"use client";

// Sound & SFX tab — 5-tier sound model selector, narrator voice (VoiceTierSelector),
// AI Audio Plan, per-character voices, music tier, SFX auto-mode.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 2.1, 2026-06-05).

import * as React from "react";
import { ds } from "../../../../lib/designSystem";
import VoiceTierSelector, { type VoiceTierConfig } from "../../../components/VoiceTierSelector";

// ── Structural types (kept inline; identical shape to parent's locals) ──
export interface SoundTierEntry { id: string; label: string; desc: string; cost: string; providerKey: string }
export interface ChildSoundCharacter { id: string; characterId?: string; name: string; imageUrl?: string | null }
export interface ChildSoundCharacterIdentity { characterId: string; displayName: string; imageUrl?: string | null }
export interface ChildSoundAudioPlan { narrationScript?: string; musicMood?: string; sfxList?: string[]; ambienceList?: string[] }
export interface ChildSoundScriptSeg { type: "narration" | "dialogue"; text: string }
export interface ChildSoundScene { scene: number; title: string }

type NarrationProvider = "piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "edge-tts" | "gtts" | "gemini" | "fal-f5" | "fal-xtts" | "fal-bark";

export interface SoundTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  muted: string;
  childAccent: string;
  childSafe: string;
  C4: string;
  // Sound model
  SOUND_TIERS: ReadonlyArray<SoundTierEntry>;
  effectiveSoundTier: string;
  setSoundTier: (id: string) => void;
  setModelSettings: React.Dispatch<React.SetStateAction<{ soundModel: string } & Record<string, unknown>>>;
  patchProjectSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  // Script status
  scriptSegments: ChildSoundScriptSeg[];
  setActiveTab: (t: "script") => void;
  // Voice tier
  voiceTierConfig: VoiceTierConfig;
  setVoiceTierConfig: (c: VoiceTierConfig) => void;
  userVoiceTier: "free" | "paid";
  getVoiceById: (id: string) => { provider?: string } | undefined;
  setNarrationProvider: React.Dispatch<React.SetStateAction<NarrationProvider>>;
  // Narration speed + audio
  narrationSpeed: number;
  setNarrationSpeed: (v: number) => void;
  narrationGenerating: boolean;
  textContent: string;
  generateNarration: () => void | Promise<void>;
  narratorAudioUrl: string | null;
  // AI Audio Plan
  runningAudioPlan: boolean;
  childScenes: ChildSoundScene[];
  audioPlans: Record<number, ChildSoundAudioPlan>;
  runChildrenAudioPlan: () => void | Promise<void>;
  // Character voices
  savedChars: ChildSoundCharacter[];
  selectedCharIds: string[];
  characters: ChildSoundCharacterIdentity[];
  characterVoices: Record<string, string>;
  setCharacterVoices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // Music
  musicTier: "stock" | "ghs_pro" | "ghs_classic";
  setMusicTier: (t: "stock" | "ghs_pro" | "ghs_classic") => void;
  musicGenerating: boolean;
  generateChildrenMusic: () => void | Promise<void>;
  generatedMusicUrl: string | null;
  musicFallbackReason: string | null;
  // SFX
  autoSfx: boolean;
  setAutoSfx: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SoundTab(props: SoundTabProps) {
  const {
    cardStyle, muted, childAccent, childSafe, C4,
    SOUND_TIERS, effectiveSoundTier, setSoundTier, setModelSettings, patchProjectSettings,
    scriptSegments, setActiveTab,
    voiceTierConfig, setVoiceTierConfig, userVoiceTier, getVoiceById, setNarrationProvider,
    narrationSpeed, setNarrationSpeed, narrationGenerating, textContent, generateNarration, narratorAudioUrl,
    runningAudioPlan, childScenes, audioPlans, runChildrenAudioPlan,
    savedChars, selectedCharIds, characters, characterVoices, setCharacterVoices,
    musicTier, setMusicTier, musicGenerating, generateChildrenMusic, generatedMusicUrl, musicFallbackReason,
    autoSfx, setAutoSfx,
  } = props;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Sound & SFX</h2>
      </div>

      {/* ── 5-Tier Sound Model Selector (binding) ── */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${childAccent}40`, background: `${childAccent}06` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 4 }}>Sound Model</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Select audio quality tier for this project. Higher tiers = better quality + higher cost.</p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {SOUND_TIERS.map(tier => (
            <button key={tier.id} onClick={() => { setSoundTier(tier.id); setModelSettings(p => ({ ...p, soundModel: tier.id })); patchProjectSettings({ soundTier: tier.id }).catch(() => {}); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, border: `2px solid ${effectiveSoundTier === tier.id ? childAccent : ds.color.line}`, background: effectiveSoundTier === tier.id ? `${childAccent}12` : "transparent", cursor: "pointer", textAlign: "left" as const }}>
              <div>
                <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: effectiveSoundTier === tier.id ? childAccent : "#fff" }}>{tier.label}</span>
                <span style={{ display: "block", fontSize: 10, color: muted, marginTop: 2 }}>{tier.desc}</span>
              </div>
              <span style={{ fontSize: 10, color: effectiveSoundTier === tier.id ? childAccent : muted, fontFamily: ds.font.mono, flexShrink: 0, marginLeft: 8 }}>{tier.cost}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Script status (parse in Script tab) ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Script Status</p>
        {scriptSegments.length === 0 ? (
          <div>
            <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Parse your story into narrator and character lines in the Script tab first.</p>
            <button onClick={() => setActiveTab("script")}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: childAccent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Go to Script & Story Plan
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 11, color: childSafe }}>
            {scriptSegments.filter(s => s.type === "narration").length} narrator + {scriptSegments.filter(s => s.type === "dialogue").length} character lines parsed
          </p>
        )}
      </div>

      {/* ── Voice Layers ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Voice Layers</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Layer 1 = Narrator (default: Piper free). Additional layers add secondary voice tracks.</p>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: "#fff", fontWeight: 600, marginBottom: 6 }}>Layer 1 — Narrator</p>
          <VoiceTierSelector
            value={voiceTierConfig}
            userTier={userVoiceTier}
            onChange={(c) => {
              setVoiceTierConfig(c);
              const voice = c.voiceId ? getVoiceById(c.voiceId) : undefined;
              const rawProvider: string = voice?.provider ?? "piper";
              const mapped = (rawProvider === "fal-kokoro" ? "fal-narrator" : rawProvider) as NarrationProvider;
              setNarrationProvider(mapped);
              setNarrationSpeed(c.speed ?? 1);
              patchProjectSettings({ narrationProvider: mapped }).catch(() => {});
            }}
            compact
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: muted }}>Speed</span>
              <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{narrationSpeed.toFixed(2)}x</span>
            </div>
            <input type="range" min={0.5} max={2.0} step={0.05} value={narrationSpeed}
              onChange={e => setNarrationSpeed(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: childSafe }} />
          </div>
        </div>
        <button onClick={generateNarration} disabled={narrationGenerating || !textContent?.trim()}
          style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: narrationGenerating ? "#2a2040" : childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: (narrationGenerating || !textContent?.trim()) ? "not-allowed" : "pointer", opacity: !textContent?.trim() ? 0.5 : 1 }}>
          {narrationGenerating ? "Generating narration..." : "Generate Narration"}
        </button>
        {narratorAudioUrl && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Narrator audio:</p>
            <audio src={narratorAudioUrl} controls style={{ width: "100%", height: 32 }} />
          </div>
        )}
      </div>

      {/* ── AI Audio Plan ── */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${childAccent}40` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 4 }}>AI Audio Plan</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>
          AI reads every scene and writes a narration script, picks a music mood, and suggests SFX + ambience.
          Makes the final video sound alive without manual entry per scene.
        </p>
        <button onClick={runChildrenAudioPlan} disabled={runningAudioPlan || childScenes.length === 0}
          style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: runningAudioPlan ? "#2a2040" : childAccent, color: "#000", fontSize: 11, fontWeight: 700, cursor: (runningAudioPlan || childScenes.length === 0) ? "not-allowed" : "pointer", opacity: childScenes.length === 0 ? 0.5 : 1 }}>
          {runningAudioPlan ? "AI planning audio..." : Object.keys(audioPlans).length > 0 ? "Re-run AI Audio Plan" : "Run AI Audio Plan"}
        </button>
        {childScenes.length === 0 && (
          <p style={{ fontSize: 10, color: muted, marginTop: 8 }}>Build scenes first (Scene Board tab).</p>
        )}
        {Object.keys(audioPlans).length > 0 && !runningAudioPlan && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: childSafe, marginBottom: 8 }}>
              ✓ {Object.keys(audioPlans).length} scene{Object.keys(audioPlans).length === 1 ? "" : "s"} planned
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {childScenes.slice(0, 8).map(s => {
                const plan = audioPlans[s.scene];
                if (!plan) return null;
                return (
                  <div key={s.scene} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: `1px solid ${ds.color.line}` }}>
                    <p style={{ fontSize: 10, color: "#fff", fontWeight: 700, margin: 0 }}>SC{String(s.scene).padStart(2, "0")} · {s.title.slice(0, 40)}</p>
                    {plan.musicMood && <p style={{ fontSize: 9, color: muted, margin: "3px 0 0" }}>Music: {plan.musicMood}</p>}
                    {plan.sfxList && plan.sfxList.length > 0 && <p style={{ fontSize: 9, color: muted, margin: "2px 0 0" }}>SFX: {plan.sfxList.slice(0, 4).join(", ")}</p>}
                    {plan.narrationScript && <p style={{ fontSize: 9, color: childSafe, margin: "3px 0 0", fontStyle: "italic" }}>&quot;{plan.narrationScript.slice(0, 100)}{plan.narrationScript.length > 100 ? "..." : ""}&quot;</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Character Voices — only actors in THIS project ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Character Voices</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Assign a voice to each actor character for their dialogue lines.</p>
        {(() => {
          const projectChars = savedChars.filter(c => selectedCharIds.includes(c.id));
          const inlineChars = characters.filter(c => !projectChars.some(p => p.characterId === c.characterId));
          const allActors = [
            ...projectChars.map(c => ({ id: c.id, name: c.name, imageUrl: c.imageUrl || null })),
            ...inlineChars.map(c => ({ id: c.characterId, name: c.displayName, imageUrl: c.imageUrl || null })),
          ];
          if (allActors.length === 0) {
            return (
              <div style={{ padding: "12px 0", textAlign: "center" as const }}>
                <p style={{ fontSize: 11, color: muted }}>No actor characters added to this project yet.</p>
                <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Add characters in the Characters tab, then assign their dialogue voices here.</p>
              </div>
            );
          }
          return allActors.map(char => (
            <div key={char.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${ds.color.line}` }}>
              {char.imageUrl
                ? <img src={char.imageUrl} alt={char.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${childAccent}30`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, color: childAccent, fontWeight: 700 }}>{char.name[0]}</span></div>
              }
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", flex: 1 }}>{char.name}</span>
              <select value={characterVoices[char.id] || "en_US-lessac-medium"}
                onChange={e => setCharacterVoices(prev => ({ ...prev, [char.id]: e.target.value }))}
                style={{ flex: 2, background: ds.color.paper, border: `1px solid ${ds.color.line}`, borderRadius: 8, padding: "5px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
                <option value="en_US-lessac-medium">Lessac (Neutral Male)</option>
                <option value="en_US-amy-medium">Amy (Neutral Female)</option>
                <option value="en_US-ryan-high">Ryan (Male)</option>
                <option value="en_GB-alan-medium">Alan (British Male)</option>
                <option value="en_US-libritts_r-medium">LibriTTS (Expressive)</option>
                <option value="en_US-kathleen-low">Kathleen (Female, Low)</option>
                <option value="en_US-danny-low">Danny (Male, Low)</option>
                <option value="en_US-joe-medium">Joe (Male, Warm)</option>
              </select>
            </div>
          ));
        })()}
      </div>

      {/* ── Music ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Background Music</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Generate child-safe background music for this story.</p>

        <p style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 8 }}>Music Source</p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 12 }}>
          <button data-testid="music-tier-stock" onClick={() => setMusicTier("stock")}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "stock" ? "#a78bfa" : "rgba(255,255,255,0.07)"}`, background: musicTier === "stock" ? "rgba(167,139,250,0.1)" : "#151518", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "stock" ? "#a78bfa" : "#c5c5c8" }}>GHS Standard</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Stock Library — always available</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7ae0c3", fontFamily: "'JetBrains Mono', monospace", background: "rgba(122,224,195,0.08)", border: "1px solid rgba(122,224,195,0.2)", borderRadius: 4, padding: "2px 6px" }}>FREE</span>
          </button>
          <button data-testid="music-tier-ghs-pro" onClick={() => setMusicTier("ghs_pro")}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "ghs_pro" ? "#7cc4ff" : "rgba(255,255,255,0.07)"}`, background: musicTier === "ghs_pro" ? "rgba(124,196,255,0.08)" : "#151518", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_pro" ? "#7cc4ff" : "#c5c5c8" }}>GHS Pro</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>FAL Stable Audio — instrumental, up to 47s</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7cc4ff", fontFamily: "'JetBrains Mono', monospace", background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 4, padding: "2px 6px" }}>MID</span>
          </button>
          <button data-testid="music-tier-ghs-classic" onClick={() => setMusicTier("ghs_classic")}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "ghs_classic" ? "#ff9a3c" : "rgba(255,255,255,0.07)"}`, background: musicTier === "ghs_classic" ? "rgba(255,154,60,0.08)" : "#151518", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_classic" ? "#ff9a3c" : "#c5c5c8" }}>GHS Classic</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Suno via Kie.ai — full lyrical songs</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9a3c", fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,154,60,0.08)", border: "1px solid rgba(255,154,60,0.2)", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" as const }}>PREMIUM</span>
          </button>
        </div>

        <button onClick={generateChildrenMusic} disabled={musicGenerating}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: musicGenerating ? "#2a2040" : C4, color: "#000", fontSize: 12, fontWeight: 700, cursor: musicGenerating ? "not-allowed" : "pointer" }}>
          {musicGenerating ? "Generating music..." : "Generate Background Music"}
        </button>
        {generatedMusicUrl && (
          <div style={{ marginTop: 10 }}>
            <audio src={generatedMusicUrl} controls style={{ width: "100%", height: 32 }} />
            {musicFallbackReason && <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>{musicFallbackReason}</p>}
          </div>
        )}
      </div>

      {/* ── SFX ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Sound Effects</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: muted }}>Auto-mode picks CC0 sounds for each scene mood.</p>
          <button onClick={() => setAutoSfx(v => !v)}
            style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${autoSfx ? childSafe + "60" : ds.color.line}`, background: autoSfx ? `${childSafe}18` : "transparent", color: autoSfx ? childSafe : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Auto SFX: {autoSfx ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  );
}
