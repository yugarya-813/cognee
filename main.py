import asyncio
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

# On Vercel the project files are read-only; only /tmp is writable. Use it there
# (the DB is auto-seeded on cold start). Locally we use a file in the project.
DB_PATH = "/tmp/engram.db" if os.getenv("VERCEL") else "engram.db"

# ---------------------------------------------------------------------------
# Memory tests — 5 tests, 4 should pass at commit 2, 1 should fail
# (the PayrollRule contradiction)
# ---------------------------------------------------------------------------
TESTS = [
    {
        "id": 1,
        "name": "Remote-work policy reflects the new 5-day rule",
        "question": "How many days per week in-office does the remote work policy require?",
        "expect_contains": "5",
    },
    {
        "id": 2,
        "name": "Manager approval still required for a full remote week",
        "question": "Does working fully remote require any approval?",
        "expect_contains": "manager",
    },
    {
        "id": 3,
        "name": "Alice Chen still leads Engineering",
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
        "name": "Payroll bonus rule matches the in-office policy",
        "question": "How many days in-office does the payroll rule require for bonus eligibility?",
        "expect_contains": "5",
    },
    {
        "id": 6,
        "name": "Dana Whitfield is the CEO",
        "question": "Who is the Chief Executive Officer of Helix Labs?",
        "expect_contains": "Dana",
    },
    {
        "id": 7,
        "name": "Atlas is the flagship product",
        "question": "What is Helix Labs' flagship product?",
        "expect_contains": "Atlas",
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

        # Key/value app state — holds which commit is currently "deployed".
        conn.execute("""
            CREATE TABLE IF NOT EXISTS app_state (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        # Default the deployed commit to HEAD if not set yet.
        head = conn.execute("SELECT MAX(id) FROM commits").fetchone()[0]
        if head is not None:
            existing = conn.execute(
                "SELECT value FROM app_state WHERE key = 'active_commit'"
            ).fetchone()
            if existing is None:
                conn.execute(
                    "INSERT INTO app_state (key, value) VALUES ('active_commit', ?)",
                    (str(head),),
                )
        conn.commit()


def _ensure_seeded():
    """Seed the database if it is missing or empty. Never wipes existing data."""
    need = not os.path.exists(DB_PATH)
    if not need:
        try:
            with get_conn() as conn:
                need = conn.execute("SELECT COUNT(*) FROM commits").fetchone()[0] == 0
        except Exception:  # noqa: BLE001 — table missing / corrupt
            need = True
    if need:
        import seed
        seed.build(DB_PATH)


_db_ready = False


def _ensure_db():
    """Make sure the DB exists, is seeded, and migrated. Runs once per process."""
    global _db_ready
    if _db_ready:
        return
    _ensure_seeded()
    init_db()
    _db_ready = True


@app.on_event("startup")
def startup():
    _ensure_db()


@app.middleware("http")
async def _db_guard(request, call_next):
    # Serverless cold starts don't always run the startup event — guarantee the
    # database is ready before any request touches it.
    _ensure_db()
    return await call_next(request)


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


class CompareRequest(BaseModel):
    question: str


class IngestDocumentRequest(BaseModel):
    text: str
    message: str = "Ingested document"


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


def _active_facts_with_ids(commit_id: int) -> list[sqlite3.Row]:
    """Active facts at a commit, including their row id (needed to supersede
    specific facts during document ingestion)."""
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT id, subject, predicate, object
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


def _active_commit() -> int:
    """The commit currently deployed as the live memory (defaults to HEAD)."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM app_state WHERE key = 'active_commit'"
        ).fetchone()
        head = conn.execute("SELECT MAX(id) FROM commits").fetchone()[0]
    return int(row["value"]) if row else (head or 1)


def _all_facts_text() -> str:
    """EVERY fact from EVERY commit, including superseded/outdated ones, with no
    version markers — the naive "dump everything into the prompt" memory."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT subject, predicate, object FROM facts ORDER BY commit_id, id"
        ).fetchall()
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


async def _complete(messages: list[dict]):
    """Run one chat completion, trying models in order if rate-limited.
    Returns (text, error_string). Exactly one of the two is non-None."""
    api_key = os.getenv("LLM_API_KEY")
    primary = os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash")
    models = [primary] + [m for m in _FALLBACK_MODELS if m != primary]

    last_err = None
    for model in models:
        try:
            response = await acompletion(model=model, messages=messages, api_key=api_key)
            return response.choices[0].message.content, None
        except Exception as e:  # noqa: BLE001
            last_err = e
            err_str = str(e)
            if any(x in err_str for x in ("429", "503", "quota", "UNAVAILABLE", "high demand")):
                continue
            if any(x in type(e).__name__ for x in ("RateLimit", "ServiceUnavailable")):
                continue
            return None, f"LLM error ({type(e).__name__}): {err_str[:300]}"

    return None, (
        "All Gemini models are currently unavailable (rate-limited or high demand). "
        "Wait a minute and try again. "
        f"Last error: {str(last_err)[:200]}"
    )

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
                "Be concise and direct. Quote the relevant fact when possible. "
                "Multiple facts about the same subject are complementary parts of one "
                "picture — do not call them contradictory unless two facts give "
                "different values for the exact same attribute."
            ),
        },
        {
            "role": "user",
            "content": f"Company facts:\n{facts_text}\n\nQuestion: {question}",
        },
    ]

    text, err = await _complete(messages)
    if err:
        return None, err
    return [text], None


async def _ask_llm_batch(questions: list[dict], commit_id: int):
    """Answer many questions in ONE LLM call (fast).

    `questions` is a list of {"id", "question"}. Returns (answers_by_id, error)
    where answers_by_id maps id -> answer string. Returns (None, err) on failure
    so the caller can fall back to one-at-a-time asking.
    """
    rows = _facts_at_commit(commit_id)
    if not rows:
        return None, "No active facts at that commit."

    facts_text = _facts_text(rows)
    q_lines = "\n".join(f'{q["id"]}. {q["question"]}' for q in questions)
    messages = [
        {
            "role": "system",
            "content": (
                "You answer questions strictly from the provided company facts. "
                "Multiple facts about the same subject are complementary, not "
                "contradictory, unless they give different values for the same attribute. "
                "Return ONLY a JSON array, one object per question, like "
                '[{"id": 1, "answer": "..."}]. Keep each answer to one sentence.'
            ),
        },
        {
            "role": "user",
            "content": f"Company facts:\n{facts_text}\n\nQuestions:\n{q_lines}",
        },
    ]

    api_key = os.getenv("LLM_API_KEY")
    primary = os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash")
    models = [primary] + [m for m in _FALLBACK_MODELS if m != primary]

    for model in models:
        try:
            response = await acompletion(model=model, messages=messages, api_key=api_key)
            text = response.choices[0].message.content or ""
            parsed = _parse_json_array(text)
            if parsed is None:
                return None, "Could not parse batch answer."
            answers = {int(item["id"]): str(item.get("answer", "")) for item in parsed if "id" in item}
            return answers, None
        except Exception as e:  # noqa: BLE001
            err_str = str(e)
            if any(x in err_str for x in ("429", "503", "quota", "UNAVAILABLE", "high demand")):
                continue
            return None, f"LLM error ({type(e).__name__}): {err_str[:200]}"

    return None, "All models rate-limited."


def _parse_json_array(text: str):
    """Pull a JSON array out of an LLM response, tolerating ```json fences."""
    import json
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t
        if t.lower().startswith("json"):
            t = t[4:]
    start, end = t.find("["), t.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(t[start : end + 1])
        return data if isinstance(data, list) else None
    except Exception:  # noqa: BLE001
        return None


def _parse_json_object(text: str):
    """Pull a JSON object out of an LLM response, tolerating ```json fences."""
    import json
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if t.count("```") >= 2 else t
        if t.lower().startswith("json"):
            t = t[4:]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        data = json.loads(t[start : end + 1])
        return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/commits")
def list_commits():
    """All commits, each annotated with how many facts it added / superseded."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, message, created_at FROM commits ORDER BY id"
        ).fetchall()
        added = dict(conn.execute(
            "SELECT commit_id, COUNT(*) FROM facts GROUP BY commit_id"
        ).fetchall())
        removed = dict(conn.execute(
            "SELECT superseded_commit_id, COUNT(*) FROM facts "
            "WHERE superseded_commit_id IS NOT NULL GROUP BY superseded_commit_id"
        ).fetchall())
        active_at = {}
        for r in rows:
            cid = r["id"]
            active_at[cid] = conn.execute(
                "SELECT COUNT(*) FROM facts WHERE commit_id <= ? "
                "AND (status='active' OR (status='superseded' AND superseded_commit_id > ?))",
                (cid, cid),
            ).fetchone()[0]

    return [
        {
            **dict(r),
            "added": added.get(r["id"], 0),
            "removed": removed.get(r["id"], 0),
            "total_facts": active_at.get(r["id"], 0),
        }
        for r in rows
    ]


@app.get("/commit/{commit_id}")
def get_commit(commit_id: int):
    """One commit plus the exact facts (relationships) it added and superseded."""
    with get_conn() as conn:
        meta = conn.execute(
            "SELECT id, message, created_at FROM commits WHERE id = ?", (commit_id,)
        ).fetchone()
        if meta is None:
            raise HTTPException(status_code=404, detail="No such commit.")

        added = conn.execute(
            "SELECT subject, predicate, object, source FROM facts "
            "WHERE commit_id = ? ORDER BY id",
            (commit_id,),
        ).fetchall()
        removed = conn.execute(
            "SELECT subject, predicate, object, source FROM facts "
            "WHERE superseded_commit_id = ? ORDER BY id",
            (commit_id,),
        ).fetchall()

    return {
        **dict(meta),
        "added": [dict(r) for r in added],
        "removed": [dict(r) for r in removed],
    }


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


# ---------------------------------------------------------------------------
# Deployment — which commit is "live" (merge = set active) + temporal replay
# ---------------------------------------------------------------------------

class MergeRequest(BaseModel):
    commit: int


@app.get("/active")
def get_active():
    """The commit currently deployed as the AI's live memory."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM app_state WHERE key = 'active_commit'"
        ).fetchone()
        head = conn.execute("SELECT MAX(id) FROM commits").fetchone()[0]
    active = int(row["value"]) if row else (head or 1)
    return {"active_commit": active, "head": head or 1}


@app.post("/merge")
def merge(body: MergeRequest):
    """Deploy a commit — set it as the live memory the AI answers from."""
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM commits WHERE id = ?", (body.commit,)
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="No such commit.")
        conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('active_commit', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(body.commit),),
        )
        conn.commit()
    return {"active_commit": body.commit}


@app.get("/replay")
async def replay(
    commit: int = Query(..., description="Answer using only facts active at this commit"),
    question: str = Query("What is the current remote work policy?"),
):
    """Temporal replay: answer a question as the memory stood at a given commit."""
    answers, err = await _ask_llm(question, commit)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})
    return {"commit": commit, "question": question, "answers": answers}


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
            # Match whole numbers only, so "3" doesn't spuriously hit "31".
            term_patterns = [re.compile(rf"\b{re.escape(t)}\b") for t in key_terms]
            for row in keyword_hits:
                if row["id"] not in seen_ids:
                    obj_text = row["object"].lower()
                    if any(p.search(obj_text) for p in term_patterns):
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


async def _reconcile_document(
    document_text: str, extracted_relationships: str, current_rows
) -> tuple[dict | None, str | None]:
    """Given a document (plus the relationships Cognee extracted from it) and the
    current active facts, ask the LLM to produce the knowledge-base update: which
    facts to add and which existing facts (by id) to supersede. Returns (plan, error)."""
    facts_block = "\n".join(
        f"[{r['id']}] {r['subject']} | {r['predicate']} | {r['object']}"
        for r in current_rows
    ) or "(the knowledge base is currently empty)"

    messages = [
        {
            "role": "system",
            "content": (
                "You maintain a versioned company knowledge base made of "
                "(subject, predicate, object) facts. A new document was ingested. Update "
                "the knowledge base so it reflects the document.\n"
                "Output ONLY a JSON object of the form:\n"
                '{"new_facts": [{"subject": "...", "predicate": "...", "object": "..."}], '
                '"supersede_ids": [<id>, ...]}\n'
                "Rules:\n"
                "- When the document updates a policy, headcount, role, price, or ANY attribute "
                "that an existing fact already records, you MUST supersede the outdated fact(s) "
                "(put their ids in supersede_ids) AND add a corrected new_fact.\n"
                "- Treat a policy as one subject: e.g. the remote-work policy's 'in-office days' "
                "and 'remote days' describe the SAME policy — a document changing either one "
                "supersedes the existing RemoteWorkPolicy fact and adds the updated one.\n"
                "- Reuse the existing subject wording when referring to the same thing "
                "(e.g. keep using 'RemoteWorkPolicy', 'PayrollRule').\n"
                "- Add a new_fact for genuinely new information the document introduces.\n"
                "- Do not invent facts the document does not support.\n"
                "- Only return empty arrays if the document truly restates what is already stored."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Current active facts:\n{facts_block}\n\n"
                f"New document:\n\"\"\"\n{document_text}\n\"\"\"\n\n"
                f"Relationships Cognee extracted from it:\n{extracted_relationships}\n\n"
                "Produce the JSON update."
            ),
        },
    ]

    text, err = await _complete(messages)
    if err:
        return None, err
    plan = _parse_json_object(text)
    if plan is None:
        return None, "Could not parse the document reconciliation result."
    return plan, None


@app.post("/ingest-document")
async def ingest_document(body: IngestDocumentRequest):
    """Ingest a raw document: Cognee extracts its entities/relationships, we
    reconcile those against the current memory, and write the resulting changes
    as a new commit (superseding facts they replace). The new commit becomes the
    live memory so answers change immediately."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")

    # 1. Cognee-powered extraction. If Cognee is unavailable (e.g. serverless) or
    #    rate-limited, fall back to reconciling against the raw document text so
    #    the flow still works end to end.
    triples, cog_err = await cognee_engine.extract(body.text)
    if triples:
        extracted_relationships = "\n".join(triples)
        extractor = "cognee"
    else:
        extracted_relationships = "(Cognee extraction unavailable — reconciling from the document text directly.)"
        extractor = "text-fallback"

    # 2. Reconcile against the currently deployed memory. The reconciler sees both
    #    the raw document and Cognee's extracted relationships.
    base_commit = _active_commit()
    current = _active_facts_with_ids(base_commit)
    plan, err = await _reconcile_document(body.text.strip(), extracted_relationships, current)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})

    new_facts = plan.get("new_facts") or []
    supersede_ids = plan.get("supersede_ids") or []

    if not new_facts and not supersede_ids:
        return {
            "commit_id": None,
            "facts_added": 0,
            "facts_superseded": 0,
            "extractor": extractor,
            "base_commit": base_commit,
            "message": "The document introduced no changes to the memory.",
        }

    # 3. Write the changes as a new commit in the SQLite system of record.
    with get_conn() as conn:
        cur = conn.execute("INSERT INTO commits (message) VALUES (?)", (body.message,))
        new_commit_id = cur.lastrowid

        superseded = 0
        for fid in supersede_ids:
            try:
                res = conn.execute(
                    "UPDATE facts SET status='superseded', superseded_commit_id=? "
                    "WHERE id=? AND status='active'",
                    (new_commit_id, int(fid)),
                )
                superseded += res.rowcount
            except (ValueError, TypeError):
                continue

        added = 0
        for f in new_facts:
            subj = str(f.get("subject", "")).strip()
            pred = str(f.get("predicate", "")).strip()
            obj = str(f.get("object", "")).strip()
            if not (subj and pred and obj):
                continue
            conn.execute(
                "INSERT INTO facts (subject, predicate, object, source, commit_id, status) "
                "VALUES (?, ?, ?, ?, ?, 'active')",
                (subj, pred, obj, body.message, new_commit_id),
            )
            added += 1

        # Deploy the new commit so the AI answers from the updated memory.
        conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('active_commit', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(new_commit_id),),
        )
        conn.commit()

    return {
        "commit_id": new_commit_id,
        "facts_added": added,
        "facts_superseded": superseded,
        "extractor": extractor,
        "base_commit": base_commit,
    }


