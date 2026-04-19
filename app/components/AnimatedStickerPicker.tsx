"use client";

import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StickerOverlay {
  id: string;
  type:
    | "circle"
    | "underline"
    | "arrow_right"
    | "star"
    | "checkmark"
    | "bracket"
    | "burst"
    | "spotlight";
  color: string;   // hex
  x: number;       // % from left
  y: number;       // % from top
  width: number;   // % of container width
  height: number;  // % of container height
  startTime: number;
  duration: number;
  strokeWidth: number;
}

interface Props {
  stickers: StickerOverlay[];
  onChange: (stickers: StickerOverlay[]) => void;
  accentColor?: string;
  currentTime?: number;
  compact?: boolean;
}

// ─── SVG path data (exported so consumers can reuse without duplication) ────────

export const STICKER_DEFS: Record<
  StickerOverlay["type"],
  { viewBox: string; path: string; label: string; emoji: string }
> = {
  circle: {
    viewBox: "0 0 200 100",
    path: "M 100 8 C 155 5, 192 30, 192 50 C 192 70, 158 92, 100 92 C 42 92, 8 70, 8 50 C 8 30, 45 11, 100 8 Z",
    label: "Circle",
    emoji: "⭕",
  },
  underline: {
    viewBox: "0 0 200 30",
    path: "M 5 18 Q 40 8, 80 18 Q 120 28, 160 16 Q 185 10, 195 18",
    label: "Underline",
    emoji: "〰",
  },
  arrow_right: {
    viewBox: "0 0 185 50",
    path: "M 10 25 L 170 25 M 140 8 L 175 25 L 140 42",
    label: "Arrow",
    emoji: "→",
  },
  star: {
    viewBox: "0 0 100 90",
    path: "M 50 5 L 61 35 L 95 35 L 67 55 L 79 85 L 50 65 L 21 85 L 33 55 L 5 35 L 39 35 Z",
    label: "Star",
    emoji: "⭐",
  },
  checkmark: {
    viewBox: "0 0 100 85",
    path: "M 5 45 L 35 75 L 95 10",
    label: "Check",
    emoji: "✓",
  },
  bracket: {
    viewBox: "0 0 100 100",
    path: "M 30 10 L 10 10 L 10 90 L 30 90 M 70 10 L 90 10 L 90 90 L 70 90",
    label: "Bracket",
    emoji: "[]",
  },
  burst: {
    viewBox: "0 0 100 100",
    path: "M 50 5 L 56 35 L 75 15 L 65 43 L 95 35 L 72 55 L 95 68 L 65 62 L 73 90 L 52 70 L 50 95 L 48 70 L 27 90 L 35 62 L 5 68 L 28 55 L 5 35 L 35 43 L 25 15 L 44 35 Z",
    label: "Burst",
    emoji: "💥",
  },
  spotlight: {
    viewBox: "0 0 100 100",
    path: "M 50 10 C 72 10, 90 28, 90 50 C 90 72, 72 90, 50 90 C 28 90, 10 72, 10 50 C 10 28, 28 10, 50 10 Z",
    label: "Spotlight",
    emoji: "🔦",
  },
};

const COLORS = [
  { label: "Red", value: "#ef4444" },
  { label: "Gold", value: "#f59e0b" },
  { label: "White", value: "#ffffff" },
  { label: "Cyan", value: "#00d4ff" },
  { label: "Green", value: "#22c55e" },
  { label: "Orange", value: "#f97316" },
  { label: "Purple", value: "#a855f7" },
];

// ─── CSS for draw animation — injected once per page load ───────────────────

const STICKER_KEYFRAME = `@keyframes sticker-draw {
  from { stroke-dashoffset: var(--path-length, 800); }
  to   { stroke-dashoffset: 0; }
}`;

