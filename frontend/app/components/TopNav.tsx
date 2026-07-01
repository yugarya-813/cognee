"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SubTab { label: string; href: string; }
interface Tab { label: string; href: string; match: string[]; sub?: SubTab[]; }

// Sections are consolidated: Knowledge = Facts + Graph, History = Commits + Changes.
const TABS: Tab[] = [
  { label: "Compare", href: "/compare", match: ["/compare"] },
  {
    label: "Knowledge", href: "/graph", match: ["/graph", "/facts"],
    sub: [{ label: "Graph", href: "/graph" }, { label: "Facts", href: "/facts" }],
  },
  {
    label: "History", href: "/commits", match: ["/commits", "/changes", "/replay"],
    sub: [
      { label: "Commits", href: "/commits" },
      { label: "Changes", href: "/changes" },
      { label: "Replay", href: "/replay" },
    ],
  },
  { label: "Ingest", href: "/ingest-doc", match: ["/ingest-doc"] },
  { label: "Tests", href: "/tests", match: ["/tests"] },
  { label: "Ask", href: "/ask", match: ["/ask"] },
];

export default function TopNav() {
  const pathname = usePathname();
  const activeTab = TABS.find((t) => t.match.some((m) => pathname === m || pathname.startsWith(m + "?")));

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      background: "rgba(10,11,18,0.72)", borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 58, padding: "0 28px", maxWidth: 1440, margin: "0 auto",
      }}>
        {/* Logo */}
        <Link href="/compare" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 28, height: 28, borderRadius: 9, background: "linear-gradient(135deg,#3B82F6,#6366F1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 2px 12px rgba(59,130,246,0.4)",
          }}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <circle cx="3.5" cy="3.5" r="2" stroke="white" strokeWidth="1.5" />
              <circle cx="10.5" cy="10.5" r="2" stroke="white" strokeWidth="1.5" />
              <path d="M3.5 5.5v3h7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>Engram</span>
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5, padding: "1px 6px", marginLeft: 2, letterSpacing: "0.02em",
          }}>
            memory vcs
          </span>
        </Link>

        {/* Primary tabs (top-right) */}
        <nav style={{ display: "flex", gap: 2 }}>
          {TABS.map((t) => {
            const active = activeTab?.label === t.label;
            return (
              <Link key={t.label} href={t.href} className={`top-tab${active ? " active" : ""}`}>
                {t.label}
                <span className="ul" />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Contextual sub-tabs for consolidated sections */}
      {activeTab?.sub && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.012)" }}>
          <div style={{ display: "flex", gap: 6, padding: "8px 28px", maxWidth: 1440, margin: "0 auto" }}>
            {activeTab.sub.map((s) => {
              const active = pathname === s.href || pathname.startsWith(s.href + "?");
              return (
                <Link key={s.href} href={s.href} className={`sub-tab${active ? " active" : ""}`}>
                  {s.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
