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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body
        className="min-h-screen"
        style={{ background: "#0a0a0f", color: "#f0f0ff", fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}
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
