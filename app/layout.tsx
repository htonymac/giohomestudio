import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "./components/AppShell";
import CommandPalette from "./components/CommandPalette";
import { ToastProvider } from "./components/Toast";
import { CoordinatorProvider } from "./components/CoordinatorProvider";

export const metadata: Metadata = {
  title: "GioHomeStudio",
  description: "AI-powered video content studio",
};

// Without this, phones assume a ~980px layout viewport and shrink-to-fit the
// desktop layout — every card renders huge and unclickable. This one export
// is what activates the entire mobile shell in globals.css (≤768px media
// query: drawer sidebar, hamburger, grid collapse). Desktop is unaffected.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
          <CoordinatorProvider>
            <AppShell>{children}</AppShell>
            <CommandPalette />
          </CoordinatorProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
