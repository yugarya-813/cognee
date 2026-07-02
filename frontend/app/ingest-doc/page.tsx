"use client";

import { useEffect, useState } from "react";
import { API } from "../config";
import { RelationshipLine, Triple } from "../components/Relationship";
import { ContradictionBanner, ContraItem } from "../components/Contradictions";

const SAMPLE = `MEMO — Helix Labs Remote Work Policy update.

Effective this quarter, employees are now required to be in-office only 2 days per week, down from the previous requirement. This replaces the prior in-office policy. All other HR policies remain unchanged.`;

const QUESTION = "How many days per week must employees be in-office under the remote work policy?";

interface CommitDetail {
  id: number;
  message: string;
  added: Triple[];
  removed: Triple[];
}
interface Contradiction {
  new_fact: Triple;
  existing_fact: Triple;
  reason: string;
}
interface IngestResult {
  commit_id: number | null;
  facts_added: number;
  facts_superseded: number;
  extractor: string;
  base_commit: number;
  contradictions?: Contradiction[];
  message?: string;
}

export default function IngestPage() {
  const [text, setText] = useState(SAMPLE);
  const [message, setMessage] = useState("Ingest: remote policy memo");
  const [question, setQuestion] = useState(QUESTION);

  const [baseCommit, setBaseCommit] = useState<number | null>(null);
  const [beforeAnswer, setBeforeAnswer] = useState<string | null>(null);
  const [beforeLoading, setBeforeLoading] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [afterAnswer, setAfterAnswer] = useState<string | null>(null);
  const [noChange, setNoChange] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the current deployed commit and its answer to the question (the "before").
  async function loadBefore() {
    setBeforeLoading(true);
    try {
      const active = await fetch(`${API}/active`).then((r) => r.json());
      const commit = active.active_commit as number;
      setBaseCommit(commit);
      const ans = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, commit }),
      }).then((r) => r.json());
      setBeforeAnswer(ans.answers?.[0] ?? "⏳ The model is rate-limited right now — try again in a moment.");
    } catch {
      setBeforeAnswer("Could not reach the backend.");
    }
    setBeforeLoading(false);
  }

  useEffect(() => {
    loadBefore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ingest() {
    if (!text.trim()) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    setDetail(null);
    setAfterAnswer(null);
    setNoChange(false);
    try {
      const res = await fetch(`${API}/ingest-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), message: message.trim() || "Ingested document" }),
      });
      const json: IngestResult = await res.json();
      if (!res.ok) {
        setError((json as { detail?: string }).detail || "Ingestion failed.");
        setProcessing(false);
        return;
      }
      setResult(json);

      if (json.commit_id == null) {
        setNoChange(true);
        setProcessing(false);
        return;
      }

      // Pull the diff for the new commit and the updated answer, all in one screen.
      const [commitDetail, ans] = await Promise.all([
        fetch(`${API}/commit/${json.commit_id}`).then((r) => r.json()),
        fetch(`${API}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, commit: json.commit_id }),
        }).then((r) => r.json()),
      ]);
      setDetail(commitDetail);
      setAfterAnswer(ans.answers?.[0] ?? "⏳ The model is rate-limited right now — try again in a moment.");
    } catch {
      setError("Could not reach the backend.");
    }
    setProcessing(false);
  }

  return (
    <div style={{ padding: "40px 48px", maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
          Ingest a document
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5, maxWidth: 680, lineHeight: 1.6 }}>
          Drop in a document. Cognee extracts its entities and relationships, Engram reconciles them
          against the current memory, and writes the change as a new commit — so the AI&apos;s answer
          updates and you can see exactly what the document changed.
        </p>
      </div>

      {/* Question / before answer */}
      <div style={{
        background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
        padding: "16px 18px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{
              flex: 1, background: "#0C0F17", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9, padding: "10px 14px", fontSize: 13.5, color: "#fff",
              outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            onClick={loadBefore}
            disabled={beforeLoading}
            style={{
              padding: "10px 16px", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, fontSize: 13,
              color: "rgba(255,255,255,0.75)", cursor: beforeLoading ? "wait" : "pointer",
              fontFamily: "inherit", flexShrink: 0,
            }}
          >
            {beforeLoading ? "Asking…" : "Check current answer"}
          </button>
        </div>
        <AnswerRow
          label={`Current answer${baseCommit != null ? ` · commit #${baseCommit}` : ""}`}
          answer={beforeLoading ? null : beforeAnswer}
          tone="neutral"
        />
      </div>

      {/* Document input */}
      <div style={{
        background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
        padding: "16px 18px", marginBottom: 20,
      }}>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 8 }}>
          Document text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste a policy, memo, contract, or any document…"
          style={{
            width: "100%", background: "#0C0F17", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 9, padding: "12px 14px", fontSize: 13.5, color: "#fff", lineHeight: 1.6,
            outline: "none", fontFamily: "inherit", resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message"
            style={{
              flex: 1, minWidth: 220, background: "#0C0F17", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#fff",
              outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => setText(SAMPLE)}
            style={{
              fontSize: 12, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px",
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}
          >
            Use sample memo
          </button>
          <button
            onClick={ingest}
            disabled={processing || !text.trim()}
            className="lift"
            style={{
              padding: "10px 20px",
              background: processing || !text.trim() ? "rgba(59,130,246,0.25)" : "#3B82F6",
              border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 500,
              color: processing || !text.trim() ? "rgba(255,255,255,0.4)" : "#fff",
              cursor: processing || !text.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit", flexShrink: 0,
            }}
          >
            {processing ? "Processing document…" : "Ingest document"}
          </button>
        </div>
      </div>

      {/* Processing state */}
      {processing && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 18px",
          background: "#10131D", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, marginBottom: 20,
        }}>
          <Spinner />
          <div>
            <div style={{ fontSize: 13.5, color: "#fff", fontWeight: 500 }}>Processing document…</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              Cognee is extracting entities &amp; relationships, then Engram reconciles and commits. This can take a moment.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#f87171", marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {noChange && result && (
        <div style={{
          background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#f59e0b", marginBottom: 20,
        }}>
          The document didn&apos;t change anything already in memory — no new commit was created.
        </div>
      )}

      {/* Contradiction warning — shows immediately on ingest, before tests run */}
      {result && !processing && result.contradictions && result.contradictions.length > 0 && (
        <ContradictionBanner
          items={result.contradictions.map<ContraItem>((c) => ({
            reason: c.reason,
            left: c.new_fact,
            right: c.existing_fact,
            leftTag: "incoming",
            rightTag: "existing",
          }))}
        />
      )}

      {/* Result: new commit + diff + updated answer */}
      {result && result.commit_id != null && detail && !processing && (
        <div style={{
          background: "#10131D", border: "1px solid rgba(52,211,153,0.28)", borderRadius: 14,
          padding: "20px 20px 22px", boxShadow: "0 0 0 1px rgba(52,211,153,0.08)",
        }}>
          {/* commit badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600,
              color: "#34D399", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)",
              borderRadius: 20, padding: "4px 12px",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
              New commit #{result.commit_id} deployed
            </span>
            <Chip color="#4ade80" text={`+${result.facts_added} added`} />
            <Chip color="#f87171" text={`−${result.facts_superseded} superseded`} />
            <Chip color="#8b93a7" text={`extracted via ${result.extractor}`} />
          </div>

          {/* what the document changed */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
            What the document changed
          </div>
          <div style={{
            background: "#0C0F17", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10,
            padding: "10px", marginBottom: 22, display: "flex", flexDirection: "column", gap: 6,
          }}>
            {detail.removed.map((row, i) => <RelationshipLine key={`r${i}`} triple={row} op="removed" />)}
            {detail.added.map((row, i) => <RelationshipLine key={`a${i}`} triple={row} op="added" />)}
            {detail.removed.length === 0 && detail.added.length === 0 && (
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", padding: "6px 10px" }}>No fact-level changes.</span>
            )}
          </div>

          {/* before vs after answer */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
            The AI&apos;s answer, before and after
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "stretch" }}>
            <AnswerCard
              tone="weak"
              heading={`Before · commit #${baseCommit ?? "?"}`}
              answer={beforeAnswer}
            />
            <div style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,0.25)" }}>
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <path d="M2 7h14M13 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <AnswerCard
              tone="hero"
              heading={`After · commit #${result.commit_id}`}
              answer={afterAnswer}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerRow({ label, answer, tone }: { label: string; answer: string | null; tone: "neutral" }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      {answer == null ? (
        <div style={{ display: "flex", gap: 8 }}>
          <Dot /> <Dot /> <Dot />
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.82)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {answer}
        </p>
      )}
    </div>
  );
}

function AnswerCard({ tone, heading, answer }: { tone: "weak" | "hero"; heading: string; answer: string | null }) {
  const hero = tone === "hero";
  return (
    <div style={{
      background: hero ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${hero ? "rgba(52,211,153,0.28)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 11, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: hero ? "#34D399" : "rgba(255,255,255,0.4)", marginBottom: 7, fontWeight: 500 }}>
        {heading}
      </div>
      <p style={{
        fontSize: 13.5, color: hero ? "#fff" : "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap",
      }}>
        {answer ?? "—"}
      </p>
    </div>
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 500, color, background: `${color}14`,
      border: `1px solid ${color}33`, borderRadius: 6, padding: "3px 9px",
    }}>
      {text}
    </span>
  );
}

function Spinner() {
  return (
    <>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(59,130,246,0.25)",
        borderTopColor: "#3B82F6", animation: "spin 0.8s linear infinite", flexShrink: 0,
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function Dot() {
  return (
    <>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.25)",
        animation: "pulse 1.2s infinite",
      }} />
      <style>{`@keyframes pulse{0%,100%{opacity:0.25}50%{opacity:0.7}}`}</style>
    </>
  );
}
