"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Narration Controls — First-Class Narration System
//
// From Support Canvas:
// - Language per narration
// - Voice choice (standard AI / user voice / brand voice)
// - Speed, tone, pacing, emphasis control
// - Ducking rules interaction with music/SFX
// - Subtitle alignment
// - Narration modes: educational / commercial / story / explainer
// - Narration decisions visible during review BEFORE rendering
// ═══════════════════════════════════════════════════════════════════════════

interface NarrationControlsProps {
  narrationText: string;
  onNarrationChange: (text: string) => void;
  onSettingsChange: (settings: NarrationSettings) => void;
  initialSettings?: Partial<NarrationSettings>;
  compact?: boolean;
}

export interface NarrationSettings {
  language: string;
  voiceSource: "ai_standard" | "ai_premium" | "user_voice" | "brand_voice";
  voiceId: string;
  speed: number;       // 0.5 - 2.0
  tone: string;        // warm, neutral, authoritative, playful, dramatic, intimate
  pacing: string;      // slow, moderate, fast, dramatic (varies speed per sentence)
  emphasis: string;    // none, keywords, emotions, all
  mode: "educational" | "commercial" | "story" | "explainer" | "children" | "documentary";
  duckMusic: boolean;
  duckMusicLevel: number; // 0-1 (how much to lower music, e.g. 0.15)
  duckSfx: boolean;
  subtitleAlign: boolean;
  volume: number;      // 0-1
  pauseAfter: number;  // seconds of pause after narration segment
}

