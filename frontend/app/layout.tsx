import type { Metadata } from "next";
import "./globals.css";
import TopNav from "./components/TopNav";
import Background from "./components/Background";
import PageFade from "./components/PageFade";

export const metadata: Metadata = {
  title: "Engram — memory version control",
  description: "GitHub for AI memory: version, test, review and replay what an AI knows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0A0B12", minHeight: "100vh" }}>
        <Background />
        <TopNav />
        <main style={{ position: "relative", zIndex: 1 }}>
          <PageFade>{children}</PageFade>
        </main>
      </body>
    </html>
  );
}
