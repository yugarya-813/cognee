import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";

export const metadata: Metadata = {
  title: "Engram",
  description: "GitHub for AI memory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", display: "flex", margin: 0, background: "#0A0B12" }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: "auto", background: "#0A0B12" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
