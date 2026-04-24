"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonPrimary } from "./ui/ButtonPrimary";
import {
  Home, Film, Star, Monitor, Cpu, Music, Bolt, Users,
  Folder, Grid, Clock, User, Plus, Settings, Mic,
  Image, Wand, Check, ChevronRight, Bell, Wallet, Play,
} from "./icons";

// v14 Sidebar — dark, solid, no blur, brand dot + wordmark, tint-cycling nav.

// ── Nav definition — same routes/labels as v13, emoji replaced with SVG icons ──
const NAV_ITEMS = [
  // Create group
  { href: "/dashboard",                 label: "Dashboard",           icon: Home,    tint: "c2" },
  { href: "/dashboard/free-mode",       label: "Free Mode",           icon: Bolt,    tint: "c3" },
  { href: "/dashboard/movie-creator",   label: "Movie & Series",      icon: Film,    tint: "c4" },
  { href: "/dashboard/scene-forge",     label: "Scene Forge",         icon: Mic,     tint: "c5" },
  { href: "/dashboard/auto-creator",    label: "AI Content Creator",  icon: Wand,    tint: "c6" },
  { href: "/dashboard/music-video",     label: "Music & Music Video", icon: Music,   tint: "c7" },
  { href: "/dashboard/short-video",     label: "Short Video",         icon: Play,    tint: "c8" },
  { href: "/dashboard/viral-video",     label: "Viral Video",         icon: Star,    tint: "c9" },
  { href: "/dashboard/ai-motion-video", label: "AI Motion Video",     icon: Film,    tint: "c10" },
  { href: "/dashboard/commercial",      label: "Commercial",          icon: Monitor, tint: "c11" },
  { href: "/dashboard/children-video",  label: "Children Video",      icon: Users,   tint: "c2" },
  // Planners group
  { href: "/dashboard/hybrid-planner",      label: "Hybrid Planner",     icon: Grid,   tint: "c3" },
  { href: "/dashboard/movie-planner",       label: "Movie Planner",      icon: Film,   tint: "c4" },
  { href: "/dashboard/series-wizard",       label: "Series Planner",     icon: Monitor,tint: "c5" },
  { href: "/dashboard/music-video-planner", label: "Music Video Planner",icon: Music,  tint: "c6" },
  { href: "/dashboard/children-planner",    label: "Child Video Planner",icon: Image,  tint: "c7" },
  { href: "/dashboard/commercial-planner",  label: "Commercial Planner", icon: Cpu,    tint: "c8" },
  { href: "/dashboard/story-bank",          label: "Story Bank",         icon: Folder, tint: "c9" },
  // Tools group
  { href: "/dashboard/collaborative-editor",label: "Collaborative Editor",icon: Film,  tint: "c10" },
  { href: "/dashboard/video-finishing",     label: "Video Finishing",    icon: Check,  tint: "c11" },
  { href: "/dashboard/video-editor",        label: "Video Editor",       icon: Film,   tint: "c2" },
  { href: "/dashboard/ad-editor",           label: "Ad / Image Editor",  icon: Image,  tint: "c3" },
  { href: "/dashboard/video-tools",         label: "Video Tools",        icon: Wand,   tint: "c4" },
  { href: "/dashboard/video-trimmer",       label: "Video Trimmer",      icon: ChevronRight, tint: "c5" },
  { href: "/dashboard/music-studio",        label: "Music & DJ",         icon: Music,  tint: "c6" },
  { href: "/dashboard/sfx-library",         label: "SFX Library",        icon: Mic,    tint: "c7" },
  // Content group
  { href: "/dashboard/review",           label: "Review Queue",   icon: Bell,   tint: "c8", badge: true },
  { href: "/dashboard/registry",         label: "All Content",    icon: Grid,   tint: "c9" },
  { href: "/dashboard/assets",           label: "Asset Library",  icon: Folder, tint: "c10" },
  { href: "/dashboard/character-voices", label: "Characters",     icon: User,   tint: "c11" },
  { href: "/dashboard/templates",        label: "Templates",      icon: Star,   tint: "c2" },
  // Publish group
  { href: "/dashboard/publishing",        label: "Publishing",    icon: Play,   tint: "c3" },
  { href: "/dashboard/destination-pages", label: "Channel Pages", icon: Monitor,tint: "c4" },
  { href: "/dashboard/calendar",          label: "Calendar",      icon: Clock,  tint: "c5" },
  { href: "/dashboard/analytics",         label: "Analytics",     icon: Cpu,    tint: "c6" },
  { href: "/dashboard/ab-testing",        label: "A/B Testing",   icon: Wand,   tint: "c7" },
  // Settings group
  { href: "/dashboard/account",  label: "Account & Balance", icon: User,     tint: "c8" },
  { href: "/dashboard/budget",   label: "Budget & Credits",  icon: Wallet,   tint: "c9" },
  { href: "/dashboard/models",   label: "AI Models",         icon: Cpu,      tint: "c10" },
  { href: "/dashboard/settings", label: "Settings",          icon: Settings, tint: "c11" },
];

