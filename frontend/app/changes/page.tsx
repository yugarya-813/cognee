"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:8000";

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
    <div style={{ padding: "40px 48px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
          Changes
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
          Diff between memory snapshots
        </p>
      </div>

      {/* Commit range selector */}
      {commits.length >= 2 && fromCommit !== null && toCommit !== null && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 28,
          padding: "14px 18px",
          background: "#10131D",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>From</span>
          <CommitSelector
            commits={commits}
            value={fromCommit}
            onChange={setFromCommit}
            exclude={toCommit}
          />
          <ArrowRight />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>To</span>
          <CommitSelector
            commits={commits}
            value={toCommit}
            onChange={setToCommit}
            exclude={fromCommit}
          />
        </div>
      )}

      {commits.length < 2 && (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "rgba(255,255,255,0.25)",
          fontSize: 13,
          background: "#10131D",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          marginBottom: 24,
        }}>
          Need at least 2 commits to show a diff.
        </div>
      )}

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginBottom: 24 }}>Loading…</div>
      )}

      {!loading && diff && (
        <>
          {/* Diff summary bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {added.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: "#4ade80",
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.2)",
                borderRadius: 6, padding: "3px 10px",
              }}>
                +{added.length} added
              </span>
            )}
            {removed.length > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: "#f87171",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 6, padding: "3px 10px",
              }}>
                −{removed.length} removed
              </span>
            )}
            {diff.length === 0 && (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
                No changes between these commits.
              </span>
            )}
          </div>

          {/* Diff table */}
          {diff.length > 0 && (
            <div style={{
              background: "#10131D",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 28,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <th style={thStyle}></th>
                    <th style={thStyle}>Subject</th>
                    <th style={thStyle}>Predicate</th>
                    <th style={thStyle}>Object</th>
                    <th style={thStyle}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {removed.map((row, i) => (
                    <DiffRowEl key={`r-${i}`} row={row} />
                  ))}
                  {added.map((row, i) => (
                    <DiffRowEl key={`a-${i}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Impact section */}
          {impact && impact.count > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                  Downstream impact
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: "#f59e0b",
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 20, padding: "1px 8px",
                }}>
                  {impact.count} fact{impact.count !== 1 ? "s" : ""} may be affected
                </span>
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
                These facts reference <strong style={{ color: "rgba(255,255,255,0.5)" }}>{impact.changed_subjects.join(", ")}</strong> or share keywords with the changed values.
              </p>

              <div style={{
                background: "#10131D",
                border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <th style={thStyle}>Subject</th>
                      <th style={thStyle}>Predicate</th>
                      <th style={thStyle}>Object</th>
                      <th style={thStyle}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.impacted_facts.map((fact, i) => (
                      <ImpactRow key={fact.id} fact={fact} isLast={i === impact.impacted_facts.length - 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "11px 18px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(255,255,255,0.3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

function DiffRowEl({ row }: { row: DiffRow }) {
  const isAdded = row.op === "added";
  const [hovered, setHovered] = useState(false);

  const accentColor = isAdded ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)";
  const bgColor = isAdded
    ? hovered ? "rgba(74,222,128,0.07)" : "rgba(74,222,128,0.04)"
    : hovered ? "rgba(248,113,113,0.07)" : "rgba(248,113,113,0.04)";

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bgColor,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        transition: "background 120ms",
      }}
    >
      <td style={{ padding: "12px 18px", width: 32 }}>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: accentColor,
          fontFamily: "monospace",
          lineHeight: 1,
        }}>
          {isAdded ? "+" : "−"}
        </span>
      </td>
      <td style={{ padding: "12px 18px", color: "#fff", fontWeight: 500 }}>{row.subject}</td>
      <td style={{ padding: "12px 18px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{row.predicate}</td>
      <td style={{ padding: "12px 18px", color: "rgba(255,255,255,0.82)" }}>{row.object}</td>
      <td style={{ padding: "12px 18px" }}>
        {row.source ? (
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 7px",
            borderRadius: 4,
            fontFamily: "monospace",
          }}>
            {row.source}
          </span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>
        )}
      </td>
    </tr>
  );
}

function ImpactRow({ fact, isLast }: { fact: ImpactFact; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#141827" : "transparent",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
        transition: "background 120ms",
      }}
    >
      <td style={{ padding: "12px 18px", color: "#fff", fontWeight: 500 }}>{fact.subject}</td>
      <td style={{ padding: "12px 18px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{fact.predicate}</td>
      <td style={{ padding: "12px 18px", color: "rgba(255,255,255,0.82)" }}>{fact.object}</td>
      <td style={{ padding: "12px 18px" }}>
        {fact.source ? (
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 7px",
            borderRadius: 4,
            fontFamily: "monospace",
          }}>
            {fact.source}
          </span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.18)" }}>—</span>
        )}
      </td>
    </tr>
  );
}

function CommitSelector({
  commits, value, onChange, exclude,
}: {
  commits: Commit[];
  value: number;
  onChange: (id: number) => void;
  exclude: number;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {commits
        .filter((c) => c.id !== exclude)
        .map((c) => {
          const active = c.id === value;
          return (
            <CommitPill key={c.id} label={`#${c.id} · ${c.message}`} active={active} onClick={() => onChange(c.id)} />
          );
        })}
    </div>
  );
}

function CommitPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "4px 11px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        border: `1px solid ${active ? "rgba(59,130,246,0.55)" : hovered ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.09)"}`,
        background: active ? "rgba(59,130,246,0.12)" : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "#3B82F6" : hovered ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.4)",
        cursor: "pointer",
        transition: "all 150ms",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 7h10M8 3l4 4-4 4" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
