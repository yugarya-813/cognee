r"""Seed engram.db so the whole demo runs clean from scratch.

Reproduces the exact state the demo expects:
  - Commit 1: the initial company knowledge base (6 facts).
  - Commit 2: the remote-work policy changes from "3 days remote" to
    "5 days in-office" (the old fact is superseded, a new one is added).

Note that PayrollRule still says "3 days in-office" at commit 2 ON PURPOSE —
that is the downstream contradiction the memory tests are meant to catch.
The fix (commit 3) is created live during the demo.

Run from the engram folder:
    .\venv\Scripts\python.exe seed.py
"""
import os
import sqlite3

DB_PATH = "engram.db"

# Start from a clean database so the demo is identical every time.
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)

conn.execute("""
    CREATE TABLE commits (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        message    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
""")
conn.execute("""
    CREATE TABLE facts (
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

# ---------------------------------------------------------------------------
# Commit 1 — the initial company knowledge base
# ---------------------------------------------------------------------------
conn.execute("INSERT INTO commits (id, message) VALUES (1, 'Initial company knowledge base')")

facts = [
    ("RemoteWorkPolicy", "allows",    "3 days per week remote",                 "hr-handbook-v1"),
    ("RemoteWorkPolicy", "requires",  "manager approval for full remote week",  "hr-handbook-v1"),
    ("Alice Chen",       "role",      "Head of Engineering",                    "org-chart-2024"),
    ("Bob Martins",      "role",      "Payroll Manager",                        "org-chart-2024"),
    ("Engineering",      "headcount", "42 employees",                           "org-chart-2024"),
    ("PayrollRule",      "requires",  "3 days in-office for bonus eligibility", "finance-policy"),
]
conn.executemany(
    "INSERT INTO facts (subject, predicate, object, source, commit_id) VALUES (?,?,?,?,1)",
    facts,
)

# ---------------------------------------------------------------------------
# Commit 2 — remote-work policy changes from 3 days remote to 5 days in-office
# ---------------------------------------------------------------------------
conn.execute("INSERT INTO commits (id, message) VALUES (2, 'Update remote-work policy to 5 days per week')")

# Supersede the old policy fact...
conn.execute(
    """
    UPDATE facts SET status = 'superseded', superseded_commit_id = 2
    WHERE subject = 'RemoteWorkPolicy'
      AND predicate = 'allows'
      AND object = '3 days per week remote'
    """
)
# ...and add the new one.
conn.execute(
    """
    INSERT INTO facts (subject, predicate, object, source, commit_id)
    VALUES ('RemoteWorkPolicy', 'allows', '5 days per week in-office', 'hr-handbook-v2', 2)
    """
)

conn.commit()

n_commits = conn.execute("SELECT COUNT(*) FROM commits").fetchone()[0]
n_facts = conn.execute("SELECT COUNT(*) FROM facts").fetchone()[0]
conn.close()

print(f"Seeded {n_commits} commits and {n_facts} facts into {DB_PATH}.")
print("PayrollRule still says '3 days' at commit 2 (the contradiction the tests catch).")
