"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    group: "Create",
    items: [
      { href: "/dashboard",              label: "Home + Studio",    icon: "✦" },
      { href: "/dashboard/commercial",   label: "Commercial Maker", icon: "📣" },
    ],
  },
  {
    group: "Content",
    items: [
      { href: "/dashboard/review",      label: "Review Queue",    icon: "◈", badge: true },
      { href: "/dashboard/registry",    label: "All Content",     icon: "▤" },
      { href: "/dashboard/assets",      label: "Asset Library",   icon: "📦" },
    ],
  },
  {
    group: "Audio & Voice",
    items: [
      { href: "/dashboard/music-studio",     label: "Music Studio",   icon: "🎵" },
      { href: "/dashboard/character-voices", label: "Characters",      icon: "🎭" },
      { href: "/dashboard/sfx-library",      label: "SFX Library",    icon: "💥" },
    ],
  },
  {
    group: "AI & Models",
    items: [
      { href: "/dashboard/models",       label: "AI Models",       icon: "◆" },
      { href: "/dashboard/video-tools",   label: "Video Tools",     icon: "✂" },
      { href: "/dashboard/video-trimmer", label: "Video Trimmer",   icon: "🎬" },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/dashboard/analytics",  label: "Analytics",       icon: "📊" },
      { href: "/dashboard/budget",     label: "Budget",          icon: "💰" },
      { href: "/dashboard/ab-testing", label: "A/B Testing",     icon: "⚖" },
      { href: "/dashboard/calendar",   label: "Calendar",        icon: "📅" },
      { href: "/dashboard/story-bank", label: "Story Bank",      icon: "💡" },
    ],
  },
  {
    group: "Settings",
    items: [
      { href: "/dashboard/destination-pages", label: "Publishing Pages",  icon: "⊞" },
      { href: "/dashboard/settings",          label: "Settings",          icon: "⚙" },
    ],
  },
];

function LLMStatus() {
  const [label, setLabel] = useState("Checking LLM…");
  const [dot,   setDot]   = useState("#facc15");

  useEffect(() => {
    fetch("/api/llm/status")
      .then(r => r.json())
      .then(data => {
        const count = data.activeCount ?? 0;
        if (count > 0) {
          setDot("#4ade80");
          setLabel(`LLM: ${data.willUse}`);
        } else {
          setDot("#f87171");
          setLabel("LLM: not configured");
        }
      })
      .catch(() => { setDot("#f87171"); setLabel("LLM: offline"); });
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: dot }} />
      <span style={{ fontSize: 11, color: "#5a5a7a" }}>{label}</span>
    </div>
  );
}

export default function Sidebar({ reviewCount }: { reviewCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full" style={{ background: "var(--surface2)", borderRight: "1px solid var(--border)" }}>
      {/* Logo */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center font-bold text-white shrink-0"
            style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--accent2))", fontSize: 15 }}
          >
            G
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", lineHeight: 1.2 }}>GioHomeStudio</p>
            <p style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>Content Studio</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: "14px 8px 4px" }}>
        {NAV.map((group) => (
          <div key={group.group} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--text3)", padding: "0 6px", marginBottom: 4 }}>
              {group.group}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 8, marginBottom: 1,
                    fontSize: "12.5px", fontWeight: active ? 500 : 450,
                    color: active ? "#c0bcff" : "var(--text2)",
                    background: active ? "rgba(108,99,255,0.15)" : "transparent",
                    position: "relative", transition: "all 0.15s",
                  }}
                >
                  {active && (
                    <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, borderRadius: "0 2px 2px 0", background: "var(--accent)" }} />
                  )}
                  <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && reviewCount ? (
                    <span style={{ fontSize: 9, fontWeight: 700, background: "var(--accent2)", color: "white", padding: "1px 5px", borderRadius: 100 }}>
                      {reviewCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
        {/* Credit balance */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 8, background: "var(--surface3)", borderRadius: 8 }}>
          <span style={{ fontSize: 14 }}>💳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>$0.00</div>
            <div style={{ fontSize: 9, color: "var(--text3)" }}>Credit Balance</div>
          </div>
          <a href="/dashboard/settings" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(0,229,195,0.12)", color: "var(--accent3, #00e5c3)", border: "1px solid rgba(0,229,195,0.25)", textDecoration: "none", fontWeight: 600 }}>
            Settings
          </a>
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>H</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Henry</div>
            <div style={{ fontSize: 10, color: "var(--accent3, #00e5c3)" }}>Creator</div>
          </div>
        </div>

        <LLMStatus />
      </div>
    </aside>
  );
}