const DEFAULT_SETTINGS: NarrationSettings = {
  language: "en",
  voiceSource: "ai_standard",
  voiceId: "",
  speed: 1.0,
  tone: "warm",
  pacing: "moderate",
  emphasis: "keywords",
  mode: "story",
  duckMusic: true,
  duckMusicLevel: 0.15,
  duckSfx: true,
  subtitleAlign: true,
  volume: 1.0,
  pauseAfter: 0.5,
};

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const cyan = "#00d4ff";
const green = "#22c55e";
const gold = "#f59e0b";

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "es", label: "Spanish" }, { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" }, { code: "ar", label: "Arabic" }, { code: "hi", label: "Hindi" },
  { code: "sw", label: "Swahili" }, { code: "de", label: "German" }, { code: "zh", label: "Mandarin" },
  { code: "ja", label: "Japanese" }, { code: "ko", label: "Korean" }, { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" }, { code: "it", label: "Italian" }, { code: "nl", label: "Dutch" },
];

const TONES = ["warm", "neutral", "authoritative", "playful", "dramatic", "intimate", "calm", "energetic"];
const PACING_OPTIONS = [
  { id: "slow", label: "Slow", desc: "Bedtime, children, calm content" },
  { id: "moderate", label: "Moderate", desc: "Standard comfortable pace" },
  { id: "fast", label: "Fast", desc: "Energetic, commercial, trailer" },
  { id: "dramatic", label: "Dramatic", desc: "Varies speed per sentence — pauses for effect" },
];

const MODES = [
  { id: "educational" as const, label: "Educational", icon: "🎓", desc: "Clear, structured, repeats key concepts" },
  { id: "commercial" as const, label: "Commercial", icon: "📢", desc: "Confident, persuasive, call-to-action ready" },
  { id: "story" as const, label: "Story", icon: "📖", desc: "Warm, narrative, character-driven" },
  { id: "explainer" as const, label: "Explainer", icon: "💡", desc: "Step-by-step, logical, clear progression" },
  { id: "children" as const, label: "Children", icon: "🧒", desc: "Gentle, slow, playful, safe" },
  { id: "documentary" as const, label: "Documentary", icon: "🎥", desc: "Authoritative, measured, cinematic" },
];

export default function NarrationControls({ narrationText, onNarrationChange, onSettingsChange, initialSettings, compact }: NarrationControlsProps) {
  const [settings, setSettings] = useState<NarrationSettings>({ ...DEFAULT_SETTINGS, ...initialSettings });
  const [expanded, setExpanded] = useState(!compact);

  const update = (partial: Partial<NarrationSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    onSettingsChange(next);
  };

  const sectionLabel = { fontSize: 9, fontWeight: 500 as const, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8, marginTop: 14 };
  const pillBtn = (active: boolean, color: string) => ({
    padding: "5px 12px", borderRadius: 100, border: `1px solid ${active ? color : border}`,
    background: active ? `${color}10` : "transparent", color: active ? color : muted,
    fontSize: 10, cursor: "pointer" as const, fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 14, padding: compact ? 14 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expanded ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎙</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Narration Controls</span>
          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${cyan}15`, color: cyan, border: `1px solid ${cyan}30` }}>
            {settings.mode} / {settings.tone} / {settings.speed}x
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <>
          {/* Narration text */}
          <textarea value={narrationText} onChange={e => onNarrationChange(e.target.value)} rows={3}
            placeholder="Enter narration text..."
            style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }} />

          {/* Narration Mode */}
          <p style={sectionLabel}>Narration Mode</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 4 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => update({ mode: m.id })}
                style={{ padding: "8px 6px", borderRadius: 8, border: `1px solid ${settings.mode === m.id ? purple : border}`, background: settings.mode === m.id ? `${purple}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 14, display: "block" }}>{m.icon}</span>
                <p style={{ fontSize: 10, fontWeight: 600, color: settings.mode === m.id ? purple : "#fff" }}>{m.label}</p>
                <p style={{ fontSize: 7, color: muted }}>{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Voice Source */}
          <p style={sectionLabel}>Voice Source</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([
              { id: "ai_standard" as const, label: "GHS Standard Voice", cost: "Free" },
              { id: "ai_premium" as const, label: "GHS Premium Voice", cost: "1 credit" },
              { id: "user_voice" as const, label: "My Voice (upload)", cost: "Free" },
              { id: "brand_voice" as const, label: "Brand Voice (cloned)", cost: "2 credits" },
            ]).map(v => (
              <button key={v.id} onClick={() => update({ voiceSource: v.id })}
                style={pillBtn(settings.voiceSource === v.id, cyan)}>
                {v.label} <span style={{ fontSize: 8, color: muted, marginLeft: 4 }}>({v.cost})</span>
              </button>
            ))}
          </div>

          {/* Language */}
          <p style={sectionLabel}>Language</p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => update({ language: l.code })}
                style={pillBtn(settings.language === l.code, purple)}>
                {l.label}
              </button>
            ))}
          </div>

          {/* Speed + Volume */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Speed: {settings.speed.toFixed(1)}x</p>
              <input type="range" min="50" max="200" value={settings.speed * 100}
                onChange={e => update({ speed: parseInt(e.target.value) / 100 })}
                style={{ width: "100%", accentColor: purple }} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Volume: {Math.round(settings.volume * 100)}%</p>
              <input type="range" min="0" max="100" value={settings.volume * 100}
                onChange={e => update({ volume: parseInt(e.target.value) / 100 })}
                style={{ width: "100%", accentColor: purple }} />
            </div>
          </div>

          {/* Tone */}
          <p style={sectionLabel}>Tone</p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {TONES.map(t => (
              <button key={t} onClick={() => update({ tone: t })}
                style={pillBtn(settings.tone === t, gold)}>
                {t}
              </button>
            ))}
          </div>

          {/* Pacing */}
          <p style={sectionLabel}>Pacing</p>
          <div style={{ display: "flex", gap: 6 }}>
            {PACING_OPTIONS.map(p => (
              <button key={p.id} onClick={() => update({ pacing: p.id })}
                style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1px solid ${settings.pacing === p.id ? green : border}`, background: settings.pacing === p.id ? `${green}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: settings.pacing === p.id ? green : "#fff" }}>{p.label}</p>
                <p style={{ fontSize: 7, color: muted }}>{p.desc}</p>
              </button>
            ))}
          </div>

          {/* Ducking Rules */}
          <p style={sectionLabel}>Audio Interaction</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={settings.duckMusic} onChange={e => update({ duckMusic: e.target.checked })} style={{ accentColor: green }} />
              <span style={{ fontSize: 11, color: "#fff" }}>Duck music under narration</span>
              {settings.duckMusic && (
                <input type="range" min="5" max="50" value={settings.duckMusicLevel * 100}
                  onChange={e => update({ duckMusicLevel: parseInt(e.target.value) / 100 })}
                  style={{ width: 80, accentColor: green, marginLeft: 8 }} />
              )}
              {settings.duckMusic && <span style={{ fontSize: 9, color: muted }}>Music at {Math.round(settings.duckMusicLevel * 100)}%</span>}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={settings.duckSfx} onChange={e => update({ duckSfx: e.target.checked })} style={{ accentColor: green }} />
              <span style={{ fontSize: 11, color: "#fff" }}>Lower SFX during narration</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={settings.subtitleAlign} onChange={e => update({ subtitleAlign: e.target.checked })} style={{ accentColor: green }} />
              <span style={{ fontSize: 11, color: "#fff" }}>Auto-align subtitles to narration timing</span>
            </label>
          </div>

          {/* Pause after */}
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Pause after narration: {settings.pauseAfter.toFixed(1)}s</p>
            <input type="range" min="0" max="30" value={settings.pauseAfter * 10}
              onChange={e => update({ pauseAfter: parseInt(e.target.value) / 10 })}
              style={{ width: "100%", accentColor: purple }} />
          </div>
        </>
      )}
    </div>
  );
}
