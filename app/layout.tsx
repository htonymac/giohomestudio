import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";

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
          <div className="flex-1 overflow-y-auto">
            <main className="min-h-full" style={{ padding: "28px 32px" }}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
