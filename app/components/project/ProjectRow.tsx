"use client";

import Link from "next/link";
import { ds } from "../../../lib/designSystem";

// ProjectRow — 52×52 gradient thumb + title/tag/date stacked + "Review" link on right.
// Hover nudges row 4px right. Animated left gradient bar on hover.

const THUMB_GRADS: Record<1 | 2 | 3 | 4, string> = {
  1: "linear-gradient(135deg,#a78bfa,#d17bff)",
  2: "linear-gradient(135deg,#7ae0c3,#7cc4ff)",
  3: "linear-gradient(135deg,#ff9a3c,#ffb347)",
  4: "linear-gradient(135deg,#d17bff,#ff7ab8)",
};

type Props = {
  title: string;
  tag: string;
  date: string;
  thumbVariant: 1 | 2 | 3 | 4;
  onReview?: () => void;
  href?: string;
};

export function ProjectRow({ title, tag, date, thumbVariant, onReview, href }: Props) {
  const thumbGrad = THUMB_GRADS[thumbVariant];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        borderRadius: 10,
        position: "relative",
        transition: "transform .18s var(--e-soft), background .15s",
        cursor: "pointer",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.transform = "translateX(4px)";
        el.style.background = "rgba(255,255,255,.025)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        el.style.background = "";
      }}
    >
      {/* Left gradient reveal bar on hover — pure CSS via sibling trick omitted; use opacity transition */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 2,
          background: "linear-gradient(180deg,var(--btn-a),var(--btn-c))",
          borderRadius: "0 2px 2px 0",
          opacity: 0,
          transition: "opacity .18s",
        }}
        className="proj-bar"
      />

      {/* Thumb */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          background: thumbGrad,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Scanline */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(0,0,0,0.14) 0px,rgba(0,0,0,0.14) 1px,transparent 1px,transparent 4px)",
          }}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: ds.color.ink,
            fontFamily: ds.font.sans,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontFamily: ds.font.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: ds.color.lilac,
              background: "rgba(167,139,250,.1)",
              border: "1px solid rgba(167,139,250,.2)",
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            {tag}
          </span>
          <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.sans }}>
            {date}
          </span>
        </div>
      </div>

      {/* Review link / button */}
      {href ? (
        <Link
          href={href}
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            color: ds.color.lilac,
            fontFamily: ds.font.sans,
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(167,139,250,.25)",
            background: "rgba(167,139,250,.08)",
            transition: "background .15s, border-color .15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(167,139,250,.18)";
            e.currentTarget.style.borderColor = "rgba(167,139,250,.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(167,139,250,.08)";
            e.currentTarget.style.borderColor = "rgba(167,139,250,.25)";
          }}
        >
          Review
        </Link>
      ) : onReview ? (
        <button
          onClick={(e) => { e.stopPropagation(); onReview(); }}
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            color: ds.color.lilac,
            fontFamily: ds.font.sans,
            background: "rgba(167,139,250,.08)",
            border: "1px solid rgba(167,139,250,.25)",
            borderRadius: 999,
            padding: "4px 10px",
            cursor: "pointer",
            transition: "background .15s, border-color .15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(167,139,250,.18)";
            e.currentTarget.style.borderColor = "rgba(167,139,250,.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(167,139,250,.08)";
            e.currentTarget.style.borderColor = "rgba(167,139,250,.25)";
          }}
        >
          Review
        </button>
      ) : null}
    </div>
  );
}

export default ProjectRow;
