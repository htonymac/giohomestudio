"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Text Overlay Designer — Modern Social Media Style
//
// From Support Canvas:
// - Modern social media overlay style: text reveal, caption behavior, sticker/card look
// - Must work in actual video rendering (FFmpeg drawtext), not just preview
//
// Styles: TikTok captions, Instagram story text, YouTube card,
//         cinematic subtitle, karaoke highlight, news ticker
// ═══════════════════════════════════════════════════════════════════════════

export interface TextOverlay {
  id: string;
  text: string;
  style: OverlayStyle;
  position: "top" | "center" | "bottom" | "custom";
  startTime: number;
  endTime: number;
  animation: "none" | "fade" | "typewriter" | "slide_up" | "slide_left" | "slide_right" | "pop" | "word_by_word" | "line_by_line" | "stagger" | "wipe" | "bounce" | "blur_reveal";
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  opacity: number;
  bold: boolean;
  shadow: boolean;
}

type OverlayStyle = "tiktok_caption" | "instagram_story" | "youtube_card" | "cinematic_subtitle" | "karaoke" | "news_ticker" | "sticker" | "minimal" | "custom";

const OVERLAY_STYLES: Array<{ id: OverlayStyle; label: string; icon: string; desc: string; preview: { bg: string; color: string; radius: number; padding: number; fontSize: number; bold: boolean; shadow: boolean } }> = [
  { id: "tiktok_caption", label: "TikTok Caption", icon: "📱", desc: "Bold white text with shadow, bottom-center", preview: { bg: "transparent", color: "#ffffff", radius: 0, padding: 0, fontSize: 28, bold: true, shadow: true } },
  { id: "instagram_story", label: "Instagram Story", icon: "📸", desc: "Rounded pill with background, center", preview: { bg: "rgba(0,0,0,0.6)", color: "#ffffff", radius: 100, padding: 16, fontSize: 22, bold: true, shadow: false } },
  { id: "youtube_card", label: "YouTube Card", icon: "🎬", desc: "Semi-transparent card, lower third", preview: { bg: "rgba(0,0,0,0.75)", color: "#ffffff", radius: 8, padding: 12, fontSize: 18, bold: false, shadow: false } },
  { id: "cinematic_subtitle", label: "Cinematic Subtitle", icon: "🎥", desc: "Clean white on dark strip, bottom", preview: { bg: "rgba(0,0,0,0.5)", color: "#ffffff", radius: 4, padding: 8, fontSize: 20, bold: false, shadow: true } },
  { id: "karaoke", label: "Karaoke Highlight", icon: "🎤", desc: "Word-by-word highlight, color sweep", preview: { bg: "transparent", color: "#ffdd00", radius: 0, padding: 0, fontSize: 32, bold: true, shadow: true } },
  { id: "news_ticker", label: "News Ticker", icon: "📰", desc: "Scrolling text bar, bottom", preview: { bg: "#cc0000", color: "#ffffff", radius: 0, padding: 8, fontSize: 16, bold: true, shadow: false } },
  { id: "sticker", label: "Sticker / Badge", icon: "🏷", desc: "Emoji + text on card, pop animation", preview: { bg: "#7c5cfc", color: "#ffffff", radius: 16, padding: 14, fontSize: 16, bold: true, shadow: false } },
  { id: "minimal", label: "Minimal", icon: "✨", desc: "Small, clean, no background", preview: { bg: "transparent", color: "#ffffff", radius: 0, padding: 0, fontSize: 16, bold: false, shadow: false } },
  { id: "custom", label: "Brush Label", icon: "🖌", desc: "Paint-stroke background, rough edges", preview: { bg: "rgba(168,85,247,0.85)", color: "#ffffff", radius: 4, padding: 12, fontSize: 18, bold: true, shadow: true } },
];

const ANIMATIONS = [
  { id: "none" as const, label: "None" },
  { id: "fade" as const, label: "Fade In" },
  { id: "typewriter" as const, label: "Typewriter" },
  { id: "slide_up" as const, label: "Slide Up" },
  { id: "slide_left" as const, label: "Slide Left" },
  { id: "slide_right" as const, label: "Slide Right" },
  { id: "pop" as const, label: "Pop / Bounce" },
  { id: "word_by_word" as const, label: "Word by Word" },
  { id: "line_by_line" as const, label: "Line by Line" },
  { id: "stagger" as const, label: "Staggered Reveal" },
  { id: "wipe" as const, label: "Wipe / Mask" },
  { id: "bounce" as const, label: "Bounce In" },
  { id: "blur_reveal" as const, label: "Blur Reveal" },
];

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const green = "#22c55e";

interface TextOverlayDesignerProps {
  overlays: TextOverlay[];
  onOverlaysChange: (overlays: TextOverlay[]) => void;
  totalDuration: number;
}

