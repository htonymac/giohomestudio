import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import { ToastProvider } from "./components/Toast";
import { TopBar } from "./components/chrome/TopBar";

export const metadata: Metadata = {
  title: "GioHomeStudio",
  description: "AI-powered video content studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen"
        style={{
          background: "#0e0e10",
          color: "#fff",
          fontFamily: "'Geist', system-ui, sans-serif",
          fontSize: 14,
        }}
      >
        <ToastProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <div className="shrink-0 h-full">
              <Sidebar />
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ minWidth: 0 }}>
              {/* Top bar */}
              <TopBar />

              {/* Page content */}
              <main className="flex-1" style={{ padding: "22px 32px 48px" }}>
                {children}
              </main>

              {/* Footer strip */}
              <div
                className="shrink-0"
                style={{
                  padding: "6px 32px",
                  borderTop: "1px solid rgba(255,255,255,.06)",
                  background: "#0e0e10",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 9, color: "#55555a" }}>
                  AI-assisted content. Human approval required. You are the publisher of record.
                </span>
                <span style={{ fontSize: 9, color: "#55555a" }}>
                  <a href="/terms" style={{ color: "#7b7b80", textDecoration: "none", marginRight: 12 }}>Terms</a>
                  <a href="/privacy" style={{ color: "#7b7b80", textDecoration: "none" }}>Privacy</a>
                </span>
              </div>
            </div>
          </div>
          <CommandPalette />
        </ToastProvider>
      </body>
    </html>
  );
}
