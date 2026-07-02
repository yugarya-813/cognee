"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Primary spine + climax live in the top bar; everything else is grouped under
// Explore so nothing is orphaned but the nav stays calm.
const PRIMARY = [
  { label: "Demo", href: "/demo", match: ["/demo"] },
  { label: "Compare", href: "/compare", match: ["/compare"] },
];

const EXPLORE = [
  { label: "Knowledge Graph", href: "/graph" },
  { label: "Facts", href: "/facts" },
  { label: "Commits", href: "/commits" },
  { label: "Changes / Diff", href: "/changes" },
  { label: "Replay", href: "/replay" },
  { label: "Audit Log", href: "/audit" },
  { label: "Tests", href: "/tests" },
  { label: "Ingest", href: "/ingest-doc" },
  { label: "Ask", href: "/ask" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const exploreActive = EXPLORE.some((e) => pathname === e.href || pathname.startsWith(e.href + "?"));

  // close the dropdown on route change or outside click
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      background: "rgba(8,9,13,0.72)", borderBottom: "1px solid var(--hairline)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, padding: "0 28px", maxWidth: 1440, margin: "0 auto",
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
          <div style={{
            width: 29, height: 29, borderRadius: 9, background: "linear-gradient(135deg,var(--accent),var(--accent-bright))",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 2px 16px -2px var(--accent-glow)",
          }}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <circle cx="3.5" cy="3.5" r="2" stroke="white" strokeWidth="1.5" />
              <circle cx="10.5" cy="10.5" r="2" stroke="white" strokeWidth="1.5" />
              <path d="M3.5 5.5v3h7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 16.5, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>Engram</span>
          <span className="mono" style={{
            fontSize: 10.5, color: "var(--text-3)", border: "1px solid var(--hairline)",
            borderRadius: 5, padding: "1px 7px", marginLeft: 1,
          }}>
            memory vcs
          </span>
        </Link>

        {/* Right side */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {PRIMARY.map((t) => {
            const active = t.match.some((m) => pathname === m || pathname.startsWith(m + "?"));
            return (
              <Link key={t.label} href={t.href} className={`top-tab${active ? " active" : ""}`}>
                {t.label}
                <span className="ul" />
              </Link>
            );
          })}

          {/* Explore dropdown */}
          <div ref={wrapRef} style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="true"
              className={`top-tab${exploreActive ? " active" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Explore
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 5, transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms" }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="ul" />
            </button>
            {open && (
              <div className="eg-menu">
                {EXPLORE.map((e) => {
                  const active = pathname === e.href || pathname.startsWith(e.href + "?");
                  return (
                    <Link key={e.href} href={e.href} className={active ? "active" : ""}>
                      {e.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <Link href="/demo" className="eg-btn eg-btn-primary" style={{ marginLeft: 10, padding: "8px 15px", fontSize: 13, flexShrink: 0 }}>
            Run the demo
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2.5 6.5h7M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
