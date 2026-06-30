"use client";

import { useEffect, useRef } from "react";

/**
 * Animated pseudo-3D node network behind the whole app — an on-brand nod to the
 * knowledge graph. It slowly rotates, drifts with the cursor, and parallaxes as
 * you scroll. A soft glow tracks the cursor on top. Purely decorative
 * (pointer-events: none), kept subtle so content stays readable.
 */
export default function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const scroll = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;

    const N = 54;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
      vx: (Math.random() - 0.5) * 0.0009,
      vy: (Math.random() - 0.5) * 0.0009,
    }));

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let t = 0;
    function frame() {
      t += 0.0014;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2.3;
      const par = scroll.current * 0.05;
      const mx = mouse.current.x - 0.5;
      const my = mouse.current.y - 0.5;
      const spread = Math.min(w, h) * 0.6;

      const pts = nodes.map((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x > 1.1) n.x = -1.1; else if (n.x < -1.1) n.x = 1.1;
        if (n.y > 1.1) n.y = -1.1; else if (n.y < -1.1) n.y = 1.1;
        const ang = t + n.z * 0.6;
        const rx = n.x * Math.cos(ang) - n.y * Math.sin(ang);
        const ry = n.x * Math.sin(ang) + n.y * Math.cos(ang);
        const depth = 0.55 + n.z * 0.95;
        const px = cx + rx * spread * depth + mx * 46 * (n.z + 0.3);
        const py = cy + ry * spread * depth + my * 46 * (n.z + 0.3) - par * (0.4 + n.z);
        return { px, py, z: n.z, r: 0.6 + n.z * 2 };
      });

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].px - pts[j].px;
          const dy = pts[i].py - pts[j].py;
          const d2 = dx * dx + dy * dy;
          if (d2 < 150 * 150) {
            const a = (1 - Math.sqrt(d2) / 150) * 0.13 * (0.4 + Math.min(pts[i].z, pts[j].z));
            ctx.strokeStyle = `rgba(99,130,246,${a})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(pts[i].px, pts[i].py);
            ctx.lineTo(pts[j].px, pts[j].py);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = `rgba(${130 + p.z * 50},${160 + p.z * 40},255,${0.22 + p.z * 0.5})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();

    function onMove(e: MouseEvent) {
      mouse.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX - 320}px, ${e.clientY - 320}px)`;
      }
    }
    function onScroll() {
      scroll.current = window.scrollY || document.documentElement.scrollTop || 0;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.75 }} />
      <div
        ref={glowRef}
        style={{
          position: "fixed", top: 0, left: 0, width: 640, height: 640, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.10), rgba(99,102,241,0.05) 40%, transparent 65%)",
          pointerEvents: "none", zIndex: 0, willChange: "transform",
        }}
      />
    </>
  );
}
