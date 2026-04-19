"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// ── Navigation structure ──────────────────────────────────────────────────────
const NAV = [
  {
    group: "Create",
    icon: "✦",
    color: "#7c5cfc",
    items: [
      { href: "/dashboard",                 label: "Dashboard",           icon: "✦" },
      { href: "/dashboard/free-mode",       label: "Free Mode",           icon: "⚡" },
      { href: "/dashboard/movie-creator",   label: "Movie & Series",      icon: "🎬" },
      { href: "/dashboard/scene-forge",      label: "Scene Forge",         icon: "🎭" },
      { href: "/dashboard/auto-creator",    label: "AI Content Creator",  icon: "🤖" },
      { href: "/dashboard/music-video",     label: "Music & Music Video", icon: "🎶" },
      { href: "/dashboard/short-video",     label: "Short Video",         icon: "⚡" },
      { href: "/dashboard/viral-video",     label: "Viral Video",         icon: "🔥" },
      { href: "/dashboard/ai-motion-video", label: "AI Motion Video",     icon: "🎭" },
      { href: "/dashboard/commercial",      label: "Commercial",          icon: "📣" },
      { href: "/dashboard/children-video",  label: "Children Video",      icon: "🧒" },
    ],
  },
  {
    group: "Planners",
    icon: "🗂",
    color: "#3b82f6",
    items: [
      { href: "/dashboard/hybrid-planner",      label: "Hybrid Planner",      icon: "🔀" },
      { href: "/dashboard/movie-planner",       label: "Movie Planner",        icon: "🎥" },
      { href: "/dashboard/series-wizard",       label: "Series Planner",       icon: "📺" },
      { href: "/dashboard/music-video-planner", label: "Music Video Planner",  icon: "🎹" },
      { href: "/dashboard/children-planner",    label: "Child Video Planner",  icon: "🎠" },
      { href: "/dashboard/commercial-planner",  label: "Commercial Planner",   icon: "📋" },
      { href: "/dashboard/story-bank",          label: "Story Bank",           icon: "📚" },
    ],
  },
  {
    group: "Tools",
    icon: "🛠",
    color: "#f59e0b",
    items: [
      { href: "/dashboard/collaborative-editor", label: "Collaborative Editor", icon: "🎬" },
      { href: "/dashboard/video-finishing",      label: "Video Finishing",      icon: "🎯" },
      { href: "/dashboard/video-editor",         label: "Video Editor",         icon: "🎞" },
      { href: "/dashboard/ad-editor",            label: "Ad / Image Editor",    icon: "🖼" },
      { href: "/dashboard/video-tools",          label: "Video Tools",          icon: "✂" },
      { href: "/dashboard/video-trimmer",        label: "Video Trimmer",        icon: "✄" },
      { href: "/dashboard/music-studio",         label: "Music & DJ",           icon: "🎵" },
      { href: "/dashboard/sfx-library",          label: "SFX Library",          icon: "💥" },
    ],
  },
  {
    group: "Content",
    icon: "📦",
    color: "#10b981",
    items: [
      { href: "/dashboard/review",           label: "Review Queue",   icon: "◈", badge: true },
      { href: "/dashboard/registry",         label: "All Content",    icon: "▤" },
      { href: "/dashboard/assets",           label: "Asset Library",  icon: "📦" },
      { href: "/dashboard/character-voices", label: "Characters",     icon: "🎭" },
      { href: "/dashboard/templates",        label: "Templates",      icon: "🚀" },
    ],
  },
  {
    group: "Publish",
    icon: "📤",
    color: "#06b6d4",
    items: [
      { href: "/dashboard/publishing",        label: "Publishing",    icon: "📤" },
      { href: "/dashboard/destination-pages", label: "Channel Pages", icon: "⊞" },
      { href: "/dashboard/calendar",          label: "Calendar",      icon: "📅" },
      { href: "/dashboard/analytics",         label: "Analytics",     icon: "📊" },
      { href: "/dashboard/ab-testing",        label: "A/B Testing",   icon: "⚖" },
    ],
  },
  {
    group: "Settings",
    icon: "⚙",
    color: "#6b7280",
    items: [
      { href: "/dashboard/account",  label: "Account & Balance", icon: "🔑" },
      { href: "/dashboard/budget",   label: "Budget & Credits",  icon: "💳" },
      { href: "/dashboard/models",   label: "AI Models",         icon: "◆" },
      { href: "/dashboard/settings", label: "Settings",          icon: "⚙" },
    ],
  },
];

