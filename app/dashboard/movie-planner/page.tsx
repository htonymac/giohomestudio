"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
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

const SCENE_ENERGY_COLOR: Record<string, string> = {
  chaotic: "#ef4444", tense: "#eab308", dramatic: "#a855f7",
  mysterious: "#6366f1", peaceful: "#22d3ee", calm: "#22d3ee",
};

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

// ── AID Model Data (module-level — not recreated per render) ────────────

const AID_VIDEO_MODELS: Array<{
  id: string; name: string; price: number; network: "Segmind"|"MuAPI"|"FAL"|"Runway"|"Kling";
  res: string; maxSec: number; color: string;
  scores: { "2d": number; "3d": number; cartoon: number; realistic: number };
  tags2d?: string; tags3d?: string; tagCartoon?: string; tagRealistic?: string;
}> = [
  { id:"segmind_pruna_video",     name:"Pruna P Video",       price:0.005, network:"Segmind", res:"720p",   maxSec:15, color:"#22c55e", scores:{"2d":2,"3d":1,"cartoon":3,"realistic":1}, tags2d:"drafts only", tagCartoon:"budget cartoon draft" },
  // fal_ltx_video REMOVED — times out at 30% consistently.
  { id:"muapi_seedance_lite",     name:"Seedance Lite",       price:0.020, network:"MuAPI",   res:"480p",   maxSec:5,  color:"#6ee7b7", scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2}, tags2d:"cheap Seedance draft", tagCartoon:"cheap animated motion" },
  { id:"fal_wan_lite",            name:"Wan Lite 1.3B",       price:0.025, network:"FAL",     res:"480p",   maxSec:5,  color:"#4ade80", scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2}, tags2d:"budget Wan draft", tagCartoon:"cheap Wan motion" },
  { id:"muapi_wan_v2_1_480p",     name:"Wan 2.1 480p",        price:0.03,  network:"MuAPI",   res:"480p",   maxSec:5,  color:"#34d399", scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2}, tags2d:"cheap 2D draft", tagCartoon:"cheap animated draft" },
  { id:"muapi_seedance_v1_pro",   name:"Seedance 1.0 Pro",    price:0.04,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#4ade80", scores:{"2d":4,"3d":2,"cartoon":4,"realistic":2}, tags2d:"clean flat motion", tagCartoon:"smooth cartoon motion" },
  { id:"muapi_wan_v2_1_720p",     name:"Wan 2.1 720p",        price:0.05,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#2dd4bf", scores:{"2d":3,"3d":3,"cartoon":3,"realistic":3}, tags2d:"solid 2D", tags3d:"budget 3D scenes", tagRealistic:"basic realism" },
  { id:"muapi_seedance_v2",       name:"Seedance 2.0",        price:0.08,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#38bdf8", scores:{"2d":5,"3d":3,"cartoon":5,"realistic":3}, tags2d:"BEST 2D on MuAPI", tagCartoon:"BEST cartoon on MuAPI", tags3d:"decent 3D" },
  { id:"muapi_seedance_v2_1080p", name:"Seedance 2.0 1080p",  price:0.12,  network:"MuAPI",   res:"1080p",  maxSec:5,  color:"#60a5fa", scores:{"2d":5,"3d":4,"cartoon":5,"realistic":4}, tags2d:"BEST 2D full HD", tagCartoon:"BEST cartoon HD", tags3d:"good 3D detail", tagRealistic:"cinematic realism" },
  { id:"fal_hailuo_standard",     name:"Hailuo Standard",     price:0.05,  network:"FAL",     res:"720p",   maxSec:6,  color:"#a3e635", scores:{"2d":3,"3d":3,"cartoon":4,"realistic":2}, tagCartoon:"expressive cartoon", tags2d:"stylized 2D" },
  { id:"fal_kling_2_5_standard",  name:"Kling 2.5 Standard",  price:0.10,  network:"FAL",     res:"1080p",  maxSec:10, color:"#facc15", scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4}, tags3d:"solid 3D scenes", tagRealistic:"good realism, 10s" },
  { id:"fal_hailuo_pro",          name:"Hailuo Pro",          price:0.15,  network:"FAL",     res:"1080p",  maxSec:6,  color:"#fb923c", scores:{"2d":4,"3d":3,"cartoon":5,"realistic":3}, tagCartoon:"premium cartoon quality", tags2d:"expressive 2D" },
  { id:"fal_wan_pro",             name:"Wan Pro",             price:0.12,  network:"FAL",     res:"1080p",  maxSec:10, color:"#f472b6", scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4}, tags3d:"smooth 3D, 10s", tagRealistic:"natural motion, 10s" },
  { id:"fal_kling_2_5_turbo_pro", name:"Kling 2.5 Turbo",     price:0.20,  network:"FAL",     res:"1080p",  maxSec:10, color:"#a78bfa", scores:{"2d":4,"3d":5,"cartoon":3,"realistic":5}, tags3d:"premium 3D fast", tagRealistic:"high realism, fast" },
  { id:"fal_kling_3_pro",         name:"Kling 3.0 Pro",       price:0.30,  network:"FAL",     res:"1080p",  maxSec:10, color:"#c084fc", scores:{"2d":4,"3d":5,"cartoon":4,"realistic":5}, tags3d:"TOP 3D cinematic", tagRealistic:"TOP realism on FAL", tagCartoon:"cinematic cartoon" },
  { id:"fal_runway_gen4",         name:"Runway Gen-4 (FAL)",  price:0.25,  network:"FAL",     res:"1080p",  maxSec:10, color:"#d946ef", scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5}, tags3d:"cinematic 3D", tagRealistic:"near-photorealistic" },
  { id:"runway_gen4_direct",      name:"Runway Direct ★",     price:0,     network:"Runway",  res:"720p",   maxSec:10, color:"#e879f9", scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5}, tags3d:"YOUR CREDITS — cinematic 3D", tagRealistic:"YOUR CREDITS — best realistic" },
  { id:"kling_direct_v1_5_std",   name:"Kling 1.6 Direct ★",  price:0.045, network:"Kling",   res:"720p",   maxSec:10, color:"#fbbf24", scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4}, tags3d:"direct Kling 3D", tagRealistic:"direct API realism" },
  { id:"kling_direct_v2_5_std",   name:"Kling 2.5 Direct ★",  price:0.10,  network:"Kling",   res:"1080p",  maxSec:10, color:"#f59e0b", scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5}, tags3d:"BEST direct 3D cinematic", tagRealistic:"TOP direct realism, 10s" },
  { id:"kling_direct_v2_5_pro",   name:"Kling 2.5 Pro ★",     price:0.20,  network:"Kling",   res:"1080p",  maxSec:10, color:"#d97706", scores:{"2d":4,"3d":5,"cartoon":4,"realistic":5}, tags3d:"TOP 3D — premium Kling", tagRealistic:"HIGHEST direct realism", tagCartoon:"cinematic cartoon premium" },
];