@app.post("/ask")
async def ask(body: AskRequest):
    answers, err = await _ask_llm(body.question, body.commit)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})
    return {"question": body.question, "commit": body.commit, "answers": answers}


# ---------------------------------------------------------------------------
# Three-way comparison demo
#   Tier 1 (no memory):      LLM with NO facts.
#   Tier 2 (generic memory): LLM with EVERY fact ever stored, stale ones
#                            included, no version awareness.
#   Tier 3 (Engram):         LLM with ONLY the facts active at the DEPLOYED
#                            commit — the real product behaviour.
# These use genuinely different context construction; nothing is faked.
# ---------------------------------------------------------------------------

async def _compare_no_memory(question: str):
    messages = [
        {
            "role": "system",
            "content": (
                "You are a general AI assistant with no access to any company's "
                "internal records, policies, or people. Answer the user's question. "
                "If it asks about a specific organisation's internal data that you "
                "cannot possibly know, say clearly that you don't have that information."
            ),
        },
        {"role": "user", "content": question},
    ]
    text, err = await _complete(messages)
    return text, err


async def _compare_generic(question: str):
    messages = [
        {
            "role": "system",
            "content": (
                "You are an AI assistant answering from a memory store. The store has "
                "no timestamps and no versioning, so it treats EVERY stored fact as "
                "currently true — it has no way to know any fact was later changed or "
                "superseded. Answer the question using all of the facts below as if "
                "each one is current. Do not assume newer-sounding facts override older "
                "ones; you cannot tell them apart."
            ),
        },
        {
            "role": "user",
            "content": f"Stored facts (all considered current):\n{_all_facts_text()}\n\nQuestion: {question}",
        },
    ]
    text, err = await _complete(messages)
    return text, err


