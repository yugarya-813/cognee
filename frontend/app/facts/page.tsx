"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = "http://localhost:8000";

interface Fact {
  id: number;
  subject: string;
  predicate: string;
  object: string;
  source: string;
  commit_id: number;
  status: string;
  created_at: string;
}

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

function FactsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        const paramCommit = searchParams.get("commit");
        const commit = paramCommit
          ? parseInt(paramCommit)
          : data.length > 0
          ? data[data.length - 1].id
          : 1;
        setSelectedCommit(commit);
      });
  }, []);

  useEffect(() => {
    if (selectedCommit === null) return;
    setLoading(true);
    fetch(`${API}/facts?commit=${selectedCommit}`)
      .then((r) => r.json())
      .then((data: Fact[]) => {
        setFacts(data);
        setLoading(false);
      });
  }, [selectedCommit]);

  function selectCommit(id: number) {
    setSelectedCommit(id);
    router.replace(`/facts?commit=${id}`);
  }

  return (
    <div style={{ padding: "40px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Facts
          </h1>
          {!loading && (
            <span style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "1px 8px",
            }}>
              {facts.length} active
            </span>
          )}
        </div>

        {/* Commit selector — pills, not a dropdown */}
        {commits.length > 0 && selectedCommit !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginRight: 2 }}>
              Snapshot
            </span>
            {commits.map((c) => {
              const active = c.id === selectedCommit;
              return (
                <CommitPill
                  key={c.id}
                  label={`#${c.id} · ${c.message}`}
                  active={active}
                  onClick={() => selectCommit(c.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: "#10131D",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { label: "Subject", width: "22%" },
                { label: "Predicate", width: "22%" },
                { label: "Object", width: "40%" },
                { label: "Source", width: "16%" },
              ].map((col) => (
                <th
                  key={col.label}
                  style={{
                    padding: "12px 20px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={{ padding: "52px 20px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && facts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "52px 20px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  No facts found for this commit.
                </td>
              </tr>
            )}

            {!loading && facts.map((fact, i) => (
              <FactRow key={fact.id} fact={fact} isLast={i === facts.length - 1} />
            ))}
          </tbody>
        </table>
      </div>
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

function FactRow({ fact, isLast }: { fact: Fact; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "#141827" : "transparent",
        transition: "background 120ms",
      }}
    >
      <td style={{ padding: "13px 20px", color: "#fff", fontWeight: 500 }}>
        {fact.subject}
      </td>
      <td style={{ padding: "13px 20px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>
        {fact.predicate}
      </td>
      <td style={{ padding: "13px 20px", color: "rgba(255,255,255,0.82)" }}>
        {fact.object}
      </td>
      <td style={{ padding: "13px 20px" }}>
        {fact.source ? (
          <span style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.38)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 8px",
            borderRadius: 4,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}>
            {fact.source}
          </span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 13 }}>—</span>
        )}
      </td>
    </tr>
  );
}

export default function FactsPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 48, color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Loading…</div>
    }>
      <FactsContent />
    </Suspense>
  );
}
