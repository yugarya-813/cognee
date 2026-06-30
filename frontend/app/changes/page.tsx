"use client";

import { useEffect, useState } from "react";
import { RelationshipLine } from "../components/Relationship";

import { API } from "../config";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}
interface DiffRow {
  op: "added" | "removed";
  subject: string;
  predicate: string;
  object: string;
  source: string;
}
interface ImpactFact {
  id: number;
  subject: string;
  predicate: string;
  object: string;
  source: string;
}
interface Impact {
  commit: number;
  changed_subjects: string[];
  impacted_facts: ImpactFact[];
  count: number;
}

export default function ChangesPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [fromCommit, setFromCommit] = useState<number | null>(null);
  const [toCommit, setToCommit] = useState<number | null>(null);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        if (data.length >= 2) {
          setFromCommit(data[data.length - 2].id);
          setToCommit(data[data.length - 1].id);
        } else if (data.length === 1) {
          setFromCommit(data[0].id);
          setToCommit(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (fromCommit === null || toCommit === null) return;
    if (fromCommit >= toCommit) {
      setDiff([]);
      setImpact(null);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${API}/diff?from=${fromCommit}&to=${toCommit}`).then((r) => r.json()),
      fetch(`${API}/impact?commit=${toCommit}`).then((r) => r.json()),
    ]).then(([diffData, impactData]) => {
      setDiff(diffData);
      setImpact(impactData);
      setLoading(false);
    });
  }, [fromCommit, toCommit]);

  const added = diff?.filter((d) => d.op === "added") ?? [];
  const removed = diff?.filter((d) => d.op === "removed") ?? [];

  return (
    <div style={{ padding: "40px 48px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
          Changes
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
          Diff the facts &amp; relationships between any two memory snapshots.
        </p>
      </div>

      {commits.length >= 2 && fromCommit !== null && toCommit !== null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: "14px 18px",
          background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>From</span>
          <CommitSelector commits={commits} value={fromCommit} onChange={setFromCommit} exclude={toCommit} />
          <ArrowRight />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>To</span>
          <CommitSelector commits={commits} value={toCommit} onChange={setToCommit} exclude={fromCommit} />
        </div>
      )}

      {commits.length < 2 && (
        <Empty>Need at least 2 commits to show a diff.</Empty>
      )}

      {loading && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading…</div>}

      {!loading && diff && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {added.length > 0 && <Pill color="#4ade80" text={`+${added.length} added`} />}
            {removed.length > 0 && <Pill color="#f87171" text={`−${removed.length} removed`} />}
            {diff.length === 0 && fromCommit! < toCommit! && (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>No changes between these commits.</span>
            )}
          </div>

          {diff.length > 0 && (
            <div style={{
              background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
              padding: "12px", marginBottom: 30, display: "flex", flexDirection: "column", gap: 6,
            }}>
              {removed.map((row, i) => <RelationshipLine key={`r${i}`} triple={row} op="removed" />)}
              {added.map((row, i) => <RelationshipLine key={`a${i}`} triple={row} op="added" />)}
            </div>
          )}

          {impact && impact.count > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                  Downstream impact
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: "#f59e0b", background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.25)", borderRadius: 20, padding: "1px 8px",
                }}>
                  {impact.count} fact{impact.count !== 1 ? "s" : ""} may be affected
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                These relationships reference{" "}
                <strong style={{ color: "rgba(255,255,255,0.55)" }}>{impact.changed_subjects.join(", ")}</strong>{" "}
                or share values with what changed — worth a review.
              </p>
              <div style={{
                background: "#10131D", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12,
                padding: "12px", display: "flex", flexDirection: "column", gap: 6,
              }}>
                {impact.impacted_facts.map((fact) => (
                  <RelationshipLine key={fact.id} triple={fact} op="neutral" />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13,
      background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
    }}>
      {children}
    </div>
  );
}

function Pill({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, color, background: `${color}14`,
      border: `1px solid ${color}33`, borderRadius: 6, padding: "3px 10px",
    }}>
      {text}
    </span>
  );
}

function CommitSelector({
  commits, value, onChange, exclude,
}: {
  commits: Commit[]; value: number; onChange: (id: number) => void; exclude: number;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {commits.filter((c) => c.id !== exclude).map((c) => (
        <CommitPill key={c.id} label={`#${c.id}`} title={c.message} active={c.id === value} onClick={() => onChange(c.id)} />
      ))}
    </div>
  );
}

function CommitPill({ label, title, active, onClick }: { label: string; title?: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 11px", borderRadius: 6, fontSize: 12, fontWeight: active ? 500 : 400,
        border: `1px solid ${active ? "rgba(59,130,246,0.55)" : hovered ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.09)"}`,
        background: active ? "rgba(59,130,246,0.12)" : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "#3B82F6" : hovered ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.4)",
        cursor: "pointer", transition: "all 150ms", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 7h10M8 3l4 4-4 4" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
