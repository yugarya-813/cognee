import sqlite3
import cognee
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = "engram.db"

app = FastAPI(title="Engram API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tracks which commit is currently loaded in Cognee so we only re-ingest when needed
_cognee_loaded_commit: int | None = None


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
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                subject    TEXT NOT NULL,
                predicate  TEXT NOT NULL,
                object     TEXT NOT NULL,
                source     TEXT,
                commit_id  INTEGER NOT NULL,
                status     TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (commit_id) REFERENCES commits(id)
            )
        """)
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
            WHERE commit_id <= ? AND status = 'active'
            ORDER BY id
            """,
            (commit_id,),
        ).fetchall()


async def _load_cognee(commit_id: int):
    global _cognee_loaded_commit
    if _cognee_loaded_commit == commit_id:
        return  # already loaded

    rows = _facts_at_commit(commit_id)
    if not rows:
        raise HTTPException(status_code=400, detail="No active facts at that commit.")

    text = "\n".join(f"{r['subject']} {r['predicate']} {r['object']}." for r in rows)

    await cognee.prune.prune_data()
    await cognee.prune.prune_system(metadata=True)
    await cognee.add(text)
    await cognee.cognify()
    _cognee_loaded_commit = commit_id


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
            WHERE commit_id <= ? AND status = 'active'
            ORDER BY id
            """,
            (commit,),
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
                    UPDATE facts SET status = 'superseded'
                    WHERE subject = ? AND predicate = ? AND object = ? AND status = 'active'
                    """,
                    (change.subject, change.predicate, change.object),
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unknown op '{change.op}'.")

        conn.commit()

    global _cognee_loaded_commit
    _cognee_loaded_commit = None  # invalidate cache so next /ask re-ingests

    return {"commit_id": new_commit_id}


@app.get("/diff")
def diff_commits(
    from_commit: int = Query(..., alias="from"),
    to_commit:   int = Query(..., alias="to"),
):
    if from_commit >= to_commit:
        raise HTTPException(status_code=400, detail="'from' must be less than 'to'")

    with get_conn() as conn:
        added = conn.execute(
            """
            SELECT subject, predicate, object FROM facts
            WHERE commit_id > ? AND commit_id <= ?
              AND status IN ('active', 'superseded')
            ORDER BY id
            """,
            (from_commit, to_commit),
        ).fetchall()

        removed = conn.execute(
            """
            SELECT subject, predicate, object FROM facts
            WHERE commit_id <= ? AND status = 'superseded'
            ORDER BY id
            """,
            (from_commit,),
        ).fetchall()

    result = []
    for r in added:
        result.append({"op": "added", **dict(r)})
    for r in removed:
        result.append({"op": "removed", **dict(r)})
    return result


@app.post("/ingest")
async def ingest():
    """Load ALL current active facts into Cognee (convenience endpoint)."""
    with get_conn() as conn:
        max_commit = conn.execute("SELECT MAX(id) FROM commits").fetchone()[0] or 1
    await _load_cognee(max_commit)
    rows = _facts_at_commit(max_commit)
    return {"status": "ingested", "facts_loaded": len(rows), "at_commit": max_commit}


@app.post("/ask")
async def ask(body: AskRequest):
    """Ask a natural language question about memory at a specific commit."""
    await _load_cognee(body.commit)

    results = await cognee.search(body.question)

    answers = []
    for r in results:
        raw = r if isinstance(r, dict) else (r.__dict__ if hasattr(r, "__dict__") else {})
        for item in raw.get("search_result", []):
            if isinstance(item, dict):
                text = item.get("text") or item.get("content") or item.get("name") or str(item)
                answers.append(text)
            else:
                answers.append(str(item))

    return {"question": body.question, "commit": body.commit, "answers": answers}