const AID_IMAGE_MODELS = [
  { id:"segmind_pruna",         name:"Pruna P Image",        price:0.005, network:"Segmind", res:"1024px", color:"#22c55e", desc:"Cheapest image. Fast drafts." },
  { id:"fal_flux_schnell",      name:"Flux Schnell",         price:0.003, network:"FAL",     res:"1024px", color:"#4ade80", desc:"Fastest FAL image. Very cheap." },
  { id:"fal_flux_dev",          name:"Flux Dev",             price:0.025, network:"FAL",     res:"1024px", color:"#facc15", desc:"Better detail. Good balance." },
  { id:"fal_ideogram_v3_turbo", name:"Ideogram v3 Turbo",    price:0.020, network:"FAL",     res:"1024px", color:"#fb923c", desc:"Best text rendering. Titles/posters." },
  { id:"fal_seedream",          name:"Seedream",             price:0.020, network:"FAL",     res:"1024px", color:"#38bdf8", desc:"Polished commercial stills." },
  { id:"fal_nano_banana",       name:"Nano Banana 2",        price:0.030, network:"FAL",     res:"1024px", color:"#a78bfa", desc:"Strong generation + editing." },
  { id:"fal_flux_pro",          name:"Flux Pro",             price:0.050, network:"FAL",     res:"1024px", color:"#c084fc", desc:"Top-tier Flux. Best photorealism." },
  { id:"fal_ideogram_v3_quality",name:"Ideogram v3 Quality", price:0.040, network:"FAL",     res:"1024px", color:"#d946ef", desc:"High quality text + branded graphics." },
  { id:"fal_recraft_v3",        name:"Recraft v3",           price:0.040, network:"FAL",     res:"1024px", color:"#e879f9", desc:"Design-style product illustrations." },
  { id:"fal_flux_pro_ultra",    name:"Flux Pro Ultra",       price:0.060, network:"FAL",     res:"2048px", color:"#f472b6", desc:"Highest resolution. Print quality." },
];

// ── Workshop Tab Definitions ────────────────────────────────────────────

type WorkshopTab = "design" | "story" | "characters" | "scenes" | "screenplay" | "audio" | "assembly" | "overview";

