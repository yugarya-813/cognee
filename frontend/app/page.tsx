import Link from "next/link";
import Terminal from "./components/Terminal";

export default function Home() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 40px 90px" }}>
      <div className="hero-grid">
        {/* Left — headline, subhead, CTAs */}
        <div>
          <span className="eg-pill" style={{ marginBottom: 26 }}>
            <span className="dot" />
            Live · commit #8 deployed
          </span>

          <h1 style={{
            fontSize: "clamp(40px, 5.6vw, 68px)", fontWeight: 800, lineHeight: 1.03,
            letterSpacing: "-0.035em", color: "var(--text)", margin: 0,
          }}>
            Version control for your{" "}
            <span style={{ color: "var(--accent)" }}>AI&apos;s memory.</span>
          </h1>

          <p style={{
            fontSize: 17, lineHeight: 1.65, color: "var(--text-2)", margin: "24px 0 34px",
            maxWidth: 520,
          }}>
            Engram versions every fact your AI knows, tests changes before they ship,
            catches contradictions automatically, and lets you replay what it believed
            at any point in time.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/demo" className="eg-btn eg-btn-primary" style={{ padding: "13px 24px", fontSize: 15 }}>
              See the demo
              <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5h7M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/compare" className="eg-btn eg-btn-outline" style={{ padding: "13px 24px", fontSize: 15 }}>
              See the comparison
            </Link>
          </div>

          {/* tiny reassurance row */}
          <div style={{ display: "flex", gap: 22, marginTop: 34, flexWrap: "wrap" }}>
            {[
              ["Versioned", "every fact, every commit"],
              ["Tested", "contradictions caught pre-deploy"],
              ["Reversible", "replay any point in time"],
            ].map(([t, d]) => (
              <div key={t} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — the signature terminal */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Terminal />
        </div>
      </div>
    </div>
  );
}