export default function TextOverlayDesigner({ overlays, onOverlaysChange, totalDuration }: TextOverlayDesignerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = overlays.find(o => o.id === selectedId);

  const addOverlay = (style: OverlayStyle) => {
    const preset = OVERLAY_STYLES.find(s => s.id === style)?.preview;
    const newOverlay: TextOverlay = {
      id: `overlay_${Date.now()}`,
      text: "Your text here",
      style,
      position: style === "news_ticker" ? "bottom" : style === "tiktok_caption" ? "bottom" : "center",
      startTime: 0,
      endTime: Math.min(5, totalDuration),
      animation: style === "karaoke" ? "word_by_word" : style === "sticker" ? "pop" : "fade",
      fontSize: preset?.fontSize || 20,
      fontColor: preset?.color || "#ffffff",
      backgroundColor: preset?.bg || "transparent",
      borderRadius: preset?.radius || 0,
      padding: preset?.padding || 0,
      opacity: 1,
      bold: preset?.bold || false,
      shadow: preset?.shadow || false,
    };
    onOverlaysChange([...overlays, newOverlay]);
    setSelectedId(newOverlay.id);
  };

  const updateOverlay = (id: string, changes: Partial<TextOverlay>) => {
    onOverlaysChange(overlays.map(o => o.id === id ? { ...o, ...changes } : o));
  };

  const removeOverlay = (id: string) => {
    onOverlaysChange(overlays.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>📝</span>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Text & Overlay Designer</p>
        <span style={{ fontSize: 10, color: muted }}>{overlays.length} overlay(s)</span>
      </div>

      {/* Style picker — add new overlay */}
      <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Add Overlay Style</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
        {OVERLAY_STYLES.map(s => (
          <button key={s.id} onClick={() => addOverlay(s.id)}
            style={{ padding: "8px 6px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
            <span style={{ fontSize: 16, display: "block" }}>{s.icon}</span>
            <p style={{ fontSize: 9, fontWeight: 600, color: "#fff", marginTop: 2 }}>{s.label}</p>
            <p style={{ fontSize: 7, color: muted }}>{s.desc}</p>
          </button>
        ))}
      </div>

      {/* Overlay list */}
      {overlays.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Active Overlays</p>
          {overlays.map(o => (
            <div key={o.id} onClick={() => setSelectedId(o.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: selectedId === o.id ? `${purple}08` : "#080b10", border: `1px solid ${selectedId === o.id ? purple : border}`, borderRadius: 8, marginBottom: 4, cursor: "pointer" }}>
              <span style={{ fontSize: 12 }}>{OVERLAY_STYLES.find(s => s.id === o.style)?.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: "#fff", fontWeight: 500 }}>{o.text.slice(0, 30)}{o.text.length > 30 ? "..." : ""}</p>
                <p style={{ fontSize: 9, color: muted }}>{o.startTime}s – {o.endTime}s · {OVERLAY_STYLES.find(s => s.id === o.style)?.label} · {o.animation}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); removeOverlay(o.id); }}
                style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Selected overlay editor */}
      {selected && (
        <div style={{ background: "#080b10", border: `1px solid ${purple}30`, borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: purple, marginBottom: 10 }}>Editing: {OVERLAY_STYLES.find(s => s.id === selected.style)?.label}</p>

          <textarea value={selected.text} onChange={e => updateOverlay(selected.id, { text: e.target.value })}
            rows={2} style={{ width: "100%", background: "#060810", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Start: {selected.startTime}s</p>
              <input type="range" min="0" max={totalDuration} value={selected.startTime}
                onChange={e => updateOverlay(selected.id, { startTime: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: purple }} />
            </div>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>End: {selected.endTime}s</p>
              <input type="range" min={selected.startTime} max={totalDuration} value={selected.endTime}
                onChange={e => updateOverlay(selected.id, { endTime: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: purple }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Position</p>
              <select value={selected.position} onChange={e => updateOverlay(selected.id, { position: e.target.value as TextOverlay["position"] })}
                style={{ width: "100%", background: "#060810", border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Animation</p>
              <select value={selected.animation} onChange={e => updateOverlay(selected.id, { animation: e.target.value as TextOverlay["animation"] })}
                style={{ width: "100%", background: "#060810", border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
                {ANIMATIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Font Size: {selected.fontSize}px</p>
              <input type="range" min="10" max="60" value={selected.fontSize}
                onChange={e => updateOverlay(selected.id, { fontSize: parseInt(e.target.value) })}
                style={{ width: "100%", accentColor: purple }} />
            </div>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Font Color</p>
              <input type="color" value={selected.fontColor}
                onChange={e => updateOverlay(selected.id, { fontColor: e.target.value })}
                style={{ width: "100%", height: 28, border: "none", cursor: "pointer" }} />
            </div>
            <div>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>BG Color</p>
              <input type="color" value={selected.backgroundColor === "transparent" ? "#000000" : selected.backgroundColor}
                onChange={e => updateOverlay(selected.id, { backgroundColor: e.target.value })}
                style={{ width: "100%", height: 28, border: "none", cursor: "pointer" }} />
            </div>
          </div>

          {/* Preview */}
          <div style={{ marginTop: 12, padding: 20, background: "#1a1a2e", borderRadius: 8, textAlign: selected.position === "center" ? "center" : "left", display: "flex", alignItems: selected.position === "top" ? "flex-start" : selected.position === "bottom" ? "flex-end" : "center", justifyContent: "center", minHeight: 80 }}>
            <span style={{
              fontSize: selected.fontSize * 0.6,
              color: selected.fontColor,
              backgroundColor: selected.backgroundColor,
              padding: selected.padding * 0.6,
              borderRadius: selected.borderRadius,
              fontWeight: selected.bold ? 700 : 400,
              textShadow: selected.shadow ? "0 2px 4px rgba(0,0,0,0.8)" : "none",
              display: "inline-block",
            }}>
              {selected.text || "Preview text"}
            </span>
          </div>
        </div>
      )}

      {/* FFmpeg compatibility note */}
      <p style={{ fontSize: 9, color: "#3d5060", marginTop: 12, lineHeight: 1.5 }}>
        All styles render via FFmpeg drawtext filter in final video. Animations are applied as FFmpeg filter expressions (fade=enable, scroll for ticker). Preview is approximate.
      </p>
    </div>
  );
}
