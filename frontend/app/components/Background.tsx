"use client";

import { useEffect, useRef } from "react";

/**
 * Calm, premium backdrop matching the dark reference: a near-black canvas with
 * a couple of faint blue glows and a fine grid, plus a soft glow that tracks the
 * cursor. Deliberately quiet so content stays the hero. Purely decorative
 * (pointer-events: none) and respects reduced-motion (glow simply stays put).
 */
export default function Background() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    function onMove(e: MouseEvent) {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`;
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* base wash */}
      <div style={{ position: "absolute", inset: 0, background: "var(--bg)" }} />
      {/* two faint accent glows, top-left + right */}
      <div style={{
        position: "absolute", top: "-18%", left: "-8%", width: 720, height: 720, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(61,124,255,0.14), rgba(61,124,255,0.04) 45%, transparent 68%)",
        filter: "blur(8px)",
      }} />
      <div style={{
        position: "absolute", top: "8%", right: "-14%", width: 640, height: 640, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(94,147,255,0.10), transparent 66%)",
        filter: "blur(8px)",
      }} />
      {/* fine grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.5,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(circle at 50% 30%, black, transparent 80%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 30%, black, transparent 80%)",
      }} />
      {/* cursor-follow glow */}
      <div
        ref={glowRef}
        style={{
          position: "absolute", top: 0, left: 0, width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(61,124,255,0.06), transparent 60%)",
          willChange: "transform",
        }}
      />
    </div>
  );
}
