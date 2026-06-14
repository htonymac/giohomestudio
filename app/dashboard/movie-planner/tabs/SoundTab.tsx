"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SoundTab — voice, music, SFX, narration controls for movie-planner.
//
// SECTIONS (top → bottom):
//   1. Header row — Parse Script · Import Music · Auto Audio Plans buttons
//   2. GHS Sound Tier selector (4 cards from GHS_SOUND_TIERS)
//   3. Character Voice Assignments (Multi-Cast Dialogue + Audition per cast)
//   4. 5-Tier Sound Model selector (binding — SOUND_TIERS_MOVIE)
//   5. Narration Provider pill row (6 providers)
//   6. Auto SFX toggle
//   7. SFX Library (Freesound search + AI-SFX generate)
//   8. Music Library (tier select + AI Pick + Browse Library)
//   9. Per-scene audio editor (Narration / Music Cue / SFX inputs + 6 polish ops)
//
// All async actions and large stateful logic live INSIDE this file as closures
// because they each reference ~6-12 pieces of parent state at once and pulling
// them out as parent-supplied callbacks would multiply prop noise without
// behavior win. The parent owns the state — this file is a fat presentational
// component, same pattern as AssemblyTab.
//
// Why no extraction beyond Wave 2.3: the inline async closures use parent
// setters directly (setSceneDialogueAudio, setSceneVideos, setLipsyncingScenes)
// to keep optimistic UI snappy. Wrapping them as callbacks loses that.
//
// Parent contract: parent MUST pass every prop in SoundTabProps. The tab does
// NOT call /api/free-mode or any free-mode-specific endpoint — it only talks to
// /api/tts, /api/dialogue/{parse,generate}, /api/narration/generate,
// /api/avatar/lip-sync, /api/hybrid/narrate-piper, /api/freesound/* and the
// movie-planner project-settings patcher.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";
import NarrationControls, { type NarrationSettings } from "../../../components/NarrationControls";
import { GHS_SOUND_TIERS, getSoundTier, soundTierToMCDConfig, type GhsSoundTierId } from "@/lib/ghs-sound-tiers";
import type { MusicAsset } from "../../../utils/mediaUrl";
import { NarrationPreview } from "../../../components/NarrationPreview";

// ── Types kept local — these mirror the parent's interfaces. Duplicated on
//    purpose so the tab file is readable in isolation by a junior dev. ──

interface Character {
  id: string;
  name: string;
  role: string;
  description?: string;
  imageUrl?: string;
  characterId?: string;
  voiceName?: string;
}

interface SceneCard {
  scene: number;
  title: string;
  goal: string;
  duration: string;
  characters: string[];
  visualDescription: string;
  cameraDirection: string;
  dialogue: string;
  soundEffects: string;
  ambience: string;
  musicCue: string;
  generationMethod: "image" | "video" | "image-to-video" | "audio-only" | "hybrid";
  costLabel: "cheap" | "balanced" | "premium";
  status: "planned" | "approved" | "generating" | "generated" | "needs_edit" | "blocked";
  generatedAssetUrl?: string;
}

interface MoviePlan {
  summary: string;
  storyArc: { setup: string; tension: string; climax: string; resolution: string };
  scenes: SceneCard[];
  soundPlan: string;
  musicDirection: string;
  visualDirection: string;
  continuityNotes: string[];
  missingAssets: string[];
  reviewerNotes: string[];
  estimatedCredits: number;
}

// ── SOUND_TIERS_MOVIE id type — must mirror parent's `SoundTierMovieId`.
//    Parent passes both the constant array AND the bridge fn so we don't
//    have to re-declare them here. ──
type SoundTierMovieId = "piper" | "ghs_karaoke" | "fal_karaoke" | "kie_classic" | "kie_premium";
type SoundTierMovieEntry = { id: SoundTierMovieId; label: string; desc: string; cost: string; providerKey: string };

// ── Narration provider type — mirrors parent's union. ──
type NarrationProvider = "piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "edge-tts" | "gemini" | "fal-f5" | "fal-xtts" | "fal-bark" | "gtts";

