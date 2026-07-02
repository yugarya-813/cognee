"use client";

import { ReactNode } from "react";

/**
 * Shared page furniture so every Explore page matches the polish of Demo/Compare:
 * a contained width, a bold header with 1–2 accent words, and a compact commit
 * picker (uniform "#N" pills — no ragged wrapping).
 */

export function PageShell({ children, width = 1040 }: { children: ReactNode; width?: number }) {
  return (
    <div style={{ maxWidth: width, margin: "0 auto", padding: "48px 40px 96px" }}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow, title, accent, tail, subtitle, right,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  tail?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 20, marginBottom: 26, flexWrap: "wrap",
    }}>
      <div>
        {eyebrow && (
          <span className="eg-pill" style={{ marginBottom: 14 }}><span className="dot" />{eyebrow}</span>
        )}
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", margin: 0, color: "var(--text)", lineHeight: 1.1 }}>
          {title}{accent ? <> <span style={{ color: "var(--accent)" }}>{accent}</span></> : null}{tail ?? ""}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14.5, color: "var(--text-2)", margin: "10px 0 0", maxWidth: 660, lineHeight: 1.6 }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

interface CommitLite { id: number; message: string }

export function CommitPicker({
  commits, value, onChange, label = "Snapshot", exclude,
}: {
  commits: CommitLite[];
  value: number | null;
  onChange: (id: number) => void;
  label?: string;
  exclude?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {label && <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 2 }}>{label}</span>}
      {commits.filter((c) => c.id !== exclude).map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            title={`#${c.id} · ${c.message}`}
            onClick={() => onChange(c.id)}
            className="mono"
            style={{
              padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: active ? 600 : 500,
              border: `1px solid ${active ? "var(--accent-line)" : "var(--hairline)"}`,
              background: active ? "var(--accent-weak)" : "transparent",
              color: active ? "var(--accent-bright)" : "var(--text-3)",
              cursor: "pointer", transition: "all 150ms", lineHeight: 1,
            }}
          >
            #{c.id}
          </button>
        );
      })}
    </div>
  );
}
