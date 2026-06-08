"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CaptionsTab — caption / lyric controls for music-video-planner.
//
// SECTIONS (top → bottom):
//   1. Caption display mode picker (Full Lyrics / Key Lines Only / Subtitle Style / No Captions)
//   2. Caption position picker (Top / Center / Bottom)
//   3. Font style picker (Bold Modern / Clean Sans / Italic Drama / Worship Serif)
//   4. Lyrics / caption text editor (controlled textarea)
//   5. "Go to Storyboard" navigation button
//
// All buttons except the Lyrics textarea + nav button are no-op mock UI — they
// don't wire to state yet. Kept as-is during extraction (zero behavior change).
//
// Parent contract: pass lyrics, setLyrics, setActiveTab + the surface color
// token. That's the entire prop surface.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";

export type MusicVideoTab =
  | "overview" | "song" | "analysis" | "script" | "captions"
  | "sound" | "storyboard" | "characters" | "assembly";

export interface CaptionsTabProps {
  /** Lyrics / caption text — controlled textarea value. */
  lyrics: string;
  setLyrics: React.Dispatch<React.SetStateAction<string>>;
  /** Tab switcher — used by the "Go to Storyboard" button. */
  setActiveTab: (tab: MusicVideoTab) => void;
  /** Card background color token (parent's `surface` const). */
  surface: string;
}

export default function CaptionsTab({ lyrics, setLyrics, setActiveTab, surface }: CaptionsTabProps) {
  return (
    <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Captions &amp; Lyrics</h2>

      {/* Caption display mode (mock UI — buttons don't bind to state yet) */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Caption Display Mode</p>
        <div style={{ display: "flex", gap: 8 }}>
          {["Full Lyrics", "Key Lines Only", "Subtitle Style", "No Captions"].map(m => (
            <button key={m} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Caption position (mock UI) */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Caption Position</p>
        <div style={{ display: "flex", gap: 8 }}>
          {["Top", "Center", "Bottom"].map(p => (
            <button key={p} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Font style picker (mock UI) */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Font Style</p>
        <div style={{ display: "flex", gap: 8 }}>
          {["Bold Modern", "Clean Sans", "Italic Drama", "Worship Serif"].map(f => (
            <button key={f} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Lyrics / caption text — the only field that actually binds to state */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Lyrics / Caption Text</p>
        <textarea
          value={lyrics}
          onChange={e => setLyrics(e.target.value)}
          rows={6}
          placeholder="Paste or edit your lyrics here for timed captions..."
          style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" as const }}
        />
      </div>

      <button
        onClick={() => setActiveTab("storyboard")}
        style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#ec4899", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        → Go to Storyboard
      </button>
    </div>
  );
}
