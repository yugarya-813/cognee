"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API } from "../config";
import { RelationshipLine, type Triple } from "../components/Relationship";

interface CommitDetail { id: number; message: string; added: Triple[]; removed: Triple[] }
interface DiffRow { op: "added" | "removed"; subject: string; predicate: string; object: string; source: string }
interface ContraPair { fact_a: Triple; fact_b: Triple; reason: string }

const STEPS = [
  { n: 1, id: "change",  label: "Change" },
  { n: 2, id: "diff",    label: "Diff" },
  { n: 3, id: "tests",   label: "Tests" },
  { n: 4, id: "fix",     label: "Fix" },
  { n: 5, id: "deploy",  label: "Deploy" },
  { n: 6, id: "replay",  label: "Replay" },
  { n: 7, id: "compare", label: "Comparison" },
];

export default function DemoPage() {
  const [c7, setC7] = useState<CommitDetail | null>(null);
  const [c8, setC8] = useState<CommitDetail | null>(null);
  const [diff, setDiff] = useState<DiffRow[]>([]);
  const [contradictions, setContradictions] = useState<ContraPair[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [current, setCurrent] = useState("change");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/commit/7`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/commit/8`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/diff?from=6&to=7`).then((r) => r.json()).catch(() => []),
      fetch(`${API}/contradictions?commit=7`).then((r) => r.json()).catch(() => ({ contradictions: [] })),
      fetch(`${API}/active`).then((r) => r.json()).catch(() => null),
    ]).then(([d7, d8, df, contra, act]) => {
      setC7(d7); setC8(d8); setDiff(df || []);
      setContradictions(contra?.contradictions ?? []);
      setActive(act?.active_commit ?? null);
    });
  }, []);

  // scrollspy — highlight the step currently in view
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.id); });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    STEPS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const added7 = diff.filter((d) => d.op === "added");
  const removed7 = diff.filter((d) => d.op === "removed");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px 100px" }}>
      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <span className="eg-pill" style={{ marginBottom: 16 }}><span className="dot" />the Engram workflow</span>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px", color: "var(--text)" }}>
          One policy change, start to finish.
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-2)", margin: 0, lineHeight: 1.6, maxWidth: 620 }}>
          Watch a company move its remote-work policy from 3 to 5 days — and how Engram
          reviews the change, catches a hidden contradiction, fixes it, and lets you rewind.
        </p>
      </div>

      {/* sticky step rail */}
      <div style={{
        position: "sticky", top: 60, zIndex: 20, padding: "12px 0", marginBottom: 8,
        background: "linear-gradient(var(--bg) 70%, transparent)",
      }}>
        <div className="step-rail">
          {STEPS.map((s, i) => {
            const state = current === s.id ? "active" : STEPS.findIndex((x) => x.id === current) > i ? "done" : "";
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <a href={`#${s.id}`} className={`step-node ${state}`}>
                  <span className="step-num">{s.n}</span>{s.label}
                </a>
                {i < STEPS.length - 1 && <span className="step-sep" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1 — Change */}
      <Section id="change" n={1} title="The change" caption="HR updates the remote-work policy to 5 days in-office. Engram records it as a commit.">
        {c7 && (
          <div className="eg-panel" style={{ padding: 16 }}>
            <CommitHeader id={c7.id} message={c7.message} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {c7.removed.map((t, i) => <RelationshipLine key={`r${i}`} triple={t} op="removed" />)}
              {c7.added.map((t, i) => <RelationshipLine key={`a${i}`} triple={t} op="added" />)}
            </div>
          </div>
        )}
      </Section>

      {/* Step 2 — Diff */}
      <Section id="diff" n={2} title="The reviewable diff" caption="Every change is a diff you can read before it ships — green added, amber retired.">
        <div className="eg-panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <Stat c="var(--green)" v={added7.length} l="added" />
            <Stat c="var(--amber)" v={removed7.length} l="retired" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {removed7.map((t, i) => <RelationshipLine key={`dr${i}`} triple={t} op="removed" />)}
            {added7.map((t, i) => <RelationshipLine key={`da${i}`} triple={t} op="added" />)}
          </div>
          <Link href="/changes" className="eg-btn eg-btn-outline" style={{ marginTop: 14, padding: "8px 14px", fontSize: 13 }}>
            Open the diff explorer →
          </Link>
        </div>
      </Section>

      {/* Step 3 — Tests / contradiction (the arresting moment) */}
      <Section id="tests" n={3} title="The contradiction, caught" caption="Before the change ships, Engram's checks catch a fact that no longer agrees with it.">
        {contradictions.length > 0 ? (
          <div style={{
            background: "linear-gradient(180deg, rgba(245,166,35,0.10), rgba(248,113,113,0.05))",
            border: "1px solid rgba(245,166,35,0.4)", borderRadius: 16, padding: "22px 24px",
            boxShadow: "0 0 0 1px rgba(245,166,35,0.08), 0 20px 60px -20px rgba(245,166,35,0.25)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--amber)" }}>Contradiction detected — do not deploy</span>
            </div>
            {contradictions.map((c, i) => (
              <div key={i}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <RelationshipLine triple={c.fact_a} op="removed" />
                  <div className="mono" style={{ fontSize: 11, color: "var(--red)", fontWeight: 600, paddingLeft: 10 }}>✕ conflicts with</div>
                  <RelationshipLine triple={c.fact_b} op="added" />
                </div>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: "12px 0 0", lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid rgba(245,166,35,0.4)" }}>
                  {c.reason}
                </p>
              </div>
            ))}
            <Link href="/tests" className="eg-btn eg-btn-outline" style={{ marginTop: 16, padding: "8px 14px", fontSize: 13 }}>
              Run the full memory tests →
            </Link>
          </div>
        ) : (
          <div className="eg-panel" style={{ padding: 20, color: "var(--text-3)", fontSize: 13 }}>Loading the check…</div>
        )}
      </Section>

      {/* Step 4 — Fix */}
      <Section id="fix" n={4} title="The fix" caption="Update the stale payroll fact to match the new policy — recorded as its own commit.">
        {c8 && (
          <div className="eg-panel" style={{ padding: 16 }}>
            <CommitHeader id={c8.id} message={c8.message} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {c8.removed.map((t, i) => <RelationshipLine key={`fr${i}`} triple={t} op="removed" />)}
              {c8.added.map((t, i) => <RelationshipLine key={`fa${i}`} triple={t} op="added" />)}
            </div>
          </div>
        )}
      </Section>

      {/* Step 5 — Deploy */}
      <Section id="deploy" n={5} title="Deploy the corrected memory" caption="With the contradiction resolved, commit 8 becomes the live memory — 7/7 tests passing.">
        <div className="eg-panel" style={{ padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--green)",
            background: "var(--green-weak)", border: "1px solid rgba(53,214,160,0.3)", borderRadius: 999, padding: "6px 14px",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)" }} />
            Deployed · commit #{active ?? 8}
          </span>
          <span className="mono" style={{ fontSize: 13, color: "var(--green)" }}>7/7 tests passing</span>
          <Link href="/commits" className="eg-btn eg-btn-outline" style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 13 }}>
            View commit history →
          </Link>
        </div>
      </Section>

      {/* Step 6 — Replay */}
      <Section id="replay" n={6} title="Rewind to any point" caption="Replay what the AI believed at every commit — the answer flips as history moves.">
        <div className="eg-panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 14, flexWrap: "wrap" }}>
            <ReplayCard commit={4} text="3 days per week remote" tone="old" />
            <div style={{ display: "flex", alignItems: "center", color: "var(--text-3)" }}>→</div>
            <ReplayCard commit={8} text="5 days per week in-office" tone="new" />
          </div>
          <Link href="/replay" className="eg-btn eg-btn-primary" style={{ marginTop: 16, padding: "9px 16px", fontSize: 13 }}>
            Scrub the timeline →
          </Link>
        </div>
      </Section>

      {/* Step 7 — Comparison finale */}
      <Section id="compare" n={7} title="Why it matters" caption="The same question, three kinds of memory. Only versioned memory stays correct — and lean.">
        <div style={{
          background: "linear-gradient(180deg, rgba(61,124,255,0.08), transparent)",
          border: "1px solid var(--accent-line)", borderRadius: 16, padding: "26px 26px",
          textAlign: "center",
        }}>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: "0 0 18px", lineHeight: 1.6 }}>
            No memory can&apos;t answer. Generic memory answers from stale facts and contradicts itself.
            Engram answers from the deployed, tested commit — correct, current, and token-lean.
          </p>
          <Link href="/compare" className="eg-btn eg-btn-primary" style={{ padding: "13px 26px", fontSize: 15 }}>
            See the three-way comparison →
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Section({ id, n, title, caption, children }: { id: string; n: number; title: string; caption: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 130, padding: "26px 0 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span className="mono" style={{
          fontSize: 12, color: "var(--accent-bright)", background: "var(--accent-weak)",
          border: "1px solid var(--accent-line)", borderRadius: 6, padding: "1px 8px",
        }}>
          {String(n).padStart(2, "0")}
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--text-3)", margin: "0 0 16px 34px", lineHeight: 1.55 }}>{caption}</p>
      <div style={{ marginLeft: 34 }}>{children}</div>
    </section>
  );
}

