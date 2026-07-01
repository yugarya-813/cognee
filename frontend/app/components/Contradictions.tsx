"use client";

import { RelationshipLine, Triple } from "./Relationship";

export interface ContraItem {
  reason: string;
  left: Triple;
  right: Triple;
  leftTag?: string;
  rightTag?: string;
}

// Prominent amber/red warning card that names the conflicting facts and why.
// Used on the Ingest panel and the Changes/diff page — the memory "polices itself".
export function ContradictionBanner({ items }: { items: ContraItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.35)",
      borderRadius: 14, padding: "18px 20px", marginBottom: 22,
      boxShadow: "0 0 0 1px rgba(239,68,68,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ fontSize: 17 }}>⚠️</span>
        <span style={{ fontSize: 14.5, fontWeight: 650, color: "#f87171", letterSpacing: "-0.01em" }}>
          {items.length} contradiction{items.length !== 1 ? "s" : ""} detected
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", margin: "0 0 14px", lineHeight: 1.5 }}>
        These facts disagree with each other — caught automatically, before any tests were run.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((c, i) => (
          <div key={i} style={{
            background: "#0C0F17", border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 10, padding: "12px 12px 10px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <FactRow tag={c.leftTag} triple={c.left} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#f87171", letterSpacing: "0.06em" }}>
                  ✕ CONFLICTS WITH
                </span>
                <span style={{ flex: 1, height: 1, background: "rgba(239,68,68,0.15)" }} />
              </div>
              <FactRow tag={c.rightTag} triple={c.right} />
            </div>
            <p style={{
              fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "10px 0 0",
              lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid rgba(239,68,68,0.3)",
            }}>
              {c.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactRow({ tag, triple }: { tag?: string; triple: Triple }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {tag && (
        <span style={{
          fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
          color: tag === "incoming" ? "#f59e0b" : "rgba(255,255,255,0.4)",
          background: tag === "incoming" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${tag === "incoming" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 5, padding: "2px 6px", flexShrink: 0, width: 66, textAlign: "center",
        }}>
          {tag}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <RelationshipLine triple={triple} op="neutral" />
      </div>
    </div>
  );
}
