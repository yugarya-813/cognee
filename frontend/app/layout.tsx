import type { Metadata } from "next";
import "./globals.css";
import TopNav from "./components/TopNav";
import Background from "./components/Background";
import PageFade from "./components/PageFade";

export const metadata: Metadata = {
  title: "Engram — version control for AI memory",
  description: "Version, test, review, and replay what an AI knows — the way Git does for code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "var(--bg)", minHeight: "100vh" }}>
        {/* Fonts — React hoists these <link>s into <head>. Geist (sans) + Geist Mono. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600&display=swap"
        />
        <Background />
        <TopNav />
        <main style={{ position: "relative", zIndex: 1 }}>
          <PageFade>{children}</PageFade>
        </main>
      </body>
    </html>
  );
}
