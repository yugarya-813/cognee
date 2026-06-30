import sqlite3

DB_PATH = "engram.db"

conn = sqlite3.connect(DB_PATH)

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

conn.execute("INSERT INTO commits (id, message) VALUES (1, 'Initial company knowledge base')")

facts = [
    ("RemoteWorkPolicy", "allows",    "3 days per week remote",                 "hr-handbook-v1"),
    ("RemoteWorkPolicy", "requires",  "manager approval for full remote week",   "hr-handbook-v1"),
    ("Alice Chen",       "role",      "Head of Engineering",                    "org-chart-2024"),
    ("Bob Martins",      "role",      "Payroll Manager",                        "org-chart-2024"),
    ("Engineering",      "headcount", "42 employees",                           "org-chart-2024"),
    ("PayrollRule",      "requires",  "3 days in-office for bonus eligibility",  "finance-policy"),
]

conn.executemany(
    "INSERT INTO facts (subject, predicate, object, source, commit_id) VALUES (?,?,?,?,1)",
    facts,
)

conn.commit()
conn.close()
print("Seeded 1 commit and 6 facts into engram.db")