// Grouped for the accordion nav
const NAV_GROUPS = [
  { group: "Create",   items: NAV_ITEMS.slice(0, 11) },
  { group: "Planners", items: NAV_ITEMS.slice(11, 18) },
  { group: "Tools",    items: NAV_ITEMS.slice(18, 26) },
  { group: "Content",  items: NAV_ITEMS.slice(26, 31) },
  { group: "Publish",  items: NAV_ITEMS.slice(31, 36) },
  { group: "Settings", items: NAV_ITEMS.slice(36) },
];

// Tile tint gradients
const TINTS: Record<string, string> = {
  c2:  "linear-gradient(135deg,#7cc4ff,#a78bfa)",
  c3:  "linear-gradient(135deg,#d17bff,#ff7ab8)",
  c4:  "linear-gradient(135deg,#7ae0c3,#7cc4ff)",
  c5:  "linear-gradient(135deg,#ffb347,#ff7a45)",
  c6:  "linear-gradient(135deg,#c9a9ff,#ff7ab8)",
  c7:  "linear-gradient(135deg,#ff9a3c,#d17bff)",
  c8:  "linear-gradient(135deg,#7ae0c3,#a78bfa)",
  c9:  "linear-gradient(135deg,#7cc4ff,#c9a9ff)",
  c10: "linear-gradient(135deg,#ffb347,#ff7ab8)",
  c11: "linear-gradient(135deg,#a78bfa,#ff9a3c)",
  active: "linear-gradient(135deg,#a78bfa,#ff9a3c)",
};

