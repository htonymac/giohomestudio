"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NarrationControls from "../../components/NarrationControls";
import type { NarrationSettings } from "../../components/NarrationControls";
import CharacterPicker from "../../components/CharacterPicker";
import type { SceneIntelligenceData } from "../../api/hybrid/scene-intelligence/route";
import { ds } from "../../../lib/designSystem";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { HeroTitle } from "../../components/hero/HeroTitle";
import * as Icon from "../../components/icons";
import { safeJson } from "../../../lib/api-utils";
import SupervisorStatusBar from "../../components/SupervisorStatusBar";

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

// ═══════════════════════════════════════════════════════════════════════════
// GHS Child Video Planner — PRODUCTION WORKSHOP
//
// This is NOT a wizard. This is a freely-switchable tab workshop matching
// the Hybrid Planner pattern.
//
// Tabs: Overview | Content Input | Style & Voice | Review 1 | Preview | Review 2
//
// 8 engines: Child-Safe Planner, Text Understanding, Narration Timing,
//   Highlight Sync, Children Music, Visual Planning, Review Engine (2-stage),
//   Export Identity
//
// Non-negotiable: text must rhythm with narration, 2 review checkpoints
// ═══════════════════════════════════════════════════════════════════════════

// SCENE_ENV_ICON removed — env type shown as text label (v14: no emoji)

const SCENE_ENERGY_COLOR: Record<string, string> = {
  chaotic: "#ef4444", tense: "#eab308", dramatic: "#a855f7",
  mysterious: "#6366f1", peaceful: "#22d3ee", calm: "#22d3ee",
};

// ── v14 style helpers (mapped to ds tokens) ──
const surface = ds.color.card;
const s2 = ds.color.paper;
const border = ds.color.line;
const muted = ds.color.mute;
const childAccent = ds.color.gold;    // gold accent
const childSafe = ds.color.mint;      // mint (safety indicator)
const C2 = ds.color.pink;             // pink
const C3 = ds.color.btnC;             // orange
const C4 = ds.color.sky;              // sky blue
const bgGrad = ds.color.paper;        // v14 paper bg (no gradient)

// ── Shared styles ──
const cardStyle: React.CSSProperties = {
  background: ds.color.card,
  border: `1px solid ${ds.color.line}`,
  borderRadius: 18,
  padding: 20,
  marginBottom: 12,
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
  textTransform: "uppercase" as const, color: ds.color.mute, marginBottom: 8, display: "block",
  fontFamily: ds.font.mono,
};

// ── Constants ──
const NARRATION_STYLES = [
  { id: "gentle", label: "Gentle Story Reader", desc: "Warm, soft, bedtime-friendly" },
  { id: "teacher", label: "Early Learning Teacher", desc: "Clear, educational, classroom-like" },
  { id: "fun", label: "Fun Kids Narrator", desc: "Playful, energetic, engaging" },
  { id: "calm", label: "Calm Bedtime Narrator", desc: "Very soft, soothing, sleepy" },
  { id: "classroom", label: "Classroom Guide", desc: "Structured, patient, step-by-step" },
];

const MUSIC_CHOICES = [
  { id: "none", label: "No Music" },
  { id: "soft_story", label: "Soft Storybook" },
  { id: "abc_learning", label: "ABC Learning" },
  { id: "counting", label: "Counting Rhythm" },
  { id: "nursery", label: "Nursery Rhyme" },
  { id: "playful", label: "Playful Learning" },
  { id: "bedtime", label: "Calm Bedtime" },
  { id: "classroom", label: "Bright Classroom" },
];

const VISUAL_STYLES = [
  { id: "storybook",  label: "Storybook",      colors: "#FFF8E1, #FF8A65", desc: "Warm illustrated book style" },
  { id: "cartoon",   label: "Bright Cartoon",  colors: "#E3F2FD, #FF5722", desc: "Bold colorful animation" },
  { id: "classroom", label: "Classroom",        colors: "#E8F5E9, #2196F3", desc: "Clean educational layout" },
  { id: "nursery",   label: "Nursery Soft",    colors: "#FCE4EC, #CE93D8", desc: "Pastel gentle nursery" },
  { id: "fantasy",   label: "Fantasy Land",    colors: "#E8EAF6, #7C4DFF", desc: "Magical fantasy world" },
  { id: "animals",   label: "Animal World",    colors: "#FFF3E0, #FF9800", desc: "Jungle animal adventure" },
  { id: "space",     label: "Outer Space",     colors: "#E1F5FE, #0288D1", desc: "Space exploration" },
  { id: "ocean",     label: "Ocean World",     colors: "#E0F7FA, #00BCD4", desc: "Underwater adventure" },
];

const AGE_GROUPS = [
  { id: "toddler",   label: "Toddlers",      age: "2-3 years", desc: "Letters, colours, sounds, simple words" },
  { id: "preschool", label: "Pre-school",    age: "3-5 years", desc: "Phonics, counting, short stories, shapes" },
  { id: "early",     label: "Early School",  age: "5-8 years", desc: "Reading, sentences, science, numbers" },
  { id: "older",     label: "Older Kids",    age: "8-12 years", desc: "Full stories, projects, advanced topics" },
];

const AGE_AUDIENCE: Record<string, string> = {
  toddler: "2-3 year olds",
  preschool: "3-5 year olds",
  early: "5-8 year olds",
  older: "8-12 year olds",
};

const LEARNING_MODES = [
  { id: "storybook",    label: "Storybook",      desc: "Full illustrated story with narration" },
  { id: "read_along",   label: "Read-Along",     desc: "Text synced with highlighted narration" },
  { id: "word",         label: "Word Learning",  desc: "Single word focus with pronunciation" },
  { id: "sentence",     label: "Sentences",      desc: "Sentence-by-sentence reading" },
  { id: "poem",         label: "Poem / Rhyme",   desc: "Rhythmic poem with beat-sync" },
  { id: "phonics",      label: "Phonics",         desc: "Letter sounds and phonics drill" },
  { id: "video_lesson", label: "Video Lesson",   desc: "Educational structured lesson" },
];

const MOVIE_GENRES = ["Adventure", "Fantasy", "Animals", "Space", "Ocean", "Jungle", "Fairytale"];
const MOVIE_SCENE_COUNTS = [3, 5, 7, 10];
const MOVIE_SCENE_DURATIONS = ["3s", "5s", "8s", "10s"];

// ── 5-Tier Sound Model Selector (binding) ──
const SOUND_TIERS = [
  { id: "piper_free",      label: "Standard (built-in GHS)", cost: "Free" },
  { id: "piper_extended",  label: "Start Plus",              cost: "Low cost" },
  { id: "ghs_karaoke",     label: "Sound Pro (GHS Karaoke)", cost: "Mid" },
  { id: "elevenlabs",      label: "Classic",                 cost: "Premium" },
  { id: "gemini",          label: "Premium",                 cost: "Highest" },
] as const;
type SoundTierId = typeof SOUND_TIERS[number]["id"];

// ── Tab type ──
type WorkshopTab = "overview" | "design" | "content" | "script" | "sound" | "style" | "characters" | "sceneBoard" | "screenplay" | "assembly" | "review1" | "preview" | "review2";

// Design → Content(Story) → Script(Story Plan) → Sound(Voices & Sounds) → Characters(Character Friends) → Scene Board → Review → Overview
const WORKSHOP_TABS: { id: WorkshopTab; label: string }[] = [
  { id: "design",      label: "Design" },
  { id: "content",     label: "Story" },
  { id: "script",      label: "Script & Story Plan" },
  { id: "sound",       label: "Voices & Sounds" },
  { id: "characters",  label: "Character Friends" },
  { id: "sceneBoard",  label: "Scene Board" },
  { id: "screenplay",  label: "Screenplay" },
  { id: "assembly",    label: "Assembly" },
  { id: "overview",    label: "Overview" },
];

// ── Character type ──
interface ChildCharacter {
  id: string;
  name: string;
  role?: string;
  imageUrl?: string;
  characterId?: string;
  voiceName?: string;
  visualDescription?: string;
}

export default function ChildrenPlannerPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: muted }}>Loading Child Video Planner...</div>}><ChildrenPlannerInner /></Suspense>;
}

