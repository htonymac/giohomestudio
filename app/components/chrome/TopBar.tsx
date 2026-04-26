"use client";

import { HTMLAttributes } from "react";
import SearchBar from "../SearchBar";
import { PillLive } from "../ui/PillLive";
import { Bell, Settings } from "../icons";

// v14 TopBar — extracted from layout.tsx inline top bar.
// Solid #0e0e10 bg, hairline bottom border, SearchBar left, status pills right.
// No blur, no glass, no gradient bg.

type TopBarProps = HTMLAttributes<HTMLElement>;

export function TopBar({ style, className, ...rest }: TopBarProps) {
  return (
    <header
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 28px",
        borderBottom: "1px solid rgba(255,255,255,.06)",
        background: "#0e0e10",
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    >
      {/* Left — search */}
      <div style={{ flex: 1, maxWidth: 420 }}>
        <SearchBar />
      </div>

      {/* Right — status + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <PillLive label="Online" />

        <button
          aria-label="Notifications"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#7b7b80",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 8,
            transition: "color .15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#fff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#7b7b80")}
        >
          <Bell size={16} />
        </button>

        <button
          aria-label="Settings"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#7b7b80",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 8,
            transition: "color .15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#fff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#7b7b80")}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
