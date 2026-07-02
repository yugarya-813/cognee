"use client";

import { useEffect, useRef, useState } from "react";

/** One line of the scripted session. */
type Kind = "cmd" | "ok" | "warn" | "info" | "blank";
interface Line { kind: Kind; text: string }

const SCRIPT: Line[] = [
  { kind: "cmd",  text: '$ engram apply --change "remote-work 3→5 days"' },
  { kind: "ok",   text: "[✓] diff generated" },
  { kind: "warn", text: "[⚠] contradiction caught → payroll still says 3 days" },
  { kind: "ok",   text: "[✓] fixed & re-tested → 7/7 passing" },
  { kind: "ok",   text: "[✓] deployed live memory" },
  { kind: "ok",   text: '[✓] replayed: commit 4 "3 days" → commit 8 "5 days"' },
  { kind: "blank", text: "" },
  { kind: "info", text: "▶ memory updated safely · every change reviewable" },
];

const COLOR: Record<Kind, string> = {
  cmd:  "var(--text)",
  ok:   "var(--green)",
  warn: "var(--amber)",
  info: "var(--accent-bright)",
  blank: "transparent",
};

// Type the whole script out, hold, then loop. One tiny timer drives it.
export default function Terminal() {
  const [line, setLine] = useState(0);   // lines fully/partly revealed
  const [chars, setChars] = useState(0); // chars typed on the current line
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setLine(SCRIPT.length); setDone(true); return; }

    function step() {
      setChars((c) => {
        const current = SCRIPT[line];
        if (!current) return c;
        if (c < current.text.length) {
          timer.current = setTimeout(step, current.kind === "cmd" ? 34 : 16);
          return c + 1;
        }
        // line finished → advance
        if (line < SCRIPT.length - 1) {
          timer.current = setTimeout(() => { setLine((l) => l + 1); setChars(0); }, current.text ? 320 : 140);
        } else {
          setDone(true);
          timer.current = setTimeout(() => { setLine(0); setChars(0); setDone(false); }, 3200); // hold, then loop
        }
        return c;
      });
    }
    timer.current = setTimeout(step, 260);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  return (
    <div className="eg-panel" style={{
      background: "#0B0D13", borderColor: "var(--hairline-2)", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(61,124,255,0.05)",
      width: "100%", maxWidth: 560,
    }}>
      {/* title bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        borderBottom: "1px solid var(--hairline)", background: "rgba(255,255,255,0.015)",
      }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840" }} />
        <span className="mono" style={{ marginLeft: 10, fontSize: 12, color: "var(--text-3)" }}>
          engram — memory.log
        </span>
      </div>

      {/* body */}
      <div className="mono" style={{ padding: "18px 20px", fontSize: 13.5, lineHeight: 1.85, minHeight: 268 }}>
        {SCRIPT.map((l, i) => {
          if (i > line) return <div key={i} style={{ height: l.kind === "blank" ? 12 : 25 }} />;
          const isCurrent = i === line && !done;
          const text = isCurrent ? l.text.slice(0, chars) : l.text;
          if (l.kind === "blank") return <div key={i} style={{ height: 12 }} />;
          return (
            <div key={i} style={{ color: COLOR[l.kind], whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {renderLine(l.kind, text)}
              {isCurrent && <span className="term-cursor" />}
            </div>
          );
        })}
        {done && (
          <span className="term-cursor" style={{ marginLeft: 0 }} />
        )}
      </div>
    </div>
  );
}

// Tint the [✓] / [⚠] / $ / ▶ markers a touch brighter than the line body.
function renderLine(kind: Kind, text: string) {
  if (kind === "cmd" && text.startsWith("$")) {
    return (<><span style={{ color: "var(--accent-bright)" }}>$</span>{text.slice(1)}</>);
  }
  const m = text.match(/^(\[.\]|▶)(.*)$/);
  if (m) {
    return (<><span style={{ fontWeight: 600 }}>{m[1]}</span>{m[2]}</>);
  }
  return text;
}
