"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RelationshipLine, type Triple } from "../components/Relationship";

import { API } from "../config";

interface Commit {
  id: number;
  message: string;
  created_at: string;
  added: number;
  removed: number;
  total_facts: number;
}
interface CommitDetail {
  id: number;
  message: string;
  created_at: string;
  added: Triple[];
  removed: Triple[];
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortHash(id: number): string {
  return id.toString(16).padStart(7, "0");
}

export default function CommitsPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, CommitDetail>>({});
  const [activeCommit, setActiveCommit] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data.slice().reverse());
        setLoading(false);
      });
    fetch(`${API}/active`)
      .then((r) => r.json())
      .then((d) => setActiveCommit(d.active_commit));
  }, []);

  function deploy(id: number) {
    setActiveCommit(id); // optimistic
    fetch(`${API}/merge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commit: id }),
    }).catch(() => {});
  }

  function toggle(id: number) {
    setOpenId((cur) => (cur === id ? null : id));
    if (!details[id]) {
      fetch(`${API}/commit/${id}`)
        .then((r) => r.json())
        .then((d: CommitDetail) => setDetails((prev) => ({ ...prev, [id]: d })));
    }
  }

  return (
    <div style={{ padding: "40px 48px", maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Commits
          </h1>
          {!loading && (
            <span style={{
              fontSize: 12, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1px 8px",
            }}>
              {commits.length}
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
          The full history of the memory — click a commit to see the facts &amp; relationships it changed.
        </p>
      </div>

      {loading && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading…</div>}

      {!loading && commits.length > 0 && (
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 11, top: 16, bottom: 16, width: 1, background: "rgba(255,255,255,0.07)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {commits.map((commit) => (
              <CommitRow
                key={commit.id}
                commit={commit}
                open={openId === commit.id}
                detail={details[commit.id]}
                deployed={activeCommit === commit.id}
                onToggle={() => toggle(commit.id)}
                onDeploy={() => deploy(commit.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommitRow({
  commit, open, detail, deployed, onToggle, onDeploy,
}: {
  commit: Commit; open: boolean; detail?: CommitDetail; deployed: boolean;
  onToggle: () => void; onDeploy: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, position: "relative", zIndex: 1, marginTop: 8 }}>
        <div style={{
          width: 23, height: 23, borderRadius: "50%", background: "#0A0B12",
          border: `2px solid ${deployed ? "#34D399" : open || hovered ? "#3B82F6" : "rgba(59,130,246,0.4)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 150ms",
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: deployed ? "#34D399" : open || hovered ? "#3B82F6" : "rgba(59,130,246,0.6)", transition: "background 150ms" }} />
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div
          onClick={onToggle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: hovered || open ? "#141827" : "#10131D",
            border: `1px solid ${hovered || open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: open ? "10px 10px 0 0" : 10,
            padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, cursor: "pointer", transition: "background 150ms, border-color 150ms",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Chevron open={open} />
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

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {commit.added > 0 && <Badge color="#4ade80" text={`+${commit.added}`} />}
            {commit.removed > 0 && <Badge color="#f87171" text={`−${commit.removed}`} />}
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.26)" }}>{commit.total_facts} facts</span>
            {deployed ? (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#34D399", background: "rgba(52,211,153,0.1)",
                border: "1px solid rgba(52,211,153,0.3)", borderRadius: 20, padding: "2px 9px",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} /> Deployed
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onDeploy(); }}
                style={{
                  fontSize: 11.5, fontWeight: 500, color: hovered ? "#3B82F6" : "rgba(255,255,255,0.3)",
                  background: "transparent", border: `1px solid ${hovered ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", transition: "all 150ms",
                }}
              >
                Deploy
              </button>
            )}
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{relativeTime(commit.created_at)}</span>
          </div>
        </div>

        {open && (
          <div style={{
            background: "#0C0F18", border: "1px solid rgba(255,255,255,0.12)", borderTop: "none",
            borderRadius: "0 0 10px 10px", padding: "16px 18px",
          }}>
            {!detail && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Loading changes…</div>}
            {detail && detail.added.length === 0 && detail.removed.length === 0 && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>No relationship changes.</div>
            )}
            {detail && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detail.removed.map((t, i) => <RelationshipLine key={`r${i}`} triple={t} op="removed" />)}
                {detail.added.map((t, i) => <RelationshipLine key={`a${i}`} triple={t} op="added" />)}
                <Link href={`/facts?commit=${commit.id}`} style={{ fontSize: 12, color: "#3B82F6", textDecoration: "none", marginTop: 6 }}>
                  Browse all facts at this commit →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
