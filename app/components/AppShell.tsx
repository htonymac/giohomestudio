"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { TopBar } from "./chrome/TopBar";

/**
 * AppShell — the dashboard chrome (sidebar + topbar + main + footer).
 *
 * Desktop (≥769px): renders EXACTLY as the old inline layout.tsx shell.
 * All mobile behaviour is gated behind `@media (max-width:768px)` in
 * globals.css, plus the hamburger/backdrop nodes which are `display:none`
 * on desktop. So the desktop render is byte-for-byte unchanged — the extra
 * class names (`gh-shell`, `gh-sidebar-wrap`, `gh-topbar`) have no desktop
 * rules attached.
 *
 * Mobile (≤768px): the sidebar becomes an off-canvas drawer toggled by the
 * hamburger; tapping a nav link (route change) or the backdrop closes it.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (i.e. a nav link was tapped).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="gh-shell flex h-screen overflow-hidden">
      {/* Mobile hamburger — display:none on desktop (see globals.css) */}
      <button
        type="button"
        className="gh-hamburger"
        aria-label={navOpen ? "Close menu" : "Open menu"}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Mobile backdrop — display:none on desktop */}
      <div
        className={"gh-nav-backdrop" + (navOpen ? " open" : "")}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar (in-flow on desktop, off-canvas drawer on mobile) */}
      <div className={"gh-sidebar-wrap shrink-0 h-full" + (navOpen ? " open" : "")}>
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ minWidth: 0 }}>
        {/* Top bar */}
        <TopBar className="gh-topbar" />

        {/* Page content */}
        <main className="flex-1" style={{ padding: "22px 32px 48px" }}>
          {children}
        </main>

        {/* Footer strip */}
        <div
          className="gh-footer shrink-0"
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
  );
}
