"use client";

import { useState } from "react";

// ── Shared SubtitleConfig type ────────────────────────────────────────────────
// Exported so children-planner, movie-planner, and assemble route can share it.
// Modes added 2026-05-29 (Henry): 8 FB/YT-style per-word animated modes.
export interface SubtitleConfig {
  mode: "dialogue" | "highlight" | "kids" | "dramatic" | "social"
      | "dance_word" | "rainbow" | "bubble_pop" | "big_friendly"
      | "mrbeast_single" | "yellow_sweep" | "glow_pop" | "typewriter"
      | "none";
  fontFamily: "sans" | "serif" | "mono" | "display";
  fontSize: number;       // 24-80px
  textColor: string;      // hex
  highlightColor: string; // hex — used in highlight/kids/dance_word/yellow_sweep modes
  bgBox: boolean;
  bgOpacity: number;      // 0-1
  position: "bottom" | "center" | "top";
  animation: "none" | "fade" | "pop" | "bounce" | "slide" | "karaoke" | "dance";
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  mode: "dialogue",
  fontFamily: "sans",
  fontSize: 48,
  textColor: "#ffffff",
  highlightColor: "#f59e0b",
  bgBox: true,
  bgOpacity: 0.75,
  position: "bottom",
  animation: "fade",
};

const MODES: Array<{
  id: SubtitleConfig["mode"];
  label: string;
  desc: string;
  preview: { bg: string; text: string; accent: string };
}> = [
  { id: "dialogue",       label: "Normal Dialogue",         desc: "Clean semi-transparent bar",        preview: { bg: "rgba(0,0,0,0.75)", text: "#fff",    accent: "#fff" } },
  { id: "highlight",      label: "Word-by-Word Highlight",  desc: "Yellow highlight as words appear",  preview: { bg: "rgba(0,0,0,0.8)",  text: "#fff",    accent: "#f59e0b" } },
  { id: "kids",           label: "Children Song / Kids",    desc: "Colorful bubbly captions",          preview: { bg: "rgba(124,58,237,0.85)", text: "#fff", accent: "#34d399" } },
  { id: "dramatic",       label: "Dramatic Movie",          desc: "Cinema letterbox, spaced letters",  preview: { bg: "rgba(0,0,0,0.88)", text: "#fff",    accent: "#e5e5e5" } },
  { id: "social",         label: "Social Media Caption",    desc: "Bold with glow — TikTok / Reels",   preview: { bg: "rgba(0,0,0,0.65)", text: "#fff",    accent: "#00d4ff" } },
  // ── Henry 2026-05-29: 8 FB/YT-inspired per-word animated modes ──────────────
  { id: "dance_word",     label: "Dance Word 💃 (kids)",     desc: "Each word bounces + scales when spoken", preview: { bg: "rgba(20,30,80,0.85)", text: "#fff",    accent: "#fbbf24" } },
  { id: "rainbow",        label: "Rainbow Cycle 🌈 (kids)",  desc: "Each word a different color, looped",     preview: { bg: "rgba(20,30,80,0.85)", text: "#f87171", accent: "#34d399" } },
  { id: "bubble_pop",     label: "Bubble Pop 🫧 (kids)",     desc: "Words scale-pop in, fade out",            preview: { bg: "rgba(124,58,237,0.7)", text: "#fff",   accent: "#fbcfe8" } },
  { id: "big_friendly",   label: "Big Friendly 🐻 (kids)",   desc: "Huge rounded font, thick yellow outline", preview: { bg: "transparent",      text: "#fff",    accent: "#fbbf24" } },
  { id: "mrbeast_single", label: "MrBeast Single 💥",        desc: "One WORD at a time, huge, thick outline", preview: { bg: "rgba(0,0,0,0.6)",  text: "#fff",    accent: "#fff" } },
  { id: "yellow_sweep",   label: "Yellow Sweep ✨",          desc: "Yellow bar sweeps each word as spoken",   preview: { bg: "rgba(0,0,0,0.8)",  text: "#fff",    accent: "#fde047" } },
  { id: "glow_pop",       label: "Glow Pop 🎨 (TikTok)",     desc: "Neon glow outline, pop in/out",           preview: { bg: "rgba(0,0,0,0.5)",  text: "#fff",    accent: "#22d3ee" } },
  { id: "typewriter",     label: "Typewriter ⌨ (vintage)",   desc: "Character-by-character cream text",       preview: { bg: "rgba(40,30,20,0.85)", text: "#fef3c7", accent: "#fef3c7" } },
];

const FONTS: Array<{ id: SubtitleConfig["fontFamily"]; label: string; css: string }> = [
  { id: "sans",    label: "Sans",    css: "Arial, Helvetica, sans-serif" },
  { id: "serif",   label: "Serif",   css: "Georgia, 'Times New Roman', serif" },
  { id: "mono",    label: "Mono",    css: "'Courier New', Courier, monospace" },
  { id: "display", label: "Display", css: "'Arial Black', Impact, sans-serif" },
];

