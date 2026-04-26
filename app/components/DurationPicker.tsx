"use client";

import { useState, useEffect, useRef } from "react";

export interface DurationOption {
  label: string;   // display text e.g. "2–3 min (120–180s)"
  seconds: number; // representative seconds value
}

// ── Presets ──────────────────────────────────────────────────────────────────

export const DURATION_PRESETS = {
  /** Short social clips: Reels, TikTok, Shorts */
  short: [
    { label: "15 sec",  seconds: 15 },
    { label: "30 sec",  seconds: 30 },
    { label: "45 sec",  seconds: 45 },
    { label: "60 sec",  seconds: 60 },
  ] as DurationOption[],

  /** Music tracks and songs */
  music: [
    { label: "30–60 sec",       seconds: 45  },
    { label: "1–2 min (60–120s)",  seconds: 90  },
    { label: "2–3 min (120–180s)", seconds: 150 },
    { label: "3–5 min (180–300s)", seconds: 240 },
  ] as DurationOption[],

  /** Video content: reels, episodes, films */
  video: [
    { label: "30–60 sec",          seconds: 45  },
    { label: "1–2 min (60–120s)",  seconds: 90  },
    { label: "2–3 min (120–180s)", seconds: 150 },
    { label: "3–5 min (180–300s)", seconds: 240 },
    { label: "5–10 min (300–600s)", seconds: 420 },
    { label: "10+ min (600s+)",    seconds: 720 },
  ] as DurationOption[],

  /** Episode / series */
  episode: [
    { label: "1–2 min",   seconds: 90  },
    { label: "3–5 min",   seconds: 240 },
    { label: "5–10 min",  seconds: 420 },
    { label: "10–20 min", seconds: 900 },
    { label: "20–45 min", seconds: 1800 },
    { label: "45–60 min", seconds: 2700 },
  ] as DurationOption[],
};

interface DurationPickerProps {
  value?: string;
  onChange: (label: string, seconds: number) => void;
  preset?: keyof typeof DURATION_PRESETS;
  options?: DurationOption[];
  label?: string;
  accentColor?: string;
  compact?: boolean;
}

export default function DurationPicker({
  value,
  onChange,
  preset = "video",
  options,
  label = "DURATION",
  accentColor = "#7c5cfc",
  compact = false,
}: DurationPickerProps) {
  const opts: DurationOption[] = options ?? DURATION_PRESETS[preset];
  const withCustom: Array<DurationOption | { label: "Custom..."; seconds: -1 }> = [
    ...opts,
    { label: "Custom...", seconds: -1 },
  ];

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(value ?? opts[2]?.label ?? opts[0]?.label ?? "");
  const [customVal, setCustomVal] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    if (value && value !== selected) setSelected(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustomInput(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function pick(opt: DurationOption | { label: "Custom..."; seconds: -1 }) {
    if (opt.label === "Custom...") {
      setShowCustomInput(true);
      return;
    }
    setSelected(opt.label);
    setShowCustomInput(false);
    setOpen(false);
    onChange(opt.label, opt.seconds);
  }

  function applyCustom() {
    if (!customVal.trim()) return;
    const num = parseInt(customVal);
    if (isNaN(num)) return;
    const label = `${num} sec`;
    setSelected(label);
    setShowCustomInput(false);
    setOpen(false);
    onChange(label, num);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && !compact && (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#5a7080", marginBottom: 6 }}>
          {label}
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => { setOpen(o => !o); setShowCustomInput(false); }}
        style={{
          width: "100%",
          padding: compact ? "8px 12px" : "12px 16px",
          background: "#080b10",
          border: `1px solid ${open ? accentColor : "#1e2a35"}`,
          borderRadius: 10,
          color: "#e0dcff",
          fontSize: compact ? 12 : 14,
          fontWeight: 500,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "border-color 0.15s",
          outline: "none",
        }}>
        <span>{selected || "Select duration"}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s", opacity: 0.5 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#0d1117",
          border: `1px solid ${accentColor}60`,
          borderRadius: 10,
          zIndex: 200,
          overflow: "hidden",
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}20`,
        }}>
          {withCustom.map((opt) => {
            const isSel = opt.label === selected;
            return (
              <button key={opt.label} onClick={() => pick(opt)}
                style={{
                  width: "100%",
                  padding: "11px 16px",
                  background: isSel ? accentColor : "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isSel ? 600 : 400,
                  color: isSel ? "#fff" : opt.label === "Custom..." ? "#5a7080" : "#c0c8d8",
                  transition: "background 0.1s",
                  display: "block",
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "#ffffff08"; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                {opt.label}
              </button>
            );
          })}

          {/* Custom input inline */}
          {showCustomInput && (
            <div style={{ padding: "10px 12px", borderTop: "1px solid #1e2a35", display: "flex", gap: 6 }}>
              <input
                autoFocus
                type="number"
                min={1}
                placeholder="seconds"
                value={customVal}
                onChange={e => setCustomVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyCustom()}
                style={{
                  flex: 1,
                  background: "#06080f",
                  border: `1px solid ${accentColor}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button onClick={applyCustom}
                style={{ padding: "7px 14px", borderRadius: 6, background: accentColor, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
