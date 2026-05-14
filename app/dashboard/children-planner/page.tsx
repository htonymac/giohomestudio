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
import SubtitleStyler, { type SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../../components/SubtitleStyler";
import { estimateTextDuration } from "@/lib/auto-timestamp";
import { AID_VIDEO_MODELS, AID_IMAGE_MODELS } from "@/lib/aid-model-registry";
import { SCENE_ENERGY_COLOR } from "@/lib/scene-constants";
import { splitIntoActionBeats } from "@/lib/scene/action-beats";
import { useProjectSettings } from "@/hooks/useProjectSettings";

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

// ── 5-Tier Sound Model Selector ──
const SOUND_TIERS = [
  { id: "piper",          label: "GHS Standard", desc: "Piper TTS — free, always available",      cost: "Free",    providerKey: "piper" },
  { id: "ghs_karaoke",    label: "GHS Pro",      desc: "GHS Karaoke built-in",                    cost: "Low",     providerKey: "karaoke" },
  { id: "fal_karaoke",    label: "GHS Karaoke",  desc: "FAL karaoke music generation",            cost: "Mid",     providerKey: "stable_audio" },
  { id: "kie_classic",    label: "GHS Classic",  desc: "Suno via Kie.ai — full lyrical songs",   cost: "Premium", providerKey: "kie" },
  { id: "kie_premium",    label: "GHS Premium",  desc: "Suno via Kie.ai — premium quality",      cost: "Highest", providerKey: "kie" },
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

// ── Full Character Identity (hybrid-style registry) ──
interface CharacterIdentity {
  characterId: string;
  dbId?: string;       // DB CUID from character-voices table — set when imported from registry
  displayName: string;
  roleType: string;
  gender: string;
  ageRange: string;
  skinTone: string;
  hairStyle: string;
  wardrobeStyle: string;
  speechStyle: string;
  accentType: string;
  emotionProfile: string;
  voiceId: string;
  language: string;
  tags: string[];
  imageUrl?: string;
  hasVoice?: boolean;
  hasImage?: boolean;
  voiceType?: string;
  intonation?: string;
  species?: string;
  bodyBuild?: string;
  colorDescription?: string;
  faceFeatures?: string;
  clothingDetails?: string;
  accessories?: string;
  distinctiveFeatures?: string;
  ageAppearance?: string;
  imageLocked?: boolean;
  visualDescription?: string;
}

// ── normalizeImageUrl ──
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/api/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
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
  const [projectTitle, setProjectTitle] = useState("Untitled Children Project");
  const [showProjects, setShowProjects] = useState(false);
  const [projectsList, setProjectsList] = useState<Array<{ id: string; title: string; style: string; lastModified: number; sceneCount: number; characterCount: number }>>([]);
  const [textContent, setTextContent] = useState(topicPromptParam || "");
  const [narrationStyle, setNarrationStyle] = useState("gentle");
  const [narrationProvider, setNarrationProvider] = useState<"piper" | "fal-narrator" | "elevenlabs" | "karaoke">("piper");
  const [autoSfx, setAutoSfx] = useState(true);
  const [musicChoice, setMusicChoice] = useState("soft_story");
  const [visualStyle, setVisualStyle] = useState("storybook");
  const [projectStyle, setProjectStyle] = useState("storybook"); // maps to STYLE_PRESETS in scene-image API
  // ── Per-scene style overrides — keyed by sceneId, falls back to projectStyle ──
  const [sceneStyles, setSceneStyles] = useState<Record<string, string>>({});
  const [narrationSpeed, setNarrationSpeed] = useState(0.75);
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>({});
  const [tone, setTone] = useState<"soft" | "active">("soft");
  const [review1Done, setReview1Done] = useState(false);
  const [review2Done, setReview2Done] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [narrationGenerating, setNarrationGenerating] = useState(false);
  const [musicGenerating, setMusicGenerating] = useState(false);
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
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [sceneDurations, setSceneDurations] = useState<Record<string, "short" | "medium" | "long">>({});
  const importFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const sceneTitleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Per-scene AI SFX + per-scene continuous motion ──────────────────────
  const [sceneContinuousMotion, setSceneContinuousMotion] = useState<Record<string, { enabled: boolean; targetSec: number }>>({});
  const [generatingSceneSfx, setGeneratingSceneSfx] = useState<Set<string>>(new Set());

  // ── Archived scenes (soft delete) ──
  const [archivedScenes, setArchivedScenes] = useState<ChildScene[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // ── Per-scene music ──
  const [generatingSceneMusic, setGeneratingSceneMusic] = useState<Set<string>>(new Set());
  const [sceneMusicUrls, setSceneMusicUrls] = useState<Record<string, string>>({});

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
  const [assemblyMediaPrefs, setAssemblyMediaPrefs] = useState<Record<string, "image" | "video">>({});
  // ── Gen Max — per-scene action-beat images (mirrors hybrid-planner) ──
  // sceneBeatImages[sceneId] = list of beat image URLs (one per action beat).
  // selectedBeatImages[sceneId] = parallel boolean array — true = include this beat in assembly.
  // Default: every beat included. User unticks to skip.
  const [sceneBeatImages, setSceneBeatImages] = useState<Record<string, string[]>>({});
  const [selectedBeatImages, setSelectedBeatImages] = useState<Record<string, boolean[]>>({});
  const [generatingMaxBeats, setGeneratingMaxBeats] = useState<Set<string>>(new Set());
  const [maxBeatsProgress, setMaxBeatsProgress] = useState<Record<string, string>>({});
  // sceneMaxTarget — per-scene custom image count for Gen Max (default 4, range 1-30).
  // User overrides via the small number input next to the Gen Max button.
  const [sceneMaxTarget, setSceneMaxTarget] = useState<Record<string, number>>({});
  // useMaxImageScenes — set of sceneIds where the user opted-in to "Use Max Image" in Assembly.
  // OFF (default): scene contributes ONE image to the assembled video (scene.imageUrl).
  // ON: scene expands into N segments — one per ticked beat in selectedBeatImages.
  // Per-scene toggle so the user can mix: some scenes 1 image, some scenes multi-beat.
  const [useMaxImageScenes, setUseMaxImageScenes] = useState<Set<string>>(new Set());
  const [aiSupervisorRunning, setAiSupervisorRunning] = useState(false);
  const [aiSupervisorReport, setAiSupervisorReport] = useState<{ ok: boolean; summary: string; issues: string[]; fixed: string[] } | null>(null);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({ ...DEFAULT_SUBTITLE_CONFIG, mode: "kids", highlightColor: "#34d399" });
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [outroUrl, setOutroUrl] = useState<string | null>(null);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [generatingOutro, setGeneratingOutro] = useState(false);
  const [writtenBy, setWrittenBy] = useState("");
  const [madeBy, setMadeBy] = useState("");
  const [ideaFrom, setIdeaFrom] = useState("");
  const [subtitleMatchResult, setSubtitleMatchResult] = useState<{ status: "ok"|"warn"|"checking"; note: string } | null>(null);

  // ── Sound tier & model settings ──
  const [soundTier, setSoundTier] = useState<SoundTierId>("piper");
  const [musicTier, setMusicTier] = useState<"stock" | "ghs_pro" | "ghs_classic">("stock");
  const [modelSettings, setModelSettings] = useState({
    storyLLM: "claude-haiku-4-5",
    charImageModel: "fal_flux_schnell",
    sceneVideoModel: "fal_wan_lite",
    soundModel: "piper" as SoundTierId,
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
  const [narratorAudioUrl, setNarratorAudioUrl] = useState<string | null>(null);
  const [previewScene, setPreviewScene] = useState<{ url: string; type: "image" | "video"; title: string } | null>(null);

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

  // Character Registry (full hybrid-style)
  const [characters, setCharacters] = useState<CharacterIdentity[]>([]);
  const [visionProvider, setVisionProvider] = useState<"auto" | "ollama" | "claude" | "gpt">("auto");
  const [buildingAllChars, setBuildingAllChars] = useState(false);
  const [buildAllProgress, setBuildAllProgress] = useState<string | null>(null);
  const [charTabName, setCharTabName] = useState("");
  const [charTabCreating, setCharTabCreating] = useState(false);
  const [batchPortraitProgress, setBatchPortraitProgress] = useState<string | null>(null);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [generatingPortrait, setGeneratingPortrait] = useState<string | null>(null);
  const [analyzingCharacter, setAnalyzingCharacter] = useState<string | null>(null);
  const [savingCharacter, setSavingCharacter] = useState<string | null>(null);
  // ── Per-character portrait model selector ────────────────────────────────
  const [charPortraitModel, setCharPortraitModel] = useState<Record<string, string>>({});
  const [savedCharacter, setSavedCharacter] = useState<string | null>(null);
  const [imagePickerForCharId, setImagePickerForCharId] = useState<string | null>(null);
  const [imagePickerAssets, setImagePickerAssets] = useState<Array<{ id: string; name: string; fileUrl?: string; filePath?: string; source?: string }>>([]);
  const [imagePickerLoading, setImagePickerLoading] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [inlinePreview, setInlinePreview] = useState<CharacterIdentity | null>(null);
  const [importingFromPhoto, setImportingFromPhoto] = useState(false);
  const [photoImportLog, setPhotoImportLog] = useState("");
  const [photoImportName, setPhotoImportName] = useState("");
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

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
            visualStyle: effectiveProjectStyle,
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
                artStyle: effectiveProjectStyle || "storybook",
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

  // ── Character Registry functions ──

  function buildVisualDescription(char: CharacterIdentity): string {
    const parts: string[] = [];
    if (char.species) parts.push(char.species);
    if (char.bodyBuild) parts.push(char.bodyBuild);
    if (char.ageAppearance) parts.push(char.ageAppearance);
    if (char.colorDescription) parts.push(char.colorDescription);
    if (char.faceFeatures) parts.push(char.faceFeatures);
    if (char.clothingDetails) parts.push(`wearing: ${char.clothingDetails}`);
    if (char.accessories) parts.push(`accessories: ${char.accessories}`);
    if (char.distinctiveFeatures) parts.push(char.distinctiveFeatures);
    if (parts.length === 0) {
      if (char.skinTone) parts.push(char.skinTone);
      if (char.hairStyle) parts.push(char.hairStyle);
      if (char.wardrobeStyle) parts.push(char.wardrobeStyle);
      if (char.gender) parts.push(char.gender);
      if (char.ageRange) parts.push(char.ageRange);
    }
    return parts.join(", ");
  }

  async function buildAllStoryCharacters() {
    const storyRichText = expandedContent || textContent || readAlongText || "";
    if (!storyRichText.trim()) { setUiError("Write or expand your story first."); return; }
    setBuildingAllChars(true);
    setBuildAllProgress("Detecting characters from story...");
    try {
      const detectRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expandedStory: { summary: storyRichText, characterList: [] }, language: "English" }),
      });
      const detectData = await detectRes.json();
      const detected: Array<{ name: string; description?: string }> = detectData.characters || detectData.names || [];
      if (detected.length === 0) { setUiError("No characters detected in story."); setBuildingAllChars(false); setBuildAllProgress(null); return; }
      const builtSoFar: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }> = [
        ...characters.filter(c => c.species && c.colorDescription).map(c => ({ name: c.displayName, species: c.species, gender: c.gender, colorDescription: c.colorDescription })),
      ];
      let built = 0;
      for (const det of detected) {
        const name = det.name || (det as unknown as string);
        if (!name) continue;
        const existingChar = characters.find(c => c.displayName.toLowerCase() === name.toLowerCase());
        if (existingChar && existingChar.species && existingChar.colorDescription) { built++; continue; }
        setBuildAllProgress(`Building ${name}... (${built + 1}/${detected.length})`);
        try {
          const res = await fetch("/api/hybrid/character-build", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              characterName: name,
              storyText: storyRichText,
              artStyle: effectiveProjectStyle || "storybook",
              language: "English",
              childSafe: true,
              ageGroup,
              existingCharacters: builtSoFar,
            }),
          });
          const data = await res.json();
          if (data.ok && data.character) {
            const c = data.character;
            const newId = `CC_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            const builtChar: CharacterIdentity = {
              characterId: newId, displayName: c.displayName || name,
              roleType: c.roleType || "supporting", gender: c.gender || "unknown",
              ageRange: c.ageRange || "child", skinTone: c.skinTone || "",
              hairStyle: "", wardrobeStyle: c.wardrobeStyle || "",
              speechStyle: c.speechStyle || "normal", accentType: "",
              emotionProfile: c.emotionProfile || "", voiceId: c.voiceId || "",
              voiceType: c.voiceType || "childlike", intonation: c.intonation || "playful",
              language: "English", tags: [], hasVoice: !!c.voiceId, hasImage: false,
              species: c.species || "", bodyBuild: c.bodyBuild || "",
              colorDescription: c.colorDescription || "", faceFeatures: c.faceFeatures || "",
              clothingDetails: c.clothingDetails || "", accessories: c.accessories || "",
              distinctiveFeatures: c.distinctiveFeatures || "", ageAppearance: c.ageAppearance || "",
            };
            setCharacters(prev => {
              const existingIdx = prev.findIndex(x => x.displayName.toLowerCase() === builtChar.displayName.toLowerCase());
              return existingIdx >= 0
                ? prev.map((x, i) => i === existingIdx ? { ...x, ...builtChar, characterId: x.characterId, imageUrl: x.imageUrl } : x)
                : [...prev, builtChar];
            });
            builtSoFar.push({ name: builtChar.displayName, species: builtChar.species, gender: builtChar.gender, colorDescription: builtChar.colorDescription });
          }
        } catch { /* skip */ }
        built++;
        if (built < detected.length) await new Promise(r => setTimeout(r, 800));
      }
      setBuildAllProgress(null);
      setLastAction(`${built} characters built — review in Characters tab`);
    } catch (err) { setUiError("Character build failed: " + String(err)); }
    setBuildingAllChars(false);
    setBuildAllProgress(null);
  }

  async function buildCharacterInline(name: string) {
    const text = expandedContent || textContent || readAlongText || "";
    if (!name.trim()) return;
    setCharTabCreating(true);
    setInlinePreview(null);
    try {
      const res = await fetch("/api/hybrid/character-build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: name,
          storyText: text,
          artStyle: effectiveProjectStyle || "storybook",
          language: "English",
          childSafe: true,
          ageGroup,
          existingCharacters: characters.map(c => ({ name: c.displayName, species: c.species, gender: c.gender, colorDescription: c.colorDescription })),
        }),
      });
      const data = await res.json();
      if (data.ok && data.character) {
        const c = data.character;
        const newId = `CC${String(characters.length + 1).padStart(2, "0")}`;
        const built: CharacterIdentity = {
          characterId: newId, displayName: c.displayName || name,
          roleType: c.roleType || "supporting", gender: c.gender || "unknown",
          ageRange: c.ageRange || "child", skinTone: c.skinTone || "",
          hairStyle: "", wardrobeStyle: c.wardrobeStyle || "",
          speechStyle: c.speechStyle || "normal", accentType: "",
          emotionProfile: c.emotionProfile || "", voiceId: c.voiceId || "",
          voiceType: c.voiceType || "childlike", intonation: c.intonation || "playful",
          language: "English", tags: [], hasVoice: !!c.voiceId, hasImage: false,
          species: c.species || "", bodyBuild: c.bodyBuild || "",
          colorDescription: c.colorDescription || "", faceFeatures: c.faceFeatures || "",
          clothingDetails: c.clothingDetails || "", accessories: c.accessories || "",
          distinctiveFeatures: c.distinctiveFeatures || "", ageAppearance: c.ageAppearance || "",
        };
        setInlinePreview(built);
      } else {
        setLastAction(`Could not build character "${name}" — try again`);
      }
    } catch {
      setLastAction(`Character build failed for "${name}"`);
    }
    setCharTabCreating(false);
  }

  function acceptInlineCharacter() {
    if (!inlinePreview) return;
    const alreadyExists = characters.some(c => c.characterId === inlinePreview.characterId);
    if (!alreadyExists) {
      setCharacters(prev => [...prev, inlinePreview]);
      setLastAction(`${inlinePreview.displayName} added to cast`);
    }
    setInlinePreview(null);
    setPhotoImportLog("");
  }

  // Persist portrait URL to character-voices DB so the image survives across projects/planners
  async function persistPortraitToRegistry(char: CharacterIdentity, imageUrl: string) {
    const dbId = char.dbId || savedChars.find(s => s.characterId === char.characterId)?.id;
    if (!dbId) return;
    try {
      await fetch(`/api/character-voices/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
    } catch { /* best-effort */ }
  }

  async function generateCharacterPortrait(char: CharacterIdentity, overrideModelId?: string) {
    setGeneratingPortrait(char.characterId);
    const visualDescFull = buildVisualDescription(char);
    const visualDesc = visualDescFull.slice(0, 1200);
    const styleLabel = VISUAL_STYLES.find(v => v.id === effectiveProjectStyle)?.label || "storybook";
    const portraitPrompt = [
      `children's story illustration, ${styleLabel} art style, age-appropriate, friendly, colorful, warm`,
      `CHARACTER ${char.displayName.toUpperCase()} — EXACT FIXED APPEARANCE:`,
      visualDesc || `${char.displayName}, ${char.gender} ${char.ageRange}`,
      "CHARACTER REFERENCE SHEET — front-facing full body portrait, neutral pose, clean background.",
      "Show the character clearly from head to toe. Friendly and safe for children.",
      "Consistent design, professional quality.",
    ].filter(Boolean).join(". ");
    const isPhotoImport = char.tags?.includes("photo-import");
    const effectiveModelId = overrideModelId
      || charPortraitModel[char.characterId]
      || (isPhotoImport ? "fal_flux_pulid" : undefined);
    try {
      const res = await fetch("/api/generation/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: portraitPrompt, modelId: effectiveModelId, width: 768, height: 960, seed: genSeed !== null ? genSeed : undefined }),
      });
      const d = await res.json();
      if (d.error) { setUiError(`Portrait failed: ${d.error}`); setGeneratingPortrait(null); return; }
      const url = d.imageUrl || (d.imagePath ? normalizeImageUrl(d.imagePath) : null);
      if (url) {
        setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageUrl: url, hasImage: true, imageLocked: false } : c));
        setLastAction(`Portrait generated for ${char.displayName} — AI reading image...`);
        persistPortraitToRegistry(char, url);
        analyzeCharacterImage(char.characterId, url);
      }
    } catch (err) {
      setUiError(`Portrait generation failed for ${char.displayName}: ${err instanceof Error ? err.message : String(err)}`);
    }
    setGeneratingPortrait(null);
  }

  async function analyzeCharacterImage(charId: string, imageUrl: string) {
    setAnalyzingCharacter(charId);
    try {
      const res = await fetch("/api/hybrid/analyze-character", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, characterName: charId, preferredProvider: visionProvider }),
      });
      if (!res.ok) { setLastAction(`AI Read Look failed — server error ${res.status}.`); return; }
      const data = await res.json();
      if (data.noVisionAvailable) { setLastAction(`No vision AI available. Install Ollama + llava or add ANTHROPIC_API_KEY.`); return; }
      if (!data.success || !data.analysis) { setLastAction(`AI Read Look: could not parse image. Try different Vision AI.`); return; }
      const a = data.analysis;
      setCharacters(prev => prev.map(c => {
        if (c.characterId !== charId) return c;
        return {
          ...c,
          species: c.species || a.species || "",
          bodyBuild: c.bodyBuild || a.bodyBuild || "",
          colorDescription: c.colorDescription || a.colorDescription || "",
          faceFeatures: c.faceFeatures || a.faceFeatures || "",
          clothingDetails: c.clothingDetails || a.clothingDetails || "",
          accessories: c.accessories || a.accessories || "",
          distinctiveFeatures: c.distinctiveFeatures || a.distinctiveFeatures || "",
          ageAppearance: c.ageAppearance || a.ageAppearance || "",
          gender: c.gender || (a.gender !== "unknown" ? a.gender : ""),
        };
      }));
      setLastAction(`AI read the image — visual fields filled for ${charId}.`);
    } catch (err) {
      setLastAction(`AI Read Look error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnalyzingCharacter(null);
    }
  }

  async function saveCharacterToRegistry(char: CharacterIdentity) {
    setSavingCharacter(char.characterId);
    setSavedCharacter(null);
    const payload = {
      name: char.displayName, characterId: char.characterId, gender: char.gender,
      role: char.roleType, age: char.ageRange, voiceId: char.voiceId || null,
      language: char.language || null, imageUrl: char.imageUrl || null,
      visualDescription: [char.species, char.colorDescription, char.clothingDetails, char.distinctiveFeatures].filter(Boolean).join(", ") || null,
      defaultSpeechStyle: char.speechStyle || null, personality: char.emotionProfile || null,
    };
    try {
      const createRes = await fetch("/api/character-voices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (createRes.status === 201 || createRes.ok) {
        setSavedCharacter(char.characterId);
        setLastAction(`${char.displayName} saved to Character Registry.`);
        setTimeout(() => setSavedCharacter(null), 3000);
        return;
      }
      if (createRes.status === 409) {
        setSavedCharacter(char.characterId);
        setLastAction(`${char.displayName} already in Character Registry.`);
        setTimeout(() => setSavedCharacter(null), 3000);
        return;
      }
      setLastAction(`Save failed (${createRes.status})`);
    } catch (err) {
      setLastAction(`Save error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingCharacter(null);
    }
  }

  async function openImagePicker(charId: string) {
    setImagePickerForCharId(charId);
    setImagePickerLoading(true);
    setImagePickerAssets([]);
    try {
      const [assetsRes, charsRes] = await Promise.all([fetch("/api/assets?type=image"), fetch("/api/character-voices")]);
      const combined: Array<{ id: string; name: string; fileUrl?: string; filePath?: string; source?: string }> = [];
      if (assetsRes.ok) {
        const d = await assetsRes.json();
        (d.assets || []).forEach((a: { id: string; name: string; fileUrl?: string; filePath?: string }) => { if (a.fileUrl || a.filePath) combined.push(a); });
      }
      if (charsRes.ok) {
        const d = await charsRes.json();
        (d.voices || []).forEach((v: { id: string; name: string; imageUrl?: string }) => {
          if (v.imageUrl) combined.push({ id: `cv_${v.id}`, name: v.name, fileUrl: v.imageUrl.startsWith("http") || v.imageUrl.startsWith("/api/") ? v.imageUrl : `/api/media/${v.imageUrl.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`, source: "character_registry" });
        });
      }
      setImagePickerAssets(combined);
    } catch { setImagePickerAssets([]); }
    setImagePickerLoading(false);
  }

  function assignImageToCharacter(charId: string, imageUrl: string) {
    setCharacters(prev => prev.map(c => c.characterId === charId ? { ...c, imageUrl, hasImage: true, imageLocked: false } : c));
    setImagePickerForCharId(null);
    setLastAction(`Image assigned — AI reading look...`);
    const char = characters.find(c => c.characterId === charId);
    if (char) persistPortraitToRegistry(char, imageUrl);
    analyzeCharacterImage(charId, imageUrl);
  }

  async function importCharacterFromPhoto(file: File, nameOverride?: string) {
    setImportingFromPhoto(true);
    setPhotoImportLog("Uploading image…");
    setInlinePreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/character-voices/upload-image", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadData.url) throw new Error(uploadData.error || "Upload failed");
      const imageUrl: string = uploadData.url;
      setPhotoImportLog("Reading photo with AI vision…");
      const analyzeRes = await fetch("/api/hybrid/analyze-character", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, characterName: nameOverride || "imported", preferredProvider: visionProvider }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeData.ok && !analyzeData.analysis) throw new Error(analyzeData.error || "Vision analysis failed");
      const a = analyzeData.analysis || {};
      const newId = `CC${String(characters.length + 1).padStart(2, "0")}_PH`;
      const displayName = nameOverride?.trim() || a.suggestedName || "Imported Character";
      const built: CharacterIdentity = {
        characterId: newId, displayName,
        roleType: a.suggestedRole || "supporting", gender: a.gender || "unknown",
        ageRange: a.ageAppearance || "child", skinTone: a.colorDescription || "",
        hairStyle: "", wardrobeStyle: a.clothingDetails || "",
        speechStyle: "normal", accentType: "", emotionProfile: a.distinctiveFeatures || "",
        voiceId: "", voiceType: "childlike", intonation: "playful", language: "English",
        tags: ["photo-import"], hasVoice: false, hasImage: true, imageUrl,
        imageLocked: true,
        species: a.species || "human", bodyBuild: a.bodyBuild || "",
        colorDescription: a.colorDescription || "", faceFeatures: a.faceFeatures || "",
        clothingDetails: a.clothingDetails || "", accessories: a.accessories || "",
        distinctiveFeatures: a.distinctiveFeatures || "", ageAppearance: a.ageAppearance || "",
      };
      setInlinePreview(built);
      setPhotoImportLog(`"${displayName}" ready — click "Add to Cast" to confirm`);
      setPhotoImportName("");
    } catch (err) {
      setPhotoImportLog(`[!] ${err instanceof Error ? err.message : "Import failed"}`);
    }
    setImportingFromPhoto(false);
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
          childContext: { ageGroup, learningMode, safetyLevel, visualStyle: effectiveProjectStyle },
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

      const styleLabel = VISUAL_STYLES.find(v => v.id === effectiveProjectStyle)?.label || effectiveProjectStyle;
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
          duration: continuousMotionEnabled ? 10 : 5,
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
      const storyText = `[Children Story — ${ageGroup} — ${effectiveProjectStyle} style]\n${storyInput}\n${selectedCharIds.length > 0 ? `Characters: ${savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => c.name).join(", ")}` : ""}`;
      const res = await fetch("/api/hybrid/scene-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyText, characters: savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => ({ characterId: c.characterId || c.id, name: c.name })), costPreference: "balanced", targetDuration: "2-5", projectId: `children_${Date.now()}`, styleHint: `${effectiveProjectStyle}, children's book illustration, age-appropriate, friendly, colorful` }),
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
          projectStyle: sceneStyles[sceneId] || effectiveProjectStyle,
          mood: "friendly, warm, safe",
          modelId: effectiveImageModelId,
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
        // ACCUMULATE: also push this single image into the per-scene pool so it's
        // available alongside Gen Max beats in the assembly picker. Without this,
        // clicking Gen Image after Gen Max overwrites the active slot only and the
        // image isn't visible in the multi-image spread.
        setSceneBeatImages(prev => {
          const existing = prev[sceneId] || [];
          if (existing.includes(url)) return prev;
          return { ...prev, [sceneId]: [...existing, url].slice(-30) };
        });
        setSelectedBeatImages(prev => {
          const existing = prev[sceneId] || [];
          return { ...prev, [sceneId]: [...existing, true].slice(-30) };
        });
        setLastAction(`Scene ${scene.scene} image generated`);
      }
    } catch (err) {
      setLastAction(`Image generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setGeneratingSceneImage(null);
  }

  // ════════════════════════════════════════════════════════════════════════
  // GEN MAX — multi-beat images per scene (mirrors hybrid-planner)
  //
  // splitIntoActionBeats imported from @/lib/scene/action-beats (Phase B extraction)
  // makeChildSceneBeatImages() fires one /api/hybrid/scene-image request per beat.
  // Each beat gets its OWN image. The assembly loop later expands the scene into
  // N segments, one per ticked beat.
  // ════════════════════════════════════════════════════════════════════════

  /**
   * makeChildSceneBeatImages — generate N images for a scene.
   *
   * 2026-05-09 ACCUMULATE FIX:
   *   - Old behavior: this function REPLACED sceneBeatImages[sceneId] with the new array,
   *     so a second Gen Max wiped out the previous run's images. Henry's "ffff" project
   *     hit this bug.
   *   - New behavior: APPEND new images to the existing pool. Each click adds more.
   *   - Per-scene custom count via sceneMaxTarget[sceneId] (default 4). Falls back to
   *     beats from splitIntoActionBeats if scene description is rich enough; otherwise
   *     fills the gap with seed-varied retries of the same description so user always
   *     gets the requested count.
   *
   * @param scene the child scene to generate images for
   * @param countOverride optional — explicit count for this single call; falls back to
   *                      sceneMaxTarget[sceneId], then 4
   */
  async function makeChildSceneBeatImages(scene: ChildScene, countOverride?: number) {
    const sceneId = `child_sc${String(scene.scene).padStart(2, "0")}`;
    if (generatingMaxBeats.has(sceneId)) return;

    const fullDesc = `${scene.title}. ${scene.visualDescription}`;
    // 2026-05-10 default 8 (was 4) per Henry's "boring without pictures".
    const targetCount = Math.max(1, Math.min(30, countOverride ?? sceneMaxTarget[sceneId] ?? 8));
    const naturalBeats = splitIntoActionBeats(fullDesc);
    // Build the prompt list:
    //   1. up to targetCount beats from the description
    //   2. if not enough natural beats, fill remainder with the full description varied by seed
    const promptList: string[] = [];
    for (let i = 0; i < targetCount; i++) {
      promptList.push(naturalBeats.length > 1 && i < naturalBeats.length ? naturalBeats[i] : fullDesc);
    }

    setGeneratingMaxBeats(prev => new Set(prev).add(sceneId));
    setMaxBeatsProgress(prev => ({ ...prev, [sceneId]: `Image 1/${promptList.length}…` }));
    setLastAction(`Gen Max: generating ${promptList.length} images for Scene ${scene.scene}…`);

    const assignedChars = sceneCharAssignments[sceneId] || scene.characters || [];
    const childStylePrefix = "children's book illustration, age-appropriate, friendly, colorful, ";
    const newUrls: string[] = [];

    for (let bi = 0; bi < promptList.length; bi++) {
      setMaxBeatsProgress(prev => ({ ...prev, [sceneId]: `Image ${bi + 1}/${promptList.length}…` }));
      try {
        const res = await fetch("/api/hybrid/scene-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneId: `${sceneId}_b${bi}_${Date.now()}`,
            sceneText: `${childStylePrefix}${promptList[bi]}`,
            characterIds: assignedChars,
            projectStyle: sceneStyles[sceneId] || effectiveProjectStyle,
            mood: "friendly, warm, safe",
            modelId: effectiveImageModelId,
            // Unique seed per image so retries on the same description still produce variation.
            seed: Math.floor(Math.random() * 1e9),
          }),
        });
        const data = await safeJson<{ imageUrl?: string; imagePath?: string; error?: string }>(res, `child-beat-${bi}`);
        const url = data.imageUrl || data.imagePath || "";
        if (url) newUrls.push(url);
      } catch (err) {
        console.error(`[makeChildSceneBeatImages] image ${bi} failed:`, err);
      }
    }

    // ACCUMULATE (don't replace). Cap at 30 to avoid runaway.
    setSceneBeatImages(prev => {
      const existing = prev[sceneId] || [];
      const merged = [...existing, ...newUrls].slice(-30);
      return { ...prev, [sceneId]: merged };
    });
    // New images default to ticked. Existing tick state preserved.
    setSelectedBeatImages(prev => {
      const existing = prev[sceneId] || [];
      const additions = newUrls.map(() => true);
      const merged = [...existing, ...additions].slice(-30);
      return { ...prev, [sceneId]: merged };
    });
    // 2026-05-10 fix — set first new beat as the scene's active image ONLY if no
    // active image yet. Without this, scene treated as "no image generated" by
    // assembly + UI flags even though beats are visible.
    if (newUrls.length > 0) {
      setSceneImages(prev => prev[sceneId] ? prev : { ...prev, [sceneId]: newUrls[0] });
      setChildScenes(prev => prev.map(s => s.scene === scene.scene && !s.imageUrl ? { ...s, imageUrl: newUrls[0] } : s));
      // Auto-opt-in to multi-image mode so assembly expands the beats.
      setUseMaxImageScenes(prev => prev.has(sceneId) ? prev : new Set(prev).add(sceneId));
    }
    setGeneratingMaxBeats(prev => { const n = new Set(prev); n.delete(sceneId); return n; });
    setMaxBeatsProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
    // Surface success vs requested so user knows when fewer land than asked.
    const failed = promptList.length - newUrls.length;
    if (failed > 0) {
      setLastAction(`Scene ${scene.scene}: +${newUrls.length} of ${promptList.length} images (${failed} failed — check console)`);
    } else {
      setLastAction(`Scene ${scene.scene}: +${newUrls.length} images added`);
    }
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
        Math.floor(Math.random() * 9000000) + 1000000,
      ];
      const results: string[] = [];
      for (let i = 0; i < 4; i++) {
        try {
          const res = await fetch("/api/hybrid/scene-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneId,
              sceneText: `${childStylePrefix}${scene.title}. ${scene.visualDescription}`,
              characterIds: assignedChars,
              projectStyle: sceneStyles[sceneId] || (effectiveProjectStyle === "storybook" ? "storybook" : effectiveProjectStyle === "2d-cartoon" ? "2d-cartoon" : "storybook"),
              mood: "friendly, warm, safe",
              modelId: effectiveImageModelId,
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
        let updatedScene: ChildScene | undefined;
        setChildScenes(prev => {
          const next = prev.map(s => s.scene === sceneNum ? { ...s, visualDescription: data.polishedText } : s);
          updatedScene = next.find(s => s.scene === sceneNum);
          return next;
        });
        setLastAction(`Scene ${sceneId}: polished — regenerating image...`);
        // Auto-regen image with the new polished description
        if (updatedScene) {
          await generateSceneBoardImage({ ...updatedScene, visualDescription: data.polishedText });
        }
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

  // ── Per-scene AI SFX — extract SFX cues from scene description ──────────
  async function generateSceneSfx(sceneId: string, description: string) {
    setGeneratingSceneSfx(prev => new Set(prev).add(sceneId));
    try {
      const res = await fetch("/api/hybrid/audio-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sceneText: description, autoMode: true }),
      });
      if (res.ok) {
        await res.json();
      }
    } catch (e) {
      console.error("[children-planner] scene SFX error:", e);
    } finally {
      setGeneratingSceneSfx(prev => { const s = new Set(prev); s.delete(sceneId); return s; });
    }
  }

  // ── Per-scene music — request music mood for this scene via audio-plan ──
  async function generateSceneMusic(sceneId: string, description: string, title: string) {
    setGeneratingSceneMusic(prev => new Set(prev).add(sceneId));
    try {
      const res = await fetch("/api/hybrid/audio-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sceneText: `${title}. ${description}`,
          autoMode: true,
          childSafe: true,
          ageGroup,
          musicOnly: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const mood = data.musicMood || data.mood || "";
        const musicUrl = data.musicUrl || "";
        if (musicUrl) {
          setSceneMusicUrls(prev => ({ ...prev, [sceneId]: musicUrl }));
        }
        if (mood) {
          setLastAction(`Scene ${sceneId}: music mood — ${mood}`);
        }
      }
    } catch (e) {
      console.error("[children-planner] scene music error:", e);
    } finally {
      setGeneratingSceneMusic(prev => { const s = new Set(prev); s.delete(sceneId); return s; });
    }
  }

  // ── Soft-delete scene (moves to archived, not permanent) ──
  function archiveScene(sceneNum: number) {
    setChildScenes(prev => {
      const target = prev.find(s => s.scene === sceneNum);
      if (target) setArchivedScenes(a => [...a, target]);
      return prev.filter(s => s.scene !== sceneNum);
    });
    setLastAction(`Scene ${sceneNum} moved to archive (not deleted)`);
  }

  // ── Restore scene from archive ──
  function restoreScene(sceneNum: number) {
    setArchivedScenes(prev => {
      const target = prev.find(s => s.scene === sceneNum);
      if (target) setChildScenes(c => [...c, target].sort((a, b) => a.scene - b.scene));
      return prev.filter(s => s.scene !== sceneNum);
    });
    setLastAction(`Scene ${sceneNum} restored`);
  }

  // ── AI Supervisor — checks video/audio authenticity before assembly (runs unlimited times) ──
  async function runAiSupervisor() {
    setAiSupervisorRunning(true);
    setAiSupervisorReport(null);
    const issues: string[] = [];
    const fixed: string[] = [];
    try {
      // ── 1. Scene check ──
      const sceneReports = childScenes.map(s => {
        const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
        return {
          sceneId,
          title: s.title,
          text: s.title || s.visualDescription || "",
          hasImage: !!(sceneImages[sceneId] || s.imageUrl),
          hasVideo: !!sceneVideos[sceneId],
          isSelected: assemblySelectedIds.includes(sceneId),
        };
      });
      const selectedScenes = sceneReports.filter(r => r.isSelected);
      const missingMedia = selectedScenes.filter(r => !r.hasImage && !r.hasVideo);
      if (selectedScenes.length === 0) issues.push("No scenes selected — tick scenes in Assembly before assembling.");
      if (missingMedia.length > 0) issues.push(`${missingMedia.length} scene(s) missing image/video: ${missingMedia.map(r => r.sceneId).join(", ")}`);
      if (selectedScenes.length > 0 && missingMedia.length === 0) fixed.push(`${selectedScenes.length} scene(s) ready.`);

      // ── 2. Narration check + auto-generate (always re-runs) ──
      const storyForTTS = (narrationText || readAlongText || textContent || "").trim();
      if (storyForTTS.length > 10) {
        try {
          // BUG-09 fix: use narrationProvider state instead of hardcoded "piper"
          const autoProvider = effectiveNarrationProvider || "piper";
          fixed.push(`Generating narration (${autoProvider})...`);
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: storyForTTS.slice(0, 3000), provider: autoProvider, speed: 0.9 }),
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json() as { audioUrl?: string };
            if (ttsData.audioUrl) {
              setNarratorAudioUrl(ttsData.audioUrl);
              fixed[fixed.length - 1] = `Narration generated (${autoProvider}).`;
            } else {
              fixed[fixed.length - 1] = "";
              issues.push("Narration TTS returned no audio URL.");
            }
          } else { fixed[fixed.length - 1] = ""; issues.push(`Narration TTS failed (HTTP ${ttsRes.status}).`); }
        } catch (ttsErr) { issues.push(`Narration TTS error: ${ttsErr instanceof Error ? ttsErr.message : "unknown"}`); }
      } else { issues.push("No story text found — write your story in the Content tab first."); }

      // ── 3. Music check + auto-generate if missing ──
      if (!selectedMusicUrl && !generatedMusicUrl) {
        try {
          fixed.push("Generating background music...");
          const supervisorTier = SOUND_TIERS.find(t => t.id === effectiveSoundTier);
          const supervisorProviderKey = supervisorTier?.providerKey ?? "stock";
          const musicRes = await fetch("/api/music/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: `calm children's story background music, gentle and warm`, durationSeconds: 30, providerKey: supervisorProviderKey }),
          });
          if (musicRes.ok) {
            const mData = await musicRes.json() as { url?: string; audioUrl?: string };
            const mUrl = mData.url ?? mData.audioUrl ?? "";
            if (mUrl) { setGeneratedMusicUrl(mUrl); setSelectedMusicUrl(mUrl); fixed[fixed.length - 1] = "Background music auto-generated."; }
            else { fixed[fixed.length - 1] = ""; issues.push("Music generation returned no URL — add manually in Sound tab."); }
          } else { fixed[fixed.length - 1] = ""; issues.push("Music generation failed — add manually in Sound tab."); }
        } catch { issues.push("Music generation error — add manually in Sound tab."); }
      } else { fixed.push(`Background music ready.`); }

      // ── 4. SFX check ──
      if (!sfxGeneratedUrl && fsResults.length === 0) {
        issues.push("No SFX — optional but recommended. Search sound effects in Sound tab.");
      } else { fixed.push("SFX available."); }

      // ── 5. Subtitle check ──
      if ((effectiveSubtitleConfig.mode as string) === "none") {
        issues.push("Subtitles disabled — enable a style in Assembly for better accessibility.");
      } else { fixed.push(`Subtitles: "${effectiveSubtitleConfig.mode}" mode, ${effectiveSubtitleConfig.position} position.`); }

      const blockingIssues = issues.filter(i => !i.startsWith("No SFX") && !i.startsWith("Subtitles disabled"));
      const ok = missingMedia.length === 0 && selectedScenes.length > 0 && blockingIssues.length === 0;
      const summary = ok
        ? `All checks passed — ${selectedScenes.length} scene(s) ready to assemble.`
        : `${blockingIssues.length} blocking issue(s). ${fixed.filter(f => f).length} item(s) fixed/confirmed.`;
      setAiSupervisorReport({ ok, summary, issues: issues.filter(Boolean), fixed: fixed.filter(Boolean) });
    } catch (err) {
      setAiSupervisorReport({ ok: false, summary: "Supervisor check failed", issues: [`Error: ${err instanceof Error ? err.message : "unknown"}`], fixed: [] });
    } finally {
      setAiSupervisorRunning(false);  // always reset — guaranteed by finally
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
          audioConfig: { narrationProvider: effectiveNarrationProvider, narrationText: narrationText, musicUrl: selectedMusicUrl, musicName: selectedMusicName },
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
      // Each pushed segment carries:
      //   scene:    UNIQUE sequential index (1,2,3...) so /api/video/assemble can write
      //             temp files like scene_img_1.png / imgslide_1.mp4 without collisions.
      //   parentScene: original parent scene number, used here only for subtitle text.
      //   videoUrl: img:<url> for image, or direct video URL for video clips.
      type Segment = { scene: number; videoUrl: string; parentScene: number };
      const assemblyScenes: Segment[] = [];
      let segCounter = 0;
      for (const s of scenesToAssemble) {
        const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
        const videoUrl = sceneVideos[sceneId];
        const imageUrl = sceneImages[sceneId] || s.imageUrl;
        const pref = assemblyMediaPrefs[sceneId] || "auto";

        // MULTI-IMAGE SOURCE for "Use Max Image":
        // Prefer Gen Max beats (different action moments). If none, fall back to Gen 4 variants
        // (alternate renders of the same moment). Both are valid multi-image sources for Henry's
        // "spread the scene across N small boxes" workflow.
        const allBeats = sceneBeatImages[sceneId] && sceneBeatImages[sceneId].length > 1
          ? sceneBeatImages[sceneId]
          : (s.variantUrls && s.variantUrls.length > 1 ? s.variantUrls : null);
        const beatChecks = selectedBeatImages[sceneId];
        const tickedBeats = allBeats
          ? allBeats.filter((_, bi) => beatChecks?.[bi] !== false)
          : [];
        const wantsImagePath = pref === "image" || (pref !== "video" && !videoUrl);
        const userOptedIntoMax = useMaxImageScenes.has(sceneId);
        if (wantsImagePath && userOptedIntoMax && tickedBeats.length > 1) {
          // Push one assembly segment per ticked beat. CRITICAL: each gets a unique
          // sequential scene number so /api/video/assemble's temp-file naming doesn't collide.
          for (const beatUrl of tickedBeats) {
            assemblyScenes.push({ scene: ++segCounter, videoUrl: `img:${beatUrl}`, parentScene: s.scene });
          }
          continue;
        }

        // Single-image / video path. Source priority:
        //   1. user opted into Max + exactly one beat ticked → use that beat
        //   2. scene's primary imageUrl → use that
        //   3. allBeats[0] only as last-resort fallback when scene has no primary image
        const singleImageSrc =
          userOptedIntoMax && tickedBeats.length === 1 ? tickedBeats[0] :
          imageUrl ? imageUrl :
          (allBeats && allBeats.length > 0 ? allBeats[0] : undefined);
        if (pref === "video" && videoUrl) {
          assemblyScenes.push({ scene: ++segCounter, videoUrl, parentScene: s.scene });
        } else if (pref === "image" && singleImageSrc) {
          assemblyScenes.push({ scene: ++segCounter, videoUrl: `img:${singleImageSrc}`, parentScene: s.scene });
        } else if (videoUrl) {
          // auto: prefer video if available
          assemblyScenes.push({ scene: ++segCounter, videoUrl, parentScene: s.scene });
        } else if (singleImageSrc) {
          assemblyScenes.push({ scene: ++segCounter, videoUrl: `img:${singleImageSrc}`, parentScene: s.scene });
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

      const assembleProjectId = urlProjectId || `children_${contentParam || "story"}_${topicParam || "default"}`;
      const narrationList = narratorAudioUrl ? [{ startTime: 0, audioUrl: narratorAudioUrl, volume: 1.0 }] : [];
      // Collect SFX: AI-generated SFX + any saved freesound picks
      const sfxList: Array<{ sourceUrl: string; startTime: number; volume: number }> = [];
      if (sfxGeneratedUrl) sfxList.push({ sourceUrl: sfxGeneratedUrl, startTime: 0, volume: 0.6 });
      // Attach scene text so assembly route can render subtitles
      const totalNarDuration = narrationText ? estimateTextDuration(narrationText) : 0;
      // Map by parentScene so beat segments still resolve their PARENT title for subtitles.
      const sceneByNum = new Map<number, ChildScene>();
      for (const s of scenesToAssemble) sceneByNum.set(s.scene, s);
      // Per-segment duration: divide narrator total by total SEGMENT count.
      // A 4-beat scene now contributes 4 segments with unique scene numbers, so it gets
      // 4× the screen time of a 1-image scene (proportional to its content).
      const perSegmentDuration = totalNarDuration > 0
        ? Math.max(2, totalNarDuration / assemblyScenes.length)
        : 5;
      // Strip the parentScene helper field before sending — /api/video/assemble doesn't
      // know about it. Subtitle text is built from parent here.
      const scenesWithText = assemblyScenes.map(({ parentScene, ...rest }) => {
        const parent = sceneByNum.get(parentScene);
        return {
          ...rest,
          duration: perSegmentDuration,
          text: parent?.title ? `${parent.title}: ${parent.visualDescription || ""}` : "",
        };
      });
      const res = await fetch("/api/video/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: assembleProjectId,
          title: `Children Story — ${contentParam || "story"}`,
          scenes: scenesWithText,
          musicUrl: selectedMusicUrl || generatedMusicUrl || undefined,
          musicVolume: 0.75,
          narrationList,
          sfx: sfxList.length > 0 ? sfxList : undefined,
          aspectRatio: "16:9",
          subtitleConfig: effectiveSubtitleConfig,
          introUrl: introUrl || undefined,
          outroUrl: outroUrl || undefined,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        setLastAction(`Assembly error (${res.status}): ${errText.slice(0, 200)}`);
        setAssembling(false);
        return;
      }
      const data = await res.json();
      if (data.error) { setLastAction(`Assembly error: ${data.error}`); }
      else if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        setGeneratedVideoUrl(data.outputUrl);
        try {
          await fetch("/api/assets", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: `Children Story — ${contentParam || "story"}`, type: "children-video", videoUrl: data.outputUrl, status: "review", metadata: { ageGroup, learningMode, visualStyle: effectiveProjectStyle, scenes: assemblyScenes.length } }),
          });
        } catch { /* ignore */ }
        setAssemblyComplete(true);
        setLastAction("Story assembled successfully");
      }
    } catch (err) { setLastAction(`Assembly failed — ${err instanceof Error ? err.message : "try again"}`); }
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
      const prompt = `You are a children content music supervisor. Pick the best background music track for this story:\n\nStory: ${storyContext.substring(0, 400)}\nAge group: ${ageGroup}, Learning mode: ${learningMode}, Visual style: ${effectiveProjectStyle}, Tone: ${tone}\n\nTracks:\n${trackList}\n\nRespond with JSON only: {"trackNumber": <1-based index>, "trackName": "<name>", "reason": "<brief reason>"}`;
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

  // ── Narration-only TTS generation ──
  async function generateNarration() {
    const text = textContent?.trim() || narrationText?.trim();
    if (!text) { setUiError("Write your story first before generating narration."); return; }
    setNarrationGenerating(true);
    setUiError("");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 3000),
          provider: effectiveNarrationProvider,
          engine: effectiveNarrationProvider,
          speed: narrationSpeed,
          voiceId: effectiveNarrationProvider === "elevenlabs" ? "EXAVITQu4vr4xnSDxMaL" : undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        throw new Error(`TTS error ${res.status}: ${errBody}`);
      }
      const data = await res.json() as { audioUrl?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (data.audioUrl) {
        setNarratorAudioUrl(data.audioUrl);
        setLastAction("Narration generated");
      } else {
        throw new Error("No audio URL returned");
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Narration generation failed");
    }
    setNarrationGenerating(false);
  }

  // ── Music-only generation ──
  async function generateChildrenMusic() {
    setMusicGenerating(true);
    setUiError("");
    try {
      const musicMood = musicChoice === "soft_story" ? "calm" : musicChoice === "nursery" ? "children" : "upbeat";
      // Resolve providerKey from the selected SOUND_TIERS entry
      const activeTier = SOUND_TIERS.find(t => t.id === effectiveSoundTier);
      const resolvedProviderKey = activeTier?.providerKey ?? "stock";
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${musicMood} background music for a children's story`,
          durationSeconds: 20,
          providerKey: resolvedProviderKey,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        throw new Error(`Music error ${res.status}: ${errBody}`);
      }
      const data = await res.json() as { url?: string; audioUrl?: string; fallbackReason?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (data.url || data.audioUrl) {
        const musicUrl = data.url ?? data.audioUrl ?? "";
        setGeneratedMusicUrl(musicUrl);
        setSelectedMusicUrl(musicUrl);   // auto-select so assembly includes it
        if (data.fallbackReason) setMusicFallbackReason(data.fallbackReason);
        else setMusicFallbackReason(null);
        setLastAction("Background music generated");
      } else {
        throw new Error("No music URL returned");
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Music generation failed");
    }
    setMusicGenerating(false);
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
        const activeTierForContent = SOUND_TIERS.find(t => t.id === effectiveSoundTier);
        const contentProviderKey = activeTierForContent?.providerKey ?? "stock";
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `${musicMood} background music for a children's story`,
            durationSeconds: 20,
            providerKey: contentProviderKey,
          }),
        });
        const musicData = await safeJson<{ url?: string; audioUrl?: string; fallbackReason?: string }>(musicRes, "music/generate");
        if (musicData.url || musicData.audioUrl) {
          const mUrl = musicData.url ?? musicData.audioUrl ?? "";
          setGeneratedMusicUrl(mUrl);
          setSelectedMusicUrl(mUrl);  // auto-select
        }
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
              duration: estimateTextDuration(s.text || textContent || ""),
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

  // ── Phase C.2: Project settings hook — reads from DB, patches asynchronously ──
  const {
    settings: projectSettings,
    patch: patchProjectSettings,
  } = useProjectSettings(urlProjectId || null);

  // ── Phase C.2: Effective shims — hook value wins when loaded, local state is fallback ──
  const effectiveProjectStyle = projectSettings.visualStyle ?? projectStyle;
  const effectiveSoundTier = (projectSettings.soundTier ?? soundTier) as typeof soundTier;
  const effectiveNarrationProvider = (projectSettings.narrationProvider ?? narrationProvider) as typeof narrationProvider;
  const effectiveVideoModelId = projectSettings.videoModelVersion !== "auto"
    ? (projectSettings.videoModelVersion ?? selectedVideoModelId)
    : selectedVideoModelId;
  const effectiveImageModelId = projectSettings.imageModelVersion !== "auto"
    ? (projectSettings.imageModelVersion ?? selectedImageModelId)
    : selectedImageModelId;
  // SubtitleConfig: build from hook fields, spread over local config for non-migrated fields
  const effectiveSubtitleConfig: typeof subtitleConfig = projectSettings
    ? {
        ...subtitleConfig,
        mode: (projectSettings.subtitleMode as typeof subtitleConfig.mode) ?? subtitleConfig.mode,
        highlightColor: projectSettings.subtitleHighlight ?? subtitleConfig.highlightColor,
      }
    : subtitleConfig;

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
            if (d.projectTitle)     setProjectTitle(d.projectTitle);
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
            if (d.characters?.length > 0)   setCharacters(d.characters);
            if (d.childScenes?.length > 0)  setChildScenes(d.childScenes);
            if (d.sceneImages && Object.keys(d.sceneImages).length > 0) setSceneImages(d.sceneImages);
            if (d.sceneVideos && Object.keys(d.sceneVideos).length > 0) setSceneVideos(d.sceneVideos);
            // Restore Gen Max beats so they survive a page refresh.
            if (d.sceneBeatImages && Object.keys(d.sceneBeatImages).length > 0) setSceneBeatImages(d.sceneBeatImages);
            if (d.selectedBeatImages && Object.keys(d.selectedBeatImages).length > 0) setSelectedBeatImages(d.selectedBeatImages);
            // Restore which scenes are in "Use Max Image" mode for assembly.
            if (Array.isArray(d.useMaxImageScenes)) setUseMaxImageScenes(new Set(d.useMaxImageScenes));
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
      projectTitle,
      textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice,
      ageGroup, safetyLevel, learningMode,
      savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos,
      sceneBeatImages, selectedBeatImages,  // Gen Max beats — persist across refresh
      // Set serializes as Array via spread — restore reads as Array, hydrates back into Set.
      useMaxImageScenes: Array.from(useMaxImageScenes),
      scriptSegments, screenplay, selectedMusicUrl, selectedMusicName,
      soundTier, modelSettings, activeTab,
      characters,
      timestamp: Date.now(),
    };
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: activeProjectIdRef.current || "ghs_children_default", data }),
    }).catch(() => { /* silent on DB error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectTitle, textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice, ageGroup, safetyLevel,
      savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos,
      sceneBeatImages, selectedBeatImages, useMaxImageScenes,
      scriptSegments, screenplay,
      selectedMusicUrl, selectedMusicName, soundTier, modelSettings, activeTab, characters]);

  // ── Load project list for "My Projects" panel ──
  useEffect(() => {
    fetch("/api/hybrid/saved-state?list=true&prefix=ghs_children")
      .then(r => r.json())
      .then(d => { if (d.projects) setProjectsList(d.projects); })
      .catch(() => {});
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
            visualStyle: effectiveProjectStyle,
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
                  <button key={tier.id} onClick={() => { setModelSettings(p => ({ ...p, soundModel: tier.id })); setSoundTier(tier.id); patchProjectSettings({ soundTier: tier.id }).catch(() => {}); }}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 10px", marginBottom: 4, borderRadius: 8, border: `1px solid ${modelSettings.soundModel === tier.id ? childSafe : ds.color.line}`, background: modelSettings.soundModel === tier.id ? `${childSafe}12` : "transparent", color: modelSettings.soundModel === tier.id ? childSafe : "#fff", fontSize: 10, cursor: "pointer" }}>
                    <span>{tier.label}</span><span style={{ opacity: 0.6 }}>{tier.cost}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Art Style — controls scene image rendering */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Video Art Style</p>
          <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Controls how all scene images look. Applied during image generation.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { id: "storybook",    icon: "SB", name: "Storybook",    color: "#22c55e", example: "Like: children's picture books, Peppa Pig",   desc: "Soft, warm and painterly. Gentle and cozy." },
              { id: "2d-cartoon",   icon: "2D", name: "2D Cartoon",   color: "#f59e0b", example: "Like: SpongeBob, old Disney, cartoon shows",   desc: "Flat bold colors with thick outlines. Fun and simple." },
              { id: "3d-cinematic", icon: "3D", name: "3D Cinematic", color: "#00d4ff", example: "Like: Toy Story, Moana, Kung Fu Panda",         desc: "3D animated movie quality. Rich lighting and depth." },
              { id: "anime",        icon: "AN", name: "Anime",        color: "#a855f7", example: "Like: Naruto, Dragon Ball, My Hero Academia",  desc: "Japanese animation style. Big expressive eyes." },
              { id: "realistic",    icon: "RL", name: "Realistic",    color: "#ec4899", example: "Like: a real film or Netflix drama",            desc: "Photorealistic — looks like an actual photograph." },
            ].map(s => {
              const isSel = effectiveProjectStyle === s.id;
              return (
                <div key={s.id} onClick={() => { setProjectStyle(s.id); patchProjectSettings({ visualStyle: s.id }).catch(() => {}); setLastAction(`Art style: ${s.name}`); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${isSel ? s.color : border}`, background: isSel ? `${s.color}10` : "transparent" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: s.color, minWidth: 26, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isSel ? s.color : "#fff" }}>{s.name}</span>
                      {isSel && <span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 6, background: s.color, color: "#000", fontWeight: 800 }}>ACTIVE</span>}
                      <span style={{ fontSize: 9, color: s.color }}>{s.example}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

  // ── Explicit project flush (used by Save button + New Project) ──
  async function flushCurrentProject() {
    const id = activeProjectIdRef.current || "ghs_children_default";
    const data = {
      projectTitle, textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice,
      ageGroup, safetyLevel, learningMode, savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos,
      sceneBeatImages, selectedBeatImages,  // Gen Max beats — survive flush + reload
      useMaxImageScenes: Array.from(useMaxImageScenes),  // per-scene "use multi-image" opt-in
      scriptSegments, screenplay, selectedMusicUrl, selectedMusicName, soundTier, modelSettings, activeTab,
      characters,
      timestamp: Date.now(),
    };
    try {
      await fetch("/api/hybrid/saved-state", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId: id, data }),
      });
      // Refresh project list
      const listRes = await fetch("/api/hybrid/saved-state?list=true&prefix=ghs_children");
      const listData = await listRes.json();
      if (listData.projects) setProjectsList(listData.projects);
    } catch { /* silent */ }
  }

  // ── New Project — save current then start fresh ──
  async function newProject() {
    isRestoringRef.current = true;
    await flushCurrentProject();
    const newKey = `ghs_children_${Date.now()}`;
    activeProjectIdRef.current = newKey;
    window.history.replaceState(null, "", `/dashboard/children-planner?projectId=${encodeURIComponent(newKey)}`);
    setProjectTitle("Untitled Children Project");
    setTextContent(""); setExpandedContent(""); setVisualStyle("storybook"); setNarrationStyle("gentle");
    setMusicChoice("soft_story"); setAgeGroup("preschool"); setSafetyLevel("high"); setLearningMode("storybook");
    setSavedChars([]); setSelectedCharIds([]); setCharacters([]); setChildScenes([]); setSceneImages({}); setSceneVideos({});
    setSceneBeatImages({}); setSelectedBeatImages({});
    setUseMaxImageScenes(new Set());
    setScriptSegments([]); setScreenplay(""); setSelectedMusicUrl(null); setSelectedMusicName("");
    setSavedCuts([]); setActiveTab("design"); setLastAction("New project started");
    setShowProjects(false);
    isRestoringRef.current = false;
  }

  // ── Load an existing children project ──
  async function loadChildProject(id: string) {
    isRestoringRef.current = true;
    activeProjectIdRef.current = id;
    window.history.replaceState(null, "", `/dashboard/children-planner?projectId=${encodeURIComponent(id)}`);
    try {
      const res = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(id)}`);
      const dbData = await res.json();
      if (dbData.found && dbData.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = dbData.data as any;
        if (d.projectTitle)     setProjectTitle(d.projectTitle);
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
        if (d.characters?.length > 0)   setCharacters(d.characters);
        if (d.childScenes?.length > 0)  setChildScenes(d.childScenes);
        if (d.sceneImages && Object.keys(d.sceneImages).length > 0) setSceneImages(d.sceneImages);
        if (d.sceneVideos && Object.keys(d.sceneVideos).length > 0) setSceneVideos(d.sceneVideos);
        if (d.sceneBeatImages && Object.keys(d.sceneBeatImages).length > 0) setSceneBeatImages(d.sceneBeatImages);
        if (d.selectedBeatImages && Object.keys(d.selectedBeatImages).length > 0) setSelectedBeatImages(d.selectedBeatImages);
        if (Array.isArray(d.useMaxImageScenes)) setUseMaxImageScenes(new Set(d.useMaxImageScenes));
        if (d.scriptSegments?.length > 0) setScriptSegments(d.scriptSegments);
        if (d.screenplay)       setScreenplay(d.screenplay);
        if (d.selectedMusicUrl) setSelectedMusicUrl(d.selectedMusicUrl);
        if (d.selectedMusicName) setSelectedMusicName(d.selectedMusicName);
        if (d.soundTier)        setSoundTier(d.soundTier);
        if (d.modelSettings)    setModelSettings(d.modelSettings);
        if (d.activeTab)        setActiveTab(d.activeTab);
        setLastAction(`Loaded: "${d.projectTitle || "project"}"`);
      }
    } catch { /* silent */ }
    setShowProjects(false);
    isRestoringRef.current = false;
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
      <div style={{ padding: "12px 32px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
          onBlur={() => flushCurrentProject()}
          style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, width: 200, outline: "none", fontFamily: ds.font.sans }}
          placeholder="Project Title" />
        <button onClick={async () => { await newProject(); }}
          style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid rgba(255,255,255,0.1)`, background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>
          New Project
        </button>
        <button onClick={async () => { setSaving(true); await flushCurrentProject(); setLastAction("Saved"); setTimeout(() => setSaving(false), 600); }} disabled={saving}
          style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saved" : "Save"}
        </button>
        <button onClick={() => setShowProjects(p => !p)}
          style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.gold}40`, background: showProjects ? `${ds.color.gold}15` : `${ds.color.gold}08`, color: ds.color.gold, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          My Projects {projectsList.length > 0 ? `(${projectsList.length})` : ""}
        </button>
        <a href="/dashboard/children-video" style={{ fontSize: 12, color: ds.color.mute, textDecoration: "none", padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, marginLeft: "auto" }}>
          Children Video
        </a>
      </div>

      {/* ── My Projects Panel ── */}
      {showProjects && (
        <div style={{ margin: "12px 32px 0", background: ds.color.card, border: `2px solid ${ds.color.gold}30`, borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.gold, marginBottom: 12 }}>My Children Projects</p>
          {projectsList.length === 0
            ? <p style={{ fontSize: 11, color: ds.color.mute }}>No saved projects yet. Your current work is auto-saved.</p>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {projectsList.sort((a, b) => b.lastModified - a.lastModified).map(proj => {
                  const isActive = proj.id === (activeProjectIdRef.current || "ghs_children_default");
                  return (
                    <div key={proj.id} onClick={() => isActive ? setShowProjects(false) : loadChildProject(proj.id)}
                      style={{ borderRadius: 12, border: `2px solid ${isActive ? ds.color.gold : ds.color.line}`, background: isActive ? `${ds.color.gold}08` : ds.color.paper, cursor: "pointer", padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? ds.color.gold : "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.title || "Untitled"}</p>
                      <p style={{ fontSize: 9, color: ds.color.mute }}>{proj.sceneCount} scenes · {proj.characterCount} chars</p>
                      <p style={{ fontSize: 8, color: ds.color.mute, marginTop: 4 }}>{new Date(proj.lastModified).toLocaleDateString()}</p>
                      {isActive && <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 6, background: ds.color.gold, color: "#000", fontWeight: 800, display: "inline-block", marginTop: 4 }}>OPEN</span>}
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

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
        <div style={{ padding: "16px 32px 32px" }}>
          {/* Header: Character Registry + Vision AI selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" as const, gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Character Registry ({characters.length})</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff08", border: "1px solid #ffffff15", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ fontSize: 10, color: "#888", fontWeight: 600, letterSpacing: 0.5 }}>VISION AI</span>
                {(["auto", "ollama", "claude", "gpt"] as const).map(p => (
                  <button key={p} onClick={() => setVisionProvider(p)}
                    style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                      background: visionProvider === p ? (p === "ollama" ? "#16a34a" : p === "claude" ? "#7c3aed" : p === "gpt" ? "#0284c7" : childAccent) : "#ffffff10",
                      color: visionProvider === p ? "#fff" : "#aaa" }}>
                    {p === "auto" ? "Auto" : p === "ollama" ? "Local" : p === "claude" ? "Claude" : "GPT"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              <button onClick={buildAllStoryCharacters} disabled={buildingAllChars || !( expandedContent || textContent.trim())}
                style={{ padding: "10px 18px", borderRadius: 10, border: "none",
                  background: buildingAllChars ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #059669)`,
                  color: "#fff", fontSize: 11, fontWeight: 700, cursor: buildingAllChars ? "not-allowed" : "pointer" }}>
                {buildAllProgress || (buildingAllChars ? "Building..." : "Build Story Characters with AI")}
              </button>
              <div style={{ display: "flex", gap: 4 }}>
                <input value={charTabName} onChange={e => setCharTabName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && charTabName.trim()) { buildCharacterInline(charTabName.trim()).then(() => setCharTabName("")); }}}
                  placeholder="Add character by name..."
                  style={{ background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 11, outline: "none", width: 180 }} />
                <button onClick={() => { if (charTabName.trim()) buildCharacterInline(charTabName.trim()).then(() => setCharTabName("")); }}
                  disabled={!charTabName.trim() || charTabCreating}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: charTabCreating ? "#2a2a40" : childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                  {charTabCreating ? "..." : "+ Add"}
                </button>
              </div>
              {(() => {
                const charsWithoutImages = characters.filter(c => !c.imageUrl && !c.hasImage);
                return charsWithoutImages.length > 0 ? (
                  <button disabled={!!batchPortraitProgress} onClick={async () => {
                    let completed = 0;
                    setBatchPortraitProgress(`0/${charsWithoutImages.length}`);
                    for (const char of charsWithoutImages) {
                      try { await generateCharacterPortrait(char); completed++; setBatchPortraitProgress(`${completed}/${charsWithoutImages.length}`); if (completed < charsWithoutImages.length) await new Promise(r => setTimeout(r, 1500)); } catch { /* continue */ }
                    }
                    setBatchPortraitProgress(null);
                    setLastAction(`Batch: ${completed}/${charsWithoutImages.length} portraits generated`);
                  }}
                    style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: batchPortraitProgress ? "not-allowed" : "pointer", opacity: batchPortraitProgress ? 0.7 : 1 }}>
                    {batchPortraitProgress ? `Generating ${batchPortraitProgress}...` : `Generate All Portraits (${charsWithoutImages.length})`}
                  </button>
                ) : null;
              })()}
              <button onClick={() => setShowCharacterPicker(true)}
                style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${ds.color.lilac}30`, background: "transparent", color: ds.color.lilac, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Import Existing
              </button>
            </div>
          </div>

          {/* UI Error */}
          {uiError && (
            <div style={{ ...cardStyle, borderColor: "#ef444440", background: "#ef444410", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 12, color: "#ef4444" }}>{uiError}</p>
              <button onClick={() => setUiError(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          )}

          {/* BUILD FROM PHOTO section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, #ffffff18, transparent)" }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: "#ffffff40", letterSpacing: 2, textTransform: "uppercase" as const }}>Build from Photo</span>
              <div style={{ height: 1, flex: 1, background: "linear-gradient(270deg, #ffffff18, transparent)" }} />
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
              onDragLeave={() => setPhotoDragOver(false)}
              onDrop={e => { e.preventDefault(); setPhotoDragOver(false); const file = e.dataTransfer.files?.[0]; if (file && file.type.startsWith("image/")) importCharacterFromPhoto(file, photoImportName); else setPhotoImportLog("[!] Drop an image file (JPG, PNG, WebP)"); }}
              style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 0, borderRadius: 14, overflow: "hidden", border: photoDragOver ? `2px solid ${childAccent}` : importingFromPhoto ? `2px solid ${ds.color.lilac}60` : "2px solid #ffffff14", background: "#0d0d1a", transition: "border-color 0.2s ease" }}>
              <label style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 6, cursor: importingFromPhoto ? "not-allowed" : "pointer", background: photoDragOver ? `${childAccent}20` : importingFromPhoto ? `${ds.color.lilac}15` : "#ffffff06", padding: "18px 10px", borderRight: "1px solid #ffffff10", minHeight: 90 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${photoDragOver ? childAccent : importingFromPhoto ? ds.color.lilac : "#ffffff25"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: photoDragOver ? `${childAccent}18` : "#ffffff08" }}>
                  {importingFromPhoto ? "..." : photoDragOver ? "Drop" : "+"}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: photoDragOver ? childAccent : "#ffffff50", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
                  {photoDragOver ? "Drop now" : importingFromPhoto ? "Reading…" : "Drop / Browse"}
                </span>
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={importingFromPhoto}
                  onChange={e => { const file = e.target.files?.[0]; if (file) importCharacterFromPhoto(file, photoImportName); e.target.value = ""; }} />
              </label>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Import any photo</p>
                  <p style={{ fontSize: 10, color: muted, margin: 0 }}>AI reads the image, extracts visual traits, and builds a full character identity automatically.</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={photoImportName} onChange={e => setPhotoImportName(e.target.value)} placeholder="Character name (optional)"
                    style={{ background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 11px", color: "#fff", fontSize: 11, outline: "none", flex: 1 }}
                    disabled={importingFromPhoto} />
                  <label style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: importingFromPhoto ? "#1a1a2e" : `linear-gradient(135deg, ${childAccent}, #059669)`, color: importingFromPhoto ? "#444" : "#000", fontSize: 10, fontWeight: 800, cursor: importingFromPhoto ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, flexShrink: 0, display: "flex", alignItems: "center" }}>
                    {importingFromPhoto ? "Importing..." : "Choose Photo"}
                    <input type="file" accept="image/*" style={{ display: "none" }} disabled={importingFromPhoto}
                      onChange={e => { const file = e.target.files?.[0]; if (file) importCharacterFromPhoto(file, photoImportName); e.target.value = ""; }} />
                  </label>
                </div>
                {photoImportLog && <span style={{ fontSize: 9, fontWeight: 700, color: photoImportLog.startsWith("[!]") ? childAccent : "#22c55e" }}>{photoImportLog}</span>}
              </div>
            </div>
          </div>

          {/* Inline preview card */}
          {inlinePreview && (
            <div style={{ ...cardStyle, borderColor: `${childAccent}40`, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                {inlinePreview.imageUrl ? (
                  <img src={inlinePreview.imageUrl} alt={inlinePreview.displayName} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: `2px solid ${childAccent}40`, flexShrink: 0 }} />
                ) : (
                  <Icon.User style={{ width: 20, height: 20 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{inlinePreview.displayName}</p>
                    {inlinePreview.tags?.includes("photo-import") && <span style={{ fontSize: 9, fontWeight: 700, color: childAccent, background: `${childAccent}18`, padding: "2px 6px", borderRadius: 4 }}>FROM PHOTO</span>}
                  </div>
                  <p style={{ fontSize: 10, color: muted, margin: 0 }}>{inlinePreview.roleType} · {inlinePreview.gender} · {inlinePreview.ageRange}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={acceptInlineCharacter} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Add to Cast</button>
                  <button onClick={() => { setInlinePreview(null); setPhotoImportLog(""); }} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>
                    <Icon.X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                {([["Species", inlinePreview.species], ["Build", inlinePreview.bodyBuild], ["Colours", inlinePreview.colorDescription], ["Face", inlinePreview.faceFeatures], ["Clothing", inlinePreview.clothingDetails], ["Distinctive", inlinePreview.distinctiveFeatures]] as [string, string | undefined][])
                  .filter(([, v]) => v && v !== "not specified").map(([label, value]) => (
                  <div key={label} style={{ padding: "6px 8px", borderRadius: 6, background: "#ffffff05" }}>
                    <p style={{ fontSize: 8, color: muted, fontWeight: 600, textTransform: "uppercase" as const, marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 10, color: "#fff" }}>{(value as string).slice(0, 60)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {characters.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <Icon.Users style={{ width: 28, height: 28, color: muted, marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No characters yet</p>
              <p style={{ fontSize: 12, color: muted, marginBottom: 20 }}>
                {(expandedContent || textContent.trim()) ? "Your story is ready — click above to let AI build all characters automatically." : "Write your story first, then AI will detect and build all characters for you."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" as const }}>
                {(expandedContent || textContent.trim()) && (
                  <button onClick={buildAllStoryCharacters} disabled={buildingAllChars}
                    style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${childAccent}, #059669)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {buildAllProgress || "Build Story Characters with AI"}
                  </button>
                )}
                <button onClick={() => setShowCharacterPicker(true)} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${ds.color.lilac}40`, background: "transparent", color: ds.color.lilac, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Import from Registry
                </button>
                {!(expandedContent || textContent.trim()) && (
                  <button onClick={() => setActiveTab("content")} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${childAccent}40`, background: "transparent", color: childAccent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ← Go to Story First
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
              {characters.map(char => {
                const isEditing = editingCharId === char.characterId;
                const isGenerating = generatingPortrait === char.characterId;
                const hasVisual = !!(char.species || char.colorDescription || char.clothingDetails || char.distinctiveFeatures);
                const visualDesc = buildVisualDescription(char);

                return (
                  <div key={char.characterId} style={{ ...cardStyle, borderColor: char.imageLocked ? `${childAccent}40` : hasVisual ? `${ds.color.lilac}30` : `${border}` }}>
                    {/* Top row */}
                    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                      <div style={{ position: "relative", width: 80, height: 80, borderRadius: 14, background: `${ds.color.lilac}20`, flexShrink: 0, overflow: "hidden", border: char.imageLocked ? `2px solid ${childAccent}` : `1px solid ${border}` }}>
                        {char.imageUrl
                          ? <img src={normalizeImageUrl(char.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.User style={{ width: 32, height: 32, color: muted }} /></div>
                        }
                        {char.imageLocked && <div style={{ position: "absolute", bottom: 2, right: 2, background: childAccent, borderRadius: 4, padding: "1px 4px", fontSize: 7, color: "#000", fontWeight: 800 }}>LOCKED</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{char.displayName}</p>
                            {char.imageLocked
                              ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${childAccent}20`, color: childAccent, fontWeight: 700 }}>Look Locked</span>
                              : hasVisual
                              ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${ds.color.lilac}15`, color: ds.color.lilac, fontWeight: 600 }}>AI-described</span>
                              : char.imageUrl
                              ? <span onClick={() => analyzeCharacterImage(char.characterId, char.imageUrl!)} style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${childAccent}10`, color: childAccent, fontWeight: 600, cursor: "pointer" }}>Click to AI-read image</span>
                              : <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${childAccent}10`, color: childAccent, fontWeight: 600 }}>Upload image first</span>
                            }
                          </div>
                          <button
                            onClick={() => { if (confirm(`Remove ${char.displayName} from cast?`)) setCharacters(prev => prev.filter(x => x.characterId !== char.characterId)); }}
                            style={{ background: "#ef444415", border: "1px solid #ef444430", borderRadius: 6, color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 9px", flexShrink: 0 }}>
                            × Remove
                          </button>
                        </div>
                        {visualDesc ? (
                          <p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.5, marginBottom: 4, background: `${ds.color.lilac}06`, padding: "4px 6px", borderRadius: 6, border: `1px solid ${ds.color.lilac}15` }}>
                            <span style={{ color: ds.color.lilac, fontWeight: 600 }}>Visual: </span>{visualDesc.slice(0, 120)}{visualDesc.length > 120 ? "..." : ""}
                          </p>
                        ) : (
                          <p style={{ fontSize: 9, color: childAccent, background: `${childAccent}08`, padding: "4px 6px", borderRadius: 6, marginBottom: 4 }}>
                            Click "Define Appearance" to describe this character so scenes look consistent.
                          </p>
                        )}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                          <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${ds.color.lilac}15`, color: ds.color.lilac, fontWeight: 600 }}>{char.roleType}</span>
                          {char.gender && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${C4}15`, color: C4, fontWeight: 600 }}>{char.gender}</span>}
                          {char.voiceId && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${childAccent}15`, color: childAccent, fontWeight: 600 }}>Voice</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: isEditing ? 12 : 0 }}>
                      <button onClick={() => setEditingCharId(isEditing ? null : char.characterId)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isEditing ? ds.color.lilac : border}`, background: isEditing ? `${ds.color.lilac}15` : "transparent", color: isEditing ? ds.color.lilac : muted, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                        {isEditing ? "Close Builder" : "Define Appearance"}
                      </button>
                      {/* ── Portrait model selector ── */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>Model</span>
                        <select
                          value={charPortraitModel[char.characterId] || (char.tags?.includes("photo-import") ? "fal_flux_pulid" : "segmind_flux")}
                          onChange={e => setCharPortraitModel(prev => ({ ...prev, [char.characterId]: e.target.value }))}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
                            border: "1px solid #ffffff20", background: "#0f172a", color: "#e2e8f0",
                            outline: "none", flex: 1
                          }}>
                          <option value="segmind_flux">Flux Free ($0.0004) — drafts</option>
                          <option value="fal_flux_schnell">Flux Schnell ($0.003) — fast+good</option>
                          <option value="segmind_pruna">Pruna ($0.005) — fast</option>
                          <option value="fal_ideogram_v3_turbo">Ideogram v3 ($0.02) — text/ads</option>
                          <option value="fal_flux_dev">Flux Dev ($0.025) — quality</option>
                          <option value="fal_flux_pro">Flux Pro ($0.05) — best</option>
                          <option value="fal_flux_pulid">Face Lock / PuLID — real photo only</option>
                        </select>
                      </div>
                      <button onClick={() => generateCharacterPortrait(char)} disabled={isGenerating}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: isGenerating ? "#2a2a40" : `linear-gradient(135deg, ${C4}, #0084ff)`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.7 : 1 }}>
                        {isGenerating ? "Generating..." : char.imageUrl ? "Regenerate Portrait" : "Generate Portrait"}
                      </button>
                      {char.imageUrl && (() => {
                        const isAnalyzing = analyzingCharacter === char.characterId;
                        return (
                          <button onClick={() => { if (!isAnalyzing) analyzeCharacterImage(char.characterId, char.imageUrl!); }} disabled={isAnalyzing}
                            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${ds.color.lilac}40`, background: isAnalyzing ? `${ds.color.lilac}20` : `${ds.color.lilac}08`, color: ds.color.lilac, fontSize: 10, fontWeight: 700, cursor: isAnalyzing ? "wait" : "pointer", opacity: isAnalyzing ? 0.8 : 1 }}>
                            {isAnalyzing ? "Reading image..." : "AI Read Look"}
                          </button>
                        );
                      })()}
                      {(() => {
                        const isSaving = savingCharacter === char.characterId;
                        const isSaved = savedCharacter === char.characterId;
                        return (
                          <button onClick={() => { if (!isSaving) saveCharacterToRegistry(char); }} disabled={isSaving}
                            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isSaved ? childAccent : "#e05c2040"}`, background: isSaved ? `${childAccent}18` : "#e05c2008", color: isSaved ? childAccent : "#e05c20", fontSize: 10, fontWeight: 700, cursor: isSaving ? "wait" : "pointer", opacity: isSaving ? 0.7 : 1 }}>
                            {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save Character"}
                          </button>
                        );
                      })()}
                      <button onClick={() => openImagePicker(char.characterId)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #0ea5e940", background: "#0ea5e908", color: "#0ea5e9", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Import Image
                      </button>
                      {char.imageUrl && !char.imageLocked && (
                        <button onClick={() => { setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageLocked: true } : c)); setLastAction(`${char.displayName}'s look is LOCKED`); }}
                          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          Lock this Look
                        </button>
                      )}
                      {char.imageLocked && (
                        <button onClick={() => { setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageLocked: false } : c)); }}
                          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                          Unlock
                        </button>
                      )}
                    </div>

                    {/* Visual Identity Builder */}
                    {isEditing && (
                      <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${ds.color.lilac}20` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.lilac, marginBottom: 10 }}>Visual Identity — fill in what makes this character unique</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Character Type / Species</label>
                            <input value={char.species || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, species: e.target.value } : c))}
                              placeholder='"rabbit", "human", "lion", "young boy"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Body Build / Size</label>
                            <input value={char.bodyBuild || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, bodyBuild: e.target.value } : c))}
                              placeholder='"small and round", "tall and slim"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Fur / Skin / Color Description</label>
                            <input value={char.colorDescription || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, colorDescription: e.target.value } : c))}
                              placeholder='"warm grey fur with white belly", "brown skin"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Face & Eyes</label>
                            <input value={char.faceFeatures || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, faceFeatures: e.target.value } : c))}
                              placeholder='"big round eyes, small button nose, wide smile"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Clothing (be specific)</label>
                            <input value={char.clothingDetails || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, clothingDetails: e.target.value } : c))}
                              placeholder='"red overalls, yellow shirt"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Accessories</label>
                            <input value={char.accessories || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, accessories: e.target.value } : c))}
                              placeholder='"small backpack, red hat"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Age / Posture</label>
                            <input value={char.ageAppearance || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, ageAppearance: e.target.value } : c))}
                              placeholder='"young child, age 6, cheerful expression"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Distinctive Features</label>
                            <input value={char.distinctiveFeatures || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, distinctiveFeatures: e.target.value } : c))}
                              placeholder='"fluffy white tail, very big ears, always smiling"'
                              style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                          </div>
                        </div>
                        {buildVisualDescription(char) && (
                          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: `${ds.color.lilac}08`, border: `1px solid ${ds.color.lilac}20` }}>
                            <p style={{ fontSize: 9, color: ds.color.lilac, fontWeight: 600, marginBottom: 2 }}>→ This is what gets injected into every scene prompt:</p>
                            <p style={{ fontSize: 9, color: "#ccc", lineHeight: 1.6, fontStyle: "italic" }}>
                              CHARACTER {char.displayName.toUpperCase()} (EXACT FIXED APPEARANCE): {buildVisualDescription(char)}
                            </p>
                          </div>
                        )}
                        <button onClick={() => { generateCharacterPortrait(char); setEditingCharId(null); }} disabled={isGenerating}
                          style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C4}, #0084ff)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Generate Portrait from This Description →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Next step CTA */}
          {characters.length > 0 && (
            <div style={{ ...cardStyle, borderColor: `${childAccent}20`, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {characters.filter(c => c.voiceId).length}/{characters.length} characters fully built
                  </p>
                  <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                    {characters.filter(c => !c.voiceId).length > 0
                      ? `${characters.filter(c => !c.voiceId).length} still need AI build — click "Build Story Characters with AI" above`
                      : "All characters ready — proceed to Scene Board"}
                  </p>
                </div>
                <button onClick={() => setActiveTab("sceneBoard")}
                  style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C4}, #0084ff)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                  → Step 3: Scene Board
                </button>
              </div>
            </div>
          )}

          {/* CharacterPicker modal for "Import Existing" */}
          {showCharacterPicker && (
            <>
              <div onClick={() => setShowCharacterPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 299 }} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300, background: "#0f1117", border: "1px solid #ffffff18", borderRadius: 16, width: "min(680px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
                <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #ffffff10", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Import from Character Registry</p>
                  <button onClick={() => setShowCharacterPicker(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}><Icon.X style={{ width: 16, height: 16 }} /></button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  <CharacterPicker
                    onSelect={(char) => {
                      const newChar: CharacterIdentity = {
                        characterId: char.characterId || char.id || `CC_IMP_${Date.now()}`,
                        dbId: char.id,
                        displayName: char.name,
                        roleType: char.role || "supporting",
                        gender: char.gender || "unknown",
                        ageRange: "child",
                        skinTone: "", hairStyle: "", wardrobeStyle: "",
                        speechStyle: "normal", accentType: "",
                        emotionProfile: "", voiceId: char.voiceId || "",
                        voiceType: "childlike", intonation: "playful", language: "English",
                        tags: ["imported"], hasVoice: !!char.voiceId, hasImage: !!char.imageUrl,
                        imageUrl: char.imageUrl ? (char.imageUrl.startsWith("http") || char.imageUrl.startsWith("/api/") ? char.imageUrl : `/api/media/${char.imageUrl.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`) : undefined,
                        visualDescription: char.visualDescription || undefined,
                      };
                      setCharacters(prev => prev.some(c => c.characterId === newChar.characterId) ? prev : [...prev, newChar]);
                      setShowCharacterPicker(false);
                      setLastAction(`Imported "${char.name}"`);
                    }}
                    onCreateNew={() => { window.open("/dashboard/character-voices?returnTo=children-planner", "_blank"); }}
                    compact
                  />
                </div>
              </div>
            </>
          )}

          {/* Image Picker Modal */}
          {imagePickerForCharId && (
            <>
              <div onClick={() => setImagePickerForCharId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 299 }} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300, background: "#0f1117", border: "1px solid #ffffff18", borderRadius: 16, width: "min(680px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
                <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #ffffff10", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Import Image</p>
                    <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Pick an existing image for <strong style={{ color: "#0ea5e9" }}>{characters.find(c => c.characterId === imagePickerForCharId)?.displayName || imagePickerForCharId}</strong></p>
                  </div>
                  <button onClick={() => setImagePickerForCharId(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}><Icon.X style={{ width: 16, height: 16 }} /></button>
                </div>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid #ffffff08", background: "#ffffff04" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9" }}>Upload from computer</span>
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => { const dataUrl = ev.target?.result as string; if (dataUrl && imagePickerForCharId) assignImageToCharacter(imagePickerForCharId, dataUrl); };
                        reader.readAsDataURL(file);
                      }} />
                    <span style={{ fontSize: 9, color: "#666" }}>JPG, PNG, WEBP</span>
                  </label>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {imagePickerLoading ? <p style={{ textAlign: "center", color: "#888", fontSize: 12, padding: 40 }}>Loading assets...</p>
                  : imagePickerAssets.length === 0 ? <div style={{ textAlign: "center", color: "#666", fontSize: 12, padding: 40 }}><p>No images found. Generate portrait images first.</p></div>
                  : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                      {imagePickerAssets.map(asset => {
                        const displayUrl = asset.fileUrl || (asset.filePath ? `/api/media/${asset.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}` : "");
                        if (!displayUrl) return null;
                        return (
                          <div key={asset.id} onClick={() => imagePickerForCharId && assignImageToCharacter(imagePickerForCharId, displayUrl)}
                            style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "2px solid #ffffff10" }}>
                            <img src={displayUrl} alt={asset.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            <div style={{ padding: "5px 6px", background: "#ffffff06" }}>
                              <p style={{ fontSize: 9, color: "#ccc", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{asset.name}</p>
                              {asset.source === "character_registry" && <p style={{ fontSize: 8, color: "#7c3aed", marginTop: 1 }}>Character Registry</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  }
                </div>
              </div>
            </>
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
                Video Model: <span style={{ color: "#fff" }}>{effectiveVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childSafe}40`, background: `${childSafe}10`, color: childSafe, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Image style={{ width: 12, height: 12 }} />
                Image Model: <span style={{ color: "#fff" }}>{effectiveImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
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
                  onClick={() => setGenSeed(Math.floor(Math.random() * 1e9))}
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
              <button key={p.id} onClick={() => { setNarrationProvider(p.id); patchProjectSettings({ narrationProvider: p.id }).catch(() => {}); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${effectiveNarrationProvider === p.id ? p.color : border}`,
                  background: effectiveNarrationProvider === p.id ? `${p.color}12` : "transparent",
                  color: effectiveNarrationProvider === p.id ? p.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
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
              const isActive = effectiveProjectStyle === v.id;
              const [c1, c2] = v.colors.split(",").map(s => s.trim());
              return (
                <button key={v.id} onClick={() => { setVisualStyle(v.id); patchProjectSettings({ visualStyle: v.id }).catch(() => {}); setLastAction(`Visual: ${v.label}`); }}
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 11, color: muted }}>Describe a sound effect and AI generates it for you.</p>
                  <button
                    onClick={async () => {
                      const story = expandedContent || textContent || readAlongText;
                      if (!story.trim()) { setLastAction("Write your story first, then auto-suggest will read it"); return; }
                      setSfxDesc("Reading your story and scenes...");
                      try {
                        const sceneCtx = childScenes.length > 0
                          ? `\nScenes:\n${childScenes.slice(0, 5).map((s, i) => `Scene ${i + 1}: ${s.title || ""} — ${(s.visualDescription || "").slice(0, 100)}`).join("\n")}`
                          : "";
                        const charCtx = savedChars.length > 0 ? `\nCharacters: ${savedChars.map(c => c.name).join(", ")}` : "";
                        const prompt = `You are a children's video sound designer. Read this story carefully and write ONE specific sound effect description (15-25 words) that matches the actual events and mood in the story. Be specific to what happens — mention characters, actions, settings from the story.\n\nStory: ${story.slice(0, 900)}${sceneCtx}${charCtx}\nStyle: ${effectiveProjectStyle || "children's illustration"}, Age: ${ageGroup || "3-8"}, Tone: ${tone || "playful"}\n\nReply with ONLY the sound effect description. No intro text, no quotes.`;
                        const res = await fetch("/api/llm/chat", { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt, role: "fast", maxTokens: 80 }) });
                        const d = await res.json();
                        setSfxDesc((d.text || "").replace(/^["']|["']$/g, "").trim());
                      } catch { setSfxDesc(""); setLastAction("Auto-suggest failed — type a description manually"); }
                    }}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                    ✨ Auto-suggest from story
                  </button>
                </div>
                <textarea value={sfxDesc} onChange={e => setSfxDesc(e.target.value)} rows={3}
                  placeholder="e.g. Happy children laughing and playing, gentle bells ringing, magical sparkle sound..."
                  style={{ width: "100%", background: "#0a0d14", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical" as const, marginBottom: 8 }} />
                <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim() || sfxDesc === "AI is reading your story..."}
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
              { label: "Visual Plan", check: `${VISUAL_STYLES.find(v => v.id === effectiveProjectStyle)?.label} — child-safe colors` },
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
      {/* ASSEMBLY TAB — BUILD YOUR VIDEO                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "assembly" && (
        <div style={{ ...cardStyle, padding: 28 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <Icon.Film style={{ width: 22, height: 22, color: childAccent, flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Assemble Your Video</h2>
              <p style={{ fontSize: 11, color: muted }}>Follow these steps to build your children&apos;s story video.</p>
            </div>
          </div>

          {/* ── Step-by-step readiness checklist ── */}
          <div style={{ ...cardStyle, marginBottom: 20, borderColor: `${childAccent}30`, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 14 }}>Where are you right now?</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>

              {/* Step 1 — story */}
              {(() => {
                const done = !!(expandedContent || textContent);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 1 — Create your story</p>
                      {done
                        ? <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>Story is written and ready.</p>
                        : <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>You have not written a story yet. Go to the Story tab and type or generate your children&apos;s story first.</p>
                      }
                    </div>
                    {!done && (
                      <button onClick={() => setActiveTab("content")}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        Go to Story
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Step 2 — scenes */}
              {(() => {
                const done = childScenes.length > 0;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 2 — Generate scenes</p>
                      {done
                        ? <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{childScenes.length} scene{childScenes.length !== 1 ? "s" : ""} generated.</p>
                        : <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>No scenes yet. Go to Scene Board and press &quot;Generate Scenes&quot; to turn your story into individual video scenes.</p>
                      }
                    </div>
                    {!done && (
                      <button onClick={() => setActiveTab("sceneBoard")}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        Go to Scene Board
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Step 3 — select scenes */}
              {(() => {
                const scenesExist = childScenes.length > 0;
                const done = assemblySelectedIds.length > 0;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 3 — Pick scenes to include</p>
                      {done
                        ? <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{assemblySelectedIds.length} scene{assemblySelectedIds.length !== 1 ? "s" : ""} selected.</p>
                        : scenesExist
                          ? <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>Check the boxes below next to the scenes you want in your video. You can include all of them or just some.</p>
                          : <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>Complete Step 2 first.</p>
                      }
                    </div>
                    {!done && scenesExist && (
                      <button onClick={() => setAssemblySelectedIds(childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}`))}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                        Select All
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Step 4 — assemble */}
              {(() => {
                const done = !!assembledUrl;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 4 — Press Assemble</p>
                      {done
                        ? <p style={{ fontSize: 10, color: childSafe, fontWeight: 600, marginTop: 2 }}>Video is ready! Scroll down to watch it.</p>
                        : <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>When the scenes above are checked, scroll down and click the big Assemble button.</p>
                      }
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>

          {/* ── Scene selection + assemble ── */}
          {childScenes.length > 0 ? (
            <div style={{ ...cardStyle, marginBottom: 20, borderColor: `${childAccent}30` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Film style={{ width: 14, height: 14 }} /> Choose Your Scenes
              </p>
              <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>
                Tick the scenes you want in the final video, then press Assemble. You can also make a video for each scene individually.
              </p>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 10 }}>
                <button onClick={() => setAssemblySelectedIds(childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}`))}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${childSafe}`, background: "transparent", color: childSafe, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Select All</button>
                <button onClick={() => setAssemblySelectedIds([])}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>Deselect All</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
                {childScenes.map(s => {
                  const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
                  const isSelected = assemblySelectedIds.includes(sceneId);
                  const videoUrl = sceneVideos[sceneId];
                  const imageUrl = sceneImages[sceneId] || s.imageUrl;
                  const isGenerating = generatingSceneVideos.has(sceneId);
                  const progress = sceneGenProgress[sceneId];
                  const mediaPref = assemblyMediaPrefs[sceneId];
                  const effectivePref: "image" | "video" = mediaPref ?? (videoUrl ? "video" : "image");
                  return (
                    <div key={s.scene} style={{ background: s2, borderRadius: 10, border: `1px solid ${isSelected ? childAccent : border}`, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <input type="checkbox" checked={isSelected} onChange={e => setAssemblySelectedIds(prev => e.target.checked ? [...prev, sceneId] : prev.filter(id => id !== sceneId))}
                          style={{ marginTop: 4, accentColor: childAccent, flexShrink: 0 }} />
                        {/* Thumbnail */}
                        {imageUrl && (
                          <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                            <img src={imageUrl} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 6, flexWrap: "wrap" as const }}>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: childAccent }}>SC{String(s.scene).padStart(2, "0")}</span>
                              <p style={{ fontSize: 11, color: "#fff", margin: "2px 0" }}>{s.title}</p>
                            </div>
                            {/* Make Video button */}
                            <button onClick={() => makeSceneVideo(s)} disabled={isGenerating}
                              style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: isGenerating ? "#2a2a40" : videoUrl ? `${childSafe}20` : childAccent, color: isGenerating ? muted : videoUrl ? childSafe : "#000", fontSize: 9, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer", flexShrink: 0 }}>
                              {isGenerating ? "..." : videoUrl ? "Regen Vid" : "+ Make Video"}
                            </button>
                          </div>
                          {/* Image / Video toggle — mirrors hybrid.
                              Beat count badge: shows when Gen Max produced multiple beat images
                              for this scene. Click to expand the beat strip below for ticking. */}
                          {(() => {
                            // Multi-image source: prefer Gen Max beats, fall back to Gen 4 variants.
                            // Both behave the same for the picker — user just sees "N images" they can
                            // mix into the assembly.
                            const genMaxBeats = sceneBeatImages[sceneId] || [];
                            const variants = (s.variantUrls && s.variantUrls.length > 1) ? s.variantUrls : [];
                            const beats = genMaxBeats.length > 1 ? genMaxBeats : variants;
                            const totalBeats = beats.length;
                            const onCount = (selectedBeatImages[sceneId] || []).filter(Boolean).length;
                            return (
                              <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                                <span style={{ fontSize: 9, color: muted, alignSelf: "center" }}>USE IN ASSEMBLY:</span>
                                <button
                                  onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "image" }))}
                                  disabled={!imageUrl && totalBeats === 0}
                                  style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${effectivePref === "image" ? childSafe : border}`, background: effectivePref === "image" && (imageUrl || totalBeats > 0) ? `${childSafe}15` : "transparent", color: (imageUrl || totalBeats > 0) ? (effectivePref === "image" ? childSafe : muted) : "#444", fontSize: 9, fontWeight: effectivePref === "image" ? 700 : 400, cursor: (imageUrl || totalBeats > 0) ? "pointer" : "not-allowed" }}>
                                  Image {effectivePref === "image" ? "SELECTED" : (imageUrl || totalBeats > 0) ? "" : "(none)"}
                                </button>
                                <button
                                  onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "video" }))}
                                  disabled={!videoUrl}
                                  style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${effectivePref === "video" ? "#f59e0b" : border}`, background: effectivePref === "video" && videoUrl ? "#f59e0b15" : "transparent", color: videoUrl ? (effectivePref === "video" ? "#f59e0b" : muted) : "#444", fontSize: 9, fontWeight: effectivePref === "video" ? 700 : 400, cursor: videoUrl ? "pointer" : "not-allowed" }}>
                                  Video {effectivePref === "video" ? "SELECTED" : videoUrl ? "" : "(none)"}
                                </button>
                                {/* Max image button — ALWAYS visible per Henry's spec.
                                    Three states based on whether beats exist + opt-in:
                                      A. Beats already generated AND user opted in  → "Max ON (M/N)"  (orange filled)
                                      B. Beats already generated AND user not opted in → "Use Max Image (N)" (orange outline)
                                      C. No beats yet                                  → "+ Gen Max (~N)" (orange dashed) — clicking
                                         fires makeChildSceneBeatImages(scene) which generates beats AND auto-opts the scene in.
                                    Hidden only if scene description is too short to split into multiple beats. */}
                                {(() => {
                                  const isMaxOn = useMaxImageScenes.has(sceneId);
                                  const isGenerating = generatingMaxBeats.has(sceneId);
                                  // If no beats yet, predict count from current description so the button can show "~N".
                                  // Minimum 2 — if scene description is too short to split, we still show the button
                                  // so user can manually trigger Gen Max. They might paste a longer description first.
                                  const split = splitIntoActionBeats(`${s.title}. ${s.visualDescription}`).length;
                                  const predictedBeats = totalBeats > 0
                                    ? totalBeats
                                    : Math.max(split, 2);
                                  const includedCount = isMaxOn
                                    ? (selectedBeatImages[sceneId] || []).filter(Boolean).length
                                    : 1;
                                  // STATE C — beats not yet generated. Button generates AND opts in.
                                  // Bundled with a small count input so user picks N before generating.
                                  if (totalBeats === 0) {
                                    const target = sceneMaxTarget[sceneId] ?? 4;
                                    return (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 0, borderRadius: 6, border: `1px dashed #ff9500`, overflow: "hidden" as const }}>
                                        <input
                                          type="number"
                                          min={1}
                                          max={30}
                                          value={target}
                                          onChange={e => {
                                            const v = Math.max(1, Math.min(30, parseInt(e.target.value) || 4));
                                            setSceneMaxTarget(prev => ({ ...prev, [sceneId]: v }));
                                          }}
                                          title="How many images to generate (1-30)"
                                          style={{ width: 36, padding: "3px 4px", border: "none", background: "transparent", color: "#ff9500", fontSize: 9, fontWeight: 700, textAlign: "center" as const }}
                                        />
                                        <button
                                          onClick={async () => {
                                            if (isGenerating) return;
                                            await makeChildSceneBeatImages(s);
                                            setUseMaxImageScenes(prev => new Set(prev).add(sceneId));
                                          }}
                                          disabled={isGenerating}
                                          title={`Generate ${target} images and append to scene pool`}
                                          style={{
                                            padding: "3px 9px",
                                            border: "none", borderLeft: `1px dashed #ff9500`,
                                            background: isGenerating ? "#2a2040" : "transparent",
                                            color: isGenerating ? muted : "#ff9500",
                                            fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" as const,
                                            cursor: isGenerating ? "not-allowed" : "pointer",
                                          }}>
                                          {isGenerating
                                            ? (maxBeatsProgress[sceneId] || "Generating…")
                                            : `+ Gen Max`}
                                        </button>
                                      </span>
                                    );
                                  }
                                  // STATE A or B — beats exist. Toggle picker.
                                  return (
                                    <button
                                      onClick={() => setUseMaxImageScenes(prev => {
                                        const n = new Set(prev);
                                        if (n.has(sceneId)) {
                                          n.delete(sceneId);
                                        } else {
                                          n.add(sceneId);
                                          if (!selectedBeatImages[sceneId]) {
                                            setSelectedBeatImages(p => ({ ...p, [sceneId]: beats.map(() => true) }));
                                          }
                                        }
                                        return n;
                                      })}
                                      title={isMaxOn
                                        ? `Using ${includedCount} of ${totalBeats} max images — click to revert to single image`
                                        : `Click to use multiple beat images (${totalBeats} available) instead of one`}
                                      style={{
                                        padding: "3px 9px", borderRadius: 6,
                                        border: `1px solid ${isMaxOn ? "#ff9500" : "#ff950060"}`,
                                        background: isMaxOn ? "#ff9500" : "#ff950012",
                                        color: isMaxOn ? "#000" : "#ff9500",
                                        fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" as const,
                                        cursor: "pointer",
                                      }}>
                                      {isMaxOn ? `Max ON (${includedCount}/${totalBeats})` : `Use Max Image (${totalBeats})`}
                                    </button>
                                  );
                                })()}
                                {imageUrl && (
                                  <button onClick={() => setPreviewScene({ url: imageUrl, type: "image", title: s.title })}
                                    style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>
                                    Preview
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                          {/* Multi-image picker — ALWAYS visible when scene has 2+ images (any source).
                              Sources unified: Gen Max beats > Gen 4 variants > current+main pool.
                              Henry's spec: don't hide images behind a click — spread them inline so user
                              sees what's available and ticks/unticks per box. Default: every image included.
                              When 0 ticked, assembly falls back to scene's primary image. */}
                          {(() => {
                            const genMaxBeats = sceneBeatImages[sceneId] || [];
                            const variants = (s.variantUrls && s.variantUrls.length > 1) ? s.variantUrls : [];
                            const beats = genMaxBeats.length > 1 ? genMaxBeats : variants;
                            if (beats.length <= 1) return null;
                            // Auto-opt this scene into multi-image mode the first time the picker renders
                            // with images available — saves the user a click.
                            if (!useMaxImageScenes.has(sceneId)) {
                              setTimeout(() => setUseMaxImageScenes(prev => new Set(prev).add(sceneId)), 0);
                            }
                            return (
                            <div style={{ marginTop: 4, marginBottom: 6, padding: "8px 10px", background: "#ff95000a", border: "1px solid #ff950025", borderRadius: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 9, color: "#ff9500", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                                  Pick which images to include
                                </span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sceneId]: beats.map(() => true) }))}
                                    style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ff950060", background: "transparent", color: "#ff9500", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                    Select All
                                  </button>
                                  <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sceneId]: beats.map(() => false) }))}
                                    style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                                    Deselect All
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                                {beats.map((url, bi) => {
                                  const checked = selectedBeatImages[sceneId]?.[bi] !== false;
                                  return (
                                    <label key={bi}
                                      title={`Image ${bi + 1} — ${checked ? "included" : "skipped"} in assembly`}
                                      style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: 3, borderRadius: 5, border: `2px solid ${checked ? "#ff9500" : "#33334a"}`, background: checked ? "#ff950018" : "transparent", cursor: "pointer", userSelect: "none" as const }}>
                                      <img src={url} alt={`B${bi + 1}`}
                                        style={{ width: 60, height: 44, objectFit: "cover" as const, borderRadius: 3, opacity: checked ? 1 : 0.4 }}
                                        onClick={e => { e.preventDefault(); setPreviewScene({ url, type: "image", title: `${s.title} — Image ${bi + 1}` }); }} />
                                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                        <input type="checkbox" checked={checked}
                                          onChange={e => setSelectedBeatImages(prev => {
                                            const arr = [...(prev[sceneId] || beats.map(() => true))];
                                            arr[bi] = e.target.checked;
                                            return { ...prev, [sceneId]: arr };
                                          })}
                                          style={{ width: 11, height: 11 }} />
                                        <span style={{ fontSize: 8, color: checked ? "#ff9500" : muted, fontWeight: 700 }}>#{bi + 1}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                            );
                          })()}
                          {progress && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ height: 3, borderRadius: 2, background: border }}>
                                <div style={{ width: `${progress.percent}%`, height: "100%", borderRadius: 2, background: childAccent, transition: "width 0.3s" }} />
                              </div>
                              <p style={{ fontSize: 9, color: childAccent, marginTop: 2 }}>{progress.message}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Audio panel — always visible in Assembly, with quick-generate buttons */}
              <div style={{ ...cardStyle, marginBottom: 12, borderColor: `${childAccent}30`, padding: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: childAccent, marginBottom: 10 }}>Audio for Video</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {/* Narration */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <p style={{ fontSize: 9, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, flex: 1 }}>Narration</p>
                      <button
                        onClick={async () => {
                          const text = (narrationText || readAlongText || textContent || "").trim();
                          if (!text) { setUiError("Write story content first"); return; }
                          setLastAction("Generating narration...");
                          try {
                            // BUG-09 fix: use narrationProvider state instead of hardcoded "piper"
                            const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 3000), provider: effectiveNarrationProvider || "piper", speed: 0.9 }) });
                            const d = await r.json() as { audioUrl?: string };
                            if (d.audioUrl) { setNarratorAudioUrl(d.audioUrl); setLastAction("Narration ready"); }
                            else setLastAction("Narration generation failed");
                          } catch { setLastAction("Narration error"); }
                        }}
                        style={{ padding: "2px 8px", borderRadius: 6, border: "none", background: `${childAccent}20`, color: childAccent, fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                        {narratorAudioUrl ? "Regen" : "Generate"}
                      </button>
                    </div>
                    {narratorAudioUrl
                      ? <audio src={narratorAudioUrl} controls style={{ width: "100%", height: 28 }} />
                      : <p style={{ fontSize: 9, color: "#555", fontStyle: "italic" }}>Not generated yet</p>}
                  </div>
                  {/* Music */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <p style={{ fontSize: 9, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, flex: 1 }}>Background Music</p>
                      <button
                        onClick={async () => {
                          setLastAction("Generating music...");
                          try {
                            // CHILDREN-MUSIC-FIX (2026-05-08):
                            // Old prompt was a generic one-liner ("calm children's story background music").
                            // Music providers (Suno, Stable Audio) need instrument + tempo + structure cues
                            // to produce something usable. Rich prompt below names instruments that work for
                            // children content and explicitly excludes harsh percussion / synths.
                            //
                            // Duration: was hardcoded 30s — too short, music cuts off mid-narration. We try
                            // to read the narrator audio's duration first; if unavailable, default to 90s
                            // (children stories are typically 1-3 min) so the track loops/fits.
                            const isSoft = (tone || "soft") === "soft";
                            const richPrompt = isSoft
                              ? "Gentle children's lullaby, soft solo piano with delicate music box and warm light strings, slow peaceful tempo around 70 BPM, calm comforting atmosphere, fairy tale storybook mood, fully instrumental, NO vocals, NO heavy drums, NO percussion, NO synths, dreamy bedtime story background"
                              : "Playful children's adventure music, light cheerful ukulele with bright glockenspiel and gentle flute, moderate uplifting tempo around 100 BPM, joyful curious atmosphere, fairy tale wonder, fully instrumental, NO vocals, soft brushed percussion only, NO electric guitar, NO heavy drums, storybook adventure background";
                            const moodTag = isSoft ? "calm" : "playful";

                            // Narrator-audio probe → use real duration when we have it.
                            let dur = 90;
                            if (narratorAudioUrl) {
                              try {
                                const probed = await new Promise<number>((resolve) => {
                                  const a = new Audio(narratorAudioUrl);
                                  a.addEventListener("loadedmetadata", () => resolve(isFinite(a.duration) ? a.duration : 0));
                                  a.addEventListener("error", () => resolve(0));
                                  setTimeout(() => resolve(0), 4000);
                                });
                                if (probed > 10) dur = Math.min(Math.max(Math.ceil(probed), 30), 300);
                              } catch { /* keep default */ }
                            }

                            const assemblyTier = SOUND_TIERS.find(t => t.id === effectiveSoundTier);
                            const assemblyProviderKey = assemblyTier?.providerKey ?? "stock";
                            const r = await fetch("/api/music/generate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                prompt: richPrompt,
                                durationSeconds: dur,
                                genre: "children",
                                mood: moodTag,
                                hasLyrics: false,
                                providerKey: assemblyProviderKey,
                              }),
                            });
                            const d = await r.json() as { url?: string; audioUrl?: string };
                            const url = d.url ?? d.audioUrl ?? "";
                            if (url) { setGeneratedMusicUrl(url); setSelectedMusicUrl(url); setLastAction(`Music ready (${moodTag}, ${dur}s)`); }
                            else setLastAction("Music generation failed");
                          } catch { setLastAction("Music error"); }
                        }}
                        style={{ padding: "2px 8px", borderRadius: 6, border: "none", background: "#a855f720", color: "#a855f7", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                        {selectedMusicUrl || generatedMusicUrl ? "Regen" : "Generate"}
                      </button>
                    </div>
                    {(selectedMusicUrl || generatedMusicUrl)
                      ? <audio src={selectedMusicUrl || generatedMusicUrl || ""} controls style={{ width: "100%", height: 28 }} />
                      : <p style={{ fontSize: 9, color: "#555", fontStyle: "italic" }}>Not generated yet</p>}
                  </div>
                </div>
              </div>

              {/* AI Supervisor — auto-checks + fixes audio before assembly */}
              <div style={{ ...cardStyle, marginBottom: 12, borderColor: aiSupervisorReport?.ok ? `${childSafe}40` : "#7c3aed50", padding: 14, background: aiSupervisorRunning ? "#0a0010" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 2 }}>AI Supervisor</p>
                    <p style={{ fontSize: 9, color: muted }}>Checks scenes, audio, music, SFX — auto-generates narration. Run anytime.</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {aiSupervisorReport && !aiSupervisorRunning && (
                      <button onClick={() => { setAiSupervisorReport(null); runAiSupervisor(); }}
                        style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid #7c3aed50`, background: "transparent", color: "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Run Again
                      </button>
                    )}
                    <button onClick={runAiSupervisor} disabled={aiSupervisorRunning}
                      style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: aiSupervisorRunning ? "#2a2040" : "linear-gradient(135deg, #7c3aed, #a855f7)", color: aiSupervisorRunning ? muted : "#fff", fontSize: 11, fontWeight: 700, cursor: aiSupervisorRunning ? "not-allowed" : "pointer" }}>
                      {aiSupervisorRunning ? "Checking + Fixing..." : aiSupervisorReport ? "Run AI Check Again" : "Run AI Check & Fix"}
                    </button>
                  </div>
                </div>
                {aiSupervisorReport && (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: aiSupervisorReport.ok ? childSafe : "#f59e0b" }}>
                      {aiSupervisorReport.ok ? "✓" : "⚠"} {aiSupervisorReport.summary}
                    </p>
                    {aiSupervisorReport.fixed.map((f, i) => (
                      <p key={`fix-${i}`} style={{ fontSize: 10, color: childSafe, marginTop: 1 }}>✓ {f}</p>
                    ))}
                    {aiSupervisorReport.issues.map((issue, i) => {
                      const lower = issue.toLowerCase();
                      const fixLabel = lower.includes("sfx") || lower.includes("sound effect") ? "→ Sound tab" :
                        lower.includes("music") ? "→ Sound tab" :
                        lower.includes("narration") ? "→ Generate Narration" :
                        lower.includes("subtitle") ? "→ Subtitle Style" :
                        lower.includes("scene") || lower.includes("image") ? "→ Scene Board" : null;
                      const fixAction = lower.includes("sfx") || lower.includes("music") ? () => setActiveTab("sound") :
                        lower.includes("narration") ? () => runAiSupervisor() :
                        lower.includes("scene") || lower.includes("image") ? () => setActiveTab("sceneBoard") : null;
                      return (
                        <div key={`iss-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 1, flex: 1 }}>⚠ {issue}</p>
                          {fixLabel && fixAction && (
                            <button onClick={fixAction} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #f59e0b40", background: "#f59e0b15", color: "#f59e0b", fontSize: 8, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {fixLabel}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Subtitle style — rich configurator */}
              <div style={{ marginBottom: 6 }}>
                <SubtitleStyler value={effectiveSubtitleConfig} onChange={(newCfg) => { setSubtitleConfig(newCfg); patchProjectSettings({ subtitleMode: newCfg.mode, subtitleHighlight: newCfg.highlightColor, subtitleEnabled: newCfg.mode !== "none" }).catch(() => {}); }} accentColor={childAccent} />
              </div>

              {/* Narration ↔ Subtitle match check */}
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={async () => {
                    setSubtitleMatchResult({ status: "checking", note: "Checking..." });
                    try {
                      const script = expandedContent || textContent || "";
                      if (!script.trim()) { setSubtitleMatchResult({ status: "warn", note: "No story text to check against." }); return; }
                      const res = await fetch("/api/free-mode/enhance", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rawPrompt: `Check if these subtitle settings match the narration content. Subtitle mode: "${effectiveSubtitleConfig.mode}", position: "${effectiveSubtitleConfig.position}". Story: "${script.slice(0,300)}". Reply in one line: does the subtitle style match? Say MATCH or MISMATCH and why.`, mode: "text_to_video" }) });
                      const d = await res.json() as { enhanced?: string };
                      const result = (d.enhanced || "").toLowerCase();
                      setSubtitleMatchResult({ status: result.includes("match") && !result.includes("mismatch") ? "ok" : "warn", note: d.enhanced || "Unable to check" });
                    } catch { setSubtitleMatchResult({ status: "warn", note: "Check failed" }); }
                  }}
                  style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Check Narration ↔ Subtitle Match
                </button>
                {subtitleMatchResult && (
                  <p style={{ fontSize: 9, color: subtitleMatchResult.status === "ok" ? childSafe : subtitleMatchResult.status === "checking" ? muted : "#f59e0b", flex: 1 }}>
                    {subtitleMatchResult.status === "ok" ? "✓" : subtitleMatchResult.status === "checking" ? "…" : "⚠"} {subtitleMatchResult.note.slice(0,120)}
                  </p>
                )}
              </div>

              {/* Intro / Outro — AI generated title cards */}
              <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Intro & Outro</p>
                <p style={{ fontSize: 9, color: muted, marginBottom: 10 }}>AI generates a cinematic title card. Prepended/appended to your video.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {/* Intro */}
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Intro</span>
                      {introUrl && <button onClick={() => setIntroUrl(null)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>Remove</button>}
                    </div>
                    {introUrl ? (
                      <video src={introUrl} controls style={{ width: "100%", maxHeight: 80, borderRadius: 6 }} />
                    ) : (
                      <div style={{ height: 60, background: s2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${border}` }}>
                        <span style={{ fontSize: 9, color: muted }}>No intro</span>
                      </div>
                    )}
                    <button
                      disabled={generatingIntro}
                      onClick={async () => {
                        setGeneratingIntro(true);
                        try {
                          const res = await fetch("/api/video/title-card", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: "intro",
                              studioName: "GIO HOME AI STUDIO",
                              title: contentParam || "My Story",
                              duration: 4,
                            }),
                          });
                          const data = await res.json();
                          if (data.videoUrl) setIntroUrl(data.videoUrl);
                          else setLastAction(`Intro failed: ${data.error ?? "unknown"}`);
                        } catch (err) {
                          setLastAction(`Intro error: ${err instanceof Error ? err.message : "unknown"}`);
                        } finally {
                          setGeneratingIntro(false);
                        }
                      }}
                      style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${childAccent}50`, background: generatingIntro ? "#0a0020" : `${childAccent}15`, color: generatingIntro ? muted : childAccent, fontSize: 9, fontWeight: 700, cursor: generatingIntro ? "not-allowed" : "pointer" }}>
                      {generatingIntro ? "Generating Intro..." : introUrl ? "Regen Intro" : "Generate AI Intro"}
                    </button>
                  </div>
                  {/* Outro */}
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Outro</span>
                      {outroUrl && <button onClick={() => setOutroUrl(null)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>Remove</button>}
                    </div>
                    {outroUrl ? (
                      <video src={outroUrl} controls style={{ width: "100%", maxHeight: 80, borderRadius: 6 }} />
                    ) : (
                      <div style={{ height: 60, background: s2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${border}` }}>
                        <span style={{ fontSize: 9, color: muted }}>No outro</span>
                      </div>
                    )}
                    <button
                      disabled={generatingOutro}
                      onClick={async () => {
                        setGeneratingOutro(true);
                        try {
                          const castList = characters
                            .filter(c => c.voiceId)
                            .map(c => ({ characterName: c.displayName, actorName: c.voiceId || c.displayName }))
                            .slice(0, 6);
                          const res = await fetch("/api/video/title-card", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: "outro",
                              studioName: "GIO HOME AI STUDIO",
                              title: contentParam || "My Story",
                              cast: castList,
                              director: writtenBy || undefined,
                              producer: madeBy || undefined,
                              username: ideaFrom || undefined,
                              duration: 5,
                            }),
                          });
                          const data = await res.json();
                          if (data.videoUrl) setOutroUrl(data.videoUrl);
                          else setLastAction(`Outro failed: ${data.error ?? "unknown"}`);
                        } catch (err) {
                          setLastAction(`Outro error: ${err instanceof Error ? err.message : "unknown"}`);
                        } finally {
                          setGeneratingOutro(false);
                        }
                      }}
                      style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid #34d39950`, background: generatingOutro ? "#0a0020" : "#34d39915", color: generatingOutro ? muted : "#34d399", fontSize: 9, fontWeight: 700, cursor: generatingOutro ? "not-allowed" : "pointer" }}>
                      {generatingOutro ? "Generating Outro..." : outroUrl ? "Regen Outro" : "Generate AI Outro"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Credits — Written by / Made by / Idea from */}
              <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Story Credits</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Written by</label>
                    <input value={writtenBy} onChange={e => setWrittenBy(e.target.value)} placeholder="Your name"
                      style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Made by</label>
                    <input value={madeBy} onChange={e => setMadeBy(e.target.value)} placeholder="Studio / creator"
                      style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Idea from</label>
                    <input value={ideaFrom} onChange={e => setIdeaFrom(e.target.value)} placeholder="Original idea by..."
                      style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
                  </div>
                </div>
              </div>

              {/* Status / readiness banner */}
              {assemblySelectedIds.length === 0 ? (
                <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>⚠ No scenes selected yet.</p>
                  <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Check the boxes next to the scenes above to choose which ones go into your video. You can select all of them or just a few.</p>
                </div>
              ) : (
                <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
                  <p style={{ fontSize: 12, color: childSafe, fontWeight: 700 }}>Ready to assemble {assemblySelectedIds.length} scene{assemblySelectedIds.length !== 1 ? "s" : ""} into your video!</p>
                  <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Press the button below when you are ready. This may take a minute.</p>
                </div>
              )}

              {/* Big assemble button */}
              <button onClick={assembleMovie} disabled={assembling || assemblySelectedIds.length === 0}
                style={{ width: "100%", padding: "16px 20px", borderRadius: 14, border: "none", background: (assembling || assemblySelectedIds.length === 0) ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: assemblySelectedIds.length === 0 ? muted : "#fff", fontSize: 16, fontWeight: 800, cursor: (assembling || assemblySelectedIds.length === 0) ? "not-allowed" : "pointer", marginBottom: 12, letterSpacing: 0.3 }}>
                {assembling
                  ? "Assembling your story video... please wait"
                  : assembledUrl
                    ? "Assemble Again (overwrite)"
                    : assemblySelectedIds.length === 0
                      ? "Select scenes above to assemble"
                      : `Assemble ${assemblySelectedIds.length} Scene${assemblySelectedIds.length !== 1 ? "s" : ""} into Story Video`}
              </button>

              {assembledUrl && (
                <div style={{ padding: "14px 16px", borderRadius: 12, background: `${childSafe}08`, border: `1px solid ${childSafe}30`, marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: childSafe, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon.Check style={{ width: 14, height: 14 }} /> Your story video is ready!
                  </p>
                  <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 240, borderRadius: 10 }} />
                  <p style={{ fontSize: 10, color: muted, marginTop: 8 }}>Happy with the result? Go to <strong style={{ color: "#fff" }}>Final Check</strong> tab to review and approve it before exporting.</p>
                  <button onClick={() => setActiveTab("review2")}
                    style={{ marginTop: 8, padding: "8px 18px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Go to Final Check
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "24px 20px", borderRadius: 14, background: `${childAccent}06`, border: `1px dashed ${border}`, textAlign: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No scenes yet. You need scenes before you can assemble a video.</p>
              <button onClick={() => setActiveTab("sceneBoard")}
                style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Go to Scene Board
              </button>
            </div>
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

          {/* ── Assembly status summary (scene selection moved to Assembly tab) ── */}
          {assembledUrl && (
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: `${childSafe}30`, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: childSafe, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Icon.Check style={{ width: 14, height: 14 }} /> Video assembled ({assemblySelectedIds.length} scene{assemblySelectedIds.length !== 1 ? "s" : ""})
              </p>
              <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 180, borderRadius: 8 }} />
            </div>
          )}
          {!assembledUrl && (
            <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: `${childAccent}06`, border: `1px solid ${border}` }}>
              <p style={{ fontSize: 12, color: muted }}>No video assembled yet. Go to the <strong style={{ color: "#fff" }}>Assembly</strong> tab first to build your video, then come back here for the final check.</p>
              <button onClick={() => setActiveTab("assembly")} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                Go to Assembly
              </button>
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#fff", fontWeight: 600, minWidth: 60 }}>Layer 1</span>
              <select value={effectiveNarrationProvider} onChange={e => { setNarrationProvider(e.target.value as typeof narrationProvider); patchProjectSettings({ narrationProvider: e.target.value }).catch(() => {}); }}
                style={{ flex: 1, background: ds.color.paper, border: `1px solid ${ds.color.line}`, borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                <option value="piper">Piper (free local)</option>
                <option value="fal-narrator">FAL Narrator (cloud)</option>
                <option value="elevenlabs">ElevenLabs (premium)</option>
                <option value="karaoke">Karaoke (browser)</option>
              </select>
            </div>
            {/* Speed + generate row */}
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

          {/* ── Character Voices — only actors in THIS project, not the full library ── */}
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

            {/* GHS Music Tier Selection */}
            <p style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 8 }}>Music Source</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 12 }}>
              {/* GHS Standard */}
              <button data-testid="music-tier-stock" onClick={() => setMusicTier("stock")}
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "stock" ? "#a78bfa" : "rgba(255,255,255,0.07)"}`, background: musicTier === "stock" ? "rgba(167,139,250,0.1)" : "#151518", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "stock" ? "#a78bfa" : "#c5c5c8" }}>GHS Standard</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Stock Library — always available</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#7ae0c3", fontFamily: "'JetBrains Mono', monospace", background: "rgba(122,224,195,0.08)", border: "1px solid rgba(122,224,195,0.2)", borderRadius: 4, padding: "2px 6px" }}>FREE</span>
              </button>
              {/* GHS Pro */}
              <button data-testid="music-tier-ghs-pro" onClick={() => setMusicTier("ghs_pro")}
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${musicTier === "ghs_pro" ? "#7cc4ff" : "rgba(255,255,255,0.07)"}`, background: musicTier === "ghs_pro" ? "rgba(124,196,255,0.08)" : "#151518", cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_pro" ? "#7cc4ff" : "#c5c5c8" }}>GHS Pro</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>FAL Stable Audio — instrumental, up to 47s</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#7cc4ff", fontFamily: "'JetBrains Mono', monospace", background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 4, padding: "2px 6px" }}>MID</span>
              </button>
              {/* GHS Classic */}
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
                    {/* Hidden file input for Import */}
                    <input
                      type="file"
                      accept="image/*"
                      ref={el => { importFileRefs.current[sceneId] = el; }}
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => {
                          const url = ev.target?.result as string;
                          if (url) {
                            setSceneImages(prev => ({ ...prev, [sceneId]: url }));
                            setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, imageUrl: url } : s));
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                    />
                    {/* Image area */}
                    <div style={{ height: 150, background: s2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", cursor: sceneImg ? "pointer" : "default" }}
                      onClick={() => sceneImg && setLightboxImage(sceneImg)}>
                      {sceneImg ? (
                        <img src={sceneImg} alt={scene.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Icon.Image style={{ width: 32, height: 32, color: muted, opacity: 0.3 }} />
                      )}
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "3px 8px" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: childAccent }}>{sceneId.toUpperCase()}</span>
                      </div>
                      {/* Top-right: Preview + Import */}
                      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                        {sceneImg && (
                          <button
                            onClick={e => { e.stopPropagation(); setLightboxImage(sceneImg); }}
                            title="Preview full-size"
                            style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                            Preview
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); importFileRefs.current[sceneId]?.click(); }}
                          title="Import image from file"
                          style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "rgba(0,0,0,0.7)", color: "#a78bfa", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                          Import
                        </button>
                      </div>
                      {/* Bottom-right: Style override + Gen 4 + Regen */}
                      <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={sceneStyles[sceneId] || effectiveProjectStyle || "storybook"}
                          onChange={e => { e.stopPropagation(); setSceneStyles(prev => ({ ...prev, [sceneId]: e.target.value })); }}
                          onClick={e => e.stopPropagation()}
                          title="Override style for this scene"
                          style={{ padding: "0 4px", height: 26, borderRadius: 7, border: "1px solid #7c3aed40", background: "rgba(15,23,42,0.9)", color: "#c084fc", fontSize: 8, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          <option value="3d-cinematic">3D Cin</option>
                          <option value="realistic">Real</option>
                          <option value="nollywood">Nollywood</option>
                          <option value="2d-cartoon">2D Cart</option>
                          <option value="anime">Anime</option>
                          <option value="storybook">Story</option>
                          <option value="comic">Comic</option>
                        </select>
                        <button
                          onClick={e => { e.stopPropagation(); generateSceneBoardImageVariations(scene); }}
                          disabled={isGenImg || isGenVar}
                          title="Generate 4 variations"
                          style={{ padding: "5px 9px", borderRadius: 7, border: "none", background: isGenVar ? "#2a2040" : "#7c3aed30", color: isGenVar ? muted : "#a78bfa", fontSize: 9, fontWeight: 700, cursor: isGenImg || isGenVar ? "not-allowed" : "pointer" }}>
                          {isGenVar ? "Gen…" : "Gen 4"}
                        </button>
                        {/* Gen Max — one image per action beat. Each beat becomes a separate
                            assembly segment when the scene is rendered into the final video. */}
                        {(() => {
                          const beats = splitIntoActionBeats(`${scene.title}. ${scene.visualDescription}`);
                          const isMaxing = generatingMaxBeats.has(sceneId);
                          if (beats.length <= 1 && !sceneBeatImages[sceneId]?.length) return null;
                          return (
                            <button
                              onClick={e => { e.stopPropagation(); makeChildSceneBeatImages(scene); }}
                              disabled={isGenImg || isGenVar || isMaxing}
                              title={`Generate one image per action beat (${beats.length} beats)`}
                              style={{ padding: "5px 9px", borderRadius: 7, border: "none",
                                background: isMaxing ? "#2a2040" : "linear-gradient(135deg,#ff6b00,#ff9500)",
                                color: "#fff", fontSize: 9, fontWeight: 700,
                                cursor: (isGenImg || isGenVar || isMaxing) ? "not-allowed" : "pointer",
                                whiteSpace: "nowrap" as const }}>
                              {isMaxing ? (maxBeatsProgress[sceneId] || "…") : `Gen Max (${beats.length})`}
                            </button>
                          );
                        })()}
                        <button
                          onClick={e => { e.stopPropagation(); generateSceneBoardImage(scene); }}
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
                    {/* Beat thumbnails — Gen Max output. Each thumbnail has a checkbox.
                        Ticked beats are expanded into multiple assembly segments. */}
                    {sceneBeatImages[sceneId]?.length > 0 && (
                      <div style={{ padding: "6px 8px", background: s2, borderTop: `1px solid ${border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 8, color: muted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                            Beats — tick to include in assembly
                          </span>
                          <span style={{ fontSize: 8, color: childAccent }}>
                            {(selectedBeatImages[sceneId] || []).filter(Boolean).length}/{sceneBeatImages[sceneId].length} on
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 4, overflowX: "auto" as const, paddingBottom: 2 }}>
                          {sceneBeatImages[sceneId].map((url, bi) => {
                            const checked = selectedBeatImages[sceneId]?.[bi] !== false;
                            return (
                              <div key={bi} style={{ flexShrink: 0, textAlign: "center" }}>
                                <img src={url} alt={`Beat ${bi + 1}`}
                                  style={{ width: 56, height: 42, borderRadius: 4, objectFit: "cover" as const, display: "block", border: `2px solid ${checked ? childAccent : "#33334a"}`, opacity: checked ? 1 : 0.4, cursor: "zoom-in" }}
                                  onClick={e => { e.stopPropagation(); setPreviewScene({ url, type: "image", title: `${scene.title} — Beat ${bi + 1}` }); }} />
                                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 2, cursor: "pointer", userSelect: "none" as const }}>
                                  <input type="checkbox" checked={checked}
                                    onChange={e => setSelectedBeatImages(prev => {
                                      const arr = [...(prev[sceneId] || sceneBeatImages[sceneId].map(() => true))];
                                      arr[bi] = e.target.checked;
                                      return { ...prev, [sceneId]: arr };
                                    })}
                                    style={{ width: 11, height: 11, cursor: "pointer" }} />
                                  <span style={{ fontSize: 7, color: checked ? "#fff" : muted }}>B{bi + 1}</span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Content area */}
                    <div style={{ padding: "12px 14px" }}>
                      {/* Scene header: type badge + title editable + delete */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                        {/* Scene type badge: Video-led if video exists, Image-led otherwise */}
                        <span style={{
                          fontSize: 7, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0, marginTop: 2,
                          background: sceneVideos[sceneId] ? `${childSafe}20` : `${childAccent}15`,
                          color: sceneVideos[sceneId] ? childSafe : childAccent,
                          border: `1px solid ${sceneVideos[sceneId] ? childSafe : childAccent}40`,
                          textTransform: "uppercase" as const, letterSpacing: "0.08em",
                        }}>
                          {sceneVideos[sceneId] ? "Video-led" : "Image-led"}
                        </span>
                        {/* Scene title — inline editable textarea with 500ms debounce auto-save */}
                        <textarea
                          value={scene.title}
                          rows={1}
                          onChange={e => {
                            const val = e.target.value;
                            setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, title: val } : s));
                            clearTimeout(sceneTitleTimers.current[sceneId]);
                            sceneTitleTimers.current[sceneId] = setTimeout(() => {
                              // title auto-saved to state — persisted on OK Save
                            }, 500);
                          }}
                          style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${border}`, borderRadius: 0, padding: "2px 0", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.3 }}
                          placeholder="Scene title..."
                        />
                        {/* Delete scene — soft delete to archive */}
                        <button
                          onClick={() => archiveScene(scene.scene)}
                          title="Move to archive (not permanently deleted)"
                          style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid #ef444440", background: "#ef444410", color: "#ef4444", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0, marginTop: 1 }}>
                          Archive
                        </button>
                      </div>

                      {/* Scene description — editable inline textarea */}
                      <textarea
                        value={scene.visualDescription}
                        onChange={e => setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, visualDescription: e.target.value } : s))}
                        style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#ccc", fontSize: 10, outline: "none", resize: "vertical", minHeight: 56, marginBottom: 6 }}
                        placeholder="Scene description (editable)..."
                      />

                      {/* Per-scene: SFX + Scene Music + continuous motion + duration picker */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const, marginTop: 8, marginBottom: 8 }}>
                        <button
                          onClick={() => generateSceneSfx(sceneId, scene.visualDescription ?? "")}
                          disabled={generatingSceneSfx.has(sceneId)}
                          title="Auto-extract SFX cues from scene text"
                          style={{
                            padding: "4px 9px", fontSize: 10, borderRadius: 6, border: "1px solid #7c3aed",
                            background: generatingSceneSfx.has(sceneId) ? "#3b2a6e" : "#1a0a3a",
                            color: "#c4b5fd", cursor: generatingSceneSfx.has(sceneId) ? "wait" : "pointer",
                          }}>
                          {generatingSceneSfx.has(sceneId) ? "SFX..." : "AI SFX"}
                        </button>

                        {/* Scene Music button */}
                        <button
                          onClick={() => generateSceneMusic(sceneId, scene.visualDescription ?? "", scene.title)}
                          disabled={generatingSceneMusic.has(sceneId)}
                          title="Generate music mood for this scene"
                          style={{
                            padding: "4px 9px", fontSize: 10, borderRadius: 6,
                            border: `1px solid ${sceneMusicUrls[sceneId] ? childSafe : "#4a5568"}`,
                            background: generatingSceneMusic.has(sceneId) ? "#1a2a1a" : sceneMusicUrls[sceneId] ? `${childSafe}15` : "transparent",
                            color: generatingSceneMusic.has(sceneId) ? muted : sceneMusicUrls[sceneId] ? childSafe : muted,
                            cursor: generatingSceneMusic.has(sceneId) ? "wait" : "pointer",
                          }}>
                          {generatingSceneMusic.has(sceneId) ? "Music..." : sceneMusicUrls[sceneId] ? "Music ✓" : "Scene Music"}
                        </button>

                        {/* Continuous Motion toggle */}
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#a78bfa", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={sceneContinuousMotion[sceneId]?.enabled ?? false}
                            onChange={e => setSceneContinuousMotion(prev => ({
                              ...prev,
                              [sceneId]: { enabled: e.target.checked, targetSec: prev[sceneId]?.targetSec ?? 10 },
                            }))}
                          />
                          Motion
                        </label>

                        {/* Duration picker — shown when continuous motion is on */}
                        {sceneContinuousMotion[sceneId]?.enabled && (
                          <select
                            value={sceneContinuousMotion[sceneId]?.targetSec ?? 10}
                            onChange={e => setSceneContinuousMotion(prev => ({
                              ...prev,
                              [sceneId]: { ...prev[sceneId], targetSec: Number(e.target.value) },
                            }))}
                            style={{ padding: "2px 5px", fontSize: 10, borderRadius: 4, border: "1px solid #4c1d95", background: "#1a0a3a", color: "#c4b5fd" }}>
                            {[5, 10, 15, 20, 30].map(s => <option key={s} value={s}>{s}s</option>)}
                          </select>
                        )}
                      </div>

                      {/* Narration duration selector + OK Save */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 9, color: muted, fontWeight: 600, whiteSpace: "nowrap" as const }}>Narr:</span>
                        {(["short", "medium", "long"] as const).map(d => (
                          <button key={d} onClick={() => setSceneDurations(prev => ({ ...prev, [sceneId]: d }))}
                            style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${(sceneDurations[sceneId] || "medium") === d ? childAccent : border}`, background: (sceneDurations[sceneId] || "medium") === d ? `${childAccent}20` : "transparent", color: (sceneDurations[sceneId] || "medium") === d ? childAccent : muted, fontSize: 8, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const }}>
                            {d}
                          </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => {
                            fetch("/api/hybrid/scene-plan", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                projectId: `children_${contentParam || "story"}_${topicParam || "default"}`,
                                title: `Children Story — ${contentParam || "story"}`,
                                scenes: childScenes.map(cs => ({
                                  sceneId: cs.scene, description: cs.visualDescription, title: cs.title,
                                })),
                              }),
                            }).catch(() => null);
                            setLastAction(`Scene ${scene.scene} saved`);
                          }}
                          style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${childSafe}40`, background: `${childSafe}10`, color: childSafe, fontSize: 8, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                          OK Save
                        </button>
                      </div>

                      {/* Action row: Preview (lightbox) + AI Editor + Make Video */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" as const }}>
                        {sceneImg && (
                          <button
                            onClick={() => setLightboxImage(sceneImg)}
                            title="Preview full-size (lightbox)"
                            style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #38bdf840", background: "#38bdf810", color: "#38bdf8", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                            Preview
                          </button>
                        )}
                        <button
                          onClick={() => handlePolishScene(sceneId, scene.visualDescription, "polish")}
                          disabled={polishingScene === sceneId}
                          data-testid={`polish-btn-${sceneId}`}
                          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #a855f770", background: polishingScene === sceneId ? "#a855f715" : "transparent", color: polishingScene === sceneId ? muted : "#c084fc", fontSize: 9, fontWeight: 700, cursor: polishingScene === sceneId ? "not-allowed" : "pointer" }}>
                          {polishingScene === sceneId ? "Editing..." : "AI Editor"}
                        </button>
                        {/* Make Video — POST /api/hybrid/scene-video */}
                        <button
                          onClick={() => makeSceneVideo(scene)}
                          disabled={generatingSceneVideos.has(sceneId)}
                          title="Generate video clip — POST /api/hybrid/scene-video"
                          style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${childSafe}50`, background: generatingSceneVideos.has(sceneId) ? `${childSafe}08` : `${childSafe}12`, color: generatingSceneVideos.has(sceneId) ? muted : childSafe, fontSize: 9, fontWeight: 700, cursor: generatingSceneVideos.has(sceneId) ? "not-allowed" : "pointer" }}>
                          {generatingSceneVideos.has(sceneId) ? "Making..." : sceneVideos[sceneId] ? "Vid ✓" : "Make Video"}
                        </button>
                      </div>

                      {/* Video preview if generated */}
                      {sceneVideos[sceneId] && (
                        <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", border: `1px solid ${childSafe}30` }}>
                          <video src={sceneVideos[sceneId]} controls loop style={{ width: "100%", maxHeight: 120, display: "block" }} />
                        </div>
                      )}

                      {/* Scene music preview if generated */}
                      {sceneMusicUrls[sceneId] && (
                        <div style={{ marginBottom: 8, padding: "6px 8px", borderRadius: 7, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
                          <p style={{ fontSize: 8, color: childSafe, marginBottom: 4, fontWeight: 700 }}>Scene Music</p>
                          <audio src={sceneMusicUrls[sceneId]} controls style={{ width: "100%", height: 28 }} />
                        </div>
                      )}

                      {/* Characters in scene — assigned chips + picker from both savedChars + characters registry */}
                      <div>
                        <p style={{ fontSize: 9, color: muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 1 }}>Characters in scene</p>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, alignItems: "center" }}>
                          {assignedChars.length === 0 && (
                            <span style={{ fontSize: 9, color: muted, fontStyle: "italic" }}>None assigned</span>
                          )}
                          {assignedChars.map(charId => {
                            // Check savedChars first, then full character registry
                            const charSimple = savedChars.find(c => c.id === charId);
                            const charFull = characters.find(c => c.characterId === charId);
                            const charName = charSimple?.name || charFull?.displayName || charId;
                            return (
                              <span key={charId} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, background: `${childAccent}15`, border: `1px solid ${childAccent}50`, color: childAccent, fontSize: 9, fontWeight: 700 }}>
                                {charName}
                                <button
                                  onClick={() => setSceneCharAssignments(prev => ({ ...prev, [sceneId]: (prev[sceneId] || []).filter(id => id !== charId) }))}
                                  style={{ background: "none", border: "none", color: childAccent, cursor: "pointer", padding: 0, fontSize: 11, lineHeight: 1, opacity: 0.7 }}>×</button>
                              </span>
                            );
                          })}
                          {/* Character picker — combines savedChars + full characters registry, deduped */}
                          {(() => {
                            const allPickable: Array<{ id: string; name: string }> = [];
                            for (const c of savedChars) {
                              if (!assignedChars.includes(c.id)) allPickable.push({ id: c.id, name: c.name });
                            }
                            for (const c of characters) {
                              if (!assignedChars.includes(c.characterId) && !allPickable.some(p => p.name.toLowerCase() === c.displayName.toLowerCase())) {
                                allPickable.push({ id: c.characterId, name: c.displayName });
                              }
                            }
                            if (allPickable.length === 0) return null;
                            return (
                              <select
                                onChange={e => {
                                  if (e.target.value) {
                                    setSceneCharAssignments(prev => ({ ...prev, [sceneId]: [...(prev[sceneId] || []), e.target.value] }));
                                    e.target.value = "";
                                  }
                                }}
                                defaultValue=""
                                style={{ padding: "2px 6px", borderRadius: 6, background: s2, border: `1px solid ${border}`, color: muted, fontSize: 9, cursor: "pointer" }}>
                                <option value="">+ Assign</option>
                                {allPickable.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Archived Scenes panel ── */}
          {archivedScenes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setShowArchived(v => !v)}
                style={{ fontSize: 11, color: muted, background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", marginBottom: 10 }}>
                {showArchived ? "Hide" : "Show"} Archived Scenes ({archivedScenes.length})
              </button>
              {showArchived && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                  {archivedScenes.map(s => (
                    <div key={s.scene} style={{ background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 10, color: muted, fontWeight: 700 }}>Scene {s.scene}</span>
                      <span style={{ fontSize: 11, color: "#ccc", flex: 1 }}>{s.title}</span>
                      <button
                        onClick={() => restoreScene(s.scene)}
                        style={{ fontSize: 10, color: childSafe, background: `${childSafe}10`, border: `1px solid ${childSafe}40`, borderRadius: 7, padding: "4px 12px", cursor: "pointer", fontWeight: 700 }}>
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
      {(() => {
        // Ordered flow — design → content → script → sound → characters → sceneBoard → screenplay → assembly
        const FLOW: { id: WorkshopTab; label: string }[] = [
          { id: "design",      label: "Story" },
          { id: "content",     label: "Script & Story Plan" },
          { id: "script",      label: "Voices & Sounds" },
          { id: "sound",       label: "Character Friends" },
          { id: "characters",  label: "Scene Board" },
          { id: "sceneBoard",  label: "Screenplay" },
          { id: "screenplay",  label: "Assembly" },
          { id: "assembly",    label: "Overview" },
        ];
        const idx = FLOW.findIndex(t => t.id === activeTab);
        const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx] : null;
        return (
          <SupervisorStatusBar
            plannerType="children"
            designComplete={!!(ageGroup && effectiveProjectStyle)}
            storyComplete={!!(expandedContent || textContent)}
            charactersComplete={savedChars.length > 0}
            soundComplete={!!(narrationStyle && musicChoice)}
            scenesComplete={childScenes.length > 0}
            assemblyComplete={!!assembledUrl}
            storyText={expandedContent || textContent}
            nextTabLabel={next?.label}
            onNextTab={next ? () => setActiveTab(FLOW[idx + 1].id) : undefined}
            onAutoFix={(section) => {
              const tabMap: Record<string, WorkshopTab> = {
                design: "design", story: "content", characters: "characters",
                sound: "sound", scenes: "sceneBoard", assembly: "assembly",
              };
              const target = tabMap[section] as WorkshopTab;
              if (target) setActiveTab(target);
            }}
          />
        );
      })()}

      {/* ── Preview Scene Modal ── */}
      {previewScene && (
        <div onClick={() => setPreviewScene(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: "90%", background: "#111", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ padding: "10px 14px", background: "#1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{previewScene.title}</span>
              <button onClick={() => setPreviewScene(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            {previewScene.type === "video"
              ? <video src={previewScene.url} controls autoPlay style={{ width: "100%", maxHeight: 420 }} />
              : <img src={previewScene.url} alt={previewScene.title} style={{ width: "100%", maxHeight: 420, objectFit: "contain" }} />
            }
          </div>
        </div>
      )}

      {/* ── Full-size Image Lightbox ─────────────────────────────────────────── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={lightboxImage} alt="Scene preview" style={{ maxWidth: "90vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }} />
            <button
              onClick={() => setLightboxImage(null)}
              style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: "#2a2040", border: "2px solid #444", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
