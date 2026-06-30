"use client";

import { useEffect, useState } from "react";

import { API } from "../config";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

interface Test {
  id: number;
  name: string;
  question: string;
  expect_contains: string;
}

interface TestResult {
  id: number;
  name: string;
  question: string;
  expect_contains: string;
  passed: boolean;
  answer: string[];
}

interface RunResult {
  commit: number;
  passed: number;
  failed: number;
  total: number;
  results: TestResult[];
}

export default function TestsPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/commits`).then((r) => r.json()),
      fetch(`${API}/tests`).then((r) => r.json()),
    ]).then(([commitData, testData]: [Commit[], Test[]]) => {
      setCommits(commitData);
      setTests(testData);
      if (commitData.length > 0) {
        setSelectedCommit(commitData[commitData.length - 1].id);
      }
    });
  }, []);

  async function handleRun() {
    if (selectedCommit === null) return;
    setRunning(true);
    setRunResult(null);
    setError(null);
    setExpandedId(null);
    try {
      const res = await fetch(`${API}/tests/run?commit=${selectedCommit}`, {
        method: "POST",
      });
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setError(`Backend error (HTTP ${res.status}). Check the server is running.`);
        return;
      }
      if (!res.ok) setError((data.detail as string) || "Failed to run tests");
      else setRunResult(data as unknown as RunResult);
    } catch {
      setError("Could not reach the backend. Is it running on port 8000?");
    }
    setRunning(false);
  }

  const passedCount = runResult?.passed ?? 0;
  const failedCount = runResult?.failed ?? 0;
  const totalCount = runResult?.total ?? tests.length;

  return (
    <div style={{ padding: "40px 48px", maxWidth: 820 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
              Tests
            </h1>
            <span style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "1px 8px",
            }}>
              {totalCount}
            </span>
          </div>

          <button
            onClick={handleRun}
            disabled={running || selectedCommit === null}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 16px",
              background: running ? "rgba(59,130,246,0.2)" : "#3B82F6",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: running ? "rgba(255,255,255,0.5)" : "#fff",
              cursor: running ? "not-allowed" : "pointer",
              transition: "background 150ms",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {running ? (
              <>
                <Spinner /> Running…
              </>
            ) : (
              <>
                <RunIcon /> Run tests
              </>
            )}
          </button>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
          AI-powered memory checks — each test asks Cognee a question and verifies the answer
        </p>
      </div>

      {/* Commit selector */}
      {commits.length > 0 && selectedCommit !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginRight: 2 }}>At</span>
          {commits.map((c) => {
            const active = c.id === selectedCommit;
            return (
              <CommitPill
                key={c.id}
                label={`#${c.id} · ${c.message}`}
                active={active}
                onClick={() => { setSelectedCommit(c.id); setRunResult(null); }}
              />
            );
          })}
        </div>
      )}

      {/* Run summary bar */}
      {runResult && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
          padding: "12px 18px",
          background: failedCount > 0 ? "rgba(248,113,113,0.06)" : "rgba(74,222,128,0.06)",
          border: `1px solid ${failedCount > 0 ? "rgba(248,113,113,0.2)" : "rgba(74,222,128,0.2)"}`,
          borderRadius: 10,
        }}>
          <span style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#4ade80",
            fontVariantNumeric: "tabular-nums",
          }}>
            {passedCount}
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>passed</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.15)", margin: "0 4px" }}>·</span>
          <span style={{
            fontSize: 22,
            fontWeight: 700,
            color: failedCount > 0 ? "#f87171" : "rgba(255,255,255,0.2)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {failedCount}
          </span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>failed</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.15)", margin: "0 4px" }}>·</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{totalCount} total</span>

          {failedCount > 0 && (
            <span style={{
              marginLeft: "auto",
              fontSize: 12,
              fontWeight: 500,
              color: "#f87171",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 6,
              padding: "3px 10px",
            }}>
              Contradiction detected
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: "#f87171",
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Loading hint */}
      {running && (
        <div style={{
          padding: "14px 18px",
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)",
          borderRadius: 10,
          fontSize: 13,
          color: "rgba(255,255,255,0.4)",
          marginBottom: 20,
        }}>
          Asking Cognee {tests.length} questions… this takes ~30–60s per question on the first run.
          Cognee is loaded once then all searches run sequentially.
        </div>
      )}

      {/* Test list */}
      <div style={{
        background: "#10131D",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {(runResult ? runResult.results : tests.map((t) => ({ ...t, passed: null as unknown as boolean, answer: [] as string[] }))).map((test, i) => {
          const hasResult = runResult !== null;
          const isLast = i === (runResult ? runResult.results : tests).length - 1;
          const expanded = expandedId === test.id;
          const failed = hasResult && !(test as TestResult).passed;

          return (
            <div key={test.id} style={{ borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
              <div
                onClick={() => hasResult && setExpandedId(expanded ? null : test.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 20px",
                  cursor: hasResult ? "pointer" : "default",
                  transition: "background 120ms",
                  background: expanded ? "#141827" : "transparent",
                }}
                onMouseEnter={(e) => { if (hasResult) e.currentTarget.style.background = "#141827"; }}
                onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Status icon */}
                <div style={{ flexShrink: 0, marginTop: 1 }}>
                  {!hasResult ? (
                    <PendingDot />
                  ) : (test as TestResult).passed ? (
                    <PassIcon />
                  ) : (
                    <FailIcon />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: failed ? "#f87171" : "#fff",
                    marginBottom: 4,
                  }}>
                    {test.name}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>
                    <span style={{ color: "rgba(255,255,255,0.22)" }}>Q: </span>
                    {test.question}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    <span style={{ color: "rgba(255,255,255,0.22)" }}>Expect: </span>
                    <code style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      color: "rgba(255,255,255,0.5)",
                    }}>
                      contains &quot;{test.expect_contains}&quot;
                    </code>
                  </div>
                </div>

                {/* Expand chevron */}
                {hasResult && (
                  <div style={{
                    flexShrink: 0,
                    color: "rgba(255,255,255,0.2)",
                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 150ms",
                  }}>
                    <ChevronRight />
                  </div>
                )}
              </div>

              {/* Expanded answer */}
              {expanded && (test as TestResult).answer.length > 0 && (
                <div style={{
                  padding: "0 20px 16px 48px",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.25)",
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                    marginTop: 12,
                  }}>
                    Cognee answered
                  </div>
                  {(test as TestResult).answer.map((a, j) => (
                    <p key={j} style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.65)",
                      lineHeight: 1.6,
                      margin: "0 0 6px 0",
                    }}>
                      {a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Small components ────────────────────────────────────────────────────────

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

function PassIcon() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      background: "rgba(74,222,128,0.12)",
      border: "1.5px solid rgba(74,222,128,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 5l2.5 2.5L8 3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function FailIcon() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      background: "rgba(248,113,113,0.12)",
      border: "1.5px solid rgba(248,113,113,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 3l4 4M7 3l-4 4" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

function PendingDot() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      background: "transparent",
      border: "1.5px solid rgba(255,255,255,0.12)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
    </div>
  );
}

function RunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 2l8 4.5L3 11V2z" fill="currentColor"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="6.5" cy="6.5" r="5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
      <path d="M6.5 1.5a5 5 0 0 1 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
