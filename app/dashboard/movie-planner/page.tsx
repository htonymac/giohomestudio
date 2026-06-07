"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { SceneIntelligenceData } from "../../api/hybrid/scene-intelligence/route";
import DurationPicker from "../../components/DurationPicker";
import NarrationControls from "../../components/NarrationControls";
import type { NarrationSettings } from "../../components/NarrationControls";
import SceneImagePanel from "../../components/SceneImagePanel";
import CharacterPicker from "../../components/CharacterPicker";
import { assetToMediaUrl, type MusicAsset } from "../../utils/mediaUrl";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import { ds } from "../../../lib/designSystem";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { HeroTitle } from "../../components/hero/HeroTitle";
import * as Icon from "../../components/icons";
import { safeJson } from "../../../lib/api-utils";
import { GHS_SOUND_TIERS, getSoundTier, soundTierToMCDConfig, type GhsSoundTierId } from "@/lib/ghs-sound-tiers";
import SupervisorStatusBar from "../../components/SupervisorStatusBar";
import SubtitleStyler, { type SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../../components/SubtitleStyler";
import { useGate } from "../../components/PreGenerationGate";
import { estimateTextDuration } from "@/lib/auto-timestamp";
import { AID_VIDEO_MODELS, AID_IMAGE_MODELS } from "@/lib/aid-model-registry";
import { SCENE_ENERGY_COLOR } from "@/lib/scene-constants";
import { useProjectSettings } from "@/hooks/useProjectSettings";
import ScriptTab from "./tabs/ScriptTab";
import OverviewTab from "./tabs/OverviewTab";
import DesignTab from "./tabs/DesignTab";
import StoryTab from "./tabs/StoryTab";
import CharactersTab from "./tabs/CharactersTab";

// ═══════════════════════════════════════════════════════════════════════════
// GHS AI Movie & Series Planner — PRODUCTION WORKSHOP
//
// This is NOT a wizard. This is the user's production workshop and command
// center. Tabs are freely switchable, all sharing the same state.
//
// Tabs: Overview | Story & Draft | Design | Characters | Scene Board |
//       Audio & Shots | Assembly | Generate
//
// 2 AI layers: Primary Planner (story expansion) + Reviewer (quality check)
// 3 Non-LLM engines: Continuity Checker, Sound Cue Planner, Generation Strategy
//
// Features: save/load projects, continue existing, scene editing, render queue
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────────

interface Character {
  id: string;
  name: string;
  role?: string;
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

// ── Constants ────────────────────────────────────────────────────────────────

const GENRES = [
  "Children Story", "Short Story", "Action", "African Cinema", "Epic Fantasy",
  "Mythology", "Historical Drama", "Adventure", "Romance", "Thriller",
  "Horror", "Comedy", "Sci-Fi", "War", "Crime", "Supernatural", "Survival", "Inspirational",
];

const STYLES = [
  "Cinematic", "Dialogue Driven", "Narrated", "Voiceover Led",
  "Minimal Dialogue", "Visual Only", "Documentary Style", "Music Led",
];

const FORMATS = [
  { id: "audio_video_image", label: "Hybrid Movie", desc: "Images for setup/emotion + Video for action + Audio ties it together. Save 50-75% credits.", cost: "1-2 credits/scene", badge: "RECOMMENDED", badgeColor: "#22c55e",
    detail: "AI decides per scene: calm scenes use images with rich narration, action scenes use 5-10s video, transitions use audio bridges. Same story quality, much lower cost." },
  { id: "video_first", label: "Full Video Movie", desc: "Every scene is full video. Highest quality and motion. For premium productions.", cost: "4 credits/scene", badge: "PREMIUM", badgeColor: "#7c5cfc",
    detail: "Maximum visual quality. Every scene generated as video. Best for cinematic action, high-budget productions. Narration is minimal — motion tells the story." },
  { id: "audio_image", label: "Image-Led Narrated Movie", desc: "Heavy narration with images. Minimal motion. Cheapest format.", cost: "1 credit/scene", badge: "BUDGET", badgeColor: "#f59e0b",
    detail: "Best for children stories, emotional stories, recap storytelling. Strong narration carries every scene. Images with pan/zoom effects. Very low cost." },
  { id: "audio_only", label: "Audio Only Movie", desc: "Radio drama, voice-led storytelling. No visuals. Pure audio experience.", cost: "0 credits/scene", badge: "FREE", badgeColor: "#00d4ff",
    detail: "Voice acting, narration, SFX, and music only. No image or video generation needed. For podcasts, audio dramas, and voice-led stories." },
];

const PRODUCTION_MODES = [
  { id: "ai_generated", label: "AI Generated Movie", desc: "AI plans and generates, you review and approve" },
  { id: "ai_human", label: "AI + Human Movie", desc: "AI plans, you edit important creative decisions" },
  { id: "manual_assisted", label: "Manual Assisted Movie", desc: "You control scene design, AI assists" },
];

const PLANNING_DEPTHS = [
  { id: "quick", label: "Standard", desc: "Basic AI planning — fast outline, simple scenes", cost: "Free", badge: "FREE", badgeColor: "#22c55e",
    detail: "1 AI system creates a basic plan. Good for quick ideas and testing." },
  { id: "smart", label: "Smart", desc: "2 AI systems — AI Story Director + AI Quality Reviewer", cost: "1 credit", badge: "RECOMMENDED", badgeColor: "#7c5cfc",
    detail: "AI Story Director expands your idea. AI Quality Reviewer checks for logic gaps and pacing. Better scenes, sound planning, and style." },
  { id: "full", label: "Premium", desc: "3 AI systems — Story Director + Technical Director + Quality Reviewer", cost: "3 credits", badge: "PREMIUM", badgeColor: "#f59e0b",
    detail: "Full multi-AI orchestration. AI Story Director expands, AI Technical Director adds exact SFX and physics, AI Quality Reviewer validates. Complete producer-grade blueprint." },
];

const TONES = [
  "Emotional", "Suspenseful", "Heroic", "Magical", "Dark", "Funny",
  "Warm", "Tragic", "Adventurous", "Intense", "Romantic", "Mysterious",
];

const SETTINGS = [
  "Modern City", "Village", "Desert", "Mountain Snow", "Ancient Kingdom",
  "Mythic World", "Futuristic City", "Forest", "War Zone", "Ocean",
  "Space", "Underground", "Market", "School", "Palace",
];

const ROLES = [
  "Hero", "Heroine", "Villain", "Narrator", "Mentor", "Side Character",
  "Comic Relief", "Antihero", "Child Lead", "Warrior", "Ruler", "Love Interest",
];

// ── Scene Intelligence display constants ─────────────────────────────────

// SCENE_ENV_ICON removed — env type shown as text label (v14: no emoji)

// ── Colors ───────────────────────────────────────────────────────────────

const surface = ds.color.card;
const border = ds.color.line;
const muted = ds.color.mute;
const accent = ds.color.lilac;
const s2 = ds.color.paper;
const green = "#22c55e";
const gold = ds.color.gold;
const red = "#ef4444";
const blue = ds.color.sky;
const purple = "#a855f7";

const cardStyle: React.CSSProperties = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginBottom: 12 };
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: muted, marginBottom: 8, display: "block", fontFamily: ds.font.mono };
const inputStyle: React.CSSProperties = { width: "100%", background: ds.color.paper, border: `1px solid ${ds.color.line2 ?? border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: ds.font.sans };
const btnPrimary: React.CSSProperties = { padding: "12px 24px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const badgeStyle = (color: string): React.CSSProperties => ({ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${color}15`, color, fontWeight: 600, display: "inline-block" });
const pillStyle = (selected: boolean, color?: string): React.CSSProperties => ({
  padding: "8px 16px", borderRadius: 100, cursor: "pointer",
  border: `1px solid ${selected ? (color ?? accent) : border}`,
  background: selected ? `${color ?? accent}15` : "transparent",
  color: selected ? (color ?? accent) : muted,
  fontSize: 12, fontWeight: selected ? 600 : 400, transition: "all 0.2s",
});

// ── 5-Tier Sound Model Selector ──
const SOUND_TIERS_MOVIE = [
  { id: "piper",          label: "GHS Standard", desc: "Piper TTS — free, always available",      cost: "Free",    providerKey: "piper" },
  { id: "ghs_karaoke",    label: "GHS Pro",      desc: "GHS Karaoke built-in",                    cost: "Low",     providerKey: "karaoke" },
  { id: "fal_karaoke",    label: "GHS Karaoke",  desc: "FAL karaoke music generation",            cost: "Mid",     providerKey: "stable_audio" },
  { id: "kie_classic",    label: "GHS Classic",  desc: "Suno via Kie.ai — full lyrical songs",   cost: "Premium", providerKey: "kie" },
  { id: "kie_premium",    label: "GHS Premium",  desc: "Suno via Kie.ai — premium quality",      cost: "Highest", providerKey: "kie" },
] as const;
type SoundTierMovieId = typeof SOUND_TIERS_MOVIE[number]["id"];

// ── MCD-TIER: Map old SOUND_TIERS_MOVIE ids → canonical GhsSoundTierId ──
// Old ids existed before ghs-sound-tiers.ts was locked. Both live in
// the codebase — this bridge lets us call getSoundTier() from SOUND_TIERS_MOVIE
// without touching the existing tier state machine.
function movieTierToGhsSoundTierId(id: SoundTierMovieId): GhsSoundTierId {
  switch (id) {
    case "piper":       return "ghs-sound";
    case "ghs_karaoke": return "ghs-plus";
    case "fal_karaoke": return "ghs-pro";
    case "kie_classic": return "ghs-premium";
    case "kie_premium": return "ghs-premium";
  }
}

// ── Workshop Tab Definitions ────────────────────────────────────────────

type WorkshopTab = "design" | "story" | "script" | "sound" | "characters" | "scenes" | "assembly" | "overview";

// Design → Story → Script(Screenplay) → Sound(Voice & Audio) → Cast → Scene Board → Assembly → Overview
const WORKSHOP_TABS: { id: WorkshopTab; label: string }[] = [
  { id: "design",     label: "Design" },
  { id: "story",      label: "Story & Draft" },
  { id: "script",     label: "Screenplay" },
  { id: "sound",      label: "Voice & Audio" },
  { id: "characters", label: "Cast" },
  { id: "scenes",     label: "Scene Board" },
  { id: "assembly",   label: "Assembly" },
  { id: "overview",   label: "Overview" },
];

// ── Page ─────────────────────────────────────────────────────────────────

export default function MoviePlannerPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: "#5a7080" }}>Loading Movie Planner...</div>}><MoviePlannerInner /></Suspense>;
}

