"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  // ── Studio — the main creative workspace ──
  {
    group: "Studio",
    items: [
      { href: "/dashboard",              label: "Create",           icon: "✦" },
      { href: "/dashboard/templates",    label: "Templates",        icon: "🚀" },
      { href: "/dashboard/commercial",   label: "Commercial Maker", icon: "📣" },
    ],
  },
  // ── Editing Tools — video, image, audio tools ──
  {
    group: "Editing Tools",
    items: [
      { href: "/dashboard/video-editor",  label: "Video Editor",     icon: "🎬" },
      { href: "/dashboard/ad-editor",     label: "Ad / Image Editor",icon: "🖼" },
      { href: "/dashboard/video-tools",   label: "Video Tools",      icon: "✂" },
      { href: "/dashboard/video-trimmer", label: "Video Trimmer",    icon: "✄" },
      { href: "/dashboard/music-studio",  label: "Music & DJ",       icon: "🎵" },
      { href: "/dashboard/sfx-library",   label: "SFX Library",      icon: "💥" },
    ],
  },
  // ── Content — everything related to your content lifecycle ──
  {
    group: "Content",
    items: [
      { href: "/dashboard/review",           label: "Review Queue",    icon: "◈", badge: true },
      { href: "/dashboard/registry",         label: "All Content",     icon: "▤" },
      { href: "/dashboard/assets",           label: "Asset Library",   icon: "📦" },
      { href: "/dashboard/character-voices", label: "Characters",      icon: "🎭" },
      { href: "/dashboard/story-bank",       label: "Story Bank",      icon: "💡" },
      { href: "/dashboard/series-wizard",    label: "Series Wizard",   icon: "📺" },
    ],
  },
  // ── Publish & Grow — where content goes after creation ──
  {
    group: "Publish & Grow",
    items: [
      { href: "/dashboard/destination-pages", label: "Publishing Pages", icon: "⊞" },
      { href: "/dashboard/calendar",          label: "Calendar",         icon: "📅" },
      { href: "/dashboard/analytics",         label: "Analytics",        icon: "📊" },
      { href: "/dashboard/ab-testing",        label: "A/B Testing",      icon: "⚖" },
    ],
  },
  // ── Billing & Settings — obvious, accessible ──
  {
    group: "Billing & Settings",
    items: [
      { href: "/dashboard/budget",    label: "Budget & Credits",  icon: "💳" },
      { href: "/dashboard/models",    label: "AI Models",         icon: "◆" },
      { href: "/dashboard/settings",  label: "Settings",          icon: "⚙" },
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
    <aside className="flex flex-col h-full" style={{ background: "var(--surface2)", borderRight: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
      {/* Logo — clicks to intro page */}
      <Link href="/" style={{ display: "block", padding: "16px 14px 12px", borderBottom: "1px solid var(--border)", textDecoration: "none", cursor: "pointer" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center font-bold text-white shrink-0"
            style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--accent-warm))", fontSize: 15, boxShadow: "0 2px 12px rgba(123,97,255,0.3)" }}
          >
            G
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", lineHeight: 1.2 }}>GioHomeStudio</p>
            <p style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>Content Studio</p>
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: "10px 8px 4px" }}>
        {NAV.map((group, gi) => {
          const GROUP_ACCENTS: Record<string, string> = {
            "Studio": "#7c5cfc",
            "Editing Tools": "#3b82f6",
            "Content": "#f59e0b",
            "Publish & Grow": "#10b981",
            "Billing & Settings": "#6b7280",
          };
          const accent = GROUP_ACCENTS[group.group] ?? "#7c5cfc";

          return (
            <div key={group.group} style={{ marginBottom: 18 }}>
              {/* Section divider line (skip first) */}
              {gi > 0 && (
                <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--border), transparent)", margin: "6px 10px 14px" }} />
              )}
              {/* Section header — bold, visible, with accent bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 8 }}>
                <span style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
                <p style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  color: accent,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  {group.group}
                </p>
              </div>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="sidebar-link"
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 8, marginBottom: 1,
                      fontSize: "12.5px", fontWeight: active ? 600 : 450,
                      color: active ? "#e0dcff" : "#8888a8",
                      background: active ? `${accent}20` : "transparent",
                      borderLeft: active ? `2px solid ${accent}` : "2px solid transparent",
                      position: "relative",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = `${accent}10`;
                        (e.currentTarget as HTMLElement).style.color = "#c0c0e0";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "#8888a8";
                      }
                    }}
                  >
                    <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && reviewCount ? (
                      <span style={{ fontSize: 9, fontWeight: 700, background: "#ef4444", color: "white", padding: "1px 6px", borderRadius: 100, animation: "pulse 2s infinite" }}>
                        {reviewCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "10px 8px", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
        {/* Credit balance — prominent */}
        <Link href="/dashboard/budget" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px", marginBottom: 6, background: "linear-gradient(135deg, rgba(0,229,195,0.08), rgba(124,92,252,0.08))", borderRadius: 10, border: "1px solid rgba(0,229,195,0.15)", textDecoration: "none" }}>
          <span style={{ fontSize: 16 }}>💳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>$0.00</div>
            <div style={{ fontSize: 9, color: "var(--text3)" }}>Credit Balance</div>
          </div>
          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 100, background: "rgba(0,229,195,0.15)", color: "var(--accent3, #00e5c3)", fontWeight: 700 }}>
            Top Up
          </span>
        </Link>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>H</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Henry</div>
            <div style={{ fontSize: 9, color: "var(--accent3, #00e5c3)" }}>Creator</div>
          </div>
          <Link href="/dashboard/settings" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none" }} title="Settings">⚙</Link>
        </div>

        <LLMStatus />
      </div>
    </aside>
  );
}
