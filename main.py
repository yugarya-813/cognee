import sqlite3
import re
import os
import cognee_engine
from dotenv import load_dotenv
from litellm import acompletion
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

DB_PATH = "engram.db"

# ---------------------------------------------------------------------------
# Memory tests — 5 tests, 4 should pass at commit 2, 1 should fail
# (the PayrollRule contradiction)
# ---------------------------------------------------------------------------
TESTS = [
    {
        "id": 1,
        "name": "Remote work policy reflects the new 5-day rule",
        "question": "What is the current remote work policy?",
        "expect_contains": "5",
    },
    {
        "id": 2,
        "name": "Manager approval still required for full remote week",
        "question": "Does working fully remote require any approval?",
        "expect_contains": "manager",
    },
    {
        "id": 3,
        "name": "Alice Chen is Head of Engineering",
        "question": "What is Alice Chen's role?",
        "expect_contains": "Engineering",
    },
    {
        "id": 4,
        "name": "Engineering headcount is 42",
        "question": "How many employees are in the Engineering department?",
        "expect_contains": "42",
    },
    {
        "id": 5,
        "name": "Payroll bonus rule is consistent with the new in-office policy",
        "question": "How many days in-office does the payroll rule require for bonus eligibility?",
        "expect_contains": "5",
    },
]

app = FastAPI(title="Engram API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS commits (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                message    TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS facts (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                subject              TEXT NOT NULL,
                predicate            TEXT NOT NULL,
                object               TEXT NOT NULL,
                source               TEXT,
                commit_id            INTEGER NOT NULL,
                status               TEXT NOT NULL DEFAULT 'active',
                superseded_commit_id INTEGER,
                created_at           TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (commit_id) REFERENCES commits(id)
            )
        """)
        # Safe migration: add superseded_commit_id to existing DBs
        try:
            conn.execute("ALTER TABLE facts ADD COLUMN superseded_commit_id INTEGER")
        except Exception:
            pass  # column already exists
        conn.commit()


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class FactChange(BaseModel):
    op: str
    subject: str
    predicate: str
    object: str
    source: str = ""


class CommitRequest(BaseModel):
    message: str
    changes: list[FactChange]


class AskRequest(BaseModel):
    question: str
    commit: int


# ---------------------------------------------------------------------------
# Cognee helpers
# ---------------------------------------------------------------------------

def _facts_at_commit(commit_id: int) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT subject, predicate, object
            FROM facts
            WHERE commit_id <= ? AND (status = 'active' OR superseded_commit_id > ?)
            ORDER BY id
            """,
            (commit_id, commit_id),
        ).fetchall()


def _facts_text(rows) -> str:
    """Render fact rows as plain sentences — the input we feed Cognee."""
    return "\n".join(
        f"- {r['subject']} {r['predicate']} {r['object']}." for r in rows
    )


def _build_graph(commit_id: int) -> dict:
    """Turn the active facts at a commit into a node/relationship graph.

    Each fact triple (subject -predicate-> object) becomes two nodes and one
    edge. Nodes/edges touched by a fact ADDED at this commit are flagged
    `changed` so the UI can highlight what just moved.
    """
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, subject, predicate, object, source, commit_id, status
            FROM facts
            WHERE commit_id <= ?
              AND (status = 'active' OR (status = 'superseded' AND superseded_commit_id > ?))
            ORDER BY id
            """,
            (commit_id, commit_id),
        ).fetchall()

    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(name: str, kind: str, changed: bool):
        existing = nodes.get(name)
        if existing is None:
            nodes[name] = {"id": name, "label": name, "kind": kind, "changed": changed}
        elif changed:
            existing["changed"] = True

    for r in rows:
        is_new = r["commit_id"] == commit_id
        add_node(r["subject"], "entity", is_new)
        add_node(r["object"], "value", is_new)
        edges.append({
            "source": r["subject"],
            "target": r["object"],
            "label": r["predicate"],
            "source_ref": r["source"],
            "changed": is_new,
        })

    return {"commit": commit_id, "nodes": list(nodes.values()), "edges": edges}


_FALLBACK_MODELS = [
    "gemini/gemini-2.5-flash-lite",
    "gemini/gemini-2.0-flash",
    "gemini/gemini-2.5-flash",
]

async def _ask_llm(question: str, commit_id: int) -> list[str]:
    """Ask a question by passing all active facts as context in a single LLM call.
    Tries multiple models in order if one is rate-limited."""
    rows = _facts_at_commit(commit_id)
    if not rows:
        raise HTTPException(status_code=400, detail="No active facts at that commit.")

    facts_text = _facts_text(rows)
    messages = [
        {
            "role": "system",
            "content": (
                "You are a knowledge base assistant. "
                "Answer questions based ONLY on the provided company facts. "
                "Be concise and direct. Quote the relevant fact when possible."
            ),
        },
        {
            "role": "user",
            "content": f"Company facts:\n{facts_text}\n\nQuestion: {question}",
        },
    ]

    api_key = os.getenv("LLM_API_KEY")
    primary = os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash")
    models = [primary] + [m for m in _FALLBACK_MODELS if m != primary]

    last_err = None
    for model in models:
        try:
            response = await acompletion(model=model, messages=messages, api_key=api_key)
            return [response.choices[0].message.content], None
        except Exception as e:
            last_err = e
            err_str = str(e)
            # Retry on rate limits and temporary unavailability
            if any(x in err_str for x in ("429", "503", "quota", "UNAVAILABLE", "high demand")):
                continue
            if any(x in type(e).__name__ for x in ("RateLimit", "ServiceUnavailable")):
                continue
            # Hard error — surface it
            return None, f"LLM error ({type(e).__name__}): {err_str[:300]}"

    return None, (
        "All Gemini models are currently unavailable (rate-limited or high demand). "
        "Wait a minute and try again. "
        f"Last error: {str(last_err)[:200]}"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/commits")
def list_commits():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, message, created_at FROM commits ORDER BY id"
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/facts")
def list_facts(commit: int = Query(..., description="Return active facts as of this commit id")):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, subject, predicate, object, source, commit_id, status, created_at
            FROM facts
            WHERE commit_id <= ?
              AND (status = 'active' OR (status = 'superseded' AND superseded_commit_id > ?))
            ORDER BY id
            """,
            (commit, commit),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/commit", status_code=201)