interface FreesoundResult {
  id: number;
  name: string;
  duration: number;
  license: string;
  licenseType?: string;
  safeForCommercial?: boolean;
  username: string;
  previewUrl: string;
  tags: string[];
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface SoundTabProps {
  /** Workshop tab switcher — used to jump back to "design" when no scenes exist. */
  setActiveTab: (tab: "design" | "story" | "script" | "sound" | "characters" | "scenes" | "assembly" | "overview") => void;

  // ── Header buttons ──
  /** Parses screenplay to extract per-character dialogue. Disabled when no screenplay. */
  parseScript: () => void;
  parsingScript: boolean;
  /** Raw screenplay text from Script tab. Empty disables Parse Script. */
  screenplay: string;
  /** Movie plan (used by Auto Audio Plans to backfill missing musicCue/sound/dialogue). */
  moviePlan: MoviePlan | null;
  /** Tone constant from Design tab — used as default music cue fallback. */
  tone: string;
  /** Mutates one scene's fields by scene number. Parent owns the source of truth. */
  updateScene: (sceneNumber: number, updates: Partial<SceneCard>) => void;
  /** Sets the status-bar one-liner shown at the bottom of the page. */
  setLastAction: (msg: string) => void;

  // ── GHS Sound Tier card grid ──
  /** Resolved narration provider — falls back to project settings if set. */
  effectiveNarrationProvider: NarrationProvider;
  setNarrationProvider: React.Dispatch<React.SetStateAction<NarrationProvider>>;
  /** Persists settings to the DB via patcher. Fire-and-forget. */
  patchProjectSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  // ── Edge Neural narrator voice (2026-06-13) ──
  /** Raw Edge voice id for narrator (no "edge:" prefix). Used when effectiveNarrationProvider === "edge-tts". */
  edgeTtsVoiceId: string;
  setEdgeTtsVoiceId: React.Dispatch<React.SetStateAction<string>>;
  /** Ref that flips to true when the user manually picks a narrator voice. Prevents region auto-snap from overriding. */
  narratorVoiceManualRef: React.RefObject<boolean>;
  /** Edge narrator voice list for the sub-picker dropdown. */
  edgeNarratorVoices: ReadonlyArray<{ id: string; label: string }>;

  // ── Character voice assignments ──
  /** Cast = ordered list of cast members + role. */
  selectedCast: Array<{ characterId: string; role: string }>;
  /** All characters the user has saved — used to look up name/image/voice. */
  savedCharacters: Character[];
  /** characterId → ElevenLabs voiceId override map. */
  castVoiceMap: Record<string, string>;
  setCastVoiceMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  generatingPerLineVoices: boolean;
  setGeneratingPerLineVoices: React.Dispatch<React.SetStateAction<boolean>>;
  /** All scenes (parent computes from moviePlan.scenes or fallback). */
  scenes: SceneCard[];
  /** Active project ID — needed for per-line narrate-piper persistence. */
  projectId: string | null;
  /** Resolved 5-tier sound model — used as MCD bridge into ghs-sound-tiers. */
  effectiveSoundTier: SoundTierMovieId;
  /** Multi-cast dialogue audio: sceneNumber → audioUrl. */
  sceneDialogueAudio: Record<number, string>;
  setSceneDialogueAudio: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  /** Scene videos for lip-sync: sceneId ("SC01") → videoUrl. */
  sceneVideos: Record<string, string>;
  setSceneVideos: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Set of scene numbers currently running lip-sync — disables their button. */
  lipsyncingScenes: Set<number>;
  setLipsyncingScenes: React.Dispatch<React.SetStateAction<Set<number>>>;

  // ── 5-Tier Sound Model selector ──
  SOUND_TIERS_MOVIE: ReadonlyArray<SoundTierMovieEntry>;
  /** Bridges old SoundTierMovieId → canonical GhsSoundTierId. Parent passes it because the
   *  movie-planner page also uses it for non-Sound contexts. */
  movieTierToGhsSoundTierId: (id: SoundTierMovieId) => GhsSoundTierId;
  setSoundTier: (id: SoundTierMovieId) => void;
  setModelSettings: React.Dispatch<React.SetStateAction<{
    storyLLM: string;
    charImageModel: string;
    sceneVideoModel: string;
    soundModel: SoundTierMovieId;
  }>>;
  /** Which tier's ⓘ popover is open. null = all closed. */
  openTierInfo: SoundTierMovieId | null;
  setOpenTierInfo: React.Dispatch<React.SetStateAction<SoundTierMovieId | null>>;

  // ── Auto SFX toggle ──
  autoSfx: boolean;
  setAutoSfx: React.Dispatch<React.SetStateAction<boolean>>;

  // ── SFX Library (Freesound + AI-SFX) ──
  soundTab: "freesound" | "ai-sfx";
  setSoundTab: React.Dispatch<React.SetStateAction<"freesound" | "ai-sfx">>;
  fsNoKey: boolean;
  fsQuery: string;
  setFsQuery: React.Dispatch<React.SetStateAction<string>>;
  searchFreesound: (q?: string) => void;
  fsSearching: boolean;
  fsResults: FreesoundResult[];
  fsSaved: Set<number>;
  fsSaving: number | null;
  saveFreesound: (sound: FreesoundResult) => void;
  sfxPreviewId: number | string | null;
  setSfxPreviewId: React.Dispatch<React.SetStateAction<number | string | null>>;
  sfxDesc: string;
  setSfxDesc: React.Dispatch<React.SetStateAction<string>>;
  generateElevenLabsSfx: () => void;
  sfxGenerating: boolean;
  sfxGeneratedUrl: string | null;

  // ── Music Library ──
  musicTier: "stock" | "ghs_pro" | "ghs_classic";
  setMusicTier: React.Dispatch<React.SetStateAction<"stock" | "ghs_pro" | "ghs_classic">>;
  generateMovieMusic: () => void;
  musicGenerating: boolean;
  aiPickMusic: () => void;
  aiPickingMusic: boolean;
  showMusicPicker: boolean;
  setShowMusicPicker: React.Dispatch<React.SetStateAction<boolean>>;
  musicLibrary: MusicAsset[];
  loadMusicLibrary: () => void;
  loadingMusic: boolean;
  selectedMusicUrl: string | null;
  setSelectedMusicUrl: React.Dispatch<React.SetStateAction<string | null>>;
  selectedMusicName: string;
  setSelectedMusicName: React.Dispatch<React.SetStateAction<string>>;
  aiMusicPickLog: string;
  setAiMusicPickLog: React.Dispatch<React.SetStateAction<string>>;
  /** Translates asset path → /api/media/... URL. */
  assetToMediaUrl: (filePath: string) => string;

  // ── Per-scene editor ──
  totalScenes: number;
  narrationScene: number | null;
  setNarrationScene: React.Dispatch<React.SetStateAction<number | null>>;
  generateSceneNarration: (scene: SceneCard) => void;
  /** sceneNum → audioUrl — populated after "Generate Audio" is clicked per scene. */
  sceneNarrationAudioUrls: Record<number, string>;
  /** sceneNum → word timings (null for Piper). Drives NarrationPreview subtitle sync. */
  sceneNarrationWordTimings: Record<number, Array<{ word: string; startMs: number; endMs: number }> | null>;
  polishingScene: string | null;
  handlePolishScene: (sceneId: string, currentText: string, action: "polish" | "upgrade" | "add-detail") => void;
  handleSceneOp: (sceneId: string, currentText: string, op: "add_action" | "intense" | "reduce_action" | "emotional" | "establish" | "qc") => void;
  narrationTexts: Record<number, string>;
  setNarrationTexts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  narrationSettings: Record<number, NarrationSettings>;
  setNarrationSettings: React.Dispatch<React.SetStateAction<Record<number, NarrationSettings>>>;
  setErrorMsg: React.Dispatch<React.SetStateAction<string | null>>;

  // ── Style / color tokens (parent passes — keeps theme central). ──
  cardStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  btnPrimary: React.CSSProperties;
  badgeStyle: (color: string) => React.CSSProperties;
  methodColors: Record<string, string>;
  accent: string;
  blue: string;
  gold: string;
  purple: string;
  green: string;
  red: string;
  muted: string;
  border: string;
  s2: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SoundTab(props: SoundTabProps) {
  const {
    setActiveTab,
    parseScript, parsingScript, screenplay,
    moviePlan, tone, updateScene, setLastAction,
    effectiveNarrationProvider, setNarrationProvider, patchProjectSettings,
    edgeTtsVoiceId, setEdgeTtsVoiceId, narratorVoiceManualRef, edgeNarratorVoices,
    selectedCast, savedCharacters, castVoiceMap, setCastVoiceMap,
    generatingPerLineVoices, setGeneratingPerLineVoices,
    scenes, projectId, effectiveSoundTier,
    sceneDialogueAudio, setSceneDialogueAudio,
    sceneVideos, setSceneVideos,
    lipsyncingScenes, setLipsyncingScenes,
    SOUND_TIERS_MOVIE, movieTierToGhsSoundTierId,
    setSoundTier, setModelSettings,
    openTierInfo, setOpenTierInfo,
    autoSfx, setAutoSfx,
    soundTab, setSoundTab,
    fsNoKey, fsQuery, setFsQuery, searchFreesound, fsSearching, fsResults,
    fsSaved, fsSaving, saveFreesound,
    sfxPreviewId, setSfxPreviewId,
    sfxDesc, setSfxDesc, generateElevenLabsSfx, sfxGenerating, sfxGeneratedUrl,
    musicTier, setMusicTier,
    generateMovieMusic, musicGenerating,
    aiPickMusic, aiPickingMusic,
    showMusicPicker, setShowMusicPicker,
    musicLibrary, loadMusicLibrary, loadingMusic,
    selectedMusicUrl, setSelectedMusicUrl,
    selectedMusicName, setSelectedMusicName,
    aiMusicPickLog, setAiMusicPickLog,
    assetToMediaUrl,
    totalScenes, narrationScene, setNarrationScene,
    generateSceneNarration, sceneNarrationAudioUrls, sceneNarrationWordTimings,
    polishingScene, handlePolishScene, handleSceneOp,
    narrationTexts, setNarrationTexts, narrationSettings, setNarrationSettings,
    setErrorMsg,
    cardStyle, inputStyle, btnPrimary, badgeStyle, methodColors,
    accent, blue, gold, purple, green, red, muted, border, s2,
  } = props;

  return (
    <div>
      {/* Header bar — Parse Script · Import Music · Auto Audio Plans */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Audio & Shots</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button onClick={parseScript} disabled={parsingScript || !screenplay}
            style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${blue}30`, background: `${blue}06`, color: blue, fontSize: 11, fontWeight: 600, cursor: (parsingScript || !screenplay) ? "not-allowed" : "pointer", opacity: !screenplay ? 0.5 : 1 }}
            title={!screenplay ? "Write screenplay first in the Script tab" : "Parse screenplay to extract dialogue per character"}>
            {parsingScript ? "Parsing..." : "Parse Script"}
          </button>
          <a href="/dashboard/sfx-library?selectMode=music&returnTo=movie-planner" style={{ textDecoration: "none" }}>
            <button style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${accent}30`, background: `${accent}06`, color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Import Music
            </button>
          </a>
          <button onClick={() => {
            if (!moviePlan) return;
            // Backfill missing audio fields on every scene with sensible defaults.
            moviePlan.scenes.forEach(s => {
              const updates: Partial<SceneCard> = {};
              if (!s.musicCue) updates.musicCue = tone || "cinematic";
              if (!s.soundEffects) updates.soundEffects = s.ambience || "ambient";
              if (!s.dialogue) updates.dialogue = s.goal || s.visualDescription || "";
              if (Object.keys(updates).length > 0) updateScene(s.scene, updates);
            });
            setLastAction("Auto audio plans applied to all scenes");
          }}
            style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${gold}30`, background: `${gold}06`, color: gold, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Auto Audio Plans
          </button>
        </div>
      </div>

      {/* ── SC: GHS Sound Tier Selector (4 cards from ghs-sound-tiers) ── */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${purple}30` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Voice & Sound Tier</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>4 tiers — GHS Sound (free) → GHS Premium (Kie Suno). All royalty-free.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
          {GHS_SOUND_TIERS.map((tier) => {
            const tierColor = tier.id === "ghs-sound" ? accent : tier.id === "ghs-plus" ? blue : tier.id === "ghs-pro" ? purple : gold;
            // 2026-06-13: ghs-sound = edge-tts (was piper). Keep piper as legacy fallback match too.
            const isSelected = effectiveNarrationProvider === tier.provider
              || (tier.id === "ghs-sound" && (effectiveNarrationProvider === "edge-tts" || effectiveNarrationProvider === "piper"));
            return (
              <button key={tier.id} onClick={() => {
                // Map tier → narration provider.
                // 2026-06-13: ghs-sound now defaults to edge-tts (free Edge Neural),
                // not piper — mirrors hybrid-planner. User can still switch to piper
                // via the Narration Provider pill row below.
                const provMap: Record<string, "edge-tts" | "piper" | "fal-narrator" | "elevenlabs" | "karaoke"> = {
                  "ghs-sound": "edge-tts", "ghs-plus": "karaoke", "ghs-pro": "karaoke", "ghs-premium": "karaoke",
                };
                const resolvedProvider = provMap[tier.id] ?? "edge-tts";
                setNarrationProvider(resolvedProvider);
                patchProjectSettings({ narrationProvider: resolvedProvider }).catch(() => {});
                setLastAction(`Sound tier: ${tier.label}`);
              }}
                style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-start", gap: 3, padding: "10px 12px", borderRadius: 10, border: `2px solid ${isSelected ? tierColor : border}`, background: isSelected ? `${tierColor}10` : "transparent", cursor: "pointer", textAlign: "left" as const }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? tierColor : "#fff" }}>{tier.label}</span>
                <span style={{ fontSize: 9, color: muted, lineHeight: 1.3 }}>{tier.description}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: tier.isFree ? accent : gold, fontFamily: "monospace", marginTop: 2 }}>{tier.isFree ? "FREE" : tier.requiresKey ? tier.requiredKey : "PAID"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SC: Character Voice Assignments ── */}
      {selectedCast.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${blue}30` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Character Voices</p>
              <p style={{ fontSize: 10, color: muted }}>Assign ElevenLabs voice ID per cast member for per-line dialogue generation.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {/* Legacy single-voice button — kept for fallback. Multi-Cast below is preferred. */}
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 2 }}>
                <button
                  onClick={async () => {
                    setGeneratingPerLineVoices(true);
                    setLastAction("Generating per-line voices for all cast...");
                    try {
                      for (const sc of selectedCast) {
                        const char = savedCharacters.find(c => c.id === sc.characterId);
                        if (!char) continue;
                        const voiceId = castVoiceMap[sc.characterId] || char.characterId || "";
                        const lines = scenes.flatMap(s => s.dialogue ? [{ sceneId: `SC${String(s.scene).padStart(2, "0")}`, text: s.dialogue, speaker: char.name }] : []);
                        if (lines.length === 0 || !voiceId) continue;
                        for (const line of lines) {
                          await fetch("/api/hybrid/narrate-piper", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: line.text, voiceProvider: effectiveNarrationProvider, voiceId, sceneId: line.sceneId, projectId }),
                          }).catch(() => {});
                        }
                      }
                      setLastAction("Per-line voices generated for all cast");
                    } catch (err) {
                      setLastAction(`Per-line voice gen failed: ${err instanceof Error ? err.message : "Unknown"}`);
                    } finally {
                      setGeneratingPerLineVoices(false);
                    }
                  }}
                  disabled={generatingPerLineVoices}
                  title="Old single-voice path — generates each scene's full dialogue blob through one voice per cast. Use Multi-Cast below for proper character voices."
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, fontWeight: 600, cursor: generatingPerLineVoices ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, opacity: 0.7 }}>
                  {generatingPerLineVoices ? "Generating..." : "Generate Per-Line Voices (legacy)"}
                </button>
                <span style={{ fontSize: 8, color: muted, opacity: 0.6, textAlign: "right" as const, maxWidth: 160 }}>Old single-voice path. Replaced by Multi-Cast above for proper character voices.</span>
              </div>
              {/* Multi-Cast Dialogue (Phase 1):
                  For every scene with dialogue text, this:
                    1. Calls /api/dialogue/parse to split blob into speaker-tagged lines.
                    2. Maps each tagged speaker → assigned ElevenLabs voiceId via castVoiceMap.
                    3. Calls /api/dialogue/generate which concats with per-speaker pacing.
                  Then runs auto-lipsync pass on any scene that has a source video. */}
              {(() => {
                // Resolve MCD config from active tier — used in button label + tooltip.
                const _mcdTierId = movieTierToGhsSoundTierId(effectiveSoundTier);
                const _mcdCfg = soundTierToMCDConfig(_mcdTierId);
                const _mcdLabel = `${_mcdCfg.label}, ${_mcdCfg.estCostPer100s}/100s`;
                return (
                  <button
                    onClick={async () => {
                      setGeneratingPerLineVoices(true);
                      setLastAction("Multi-cast dialogue: parsing and generating...");
                      const mcdTierId = movieTierToGhsSoundTierId(effectiveSoundTier);
                      const mcdCfg = soundTierToMCDConfig(mcdTierId);
                      const knownSpeakers = selectedCast
                        .map(sc => savedCharacters.find(c => c.id === sc.characterId)?.name)
                        .filter((n): n is string => !!n);
                      // Track newly generated audio for auto-lipsync pass.
                      const newlyGeneratedDialogue: Array<{ sceneNum: number; sceneId: string; audioUrl: string }> = [];
                      try {
                        let scenesDone = 0;
                        for (const s of scenes) {
                          if (!s.dialogue?.trim()) continue;
                          // Parse speaker-tagged lines.
                          const parseRes = await fetch("/api/dialogue/parse", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: s.dialogue, knownSpeakers, provider: "auto" }),
                          });
                          const parseData = await parseRes.json() as { ok?: boolean; lines?: Array<{ speakerId: string; text: string; emotion?: string }>; error?: string };
                          if (!parseData.ok || !Array.isArray(parseData.lines) || parseData.lines.length === 0) {
                            console.warn(`[multi-cast] parse failed for scene ${s.scene}:`, parseData.error);
                            continue;
                          }
                          // Map speaker → voiceId. Normalize names: trim + lowercase + strip punctuation.
                          // Also handle generic "Cast N" labels → selectedCast[N-1].
                          const norm = (str: string) => str.trim().toLowerCase().replace(/[^\p{L}\d]/gu, "");
                          const lines = parseData.lines.map((l, lineIdx) => {
                            const target = norm(l.speakerId);
                            const genericMatch = target.match(/^cast(\d+)$/);
                            let matchedCast = null;
                            if (genericMatch) {
                              const idx = Math.max(0, parseInt(genericMatch[1]) - 1);
                              matchedCast = selectedCast[idx] || selectedCast[0];
                            } else {
                              matchedCast = selectedCast.find(sc => {
                                const c = savedCharacters.find(ch => ch.id === sc.characterId);
                                return c?.name && norm(c.name) === target;
                              }) || null;
                            }
                            // Last-resort: alternate by line index (better than every line falling to cast[0]).
                            if (!matchedCast) {
                              matchedCast = selectedCast[lineIdx % selectedCast.length] || selectedCast[0];
                            }
                            const voiceId = matchedCast ? (castVoiceMap[matchedCast.characterId] || "") : "";
                            return {
                              speakerId: l.speakerId,
                              voiceId: voiceId || undefined,
                              text: l.text,
                              ...(l.emotion ? { emotion: l.emotion } : {}),
                            };
                          });
                          if (lines.every(l => !l.voiceId)) {
                            setLastAction(`Scene ${s.scene} skipped — no voiceIds set on cast`);
                            continue;
                          }
                          // Generate — use tier's ttsProvider, not the narration provider selector.
                          const genRes = await fetch("/api/dialogue/generate", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              lines,
                              provider: mcdCfg.ttsProvider,
                              sceneIdHint: `SC${String(s.scene).padStart(2, "0")}`,
                            }),
                          });
                          const genData = await genRes.json() as { ok?: boolean; audioUrl?: string; durationMs?: number; error?: string };
                          if (genData.ok && genData.audioUrl) {
                            setSceneDialogueAudio(prev => ({ ...prev, [s.scene]: genData.audioUrl! }));
                            newlyGeneratedDialogue.push({ sceneNum: s.scene, sceneId: `SC${String(s.scene).padStart(2, "0")}`, audioUrl: genData.audioUrl! });
                            scenesDone++;
                          } else {
                            console.warn(`[multi-cast] gen failed for scene ${s.scene}:`, genData.error);
                          }
                        }
                        setLastAction(`Multi-cast dialogue generated for ${scenesDone} scene${scenesDone === 1 ? "" : "s"}`);

                        // Auto-lipsync pass (only when tier specifies it).
                        if (mcdCfg.lipsync !== "off" && newlyGeneratedDialogue.length > 0) {
                          const lipsyncScenes = newlyGeneratedDialogue.filter(d => !!sceneVideos[d.sceneId]);
                          const skipped = newlyGeneratedDialogue.length - lipsyncScenes.length;
                          if (skipped > 0) {
                            console.info(`[auto-lipsync] ${skipped} scene(s) skipped — no source video`);
                          }
                          for (let li = 0; li < lipsyncScenes.length; li++) {
                            const { sceneNum, sceneId, audioUrl } = lipsyncScenes[li];
                            setLastAction(`Auto-lipsync ${li + 1}/${lipsyncScenes.length} (Scene ${sceneNum})...`);
                            setLipsyncingScenes(prev => new Set(prev).add(sceneNum));
                            try {
                              const lsRes = await fetch("/api/avatar/lip-sync", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ imageUrl: sceneVideos[sceneId], audioUrl, inputIsVideo: true }),
                              });
                              const lsData = await lsRes.json() as { videoUrl?: string; provider?: string; error?: string };
                              if (lsData.videoUrl) {
                                setSceneVideos(prev => ({ ...prev, [sceneId]: lsData.videoUrl! }));
                              } else {
                                console.warn(`[auto-lipsync] scene ${sceneNum} failed:`, lsData.error);
                              }
                            } catch (lsErr) {
                              console.warn(`[auto-lipsync] scene ${sceneNum} error:`, lsErr);
                              // Keep original video — do not clear on failure.
                            } finally {
                              setLipsyncingScenes(prev => { const n = new Set(prev); n.delete(sceneNum); return n; });
                            }
                          }
                          if (lipsyncScenes.length > 0) {
                            setLastAction(`Auto-lipsync complete for ${lipsyncScenes.length} scene${lipsyncScenes.length === 1 ? "" : "s"}`);
                          }
                        }
                      } catch (err) {
                        setLastAction(`Multi-cast dialogue failed: ${err instanceof Error ? err.message : "Unknown"}`);
                      } finally {
                        setGeneratingPerLineVoices(false);
                      }
                    }}
                    disabled={generatingPerLineVoices || selectedCast.length === 0}
                    title={`Auto-tag speakers, route to ${_mcdCfg.ttsProvider} voice, concat with natural pacing. Tier: ${_mcdLabel}`}
                    style={{ padding: "8px 16px", borderRadius: 10, border: "none",
                      background: generatingPerLineVoices ? "#2a2040" : "linear-gradient(135deg, #ff6b00, #ff9500)",
                      color: "#fff", fontSize: 11, fontWeight: 700,
                      cursor: (generatingPerLineVoices || selectedCast.length === 0) ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap" as const }}>
                    {generatingPerLineVoices ? "Generating..." : `🎭 Generate Dialogue (${_mcdLabel})`}
                  </button>
                );
              })()}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {selectedCast.map(sc => {
              const char = savedCharacters.find(c => c.id === sc.characterId);
              if (!char) return null;
              return (
                <div key={sc.characterId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, background: s2, border: `1px solid ${border}` }}>
                  {char.imageUrl && (
                    <img src={char.imageUrl.startsWith("http") || char.imageUrl.startsWith("/api/") ? char.imageUrl : `/api/media/${char.imageUrl.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`} alt={char.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{char.name}</p>
                    <p style={{ fontSize: 9, color: muted }}>{sc.role}</p>
                  </div>
                  <input
                    value={castVoiceMap[sc.characterId] ?? char.characterId ?? ""}
                    onChange={e => setCastVoiceMap(prev => ({ ...prev, [sc.characterId]: e.target.value }))}
                    placeholder="ElevenLabs voice ID"
                    style={{ ...inputStyle, width: 180, padding: "6px 10px", fontSize: 10 }}
                  />
                  {/* Audition — preview the assigned voice + a sample greeting. Inline Audio() — no extra UI state. */}
                  <button
                    title="Hear this voice say a sample line"
                    onClick={async () => {
                      const vid = castVoiceMap[sc.characterId] || char.characterId || "";
                      if (!vid) { setLastAction(`No voice ID set for ${char.name}`); return; }
                      setLastAction(`Auditioning ${char.name}...`);
                      try {
                        const res = await fetch("/api/tts", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            text: `Hello, I am ${char.name}. This is how my voice sounds.`,
                            voiceId: vid,
                            provider: effectiveNarrationProvider,
                            emotion: "neutral",
                          }),
                        });
                        const data = await res.json() as { audioUrl?: string; error?: string };
                        if (data.audioUrl) {
                          const a = new Audio(data.audioUrl);
                          a.play().catch(() => {});
                          setLastAction(`Playing ${char.name}'s voice...`);
                        } else {
                          setLastAction(`Audition failed: ${data.error || "no audio"}`);
                        }
                      } catch (err) {
                        setLastAction(`Audition error: ${err instanceof Error ? err.message : "unknown"}`);
                      }
                    }}
                    style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${blue}40`, background: `${blue}12`, color: blue, fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                    ▶ Audition
                  </button>
                </div>
              );
            })}
          </div>
          {/* Per-scene multi-cast dialogue playback. Shows up after Multi-Cast Dialogue button finishes —
              one player per scene whose dialogue we generated. Each row has Apply Lip-Sync for scenes
              that already have a video. */}
          {Object.keys(sceneDialogueAudio).length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${border}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
                Generated Dialogue (Multi-Cast)
              </p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {Object.entries(sceneDialogueAudio)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([sceneNumStr, url]) => {
                    const sceneNum = Number(sceneNumStr);
                    const scene = scenes.find(s => s.scene === sceneNum);
                    const sceneId = `SC${String(sceneNum).padStart(2, "0")}`;
                    const sceneVideoUrl = sceneVideos[sceneId];
                    const isLipsyncing = lipsyncingScenes.has(sceneNum);
                    return (
                      <div key={sceneNumStr} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: s2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9500", fontFamily: "monospace", minWidth: 40 }}>{sceneId}</span>
                        <span style={{ fontSize: 10, color: muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>
                          {scene?.title || ""}
                        </span>
                        <audio src={url} controls style={{ height: 28, flex: 2 }} />
                        {/* Apply Lip-Sync — only enabled when scene has a video to drive.
                            Still-image-only scenes show disabled button with tooltip. */}
                        <button
                          onClick={async () => {
                            if (!sceneVideoUrl) {
                              setLastAction(`Scene ${sceneNum}: generate a video first before applying lip-sync`);
                              return;
                            }
                            if (isLipsyncing) return;
                            setLipsyncingScenes(prev => new Set(prev).add(sceneNum));
                            setLastAction(`Lip-syncing Scene ${sceneNum}... (this can take 1-5 min)`);
                            try {
                              const res = await fetch("/api/avatar/lip-sync", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ imageUrl: sceneVideoUrl, audioUrl: url, inputIsVideo: true }),
                              });
                              const data = await res.json() as { videoUrl?: string; provider?: string; error?: string };
                              if (data.videoUrl) {
                                // Replace pointer only — original preserved on disk under prior filename.
                                setSceneVideos(prev => ({ ...prev, [sceneId]: data.videoUrl! }));
                                setLastAction(`Scene ${sceneNum}: lip-synced via ${data.provider}`);
                              } else {
                                setLastAction(`Scene ${sceneNum}: lip-sync failed — ${data.error || "no video returned"}`);
                              }
                            } catch (err) {
                              setLastAction(`Scene ${sceneNum}: lip-sync error — ${err instanceof Error ? err.message : "unknown"}`);
                            } finally {
                              setLipsyncingScenes(prev => { const n = new Set(prev); n.delete(sceneNum); return n; });
                            }
                          }}
                          disabled={!sceneVideoUrl || isLipsyncing}
                          title={!sceneVideoUrl
                            ? "Generate a video for this scene first — lip-sync needs a source video to drive"
                            : "Apply lip-sync — drives the scene video's mouth movement from this dialogue audio"}
                          style={{ padding: "5px 10px", borderRadius: 8, border: "none",
                            background: !sceneVideoUrl ? "#1a1a2e" : isLipsyncing ? "#2a2040" : "linear-gradient(135deg, #a855f7, #7c3aed)",
                            color: !sceneVideoUrl ? muted : "#fff",
                            fontSize: 9, fontWeight: 700,
                            cursor: (!sceneVideoUrl || isLipsyncing) ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap" as const }}>
                          {isLipsyncing ? "Syncing…" : "👄 Lip-Sync"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SC: 5-Tier Sound Model Selector (binding) ── */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${purple}30` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Sound Model</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Select audio quality tier. Higher = better quality + higher cost.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {SOUND_TIERS_MOVIE.map((tier, idx) => {
            const ghsTierId = movieTierToGhsSoundTierId(tier.id);
            const ghsTier = getSoundTier(ghsTierId);
            const isInfoOpen = openTierInfo === tier.id;
            return (
              <div key={tier.id} style={{ position: "relative" as const }}>
                <button
                  onClick={() => { setSoundTier(tier.id); setModelSettings(p => ({ ...p, soundModel: tier.id })); patchProjectSettings({ soundTier: tier.id }).catch(() => {}); setOpenTierInfo(null); }}
                  style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: "8px 14px", borderRadius: 10, border: `2px solid ${effectiveSoundTier === tier.id ? purple : border}`, background: effectiveSoundTier === tier.id ? `${purple}12` : "transparent", cursor: "pointer", minWidth: 100 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: effectiveSoundTier === tier.id ? purple : "#fff" }}>{idx + 1}. {tier.label.split("(")[0].trim()}</span>
                  <span style={{ fontSize: 9, color: effectiveSoundTier === tier.id ? purple : muted, fontFamily: "monospace" }}>{tier.cost}</span>
                </button>
                {/* ⓘ More button — shows popover with MCD bundle details */}
                <button
                  onClick={e => { e.stopPropagation(); setOpenTierInfo(isInfoOpen ? null : tier.id); }}
                  title={`What's included in ${tier.label}`}
                  style={{ position: "absolute" as const, top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", border: `1px solid ${purple}50`, background: `${purple}18`, color: purple, fontSize: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}>
                  i
                </button>
                {/* Tier info popover */}
                {isInfoOpen && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ position: "absolute" as const, top: "calc(100% + 6px)", left: 0, zIndex: 200, minWidth: 220, background: "#1a1028", border: `1px solid ${purple}50`, borderRadius: 10, padding: "12px 14px", boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: purple, marginBottom: 4 }}>{ghsTier.mcdLabel}</p>
                    <p style={{ fontSize: 9, color: muted, marginBottom: 2 }}>Quality: <span style={{ color: "#fff" }}>{ghsTier.quality}</span></p>
                    <p style={{ fontSize: 9, color: muted, marginBottom: 8 }}>Est. cost/100s: <span style={{ color: gold }}>{ghsTier.estCostPer100s}</span></p>
                    <ul style={{ margin: 0, padding: "0 0 0 14px", listStyle: "disc" }}>
                      {(ghsTier.includes as readonly string[]).map((item, i) => (
                        <li key={i} style={{ fontSize: 9, color: "#c4b5d4", marginBottom: 2 }}>{item}</li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setOpenTierInfo(null)}
                      style={{ marginTop: 8, padding: "3px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>
                      Close
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Click-outside close for tier info popover */}
        {openTierInfo !== null && (
          <div
            onClick={() => setOpenTierInfo(null)}
            style={{ position: "fixed" as const, inset: 0, zIndex: 199 }}
          />
        )}
      </div>

      {/* ── Narration Provider Selector ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Narration Provider</p>
        <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Select the TTS engine for all scene narrations in this project.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
          {/* 2026-06-13: Edge Neural is now the default (GHS Standard row). GHS Standard (Piper) kept as fallback. */}
          {([
            { id: "edge-tts",     label: "Edge Neural (free)",  color: "#10b981" },
            { id: "piper",        label: "Piper (fallback)",    color: accent },
            { id: "fal-narrator", label: "FAL Narrator",        color: blue },
            { id: "gemini",       label: "GHS Premium",         color: "#00d4ff" },
            { id: "elevenlabs",   label: "GHS Best",            color: purple },
            { id: "karaoke",      label: "Karaoke",             color: gold },
          ] as const).map(p => (
            <button key={p.id} onClick={() => {
              setNarrationProvider(p.id);
              patchProjectSettings({ narrationProvider: p.id }).catch(() => {});
            }}
              style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${effectiveNarrationProvider === p.id ? p.color : border}`,
                background: effectiveNarrationProvider === p.id ? `${p.color}12` : "transparent",
                color: effectiveNarrationProvider === p.id ? p.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Edge Neural sub-picker — shown when edge-tts is the active provider (2026-06-13). */}
        {effectiveNarrationProvider === "edge-tts" && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#10b981", marginBottom: 6 }}>Edge Narrator Voice</p>
            <p style={{ fontSize: 9, color: muted, marginBottom: 8 }}>Free Microsoft Neural voices. Auto-snaps to story region unless you pick manually.</p>
            <select
              value={edgeTtsVoiceId}
              onChange={e => {
                // User is manually picking — stop region auto-snap.
                if (narratorVoiceManualRef && narratorVoiceManualRef.current !== undefined) {
                  (narratorVoiceManualRef as React.MutableRefObject<boolean>).current = true;
                }
                setEdgeTtsVoiceId(e.target.value);
              }}
              style={{ width: "100%", background: "#12121e", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none" }}>
              {edgeNarratorVoices.map(v => (
                <option key={v.id} value={v.id} style={{ background: "#12121e" }}>{v.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Auto SFX toggle ── */}
      <div data-testid="auto-sfx-toggle" style={{ ...cardStyle, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Auto SFX</p>
          <p style={{ fontSize: 10, color: muted }}>AI assigns sound effects to each scene automatically. Only CC0 / CC BY / Public Domain tracks used.</p>
        </div>
        <button data-testid="auto-sfx-btn" onClick={() => { setAutoSfx(v => !v); setLastAction(`Auto SFX: ${!autoSfx ? "ON" : "OFF"}`); }}
          style={{ padding: "8px 20px", borderRadius: 20, border: `1px solid ${autoSfx ? accent + "60" : border}`, background: autoSfx ? `${accent}18` : "transparent", color: autoSfx ? accent : muted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const, minWidth: 64 }}>
          {autoSfx ? "ON" : "OFF"}
        </button>
      </div>

      {/* ── SFX / Sound Browser ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>SFX Library</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["freesound", "ai-sfx"] as const).map(t => (
            <button key={t} onClick={() => setSoundTab(t)}
              style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${soundTab === t ? blue : border}`, background: soundTab === t ? `${blue}10` : "transparent", color: soundTab === t ? blue : muted, fontSize: 10, cursor: "pointer" }}>
              {t === "freesound" ? "Freesound Library" : "AI Generate SFX"}
            </button>
          ))}
        </div>

        {soundTab === "freesound" && (
          <div>
            {fsNoKey && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: `${gold}08`, border: `1px solid ${gold}20`, marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: gold }}>Freesound API key not configured. Add FREESOUND_API_KEY to your .env file.</p>
                <p style={{ fontSize: 10, color: muted, marginTop: 3 }}>Get one free at <a href="https://freesound.org/apiv2/apply/" target="_blank" rel="noopener noreferrer" style={{ color: blue }}>freesound.org/apiv2/apply</a></p>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={fsQuery} onChange={e => setFsQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFreesound()}
                placeholder="Search: footsteps, rain, crowd, thunder..." style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 12 }} />
              <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: fsSearching ? "#2a2a40" : blue, color: "#000", fontSize: 11, fontWeight: 700, cursor: fsSearching ? "not-allowed" : "pointer" }}>
                {fsSearching ? "..." : "Search"}
              </button>
            </div>
            {fsResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {fsResults.map(sound => (
                  <div key={sound.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, border: `1px solid ${fsSaved.has(sound.id) ? `${green}30` : border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sound.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <span style={{ fontSize: 9, color: muted }}>{Math.round(sound.duration)}s</span>
                        {sound.licenseType === "CC0" && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: "#16a34a22", color: "#4ade80", fontWeight: 700 }}>Free</span>}
                        {sound.licenseType === "CC-BY" && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: `${blue}22`, color: blue, fontWeight: 700 }}>Attribution</span>}
                        {(sound.licenseType === "CC-BY-NC" || sound.licenseType === "OTHER") && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: "#dc262622", color: "#f87171", fontWeight: 700, textDecoration: "line-through" }}>Commercial Blocked</span>}
                        {!sound.licenseType && <span style={{ fontSize: 8, color: muted }}>{sound.license}</span>}
                      </div>
                    </div>
                    <button onClick={() => setSfxPreviewId(sfxPreviewId === sound.id ? null : sound.id)}
                      style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
                      {sfxPreviewId === sound.id ? "Stop" : "Play"}
                    </button>
                    {sfxPreviewId === sound.id && <audio src={sound.previewUrl} autoPlay onEnded={() => setSfxPreviewId(null)} style={{ display: "none" }} />}
                    <button
                      onClick={() => sound.safeForCommercial !== false && saveFreesound(sound)}
                      disabled={fsSaving === sound.id || fsSaved.has(sound.id) || sound.safeForCommercial === false}
                      title={sound.safeForCommercial === false ? "CC BY-NC — not safe for commercial use" : undefined}
                      style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${sound.safeForCommercial === false ? "#dc262630" : `${green}30`}`, background: sound.safeForCommercial === false ? "#dc262615" : fsSaved.has(sound.id) ? `${green}15` : "transparent", color: sound.safeForCommercial === false ? "#f87171" : fsSaved.has(sound.id) ? green : muted, cursor: (sound.safeForCommercial === false || fsSaved.has(sound.id)) ? "not-allowed" : "pointer", fontWeight: 600 }}>
                      {sound.safeForCommercial === false ? "Blocked" : fsSaved.has(sound.id) ? "Saved" : fsSaving === sound.id ? "..." : "Save"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!fsSearching && fsResults.length === 0 && fsQuery && !fsNoKey && (
              <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: "12px 0" }}>No results — try different keywords</p>
            )}
          </div>
        )}

        {soundTab === "ai-sfx" && (
          <div>
            <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Describe a sound effect — AI generates it via FAL stable-audio (free with FAL_KEY) or ElevenLabs (premium).</p>
            <input value={sfxDesc} onChange={e => setSfxDesc(e.target.value)}
              placeholder="e.g. Heavy footsteps on wooden floor" style={{ ...inputStyle, marginBottom: 8 }} />
            <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()}
              style={{ ...btnPrimary, width: "100%", background: sfxGenerating ? "#2a2a40" : purple, cursor: sfxGenerating ? "not-allowed" : "pointer" }}>
              {sfxGenerating ? "Generating SFX..." : "Generate SFX"}
            </button>
            {sfxGeneratedUrl && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: `${green}08`, border: `1px solid ${green}20` }}>
                <p style={{ fontSize: 11, color: green, marginBottom: 6 }}>SFX Generated</p>
                <audio src={sfxGeneratedUrl} controls style={{ width: "100%" }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Music Library ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon.Music style={{ width: 14, height: 14, color: muted }} /> Background Music</p>

        {/* GHS Music Tier Selection */}
        <p style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 8 }}>Music Source</p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 12 }}>
          <button data-testid="music-tier-stock" onClick={() => setMusicTier("stock")}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "stock" ? "#a78bfa" : border}`, background: musicTier === "stock" ? "rgba(167,139,250,0.1)" : "transparent", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "stock" ? "#a78bfa" : "#c5c5c8" }}>GHS Standard</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Stock Library — always available</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7ae0c3", fontFamily: "monospace", background: "rgba(122,224,195,0.08)", border: "1px solid rgba(122,224,195,0.2)", borderRadius: 4, padding: "2px 6px" }}>FREE</span>
          </button>
          <button data-testid="music-tier-ghs-pro" onClick={() => setMusicTier("ghs_pro")}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "ghs_pro" ? "#7cc4ff" : border}`, background: musicTier === "ghs_pro" ? "rgba(124,196,255,0.08)" : "transparent", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_pro" ? "#7cc4ff" : "#c5c5c8" }}>GHS Pro</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>FAL Stable Audio — instrumental, up to 47s</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7cc4ff", fontFamily: "monospace", background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 4, padding: "2px 6px" }}>MID</span>
          </button>
          <button data-testid="music-tier-ghs-classic" onClick={() => setMusicTier("ghs_classic")}
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "ghs_classic" ? "#ff9a3c" : border}`, background: musicTier === "ghs_classic" ? "rgba(255,154,60,0.08)" : "transparent", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_classic" ? "#ff9a3c" : "#c5c5c8" }}>GHS Classic</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Suno via Kie.ai — full lyrical songs</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9a3c", fontFamily: "monospace", background: "rgba(255,154,60,0.08)", border: "1px solid rgba(255,154,60,0.2)", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" as const }}>PREMIUM</span>
          </button>
        </div>
        <button onClick={generateMovieMusic} disabled={musicGenerating}
          style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: musicGenerating ? "#2a2040" : purple, color: "#fff", fontSize: 11, fontWeight: 700, cursor: musicGenerating ? "not-allowed" : "pointer", marginBottom: 12 }}>
          {musicGenerating ? "Generating…" : "Generate Music"}
        </button>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={aiPickMusic} disabled={aiPickingMusic}
            style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: aiPickingMusic ? "#2a2a40" : `linear-gradient(135deg, ${gold}, #d97706)`, color: aiPickingMusic ? muted : "#000", fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
            {aiPickingMusic ? "AI Picking…" : "AI Pick"}
          </button>
          <button onClick={() => { setShowMusicPicker(p => !p); if (!showMusicPicker && musicLibrary.length === 0) loadMusicLibrary(); }}
            style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${purple}40`, background: `${purple}10`, color: purple, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {showMusicPicker ? "Close Picker" : "Browse Library"}
          </button>
          {selectedMusicUrl && (
            <button onClick={() => { setSelectedMusicUrl(null); setSelectedMusicName(""); setAiMusicPickLog(""); }}
              style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 11, cursor: "pointer" }}>Remove</button>
          )}
        </div>
        {aiMusicPickLog && <p style={{ fontSize: 10, color: aiMusicPickLog.startsWith("Selected:") ? accent : muted, marginBottom: 8 }}>{aiMusicPickLog}</p>}
        {selectedMusicUrl && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: green, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><Icon.Check style={{ width: 10, height: 10 }} /> {selectedMusicName}</p>
            <audio controls src={selectedMusicUrl} style={{ width: "100%", height: 36 }} />
          </div>
        )}
        {showMusicPicker && (
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {loadingMusic ? <p style={{ fontSize: 11, color: muted }}>Loading...</p> : musicLibrary.length === 0 ? (
              <div style={{ textAlign: "center", padding: 14 }}>
                <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>No music in library yet.</p>
                <a href="/dashboard/music-studio" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <button style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 10, cursor: "pointer" }}>AI Generate Music</button>
                </a>
              </div>
            ) : musicLibrary.map(track => {
              const mediaUrl = assetToMediaUrl(track.filePath);
              const isSelected = selectedMusicUrl === mediaUrl;
              return (
                <div key={track.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isSelected ? `${purple}15` : s2, border: `1px solid ${isSelected ? purple : border}`, cursor: "pointer" }}
                  onClick={() => { setSelectedMusicUrl(mediaUrl); setSelectedMusicName(track.name); setShowMusicPicker(false); }}>
                  <Icon.Music style={{ width: 14, height: 14, color: muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, flex: 1, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</span>
                  {isSelected && <span style={{ fontSize: 10, color: purple, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><Icon.Check style={{ width: 10, height: 10 }} /> Selected</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Per-scene audio controls ── */}
      {totalScenes === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 14, color: muted }}>No scenes yet. Create scenes first.</p>
          <button onClick={() => setActiveTab("design")} style={{ ...btnPrimary, marginTop: 12 }}>Go to Design</button>
        </div>
      ) : scenes.map(scene => {
        const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
        const isNarrationOpen = narrationScene === scene.scene;
        const typeIcon = scene.generationMethod === "video" ? "V" : scene.generationMethod === "image" ? "I" : scene.generationMethod === "audio-only" ? "A" : "H";
        return (
          <div key={scene.scene} style={{ ...cardStyle, borderColor: `${accent}20` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{typeIcon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{sceneId}: {scene.title}</p>
                  <span style={badgeStyle(methodColors[scene.generationMethod] || accent)}>{scene.generationMethod}</span>
                </div>
              </div>
              <span style={{ fontSize: 10, color: muted }}>{scene.duration}</span>
            </div>

            {/* Audio inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
              <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                <p style={{ fontSize: 8, color: gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Narration</p>
                <input value={scene.dialogue} onChange={e => updateScene(scene.scene, { dialogue: e.target.value })}
                  style={{ ...inputStyle, fontSize: 9, padding: "3px 6px" }} placeholder="Narration text..." />
              </div>
              <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                <p style={{ fontSize: 8, color: purple, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Music Cue</p>
                <input value={scene.musicCue} onChange={e => updateScene(scene.scene, { musicCue: e.target.value })}
                  style={{ ...inputStyle, fontSize: 9, padding: "3px 6px" }} placeholder="e.g. suspense" />
              </div>
              <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                <p style={{ fontSize: 8, color: blue, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>SFX</p>
                <input value={scene.soundEffects} onChange={e => updateScene(scene.scene, { soundEffects: e.target.value })}
                  style={{ ...inputStyle, fontSize: 9, padding: "3px 6px" }} placeholder="footsteps, wind" />
              </div>
            </div>

            {/* AI Write Narration + Generate Audio + Polish */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button onClick={async () => {
                try {
                  const res = await fetch("/api/narration/generate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sceneDescription: scene.goal || scene.visualDescription,
                      sceneType: scene.generationMethod,
                      mood: scene.musicCue,
                      characters: scene.characters,
                      sceneNumber: scene.scene,
                    }),
                  });
                  const data = await res.json();
                  if (data.narrationText) {
                    updateScene(scene.scene, { dialogue: data.narrationText });
                    setLastAction(`AI narration written for Scene ${scene.scene}`);
                  }
                } catch (err) {
                  console.error("AI narration error:", err);
                  setErrorMsg(`Failed to generate narration for Scene ${scene.scene}: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
              }}
                style={{ flex: 1, fontSize: 9, padding: "6px 10px", borderRadius: 6, border: `1px solid ${gold}30`, background: `${gold}06`, color: gold, cursor: "pointer", fontWeight: 600 }}>
                AI Write Narration
              </button>
              <button onClick={() => generateSceneNarration(scene)} disabled={!scene.dialogue?.trim()}
                style={{ flex: 1, fontSize: 9, padding: "6px 10px", borderRadius: 6, border: `1px solid ${accent}30`, background: `${accent}06`, color: accent, cursor: !scene.dialogue?.trim() ? "not-allowed" : "pointer", fontWeight: 600, opacity: !scene.dialogue?.trim() ? 0.5 : 1 }}>
                Generate Audio
              </button>
              <button
                onClick={() => handlePolishScene(sceneId, scene.visualDescription || scene.goal, "polish")}
                disabled={polishingScene === sceneId}
                data-testid={`polish-btn-${sceneId}`}
                style={{ flex: 1, fontSize: 9, padding: "6px 10px", borderRadius: 6, border: `1px solid #a855f730`, background: polishingScene === sceneId ? "#a855f708" : `#a855f706`, color: polishingScene === sceneId ? muted : "#a855f7", cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                {polishingScene === sceneId ? "Polishing..." : "✨ Polish"}
              </button>
            </div>

            {/* Narration audio preview — shown once TTS has been generated for this scene */}
            {sceneNarrationAudioUrls[scene.scene] && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 8, color: accent, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Narrator Audio</p>
                <NarrationPreview
                  audioUrl={sceneNarrationAudioUrls[scene.scene]}
                  wordTimings={sceneNarrationWordTimings[scene.scene] ?? null}
                  text={scene.dialogue || ""}
                  height={28}
                />
              </div>
            )}

            {/* Hybrid-style scene editor row — 6 polish operations */}
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => handleSceneOp(sceneId, scene.visualDescription || scene.goal, "add_action")}
                disabled={polishingScene === sceneId}
                title="Add action / motion to this scene"
                style={{ flex: 1, minWidth: 70, fontSize: 9, padding: "5px 8px", borderRadius: 6, border: `1px solid ${gold}40`, background: `${gold}08`, color: gold, cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                ➕ Action
              </button>
              <button
                onClick={() => handleSceneOp(sceneId, scene.visualDescription || scene.goal, "intense")}
                disabled={polishingScene === sceneId}
                title="Make this scene more intense / dramatic"
                style={{ flex: 1, minWidth: 70, fontSize: 9, padding: "5px 8px", borderRadius: 6, border: `1px solid #ef444440`, background: `#ef444408`, color: "#ef4444", cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                🔥 Intense
              </button>
              <button
                onClick={() => handleSceneOp(sceneId, scene.visualDescription || scene.goal, "reduce_action")}
                disabled={polishingScene === sceneId}
                title="Tone down action — calmer scene"
                style={{ flex: 1, minWidth: 70, fontSize: 9, padding: "5px 8px", borderRadius: 6, border: `1px solid ${accent}40`, background: `${accent}08`, color: accent, cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                ❄ Calm
              </button>
              <button
                onClick={() => handleSceneOp(sceneId, scene.visualDescription || scene.goal, "emotional")}
                disabled={polishingScene === sceneId}
                title="Add emotional weight"
                style={{ flex: 1, minWidth: 70, fontSize: 9, padding: "5px 8px", borderRadius: 6, border: `1px solid #ec489940`, background: `#ec489908`, color: "#ec4899", cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                💗 Emotion
              </button>
              <button
                onClick={() => handleSceneOp(sceneId, scene.visualDescription || scene.goal, "establish")}
                disabled={polishingScene === sceneId}
                title="Establish setting / wide shot"
                style={{ flex: 1, minWidth: 70, fontSize: 9, padding: "5px 8px", borderRadius: 6, border: `1px solid ${gold}40`, background: `${gold}08`, color: gold, cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                🌅 Establish
              </button>
              <button
                onClick={() => handleSceneOp(sceneId, scene.visualDescription || scene.goal, "qc")}
                disabled={polishingScene === sceneId}
                title="Run QC check on scene clarity"
                style={{ flex: 1, minWidth: 70, fontSize: 9, padding: "5px 8px", borderRadius: 6, border: `1px solid #22c55e40`, background: `#22c55e08`, color: "#22c55e", cursor: polishingScene === sceneId ? "not-allowed" : "pointer", fontWeight: 600 }}>
                ✅ QC
              </button>
            </div>

            {/* NarrationControls toggle */}
            <button onClick={() => setNarrationScene(isNarrationOpen ? null : scene.scene)}
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1px solid ${gold}20`, background: `${gold}04`, color: gold, fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
              {isNarrationOpen ? "Hide Narration Controls" : "Open Narration Controls"}
            </button>
            {isNarrationOpen && (
              <div style={{ marginTop: 8 }}>
                <NarrationControls
                  narrationText={narrationTexts[scene.scene] ?? scene.dialogue ?? ""}
                  onNarrationChange={(text) => {
                    setNarrationTexts(prev => ({ ...prev, [scene.scene]: text }));
                    updateScene(scene.scene, { dialogue: text });
                  }}
                  onSettingsChange={(settings) => {
                    setNarrationSettings(prev => ({ ...prev, [scene.scene]: settings }));
                  }}
                  initialSettings={narrationSettings[scene.scene]}
                  compact
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