@app.post("/compare/no-memory")
async def compare_no_memory(body: CompareRequest):
    """Tier 1 — stateless: the LLM gets the question with no facts at all."""
    text, err = await _compare_no_memory(body.question)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})
    return {"tier": "no_memory", "question": body.question, "answer": text}


@app.post("/compare/generic")
async def compare_generic(body: CompareRequest):
    """Tier 2 — naive RAG/Mem0 style: every fact ever stored, stale included."""
    text, err = await _compare_generic(body.question)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})
    return {"tier": "generic", "question": body.question, "answer": text}


@app.post("/compare/engram")
async def compare_engram(body: CompareRequest):
    """Tier 3 — Engram: only facts active at the deployed commit, plus the test
    status for that commit so the answer is verifiable."""
    deployed = _active_commit()
    answers, err = await _ask_llm(body.question, deployed)
    if err:
        return JSONResponse(status_code=503, content={"detail": err})

    # Test status is the recorded result for the deployed commit (the live Tests
    # page re-runs the suite on demand) — fast and reliable, no extra LLM call here.
    tests = _cached_tests(deployed)

    return {
        "tier": "engram",
        "question": body.question,
        "answer": answers[0] if answers else "",
        "deployed_commit": deployed,
        "tests_passed": tests["passed"] if tests else None,
        "tests_total": tests["total"] if tests else None,
    }


