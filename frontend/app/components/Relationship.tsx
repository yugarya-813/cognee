"use client";

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  source: string;
}

// A single fact rendered as a relationship:  subject —predicate→ object
// Optionally prefixed with a +/− diff marker.
export function RelationshipLine({ triple, op }: { triple: Triple; op?: "added" | "removed" | "neutral" }) {
  const sign = op === "added" ? "+" : op === "removed" ? "−" : "";
  const signColor = op === "added" ? "#4ade80" : op === "removed" ? "#f87171" : "transparent";
  const bg = op === "added" ? "rgba(74,222,128,0.06)" : op === "removed" ? "rgba(248,113,113,0.06)" : "transparent";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: bg }}>
      {sign && <span style={{ fontFamily: "monospace", fontWeight: 700, color: signColor, width: 10, flexShrink: 0 }}>{sign}</span>}
      <span style={{
        fontSize: 12.5, fontWeight: 600, color: "#fff", background: "rgba(59,130,246,0.12)",
        border: "1px solid rgba(59,130,246,0.3)", padding: "2px 9px", borderRadius: 6, flexShrink: 0,
      }}>
        {triple.subject}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.4)", fontSize: 12, fontStyle: "italic", flexShrink: 0 }}>
        {triple.predicate}
        <svg width="16" height="8" viewBox="0 0 16 8" fill="none" style={{ flexShrink: 0 }}>
          <path d="M0 4h13M10 1l4 3-4 3" stroke="rgba(255,255,255,0.25)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{
        fontSize: 12.5, color: "rgba(255,255,255,0.85)", background: "rgba(99,102,241,0.1)",
        border: "1px solid rgba(99,102,241,0.25)", padding: "2px 9px", borderRadius: 6,
      }}>
        {triple.object}
      </span>
      {triple.source && (
        <span style={{
          fontSize: 10.5, color: "rgba(255,255,255,0.3)", fontFamily: "monospace",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          padding: "1px 6px", borderRadius: 4, marginLeft: "auto", flexShrink: 0,
        }}>
          {triple.source}
        </span>
      )}
    </div>
  );
}
