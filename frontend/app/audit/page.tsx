"use client";

import { useEffect, useState } from "react";
import { RelationshipLine, type Triple } from "../components/Relationship";
import { API } from "../config";

interface HistoryCommit {
  id: number;
  message: string;
  created_at: string;
  added_count: number;
  superseded_count: number;
  added: Triple[];
  superseded: Triple[];
}
interface FactVersion {
  predicate: string;
  object: string;
  source: string;
  added_at_commit: number;
  added_message: string;
  added_at: string;
  status: "active" | "superseded";
  superseded_at_commit: number | null;
  superseded_message: string | null;
}
interface FactHistory {
  subject: string;
  versions: FactVersion[];
  count: number;
}

function absTime(dateStr: string): string {
  const d = new Date(dateStr + "Z");
  return d.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "UTC",
  }) + " UTC";
}
function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function shortHash(id: number): string {
  return id.toString(16).padStart(7, "0");
}

export default function AuditPage() {
  const [history, setHistory] = useState<HistoryCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/history`)
      .then((r) => r.json())
      .then((data: HistoryCommit[]) => {
        setHistory(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalAdded = history.reduce((n, c) => n + c.added_count, 0);
  const totalSuperseded = history.reduce((n, c) => n + c.superseded_count, 0);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Audit Log
          </h1>
          {!loading && (
            <span style={{
              fontSize: 12, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1px 8px",
            }}>
              {history.length} entries
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5, maxWidth: 660, lineHeight: 1.6 }}>
          A complete, timestamped trail of every change to the AI&apos;s memory — what changed, when,
          and why. Nothing is edited in place; every version is retained.
        </p>
        {!loading && history.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Stat label="commits" value={history.length} color="#93b4fc" />
            <Stat label="facts added" value={totalAdded} color="#4ade80" />
            <Stat label="facts superseded" value={totalSuperseded} color="#f59e0b" />
          </div>
        )}
      </div>

      {/* Fact-history explorer */}
      <FactHistoryExplorer />

      {loading && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading audit trail…</div>}

      {/* Timeline */}
      {!loading && history.length > 0 && (
        <div style={{ position: "relative", marginTop: 6 }}>
          <div style={{ position: "absolute", left: 11, top: 16, bottom: 16, width: 1, background: "rgba(255,255,255,0.07)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {history.map((c) => (
              <AuditRow key={c.id} commit={c} open={openId === c.id} onToggle={() => setOpenId((v) => (v === c.id ? null : c.id))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ commit, open, onToggle }: { commit: HistoryCommit; open: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false);
  const hasChanges = commit.added.length > 0 || commit.superseded.length > 0;

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, position: "relative", zIndex: 1, marginTop: 8 }}>
        <div style={{
          width: 23, height: 23, borderRadius: "50%", background: "#0A0B12",
          border: `2px solid ${open || hovered ? "#3B82F6" : "rgba(59,130,246,0.4)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 150ms",
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: open || hovered ? "#3B82F6" : "rgba(59,130,246,0.6)", transition: "background 150ms" }} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={hasChanges ? onToggle : undefined}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered || open ? "#141827" : "#10131D",
            border: `1px solid ${hovered || open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: open ? "10px 10px 0 0" : 10,
            padding: "13px 18px", cursor: hasChanges ? "pointer" : "default",
            transition: "background 150ms, border-color 150ms",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {hasChanges && <Chevron open={open} />}
              <code style={{
                fontSize: 11, fontFamily: "'SF Mono','Fira Code',monospace", color: "rgba(255,255,255,0.32)",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                padding: "2px 7px", borderRadius: 5, letterSpacing: "0.04em", flexShrink: 0,
              }}>
                {shortHash(commit.id)}
              </code>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {commit.message}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {commit.added_count > 0 && <Badge color="#4ade80" text={`+${commit.added_count}`} />}
              {commit.superseded_count > 0 && <Badge color="#f59e0b" text={`~${commit.superseded_count}`} />}
            </div>
          </div>
          {/* timestamp line — the audit anchor */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: hasChanges ? 23 : 0 }}>
            <ClockIcon />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'SF Mono','Fira Code',monospace" }}>
              {absTime(commit.created_at)}
            </span>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.28)" }}>· {relTime(commit.created_at)}</span>
          </div>
        </div>

        {open && (
          <div style={{
            background: "#0C0F18", border: "1px solid rgba(255,255,255,0.12)", borderTop: "none",
            borderRadius: "0 0 10px 10px", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6,
          }}>
            {commit.superseded.map((t, i) => <RelationshipLine key={`s${i}`} triple={t} op="removed" />)}
            {commit.added.map((t, i) => <RelationshipLine key={`a${i}`} triple={t} op="added" />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fact-history explorer — the version timeline of a single subject
// ---------------------------------------------------------------------------

function FactHistoryExplorer() {
  const [subject, setSubject] = useState("RemoteWorkPolicy");
  const [data, setData] = useState<FactHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!subject.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch(`${API}/fact-history?subject=${encodeURIComponent(subject.trim())}`);
      setData(await res.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  return (
    <div style={{
      background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
      padding: "16px 18px", marginBottom: 22,
    }}>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
        Trace a single subject&apos;s version history
      </div>
      <form onSubmit={lookup} style={{ display: "flex", gap: 10 }}>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. RemoteWorkPolicy, PayrollRule, Sales…"
          style={{
            flex: 1, background: "#0C0F17", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 9, padding: "10px 14px", fontSize: 13.5, color: "#fff", outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit" disabled={loading || !subject.trim()}
          style={{
            padding: "10px 18px", background: loading || !subject.trim() ? "rgba(59,130,246,0.25)" : "#3B82F6",
            border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 500,
            color: loading || !subject.trim() ? "rgba(255,255,255,0.4)" : "#fff",
            cursor: loading || !subject.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {loading ? "Tracing…" : "Trace"}
        </button>
      </form>

      {open && data && (
        <div style={{ marginTop: 14 }}>
          {data.versions.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              No history for &ldquo;{data.subject}&rdquo;. Try an exact subject name.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.versions.map((v, i) => {
                const superseded = v.status === "superseded";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                    background: superseded ? "rgba(245,158,11,0.05)" : "rgba(74,222,128,0.05)",
                    border: `1px solid ${superseded ? "rgba(245,158,11,0.2)" : "rgba(74,222,128,0.22)"}`,
                    borderRadius: 9,
                  }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: superseded ? "#f59e0b" : "#4ade80", flexShrink: 0, width: 78, textAlign: "center",
                      background: superseded ? "rgba(245,158,11,0.1)" : "rgba(74,222,128,0.1)",
                      border: `1px solid ${superseded ? "rgba(245,158,11,0.25)" : "rgba(74,222,128,0.25)"}`,
                      borderRadius: 5, padding: "2px 0",
                    }}>
                      {superseded ? "retired" : "current"}
                    </span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontStyle: "italic", flexShrink: 0 }}>
                      {v.predicate}
                    </span>
                    <span style={{ fontSize: 13.5, color: "#fff", flex: 1, minWidth: 0 }}>{v.object}</span>
                    <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", flexShrink: 0, fontFamily: "monospace" }}>
                      #{v.added_at_commit}
                      {v.superseded_at_commit ? ` → retired @#${v.superseded_at_commit}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: 6, fontSize: 12,
      background: "#10131D", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 11px",
    }}>
      <strong style={{ color, fontSize: 14, fontWeight: 650 }}>{value}</strong>
      <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
    </span>
  );
}

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, color, background: `${color}14`,
      border: `1px solid ${color}33`, borderRadius: 6, padding: "1px 7px", fontFamily: "monospace",
    }}>
      {text}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>
      <path d="M4 2l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.1" />
      <path d="M6 3.6V6l1.7 1" stroke="rgba(255,255,255,0.3)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