function MoviePlannerInner() {
  const searchParams = useSearchParams();

  // ── Workshop tab ──
  const [activeTab, setActiveTab] = useState<WorkshopTab>("design");

  // ── Project ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectPhase, setProjectPhase] = useState("STORY_INPUT");
  const [lastAction, setLastAction] = useState("Project created");
  const [saving, setSaving] = useState(false);

  // ── Story ──
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [devocarizing, setDevocarizing] = useState(false);
  const [expandedStory, setExpandedStory] = useState("");
  const [duration, setDuration] = useState("10 min");
  const [language, setLanguage] = useState("English");

  // ── Design ──
  const [projectStyle, setProjectStyle] = useState("realistic"); // maps to STYLE_PRESETS in scene-image API
  // ── Per-scene style overrides — keyed by sceneId, falls back to projectStyle ──
  const [sceneStyles, setSceneStyles] = useState<Record<string, string>>({});
  const [genre, setGenre] = useState("");
  const [style, setStyle] = useState("");
  const [format, setFormat] = useState("");
  const [productionMode, setProductionMode] = useState("");
  const [planningDepth, setPlanningDepth] = useState("smart");
  const [tone, setTone] = useState("");
  const [setting, setSetting] = useState("");

  // ── Characters ──
  const [savedCharacters, setSavedCharacters] = useState<Character[]>([]);
  const [selectedCast, setSelectedCast] = useState<Array<{ characterId: string; role: string }>>([]);
  const [loadingChars, setLoadingChars] = useState(false);

  // ── AI Cast Generation from story ──
  const [generatedCast, setGeneratedCast] = useState<Character[]>([]);
  const [castGenerating, setCastGenerating] = useState(false);
  const [castGenError, setCastGenError] = useState<string | null>(null);
  // ── Portrait image model selector (Cast tab) — global fallback ──
  const [castPortraitModel, setCastPortraitModel] = useState<string>("segmind_flux");
  // ── Per-character portrait model selector ────────────────────────────────
  const [charPortraitModel, setCharPortraitModel] = useState<Record<string, string>>({});
  const [charRefImages, setCharRefImages] = useState<Record<string, Array<{url: string; angle: string; label: string}>>>({});
  // ── Era & Culture Lock ────────────────────────────────────────────────────
  const [storyEra, setStoryEra] = useState("");
  const [storyCulture, setStoryCulture] = useState("");

  // ── AI Planning ──
  const [planning, setPlanning] = useState(false);
  const [moviePlan, setMoviePlan] = useState<MoviePlan | null>(null);

  // ── Scene editing ──
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [sceneViewMode, setSceneViewMode] = useState<"grid" | "list">("grid");
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [generatingSceneImage, setGeneratingSceneImage] = useState<string | null>(null);
  const [polishingScene, setPolishingScene] = useState<string | null>(null);

  // ── Narration ──
  const [narrationTexts, setNarrationTexts] = useState<Record<number, string>>({});
  const [narrationSettings, setNarrationSettings] = useState<Record<number, NarrationSettings>>({});
  const [narrationScene, setNarrationScene] = useState<number | null>(null);
  // H9: extend type to include new TTS branches wired in /api/tts.
  const [narrationProvider, setNarrationProvider] = useState<"piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "edge-tts" | "gemini" | "fal-f5" | "fal-xtts" | "fal-bark" | "gtts">("piper");
  const [autoSfx, setAutoSfx] = useState(true);
  // ── Narration audio URLs (sceneNum → audioUrl) — populated when TTS is generated ──
  const [sceneNarrationAudioUrls, setSceneNarrationAudioUrls] = useState<Record<number, string>>({});

  // ── Project persistence ──
  const [projectList, setProjectList] = useState<Array<{ id: string; title: string; genre: string | null; status: string; updatedAt: string; _count: { scenes: number } }>>([]);
  const [showContinue, setShowContinue] = useState(false);
  const [renderingScene, setRenderingScene] = useState<number | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assemblyMediaPrefs, setAssemblyMediaPrefs] = useState<Record<string, "image" | "video">>({});
  const [aiSupervisorRunning, setAiSupervisorRunning] = useState(false);
  const [aiSupervisorReport, setAiSupervisorReport] = useState<{ ok: boolean; summary: string; issues: string[] } | null>(null);

  // ── Validation ──
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [validating, setValidating] = useState(false);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);

  // ── Character Picker ──
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  // ── Pre-flight check ──
  interface PreflightCheck { id: string; label: string; status: "ok" | "warn" | "error"; detail?: string; autoFixAvailable: boolean; autoFixAction?: string; }
  const [preflightResult, setPreflightResult] = useState<{ checks: PreflightCheck[]; canAssemble: boolean; blockingErrors: number; warnings: number } | null>(null);
  const [preflightRunning, setPreflightRunning] = useState(false);

  // ── Error display ──
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Batch image generation ──
  const [generatingAllImages, setGeneratingAllImages] = useState(false);

  // ── Scene Videos (sceneId → local video URL) ──
  const [sceneVideos, setSceneVideos] = useState<Record<string, string>>({});
  const [sceneVideoVersions, setSceneVideoVersions] = useState<Record<string, string[]>>({});
  const [generatingSceneVideos, setGeneratingSceneVideos] = useState<Set<string>>(new Set());
  const [sceneGenProgress, setSceneGenProgress] = useState<Record<string, { percent: number; message: string }>>({});

  // ── FreeSound / SFX browser ──
  const [soundTab, setSoundTab] = useState<"freesound" | "ai-sfx">("freesound");
  const [fsQuery, setFsQuery] = useState("");
  const [fsResults, setFsResults] = useState<Array<{ id: number; name: string; duration: number; license: string; licenseType?: string; safeForCommercial?: boolean; username: string; previewUrl: string; tags: string[] }>>([]);
  const [fsSearching, setFsSearching] = useState(false);
  const [fsSaving, setFsSaving] = useState<number | null>(null);
  const [fsSaved, setFsSaved] = useState<Set<number>>(new Set());
  const [fsNoKey, setFsNoKey] = useState(false);
  const [sfxDesc, setSfxDesc] = useState("");
  const [sfxGenerating, setSfxGenerating] = useState(false);
  const [sfxGeneratedUrl, setSfxGeneratedUrl] = useState<string | null>(null);
  const [sfxPreviewId, setSfxPreviewId] = useState<number | string | null>(null);

  // ── Assembly scene selection ──
  const [assemblySelectedIds, setAssemblySelectedIds] = useState<string[]>([]);
  const [assemblyInitialized, setAssemblyInitialized] = useState(false);

  // ── Screenplay ──
  const [screenplay, setScreenplay] = useState("");
  const [screenplayAuthor, setScreenplayAuthor] = useState("");
  const [movieMadeBy, setMovieMadeBy] = useState("");
  const [movieIdeaFrom, setMovieIdeaFrom] = useState("");
  const [subtitleMatchResult, setSubtitleMatchResult] = useState<{ status: "ok"|"warn"|"checking"; note: string } | null>(null);
  const [screenplayError, setScreenplayError] = useState("");
  const [generatingScreenplay, setGeneratingScreenplay] = useState(false);
  const [parsingScript, setParsingScript] = useState(false);
  const [scriptSegments, setScriptSegments] = useState<Array<{ type: "narration"|"dialogue"; speaker?: string; text: string }>>([]);
  const [showScriptReview, setShowScriptReview] = useState(false);
  const [sendingToScenes, setSendingToScenes] = useState(false);
  const [sendToScenesResult, setSendToScenesResult] = useState("");
  const [assemblyName, setAssemblyName] = useState("Main Cut");
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; sceneIds: string[]; videoUrl?: string; savedAt: string }>>([]);
  const [showCutsPanel, setShowCutsPanel] = useState(false);

  // ── Sound tier & model settings (SD) ──
  const [soundTier, setSoundTier] = useState<SoundTierMovieId>("piper");
  const [musicTier, setMusicTier] = useState<"stock" | "ghs_pro" | "ghs_classic">("stock");
  // ── MCD-TIER: which tier ⓘ popover is open (null = all closed) ──
  const [openTierInfo, setOpenTierInfo] = useState<SoundTierMovieId | null>(null);
  // ── SC: per-cast voice assignments & per-line generation ──
  const [castVoiceMap, setCastVoiceMap] = useState<Record<string, string>>({});
  const [generatingPerLineVoices, setGeneratingPerLineVoices] = useState(false);
  // Phase 1 multi-cast dialogue: per-scene assembled dialogue audio URL (one per scene number).
  // Result of /api/dialogue/generate — single concat clip with all speaker lines + pacing.
  const [sceneDialogueAudio, setSceneDialogueAudio] = useState<Record<number, string>>({});
  // Phase 3 lip-sync: which scenes are currently running lip-sync (so the button shows progress).
  const [lipsyncingScenes, setLipsyncingScenes] = useState<Set<number>>(new Set());
  const [musicGenerating, setMusicGenerating] = useState(false);
  const [modelSettings, setModelSettings] = useState({
    storyLLM: "claude-haiku-4-5",
    charImageModel: "fal_flux_schnell",
    sceneVideoModel: "kling_1_6_standard",
    soundModel: "piper" as SoundTierMovieId,
  });
  const [showModelSettings, setShowModelSettings] = useState(false);

  // ── Story AI provider ──
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-haiku-4-5-20251001");

  // ── Story expand pipeline ──
  const [expanding, setExpanding] = useState(false);

  // ── AI Production Plan (FIX 2) ──
  interface AiProductionPlan {
    scenes: Array<{ id: string; title: string; description: string; duration: string }>;
    musicMood: string;
    visualStyle: string;
    narratorTone: string;
    sceneCount: number;
    pacing: string;
    generatedAt: string;
  }
  const [aiProductionPlan, setAiProductionPlan] = useState<AiProductionPlan | null>(null);
  const [generatingProductionPlan, setGeneratingProductionPlan] = useState(false);
  const [showProductionPlan, setShowProductionPlan] = useState(true);

  // ── Character Style Classification (FIX 2) ──
  const CHARACTER_STYLES = [
    { id: "realistic",    label: "Realistic / Live Action" },
    { id: "3d_animation", label: "3D Animation" },
    { id: "2d_animation", label: "2D / Cartoon" },
    { id: "cinematic",    label: "Cinematic / Film Noir" },
    { id: "anime",        label: "Anime Style" },
  ] as const;
  type CharacterStyleId = typeof CHARACTER_STYLES[number]["id"];
  const [movieCharacterStyle, setMovieCharacterStyle] = useState<CharacterStyleId>("realistic");

  // ── Music library ──
  const [musicLibrary, setMusicLibrary] = useState<MusicAsset[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusicUrl, setSelectedMusicUrl] = useState<string | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState("");
  const [aiPickingMusic, setAiPickingMusic] = useState(false);
  const [aiMusicPickLog, setAiMusicPickLog] = useState("");
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({ ...DEFAULT_SUBTITLE_CONFIG, mode: "dramatic" });
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [outroUrl, setOutroUrl] = useState<string | null>(null);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [generatingOutro, setGeneratingOutro] = useState(false);

  // ── Pre-generation gate ──
  const { requireGate, GateModal } = useGate();

  // ── AID model picker ──
  const [selectedVideoModelId, setSelectedVideoModelId] = useState("segmind_pruna_video");
  const [selectedImageModelId, setSelectedImageModelId] = useState("fal_flux_schnell");
  const [transparentBg, setTransparentBg] = useState(false);
  const [aiTier, setAiTier] = useState<AITier>("standard");
  const [showAidPicker, setShowAidPicker] = useState(false);
  const [aidMode, setAidMode] = useState<"video"|"image">("video");
  const [aidStyle, setAidStyle] = useState<"all"|"2d"|"3d"|"cartoon"|"realistic">("all");
  const [aidSort, setAidSort] = useState<"cheapest"|"quality"|"expensive">("cheapest");

  // ── Drag reorder ──
  const [dragSource, setDragSource] = useState<number | null>(null);

  // ── Scene Intelligence ──
  const [sceneIntelligence, setSceneIntelligence] = useState<Record<string, SceneIntelligenceData>>({});
  const [runningIntelligence, setRunningIntelligence] = useState(false);

  // ── Continuous Motion ──────────────────────────────────────────────────────
  const [continuousMotionEnabled, setContinuousMotionEnabled] = useState(false);
  const [cmTotalDuration, setCmTotalDuration] = useState(15);
  const [cmSegmentDuration, setCmSegmentDuration] = useState(5);
  const [cmProvider, setCmProvider] = useState<"wan" | "kling_std">("wan");
  const [cmRunning, setCmRunning] = useState(false);
  const [cmStatus, setCmStatus] = useState<string | null>(null);
  const [cmSceneId, setCmSceneId] = useState<string | null>(null);
  const [cmFinalVideoUrl, setCmFinalVideoUrl] = useState<string | null>(null);
  const [cmError, setCmError] = useState<string | null>(null);

  // ── Derived stats ──
  const scenes = moviePlan?.scenes ?? [];
  const totalScenes = scenes.length;
  const draftScenes = scenes.filter(s => s.status === "planned" || s.status === "needs_edit").length;
  const approvedScenes = scenes.filter(s => s.status === "approved").length;
  const blockedScenes = scenes.filter(s => s.status === "blocked").length;
  const generatedScenes = scenes.filter(s => s.status === "generated").length;
  const generatedImages = Object.keys(sceneImages).length;

  // ── Progress calculations (real) ──
  const storyProgress = expandedStory ? 100 : idea ? 50 : 0;
  const characterProgress = savedCharacters.length === 0 ? 0 : selectedCast.length > 0 ? 100 : 50;
  const planningProgress = moviePlan ? 100 : 0;
  const sceneProgress = totalScenes === 0 ? 0 : Math.round((generatedScenes / totalScenes) * 100);
  const imageProgress = totalScenes === 0 ? 0 : Math.round((generatedImages / totalScenes) * 100);
  const assemblyReadiness = Math.round((storyProgress + characterProgress + planningProgress + sceneProgress + imageProgress) / 5);

  // ── Guidance banner ──
  const nextStepMessage: { text: string; color: string; targetTab: WorkshopTab } = (() => {
    if (!genre) return { text: "Set Design first — genre, tone, format, style feed the AI story expansion", color: gold, targetTab: "design" as WorkshopTab };
    if (!idea.trim()) return { text: "Design set — now write your story idea in Story tab", color: accent, targetTab: "story" as WorkshopTab };
    if (selectedCast.length === 0) return { text: "Select characters from the Cast tab for better results", color: purple, targetTab: "characters" as WorkshopTab };
    if (!moviePlan) return { text: "Set your design choices then click Generate Movie Plan", color: gold, targetTab: "design" as WorkshopTab };
    const pendingImages = moviePlan.scenes.filter(s => {
      const sid = `SC${String(s.scene).padStart(2, "0")}`;
      return !sceneImages[sid] && s.generationMethod !== "audio-only";
    }).length;
    if (pendingImages > 0) return { text: `Generate scene images from the Scene Board (${pendingImages} pending)`, color: blue, targetTab: "scenes" as WorkshopTab };
    const hasAudio = moviePlan.scenes.every(s => s.dialogue || s.musicCue);
    if (!hasAudio) return { text: "Plan audio for each scene in the Voice & Audio tab", color: gold, targetTab: "sound" as WorkshopTab };
    return { text: "Your movie is ready! Go to Assembly to build it.", color: green, targetTab: "assembly" as WorkshopTab };
  })();

  // ── Warnings engine ──
  const warnings: string[] = [];
  if (selectedCast.length === 0 && totalScenes > 0) warnings.push("No characters in cast");
  savedCharacters.forEach(c => {
    if (selectedCast.some(sc => sc.characterId === c.id)) {
      if (!c.voiceName) warnings.push(`${c.name} missing voice`);
      if (!c.imageUrl) warnings.push(`${c.name} missing portrait image`);
    }
  });
  if (totalScenes > 0) {
    scenes.forEach(s => {
      const sceneId = `SC${String(s.scene).padStart(2, "0")}`;
      if (!sceneImages[sceneId] && s.generationMethod !== "audio-only") warnings.push(`Scene ${s.scene}: "${s.title}" has no image`);
      if (s.characters.length === 0) warnings.push(`Scene ${s.scene}: no characters assigned`);
      // Enforce scene still before video
      if ((s.generationMethod === "video" || s.generationMethod === "image-to-video") && !sceneImages[sceneId]) {
        warnings.push(`Scene ${s.scene}: needs scene image before video generation`);
      }
    });
  }

  // ── Method / cost colors ──
  const methodColors: Record<string, string> = {
    image: green, video: red, "image-to-video": gold,
    "audio-only": "#3b82f6", hybrid: purple,
  };
  const costColors: Record<string, string> = { cheap: green, balanced: gold, premium: red };

  // ── Auto-select all scenes when entering Assembly for the first time ──
  useEffect(() => {
    if (activeTab === "assembly" && scenes.length > 0 && !assemblyInitialized) {
      setAssemblySelectedIds(scenes.map(s => `SC${String(s.scene).padStart(2, "0")}`));
      setAssemblyInitialized(true);
    }
    if (assemblyInitialized && scenes.length > 0) {
      setAssemblySelectedIds(prev => {
        const newIds = scenes.map(s => `SC${String(s.scene).padStart(2, "0")}`).filter(id => !prev.includes(id));
        return newIds.length > 0 ? [...prev, ...newIds] : prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scenes.length]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Persistent project storage key — from URL ?projectId= (no localStorage) ──
  const urlProjectId = searchParams.get("projectId");

  // ── Phase C.1: Project settings hook — reads from DB, patches asynchronously ──
  const {
    settings: projectSettings,
    patch: patchProjectSettings,
  } = useProjectSettings(urlProjectId || null);

  // ── Phase C.1: Effective shims — hook value wins when loaded, local state is fallback ──
  const effectiveProjectStyle = projectSettings.visualStyle ?? projectStyle;
  const effectiveLanguage = projectSettings.language ?? language;
  const effectiveSoundTier = (projectSettings.soundTier ?? soundTier) as typeof soundTier;
  const effectiveNarrationProvider = (projectSettings.narrationProvider ?? narrationProvider) as typeof narrationProvider;
  const effectiveVideoModelId = projectSettings.imageModelVersion !== "auto"
    ? (projectSettings.videoModelVersion ?? selectedVideoModelId)
    : selectedVideoModelId;
  // Note: imageModelVersion "auto" falls back to local. Treat non-auto as a pinned version.
  const effectiveImageModelId = projectSettings.imageModelVersion !== "auto"
    ? (projectSettings.imageModelVersion ?? selectedImageModelId)
    : selectedImageModelId;
  // SubtitleConfig: build from hook fields, spread over local config for non-migrated fields
  const effectiveSubtitleConfig: typeof subtitleConfig = projectSettings
    ? {
        ...subtitleConfig,
        // subtitleMode from DB maps to SubtitleStyler's `mode` — best-effort passthrough
        mode: (projectSettings.subtitleMode as typeof subtitleConfig.mode) ?? subtitleConfig.mode,
        highlightColor: projectSettings.subtitleHighlight ?? subtitleConfig.highlightColor,
      }
    : subtitleConfig;

  // BUG-15 pattern: guard while restoring from DB
  const isRestoringRef = useRef(true);
  const activeProjectIdRef = useRef<string>("");

  // ── Restore full project state — DB only ──
  useEffect(() => {
    let cancelled = false;
    async function restoreState() {
      isRestoringRef.current = true;
      const activeId = urlProjectId || "ghs_movie_default";
      if (typeof window !== "undefined") {
        const target = `/dashboard/movie-planner?projectId=${encodeURIComponent(activeId)}`;
        if (window.location.search !== `?projectId=${encodeURIComponent(activeId)}`) {
          window.history.replaceState(null, "", target);
        }
      }
      activeProjectIdRef.current = activeId;
      try {
        const dbRes = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(activeId)}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData.found && dbData.data && !cancelled) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = dbData.data as any;
            if (d.title)           setTitle(d.title);
            if (d.idea)            setIdea(d.idea);
            if (d.expandedStory)   setExpandedStory(d.expandedStory);
            if (d.genre)           setGenre(d.genre);
            if (d.style)           setStyle(d.style);
            if (d.format)          setFormat(d.format);
            if (d.tone)            setTone(d.tone);
            if (d.savedCharacters?.length > 0) setSavedCharacters(d.savedCharacters);
            if (d.selectedCast?.length > 0) setSelectedCast(d.selectedCast);
            if (d.moviePlan)       setMoviePlan(d.moviePlan);
            if (d.sceneImages && Object.keys(d.sceneImages).length > 0) setSceneImages(d.sceneImages);
            if (d.sceneVideos && Object.keys(d.sceneVideos).length > 0) setSceneVideos(d.sceneVideos);
            if (d.scriptSegments?.length > 0) setScriptSegments(d.scriptSegments);
            if (d.screenplay)      setScreenplay(d.screenplay);
            if (d.selectedMusicUrl) setSelectedMusicUrl(d.selectedMusicUrl);
            if (d.selectedMusicName) setSelectedMusicName(d.selectedMusicName);
            if (d.narrationProvider) setNarrationProvider(d.narrationProvider);
            if (d.soundTier)       setSoundTier(d.soundTier);
            if (d.modelSettings)   setModelSettings(d.modelSettings);
            if (d.savedCuts?.length > 0) setSavedCuts(d.savedCuts);
            if (d.activeTab)       setActiveTab(d.activeTab);
            if (d.storyEra)        setStoryEra(d.storyEra);
            if (d.storyCulture)    setStoryCulture(d.storyCulture);
          }
        }
      } catch { /* DB unavailable — start fresh */ }
      finally {
        isRestoringRef.current = false;
      }
    }
    restoreState();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save project state — DB only ──
  useEffect(() => {
    if (isRestoringRef.current) return;
    const data = {
      title, idea, expandedStory, genre, style, format, tone,
      storyEra, storyCulture,
      savedCharacters, selectedCast, moviePlan,
      sceneImages, sceneVideos, scriptSegments, screenplay,
      selectedMusicUrl, selectedMusicName, narrationProvider,
      soundTier, modelSettings, savedCuts, activeTab,
      timestamp: Date.now(),
    };
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: activeProjectIdRef.current || "ghs_movie_draft", data }),
    }).catch(() => { /* silent on DB error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, idea, expandedStory, genre, style, format, tone, storyEra, storyCulture,
      savedCharacters, selectedCast, moviePlan, sceneImages, sceneVideos, scriptSegments, screenplay,
      selectedMusicUrl, selectedMusicName, narrationProvider, soundTier, modelSettings, savedCuts, activeTab]);

  // Load project list + check for continue
  useEffect(() => {
    fetch("/api/movie-planner/project").then(r => r.json()).then(d => {
      if (d.projects) setProjectList(d.projects);
    }).catch((err) => { console.error("loadProjectList:", err); });
    if (searchParams.get("continue") === "true") setShowContinue(true);
    const preFormat = searchParams.get("format");
    if (preFormat) setFormat(preFormat);
    // Handle characterId from character-voices export
    const charId = searchParams.get("characterId");
    if (charId) {
      fetch("/api/character-voices").then(r => r.json()).then(d => {
        const char = (d.voices || []).find((v: { id: string }) => v.id === charId);
        if (char) {
          setSavedCharacters(prev => {
            if (prev.some(c => c.id === char.id)) return prev;
            return [...prev, { id: char.id, name: char.name, role: char.role, description: char.visualDescription, imageUrl: char.imageUrl, characterId: char.characterId, voiceName: char.voiceName }];
          });
          setSelectedCast(prev => {
            if (prev.some(c => c.characterId === char.id)) return prev;
            return [...prev, { characterId: char.id, role: char.role || "Hero" }];
          });
          const desc = char.visualDescription || char.name;
          setIdea(prev => prev || `Story featuring ${char.name}: ${desc}`);
          setActiveTab("story");
          setLastAction(`Character "${char.name}" imported from registry`);
        }
      }).catch((err) => { console.error("loadCharFromParam:", err); setErrorMsg(`Failed to load character: ${err instanceof Error ? err.message : "Unknown error"}`); });
    }
  }, [searchParams]);

  // Load saved characters
  useEffect(() => {
    setLoadingChars(true);
    fetch("/api/character-voices")
      .then(r => r.json())
      .then(d => {
        const chars = d.voices || d.characters || [];
        if (chars.length > 0) setSavedCharacters(chars.map((v: Record<string, unknown>) => ({
          id: v.id as string,
          name: v.name as string,
          role: v.role as string || "supporting",
          description: v.visualDescription as string || "",
          imageUrl: v.imageUrl as string || "",
          characterId: v.characterId as string || "",
          voiceName: v.voiceName as string || "",
        })));
      })
      .catch((err) => { console.error("loadCharacters:", err); })
      .finally(() => setLoadingChars(false));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // API Functions
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Save project to DB ──
  const saveProject = useCallback(async () => {
    if (!moviePlan && !idea.trim() && !title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        id: projectId ?? undefined,
        title, idea, expandedStory, genre, style, format, productionMode,
        planningDepth, tone, setting, duration, language,
        summary: moviePlan?.summary, storyArc: moviePlan?.storyArc,
        soundPlan: moviePlan?.soundPlan, musicDirection: moviePlan?.musicDirection,
        visualDirection: moviePlan?.visualDirection, continuityNotes: moviePlan?.continuityNotes,
        missingAssets: moviePlan?.missingAssets, reviewerNotes: moviePlan?.reviewerNotes,
        estimatedCredits: moviePlan?.estimatedCredits, cast: selectedCast,
        status: moviePlan ? "SCENES_READY" : "DRAFT",
        scenes: moviePlan?.scenes ?? [],
      };
      const res = await fetch("/api/movie-planner/project", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.project) {
        setProjectId(data.project.id);
        setLastAction("Project saved");
        fetch("/api/movie-planner/project").then(r => r.json()).then(d => {
          if (d.projects) setProjectList(d.projects);
        }).catch((err) => { console.error("refreshProjectList:", err); });
      }
    } catch (err) {
      console.error("saveProject error:", err);
      setErrorMsg(`Failed to save project: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setSaving(false);
  }, [projectId, title, idea, expandedStory, genre, style, format, productionMode, planningDepth, tone, setting, duration, language, moviePlan, selectedCast]);

  // ── Load existing project ──
  async function loadProject(id: string) {
    isRestoringRef.current = true;
    // Each project gets its own save slot so auto-saves don't cross-contaminate
    const slotKey = `ghs_movie_${id}`;
    activeProjectIdRef.current = slotKey;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/dashboard/movie-planner?projectId=${encodeURIComponent(slotKey)}`);
    }
    try {
      const res = await fetch(`/api/movie-planner/project/${id}`);
      const data = await res.json();
      if (data.project) {
        const p = data.project;
        setProjectId(p.id);
        setTitle(p.title); setIdea(p.idea); setExpandedStory(p.expandedStory ?? "");
        setGenre(p.genre ?? ""); setStyle(p.style ?? ""); setFormat(p.format ?? "");
        setProductionMode(p.productionMode ?? ""); setPlanningDepth(p.planningDepth ?? "smart");
        setTone(p.tone ?? ""); setSetting(p.setting ?? "");
        setDuration(p.duration ?? "10 min"); setLanguage(p.language ?? "English");
        if (p.cast) setSelectedCast(p.cast as Array<{ characterId: string; role: string }>);
        if (p.scenes?.length > 0) {
          setMoviePlan({
            summary: p.summary ?? "", storyArc: (p.storyArc as MoviePlan["storyArc"]) ?? { setup: "", tension: "", climax: "", resolution: "" },
            scenes: p.scenes.map((s: Record<string, unknown>) => ({ ...s, characters: s.characters ?? [] })) as SceneCard[],
            soundPlan: p.soundPlan ?? "", musicDirection: p.musicDirection ?? "",
            visualDirection: p.visualDirection ?? "", continuityNotes: (p.continuityNotes ?? []) as string[],
            missingAssets: (p.missingAssets ?? []) as string[], reviewerNotes: (p.reviewerNotes ?? []) as string[],
            estimatedCredits: p.estimatedCredits ?? 0,
          });
          setActiveTab("scenes");
          setProjectPhase("SCENES_READY");
        } else if (p.genre) {
          setActiveTab("design");
          setProjectPhase("DESIGN_SET");
        } else {
          setActiveTab("story");
          setProjectPhase("STORY_INPUT");
        }
        setShowContinue(false);
        setLastAction(`Loaded project "${p.title}"`);
      }
    } catch (err) {
      console.error("loadProject error:", err);
      setErrorMsg(`Failed to load project: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      isRestoringRef.current = false;
    }
  }

  // ── Delete project ──
  async function deleteProject(id: string) {
    await fetch(`/api/movie-planner/project/${id}`, { method: "DELETE" }).catch((err) => { console.error("deleteProject:", err); setErrorMsg(`Failed to delete project: ${err instanceof Error ? err.message : "Unknown error"}`); });
    setProjectList(prev => prev.filter(p => p.id !== id));
    if (projectId === id) { setProjectId(null); setActiveTab("design"); }
  }

  // ── New Project — save current slot, move to fresh slot ──
  async function newProject() {
    isRestoringRef.current = true;
    const key = activeProjectIdRef.current || "ghs_movie_default";
    try {
      await fetch("/api/hybrid/saved-state", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId: key, data: {
          title, idea, expandedStory, genre, style, format, tone,
          savedCharacters, selectedCast, moviePlan, sceneImages, sceneVideos,
          scriptSegments, screenplay, selectedMusicUrl, selectedMusicName,
          narrationProvider, soundTier, modelSettings, savedCuts, activeTab,
          timestamp: Date.now(),
        }}),
      });
    } catch { /* silent */ }
    const newKey = `ghs_movie_${Date.now()}`;
    activeProjectIdRef.current = newKey;
    window.history.replaceState(null, "", `/dashboard/movie-planner?projectId=${encodeURIComponent(newKey)}`);
    setProjectId(null); setTitle(""); setIdea(""); setExpandedStory("");
    setGenre(""); setStyle(""); setFormat(""); setProductionMode(""); setTone(""); setSetting("");
    setSelectedCast([]); setGeneratedCast([]);
    setMoviePlan(null); setSceneImages({}); setSceneVideos({});
    setScriptSegments([]); setScreenplay(""); setSelectedMusicUrl(null); setSelectedMusicName("");
    setSavedCuts([]); setActiveTab("design"); setProjectPhase("STORY_INPUT");
    setLastAction("New project started");
    isRestoringRef.current = false;
  }

  // ── Scene editing helpers ──
  function updateScene(sceneNum: number, patch: Partial<SceneCard>) {
    if (!moviePlan) return;
    setMoviePlan(prev => prev ? {
      ...prev,
      scenes: prev.scenes.map(s => s.scene === sceneNum ? { ...s, ...patch } : s),
    } : prev);
  }

  function moveScene(sceneNum: number, direction: "up" | "down") {
    if (!moviePlan) return;
    const sc = [...moviePlan.scenes];
    const idx = sc.findIndex(s => s.scene === sceneNum);
    if (direction === "up" && idx > 0) [sc[idx - 1], sc[idx]] = [sc[idx], sc[idx - 1]];
    if (direction === "down" && idx < sc.length - 1) [sc[idx], sc[idx + 1]] = [sc[idx + 1], sc[idx]];
    sc.forEach((s, i) => { s.scene = i + 1; });
    setMoviePlan(prev => prev ? { ...prev, scenes: sc } : prev);
  }

  function duplicateScene(sceneNum: number) {
    if (!moviePlan) return;
    const scene = moviePlan.scenes.find(s => s.scene === sceneNum);
    if (!scene) return;
    const newScenes = [...moviePlan.scenes];
    const idx = newScenes.findIndex(s => s.scene === sceneNum);
    newScenes.splice(idx + 1, 0, { ...scene, scene: 0, status: "planned" as const, generatedAssetUrl: undefined });
    newScenes.forEach((s, i) => { s.scene = i + 1; });
    setMoviePlan(prev => prev ? { ...prev, scenes: newScenes } : prev);
  }

  function deleteScene(sceneNum: number) {
    if (!moviePlan) return;
    const sc = moviePlan.scenes.filter(s => s.scene !== sceneNum);
    sc.forEach((s, i) => { s.scene = i + 1; });
    setMoviePlan(prev => prev ? { ...prev, scenes: sc } : prev);
    if (selectedScene === sceneNum) setSelectedScene(null);
  }

  // ── Cast helpers ──
  function addToCast(charId: string) {
    if (selectedCast.some(c => c.characterId === charId)) return;
    setSelectedCast(prev => [...prev, { characterId: charId, role: "Hero" }]);
  }

  function removeCast(charId: string) {
    setSelectedCast(prev => prev.filter(c => c.characterId !== charId));
  }

  function setCastRole(charId: string, role: string) {
    setSelectedCast(prev => prev.map(c => c.characterId === charId ? { ...c, role } : c));
  }

  // ── Make Scene Image ──
  async function makeSceneImage(scene: SceneCard) {
    const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
    setGeneratingSceneImage(sceneId);
    setLastAction(`Generating image for Scene ${scene.scene}...`);
    try {
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId, projectId, sceneText: `${scene.title}. ${scene.visualDescription || scene.goal}`,
          characterIds: scene.characters || [], mood: scene.musicCue,
          cameraFraming: scene.cameraDirection,
          projectStyle: sceneStyles[sceneId] || effectiveProjectStyle,
          storyEra: storyEra || undefined,
          storyCulture: storyCulture || undefined,
        }),
      });
      const data = await res.json();
      if (data.error === "unresolved_characters") {
        alert(`Cannot generate: ${data.message}`);
      } else if (data.imageUrl || data.imagePath) {
        const url = data.imageUrl || `/api/media/${data.imagePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
        setSceneImages(prev => ({ ...prev, [sceneId]: url }));
        updateScene(scene.scene, { status: "generated" as const });
        setLastAction(`Scene ${scene.scene} image generated`);
        // Save image to character profiles if they have no image yet
        const sceneCharIds: string[] = scene.characters || [];
        if (sceneCharIds.length) {
          fetch("/api/character-voices")
            .then(r => r.json())
            .then((d: { voices?: Array<{ id: string; characterId: string | null; imageUrl: string | null }> }) => {
              const voiceMap = new Map((d.voices || []).map(v => [v.characterId, v]));
              sceneCharIds.forEach(cId => {
                const voice = voiceMap.get(cId);
                if (voice && !voice.imageUrl && voice.id) {
                  fetch(`/api/character-voices/${voice.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl: url }),
                  }).catch(() => {});
                }
              });
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error("makeSceneImage error:", err);
      setErrorMsg(`Failed to generate image for Scene ${scene.scene}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingSceneImage(null);
  }

  // ── Continuous Motion ─────────────────────────────────────────────────────
  async function startContinuousMotion() {
    const prompt = expandedStory || idea || "";
    if (!prompt.trim()) { setCmError("Write a story first — Continuous Motion needs a prompt."); return; }
    setCmRunning(true); setCmStatus("Submitting plan..."); setCmError(null); setCmFinalVideoUrl(null); setCmSceneId(null);
    try {
      const res = await fetch("/api/continuous-motion/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          totalDuration: cmTotalDuration,
          segmentDuration: Math.min(cmSegmentDuration, 10),
          providerKey: cmProvider,
          projectId: projectId ?? "movie_draft",
        }),
      });
      const data = await res.json() as { sceneId?: string; status?: string; finalVideoUrl?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const sid = data.sceneId ?? "";
      setCmSceneId(sid);
      setCmStatus(data.status ?? "GENERATING");
      if (data.status === "COMPLETE" || data.status === "DONE") {
        setCmFinalVideoUrl(data.finalVideoUrl ?? null); setCmStatus("DONE"); setCmRunning(false); return;
      }
      if (sid) {
        const poll = setInterval(async () => {
          try {
            const pr = await fetch(`/api/continuous-motion/scene/${sid}`);
            const pd = await pr.json() as { status?: string; finalVideoUrl?: string };
            setCmStatus(pd.status ?? "…");
            if (pd.status === "COMPLETE" || pd.status === "DONE") {
              clearInterval(poll); setCmFinalVideoUrl(pd.finalVideoUrl ?? data.finalVideoUrl ?? null); setCmStatus("DONE"); setCmRunning(false);
            } else if (pd.status === "FAILED") {
              clearInterval(poll); setCmError("Generation failed. Check logs."); setCmRunning(false);
            }
          } catch { /* keep polling */ }
        }, 3000);
      } else { setCmStatus(data.status ?? "PLANNING"); setCmRunning(false); }
    } catch (err) { setCmError(err instanceof Error ? err.message : "Continuous Motion failed"); setCmRunning(false); }
  }

  // ── Generate All Scene Images (batch) ──
  async function generateAllSceneImages() {
    if (!moviePlan) return;
    setGeneratingAllImages(true);
    setErrorMsg(null);
    const pending = moviePlan.scenes.filter(s => {
      const sceneId = `SC${String(s.scene).padStart(2, "0")}`;
      return !sceneImages[sceneId] && s.generationMethod !== "audio-only";
    });
    setLastAction(`Generating images for ${pending.length} scenes...`);
    for (const scene of pending) {
      await makeSceneImage(scene);
    }
    setLastAction(`Batch image generation complete`);
    setGeneratingAllImages(false);
  }

  // ── Render a single scene ──
  async function renderScene(sceneNum: number) {
    if (!moviePlan) return;
    const scene = moviePlan.scenes.find(s => s.scene === sceneNum);
    if (!scene) return;
    setRenderingScene(sceneNum);
    updateScene(sceneNum, { status: "generating" });

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${scene.visualDescription}. Camera: ${scene.cameraDirection}. Style: ${genre} ${style}. Mood: ${tone}. Setting: ${setting}.`,
          model: effectiveVideoModelId,
          aspectRatio: "16:9",
        }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        updateScene(sceneNum, { status: "generated", generatedAssetUrl: data.outputUrl });
      } else {
        updateScene(sceneNum, { status: "needs_edit" });
      }
    } catch (err) {
      console.error("renderScene error:", err);
      setErrorMsg(`Failed to render Scene ${sceneNum}: ${err instanceof Error ? err.message : "Unknown error"}`);
      updateScene(sceneNum, { status: "needs_edit" });
    }
    setRenderingScene(null);
  }

  // ── AI Planning: Multi-AI cinematic expansion ──
  async function generateMoviePlan() {
    setPlanning(true);
    setMoviePlan(null);
    setLastAction("Running Multi-AI cinematic expansion...");

    const castForAI = selectedCast.map(c => {
      const char = savedCharacters.find(ch => ch.id === c.characterId);
      return char ? { name: char.name, role: c.role, description: char.description ?? "" } : null;
    }).filter(Boolean);

    try {
      const res = await fetch("/api/movie-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea, expandedStory, genre, style, format, productionMode,
          planningDepth, tone, setting, language: effectiveLanguage,
          storyAiProvider,
          characters: castForAI,
        }),
      });

      const data = await res.json();

      if (!data.scenes?.length) {
        setErrorMsg("AI planning returned no scenes. Try adding more detail to your story idea.");
        setPlanning(false);
        return;
      }

      if (data.scenes?.length > 0) {
        const planScenes: SceneCard[] = data.scenes.map((s: Record<string, unknown>) => ({
          scene: s.scene as number,
          title: (s.title as string) ?? `Scene ${s.scene}`,
          goal: (s.goal as string) ?? (s.summary as string) ?? "",
          duration: (s.duration as string) ?? "30s",
          characters: (s.characters as string[]) ?? [],
          visualDescription: (s.summary as string) ?? (s.visualDescription as string) ?? "",
          cameraDirection: (s.camera as string) ?? (s.cameraDirection as string) ?? "",
          dialogue: (s.dialogue as string) ?? "",
          soundEffects: ((s.sfx_needed as string[]) ?? []).join(", ") || ((s.soundEffects as string) ?? ""),
          ambience: (s.ambience as string) ?? "",
          musicCue: (s.music_cue as string) ?? (s.musicCue as string) ?? "",
          generationMethod: (s.generationMethod as string) ?? "image-to-video",
          costLabel: (s.costLabel as string) ?? "balanced",
          status: "planned" as const,
        }));

        const reviewerNotes: string[] = [];
        const review = data.review ?? {};
        if (review.issues) (review.issues as Array<Record<string, string>>).forEach((i: Record<string, string>) => reviewerNotes.push(`[${i.type}] Scene ${i.scene}: ${i.description}`));
        if (review.improvements) (review.improvements as Array<Record<string, string>>).forEach((i: Record<string, string>) => reviewerNotes.push(`[improve] Scene ${i.scene}: ${i.suggestion}`));
        if (review.missing_scenes) (review.missing_scenes as string[]).forEach((s: string) => reviewerNotes.push(`[missing] ${s}`));
        if (data.continuityIssues) (data.continuityIssues as string[]).forEach((c: string) => reviewerNotes.push(`[continuity] ${c}`));
        if (data.missingSfx?.length > 0) reviewerNotes.push(`[sfx] ${data.missingSfx.length} sound effects need AI generation or external retrieval`);
        if (selectedCast.length === 0) reviewerNotes.push("[cast] No characters selected — AI used generic characters. Select from saved characters for better results.");

        const plan: MoviePlan = {
          summary: planScenes.map(s => s.goal).join(". "),
          storyArc: { setup: planScenes[0]?.goal ?? "", tension: planScenes[Math.floor(planScenes.length / 3)]?.goal ?? "", climax: planScenes[Math.floor(planScenes.length * 2 / 3)]?.goal ?? "", resolution: planScenes[planScenes.length - 1]?.goal ?? "" },
          scenes: planScenes,
          soundPlan: `Multi-AI analyzed sound design: ${data.sfxResolution?.stats?.total ?? 0} SFX identified, ${data.sfxResolution?.stats?.high_confidence ?? 0} matched from library`,
          musicDirection: `${genre} score — ${tone} mood. AI-planned per scene.`,
          visualDirection: `${setting} setting. ${style} approach. ${format} output format.`,
          continuityNotes: data.continuityIssues ?? [],
          missingAssets: data.missingSfx?.map((s: Record<string, string>) => `SFX needed: ${s.need}`) ?? [],
          reviewerNotes,
          estimatedCredits: format === "audio_only" ? 5 : format === "video_first" ? planScenes.length * 5 : planScenes.length * 3,
        };

        setMoviePlan(plan);
        setActiveTab("scenes");
        setProjectPhase("SCENES_READY");
        setLastAction(`Movie plan generated: ${planScenes.length} scenes`);
        setTimeout(() => saveProject(), 500);
      }
    } catch (err) {
      console.error("generateMoviePlan error:", err);
      setErrorMsg(`AI planning failed: ${err instanceof Error ? err.message : "Unknown error"}. Check your connection and try again.`);
    }
    setPlanning(false);
  }

  // ── Expand Story + Extract Characters + Build Scenes (3-step pipeline) ──
  async function expandStory() {
    if (!idea.trim()) return;
    setExpanding(true);
    setErrorMsg(null);
    setLastAction("AI is reading your story and building the full production plan...");
    try {
      // STEP 1: Story Expansion
      const storyInputWithStyle = style ? `${idea.trim()}\n\nVisual style: ${style}` : idea.trim();
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: storyInputWithStyle,
          genre: genre || undefined,
          tone: tone || undefined,
          language: effectiveLanguage,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          tier: aiTier,
          styleHint: style || undefined,
          storyEra: storyEra || undefined,
          storyCulture: storyCulture || undefined,
        }),
      });
      const expandData = await expandRes.json();
      if (!expandRes.ok || expandData.ok === false) {
        setErrorMsg(expandData.error || "Story expansion failed. Try again.");
        setExpanding(false);
        return;
      }
      const expandedObj = expandData.expandedStory || {};
      const storySummary: string = expandedObj.summary || expandData.summary || idea;
      setExpandedStory(storySummary);
      setLastAction("Story expanded — extracting characters...");

      // STEP 2: Character Extraction
      const charRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: expandedObj,
          projectId: projectId || undefined,
        }),
      });
      const charData = await charRes.json();
      const extractedChars: Character[] = [];
      if (charData.characters?.length > 0) {
        charData.characters.forEach((c: Record<string, unknown>, i: number) => {
          extractedChars.push({
            id: (c.characterId as string) || `CH${String(i + 1).padStart(2, "0")}`,
            name: (c.name as string) || (c.displayName as string) || `Character ${i + 1}`,
            role: (c.role as string) || "supporting",
            description: (c.visualDescription as string) || "",
            characterId: (c.characterId as string) || `CH${String(i + 1).padStart(2, "0")}`,
          });
        });
        const seenNames = new Set<string>();
        const deduped = extractedChars.filter(c => {
          const key = c.name.toLowerCase();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });
        setSavedCharacters(prev => {
          const combined = [...prev];
          deduped.forEach(nc => { if (!combined.some(c => c.name.toLowerCase() === nc.name.toLowerCase())) combined.push(nc); });
          return combined;
        });
        setSelectedCast(prev => {
          const combined = [...prev];
          deduped.forEach(nc => { if (!combined.some(c => c.characterId === nc.id)) combined.push({ characterId: nc.id, role: nc.role || "Hero" }); });
          return combined;
        });
        setLastAction(`${deduped.length} characters found — planning scenes...`);
      }

      // STEP 3: Scene Breakdown
      const sceneSummary = style ? `${storySummary}\n\nVisual style: ${style}` : storySummary;
      const charRegistryMap = new Map(savedCharacters.map(sc => [sc.id, sc]));
      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: sceneSummary,
          characters: extractedChars.map(c => {
            const reg = charRegistryMap.get(c.id);
            return {
              characterId: c.id,
              displayName: c.name,
              role: c.role,
              visualDescription: c.description || reg?.description || "",
            };
          }),
          genre: genre || undefined,
          tone: tone || undefined,
          projectId: projectId || undefined,
          styleHint: style || undefined,
          storyEra: storyEra || undefined,
          storyCulture: storyCulture || undefined,
        }),
      });
      const sceneData = await safeJson<{ scenes?: Record<string, unknown>[] }>(sceneRes, "scene-plan");
      const movieScenes = sceneData.scenes ?? [];
      if (movieScenes.length > 0) {
        const planScenes: SceneCard[] = movieScenes.map((s: Record<string, unknown>, i: number) => ({
          scene: i + 1,
          title: (s.title as string) || `Scene ${i + 1}`,
          goal: (s.description as string) || (s.narrativeDescription as string) || "",
          duration: `${(s.durationEstimate as number) || 5}s`,
          characters: (s.characterIds as string[]) || [],
          visualDescription: (s.description as string) || "",
          cameraDirection: "",
          dialogue: s.narrationScript as string || "",
          soundEffects: (s.soundSuggestion as string) || "",
          ambience: "",
          musicCue: (s.musicSuggestion as string) || "",
          generationMethod: "image-to-video" as const,
          costLabel: "balanced" as const,
          status: "planned" as const,
        }));
        setMoviePlan(prev => {
          const base: MoviePlan = prev ?? {
            summary: storySummary,
            storyArc: { setup: planScenes[0]?.goal ?? "", tension: planScenes[Math.floor(planScenes.length / 3)]?.goal ?? "", climax: planScenes[Math.floor(planScenes.length * 2 / 3)]?.goal ?? "", resolution: planScenes[planScenes.length - 1]?.goal ?? "" },
            scenes: [], soundPlan: "", musicDirection: "", visualDirection: "", continuityNotes: [], missingAssets: [], reviewerNotes: [], estimatedCredits: planScenes.length * 2,
          };
          return { ...base, scenes: planScenes };
        });
        setProjectPhase("SCENES_READY");
        setLastAction(`Story expanded · ${extractedChars.length} characters · ${planScenes.length} scenes ready`);
        setActiveTab("story");
        // auto-run scene intelligence after planning
        setTimeout(() => runSceneIntelligence(), 500);
      } else {
        setLastAction(`Story expanded · ${extractedChars.length} characters ready`);
      }
    } catch (err) {
      console.error("expandStory failed:", err);
      setErrorMsg("Story expansion failed: " + String(err));
    }
    setExpanding(false);
  }

  // ── AI Production Plan (FIX 2) ──
  async function generateProductionPlan() {
    if (!idea.trim()) { setLastAction("Write your movie idea first"); return; }
    setGeneratingProductionPlan(true);
    setLastAction("AI is reading your story and building production plan...");
    try {
      // Try /api/movie/plan first; fall back to story-expand
      const res = await fetch("/api/movie/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyText: idea, mode: "movie-plan", genre: genre || "Drama", tone: tone || "Cinematic" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scenes || data.plan) {
          const plan = data.plan ?? data;
          setAiProductionPlan({
            scenes: plan.scenes ?? [],
            musicMood: plan.musicMood ?? "Cinematic",
            visualStyle: plan.visualStyle ?? style ?? "Cinematic",
            narratorTone: plan.narratorTone ?? tone ?? "Neutral",
            sceneCount: (plan.scenes ?? []).length,
            pacing: plan.pacing ?? "Standard",
            generatedAt: new Date().toISOString(),
          });
          setShowProductionPlan(true);
          setLastAction(`AI Production Plan: ${(plan.scenes ?? []).length} scenes, ${plan.musicMood ?? ""} music mood`);
          return;
        }
      }
      // Fallback: use story-expand endpoint
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyInput: idea, genre, tone, mode: "movie-plan", storyEra: storyEra || undefined, storyCulture: storyCulture || undefined }),
      });
      const expandData = await expandRes.json();
      const summary = expandData.expandedStory?.summary || expandData.summary || idea;
      setAiProductionPlan({
        scenes: [],
        musicMood: genre?.toLowerCase().includes("action") ? "Intense / Dramatic" : "Cinematic / Emotional",
        visualStyle: style || "Cinematic",
        narratorTone: tone || "Neutral",
        sceneCount: 0,
        pacing: tone?.toLowerCase().includes("fast") ? "Fast" : "Standard",
        generatedAt: new Date().toISOString(),
      });
      setExpandedStory(summary);
      setShowProductionPlan(true);
      setLastAction("AI Production Plan created — review below");
    } catch (err) {
      setLastAction("Production plan failed: " + String(err));
    }
    setGeneratingProductionPlan(false);
  }

  // ── Scene Intelligence ──
  async function runSceneIntelligence() {
    if (scenes.length === 0) return;
    setRunningIntelligence(true);
    try {
      const res = await fetch("/api/hybrid/scene-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenes.map(s => ({
            sceneId: `SC${String(s.scene).padStart(2, "0")}`,
            title: s.title,
            description: s.goal || s.visualDescription,
            location: undefined,
            timeOfDay: undefined,
            mood: undefined,
          })),
          storyContext: idea,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.intelligence)) {
        const map: Record<string, SceneIntelligenceData> = {};
        for (const item of data.intelligence) map[item.sceneId] = item;
        setSceneIntelligence(map);
        setMoviePlan(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            scenes: prev.scenes.map(s => {
              const sceneId = `SC${String(s.scene).padStart(2, "0")}`;
              const intel = map[sceneId];
              if (!intel) return s;
              return {
                ...s,
                ambience: s.ambience || intel.ambienceSounds.slice(0, 3).join(", "),
                soundEffects: s.soundEffects || intel.sfxEvents.slice(0, 4).join(", "),
              };
            }),
          };
        });
      }
    } catch (err) {
      console.warn("Scene intelligence failed:", err);
    }
    setRunningIntelligence(false);
  }

  // ── Load music from asset library ──
  async function loadMusicLibrary() {
    setLoadingMusic(true);
    try {
      const res = await fetch("/api/assets?type=music");
      const data = await res.json();
      setMusicLibrary((data.assets || data || []).filter((a: MusicAsset) => a.filePath || a.id));
    } catch { /* best effort */ }
    setLoadingMusic(false);
  }

  // ── AI Pick Music ──
  async function aiPickMusic() {
    setAiPickingMusic(true);
    setAiMusicPickLog("Loading music library...");
    try {
      let tracks = musicLibrary;
      if (tracks.length === 0) {
        const res = await fetch("/api/assets?type=music");
        const data = await res.json();
        tracks = (data.assets || data || []).filter((a: MusicAsset) => a.filePath || a.id);
        setMusicLibrary(tracks);
      }
      if (tracks.length === 0) {
        setAiMusicPickLog("No music in library. Add tracks first.");
        setAiPickingMusic(false);
        return;
      }
      const storyContext = expandedStory ? expandedStory.slice(0, 400) : idea.slice(0, 400);
      const moodTags = scenes.flatMap(s => [s.musicCue, s.ambience].filter(Boolean)).slice(0, 12).join(", ");
      const trackList = tracks.map((t, i) => `${i + 1}. "${t.name}"${t.tags?.length ? ` [${t.tags.slice(0, 4).join(", ")}]` : ""}`).join("\n");
      setAiMusicPickLog("Asking AI to pick best track...");
      const prompt = `You are a music supervisor. Based on the story and music tracks, pick the best background track.\n\nSTORY:\n${storyContext}\n\nMOOD CUES: ${moodTags || "cinematic, dramatic"}\n\nAVAILABLE TRACKS:\n${trackList}\n\nReply with ONLY JSON: {"trackNumber": 2, "trackName": "exact name", "reason": "one sentence"}`;
      const llmRes = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, role: "quality", maxTokens: 200 }),
      });
      if (!llmRes.ok) throw new Error(`LLM error ${llmRes.status}`);
      const llmData = await llmRes.json();
      const raw = (llmData.text || llmData.response || "").trim();
      let picked: { trackNumber?: number; trackName?: string; reason?: string } = {};
      try {
        const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
        if (start !== -1 && end > start) picked = JSON.parse(raw.slice(start, end + 1));
      } catch { /* ignore */ }
      const match = tracks.find(t => t.name.toLowerCase() === (picked.trackName || "").toLowerCase())
        || (picked.trackNumber ? tracks[picked.trackNumber - 1] : null);
      if (match) {
        const mediaUrl = assetToMediaUrl(match.filePath);
        setSelectedMusicUrl(mediaUrl);
        setSelectedMusicName(match.name);
        setAiMusicPickLog(`Selected: "${match.name}"${picked.reason ? ` — ${picked.reason}` : ""}`);
      } else {
        setAiMusicPickLog(`Could not match track. AI said: ${raw.slice(0, 120)}`);
      }
    } catch (err) {
      setAiMusicPickLog(`AI pick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAiPickingMusic(false);
  }

  // ── Generate Movie Music ──
  async function generateMovieMusic() {
    setMusicGenerating(true);
    try {
      // Resolve providerKey from the selected SOUND_TIERS_MOVIE entry
      const activeTier = SOUND_TIERS_MOVIE.find(t => t.id === effectiveSoundTier);
      const resolvedProviderKey = activeTier?.providerKey ?? "stock";
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${tone || "cinematic"} background score for a movie — ${genre || "drama"}`,
          durationSeconds: 30,
          providerKey: resolvedProviderKey,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        throw new Error(`Music error ${res.status}: ${errBody}`);
      }
      const data = await res.json() as { url?: string; audioUrl?: string; fallbackReason?: string; error?: string };
      if (data.error) throw new Error(data.error);
      const url = data.url ?? data.audioUrl ?? "";
      if (url) {
        setSelectedMusicUrl(url);
        setSelectedMusicName(`AI Generated (${activeTier?.label ?? "Stock"})`);
        if (data.fallbackReason) setAiMusicPickLog(`Note: ${data.fallbackReason}`);
      } else {
        throw new Error("No music URL returned");
      }
    } catch (err) {
      setAiMusicPickLog(`Music error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setMusicGenerating(false);
  }

  // ── Generate Screenplay (AI) ──
  async function generateScreenplay() {
    if (!expandedStory && !idea.trim()) { setScreenplayError("Write or expand your story first."); return; }
    setGeneratingScreenplay(true);
    setScreenplayError("");
    try {
      const res = await fetch("/api/hybrid/screenplay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, summary: expandedStory || idea,
          scenes: moviePlan?.scenes ?? [],
          genre, tone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setScreenplayError(data.error || "Screenplay generation failed.");
      } else {
        setScreenplay(data.screenplay || "");
      }
    } catch (err) {
      setScreenplayError(err instanceof Error ? err.message : "Screenplay generation failed.");
    }
    setGeneratingScreenplay(false);
  }

  // ── Parse Script into segments (narrator + dialogue) ──
  async function parseScript() {
    const textToParse = screenplay || expandedStory || idea;
    if (!textToParse.trim()) { setErrorMsg("Write or expand your story first."); return; }
    setParsingScript(true);
    try {
      const res = await fetch("/api/hybrid/parse-script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToParse,
          knownCharacters: savedCharacters.map(c => c.name),
        }),
      });
      const data = await res.json();
      if (data.ok && data.segments) {
        setScriptSegments(data.segments);
        setShowScriptReview(true);
        setLastAction(`Script parsed — ${data.segments.length} segments`);
      } else {
        setErrorMsg(data.error || "Script parsing failed");
      }
    } catch (err) {
      setErrorMsg("Script parse error: " + String(err));
    }
    setParsingScript(false);
  }

  // ── Send screenplay blocks to scene narration fields ──
  async function sendScreenplayToScenes() {
    if (!screenplay || !moviePlan) return;
    setSendingToScenes(true);
    setSendToScenesResult("");
    const lines = screenplay.split("\n");
    const sceneBlocks: Array<{ sceneNum: number; lines: string[] }> = [];
    let currentBlock: string[] = [];
    let currentSceneNum = 0;
    lines.forEach(line => {
      const trimmed = line.trim();
      if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed)) {
        if (currentBlock.length > 0 && currentSceneNum > 0) {
          sceneBlocks.push({ sceneNum: currentSceneNum, lines: currentBlock });
        }
        currentSceneNum++;
        currentBlock = [trimmed];
      } else {
        currentBlock.push(trimmed);
      }
    });
    if (currentBlock.length > 0 && currentSceneNum > 0) sceneBlocks.push({ sceneNum: currentSceneNum, lines: currentBlock });
    sceneBlocks.forEach(block => {
      const scene = moviePlan.scenes.find(s => s.scene === block.sceneNum);
      if (scene) {
        const narration = block.lines.filter(l => l && !/^[A-Z][A-Z\s\-'().]+$/.test(l) && !l.startsWith("(")).join(" ");
        updateScene(scene.scene, { dialogue: narration });
      }
    });
    setSendToScenesResult(`Screenplay sent to ${sceneBlocks.length} scenes. Go to Audio to generate narration.`);
    setSendingToScenes(false);
    await parseScript();
  }

  // ── Run Validation ──
  async function runValidation() {
    setValidating(true);
    try {
      const errors: string[] = [];
      const warns: string[] = [];
      if (!title.trim()) errors.push("Movie title is missing");
      if (totalScenes === 0) errors.push("No scenes created");
      if (selectedCast.length === 0) warns.push("No characters in cast");
      scenes.forEach(s => {
        if (!s.title) errors.push(`Scene ${s.scene}: Missing title`);
        if (s.characters.length === 0) warns.push(`Scene ${s.scene}: No characters`);
        const sid = `SC${String(s.scene).padStart(2, "0")}`;
        if (!sceneImages[sid] && s.generationMethod !== "audio-only") warns.push(`Scene ${s.scene}: No scene image`);
      });
      setValidation({ valid: errors.length === 0, errors, warnings: warns });
    } catch (err) {
      console.error("runValidation error:", err);
      setErrorMsg(`Validation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setValidating(false);
  }

  // ── Pre-flight check before assembly ──
  async function runPreflight() {
    setPreflightRunning(true);
    try {
      const sceneList = scenes.map(s => {
        const sceneId = `SC${String(s.scene).padStart(2, "0")}`;
        return { sceneId, imageUrl: sceneImages[sceneId] || s.generatedAssetUrl || null, videoUrl: sceneVideos?.[sceneId] || null, title: s.title };
      });
      const charList = savedCharacters.filter(c => selectedCast.some(sc => sc.characterId === c.id)).map(c => ({ id: c.id, name: c.name, voiceId: c.characterId, voiceName: c.voiceName }));
      const res = await fetch("/api/hybrid/pre-flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectType: "movie",
          scenes: sceneList,
          audioConfig: { narrationProvider: effectiveNarrationProvider, musicUrl: selectedMusicUrl, musicName: selectedMusicName },
          characters: charList,
        }),
      });
      const data = await safeJson<{ checks: PreflightCheck[]; canAssemble: boolean; blockingErrors: number; warnings: number }>(res, "pre-flight");
      setPreflightResult(data);
    } catch (err) {
      console.error("preflight error:", err);
    } finally {
      setPreflightRunning(false);
    }
  }

  // ── Generate Cast from Story (AI extracts characters from the expanded story) ──
  async function generateCastFromStory() {
    const storyText = expandedStory || idea;
    if (!storyText.trim()) {
      setCastGenError("Write your story first before generating cast.");
      return;
    }
    setCastGenerating(true);
    setCastGenError(null);
    try {
      const expandedPayload = { summary: storyText, characterList: [] };
      const res = await fetch("/api/hybrid/character-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expandedStory: expandedPayload, projectId }),
      });
      const data = await safeJson<{ characters: Array<{ characterId: string; name: string; role: string; gender: string; age: string; voiceId: string; voiceName: string; dbId: string }>; error?: string }>(res, "cast-generate");
      if (data.error) {
        setCastGenError(data.error);
        return;
      }
      const chars: Character[] = (data.characters || []).map(c => ({
        id: c.dbId || c.characterId,
        name: c.name,
        role: c.role || "supporting",
        description: "",
        imageUrl: "",
        characterId: c.characterId,
        voiceName: c.voiceName || "",
      }));
      setGeneratedCast(chars);
      // Merge into savedCharacters (deduplicate by id)
      setSavedCharacters(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newChars = chars.filter(c => !existingIds.has(c.id));
        return [...prev, ...newChars];
      });
      // Auto-add all to cast
      chars.forEach(c => addToCast(c.id));
      setLastAction(`AI generated ${chars.length} cast member${chars.length !== 1 ? "s" : ""} from story`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cast generation failed";
      setCastGenError(msg);
      setErrorMsg(msg);
    } finally {
      setCastGenerating(false);
    }
  }

  // ── De-vocabularize: simplify the movie idea for a target reading/writing age ──
  async function devocarize(age: number) {
    const text = idea.trim();
    if (!text) { setLastAction("Add movie idea first"); return; }
    setDevocarizing(true);
    setLastAction(`Simplifying story for age ${age}…`);
    try {
      const res = await fetch("/api/children/devocarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, age }),
      });
      const data = await res.json() as { simplified?: string; error?: string; model?: string };
      if (!res.ok || !data.simplified) {
        setLastAction(`De-vocarize failed: ${data.error || `HTTP ${res.status}`}`);
        return;
      }
      setIdea(data.simplified);
      setLastAction(`Simplified for age ${age} via ${data.model || "LLM"}`);
    } catch (err) {
      setLastAction(`De-vocarize error: ${(err as Error)?.message?.slice(0, 100) || "unknown"}`);
    } finally {
      setDevocarizing(false);
    }
  }

  // ── Assemble Final Movie ──
  async function assembleMovie() {
    if (!moviePlan) return;
    try { await requireGate(); } catch { return; }
    setAssembling(true);
    setAssemblyComplete(false);
    setErrorMsg(null);
    const progress: Record<number, string> = {};
    scenes.forEach(s => { progress[s.scene] = "queued"; });
    setAssemblyProgress({ ...progress });

    try {
      // Build scenes array: only include selected scenes, check for video first then image
      const assemblyScenes: Array<{ scene: number; videoUrl: string }> = [];
      const skipped: number[] = [];
      const selectedScenes = moviePlan.scenes.filter(s => assemblySelectedIds.includes(`SC${String(s.scene).padStart(2, "0")}`));

      for (const s of selectedScenes) {
        const videoUrl = sceneVideos[`SC${String(s.scene).padStart(2, "0")}`] || s.generatedAssetUrl;
        const sceneId = `SC${String(s.scene).padStart(2, "0")}`;
        const imageUrl = sceneImages[sceneId];

        const pref = assemblyMediaPrefs[sceneId];
        const useVideo = pref === "video" ? !!videoUrl : pref === "image" ? false : !!videoUrl;
        if (useVideo && videoUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl });
        } else if (imageUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl: `img:${imageUrl}` });
        } else if (videoUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl });
        } else {
          skipped.push(s.scene);
        }
      }

      if (skipped.length > 0) {
        setErrorMsg(`Warning: Scenes ${skipped.join(", ")} have no video or image and were skipped.`);
      }

      if (assemblyScenes.length === 0) {
        setErrorMsg("No scenes have video or images to assemble. Generate scene content first.");
        setAssembling(false);
        return;
      }

      for (const s of assemblyScenes) {
        progress[s.scene] = "processing";
        setAssemblyProgress({ ...progress });
        await new Promise(resolve => setTimeout(resolve, 200));
        progress[s.scene] = "done";
        setAssemblyProgress({ ...progress });
      }

      // Build scene duration lookup from narration text for accurate startTime offsets
      const sceneDurations: Record<number, number> = {};
      for (const s of selectedScenes) {
        const narText = (s as { narrationScript?: string }).narrationScript || "";
        sceneDurations[s.scene] = estimateTextDuration(narText);
      }

      // ── AUTO-GENERATE PER-SCENE NARRATION IF MISSING (Henry 2026-05-30) ──
      // Mirror of children #10 fix (commit 0b57265). Movie planner assembly only
      // included narration for scenes that had previously had `Generate Narration`
      // clicked per-scene; otherwise the final video was silent. Now we batch-fill
      // any scene with dialogue but no audio before building narrationList.
      const localUrls: Record<number, string> = { ...sceneNarrationAudioUrls };
      const scenesNeedingTts = assemblyScenes
        .filter(s => !localUrls[s.scene])
        .map(s => selectedScenes.find(ss => ss.scene === s.scene))
        .filter((s): s is typeof selectedScenes[number] => !!s && !!(s as { dialogue?: string }).dialogue?.trim());
      if (scenesNeedingTts.length > 0) {
        setLastAction(`Auto-generating narration for ${scenesNeedingTts.length} scene${scenesNeedingTts.length === 1 ? "" : "s"} (${effectiveNarrationProvider})...`);
        for (const s of scenesNeedingTts) {
          await generateSceneNarration(s);
          // generateSceneNarration writes into setSceneNarrationAudioUrls async — mirror locally too
          // so the narrationList build below picks it up without a re-render race.
          // We re-read sceneNarrationAudioUrls via closure on next event loop tick:
          await new Promise(r => setTimeout(r, 50));
        }
        // Refresh local copy from latest state — small race possible but acceptable for a sequential generation.
        // The user-visible side effect (audio appearing in scene cards) is unchanged.
        const fresh = sceneNarrationAudioUrls;
        Object.keys(fresh).forEach(k => { localUrls[+k] = fresh[+k]; });
      }

      // Build narration list from per-scene TTS audio — include all scenes with audio
      const narrationList = assemblyScenes
        .filter(s => localUrls[s.scene])
        .map((s, idx) => ({
          audioUrl: localUrls[s.scene],
          startTime: assemblyScenes.slice(0, idx).reduce((acc, prev) => acc + (sceneDurations[prev.scene] ?? 5), 0),
          volume: 1.0,
        }));

      // Collect any character voice audio from saved characters (if character has voiceId)
      const characterVoices = selectedCast
        .map(sc => {
          const char = savedCharacters.find(c => c.id === sc.characterId);
          return char?.voiceName ? { characterId: sc.characterId, voiceName: char.voiceName, role: sc.role } : null;
        })
        .filter(Boolean);

      // TODO(pacing): movie-planner has no pacingPlan state — pacingEntries not sent.
      // Add a word-timed narration plan here if movie-planner ever gains per-word pacing.
      const res = await fetch("/api/video/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title: assemblyName || title,
          scenes: assemblyScenes,
          // Audio parameters — REQUIRED for narration/voice/SFX in output
          narrationUrl: narrationList.length === 1 ? narrationList[0].audioUrl : undefined,
          narrationList: narrationList.length > 1 ? narrationList : undefined,
          musicUrl: selectedMusicUrl || undefined,
          musicVolume: 0.35,
          narrationVolume: 1.0,
          sfx: sfxGeneratedUrl ? [{ sourceUrl: sfxGeneratedUrl, startTime: 0, volume: 0.7 }] : undefined,
          characterVoices: characterVoices.length > 0 ? characterVoices : undefined,
          subtitleConfig: effectiveSubtitleConfig,
          introUrl: introUrl || undefined,
          outroUrl: outroUrl || undefined,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        setErrorMsg(`Assembly error (${res.status}): ${errText.slice(0, 200)}`);
        setAssembling(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setErrorMsg(`Assembly API error: ${data.error}`);
      } else if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        // Save to asset library
        try {
          await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title || "Untitled Movie",
              type: "video",
              url: data.outputUrl,
              projectId,
              metadata: { genre, style, format, scenes: totalScenes },
            }),
          });
        } catch (err) {
          console.error("saveToAssetLibrary:", err);
        }
      }
      setAssemblyComplete(true);
      setLastAction("Assembly complete");
    } catch (err) {
      console.error("assembleMovie error:", err);
      setErrorMsg(`Assembly failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setAssembling(false);
    saveProject();
  }

  // ── Drag handlers ──
  const handleDragStart = useCallback((sceneNum: number) => { setDragSource(sceneNum); }, []);
  const handleDrop = useCallback((targetNum: number) => {
    if (dragSource === null || dragSource === targetNum || !moviePlan) return;
    const arr = [...moviePlan.scenes];
    const srcIdx = arr.findIndex(s => s.scene === dragSource);
    const tgtIdx = arr.findIndex(s => s.scene === targetNum);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = arr.splice(srcIdx, 1);
    arr.splice(tgtIdx, 0, moved);
    arr.forEach((s, i) => { s.scene = i + 1; });
    setMoviePlan(prev => prev ? { ...prev, scenes: arr } : prev);
    setDragSource(null);
  }, [dragSource, moviePlan]);

  // ── Make Scene Video (SSE streaming, same as Hybrid Planner) ──
  async function makeSceneVideo(scene: SceneCard) {
    const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
    const existingImage = sceneImages[sceneId];
    if (!existingImage) {
      setErrorMsg(`Scene ${scene.scene} needs an image first. Click "Make Image" before making a video.`);
      return;
    }
    setGeneratingSceneVideos(prev => new Set(prev).add(sceneId));
    setSceneGenProgress(prev => ({ ...prev, [sceneId]: { percent: 2, message: "Connecting..." } }));
    setLastAction(`Generating video for Scene ${scene.scene}...`);
    try {
      const response = await fetch("/api/hybrid/scene-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId, projectId,
          sceneText: `${scene.title}. ${scene.visualDescription || scene.goal}`,
          imageUrl: existingImage,
          duration: 5,
          motionDescription: scene.cameraDirection || "",
        }),
      });
      if (!response.body) throw new Error("No response stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (evt.type === "progress") {
              setSceneGenProgress(prev => ({ ...prev, [sceneId]: { percent: evt.percent as number, message: evt.message as string } }));
            } else if (evt.type === "done") {
              const videoUrl = evt.videoUrl as string;
              setSceneGenProgress(prev => ({ ...prev, [sceneId]: { percent: 100, message: "Done!" } }));
              setTimeout(() => setSceneGenProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; }), 2000);
              setSceneVideoVersions(prev => ({ ...prev, [sceneId]: [...(prev[sceneId] || []).slice(-4), videoUrl] }));
              setSceneVideos(prev => ({ ...prev, [sceneId]: videoUrl }));
              updateScene(scene.scene, { status: "generated" as const });
              setLastAction(`Scene ${scene.scene} video ready`);
            } else if (evt.type === "error") {
              setSceneGenProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
              setErrorMsg(`Video failed: ${evt.message as string}`);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      setSceneGenProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
      setErrorMsg(`Video generation failed for Scene ${scene.scene}.`);
      console.error("makeSceneVideo:", err);
    }
    setGeneratingSceneVideos(prev => { const s = new Set(prev); s.delete(sceneId); return s; });
  }

  // ── FreeSound search / save ──
  async function searchFreesound(q?: string) {
    const query = q ?? fsQuery;
    if (!query.trim()) return;
    setFsSearching(true);
    setFsResults([]);
    try {
      const res = await fetch(`/api/sfx/freesound?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.noKey) { setFsNoKey(true); return; }
      setFsNoKey(false);
      setFsResults(data.results || []);
    } catch { setErrorMsg("Freesound search failed"); }
    finally { setFsSearching(false); }
  }

  async function saveFreesound(sound: { id: number; name: string; previewUrl: string; license: string; username: string; duration: number; tags: string[] }) {
    setFsSaving(sound.id);
    try {
      const res = await fetch("/api/sfx/freesound", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sound),
      });
      const data = await res.json();
      if (data.ok) { setFsSaved(prev => new Set([...prev, sound.id])); setLastAction(`"${sound.name}" saved to SFX library`); }
      else setErrorMsg(data.error || "Save failed");
    } catch { setErrorMsg("Save failed"); }
    finally { setFsSaving(null); }
  }

  async function generateElevenLabsSfx() {
    if (!sfxDesc.trim()) return;
    setSfxGenerating(true);
    setSfxGeneratedUrl(null);
    try {
      const res = await fetch("/api/sfx/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: sfxDesc.trim(), autoSfx, mode: autoSfx ? "auto" : undefined }),
      });
      const data = await res.json();
      if (data.fileUrl) { setSfxGeneratedUrl(data.fileUrl); setLastAction(`SFX generated: "${sfxDesc.slice(0, 30)}"`); }
      else setErrorMsg(data.error || "SFX generation failed");
    } catch { setErrorMsg("SFX generation failed"); }
    finally { setSfxGenerating(false); }
  }

  // ── Generate narration audio per scene ──
  async function generateSceneNarration(scene: SceneCard) {
    const text = scene.dialogue;
    if (!text?.trim()) { setErrorMsg(`Scene ${scene.scene} has no narration text. Add text first.`); return; }
    setLastAction(`Generating narration audio for Scene ${scene.scene} via ${effectiveNarrationProvider}...`);
    try {
      // Route to /api/tts for cloud providers, narrate-piper for local
      const endpoint = (effectiveNarrationProvider === "fal-narrator" || effectiveNarrationProvider === "elevenlabs")
        ? "/api/tts"
        : "/api/hybrid/narrate-piper";
      const payload = (effectiveNarrationProvider === "fal-narrator" || effectiveNarrationProvider === "elevenlabs")
        ? { text, provider: effectiveNarrationProvider, speed: 0.85 }
        : { text, sceneId: `SC${String(scene.scene).padStart(2, "0")}`, model: "en_US-lessac-medium", speed: 0.85, provider: effectiveNarrationProvider };
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.audioUrl || data.filePath) {
        const audioUrl: string = data.audioUrl || `/api/media/${(data.filePath as string).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
        setSceneNarrationAudioUrls(prev => ({ ...prev, [scene.scene]: audioUrl }));
        setLastAction(`Scene ${scene.scene} narration audio ready`);
      } else {
        setErrorMsg(data.error || "Narration generation failed");
      }
    } catch (err) {
      setErrorMsg(`Narration failed for Scene ${scene.scene}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ── Scene Polish — improve scene description via LLM ─────────────
  async function handlePolishScene(sceneId: string, currentText: string, action: "polish" | "upgrade" | "add-detail") {
    if (!currentText?.trim()) return;
    setPolishingScene(sceneId);
    try {
      const res = await fetch("/api/hybrid/scene-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, currentText, action }),
      });
      const data = await res.json();
      if (data.polishedText) {
        const sceneNum = parseInt(sceneId.replace("SC", ""), 10);
        updateScene(sceneNum, { visualDescription: data.polishedText });
        setLastAction(`Scene ${sceneId}: polished — regenerating image...`);
        // Auto-regen image with polished description
        const updatedScene = scenes.find(s => s.scene === sceneNum);
        if (updatedScene) {
          await makeSceneImage({ ...updatedScene, visualDescription: data.polishedText });
        }
      } else if (data.error) {
        setLastAction(`Polish failed: ${data.error}`);
      }
    } catch (err) {
      console.error("[handlePolishScene movie] error:", err);
      setLastAction("Scene polish failed — check console");
    } finally {
      setPolishingScene(null);
    }
  }

  // ── Scene Edit Op — Hybrid-style toolbar (add_action, intense, emotional, etc.) ──
  // Wires Movie planner to /api/hybrid/scene-edit using op:"polish" + polishMode = our op name.
  async function handleSceneOp(sceneId: string, currentText: string, op: "add_action" | "intense" | "reduce_action" | "emotional" | "establish" | "qc") {
    if (!currentText?.trim()) { setLastAction("Scene has no description to edit"); return; }
    setPolishingScene(sceneId);
    try {
      const sceneNum = parseInt(sceneId.replace("SC", ""), 10);
      const sceneObj = scenes.find(s => s.scene === sceneNum);
      // establish/qc don't have a polishMode — route them differently when API supports
      const isPolishOp = ["add_action", "intense", "reduce_action", "emotional"].includes(op);
      const body = isPolishOp
        ? { op: "polish", polishMode: op, scene: { id: sceneId, title: sceneObj?.title || "", description: currentText } }
        : op === "establish"
        ? { op: "establish", scene: { id: sceneId, title: sceneObj?.title || "", description: currentText } }
        : { op: "polish", polishMode: "default", scene: { id: sceneId, title: sceneObj?.title || "", description: currentText } };
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const newText = data.scene?.description || data.newDescription || data.polishedText || data.text;
      if (newText && data.ok !== false) {
        updateScene(sceneNum, { visualDescription: newText });
        setLastAction(`Scene ${sceneId}: ${op} applied — regenerating image...`);
        // Henry 2026-05-30 task #34: mirror the children fix (#9). handleSceneOp
        // previously updated text only; user saw no visible change because the
        // scene image stayed stale. Now auto-regen the image after text update.
        // Skip for the "qc" op which doesn't change the visual.
        if (op !== "qc" && sceneObj) {
          await makeSceneImage({ ...sceneObj, visualDescription: newText });
        }
        setLastAction(`Scene ${sceneId}: ${op} applied${op !== "qc" ? " — image refreshed" : ""}`);
      } else if (data.error) {
        setLastAction(`${op} failed: ${data.error.slice(0, 200)}`);
      } else {
        setLastAction(`${op}: no response`);
      }
    } catch (err) {
      console.error(`[handleSceneOp movie] ${op} error:`, err);
      setLastAction(`Scene ${op} failed`);
    } finally {
      setPolishingScene(null);
    }
  }

  // ── AI Supervisor — checks scene/audio readiness before assembly ──
  async function runAiSupervisor() {
    setAiSupervisorRunning(true);
    setAiSupervisorReport(null);
    try {
      const selectedScenes = scenes.filter(s => assemblySelectedIds.includes(`SC${String(s.scene).padStart(2, "0")}`));
      const issues: string[] = [];
      const missingMedia = selectedScenes.filter(s => {
        const sid = `SC${String(s.scene).padStart(2, "0")}`;
        return !sceneImages[sid] && !sceneVideos[sid];
      });
      const imageOnly = selectedScenes.filter(s => {
        const sid = `SC${String(s.scene).padStart(2, "0")}`;
        return sceneImages[sid] && !sceneVideos[sid];
      });
      if (selectedScenes.length === 0) issues.push("No scenes selected for assembly.");
      if (missingMedia.length > 0) issues.push(`${missingMedia.length} selected scene(s) have no media: ${missingMedia.map(s => `SC${String(s.scene).padStart(2, "0")}`).join(", ")}`);
      if (imageOnly.length > 0) issues.push(`${imageOnly.length} scene(s) use still images — generate videos for cinematic output.`);
      if (!selectedMusicUrl) issues.push("No background music selected.");
      const ok = missingMedia.length === 0 && selectedScenes.length > 0;
      setAiSupervisorReport({ ok, summary: ok ? `${selectedScenes.length} scenes ready.` : `${issues.length} issue(s) found.`, issues });
    } catch {
      setAiSupervisorReport({ ok: false, summary: "Supervisor check failed", issues: ["Could not run AI check."] });
    }
    setAiSupervisorRunning(false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Progress Bar Component ──
  function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: muted }}>{label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: border }}>
          <div style={{ width: `${value}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.5s" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: ds.color.paper, minHeight: "100vh", padding: "0 0 60px", fontFamily: ds.font.sans }}>
      <GateModal />
      <div style={{ padding: "24px 32px 0" }}>
        <HeroTitle kicker="Production Workshop" title="Movie & Series" italic="Planner" sub="Plan, create, review, and assemble your production." />
        {/* Project toolbar */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, marginBottom: 20 }}>
          <input value={title} onChange={e => setTitle(e.target.value)}
            style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, width: 220, outline: "none", fontFamily: ds.font.sans }}
            placeholder="Project Title" />
          <button onClick={async () => { await newProject(); }}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid rgba(255,255,255,0.1)`, background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>
            New Project
          </button>
          <button onClick={() => saveProject()} disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setShowContinue(!showContinue)}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer", fontFamily: ds.font.mono }}>
            Projects ({projectList.length})
          </button>
          {projectId && <span style={{ fontSize: 9, color: "#3d5060", fontFamily: ds.font.mono }}>{projectId.slice(0, 8)}...</span>}
        </div>
      </div>
      <div style={{ padding: "0 32px" }}>

      {/* ── Continue / Load existing ── */}
      {showContinue && (
        <div style={{ ...cardStyle, marginBottom: 16, maxHeight: 240, overflowY: "auto" }}>
          <p style={labelStyle}>Your Movie Projects</p>
          {projectList.length === 0 && <p style={{ fontSize: 12, color: muted }}>No saved projects yet</p>}
          {projectList.map(p => (
            <div key={p.id} onClick={() => loadProject(p.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, marginBottom: 4, background: projectId === p.id ? `${accent}10` : "transparent", cursor: "pointer", border: `1px solid ${projectId === p.id ? accent : "transparent"}` }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.title}</span>
                <span style={{ fontSize: 10, color: muted, marginLeft: 8 }}>{p.genre ?? ""} &middot; {p._count.scenes} scenes &middot; {p.status}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 9, color: "#3d5060" }}>{new Date(p.updatedAt).toLocaleDateString()}</span>
                <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                  style={{ fontSize: 9, color: red, background: "none", border: "none", cursor: "pointer" }}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Workshop Tab Bar ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: ds.color.card, borderRadius: 14, padding: "4px 4px", border: `1px solid ${ds.color.line}`, overflowX: "auto" }}>
        {WORKSHOP_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const hasContent = tab.id === "scenes" ? totalScenes > 0 : tab.id === "characters" ? savedCharacters.length > 0 : tab.id === "story" ? !!idea : tab.id === "assembly" ? assemblyReadiness > 50 : true;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "10px 8px", border: "none",
                background: "transparent",
                color: isActive ? "#fff" : hasContent ? "rgba(255,255,255,0.6)" : muted,
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                cursor: "pointer", position: "relative",
                fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.08em",
                minWidth: 80,
              }}>
              {tab.label}
              {tab.id === "scenes" && totalScenes > 0 && !isActive && (
                <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: `${accent}20`, color: accent }}>{totalScenes}</span>
              )}
              {isActive && (
                <span style={{ position: "absolute", bottom: 0, left: 4, right: 4, height: 2, borderRadius: 2, background: "linear-gradient(90deg, #7c5cfc, #ff7a45)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── CharacterPicker Modal ── */}
      {/* ═══ AID MODEL PICKER MODAL ═══ */}
      {showAidPicker && (() => {
        const AID_MODELS = AID_VIDEO_MODELS;
        const IMAGE_MODELS_AID = AID_IMAGE_MODELS;
        type StyleKey = "all"|"2d"|"3d"|"cartoon"|"realistic";
        const ADVISER: Record<StyleKey, { title:string; msg:string; cheapestId:string; bestId:string; bestLabel:string }> = {
          all:      { title:"All Models",             msg:"Showing all models sorted by price. MuAPI is 40–58% cheaper than FAL for the same quality tier.",                                                     cheapestId:"segmind_pruna_video",  bestId:"fal_kling_3_pro",        bestLabel:"Top Overall" },
          "2d":     { title:"2D / Illustration Style", msg:"Seedance 2.0 (MuAPI) is the best model for 2D flat animation — clean outlines, flat colour fills, smooth motion. Avoid Kling/Runway for 2D.",       cheapestId:"muapi_seedance_v1_pro", bestId:"muapi_seedance_v2_1080p", bestLabel:"Best 2D" },
          "3d":     { title:"3D / Cinematic Style",    msg:"Kling 2.5 Direct ★ is the best 3D model — direct API, no FAL overhead. Start with Kling 1.6 Direct for budget drafts.",                            cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_std",  bestLabel:"Best 3D Direct" },
          cartoon:  { title:"Cartoon / Animated",      msg:"Seedance 2.0 (MuAPI) at $0.08 is the best cartoon model. Hailuo Pro is the best cartoon on FAL.",                                                   cheapestId:"muapi_seedance_v1_pro", bestId:"fal_hailuo_pro",          bestLabel:"Best Cartoon" },
          realistic:{ title:"Realistic / Photorealistic",msg:"Kling 2.5 Pro Direct ★ ($0.20) is the most realistic direct API option. Kling 2.5 Direct ★ ($0.10) is best value.",                              cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_pro",  bestLabel:"Most Realistic" },
        };
        const adviser = ADVISER[aidStyle];
        const qualityScore = (m: typeof AID_MODELS[0]) => aidStyle === "all" ? (m.scores["2d"]+m.scores["3d"]+m.scores.cartoon+m.scores.realistic)/4 : m.scores[aidStyle as Exclude<StyleKey,"all">];
        const applySort = (list: typeof AID_MODELS) => {
          if (aidSort === "cheapest")  return [...list].sort((a,b) => a.price - b.price);
          if (aidSort === "expensive") return [...list].sort((a,b) => b.price - a.price);
          return [...list].sort((a,b) => { const d = qualityScore(b)-qualityScore(a); return d !== 0 ? d : a.price-b.price; });
        };
        const filteredModels = applySort(aidStyle === "all" ? AID_MODELS : AID_MODELS.filter(m => m.scores[aidStyle as Exclude<StyleKey,"all">] >= 2));
        const cheapestMatch = filteredModels.find(m => m.id === adviser.cheapestId) ?? filteredModels[0];
        const bestMatch = filteredModels.find(m => m.id === adviser.bestId) ?? filteredModels[filteredModels.length-1];
        const networkColor: Record<string,string> = { Segmind:"#22c55e", MuAPI:"#38bdf8", FAL:"#a78bfa", Runway:"#e879f9", Kling:"#f59e0b" };
        const isVideo = aidMode === "video";
        const activeModelId = isVideo ? effectiveVideoModelId : effectiveImageModelId;
        return (
          <div onClick={() => setShowAidPicker(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background:"#0d0d20", border:"1px solid #3b2f6e", borderRadius:16, width:500, maxWidth:"96vw", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 0 60px rgba(100,50,200,0.4)" }}>
              <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #1e1a3a", flexShrink:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#e2d9f3" }}>AI Model Selector</div>
                  <button onClick={() => setShowAidPicker(false)} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", display:"flex", alignItems:"center" }}><Icon.X style={{ width:18, height:18 }} /></button>
                </div>
                <div style={{ display:"flex", gap:0, borderRadius:10, overflow:"hidden", border:"1px solid #2a2456", width:"fit-content" }}>
                  {(["video","image"] as const).map(mode => (
                    <button key={mode} onClick={() => setAidMode(mode)} style={{ padding:"7px 24px", border:"none", cursor:"pointer", fontSize:11, fontWeight:800, background:aidMode===mode?(mode==="video"?"#7c3aed":"#0ea5e9"):"#12122a", color:aidMode===mode?"#fff":"#5a4f80", transition:"all 0.15s" }}>
                      {mode==="video"?"VIDEO":"IMAGE"}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:9, color:"#4a4070", marginTop:6 }}>Active: <span style={{ color:isVideo?"#c084fc":"#38bdf8", fontWeight:700 }}>{activeModelId}</span></div>
              </div>
              {isVideo && (
                <div style={{ padding:"10px 20px 0", display:"flex", gap:6, flexShrink:0 }}>
                  {(["all","2d","3d","cartoon","realistic"] as StyleKey[]).map(s => {
                    const labels: Record<StyleKey,string> = { all:"ALL","2d":"2D","3d":"3D",cartoon:"CARTOON",realistic:"REALISTIC" };
                    return <button key={s} onClick={() => setAidStyle(s)} style={{ padding:"4px 9px", borderRadius:7, border:aidStyle===s?"1.5px solid #c084fc":"1px solid #2a2456", background:aidStyle===s?"#3b1f6e":"#12122a", color:aidStyle===s?"#e2d9f3":"#6b5fa0", fontSize:9, fontWeight:800, cursor:"pointer", letterSpacing:0.5 }}>{labels[s]}</button>;
                  })}
                </div>
              )}
              {isVideo && (
                <div style={{ padding:"8px 20px 0", display:"flex", gap:5, alignItems:"center", flexShrink:0 }}>
                  <span style={{ fontSize:8, color:"#3a3060", fontWeight:700, letterSpacing:0.5, marginRight:3 }}>SORT:</span>
                  {([{key:"cheapest",label:"Cheapest",col:"#22c55e"},{key:"quality",label:"Quality",col:"#c084fc"},{key:"expensive",label:"Premium",col:"#facc15"}] as {key:"cheapest"|"quality"|"expensive";label:string;col:string}[]).map(opt => (
                    <button key={opt.key} onClick={() => setAidSort(opt.key)} style={{ padding:"3px 10px", borderRadius:7, border:aidSort===opt.key?`1.5px solid ${opt.col}`:"1px solid #2a2456", background:aidSort===opt.key?`${opt.col}20`:"#12122a", color:aidSort===opt.key?opt.col:"#4a4070", fontSize:9, fontWeight:700, cursor:"pointer" }}>{opt.label}</button>
                  ))}
                </div>
              )}
              {isVideo && (
                <div style={{ margin:"10px 20px 0", padding:"11px 14px", borderRadius:10, background:"#0a0820", border:"1px solid #2a1f5a", flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#c084fc", marginBottom:4 }}>{adviser.title}</div>
                  <div style={{ fontSize:9, color:"#a08aba", lineHeight:1.6 }}>{adviser.msg}</div>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #22c55e40" }}>
                      <div style={{ fontSize:8, color:"#22c55e", fontWeight:700, marginBottom:1 }}>CHEAPEST</div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>{cheapestMatch?.name}</div>
                      <div style={{ fontSize:9, color:"#22c55e", fontWeight:700 }}>{cheapestMatch?.price===0?"Runway credits":`$${cheapestMatch?.price.toFixed(3)}/clip`}</div>
                    </div>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #c084fc40" }}>
                      <div style={{ fontSize:8, color:"#c084fc", fontWeight:700, marginBottom:1 }}>{adviser.bestLabel.toUpperCase()}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>{bestMatch?.name}</div>
                      <div style={{ fontSize:9, color:"#c084fc", fontWeight:700 }}>{bestMatch?.price===0?"Runway credits":`$${bestMatch?.price.toFixed(3)}/clip`}</div>
                    </div>
                  </div>
                </div>
              )}
              {!isVideo && (
                <div style={{ margin:"10px 20px 0", padding:"11px 14px", borderRadius:10, background:"#0a0820", border:"1px solid #0ea5e940", flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#38bdf8", marginBottom:4, display:"flex", alignItems:"center", gap:5 }}><Icon.Image style={{ width:12, height:12 }} /> Image Model Adviser</div>
                  <div style={{ fontSize:9, color:"#a08aba", lineHeight:1.6 }}>Pruna P Image ($0.005) and Flux Schnell ($0.003) cheapest for drafts. Flux Pro ($0.05) or Flux Pro Ultra ($0.06) for final quality. Ideogram v3 best for text/titles.</div>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #22c55e40" }}><div style={{ fontSize:8, color:"#22c55e", fontWeight:700, marginBottom:1 }}>CHEAPEST IMAGE</div><div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>Flux Schnell</div><div style={{ fontSize:9, color:"#22c55e", fontWeight:700 }}>$0.003/image · FAL</div></div>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #c084fc40" }}><div style={{ fontSize:8, color:"#c084fc", fontWeight:700, marginBottom:1 }}>BEST QUALITY</div><div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>Flux Pro Ultra</div><div style={{ fontSize:9, color:"#c084fc", fontWeight:700 }}>$0.060/image · 2048px</div></div>
                  </div>
                </div>
              )}
              <div style={{ overflowY:"auto", padding:"10px 20px 16px", flex:1 }}>
                {isVideo ? filteredModels.map((m, idx) => {
                  const isCheapest = m.id === cheapestMatch?.id;
                  const isBest = m.id === bestMatch?.id;
                  const isSelected = effectiveVideoModelId === m.id;
                  const styleScore = aidStyle === "all" ? null : m.scores[aidStyle as Exclude<StyleKey,"all">];
                  const styleTag = aidStyle==="2d"?m.tags2d:aidStyle==="3d"?m.tags3d:aidStyle==="cartoon"?m.tagCartoon:aidStyle==="realistic"?m.tagRealistic:undefined;
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedVideoModelId(m.id); patchProjectSettings({ videoModelVersion: m.id }).catch(() => {}); setShowAidPicker(false); }}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", marginBottom:5, borderRadius:10, cursor:"pointer", border:isSelected?`1.5px solid ${m.color}`:isBest?`1px solid ${m.color}60`:"1px solid #1e1a3a", background:isSelected?`${m.color}15`:isBest?`${m.color}08`:"#0a0820", transition:"all 0.12s" }}>
                      <div style={{ fontSize:9, color:"#3a3060", fontWeight:700, minWidth:16, textAlign:"right", marginRight:8 }}>{idx+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:2 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:"#e2d9f3" }}>{m.name}</span>
                          <span style={{ fontSize:8, fontWeight:700, background:netCol, color:"#000", borderRadius:3, padding:"1px 5px" }}>{m.network}</span>
                          {isCheapest && <span style={{ fontSize:8, fontWeight:700, background:"#22c55e", color:"#000", borderRadius:3, padding:"1px 5px" }}>CHEAPEST</span>}
                          {isBest && !isCheapest && <span style={{ fontSize:8, fontWeight:700, background:"#c084fc", color:"#000", borderRadius:3, padding:"1px 5px" }}>{adviser.bestLabel.toUpperCase()}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, color:"#22c55e", fontWeight:700 }}>{m.price===0?"Runway credits":`$${m.price.toFixed(3)}`}</span>
                          <span style={{ fontSize:9, color:"#4a4070" }}>{m.res} · {m.maxSec}s</span>
                          {styleTag && <span style={{ fontSize:9, color:m.color, fontStyle:"italic" }}>{styleTag}</span>}
                          {styleScore !== null && <span style={{ fontSize:9, color:"#5a4f80" }}>{styleScore}/5</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", marginLeft:8 }}>
                        {isSelected ? <Icon.Check style={{ width:14, height:14, color:m.color }} /> : <div style={{ fontSize:9, color:"#3a3060" }}>select</div>}
                      </div>
                    </div>
                  );
                }) : IMAGE_MODELS_AID.map((m, idx) => {
                  const isSelected = effectiveImageModelId === m.id;
                  const isCheapest = m.id === "fal_flux_schnell";
                  const isBest = m.id === "fal_flux_pro_ultra";
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedImageModelId(m.id); patchProjectSettings({ imageModelVersion: m.id }).catch(() => {}); setShowAidPicker(false); }}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", marginBottom:5, borderRadius:10, cursor:"pointer", border:isSelected?`1.5px solid ${m.color}`:"1px solid #1e1a3a", background:isSelected?`${m.color}15`:"#0a0820", transition:"all 0.12s" }}>
                      <div style={{ fontSize:9, color:"#3a3060", fontWeight:700, minWidth:16, textAlign:"right", marginRight:8 }}>{idx+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:2 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:"#e2d9f3" }}>{m.name}</span>
                          <span style={{ fontSize:8, fontWeight:700, background:netCol, color:"#000", borderRadius:3, padding:"1px 5px" }}>{m.network}</span>
                          {isCheapest && <span style={{ fontSize:8, fontWeight:700, background:"#22c55e", color:"#000", borderRadius:3, padding:"1px 5px" }}>CHEAPEST</span>}
                          {isBest && <span style={{ fontSize:8, fontWeight:700, background:"#c084fc", color:"#000", borderRadius:3, padding:"1px 5px" }}>BEST QUALITY</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, color:"#22c55e", fontWeight:700 }}>${m.price.toFixed(3)}/img</span>
                          <span style={{ fontSize:9, color:"#4a4070" }}>{m.res}</span>
                          <span style={{ fontSize:9, color:"#5a5080", fontStyle:"italic" }}>{m.desc}</span>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", marginLeft:8 }}>
                        {isSelected ? <Icon.Check style={{ width:14, height:14, color:m.color }} /> : <div style={{ fontSize:9, color:"#3a3060" }}>select</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Planning loading overlay */}
      {planning && (
        <div style={{ ...cardStyle, padding: "48px 40px", marginBottom: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Icon.Film style={{ width: 40, height: 40, color: muted, marginBottom: 12 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Multi-AI Cinematic Expansion</h2>
            <p style={{ fontSize: 13, color: muted }}>3 AI systems are analyzing your idea simultaneously</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500, margin: "0 auto" }}>
            {[
              { label: "AI Story Director", desc: "Expanding your idea into full cinematic scenes", color: accent },
              { label: "AI Technical Director", desc: "Adding physical realism — SFX, ambience, spatial audio", color: blue },
              { label: "AI Quality Reviewer", desc: "Checking for logic gaps, pacing issues, continuity", color: green },
            ].map((ai, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, background: s2, border: `1px solid ${border}` }}>
                                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: ai.color }}>{ai.label}</p>
                  <p style={{ fontSize: 10, color: muted }}>{ai.desc}</p>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${ai.color}40`, borderTopColor: ai.color, animation: "spin 1s linear infinite" }} />
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 4 }}>
              <p style={{ fontSize: 9, color: "#3d5060", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Non-AI Engines</p>
              <div style={{ display: "flex", gap: 8 }}>
                {["Continuity Checker", "SFX Resolver", "Generation Strategy"].map(e => (
                  <span key={e} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "#141424", color: muted, border: `1px solid ${border}` }}>{e}</span>
                ))}
              </div>
            </div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: `${red}10`, border: `1px solid ${red}30`, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: red, flex: 1 }}>{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 10, cursor: "pointer", marginLeft: 12 }}>Dismiss</button>
        </div>
      )}

      {/* ── Guidance Banner ── */}
      {activeTab !== "overview" && (
        <div
          onClick={() => setActiveTab(nextStepMessage.targetTab)}
          style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 12, cursor: "pointer",
            background: `${nextStepMessage.color}08`, border: `1px solid ${nextStepMessage.color}25`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
          <p style={{ fontSize: 12, color: nextStepMessage.color, fontWeight: 600 }}>
            Next: {nextStepMessage.text}
          </p>
          {nextStepMessage.targetTab !== activeTab && (
            <span style={{ fontSize: 10, color: nextStepMessage.color, opacity: 0.7 }}>Click to go</span>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB — extracted to tabs/OverviewTab.tsx (movie-planner Wave 1.2) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <OverviewTab
          totalScenes={totalScenes}
          draftScenes={draftScenes}
          approvedScenes={approvedScenes}
          blockedScenes={blockedScenes}
          savedCharactersCount={savedCharacters.length}
          storyProgress={storyProgress}
          characterProgress={characterProgress}
          planningProgress={planningProgress}
          sceneProgress={sceneProgress}
          imageProgress={imageProgress}
          assemblyReadiness={assemblyReadiness}
          lastAction={lastAction}
          projectPhase={projectPhase}
          hasGenre={!!genre}
          hasIdea={!!idea}
          selectedCastCount={selectedCast.length}
          hasMoviePlan={!!moviePlan}
          generatedImages={generatedImages}
          generatedScenes={generatedScenes}
          warnings={warnings}
          moviePlan={moviePlan}
          format={format}
          title={title}
          assembledUrl={assembledUrl}
          showModelSettings={showModelSettings}
          setShowModelSettings={setShowModelSettings}
          modelSettings={modelSettings}
          setModelSettings={setModelSettings as unknown as React.Dispatch<React.SetStateAction<import("./tabs/OverviewTab").OverviewModelSettings>>}
          SOUND_TIERS_MOVIE={SOUND_TIERS_MOVIE}
          onPickSoundTier={(id: string) => {
            // Three side-effects bundled — mirrors original inline behavior verbatim.
            setModelSettings(p => ({ ...p, soundModel: id as typeof modelSettings.soundModel }));
            setSoundTier(id as typeof modelSettings.soundModel);
            patchProjectSettings({ soundTier: id }).catch(() => {});
          }}
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          s2={s2}
          border={border}
          muted={muted}
          accent={accent}
          purple={purple}
          gold={gold}
          red={red}
          blue={blue}
          green={green}
          setActiveTab={setActiveTab}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STORY & DRAFT TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STORY TAB — extracted to tabs/StoryTab.tsx (movie-planner Wave 1.4)   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "story" && (
        <StoryTab
          genre={genre}
          tone={tone}
          setting={setting}
          format={format}
          FORMATS={FORMATS}
          title={title}
          setTitle={setTitle}
          idea={idea}
          setIdea={setIdea}
          expandedStory={expandedStory}
          setExpandedStory={setExpandedStory}
          duration={duration}
          setDuration={setDuration}
          effectiveLanguage={effectiveLanguage}
          onChangeLanguage={(v: string) => {
            // Bundles original inline behavior: setLanguage + patchProjectSettings.
            setLanguage(v);
            patchProjectSettings({ language: v }).catch(() => {});
          }}
          aiTier={aiTier}
          setAiTier={setAiTier}
          storyEra={storyEra}
          setStoryEra={setStoryEra}
          storyCulture={storyCulture}
          setStoryCulture={setStoryCulture}
          expanding={expanding}
          planning={planning}
          devocarizing={devocarizing}
          generatingProductionPlan={generatingProductionPlan}
          aiProductionPlan={aiProductionPlan as unknown as import("./tabs/StoryTab").StoryAiProductionPlan | null}
          showProductionPlan={showProductionPlan}
          setShowProductionPlan={setShowProductionPlan}
          generateProductionPlan={generateProductionPlan}
          scenes={scenes as unknown as ReadonlyArray<import("./tabs/StoryTab").StoryDraftScene>}
          sceneImages={sceneImages}
          draftScenes={draftScenes}
          totalScenes={totalScenes}
          setSelectedScene={setSelectedScene}
          expandStory={expandStory}
          generateMoviePlan={generateMoviePlan}
          devocarize={devocarize}
          setActiveTab={setActiveTab}
          setLastAction={setLastAction}
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          inputStyle={inputStyle}
          btnPrimary={btnPrimary}
          s2={s2}
          surface={surface}
          border={border}
          muted={muted}
          accent={accent}
          blue={blue}
          gold={gold}
          green={green}
          badgeStyle={badgeStyle}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESIGN TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESIGN TAB — extracted to tabs/DesignTab.tsx (movie-planner Wave 1.3) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "design" && (
        <DesignTab
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          s2={s2}
          border={border}
          muted={muted}
          accent={accent}
          blue={blue}
          green={green}
          gold={gold}
          purple={purple}
          pillStyle={pillStyle}
          GENRES={GENRES}
          STYLES={STYLES}
          FORMATS={FORMATS}
          PRODUCTION_MODES={PRODUCTION_MODES}
          CHARACTER_STYLES={CHARACTER_STYLES}
          TONES={TONES}
          SETTINGS={SETTINGS}
          PLANNING_DEPTHS={PLANNING_DEPTHS}
          genre={genre}
          style={style}
          format={format}
          productionMode={productionMode}
          movieCharacterStyle={movieCharacterStyle}
          tone={tone}
          setting={setting}
          planningDepth={planningDepth}
          storyAiProvider={storyAiProvider}
          effectiveProjectStyle={effectiveProjectStyle}
          idea={idea}
          planning={planning}
          setGenre={setGenre}
          setStyle={setStyle}
          setFormat={setFormat}
          setProductionMode={setProductionMode}
          setMovieCharacterStyle={setMovieCharacterStyle as unknown as (v: string) => void}
          setTone={setTone}
          setSetting={setSetting}
          setPlanningDepth={setPlanningDepth}
          setStoryAiProvider={setStoryAiProvider}
          onPickArtStyle={(id, nameLabel) => {
            // Same 3-side-effect bundle as the original inline handler — verbatim.
            setProjectStyle(id);
            patchProjectSettings({ visualStyle: id }).catch(() => {});
            setLastAction(`Art style: ${nameLabel}`);
          }}
          generateMoviePlan={generateMoviePlan}
          setActiveTab={setActiveTab}
          setLastAction={setLastAction}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS (CAST) TAB                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS (CAST) TAB — extracted to tabs/CharactersTab.tsx (Wave 2.1) */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "characters" && (
        <CharactersTab
          selectedCast={selectedCast as unknown as import("./tabs/CharactersTab").CharactersTabCastMember[]}
          showCharacterPicker={showCharacterPicker}
          setShowCharacterPicker={setShowCharacterPicker}
          castGenError={castGenError}
          generatedCast={generatedCast}
          castPortraitModel={castPortraitModel}
          setCastPortraitModel={setCastPortraitModel}
          generateCastFromStory={generateCastFromStory}
          castGenerating={castGenerating}
          expandedStory={expandedStory}
          idea={idea}
          savedCharacters={savedCharacters as unknown as import("./tabs/CharactersTab").CharactersTabSavedChar[]}
          setSavedCharacters={setSavedCharacters as unknown as React.Dispatch<React.SetStateAction<import("./tabs/CharactersTab").CharactersTabSavedChar[]>>}
          addToCast={addToCast}
          setLastAction={setLastAction}
          loadingChars={loadingChars}
          removeCast={removeCast}
          charPortraitModel={charPortraitModel}
          setCharPortraitModel={setCharPortraitModel}
          charRefImages={charRefImages as unknown as Record<string, import("./tabs/CharactersTab").CharactersTabShot[]>}
          generatePortrait={async (char) => {
            // ── Inline portrait pipeline — moved verbatim from the original
            //    button onClick. Fires 3 angle shots in parallel, picks the
            //    first url as MAIN, persists via PATCH /api/character-voices/<id>.
            const modelId = charPortraitModel[char.id] || castPortraitModel;
            const styleLabel = movieCharacterStyle.replace(/_/g, " ");
            const eraLine = (storyEra || storyCulture) ? `Set in ${[storyEra, storyCulture].filter(Boolean).join(", ")}. Clothing, accessories, and props MUST reflect this era and culture exactly.` : "";
            const basePrompt = [
              `${styleLabel} style full body character: ${char.name}.`,
              char.description || "",
              eraLine || undefined,
              "Professional character reference sheet, full body head to toe, clean background, high quality rendering.",
            ].filter(Boolean).join(" ");
            const ANGLE_SHOTS = [
              { angle: "front",         label: "main",        framing: "FULL BODY front view, standing neutral pose, facing camera, visible from head to toe including feet, clean plain background." },
              { angle: "three-quarter", label: "variation_1", framing: "FULL BODY three-quarter angle view, slight left turn, standing pose, entire body visible from head to feet, clean plain background." },
              { angle: "side",          label: "variation_2", framing: "FULL BODY side profile view, 90-degree turn, standing pose, full height visible from head to feet, clean plain background." },
            ];
            async function genOneShot(framing: string): Promise<string | null> {
              try {
                const r = await fetch("/api/generation/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${basePrompt} ${framing}`, width: 768, height: 1024, modelId }) });
                const d = await r.json();
                const raw = d.imageUrl || d.imagePath || "";
                if (!raw) return null;
                return raw.startsWith("http") || raw.startsWith("/api/") ? raw : `/api/media/${raw.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
              } catch { return null; }
            }
            try {
              const [url1, url2, url3] = await Promise.all(ANGLE_SHOTS.map(s => genOneShot(s.framing)));
              if (!url1) { setErrorMsg(`Portrait generation failed for ${char.name}`); return; }
              const shots = [
                { url: url1, angle: ANGLE_SHOTS[0].angle, label: ANGLE_SHOTS[0].label },
                ...(url2 ? [{ url: url2, angle: ANGLE_SHOTS[1].angle, label: ANGLE_SHOTS[1].label }] : []),
                ...(url3 ? [{ url: url3, angle: ANGLE_SHOTS[2].angle, label: ANGLE_SHOTS[2].label }] : []),
              ];
              setCharRefImages(prev => ({ ...prev, [char.id]: shots }));
              setSavedCharacters(prev => prev.map(c => c.id === char.id ? { ...c, imageUrl: url1 } : c));
              setLastAction(`${shots.length} portrait shots generated for ${char.name}`);
              fetch(`/api/character-voices/${char.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: url1, referenceImages: shots }) }).catch(() => {});
            } catch (err) { setErrorMsg(`Failed to generate portrait for ${char.name}: ${err instanceof Error ? err.message : "Unknown error"}`); }
          }}
          ROLES={ROLES}
          setCastRole={setCastRole}
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          inputStyle={inputStyle}
          s2={s2}
          surface={surface}
          border={border}
          muted={muted}
          accent={accent}
          green={green}
          red={red}
          purple={purple}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCENE BOARD TAB                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "scenes" && (
        <div>
          {/* ── CONTINUOUS MOTION TOGGLE ──────────────────────────────────── */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: continuousMotionEnabled ? `${accent}50` : border, background: continuousMotionEnabled ? `${accent}06` : undefined }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={continuousMotionEnabled}
                onChange={e => { setContinuousMotionEnabled(e.target.checked); setCmError(null); setCmStatus(null); setCmFinalVideoUrl(null); }}
                style={{ width: 16, height: 16, accentColor: accent }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: continuousMotionEnabled ? accent : "#fff" }}>
                Continuous Motion — chain scenes into one seamless action sequence
              </span>
            </label>
            {continuousMotionEnabled && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
                  AI will treat your scenes as one continuous action. Enable this when your story has unbroken physical action (chase, fall, fight, explosion chain).
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Total Duration (seconds)</label>
                    <input type="number" min={5} max={120} value={cmTotalDuration}
                      onChange={e => setCmTotalDuration(Math.max(5, Number(e.target.value)))}
                      style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Segment Duration (sec, max 10)</label>
                    <input type="number" min={3} max={10} value={cmSegmentDuration}
                      onChange={e => setCmSegmentDuration(Math.min(10, Math.max(3, Number(e.target.value))))}
                      style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Video Provider</label>
                    <select value={cmProvider} onChange={e => setCmProvider(e.target.value as "wan" | "kling_std")}
                      style={{ ...inputStyle, fontSize: 12 }}>
                      <option value="wan">Wan 2.5</option>
                      <option value="kling_std">Kling Standard</option>
                    </select>
                  </div>
                </div>
                {cmError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{cmError}</p>}
                {cmStatus && cmStatus !== "DONE" && (
                  <p style={{ fontSize: 11, color: accent, marginBottom: 10 }}>Status: {cmStatus}{cmRunning && " — polling every 3s..."}</p>
                )}
                {cmFinalVideoUrl && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>Continuous Motion ready</p>
                    <video src={cmFinalVideoUrl} controls style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000", marginBottom: 8 }} />
                  </div>
                )}
                <button
                  onClick={startContinuousMotion}
                  disabled={cmRunning}
                  style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: cmRunning ? "#2a2040" : accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: cmRunning ? "not-allowed" : "pointer" }}>
                  {cmRunning ? `Generating… (${cmStatus ?? "starting"})` : "Generate Continuous Motion"}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Scene Board ({totalScenes} scenes)</h2>
              {(storyEra || storyCulture) && (
                <div style={{ marginTop: 3 }}>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#fb923c18", color: "#fb923c", fontWeight: 600 }}>
                    {[storyEra, storyCulture].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setSceneViewMode("grid")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sceneViewMode === "grid" ? accent : border}`, background: sceneViewMode === "grid" ? `${accent}10` : "transparent", color: sceneViewMode === "grid" ? accent : muted, fontSize: 10, cursor: "pointer" }}>Grid</button>
              <button onClick={() => setSceneViewMode("list")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sceneViewMode === "list" ? accent : border}`, background: sceneViewMode === "list" ? `${accent}10` : "transparent", color: sceneViewMode === "list" ? accent : muted, fontSize: 10, cursor: "pointer" }}>List</button>
              <button
                disabled={runningIntelligence || scenes.length === 0}
                onClick={runSceneIntelligence}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4ade8030", background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}
              >
                {runningIntelligence ? "Detecting..." : "Scene Intelligence"}
              </button>
              {(() => {
                const pendingCount = scenes.filter(s => {
                  const sid = `SC${String(s.scene).padStart(2, "0")}`;
                  return !sceneImages[sid] && s.generationMethod !== "audio-only";
                }).length;
                return pendingCount > 0 ? (
                  <button onClick={generateAllSceneImages} disabled={generatingAllImages || !!generatingSceneImage}
                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${green}40`, background: `${green}10`, color: green, fontSize: 10, fontWeight: 600, cursor: generatingAllImages ? "not-allowed" : "pointer" }}>
                    {generatingAllImages ? "Generating..." : `Gen All Images (${pendingCount})`}
                  </button>
                ) : null;
              })()}
            </div>
          </div>
          {runningIntelligence && (
            <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0" }}>Scene Intelligence running — detecting environments and ambient sounds...</p>
          )}
          {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
            <p style={{ fontSize: 10, color: "#666", margin: "4px 0" }}>
              {Object.keys(sceneIntelligence).length} scenes have sound environment data
            </p>
          )}

          {/* ── AI Model Picker (Scene Board) ── */}
          <div style={{ ...cardStyle, padding: "12px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
                    style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${accent}40`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Video Model: <span style={{ color: "#fff" }}>{effectiveVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </button>
                  <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                    style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Image Model: <span style={{ color: "#fff" }}>{effectiveImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </button>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!moviePlan) return;
                  for (const scene of moviePlan.scenes) {
                    if (scene.status !== "generated" && scene.generationMethod !== "audio-only") {
                      await renderScene(scene.scene);
                    }
                  }
                  saveProject();
                }}
                disabled={renderingScene !== null || totalScenes === 0}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: renderingScene !== null ? "#2a2a40" : purple, color: "#fff", fontSize: 10, fontWeight: 700, cursor: renderingScene !== null ? "not-allowed" : "pointer" }}>
                {renderingScene !== null ? `Rendering SC${String(renderingScene).padStart(2, "0")}...` : "Render All Videos"}
              </button>
            </div>
          </div>

          {totalScenes === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No scenes yet. Run AI Planning from the Design tab.</p>
              <button onClick={() => setActiveTab("design")} style={btnPrimary}>Go to Design</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: sceneViewMode === "grid" ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr", gap: 12 }}>
              {scenes.map(scene => {
                const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
                const hasImage = !!sceneImages[sceneId];
                const statusColor = scene.status === "approved" ? green : scene.status === "blocked" ? red : scene.status === "generated" ? blue : scene.status === "generating" ? accent : gold;
                const sceneChars = scene.characters.map(c => {
                  const char = savedCharacters.find(ch => ch.id === c || ch.name === c || ch.characterId === c);
                  return char?.name || c;
                });
                return (
                  <div key={scene.scene} draggable onDragStart={() => handleDragStart(scene.scene)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(scene.scene)}
                    style={{ ...cardStyle, padding: 0, overflow: "hidden", opacity: dragSource === scene.scene ? 0.5 : 1, cursor: "grab" }}>
                    {/* Thumbnail */}
                    <div style={{ height: 140, background: s2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {hasImage ? (
                        <img src={sceneImages[sceneId]} alt={scene.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ textAlign: "center" }}>
                          <Icon.Image style={{ width: 36, height: 36, color: muted, opacity: 0.2 }} />
                          <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>No image yet</p>
                        </div>
                      )}
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                        {sceneId}
                      </div>
                      <div style={{ position: "absolute", top: 8, right: 8 }}>
                        <span style={badgeStyle(methodColors[scene.generationMethod] ?? accent)}>{scene.generationMethod}</span>
                      </div>
                      <div style={{ position: "absolute", bottom: 8, right: 8 }}>
                        <span style={badgeStyle(statusColor)}>{scene.status}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{scene.title}</p>
                      <p style={{ fontSize: 10, color: muted, marginBottom: 8, lineHeight: 1.4 }}>{(scene.goal || scene.visualDescription).substring(0, 80)}{(scene.goal || scene.visualDescription).length > 80 ? "..." : ""}</p>

                      {/* Characters */}
                      {sceneChars.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                          {sceneChars.map(name => (
                            <span key={name} style={{ fontSize: 8, padding: "2px 8px", borderRadius: 20, background: `${purple}15`, color: purple }}>{name}</span>
                          ))}
                        </div>
                      )}

                      {/* Info row */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, color: muted }}>{scene.duration}</span>
                        <span style={badgeStyle(costColors[scene.costLabel] || gold)}>{scene.costLabel}</span>
                      </div>

                      {/* Video progress bar */}
                      {sceneGenProgress[sceneId] && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: accent }}>{sceneGenProgress[sceneId].message}</span>
                            <span style={{ fontSize: 9, color: accent }}>{sceneGenProgress[sceneId].percent}%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: border }}>
                            <div style={{ width: `${sceneGenProgress[sceneId].percent}%`, height: "100%", borderRadius: 2, background: accent, transition: "width 0.4s" }} />
                          </div>
                        </div>
                      )}

                      {/* Video preview */}
                      {sceneVideos[sceneId] && !sceneGenProgress[sceneId] && (
                        <div style={{ marginBottom: 8 }}>
                          <video src={sceneVideos[sceneId]} controls loop muted style={{ width: "100%", borderRadius: 8, maxHeight: 120 }} />
                          {(sceneVideoVersions[sceneId]?.length ?? 0) > 1 && (
                            <p style={{ fontSize: 8, color: muted, marginTop: 2 }}>{sceneVideoVersions[sceneId].length} versions</p>
                          )}
                        </div>
                      )}

                      {/* Scene Intelligence card */}
                      {(() => {
                        const intel = sceneIntelligence[sceneId];
                        if (!intel) return null;
                        const energyColor = SCENE_ENERGY_COLOR[intel.energyLevel] || "#888";
                                                return (
                          <div style={{ margin: "8px 0", padding: "6px 8px", borderRadius: 8, background: "#ffffff05", border: "1px solid #ffffff0a" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                                            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{intel.environmentType.replace(/-/g, " ")}</span>
                              <span style={{ fontSize: 8, color: "#666" }}>•</span>
                              <span style={{ fontSize: 8, color: "#666", textTransform: "capitalize" }}>{intel.timeOfDay}</span>
                              <span style={{ marginLeft: "auto", fontSize: 7, padding: "1px 5px", borderRadius: 4, background: `${energyColor}20`, color: energyColor, fontWeight: 700, textTransform: "uppercase" }}>{intel.energyLevel}</span>
                            </div>
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {intel.ambienceSounds.slice(0, 4).map((sound, i) => (
                                <span key={i} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#1a2a1a", color: "#4ade80", border: "1px solid #4ade8030" }}>{sound}</span>
                              ))}
                              {intel.sfxEvents.length > 0 && (
                                <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#2a1a1a", color: "#eab308", border: "1px solid #eab30830" }}>{intel.sfxEvents[0]}</span>
                              )}
                              {autoSfx && intel.sfxEvents.length > 0 && (
                                <span style={{ fontSize: 6, padding: "2px 5px", borderRadius: 20, background: "#1a1a2a", color: "#818cf8", border: "1px solid #818cf830" }}>Auto SFX</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Action buttons row 1 */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <select
                          value={sceneStyles[sceneId] || effectiveProjectStyle || "realistic"}
                          onChange={e => setSceneStyles(prev => ({ ...prev, [sceneId]: e.target.value }))}
                          title="Override style for this scene"
                          style={{ padding: "0 6px", height: 28, borderRadius: 8, border: "1px solid #7c3aed40", background: "#0f172a", color: "#c084fc", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          <option value="3d-cinematic">3D Cinematic</option>
                          <option value="realistic">Realistic</option>
                          <option value="nollywood">Nollywood</option>
                          <option value="2d-cartoon">2D Cartoon</option>
                          <option value="anime">Anime</option>
                          <option value="storybook">Storybook</option>
                          <option value="comic">Comic</option>
                        </select>
                        <button onClick={() => makeSceneImage(scene)} disabled={generatingSceneImage === sceneId}
                          style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "none", background: generatingSceneImage === sceneId ? "#2a2a40" : "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneImage === sceneId ? "not-allowed" : "pointer" }}>
                          {generatingSceneImage === sceneId ? "..." : hasImage ? "Regen" : "Make Image"}
                        </button>
                        <button onClick={() => makeSceneVideo(scene)} disabled={!hasImage || generatingSceneVideos.has(sceneId)}
                          style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "none", background: !hasImage ? "#1a1a2a" : generatingSceneVideos.has(sceneId) ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c5cfc)`, color: !hasImage ? muted : "#fff", fontSize: 9, fontWeight: 700, cursor: !hasImage || generatingSceneVideos.has(sceneId) ? "not-allowed" : "pointer" }}>
                          {generatingSceneVideos.has(sceneId) ? "..." : sceneVideos[sceneId] ? "New Video" : "Make Video"}
                        </button>
                        <button onClick={() => updateScene(scene.scene, { status: scene.status === "approved" ? "planned" : "approved" })}
                          style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${green}30`, background: scene.status === "approved" ? `${green}15` : "transparent", color: green, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                          {scene.status === "approved" ? <Icon.Check style={{ width: 10, height: 10 }} /> : "OK"}
                        </button>
                        <button onClick={() => setExpandedSceneId(expandedSceneId === sceneId ? null : sceneId)}
                          style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`, background: expandedSceneId === sceneId ? `${blue}10` : "transparent", color: expandedSceneId === sceneId ? blue : muted, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                          {expandedSceneId === sceneId ? "Close" : "Edit"}
                        </button>
                      </div>
                      {/* Action buttons row 2: editor + move */}
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <a href={`/dashboard/collaborative-editor?mode=ghs_hybrid&sceneId=${sceneId}&from=movie-planner`} style={{ flex: 1, textDecoration: "none" }}
                          onClick={() => { /* return state handled via URL params */ }}>
                          <button style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: `1px solid ${purple}30`, background: `${purple}06`, color: purple, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                            Editor
                          </button>
                        </a>
                      </div>

                      {/* Action row 2: move/dup/delete */}
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <button onClick={() => moveScene(scene.scene, "up")} disabled={scene.scene === 1}
                          style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Up</button>
                        <button onClick={() => moveScene(scene.scene, "down")} disabled={scene.scene === totalScenes}
                          style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Down</button>
                        <button onClick={() => duplicateScene(scene.scene)}
                          style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: blue, cursor: "pointer" }}>Dup</button>
                        <button onClick={() => deleteScene(scene.scene)}
                          style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, cursor: "pointer", marginLeft: "auto" }}>Del</button>
                      </div>

                      {/* Expanded edit with SceneImagePanel */}
                      {expandedSceneId === sceneId && (
                        <div style={{ marginTop: 10 }}>
                          {/* Editable fields */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, marginBottom: 10 }}>
                            <div>
                              <p style={{ ...labelStyle, fontSize: 9 }}>Visual Description</p>
                              <textarea value={scene.visualDescription} onChange={e => updateScene(scene.scene, { visualDescription: e.target.value })}
                                onBlur={() => saveProject()}
                                rows={2} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                            </div>
                            <div>
                              <p style={{ ...labelStyle, fontSize: 9 }}>Camera Direction</p>
                              <input value={scene.cameraDirection} onChange={e => updateScene(scene.scene, { cameraDirection: e.target.value })}
                                style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                            </div>
                            <div>
                              <p style={{ ...labelStyle, fontSize: 9 }}>Dialogue / Narration</p>
                              <textarea value={scene.dialogue} onChange={e => updateScene(scene.scene, { dialogue: e.target.value })}
                                onBlur={() => saveProject()}
                                rows={2} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                            </div>
                            <div>
                              <p style={{ ...labelStyle, fontSize: 9 }}>Duration</p>
                              <input value={scene.duration} onChange={e => updateScene(scene.scene, { duration: e.target.value })}
                                style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                            </div>
                          </div>
                          <SceneImagePanel
                            sceneId={sceneId}
                            sceneTitle={scene.title}
                            sceneText={scene.visualDescription || scene.goal}
                            projectId={projectId || undefined}
                            characters={savedCharacters.map(c => ({ id: c.id, characterId: c.characterId || c.id, name: c.name, imageUrl: c.imageUrl }))}
                            selectedCharacterIds={scene.characters}
                            onImageGenerated={(url) => {
                              setSceneImages(prev => ({ ...prev, [sceneId]: url }));
                              updateScene(scene.scene, { status: "generated" as const });
                              setLastAction(`Scene ${scene.scene} image generated`);
                            }}
                            onCharacterSelect={(ids) => updateScene(scene.scene, { characters: ids })}
                            onTextChange={(t) => updateScene(scene.scene, { visualDescription: t })}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCREENPLAY TAB                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCRIPT TAB — extracted to tabs/ScriptTab.tsx (movie-planner Wave 1)   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "script" && (
        <ScriptTab
          screenplay={screenplay}
          generatingScreenplay={generatingScreenplay}
          idea={idea}
          expandedStory={expandedStory}
          screenplayAuthor={screenplayAuthor}
          screenplayError={screenplayError}
          parsingScript={parsingScript}
          scriptSegments={scriptSegments}
          showScriptReview={showScriptReview}
          sendingToScenes={sendingToScenes}
          sendToScenesResult={sendToScenesResult}
          hasMoviePlan={!!moviePlan}
          title={title}
          genre={genre}
          tone={tone}
          cardStyle={cardStyle}
          inputStyle={inputStyle}
          s2={s2}
          border={border}
          muted={muted}
          accent={accent}
          purple={purple}
          blue={blue}
          gold={gold}
          red={red}
          setActiveTab={setActiveTab}
          setScreenplayAuthor={setScreenplayAuthor}
          setScreenplay={setScreenplay}
          setShowScriptReview={setShowScriptReview}
          generateScreenplay={generateScreenplay}
          parseScript={parseScript}
          sendScreenplayToScenes={sendScreenplayToScenes}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* AUDIO & SHOTS TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sound" && (
        <div>
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
                // Set default audio values for scenes that are missing them
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
                const isSelected = effectiveNarrationProvider === tier.provider || (tier.id === "ghs-sound" && effectiveNarrationProvider === "piper");
                return (
                  <button key={tier.id} onClick={() => {
                    // Map tier to narration provider
                    const provMap: Record<string, "piper" | "fal-narrator" | "elevenlabs" | "karaoke"> = {
                      "ghs-sound": "piper", "ghs-plus": "karaoke", "ghs-pro": "karaoke", "ghs-premium": "karaoke",
                    };
                    const resolvedProvider = provMap[tier.id] ?? "piper";
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
                  {/* Legacy button — kept for single-voice fallback. Not as good as Multi-Cast above. */}
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
                  {/* Multi-Cast Dialogue (Phase 1, 2026-05-08):
                      For every scene with dialogue text, this:
                        1. Calls /api/dialogue/parse to split the blob into speaker-tagged lines.
                           Known cast names are passed so the parser uses real names instead of
                           generic "Cast 1 / Cast 2".
                        2. Maps each tagged speaker → their assigned ElevenLabs voiceId via castVoiceMap.
                        3. Calls /api/dialogue/generate which:
                              a. Generates each line via /api/tts (with auto-emotion + the right voice)
                              b. Concats with per-speaker pacing (80ms same-speaker, 220ms turn-take, 450ms scene-break)
                              c. Returns a single dialogue audio file per scene.
                      Result is stored in sceneDialogueAudio[sceneNumber] for playback / assembly. */}
                  {(() => {
                    // ── MCD-TIER: resolve MCD config from active tier ──
                    const _mcdTierId = movieTierToGhsSoundTierId(effectiveSoundTier);
                    const _mcdCfg = soundTierToMCDConfig(_mcdTierId);
                    const _mcdLabel = `${_mcdCfg.label}, ${_mcdCfg.estCostPer100s}/100s`;
                    return (
                  <button
                    onClick={async () => {
                      setGeneratingPerLineVoices(true);
                      setLastAction("Multi-cast dialogue: parsing and generating...");
                      // ── MCD-TIER: resolve config once before loop ──
                      const mcdTierId = movieTierToGhsSoundTierId(effectiveSoundTier);
                      const mcdCfg = soundTierToMCDConfig(mcdTierId);
                      const knownSpeakers = selectedCast
                        .map(sc => savedCharacters.find(c => c.id === sc.characterId)?.name)
                        .filter((n): n is string => !!n);
                      // Track newly generated audio for auto-lipsync pass
                      const newlyGeneratedDialogue: Array<{ sceneNum: number; sceneId: string; audioUrl: string }> = [];
                      try {
                        let scenesDone = 0;
                        for (const s of scenes) {
                          if (!s.dialogue?.trim()) continue;
                          // Parse speaker-tagged lines
                          const parseRes = await fetch("/api/dialogue/parse", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              text: s.dialogue,
                              knownSpeakers,
                              provider: "auto",
                            }),
                          });
                          const parseData = await parseRes.json() as { ok?: boolean; lines?: Array<{ speakerId: string; text: string; emotion?: string }>; error?: string };
                          if (!parseData.ok || !Array.isArray(parseData.lines) || parseData.lines.length === 0) {
                            console.warn(`[multi-cast] parse failed for scene ${s.scene}:`, parseData.error);
                            continue;
                          }
                          // Map speaker → voiceId.
                          // 2026-05-09 voice-swap fix: normalize names before comparing.
                          // Models sometimes return "Bryan ", "BRYAN", or "bryan." — all should match
                          // the same cast member. Use trim() + lowercase + strip punctuation on both sides.
                          // Also handle: speakerId might equal "Cast 1" / "Cast 2" generic labels — map
                          // those to selectedCast[0] / [1] in order.
                          const norm = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\d]/gu, "");
                          const lines = parseData.lines.map((l, lineIdx) => {
                            const target = norm(l.speakerId);
                            // Generic Cast N label?
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
                            // Last-resort: alternate by line index. Better than always defaulting to cast[0]
                            // (which made every line use the same voice when names didn't match).
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
                          // Generate — use tier's ttsProvider, not the narration provider selector
                          const genRes = await fetch("/api/dialogue/generate", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              lines,
                              provider: mcdCfg.ttsProvider,  // tier-driven override
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

                        // ── MCD-TIER: Auto-lipsync pass (only when tier specifies it) ──
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
                              // Keep original video — do not clear sceneVideos entry on failure
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
                      {/* Audition: 1-line preview using the assigned voice + a sample greeting.
                          Lets the user hear the voice before running bulk dialogue gen.
                          Audio plays inline via Audio() — no extra UI state. */}
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
              {/* Per-scene multi-cast dialogue audio playback.
                  Shows up after the Multi-Cast Dialogue button completes — one player per
                  scene whose dialogue we generated. User can re-listen + decide whether
                  to use as the scene's narration track in assembly.
                  Each row also has an "Apply Lip-Sync" button — Phase 3 — which runs the
                  scene's existing video clip through /api/avatar/lip-sync to drive mouth
                  movement from this dialogue audio. Result replaces the scene video. */}
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
                                If the scene only has a still image, the button is disabled
                                and a tooltip explains why (lipsync needs source video to bend). */}
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
                                    body: JSON.stringify({
                                      imageUrl: sceneVideoUrl,
                                      audioUrl: url,
                                      inputIsVideo: true,
                                    }),
                                  });
                                  const data = await res.json() as { videoUrl?: string; provider?: string; error?: string };
                                  if (data.videoUrl) {
                                    // Replace the scene's video with the lip-synced version.
                                    // Original is preserved on disk under the prior filename
                                    // — we only update the React state pointer.
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
              {/* Henry 2026-06-05 H9: pill picker kept (don't change UI) but new
                  GHS Standard+ / Premium / Best options added so movie-planner users
                  can pick Edge-TTS Nigerian / Gemini / etc. without leaving the pill row. */}
              {([
                { id: "piper",       label: "GHS Standard",       color: accent },
                { id: "edge-tts",    label: "GHS Standard+ (NG)", color: "#10b981" },
                { id: "fal-narrator", label: "FAL Narrator",      color: blue },
                { id: "gemini",      label: "GHS Premium",        color: "#00d4ff" },
                { id: "elevenlabs",  label: "GHS Best",           color: purple },
                { id: "karaoke",     label: "Karaoke",            color: gold },
              ] as const).map(p => (
                <button key={p.id} onClick={() => { setNarrationProvider(p.id); patchProjectSettings({ narrationProvider: p.id }).catch(() => {}); }}
                  style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${effectiveNarrationProvider === p.id ? p.color : border}`,
                    background: effectiveNarrationProvider === p.id ? `${p.color}12` : "transparent",
                    color: effectiveNarrationProvider === p.id ? p.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
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

                {/* AI Write Narration + Generate Audio */}
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

                {/* Hybrid-style scene editor row — Phase A: Movie Planner toolbar */}
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
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ASSEMBLY TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "assembly" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Assembly & Export</h2>

          {/* ── Saved Cuts panel ── */}
          {savedCuts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowCutsPanel(p => !p)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${gold}30`, background: showCutsPanel ? `${gold}10` : `${gold}06`, color: gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Icon.Folder style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>Saved Cuts ({savedCuts.length})</span>
                <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap", flex: 1 }}>
                  {savedCuts.map(c => <span key={c.name} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${gold}20`, color: gold }}>{c.name}</span>)}
                </div>
                <span style={{ fontSize: 10, color: muted }}>{showCutsPanel ? "▲ Close" : "▼ Open"}</span>
              </button>
              {showCutsPanel && (
                <div style={{ background: surface, border: `1px solid ${gold}25`, borderRadius: 12, padding: 12, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {savedCuts.map((c, ci) => (
                    <div key={c.name}
                      onClick={() => { setAssemblyName(c.name); setAssemblySelectedIds(c.sceneIds); if (c.videoUrl) setAssembledUrl(c.videoUrl); setShowCutsPanel(false); setLastAction(`Loaded cut: "${c.name}"`); }}
                      style={{ background: s2, borderRadius: 10, border: `2px solid ${assemblyName === c.name ? gold : border}`, padding: 10, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {c.videoUrl ? <Icon.Film style={{ width: 13, height: 13, flexShrink: 0 }} /> : <Icon.Grid style={{ width: 13, height: 13, flexShrink: 0 }} />}
                        <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? gold : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => prev.filter((_, i) => i !== ci)); }}
                          style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: red, cursor: "pointer", display:"flex", alignItems:"center" }}><Icon.X style={{ width: 10, height: 10 }} /></button>
                      </div>
                      <p style={{ fontSize: 9, color: muted }}>{c.sceneIds.length} scene{c.sceneIds.length !== 1 ? "s" : ""} · {new Date(c.savedAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Cut name + Save ── */}
          <div style={{ ...cardStyle, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Movie / Cut Name</label>
                <input type="text" value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="Main Cut, Director's Cut, Trailer..."
                  style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }} />
              </div>
              <button
                onClick={() => {
                  if (!assemblyName.trim() || assemblySelectedIds.length === 0) return;
                  setSavedCuts(prev => {
                    const existing = prev.findIndex(c => c.name === assemblyName);
                    const cut = { name: assemblyName, sceneIds: assemblySelectedIds, videoUrl: assembledUrl ?? undefined, savedAt: new Date().toISOString() };
                    const next = existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
                    return next;
                  });
                  setLastAction(`Cut "${assemblyName}" saved`);
                }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
                Save Cut
              </button>
            </div>
          </div>

          {/* ── Pre-Flight AI Review ── */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: preflightResult ? (preflightResult.blockingErrors > 0 ? `${red}40` : preflightResult.warnings > 0 ? `${gold}40` : `${green}40`) : `${purple}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon.Star style={{ width: 15, height: 15, color: purple, flexShrink: 0 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI Audio & Audit</p>
              </div>
              {preflightResult && (
                <div style={{ display: "flex", gap: 6 }}>
                  {preflightResult.blockingErrors > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${red}20`, color: red, fontWeight: 700 }}>{preflightResult.blockingErrors} error{preflightResult.blockingErrors !== 1 ? "s" : ""}</span>}
                  {preflightResult.warnings > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${gold}20`, color: gold, fontWeight: 700 }}>{preflightResult.warnings} warning{preflightResult.warnings !== 1 ? "s" : ""}</span>}
                  {preflightResult.canAssemble && preflightResult.warnings === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${green}20`, color: green, fontWeight: 700 }}>Ready</span>}
                </div>
              )}
            </div>
            <button onClick={runPreflight} disabled={preflightRunning}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${purple}30`, background: preflightRunning ? "#2a2040" : `${purple}10`, color: purple, fontSize: 11, fontWeight: 600, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0 }}>
              {preflightRunning ? "AI Audio & Audit running..." : "AI Audio & Audit"}
            </button>
            {preflightResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {preflightResult.checks.map(check => (
                  <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: check.status === "ok" ? `${green}08` : check.status === "warn" ? `${gold}08` : `${red}08`, border: `1px solid ${check.status === "ok" ? green : check.status === "warn" ? gold : red}20` }}>
                    <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}</span>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: check.status === "ok" ? green : check.status === "warn" ? gold : red }}>{check.label}</p>
                      {check.detail && <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{check.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Readiness gate */}
          <div style={{ ...cardStyle, borderColor: assemblyReadiness > 70 ? `${green}30` : `${gold}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Assembly Readiness</p>
              <span style={{ fontSize: 22, fontWeight: 800, color: assemblyReadiness > 70 ? green : gold }}>{assemblyReadiness}%</span>
            </div>
            <ProgressBar label="Overall" value={assemblyReadiness} color={assemblyReadiness > 70 ? green : gold} />

            {/* Validation */}
            <button onClick={runValidation} disabled={validating}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${border}`, background: s2, color: muted, fontSize: 11, cursor: validating ? "not-allowed" : "pointer", marginBottom: 10 }}>
              {validating ? "Validating..." : "Run Validation Check"}
            </button>

            {validation && (
              <div style={{ marginBottom: 10 }}>
                {validation.valid && <p style={{ fontSize: 11, color: green, fontWeight: 600 }}>All checks passed!</p>}
                {validation.errors.map((e, i) => <p key={i} style={{ fontSize: 10, color: red, marginBottom: 2 }}>Error: {e}</p>)}
                {validation.warnings.map((w, i) => <p key={i} style={{ fontSize: 10, color: gold, marginBottom: 2 }}>Warning: {w}</p>)}
              </div>
            )}
          </div>

          {/* Cost + scene count summary */}
          <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#fff" }}>Estimated Credits: <strong style={{ color: accent }}>{moviePlan?.estimatedCredits || 0}</strong></span>
            <span style={{ fontSize: 12, color: muted }}>{assemblySelectedIds.length}/{totalScenes} scenes selected &middot; {generatedScenes} rendered</span>
          </div>

          {/* Scene selection checklist */}
          {totalScenes > 0 && (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Select Scenes for Assembly</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setAssemblySelectedIds(scenes.map(s => `SC${String(s.scene).padStart(2, "0")}`))}
                    style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${green}30`, background: "transparent", color: green, cursor: "pointer" }}>All</button>
                  <button onClick={() => setAssemblySelectedIds([])}
                    style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, cursor: "pointer" }}>None</button>
                </div>
              </div>
              {scenes.map(scene => {
                const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
                const isSelected = assemblySelectedIds.includes(sceneId);
                const hasVid = !!sceneVideos[sceneId];
                const hasImg = !!sceneImages[sceneId];
                return (
                  <div key={scene.scene}
                    onClick={() => setAssemblySelectedIds(prev => isSelected ? prev.filter(id => id !== sceneId) : [...prev, sceneId])}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: isSelected ? `${green}06` : s2, marginBottom: 4, border: `1px solid ${isSelected ? `${green}25` : border}`, cursor: "pointer" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? green : muted}`, background: isSelected ? `${green}20` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isSelected && <Icon.Check style={{ width: 10, height: 10, color: green }} />}
                    </div>
                    {/* Thumbnail */}
                    {(hasImg || hasVid) && (
                      <div style={{ width: 36, height: 24, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                        {hasImg ? <img src={sceneImages[sceneId]} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : null}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sceneId}: {scene.title}</p>
                      <p style={{ fontSize: 9, color: muted }}>{scene.duration} · {scene.generationMethod}</p>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {/* Image/Video toggle — mirrors hybrid assembly */}
                      {(() => {
                        const pref = assemblyMediaPrefs[sceneId];
                        const eff: "image" | "video" = pref ?? (hasVid ? "video" : "image");
                        return (
                          <>
                            <button onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "image" }))}
                              disabled={!hasImg}
                              style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, border: `1px solid ${eff === "image" ? green : border}`, background: eff === "image" && hasImg ? `${green}15` : "transparent", color: hasImg ? (eff === "image" ? green : muted) : "#333", cursor: hasImg ? "pointer" : "not-allowed", fontWeight: eff === "image" ? 700 : 400 }}>
                              Image {eff === "image" ? "✓" : ""}
                            </button>
                            <button onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "video" }))}
                              disabled={!hasVid}
                              style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, border: `1px solid ${eff === "video" ? accent : border}`, background: eff === "video" && hasVid ? `${accent}15` : "transparent", color: hasVid ? (eff === "video" ? accent : muted) : "#333", cursor: hasVid ? "pointer" : "not-allowed", fontWeight: eff === "video" ? 700 : 400 }}>
                              Video {eff === "video" ? "✓" : hasVid ? "" : "(none)"}
                            </button>
                          </>
                        );
                      })()}
                      {!hasImg && !hasVid && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: `${red}10`, color: red }}>no media</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Assembly progress */}
          {(assembling || assemblyComplete) && assemblySelectedIds.map(sceneId => {
            const scene = scenes.find(s => `SC${String(s.scene).padStart(2, "0")}` === sceneId);
            if (!scene) return null;
            const status = assemblyProgress[scene.scene] || "queued";
            return (
              <div key={sceneId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, marginBottom: 4, border: `1px solid ${border}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: status === "done" ? green : status === "processing" ? gold : muted }}>{status === "done" ? <Icon.Check style={{ width: 10, height: 10 }} /> : status === "processing" ? "..." : "○"}</span>
                <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>{sceneId}: {scene.title}</p>
                <span style={{ fontSize: 10, color: muted }}>{status}</span>
              </div>
            );
          })}

          {/* Assembled video preview */}
          {assembledUrl && (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 320 }} />
              <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: green }}>Assembly Complete</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={assembledUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, background: `${green}15`, color: green, textDecoration: "none", fontWeight: 600 }}>
                    Watch Final Movie
                  </a>
                  <a href={assembledUrl} download={`${title || "movie"}.mp4`}
                    style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, background: `${accent}15`, color: accent, textDecoration: "none", fontWeight: 600 }}>
                    Download MP4
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Audio preview */}
          {selectedMusicUrl && (
            <div style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8 }}>Audio Preview</p>
              <p style={{ fontSize: 9, color: muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 1 }}>Background Music</p>
              <audio src={selectedMusicUrl} controls style={{ width: "100%", height: 32 }} />
            </div>
          )}

          {/* AI Supervisor */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSupervisorReport ? 10 : 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: purple }}>AI Supervisor</p>
              <button onClick={runAiSupervisor} disabled={aiSupervisorRunning}
                style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: aiSupervisorRunning ? "#2a2040" : `${purple}20`, color: aiSupervisorRunning ? muted : purple, fontSize: 10, fontWeight: 700, cursor: aiSupervisorRunning ? "not-allowed" : "pointer" }}>
                {aiSupervisorRunning ? "Checking..." : "Run Check"}
              </button>
            </div>
            {aiSupervisorReport && (
              <div style={{ padding: "10px 12px", borderRadius: 8, background: aiSupervisorReport.ok ? `${green}08` : `${gold}06`, border: `1px solid ${aiSupervisorReport.ok ? green : gold}30` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: aiSupervisorReport.ok ? green : gold, marginBottom: 4 }}>
                  {aiSupervisorReport.ok ? "✓ Ready" : "⚠ Issues Found"} — {aiSupervisorReport.summary}
                </p>
                {aiSupervisorReport.issues.map((issue, i) => {
                  const lower = issue.toLowerCase();
                  const fixLabel = lower.includes("sfx") || lower.includes("sound effect") ? "→ Sound tab" :
                    lower.includes("music") ? "→ Sound tab" :
                    lower.includes("narration") || lower.includes("voice") ? "→ Generate Narration" :
                    lower.includes("subtitle") ? "→ Subtitle Style" :
                    lower.includes("scene") || lower.includes("image") ? "→ Scene Board" :
                    lower.includes("cast") || lower.includes("character") ? "→ Cast" : null;
                  const fixAction = lower.includes("sfx") || lower.includes("sound effect") || lower.includes("music") ? () => setActiveTab("sound") :
                    lower.includes("narration") || lower.includes("voice") ? () => runAiSupervisor() :
                    lower.includes("scene") || lower.includes("image") ? () => setActiveTab("scenes") :
                    lower.includes("cast") || lower.includes("character") ? () => setActiveTab("characters") : null;
                  return (
                    <div key={`iss-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
                      <p style={{ fontSize: 10, color: gold, margin: 0, flex: 1 }}>⚠ {issue}</p>
                      {fixLabel && fixAction && (
                        <button onClick={fixAction} style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${gold}40`, background: `${gold}15`, color: gold, fontSize: 8, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          {fixLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!aiSupervisorReport && !aiSupervisorRunning && (
              <p style={{ fontSize: 9, color: muted, marginTop: 6 }}>Run before assembly — checks scenes, audio, and media readiness.</p>
            )}
          </div>

          {/* Subtitle Style */}
          <div style={{ marginBottom: 12 }}>
            <SubtitleStyler value={effectiveSubtitleConfig} onChange={(newCfg) => { setSubtitleConfig(newCfg); patchProjectSettings({ subtitleMode: newCfg.mode, subtitleHighlight: newCfg.highlightColor, subtitleEnabled: newCfg.mode !== "none" }).catch(() => {}); }} accentColor={accent} />
          </div>

          {/* AI Intro / Outro */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>AI Intro / Outro</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              <div>
                {introUrl
                  ? <div style={{ position: "relative" }}>
                      <video src={introUrl} style={{ width: "100%", borderRadius: 8, maxHeight: 80 }} muted />
                      <button onClick={() => setIntroUrl(null)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", padding: "2px 6px" }}>✕</button>
                    </div>
                  : <button
                      onClick={async () => {
                        setGeneratingIntro(true);
                        try {
                          const res = await fetch("/api/video/title-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "intro", studioName: "GIO HOME AI STUDIO", title: title || "My Movie", director: screenplayAuthor || undefined, producer: movieMadeBy || undefined, username: movieIdeaFrom || undefined, duration: 4 }) });
                          const d = await res.json();
                          if (d.videoUrl) setIntroUrl(d.videoUrl);
                        } catch { /* ignore */ } finally { setGeneratingIntro(false); }
                      }}
                      disabled={generatingIntro}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: generatingIntro ? "not-allowed" : "pointer" }}>
                      {generatingIntro ? "Generating…" : "Generate AI Intro"}
                    </button>
                }
              </div>
              <div>
                {outroUrl
                  ? <div style={{ position: "relative" }}>
                      <video src={outroUrl} style={{ width: "100%", borderRadius: 8, maxHeight: 80 }} muted />
                      <button onClick={() => setOutroUrl(null)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", padding: "2px 6px" }}>✕</button>
                    </div>
                  : <button
                      onClick={async () => {
                        setGeneratingOutro(true);
                        try {
                          const res = await fetch("/api/video/title-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "outro", studioName: "GIO HOME AI STUDIO", title: title || "My Movie", director: screenplayAuthor || undefined, producer: movieMadeBy || undefined, username: movieIdeaFrom || undefined, duration: 5 }) });
                          const d = await res.json();
                          if (d.videoUrl) setOutroUrl(d.videoUrl);
                        } catch { /* ignore */ } finally { setGeneratingOutro(false); }
                      }}
                      disabled={generatingOutro}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: generatingOutro ? "not-allowed" : "pointer" }}>
                      {generatingOutro ? "Generating…" : "Generate AI Outro"}
                    </button>
                }
              </div>
            </div>
          </div>

          {/* Credits + Narration↔Subtitle match */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Movie Credits</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Written by</label>
                <input value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Screenplay author"
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Made by</label>
                <input value={movieMadeBy} onChange={e => setMovieMadeBy(e.target.value)} placeholder="Studio / creator"
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Idea from</label>
                <input value={movieIdeaFrom} onChange={e => setMovieIdeaFrom(e.target.value)} placeholder="Original idea by..."
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
            </div>
            <button
              onClick={() => setLastAction(`Credits saved: ${screenplayAuthor} · ${movieMadeBy}`)}
              style={{ marginTop: 10, padding: "8px 18px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Save Credits
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button
                onClick={async () => {
                  setSubtitleMatchResult({ status: "checking", note: "Checking..." });
                  try {
                    const script = expandedStory || idea || "";
                    if (!script.trim()) { setSubtitleMatchResult({ status: "warn", note: "No story text to check against." }); return; }
                    const res = await fetch("/api/free-mode/enhance", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ rawPrompt: `Check if subtitle mode "${effectiveSubtitleConfig.mode}" matches this story tone: "${script.slice(0,300)}". Reply MATCH or MISMATCH in one line.`, mode: "text_to_video" }) });
                    const d = await res.json() as { enhanced?: string };
                    const result = (d.enhanced || "").toLowerCase();
                    setSubtitleMatchResult({ status: result.includes("match") && !result.includes("mismatch") ? "ok" : "warn", note: d.enhanced || "Unable to check" });
                  } catch { setSubtitleMatchResult({ status: "warn", note: "Check failed" }); }
                }}
                style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${accent}40`, background: `${accent}10`, color: accent, fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Check Narration ↔ Subtitle Match
              </button>
              {subtitleMatchResult && (
                <p style={{ fontSize: 9, color: subtitleMatchResult.status === "ok" ? green : subtitleMatchResult.status === "checking" ? muted : "#f59e0b", flex: 1 }}>
                  {subtitleMatchResult.status === "ok" ? "✓" : subtitleMatchResult.status === "checking" ? "…" : "⚠"} {subtitleMatchResult.note.slice(0,120)}
                </p>
              )}
            </div>
          </div>

          {/* Assemble / Editor buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {!assemblyComplete ? (
              <button
                data-testid="assemble-movie-btn"
                onClick={assembleMovie}
                disabled={assembling || assemblySelectedIds.length === 0}
                style={{ ...btnPrimary, flex: 1, background: (assembling || assemblySelectedIds.length === 0) ? "#2a2a40" : green, color: "#000" }}>
                {assembling ? "Assembling..." : `Assemble "${assemblyName}" (${assemblySelectedIds.length} scenes)`}
              </button>
            ) : (
              <a href="/dashboard/collaborative-editor?from=movie-planner" style={{ flex: 1, textDecoration: "none" }}
                onClick={() => { /* return state handled via URL params */ }}>
                <button style={{ ...btnPrimary, width: "100%", background: purple, color: "#fff" }}>Open in Editor</button>
              </a>
            )}
          </div>
          <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>
            FFmpeg merges selected scenes + audio into one video. Auto-saved to Asset Library.
          </p>
        </div>
      )}

      </div>

      {/* ── AI Supervisor Status Bar ─────────────────────────────────────────── */}
      {(() => {
        const FLOW: { id: WorkshopTab; label: string }[] = [
          { id: "design",     label: "Story & Draft" },
          { id: "story",      label: "Screenplay" },
          { id: "script",     label: "Voice & Audio" },
          { id: "sound",      label: "Cast" },
          { id: "characters", label: "Scene Board" },
          { id: "scenes",     label: "Assembly" },
          { id: "assembly",   label: "Overview" },
        ];
        const idx = FLOW.findIndex(t => t.id === activeTab);
        const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx] : null;
        return (
          <SupervisorStatusBar
            plannerType="movie"
            projectId={projectId}
            designComplete={!!(genre || style || format)}
            storyComplete={!!(expandedStory || idea)}
            charactersComplete={savedCharacters.length > 0}
            soundComplete={!!(effectiveNarrationProvider && effectiveNarrationProvider !== "piper") || autoSfx}
            scenesComplete={(moviePlan?.scenes ?? []).length > 0}
            assemblyComplete={!!assembledUrl}
            storyText={expandedStory || idea}
            nextTabLabel={next?.label}
            onNextTab={next ? () => setActiveTab(FLOW[idx + 1].id) : undefined}
            onAutoFix={(section) => {
              const tabMap: Record<string, WorkshopTab> = {
                design: "design", story: "story", characters: "characters",
                sound: "sound", scenes: "scenes", assembly: "assembly",
              };
              const target = tabMap[section] as WorkshopTab;
              if (target) setActiveTab(target);
            }}
          />
        );
      })()}
    </div>
  );
}
