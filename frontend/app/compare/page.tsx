"use client";

import { useState } from "react";
import { API } from "../config";

const PRESET = "How many days can employees work remotely, and does payroll match?";

interface TierResult {
  answer: string;
  error: boolean;
  input_tokens?: number;
  output_tokens?: number;
  est_cost?: number;
}
interface EngramResult extends TierResult {
  deployed_commit: number;
  tests_passed: number | null;
  tests_total: number | null;
}
interface CompareResponse {
  question: string;
  no_memory: TierResult;
  generic: TierResult;
  engram: EngramResult;
}

export default function ComparePage() {
  const [question, setQuestion] = useState(PRESET);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API}/compare/all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || "Request failed.");
      } else {
        setData(json);
      }
    } catch {
      setError("Could not reach the backend.");
    }
    setLoading(false);
  }

  const maxInput = data
    ? Math.max(
        data.no_memory.input_tokens ?? 0,
        data.generic.input_tokens ?? 0,
        data.engram.input_tokens ?? 0,
        1,
      )
    : 1;

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1180 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="eg-pill" style={{ marginBottom: 14 }}><span className="dot" />the payoff</span>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>
          Three kinds of memory. One is trustworthy.
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--text-2)", marginTop: 8, maxWidth: 660, lineHeight: 1.6 }}>
          The same model answers each time — only what it&apos;s allowed to remember changes.
          Watch which one stays correct, current, and token-lean.
        </p>
      </div>

      {/* Question input */}
      <form onSubmit={compare} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about the company…"
          style={{
            flex: 1, background: "#10131D", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "12px 16px", fontSize: 14, color: "#fff",
            outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            padding: "12px 24px",
            background: loading || !question.trim() ? "rgba(59,130,246,0.25)" : "#3B82F6",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 500,
            color: loading || !question.trim() ? "rgba(255,255,255,0.4)" : "#fff",
            cursor: loading || !question.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {loading ? "Comparing…" : "Compare"}
        </button>
      </form>

      {/* Preset suggestion */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>Try</span>
        <button
          onClick={() => setQuestion(PRESET)}
          style={{
            fontSize: 12, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "4px 12px",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {PRESET}
        </button>
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#f87171", marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Three columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.08fr", gap: 16, alignItems: "stretch" }}>
        <TierCard
          tier="weak"
          tokenTone="neutral"
          name="No Memory"
          subtitle="Stateless LLM — no company facts at all."
          verdict="Can't answer"
          loading={loading}
          result={data?.no_memory}
          maxInput={maxInput}
        />
        <TierCard
          tier="weak"
          tokenTone="heavy"
          name="Generic AI Memory"
          subtitle="Dumps every fact ever stored — stale ones included, no versioning."
          verdict="Outdated / contradictory"
          loading={loading}
          result={data?.generic}
          maxInput={maxInput}
        />
        <TierCard
          tier="hero"
          tokenTone="lean"
          name="Engram"
          badge="ours"
          subtitle="Only the facts active at the deployed commit — versioned & tested."
          verdict="Correct & current"
          loading={loading}
          result={data?.engram}
          meta={data?.engram}
          maxInput={maxInput}
        />
      </div>

      {data && (
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          Generic memory pays a growing token tax for stale context; Engram loads only current facts.
        </p>
      )}
    </div>
  );
}

function TierCard({
  tier, tokenTone, name, badge, subtitle, verdict, loading, result, meta, maxInput,
}: {
  tier: "weak" | "hero";
  tokenTone: "neutral" | "heavy" | "lean";
  name: string;
  badge?: string;
  subtitle: string;
  verdict: string;
  loading: boolean;
  result?: TierResult;
  meta?: EngramResult;
  maxInput: number;
}) {
  const hero = tier === "hero";

  // verdict colours
  const vColor = hero ? "#34D399" : name === "No Memory" ? "#f87171" : "#f59e0b";

  return (
    <div
      className={`lift tier-card ${hero ? "hero" : "weak"}`}
      style={{
        position: "relative",
        background: hero ? "#0F1620" : "#0E111A",
        border: `1px solid ${hero ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14,
        padding: "20px 20px 22px",
        boxShadow: hero ? "0 0 0 1px rgba(52,211,153,0.12), 0 8px 40px rgba(52,211,153,0.10)" : "none",
        display: "flex",
        flexDirection: "column",
        minHeight: 260,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: hero ? "#fff" : "rgba(255,255,255,0.82)" }}>
          {name}
        </span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#34D399", background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.3)", borderRadius: 5, padding: "1px 6px",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.32)", margin: "0 0 14px", lineHeight: 1.5, minHeight: 34 }}>
        {subtitle}
      </p>

      {/* verdict tag */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
        fontSize: 11.5, fontWeight: 600, color: vColor,
        background: `${vColor}14`, border: `1px solid ${vColor}40`,
        borderRadius: 20, padding: "3px 11px", marginBottom: 16,
      }}>
        {hero ? <CheckIcon /> : <CrossIcon />}
        {verdict}
      </div>

      {/* answer */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <Skeleton />
        ) : !result ? (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", margin: 0, lineHeight: 1.6 }}>
            Ask a question to see this tier&apos;s answer.
          </p>
        ) : result.error ? (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.6 }}>
            ⚠ The model is rate-limited right now — try again in a moment.
          </p>
        ) : (
          <p style={{
            fontSize: 13.5, color: hero ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)",
            margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap",
          }}>
            {result.answer}
          </p>
        )}
      </div>

      {/* token stats — the efficiency story */}
      {!loading && result && result.input_tokens != null && (
        <TokenStats result={result} maxInput={maxInput} tone={tokenTone} />
      )}

      {/* engram metadata */}
      {hero && meta && !meta.error && meta.deployed_commit != null && (
        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(52,211,153,0.15)",
          display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.55)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
          Deployed commit #{meta.deployed_commit}
          {meta.tests_passed != null && (
            <>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span style={{ color: "#34D399", fontWeight: 500 }}>
                {meta.tests_passed}/{meta.tests_total} tests passed
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TokenStats({ result, maxInput, tone }: { result: TierResult; maxInput: number; tone: "neutral" | "heavy" | "lean" }) {
  const input = result.input_tokens ?? 0;
  const color = tone === "heavy" ? "#f59e0b" : tone === "lean" ? "#34D399" : "rgba(255,255,255,0.45)";
  const pct = Math.max(5, Math.round((input / maxInput) * 100));
  const label = tone === "heavy" ? "heavy" : tone === "lean" ? "lean" : "minimal";

  return (
    <div style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          context tokens
          <span style={{ color, marginLeft: 6, fontWeight: 600 }}>· {label}</span>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color, fontFamily: "'SF Mono','Fira Code',monospace" }}>
          {input.toLocaleString()}
        </span>
      </div>
      {/* relative-size bar */}
      <div style={{ height: 5, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 5, transition: "width 550ms cubic-bezier(.22,.61,.36,1)" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.32)" }}>
        <span>{(result.output_tokens ?? 0).toLocaleString()} out</span>
        <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
        <span>~${(result.est_cost ?? 0).toFixed(6)} <span style={{ color: "rgba(255,255,255,0.22)" }}>est.</span></span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[100, 92, 78].map((w, i) => (
        <div key={i} style={{
          height: 11, width: `${w}%`, borderRadius: 5,
          background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.11), rgba(255,255,255,0.06))",
          backgroundSize: "200% 100%", animation: "shimmer 1.3s infinite",
        }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2l2.2 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
