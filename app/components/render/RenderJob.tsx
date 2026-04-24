"use client";

import { ds } from "../../../lib/designSystem";

// RenderJob — individual job card in the RenderDeck grid.
// Progress bar + scanline-style thumb + animated %.
// thumbVariant drives the gradient on the placeholder thumb.

const THUMB_GRADS: Record<1 | 2 | 3, string> = {
  1: "linear-gradient(135deg,#a78bfa,#d17bff)",
  2: "linear-gradient(135deg,#7ae0c3,#7cc4ff)",
  3: "linear-gradient(135deg,#ff9a3c,#ffb347)",
};

type Props = {
  id: string;
  title: string;
  engine: "Kling" | "Runway" | "Suno" | "FAL";
  format: string;
  duration: string;
  pct: number;
  eta: string;
  frame?: string;
  thumbVariant: 1 | 2 | 3;
};

export function RenderJob({ title, engine, format, duration, pct, eta, thumbVariant }: Props) {
  const thumbGrad = THUMB_GRADS[thumbVariant];
  const clampedPct = Math.min(100, Math.max(0, pct));

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${ds.color.line}`,
        borderRadius: ds.radius.sm,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Thumb placeholder (scanline style) */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: 8,
          background: thumbGrad,
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Scanline overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(0,0,0,0.18) 0px,rgba(0,0,0,0.18) 1px,transparent 1px,transparent 4px)",
            pointerEvents: "none",
          }}
        />
        {/* Pct overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontFamily: ds.font.mono,
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            textShadow: "0 1px 4px rgba(0,0,0,.7)",
            letterSpacing: "0.08em",
          }}
        >
          {clampedPct}%
        </div>
      </div>

      {/* Title + meta */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: ds.color.ink,
            fontFamily: ds.font.sans,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: ds.font.mono,
            fontSize: 10,
            color: ds.color.mute,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {engine} · {format} · {duration}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div
          style={{
            height: 3,
            borderRadius: 99,
            background: "rgba(255,255,255,.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${clampedPct}%`,
              height: "100%",
              background: "linear-gradient(90deg,var(--btn-a),var(--btn-c))",
              borderRadius: 99,
              transition: "width .4s var(--e-soft)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 5,
            fontFamily: ds.font.mono,
            fontSize: 9,
            color: ds.color.mute,
            letterSpacing: "0.1em",
          }}
        >
          <span>{clampedPct}% complete</span>
          <span>ETA {eta}</span>
        </div>
      </div>
    </div>
  );
}

export default RenderJob;
