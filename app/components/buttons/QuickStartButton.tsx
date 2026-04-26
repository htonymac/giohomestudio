"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ds } from "../../../lib/designSystem";

// QuickStartButton — tile-style button, full-width row.
// primary: ButtonPrimary animated gradient (full width).
// v2/v3/v4: ButtonTile style with different accent tint for the icon tile.

const TILE_ACCENT: Record<"v2" | "v3" | "v4", string> = {
  v2: ds.grad.tile.c4,   // mint→sky
  v3: ds.grad.tile.c5,   // gold→coral
  v4: ds.grad.tile.c3,   // magenta→pink
};

type Props = {
  variant: "primary" | "v2" | "v3" | "v4";
  title: string;
  sub: string;
  icon: ReactNode;
  href: string;
};

export function QuickStartButton({ variant, title, sub, icon, href }: Props) {
  if (variant === "primary") {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "block", width: "100%" }}>
        <ButtonPrimary
          size="md"
          style={{
            width: "100%",
            justifyContent: "flex-start",
            gap: 12,
            padding: "12px 16px",
          }}
        >
          <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{title}</span>
            <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, lineHeight: 1.2 }}>{sub}</span>
          </span>
        </ButtonPrimary>
      </Link>
    );
  }

  const tileGrad = TILE_ACCENT[variant as "v2" | "v3" | "v4"];

  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", width: "100%" }}>
      <div
        style={{
          width: "100%",
          background: ds.color.card,
          border: `1px solid rgba(167,139,250,.18)`,
          borderRadius: 12,
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          transition: "transform .18s var(--e-soft), border-color .18s, box-shadow .2s",
          color: ds.color.ink2,
          fontFamily: ds.font.sans,
          boxSizing: "border-box",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateX(4px) translateY(-1px)";
          el.style.borderColor = "rgba(167,139,250,.45)";
          el.style.boxShadow = ds.shadow.lift;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "";
          el.style.borderColor = "rgba(167,139,250,.18)";
          el.style.boxShadow = "";
        }}
        onMouseDown={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateX(2px) translateY(1px) scale(.97)";
          el.style.transition = "transform .08s";
        }}
        onMouseUp={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transition = "transform .18s var(--e-soft), border-color .18s, box-shadow .2s";
        }}
      >
        {/* Icon tile */}
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: tileGrad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
            boxShadow: ds.shadow.tile,
          }}
        >
          {icon}
        </span>

        {/* Text */}
        <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, lineHeight: 1.2 }}>{title}</span>
          <span style={{ fontSize: 11, color: ds.color.mute, lineHeight: 1.3 }}>{sub}</span>
        </span>
      </div>
    </Link>
  );
}

export default QuickStartButton;
