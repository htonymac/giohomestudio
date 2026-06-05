"use client";

// GHS Voice Tier Selector — canonical voice picker shared across planners.
//
// Reads voices from src/lib/voice-registry.ts (single source of truth).
// Adding a new voice = ONE entry in voice-registry. This component picks it
// up automatically.
//
// UI design (locked 2026-06-04 — Henry confirmed "DONT CHANGE UI JUST UPDATE AND ADD"):
//   ┌─────────────────────────────────────────────────────────────────┐
//   │ Voice Engine                                                    │
//   │ [GHS Standard] [GHS Standard+] [GHS Pro] [GHS Premium] [GHS Best]│   ← tier pills
//   │ ───────────────────────────────────────────────────────────────  │
//   │ Engine: Edge-TTS Neural · 🇳🇬 NG · STANDARD+   [Country: All ▾]  │
//   │ Voice: [Ezinne (NG female) ▾]   [Test ▶]                        │   ← model dropdown + country filter
//   │ Speed: 0.5 ━━●━━ 2.0     [See more ▸]                          │   ← speed + see real-model-names
//   └─────────────────────────────────────────────────────────────────┘
//
// Branding rule: tier labels (GHS Standard etc.) shown by default. Real model
// names hidden behind "See more" — per Henry's "BEFORE LAUNCH I WILL LOCK IT".

import { useMemo, useState } from "react";
import {
  VOICE_REGISTRY,
  TIER_ORDER,
  type GhsVoiceTier,
  type VoiceEntry,
  tierLabel,
  getVoicesByTier,
  defaultVoiceForTier,
  isFreeTier,
} from "../../src/lib/voice-registry";

// Legacy compat — existing callers (video-trimmer, video-finishing, video-editor)
// pass a {tier, voiceId, speed} config. Preserve that shape.
export type VoiceTier = "standard" | "pro" | "premium";
export interface VoiceTierConfig {
  tier: VoiceTier | GhsVoiceTier;
  voiceId?: string;
  speed?: number;
}

interface VoiceTierSelectorProps {
  value: VoiceTierConfig;
  onChange: (config: VoiceTierConfig) => void;
  compact?: boolean;
  // Phase 5 hook — when set to "free", PAID tiers (Pro/Premium/Best) show a lock + upgrade CTA
  userTier?: "free" | "paid";
}

const border = "#1e2a35";
const muted = "#5a7080";
const s2 = "#0d111c";

const TIER_COLORS: Record<GhsVoiceTier, string> = {
  "standard":      "#22c55e",
  "standard-plus": "#10b981",
  "pro":           "#a855f7",
  "premium":       "#00d4ff",
  "best":          "#f59e0b",
};

const TIER_BADGES: Record<GhsVoiceTier, string> = {
  "standard":      "FREE",
  "standard-plus": "FREE+",
  "pro":           "PRO",
  "premium":       "PREMIUM",
  "best":          "BEST",
};

// Map legacy tier ids (standard/pro/premium) to new registry ids.
function normalizeTier(t: VoiceTier | GhsVoiceTier): GhsVoiceTier {
  return t as GhsVoiceTier; // identical strings — TS just wants the narrower type
}