function CommitHeader({ id, message }: { id: number; message: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <code className="mono" style={{
        fontSize: 11, color: "var(--text-3)", background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--hairline)", padding: "2px 7px", borderRadius: 5,
      }}>
        {id.toString(16).padStart(7, "0")}
      </code>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{message}</span>
    </div>
  );
}

function Stat({ c, v, l }: { c: string; v: number; l: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: c, background: `${c}14`, border: `1px solid ${c}33`, borderRadius: 6, padding: "2px 9px" }} className="mono">
      {l === "added" ? "+" : "~"}{v} {l}
    </span>
  );
}

function ReplayCard({ commit, text, tone }: { commit: number; text: string; tone: "old" | "new" }) {
  const isNew = tone === "new";
  return (
    <div style={{
      flex: 1, minWidth: 200, background: isNew ? "var(--green-weak)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${isNew ? "rgba(53,214,160,0.3)" : "var(--hairline)"}`, borderRadius: 12, padding: "14px 16px",
    }}>
      <div className="mono" style={{ fontSize: 11, color: isNew ? "var(--green)" : "var(--text-3)", marginBottom: 8 }}>
        commit #{commit}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: isNew ? "#fff" : "var(--text-2)" }}>&ldquo;{text}&rdquo;</div>
    </div>
  );
}