// Design → Story → Cast → Scene Board → Screenplay → Audio → Assembly → Overview
const WORKSHOP_TABS: { id: WorkshopTab; label: string }[] = [
  { id: "design",     label: "Design" },
  { id: "story",      label: "Story & Draft" },
  { id: "characters", label: "Cast" },
  { id: "scenes",     label: "Scene Board" },
  { id: "screenplay", label: "Screenplay" },
  { id: "audio",      label: "Audio & Shots" },
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
  const [expandedStory, setExpandedStory] = useState("");
  const [duration, setDuration] = useState("10 min");
  const [language, setLanguage] = useState("English");

  // ── Design ──
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
  // ── Portrait image model selector (Cast tab) ──
  const [castPortraitModel, setCastPortraitModel] = useState<"fal_flux_schnell" | "segmind_pruna" | "fal_flux_dev">("fal_flux_schnell");

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
  const [narrationProvider, setNarrationProvider] = useState<"piper" | "fal-narrator" | "elevenlabs" | "karaoke">("piper");
  const [autoSfx, setAutoSfx] = useState(true);

  // ── Project persistence ──
  const [projectList, setProjectList] = useState<Array<{ id: string; title: string; genre: string | null; status: string; updatedAt: string; _count: { scenes: number } }>>([]);
  const [showContinue, setShowContinue] = useState(false);
  const [renderingScene, setRenderingScene] = useState<number | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);

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
  const [soundTab, setSoundTab] = useState<"freesound" | "elevenlabs">("freesound");
  const [fsQuery, setFsQuery] = useState("");
  const [fsResults, setFsResults] = useState<Array<{ id: number; name: string; duration: number; license: string; username: string; previewUrl: string; tags: string[] }>>([]);
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
  const [screenplayError, setScreenplayError] = useState("");
  const [generatingScreenplay, setGeneratingScreenplay] = useState(false);
  const [parsingScript, setParsingScript] = useState(false);
  const [scriptSegments, setScriptSegments] = useState<Array<{ type: "narration"|"dialogue"; speaker?: string; text: string }>>([]);
  const [showScriptReview, setShowScriptReview] = useState(false);
  const [sendingToScenes, setSendingToScenes] = useState(false);
  const [sendToScenesResult, setSendToScenesResult] = useState("");
  const [assemblyName, setAssemblyName] = useState("Main Cut");
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; sceneIds: string[]; videoUrl?: string; savedAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("ghs_movie_cuts") || "[]"); } catch { return []; }
  });
  const [showCutsPanel, setShowCutsPanel] = useState(false);

  // ── Story AI provider ──
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-haiku-4-5-20251001");

  // ── Story expand pipeline ──
  const [expanding, setExpanding] = useState(false);

  // ── Music library ──
  const [musicLibrary, setMusicLibrary] = useState<MusicAsset[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusicUrl, setSelectedMusicUrl] = useState<string | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState("");
  const [aiPickingMusic, setAiPickingMusic] = useState(false);
  const [aiMusicPickLog, setAiMusicPickLog] = useState("");

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
    if (!hasAudio) return { text: "Plan audio for each scene in the Audio tab", color: gold, targetTab: "audio" as WorkshopTab };
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

  // Restore state from localStorage if returning from editor
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ghs_movie_planner_return");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timestamp && Date.now() - data.timestamp < 3600000) {
          if (data.projectId) setProjectId(data.projectId);
          if (data.activeTab) setActiveTab(data.activeTab);
        }
        localStorage.removeItem("ghs_movie_planner_return");
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!moviePlan && !idea.trim()) return;
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
    }
  }

  // ── Delete project ──
  async function deleteProject(id: string) {
    await fetch(`/api/movie-planner/project/${id}`, { method: "DELETE" }).catch((err) => { console.error("deleteProject:", err); setErrorMsg(`Failed to delete project: ${err instanceof Error ? err.message : "Unknown error"}`); });
    setProjectList(prev => prev.filter(p => p.id !== id));
    if (projectId === id) { setProjectId(null); setActiveTab("design"); }
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
      }
    } catch (err) {
      console.error("makeSceneImage error:", err);
      setErrorMsg(`Failed to generate image for Scene ${scene.scene}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingSceneImage(null);
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
          model: selectedVideoModelId,
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
          planningDepth, tone, setting, language,
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
          language,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          tier: aiTier,
          styleHint: style || undefined,
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
      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: sceneSummary,
          characters: extractedChars.map(c => ({ characterId: c.id, displayName: c.name, role: c.role })),
          projectId: projectId || undefined,
          styleHint: style || undefined,
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
          audioConfig: { narrationProvider: narrationProvider, musicUrl: selectedMusicUrl, musicName: selectedMusicName },
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

  // ── Assemble Final Movie ──
  async function assembleMovie() {
    if (!moviePlan) return;
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

        if (videoUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl });
        } else if (imageUrl) {
          // Use img: prefix so the assemble API knows to convert image to video segment
          assemblyScenes.push({ scene: s.scene, videoUrl: `img:${imageUrl}` });
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

      const res = await fetch("/api/video/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title: assemblyName || title,
          scenes: assemblyScenes,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(`Assembly API error: ${data.error}`);
      } else if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        // Save to asset library
        try {
          await fetch("/api/asset-library", {
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
    setLastAction(`Generating narration audio for Scene ${scene.scene} via ${narrationProvider}...`);
    try {
      // Route to /api/tts for cloud providers, narrate-piper for local
      const endpoint = (narrationProvider === "fal-narrator" || narrationProvider === "elevenlabs")
        ? "/api/tts"
        : "/api/hybrid/narrate-piper";
      const payload = (narrationProvider === "fal-narrator" || narrationProvider === "elevenlabs")
        ? { text, provider: narrationProvider, speed: 0.85 }
        : { text, sceneId: `SC${String(scene.scene).padStart(2, "0")}`, model: "en_US-lessac-medium", speed: 0.85, provider: narrationProvider };
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.audioUrl || data.filePath) {
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
        setLastAction(`Scene ${sceneId}: description polished`);
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
      <div style={{ padding: "24px 32px 0" }}>
        <HeroTitle kicker="Production Workshop" title="Movie & Series" italic="Planner" sub="Plan, create, review, and assemble your production." />
        {/* Project toolbar */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, marginBottom: 20 }}>
          <input value={title} onChange={e => setTitle(e.target.value)}
            style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, width: 220, outline: "none", fontFamily: ds.font.sans }}
            placeholder="Project Title" />
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
        const activeModelId = isVideo ? selectedVideoModelId : selectedImageModelId;
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
                  const isSelected = selectedVideoModelId === m.id;
                  const styleScore = aidStyle === "all" ? null : m.scores[aidStyle as Exclude<StyleKey,"all">];
                  const styleTag = aidStyle==="2d"?m.tags2d:aidStyle==="3d"?m.tags3d:aidStyle==="cartoon"?m.tagCartoon:aidStyle==="realistic"?m.tagRealistic:undefined;
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedVideoModelId(m.id); setShowAidPicker(false); }}
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
                  const isSelected = selectedImageModelId === m.id;
                  const isCheapest = m.id === "fal_flux_schnell";
                  const isBest = m.id === "fal_flux_pro_ultra";
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedImageModelId(m.id); setShowAidPicker(false); }}
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
      {activeTab === "overview" && (
        <div>
          {/* Stats grid — 5 columns */}
          <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: accent }}>{totalScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Total Scenes</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: gold }}>{draftScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Draft</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: green }}>{approvedScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Approved</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: red }}>{blockedScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Blocked</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: purple }}>{savedCharacters.length}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Characters</p>
            </div>
          </div>

          {/* Progress + Resume side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Production Progress</p>
              <ProgressBar label="Story" value={storyProgress} color={accent} />
              <ProgressBar label="Characters" value={characterProgress} color={purple} />
              <ProgressBar label="AI Planning" value={planningProgress} color={gold} />
              <ProgressBar label="Scenes Generated" value={sceneProgress} color={blue} />
              <ProgressBar label="Scene Images" value={imageProgress} color={green} />
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginTop: 6 }}>
                <ProgressBar label="Assembly Readiness" value={assemblyReadiness} color={assemblyReadiness > 70 ? green : assemblyReadiness > 40 ? gold : red} />
              </div>
            </div>

            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Resume & Next Steps</p>
              <div style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}`, marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Last Action</p>
                <p style={{ fontSize: 12, color: "#fff" }}>{lastAction}</p>
              </div>
              <div style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}`, marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Phase</p>
                <p style={{ fontSize: 12, color: "#fff" }}>{projectPhase.replace(/_/g, " ")}</p>
              </div>
              <div style={{ background: `${accent}08`, borderRadius: 10, padding: 12, border: `1px solid ${accent}20` }}>
                <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Next Step</p>
                <p style={{ fontSize: 12, color: "#fff" }}>
                  {!genre ? "Set movie design first (genre, tone, format)" :
                   !idea ? "Write your story idea" :
                   selectedCast.length === 0 ? "Select your cast" :
                   !moviePlan ? "Run AI Planning" :
                   generatedImages < totalScenes ? `Generate images for ${totalScenes - generatedImages} scenes` :
                   generatedScenes < totalScenes ? "Render remaining scenes" :
                   "Ready for assembly!"}
                </p>
                <button onClick={() => {
                  if (!genre) setActiveTab("design");
                  else if (!idea) setActiveTab("story");
                  else if (selectedCast.length === 0) setActiveTab("characters");
                  else if (!moviePlan) setActiveTab("story");
                  else if (generatedImages < totalScenes) setActiveTab("scenes");
                  else setActiveTab("assembly");
                }} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  Go
                </button>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ ...cardStyle, borderColor: `${gold}30`, background: `${gold}04` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: gold, marginBottom: 10 }}>Warnings & Blockers ({warnings.length})</p>
              {warnings.slice(0, 8).map((w, i) => {
                const fixTab: WorkshopTab = w.includes("voice") || w.includes("portrait") ? "characters" : w.includes("Scene") || w.includes("image") ? "scenes" : w.includes("character") || w.includes("cast") ? "characters" : "overview";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: `${gold}06`, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: gold }}>!</span>
                    <p style={{ fontSize: 11, color: gold, flex: 1 }}>{w}</p>
                    <button onClick={() => setActiveTab(fixTab)} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${gold}30`, background: "transparent", color: gold, fontSize: 8, cursor: "pointer", flexShrink: 0 }}>Fix</button>
                  </div>
                );
              })}
              {warnings.length > 8 && <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>+{warnings.length - 8} more</p>}
            </div>
          )}

          {/* Quick Links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <button onClick={() => setActiveTab("scenes")} style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${blue}20` }}>
              <Icon.Film style={{ width: 24, height: 24, color: blue, marginBottom: 6 }} />
              <p style={{ fontSize: 11, color: blue, fontWeight: 600, marginTop: 6 }}>Scene Board</p>
            </button>
            <a href="/dashboard/character-voices" style={{ textDecoration: "none" }}>
              <div style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${purple}20` }}>
                <Icon.User style={{ width: 24, height: 24, color: purple, marginBottom: 6 }} />
                <p style={{ fontSize: 11, color: purple, fontWeight: 600, marginTop: 6 }}>Character Registry</p>
              </div>
            </a>
            <a href="/dashboard/collaborative-editor?from=movie-planner" style={{ textDecoration: "none" }}
              onClick={() => { try { localStorage.setItem("ghs_movie_planner_return", JSON.stringify({ projectId, activeTab, timestamp: Date.now() })); } catch {} }}>
              <div style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${accent}20` }}>
                <Icon.Wand style={{ width: 24, height: 24, color: accent, marginBottom: 6 }} />
                <p style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 6 }}>Open Editor</p>
              </div>
            </a>
            <button onClick={() => setActiveTab("assembly")} style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${gold}20` }}>
              <Icon.Bolt style={{ width: 24, height: 24, color: gold, marginBottom: 6 }} />
              <p style={{ fontSize: 11, color: gold, fontWeight: 600, marginTop: 6 }}>Assembly</p>
            </button>
          </div>

          {/* Cost summary */}
          {moviePlan && (
            <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#fff" }}>Estimated Credits: <strong style={{ color: accent }}>{moviePlan.estimatedCredits}</strong></span>
              <span style={{ fontSize: 12, color: muted }}>{totalScenes} scenes &middot; {format || "hybrid"} format</span>
            </div>
          )}

          {/* Assembled video in Overview */}
          {assembledUrl && (
            <div style={{ ...cardStyle, borderColor: `${green}40`, background: `${green}04` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: green, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Check style={{ width: 14, height: 14 }} /> Movie Assembled
              </p>
              <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 280, borderRadius: 10, marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <a href={assembledUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: `1px solid ${green}30`, background: `${green}08`, color: green, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Watch Full Movie
                  </button>
                </a>
                <a href={assembledUrl} download={`${title || "movie"}.mp4`} style={{ flex: 1, textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: `1px solid ${accent}30`, background: `${accent}08`, color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Download MP4
                  </button>
                </a>
              </div>
            </div>
          )}

          {/* Movie Blueprint if exists */}
          {moviePlan && (
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Movie Blueprint</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{moviePlan.summary}</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STORY & DRAFT TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "story" && (
        <div>
          {/* Design-first nudge — shown if genre/format not yet set */}
          {!genre && (
            <div onClick={() => setActiveTab("design")}
              style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 12, cursor: "pointer", background: `${gold}08`, border: `1px solid ${gold}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: gold }}>Set Design First</p>
                <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>Genre, tone, format, and style feed the AI — without them the AI plans a generic movie, not your movie.</p>
              </div>
              <span style={{ fontSize: 11, color: gold, whiteSpace: "nowrap", marginLeft: 16 }}>Go to Design</span>
            </div>
          )}
          {genre && (
            <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 12, background: `${green}08`, border: `1px solid ${green}20`, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: green, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon.Check style={{ width: 12, height: 12 }} /> Design set:</span>
              <span style={{ fontSize: 11, color: muted }}>{genre}{tone ? ` · ${tone}` : ""}{setting ? ` · ${setting}` : ""}{format ? ` · ${FORMATS.find(f => f.id === format)?.label || format}` : ""}</span>
              <button onClick={() => setActiveTab("design")} style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: `1px solid ${green}30`, background: "transparent", color: green, fontSize: 10, cursor: "pointer" }}>Edit Design</button>
            </div>
          )}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Story & Draft</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Movie Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The Last Guardian" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Movie Idea *</label>
              <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={5}
                placeholder="e.g. 'The man walked slowly toward the giant snake. The beast glared at him like prey. Beside him was a fallen log. He grabbed it and prepared to fight.'"
                style={{ ...inputStyle, resize: "vertical" }} />
              <p style={{ fontSize: 10, color: "#3d5060", marginTop: 6 }}>Write short — AI will expand this into full cinematic detail.</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Expanded Story (optional)</label>
              <textarea value={expandedStory} onChange={e => setExpandedStory(e.target.value)} rows={4}
                placeholder="Add more story detail if you have it — backstory, character motivations, key plot points..."
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Duration</label>
                <DurationPicker
                  preset="episode"
                  value={duration}
                  onChange={(label: string) => setDuration(label)}
                  label=""
                  accentColor="#7c5cfc"
                />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["English (US)", "English (UK)", "English (AU)", "French", "Spanish", "Portuguese", "Arabic", "Hindi", "Mandarin", "Swahili", "German", "Italian", "Japanese", "Korean", "Russian", "Turkish", "Dutch", "Mixed"].map(l => (
                    <option key={l} value={l} style={{ background: surface }}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Cost Preference</label>
                <select value={format === "audio_only" ? "free" : "balanced"} onChange={() => {}} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["efficient", "balanced", "premium"].map(c => <option key={c} value={c} style={{ background: surface }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Audience</label>
                <select defaultValue="general" style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["general", "children", "teens", "adults", "business", "family"].map(a => <option key={a} value={a} style={{ background: surface }}>{a}</option>)}
                </select>
              </div>
            </div>

            <AITierSelector value={aiTier} onChange={setAiTier} compact />

            <div style={{ display: "flex", gap: 10, marginBottom: 0, marginTop: 10 }}>
              <button onClick={() => expandStory()} disabled={!idea.trim() || expanding}
                style={{ ...btnPrimary, flex: 1, background: !idea.trim() || expanding ? "#2a2a40" : "linear-gradient(135deg, #22c55e, #16a34a)", cursor: !idea.trim() || expanding ? "not-allowed" : "pointer" }}>
                {expanding ? "Expanding Story..." : "Expand with AI Intelligence"}
              </button>
              <button onClick={() => {
                if (!idea.trim()) return;
                if (!genre) { setLastAction("Set Design before running AI planning"); setActiveTab("design"); return; }
                generateMoviePlan();
              }} disabled={!idea.trim() || planning}
                style={{ ...btnPrimary, flex: 1, background: !idea.trim() || planning ? "#2a2a40" : !genre ? gold : "#7c5cfc", cursor: !idea.trim() || planning ? "not-allowed" : "pointer" }}>
                {planning ? "Planning..." : !genre ? "Set Design First" : "Generate Movie Plan"}
              </button>
            </div>
            {expanding && <p style={{ fontSize: 10, color: accent, marginTop: 8, textAlign: "center" }}>Running 3-step pipeline: story expand → character extract → scene plan...</p>}
          </div>

          {/* Expanded summary display */}
          {expandedStory && (
            <div style={{ ...cardStyle, borderColor: `${accent}20` }}>
              <p style={labelStyle}>Expanded Story</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{expandedStory}</p>
            </div>
          )}

          {/* Draft Zone */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Draft Zone — Unfinished Scenes</p>
            {scenes.filter(s => s.status === "planned" || s.status === "needs_edit").length > 0 ? (
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>{draftScenes} scenes in draft</p>
                {scenes.filter(s => s.status === "planned" || s.status === "needs_edit").map(s => (
                  <div key={s.scene} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, marginBottom: 4, border: `1px solid ${border}` }}>
                    <span style={badgeStyle(gold)}>SC{String(s.scene).padStart(2, "0")}</span>
                    <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>{s.title}</p>
                    <span style={{ fontSize: 9, color: muted }}>{sceneImages[`SC${String(s.scene).padStart(2, "0")}`] ? "has image" : "no image"}</span>
                    <button onClick={() => { setActiveTab("scenes"); setSelectedScene(s.scene); }}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: blue, fontSize: 9, cursor: "pointer" }}>Open</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: muted }}>{totalScenes === 0 ? "No scenes created yet. Run AI Planning from the Design tab." : "All scenes reviewed or approved!"}</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESIGN TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "design" && (
        <div>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Design Your Movie</h2>
            <p style={{ fontSize: 12, color: muted, marginBottom: 24 }}>These layers tell AI how to plan your production.</p>

            {/* Genre */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Story Genre</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GENRES.map(g => <button key={g} onClick={() => setGenre(g)} style={pillStyle(genre === g)}>{g}</button>)}
              </div>
            </div>

            {/* Style */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Storytelling Style</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STYLES.map(s => <button key={s} onClick={() => setStyle(s)} style={pillStyle(style === s, blue)}>{s}</button>)}
              </div>
            </div>

            {/* Format cards with radio */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Production Format</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {FORMATS.map(f => {
                  const isSelected = format === f.id;
                  const color = f.badgeColor;
                  return (
                    <button key={f.id} onClick={() => setFormat(f.id)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 18px", borderRadius: 14, border: `2px solid ${isSelected ? color : border}`, background: isSelected ? `${color}08` : "transparent", cursor: "pointer", textAlign: "left", transition: "all 0.2s", position: "relative" }}>
                      {f.badge && (
                        <span style={{ position: "absolute", top: -1, right: 16, fontSize: 8, fontWeight: 800, padding: "3px 10px", borderRadius: "0 0 8px 8px", background: color, color: f.badge === "BUDGET" || f.badge === "FREE" ? "#000" : "#fff", letterSpacing: 0.5 }}>
                          {f.badge}
                        </span>
                      )}
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isSelected ? color : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{f.label}</p>
                          <span style={{ fontSize: 10, color, fontWeight: 600 }}>{f.cost}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#8090a0", lineHeight: 1.5 }}>{f.desc}</p>
                        {isSelected && f.detail && (
                          <p style={{ fontSize: 11, color: "#5a7080", lineHeight: 1.6, marginTop: 8, padding: "10px 12px", borderRadius: 8, background: s2, border: `1px solid ${border}` }}>
                            {f.detail}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Production Mode */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Production Mode</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PRODUCTION_MODES.map(m => (
                  <button key={m.id} onClick={() => setProductionMode(m.id)}
                    style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `1px solid ${productionMode === m.id ? green : border}`, background: productionMode === m.id ? "rgba(34,197,94,0.06)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                    <p style={{ fontSize: 10, color: muted }}>{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone + Setting side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Tone / Mood</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TONES.map(t => <button key={t} onClick={() => setTone(t)} style={{ ...pillStyle(tone === t, "#ec4899"), fontSize: 11, padding: "6px 12px" }}>{t}</button>)}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Setting / World</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SETTINGS.map(s => <button key={s} onClick={() => setSetting(s)} style={{ ...pillStyle(setting === s, blue), fontSize: 11, padding: "6px 12px" }}>{s}</button>)}
                </div>
              </div>
            </div>

            {/* Intelligence Tier */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>AI Intelligence Tier</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PLANNING_DEPTHS.map(p => {
                  const isSelected = planningDepth === p.id;
                  const color = p.badgeColor;
                  return (
                    <button key={p.id} onClick={() => setPlanningDepth(p.id)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, border: `1px solid ${isSelected ? color : border}`, background: isSelected ? `${color}08` : "transparent", cursor: "pointer", textAlign: "left", position: "relative" }}>
                      {p.badge && (
                        <span style={{ position: "absolute", top: -1, right: 14, fontSize: 8, fontWeight: 800, padding: "2px 8px", borderRadius: "0 0 6px 6px", background: color, color: p.badge === "PREMIUM" ? "#000" : "#fff" }}>
                          {p.badge}
                        </span>
                      )}
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? color : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                        {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.label}</p>
                          <span style={{ fontSize: 10, color }}>{p.cost}</span>
                        </div>
                        <p style={{ fontSize: 11, color: muted }}>{p.desc}</p>
                        {isSelected && p.detail && (
                          <p style={{ fontSize: 10, color: "#5a7080", marginTop: 6, padding: "8px 10px", borderRadius: 6, background: s2, border: `1px solid ${border}` }}>
                            {p.detail}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LLM Intelligence Grade for Story Expansion */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Story Expansion Intelligence</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { value: "ollama",                        label: "Local LLM",  sub: "Ollama · Free · No cloud cost",                      color: green,  badge: "FREE" },
                  { value: "claude:claude-haiku-4-5-20251001", label: "Standard",   sub: "Claude Haiku 4.5 · Fast · Low cost",                 color: blue,   badge: "FAST" },
                  { value: "claude:claude-sonnet-4-6",      label: "Pro",        sub: "Claude Sonnet 4.6 · Best balance · Recommended",      color: accent, badge: "REC" },
                  { value: "claude:claude-opus-4-7",        label: "Premium",    sub: "Claude Opus 4.7 · Highest quality · Most powerful",   color: gold,   badge: "TOP" },
                ].map(tier => {
                  const sel = storyAiProvider === tier.value;
                  return (
                    <button key={tier.value} onClick={() => setStoryAiProvider(tier.value)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: `1px solid ${sel ? tier.color : border}`, background: sel ? `${tier.color}10` : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${sel ? tier.color : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {sel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: tier.color }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{tier.label}</span>
                          <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 20, background: `${tier.color}20`, color: tier.color, fontWeight: 700 }}>{tier.badge}</span>
                        </div>
                        <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{tier.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two-button CTA: confirm design → story, OR generate directly if story already written */}
            <div style={{ display: "flex", gap: 10 }}>
              {!idea.trim() ? (
                <button onClick={() => { setActiveTab("story"); setLastAction("Design set — write your story"); }}
                  disabled={!genre}
                  style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: genre ? gold : "#2a2a40", color: "#000", fontSize: 14, fontWeight: 700, cursor: genre ? "pointer" : "not-allowed" }}>
                  {genre ? "Design Set — Write Story" : "Select a genre above first"}
                </button>
              ) : (
                <button onClick={() => generateMoviePlan()} disabled={!idea.trim() || planning}
                  style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (idea.trim() && !planning) ? accent : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (idea.trim() && !planning) ? "pointer" : "not-allowed" }}>
                  {planning ? "Generating Movie Plan..." : "Generate Movie Plan"}
                </button>
              )}
              {idea.trim() && !planning && (
                <button onClick={() => setActiveTab("story")}
                  style={{ padding: "16px 20px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                  Edit Story
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS (CAST) TAB                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "characters" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Cast ({selectedCast.length} selected)</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/dashboard/character-voices?returnTo=movie-planner" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${accent}30`, background: "transparent", color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  + Create New
                </button>
              </a>
              <button onClick={() => setShowCharacterPicker(prev => !prev)}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                {showCharacterPicker ? "Hide Library" : "or import saved →"}
              </button>
            </div>
          </div>

          {/* ── PRIMARY ACTION: Build Story Characters with AI ── */}
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${purple}40`, background: `${purple}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Icon.Star style={{ width: 18, height: 18, color: purple, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Build Story Characters with AI</p>
                <p style={{ fontSize: 11, color: muted }}>AI reads your story and builds the full cast — names, roles, voices, ready to use.</p>
              </div>
            </div>
            {castGenError && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: `${red}10`, border: `1px solid ${red}30`, marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: red }}>{castGenError}</p>
              </div>
            )}
            {generatedCast.length > 0 && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: `${green}08`, border: `1px solid ${green}25`, marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: green, fontWeight: 600 }}>{generatedCast.length} cast members generated and added below.</p>
              </div>
            )}
            {/* ── Portrait model selector ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 10, color: muted, alignSelf: "center", flexShrink: 0 }}>Portrait model:</span>
              {([
                { id: "fal_flux_schnell" as const, label: "Flux Schnell", desc: "Fast · $0.003" },
                { id: "segmind_pruna" as const, label: "Pruna", desc: "Cheap · $0.005" },
                { id: "fal_flux_dev" as const, label: "Flux Dev", desc: "Quality · $0.025" },
              ] as Array<{ id: "fal_flux_schnell" | "segmind_pruna" | "fal_flux_dev"; label: string; desc: string }>).map(m => (
                <button key={m.id} onClick={() => setCastPortraitModel(m.id)}
                  style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${castPortraitModel === m.id ? purple : border}`, background: castPortraitModel === m.id ? `${purple}20` : "transparent", color: castPortraitModel === m.id ? purple : muted, fontSize: 9, cursor: "pointer", fontWeight: castPortraitModel === m.id ? 700 : 400 }}>
                  {m.label} <span style={{ opacity: 0.6 }}>{m.desc}</span>
                </button>
              ))}
            </div>
            <button
              onClick={generateCastFromStory}
              disabled={castGenerating || (!expandedStory && !idea.trim())}
              title={(!expandedStory && !idea.trim()) ? "Write your story first" : ""}
              style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: castGenerating ? "#2a2040" : (!expandedStory && !idea.trim()) ? "#1a1a2a" : `linear-gradient(135deg, ${purple}, #7c3aed)`, color: (!expandedStory && !idea.trim()) ? muted : "#fff", fontSize: 13, fontWeight: 700, cursor: castGenerating || (!expandedStory && !idea.trim()) ? "not-allowed" : "pointer" }}>
              {castGenerating ? "Building characters from story..." : generatedCast.length > 0 ? "Rebuild Story Characters with AI" : "Build Story Characters with AI"}
            </button>
            {!expandedStory && !idea.trim() && (
              <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Write your story first in the Story tab, then come back here.</p>
            )}
          </div>

          {/* Inline CharacterPicker — secondary, hidden by default */}
          {showCharacterPicker && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Import from Character Library</p>
                <button onClick={() => setShowCharacterPicker(false)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                  Close
                </button>
              </div>
              <CharacterPicker
                onSelect={(char) => {
                  setSavedCharacters(prev => {
                    if (prev.some(c => c.id === char.id)) return prev;
                    return [...prev, { id: char.id, name: char.name, role: char.role || "supporting", description: char.visualDescription || "", imageUrl: char.imageUrl || "", characterId: char.characterId || "", voiceName: char.voiceName || "" }];
                  });
                  addToCast(char.id);
                  setLastAction(`Imported character "${char.name}"`);
                }}
                onCreateNew={() => { window.open(`/dashboard/character-voices?returnTo=movie-planner`, "_blank"); }}
                compact
              />
            </div>
          )}

          {loadingChars ? (
            <p style={{ color: muted, fontSize: 13 }}>Loading characters...</p>
          ) : savedCharacters.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No saved characters yet.</p>
              <a href="/dashboard/character-voices?returnTo=movie-planner" style={{ fontSize: 12, color: accent, textDecoration: "none" }}>Create characters first</a>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
              {savedCharacters.map(char => {
                const inCast = selectedCast.some(c => c.characterId === char.id);
                return (
                  <div key={char.id} style={{ ...cardStyle, padding: 0, overflow: "hidden", borderColor: inCast ? `${green}40` : border }}>
                    {/* Image */}
                    <div style={{ height: 80, background: s2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" }}
                      onClick={() => inCast ? removeCast(char.id) : addToCast(char.id)}>
                      {char.imageUrl ? (
                        <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Icon.User style={{ width: 32, height: 32, color: muted, opacity: 0.3 }} />
                      )}
                      {inCast && <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: green, display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}><Icon.Check style={{ width: 12, height: 12 }} /></div>}
                      {char.characterId && <span style={{ position: "absolute", bottom: 4, left: 6, fontSize: 8, fontFamily: "monospace", color: purple, background: "rgba(0,0,0,0.7)", padding: "1px 5px", borderRadius: 4 }}>{char.characterId}</span>}
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{char.name}</p>
                      <p style={{ fontSize: 10, color: muted }}>{char.role || "supporting"}{char.voiceName ? ` \u00B7 ${char.voiceName}` : ""}</p>
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <button onClick={() => inCast ? removeCast(char.id) : addToCast(char.id)}
                          style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${inCast ? red : green}30`, background: `${inCast ? red : green}06`, color: inCast ? red : green, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                          {inCast ? "Remove" : "Add to Cast"}
                        </button>
                        <button onClick={() => {
                          fetch("/api/generation/image", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: `Character portrait: ${char.name}. ${char.description || ""}. Professional character reference, front view.`, width: 768, height: 768, model: castPortraitModel }),
                          }).then(r => r.json()).then(d => {
                            if (d.imageUrl || d.imagePath) {
                              setSavedCharacters(prev => prev.map(c => c.id === char.id ? { ...c, imageUrl: d.imageUrl || d.imagePath } : c));
                              setLastAction(`Portrait generated for ${char.name}`);
                            }
                          }).catch((err) => { console.error("genCharImage:", err); setErrorMsg(`Failed to generate portrait for ${char.name}: ${err instanceof Error ? err.message : "Unknown error"}`); });
                        }}
                          style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${purple}30`, background: `${purple}06`, color: purple, fontSize: 9, cursor: "pointer" }}>
                          Generate Portrait
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Assigned roles */}
          {selectedCast.length > 0 && (
            <div style={cardStyle}>
              <label style={labelStyle}>Assign Roles</label>
              {selectedCast.map(c => {
                const char = savedCharacters.find(ch => ch.id === c.characterId);
                return (
                  <div key={c.characterId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", minWidth: 100 }}>{char?.name}</span>
                    <select value={c.role} onChange={e => setCastRole(c.characterId, e.target.value)} style={{ ...inputStyle, width: 160, padding: "8px 12px", fontSize: 12 }}>
                      {ROLES.map(r => <option key={r} value={r} style={{ background: surface }}>{r}</option>)}
                    </select>
                    <button onClick={() => removeCast(c.characterId)} style={{ fontSize: 11, color: red, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCENE BOARD TAB                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "scenes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Scene Board ({totalScenes} scenes)</h2>
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
                    Video Model: <span style={{ color: "#fff" }}>{selectedVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </button>
                  <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                    style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Image Model: <span style={{ color: "#fff" }}>{selectedImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
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
                          onClick={() => { try { localStorage.setItem("ghs_movie_planner_return", JSON.stringify({ projectId, activeTab, timestamp: Date.now() })); } catch {} }}>
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
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div>
                              <p style={{ ...labelStyle, fontSize: 9 }}>Visual Description</p>
                              <textarea value={scene.visualDescription} onChange={e => updateScene(scene.scene, { visualDescription: e.target.value })}
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
      {activeTab === "screenplay" && (
        <div>
          {/* Setup / Generate */}
          {!screenplay && !generatingScreenplay && (
            <div style={{ ...cardStyle, borderColor: `${purple}20`, marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Screenplay</p>
              <p style={{ fontSize: 11, color: muted, marginBottom: 16 }}>Generate a full formatted screenplay from your story, or paste your own script below and parse it into narrator/dialogue segments.</p>
              {!idea.trim() && !expandedStory ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Write your story idea first — go to Story & Draft tab.</p>
                  <button onClick={() => setActiveTab("story")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Story</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>Written by:</span>
                    <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Your name"
                      style={{ flex: 1, background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", maxWidth: 280 }} />
                  </div>
                  {screenplayError && <p style={{ fontSize: 11, color: red, marginBottom: 8 }}>{screenplayError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={generateScreenplay}
                      style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Generate Screenplay
                    </button>
                    <button onClick={() => setScreenplay("FADE IN:\n\nINT. SCENE ONE - DAY\n\nPaste your screenplay here...\n\nFADE OUT.\n\nTHE END")}
                      style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                      Paste My Own
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Loading */}
          {generatingScreenplay && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Icon.Wand style={{ width: 36, height: 36, color: muted, marginBottom: 12 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Writing your screenplay...</p>
              <p style={{ fontSize: 11, color: muted }}>15–30 seconds</p>
            </div>
          )}

          {/* Screenplay paper */}
          {screenplay && !generatingScreenplay && (
            <>
              {/* Toolbar */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
                  <span style={{ fontSize: 10, color: muted }}>Written by:</span>
                  <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Your name"
                    style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", width: 160 }} />
                </div>
                <button onClick={generateScreenplay}
                  style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${purple}40`, background: "transparent", color: purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Regenerate
                </button>
                <button onClick={() => { const blob = new Blob([screenplay], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${title || "screenplay"}.txt`; a.click(); }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Download .txt
                </button>
                <button onClick={parseScript} disabled={parsingScript}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : blue, color: "#000", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
                  {parsingScript ? "Parsing..." : "Parse Script"}
                </button>
                <button onClick={sendScreenplayToScenes} disabled={sendingToScenes || !moviePlan}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${gold}60` : gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes || !moviePlan ? "default" : "pointer", opacity: !moviePlan ? 0.4 : 1 }}>
                  {sendingToScenes ? "Sending..." : "Send to Scenes →"}
                </button>
              </div>

              {/* Send result */}
              {sendToScenesResult && (
                <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${accent}10`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon.Check style={{ width: 14, height: 14, color: accent, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: accent, flex: 1 }}>{sendToScenesResult}</p>
                  <button onClick={() => setActiveTab("audio")} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Go to Audio</button>
                </div>
              )}

              {/* Parsed segments preview */}
              {showScriptReview && scriptSegments.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Parsed Script — {scriptSegments.length} segments</p>
                    <button onClick={() => setShowScriptReview(false)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Hide</button>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {scriptSegments.map((seg, i) => (
                      <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: seg.type === "dialogue" ? `${blue}10` : `${purple}10`, borderLeft: `3px solid ${seg.type === "dialogue" ? blue : purple}` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: seg.type === "dialogue" ? blue : purple, textTransform: "uppercase", marginRight: 8 }}>
                          {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "NARR"}
                        </span>
                        <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Screenplay editor */}
              <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
                style={{ ...inputStyle, minHeight: 400, fontFamily: "'Courier New', Courier, monospace", fontSize: 12, lineHeight: 1.8, resize: "vertical", whiteSpace: "pre-wrap" }} />

              {/* White paper preview */}
              <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
                <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
                  <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>GIO HOME AI STUDIO</p>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(title || "UNTITLED").toUpperCase()}</h1>
                  {(genre || tone) && <p style={{ fontSize: 11, color: "#777", marginBottom: 24, fontStyle: "italic" }}>{[genre, tone].filter(Boolean).join(" · ")}</p>}
                  <p style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Written by</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 20 }}>{screenplayAuthor || "—"}</p>
                  <p style={{ fontSize: 8, color: "#aaa", letterSpacing: 1 }}>AI Assets by GIO HOME AI STUDIO · © {new Date().getFullYear()}</p>
                </div>
                <div style={{ color: "#111", fontSize: 12, lineHeight: 2 }}>
                  {screenplay.split("\n").map((line, i) => {
                    const t = line.trim();
                    if (!t) return <div key={i} style={{ height: 6 }} />;
                    if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(t)) return <p key={i} style={{ fontWeight: 700, color: "#000", marginTop: 24, marginBottom: 2 }}>{t}</p>;
                    if (/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:)/.test(t)) return <p key={i} style={{ fontStyle: "italic", color: "#555", marginTop: 12 }}>{t}</p>;
                    if (t === "THE END") return <p key={i} style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginTop: 40, letterSpacing: 4 }}>THE END</p>;
                    if (/^[A-Z][A-Z\s\-'().]+$/.test(t) && t.length < 40 && !t.startsWith("INT") && !t.startsWith("EXT") && !t.startsWith("FADE") && !t.startsWith("CUT")) return <p key={i} style={{ fontWeight: 700, marginTop: 16, paddingLeft: "38%" }}>{t}</p>;
                    if (t.startsWith("(") && t.endsWith(")")) return <p key={i} style={{ fontStyle: "italic", color: "#555", paddingLeft: "30%" }}>{t}</p>;
                    const prev = screenplay.split("\n").slice(0, i).reverse().find(l => l.trim());
                    const isDlg = prev && (/^[A-Z][A-Z\s\-'().]+$/.test(prev.trim()) || (prev.trim().startsWith("(") && prev.trim().endsWith(")")));
                    if (isDlg) return <p key={i} style={{ color: "#222", paddingLeft: "20%", paddingRight: "20%" }}>{line}</p>;
                    return <p key={i} style={{ color: "#333", marginBottom: 2 }}>{line}</p>;
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* AUDIO & SHOTS TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "audio" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Audio & Shots</h2>
            <div style={{ display: "flex", gap: 8 }}>
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

          {/* ── Narration Provider Selector ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Narration Provider</p>
            <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Select the TTS engine for all scene narrations in this project.</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {([
                { id: "piper",       label: "Piper (free)",   color: accent },
                { id: "fal-narrator", label: "FAL Narrator",  color: blue },
                { id: "elevenlabs",  label: "ElevenLabs",     color: purple },
                { id: "karaoke",     label: "Karaoke",        color: gold },
              ] as const).map(p => (
                <button key={p.id} onClick={() => setNarrationProvider(p.id)}
                  style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${narrationProvider === p.id ? p.color : border}`,
                    background: narrationProvider === p.id ? `${p.color}12` : "transparent",
                    color: narrationProvider === p.id ? p.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
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
              {(["freesound", "elevenlabs"] as const).map(t => (
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
                          <p style={{ fontSize: 9, color: muted }}>{Math.round(sound.duration)}s · {sound.license.split("/").pop()}</p>
                        </div>
                        <button onClick={() => setSfxPreviewId(sfxPreviewId === sound.id ? null : sound.id)}
                          style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
                          {sfxPreviewId === sound.id ? "▐▐" : "▶"}
                        </button>
                        {sfxPreviewId === sound.id && <audio src={sound.previewUrl} autoPlay onEnded={() => setSfxPreviewId(null)} style={{ display: "none" }} />}
                        <button onClick={() => saveFreesound(sound)} disabled={fsSaving === sound.id || fsSaved.has(sound.id)}
                          style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${green}30`, background: fsSaved.has(sound.id) ? `${green}15` : "transparent", color: fsSaved.has(sound.id) ? green : muted, cursor: "pointer", fontWeight: 600 }}>
                          {fsSaved.has(sound.id) ? "Saved" : fsSaving === sound.id ? "..." : "Save"}
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

            {soundTab === "elevenlabs" && (
              <div>
                <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Describe a sound effect and ElevenLabs AI will generate it.</p>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
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
                    {polishingScene === sceneId ? "Polishing..." : "Polish"}
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
                        <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => { const next = prev.filter((_, i) => i !== ci); try { localStorage.setItem("ghs_movie_cuts", JSON.stringify(next)); } catch {} return next; }); }}
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
                    try { localStorage.setItem("ghs_movie_cuts", JSON.stringify(next)); } catch {}
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
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Pre-Assembly Review</p>
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
              {preflightRunning ? "Running pre-flight review..." : "Run Pre-flight Review"}
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
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {hasVid && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: `${accent}15`, color: accent }}>video</span>}
                      {hasImg && !hasVid && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: `${blue}15`, color: blue }}>image</span>}
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
                onClick={() => { try { localStorage.setItem("ghs_movie_planner_return", JSON.stringify({ projectId, activeTab, timestamp: Date.now() })); } catch {} }}>
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
    </div>
  );
}