const ANIMATIONS: SubtitleConfig["animation"][] = ["none", "fade", "pop", "bounce", "slide", "karaoke", "dance"];

// ── Dance animation keyframes injected once ──────────────────────────────────
const DANCE_STYLE = `
@keyframes ghs-dance-word {
  0%,100% { transform: translateY(0) rotate(0deg) scale(1); }
  20%      { transform: translateY(-5px) rotate(-4deg) scale(1.1); }
  40%      { transform: translateY(2px) rotate(3deg) scale(0.95); }
  60%      { transform: translateY(-4px) rotate(-2deg) scale(1.08); }
  80%      { transform: translateY(1px) rotate(2deg) scale(0.97); }
}
`;
let danceStyleInjected = false;
function injectDanceStyle() {
  if (typeof document === "undefined" || danceStyleInjected) return;
  const el = document.createElement("style");
  el.textContent = DANCE_STYLE;
  document.head.appendChild(el);
  danceStyleInjected = true;
}

// ── Mini preview component ───────────────────────────────────────────────────
function MiniPreview({ cfg }: { cfg: SubtitleConfig }) {
  const fontEntry = FONTS.find(f => f.id === cfg.fontFamily)!;
  const bgAlpha = `rgba(0,0,0,${cfg.bgOpacity})`;
  const isKids = cfg.mode === "kids";
  const isDramatic = cfg.mode === "dramatic";
  const isHighlight = cfg.mode === "highlight";
  const isDance = cfg.animation === "dance";

  if (isDance) injectDanceStyle();

  const sampleText = isKids ? "🎵 La la la, here we go!" : isDramatic ? "A HERO IS BORN" : "The story begins here today.";
  const words = sampleText.split(" ");

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: 80,
      background: "linear-gradient(135deg, #1a1a2e, #16213e)",
      borderRadius: 8,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.1)",
    }}>
      {/* Fake video frame content */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0d1b3e 0%, #1a0a3a 50%, #0d2412 100%)", opacity: 0.8 }} />
      {/* Subtitle bar */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        ...(cfg.position === "bottom" ? { bottom: 4 } : cfg.position === "top" ? { top: 4 } : { top: "50%", transform: "translateY(-50%)" }),
        padding: "4px 10px",
        background: cfg.bgBox ? bgAlpha : "transparent",
        textAlign: "center",
        borderRadius: isKids ? 12 : isDramatic ? 0 : 4,
        border: isKids ? "2px solid rgba(255,255,255,0.3)" : "none",
      }}>
        {isDance ? (
          <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" as const, justifyContent: "center" }}>
            {words.map((w, i) => (
              <span key={i} style={{
                fontFamily: fontEntry.css,
                fontSize: 11,
                fontWeight: 800,
                color: i % 2 === 0 ? cfg.textColor : cfg.highlightColor,
                display: "inline-block",
                animation: `ghs-dance-word 0.6s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
                textShadow: `0 0 6px ${cfg.highlightColor}80`,
              }}>{w}</span>
            ))}
          </span>
        ) : isHighlight ? (
          <span style={{ fontFamily: fontEntry.css, fontSize: 11, color: cfg.textColor, letterSpacing: 0.5 }}>
            The{" "}
            <span style={{ background: cfg.highlightColor, color: "#000", borderRadius: 2, padding: "0 2px", fontWeight: 700 }}>story</span>
            {" "}begins here today.
          </span>
        ) : isKids ? (
          <span style={{ fontFamily: "'Arial Rounded MT Bold', Arial, sans-serif", fontSize: 11, color: cfg.highlightColor, fontWeight: 800, textShadow: "0 0 8px rgba(0,0,0,0.9)", letterSpacing: 0.5 }}>
            {sampleText}
          </span>
        ) : isDramatic ? (
          <span style={{ fontFamily: fontEntry.css, fontSize: 10, color: cfg.textColor, fontWeight: 400, letterSpacing: 4, textTransform: "uppercase" as const }}>
            {sampleText}
          </span>
        ) : (
          <span style={{ fontFamily: fontEntry.css, fontSize: 11, color: cfg.textColor, fontWeight: cfg.mode === "social" ? 800 : 700 }}>
            {cfg.mode === "social" ? <span style={{ textShadow: `0 0 8px ${cfg.highlightColor}` }}>{sampleText}</span> : sampleText}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main SubtitleStyler component ────────────────────────────────────────────
interface SubtitleStylerProps {
  value: SubtitleConfig;
  onChange: (cfg: SubtitleConfig) => void;
  accentColor?: string;
}

export default function SubtitleStyler({ value, onChange, accentColor = "#a78bfa" }: SubtitleStylerProps) {
  const [expanded, setExpanded] = useState(false);

  const s2 = "#111128";
  const border = "#2a2a4a";
  const muted = "#6b7280";
  const cardBg = "#0f0f20";

  function set<K extends keyof SubtitleConfig>(key: K, val: SubtitleConfig[K]) {
    onChange({ ...value, [key]: val });
  }

  const subtitlesOn = value.mode !== "none";

  return (
    <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${border}`, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
        <div style={{ cursor: subtitlesOn ? "pointer" : "default" }} onClick={() => subtitlesOn && setExpanded(!expanded)}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>Subtitle Style</p>
          <p style={{ fontSize: 9, color: muted, margin: "2px 0 0" }}>
            {subtitlesOn
              ? `${MODES.find(m => m.id === value.mode)?.label ?? "Normal Dialogue"} · ${value.position} · ${value.animation}`
              : "Subtitles disabled"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* No Subtitles toggle */}
          <button
            onClick={() => { onChange({ ...value, mode: subtitlesOn ? "none" : "dialogue" }); setExpanded(false); }}
            style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${subtitlesOn ? border : "#ef4444"}`, background: subtitlesOn ? "transparent" : "#ef444420", color: subtitlesOn ? muted : "#ef4444", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
            {subtitlesOn ? "Disable" : "Enable Subtitles"}
          </button>
          {subtitlesOn && (
            <>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: value.textColor, border: "2px solid rgba(255,255,255,0.2)" }} />
              <span style={{ fontSize: 10, color: accentColor, fontWeight: 700, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
                {expanded ? "▲ Close" : "▼ Customise"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Live preview — only when enabled */}
      {subtitlesOn && (
        <div style={{ padding: "0 14px 10px" }}>
          <MiniPreview cfg={value} />
        </div>
      )}

      {expanded && subtitlesOn && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column" as const, gap: 14 }}>

          {/* Mode cards */}
          <div>
            <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>MODE</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => set("mode", m.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${value.mode === m.id ? accentColor : border}`,
                    background: value.mode === m.id ? `${accentColor}18` : s2,
                    cursor: "pointer",
                    textAlign: "left" as const,
                  }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: value.mode === m.id ? accentColor : "#fff", margin: "0 0 2px" }}>{m.label}</p>
                  <p style={{ fontSize: 8, color: muted, margin: 0 }}>{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div>
            <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>FONT</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {FONTS.map(f => (
                <button key={f.id} onClick={() => set("fontFamily", f.id)}
                  style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${value.fontFamily === f.id ? accentColor : border}`, background: value.fontFamily === f.id ? `${accentColor}18` : "transparent", color: value.fontFamily === f.id ? accentColor : muted, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: f.css }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size + position row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>FONT SIZE — {value.fontSize}px</p>
              <input type="range" min={24} max={80} step={2} value={value.fontSize}
                onChange={e => set("fontSize", Number(e.target.value))}
                style={{ width: "100%", accentColor }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 8, color: muted }}>24</span>
                <span style={{ fontSize: 8, color: muted }}>80</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>POSITION</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                {(["bottom", "center", "top"] as SubtitleConfig["position"][]).map(pos => (
                  <label key={pos} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="subtitle-pos" checked={value.position === pos} onChange={() => set("position", pos)}
                      style={{ accentColor }} />
                    <span style={{ fontSize: 10, color: value.position === pos ? accentColor : muted, textTransform: "capitalize" as const }}>{pos}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Colors */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>TEXT COLOR</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={value.textColor} onChange={e => set("textColor", e.target.value)}
                  style={{ width: 36, height: 28, borderRadius: 6, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontSize: 9, color: muted }}>{value.textColor}</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>HIGHLIGHT COLOR</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={value.highlightColor} onChange={e => set("highlightColor", e.target.value)}
                  style={{ width: 36, height: 28, borderRadius: 6, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontSize: 9, color: muted }}>{value.highlightColor}</span>
              </div>
            </div>
          </div>

          {/* Background box */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 10, color: muted, fontWeight: 600, margin: 0 }}>BACKGROUND BOX</p>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={value.bgBox} onChange={e => set("bgBox", e.target.checked)}
                  style={{ accentColor }} />
                <span style={{ fontSize: 10, color: value.bgBox ? accentColor : muted }}>{value.bgBox ? "On" : "Off"}</span>
              </label>
            </div>
            {value.bgBox && (
              <>
                <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Opacity — {Math.round(value.bgOpacity * 100)}%</p>
                <input type="range" min={0} max={1} step={0.05} value={value.bgOpacity}
                  onChange={e => set("bgOpacity", Number(e.target.value))}
                  style={{ width: "100%", accentColor }} />
              </>
            )}
          </div>

          {/* Animation */}
          <div>
            <p style={{ fontSize: 10, color: muted, fontWeight: 600, marginBottom: 6 }}>ANIMATION</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {ANIMATIONS.map(a => (
                <button key={a} onClick={() => set("animation", a)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${value.animation === a ? accentColor : border}`, background: value.animation === a ? `${accentColor}18` : "transparent", color: value.animation === a ? accentColor : muted, fontSize: 9, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