function LLMStatus() {
  const [label, setLabel] = useState("Checking…");
  const [dot, setDot] = useState("#facc15");
  useEffect(() => {
    fetch("/api/llm/status")
      .then(r => r.json())
      .then(d => {
        if ((d.activeCount ?? 0) > 0) { setDot("#4ade80"); setLabel(d.willUse || "LLM ready"); }
        else { setDot("#f87171"); setLabel("LLM offline"); }
      })
      .catch(() => { setDot("#f87171"); setLabel("LLM offline"); });
  }, []);
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: dot }} />
      <span style={{ fontSize: 10, color: "#5a5a7a" }}>{label}</span>
    </div>
  );
}

export default function Sidebar({ reviewCount }: { reviewCount?: number }) {
  const pathname = usePathname();

  function activeGroup(): string {
    for (const g of NAV) {
      for (const item of g.items) {
        if (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) {
          return g.group;
        }
      }
    }
    return "Create";
  }

  const [openGroup, setOpenGroup] = useState<string>(() => activeGroup());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ghs_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setOpenGroup(activeGroup());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("ghs_sidebar_collapsed", String(next));
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }));
      return next;
    });
  };

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        background: "var(--surface2)",
        borderRight: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
        width: collapsed ? 56 : 220,
        transition: "width 0.2s ease",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: "flex", alignItems: "center",
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "16px 10px 12px" : "16px 14px 12px",
          borderBottom: "1px solid var(--border)",
          textDecoration: "none", cursor: "pointer",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <div
          className="flex items-center justify-center font-bold text-white shrink-0"
          style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 48%, #f97316 100%)", fontSize: 15, boxShadow: "0 4px 16px rgba(236,72,153,0.45)" }}
        >
          G
        </div>
        {!collapsed && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#e6eaf2", letterSpacing: "-0.3px", lineHeight: 1.2 }}>GioHomeStudio</p>
            <p style={{ fontSize: 10, color: "#7c8fa8", fontWeight: 400, letterSpacing: "0.1px" }}>Content Studio</p>
          </div>
        )}
      </Link>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        style={{ position: "absolute", top: 20, right: collapsed ? 8 : -1, zIndex: 10, width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? "→" : "←"}
      </button>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: "8px 6px 4px" }}>
        {NAV.map(group => {
          const isOpen = !collapsed && openGroup === group.group;
          const hasActive = group.items.some(
            item => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          );

          return (
            <div key={group.group} style={{ marginBottom: 3 }}>
              {/* Group header */}
              <button
                onClick={() => { if (!collapsed) setOpenGroup(prev => prev === group.group ? "" : group.group); }}
                title={group.group}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: collapsed ? 0 : 9,
                  padding: collapsed ? "10px 0" : "9px 10px",
                  borderRadius: 10, border: "none", cursor: "pointer",
                  background: hasActive
                    ? `linear-gradient(135deg, ${group.color}22, ${group.color}10)`
                    : isOpen ? `${group.color}0d` : "transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                  transition: "all 0.15s",
                  boxShadow: hasActive ? `inset 0 0 0 1px ${group.color}30` : "none",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${group.color}18, ${group.color}08)`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = hasActive ? `linear-gradient(135deg, ${group.color}22, ${group.color}10)` : isOpen ? `${group.color}0d` : "transparent"; }}
              >
                <span style={{
                  fontSize: collapsed ? 18 : 16,
                  width: collapsed ? 24 : 22, height: collapsed ? 24 : 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, borderRadius: 6,
                  background: hasActive ? `${group.color}25` : "transparent",
                  filter: hasActive ? `drop-shadow(0 0 6px ${group.color}80)` : "none",
                  transition: "all 0.15s",
                }}>
                  {group.icon}
                </span>
                {!collapsed && (
                  <>
                    <span style={{
                      flex: 1, fontSize: 12, fontWeight: 800,
                      color: hasActive ? group.color : isOpen ? "#c0b8e8" : "#7a7a9a",
                      textAlign: "left", letterSpacing: "0.5px",
                      textShadow: hasActive ? `0 0 12px ${group.color}60` : "none",
                      transition: "all 0.15s",
                      textTransform: "uppercase",
                    }}>
                      {group.group}
                    </span>
                    <span style={{
                      fontSize: 10, color: hasActive ? group.color : "#505070",
                      opacity: hasActive ? 0.9 : 0.5, marginRight: 2,
                      display: "inline-block",
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s",
                    }}>
                      ›
                    </span>
                  </>
                )}
              </button>

              {/* Items — only when open */}
              {isOpen && (
                <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
                  {group.items.map(item => {
                    const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="sidebar-link"
                        onClick={e => { if (active) { e.preventDefault(); window.location.href = item.href; } }}
                        style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "6px 10px", borderRadius: 7, marginBottom: 1,
                          fontSize: 12, fontWeight: active ? 600 : 400,
                          color: active ? "#e0dcff" : "#8888a8",
                          background: active ? `${group.color}20` : "transparent",
                          borderLeft: active ? `2px solid ${group.color}` : "2px solid transparent",
                          textDecoration: "none",
                          transition: "all 0.12s ease",
                        }}
                        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = `${group.color}10`; (e.currentTarget as HTMLElement).style.color = "#c0c0e0"; } }}
                        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#8888a8"; } }}
                      >
                        <span style={{ fontSize: 13, width: 16, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {"badge" in item && item.badge && reviewCount ? (
                          <span style={{ fontSize: 9, fontWeight: 700, background: "#ef4444", color: "white", padding: "1px 5px", borderRadius: 100 }}>
                            {reviewCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Collapsed: show active item icon only */}
              {collapsed && hasActive && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingBottom: 4 }}>
                  {group.items.filter(item => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))).map(item => (
                    <Link key={item.href} href={item.href} title={item.label}
                      style={{ width: 36, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: `${group.color}25`, textDecoration: "none", fontSize: 13 }}>
                      {item.icon}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed ? "10px 4px" : "10px 8px", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
        {!collapsed ? (
          <Link href="/dashboard/budget" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px", marginBottom: 6, background: "linear-gradient(135deg, rgba(0,229,195,0.08), rgba(124,92,252,0.08))", borderRadius: 10, border: "1px solid rgba(0,229,195,0.15)", textDecoration: "none" }}>
            <span style={{ fontSize: 16 }}>💳</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>$0.00</div>
              <div style={{ fontSize: 9, color: "var(--text3)" }}>Credit Balance</div>
            </div>
            <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 100, background: "rgba(0,229,195,0.15)", color: "var(--accent3, #00e5c3)", fontWeight: 700 }}>Top Up</span>
          </Link>
        ) : (
          <Link href="/dashboard/budget" style={{ display: "flex", justifyContent: "center", padding: "8px 0", marginBottom: 4, textDecoration: "none" }} title="Credits">
            <span style={{ fontSize: 16 }}>💳</span>
          </Link>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 8, padding: "6px 10px", borderRadius: 8, justifyContent: collapsed ? "center" : "flex-start" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>H</div>
          {!collapsed && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Henry</div>
                <div style={{ fontSize: 9, color: "var(--accent3, #00e5c3)" }}>Creator</div>
              </div>
              <Link href="/dashboard/settings" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none" }} title="Settings">⚙</Link>
            </>
          )}
        </div>

        {!collapsed && <LLMStatus />}
      </div>
    </aside>
  );
}
