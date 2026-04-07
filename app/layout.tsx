import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import SearchBar from "./components/SearchBar";
import CommandPalette from "./components/CommandPalette";

export const metadata: Metadata = {
  title: "GioHomeStudio",
  description: "AI-powered video content studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body
        className="min-h-screen"
        style={{ background: "var(--bg, #070710)", color: "var(--text, #eeeeff)", fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 13 }}
      >
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar — fixed width */}
          <div className="shrink-0 h-full" style={{ width: 220 }}>
            <Sidebar />
          </div>

          {/* Main content — scrollable */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Top bar with search */}
            <div className="shrink-0 flex items-center justify-between gap-4" style={{ padding: "12px 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <SearchBar />
              <div className="flex items-center gap-2 shrink-0">
                <span className="pill pill-green" style={{ fontSize: 9 }}>● Online</span>
              </div>
            </div>
            <main className="flex-1" style={{ padding: "24px 32px" }}>
              {children}
            </main>
          </div>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
