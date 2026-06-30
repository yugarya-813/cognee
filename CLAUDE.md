# ENGRAM — Master build plan for Claude Code

## WHAT WE ARE BUILDING
Engram = "GitHub for an AI's memory." Companies give AIs long-term memory, but
once they do, nobody can see what the AI knows, test it, review changes, or undo
bad updates. Engram lets you VERSION, TEST, REVIEW, and REPLAY an AI's memory —
the way GitHub does for code.

The memory engine is **Cognee** (installed and working in this folder's venv).
We are building the platform AROUND Cognee, not replacing it.

The whole product is proven by ONE demo: a company changes its remote-work policy
from 3 days to 5 days; Engram shows the change as a reviewable diff, runs tests
that CATCH a downstream contradiction (a payroll rule still says 3 days), we fix
it, merge, then ask the AI and get the right answer — and can rewind time to show
what it believed before.

## ARCHITECTURE (follow this split exactly)
- **SQLite = system of record.** Facts are versioned rows. A "commit" is a version
  marker. A "diff" between commits is computed in SQL. Versioning lives here.
- **Cognee = system of intelligence.** We feed it the current facts so it can
  answer questions and reason over the knowledge graph.
- **FastAPI backend** exposes endpoints (runs on http://localhost:8000).
- **Next.js + Tailwind frontend** (runs on http://localhost:3000) calls the backend.

## DATA MODEL
- facts: id, subject, predicate, object, source, commit_id (int), status
  ('active'/'superseded'), created_at
- commits: id, message, created_at
A fact is a triple, e.g. (subject="RemoteWorkPolicy", predicate="allows",
object="3 days per week").

## HARD RULES (always)
- Windows + PowerShell. NEVER give Linux/bash commands.
- Always run backend Python as: .\venv\Scripts\python.exe  (plain 'python' is the wrong interpreter)
- .env is configured for Gemini — do NOT change Cognee's model config.
  Working config: LLM=gemini/gemini-2.5-flash, EMBEDDING=gemini/gemini-embedding-001, dims=3072
- Keep code simple and readable — I am not an expert.
- Enable CORS on FastAPI so the frontend (localhost:3000) can call it.
- Use SQLite for everything (no Postgres setup).

## UI STYLE (for all frontend work)
- Clean, modern, minimal dashboard. Think Linear / Vercel: lots of whitespace,
  neutral palette (white/very light gray background, one accent color), system or
  Inter font, subtle 1px borders, gentle rounded corners, NO heavy shadows or
  gradients, NO clutter.
- Layout: a thin left sidebar with the app name "Engram" and nav links
  (Facts, Commits), and a main content area.
- Data shows in simple cards or a clean table. Readable, generous spacing.
- It must look intentional and tidy, but DO NOT over-engineer — basic and usable
  beats fancy and broken.
- Use Tailwind utility classes. No component libraries needed for Day 1.

## HOW YOU MUST WORK (critical)
- Build ONE DAY at a time. I will say "Let's do Day N."
- Within a day, build in small checkpoints. After EACH checkpoint:
  1. Tell me the exact PowerShell command to test it.
  2. Tell me EXACTLY what I should see if it worked (the approval check).
  3. STOP and wait for me to say "continue" or "next."
- Never jump ahead to a future day. Never dump multiple days of code at once.
- If I paste an error, fix that one thing before moving on.
- Backend and frontend are separate folders. Keep the backend in the current
  folder; create the Next.js app in a subfolder called `frontend`.

## THE 7-DAY ROADMAP

### DAY 1 — Backend skeleton + database + a basic clean UI (NO Cognee yet)
BACKEND: FastAPI app with CORS; /health endpoint; SQLite with facts+commits
tables; a seed script inserting ~6 facts about a fake company (remote-work policy
= 3 days, two people, a department, and a payroll rule that references "3 days")
under commit 1; read endpoints GET /facts?commit=N and GET /commits; write
endpoint POST /commit; GET /diff?from=A&to=B returning add/supersede ops.
FRONTEND: a Next.js + Tailwind app in `frontend/` per the UI STYLE above. A
sidebar (Engram + nav: Facts, Commits). A "Facts" page that fetches
GET /facts?commit=1 and shows the facts in a clean table (columns: Subject,
Predicate, Object, Source). A "Commits" page that lists commits. A small header
showing total fact count.
APPROVAL CHECKS:
  - Backend: browser http://localhost:8000/facts?commit=1 returns the 6 facts as JSON.
  - Frontend: browser http://localhost:3000 shows a clean dashboard with the
    sidebar on the left and a tidy table of the 6 facts in the main area, looking
    minimal and intentional (not a raw unstyled list).

### DAY 2 — Wire in Cognee (the intelligence layer)
Build: a module that takes the active facts at a commit, feeds them into Cognee
(add + cognify), and POST /ask {question, commit} returning Cognee's answer.
Add a simple "Ask" box in the UI that posts a question and shows the answer.
APPROVAL CHECK: asking "What is the remote work policy?" returns an answer
containing "3 days", shown in the UI.

### DAY 3 — The change + the diff that matters
Build: create commit 2 changing the remote-work policy to "5 days per week"
(supersede old fact, add new). GET /diff?from=1&to=2 clearly shows supersede +
add. GET /impact?commit=N returns counts (facts mentioning the changed subject).
A "Changes" page in the UI renders the diff as a clean +/- list.
APPROVAL CHECK: the Changes page shows the policy going 3→5 days; asking at
commit 2 answers "5 days".

### DAY 4 — Memory tests (THE HEART) + the caught contradiction
Build: a memory-test runner. A test = {name, question, expect_contains}; passes
if the /ask answer contains the expected text. Write 5 tests for commit 2,
including one checking the payroll rule is consistent with the new policy — and
make it FAIL because the payroll fact still says "3 days". POST /tests/run?commit=N
returns {passed, failed, results:[...]}. A "Tests" page renders pass/fail rows.
APPROVAL CHECK: tests on commit 2 show 4 passed / 1 failed, the failure being the
payroll contradiction, displayed clearly in the UI (green checks, one red).

### DAY 5 — Fix (improve/forget) + merge + temporal replay
Build: an action that fixes the payroll fact (supersede with a 5-day version) as
commit 3 → tests pass 5/5. A notion of the active/deployed commit (merge = set
active). GET /replay?commit=N answers a question using only facts active then.
A "Replay" control in the UI to scrub between commits and see the answer change.
APPROVAL CHECK: after the fix, tests on commit 3 = 5/0; replay shows "3 days" at
commit 1 and "5 days" at commit 3.

### DAY 6 — Polish, seed lock, demo dry-run, backup recording
Build: finalize seed data so the whole demo runs clean from scratch; tidy the UI;
write a README; help script the 6-step demo. NO new features — make it bulletproof.
APPROVAL CHECK: I can run the full demo end to end twice in a row without errors.

### DAY 7 — Buffer only
Bug fixes, final submission prep. No new features.

## START
When I say "Let's do Day 1," begin Day 1 at its first checkpoint (backend first,
then frontend) and follow the "HOW YOU MUST WORK" rules.