def create_commit(body: CommitRequest):
    if not body.changes:
        raise HTTPException(status_code=400, detail="changes list cannot be empty")

    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO commits (message) VALUES (?)", (body.message,)
        )
        new_commit_id = cur.lastrowid

        for change in body.changes:
            if change.op == "add":
                conn.execute(
                    """
                    INSERT INTO facts (subject, predicate, object, source, commit_id, status)
                    VALUES (?, ?, ?, ?, ?, 'active')
                    """,
                    (change.subject, change.predicate, change.object,
                     change.source, new_commit_id),
                )
            elif change.op == "remove":
                conn.execute(
                    """
                    UPDATE facts SET status = 'superseded', superseded_commit_id = ?
                    WHERE subject = ? AND predicate = ? AND object = ? AND status = 'active'
                    """,
                    (new_commit_id, change.subject, change.predicate, change.object),
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unknown op '{change.op}'.")

        conn.commit()

    return {"commit_id": new_commit_id}


@app.get("/diff")
def diff_commits(
    from_commit: int = Query(..., alias="from"),
    to_commit:   int = Query(..., alias="to"),
):
    if from_commit >= to_commit:
        raise HTTPException(status_code=400, detail="'from' must be less than 'to'")

    with get_conn() as conn:
        # Facts added in commits (from, to]
        added = conn.execute(
            """
            SELECT subject, predicate, object, source
            FROM facts
            WHERE commit_id > ? AND commit_id <= ?
            ORDER BY id
            """,
            (from_commit, to_commit),
        ).fetchall()

        # Facts superseded in commits (from, to]
        removed = conn.execute(
            """
            SELECT subject, predicate, object, source
            FROM facts
            WHERE superseded_commit_id > ? AND superseded_commit_id <= ?
            ORDER BY id
            """,
            (from_commit, to_commit),
        ).fetchall()

    result = []
    for r in removed:
        result.append({"op": "removed", **dict(r)})
    for r in added:
        result.append({"op": "added", **dict(r)})
    return result


@app.get("/impact")
def get_impact(commit: int = Query(..., description="Commit to measure impact of")):
    """Return facts at this commit whose content overlaps with what changed."""
    with get_conn() as conn:
        prev = commit - 1

        # Find subjects that changed in this commit (added or removed)
        changed_subjects = set()

        added_rows = conn.execute(
            "SELECT DISTINCT subject FROM facts WHERE commit_id = ?",
            (commit,),
        ).fetchall()
        for r in added_rows:
            changed_subjects.add(r["subject"])

        removed_rows = conn.execute(
            "SELECT DISTINCT subject FROM facts WHERE superseded_commit_id = ?",
            (commit,),
        ).fetchall()
        for r in removed_rows:
            changed_subjects.add(r["subject"])

        if not changed_subjects:
            return {"commit": commit, "changed_subjects": [], "impacted_facts": [], "count": 0}

        # Find active facts at prev commit that mention any changed subject
        # (in subject, predicate, or object field)
        placeholders = ",".join("?" * len(changed_subjects))
        subjects_list = list(changed_subjects)

        impacted = conn.execute(
            f"""
            SELECT id, subject, predicate, object, source
            FROM facts
            WHERE commit_id <= ?
              AND (status = 'active' OR (status = 'superseded' AND superseded_commit_id > ?))
              AND (
                subject IN ({placeholders})
                OR object LIKE '%' || ? || '%'
              )
            ORDER BY id
            """,
            [prev, prev] + subjects_list + [subjects_list[0]],
        ).fetchall()

        # Broader text search: facts whose object text mentions keywords from changed subjects
        keyword_hits = conn.execute(
            """
            SELECT id, subject, predicate, object, source
            FROM facts
            WHERE commit_id <= ?
              AND (status = 'active' OR (status = 'superseded' AND superseded_commit_id > ?))
            ORDER BY id
            """,
            (prev, prev),
        ).fetchall()

        # Filter to facts whose object contains any number from changed facts' objects
        changed_objects = conn.execute(
            """
            SELECT DISTINCT object FROM facts
            WHERE commit_id = ?
               OR superseded_commit_id = ?
            """,
            (commit, commit),
        ).fetchall()

        # Extract key terms (numbers, policy-related words) from changed objects
        key_terms = set()
        for row in changed_objects:
            nums = re.findall(r'\d+', row["object"])
            key_terms.update(nums)

        related = []
        seen_ids = {r["id"] for r in impacted}
        if key_terms:
            for row in keyword_hits:
                if row["id"] not in seen_ids:
                    obj_text = row["object"].lower()
                    if any(term in obj_text for term in key_terms):
                        related.append(dict(row))
                        seen_ids.add(row["id"])

        all_impacted = [dict(r) for r in impacted] + related

    return {
        "commit": commit,
        "changed_subjects": list(changed_subjects),
        "impacted_facts": all_impacted,
        "count": len(all_impacted),
    }


# ---------------------------------------------------------------------------
# Knowledge graph — nodes & relationships (the "vector-ish" memory view)
# ---------------------------------------------------------------------------

@app.get("/graph")
def get_graph(commit: int = Query(..., description="Build the graph from active facts at this commit")):
    """Node/relationship view of the memory at a commit, straight from SQLite.

    Always available (no LLM/quota needed) so the graph renders instantly. For
    the richer Cognee-built graph use the /cognee/* endpoints below.
    """
    return _build_graph(commit)


# ---------------------------------------------------------------------------
# Cognee — the intelligence layer (vector + knowledge-graph memory)
# ---------------------------------------------------------------------------

class CogneeBuildRequest(BaseModel):
    commit: int


@app.get("/cognee/status")
def cognee_status():
    return cognee_engine.status()


@app.post("/cognee/build")
async def cognee_build(body: CogneeBuildRequest):
    """Feed the active facts at a commit into Cognee and build its graph."""
    rows = _facts_at_commit(body.commit)
    if not rows:
        raise HTTPException(status_code=400, detail="No active facts at that commit.")
    result = await cognee_engine.build_memory(_facts_text(rows), body.commit)
    if not result["ok"]:
        return JSONResponse(status_code=503, content={"detail": result["message"]})
    return result


@app.get("/cognee/graph")
async def cognee_graph():
    """Return the knowledge graph Cognee currently holds (after a build)."""
    result = await cognee_engine.graph()
    if not result["ok"]:
        return JSONResponse(status_code=503, content={"detail": result["message"]})
    return {"nodes": result["nodes"], "edges": result["edges"]}


@app.post("/cognee/ask")
async def cognee_ask(body: AskRequest):
    """Ask Cognee using graph-aware retrieval, falling back to a direct LLM
    call over the same facts if Cognee is unavailable."""
    answer, err = await cognee_engine.ask(body.question)
    if err:
        # Graceful fallback so the demo never dead-ends.
        answers, llm_err = await _ask_llm(body.question, body.commit)
        if llm_err:
            return JSONResponse(status_code=503, content={"detail": f"{err} | Fallback: {llm_err}"})
        return {"question": body.question, "commit": body.commit, "answers": answers, "engine": "llm-fallback"}
    return {"question": body.question, "commit": body.commit, "answers": [answer], "engine": "cognee"}


@app.post("/ingest")
async def ingest():
    """No-op kept for API compatibility — ask now uses direct LLM calls."""
    with get_conn() as conn:
        max_commit = conn.execute("SELECT MAX(id) FROM commits").fetchone()[0] or 1
    rows = _facts_at_commit(max_commit)
    return {"status": "ready", "facts_loaded": len(rows), "at_commit": max_commit}


@app.post("/ask")
async def ask(body: AskRequest):
    answers, err = await _ask_llm(body.question, body.commit)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})
    return {"question": body.question, "commit": body.commit, "answers": answers}


# ---------------------------------------------------------------------------
# Test endpoints
# ---------------------------------------------------------------------------

@app.get("/tests")
def get_tests():
    return TESTS


@app.post("/tests/run")
async def run_tests(commit: int = Query(...)):

    passed = 0
    failed = 0
    results = []

    for test in TESTS:
        answers, err = await _ask_llm(test["question"], commit)
        if err:
            return JSONResponse(status_code=503, content={"detail": err})
        answer_text = " ".join(answers).lower()
        ok = test["expect_contains"].lower() in answer_text

        if ok:
            passed += 1
        else:
            failed += 1

        results.append({
            "id": test["id"],
            "name": test["name"],
            "question": test["question"],
            "expect_contains": test["expect_contains"],
            "passed": ok,
            "answer": answers,
        })

    return {
        "commit": commit,
        "passed": passed,
        "failed": failed,
        "total": len(TESTS),
        "results": results,
    }