export default function VoiceTierSelector({ value, onChange, compact, userTier = "paid" }: VoiceTierSelectorProps) {
  const [showModels, setShowModels] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>("ALL");

  const currentTier = normalizeTier(value.tier);
  const tierColor = TIER_COLORS[currentTier] ?? TIER_COLORS["standard"];

  // Voices for the currently selected tier, optionally filtered by country.
  const tierVoices: VoiceEntry[] = useMemo(() => {
    let voices = getVoicesByTier(currentTier);
    if (countryFilter !== "ALL") voices = voices.filter(v => v.country === countryFilter);
    return voices;
  }, [currentTier, countryFilter]);

  // Country dropdown options derived from the registry — only countries that have voices.
  const countries = useMemo(() => {
    const seen = new Set<string>();
    for (const v of VOICE_REGISTRY) seen.add(v.country);
    return Array.from(seen).sort();
  }, []);

  // Resolve the selected voice entry (or fall back to first in tier).
  const selectedVoice: VoiceEntry =
    (value.voiceId && tierVoices.find(v => v.id === value.voiceId)) ||
    tierVoices[0] ||
    defaultVoiceForTier(currentTier);

  function pickTier(t: GhsVoiceTier) {
    if (userTier === "free" && !isFreeTier(t)) {
      // Phase 5: show upgrade modal. For now, just ignore the click.
      return;
    }
    const defaultVoice = defaultVoiceForTier(t);
    onChange({ tier: t, voiceId: defaultVoice.id, speed: value.speed });
  }

  function pickVoice(voiceId: string) {
    onChange({ ...value, voiceId });
  }

  return (
    <div style={{ marginBottom: compact ? 8 : 16 }}>
      {!compact && (
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: muted, marginBottom: 8 }}>
          Voice Engine
        </p>
      )}

      {/* Tier pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {TIER_ORDER.map(t => {
          const c = TIER_COLORS[t];
          const isActive = currentTier === t;
          const isLocked = userTier === "free" && !isFreeTier(t);
          return (
            <button
              key={t}
              onClick={() => pickTier(t)}
              disabled={isLocked}
              title={isLocked ? "Upgrade to use this tier" : ""}
              style={{
                flex: "1 1 0", minWidth: 72,
                padding: compact ? "6px 4px" : "8px 6px",
                borderRadius: 8,
                border: `1px solid ${isActive ? c : border}`,
                background: isActive ? `${c}12` : "transparent",
                cursor: isLocked ? "not-allowed" : "pointer",
                opacity: isLocked ? 0.45 : 1,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 9, fontWeight: 700, color: isActive ? c : "#4a6070", letterSpacing: 0.5, margin: 0 }}>
                {tierLabel(t)} {isLocked && "🔒"}
              </p>
              <p style={{ fontSize: 8, color: isActive ? c + "99" : "#2a3a45", margin: "1px 0 0" }}>
                {TIER_BADGES[t]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Country filter + selected engine info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: s2, border: `1px solid ${border}`, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: tierColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#9aafb8", whiteSpace: "nowrap" }}>
            {selectedVoice.displayName}
          </span>
          <span style={{ fontSize: 9, background: `${tierColor}20`, color: tierColor, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
            {TIER_BADGES[currentTier]}
          </span>
          <span style={{ fontSize: 9, color: muted }}>{selectedVoice.country}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            style={{ background: "transparent", color: muted, border: `1px solid ${border}`, borderRadius: 4, padding: "2px 6px", fontSize: 10 }}
          >
            <option value="ALL">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => setShowModels(v => !v)}
            style={{ fontSize: 9, color: muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            {showModels ? "Hide" : "See more"}
          </button>
        </div>
      </div>

      {/* Per-tier voice dropdown (the "edit inside tier" Henry asked for) */}
      {tierVoices.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Voice</p>
          <select
            value={selectedVoice.id}
            onChange={e => pickVoice(e.target.value)}
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 10px", color: "#e0e8f0", fontSize: 11 }}
          >
            {tierVoices.map(v => {
              const gender = v.gender === "female" ? "♀" : v.gender === "male" ? "♂" : "";
              // Henry 2026-06-05: show tone + age so user picks BEFORE listening.
              const tone = v.tone ? ` [${v.tone}]` : "";
              const age = v.ageType && v.ageType !== "adult" ? ` (${v.ageType})` : "";
              const note = v.notes ? ` — ${v.notes}` : "";
              return (
                <option key={v.id} value={v.id}>
                  {v.displayName} · {v.country} {gender}{tone}{age}{note}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Expanded "see more" panel — shows real model names + cost */}
      {showModels && (
        <div style={{ marginTop: 6, borderRadius: 8, border: `1px solid ${border}`, background: "#080b10", padding: "10px 12px" }}>
          {TIER_ORDER.map(t => {
            const voices = getVoicesByTier(t);
            const c = TIER_COLORS[t];
            return (
              <div key={t} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: c, marginBottom: 4 }}>
                  {tierLabel(t)} — {voices.length} voices — {voices[0]?.provider ?? "n/a"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {voices.map(v => (
                    <span key={v.id} style={{ fontSize: 8, background: `${c}10`, border: `1px solid ${c}30`, color: c + "cc", borderRadius: 4, padding: "2px 6px" }} title={`${v.modelId} — $${v.pricePerMin.toFixed(3)}/min`}>
                      {v.displayName} ({v.country})
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 8, color: "#3a5060", marginTop: 3 }}>
                  ${voices[0]?.pricePerMin.toFixed(3) ?? "0.000"}/min · {voices[0]?.provider}
                </p>
              </div>
            );
          })}
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
            style={{ flex: 1, accentColor: tierColor }}
          />
          <span style={{ fontSize: 9, color: muted, minWidth: 26 }}>{(value.speed ?? 1).toFixed(1)}×</span>
        </div>
      )}
    </div>
  );
}

// ── Helper: call TTS with tier config ────────────────────────────────────────
// Resolves the selected voice from the registry and dispatches via /api/tts.
// Kept for backward compatibility with existing callers (video-trimmer etc.).
export async function generateTTS(text: string, config: VoiceTierConfig): Promise<{ audioUrl: string; engine: string } | null> {
  try {
    const voiceEntry = config.voiceId
      ? VOICE_REGISTRY.find(v => v.id === config.voiceId)
      : defaultVoiceForTier(normalizeTier(config.tier));
    const provider = voiceEntry?.provider ?? "piper";
    const modelId = voiceEntry?.modelId;

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        provider,
        voiceId: modelId,
        speed: config.speed,
      }),
    });
    const data = await res.json() as { audioUrl?: string; engine?: string; error?: string };
    if (data.audioUrl) return { audioUrl: data.audioUrl, engine: data.engine ?? provider };
    return null;
  } catch {
    return null;
  }
}
