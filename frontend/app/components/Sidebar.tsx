"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/facts",   label: "Facts",   icon: <FactsIcon /> },
  { href: "/graph",   label: "Graph",   icon: <GraphIcon /> },
  { href: "/commits", label: "Commits", icon: <CommitsIcon /> },
  { href: "/changes", label: "Changes", icon: <ChangesIcon /> },
  { href: "/tests",   label: "Tests",   icon: <TestsIcon /> },
  { href: "/ask",     label: "Ask",     icon: <AskIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: "#0A0B12",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, background: "#3B82F6",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="3.5" cy="3.5" r="2" stroke="white" strokeWidth="1.5"/>
              <circle cx="10.5" cy="10.5" r="2" stroke="white" strokeWidth="1.5"/>
              <path d="M3.5 5.5v3h7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>Engram</span>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 5, paddingLeft: 36, lineHeight: 1.4 }}>
          Memory version control
        </p>
      </div>

      <nav style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "?");
          return (
            <Link key={href} href={href} className={`nav-link${active ? " active" : ""}`}>
              <span style={{ display: "flex", alignItems: "center", opacity: active ? 1 : 0.65 }}>
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.5, margin: 0 }}>
          GitHub for AI memory
        </p>
      </div>
    </aside>
  );
}

function FactsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4 5h6M4 7.5h6M4 10h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="3.5" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="11" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="6.5" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 4.5l4.5 4.5M9.5 5l-4 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function CommitsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1.5 7h2.5M10 7h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ChangesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M10 8l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TestsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3h3v8H2zM9 3h3v8H9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5 7h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function AskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 5.5a1.5 1.5 0 0 1 3 .5c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="7" cy="10.5" r="0.75" fill="currentColor"/>
    </svg>
  );
}