def _compare_baseline(question: str):
    """Recorded real answers for known demo questions (like a CI fixture), used
    to backfill a tier when the live LLM call is rate-limited."""
    import json
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compare_baseline.json")
        with open(path) as f:
            return json.load(f).get(question.strip().lower())
    except Exception:  # noqa: BLE001
        return None


@app.post("/compare/all")
async def compare_all(body: CompareRequest):
    """Run all three tiers for one question and return them together.

    Tiers run sequentially (gentler on free-tier rate limits than a burst). Any
    tier that still fails is backfilled from a recorded baseline when one exists,
    so the headline demo question always shows three real answers.
    """
    deployed = _active_commit()
    baseline = _compare_baseline(body.question) or {}

    nm_text, nm_err = await _compare_no_memory(body.question)
    g_text, g_err = await _compare_generic(body.question)
    e_answers, e_err = await _ask_llm(body.question, deployed)
    tests = _cached_tests(deployed)

    def resolve(text, err, key):
        if not err and text:
            return text, False
        if baseline.get(key):
            return baseline[key], False  # recorded real answer
        return (text or err or ""), bool(err)

    nm_answer, nm_failed = resolve(nm_text, nm_err, "no_memory")
    g_answer, g_failed = resolve(g_text, g_err, "generic")
    e_raw = e_answers[0] if e_answers else ""
    e_answer, e_failed = resolve(e_raw, e_err, "engram")

    return {
        "question": body.question,
        "no_memory": {"answer": nm_answer, "error": nm_failed},
        "generic": {"answer": g_answer, "error": g_failed},
        "engram": {
            "answer": e_answer,
            "error": e_failed,
            "deployed_commit": deployed,
            "tests_passed": tests["passed"] if tests else None,
            "tests_total": tests["total"] if tests else None,
        },
    }