let keyframeInjected = false;
function ensureKeyframe() {
  if (keyframeInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = STICKER_KEYFRAME;
  document.head.appendChild(el);
  keyframeInjected = true;
}

// ─── Per-sticker SVG preview ──────────────────────────────────────────────────

function StickerSVG({
  type,
  color,
  strokeWidth,
  animate,
}: {
  type: StickerOverlay["type"];
  color: string;
  strokeWidth: number;
  animate?: boolean;
}) {
  const def = STICKER_DEFS[type];
  const isSpotlight = type === "spotlight";
  const pathLength = 800;

  return (
    <svg
      viewBox={def.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}
    >
      <path
        d={def.path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={type === "star" || type === "burst" ? `${color}22` : "none"}
        style={
          animate
            ? (ensureKeyframe(), {
                "--path-length": pathLength,
                strokeDasharray: isSpotlight ? "8 6" : `${pathLength}`,
                strokeDashoffset: 0,
                animation: "sticker-draw 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
              } as React.CSSProperties)
            : { strokeDasharray: isSpotlight ? "8 6" : undefined }
        }
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnimatedStickerPicker({
  stickers,
  onChange,
  accentColor = "#ef4444",
  currentTime = 0,
  compact = false,
}: Props) {
  ensureKeyframe();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = stickers.find((s) => s.id === selectedId) ?? null;

  function addSticker(type: StickerOverlay["type"]) {
    const sticker: StickerOverlay = {
      id: `stk_${Date.now()}`,
      type,
      color: accentColor,
      x: 30,
      y: 30,
      width: 30,
      height: 15,
      startTime: currentTime,
      duration: 3,
      strokeWidth: 4,
    };
    const next = [...stickers, sticker];
    onChange(next);
    setSelectedId(sticker.id);
  }

  function updateSelected(patch: Partial<StickerOverlay>) {
    if (!selectedId) return;
    onChange(
      stickers.map((s) => (s.id === selectedId ? { ...s, ...patch } : s))
    );
  }

  function deleteSticker(id: string) {
    onChange(stickers.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // Shared style shortcuts
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: "#4e6080",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#080b10",
    border: "1px solid #1e2a35",
    borderRadius: 5,
    padding: "3px 6px",
    color: "#dde4f0",
    fontSize: 11,
    outline: "none",
  };
  const rangeStyle: React.CSSProperties = {
    width: "100%",
    accentColor,
  };

  return (
    <div
      style={{
        background: "#0b0e18",
        borderRadius: 10,
        padding: compact ? 8 : 12,
        border: "1px solid #1e2a35",
      }}
    >
      {/* ── Sticker type grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 5,
          marginBottom: 10,
        }}
      >
        {(Object.keys(STICKER_DEFS) as StickerOverlay["type"][]).map((type) => {
          const def = STICKER_DEFS[type];
          return (
            <button
              key={type}
              title={def.label}
              onClick={() => addSticker(type)}
              style={{
                padding: "6px 4px",
                borderRadius: 7,
                border: `1px solid ${accentColor}30`,
                background: `${accentColor}0a`,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <div style={{ width: 32, height: 20 }}>
                <StickerSVG type={type} color={accentColor} strokeWidth={4} animate />
              </div>
              <span
                style={{
                  fontSize: 8,
                  color: "#4e6080",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {def.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Placed stickers list ── */}
      {stickers.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Placed stickers ({stickers.length})</span>
          {stickers.map((s) => {
            const isActive =
              currentTime >= s.startTime &&
              currentTime <= s.startTime + s.duration;
            return (
              <div
                key={s.id}
                onClick={() =>
                  setSelectedId(s.id === selectedId ? null : s.id)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 6px",
                  borderRadius: 6,
                  marginBottom: 4,
                  cursor: "pointer",
                  background:
                    s.id === selectedId
                      ? `${accentColor}15`
                      : "transparent",
                  border: `1px solid ${
                    s.id === selectedId ? `${accentColor}50` : "#1e2a35"
                  }`,
                }}
              >
                <div style={{ width: 20, height: 14, flexShrink: 0 }}>
                  <StickerSVG
                    type={s.type}
                    color={isActive ? s.color : "#4e6080"}
                    strokeWidth={s.strokeWidth}
                    animate={isActive}
                  />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: isActive ? s.color : "#4e6080",
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {STICKER_DEFS[s.type].label}
                </span>
                <span style={{ fontSize: 9, color: "#3d5060" }}>
                  {s.startTime.toFixed(1)}s
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSticker(s.id);
                  }}
                  style={{
                    fontSize: 10,
                    color: "#ef4444",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 2px",
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Selected sticker controls ── */}
      {selected && (
        <div
          style={{
            background: "#10141f",
            borderRadius: 8,
            padding: 8,
            border: "1px solid #1e2a35",
          }}
        >
          <span
            style={{
              ...labelStyle,
              color: accentColor,
              fontWeight: 700,
            }}
          >
            Edit: {STICKER_DEFS[selected.type].label}
          </span>

          {/* Color picker row */}
          <div style={{ marginBottom: 8 }}>
            <span style={labelStyle}>Color</span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => updateSelected({ color: c.value })}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: c.value,
                    border: `2px solid ${
                      selected.color === c.value ? "#fff" : "transparent"
                    }`,
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              ))}
              <input
                type="color"
                value={selected.color}
                onChange={(e) => updateSelected({ color: e.target.value })}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  background: "transparent",
                }}
                title="Custom color"
              />
            </div>
          </div>

          {/* Position */}
          <div style={{ marginBottom: 6 }}>
            <span style={labelStyle}>Position X: {selected.x}%</span>
            <input
              type="range"
              min="0"
              max="90"
              value={selected.x}
              onChange={(e) =>
                updateSelected({ x: parseInt(e.target.value) })
              }
              style={rangeStyle}
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={labelStyle}>Position Y: {selected.y}%</span>
            <input
              type="range"
              min="0"
              max="90"
              value={selected.y}
              onChange={(e) =>
                updateSelected({ y: parseInt(e.target.value) })
              }
              style={rangeStyle}
            />
          </div>

          {/* Size */}
          <div style={{ marginBottom: 6 }}>
            <span style={labelStyle}>Width: {selected.width}%</span>
            <input
              type="range"
              min="5"
              max="80"
              value={selected.width}
              onChange={(e) =>
                updateSelected({ width: parseInt(e.target.value) })
              }
              style={rangeStyle}
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={labelStyle}>Height: {selected.height}%</span>
            <input
              type="range"
              min="5"
              max="60"
              value={selected.height}
              onChange={(e) =>
                updateSelected({ height: parseInt(e.target.value) })
              }
              style={rangeStyle}
            />
          </div>

          {/* Stroke width */}
          <div style={{ marginBottom: 6 }}>
            <span style={labelStyle}>Stroke: {selected.strokeWidth}px</span>
            <input
              type="range"
              min="1"
              max="12"
              value={selected.strokeWidth}
              onChange={(e) =>
                updateSelected({ strokeWidth: parseInt(e.target.value) })
              }
              style={rangeStyle}
            />
          </div>

          {/* Timing */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Start (s)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={selected.startTime}
                onChange={(e) =>
                  updateSelected({ startTime: parseFloat(e.target.value) || 0 })
                }
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Duration (s)</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={selected.duration}
                onChange={(e) =>
                  updateSelected({
                    duration: parseFloat(e.target.value) || 1,
                  })
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Live preview */}
          <div
            style={{
              marginTop: 10,
              background: "#080b10",
              borderRadius: 6,
              padding: 6,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 50,
            }}
          >
            <div style={{ width: 80, height: 40 }}>
              <StickerSVG
                type={selected.type}
                color={selected.color}
                strokeWidth={selected.strokeWidth}
                animate
              />
            </div>
          </div>
        </div>
      )}

      {stickers.length === 0 && (
        <p style={{ fontSize: 9, color: "#3d5060", textAlign: "center", margin: "4px 0" }}>
          Click a sticker type above to add it to the video
        </p>
      )}
    </div>
  );
}
