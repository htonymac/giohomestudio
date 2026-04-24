"use client";

import { ReactNode, useRef } from "react";
import Link from "next/link";
import { ds } from "../../../lib/designSystem";

// ToolTile — compact square-ish tile, icon at top, title + sub.
// Mouse-tracked radial glow via pointermove → --mx/--my CSS vars.
// Variants t1/t2/t3/t4 set icon tile accent.

const TILE_ACCENT: Record<"t1" | "t2" | "t3" | "t4", string> = {
  t1: ds.grad.tile.active,  // purple→orange (c11)
  t2: ds.grad.tile.c4,      // mint→sky
  t3: ds.grad.tile.c2,      // sky→lilac
  t4: ds.grad.tile.c3,      // magenta→pink
};

type Props = {
  variant: "t1" | "t2" | "t3" | "t4";
  title: string;
  sub: string;
  icon: ReactNode;
  href: string;
};

export function ToolTile({ variant, title, sub, icon, href }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const tileGrad = TILE_ACCENT[variant];

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  }

  function handlePointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  }

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          {
            "--mx": "50%",
            "--my": "50%",
            position: "relative",
            background: ds.color.card,
            border: `1px solid ${ds.color.line}`,
            borderRadius: ds.radius.lg,
            padding: "18px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            cursor: "pointer",
            transition: "transform .18s var(--e-soft), border-color .18s, box-shadow .2s",
            overflow: "hidden",
          } as React.CSSProperties
        }
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translateY(-2px)";
          el.style.borderColor = "rgba(167,139,250,.35)";
          el.style.boxShadow = ds.shadow.lift;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = "";
          el.style.borderColor = ds.color.line;
          el.style.boxShadow = "";
        }}
        onMouseDown={(e) => {
          const el = e.currentTarget;
          el.style.transform = "scale(.96) translateY(1px)";
          el.style.transition = "transform .08s";
        }}
        onMouseUp={(e) => {
          const el = e.currentTarget;
          el.style.transition = "transform .18s var(--e-soft), border-color .18s, box-shadow .2s";
        }}
      >
        {/* Mouse-tracked radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at var(--mx) var(--my), rgba(167,139,250,.09) 0%, transparent 60%)",
            pointerEvents: "none",
            transition: "opacity .2s",
          }}
        />

        {/* Icon tile */}
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: tileGrad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: ds.shadow.tile,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>

        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: ds.color.ink,
              fontFamily: ds.font.sans,
              lineHeight: 1.2,
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: ds.color.mute,
              fontFamily: ds.font.sans,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default ToolTile;
