"use client";

import { useEffect, useState } from "react";

import { API } from "../config";
import { PageShell, PageHeader, CommitPicker } from "../components/PageKit";

interface Commit {
  id: number;
  message: string;
  created_at: string;
}

export default function AskPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<number>(1);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data);
        if (data.length > 0) setSelectedCommit(data[data.length - 1].id);
      });
  }, []);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), commit: selectedCommit }),
      });
      let data: Record<string, unknown>;
      try { data = await res.json(); }
      catch { setError(`Backend error (HTTP ${res.status}).`); return; }
      if (!res.ok) {
        // 503 = provider rate-limit/quota (verbose dump) → show a calm message.
        setError(res.status === 503
          ? "⏳ The model is rate-limited right now — try again in a moment."
          : (data.detail as string) || "Request failed");
      } else setAnswer(data.answers as string[]);
    } catch {
      setError("Could not reach the backend. Is it running on port 8000?");
    }
    setLoading(false);
  }

  return (
    <PageShell width={780}>
      <PageHeader
        title="Ask the"
        accent="memory"
        subtitle="Query the AI's memory as it stood at any commit in its history."
      />

      {commits.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <CommitPicker commits={commits} value={selectedCommit} onChange={setSelectedCommit} label="At" />
        </div>
      )}

      {/* Question input */}
      <form onSubmit={handleAsk} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="e.g. What is the remote work policy?"
          style={{
            flex: 1,
            background: "#10131D",
            border: `1px solid ${inputFocused ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.09)"}`,
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 14,
            color: "#fff",
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 150ms",
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="eg-btn eg-btn-primary"
          style={{ padding: "12px 24px", fontSize: 14, flexShrink: 0 }}
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: "#f87171",
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Answer */}
      {answer !== null && (
        <div style={{
          background: "#10131D",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "20px 24px",
        }}>
          {/* Label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6" }} />
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: "rgba(255,255,255,0.28)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Answer · commit #{selectedCommit}
            </span>
          </div>

          {answer.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.6 }}>
              No answer found. Try running <code style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.45)" }}>POST /ingest</code> first to load facts into Cognee.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {answer.map((a, i) => (
                <p key={i} style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.65,
                  margin: 0,
                }}>
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
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
