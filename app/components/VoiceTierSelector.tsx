"use client";

import { useState } from "react";

// ── Voice Tier System ─────────────────────────────────────────────────────────
// GHS Standard  = Piper (free, local)
// GHS Pro       = ElevenLabs (paid, high quality)
// GHS Premium   = Gemini Flash TTS via fal.ai (paid, highest quality)

export type VoiceTier = "standard" | "pro" | "premium";

export interface VoiceTierConfig {
  tier: VoiceTier;
  voiceId?: string;  // ElevenLabs voice ID or Gemini voice name
  speed?: number;
}

const border = "#1e2a35";
const muted = "#5a7080";
const s2 = "#0d111c";

const TIERS = [
  {
    id: "standard" as VoiceTier,
    label: "GHS Standard",
    badge: "FREE",
    engine: "Piper TTS",
    price: "Free",
    color: "#22c55e",
    desc: "Local AI voice. Fast, private, no cost.",
    models: ["en-US Lessac", "en-GB Alan", "en-US Ryan"],
    priceNote: "$0 / unlimited",
  },
  {
    id: "pro" as VoiceTier,
    label: "GHS Pro",
    badge: "PRO",
    engine: "ElevenLabs",
    price: "~$0.03/min",
    color: "#a855f7",
    desc: "Studio-quality voice synthesis. Emotional range.",
    models: ["Rachel (warm, female)", "Antoni (deep, male)", "Bella (soft, female)", "Josh (clear, male)", "Elli (bright, female)"],
    priceNote: "$0.03 per 1,000 chars",
  },
  {
    id: "premium" as VoiceTier,
    label: "GHS Premium",
    badge: "PREMIUM",
    engine: "Gemini Flash TTS",
    price: "~$0.01/min",
    color: "#00d4ff",
    desc: "Google Gemini voice via fal.ai. Multi-speaker support.",
    models: ["Zephyr (neutral)", "Puck (bright)", "Charon (deep)", "Kore (soft)", "Fenrir (gravel)", "Aoede (melodic)"],
    priceNote: "$0.01 per 1,000 chars (via fal.ai)",
  },
];

// ElevenLabs voices for Pro tier
const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah — warm female" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel — calm female" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi — fierce female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli — bright female" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh — clear male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold — crisp male" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam — narrative male" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam — grounded male" },
];

// Gemini voices for Premium tier
const GEMINI_VOICES = [
  { id: "Zephyr", name: "Zephyr — neutral" },
  { id: "Puck", name: "Puck — bright" },
  { id: "Charon", name: "Charon — deep" },
  { id: "Kore", name: "Kore — soft" },
  { id: "Fenrir", name: "Fenrir — gravel" },
  { id: "Leda", name: "Leda — clear female" },
  { id: "Aoede", name: "Aoede — melodic" },
  { id: "Orus", name: "Orus — warm male" },
];

interface VoiceTierSelectorProps {
  value: VoiceTierConfig;
  onChange: (config: VoiceTierConfig) => void;
  compact?: boolean;
}

export default function VoiceTierSelector({ value, onChange, compact }: VoiceTierSelectorProps) {
  const [showModels, setShowModels] = useState(false);

  const selected = TIERS.find(t => t.id === value.tier) ?? TIERS[0];
  const voices = value.tier === "pro" ? ELEVENLABS_VOICES : value.tier === "premium" ? GEMINI_VOICES : [];

  return (
    <div style={{ marginBottom: compact ? 8 : 16 }}>
      {!compact && (
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: muted, marginBottom: 8 }}>
          Voice Engine
        </p>
      )}

      {/* Tier pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {TIERS.map(t => (
          <button
            key={t.id}
            onClick={() => onChange({ tier: t.id })}
            style={{
              flex: 1, padding: compact ? "6px 4px" : "8px 6px",
              borderRadius: 8,
              border: `1px solid ${value.tier === t.id ? t.color : border}`,
              background: value.tier === t.id ? `${t.color}12` : "transparent",
              cursor: "pointer", textAlign: "center",
            }}
          >
            <p style={{ fontSize: 9, fontWeight: 700, color: value.tier === t.id ? t.color : "#4a6070", letterSpacing: 0.5 }}>
              {t.label}
            </p>
            <p style={{ fontSize: 8, color: value.tier === t.id ? t.color + "99" : "#2a3a45", marginTop: 1 }}>
              {t.price}
            </p>
          </button>
        ))}
      </div>

      {/* Selected engine info + view models */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: s2, border: `1px solid ${border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: selected.color }} />
          <span style={{ fontSize: 11, color: "#9aafb8" }}>
            {selected.engine}
          </span>
          <span style={{ fontSize: 9, background: `${selected.color}20`, color: selected.color, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
            {selected.badge}
          </span>
        </div>
        <button
          onClick={() => setShowModels(v => !v)}
          style={{ fontSize: 9, color: muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          {showModels ? "Hide models" : "View models"}
        </button>
      </div>

      {/* Expanded model list */}
      {showModels && (
        <div style={{ marginTop: 6, borderRadius: 8, border: `1px solid ${border}`, background: "#080b10", padding: "10px 12px" }}>
          {TIERS.map(t => (
            <div key={t.id} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: t.color, marginBottom: 4 }}>
                {t.label} — {t.engine}
              </p>
              <p style={{ fontSize: 9, color: muted, marginBottom: 3 }}>{t.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {t.models.map(m => (
                  <span key={m} style={{ fontSize: 8, background: `${t.color}10`, border: `1px solid ${t.color}30`, color: t.color + "cc", borderRadius: 4, padding: "2px 6px" }}>
                    {m}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 8, color: "#3a5060", marginTop: 3 }}>{t.priceNote}</p>
            </div>
          ))}
        </div>
      )}

      {/* Voice picker for Pro / Premium */}
      {voices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>
            {value.tier === "premium" ? "Gemini Voice" : "ElevenLabs Voice"}
          </p>
          <select
            value={value.voiceId || ""}
            onChange={e => onChange({ ...value, voiceId: e.target.value })}
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 10px", color: "#e0e8f0", fontSize: 11 }}
          >
            <option value="">Default voice</option>
            {voices.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Speed slider */}
      {!compact && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, color: muted, minWidth: 36 }}>Speed</span>
          <input
            type="range" min={0.5} max={2} step={0.1}
            value={value.speed ?? 1}
            onChange={e => onChange({ ...value, speed: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: selected.color }}
          />
          <span style={{ fontSize: 9, color: muted, minWidth: 26 }}>{(value.speed ?? 1).toFixed(1)}×</span>
        </div>
      )}
    </div>
  );
}

// ── Helper: call TTS with tier config ────────────────────────────────────────
export async function generateTTS(text: string, config: VoiceTierConfig): Promise<{ audioUrl: string; engine: string } | null> {
  try {
    if (config.tier === "premium") {
      const res = await fetch("/api/tts/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: config.voiceId || "Charon" }),
      });
      const data = await res.json();
      if (data.audioUrl) return { audioUrl: data.audioUrl, engine: "GHS Premium (Gemini)" };
    }

    // Standard and Pro both go through main /api/tts — engine param selects
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceId: config.voiceId,
        speed: config.speed,
        engine: config.tier === "pro" ? "elevenlabs" : "piper",
      }),
    });
    const data = await res.json();
    if (data.audioUrl) return { audioUrl: data.audioUrl, engine: data.engine };
    return null;
  } catch {
    return null;
  }
}
