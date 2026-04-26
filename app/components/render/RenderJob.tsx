"use client";

import { ds } from "../../../lib/designSystem";

// RenderJob — v15 render card.
// 96x54 thumbnail (poster frame or dark tile with first-letter initial + accent overlay),
// title + status pill + ETA. Animated progress bar at bottom of thumb when Rendering.

type Status = "Rendering" | "Queued" | "Done";

type Props = {
  id: string;
  title: string;
  engine: "Kling" | "Runway" | "Suno" | "FAL";
  format: string;
  duration: string;
  pct: number;
  eta: string;
  frame?: string; // optional poster URL
  status?: Status;
  thumbVariant?: 1 | 2 | 3;
};

const ENGINE_ACCENT: Record<Props["engine"], string> = {
  Kling:  "#a78bfa", // lilac
  Runway: "#7cc4ff", // sky
  FAL:    "#7ae0c3", // mint
  Suno:   "#ffb347", // gold
};

function deriveStatus(pct: number, override?: Status): Status {
  if (override) return override;
  if (pct >= 100) return "Done";
  if (pct <= 0)   return "Queued";
  return "Rendering";
}

function StatusPill({ status, pct, accent }: { status: Status; pct: number; accent: string }) {
  const label =
    status === "Rendering" ? `Rendering ${Math.round(pct)}%` :
    status === "Queued"    ? "Queued" :
                             "Done";
  const color =
    status === "Rendering" ? accent :
    status === "Done"      ? "#7ae0c3" :
                             ds.color.mute;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 999,
        background: "#151518",
        border: `1px solid ${color}30`,
        color,
        fontFamily: ds.font.mono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

export function RenderJob({ title, engine, format, duration, pct, eta, frame, status }: Props) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const resolvedStatus = deriveStatus(clampedPct, status);
  const accent = ENGINE_ACCENT[engine];
  const initial = (title || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${ds.color.line}`,
        borderRadius: ds.radius.sm,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* 96x54 thumbnail */}
      <div
        style={{
          width: 96,
          height: 54,
          borderRadius: 6,
          background: frame ? "#0b0b0d" : ds.color.card,
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {frame ? (
          // actual poster frame
          <img
            src={frame}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <>
            {/* faint accent gradient overlay */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${accent}22, ${accent}08 60%, transparent)`,
                pointerEvents: "none",
              }}
            />
            {/* first-letter initial */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontFamily: ds.font.sans,
                fontSize: 22,
                fontWeight: 900,
                color: accent,
                letterSpacing: "-0.03em",
                textShadow: "0 1px 4px rgba(0,0,0,.4)",
              }}
            >
              {initial}
            </span>
          </>
        )}

        {/* Progress bar along bottom — only when Rendering */}
        {resolvedStatus === "Rendering" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              background: "rgba(0,0,0,.5)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${clampedPct}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${accent}, #ff9a3c)`,
                transition: "width .4s var(--e-soft)",
              }}
            />
          </div>
        )}
      </div>

      {/* Title (13px, #fff) */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: ds.color.ink,
          fontFamily: ds.font.sans,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.25,
        }}
        title={title}
      >
        {title}
      </div>

      {/* Status pill + ETA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <StatusPill status={resolvedStatus} pct={clampedPct} accent={accent} />
        <span
          style={{
            fontFamily: ds.font.mono,
            fontSize: 9,
            color: ds.color.mute,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {resolvedStatus === "Rendering" ? `ETA ${eta}` : `${engine} · ${format} · ${duration}`}
        </span>
      </div>
    </div>
  );
}

export default RenderJob;