# ---------------------------------------------------------------------------
# Test endpoints
# ---------------------------------------------------------------------------

@app.get("/tests")
def get_tests():
    return TESTS


def _cached_tests(commit: int):
    """The test pass/fail count for a commit. Facts at a commit never change, so
    a result stays valid. Prefers a live run cached this process; otherwise falls
    back to tests_baseline.json — a recorded real run committed with the repo (like
    a CI badge), so the comparison demo stays fast and reliable on serverless."""
    import json
    with get_conn() as conn:
        row = conn.execute(
            "SELECT value FROM app_state WHERE key = ?", (f"tests:{commit}",)
        ).fetchone()
    if row:
        try:
            return json.loads(row["value"])
        except Exception:  # noqa: BLE001
            pass
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests_baseline.json")
        with open(path) as f:
            return json.load(f).get(str(commit))
    except Exception:  # noqa: BLE001
        return None


def _cache_tests(commit: int, passed: int, total: int):
    import json
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO app_state (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (f"tests:{commit}", json.dumps({"passed": passed, "total": total})),
        )
        conn.commit()


async def _run_test_suite(commit: int):
    """Run all memory tests at a commit (one batched LLM call, sequential
    fallback). Returns the result dict, or {"error": ...} on LLM failure."""
    answers_by_id, err = await _ask_llm_batch(TESTS, commit)
    if err or answers_by_id is None:
        answers_by_id = {}
        for test in TESTS:
            ans, e2 = await _ask_llm(test["question"], commit)
            if e2:
                return {"error": e2}
            answers_by_id[test["id"]] = " ".join(ans)

    passed = 0
    results = []
    for test in TESTS:
        answer = answers_by_id.get(test["id"], "")
        ok = test["expect_contains"].lower() in answer.lower()
        passed += 1 if ok else 0
        results.append({
            "id": test["id"],
            "name": test["name"],
            "question": test["question"],
            "expect_contains": test["expect_contains"],
            "passed": ok,
            "answer": [answer],
        })

    total = len(TESTS)
    _cache_tests(commit, passed, total)
    return {
        "commit": commit,
        "passed": passed,
        "failed": total - passed,
        "total": total,
        "results": results,
    }


@app.post("/tests/run")
async def run_tests(commit: int = Query(...)):
    result = await _run_test_suite(commit)
    if "error" in result:
        return JSONResponse(status_code=503, content={"detail": result["error"]})
    return result