function ChildrenPlannerInner() {
  const searchParams = useSearchParams();
  const branch = searchParams.get("branch") ?? "hybrid";
  const contentParam = searchParams.get("content") ?? "";
  const ageParam = searchParams.get("age") ?? "";
  const langParam = searchParams.get("lang") ?? "en";
  const lang2Param = searchParams.get("lang2") ?? "";
  const topicParam = searchParams.get("topic") ?? "";
  const topicPromptParam = searchParams.get("topicPrompt") ?? "";
  const charactersParam = searchParams.get("characters") ?? "";
  const characterIdParam = searchParams.get("characterId") ?? "";

  // ── State ──
  const [activeTab, setActiveTab] = useState<WorkshopTab>("design");
  const [lastAction, setLastAction] = useState("Workshop opened");
  const [textContent, setTextContent] = useState(topicPromptParam || "");
  const [narrationStyle, setNarrationStyle] = useState("gentle");
  const [narrationProvider, setNarrationProvider] = useState<"piper" | "fal-narrator" | "elevenlabs" | "karaoke">("piper");
  const [autoSfx, setAutoSfx] = useState(true);
  const [musicChoice, setMusicChoice] = useState("soft_story");
  const [visualStyle, setVisualStyle] = useState("storybook");
  const [tone, setTone] = useState<"soft" | "active">("soft");
  const [review1Done, setReview1Done] = useState(false);
  const [review2Done, setReview2Done] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [narrationText, setNarrationText] = useState("");
  const [narrationSettings, setNarrationSettings] = useState<Partial<NarrationSettings>>({ mode: "children" });

  // ── Story AI provider ──
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-haiku-4-5-20251001");

  // ── AID model picker ──
  const [selectedVideoModelId, setSelectedVideoModelId] = useState("segmind_pruna_video");
  const [selectedImageModelId, setSelectedImageModelId] = useState("fal_flux_schnell");
  const [genSeed, setGenSeed] = useState<number | null>(null);
  const [showAidPicker, setShowAidPicker] = useState(false);
  const [aidMode, setAidMode] = useState<"video"|"image">("video");
  const [aidStyle, setAidStyle] = useState<"all"|"2d"|"3d"|"cartoon"|"realistic">("all");
  const [aidSort, setAidSort] = useState<"cheapest"|"quality"|"expensive">("cheapest");

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

  // ── Assembly Named Cuts (Final tab) ──
  const [assemblyName, setAssemblyName] = useState("Main Story");
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; sceneIds: string[]; videoUrl?: string; savedAt: string }>>([]);
  const [showCutsPanel, setShowCutsPanel] = useState(false);

  // ── Design tab state ──
  const [ageGroup, setAgeGroup] = useState<"toddler" | "preschool" | "early" | "older">("preschool");
  const [safetyLevel, setSafetyLevel] = useState<"maximum" | "high" | "standard">("high");
  const [designComplete, setDesignComplete] = useState(false);
  const [expandingContent, setExpandingContent] = useState(false);
  const [expandedContent, setExpandedContent] = useState("");
  const [extractingChars, setExtractingChars] = useState<"idle" | "extracting" | "building">("idle");

  // ── Feature state: expandStory ──
  const [expanding, setExpanding] = useState(false);

  // ── Scene Intelligence ──
  const [sceneIntelligence, setSceneIntelligence] = useState<Record<string, SceneIntelligenceData>>({});
  const [runningIntelligence, setRunningIntelligence] = useState(false);

  // ── Feature state: makeSceneVideo ──
  interface ChildScene { scene: number; title: string; visualDescription: string; cameraDirection?: string; imageUrl?: string; characters?: string[]; variantUrls?: string[] }
  const [childScenes, setChildScenes] = useState<ChildScene[]>([]);
  const [sceneVideos, setSceneVideos] = useState<Record<string, string>>({});
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [generatingSceneVideos, setGeneratingSceneVideos] = useState<Set<string>>(new Set());
  const [sceneGenProgress, setSceneGenProgress] = useState<Record<string, { percent: number; message: string }>>({});

  // ── Scene Board state ──
  const [generatingScenesFromStory, setGeneratingScenesFromStory] = useState(false);
  const [generatingSceneImage, setGeneratingSceneImage] = useState<string | null>(null);
  const [generatingVariations, setGeneratingVariations] = useState<Set<string>>(new Set());
  const [polishingScene, setPolishingScene] = useState<string | null>(null);
  const [sceneCharAssignments, setSceneCharAssignments] = useState<Record<string, string[]>>({});

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

  // ── Pre-flight check ──
  interface PreflightCheck { id: string; label: string; status: "ok" | "warn" | "error"; detail?: string; autoFixAvailable: boolean; autoFixAction?: string; }
  const [preflightResult, setPreflightResult] = useState<{ checks: PreflightCheck[]; canAssemble: boolean; blockingErrors: number; warnings: number } | null>(null);
  const [preflightRunning, setPreflightRunning] = useState(false);

  // ── Feature state: assembleMovie ──
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  const [assemblySelectedIds, setAssemblySelectedIds] = useState<string[]>([]);

  // ── Sound tier & model settings ──
  const [soundTier, setSoundTier] = useState<SoundTierId>("piper_free");
  const [modelSettings, setModelSettings] = useState({
    storyLLM: "claude-haiku-4-5",
    charImageModel: "fal_flux_schnell",
    sceneVideoModel: "fal_wan_lite",
    soundModel: "piper_free" as SoundTierId,
  });
  const [showModelSettings, setShowModelSettings] = useState(false);

  // ── Feature state: FreeSound + AI SFX ──
  const [soundTab, setSoundTab] = useState<"freesound" | "ai-sfx">("freesound");
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

  // ── Feature state: Music Library ──
  interface MusicAsset { id: string; name: string; filePath: string; source: string; tags: string[] }
  const [musicLibrary, setMusicLibrary] = useState<MusicAsset[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusicUrl, setSelectedMusicUrl] = useState<string | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState("");
  const [aiPickingMusic, setAiPickingMusic] = useState(false);
  const [aiMusicPickLog, setAiMusicPickLog] = useState("");

  // Learning mode + production system
  const [learningMode, setLearningMode] = useState<"storybook" | "word" | "sentence" | "poem" | "phonics" | "video_lesson" | "read_along">("storybook");
  const [productionSystem, setProductionSystem] = useState<"hybrid" | "movie">("hybrid");

  // Movie mode options
  const [movieGenre, setMovieGenre] = useState("Adventure");
  const [movieSceneCount, setMovieSceneCount] = useState(5);
  const [movieSceneDuration, setMovieSceneDuration] = useState("5s");

  // Read-Along settings
  const [readAlongText, setReadAlongText] = useState("");
  const [highlightMode, setHighlightMode] = useState<"word" | "sentence" | "line" | "karaoke">("word");
  const [readSpeed, setReadSpeed] = useState<"slow" | "normal" | "fast">("slow");
  const [highlightColor, setHighlightColor] = useState("#FFD700");
  const [fontSize, setFontSize] = useState(32);

  // Generated content
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState("");
  const [generatedMusicUrl, setGeneratedMusicUrl] = useState("");
  const [musicFallbackReason, setMusicFallbackReason] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [contentImage, setContentImage] = useState<string | null>(null);

  // Characters
  const [savedChars, setSavedChars] = useState<ChildCharacter[]>([]);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [loadingChars, setLoadingChars] = useState(false);

  // Final export
  const [finalVideoUrl, setFinalVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isBilingual = !!lang2Param;

  // ── Progress calculations ──
  const contentProgress = textContent ? 100 : 0;
  const styleProgress = narrationStyle && visualStyle && musicChoice ? 100 : 0;
  const previewProgress = generatedVideoUrl ? 100 : 0;
  const reviewProgress = (review1Done ? 50 : 0) + (review2Done ? 50 : 0);

  // ── Expand content with AI ──
  async function expandContent() {
    const rawText = readAlongText || textContent || "";
    if (!rawText.trim()) return;
    setExpandingContent(true);
    try {
      const res = await fetch("/api/hybrid/story-expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: rawText,
          genre: "children",
          tone: "warm, educational, age-appropriate",
          audience: AGE_AUDIENCE[ageGroup] || "children",
          language: "English",
          childContext: {
            ageGroup,
            learningMode,
            safetyLevel,
            productionSystem,
            visualStyle,
          },
        }),
      });
      const data = await res.json();
      if (data.expandedStory?.summary || data.summary) {
        const expanded = data.expandedStory?.summary || data.summary || "";
        setExpandedContent(expanded);
        setReadAlongText(prev => prev || expanded);
      }
    } catch { /* ignore */ }
    setExpandingContent(false);
  }

  // ── Extract and build child characters from story ──
  async function extractChildCharacters() {
    const text = expandedContent || readAlongText || textContent || "";
    if (!text.trim()) return;
    setExtractingChars("extracting");
    try {
      const res = await fetch("/api/hybrid/character-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: text, characterList: [] },
          language: "English",
        }),
      });
      const data = await res.json();
      const detected = (data.characters || []) as Array<{ name: string; description?: string }>;
      if (detected.length > 0) {
        setExtractingChars("building");
        const base = Date.now();
        const newChars: ChildCharacter[] = [];
        for (let i = 0; i < detected.length; i++) {
          const name = detected[i].name;
          if (!name) continue;
          try {
            const buildRes = await fetch("/api/hybrid/character-build", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                characterName: name,
                storyText: text,
                artStyle: visualStyle || "storybook",
                language: "English",
                childSafe: true,
                ageGroup,
              }),
            });
            const buildData = await buildRes.json();
            if (buildData.ok && buildData.character) {
              const c = buildData.character;
              newChars.push({
                id: `CC${base}${i}`,
                name: c.displayName || name,
                role: c.roleType || "main",
                characterId: c.characterId,
                imageUrl: undefined,
                voiceName: undefined,
                visualDescription: c.colorDescription || "",
              });
            }
          } catch { /* skip this character */ }
        }
        if (newChars.length > 0) {
          setSavedChars(prev => {
            const combined = [...prev];
            for (const nc of newChars) {
              if (!combined.some(c => c.name?.toLowerCase() === nc.name.toLowerCase())) {
                combined.push(nc);
              }
            }
            return combined;
          });
          // Persist each new character to DB
          for (const nc of newChars) {
            try {
              const postRes = await fetch("/api/character-voices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: nc.name,
                  characterId: nc.characterId || undefined,
                  role: nc.role || "character",
                  visualDescription: nc.visualDescription || undefined,
                  isNarrator: false,
                }),
              });
              if (!postRes.ok && postRes.status !== 409) {
                console.error("children-planner: DB save failed for", nc.name, await postRes.text());
                setLastAction(`Character saved locally — DB save failed for ${nc.name}`);
              }
            } catch (dbErr) {
              console.error("children-planner: DB POST error", dbErr);
              setLastAction(`Character saved locally — DB save failed for ${nc.name}`);
            }
          }
        }
      }
    } catch { /* ignore */ }
    setExtractingChars("idle");
  }

  // ── expandStory: 3-step AI pipeline ──
  async function expandStory() {
    const storyInput = textContent || readAlongText || "";
    if (!storyInput.trim()) { setLastAction("Enter content first"); return; }
    setExpanding(true);
    setLastAction("AI is building your children story...");
    try {
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput,
          genre: "children",
          tone: tone === "soft" ? "warm, gentle, bedtime-friendly" : "fun, playful, energetic",
          audience: AGE_AUDIENCE[ageGroup] || "children",
          language: "English",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          childContext: { ageGroup, learningMode, safetyLevel, visualStyle },
        }),
      });
      const expandData = await safeJson<{ expandedStory?: { summary?: string }; summary?: string }>(expandRes, "story-expand");
      const summary = expandData.expandedStory?.summary || expandData.summary || "";
      if (summary) {
        setExpandedContent(summary);
        setNarrationText(summary);
        setLastAction("Story expanded");
      }

      const charRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: summary || storyInput, characterList: [] },
          language: "English",
        }),
      });
      const charData = await safeJson<{ characters?: Array<{ name: string; description?: string }> }>(charRes, "character-extract");
      const detectedChars = (charData.characters || []) as Array<{ name: string; description?: string }>;
      if (detectedChars.length > 0) {
        const base = Date.now();
        const newChars: ChildCharacter[] = detectedChars.map((c, i) => ({
          id: `CC${base}${i}`,
          name: c.name,
          role: "character",
          visualDescription: c.description || "",
        }));
        setSavedChars(prev => {
          const combined = [...prev];
          for (const nc of newChars) {
            if (!combined.some(c => c.name?.toLowerCase() === nc.name.toLowerCase())) combined.push(nc);
          }
          return combined;
        });
        // Persist each new character to DB
        for (const nc of newChars) {
          try {
            const postRes = await fetch("/api/character-voices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: nc.name,
                role: nc.role || "character",
                visualDescription: nc.visualDescription || undefined,
                isNarrator: false,
              }),
            });
            if (!postRes.ok && postRes.status !== 409) {
              console.error("children-planner expandStory: DB save failed for", nc.name, await postRes.text());
              setLastAction(`Character saved locally — DB save failed for ${nc.name}`);
            }
          } catch (dbErr) {
            console.error("children-planner expandStory: DB POST error", dbErr);
            setLastAction(`Character saved locally — DB save failed for ${nc.name}`);
          }
        }
      }

      const styleLabel = VISUAL_STYLES.find(v => v.id === visualStyle)?.label || visualStyle;
      const storyWithStyle = `${summary || storyInput}\n\nVisual style: ${styleLabel}`;
      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storyWithStyle,
          characters: savedChars.map(c => ({
            characterId: c.id,
            displayName: c.name,
            role: c.role || "character",
          })),
          costPreference: "budget",
          targetDuration: movieSceneDuration,
          projectId: `children_${Date.now()}`,
          styleHint: styleLabel,
        }),
      });
      const sceneData = await safeJson<{ scenes?: Array<{ scene?: number; title?: string; visualDescription?: string; cameraDirection?: string }> }>(sceneRes, "scene-plan");
      const planned = (sceneData.scenes || []) as Array<{ scene?: number; title?: string; visualDescription?: string; cameraDirection?: string }>;
      if (planned.length > 0) {
        setChildScenes(planned.map((s, i) => ({
          scene: s.scene ?? i + 1,
          title: s.title || `Scene ${i + 1}`,
          visualDescription: s.visualDescription || "",
          cameraDirection: s.cameraDirection || "",
        })));
        setLastAction(`Story built — ${planned.length} scenes planned`);
        setAssemblySelectedIds(planned.map((_, i) => `child_sc${(i + 1).toString().padStart(2, "0")}`));
        // auto-run scene intelligence after planning
        setTimeout(() => runSceneIntelligence(), 500);
      }
    } catch { setLastAction("AI build failed — try again"); }
    setExpanding(false);
  }

  async function runSceneIntelligence() {
    if (childScenes.length === 0) return;
    setRunningIntelligence(true);
    try {
      const res = await fetch("/api/hybrid/scene-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: childScenes.map(s => ({
            sceneId: `child_sc${String(s.scene).padStart(2, "0")}`,
            title: s.title,
            description: s.visualDescription,
            location: "",
            timeOfDay: "",
            mood: "",
          })),
          storyContext: textContent || readAlongText || "",
        }),
      });
      const data = await safeJson<{ ok?: boolean; intelligence?: SceneIntelligenceData[] }>(res, "scene-intelligence");
      if (data.ok && Array.isArray(data.intelligence)) {
        const map: Record<string, SceneIntelligenceData> = {};
        for (const item of data.intelligence) map[item.sceneId] = item;
        setSceneIntelligence(map);
      }
    } catch (err) {
      console.warn("Scene intelligence failed:", err);
    }
    setRunningIntelligence(false);
  }

  // ── makeSceneVideo: SSE streaming ──
  async function makeSceneVideo(scene: ChildScene) {
    const sceneId = `child_sc${String(scene.scene).padStart(2, "0")}`;
    const existingImage = sceneImages[sceneId] || scene.imageUrl;
    if (!existingImage) {
      setLastAction(`Scene ${scene.scene} needs an image first.`);
      return;
    }
    setGeneratingSceneVideos(prev => new Set(prev).add(sceneId));
    setSceneGenProgress(prev => ({ ...prev, [sceneId]: { percent: 2, message: "Connecting..." } }));
    setLastAction(`Generating video for Scene ${scene.scene}...`);
    try {
      const projectId = `children_${Date.now()}`;
      const response = await fetch("/api/hybrid/scene-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId, projectId,
          sceneText: `${scene.title}. ${scene.visualDescription}`,
          imageUrl: existingImage,
          duration: 5,
          motionDescription: scene.cameraDirection || "",
          seed: genSeed !== null ? genSeed : undefined,
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
              setSceneVideos(prev => ({ ...prev, [sceneId]: videoUrl }));
              setLastAction(`Scene ${scene.scene} video ready`);
            } else if (evt.type === "error") {
              setSceneGenProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
              setLastAction(`Video failed: ${evt.message as string}`);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch {
      setSceneGenProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
      setLastAction(`Video generation failed for Scene ${scene.scene}.`);
    }
    setGeneratingSceneVideos(prev => { const s = new Set(prev); s.delete(sceneId); return s; });
  }

  // ── Continuous Motion ─────────────────────────────────────────────────────
  async function startContinuousMotion() {
    const prompt = expandedContent || textContent || readAlongText || "";
    if (!prompt.trim()) { setCmError("Add story content first — Continuous Motion needs a prompt."); return; }
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
          projectId: `children_${contentParam || "story"}_${topicParam || "default"}`,
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

  // ── Generate Scenes from Story (Scene Board primary action) ──
  async function generateScenesFromStory() {
    const storyInput = textContent || readAlongText || "";
    if (!storyInput.trim()) { setLastAction("Enter your story content first"); return; }
    setGeneratingScenesFromStory(true);
    setLastAction("AI is planning scenes from your story...");
    try {
      const storyText = `[Children Story — ${ageGroup} — ${visualStyle} style]\n${storyInput}\n${selectedCharIds.length > 0 ? `Characters: ${savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => c.name).join(", ")}` : ""}`;
      const res = await fetch("/api/hybrid/scene-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyText, characters: savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => ({ characterId: c.characterId || c.id, name: c.name })), costPreference: "balanced", targetDuration: "2-5", projectId: `children_${Date.now()}`, styleHint: `${visualStyle}, children's book illustration, age-appropriate, friendly, colorful` }),
      });
      const data = await safeJson<{ scenes?: Array<{ scene?: number; title?: string; visualDescription?: string; cameraDirection?: string }> }>(res, "scene-board-plan");
      const planned = (data.scenes || []).map((s, i) => ({
        scene: s.scene ?? i + 1,
        title: s.title || `Scene ${i + 1}`,
        visualDescription: s.visualDescription || "",
        cameraDirection: s.cameraDirection || "",
        characters: sceneCharAssignments[`child_sc${String(i + 1).padStart(2, "0")}`] || [],
      }));
      if (planned.length > 0) {
        setChildScenes(planned);
        setAssemblySelectedIds(planned.map((_, i) => `child_sc${String(i + 1).padStart(2, "0")}`));
        setLastAction(`Scene Board ready — ${planned.length} scenes planned`);
      } else {
        setLastAction("No scenes returned — try expanding your story first");
      }
    } catch (err) {
      setLastAction(`Scene planning failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingScenesFromStory(false);
  }

  // ── Generate image for a single scene (Scene Board) ──
  async function generateSceneBoardImage(scene: ChildScene) {
    const sceneId = `child_sc${String(scene.scene).padStart(2, "0")}`;
    setGeneratingSceneImage(sceneId);
    try {
      const assignedChars = sceneCharAssignments[sceneId] || scene.characters || [];
      const childStylePrefix = "children's book illustration, age-appropriate, friendly, colorful, ";
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          sceneText: `${childStylePrefix}${scene.title}. ${scene.visualDescription}`,
          characterIds: assignedChars,
          projectStyle: visualStyle === "storybook" ? "storybook" : visualStyle === "2d-cartoon" ? "2d-cartoon" : "storybook",
          mood: "friendly, warm, safe",
          modelId: selectedImageModelId,
        }),
      });
      const data = await safeJson<{ imageUrl?: string; imagePath?: string; error?: string }>(res, "scene-board-image");
      if (data.error) {
        setLastAction(`Image failed: ${data.error}`);
        return;
      }
      const url = data.imageUrl || data.imagePath || "";
      if (url) {
        setSceneImages(prev => ({ ...prev, [sceneId]: url }));
        setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, imageUrl: url } : s));
        setLastAction(`Scene ${scene.scene} image generated`);
      }
    } catch (err) {
      setLastAction(`Image generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingSceneImage(null);
  }

  // ── Generate 3 image variations for a scene (Scene Board) ──
  async function generateSceneBoardImageVariations(scene: ChildScene) {
    const sceneId = `child_sc${String(scene.scene).padStart(2, "0")}`;
    if (generatingVariations.has(sceneId)) return;
    setGeneratingVariations(prev => new Set(prev).add(sceneId));
    try {
      const assignedChars = sceneCharAssignments[sceneId] || scene.characters || [];
      const childStylePrefix = "children's book illustration, age-appropriate, friendly, colorful, ";
      const seeds = [
        Math.floor(Math.random() * 9000000) + 1000000,
        Math.floor(Math.random() * 9000000) + 1000000,
        Math.floor(Math.random() * 9000000) + 1000000,
      ];
      const results: string[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetch("/api/hybrid/scene-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneId,
              sceneText: `${childStylePrefix}${scene.title}. ${scene.visualDescription}`,
              characterIds: assignedChars,
              projectStyle: visualStyle === "storybook" ? "storybook" : visualStyle === "2d-cartoon" ? "2d-cartoon" : "storybook",
              mood: "friendly, warm, safe",
              modelId: selectedImageModelId,
              seed: seeds[i],
            }),
          });
          const data = await safeJson<{ imageUrl?: string; imagePath?: string; error?: string }>(res, `scene-variation-${i}`);
          const url = data.imageUrl || data.imagePath || "";
          if (url) results.push(url);
        } catch {
          // continue — collect as many as possible
        }
      }
      if (results.length > 0) {
        // First result becomes active; remaining go to implicit history via childScenes imageUrl history
        const [first, ...rest] = results;
        setSceneImages(prev => ({ ...prev, [sceneId]: first }));
        setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, imageUrl: first } : s));
        // Store extra variation URLs on the scene as variantUrls for thumbnail picker
        setChildScenes(prev => prev.map(s =>
          s.scene === scene.scene
            ? { ...s, variantUrls: [first, ...rest] }
            : s
        ));
        setLastAction(`Scene ${scene.scene}: ${results.length} variation${results.length > 1 ? "s" : ""} generated`);
      } else {
        setLastAction(`Variations failed for scene ${scene.scene}`);
      }
    } catch (err) {
      setLastAction(`Variations failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingVariations(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
  }

  // ── Scene Polish — improve scene visual description via LLM ────────
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
        const sceneNum = parseInt(sceneId.replace("child_sc", ""), 10);
        setChildScenes(prev => prev.map(s =>
          s.scene === sceneNum ? { ...s, visualDescription: data.polishedText } : s
        ));
        setLastAction(`Scene ${sceneId}: description polished`);
      } else if (data.error) {
        setLastAction(`Polish failed: ${data.error}`);
      }
    } catch (err) {
      console.error("[handlePolishScene children] error:", err);
      setLastAction("Scene polish failed — check console");
    } finally {
      setPolishingScene(null);
    }
  }

  // ── Pre-flight check ──
  async function runPreflight() {
    setPreflightRunning(true);
    try {
      const sceneList = childScenes.map(s => {
        const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
        return { sceneId, imageUrl: sceneImages[sceneId] || s.imageUrl || null, videoUrl: sceneVideos[sceneId] || null, title: s.title };
      });
      const charList = savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => ({ id: c.id, name: c.name, voiceId: c.characterId, voiceName: c.voiceName }));
      const res = await fetch("/api/hybrid/pre-flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectType: "children",
          scenes: sceneList,
          audioConfig: { narrationProvider: narrationProvider, narrationText: narrationText, musicUrl: selectedMusicUrl, musicName: selectedMusicName },
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

  // ── assembleMovie ──
  async function assembleMovie() {
    const scenesToAssemble = childScenes.filter(s => {
      const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
      return assemblySelectedIds.includes(sceneId);
    });
    if (scenesToAssemble.length === 0) { setLastAction("Select scenes to assemble first"); return; }
    setAssembling(true);
    setAssemblyComplete(false);
    setAssembledUrl(null);
    const progress: Record<number, string> = {};
    try {
      const assemblyScenes: Array<{ scene: number; videoUrl: string }> = [];
      for (const s of scenesToAssemble) {
        const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
        const videoUrl = sceneVideos[sceneId];
        const imageUrl = sceneImages[sceneId] || s.imageUrl;
        if (videoUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl });
        } else if (imageUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl: `img:${imageUrl}` });
        }
      }
      if (assemblyScenes.length === 0) { setLastAction("No video or images available. Generate scene content first."); setAssembling(false); return; }

      for (const s of assemblyScenes) {
        progress[s.scene] = "processing";
        setAssemblyProgress({ ...progress });
        await new Promise(resolve => setTimeout(resolve, 200));
        progress[s.scene] = "done";
        setAssemblyProgress({ ...progress });
      }

      const projectId = `children_${Date.now()}`;
      const res = await fetch("/api/video/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: `Children Story — ${contentParam || "story"}`, scenes: assemblyScenes }),
      });
      const data = await res.json();
      if (data.error) { setLastAction(`Assembly error: ${data.error}`); }
      else if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        setGeneratedVideoUrl(data.outputUrl);
        try {
          await fetch("/api/asset-library", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: `Children Story — ${contentParam || "story"}`, type: "children-video", videoUrl: data.outputUrl, status: "review", metadata: { ageGroup, learningMode, visualStyle, scenes: assemblyScenes.length } }),
          });
        } catch { /* ignore */ }
        setAssemblyComplete(true);
        setLastAction("Story assembled successfully");
      }
    } catch { setLastAction("Assembly failed — try again"); }
    setAssembling(false);
  }

  // ── searchFreesound ──
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
    } catch { /* ignore */ }
    finally { setFsSearching(false); }
  }

  // ── saveFreesound ──
  async function saveFreesound(sound: { id: number; name: string; previewUrl: string; license: string; username: string; duration: number; tags: string[] }) {
    setFsSaving(sound.id);
    try {
      const res = await fetch("/api/sfx/freesound", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sound.id, name: sound.name, previewUrl: sound.previewUrl, license: sound.license, username: sound.username, duration: sound.duration, tags: sound.tags }),
      });
      const data = await res.json();
      if (data.ok || data.id) setFsSaved(prev => new Set(prev).add(sound.id));
      else setLastAction("Save failed: " + (data.error || "unknown"));
    } catch { setLastAction("Save to library failed"); }
    setFsSaving(null);
  }

  // ── generateElevenLabsSfx ──
  async function generateElevenLabsSfx() {
    if (!sfxDesc.trim()) return;
    setSfxGenerating(true);
    setSfxGeneratedUrl(null);
    try {
      const res = await fetch("/api/sfx/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: sfxDesc, duration_seconds: 5, autoSfx, mode: autoSfx ? "auto" : undefined }),
      });
      const data = await res.json();
      if (data.fileUrl || data.url || data.audioUrl) setSfxGeneratedUrl(data.fileUrl || data.url || data.audioUrl);
      else setLastAction("SFX generation failed: " + (data.error || "unknown"));
    } catch { setLastAction("SFX generation failed"); }
    setSfxGenerating(false);
  }

  // ── loadMusicLibrary ──
  async function loadMusicLibrary() {
    if (musicLibrary.length > 0) { setShowMusicPicker(true); return; }
    setLoadingMusic(true);
    try {
      const res = await fetch("/api/assets?type=music");
      const data = await res.json();
      const items = (data.assets || data.items || data || []) as MusicAsset[];
      setMusicLibrary(items.filter(t => t.filePath || t.id));
    } catch { /* ignore */ }
    setLoadingMusic(false);
    setShowMusicPicker(true);
  }

  // ── aiPickMusic ──
  async function aiPickMusic() {
    if (musicLibrary.length === 0) { setLastAction("Load music library first"); return; }
    setAiPickingMusic(true);
    setAiMusicPickLog("AI is selecting the best children music track...");
    try {
      const storyContext = expandedContent || textContent || readAlongText || "children story";
      const trackList = musicLibrary.map((t, i) => `${i + 1}. ${t.name} [tags: ${(t.tags || []).join(", ")}]`).join("\n");
      const prompt = `You are a children content music supervisor. Pick the best background music track for this story:\n\nStory: ${storyContext.substring(0, 400)}\nAge group: ${ageGroup}, Learning mode: ${learningMode}, Visual style: ${visualStyle}, Tone: ${tone}\n\nTracks:\n${trackList}\n\nRespond with JSON only: {"trackNumber": <1-based index>, "trackName": "<name>", "reason": "<brief reason>"}`;
      const res = await fetch("/api/llm/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], provider: storyAiProvider === "auto" ? undefined : storyAiProvider }),
      });
      const data = await res.json();
      const raw = data.content || data.text || data.message || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { trackNumber?: number; trackName?: string; reason?: string };
        const idx = (parsed.trackNumber ?? 1) - 1;
        const match = musicLibrary[idx] || musicLibrary.find(t => t.name === parsed.trackName);
        if (match) {
          setSelectedMusicUrl(`/api/media/${match.filePath}`);
          setSelectedMusicName(match.name);
          setAiMusicPickLog(`Selected: "${match.name}" — ${parsed.reason || ""}`);
        } else { setAiMusicPickLog("Could not match track from response."); }
      } else { setAiMusicPickLog("AI response could not be parsed."); }
    } catch { setAiMusicPickLog("AI pick failed — try again."); }
    setAiPickingMusic(false);
  }

  async function generateChildrenContent() {
    setGenerating(true);
    setGenerationError("");
    setGenerationProgress("Step 1/3: Building story slides...");
    try {
      // Step 1: Generate InvText story slides
      const storyRes = await fetch("/api/video/invtext-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textContent,
          contentType: contentParam || "story",
          tier: "standard",
          slideCount: 4,
        }),
      });
      const storyData = await safeJson<{ slides?: Array<{ text?: string; background?: string }>; scenes?: Array<{ text?: string; background?: string }> }>(storyRes, "invtext-story");

      setGenerationProgress("Step 2/3: Generating music...");
      // Step 2: Generate background music
      try {
        const musicMood = musicChoice === "soft_story" ? "calm" : musicChoice === "nursery" ? "children" : "upbeat";
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `${musicMood} background music for a children's story`,
            durationSeconds: 20,
          }),
        });
        const musicData = await safeJson<{ url?: string; audioUrl?: string; fallbackReason?: string }>(musicRes, "music/generate");
        if (musicData.url || musicData.audioUrl) setGeneratedMusicUrl(musicData.url ?? musicData.audioUrl ?? "");
        if (musicData.fallbackReason) setMusicFallbackReason(musicData.fallbackReason);
        else setMusicFallbackReason(null);
      } catch { /* music generation is optional */ }

      setGenerationProgress("Step 3/3: Assembling video...");
      // Step 3: Assemble slides into video with music
      if (storyData.slides || storyData.scenes) {
        const assembleRes = await fetch("/api/video/assemble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: (storyData.slides || storyData.scenes || []).map((s: { text?: string; background?: string }, i: number) => ({
              type: "image",
              sourceUrl: s.background || `bg:linear-gradient(135deg, #a855f720, #0a0d14)`,
              duration: 5,
              overlayText: s.text || textContent,
            })),
            musicUrl: generatedMusicUrl || undefined,
            outputName: `children_${Date.now()}`,
          }),
        });
        const assembleData = await safeJson<{ outputUrl?: string; videoUrl?: string }>(assembleRes, "video/assemble");
        if (assembleData.outputUrl || assembleData.videoUrl) {
          setGeneratedVideoUrl(assembleData.outputUrl ?? assembleData.videoUrl ?? "");
        }
      }

      setGenerationProgress("");
      setLastAction("Preview generated");
      setActiveTab("preview");
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Generation failed");
      setGenerationProgress("");
    }
    setGenerating(false);
  }

  // ── Persistent project storage key — from URL ?projectId= (no localStorage) ──
  const urlProjectId = searchParams.get("projectId");
  // BUG-15 pattern: guard flag — while restoring from DB we must NOT trigger the save effect
  const isRestoringRef = useRef(true);
  // Stable ref so save effect always uses current project ID
  const activeProjectIdRef = useRef<string>("");

  // ── Restore full project state — DB only ──
  useEffect(() => {
    let cancelled = false;
    async function restoreState() {
      isRestoringRef.current = true;
      const activeId = urlProjectId || "ghs_children_default";
      if (typeof window !== "undefined") {
        const target = `/dashboard/children-planner?projectId=${encodeURIComponent(activeId)}`;
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
            if (d.textContent)      setTextContent(d.textContent);
            if (d.expandedContent)  setExpandedContent(d.expandedContent);
            if (d.visualStyle)      setVisualStyle(d.visualStyle);
            if (d.narrationStyle)   setNarrationStyle(d.narrationStyle);
            if (d.narrationProvider) setNarrationProvider(d.narrationProvider);
            if (d.musicChoice)      setMusicChoice(d.musicChoice);
            if (d.ageGroup)         setAgeGroup(d.ageGroup);
            if (d.safetyLevel)      setSafetyLevel(d.safetyLevel);
            if (d.learningMode)     setLearningMode(d.learningMode);
            if (d.savedChars?.length > 0)   setSavedChars(d.savedChars);
            if (d.selectedCharIds?.length > 0) setSelectedCharIds(d.selectedCharIds);
            if (d.childScenes?.length > 0)  setChildScenes(d.childScenes);
            if (d.sceneImages && Object.keys(d.sceneImages).length > 0) setSceneImages(d.sceneImages);
            if (d.sceneVideos && Object.keys(d.sceneVideos).length > 0) setSceneVideos(d.sceneVideos);
            if (d.scriptSegments?.length > 0) setScriptSegments(d.scriptSegments);
            if (d.screenplay)       setScreenplay(d.screenplay);
            if (d.selectedMusicUrl) setSelectedMusicUrl(d.selectedMusicUrl);
            if (d.selectedMusicName) setSelectedMusicName(d.selectedMusicName);
            if (d.soundTier)        setSoundTier(d.soundTier);
            if (d.modelSettings)    setModelSettings(d.modelSettings);
            if (d.activeTab)        setActiveTab(d.activeTab);
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

  // ── Save project state — DB only, debounced via useEffect deps ──
  useEffect(() => {
    if (isRestoringRef.current) return;
    const data = {
      textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice,
      ageGroup, safetyLevel, learningMode,
      savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos,
      scriptSegments, screenplay, selectedMusicUrl, selectedMusicName,
      soundTier, modelSettings, activeTab,
      timestamp: Date.now(),
    };
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: activeProjectIdRef.current || "ghs_children_draft", data }),
    }).catch(() => { /* silent on DB error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice, ageGroup, safetyLevel,
      savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos, scriptSegments, screenplay,
      selectedMusicUrl, selectedMusicName, soundTier, modelSettings, activeTab]);

  // Load characters from DB
  useEffect(() => {
    setLoadingChars(true);
    fetch("/api/character-voices").then(r => r.json()).then(d => {
      if (d.voices?.length > 0) {
        setSavedChars(d.voices.map((v: Record<string, unknown>) => ({
          id: v.id as string,
          name: v.name as string,
          role: (v.role || "") as string,
          imageUrl: v.imageUrl as string | null,
          characterId: v.characterId as string | null,
          voiceName: v.voiceName as string | null,
          visualDescription: v.visualDescription as string | null,
        })));
      }
    }).catch(() => {}).finally(() => setLoadingChars(false));
  }, []);

  // Pre-populate content from a character deep-link
  useEffect(() => {
    if (!characterIdParam || savedChars.length === 0) return;
    const char = savedChars.find(c => c.id === characterIdParam);
    if (char) {
      const desc = char.visualDescription || "";
      setTextContent(prev => prev ? prev : `Story featuring ${char.name}${desc ? `: ${desc}` : ""}`);
      setActiveTab("content");
    }
  }, [characterIdParam, savedChars]);

  // Save to asset library after both reviews
  async function handleFinalRender() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/asset-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Children Video — ${contentParam || "story"} — ${new Date().toLocaleDateString()}`,
          type: "children-video",
          videoUrl: generatedVideoUrl,
          status: "approved",
          metadata: {
            contentType: contentParam,
            ageGroup: ageGroup || ageParam,
            narrationStyle,
            visualStyle,
            musicChoice,
            bilingual: isBilingual,
            lang: langParam,
            lang2: lang2Param,
            characters: savedChars.filter(c => selectedCharIds.includes(c.id)),
            review1: true,
            review2: true,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      if (data.id || data.success || data.asset || data.error === undefined) {
        setFinalVideoUrl(generatedVideoUrl);
        setLastAction("Saved to Asset Library");
      } else {
        setSaveError(data.error || "Failed to save to asset library");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  }

  // ── Generate Screenplay (AI) ──
  async function generateScreenplay() {
    const source = expandedContent || textContent || readAlongText;
    if (!source.trim()) { setScreenplayError("Enter content first."); return; }
    setGeneratingScreenplay(true);
    setScreenplayError("");
    try {
      const res = await fetch("/api/hybrid/screenplay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Children Story — ${contentParam || "story"}`,
          summary: source,
          scenes: [],
          genre: "children",
          tone: tone === "soft" ? "warm, gentle, age-appropriate" : "playful, energetic, fun",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setScreenplayError(data.error || "Story script generation failed.");
      } else {
        setScreenplay(data.screenplay || "");
      }
    } catch (err) {
      setScreenplayError(err instanceof Error ? err.message : "Story script generation failed.");
    }
    setGeneratingScreenplay(false);
  }

  // ── Parse Script into segments ──
  async function parseScript() {
    const textToParse = screenplay || expandedContent || textContent;
    if (!textToParse.trim()) { setLastAction("Enter content first."); return; }
    setParsingScript(true);
    try {
      const res = await fetch("/api/hybrid/parse-script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToParse,
          knownCharacters: savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => c.name),
        }),
      });
      const data = await res.json();
      if (data.ok && data.segments) {
        setScriptSegments(data.segments);
        setShowScriptReview(true);
        setLastAction(`Story script parsed — ${data.segments.length} segments`);
      } else {
        setLastAction(data.error || "Script parsing failed");
      }
    } catch (err) {
      setLastAction("Script parse error: " + String(err));
    }
    setParsingScript(false);
  }

  // ── Send screenplay to narration ──
  async function sendScreenplayToContent() {
    if (!screenplay) return;
    setSendingToScenes(true);
    setSendToScenesResult("");
    const narrationLines = screenplay.split("\n").filter(line => {
      const t = line.trim();
      return t && !/^[A-Z][A-Z\s\-'().]+$/.test(t) && !t.startsWith("(") && !/^(INT\.|EXT\.|FADE|CUT TO)/.test(t);
    });
    const narrationExtracted = narrationLines.join(" ");
    setNarrationText(narrationExtracted);
    setSendToScenesResult("Story script sent to narration. Go to Style & Voice to generate audio.");
    setSendingToScenes(false);
    await parseScript();
  }

  // ── Design Tab Renderer ──
  function renderDesign() {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Learning Design</h2>
        <p style={{ color: muted, fontSize: 12, margin: "0 0 20px" }}>Set age group and learning mode first. This controls everything: vocabulary, pacing, visual safety, and narration style.</p>

        {/* Age Group */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Age Group</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AGE_GROUPS.map(ag => (
              <div key={ag.id} onClick={() => setAgeGroup(ag.id as "toddler" | "preschool" | "early" | "older")}
                style={{ padding: 14, borderRadius: 10, border: `1px solid ${ageGroup === ag.id ? childAccent : border}`, background: ageGroup === ag.id ? `${childAccent}15` : s2, cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <div>
                    <div style={{ color: ageGroup === ag.id ? childAccent : "#fff", fontWeight: 700, fontSize: 13 }}>{ag.label}</div>
                    <div style={{ color: muted, fontSize: 10 }}>{ag.age}</div>
                  </div>
                </div>
                <div style={{ color: muted, fontSize: 11 }}>{ag.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Mode */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Learning Mode</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LEARNING_MODES.map(mode => (
              <div key={mode.id} onClick={() => setLearningMode(mode.id as typeof learningMode)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${learningMode === mode.id ? childAccent : border}`, background: learningMode === mode.id ? `${childAccent}15` : s2, cursor: "pointer", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: learningMode === mode.id ? childAccent : "#fff", fontWeight: 600, fontSize: 12 }}>{mode.label}</div>
                  <div style={{ color: muted, fontSize: 10, marginTop: 2 }}>{mode.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Production System */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Production System</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { id: "hybrid", label: "Hybrid Story", desc: "Images + narration + music. Best for read-along. Recommended." },
              { id: "movie", label: "Full Video", desc: "AI video per scene. More immersive but higher cost." },
            ].map(ps => (
              <div key={ps.id} onClick={() => setProductionSystem(ps.id as "hybrid" | "movie")}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${productionSystem === ps.id ? childSafe : border}`, background: productionSystem === ps.id ? `${childSafe}15` : s2, cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: productionSystem === ps.id ? childSafe : "#fff", fontWeight: 700, fontSize: 12 }}>{ps.label}</span>
                </div>
                <div style={{ color: muted, fontSize: 10 }}>{ps.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Level */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Safety Level</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {([
              { id: "maximum", label: "Maximum", desc: "Toddlers & babies. Zero risk tolerance.", color: childSafe },
              { id: "high", label: "High", desc: "Pre-school to early school. Recommended default.", color: childAccent },
              { id: "standard", label: "Standard", desc: "Older children 8-12. Mild challenge OK.", color: "#60a5fa" },
            ] as const).map(sl => (
              <div key={sl.id} onClick={() => setSafetyLevel(sl.id)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${safetyLevel === sl.id ? sl.color : border}`, background: safetyLevel === sl.id ? `${sl.color}15` : s2, cursor: "pointer" }}>
                <div style={{ color: safetyLevel === sl.id ? sl.color : "#fff", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{sl.label}</div>
                <div style={{ color: muted, fontSize: 10 }}>{sl.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Story AI Intelligence Grade */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Story AI Intelligence</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { value: "ollama",                           label: "Local LLM",   sub: "Ollama · Free · No cloud cost",                     color: childSafe,   badge: "FREE" },
              { value: "claude:claude-haiku-4-5-20251001", label: "Standard",    sub: "Claude Haiku 4.5 · Fast · Low cost",                color: "#00d4ff",   badge: "FAST" },
              { value: "claude:claude-sonnet-4-6",         label: "Pro",         sub: "Claude Sonnet 4.6 · Best balance · Recommended",    color: childAccent, badge: "REC" },
              { value: "claude:claude-opus-4-7",           label: "Premium",     sub: "Claude Opus 4.7 · Highest quality · Most powerful", color: "#f59e0b",   badge: "TOP" },
              { value: "openai:gpt-4o-mini",               label: "GPT-4o Mini", sub: "OpenAI · Fast · Requires OPENAI_API_KEY",           color: "#fb923c",   badge: "GPT" },
              { value: "openai:gpt-4o",                    label: "GPT-4o",      sub: "OpenAI · Best quality · Requires OPENAI_API_KEY",   color: "#f87171",   badge: "GPT+" },
              { value: "openai:o1-mini",                   label: "o1-mini",     sub: "OpenAI reasoning model · Deep analysis",            color: "#f97316",   badge: "THINK" },
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

        {/* ── SD: Model Settings Panel ── */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showModelSettings ? 14 : 0, cursor: "pointer" }}
            onClick={() => setShowModelSettings(p => !p)}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Model Settings</p>
            <span style={{ fontSize: 11, color: muted }}>{showModelSettings ? "Hide" : "Show"}</span>
          </div>
          {showModelSettings && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* 1. Story LLM */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as const }}>Story LLM</p>
                {([
                  { id: "claude-haiku-4-5", label: "Haiku 4.5", badge: "Fast" },
                  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", badge: "Balanced" },
                  { id: "claude-opus-4-7", label: "Opus 4.7", badge: "Premium" },
                  { id: "gpt-4o-mini", label: "GPT Fast", badge: "GPT" },
                  { id: "gpt-4o", label: "GPT Premium", badge: "GPT" },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => setModelSettings(p => ({ ...p, storyLLM: m.id }))}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 10px", marginBottom: 4, borderRadius: 8, border: `1px solid ${modelSettings.storyLLM === m.id ? childAccent : ds.color.line}`, background: modelSettings.storyLLM === m.id ? `${childAccent}12` : "transparent", color: modelSettings.storyLLM === m.id ? childAccent : "#fff", fontSize: 10, cursor: "pointer" }}>
                    <span>{m.label}</span><span style={{ opacity: 0.6 }}>{m.badge}</span>
                  </button>
                ))}
              </div>
              {/* 2. Character Image Model */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as const }}>Character Image</p>
                {([
                  { id: "fal_flux_schnell", label: "Flux Schnell", badge: "Default" },
                  { id: "fal_flux_dev", label: "Flux Dev", badge: "Quality" },
                  { id: "pruna_flux", label: "Pruna", badge: "Optimized" },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => setModelSettings(p => ({ ...p, charImageModel: m.id }))}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 10px", marginBottom: 4, borderRadius: 8, border: `1px solid ${modelSettings.charImageModel === m.id ? C2 : ds.color.line}`, background: modelSettings.charImageModel === m.id ? `${C2}12` : "transparent", color: modelSettings.charImageModel === m.id ? C2 : "#fff", fontSize: 10, cursor: "pointer" }}>
                    <span>{m.label}</span><span style={{ opacity: 0.6 }}>{m.badge}</span>
                  </button>
                ))}
              </div>
              {/* 3. Scene Video Model */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as const }}>Scene Video</p>
                {([
                  { id: "kling_1_6_standard", label: "Kling 1.6 Standard" },
                  { id: "kling_2_5_pro", label: "Kling 2.5 Pro" },
                  { id: "runway_gen4", label: "Runway Gen-4" },
                  { id: "veo2", label: "Veo 2" },
                  { id: "fal_wan_lite", label: "Wan 2.5" },
                ] as const).map(m => (
                  <button key={m.id} onClick={() => setModelSettings(p => ({ ...p, sceneVideoModel: m.id }))}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 10px", marginBottom: 4, borderRadius: 8, border: `1px solid ${modelSettings.sceneVideoModel === m.id ? C4 : ds.color.line}`, background: modelSettings.sceneVideoModel === m.id ? `${C4}12` : "transparent", color: modelSettings.sceneVideoModel === m.id ? C4 : "#fff", fontSize: 10, cursor: "pointer" }}>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              {/* 4. Sound/SFX Model (synced with Sound tab) */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: muted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as const }}>Sound/SFX</p>
                {SOUND_TIERS.map(tier => (
                  <button key={tier.id} onClick={() => { setModelSettings(p => ({ ...p, soundModel: tier.id })); setSoundTier(tier.id); }}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 10px", marginBottom: 4, borderRadius: 8, border: `1px solid ${modelSettings.soundModel === tier.id ? childSafe : ds.color.line}`, background: modelSettings.soundModel === tier.id ? `${childSafe}12` : "transparent", color: modelSettings.soundModel === tier.id ? childSafe : "#fff", fontSize: 10, cursor: "pointer" }}>
                    <span>{tier.label}</span><span style={{ opacity: 0.6 }}>{tier.cost}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Button */}
        <div style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => { setDesignComplete(true); setLastAction(`Design set: ${ageGroup}, ${learningMode}`); setActiveTab("content"); }}
            style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: childAccent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Confirm Design → Add Content
          </button>
          {designComplete && (
            <span style={{ fontSize: 11, color: childSafe, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Icon.Check style={{ width: 12, height: 12 }} /> Design confirmed</span>
          )}
        </div>
      </div>
    );
  }

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
      {/* ── Page Header ── */}
      <div style={{ padding: "24px 32px 0" }}>
        <HeroTitle
          kicker="Children Video Studio"
          title="Storybook"
          italic="Production"
          sub={`${branch === "video" ? "Animated Children Video" : "Hybrid Story (Read-Along)"}${contentParam ? ` · ${contentParam}` : ""}${ageParam ? ` · ${ageParam}` : " · all ages"}`}
        />
      </div>

      {/* ── Project toolbar ── */}
      <div style={{ padding: "12px 32px 0", display: "flex", gap: 10, alignItems: "center" }}>
        <a href="/dashboard/children-video" style={{ fontSize: 12, color: ds.color.mute, textDecoration: "none", padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card }}>
          Children Video
        </a>
      </div>

      {/* ── v14 Tab Bar ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${ds.color.line}`, background: ds.color.paper, overflowX: "auto", marginTop: 16 }}>
        {WORKSHOP_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "13px 18px", background: "none", border: "none",
                color: isActive ? ds.color.ink : ds.color.mute,
                fontWeight: 700, fontSize: 10, fontFamily: ds.font.mono, letterSpacing: "0.18em",
                textTransform: "uppercase" as const, cursor: "pointer", position: "relative",
                whiteSpace: "nowrap", transition: "color .18s",
              }}>
              {isActive && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#a78bfa,#d17bff,#ff9a3c,#f5a623)", borderRadius: "2px 2px 0 0" }} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div>
          {/* ── Production System Toggle ── */}
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <p style={labelStyle}>Production System</p>
            <div style={{ display: "flex", gap: 8, marginBottom: productionSystem === "movie" ? 16 : 0 }}>
              <button onClick={() => { setProductionSystem("hybrid"); setLastAction("System: Hybrid Story"); }}
                style={{ flex: 1, padding: "12px 10px", borderRadius: 12, border: `2px solid ${productionSystem === "hybrid" ? ds.color.lilac : ds.color.line}`, background: productionSystem === "hybrid" ? `${ds.color.lilac}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: ds.grad.tile.c4, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Film size={14} color="#fff" /></div>
                <p style={{ fontSize: 12, fontWeight: 700, color: productionSystem === "hybrid" ? ds.color.lilac : ds.color.ink }}>Hybrid Story</p>
                <p style={{ fontSize: 9, color: ds.color.mute }}>Text + images pipeline</p>
              </button>
              <button onClick={() => { setProductionSystem("movie"); setLastAction("System: Movie Mode"); }}
                style={{ flex: 1, padding: "12px 10px", borderRadius: 12, border: `2px solid ${productionSystem === "movie" ? ds.color.lilac : ds.color.line}`, background: productionSystem === "movie" ? `${ds.color.lilac}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: ds.grad.tile.c7, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Monitor size={14} color="#fff" /></div>
                <p style={{ fontSize: 12, fontWeight: 700, color: productionSystem === "movie" ? ds.color.lilac : ds.color.ink }}>Movie Mode</p>
                <p style={{ fontSize: 9, color: ds.color.mute }}>Scenes + video generation</p>
              </button>
            </div>

            {/* Movie Mode extra options */}
            {productionSystem === "movie" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, paddingTop: 4 }}>
                {/* Genre */}
                <div>
                  <p style={labelStyle}>Genre</p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                    {MOVIE_GENRES.map(g => (
                      <button key={g} onClick={() => { setMovieGenre(g); setLastAction(`Genre: ${g}`); }}
                        style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${movieGenre === g ? childAccent : border}`, background: movieGenre === g ? `${childAccent}12` : "transparent", color: movieGenre === g ? childAccent : "#fff", fontSize: 10, fontWeight: movieGenre === g ? 700 : 400, cursor: "pointer", textAlign: "left" as const }}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene count */}
                <div>
                  <p style={labelStyle}>Number of Scenes</p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                    {MOVIE_SCENE_COUNTS.map(n => (
                      <button key={n} onClick={() => { setMovieSceneCount(n); setLastAction(`Scenes: ${n}`); }}
                        style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${movieSceneCount === n ? childAccent : border}`, background: movieSceneCount === n ? `${childAccent}12` : "transparent", color: movieSceneCount === n ? childAccent : "#fff", fontSize: 10, fontWeight: movieSceneCount === n ? 700 : 400, cursor: "pointer", textAlign: "left" as const }}>
                        {n} scenes
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene duration */}
                <div>
                  <p style={labelStyle}>Scene Duration</p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                    {MOVIE_SCENE_DURATIONS.map(d => (
                      <button key={d} onClick={() => { setMovieSceneDuration(d); setLastAction(`Duration: ${d}`); }}
                        style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${movieSceneDuration === d ? childAccent : border}`, background: movieSceneDuration === d ? `${childAccent}12` : "transparent", color: movieSceneDuration === d ? childAccent : "#fff", fontSize: 10, fontWeight: movieSceneDuration === d ? 700 : 400, cursor: "pointer", textAlign: "left" as const }}>
                        {d} per scene
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid — 4 status bubbles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Content", value: textContent ? "Ready!" : "Empty", color: childAccent, ok: !!textContent },
              { label: "Style", value: styleProgress === 100 ? "Set!" : "Pending", color: C3, ok: styleProgress === 100 },
              { label: "Preview", value: generatedVideoUrl ? "Done!" : "Not yet", color: C4, ok: !!generatedVideoUrl },
              { label: "Safety", value: review1Done && review2Done ? "2/2" : review1Done ? "1/2" : "0/2", color: childSafe, ok: review1Done && review2Done },
            ].map(stat => (
              <div key={stat.label} style={{
                ...cardStyle, marginBottom: 0, textAlign: "center", padding: "18px 12px",
                border: `2px solid ${stat.ok ? stat.color + "50" : border}`,
                background: stat.ok ? `${stat.color}10` : ds.color.card,
                boxShadow: stat.ok ? `0 0 20px ${stat.color}20` : "none",
              }}>
                <p style={{ fontSize: 18, fontWeight: 900, color: stat.ok ? stat.color : muted, margin: "0 0 4px" }}>{stat.value}</p>
                <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Progress + Next Steps side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Progress Bars */}
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Production Progress</p>
              <ProgressBar label="Content" value={contentProgress} color={childAccent} />
              <ProgressBar label="Style" value={styleProgress} color={childAccent} />
              <ProgressBar label="Preview" value={previewProgress} color="#00d4ff" />
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginTop: 6 }}>
                <ProgressBar label="Safety Reviews" value={reviewProgress} color={childSafe} />
              </div>
            </div>

            {/* Next Steps */}
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Next Steps</p>
              <div style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}`, marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: childAccent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Last Action</p>
                <p style={{ fontSize: 12, color: "#fff" }}>{lastAction}</p>
              </div>
              <div style={{ background: `${childSafe}08`, borderRadius: 10, padding: 12, border: `1px solid ${childSafe}20` }}>
                <p style={{ fontSize: 9, color: childSafe, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Next Step</p>
                <p style={{ fontSize: 12, color: "#fff" }}>
                  {!designComplete ? "Set age group & learning mode" :
                   !textContent ? "Enter your content" :
                   styleProgress < 100 ? "Choose voice & style" :
                   !review1Done ? "Complete safety review" :
                   !generatedVideoUrl ? "Generate preview" :
                   !review2Done ? "Complete final review" :
                   "Ready to render!"}
                </p>
                <button onClick={() => {
                  if (!designComplete) setActiveTab("design");
                  else if (!textContent) setActiveTab("content");
                  else if (styleProgress < 100) setActiveTab("sound");
                  else if (!review1Done) setActiveTab("review1");
                  else if (!generatedVideoUrl) setActiveTab("preview");
                  else if (!review2Done) setActiveTab("review2");
                  else setActiveTab("review2");
                }} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  Go
                </button>
              </div>
            </div>
          </div>

          {/* ── Demo Scene Gallery ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: childAccent }}>Sample Scenes</p>
                <p style={{ margin: 0, fontSize: 11, color: muted }}>Examples of what your children videos can look like</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {[
                { img: "/api/media/demo/child_abc.png",       label: "ABC Learning",    color: C4 },
                { img: "/api/media/demo/child_colors.png",    label: "Color World",     color: C2 },
                { img: "/api/media/demo/child_counting.png",  label: "Counting Fun",    color: C3 },
                { img: "/api/media/demo/child_nursery.png",   label: "Nursery Rhyme",   color: "#c084fc" },
                { img: "/api/media/demo/child_story.png",     label: "Story Time",      color: childSafe },
              ].map(scene => (
                <div key={scene.label} style={{ position: "relative", borderRadius: 14, overflow: "hidden", cursor: "pointer", border: `2px solid ${scene.color}30`, transition: "all 0.2s" }}
                  onClick={() => setContentImage(scene.img)}>
                  <img src={scene.img} alt={scene.label}
                    style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  {/* Label overlay */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 8px",
                    background: `linear-gradient(transparent, rgba(0,0,0,0.85))` }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: scene.color }}>{scene.label}</p>
                  </div>
                  {/* Hover glow badge */}
                  <div style={{ position: "absolute", top: 6, right: 6, background: scene.color, borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#000" }}>
                    Demo
                  </div>
                </div>
              ))}
            </div>
            {contentImage && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, background: `${childSafe}10`, border: `1px solid ${childSafe}30`, display: "flex", alignItems: "center", gap: 10 }}>
                <Icon.Check style={{ width: 14, height: 14, color: childSafe, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: childSafe }}>Demo image selected as content reference</p>
                <button onClick={() => setContentImage(null)} style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", borderRadius: 6, border: `1px solid ${childSafe}40`, background: "transparent", color: childSafe, cursor: "pointer" }}>Clear</button>
              </div>
            )}
          </div>

          {/* ── Demo Videos strip ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Icon.Film style={{ width: 18, height: 18, color: C2, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C2 }}>Demo Videos</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {[
                { src: "/api/media/demo/child_abc_scene.mp4",      label: "ABC Video",    color: C4 },
                { src: "/api/media/demo/child_colors_scene.mp4",   label: "Colors Video", color: C2 },
                { src: "/api/media/demo/child_counting_scene.mp4", label: "Count Video",  color: C3 },
                { src: "/api/media/demo/child_nursery_scene.mp4",  label: "Nursery",      color: "#c084fc" },
                { src: "/api/media/demo/child_story_scene.mp4",    label: "Story Video",  color: childSafe },
              ].map(v => (
                <div key={v.label} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${v.color}30` }}>
                  <video src={v.src} muted loop style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                    onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                    onMouseLeave={e => (e.target as HTMLVideoElement).pause()} />
                  <p style={{ margin: 0, padding: "6px 8px", fontSize: 10, fontWeight: 700, color: v.color, background: "rgba(0,0,0,0.6)" }}>▶ {v.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links — 4 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: designComplete ? "Design Set" : "Set Design", color: C3, action: () => setActiveTab("design"), href: null },
              { label: "Open Editor", color: childSafe, action: null, href: "/dashboard/collaborative-editor?from=children-planner" },
              { label: "Characters", color: C2, action: null, href: "/dashboard/character-voices" },
              { label: "Children Video", color: C4, action: null, href: "/dashboard/children-video" },
            ].map(link => {
              const inner = (
                <div key={link.label} onClick={link.action ?? undefined} style={{
                  ...cardStyle, cursor: "pointer", textAlign: "center", padding: "18px 8px", marginBottom: 0,
                  border: `2px solid ${link.color}30`,
                  transition: "all 0.18s",
                }}>
                  <p style={{ fontSize: 11, color: link.color, fontWeight: 700, marginBottom: 0 }}>{link.label}</p>
                </div>
              );
              return link.href ? (
                <a key={link.label} href={link.href} style={{ textDecoration: "none" }}
                  onClick={() => { /* return state handled via URL params */ }}>
                  {inner}
                </a>
              ) : inner;
            })}
          </div>

          {/* Warnings */}
          {(!textContent || styleProgress < 100 || (!review1Done && generatedVideoUrl)) && (
            <div style={{ ...cardStyle, borderColor: "#f59e0b30", background: "rgba(245,158,11,0.04)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>Warnings</p>
              {!textContent && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(245,158,11,0.06)", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#f59e0b" }}>!</span>
                  <p style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>No content entered yet</p>
                  <button onClick={() => setActiveTab("content")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
                </div>
              )}
              {styleProgress < 100 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(245,158,11,0.06)", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#f59e0b" }}>!</span>
                  <p style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>Style configuration incomplete</p>
                  <button onClick={() => setActiveTab("sound")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
                </div>
              )}
              {!review1Done && generatedVideoUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(245,158,11,0.06)", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#f59e0b" }}>!</span>
                  <p style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>Safety review not completed</p>
                  <button onClick={() => setActiveTab("review1")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESIGN TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "design" && renderDesign()}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS TAB — Inline Registry (AI-first)                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "characters" && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Characters ({savedChars.length})</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCharPicker(prev => !prev)}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                {showCharPicker ? "Hide Library" : "or import saved →"}
              </button>
            </div>
          </div>

          {/* ── PRIMARY ACTION: Build Story Characters with AI ── */}
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${childAccent}40`, background: `${childAccent}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Icon.Star style={{ width: 18, height: 18, color: childAccent, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Build Story Characters with AI</p>
                <p style={{ fontSize: 11, color: muted }}>AI reads your story, extracts characters, and builds their profiles — names, roles, descriptions, ready to use.</p>
              </div>
            </div>
            <button
              onClick={extractChildCharacters}
              disabled={extractingChars !== "idle" || (!expandedContent && !textContent.trim() && !readAlongText.trim())}
              title={(!expandedContent && !textContent.trim() && !readAlongText.trim()) ? "Enter your story content first" : ""}
              style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: extractingChars !== "idle" ? "#1a2a1a" : (!expandedContent && !textContent.trim() && !readAlongText.trim()) ? "#1a1a2a" : `linear-gradient(135deg, ${childAccent}, #059669)`, color: (!expandedContent && !textContent.trim() && !readAlongText.trim()) ? muted : "#fff", fontSize: 13, fontWeight: 700, cursor: extractingChars !== "idle" || (!expandedContent && !textContent.trim() && !readAlongText.trim()) ? "not-allowed" : "pointer" }}>
              {extractingChars === "building" ? "Building character profiles..." : extractingChars === "extracting" ? "Extracting characters from story..." : savedChars.length > 0 ? "Rebuild Story Characters with AI" : "Build Story Characters with AI"}
            </button>
            {(!expandedContent && !textContent.trim() && !readAlongText.trim()) && (
              <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Enter your story in the Content tab first, then come back here.</p>
            )}
          </div>

          {/* ── Inline import from library (secondary, hidden by default) ── */}
          {showCharPicker && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Import from Character Library</p>
                <button onClick={() => setShowCharPicker(false)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                  Close
                </button>
              </div>
              <CharacterPicker
                onSelect={(char) => {
                  setSavedChars(prev => {
                    if (prev.some(c => c.id === char.id)) return prev;
                    return [...prev, { id: char.id, name: char.name, role: char.role || "supporting", imageUrl: char.imageUrl || undefined, characterId: char.characterId || undefined, voiceName: char.voiceName || undefined, visualDescription: char.visualDescription || undefined }];
                  });
                  setSelectedCharIds(prev => prev.includes(char.id) ? prev : [...prev, char.id]);
                  setLastAction(`Imported character "${char.name}"`);
                }}
                onCreateNew={() => { window.open("/dashboard/character-voices?returnTo=children-planner", "_blank"); }}
                compact
              />
            </div>
          )}

          {/* Character cards */}
          {loadingChars ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <p style={{ color: muted, fontSize: 12 }}>Loading characters...</p>
            </div>
          ) : savedChars.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 32, borderStyle: "dashed" }}>
              <Icon.User style={{ width: 28, height: 28, color: muted, marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>No characters yet</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Click "Build Story Characters with AI" above, or import from your library.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
              {savedChars.map(char => {
                const isSelected = selectedCharIds.includes(char.id);
                const hasVoice = !!char.voiceName;
                const hasImage = !!char.imageUrl;
                return (
                  <div key={char.id}
                    style={{ background: surface, borderRadius: 14, border: `2px solid ${isSelected ? childAccent : border}`, overflow: "hidden", transition: "border-color 0.2s" }}>
                    {/* Character image */}
                    <div style={{ height: 120, background: s2, position: "relative", overflow: "hidden" }}>
                      {char.imageUrl ? (
                        <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon.User style={{ width: 40, height: 40, opacity: 0.3 }} />
                        </div>
                      )}
                      {isSelected && (
                        <div style={{ position: "absolute", top: 8, right: 8, background: childAccent, borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon.Check style={{ width: 12, height: 12, color: "#000" }} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{char.name}</p>
                      {char.characterId && <p style={{ fontSize: 9, color: childAccent, fontFamily: "monospace", marginBottom: 6 }}>{char.characterId}</p>}
                      {char.visualDescription && <p style={{ fontSize: 10, color: muted, marginBottom: 8, lineHeight: 1.4 }}>{char.visualDescription}</p>}

                      {/* Readiness badges */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: hasVoice ? `${childSafe}15` : "rgba(239,68,68,0.1)", color: hasVoice ? childSafe : "#ef4444", fontWeight: 600 }}>
                          {hasVoice ? "Voice" : "No Voice"}
                        </span>
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: hasImage ? `${childSafe}15` : "rgba(239,68,68,0.1)", color: hasImage ? childSafe : "#ef4444", fontWeight: 600 }}>
                          {hasImage ? "Image" : "No Image"}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => {
                          const next = isSelected ? selectedCharIds.filter(id => id !== char.id) : [...selectedCharIds, char.id];
                          setSelectedCharIds(next);
                          setLastAction(isSelected ? `Removed ${char.name}` : `Added ${char.name}`);
                        }}
                          style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "none", background: isSelected ? `${childAccent}20` : childAccent, color: isSelected ? childAccent : "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          {isSelected ? "Remove" : "Add to Video"}
                        </button>
                        <button onClick={() => {
                          fetch("/api/generation/image", { method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: `Character portrait: ${char.name}. ${char.visualDescription || ""}. Children's book illustration style, age-appropriate, friendly, colorful, front view.`, width: 768, height: 768 }) })
                            .then(r => r.json()).then(d => {
                              if (d.imageUrl || d.imagePath) {
                                setSavedChars(prev => prev.map(c => c.id === char.id ? { ...c, imageUrl: d.imageUrl || d.imagePath } : c));
                                setLastAction(`Portrait generated for ${char.name}`);
                              }
                            }).catch((err) => { console.error("genChildCharImage:", err); });
                        }} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${childAccent}30`, background: `${childAccent}06`, color: childAccent, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                          Gen. Portrait
                        </button>
                        <button onClick={() => {
                          setSavedChars(prev => prev.filter(c => c.id !== char.id));
                          setSelectedCharIds(prev => prev.filter(id => id !== char.id));
                          setLastAction(`Removed ${char.name}`);
                        }} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid rgba(239,68,68,0.3)`, background: "rgba(239,68,68,0.06)", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected summary */}
          {selectedCharIds.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 12, borderColor: `${childAccent}30`, background: `${childAccent}05` }}>
              <p style={{ fontSize: 11, color: childAccent, fontWeight: 600, marginBottom: 6 }}>
                {selectedCharIds.length} character{selectedCharIds.length > 1 ? "s" : ""} will appear in this video
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => (
                  <span key={c.id} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: `${childAccent}15`, color: childAccent, fontWeight: 600 }}>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONTENT INPUT TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <div style={{ ...cardStyle, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Enter Your Content</h2>

          {/* ── Learning Mode Selector ── */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>Learning Mode</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {LEARNING_MODES.map(mode => {
                const isActive = learningMode === mode.id;
                return (
                  <button key={mode.id} onClick={() => { setLearningMode(mode.id as typeof learningMode); setLastAction(`Mode: ${mode.label}`); }}
                    style={{
                      padding: "12px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                      border: `2px solid ${isActive ? childAccent : border}`,
                      background: isActive ? `${childAccent}10` : "transparent",
                      transition: "all 0.15s",
                    }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: isActive ? childAccent : "#fff", marginBottom: 2 }}>{mode.label}</p>
                    <p style={{ fontSize: 9, color: muted, lineHeight: 1.3 }}>{mode.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {topicParam && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>
                Topic: {topicParam}
              </p>
              <p style={{ fontSize: 9, color: muted, marginTop: 2 }}>
                Pre-filled from curriculum suggestion. Edit below to customise, or use as-is.
              </p>
            </div>
          )}

          {charactersParam && (
            <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
              <p style={{ fontSize: 11, color: childAccent, fontWeight: 600 }}>
                Characters: {charactersParam.split(",").filter(Boolean).length} imported
              </p>
              <p style={{ fontSize: 9, color: muted }}>Characters from your library will be used in this content.</p>
            </div>
          )}

          <textarea value={textContent} onChange={e => { setTextContent(e.target.value); setLastAction("Content updated"); }} rows={6}
            placeholder={contentParam === "3letter" ? "Enter words (one per line):\ncat\nsat\nram\njam\nran" :
              contentParam === "abc" ? "Enter the letters to cover (or leave empty for full A-Z)" :
              contentParam === "poem" ? "Enter your children's poem:\nTwinkle twinkle little star\nHow I wonder what you are" :
              contentParam === "storybook" ? "Write your children's story:\nOnce upon a time, there was a little cat named Sam. Sam loved to play in the garden..." :
              "Enter your content here..."}
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }} />

          {/* AI Content Expansion */}
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
            <button
              onClick={expandContent}
              disabled={expandingContent || !textContent.trim()}
              style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childAccent}`, background: expandingContent ? `${childAccent}10` : `${childAccent}20`, color: (expandingContent || !textContent.trim()) ? muted : childAccent, fontSize: 12, fontWeight: 600, cursor: (expandingContent || !textContent.trim()) ? "not-allowed" : "pointer" }}>
              {expandingContent ? "Expanding..." : "Expand with AI"}
            </button>
            <button
              onClick={expandStory}
              disabled={expanding || !textContent.trim()}
              style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: expanding ? `${childSafe}10` : `${childSafe}20`, color: (expanding || !textContent.trim()) ? muted : childSafe, fontSize: 12, fontWeight: 700, cursor: (expanding || !textContent.trim()) ? "not-allowed" : "pointer" }}>
              {expanding ? "Building..." : "Build Story with AI"}
            </button>
            {expandedContent && (
              <button
                onClick={extractChildCharacters}
                disabled={extractingChars !== "idle"}
                style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: `${childSafe}15`, color: extractingChars !== "idle" ? muted : childSafe, fontSize: 12, fontWeight: 600, cursor: extractingChars !== "idle" ? "not-allowed" : "pointer" }}>
                {extractingChars === "building" ? "Building Characters..." : extractingChars === "extracting" ? "Extracting..." : "Extract Characters from Story"}
              </button>
            )}
          </div>

          {/* Show planned scenes after expandStory */}
          {childScenes.length > 0 && (
            <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: `${childSafe}08`, border: `1px solid ${childSafe}25` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 10, color: childSafe, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Story Built — {childScenes.length} Scenes Planned
                </p>
                <button
                  disabled={runningIntelligence || childScenes.length === 0}
                  onClick={runSceneIntelligence}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4ade8030", background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}
                >
                  {runningIntelligence ? "Detecting..." : "Story Scenes"}
                </button>
              </div>
              {runningIntelligence && (
                <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0" }}>Scene Intelligence running — detecting environments and ambient sounds...</p>
              )}
              {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
                <p style={{ fontSize: 10, color: "#666", margin: "4px 0" }}>
                  {Object.keys(sceneIntelligence).length} scenes have sound environment data
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {childScenes.map(s => {
                  const sceneKey = `child_sc${String(s.scene).padStart(2, "0")}`;
                  const intel = sceneIntelligence[sceneKey];
                  return (
                    <div key={s.scene} style={{ padding: "8px 12px", borderRadius: 8, background: s2, border: `1px solid ${border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 10, color: childAccent, fontWeight: 700, flexShrink: 0, minWidth: 28 }}>SC{String(s.scene).padStart(2, "0")}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{s.title}</p>
                        <p style={{ fontSize: 9, color: muted, lineHeight: 1.4 }}>{s.visualDescription.substring(0, 100)}{s.visualDescription.length > 100 ? "..." : ""}</p>
                        {intel && (() => {
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
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setActiveTab("review1")} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                Proceed to Review →
              </button>
            </div>
          )}

          {/* Show expanded content if available */}
          {expandedContent && (
            <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: `${childAccent}08`, border: `1px solid ${childAccent}25` }}>
              <p style={{ fontSize: 10, color: childAccent, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>AI Expanded Story</p>
              <p style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6, whiteSpace: "pre-wrap" as const }}>{expandedContent}</p>
              <button onClick={() => { setTextContent(expandedContent); setLastAction("Used expanded content"); }}
                style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                Use This Text
              </button>
            </div>
          )}

          {/* Upload Reference Image */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 10, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Upload Reference Image</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Choose Image
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
                    const data = await res.json();
                    if (data.url) { setContentImage(data.url); setLastAction("Reference image uploaded"); }
                  } catch { /* ignore */ }
                }} />
              </label>
              {contentImage && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={contentImage} alt="Reference" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: `1px solid ${border}` }} />
                  <button onClick={() => { setContentImage(null); setLastAction("Reference image removed"); }}
                    style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {isBilingual && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <p style={{ fontSize: 11, color: "#f59e0b" }}>
                Bilingual mode active — each word/sentence will be shown in {langParam.toUpperCase()} and {lang2Param.toUpperCase()} with dual narration.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>Energy Level</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setTone("soft"); setLastAction("Energy set to Soft"); }}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tone === "soft" ? childSafe : border}`, background: tone === "soft" ? `${childSafe}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: tone === "soft" ? childSafe : "#fff" }}>Soft</p>
                  <p style={{ fontSize: 8, color: muted }}>Calm, bedtime, gentle</p>
                </button>
                <button onClick={() => { setTone("active"); setLastAction("Energy set to Active"); }}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tone === "active" ? "#f59e0b" : border}`, background: tone === "active" ? "rgba(245,158,11,0.1)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: tone === "active" ? "#f59e0b" : "#fff" }}>Active</p>
                  <p style={{ fontSize: 8, color: muted }}>Playful, energetic, fun</p>
                </button>
              </div>
            </div>
          </div>

          {/* Next step CTA */}
          {textContent && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setActiveTab("script")}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Next: Script & Story Plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STYLE & VOICE TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "style" && (
        <div style={{ ...cardStyle, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Voice, Visual & Music</h2>

          {/* ── AI Model Picker ── */}
          <div style={{ marginBottom: 20 }}>
            <span style={labelStyle}>AI Generation Models</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Film style={{ width: 12, height: 12 }} />
                Video Model: <span style={{ color: "#fff" }}>{selectedVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childSafe}40`, background: `${childSafe}10`, color: childSafe, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Image style={{ width: 12, height: 12 }} />
                Image Model: <span style={{ color: "#fff" }}>{selectedImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              {/* Seed control */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Seed (random)"
                  value={genSeed ?? ""}
                  onChange={e => {
                    const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                    setGenSeed(isNaN(v as number) ? null : v);
                  }}
                  style={{ width: 110, padding: "5px 8px", borderRadius: 7, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 10, outline: "none" }}
                />
                <button
                  title="Randomize seed"
                  onClick={() => {
                    const sv = Math.floor(Math.random() * 1e9);
                    setGenSeed(sv);
                  }}
                  style={{ padding: "5px 7px", borderRadius: 7, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>
                  🎲
                </button>
              </div>
            </div>
          </div>

          {/* Narration style */}
          <p style={labelStyle}>Narration Voice</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6, marginBottom: 20 }}>
            {NARRATION_STYLES.map(n => (
              <button key={n.id} onClick={() => { setNarrationStyle(n.id); setLastAction(`Narration: ${n.label}`); }}
                style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${narrationStyle === n.id ? childAccent : border}`, background: narrationStyle === n.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "left" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: narrationStyle === n.id ? childAccent : "#fff" }}>{n.label}</p>
                <p style={{ fontSize: 9, color: muted }}>{n.desc}</p>
              </button>
            ))}
          </div>

          {/* Narration provider selector */}
          <p style={labelStyle}>Narration Provider</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 14 }}>
            {([
              { id: "piper",       label: "Piper (free)",   color: childSafe },
              { id: "fal-narrator", label: "FAL Narrator",  color: C4 },
              { id: "elevenlabs",  label: "ElevenLabs",     color: C2 },
              { id: "karaoke",     label: "Karaoke",        color: childAccent },
            ] as const).map(p => (
              <button key={p.id} onClick={() => setNarrationProvider(p.id)}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${narrationProvider === p.id ? p.color : border}`,
                  background: narrationProvider === p.id ? `${p.color}12` : "transparent",
                  color: narrationProvider === p.id ? p.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Narration controls */}
          <div style={{ marginBottom: 20 }}>
            <NarrationControls
              narrationText={narrationText}
              onNarrationChange={setNarrationText}
              onSettingsChange={setNarrationSettings}
              initialSettings={{ mode: "children" }}
              compact
            />
          </div>

          {/* Visual style */}
          <p style={labelStyle}>Visual Style</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {VISUAL_STYLES.map(v => {
              const isActive = visualStyle === v.id;
              const [c1, c2] = v.colors.split(",").map(s => s.trim());
              return (
                <button key={v.id} onClick={() => { setVisualStyle(v.id); setLastAction(`Visual: ${v.label}`); }}
                  style={{ padding: "0", borderRadius: 12, border: `2px solid ${isActive ? childAccent : border}`, background: "transparent", cursor: "pointer", overflow: "hidden", transition: "border-color 0.15s" }}>
                  <div style={{ height: 36, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
                  <div style={{ padding: "8px 6px", textAlign: "center" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: isActive ? childAccent : "#fff", marginBottom: 2 }}>{v.label}</p>
                    <p style={{ fontSize: 8, color: muted, lineHeight: 1.3 }}>{v.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Music */}
          <p style={labelStyle}>Background Music</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
            {MUSIC_CHOICES.map(m => (
              <button key={m.id} onClick={() => { setMusicChoice(m.id); setLastAction(`Music: ${m.label}`); }}
                style={{ padding: "10px 8px", borderRadius: 10, border: `1px solid ${musicChoice === m.id ? childAccent : border}`, background: musicChoice === m.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 9, fontWeight: 600, color: musicChoice === m.id ? childAccent : "#fff" }}>{m.label}</p>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 9, color: muted, marginBottom: 16 }}>Music is always secondary to narration. Voice stays at 100%, music at 18-35%. Music ducks when narration is active.</p>

          {/* Auto SFX toggle */}
          <div data-testid="auto-sfx-toggle" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: s2, border: `1px solid ${autoSfx ? childAccent + "40" : border}`, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Auto SFX</p>
              <p style={{ fontSize: 9, color: muted }}>AI assigns sound effects to each scene automatically. Only CC0 / CC BY / Public Domain tracks used.</p>
            </div>
            <button data-testid="auto-sfx-btn" onClick={() => { setAutoSfx(v => !v); setLastAction(`Auto SFX: ${!autoSfx ? "ON" : "OFF"}`); }}
              style={{ padding: "7px 18px", borderRadius: 20, border: `1px solid ${autoSfx ? childAccent : border}`, background: autoSfx ? `${childAccent}18` : "transparent", color: autoSfx ? childAccent : muted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const, minWidth: 64 }}>
              {autoSfx ? "ON" : "OFF"}
            </button>
          </div>

          {/* ── Music Library Picker ── */}
          <p style={labelStyle}>Music Library</p>
          <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${border}`, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <button onClick={loadMusicLibrary} disabled={loadingMusic}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${childAccent}`, background: `${childAccent}10`, color: loadingMusic ? muted : childAccent, fontSize: 11, fontWeight: 700, cursor: loadingMusic ? "not-allowed" : "pointer" }}>
                {loadingMusic ? "Loading..." : "Browse Music Library"}
              </button>
              {musicLibrary.length > 0 && (
                <button onClick={aiPickMusic} disabled={aiPickingMusic}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${childSafe}`, background: `${childSafe}10`, color: aiPickingMusic ? muted : childSafe, fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
                  {aiPickingMusic ? "Picking..." : "AI Pick Music"}
                </button>
              )}
            </div>
            {selectedMusicName && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: `${childAccent}12`, border: `1px solid ${childAccent}30`, marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: childAccent, fontWeight: 700 }}>Selected: {selectedMusicName}</p>
                {selectedMusicUrl && <audio src={selectedMusicUrl} controls style={{ width: "100%", height: 28, marginTop: 6 }} />}
              </div>
            )}
            {aiMusicPickLog && <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>{aiMusicPickLog}</p>}
          </div>

          {/* ── Sound Effects Browser ── */}
          <p style={labelStyle}>Sound Effects Studio</p>
          <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${border}`, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#0a0d14", borderRadius: 8, padding: 4 }}>
              {([{ id: "freesound", label: "Sound Effects Browser" }, { id: "ai-sfx", label: "AI Audio Studio" }] as const).map(t => (
                <button key={t.id} onClick={() => setSoundTab(t.id)}
                  style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "none", background: soundTab === t.id ? childAccent : "transparent", color: soundTab === t.id ? "#000" : muted, fontSize: 11, fontWeight: soundTab === t.id ? 700 : 400, cursor: "pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {soundTab === "freesound" && (
              <div>
                {fsNoKey ? (
                  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>Freesound API key not configured</p>
                    <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Add FREESOUND_API_KEY to your environment.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input value={fsQuery} onChange={e => setFsQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFreesound()} placeholder="Search: birds chirping, water stream, laughter..."
                      style={{ flex: 1, background: "#0a0d14", border: `1px solid ${border}`, borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none" }} />
                    <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: fsSearching ? "#2a2a40" : childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: (fsSearching || !fsQuery.trim()) ? "not-allowed" : "pointer" }}>
                      {fsSearching ? "..." : "Search"}
                    </button>
                  </div>
                )}
                {fsResults.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    {fsResults.map(sound => {
                      const saved = fsSaved.has(sound.id);
                      const saving = fsSaving === sound.id;
                      const previewing = sfxPreviewId === sound.id;
                      return (
                        <div key={sound.id} style={{ background: "#0a0d14", borderRadius: 10, padding: "10px 12px", border: `1px solid ${border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{sound.name}</p>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 4 }}>
                              <span style={{ fontSize: 9, color: muted }}>{sound.duration.toFixed(1)}s</span>
                              <span style={{ fontSize: 9, color: muted }}>by {sound.username}</span>
                              {(sound.tags || []).slice(0, 3).map(tag => <span key={tag} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${childAccent}15`, color: childAccent }}>{tag}</span>)}
                            </div>
                            {previewing && <audio src={sound.previewUrl} autoPlay controls style={{ width: "100%", height: 24 }} />}
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button onClick={() => setSfxPreviewId(previewing ? null : sound.id)}
                              style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`, background: previewing ? `${childAccent}20` : "transparent", color: previewing ? childAccent : muted, fontSize: 10, cursor: "pointer" }}>
                              {previewing ? "■" : "▶"}
                            </button>
                            <button onClick={() => saveFreesound(sound)} disabled={saved || saving}
                              style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: saved ? `${childSafe}20` : childSafe, color: saved ? childSafe : "#000", fontSize: 10, fontWeight: 700, cursor: (saved || saving) ? "not-allowed" : "pointer" }}>
                              {saving ? "..." : saved ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!fsNoKey && fsResults.length === 0 && !fsSearching && (
                  <p style={{ fontSize: 11, color: muted, textAlign: "center" as const }}>Search for child-friendly sound effects above</p>
                )}
              </div>
            )}

            {soundTab === "ai-sfx" && (
              <div>
                <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Describe a sound effect and AI generates it for you.</p>
                <textarea value={sfxDesc} onChange={e => setSfxDesc(e.target.value)} rows={3}
                  placeholder="e.g. Happy children laughing and playing, gentle bells ringing, magical sparkle sound..."
                  style={{ width: "100%", background: "#0a0d14", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical" as const, marginBottom: 8 }} />
                <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: (sfxGenerating || !sfxDesc.trim()) ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: (sfxGenerating || !sfxDesc.trim()) ? "not-allowed" : "pointer" }}>
                  {sfxGenerating ? "Generating sound..." : "Generate Sound Effect"}
                </button>
                {sfxGeneratedUrl && (
                  <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: `${childAccent}10`, border: `1px solid ${childAccent}25` }}>
                    <p style={{ fontSize: 11, color: childAccent, fontWeight: 600, marginBottom: 6 }}>Generated Sound Effect</p>
                    <audio src={sfxGeneratedUrl} controls style={{ width: "100%", height: 32 }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Read-Along Settings (visible only in read_along mode) ── */}
          {learningMode === "read_along" && (
            <div style={{ marginBottom: 20, padding: 18, borderRadius: 14, border: `2px solid ${childAccent}40`, background: `${childAccent}06` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 14 }}>Read-Along Settings</p>

              <div style={{ marginBottom: 14 }}>
                <p style={labelStyle}>Read-Along Text</p>
                <textarea value={readAlongText} onChange={e => { setReadAlongText(e.target.value); setLastAction("Read-along text updated"); }} rows={4}
                  placeholder="Paste the text you want children to read along with narration..."
                  style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={labelStyle}>Highlight Mode</p>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["word", "sentence", "line", "karaoke"] as const).map(hm => (
                    <button key={hm} onClick={() => { setHighlightMode(hm); setLastAction(`Highlight: ${hm}`); }}
                      style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${highlightMode === hm ? childAccent : border}`, background: highlightMode === hm ? `${childAccent}12` : "transparent", color: highlightMode === hm ? childAccent : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                      {hm}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={labelStyle}>Read Speed</p>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["slow", "normal", "fast"] as const).map(spd => (
                    <button key={spd} onClick={() => { setReadSpeed(spd); setLastAction(`Speed: ${spd}`); }}
                      style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${readSpeed === spd ? childAccent : border}`, background: readSpeed === spd ? `${childAccent}12` : "transparent", color: readSpeed === spd ? childAccent : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                      {spd}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <p style={labelStyle}>Font Size: {fontSize}px</p>
                  <input type="range" min={24} max={48} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                    style={{ width: "100%", accentColor: childAccent }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 8, color: muted }}>24px</span>
                    <span style={{ fontSize: 8, color: muted }}>48px</span>
                  </div>
                </div>
                <div>
                  <p style={labelStyle}>Highlight Color</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="color" value={highlightColor} onChange={e => setHighlightColor(e.target.value)}
                      style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", padding: 2 }} />
                    <span style={{ fontSize: 11, color: "#fff", fontFamily: "monospace" }}>{highlightColor}</span>
                  </div>
                </div>
              </div>

              {/* Static text preview */}
              {readAlongText && (() => {
                const previewWords = readAlongText.split(/\s+/);
                return (
                  <div>
                    <p style={labelStyle}>Preview</p>
                    <div style={{ background: s2, borderRadius: 10, padding: 16, border: `1px solid ${border}`, lineHeight: 1.6 }}>
                      {previewWords.slice(0, 20).map((word, i) => (
                        <span key={i}
                          style={{
                            fontSize,
                            fontWeight: 600,
                            color: i === 0 ? "#000" : "#fff",
                            background: i === 0 ? highlightColor : "transparent",
                            padding: i === 0 ? "2px 6px" : "2px 4px",
                            borderRadius: 4,
                            marginRight: 6,
                            display: "inline-block",
                          }}>
                          {word}
                        </span>
                      ))}
                      {previewWords.length > 20 && <span style={{ fontSize: 11, color: muted }}> …</span>}
                    </div>
                    <p style={{ fontSize: 9, color: muted, marginTop: 6 }}>First word shown highlighted as preview. Actual sync runs during video generation.</p>
                  </div>
                );
              })()}
            </div>
          )}

          <button onClick={() => { setPlanning(true); setLastAction("Plan generating..."); setTimeout(() => { setPlanning(false); setLastAction("Plan generated"); setActiveTab("review1"); }, 2000); }}
            disabled={planning || !textContent.trim()}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (planning || !textContent.trim()) ? "#2a2a40" : childAccent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: (planning || !textContent.trim()) ? "not-allowed" : "pointer" }}>
            {planning ? "Child-Safe Planner analyzing..." : !textContent.trim() ? "Enter content first" : "Generate Plan \u2014 First Review"}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REVIEW 1 TAB — MANDATORY SAFETY CHECK                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "review1" && (
        <div style={{ ...cardStyle, padding: 28, border: `2px solid ${childSafe}40` }}>
          {/* Warning if not ready */}
          {(!textContent || styleProgress < 100) && (
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Content or style not yet configured</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>
                {!textContent ? "Go to Content Input to enter your text. " : ""}
                {styleProgress < 100 ? "Go to Style & Voice to configure all settings." : ""}
              </p>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Icon.Check style={{ width: 22, height: 22, color: childSafe, flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>First Review — Safety Check</h2>
              <p style={{ fontSize: 11, color: muted }}>Review the plan before AI generates visuals. This is mandatory for children content.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Content Interpretation", check: "Text matches intended learning goal" },
              { label: "Age Appropriateness", check: `Content suitable for ${ageParam || "target"} age group` },
              { label: "Narration Style", check: `${NARRATION_STYLES.find(n => n.id === narrationStyle)?.label} selected` },
              { label: "Visual Plan", check: `${VISUAL_STYLES.find(v => v.id === visualStyle)?.label} — child-safe colors` },
              { label: "Word Difficulty", check: "Words match selected age level" },
              { label: "Music Suitability", check: `${MUSIC_CHOICES.find(m => m.id === musicChoice)?.label} — narration priority` },
            ].map(item => (
              <div key={item.label} style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{item.label}</p>
                </div>
                <p style={{ fontSize: 10, color: childSafe }}>{item.check}</p>
              </div>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 16 }}>
            <input type="checkbox" checked={review1Done} onChange={e => { setReview1Done(e.target.checked); if (e.target.checked) setLastAction("Review 1 approved"); }} style={{ marginTop: 3, accentColor: childSafe }} />
            <span style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6 }}>
              I have reviewed the plan above. The content type, age group, narration style, visual style, and music choice are appropriate for children. I approve generating the preview.
            </span>
          </label>

          <button onClick={generateChildrenContent}
            disabled={!review1Done || generating}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (!review1Done || generating) ? "#2a2a40" : childSafe, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!review1Done || generating) ? "not-allowed" : "pointer" }}>
            {generating ? (generationProgress || "Generating child-safe preview...") : "Approved — Generate Preview"}
          </button>
          {generationError && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{generationError}</p>}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW TAB                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "preview" && (
        <div style={{ ...cardStyle, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Preview Generated</h2>

          {!generatedVideoUrl && !generating ? (
            <div style={{ background: s2, borderRadius: 14, padding: 40, textAlign: "center", border: `1px solid ${border}`, marginBottom: 16 }}>
              <Icon.Film style={{ width: 28, height: 28, color: muted, marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Preview not yet generated</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Complete the Safety Review first and click &quot;Generate Preview&quot;</p>
              <button onClick={() => setActiveTab("review1")} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Go to Review 1
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: muted, marginBottom: 16 }}>Review the generated preview carefully. Check visuals, narration, text highlighting, and overall child-safety before final approval.</p>

              <div style={{ background: s2, borderRadius: 14, overflow: "hidden", marginBottom: 16, border: `1px solid ${border}` }}>
                {generatedVideoUrl ? (
                  <video src={generatedVideoUrl} controls autoPlay style={{ width: "100%", maxHeight: 400 }} />
                ) : (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <Icon.Film style={{ width: 28, height: 28, color: muted, marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                      {generating ? (generationProgress || "Generating...") : "Preview not yet generated"}
                    </p>
                  </div>
                )}
              </div>

              {musicFallbackReason && (
                <div style={{ fontSize: 10, color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                  Mubert not configured — using stock library for tracks &gt;47s. Set MUBERT_PAT to enable.
                </div>
              )}
              {generatedMusicUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: s2, border: `1px solid ${border}`, marginBottom: 12 }}>
                  <Icon.Music style={{ width: 14, height: 14, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>Background music generated</p>
                  <audio src={generatedMusicUrl} controls style={{ height: 28 }} />
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setReview1Done(false); setGeneratedVideoUrl(""); setGeneratedMusicUrl(""); setLastAction("Regenerating preview"); setActiveTab("review1"); }}
                  style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
                  Regenerate
                </button>
                <button onClick={() => { setLastAction("Proceeding to final review"); setActiveTab("review2"); }}
                  style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: childAccent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                  Proceed to Final Review
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REVIEW 2 TAB — MANDATORY FINAL SAFETY CHECK                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "review2" && (
        <div style={{ ...cardStyle, padding: 28, border: `2px solid ${childSafe}40` }}>
          {/* ── Saved Story Cuts ── */}
          {savedCuts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowCutsPanel(p => !p)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${childSafe}30`, background: showCutsPanel ? `${childSafe}10` : `${childSafe}06`, color: childSafe, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Icon.Folder style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>Saved Story Versions ({savedCuts.length})</span>
                <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap", flex: 1 }}>
                  {savedCuts.map(c => <span key={c.name} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${childSafe}20`, color: childSafe }}>{c.name}</span>)}
                </div>
                <span style={{ fontSize: 10, color: muted }}>{showCutsPanel ? "▲ Close" : "▼ Open"}</span>
              </button>
              {showCutsPanel && (
                <div style={{ background: surface, border: `1px solid ${childSafe}25`, borderRadius: 12, padding: 12, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {savedCuts.map((c, ci) => (
                    <div key={c.name}
                      onClick={() => { setAssemblyName(c.name); if (c.videoUrl) setGeneratedVideoUrl(c.videoUrl); setShowCutsPanel(false); setLastAction(`Loaded version: "${c.name}"`); }}
                      style={{ background: s2, borderRadius: 10, border: `2px solid ${assemblyName === c.name ? childSafe : border}`, padding: 10, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {c.videoUrl ? <Icon.Film style={{ width: 13, height: 13, flexShrink: 0 }} /> : <Icon.Grid style={{ width: 13, height: 13, flexShrink: 0 }} />}
                        <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? childSafe : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => prev.filter((_, i) => i !== ci)); }}
                          style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: "#ef4444", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center" }}><Icon.X style={{ width: 10, height: 10 }} /></button>
                      </div>
                      <p style={{ fontSize: 9, color: muted }}>{new Date(c.savedAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Scene Video Generation (when scenes are planned) ── */}
          {childScenes.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: `${childAccent}30` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Icon.Film style={{ width: 14, height: 14 }} /> Scene Videos</p>
              <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Generate video for each scene, then assemble into the final children story video.</p>

              {/* Scene selection */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 10 }}>
                <button onClick={() => setAssemblySelectedIds(childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}`))}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${childSafe}`, background: "transparent", color: childSafe, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Select All</button>
                <button onClick={() => setAssemblySelectedIds([])}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>Deselect All</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 12 }}>
                {childScenes.map(s => {
                  const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
                  const isSelected = assemblySelectedIds.includes(sceneId);
                  const videoUrl = sceneVideos[sceneId];
                  const isGenerating = generatingSceneVideos.has(sceneId);
                  const progress = sceneGenProgress[sceneId];
                  return (
                    <div key={s.scene} style={{ background: s2, borderRadius: 10, border: `1px solid ${isSelected ? childAccent : border}`, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <input type="checkbox" checked={isSelected} onChange={e => setAssemblySelectedIds(prev => e.target.checked ? [...prev, sceneId] : prev.filter(id => id !== sceneId))}
                          style={{ marginTop: 4, accentColor: childAccent, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: childAccent }}>SC{String(s.scene).padStart(2, "0")}</span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {videoUrl && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${childSafe}15`, color: childSafe, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}><Icon.Check style={{ width: 8, height: 8 }} /> Video</span>}
                              <button onClick={() => makeSceneVideo(s)} disabled={isGenerating}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: isGenerating ? "#2a2a40" : videoUrl ? `${childSafe}20` : childAccent, color: isGenerating ? muted : videoUrl ? childSafe : "#000", fontSize: 9, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer" }}>
                                {isGenerating ? "..." : videoUrl ? "Regen" : "Make Video"}
                              </button>
                            </div>
                          </div>
                          <p style={{ fontSize: 11, color: "#fff", marginBottom: 2 }}>{s.title}</p>
                          <p style={{ fontSize: 9, color: muted }}>{s.visualDescription.substring(0, 80)}{s.visualDescription.length > 80 ? "..." : ""}</p>
                          {progress && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ height: 4, borderRadius: 2, background: border }}>
                                <div style={{ width: `${progress.percent}%`, height: "100%", borderRadius: 2, background: childAccent, transition: "width 0.3s" }} />
                              </div>
                              <p style={{ fontSize: 9, color: childAccent, marginTop: 3 }}>{progress.message}</p>
                            </div>
                          )}
                          {videoUrl && <video src={videoUrl} controls style={{ width: "100%", maxHeight: 100, marginTop: 6, borderRadius: 6 }} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Assemble button */}
              <button onClick={assembleMovie} disabled={assembling || assemblySelectedIds.length === 0}
                style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: (assembling || assemblySelectedIds.length === 0) ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: (assembling || assemblySelectedIds.length === 0) ? "not-allowed" : "pointer", marginBottom: 8 }}>
                {assembling ? "Assembling story..." : assemblyComplete ? "Story Assembled" : `Assemble ${assemblySelectedIds.length} Scene${assemblySelectedIds.length !== 1 ? "s" : ""} into Story`}
              </button>
              {assembledUrl && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: `${childSafe}08`, border: `1px solid ${childSafe}25`, marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: childSafe, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon.Check style={{ width: 11, height: 11 }} /> Story assembled</p>
                  <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 200, borderRadius: 8 }} />
                </div>
              )}
            </div>
          )}

          {/* ── Story Version Name + Save ── */}
          <div style={{ ...cardStyle, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Story Version Name</label>
                <input type="text" value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="Main Story, Bilingual Edit, Short Version..."
                  style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", fontWeight: 600 }} />
              </div>
              <button
                onClick={() => {
                  if (!assemblyName.trim()) return;
                  setSavedCuts(prev => {
                    const existing = prev.findIndex(c => c.name === assemblyName);
                    const cut = { name: assemblyName, sceneIds: [], videoUrl: generatedVideoUrl || undefined, savedAt: new Date().toISOString() };
                    const next = existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
                    return next;
                  });
                  setLastAction(`Version "${assemblyName}" saved`);
                }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
                Save Version
              </button>
            </div>
          </div>

          {/* ── Pre-Flight AI Review ── */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: preflightResult ? (preflightResult.blockingErrors > 0 ? "#ef444440" : preflightResult.warnings > 0 ? "#f59e0b40" : `${childSafe}40`) : `${childAccent}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon.Star style={{ width: 15, height: 15, color: childAccent, flexShrink: 0 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI Audio & Audit</p>
              </div>
              {preflightResult && (
                <div style={{ display: "flex", gap: 6 }}>
                  {preflightResult.blockingErrors > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "#ef444420", color: "#ef4444", fontWeight: 700 }}>{preflightResult.blockingErrors} error{preflightResult.blockingErrors !== 1 ? "s" : ""}</span>}
                  {preflightResult.warnings > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "#f59e0b20", color: "#f59e0b", fontWeight: 700 }}>{preflightResult.warnings} warning{preflightResult.warnings !== 1 ? "s" : ""}</span>}
                  {preflightResult.canAssemble && preflightResult.warnings === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${childSafe}20`, color: childSafe, fontWeight: 700 }}>Ready</span>}
                </div>
              )}
            </div>
            <button onClick={runPreflight} disabled={preflightRunning}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${childAccent}30`, background: preflightRunning ? "#2a2040" : `${childAccent}10`, color: childAccent, fontSize: 11, fontWeight: 600, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0 }}>
              {preflightRunning ? "AI Audio & Audit running..." : "AI Audio & Audit"}
            </button>
            {preflightResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {preflightResult.checks.map(check => (
                  <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: check.status === "ok" ? `${childSafe}08` : check.status === "warn" ? "#f59e0b08" : "#ef444408", border: `1px solid ${check.status === "ok" ? childSafe : check.status === "warn" ? "#f59e0b" : "#ef4444"}20` }}>
                    <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}</span>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: check.status === "ok" ? childSafe : check.status === "warn" ? "#f59e0b" : "#ef4444" }}>{check.label}</p>
                      {check.detail && <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{check.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning if preview not generated */}
          {!generatedVideoUrl && (
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Preview not yet generated</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>You need to generate a preview before completing the final review.</p>
              <button onClick={() => setActiveTab("review1")} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                Go to Review 1
              </button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Icon.Check style={{ width: 22, height: 22, color: childSafe, flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>Second Review — Final Safety Check</h2>
              <p style={{ fontSize: 11, color: muted }}>This is the FINAL check before content can be exported or published. Both reviews are mandatory for children content.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Visuals are child-safe", check: "No inappropriate imagery, characters look child-friendly" },
              { label: "Narration is clear", check: "Pronunciation is clear, pace is appropriate for children" },
              { label: "Text highlighting syncs", check: "Highlighted words match spoken words exactly" },
              { label: "Music is appropriate", check: "Music supports learning, doesn't overpower voice" },
              { label: "No unsafe AI mistakes", check: "No strange objects, no adult styling, no confusing elements" },
              { label: "Background is clean", check: "Simple, uncluttered, child-appropriate scenes" },
            ].map(item => (
              <div key={item.label} style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{item.label}</p>
                <p style={{ fontSize: 10, color: muted }}>{item.check}</p>
              </div>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 16 }}>
            <input type="checkbox" checked={review2Done} onChange={e => { setReview2Done(e.target.checked); if (e.target.checked) setLastAction("Review 2 approved"); }} style={{ marginTop: 3, accentColor: childSafe }} />
            <span style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6 }}>
              I have watched the preview in full. I confirm that the visuals, narration, text, and music are all appropriate for children. I approve this content for final rendering and export.
            </span>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveTab("preview")} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Back to Preview</button>
            <button disabled={!review2Done || saving || !!finalVideoUrl}
              onClick={handleFinalRender}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (!review2Done || saving || !!finalVideoUrl) ? "#2a2a40" : childSafe, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!review2Done || saving || !!finalVideoUrl) ? "not-allowed" : "pointer" }}>
              {saving ? "Saving to Library..." : finalVideoUrl ? "Saved to Asset Library" : "Both Reviews Passed — Render Final Video"}
            </button>
          </div>
          {saveError && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{saveError}</p>}

          {/* Export options — shown after save */}
          {finalVideoUrl && (
            <div style={{ marginTop: 16, padding: 20, borderRadius: 14, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: childSafe, marginBottom: 12 }}>Content saved to Asset Library</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={finalVideoUrl} download style={{ textDecoration: "none" }}>
                  <button style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Download Video
                  </button>
                </a>
                <a href="/dashboard/asset-library" style={{ textDecoration: "none" }}>
                  <button style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${childSafe}`, background: "transparent", color: childSafe, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    View in Asset Library
                  </button>
                </a>
                <a href={`/dashboard/collaborative-editor?videoUrl=${encodeURIComponent(finalVideoUrl)}&from=children-planner`}
                  onClick={() => { /* return state handled via URL params */ }}
                  style={{ textDecoration: "none" }}>
                  <button style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    Open in Editor
                  </button>
                </a>
                <a href="/dashboard/all-content" style={{ textDecoration: "none" }}>
                  <button style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                    All Content
                  </button>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SOUND TAB — SC: 5-tier model selector, parse script, narration     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sound" && (
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
                <button key={tier.id} onClick={() => { setSoundTier(tier.id); setModelSettings(p => ({ ...p, soundModel: tier.id })); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, border: `2px solid ${soundTier === tier.id ? childAccent : ds.color.line}`, background: soundTier === tier.id ? `${childAccent}12` : "transparent", cursor: "pointer", textAlign: "left" as const }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: soundTier === tier.id ? childAccent : "#fff" }}>{tier.label}</span>
                  <span style={{ fontSize: 10, color: soundTier === tier.id ? childAccent : muted, fontFamily: ds.font.mono }}>{tier.cost}</span>
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#fff", fontWeight: 600, minWidth: 60 }}>Layer 1</span>
              <select value={narrationProvider} onChange={e => setNarrationProvider(e.target.value as typeof narrationProvider)}
                style={{ flex: 1, background: ds.color.paper, border: `1px solid ${ds.color.line}`, borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                <option value="piper">Piper (free local)</option>
                <option value="fal-narrator">FAL Narrator (cloud)</option>
                <option value="elevenlabs">ElevenLabs (premium)</option>
                <option value="karaoke">Karaoke (browser)</option>
              </select>
            </div>
            {/* Narrator playback */}
            <button onClick={generateChildrenContent} disabled={generating}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: generating ? "#2a2040" : childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer" }}>
              {generating ? "Generating..." : "Play Narration Preview"}
            </button>
          </div>

          {/* ── Character Voices ── */}
          {savedChars.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Character Voices</p>
              {savedChars.filter(c => selectedCharIds.includes(c.id)).map(char => (
                <div key={char.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${ds.color.line}` }}>
                  {char.imageUrl && <img src={char.imageUrl} alt={char.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", minWidth: 80 }}>{char.name}</span>
                  <select style={{ flex: 1, background: ds.color.paper, border: `1px solid ${ds.color.line}`, borderRadius: 8, padding: "5px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
                    <option value="en_US-lessac-medium">Lessac (Neutral)</option>
                    <option value="en_US-amy-medium">Amy (Female)</option>
                    <option value="en_US-ryan-high">Ryan (Male)</option>
                    <option value="en_GB-alan-medium">Alan (British)</option>
                  </select>
                </div>
              ))}
              {savedChars.filter(c => selectedCharIds.includes(c.id)).length === 0 && (
                <p style={{ fontSize: 11, color: muted }}>No characters selected. Go to Character Friends tab to add them to this video.</p>
              )}
            </div>
          )}

          {/* ── Music ── */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Background Music</p>
            <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Generate child-safe background music for this story.</p>
            <button onClick={generateChildrenContent} disabled={generating}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: generating ? "#2a2040" : C4, color: "#000", fontSize: 12, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer" }}>
              {generating ? "Generating..." : "Generate Background Music"}
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
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCRIPT & STORY PLAN TAB                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "script" && (
        <div>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Script & Story Plan</h2>
            <p style={{ fontSize: 11, color: muted, marginBottom: 18 }}>
              Parse your story into narrator lines and character parts. Edit the segments, then move on to Voices & Sounds.
            </p>

            {!textContent && (
              <div style={{ padding: "20px 24px", borderRadius: 12, background: `${childAccent}08`, border: `1px solid ${childAccent}30`, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: childAccent, fontWeight: 600, marginBottom: 8 }}>Write your content first</p>
                <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Go to the Content tab and write your story before building the script.</p>
                <button onClick={() => setActiveTab("content")}
                  style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Go to Content
                </button>
              </div>
            )}

            {textContent && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 12, color: muted }}>
                    {scriptSegments.length > 0
                      ? `${scriptSegments.filter(s => s.type === "narration").length} narrator + ${scriptSegments.filter(s => s.type === "dialogue").length} character lines`
                      : "Ready to parse your story into script segments"}
                  </p>
                  <button
                    onClick={parseScript}
                    disabled={parsingScript}
                    style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: parsingScript ? "#2a2040" : childAccent, color: parsingScript ? muted : "#000", fontSize: 12, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
                    {parsingScript ? "Parsing..." : scriptSegments.length > 0 ? "Re-Parse Script" : "Parse Story into Script"}
                  </button>
                </div>

                {scriptSegments.length > 0 && (
                  <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 14 }}>
                    {scriptSegments.map((seg, i) => (
                      <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: seg.type === "narration" ? `${ds.color.sky}09` : `${C2}09`, border: `1px solid ${seg.type === "narration" ? ds.color.sky : C2}20`, display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: seg.type === "narration" ? ds.color.sky : C2, minWidth: 56, alignSelf: "flex-start", paddingTop: 4 }}>{seg.type === "narration" ? "NARRATOR" : seg.speaker?.toUpperCase() || "CHARACTER"}</span>
                        <textarea
                          value={seg.text}
                          onChange={e => setScriptSegments(prev => prev.map((s, j) => j === i ? { ...s, text: e.target.value } : s))}
                          rows={2}
                          style={{ flex: 1, background: "transparent", border: "none", color: "#ccc", fontSize: 10, lineHeight: 1.4, resize: "vertical", outline: "none" }}
                        />
                        <button
                          onClick={() => setScriptSegments(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: "transparent", border: "none", color: muted, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {scriptSegments.length > 0 && (
                  <div style={{ display: "flex", gap: 10, paddingTop: 10, borderTop: `1px solid ${ds.color.line}` }}>
                    <button
                      onClick={() => setActiveTab("sound")}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Go to Voices & Sounds
                    </button>
                  </div>
                )}

                {scriptSegments.length === 0 && (
                  <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: "20px 0" }}>
                    Click "Parse Story into Script" to begin.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCENE BOARD TAB — hybrid-style per-scene cards, children-adapted    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sceneBoard" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Scene Board</h2>
            <span style={{ fontSize: 11, color: muted }}>{childScenes.length} scene{childScenes.length !== 1 ? "s" : ""}</span>
          </div>

          {/* ── CONTINUOUS MOTION TOGGLE ──────────────────────────────────── */}
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: continuousMotionEnabled ? `${childAccent}50` : border, background: continuousMotionEnabled ? `${childAccent}06` : undefined }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={continuousMotionEnabled}
                onChange={e => { setContinuousMotionEnabled(e.target.checked); setCmError(null); setCmStatus(null); setCmFinalVideoUrl(null); }}
                style={{ width: 16, height: 16, accentColor: childAccent }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: continuousMotionEnabled ? childAccent : "#fff" }}>
                Continuous Motion — chain scenes into one seamless action sequence
              </span>
            </label>
            {continuousMotionEnabled && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
                  AI will treat your scenes as one continuous action. Enable this when your story has unbroken physical action (chase, fall, fight, explosion chain).
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Total Duration (seconds)</label>
                    <input type="number" min={5} max={120} value={cmTotalDuration}
                      onChange={e => setCmTotalDuration(Math.max(5, Number(e.target.value)))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Segment Duration (sec, max 10)</label>
                    <input type="number" min={3} max={10} value={cmSegmentDuration}
                      onChange={e => setCmSegmentDuration(Math.min(10, Math.max(3, Number(e.target.value))))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Video Provider</label>
                    <select value={cmProvider} onChange={e => setCmProvider(e.target.value as "wan" | "kling_std")}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, outline: "none" }}>
                      <option value="wan">Wan 2.5</option>
                      <option value="kling_std">Kling Standard</option>
                    </select>
                  </div>
                </div>
                {cmError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{cmError}</p>}
                {cmStatus && cmStatus !== "DONE" && (
                  <p style={{ fontSize: 11, color: childAccent, marginBottom: 10 }}>Status: {cmStatus}{cmRunning && " — polling every 3s..."}</p>
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
                  style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: cmRunning ? "#2a2040" : childAccent, color: "#000", fontSize: 13, fontWeight: 700, cursor: cmRunning ? "not-allowed" : "pointer" }}>
                  {cmRunning ? `Generating… (${cmStatus ?? "starting"})` : "Generate Continuous Motion"}
                </button>
              </div>
            )}
          </div>

          {/* Primary action: Generate from story */}
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${childAccent}40`, background: `${childAccent}06` }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 6 }}>Generate Scenes from Story</p>
            <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>AI reads your story and plans {`per-scene cards with descriptions. Each scene gets its own image.`}</p>
            <button
              onClick={generateScenesFromStory}
              disabled={generatingScenesFromStory || (!textContent.trim() && !readAlongText.trim())}
              title={(!textContent.trim() && !readAlongText.trim()) ? "Add story content first" : ""}
              style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: generatingScenesFromStory ? "#2a2040" : (!textContent.trim() && !readAlongText.trim()) ? "#1a1a2a" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: (!textContent.trim() && !readAlongText.trim()) ? muted : "#fff", fontSize: 13, fontWeight: 700, cursor: (generatingScenesFromStory || (!textContent.trim() && !readAlongText.trim())) ? "not-allowed" : "pointer" }}>
              {generatingScenesFromStory ? "Planning scenes..." : childScenes.length > 0 ? "Regenerate Scenes from Story" : "Generate Scenes from Story"}
            </button>
            {!textContent.trim() && !readAlongText.trim() && (
              <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Add your story in the Content tab first.</p>
            )}
          </div>

          {/* Scene cards */}
          {childScenes.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <Icon.Grid style={{ width: 32, height: 32, color: muted, margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: 13, color: muted }}>No scenes yet. Click Generate Scenes from Story above.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {childScenes.map(scene => {
                const sceneId = `child_sc${String(scene.scene).padStart(2, "0")}`;
                const sceneImg = sceneImages[sceneId] || scene.imageUrl;
                const isGenImg = generatingSceneImage === sceneId;
                const isGenVar = generatingVariations.has(sceneId);
                const assignedChars = sceneCharAssignments[sceneId] || scene.characters || [];
                return (
                  <div key={scene.scene} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                    {/* Image area */}
                    <div style={{ height: 140, background: s2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sceneImg ? (
                        <img src={sceneImg} alt={scene.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Icon.Image style={{ width: 32, height: 32, color: muted, opacity: 0.3 }} />
                      )}
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "3px 8px" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: childAccent }}>{sceneId.toUpperCase()}</span>
                      </div>
                      <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
                        <button
                          onClick={() => generateSceneBoardImageVariations(scene)}
                          disabled={isGenImg || isGenVar}
                          title="Generate 3 variations"
                          style={{ padding: "5px 9px", borderRadius: 7, border: "none", background: isGenVar ? "#2a2040" : "#7c3aed30", color: isGenVar ? muted : "#a78bfa", fontSize: 9, fontWeight: 700, cursor: isGenImg || isGenVar ? "not-allowed" : "pointer" }}>
                          {isGenVar ? "Gen…" : "Gen 3"}
                        </button>
                        <button
                          onClick={() => generateSceneBoardImage(scene)}
                          disabled={isGenImg || isGenVar}
                          style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: isGenImg ? "#2a2040" : sceneImg ? `${childAccent}20` : childAccent, color: isGenImg ? muted : sceneImg ? childAccent : "#000", fontSize: 9, fontWeight: 700, cursor: isGenImg || isGenVar ? "not-allowed" : "pointer" }}>
                          {isGenImg ? "Generating..." : sceneImg ? "Regen" : "Generate"}
                        </button>
                      </div>
                    </div>
                    {/* Variation thumbnails */}
                    {scene.variantUrls && scene.variantUrls.length > 1 && (
                      <div style={{ display: "flex", gap: 4, padding: "6px 8px", background: s2, borderTop: `1px solid ${border}` }}>
                        {scene.variantUrls.map((url, vi) => (
                          <button
                            key={vi}
                            onClick={() => {
                              setSceneImages(prev => ({ ...prev, [sceneId]: url }));
                              setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, imageUrl: url } : s));
                            }}
                            title={`Use variation ${vi + 1}`}
                            style={{ padding: 0, border: `2px solid ${url === sceneImg ? childAccent : "transparent"}`, borderRadius: 5, overflow: "hidden", cursor: "pointer", background: "none", flexShrink: 0 }}>
                            <img src={url} alt={`Var ${vi + 1}`} style={{ width: 44, height: 44, objectFit: "cover", display: "block" }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Content area */}
                    <div style={{ padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{scene.title}</p>
                      <textarea
                        value={scene.visualDescription}
                        onChange={e => setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, visualDescription: e.target.value } : s))}
                        onBlur={() => {
                          // SE: auto-save scene text to DB on blur
                          fetch("/api/hybrid/scene-plan", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              projectId: `children_${contentParam || "story"}_${topicParam || "default"}`,
                              title: `Children Story — ${contentParam || "story"}`,
                              scenes: childScenes.map(cs => ({
                                sceneId: cs.scene, description: cs.visualDescription,
                                title: cs.title,
                              })),
                            }),
                          }).catch(() => null);
                        }}
                        style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#ccc", fontSize: 10, outline: "none", resize: "vertical", minHeight: 56, marginBottom: 8 }}
                        placeholder="Scene description (editable)..."
                      />
                      {/* Polish button */}
                      <button
                        onClick={() => handlePolishScene(sceneId, scene.visualDescription, "polish")}
                        disabled={polishingScene === sceneId}
                        data-testid={`polish-btn-${sceneId}`}
                        style={{ marginBottom: 8, padding: "5px 12px", borderRadius: 7, border: `1px solid #a855f750`, background: polishingScene === sceneId ? "#a855f708" : "transparent", color: polishingScene === sceneId ? muted : "#a855f7", fontSize: 9, fontWeight: 600, cursor: polishingScene === sceneId ? "not-allowed" : "pointer" }}>
                        {polishingScene === sceneId ? "Polishing..." : "Polish"}
                      </button>
                      {/* Character assignment */}
                      {savedChars.length > 0 && (
                        <div>
                          <p style={{ fontSize: 9, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Characters in scene</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {savedChars.map(c => {
                              const inScene = assignedChars.includes(c.id);
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setSceneCharAssignments(prev => {
                                    const cur = prev[sceneId] || [];
                                    const next = inScene ? cur.filter(id => id !== c.id) : [...cur, c.id];
                                    return { ...prev, [sceneId]: next };
                                  })}
                                  style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${inScene ? childAccent : border}`, background: inScene ? `${childAccent}15` : "transparent", color: inScene ? childAccent : muted, fontSize: 9, cursor: "pointer", fontWeight: inScene ? 700 : 400 }}>
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
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
      {/* SCREENPLAY TAB                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "screenplay" && (
        <div>
          {!screenplay && !generatingScreenplay && (
            <div style={{ ...cardStyle, borderColor: `${childAccent}20`, marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Story Script</p>
              <p style={{ fontSize: 11, color: muted, marginBottom: 16 }}>Generate a formatted story script from your content, or paste your own and parse it into narrator/dialogue segments for audio generation.</p>
              {!textContent.trim() && !expandedContent.trim() ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Enter your story content first — go to the Content tab.</p>
                  <button onClick={() => setActiveTab("content")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: childAccent, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Content</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>Written by:</span>
                    <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Author name"
                      style={{ flex: 1, background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", maxWidth: 280 }} />
                  </div>
                  {screenplayError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{screenplayError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={generateScreenplay}
                      style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Generate Story Script
                    </button>
                    <button onClick={() => setScreenplay("FADE IN:\n\nINT. SCENE ONE - DAY\n\nPaste your story script here...\n\nFADE OUT.\n\nTHE END")}
                      style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                      Paste My Own
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {generatingScreenplay && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Writing your story script...</p>
              <p style={{ fontSize: 11, color: muted }}>15–30 seconds</p>
            </div>
          )}

          {screenplay && !generatingScreenplay && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
                  <span style={{ fontSize: 10, color: muted }}>Written by:</span>
                  <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Author name"
                    style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", width: 160 }} />
                </div>
                <button onClick={generateScreenplay}
                  style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: "transparent", color: childAccent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Regenerate
                </button>
                <button onClick={() => { const blob = new Blob([screenplay], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${contentParam || "story"}_script.txt`; a.click(); }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Download .txt
                </button>
                <button onClick={parseScript} disabled={parsingScript}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
                  {parsingScript ? "Parsing..." : "Parse Script"}
                </button>
                <button onClick={sendScreenplayToContent} disabled={sendingToScenes}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${childSafe}60` : childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes ? "default" : "pointer" }}>
                  {sendingToScenes ? "Sending..." : "Send to Narration →"}
                </button>
              </div>

              {sendToScenesResult && (
                <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${childAccent}10`, border: `1px solid ${childAccent}30`, display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon.Check style={{ width: 14, height: 14, color: childAccent, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: childAccent, flex: 1 }}>{sendToScenesResult}</p>
                  <button onClick={() => setActiveTab("style")} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Go to Style & Voice</button>
                </div>
              )}

              {showScriptReview && scriptSegments.length > 0 && (
                <div style={{ ...cardStyle, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Parsed Script — {scriptSegments.length} segments</p>
                    <button onClick={() => setShowScriptReview(false)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Hide</button>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {scriptSegments.map((seg, i) => (
                      <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: seg.type === "dialogue" ? "rgba(0,212,255,0.1)" : `${childAccent}10`, borderLeft: `3px solid ${seg.type === "dialogue" ? "#00d4ff" : childAccent}` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: seg.type === "dialogue" ? "#00d4ff" : childAccent, textTransform: "uppercase", marginRight: 8 }}>
                          {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "NARR"}
                        </span>
                        <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
                style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "'Courier New', Courier, monospace", minHeight: 400, lineHeight: 1.8, resize: "vertical" as const, whiteSpace: "pre-wrap" }} />

              <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
                <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
                  <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>GIO HOME AI STUDIO</p>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(contentParam || "CHILDREN STORY").toUpperCase()}</h1>
                  {(ageGroup) && <p style={{ fontSize: 11, color: "#777", marginBottom: 24, fontStyle: "italic" }}>For {AGE_AUDIENCE[ageGroup] || "children"}</p>}
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
                    return <p key={i} style={{ color: "#333", marginBottom: 2 }}>{line}</p>;
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ AID MODEL PICKER MODAL ═══ */}
      {showAidPicker && (() => {
        const AID_MODELS = AID_VIDEO_MODELS;
        const IMAGE_MODELS_AID = AID_IMAGE_MODELS;
        type StyleKey = "all"|"2d"|"3d"|"cartoon"|"realistic";
        const ADVISER: Record<StyleKey, { title:string; msg:string; cheapestId:string; bestId:string; bestLabel:string }> = {
          all:      { title:"All Models",             msg:"Showing all models sorted by price. MuAPI is 40–58% cheaper than FAL for the same quality tier.",                                                  cheapestId:"segmind_pruna_video",  bestId:"fal_kling_3_pro",        bestLabel:"Top Overall" },
          "2d":     { title:"2D / Illustration Style", msg:"Seedance 2.0 (MuAPI) is the best model for 2D flat animation — ideal for children cartoons and illustrated storybooks.",       cheapestId:"muapi_seedance_v1_pro", bestId:"muapi_seedance_v2_1080p", bestLabel:"Best 2D" },
          "3d":     { title:"3D / Cinematic Style",    msg:"Kling 2.5 Direct ★ is the best 3D model. Use for realistic-looking children scenes.",                                           cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_std",  bestLabel:"Best 3D Direct" },
          cartoon:  { title:"Cartoon / Animated",      msg:"Seedance 2.0 (MuAPI) at $0.08 is the best cartoon model — perfect for children storybooks. Hailuo Pro is best cartoon on FAL.", cheapestId:"muapi_seedance_v1_pro", bestId:"fal_hailuo_pro",          bestLabel:"Best Cartoon" },
          realistic:{ title:"Realistic / Photorealistic",msg:"Kling 2.5 Pro Direct ★ ($0.20) is the most realistic. Use sparingly for older children content.",                             cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_pro",  bestLabel:"Most Realistic" },
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
                  <div style={{ fontSize:9, color:"#a08aba", lineHeight:1.6 }}>Pruna P Image ($0.005) and Flux Schnell ($0.003) cheapest for drafts. Flux Pro ($0.05) for final quality. Ideogram v3 best for text/titles in storybooks.</div>
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MUSIC LIBRARY PICKER MODAL                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showMusicPicker && (
        <div onClick={() => setShowMusicPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Music Library — {musicLibrary.length} tracks</p>
              <button onClick={() => setShowMusicPicker(false)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              {musicLibrary.length === 0 ? (
                <p style={{ textAlign: "center", color: muted, padding: 40 }}>No music tracks found in library.</p>
              ) : musicLibrary.map(track => {
                const url = `/api/media/${track.filePath}`;
                const isSelected = selectedMusicUrl === url;
                return (
                  <div key={track.id} onClick={() => { setSelectedMusicUrl(url); setSelectedMusicName(track.name); setShowMusicPicker(false); setLastAction(`Music selected: ${track.name}`); }}
                    style={{ background: isSelected ? `${childAccent}15` : s2, borderRadius: 10, border: `1px solid ${isSelected ? childAccent : border}`, padding: "10px 14px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: isSelected ? childAccent : "#fff" }}>{track.name}</p>
                      {isSelected && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: `${childAccent}20`, color: childAccent, fontWeight: 700 }}>Selected</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {(track.tags || []).slice(0, 4).map(tag => <span key={tag} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${childAccent}10`, color: childAccent }}>{tag}</span>)}
                    </div>
                    {isSelected && <audio src={url} controls style={{ width: "100%", height: 24, marginTop: 6 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHAR PICKER MODAL                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showCharPicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: surface, borderRadius: 20, border: `1px solid ${border}`, width: "100%", maxWidth: 720, maxHeight: "85vh", overflow: "auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Import Characters</p>
              <button onClick={() => setShowCharPicker(false)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 12 }}>
                Close
              </button>
            </div>
            <p style={{ fontSize: 10, color: muted, marginBottom: 16 }}>Click a character to add them to this video. Select multiple, then close.</p>
            <CharacterPicker
              onSelect={(char) => {
                setSavedChars(prev => {
                  const existingIds = new Set(prev.map(c => c.id));
                  if (existingIds.has(char.id)) return prev;
                  return [...prev, {
                    id: char.id,
                    name: char.name,
                    imageUrl: char.imageUrl || undefined,
                    characterId: char.characterId || undefined,
                    voiceName: char.voiceName || undefined,
                    visualDescription: char.visualDescription || undefined,
                  }];
                });
                setSelectedCharIds(prev => prev.includes(char.id) ? prev : [...prev, char.id]);
                setLastAction(`Added ${char.name}`);
              }}
            />
          </div>
        </div>
      )}

      {/* ── AI Supervisor Status Bar ─────────────────────────────────────────── */}
      <SupervisorStatusBar
        plannerType="children"
        designComplete={!!(ageGroup && visualStyle)}
        storyComplete={!!(expandedContent || textContent)}
        charactersComplete={savedChars.length > 0}
        soundComplete={!!(narrationStyle && musicChoice)}
        scenesComplete={childScenes.length > 0}
        assemblyComplete={!!assembledUrl}
        storyText={expandedContent || textContent}
        onAutoFix={(section) => {
          const tabMap: Record<string, WorkshopTab> = {
            design: "design",
            story: "content",
            characters: "characters",
            sound: "sound",
            scenes: "sceneBoard",
            assembly: "screenplay",
          };
          const target = tabMap[section] as WorkshopTab;
          if (target) setActiveTab(target);
        }}
      />
    </div>
  );
}
