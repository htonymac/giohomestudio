"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    group: "Create",
    items: [
      { href: "/dashboard",              label: "Studio",           icon: "✦" },
      { href: "/dashboard/commercial",   label: "Commercial Maker", icon: "▲" },
      { href: "/dashboard/video-tools",   label: "Video Tools",      icon: "✂" },
      { href: "/dashboard/video-trimmer", label: "Video Trimmer (AI)", icon: "🎬" },
    ],
  },
  {
    group: "Review",
    items: [
      { href: "/dashboard/review",   label: "Review Queue", icon: "◈", badge: true },
      { href: "/dashboard/registry", label: "Registry",     icon: "▤" },
    ],
  },
  {
    group: "Audio",
    items: [
      { href: "/dashboard/character-voices", label: "Voice Registry", icon: "◉" },
      { href: "/dashboard/sfx-library",      label: "SFX Library",   icon: "♪" },
    ],
  },
  {
    group: "Setup",
    items: [
      { href: "/dashboard/destination-pages", label: "Pages", icon: "⊞" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/dashboard/studio-updates", label: "Studio Updates", icon: "◎" },
      { href: "/dashboard/settings",       label: "LLM Settings",   icon: "⚙" },
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
    <aside className="flex flex-col h-full" style={{ background: "#12121a", borderRight: "1px solid #2a2a40" }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: "#2a2a40" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center text-sm font-bold text-white rounded-lg shrink-0"
            style={{ width: 28, height: 28, background: "linear-gradient(135deg, #7c5cfc, #fc5c7d)" }}
          >
            G
          </div>
          <div>
            <p className="font-bold text-white tracking-tight leading-none" style={{ fontSize: 13 }}>GioHomeStudio</p>
            <p style={{ fontSize: 10, color: "#5a5a7a", marginTop: 2 }}>Content Studio</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.group} className="mb-5">
            <p className="px-3 mb-1.5 font-semibold uppercase tracking-widest" style={{ fontSize: 10, color: "#5a5a7a" }}>
              {group.group}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all"
                  style={{
                    color: active ? "#7c5cfc" : "#9090b0",
                    background: active ? "rgba(124,92,252,0.12)" : "transparent",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && reviewCount ? (
                    <span
                      className="text-white font-semibold rounded-full"
                      style={{ fontSize: 10, background: "#7c5cfc", minWidth: 18, textAlign: "center", padding: "1px 6px" }}
                    >
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
      <div className="px-4 py-3 border-t" style={{ borderColor: "#2a2a40" }}>
        <LLMStatus />
      </div>
    </aside>
  );
}