function LLMStatus() {
  const [label, setLabel] = useState("Checking…");
  const [dot, setDot] = useState("#7b7b80");
  useEffect(() => {
    fetch("/api/llm/status")
      .then((r) => r.json())
      .then((d) => {
        if ((d.activeCount ?? 0) > 0) {
          setDot("#7ae0c3");
          setLabel(d.willUse || "LLM ready");
        } else {
          setDot("#ff7a45");
          setLabel("LLM offline");
        }
      })
      .catch(() => { setDot("#ff7a45"); setLabel("LLM offline"); });
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: "#55555a", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
    </div>
  );
}

export default function Sidebar({ reviewCount }: { reviewCount?: number }) {
  const pathname = usePathname();

  function activeGroupName() {
    for (const g of NAV_GROUPS) {
      for (const item of g.items) {
        if (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) {
          return g.group;
        }
      }
    }
    return "Create";
  }

  const [openGroup, setOpenGroup] = useState<string>(() => activeGroupName());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ghs_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setOpenGroup(activeGroupName());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ghs_sidebar_collapsed", String(next));
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }));
      return next;
    });
  };

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0b0b0d",
        borderRight: "1px solid rgba(255,255,255,.06)",
        width: collapsed ? 52 : 218,
        transition: "width 0.2s cubic-bezier(.22,.61,.36,1)",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Brand header */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "14px 6px 12px" : "14px 14px 12px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          textDecoration: "none",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {/* Brand dot — conic gradient, 9s spin */}
        <div
          className="is-spin-slow"
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: "conic-gradient(from 0deg,#a78bfa,#7cc4ff,#d17bff,#5b4fe0,#a78bfa)",
            boxShadow: "0 0 0 2px rgba(167,139,250,.18), 0 8px 20px -6px rgba(91,79,224,.5)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontWeight: 900, fontSize: 13, color: "#fff", fontFamily: "'Geist', sans-serif", lineHeight: 1 }}>G</span>
        </div>
        {!collapsed && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1.2, fontFamily: "'Geist', sans-serif" }}>
              GioHomeStudio
            </p>
            <p style={{ fontSize: 10, color: "#55555a", fontWeight: 500, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              Studio
            </p>
          </div>
        )}
      </Link>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        title={collapsed ? "Expand" : "Collapse"}
        style={{
          position: "absolute",
          top: 18,
          right: collapsed ? 4 : -1,
          zIndex: 10,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,.08)",
          background: "#151518",
          color: "#55555a",
          fontSize: 9,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color .15s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#fff")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#55555a")}
      >
        {collapsed ? "›" : "‹"}
      </button>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 6px 4px" }}>
        {NAV_GROUPS.map((group) => {
          const isOpen = !collapsed && openGroup === group.group;
          const hasActive = group.items.some(
            (item) =>
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))
          );

          return (
            <div key={group.group} style={{ marginBottom: 2 }}>
              {/* Group header button */}
              <button
                onClick={() => {
                  if (!collapsed) {
                    setOpenGroup((prev) => (prev === group.group ? "" : group.group));
                  }
                }}
                title={collapsed ? group.group : undefined}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 8,
                  padding: collapsed ? "9px 0" : "7px 8px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: hasActive
                    ? "rgba(167,139,250,.1)"
                    : isOpen
                    ? "rgba(167,139,250,.05)"
                    : "transparent",
                  justifyContent: collapsed ? "center" : "flex-start",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = hasActive
                    ? "rgba(167,139,250,.1)"
                    : isOpen
                    ? "rgba(167,139,250,.05)"
                    : "transparent";
                }}
              >
                {!collapsed && (
                  <>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 9,
                        fontWeight: 700,
                        color: hasActive ? "#a78bfa" : "#55555a",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontFamily: "'JetBrains Mono', monospace",
                        textAlign: "left",
                      }}
                    >
                      {group.group}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#55555a",
                        display: "inline-block",
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform .15s",
                      }}
                    >
                      ›
                    </span>
                  </>
                )}
              </button>

              {/* Nav items — when group open */}
              {isOpen && (
                <div style={{ paddingLeft: 6, paddingBottom: 4 }}>
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    const IconComp = item.icon;
                    const tileBg = active ? TINTS.active : TINTS[item.tint] || TINTS.c2;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => {
                          if (active) { e.preventDefault(); window.location.href = item.href; }
                        }}
                        className="nav-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 8px 6px 6px",
                          borderRadius: 9,
                          marginBottom: 1,
                          color: active ? "#fff" : "#7b7b80",
                          fontWeight: active ? 700 : 500,
                          textDecoration: "none",
                          fontSize: 12,
                          position: "relative",
                          transition: "transform .2s cubic-bezier(.22,.61,.36,1), background .2s, color .15s",
                          background: active ? "rgba(167,139,250,.1)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            const el = e.currentTarget as HTMLAnchorElement;
                            el.style.background = "rgba(167,139,250,.08)";
                            el.style.color = "#fff";
                            el.style.transform = "translateX(4px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            const el = e.currentTarget as HTMLAnchorElement;
                            el.style.background = "transparent";
                            el.style.color = "#7b7b80";
                            el.style.transform = "";
                          }
                        }}
                      >
                        {/* Active left bar */}
                        {active && (
                          <span
                            style={{
                              position: "absolute",
                              left: -10,
                              top: 7,
                              bottom: 7,
                              width: 3,
                              background: "linear-gradient(180deg,#a78bfa,#ff9a3c)",
                              borderRadius: "0 3px 3px 0",
                            }}
                          />
                        )}

                        {/* Icon tile */}
                        <span
                          className="ic"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            display: "grid",
                            placeItems: "center",
                            color: "#fff",
                            background: tileBg,
                            boxShadow: "0 3px 8px -2px rgba(167,139,250,.5)",
                            flexShrink: 0,
                            transition: "transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .2s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLSpanElement).style.transform = "rotate(-8deg) scale(1.12)";
                            (e.currentTarget as HTMLSpanElement).style.boxShadow = "0 6px 14px -2px rgba(167,139,250,.6)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLSpanElement).style.transform = "";
                            (e.currentTarget as HTMLSpanElement).style.boxShadow = "0 3px 8px -2px rgba(167,139,250,.5)";
                          }}
                          onMouseDown={(e) => {
                            (e.currentTarget as HTMLSpanElement).style.transform = "rotate(0deg) scale(.92)";
                          }}
                          onMouseUp={(e) => {
                            (e.currentTarget as HTMLSpanElement).style.transform = "rotate(-8deg) scale(1.12)";
                          }}
                        >
                          <IconComp size={13} />
                        </span>

                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.label}
                        </span>

                        {/* Review badge */}
                        {"badge" in item && item.badge && reviewCount ? (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              background: "#ff7a45",
                              color: "#fff",
                              padding: "1px 5px",
                              borderRadius: 999,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {reviewCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Collapsed: show active item tile only */}
              {collapsed && hasActive && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingBottom: 4 }}>
                  {group.items
                    .filter(
                      (item) =>
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href))
                    )
                    .map((item) => {
                      const IconComp = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.label}
                          style={{
                            width: 34,
                            height: 30,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 8,
                            background: TINTS.active,
                            textDecoration: "none",
                            color: "#fff",
                          }}
                        >
                          <IconComp size={13} />
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom — wallet card */}
      <div
        style={{
          padding: collapsed ? "10px 4px" : "10px 10px",
          borderTop: "1px solid rgba(255,255,255,.06)",
        }}
      >
        {!collapsed ? (
          <div
            style={{
              background: "linear-gradient(135deg,rgba(167,139,250,.18),rgba(255,154,60,.12))",
              border: "1px solid rgba(167,139,250,.35)",
              borderRadius: 16,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", fontFamily: "'Geist', sans-serif", letterSpacing: "-0.03em" }}>$0.00</div>
                <div style={{ fontSize: 9, color: "#7b7b80", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>Credit Balance</div>
              </div>
              <Wallet size={16} style={{ color: "#a78bfa" }} />
            </div>
            <ButtonPrimary size="sm" style={{ width: "100%", justifyContent: "center" }}>
              Top Up
            </ButtonPrimary>
          </div>
        ) : (
          <Link
            href="/dashboard/budget"
            title="Credits"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "8px 0",
              marginBottom: 4,
              textDecoration: "none",
              color: "#7b7b80",
            }}
          >
            <Wallet size={16} />
          </Link>
        )}

        {/* User row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : 8,
            padding: "6px 4px",
            borderRadius: 8,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#a78bfa,#ff9a3c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            H
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Henry</div>
                <div style={{ fontSize: 9, color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em" }}>Creator</div>
              </div>
              <Link href="/dashboard/settings" style={{ color: "#55555a", textDecoration: "none", display: "flex" }} title="Settings">
                <Settings size={14} />
              </Link>
            </>
          )}
        </div>

        {!collapsed && <LLMStatus />}
      </div>
    </aside>
  );
}
