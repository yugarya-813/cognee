r"""Seed engram.db so the whole demo runs clean from scratch.

Builds a realistic, multi-commit memory history for a fictional company
(Helix Labs) — the "git log" of an AI's memory. Each commit adds and/or
supersedes facts, so the Facts, Graph, Commits and Changes pages all have
rich, connected data to show.

The story (read it like a changelog):

  1. Initial company knowledge base
  2. Engineering org structure
  3. Finance, Sales & Support teams
  4. Company policies
  5. Products & key customer
  6. Series B — scale the Sales team
  7. Remote-work policy changes 3 days -> 5 days   <-- the headline change
  8. Payroll rule fixed to match the new policy     <-- the contradiction fix

At commit 7 the PayrollRule still says "3 days" while the remote policy moved
to "5 days" — that is the downstream contradiction the memory tests catch.
Commit 8 resolves it, so tests pass 7/7 there.

Run from the engram folder:
    .\venv\Scripts\python.exe seed.py
"""
import os
import sqlite3

DB_PATH = "engram.db"

# ---------------------------------------------------------------------------
# The history. Each commit is (message, [operations]).
#   ("add",       subject, predicate, object, source)
#   ("supersede", subject, predicate, object)            # retires an active fact
# ---------------------------------------------------------------------------
COMMITS = [
    ("Initial company knowledge base", [
        ("add", "Helix Labs", "is",                  "an AI robotics company",          "company-charter"),
        ("add", "Helix Labs", "founded in",          "2019",                            "company-charter"),
        ("add", "Helix Labs", "headquartered in",    "Austin, Texas",                   "company-charter"),
        ("add", "Helix Labs", "mission is",          "building safe household robots",  "company-charter"),
        ("add", "Dana Whitfield", "role",            "Chief Executive Officer",         "org-chart-2024"),
        ("add", "Helix Labs", "flagship product is", "the Atlas home robot",            "product-catalog"),
    ]),

    ("Add engineering org structure", [
        ("add", "Alice Chen",  "role",       "Head of Engineering",        "org-chart-2024"),
        ("add", "Engineering", "headcount",  "42 employees",               "org-chart-2024"),
        ("add", "Engineering", "reports to", "Dana Whitfield",             "org-chart-2024"),
        ("add", "Marcus Reed", "role",       "Senior Robotics Engineer",   "org-chart-2024"),
        ("add", "Marcus Reed", "works in",   "Engineering",                "org-chart-2024"),
        ("add", "Priya Nair",  "role",       "Machine Learning Lead",      "org-chart-2024"),
        ("add", "Priya Nair",  "works in",   "Engineering",                "org-chart-2024"),
    ]),

    ("Add finance, sales & support teams", [
        ("add", "Bob Martins",   "role",      "Payroll Manager",   "org-chart-2024"),
        ("add", "Bob Martins",   "works in",  "Finance",           "org-chart-2024"),
        ("add", "Finance",       "headcount", "11 employees",      "org-chart-2024"),
        ("add", "Carlos Mendez", "role",      "Head of Sales",     "org-chart-2024"),
        ("add", "Sales",         "headcount", "18 employees",      "org-chart-2024"),
        ("add", "Support",       "headcount", "9 employees",       "org-chart-2024"),
    ]),

    ("Add company policies", [
        ("add", "RemoteWorkPolicy", "allows",   "3 days per week remote",                 "hr-handbook-v1"),
        ("add", "RemoteWorkPolicy", "requires", "manager approval for occasional remote-work exceptions", "hr-handbook-v1"),
        ("add", "PayrollRule",      "requires", "3 days in-office for bonus eligibility", "finance-policy-v1"),
        ("add", "PTOPolicy",        "grants",   "20 days paid time off per year",         "hr-handbook-v1"),
        ("add", "SecurityPolicy",   "requires", "two-factor authentication for all staff","security-handbook"),
    ]),

    ("Add products & key customer", [
        ("add", "Atlas",           "is",                   "a household assistant robot", "product-catalog"),
        ("add", "Atlas",           "priced at",            "2400 dollars",                "pricing-2024"),
        ("add", "Orbit",           "is",                   "a developer robotics SDK",    "product-catalog"),
        ("add", "Northwind Retail","is",                   "our largest enterprise customer", "crm-export"),
        ("add", "Northwind Retail","signed contract worth","1.2 million dollars",         "crm-export"),
    ]),

    ("Scale the Sales team after Series B", [
        ("add",       "Helix Labs",   "raised", "60 million dollar Series B", "press-release-2025"),
        ("supersede", "Sales",         "headcount", "18 employees"),
        ("add",       "Sales",         "headcount", "31 employees",           "org-chart-2025"),
        ("supersede", "Carlos Mendez", "role", "Head of Sales"),
        ("add",       "Carlos Mendez", "role", "VP of Sales",                 "org-chart-2025"),
    ]),

    ("Update remote-work policy to 5 days per week", [
        ("supersede", "RemoteWorkPolicy", "allows",   "3 days per week remote"),
        ("add",       "RemoteWorkPolicy", "requires", "5 days per week in-office", "hr-handbook-v2"),
    ]),

    ("Fix payroll rule to match the new in-office policy", [
        ("supersede", "PayrollRule", "requires", "3 days in-office for bonus eligibility"),
        ("add",       "PayrollRule", "requires", "5 days in-office for bonus eligibility", "finance-policy-v2"),
    ]),
]


def _apply_commit(conn, commit_id: int, ops: list) -> None:
    for op in ops:
        kind = op[0]
        if kind == "add":
            _, subject, predicate, obj, source = op
            conn.execute(
                "INSERT INTO facts (subject, predicate, object, source, commit_id) VALUES (?,?,?,?,?)",
                (subject, predicate, obj, source, commit_id),
            )
        elif kind == "supersede":
            _, subject, predicate, obj = op
            conn.execute(
                """
                UPDATE facts
                SET status = 'superseded', superseded_commit_id = ?
                WHERE subject = ? AND predicate = ? AND object = ? AND status = 'active'
                """,
                (commit_id, subject, predicate, obj),
            )
        else:
            raise ValueError(f"Unknown op: {kind}")


def build(db_path: str = DB_PATH) -> dict:
    """Create a fresh database at db_path and seed the full commit history.
    Safe to call at runtime (e.g. on a serverless cold start)."""
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
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

    for i, (message, ops) in enumerate(COMMITS, start=1):
        conn.execute("INSERT INTO commits (id, message) VALUES (?, ?)", (i, message))
        _apply_commit(conn, i, ops)

    conn.commit()
    n_commits = conn.execute("SELECT COUNT(*) FROM commits").fetchone()[0]
    n_facts = conn.execute("SELECT COUNT(*) FROM facts").fetchone()[0]
    n_active = conn.execute("SELECT COUNT(*) FROM facts WHERE status='active'").fetchone()[0]
    conn.close()
    return {"commits": n_commits, "facts": n_facts, "active": n_active}


if __name__ == "__main__":
    stats = build(DB_PATH)
    print(f"Seeded {stats['commits']} commits and {stats['facts']} facts "
          f"({stats['active']} active at HEAD) into {DB_PATH}.")
    print("Commit 7 introduces the remote-policy change; PayrollRule still says '3 days' there")
    print("(the contradiction the tests catch). Commit 8 fixes it -> tests pass 7/7.")
