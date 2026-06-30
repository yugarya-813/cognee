"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = "http://localhost:8000";

interface Commit {
  id: number;
  message: string;
  created_at: string;
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

  useEffect(() => {
    fetch(`${API}/commits`)
      .then((r) => r.json())
      .then((data: Commit[]) => {
        setCommits(data.slice().reverse());
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            Commits
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
              {commits.length}
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
          Full history of memory changes
        </p>
      </div>

      {/* Timeline */}
      {loading && (
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading…</div>
      )}

      {!loading && commits.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
          No commits yet.
        </div>
      )}

      {!loading && commits.length > 0 && (
        <div style={{ position: "relative" }}>
          {/* Vertical track line */}
          <div style={{
            position: "absolute",
            left: 11,
            top: 16,
            bottom: 16,
            width: 1,
            background: "rgba(255,255,255,0.07)",
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {commits.map((commit) => (
              <CommitRow key={commit.id} commit={commit} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommitRow({ commit }: { commit: { id: number; message: string; created_at: string } }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      {/* Dot */}
      <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 23, height: 23, borderRadius: "50%",
          background: "#0A0B12",
          border: `2px solid ${hovered ? "#3B82F6" : "rgba(59,130,246,0.4)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 150ms",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: hovered ? "#3B82F6" : "rgba(59,130,246,0.6)",
            transition: "background 150ms",
          }} />
        </div>
      </div>

      {/* Card */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1,
          background: hovered ? "#141827" : "#10131D",
          border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: 10,
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          transition: "background 150ms, border-color 150ms",
        }}
      >
        {/* Left: hash + message */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <code style={{
            fontSize: 11,
            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
            color: "rgba(255,255,255,0.32)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 7px",
            borderRadius: 5,
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}>
            {shortHash(commit.id)}
          </code>
          <span style={{
            fontSize: 14, fontWeight: 500, color: "#fff",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {commit.message}
          </span>
        </div>

        {/* Right: time + browse link */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
            {relativeTime(commit.created_at)}
          </span>
          <Link
            href={`/facts?commit=${commit.id}`}
            className="browse-btn"
            style={{
              fontSize: 12,
              color: "#3B82F6",
              textDecoration: "none",
              fontWeight: 500,
              padding: "4px 11px",
              borderRadius: 6,
              border: "1px solid rgba(59,130,246,0.3)",
              background: "rgba(59,130,246,0.08)",
              transition: "background 150ms, border-color 150ms",
            }}
          >
            Browse →
          </Link>
        </div>
      </div>
    </div>
  );
}
