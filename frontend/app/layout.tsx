import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engram",
  description: "GitHub for AI memory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <aside className="w-52 shrink-0 bg-white flex flex-col" style={{ borderRight: "1px solid #e5e7eb" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
            <span className="text-base font-semibold tracking-tight text-gray-900">Engram</span>
          </div>
          <nav className="flex flex-col gap-0.5 p-3 pt-3">
            <Link
              href="/facts"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              Facts
            </Link>
            <Link
              href="/commits"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              Commits
            </Link>
            <Link
              href="/ask"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              Ask
            </Link>
          </nav>
        </aside>
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
