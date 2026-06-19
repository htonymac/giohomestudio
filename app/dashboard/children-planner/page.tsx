"use client";
// build-touch-2026-06-01-01 — change content hash to avoid Turbopack v16 chunk bug

import { useState, useEffect, useRef, Suspense } from "react";
import * as React from "react";
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
import Review1Tab from "./tabs/Review1Tab";
import PreviewTab from "./tabs/PreviewTab";
import ScriptTab from "./tabs/ScriptTab";
import Review2Tab from "./tabs/Review2Tab";
import OverviewTab from "./tabs/OverviewTab";
import SoundTab from "./tabs/SoundTab";
import StyleTab from "./tabs/StyleTab";
import StoryTab from "./tabs/StoryTab";
import ScreenplayTab from "./tabs/ScreenplayTab";
import CharactersTab from "./tabs/CharactersTab";
import SceneBoardTab from "./tabs/SceneBoardTab";
import AssemblyTab from "./tabs/AssemblyTab";
import { safeJson } from "../../../lib/api-utils";
import SupervisorStatusBar from "../../components/SupervisorStatusBar";
import SubtitleStyler, { type SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../../components/SubtitleStyler";
import { estimateTextDuration } from "@/lib/auto-timestamp";
import { parseDurationToSeconds } from "@/lib/children/duration";
import { makeChildProjectTitle } from "@/lib/children/naming";
import { buildChildScenes, resolveChildMode, isDeterministicMode } from "@/lib/children/buildChildScenes";
import { AID_VIDEO_MODELS, AID_IMAGE_MODELS } from "@/lib/aid-model-registry";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import { getVoiceById, randomVoiceAnyTier, type GhsVoiceTier } from "@/lib/voice-registry";
import { getUserTier, voiceTierGate } from "@/lib/user-tier";
import { SCENE_ENERGY_COLOR } from "@/lib/scene-constants";
import { splitIntoActionBeats } from "@/lib/scene/action-beats";
import { useProjectSettings } from "@/hooks/useProjectSettings";
import ChildrenKaraokeSubtitle from "../../components/ChildrenKaraokeSubtitle";
import type { ChildrenPacingPlan, ChildrenNarrationTimingEntry } from "@/types/children";

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

// Henry 2026-06-13: Edge Neural voices for narrator + character auto-cast.
// Mirrors hybrid-planner's EDGE_CHARACTER_VOICES. "edge:" prefix for character map;
// narrator uses raw ids (en-NG-EzinneNeural etc.) sent to /api/tts provider:"edge-tts".
const EDGE_CHARACTER_VOICES = [
  { id: "edge:en-NG-EzinneNeural",   label: "Ezinne (Nigerian Female)" },
  { id: "edge:en-NG-AbeoNeural",     label: "Abeo (Nigerian Male)" },
  { id: "edge:en-KE-AsiliaNeural",   label: "Asilia (Kenyan Female)" },
  { id: "edge:en-KE-ChilembaNeural", label: "Chilemba (Kenyan Male)" },
  { id: "edge:en-ZA-LeahNeural",     label: "Leah (South African Female)" },
  { id: "edge:en-ZA-LukeNeural",     label: "Luke (South African Male)" },
  { id: "edge:en-US-AriaNeural",     label: "Aria (US Female)" },
  { id: "edge:en-US-GuyNeural",      label: "Guy (US Male)" },
  { id: "edge:en-GB-SoniaNeural",    label: "Sonia (British Female)" },
  { id: "edge:en-GB-RyanNeural",     label: "Ryan (British Male)" },
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

const MUSIC_GENRES = [
  { id: "auto",        label: "Auto (Match Mood)" },
  { id: "afrobeats",   label: "Afrobeats" },
  { id: "rock",        label: "Rock" },
  { id: "hiphop",      label: "Hip Hop" },
  { id: "jazz",        label: "Jazz" },
  { id: "classical",   label: "Classical" },
  { id: "lofi",        label: "Lo-Fi" },
  { id: "pop",         label: "Pop" },
  { id: "country",     label: "Country" },
  { id: "reggae",      label: "Reggae" },
  { id: "electronic",  label: "Electronic" },
  { id: "world",       label: "World / Folk" },
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

// Henry 2026-06-15: ABC builder default words — concrete, easy-to-picture, kid-friendly.
// Each is swappable per letter in the UI.
const ABC_DEFAULT_WORDS: Record<string, string> = {
  A: "apple", B: "ball", C: "cat", D: "dog", E: "egg", F: "fish", G: "goat",
  H: "hat", I: "igloo", J: "juice", K: "kite", L: "lion", M: "moon", N: "nest",
  O: "orange", P: "pig", Q: "queen", R: "rabbit", S: "sun", T: "tree",
  U: "umbrella", V: "van", W: "watch", X: "box", Y: "yo-yo", Z: "zebra",
};
const ABC_ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const MOVIE_GENRES = ["Adventure", "Fantasy", "Animals", "Space", "Ocean", "Jungle", "Fairytale"];
const MOVIE_SCENE_COUNTS = [3, 5, 7, 10];
const MOVIE_SCENE_DURATIONS = ["3s", "5s", "8s", "10s"];

// ── 5-Tier Sound Model Selector ──
// providerKey must match /api/music/generate schema: "kie" | "mubert" | "stable_audio" | "stock" | "auto"
// "karaoke" was an invalid key — the music API returned 400 and no music ever generated.
const SOUND_TIERS = [
  { id: "piper",          label: "GHS Standard", desc: "Piper TTS — free, always available",      cost: "Free",    providerKey: "stock" },
  { id: "ghs_karaoke",    label: "GHS Pro",      desc: "GHS Karaoke built-in",                    cost: "Low",     providerKey: "stable_audio" },
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
  // The restore effect rewrites the URL to just ?projectId=… (stripping the
  // selection params), so capture the user's selection ONCE at mount — otherwise
  // contentParam/age/topic become "" on the next render and the deterministic
  // teaching build (TODO #13) + auto-naming (H1) silently stop working.
  const [contentParam] = useState(() => searchParams.get("content") ?? "");
  const [ageParam] = useState(() => searchParams.get("age") ?? "");
  const langParam = searchParams.get("lang") ?? "en";
  const lang2Param = searchParams.get("lang2") ?? "";
  const [topicParam] = useState(() => searchParams.get("topic") ?? "");
  const [topicPromptParam] = useState(() => searchParams.get("topicPrompt") ?? "");
  const charactersParam = searchParams.get("characters") ?? "";
  const characterIdParam = searchParams.get("characterId") ?? "";
  // Henry 2026-05-30: thread children-video's tier + model choices into the planner so
  // template-page selections actually flow in instead of being silently dropped.
  const tierParam = searchParams.get("tier") ?? "";
  const videoModelParam = searchParams.get("videoModel") ?? "";
  const imageModelParam = searchParams.get("imageModel") ?? "";
  const URL_TIER_TO_PROVIDER: Record<string, string> = {
    standard: "claude:claude-haiku-4-5-20251001",
    pro:      "claude:claude-sonnet-4-6",
    premium:  "claude:claude-opus-4-7",
    free:     "ollama",
  };
  const initialStoryAiProvider = URL_TIER_TO_PROVIDER[tierParam] ?? "claude:claude-haiku-4-5-20251001";

  // ── State ──
  const [activeTab, setActiveTab] = useState<WorkshopTab>("design");
  const [lastAction, setLastAction] = useState("Workshop opened");
  const [projectTitle, setProjectTitle] = useState("Untitled Children Project");
  // H1: once the user hand-edits the title, AI/auto-naming must not overwrite it.
  const userEditedTitleRef = useRef(false);
  const autoNamedRef = useRef(false);
  const [showProjects, setShowProjects] = useState(false);
  const [projectsList, setProjectsList] = useState<Array<{ id: string; title: string; style: string; lastModified: number; sceneCount: number; characterCount: number }>>([]);
  const [textContent, setTextContent] = useState(topicPromptParam || "");
  // Henry 2026-06-02: de-vocarize tracks WHICH age is currently being processed,
  // null = not running, 5/6/7/8 = that age's button shows loading state.
  const [devocarizing, setDevocarizing] = useState<number | null>(null);
  const [narrationStyle, setNarrationStyle] = useState("gentle");
  // Henry 2026-06-03: studio name displayed on intro/outro cards.
  // Was hardcoded "GIO HOME AI STUDIO" in 3 places. Now editable per project.
  const [studioName, setStudioName] = useState<string>("GIO HOME AI STUDIO");
  // Henry 2026-06-04 voice unification: extended provider type to include the
  // new TTS branches (edge-tts, gtts, fal-f5, fal-xtts, fal-bark, gemini). The
  // VoiceTierSelector emits a VoiceTierConfig; we derive narrationProvider from
  // that on every change so the existing /api/tts call sites don't change.
  // Henry 2026-06-13: default changed piper→edge-tts for storybook/narration.
  // Learning modes (phonics/word/video_lesson/read_along) keep Piper via
  // pickPiperVoice() — edge-tts only wins on the NARRATOR path, not on the
  // per-character character-voice dropdown (those stay Piper-keyed).
  const [narrationProvider, setNarrationProvider] = useState<
    "piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "edge-tts" | "gtts" | "gemini" | "fal-f5" | "fal-xtts" | "fal-bark"
  >("edge-tts");
  // Henry 2026-06-13: Edge-TTS narrator voice id (mirrors hybrid-planner).
  // Defaults to Nigerian female (en-NG-EzinneNeural); snaps to story culture
  // via regionNarratorVoice() useEffect unless user has manually picked.
  const [edgeTtsVoiceId, setEdgeTtsVoiceId] = useState("en-NG-EzinneNeural");
  // True once the user manually picks a narrator voice — prevents the region
  // useEffect from overwriting their explicit choice.
  const narratorVoiceManualRef = useRef(false);
  // Henry 2026-06-05: random voice on init (never deterministic). useState's
  // lazy initializer runs once per project mount → user gets a fresh voice each
  // new project but it doesn't reshuffle on re-render.
  const [voiceTierConfig, setVoiceTierConfig] = useState<VoiceTierConfig>(() => {
    const v = randomVoiceAnyTier(true);
    return { tier: v.tier, voiceId: v.id, speed: 1 };
  });
  const [autoSfx, setAutoSfx] = useState(true);
  const [musicChoice, setMusicChoice] = useState("soft_story");
  const [musicGenre, setMusicGenre] = useState("auto");
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
  const [storyAiProvider, setStoryAiProvider] = useState(initialStoryAiProvider);

  // ── AID model picker ──
  const [selectedVideoModelId, setSelectedVideoModelId] = useState(videoModelParam || "segmind_pruna_video");
  // Henry 2026-06-16 COST FIX: default was fal_flux_schnell — that runs on FAL ($0.003 ea),
  // so every children image (and each Gen Max beat) drained the FAL balance. Switched to
  // segmind_pruna (Segmind gateway, off FAL) — the "Pruna" Henry believed he was already on.
  const [selectedImageModelId, setSelectedImageModelId] = useState(imageModelParam || "segmind_pruna");
  const [genSeed, setGenSeed] = useState<number | null>(null);
  const [showAidPicker, setShowAidPicker] = useState(false);
  const [aidMode, setAidMode] = useState<"video"|"image">("video");
  const [aidStyle, setAidStyle] = useState<"all"|"2d"|"3d"|"cartoon"|"realistic">("all");
  const [aidSort, setAidSort] = useState<"cheapest"|"quality"|"expensive">("cheapest");

  // ── Screenplay ──
  const [screenplay, setScreenplay] = useState("");
  // Henry 2026-06-01: screenplayAuthor is the SAME field as Story Credits' writtenBy.
  // Filling either should populate both. Both persist via localStorage. So we alias:
  // - read screenplayAuthor → return writtenBy
  // - setScreenplayAuthor → setWrittenBy (which writes to localStorage)
  // The standalone useState was creating a divergent field that user had to fill twice.
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
  const [ageGroup, setAgeGroup] = useState<"toddler" | "preschool" | "early" | "older">(
    () => (ageParam === "toddler" || ageParam === "preschool" || ageParam === "early" || ageParam === "older") ? ageParam : "preschool"
  );
  const [safetyLevel, setSafetyLevel] = useState<"maximum" | "high" | "standard">("high");
  // Video length — ONE source of truth (seconds), initialized from the URL
  // (durationSec from children-video, else the legacy "duration" label). The
  // Story Length picker (minutes) is just a view of this. Replaces the old
  // storyLengthMin state + the "5 min"->5 parse bug. (TODO #13 Phase 1)
  const [targetSeconds, setTargetSeconds] = useState<number>(() => {
    const ds = searchParams.get("durationSec");
    const dl = searchParams.get("duration");
    if (ds) return parseDurationToSeconds(ds);
    if (dl) return parseDurationToSeconds(dl);
    return 300;
  });
  const storyLengthMin = Math.max(1, Math.round(targetSeconds / 60));

  // H1: name a FRESH project from the user's selection (e.g. "Word Family 7373")
  // instead of "Untitled Children Project". Runs once; never overrides a restored
  // saved title or a user edit. The 4-digit suffix keeps 100+ same-selection picks
  // distinct in the My Projects list. (Narrative projects get an AI movieTitle on
  // expand instead — see expandContent.)
  useEffect(() => {
    if (autoNamedRef.current) return;
    autoNamedRef.current = true;
    if (userEditedTitleRef.current) return;
    if (!projectTitle.startsWith("Untitled")) return; // restored/real title already set
    const selection =
      topicParam && topicParam !== "Custom Story" ? topicParam
      : contentParam && contentParam !== "story" && contentParam !== "storybook" ? contentParam
      : "";
    if (!selection) return;
    setProjectTitle(makeChildProjectTitle(selection, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicParam, contentParam]);
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
  // ChildScene base moved to tabs/_shared-types.ts (Wave 1 segregation 2026-06-05).
  // Extended here with cameraDirection / imageUrl / characters / variantUrls fields
  // that page.tsx uses but tab components don't need.
  type ChildScene = import("./tabs/_shared-types").ChildScene & {
    title: string;
    imageUrl?: string;
    characters?: string[];
    variantUrls?: string[];
    // Henry 2026-06-15: ABC flashcard scenes carry their letter + teaching word so
    // scene-image can render the "A a / apple" flashcard overlay (perfect spelling).
    letter?: string;
    teachWord?: string;
  };
  const [childScenes, setChildScenes] = useState<ChildScene[]>([]);
  // ── AI Audio Plan (Henry 2026-05-30, task #12): per-scene audioPlan state +
  // runChildrenAudioPlan() mirror hybrid's Step 7. Holds narration script + music mood + SFX list per scene.
  interface ChildAudioPlan { narrationScript?: string; musicMood?: string; sfxList?: string[]; ambienceList?: string[] }
  const [audioPlans, setAudioPlans] = useState<Record<number, ChildAudioPlan>>({});
  const [runningAudioPlan, setRunningAudioPlan] = useState(false);
  // ── Establishing Shots (Henry 2026-05-30 task #21 — mirror hybrid task #17) ──
  interface ChildEstablishingShot {
    type: "opening" | "location" | "transition" | "mood" | "pre_action" | "exterior_building" | "aerial" | "beauty";
    prompt: string;
    durationSeconds: number;
    cameraMovement?: string;
    mood?: string;
    purpose?: string;
    location?: string;
    timeOfDay?: string;
    imageUrl?: string;
  }
  type ChildEstablishingMode = "off" | "minimal" | "auto" | "cinematic" | "epic";
  const [establishingShotsChild, setEstablishingShotsChild] = useState<Record<string, ChildEstablishingShot>>({});
  const [establishingAllChild, setEstablishingAllChild] = useState(false);
  const [establishingModeChild, setEstablishingModeChild] = useState<ChildEstablishingMode>("auto");
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

  // Henry 2026-06-01 (Option B): cached pre-rendered MP4 per scene image. When
  // an image is generated, we fire-and-forget POST /api/scene/prerender which
  // bakes the Ken Burns motion + fade once. At assemble time we pass this MP4
  // as a normal video URL (no `img:` prefix) so the assemble route skips its
  // own per-scene zoompan work — straight to subtitle overlay + audio mix.
  // Keyed by sceneId for the primary scene image; we also pre-render Gen Max
  // beats so multi-image assemblies are fast too.
  const [prerenderedSceneVideos, setPrerenderedSceneVideos] = useState<Record<string, string>>({});
  // ── Feature state: assembleMovie ──
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  // Henry 2026-06-01: visible progress bar (0..100) + sticky error so users know
  // exactly what's happening. Bar creeps up based on poll elapsed vs estimated.
  // assemblyError is the full ffmpeg/server error, shown in red under the button.
  const [assemblePercent, setAssemblePercent] = useState<number>(0);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  const [assemblyElapsedSec, setAssemblyElapsedSec] = useState<number>(0);
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
  // Henry 2026-06-02: image flip rate (seconds per beat image) when Max
  // mode is on with multiple beats ticked. 0.5s = fast slideshow, 5s = slow.
  // Persists per project.
  const [imageFlipRate, setImageFlipRate] = useState<number>(2);
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
  // Henry 2026-05-31: Story Credits — fill once, sticky across projects + hard refresh.
  // These are author identity (your name / your studio / idea source), not per-project,
  // so they live in localStorage. Survives Ctrl+Shift+R, survives project switches,
  // survives logout. User clears them by editing the field.
  const [writtenBy, setWrittenByState] = useState("");
  const [madeBy, setMadeByState] = useState("");
  const [ideaFrom, setIdeaFromState] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = localStorage.getItem("ghs_credits_writtenBy") ?? "";
    const m = localStorage.getItem("ghs_credits_madeBy") ?? "";
    const i = localStorage.getItem("ghs_credits_ideaFrom") ?? "";
    if (w) setWrittenByState(w);
    if (m) setMadeByState(m);
    if (i) setIdeaFromState(i);
  }, []);
  const setWrittenBy = (v: string) => {
    setWrittenByState(v);
    if (typeof window !== "undefined") localStorage.setItem("ghs_credits_writtenBy", v);
  };
  const setMadeBy = (v: string) => {
    setMadeByState(v);
    if (typeof window !== "undefined") localStorage.setItem("ghs_credits_madeBy", v);
  };
  const setIdeaFrom = (v: string) => {
    setIdeaFromState(v);
    if (typeof window !== "undefined") localStorage.setItem("ghs_credits_ideaFrom", v);
  };
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
  // Henry 2026-06-13: word timings for NarrationPreview subtitle sync (Edge returns them; Piper returns none).
  const [narratorWordTimings, setNarratorWordTimings] = useState<Array<{ word: string; startMs: number; endMs: number }> | null>(null);
  const [narratorSubText, setNarratorSubText] = useState<string>("");
  const [previewScene, setPreviewScene] = useState<{ url: string; type: "image" | "video"; title: string } | null>(null);

  // Learning mode + production system
  const [learningMode, setLearningMode] = useState<"storybook" | "word" | "sentence" | "poem" | "phonics" | "video_lesson" | "read_along">("storybook");
  // Henry 2026-06-03: voice routing. Learning modes (phonics, word,
  // video_lesson, read_along) need a CLEAR, instructional voice — a teacher.
  // Story modes (storybook, poem, sentence) need a WARM, narrator voice.
  // Piper supports many voices; default to en_GB-alan (clear male British,
  // "teacher" cadence) for learning, en_US-amy (warm female US, "narrator"
  // for stories). User can override via narrationStyle later.
  const pickPiperVoice = (): string => {
    const learningVoices: Record<string, string> = {
      phonics: "en_GB-alan-medium",
      word: "en_GB-alan-medium",
      video_lesson: "en_GB-alan-medium",
      read_along: "en_US-libritts_r-medium", // clearer enunciation for reading-along
    };
    const storyVoices: Record<string, string> = {
      storybook: "en_US-amy-medium",
      poem: "en_US-amy-medium",
      sentence: "en_US-amy-medium",
    };
    return learningVoices[learningMode] || storyVoices[learningMode] || "en_US-amy-medium";
  };

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
  const [charRefImages, setCharRefImages] = useState<Record<string, Array<{url: string; angle: string; label: string}>>>({});
  const [savedCharacter, setSavedCharacter] = useState<string | null>(null);
  const [imagePickerForCharId, setImagePickerForCharId] = useState<string | null>(null);
  const [imagePickerAssets, setImagePickerAssets] = useState<Array<{ id: string; name: string; fileUrl?: string; filePath?: string; source?: string }>>([]);
  const [imagePickerLoading, setImagePickerLoading] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [inlinePreview, setInlinePreview] = useState<CharacterIdentity | null>(null);
  const [importingFromPhoto, setImportingFromPhoto] = useState(false);
  const [photoImportLog, setPhotoImportLog] = useState("");
  // Henry 2026-05-31 (#8): toggle — burn the teaching word onto generated images
  const [wordOverlayEnabled, setWordOverlayEnabled] = useState(false);
  // Henry 2026-06-15: ABC flashcard builder — pick letters, auto kid-friendly words
  // (swappable), one flashcard scene per letter ("A is for Apple").
  const [abcLetters, setAbcLetters] = useState<Set<string>>(new Set());
  const [abcWords, setAbcWords] = useState<Record<string, string>>({});
  const [photoImportName, setPhotoImportName] = useState("");
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  // ── Children Pacing Engine state ─────────────────────────────────────────
  const [pacingPlan, setPacingPlan] = useState<ChildrenPacingPlan | null>(null);
  const [buildingPacingPlan, setBuildingPacingPlan] = useState(false);
  const [pacingAudioUrl, setPacingAudioUrl] = useState("");
  const [pacingTimingMap, setPacingTimingMap] = useState<ChildrenNarrationTimingEntry[]>([]);
  const [pacingActiveEntryIdx, setPacingActiveEntryIdx] = useState(0);
  const [buildingPacingNarration, setBuildingPacingNarration] = useState(false);
  const [assemblingPacingVideo, setAssemblingPacingVideo] = useState(false);
  const [pacingVideoUrl, setPacingVideoUrl] = useState("");
  // ── Era & Culture Lock ────────────────────────────────────────────────────
  const [storyEra, setStoryEra] = useState("");
  const [storyCulture, setStoryCulture] = useState("");

  // Henry 2026-06-13: Actor voice auto-cast by gender + story culture (mirrors hybrid).
  // Returns an "edge:" prefixed voice id for character voiceId field.
  // Called as FALLBACK when character-build API returns no voiceId.
  // NEVER affects learning-mode voices — those remain Piper via pickPiperVoice().
  function pickActorVoice(c: { gender?: string; skinTone?: string; colorDescription?: string; distinctiveFeatures?: string }): string {
    const g = (c.gender || "").toLowerCase();
    const txt = `${c.skinTone || ""} ${c.colorDescription || ""} ${c.distinctiveFeatures || ""} ${storyCulture || ""}`.toLowerCase();
    const isAfrican = /\b(african|nigeri|yoruba|igbo|hausa|melanated|kenya|south\s*african|lagos|abuja)\b/.test(txt);
    const isBritish = /\b(british|england|london|victorian|english|scottish|irish)\b/.test(txt);
    let f: string, m: string;
    if (isAfrican) { f = "edge:en-NG-EzinneNeural"; m = "edge:en-NG-AbeoNeural"; }
    else if (isBritish) { f = "edge:en-GB-SoniaNeural"; m = "edge:en-GB-RyanNeural"; }
    else { f = "edge:en-US-AriaNeural"; m = "edge:en-US-GuyNeural"; }
    if (g === "male") return m;
    if (g === "female") return f;
    return f; // unknown → female default
  }

  // Narrator voice by story culture (raw Edge id — no "edge:" prefix).
  // European/British → GB, African → NG, else US.
  // ONLY used for storybook/narration path. Learning-mode voices remain Piper.
  function regionNarratorVoice(): string {
    const txt = (storyCulture || "").toLowerCase();
    if (/\b(african|nigeri|yoruba|igbo|hausa|kenya|south\s*african|lagos|abuja)\b/.test(txt)) return "en-NG-EzinneNeural";
    if (/(europ|british|english|england|london|victorian|scottish|irish|norse|viking|medieval|french|spanish|german|italian|russian|nordic|scandinav)/.test(txt)) return "en-GB-SoniaNeural";
    return "en-US-AriaNeural";
  }
  // Snap narrator Edge voice to culture when storyCulture changes,
  // unless the user has manually picked a narrator voice.
  useEffect(() => {
    if (narratorVoiceManualRef.current) return;
    setEdgeTtsVoiceId(regionNarratorVoice());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyCulture]);

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

  // Henry 2026-05-31 (#8): extract the teaching word from a scene title.
  // "B is for Ball" → "BALL", "Word Magic: BAG" → "BAG", "Apple lesson" → "APPLE".
  // Heuristic: prefer the last ALL-CAPS word; fall back to the last word of the title.
  function extractTeachingWord(title: string | undefined): string | undefined {
    if (!title) return undefined;
    const capsMatch = title.match(/\b([A-Z]{2,})\b/g);
    if (capsMatch && capsMatch.length > 0) return capsMatch[capsMatch.length - 1];
    const words = title.trim().split(/\s+/);
    const last = words[words.length - 1]?.replace(/[^a-zA-Z]/g, "");
    return last && last.length > 1 ? last.toUpperCase() : undefined;
  }

  // Henry 2026-06-15: ABC builder — turn the selected letters into one flashcard
  // scene each ("A is for Apple"). Each scene carries letter + teachWord so the
  // scene-image flashcard overlay draws "A a / apple" with perfect (code-drawn) spelling.
  function abcWordFor(letter: string): string {
    return (abcWords[letter]?.trim() || ABC_DEFAULT_WORDS[letter] || "").toLowerCase();
  }
  function generateAbcScenes() {
    const letters = Array.from(abcLetters).sort();
    if (letters.length === 0) {
      setLastAction("ABC builder: tick at least one letter first.");
      return;
    }
    if (childScenes.length > 0 &&
        !confirm(`Replace the current ${childScenes.length} scene(s) with ${letters.length} ABC flashcard scene(s)? Generated images/files are not deleted.`)) {
      return;
    }
    const scenes: ChildScene[] = letters.map((L, i) => {
      const word = abcWordFor(L) || (ABC_DEFAULT_WORDS[L] || "").toLowerCase();
      const cap = word.charAt(0).toUpperCase() + word.slice(1);
      return {
        scene: i + 1,
        title: `${L} is for ${cap}`,
        visualDescription: `a single big cute ${word}, centered, on a clean plain pastel background, simple bright children's flashcard illustration, no text, no words, no letters`,
        narration: `${L} is for ${cap}. ${L}. ${cap}.`,
        letter: L,
        teachWord: word,
      } as ChildScene;
    });
    setChildScenes(scenes);
    setLearningMode("word");
    setWordOverlayEnabled(true);

    // Henry 2026-06-16 (#11): make ABC cards work in one rhythm — narration + subtitle + music.
    // The cards each have narration text ("A is for Apple. A. Apple."). Set narrationText so
    // narration can be generated (it was empty before → no narration → no subtitle), then
    // auto-generate the narration (subtitle is burned from its word timings at assembly) and
    // auto-pick a kid-safe music track. Each card then shows during its spoken line, with the
    // word on screen and music underneath.
    const abcNarration = scenes.map(s => s.narration).filter(Boolean).join(" ");
    setNarrationText(abcNarration);
    // Auto-narrate after state flushes (resolveNarrationText reads narrationText).
    setTimeout(() => { generateNarration().catch(() => { /* user can retry from Voices tab */ }); }, 150);
    // Auto-pick a kid-safe, copyright-free playful track (no CC-BY) for the bed.
    fetch(`/api/music/stock?children=1&mood=playful`)
      .then(r => r.json())
      .then(d => {
        const t = (d.tracks || [])[0];
        if (t?.url) { setSelectedMusicUrl(t.url); setSelectedMusicName(t.description || t.id); }
      })
      .catch(() => { /* music optional */ });

    setLastAction(`ABC builder: ${scenes.length} flashcard scene(s) created. Generating narration… then open the Scene Board and generate images — each card plays "${scenes[0]?.narration}" with the word on screen and music underneath.`);
  }

  // ── Expand content with AI ──
  async function expandContent() {
    // TODO #13 Phase 2 — DETERMINISTIC "by-time" content for teaching types
    // (counting / spelling / abc / concept: colours, shapes, animals, feelings,
    // body, first-words, actions…). The time-budget brain decides HOW MANY items
    // from the duration, so a 60s and a 600s video genuinely differ (600s gets ~10x
    // the cards / counts higher / more rounds). No LLM, no typed text needed — the
    // content type IS the input. Story/poem/unmapped types fall through to the LLM.
    const detMode = resolveChildMode(contentParam, learningMode);
    if (isDeterministicMode(detMode)) {
      setExpandingContent(true);
      try {
        const wl = ageGroup === "toddler" ? 3 : ageGroup === "preschool" ? 4 : ageGroup === "early" ? 5 : 6;
        const built = buildChildScenes({ mode: detMode, age: ageGroup, targetSeconds, wordLength: wl, contentTypeId: contentParam, seed: Date.now() });
        if (built.scenes.length > 0) {
          const newScenes = built.scenes.map((s, i) => ({
            scene: i + 1,
            title: s.overlayText,
            visualDescription: s.imageNoun,
            cameraDirection: "",
            narration: s.narration,
            letter: s.flashcardLetter,
            teachWord: s.overlayText,
          }));
          setChildScenes(newScenes);
          setAssemblySelectedIds(newScenes.map((_, i) => `child_sc${(i + 1).toString().padStart(2, "0")}`));
          const narration = built.scenes.map(s => s.narration).join(" ");
          setNarrationText(narration);
          setExpandedContent(narration);
          setLastAction(`${built.itemCount} ${detMode} cards built for ${Math.round(targetSeconds)}s — content scales with time. Generating narration… then open Scene Board to make images.`);
          setTimeout(() => { generateNarration().catch(() => { /* retry from Voices */ }); }, 150);
          setExpandingContent(false);
          return;
        }
      } catch (e) {
        console.error("[children] deterministic build failed, falling back to LLM:", e);
      }
      setExpandingContent(false);
      // deterministic build produced nothing → fall through to the LLM path below
    }

    const rawText = readAlongText || textContent || "";
    if (!rawText.trim()) return;
    setExpandingContent(true);
    try {
      // Henry 2026-06-16 (AI-don't-listen fix): the story-expand route HAS a teaching branch
      // (contentType "abc"/"3letter"/"counting" → teaching script, NOT a story) but expandContent
      // never sent contentType, so ABC/phonics content was turned into a nonsense story with a
      // villain. Derive contentType from (a) the URL ?content=, (b) the obvious teaching pattern
      // in the pasted text ("A is for Apple", "starts with", "Can you say"), or (c) the learning
      // mode. When it's teaching, the route keeps it a lesson and extends it A→Z.
      const looksLikeTeaching = /\b[A-Za-z]\s+is\s+for\s+\w/i.test(rawText)
        || /\bstarts with\b/i.test(rawText)
        || /\bcan you say\b/i.test(rawText)
        || /\b[A-Z],\s*[A-Z],/.test(rawText);
      const looksLikeCounting = /\b(count|counting|number|1[\s,-]*2[\s,-]*3)\b/i.test(rawText);
      const derivedContentType =
        (contentParam && contentParam !== "story" && contentParam !== "storybook" ? contentParam : "")
        || (looksLikeTeaching ? "abc" : "")
        || (looksLikeCounting ? "counting" : "")
        || (learningMode === "phonics" ? "abc"
          : learningMode === "word" ? "3letter"
          : "")
        || undefined;
      const res = await fetch("/api/hybrid/story-expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: rawText,
          genre: "children",
          tone: "warm, educational, age-appropriate",
          audience: AGE_AUDIENCE[ageGroup] || "children",
          language: "English",
          storyEra: storyEra || undefined,
          storyCulture: storyCulture || undefined,
          contentType: derivedContentType,
          storyType: learningMode === "poem" ? "rhyming_poem" : undefined,
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
            // Henry 2026-06-13: if API returns no voiceId, auto-cast an Edge Neural
            // voice matching gender + story culture. Learning-mode voices are Piper
            // (handled at TTS time via pickPiperVoice); this is only for character
            // dialogue lines in storybook/narration contexts.
            const autoVoiceId = c.voiceId || pickActorVoice({ gender: c.gender, skinTone: c.skinTone, colorDescription: c.colorDescription });
            const builtChar: CharacterIdentity = {
              characterId: newId, displayName: c.displayName || name,
              roleType: c.roleType || "supporting", gender: c.gender || "unknown",
              ageRange: c.ageRange || "child", skinTone: c.skinTone || "",
              hairStyle: "", wardrobeStyle: c.wardrobeStyle || "",
              speechStyle: c.speechStyle || "normal", accentType: "",
              emotionProfile: c.emotionProfile || "", voiceId: autoVoiceId,
              voiceType: c.voiceType || "childlike", intonation: c.intonation || "playful",
              language: "English", tags: [], hasVoice: !!autoVoiceId, hasImage: false,
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
        // Henry 2026-06-13: fallback to Edge auto-cast when API returns no voiceId.
        const autoVoiceIdInline = c.voiceId || pickActorVoice({ gender: c.gender, skinTone: c.skinTone, colorDescription: c.colorDescription });
        const built: CharacterIdentity = {
          characterId: newId, displayName: c.displayName || name,
          roleType: c.roleType || "supporting", gender: c.gender || "unknown",
          ageRange: c.ageRange || "child", skinTone: c.skinTone || "",
          hairStyle: "", wardrobeStyle: c.wardrobeStyle || "",
          speechStyle: c.speechStyle || "normal", accentType: "",
          emotionProfile: c.emotionProfile || "", voiceId: autoVoiceIdInline,
          voiceType: c.voiceType || "childlike", intonation: c.intonation || "playful",
          language: "English", tags: [], hasVoice: !!autoVoiceIdInline, hasImage: false,
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

  // Persist portrait to character-voices DB (creates if no dbId, updates if exists)
  async function persistPortraitToRegistry(char: CharacterIdentity, imageUrl: string, refShots?: Array<{url: string; angle: string; label: string}>) {
    let dbId = char.dbId || savedChars.find(s => s.characterId === char.characterId)?.id;
    try {
      if (!dbId) {
        // Create the character in the registry
        const createRes = await fetch("/api/character-voices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: char.displayName,
            gender: char.gender || "unknown",
            age: char.ageRange || "child",
            visualDescription: char.species ? `${char.species}. ${char.bodyBuild || ""}`.trim() : char.displayName,
            characterId: char.characterId,
          }),
        });
        if (createRes.status === 409) {
          const existing = await createRes.json();
          dbId = existing.id;
        } else if (createRes.ok) {
          const created = await createRes.json();
          dbId = created.id;
          setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, dbId } : c));
        }
      }
      if (!dbId) return;
      await fetch(`/api/character-voices/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, ...(refShots ? { referenceImages: refShots } : {}) }),
      });
    } catch { /* best-effort */ }
  }

  async function generateCharacterPortrait(char: CharacterIdentity, overrideModelId?: string) {
    setGeneratingPortrait(char.characterId);
    const visualDescFull = buildVisualDescription(char);
    const visualDesc = visualDescFull.slice(0, 1200);
    const styleLabel = VISUAL_STYLES.find(v => v.id === effectiveProjectStyle)?.label || "storybook";
    const isPhotoImport = char.tags?.includes("photo-import");
    const effectiveModelId = overrideModelId
      || charPortraitModel[char.characterId]
      || (isPhotoImport ? "fal_flux_pulid" : undefined);

    const eraLine = (storyEra || storyCulture) ? `Set in ${[storyEra, storyCulture].filter(Boolean).join(", ")}. Clothing, accessories, and props MUST reflect this era and culture exactly.` : "";
    const basePrompt = [
      `children's story illustration, ${styleLabel} art style, age-appropriate, friendly, colorful, warm`,
      eraLine || undefined,
      `CHARACTER ${char.displayName.toUpperCase()} — EXACT FIXED APPEARANCE:`,
      visualDesc || `${char.displayName}, ${char.gender} ${char.ageRange}`,
      "CHARACTER REFERENCE SHEET — show full body head to toe, clean background, friendly and safe for children.",
      "Consistent design, professional quality.",
    ].filter(Boolean).join(". ");

    const ANGLE_SHOTS = [
      { angle: "front",         label: "main",        framing: "FULL BODY front view, standing neutral pose, facing camera, visible from head to toe including feet, clean plain background." },
      { angle: "three-quarter", label: "variation_1", framing: "FULL BODY three-quarter angle view, slight left turn, standing pose, entire body visible from head to feet, clean plain background." },
      { angle: "side",          label: "variation_2", framing: "FULL BODY side profile view, 90-degree turn, standing pose, full height visible from head to feet, clean plain background." },
    ];

    async function genOneShot(framing: string): Promise<string | null> {
      try {
        const res = await fetch("/api/generation/image", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `${basePrompt} ${framing}`, modelId: effectiveModelId, width: 768, height: 1024, seed: genSeed !== null ? genSeed : undefined }),
        });
        const d = await res.json();
        if (d.error) return null;
        return d.imageUrl || (d.imagePath ? normalizeImageUrl(d.imagePath) : null);
      } catch { return null; }
    }

    try {
      const [url1, url2, url3] = await Promise.all(ANGLE_SHOTS.map(s => genOneShot(s.framing)));
      if (!url1) { setUiError(`Portrait failed for ${char.displayName}`); setGeneratingPortrait(null); return; }

      const shots = [
        { url: url1, angle: ANGLE_SHOTS[0].angle, label: ANGLE_SHOTS[0].label },
        ...(url2 ? [{ url: url2, angle: ANGLE_SHOTS[1].angle, label: ANGLE_SHOTS[1].label }] : []),
        ...(url3 ? [{ url: url3, angle: ANGLE_SHOTS[2].angle, label: ANGLE_SHOTS[2].label }] : []),
      ];

      setCharRefImages(prev => ({ ...prev, [char.characterId]: shots }));
      setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageUrl: url1, hasImage: true, imageLocked: false } : c));
      setLastAction(`${shots.length} portrait shots generated for ${char.displayName} — AI reading image...`);
      persistPortraitToRegistry(char, url1, shots);
      analyzeCharacterImage(char.characterId, url1);
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

    // Story length: picker first, then text-cue overrides if user typed a duration
    // directly into the prompt ("39 min long", "very long", etc.)
    const lower = storyInput.toLowerCase();
    let parsedDurationSec: number = targetSeconds;  // unified source of truth
    const minMatch = lower.match(/(\d+)\s*(?:-\s*\d+\s*)?\s*(?:min|minute)/);
    const hourMatch = lower.match(/(\d+)\s*hour/);
    if (hourMatch) parsedDurationSec = parseInt(hourMatch[1]) * 3600;
    else if (minMatch) parsedDurationSec = parseInt(minMatch[1]) * 60;
    else if (lower.includes("very long")) parsedDurationSec = Math.max(parsedDurationSec, 30 * 60);
    else if (lower.includes("long story")) parsedDurationSec = Math.max(parsedDurationSec, 20 * 60);
    const targetDurationLabel = `${Math.round(parsedDurationSec / 60)} min`;

    const wantsPoem = /\b(poem|poetry|rhyme|rhyming|verse|song|musical)\b/i.test(storyInput);
    const storyType = wantsPoem ? "rhyming_poem" : "story_book";

    // If user mentioned a specific age in their text ("3 and 4 year old", "5 year"),
    // honor it over the dropdown — common case is they type the age in the prompt.
    const ageInText = lower.match(/(\d+)\s*(?:and\s*\d+\s*)?\s*year[\s-]*old/);
    let effectiveAgeGroup = ageGroup;
    if (ageInText) {
      const n = parseInt(ageInText[1]);
      if (n <= 3) effectiveAgeGroup = "toddler";
      else if (n <= 5) effectiveAgeGroup = "preschool";
      else if (n <= 7) effectiveAgeGroup = "early";
      else effectiveAgeGroup = "older";
    }

    try {
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput,
          genre: "children",
          tone: tone === "soft" ? "warm, gentle, bedtime-friendly" : "fun, playful, energetic",
          audience: AGE_AUDIENCE[effectiveAgeGroup] || "children",
          language: "English",
          languageLevel: effectiveAgeGroup === "toddler" || effectiveAgeGroup === "preschool" ? "simple_english" : "normal_english",
          storyType,
          contentType: contentParam || undefined, // abc/3letter/counting/poem/storybook — drives format in story-expand
          targetDuration: parsedDurationSec,
          targetDurationLabel,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          // pro tier = Claude Sonnet quality model. Without this children expansion fell
          // back to "fast" (haiku/ollama) which writes short generic kid stories regardless
          // of target word count. Hybrid sends tier:"pro" and produces full-length results.
          tier: "pro",
          childContext: { ageGroup: effectiveAgeGroup, learningMode, safetyLevel, visualStyle: effectiveProjectStyle },
        }),
      });
      const expandData = await safeJson<{ expandedStory?: { summary?: string; fullScript?: string }; summary?: string; fullScript?: string; wordCount?: number; warning?: string; movieTitle?: string }>(expandRes, "story-expand");
      // H1: for narrative children projects, adopt the AI-generated title (like the
      // hybrid planner) instead of leaving "Untitled". Teaching content (abc/word/
      // counting) keeps its deterministic "Word Family 7373" auto-name. Never
      // override a user edit.
      {
        const isNarrative =
          (!contentParam || contentParam === "story" || contentParam === "storybook") &&
          learningMode !== "word" && learningMode !== "phonics";
        const aiTitle = (expandData.movieTitle || "").trim();
        if (isNarrative && aiTitle && !userEditedTitleRef.current && projectTitle.startsWith("Untitled")) {
          setProjectTitle(aiTitle);
        }
      }
      // Henry 2026-05-31: narration was getting the 1-paragraph SUMMARY (blurb), not the
      // duration-scaled FULL SCRIPT. Result: 5-min target → 30-second TTS. fullScript is
      // the complete narrator-spoken text (~targetWordCount words). Use it if present;
      // summary is the fallback only when fullScript is absent (older planner responses).
      const fullScript = expandData.expandedStory?.fullScript || expandData.fullScript || "";
      const summary = expandData.expandedStory?.summary || expandData.summary || "";
      const narrationSource = fullScript || summary || "";
      if (narrationSource) {
        setExpandedContent(summary || fullScript);  // expandedContent shown in UI (summary preferred for short preview)
        setNarrationText(narrationSource);            // narrationText drives TTS — needs full script for full audio
        const w = expandData.wordCount;
        setLastAction(`Story expanded${w ? ` (${w} words ≈ ${Math.round(w / 150)} min narration)` : ""}${expandData.warning ? ` — ⚠ ${expandData.warning}` : ""}`);
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
      // Henry 2026-05-30: scene-plan was getting only the SUMMARY (1-line blurb), so it
      // invented META scene titles like "Introducing the Letter P" / "The Dancing Pig"
      // disconnected from the actual narration. Image gen then built prompts from those
      // meta titles → generic jagos pictures. Hybrid passes the FULL SCRIPT (line ~1326
      // of hybrid-planner) — mirror that here so scene titles & visualDescriptions are
      // grounded in the real story words ("watch the pig dance", "let's clap for PIG").
      const storyWithStyle = `${fullScript || summary || storyInput}\n\nVisual style: ${styleLabel}`;
      const charIdentityMap = new Map(characters.map(ci => [ci.characterId, ci]));
      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storyWithStyle,
          characters: savedChars.map(c => {
            const ci = charIdentityMap.get(c.characterId || c.id);
            return {
              characterId: c.id,
              displayName: c.name,
              role: c.role || "character",
              ageRange: ci?.ageRange || "child",
              gender: ci?.gender || "unknown",
              skinTone: ci?.skinTone || "",
              visualDescription: c.visualDescription || ci?.species || "",
            };
          }),
          genre: "children",
          tone: `${ageGroup} age-appropriate, friendly, educational`,
          costPreference: "budget",
          targetDuration: movieSceneDuration,
          projectId: activeProjectIdRef.current || "ghs_children_default",
          styleHint: styleLabel,
          storyEra: storyEra || undefined,
          storyCulture: storyCulture || undefined,
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
      // Henry 2026-06-16: stable project id so scene videos isolate per project too.
      const projectId = activeProjectIdRef.current || "ghs_children_default";
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
          projectId: activeProjectIdRef.current || `children_${contentParam || "story"}_${topicParam || "default"}`,
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
        body: JSON.stringify({ storyText, characters: savedChars.filter(c => selectedCharIds.includes(c.id)).map(c => ({ characterId: c.characterId || c.id, name: c.name })), costPreference: "balanced", targetDuration: "2-5", projectId: activeProjectIdRef.current || "ghs_children_default", styleHint: `${effectiveProjectStyle}, children's book illustration, age-appropriate, friendly, colorful` }),
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
      // Henry 2026-06-03: ACTION IMAGES FIX. Previously sceneText was just
      // scene.title + scene.visualDescription. Neither contains the action
      // verbs from the narration ("spin and deliver a kick", "chase", "fight").
      // So the action-extractor in /api/hybrid/scene-image never matched any
      // action pattern — every image came back as smiling children posing.
      //
      // Fix: ALSO include the scene's narration slice. childScenes are split
      // proportionally across the full narration text. Pull the slice for
      // THIS scene so the action-extractor sees the real verbs.
      const sceneSlice = (() => {
        const src = (narrationText || expandedContent || textContent || "").trim();
        if (!src || childScenes.length === 0) return "";
        const sentences = src.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
        if (sentences.length === 0) return "";
        const perScene = Math.max(1, Math.ceil(sentences.length / childScenes.length));
        const idx = Math.max(0, scene.scene - 1);
        const start = idx * perScene;
        return sentences.slice(start, Math.min(sentences.length, start + perScene)).join(" ");
      })();
      // Detect action verbs in either the scene's title/desc OR the narration
      // slice. If found, drop the "friendly/safe" softeners so the model is
      // actually willing to render movement and tension.
      const combinedActionCheck = `${scene.title || ""} ${scene.visualDescription || ""} ${sceneSlice}`.toLowerCase();
      const hasAction = /\b(fight|kick|punch|chase|run|sprint|jump|leap|hit|fall|crash|spin|strike|swing|grab|push|shove|attack|battle|confront|argue|scream|cry|escape|hide|throw|catch|climb|dance|fly|swim|dive|sneak|rush)\b/.test(combinedActionCheck);
      const childStylePrefix = hasAction
        ? "children's book illustration, age-appropriate, dynamic, colorful, "
        : "children's book illustration, age-appropriate, friendly, colorful, ";
      const sceneTextWithAction = sceneSlice
        ? `${childStylePrefix}${scene.title}. ${scene.visualDescription}. ${sceneSlice}`
        : `${childStylePrefix}${scene.title}. ${scene.visualDescription}`;
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          // Henry 2026-06-16 CRITICAL ISOLATION FIX: this call had NO projectId, so every
          // generated image landed in the SHARED scenes/unlinked/{sceneId} folder and
          // collided with other projects' same-named scenes (SC01 etc.) — projects saw each
          // other's images. Use the STABLE project id so images are stored per-project under
          // scenes/{projectId}/{sceneId}/. Existing unlinked images are untouched (no loss);
          // they're still referenced by each project's saved-state.
          projectId: activeProjectIdRef.current || "ghs_children_default",
          sceneText: sceneTextWithAction,
          characterIds: assignedChars,
          projectStyle: sceneStyles[sceneId] || effectiveProjectStyle,
          mood: hasAction ? "dynamic, expressive, story-driven" : "friendly, warm, safe",
          // Henry 2026-06-04: every scene uses FLUX Schnell ($0.003/img).
          // Cheapest model in the FAL lineup AND best motion of any cheap
          // tier. Action vs non-action only changes the negative prompts
          // and mood string now — same model both paths.
          modelId: effectiveImageModelId,
          // Henry 2026-06-04 (B): signal to server to inject stronger
          // anti-static negatives (smiling for camera, posing, idle, etc.)
          isActionScene: hasAction,
          storyEra: storyEra || undefined,
          storyCulture: storyCulture || undefined,
          // Henry 2026-06-15: ABC flashcard scenes force the word overlay ON and pass
          // the letter so scene-image renders the "A a / apple" flashcard. Non-ABC
          // scenes keep the existing word-overlay toggle behaviour.
          wordOverlay: wordOverlayEnabled || !!scene.letter,
          overlayText: scene.teachWord || extractTeachingWord(scene.title),
          flashcardLetter: scene.letter || undefined,
          // Henry 2026-06-13: teaching modes (word/phonics) + word-overlay scenes are
          // OBJECT-CLEAR lessons ("A is for Apple") — tell scene-image to skip the
          // action/anti-pose push so the learning pattern stays calm and clear.
          // Storybook/poem/sentence children scenes still get the action treatment.
          isStillScene: wordOverlayEnabled || learningMode === "word" || learningMode === "phonics",
        }),
      });
      const data = await safeJson<{ imageUrl?: string; imagePath?: string; error?: string }>(res, "scene-board-image");
      if (data.error) {
        console.error("[scene-image fail]", { status: res.status, error: data.error, sceneId, modelId: effectiveImageModelId });
        // Show full error visibly — not just in Last Action (which is easy to miss)
        setLastAction(`[children-planner] Image FAILED (HTTP ${res.status}): ${String(data.error).slice(0, 300)}`);
        return;
      }
      const url = data.imageUrl || data.imagePath || "";
      if (!url) {
        console.error("[scene-image no-url]", { status: res.status, data, sceneId });
        setLastAction(`[children-planner] Image gen returned no URL (HTTP ${res.status}) — check server logs`);
        return;
      }
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
      // safeJson throws on non-ok / non-json (e.g. 502 gateway, 500 crash)
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scene-image exception]", { sceneId, error: msg });
      setLastAction(`[children-planner] Image generation exception: ${msg.slice(0, 300)}`);
    } finally {
      // BUG FIX 2026-06-02: early `return` inside `try` was bypassing this cleanup,
      // leaving generatingSceneImage === sceneId forever → button stuck as "Generating…"
      // and permanently disabled. `finally` guarantees cleanup on ALL exit paths.
      setGeneratingSceneImage(null);
    }
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
            // Henry 2026-06-16: per-project isolation (see genSceneBoardImage note).
            projectId: activeProjectIdRef.current || "ghs_children_default",
            sceneText: `${childStylePrefix}${promptList[bi]}`,
            characterIds: assignedChars,
            projectStyle: sceneStyles[sceneId] || effectiveProjectStyle,
            mood: "friendly, warm, safe",
            modelId: effectiveImageModelId,
            storyEra: storyEra || undefined,
            storyCulture: storyCulture || undefined,
            // Unique seed per image so retries on the same description still produce variation.
            seed: Math.floor(Math.random() * 1e9),
            wordOverlay: wordOverlayEnabled,
            overlayText: extractTeachingWord(scene.title),
          }),
        });
        const data = await safeJson<{ imageUrl?: string; imagePath?: string; error?: string }>(res, `child-beat-${bi}`);
        const url = data.imageUrl || data.imagePath || "";
        if (url) {
          newUrls.push(url);
        } else if (data.error) {
          console.error(`[makeChildSceneBeatImages] beat ${bi} error:`, data.error, "modelId:", effectiveImageModelId);
        }
      } catch (err) {
        console.error(`[makeChildSceneBeatImages] image ${bi} fetch failed:`, err);
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
      // Henry 2026-06-01: REMOVED auto-opt-in to Max mode. Previously every Gen
      // Max run auto-added the scene to useMaxImageScenes, which expanded each
      // scene to ALL its beats at assemble time (7 scenes × ~10 beats = 70
      // entries → server overload). Now Max is strictly user-toggle per scene
      // via the Max button in the scene card.
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
              // Henry 2026-06-16: per-project isolation (see genSceneBoardImage note).
              projectId: activeProjectIdRef.current || "ghs_children_default",
              sceneText: `${childStylePrefix}${scene.title}. ${scene.visualDescription}`,
              characterIds: assignedChars,
              projectStyle: sceneStyles[sceneId] || effectiveProjectStyle,
              mood: "friendly, warm, safe",
              modelId: effectiveImageModelId,
              storyEra: storyEra || undefined,
              storyCulture: storyCulture || undefined,
              seed: seeds[i],
              wordOverlay: wordOverlayEnabled,
              overlayText: extractTeachingWord(scene.title),
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

  // ── Child-safe Scene Edit Op — Phase B toolbar ──────────────────────
  // Wires to /api/hybrid/scene-edit using op:"polish" + polishMode = our op name.
  // Adds childContext so server-side knows it's child-mode.
  async function handleChildSceneOp(
    sceneId: string,
    currentText: string,
    op: "add_action" | "emotional" | "establish" | "qc" | "funny" | "playful" | "adventure",
  ) {
    if (!currentText?.trim()) { setLastAction("Scene has no description to edit"); return; }
    setPolishingScene(sceneId);
    try {
      const sceneNum = parseInt(sceneId.replace("child_sc", ""), 10);
      const sceneObj = childScenes.find(s => s.scene === sceneNum);
      const isPolishOp = ["add_action", "emotional", "funny", "playful", "adventure"].includes(op);
      const body = isPolishOp
        ? {
            op: "polish",
            polishMode: op,
            scene: { id: sceneId, title: sceneObj?.title || "", description: currentText },
            childContext: { ageGroup, safetyLevel },
          }
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
        // Capture the post-update scene so we can auto-regen its image (mirror handlePolishScene 2026-05-30)
        let updatedScene: ChildScene | undefined;
        setChildScenes(prev => {
          const next = prev.map(s => s.scene === sceneNum ? { ...s, visualDescription: newText } : s);
          updatedScene = next.find(s => s.scene === sceneNum);
          return next;
        });
        setLastAction(`Scene ${sceneId}: ${op} applied — regenerating image...`);
        // Henry 2026-05-30: child-safe ops were updating text only; image stayed stale
        // → user thought buttons "didn't fire". Now mirror hybrid's Polish auto-regen.
        if (updatedScene) {
          await generateSceneBoardImage({ ...updatedScene, visualDescription: newText });
        }
        setLastAction(`Scene ${sceneId}: ${op} applied — image refreshed`);
      } else if (data.error) {
        setLastAction(`${op} failed: ${data.error.slice(0, 200)}`);
      } else {
        setLastAction(`${op}: no response`);
      }
    } catch (err) {
      console.error(`[handleChildSceneOp] ${op} error:`, err);
      setLastAction(`Scene ${op} failed`);
    } finally {
      setPolishingScene(null);
    }
  }

  // ── Adult-Word Check / Filter — Phase B ─────────────────────────────
  // Calls /api/children/word-filter to scan scene text for inappropriate/adult words
  // and suggest gentle replacements. customBlocked = user's per-project blocklist.
  async function handleAdultWordCheck(sceneId: string, currentText: string, customBlocked: string[] = []) {
    if (!currentText?.trim()) return;
    setPolishingScene(sceneId);
    try {
      const res = await fetch("/api/children/word-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneText: currentText, customBlockedWords: customBlocked }),
      });
      const data = await res.json();
      if (data.flaggedWords && data.flaggedWords.length > 0) {
        const summary = data.flaggedWords.slice(0, 5).map((f: { word: string; replacement: string }) => `${f.word}→${f.replacement}`).join(", ");
        setLastAction(`⚠ ${data.flaggedWords.length} flagged: ${summary}${data.flaggedWords.length > 5 ? "…" : ""}`);
        if (data.cleanedText) {
          const sceneNum = parseInt(sceneId.replace("child_sc", ""), 10);
          setChildScenes(prev => prev.map(s => s.scene === sceneNum ? { ...s, visualDescription: data.cleanedText } : s));
        }
      } else if (data.error) {
        setLastAction(`Word filter failed: ${data.error.slice(0, 200)}`);
      } else {
        setLastAction("✓ No flagged words found");
      }
    } catch (err) {
      console.error("[handleAdultWordCheck] error:", err);
      setLastAction("Word filter failed");
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
      // Henry 2026-05-31: shared resolveNarrationText helper. Used to silently
      // produce BIB on new projects whose only text was the URL-param topic
      // prompt (~30 chars). Now expands first if too short.
      const { text: storyForTTS } = await resolveNarrationText();
      if (storyForTTS.replace(/\s+/g, "").length >= 80) {
        try {
          // BUG-09 fix: use narrationProvider state instead of hardcoded "piper"
          const autoProvider = effectiveNarrationProvider || "piper";
          fixed.push(`Generating narration (${autoProvider})...`);
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: storyForTTS.slice(0, 30000), provider: autoProvider, voiceId: autoProvider === "edge-tts" ? edgeTtsVoiceId : pickPiperVoice(), speed: 0.9 }),
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json() as { audioUrl?: string; engine?: string };
            // Henry 2026-06-03 (Sonnet C audit Fix #3): reject silent placeholder.
            // /api/tts returns engine="placeholder" when ALL TTS tiers failed
            // (Piper crashed, FAL no key, etc) and it had to write a sine-tone
            // _silent.mp3 file. Without this guard, that placeholder URL was
            // stored as real narration and the assembled video played 30s of
            // silence. Now we treat it as failure and surface to user.
            if (ttsData.engine === "placeholder") {
              fixed[fixed.length - 1] = "";
              issues.push("Narration unavailable — TTS engine returned placeholder. Check Piper / FAL config.");
            } else if (ttsData.audioUrl) {
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
  // TODO #5: single source of truth for the resume-marker localStorage key, so the
  // submit path and the resume effect can never build it two slightly different ways.
  function assembleJobKey() {
    const pid = urlProjectId || `children_${contentParam || "story"}_${topicParam || "default"}`;
    return `ghs_assemble_job_${pid}`;
  }

  async function assembleMovie() {
    const scenesToAssemble = childScenes.filter(s => {
      const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
      return assemblySelectedIds.includes(sceneId);
    });
    if (scenesToAssemble.length === 0) { setLastAction("Select scenes to assemble first"); return; }
    setAssembling(true);
    setAssemblyComplete(false);
    setAssembledUrl(null);
    setAssemblyError(null);
    setAssemblePercent(2); // tiny non-zero so the bar shows immediately
    setAssemblyElapsedSec(0);
    const progress: Record<number, string> = {};
    try {
      // Each pushed segment carries:
      //   scene:    UNIQUE sequential index (1,2,3...) so /api/video/assemble can write
      //             temp files like scene_img_1.png / imgslide_1.mp4 without collisions.
      //   parentScene: original parent scene number, used here only for subtitle text.
      //   videoUrl: img:<url> for image, or direct video URL for video clips.
      type Segment = { scene: number; videoUrl: string; parentScene: number; duration?: number };
      const assemblyScenes: Segment[] = [];
      let segCounter = 0;
      // Henry 2026-06-02: compute the per-scene narration share BEFORE the
      // segmentation loop so the multi-beat path knows how long each scene
      // has to fill.
      //
      // Henry 2026-06-02 (followup): probe ACTUAL narrator audio length via
      // HTMLAudioElement. Previously used estimateTextDuration() which is a
      // ~3-words-per-second estimate from text alone — real TTS (Piper,
      // pacing plan with pauses) runs 1.4-2x slower. Result: client computed
      // sceneNarrShare = 5s when real share was 25-45s, so multi-beat path
      // built only 2-3 segments per scene at flip rate, finishing all images
      // in ~30-60s while audio kept playing 5+ minutes.
      const _probeAudioDuration = async (url: string | null): Promise<number> => {
        if (!url) return 0;
        return new Promise<number>((resolve) => {
          const a = new Audio();
          let settled = false;
          const done = (n: number) => { if (!settled) { settled = true; resolve(n); } };
          a.addEventListener("loadedmetadata", () => done(a.duration || 0));
          a.addEventListener("error", () => done(0));
          setTimeout(() => done(0), 5000);
          a.src = url;
        });
      };
      const _probedSec = await _probeAudioDuration(narratorAudioUrl);
      const _totalNarFromProbe = _probedSec > 0 ? _probedSec : (narrationText ? estimateTextDuration(narrationText) : 0);
      const _sceneNarrShare = _totalNarFromProbe > 0 && scenesToAssemble.length > 0
        ? _totalNarFromProbe / scenesToAssemble.length
        : 5;
      console.log("[children-planner] sceneNarrShare", _sceneNarrShare, "from probed audio", _probedSec, "s");
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
        // Henry 2026-06-02: DROPPED the Max-toggle gate. If a scene has more
        // than one ticked beat image, USE THEM all (in tick order, cycling
        // through if narration is longer than beats * flipRate). User can
        // un-tick beats they don't want. Max toggle still respected when
        // present but no longer required.
        if (wantsImagePath && tickedBeats.length > 1) {
          const sceneNarrDuration = _sceneNarrShare; // scene's share of total narration
          const slotsNeeded = Math.max(1, Math.ceil(sceneNarrDuration / imageFlipRate));
          for (let slot = 0; slot < slotsNeeded; slot++) {
            const beatUrl = tickedBeats[slot % tickedBeats.length];
            // Last slot eats any remainder so total scene time = narration time exactly
            const dur = slot === slotsNeeded - 1
              ? Math.max(imageFlipRate, sceneNarrDuration - imageFlipRate * (slotsNeeded - 1))
              : imageFlipRate;
            assemblyScenes.push({ scene: ++segCounter, videoUrl: `img:${beatUrl}`, parentScene: s.scene, duration: dur });
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
        // Henry 2026-06-01 (Option B): if a pre-rendered Ken Burns MP4 exists
        // for this scene's primary image, use it as a VIDEO (no img: prefix).
        // The assemble route then skips its zoompan + scale work for this scene.
        const preRendered = prerenderedSceneVideos[sceneId];
        if (pref === "video" && videoUrl) {
          assemblyScenes.push({ scene: ++segCounter, videoUrl, parentScene: s.scene });
        } else if (pref === "image" && singleImageSrc) {
          const src = preRendered && singleImageSrc === imageUrl ? preRendered : `img:${singleImageSrc}`;
          assemblyScenes.push({ scene: ++segCounter, videoUrl: src, parentScene: s.scene });
        } else if (videoUrl) {
          // auto: prefer video if available
          assemblyScenes.push({ scene: ++segCounter, videoUrl, parentScene: s.scene });
        } else if (singleImageSrc) {
          const src = preRendered && singleImageSrc === imageUrl ? preRendered : `img:${singleImageSrc}`;
          assemblyScenes.push({ scene: ++segCounter, videoUrl: src, parentScene: s.scene });
        }
      }
      if (assemblyScenes.length === 0) { setLastAction("No video or images available. Generate scene content first."); setAssembling(false); return; }

      // ── INSERT ESTABLISHING SHOTS BEFORE THEIR SCENES (Henry 2026-05-30 task #21) ──
      // Mirror hybrid's withEstablishing logic. Each scene that has a rendered establishing
      // shot imageUrl gets a short image segment inserted ahead of it, preserving order.
      if (Object.keys(establishingShotsChild).length > 0) {
        const withEst: Segment[] = [];
        let estCounter = segCounter;
        for (const seg of assemblyScenes) {
          const sceneId = `child_sc${String(seg.parentScene).padStart(2, "0")}`;
          const shot = establishingShotsChild[sceneId];
          if (shot?.imageUrl) {
            withEst.push({
              scene: ++estCounter,
              videoUrl: `img:${shot.imageUrl}`,
              parentScene: seg.parentScene,
            });
          }
          withEst.push({ ...seg, scene: ++estCounter });
        }
        assemblyScenes.length = 0;
        assemblyScenes.push(...withEst);
        segCounter = estCounter;
      }

      for (const s of assemblyScenes) {
        progress[s.scene] = "processing";
        setAssemblyProgress({ ...progress });
        await new Promise(resolve => setTimeout(resolve, 200));
        progress[s.scene] = "done";
        setAssemblyProgress({ ...progress });
      }

      const assembleProjectId = urlProjectId || `children_${contentParam || "story"}_${topicParam || "default"}`;

      // ── AUTO-GENERATE NARRATION IF MISSING (Henry 2026-05-30) ──
      // Before this, assembling without manually clicking "Generate Narration" first
      // produced a silent video — user reported "narration do not work". Now we auto-fire
      // TTS in the assembly path so narration is always present.
      let resolvedNarratorAudioUrl = narratorAudioUrl;
      // Henry 2026-06-01 (Option A — speed): the auto-expand + auto-TTS path
      // was costing 45-90 seconds inside assembleMovie. Now SKIP both if
      // narratorAudioUrl already exists. User has a clear path: click
      // "Generate Narration" → Piper renders once → narratorAudioUrl set →
      // Assemble runs in ffmpeg-only time (~30-50s for 7 scenes).
      // If no narration url exists, we just SKIP the TTS path entirely and
      // assemble silently — the warning was already surfaced via the
      // resolveNarrationText returning short text. Hybrid is unaffected
      // (uses /api/assembly/execute).
      const { text: usableNarrationText } = resolvedNarratorAudioUrl
        ? { text: narrationText || textContent || "" }
        : await resolveNarrationText();
      if (!resolvedNarratorAudioUrl) {
        const storyForTTS = usableNarrationText.trim();
        if (storyForTTS.length > 10) {
          try {
            // Henry 2026-05-31: raised char cap from 3000 → 30000 (was capping at ~2 min
            // of speech regardless of story length, so 5-min/10-min stories cut early).
            // Piper handles long text fine; 30k chars ≈ 20 min spoken at default rate.
            setLastAction(`Auto-generating narration (${effectiveNarrationProvider}, ${storyForTTS.length} chars ≈ ${Math.round(storyForTTS.length / 4 / 130)} min)...`);
            const ttsRes = await fetch("/api/tts", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: storyForTTS.slice(0, 30000), provider: effectiveNarrationProvider, engine: effectiveNarrationProvider, voiceId: effectiveNarrationProvider === "edge-tts" ? edgeTtsVoiceId : pickPiperVoice(), speed: narrationSpeed }),
            });
            if (ttsRes.ok) {
              const ttsData = await ttsRes.json() as { audioUrl?: string; engine?: string };
              // Henry 2026-06-03 (Sonnet C audit Fix #3): same placeholder-reject
              // applied to the auto-fire-during-assemble path. Otherwise assemble
              // would proceed with a silent placeholder URL and ship a 30s beep.
              if (ttsData.engine === "placeholder") {
                setLastAction("Narration unavailable (TTS placeholder). Check server logs.");
              } else if (ttsData.audioUrl) {
                resolvedNarratorAudioUrl = ttsData.audioUrl;
                setNarratorAudioUrl(ttsData.audioUrl);
              }
            }
          } catch (autoTtsErr) {
            console.warn("[children-planner] auto-narration failed:", autoTtsErr);
          }
        }
      }
      const narrationList = resolvedNarratorAudioUrl ? [{ startTime: 0, audioUrl: resolvedNarratorAudioUrl, volume: 1.0 }] : [];
      // Collect SFX: AI-generated SFX + any saved freesound picks
      const sfxList: Array<{ sourceUrl: string; startTime: number; volume: number }> = [];
      if (sfxGeneratedUrl) sfxList.push({ sourceUrl: sfxGeneratedUrl, startTime: 0, volume: 0.6 });
      // Attach scene text so assembly route can render subtitles
      // Henry 2026-06-03 (Sonnet A audit Fix #2 — the 99% stuck root cause):
      // Old code computed perSegmentDuration from estimateTextDuration() — a
      // 3-words-per-second text estimate. Real TTS (Piper) runs ~1.5-2 w/s.
      // So estimate said 60s when actual audio was 5+ minutes. Segments rendered
      // SHORT, video finished at 30-60s while audio still had 4+ minutes to play.
      // Result: 99% stuck forever waiting for audio to catch up to video.
      // FIX: use the AUDIO PROBED duration (_totalNarFromProbe) we already
      // measured at the top of this function. Falls back to text estimate only
      // when the probe failed (no audio yet, or HTMLAudioElement error).
      const totalNarDuration = _totalNarFromProbe > 0
        ? _totalNarFromProbe
        : (narrationText ? estimateTextDuration(narrationText) : 0);
      // Per-segment duration: divide narrator total by total SEGMENT count.
      const perSegmentDuration = totalNarDuration > 0
        ? Math.max(2, totalNarDuration / assemblyScenes.length)
        : 5;
      // Strip the parentScene helper field before sending — /api/video/assemble doesn't
      // know about it.
      //
      // Henry 2026-05-30 (subtitle-per-scene fix): the old code passed
      //   scene.text = `${parent.title}: ${parent.visualDescription}`
      // which baked META text ("Introducing the Letter P: A big letter P shows...")
      // into per-scene subtitle PNGs. Assembly route burns slideText per scene from
      // scene.text — so the META leaked onto every scene as subtitle even though
      // body.caption had the real narration.
      //
      // Fix: split the actual full narration across the segments by sentence-count
      // so each segment carries the words spoken DURING its time slot. Hybrid does
      // this naturally because narration is generated per-scene; children narrates
      // the whole story in one pass so we slice it client-side.
      const _narrationForSegs = (usableNarrationText || narrationText || expandedContent || "").trim();
      const _sentences = _narrationForSegs
        ? _narrationForSegs.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
        : [];
      const _segCount = Math.max(1, assemblyScenes.length);
      const _perSeg = _sentences.length > 0 ? Math.max(1, Math.ceil(_sentences.length / _segCount)) : 0;
      const _segText = (i: number): string => {
        if (_sentences.length === 0) return "";
        const start = i * _perSeg;
        const end = Math.min(_sentences.length, start + _perSeg);
        return _sentences.slice(start, end).join(" ");
      };
      const scenesWithText = assemblyScenes.map(({ parentScene: _drop, duration: segDur, ...rest }, i) => {
        return {
          ...rest,
          // Per-segment duration if set (multi-beat flip rate), else equal split
          duration: segDur ?? perSegmentDuration,
          // Real spoken words for this segment — never the meta title.
          text: _segText(i),
        };
      });
      // Henry 2026-05-31: subtitle was picking the scene TITLE ("Clap Your Hands":
      // visualDescription) instead of the SPOKEN narration. Now send body.caption =
      // narration text (or expandedContent fallback) so subtitle matches what's spoken,
      // not the scene topic. /api/video/assemble's chunked drawtext path consumes this.
      const captionForSubs = (usableNarrationText || narrationText || expandedContent || "").trim() || undefined;
      // Henry 2026-06-01: switched to fire-and-poll async pattern because Cloudflare
      // Tunnel's free-tier edge has a hard 100-second timeout, and 7-scene assemble +
      // auto-narration takes ~140s. /api/video/assemble-async returns a jobId immediately;
      // the heavy work runs in-process and writes status to a file. Client polls
      // /api/video/job-status until done. Hybrid uses /api/assembly/execute and is unaffected.
      // Henry 2026-06-02 Phase B: pacing-aware subtitle timing.
      // If a Pacing Plan exists for this project, compute exact start/end ms
      // per entry and ship to assemble route. Server uses those timings to
      // build perfectly-synced ASS Dialogue lines instead of guessing with
      // arbitrary 1.6s/chunk. No plan → falls back to chunked timing.
      const pacingEntriesForAssemble = pacingPlan ? (() => {
        let cum = 0;
        return pacingPlan.entries
          .filter(e => e.text && e.text.trim().length > 0 && e.type !== "pause")
          .map(e => {
            const startMs = cum;
            cum += e.durationMs;
            const endMs = cum;
            return { text: e.text, startMs, endMs };
          });
      })() : undefined;
      const assemblePayload = {
        projectId: assembleProjectId,
        title: `Children Story — ${contentParam || "story"}`,
        scenes: scenesWithText,
        musicUrl: selectedMusicUrl || generatedMusicUrl || undefined,
        musicVolume: 0.75,
        narrationList,
        sfx: sfxList.length > 0 ? sfxList : undefined,
        aspectRatio: "16:9",
        subtitleConfig: effectiveSubtitleConfig,
        caption: captionForSubs,
        pacingEntries: pacingEntriesForAssemble,
        introUrl: introUrl || undefined,
        outroUrl: outroUrl || undefined,
      };
      setLastAction("Submitting assembly job…");
      const startRes = await fetch("/api/video/assemble-async", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assemblePayload),
      });
      if (!startRes.ok) {
        const errText = await startRes.text();
        setLastAction(`Assembly start failed (${startRes.status}): ${errText.slice(0, 200)}`);
        setAssembling(false);
        return;
      }
      const startData = await startRes.json() as { jobId?: string; error?: string };
      if (!startData.jobId) {
        setLastAction(`Assembly start failed: ${startData.error || "no jobId returned"}`);
        setAssembling(false);
        return;
      }
      const jobId = startData.jobId;
      // Henry 2026-06-18 (TODO #5 — resumable jobs): persist the jobId per project
      // so that if the user navigates away or closes the tab while the render runs,
      // the resume effect on next load can re-attach and show the finished video
      // (instead of the render silently finishing into the void).
      try { localStorage.setItem(assembleJobKey(), JSON.stringify({ jobId, startedAt: Date.now() })); } catch { /* storage unavailable — non-fatal */ }
      setLastAction(`Assembling… (job ${jobId.slice(0, 8)})`);

      // Poll status every 4 seconds; cap at 20 minutes (300 polls).
      // Henry 2026-06-02: bumped 12 -> 20 min because long pacing-aware stories
      // (36 entries / 319s narration) ran past 12-min cap while worker was
      // still alive (worker has 15-min budget + bumper concat tail).
      // Progress bar creeps based on heartbeat. Real completion fills to 100%.
      const POLL_INTERVAL_MS = 4000;
      const MAX_POLLS = 300;
      const estimatedTotalMs = Math.max(60000, scenesToAssemble.length * 22000);
      let polled = 0;
      let outputUrl: string | undefined;
      let jobError: string | undefined;
      while (polled < MAX_POLLS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        polled++;
        const elapsedMs = polled * POLL_INTERVAL_MS;
        const clientSec = Math.round(elapsedMs / 1000);
        try {
          const statusRes = await fetch(`/api/video/job-status?jobId=${encodeURIComponent(jobId)}`);
          if (!statusRes.ok) {
            // 404 right after submit is normal. Use client estimate until status file exists.
            setAssemblyElapsedSec(clientSec);
            setAssemblePercent(Math.min(99, 5 + (elapsedMs / estimatedTotalMs) * 90));
            continue;
          }
          const status = await statusRes.json() as { status?: string; outputUrl?: string; error?: string; tookMs?: number; note?: string };
          if (status.status === "done" && status.outputUrl) {
            outputUrl = status.outputUrl;
            setAssemblePercent(100);
            setLastAction(`Assembled in ${Math.round((status.tookMs || 0) / 1000)}s — ready`);
            break;
          }
          if (status.status === "error") {
            jobError = status.error || "unknown error";
            break;
          }
          // Henry 2026-06-02: prefer server heartbeat elapsed time over client estimate.
          // Worker writes "assembling (Xs elapsed)" every 8s. Parse X and show THAT
          // so the bar reflects reality. Cap at 99% (not 95) so it doesn't look stuck.
          const noteMatch = status.note?.match(/(\d+)s elapsed/);
          const serverSec = noteMatch ? parseInt(noteMatch[1], 10) : clientSec;
          setAssemblyElapsedSec(serverSec);
          const creeping = Math.min(99, 5 + (serverSec * 1000 / estimatedTotalMs) * 90);
          setAssemblePercent(creeping);
          // Surface progress every 5 polls (20s)
          if (polled % 5 === 0) {
            setLastAction(`Assembling… ${serverSec}s elapsed (${Math.round(creeping)}%) — ${status.note || "running"}`);
          }
        } catch { /* network blip — continue polling */ }
      }

      if (jobError) {
        // TODO #5: terminal failure — drop the resume marker so we don't re-nag on reload.
        try { localStorage.removeItem(assembleJobKey()); } catch { /* non-fatal */ }
        setAssemblyError(jobError);
        setAssemblePercent(0);
        setLastAction(`Assembly error: ${jobError.slice(0, 200)}`);
        setAssembling(false);
        return;
      }
      if (!outputUrl) {
        // Henry 2026-06-02: honest message — UI poll cap reached, server may
        // STILL be processing (worker has its own 15-min budget). Tell user
        // where the video will appear if the worker finishes.
        const elapsedMin = Math.round((polled * POLL_INTERVAL_MS) / 60000);
        const timeoutMsg = `UI poll cap reached after ${elapsedMin} min. The server worker may still be finishing — check All Content / Asset Library in a couple minutes. If still missing, try fewer scenes or rebuild pacing plan.`;
        setAssemblyError(timeoutMsg);
        setAssemblePercent(0);
        setLastAction(timeoutMsg);
        setAssembling(false);
        return;
      }
      setAssembledUrl(outputUrl);
      setGeneratedVideoUrl(outputUrl);
      // TODO #5: render finished and shown — drop the resume marker.
      try { localStorage.removeItem(assembleJobKey()); } catch { /* non-fatal */ }
      try {
        await fetch("/api/assets", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `Children Story — ${contentParam || "story"}`, type: "children-video", videoUrl: outputUrl, status: "review", metadata: { ageGroup, learningMode, visualStyle: effectiveProjectStyle, scenes: assemblyScenes.length } }),
        });
      } catch { /* ignore */ }
      setAssemblyComplete(true);
      setLastAction("Story assembled successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "try again";
      setAssemblyError(msg);
      setAssemblePercent(0);
      setLastAction(`Assembly failed — ${msg}`);
    }
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

  // ── Children Pacing Engine functions ─────────────────────────────────────
  async function buildPacingPlan() {
    const storyText = expandedContent || readAlongText || textContent || "";
    if (!storyText.trim()) { setLastAction("Enter story content first"); return; }
    setBuildingPacingPlan(true);
    try {
      const res = await fetch("/api/children/build-pacing-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText,
          mode: learningMode === "word" || learningMode === "phonics" ? "learning" : "story",
          wordList: undefined,
          targetAgeGroup: ageGroup === "toddler" ? "2-4" : ageGroup === "preschool" || ageGroup === "early" ? "5-7" : "8-10",
        }),
      });
      const data = await res.json();
      if (data.ok && data.plan) {
        setPacingPlan(data.plan);
        setLastAction(`Pacing plan built — ${data.plan.entries.length} timed entries`);
      } else {
        setLastAction(`Pacing plan failed: ${data.error || "unknown error"}`);
      }
    } catch (err) {
      setLastAction(`Pacing plan error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBuildingPacingPlan(false);
  }

  async function generatePacingNarration() {
    if (!pacingPlan) { setLastAction("Build pacing plan first"); return; }
    setBuildingPacingNarration(true);
    try {
      const voiceId = Object.values(characterVoices)[0] || "en_US-lessac-medium";
      const res = await fetch("/api/children/generate-narration", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: pacingPlan, voiceId }),
      });
      const data = await res.json();
      if (data.ok && data.audioUrl) {
        setPacingAudioUrl(data.audioUrl);
        setPacingTimingMap(data.timingMap || []);
        // Henry 2026-06-03 (Sonnet A audit Fix #4): bridge pacing -> main.
        // Previously generatePacingNarration set ONLY pacingAudioUrl, not
        // narratorAudioUrl. So when user clicked "Build Pacing Plan" +
        // "Generate Pacing Narration" + "Assemble", the main assembleMovie()
        // saw narratorAudioUrl=null, fired a SECOND TTS pass with raw text,
        // produced a different audio file, and shipped THAT to assemble —
        // while the pacing entries' timings referred to the FIRST audio.
        // Result: subtitles desynced, pacing audio orphaned.
        // Fix: also set narratorAudioUrl so the main assemble path uses
        // the same paced narration the pacingEntries are timed against.
        setNarratorAudioUrl(data.audioUrl);
        setLastAction(`Pacing narration ready — ${Math.round((data.durationMs || 0) / 1000)}s`);
      } else {
        setLastAction(`Narration failed: ${data.error || "unknown"}`);
      }
    } catch (err) {
      setLastAction(`Narration error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBuildingPacingNarration(false);
  }

  async function assemblePacingVideo() {
    if (!pacingPlan || !pacingAudioUrl) { setLastAction("Build pacing plan + narration first"); return; }
    setAssemblingPacingVideo(true);
    try {
      const scenes = childScenes
        .filter(s => assemblySelectedIds.includes(`child_sc${String(s.scene).padStart(2, "0")}`))
        .map((s, i) => ({
          sceneId: `child_sc${String(s.scene).padStart(2, "0")}`,
          imageUrl: sceneImages[`child_sc${String(s.scene).padStart(2, "0")}`] || s.imageUrl || "",
          imageConceptKey: s.title || `scene_${i}`,
        }))
        .filter(s => s.imageUrl);
      const res = await fetch("/api/children/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProjectIdRef.current || "ghs_children_default",
          plan: pacingPlan,
          timingMap: pacingTimingMap,
          audioUrl: pacingAudioUrl,
          scenes,
        }),
      });
      const data = await res.json();
      if (data.ok && data.videoUrl) {
        setPacingVideoUrl(data.videoUrl);
        setGeneratedVideoUrl(data.videoUrl);
        setLastAction("Pacing video assembled");
      } else {
        setLastAction(`Assembly failed: ${data.error || "unknown"}`);
      }
    } catch (err) {
      setLastAction(`Assembly error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAssemblingPacingVideo(false);
  }

  // ── SHARED narration-text resolver (Henry 2026-05-31, BIB audit deep) ──
  // The BIB hunt found 3 different narration-firing paths in this file, each
  // doing its own (narrationText || textContent || readAlongText) check. Only
  // generateNarration had the full chain (+ scriptSegments + audioPlans fallback).
  // Pre-flight auto-narrate (L1843) and the per-scene Generate button (L5662)
  // were tiny-text → BIB-WAV producers on NEW projects whose textContent is
  // just the short topic prompt ("Word Magic BAG") → 1-second BIB output.
  //
  // CRITICAL DISTINCTION Henry surfaced 2026-05-31:
  //   "AAA Untitled Children Project work with sound … new project dont work
  //    with sound just bib"
  // The default project has fully-expanded narrationText already saved. New
  // projects start with only the URL-param prompt (~30-80 chars). Without an
  // expand step BEFORE TTS, every new project produces BIB.
  //
  // This sync helper IS the source of truth — every TTS caller uses it.
  function getNarrationSourceText(): string {
    let text = (narrationText?.trim() || textContent?.trim() || readAlongText?.trim()) || "";
    if (text.length < 100 && Array.isArray(scriptSegments) && scriptSegments.length > 0) {
      const joined = scriptSegments.map(s => s.text).filter(Boolean).join(" ").trim();
      if (joined.length > text.length) text = joined;
    }
    if (text.length < 100 && audioPlans && Object.keys(audioPlans).length > 0) {
      const planScripts = Object.keys(audioPlans)
        .map(k => Number(k))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b)
        .map(n => audioPlans[n]?.narrationScript || "")
        .filter(Boolean)
        .join(" ")
        .trim();
      if (planScripts.length > text.length) text = planScripts;
    }
    return text;
  }

  // ── ASYNC narration resolver — gets text + auto-expands if still short ──
  // Used by all 3 narration-firing paths. seedForExpand lets callers nudge it
  // with whatever short text they DO have (textContent typically). Returns the
  // final text + an `expanded` flag for telemetry. NEVER returns sub-80 chars
  // unless absolutely nothing can be expanded — preventing BIB at the source.
  async function resolveNarrationText(opts: { minLen?: number } = {}): Promise<{ text: string; expanded: boolean }> {
    const minLen = opts.minLen ?? Math.max(800, storyLengthMin * 60 * 130 / 60 * 4);
    let text = getNarrationSourceText();
    let expanded = false;
    if (text.length < minLen) {
      const seed = (textContent || text || "").trim();
      if (seed.length > 0) {
        try {
          setLastAction(`Expanding story to fill ${storyLengthMin}-min narration target...`);
          const exp = await fetch("/api/hybrid/story-expand", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storyInput: seed,
              genre: "children",
              tone: tone === "soft" ? "warm, gentle, bedtime-friendly" : "fun, playful, energetic",
              audience: AGE_AUDIENCE[ageGroup] || "children",
              language: "English",
              languageLevel: ageGroup === "toddler" || ageGroup === "preschool" ? "simple_english" : "normal_english",
              storyType: "story_book",
              targetDuration: targetSeconds,
              targetDurationLabel: `${storyLengthMin} min`,
              tier: "pro",
              provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
              childContext: { ageGroup, learningMode, safetyLevel, visualStyle: projectStyle },
            }),
            signal: AbortSignal.timeout(180000),
          });
          if (exp.ok) {
            const expJson = await exp.json() as { expandedStory?: { fullScript?: string; summary?: string } };
            const fullScript = expJson?.expandedStory?.fullScript || "";
            if (fullScript && fullScript.length > text.length) {
              text = fullScript;
              expanded = true;
              setNarrationText(fullScript);
              setExpandedContent(expJson?.expandedStory?.summary || fullScript);
            }
          }
        } catch (autoExpErr) {
          console.warn("[resolveNarrationText] expand failed:", autoExpErr);
        }
      }
    }
    return { text, expanded };
  }

  // ── Narration-only TTS generation ──
  async function generateNarration() {
    // Henry 2026-05-31 BIB AUDIT (deep): use the shared resolveNarrationText helper
    // so this function does EXACTLY what the pre-flight auto-narrate and per-scene
    // Generate button do — no divergence. The helper handles: source fallback chain
    // (narrationText → textContent → readAlongText → scriptSegments → audioPlans
    // concatenation), and auto-expansion via /api/hybrid/story-expand when the
    // result is below the picker duration's character floor.
    const { text } = await resolveNarrationText();
    if (text.replace(/\s+/g, "").length < 80) {
      setUiError(`Narration text is too short (${text.length} chars) after expand — write or pick a story first. TTS skipped to avoid 1-second beep output.`);
      return;
    }

    setNarrationGenerating(true);
    setUiError("");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 30000),
          provider: effectiveNarrationProvider,
          engine: effectiveNarrationProvider,
          speed: narrationSpeed,
          // Henry 2026-06-13: edge-tts uses edgeTtsVoiceId (regional); ElevenLabs
          // uses its fixed starter voice; learning-mode Piper uses pickPiperVoice().
          voiceId: effectiveNarrationProvider === "elevenlabs" ? "EXAVITQu4vr4xnSDxMaL"
            : effectiveNarrationProvider === "edge-tts" ? edgeTtsVoiceId
            : pickPiperVoice(),
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        throw new Error(`TTS error ${res.status}: ${errBody}`);
      }
      const data = await res.json() as { audioUrl?: string; error?: string; engine?: string; message?: string; pacingEntries?: Array<{ word: string; startMs: number; endMs: number }> };
      if (data.error) throw new Error(data.error);
      // Henry 2026-06-03 (Sonnet C audit Fix #3): reject placeholder on the
      // manual Generate Narration button path.
      if (data.engine === "placeholder") {
        setLastAction("Narration unavailable — TTS returned silent placeholder. Check Piper / FAL config.");
      } else if (data.audioUrl) {
        setNarratorAudioUrl(data.audioUrl);
        // Store word timings + spoken text for NarrationPreview subtitle sync.
        setNarratorWordTimings(Array.isArray(data.pacingEntries) && data.pacingEntries.length > 0 ? data.pacingEntries : null);
        setNarratorSubText(text.slice(0, 30000));
        setLastAction(`Narration generated (${data.engine || effectiveNarrationProvider})`);
      } else if (data.engine === "browser-speech") {
        // Karaoke mode uses Web Speech API in-browser, no file generated.
        setLastAction("Karaoke mode active — narration will play via browser speech at playback time.");
      } else {
        throw new Error(data.message || "No audio URL returned");
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Narration generation failed");
    }
    setNarrationGenerating(false);
  }

  // ── AI Audio Plan for children (Henry 2026-05-30, task #12) ──
  // Mirror hybrid's aiPrepareAssembly: send all scenes + characters + story context to
  // /api/hybrid/audio-plan, receive per-scene plan (narration script + music mood + SFX
  // list + ambience list). Stash in audioPlans state keyed by scene number.
  async function runChildrenAudioPlan() {
    if (childScenes.length === 0) { setLastAction("Build scenes first (Scene Board tab)"); return; }
    setRunningAudioPlan(true);
    setLastAction("AI is planning audio for each scene...");
    try {
      const storyContext = [
        "Story:",
        textContent || expandedContent || "",
        "",
        "Scenes:",
        ...childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}: ${s.title}. ${s.visualDescription}`),
      ].join("\n");
      const scenesPayload = childScenes.map(s => ({
        sceneId: `child_sc${String(s.scene).padStart(2, "0")}`,
        title: s.title,
        description: s.visualDescription,
      }));
      const res = await fetch("/api/hybrid/audio-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenesPayload,
          characters,
          storyContext,
          generateNarration: true,
          childContext: { ageGroup, safetyLevel },
        }),
      });
      const data = await res.json();
      const plansByScene: Record<number, ChildAudioPlan> = {};
      childScenes.forEach((s, idx) => {
        const plan = data.audioPlans?.[idx];
        const narration = plan?.narrationScript || data.narrationScripts?.[idx] || "";
        plansByScene[s.scene] = {
          narrationScript: narration,
          musicMood: plan?.musicMood,
          sfxList: plan?.sfxList || [],
          ambienceList: plan?.ambienceList || [],
        };
      });
      setAudioPlans(plansByScene);
      setLastAction(`AI audio plan ready — ${Object.keys(plansByScene).length} scenes planned`);
    } catch (err) {
      console.error("[children] audio plan failed:", err);
      setLastAction("Audio plan failed — try again or assemble without it");
    } finally {
      setRunningAudioPlan(false);
    }
  }

  // ── Establishing Shot batch planner for children (Henry 2026-05-30 task #21) ──
  // Mirror hybrid's addAllEstablishingShots. Uses /api/hybrid/scene-edit op:"establish_all"
  // with mode-aware aggressiveness. Result stored in establishingShotsChild keyed by sceneId.
  async function runChildrenEstablishAll() {
    if (establishingAllChild || childScenes.length === 0) return;
    if (establishingModeChild === "off") {
      setEstablishingShotsChild({});
      setLastAction("Establishing shots OFF — cleared");
      return;
    }
    setEstablishingAllChild(true);
    setLastAction(`Planning establishing shots (mode: ${establishingModeChild})…`);
    try {
      const scenesPayload = childScenes.map(s => ({
        sceneId: `child_sc${String(s.scene).padStart(2, "0")}`,
        title: s.title,
        description: s.visualDescription,
        location: "",
        timeOfDay: "",
        mood: "",
      }));
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "establish_all",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          scenes: scenesPayload,
          storyText: textContent || expandedContent || "",
          establishingMode: establishingModeChild,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.results)) {
        const next: Record<string, ChildEstablishingShot> = {};
        let count = 0;
        for (const r of data.results as Array<{ sceneId: string; needed: boolean; shot: ChildEstablishingShot | null }>) {
          if (r.needed && r.shot) { next[r.sceneId] = r.shot; count++; }
        }
        setEstablishingShotsChild(next);
        setLastAction(`${count} establishing shot${count === 1 ? "" : "s"} planned across ${childScenes.length} scene${childScenes.length === 1 ? "" : "s"}`);
      } else {
        setLastAction(`Establishing shots failed: ${data.error || "unknown"}`);
      }
    } catch (err) {
      setLastAction(`Establishing shots failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEstablishingAllChild(false);
    }
  }

  // Generate the wide image for a single planned establishing shot.
  async function genChildEstablishingShotImage(sceneId: string) {
    const shot = establishingShotsChild[sceneId];
    if (!shot) { setLastAction("No establishing shot planned for this scene"); return; }
    try {
      const res = await fetch("/api/hybrid/establishing-shot/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, shot }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setEstablishingShotsChild(prev => ({ ...prev, [sceneId]: { ...shot, imageUrl: data.imageUrl } }));
        setLastAction("Establishing shot image generated");
      } else if (data.error) {
        setLastAction(`Establishing shot image failed: ${data.error}`);
      }
    } catch (err) {
      setLastAction(`Establishing shot image error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Music-only generation ──
  async function generateChildrenMusic() {
    setMusicGenerating(true);
    setUiError("");
    try {
      const musicMood = musicChoice === "soft_story" ? "calm" : musicChoice === "nursery" ? "playful" : "upbeat";
      // Resolve providerKey from the selected SOUND_TIERS entry
      const activeTier = SOUND_TIERS.find(t => t.id === effectiveSoundTier);
      const resolvedProviderKey = activeTier?.providerKey ?? "stock";

      // Henry 2026-06-16: free/stock tier → pick a KID-APPROPRIATE track matching the chosen
      // mood from the licensed catalog. (The old /api/music/generate path always returned the
      // same track because the prompt "for a children's story" out-scored the mood.) AI tiers
      // (stable_audio/kie) still generate via /api/music/generate below.
      if (resolvedProviderKey === "stock") {
        let tracks: Array<{ url: string; description?: string; id: string; license?: string }> = [];
        try {
          const r = await fetch(`/api/music/stock?children=1&mood=${encodeURIComponent(musicMood)}`);
          tracks = (await r.json()).tracks ?? [];
          if (tracks.length === 0) {
            const r2 = await fetch(`/api/music/stock?children=1`);
            tracks = (await r2.json()).tracks ?? [];
          }
        } catch { /* fall through to error below */ }
        if (tracks.length === 0) {
          throw new Error("No children music available yet. Add kid-friendly tracks in Music Studio → Upload (CC0 / Pixabay / Mixkit).");
        }
        const pick = tracks[Math.floor(Math.random() * tracks.length)];
        setGeneratedMusicUrl(pick.url);
        setSelectedMusicUrl(pick.url);
        setSelectedMusicName(pick.description || pick.id);
        setMusicFallbackReason(null);
        setLastAction(`Children music: "${pick.description || pick.id}" (${musicMood}, ${pick.license || "CC0"})`);
        setMusicGenerating(false);
        return;
      }

      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${musicMood} background music for a children's story`,
          durationSeconds: 20,
          providerKey: resolvedProviderKey,
          genre: musicGenre === "auto" ? undefined : musicGenre,
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
            genre: musicGenre === "auto" ? undefined : musicGenre,
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
  // Henry 2026-05-31: also accept `continue=<id>` URL param so the "Continue this
  // series" link from /children-video resolves to its target project instead of
  // silently falling through to ghs_children_default.
  const urlProjectId = searchParams.get("projectId") || searchParams.get("continue");

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
  // Henry 2026-06-04: FLUX Schnell as the FORCED default for children-planner.
  // FAL pricing: Schnell = $0.003/image. Pruna = $0.005. Pro = $0.04. Schnell
  // is BOTH the cheapest AND better than Pruna at motion/composition. Always
  // win, no tradeoff. Project's explicit pick (if not 'auto') still respected.
  const effectiveImageModelId = projectSettings.imageModelVersion !== "auto"
    ? (projectSettings.imageModelVersion ?? "fal_flux_schnell")
    : "fal_flux_schnell";
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
            if (typeof d.studioName === "string") setStudioName(d.studioName);
            if (d.narrationProvider) setNarrationProvider(d.narrationProvider);
            if (d.musicChoice)      setMusicChoice(d.musicChoice);
            if (d.musicGenre)       setMusicGenre(d.musicGenre);
            if (d.ageGroup)         setAgeGroup(d.ageGroup);
            if (d.safetyLevel)      setSafetyLevel(d.safetyLevel);
            if (d.learningMode)     setLearningMode(d.learningMode);
            if (d.savedChars?.length > 0)   setSavedChars(d.savedChars);
            if (d.selectedCharIds?.length > 0) setSelectedCharIds(d.selectedCharIds);
            if (d.characters?.length > 0)   setCharacters(d.characters);
            if (d.childScenes?.length > 0) {
              setChildScenes(d.childScenes);
              // Henry 2026-05-31: auto-select all scenes for assembly on reopen — mirrors
              // the planScenes paths (L1208/L1372). Without this, after closing/reopening
              // a saved project the Assemble button stayed grey'd out ("Select scenes
              // above to assemble") because assemblySelectedIds wasn't restored. If the
              // user persisted a deselected subset, that wins (next line restores it).
              setAssemblySelectedIds(d.childScenes.map((_: ChildScene, i: number) => `child_sc${String(i + 1).padStart(2, "0")}`));
            }
            if (Array.isArray(d.assemblySelectedIds) && d.assemblySelectedIds.length > 0) setAssemblySelectedIds(d.assemblySelectedIds);
            if (d.assemblyMediaPrefs && Object.keys(d.assemblyMediaPrefs).length > 0) setAssemblyMediaPrefs(d.assemblyMediaPrefs);
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
            if (d.storyEra)         setStoryEra(d.storyEra);
            if (d.storyCulture)     setStoryCulture(d.storyCulture);
            // C6 PACING SAVE/LOAD (Henry 2026-05-30): restore the pacing engine outputs
            // so a refresh / re-open keeps the user's plan + narration + assembled video.
            if (d.pacingPlan)       setPacingPlan(d.pacingPlan);
            if (typeof d.imageFlipRate === "number") setImageFlipRate(d.imageFlipRate);
            if (d.pacingAudioUrl)   setPacingAudioUrl(d.pacingAudioUrl);
            if (d.pacingVideoUrl)   setPacingVideoUrl(d.pacingVideoUrl);
            if (d.pacingTimingMap)  setPacingTimingMap(d.pacingTimingMap);
            if (d.audioPlans && Object.keys(d.audioPlans).length > 0) setAudioPlans(d.audioPlans);
            if (d.establishingShotsChild && Object.keys(d.establishingShotsChild).length > 0) setEstablishingShotsChild(d.establishingShotsChild);
            if (d.establishingModeChild) setEstablishingModeChild(d.establishingModeChild);
            // Henry 2026-05-31 (#8): restore word-on-image toggle
            if (typeof d.wordOverlayEnabled === "boolean") setWordOverlayEnabled(d.wordOverlayEnabled);
            // Henry 2026-06-05 (task #86): restore continueMotion + per-scene motion map.
            if (typeof d.continuousMotionEnabled === "boolean") setContinuousMotionEnabled(d.continuousMotionEnabled);
            if (d.sceneContinuousMotion && typeof d.sceneContinuousMotion === "object") setSceneContinuousMotion(d.sceneContinuousMotion);
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

  // ── BELT-AND-SUSPENDERS auto-select safety net (Henry 2026-05-31) ──
  // Saved-state restore at L2729-2738 auto-selects + persists assemblySelectedIds, but
  // older projects saved before that fix have childScenes WITHOUT assemblySelectedIds.
  // When such a project re-loads, restore yields childScenes hydrated but selection
  // empty → Assemble stays grey forever. This effect catches it: as soon as childScenes
  // is populated and we're NOT in restoration AND no selection exists, default to ALL.
  // Manual user deselection still wins because user actions happen AFTER restore.
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (childScenes.length === 0) return;
    if (assemblySelectedIds.length > 0) return;
    setAssemblySelectedIds(childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}`));
  }, [childScenes, assemblySelectedIds.length]);

  // ── TODO #5 (resumable jobs): re-attach to a render that finished while away ──
  // If the user submitted an assemble job then left/closed the tab, the jobId was
  // persisted to localStorage. On return we check that job ONCE: if it finished,
  // surface the video; if it's genuinely still running, say so; if it failed or is
  // long-gone, drop the marker. (job-status already turns a dead/stale "running"
  // worker into "error", so a "running" status here is genuinely alive.)
  const resumeCheckedRef = useRef(false);
  useEffect(() => {
    if (resumeCheckedRef.current || typeof window === "undefined") return;
    resumeCheckedRef.current = true;
    const key = assembleJobKey();
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { return; }
    if (!raw) return;
    const clear = () => { try { localStorage.removeItem(key); } catch { /* non-fatal */ } };
    let jobId: string | undefined, startedAt = 0;
    try { const p = JSON.parse(raw) as { jobId?: string; startedAt?: number }; jobId = p.jobId; startedAt = p.startedAt ?? 0; }
    catch { clear(); return; }
    if (!jobId) { clear(); return; }
    (async () => {
      try {
        const res = await fetch(`/api/video/job-status?jobId=${encodeURIComponent(jobId!)}`);
        if (res.status === 404) {
          // status file gone — clear only if the job is old enough to certainly be done/lost
          if (startedAt && Date.now() - startedAt > 30 * 60 * 1000) clear();
          return;
        }
        const s = await res.json() as { status?: string; outputUrl?: string };
        if (s.status === "done" && s.outputUrl) {
          setAssembledUrl(s.outputUrl);
          setGeneratedVideoUrl(s.outputUrl);
          setAssemblyComplete(true);
          setAssemblePercent(100);
          setLastAction("Your earlier render finished — the video is ready below.");
          clear();
        } else if (s.status === "error") {
          clear();
        } else if (s.status === "running") {
          setLastAction("A render for this project is still in progress — it'll appear in All Content when it finishes.");
        } else {
          // Unexpected status (neither done/error/running) — don't silently sit in limbo.
          console.warn(`[children-planner] resume: unexpected job status "${s.status}" for ${jobId} — leaving marker for retry`);
        }
      } catch { /* network blip — leave the marker for the next load */ }
    })();
  }, [urlProjectId, contentParam, topicParam]);

  // ── BACKFILL empty visualDescription from narration (Henry 2026-05-31) ──
  // INFINITE-LOOP FIX (Henry 2026-05-31): the old version called
  //   setChildScenes(prev => prev.map(...))
  // which ALWAYS returned a new array reference even when every scene's content
  // was unchanged (e.g. lines.length=0 short-returned, but earlier shape did map
  // anyway). React treated the new array as a state change → re-render → effect
  // re-runs → infinite loop → 3-sec click freeze on every page.
  //
  // Fix: compute the new array first; bail out BEFORE calling setChildScenes
  // unless at least one scene's visualDescription actually changed. Plus a ref
  // tracking the last-backfilled-from key (childScenes identity + segments
  // length) prevents re-firing for the same input.
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (childScenes.length === 0) return;
    const empty = childScenes.filter(s => !s.visualDescription || s.visualDescription.trim().length < 6);
    if (empty.length === 0) return;
    const lines: string[] = (Array.isArray(scriptSegments) && scriptSegments.length > 0
      ? scriptSegments.map(seg => seg.text).filter(Boolean)
      : (textContent || "").split(/(?<=[.!?])\s+/)).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const perScene = Math.max(1, Math.ceil(lines.length / childScenes.length));
    let changed = false;
    const next = childScenes.map((s, i) => {
      if (s.visualDescription && s.visualDescription.trim().length >= 6) return s;
      const start = i * perScene;
      const end = Math.min(lines.length, start + perScene);
      const filled = lines.slice(start, end).join(" ");
      if (!filled) return s;
      changed = true;
      return { ...s, visualDescription: filled };
    });
    if (!changed) return;
    setChildScenes(next);
  }, [childScenes, scriptSegments, textContent]);

  // ── Save project state — DB only, debounced via useEffect deps ──
  useEffect(() => {
    if (isRestoringRef.current) return;
    const data = {
      projectTitle,
      textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice, musicGenre, studioName,
      ageGroup, safetyLevel, learningMode,
      storyEra, storyCulture,
      savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos,
      sceneBeatImages, selectedBeatImages,  // Gen Max beats — persist across refresh
      // Set serializes as Array via spread — restore reads as Array, hydrates back into Set.
      useMaxImageScenes: Array.from(useMaxImageScenes),
      scriptSegments, screenplay, selectedMusicUrl, selectedMusicName,
      soundTier, modelSettings, activeTab,
      characters,
      // C6 PACING SAVE (Henry 2026-05-30): persist pacing engine outputs so they survive refresh.
      pacingPlan, pacingAudioUrl, pacingVideoUrl, pacingTimingMap,
      // AI Audio Plan results (Henry 2026-05-30 task #12) so they survive refresh.
      audioPlans,
      // Establishing shot plan + mode (Henry 2026-05-30 task #21) so they survive refresh.
      establishingShotsChild, establishingModeChild,
      // Assembly selection (Henry 2026-05-31 children-planner assemble fix): persist which
      // scenes the user picked + their per-scene media preference, so reopen doesn't reset.
      assemblySelectedIds, assemblyMediaPrefs,
      // Henry 2026-05-31 (#8): word-on-image toggle — persists across refresh
      wordOverlayEnabled,
      // Henry 2026-06-05 (task #86): continueMotion / sceneContinuousMotion were never
      // persisted. The toggle state reset every refresh — DB inspection showed
      // continueMotion=None. Now both the global flag and per-scene map survive.
      continuousMotionEnabled,
      sceneContinuousMotion,
      timestamp: Date.now(),
    };
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: activeProjectIdRef.current || "ghs_children_default", data }),
    }).catch(() => { /* silent on DB error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectTitle, textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice, musicGenre, ageGroup, safetyLevel,
      storyEra, storyCulture,
      savedChars, selectedCharIds, childScenes, sceneImages, sceneVideos,
      sceneBeatImages, selectedBeatImages, useMaxImageScenes,
      scriptSegments, screenplay,
      selectedMusicUrl, selectedMusicName, soundTier, modelSettings, activeTab, characters,
      pacingPlan, pacingAudioUrl, pacingVideoUrl, pacingTimingMap, audioPlans,
      establishingShotsChild, establishingModeChild,
      assemblySelectedIds, assemblyMediaPrefs, wordOverlayEnabled]);

  // ── Load project list for "My Projects" panel ──
  // Henry 2026-06-04: was filtering server-side by prefix=ghs_children which
  // missed 27+ of Henry's projects that use child_<ts>_<rand> format (URL-
  // created). Now: fetch all, filter client-side for BOTH children prefixes.
  useEffect(() => {
    fetch("/api/hybrid/saved-state?list=true")
      .then(r => r.json())
      .then(d => {
        if (d.projects) {
          const filtered = d.projects.filter((p: { id: string }) =>
            p.id.startsWith("child_") || p.id.startsWith("ghs_children")
          );
          setProjectsList(filtered);
        }
      })
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

  // ── AI PREFILL on land (Henry 2026-05-30 task #38, replaces earlier auto-expand) ──
  // Previously this auto-fired expandStory() — too aggressive (full expansion before user
  // could review the story idea). Now: on land with URL params, fire prefillPrompt() which
  // generates a UNIQUE story idea (2-3 sentences) tailored to the user's selections. User
  // can then modify with the small "Intensify / Playful / Educational / Adventure / …" buttons
  // before clicking Expand. User A and User B picking same template get different ideas.
  const autoExpandedRef = useRef(false);
  // Henry 2026-05-30: tracks which scenes have already been auto-opted into Max Image
  // mode this session. Prevents the picker render from infinitely re-adding to
  // useMaxImageScenes after the user clicks Max OFF.
  const autoOptedMaxRef = useRef<Set<string>>(new Set());
  const [prefillingPrompt, setPrefillingPrompt] = useState(false);
  useEffect(() => {
    if (autoExpandedRef.current) return;
    if (!topicPromptParam || !topicPromptParam.trim()) return;
    if (textContent.trim() !== topicPromptParam.trim()) return;
    if (expandedContent || childScenes.length > 0 || expanding) return;
    autoExpandedRef.current = true;
    setActiveTab("content");
    // Henry 2026-06-04: when user wrote a CUSTOM story on /children-video, the URL
    // arrives with topic="Custom Story". prefillPrompt() regenerates a fresh story
    // from scratch — but Henry already wrote what he wants. So for custom stories
    // we skip prefill and go straight to expandStory(), which takes the user's
    // text as `storyInput` and expands it (preserving intent + characters).
    if (topicParam === "Custom Story") {
      expandStory();
    } else {
      prefillPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicPromptParam, textContent, expandedContent, childScenes.length, expanding]);

  // Generate a UNIQUE child-safe story idea tailored to user selections (age, learning mode,
  // safety, content type, topic) using the existing /api/hybrid/scene-edit polish endpoint
  // with a custom instruction. Random seed appended so two identical-template users still
  // get different stories. Result replaces textContent.
  async function prefillPrompt() {
    const seedRoll = Math.floor(Math.random() * 100000);
    const base = topicPromptParam || textContent || "child story";
    // Henry 2026-05-31: respect duration URL param + use names from saved library
    // instead of inventing fantasy names. ~2.5 words/sec = ~150 wpm typical kid narration.
    const durationSec = targetSeconds; // unified source (fixes "5 min"->5 parse bug)
    const targetWords = Math.max(40, Math.round(durationSec * 2.5));
    const targetSentences = Math.max(3, Math.round(targetWords / 18));
    const libraryNames = savedChars.length > 0
      ? savedChars.map(c => c.name).slice(0, 10).join(", ")
      : "";
    const ctx = [
      ageGroup ? `Age group: ${ageGroup}` : "",
      learningMode ? `Learning mode: ${learningMode}` : "",
      safetyLevel ? `Safety level: ${safetyLevel}` : "",
      contentParam ? `Content type: ${contentParam}` : "",
      topicParam ? `Topic: ${topicParam}` : "",
      `Target duration: ${durationSec} seconds`,
    ].filter(Boolean).join(" · ");
    const namesGuidance = libraryNames
      ? `AVAILABLE CHARACTER NAMES (use these first, do NOT invent new fantasy names): ${libraryNames}.
If you need more characters than listed, pick from these simple common names: Joe, Mary, Tom, Sarah, Ade, Kemi, Tola, Pip, Sam, Lily, Ben, Mia.`
      : `Use SIMPLE common names ONLY (Joe, Mary, Tom, Sarah, Ade, Kemi, Tola, Pip, Sam, Lily, Ben, Mia). Do NOT invent fantasy names like "Annie Ant", "Sparkle Pip", "Twinkle Star".`;
    // Henry 2026-05-31: drop "adult" vocabulary. Toddlers need WORDS A 3-YEAR-OLD KNOWS.
    // No "embark / delightful / detective / symmetry / curiosity" etc.
    const ageVocab =
      ageGroup === "toddler"   ? "Vocabulary: only words a 2-3 year old knows (run, jump, big, small, happy, mama, papa, friend). Use SHORT 4-8 word sentences. Repeat key words for memory. NO adult words like 'embark', 'delightful', 'detective', 'symmetry', 'curiosity', 'magnificent'." :
      ageGroup === "preschool" ? "Vocabulary: words a 3-5 year old knows. Sentences max 10 words. Simple, playful, kind. No complex adult words." :
      ageGroup === "early"     ? "Vocabulary: 5-8 year old reading level. Sentences max 12 words. Light adventure, gentle." :
                                 "Vocabulary: 8-12 year old reading level. Can use slightly richer words but still accessible.";

    // Henry 2026-05-30: EDUCATIONAL content types must LEAD with learning, not character story.
    // Pure A=Apple is boring; pure narrative ("Joe finds an apple") buries the teaching.
    // Goal: letter/number/concept is the HERO, wrapped in 1-line playful hooks per letter
    // ("A is for Apple — watch the apple FLY up high!"). NOT a character journey.
    const EDUCATIONAL_TYPES = new Set([
      "letters-sounds", "numbers-counting", "colours-shapes", "animals-nature", "first-words",
      "phonics", "early-maths", "science-discovery",
      "mathematics", "science", "history-people", "geography", "computing-logic", "arts-music",
      "health-wellbeing", "reading-writing",
      "language-arts", "advanced-maths", "science-engineering", "history-civilisations",
      "geography-global", "coding-python", "music-performance", "world-cultures", "research-thinking",
    ]);
    const isEducational = contentParam ? EDUCATIONAL_TYPES.has(contentParam) : false;

    const customInstruction = isEducational
      ? `Generate a UNIQUE child-safe EDUCATIONAL video script that fills ${durationSec} seconds. Target ${targetWords} words across ~${targetSentences} short lines.

CONTEXT: ${ctx}
SEED: ${seedRoll}
TOPIC: ${topicParam || base}

${ageVocab}

THIS IS EDUCATIONAL — NOT A STORY.
- The LEARNING CONTENT is the hero: the letters, numbers, sounds, words, facts, or concepts.
- DO NOT build a character-driven narrative ("Joe and Mia go to the park"). DO NOT center characters running, sharing, or discovering.
- For each unit (letter / number / colour / word / fact), give 2-3 short playful lines that TEACH IT and make it MEMORABLE:
    * State it clearly: "A is for Apple."
    * Add ONE playful hook so it sticks: "Watch the apple bounce HIGH! Apple — Apple — A!"
    * Optional repeat / chant / sing-along feel.
- Pacing: cover several units across the duration (e.g. 60s = 4-6 letters; 300s = 12-15 units with deeper repetition).
- Include sound-it-out moments: "A — apple — aaa", "B — ball — bbb".
- A LIGHT story-flavored hook is allowed ("Apple flew up — silly apple!"), but the LETTER/NUMBER/CONCEPT stays the subject of every line.
- Repeat the core teaching word at least twice per unit so kids remember it.
- Tone: warm, bright, sing-along, kind. No scary content. No adult words.
- Return ONLY the script — no headers, no JSON wrapper, no quotes around it, no "title:" prefix.`
      : `Generate a UNIQUE child-safe story idea that fills a ${durationSec}-second video. Target length: about ${targetWords} words across roughly ${targetSentences} sentences. NOT 2-3 sentences — fill the duration properly.

CONTEXT: ${ctx}
SEED: ${seedRoll}

${namesGuidance}

${ageVocab}

Rules:
- Tell a real STORY about the characters DOING THINGS (running, finding, sharing, helping). Not a list of facts or definitions.
- Give clear beginning → middle → end that fills ${durationSec} seconds.
- Use specific everyday setting (park, kitchen, garden, classroom, beach) + small surprise/discovery.
- Keep it positive, kind, age-appropriate. No scary or mature themes.
- Length MUST match the duration. Don't shortcut.
- Return ONLY the story description — no headers, no JSON wrapper, no quotes around it, no "title:" prefix.`;
    setPrefillingPrompt(true);
    setLastAction("AI is suggesting a unique story idea...");
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "polish",
          polishMode: "custom",
          customInstruction,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          scene: { id: "prefill", title: "Story idea", description: base },
        }),
      });
      const data = await res.json();
      let newText = data.scene?.description || data.newDescription || data.polishedText || data.text;
      // Henry 2026-05-31: defense-in-depth — if the LLM somehow leaks raw JSON wrapper
      // through, extract the description field client-side instead of showing braces.
      if (typeof newText === "string" && newText.trim().startsWith("{")) {
        const m = newText.match(/"description"\s*:\s*"((?:[^"\\]|\\.)+)"/);
        if (m) newText = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
        else newText = newText.replace(/^[\s{[]+|["\s}\]]+$/g, "").trim();
      }
      if (newText && data.ok !== false) {
        setTextContent(newText);
        setLastAction("Story idea ready — modify with the buttons or click Expand");
      }
    } catch (err) {
      console.error("[prefillPrompt children] error:", err);
    } finally {
      setPrefillingPrompt(false);
    }
  }

  // ── MODIFY PROMPT buttons (Henry 2026-05-30 task #38) ─────────────────────
  // Small per-intent buttons next to Expand/Build that rewrite the current textContent.
  // 5 use built-in polishMode values (intense / playful / funny / adventure / emotional);
  // 5 use polishMode="custom" with a child-safe instruction.
  const [modifyingPrompt, setModifyingPrompt] = useState<string | null>(null);
  type ModifyKind = "intense" | "playful" | "funny" | "adventure" | "emotional"
                  | "educational" | "magical" | "cozy" | "diverse" | "musical";
  async function modifyPrompt(kind: ModifyKind) {
    if (!textContent.trim()) { setLastAction("Type or generate a story idea first"); return; }
    setModifyingPrompt(kind);
    // Henry 2026-05-31: extract proper nouns + key actions from current text so the
    // LLM CANNOT replace "Joe goes to school" with "John jumps off the road" — it must
    // keep every name and the same beat order. Worst frustration this week.
    const keepNames = Array.from(new Set((textContent.match(/\b[A-Z][a-z]{2,15}\b/g) || []))).slice(0, 8);
    const preserve = keepNames.length > 0
      ? `\n\nABSOLUTE RULE: KEEP every one of these names exactly as-is, do NOT rename or remove any of them, do NOT introduce new characters: ${keepNames.join(", ")}. KEEP the same order of events. ONLY enhance the prose around the same story.`
      : `\n\nABSOLUTE RULE: KEEP every character name and every event in the same order. ONLY enhance the prose around the same story. Do not introduce new characters or change the outcome.`;
    const customInstructions: Record<string, string> = {
      educational: `Rewrite the story below to be MORE EDUCATIONAL — add small concepts, learning moments, or age-appropriate facts ALONGSIDE the existing events. Stay child-safe.${preserve}`,
      magical:     `Add a touch of wonder and magic to the story below — sparkle, surprise, gentle enchantment ALONGSIDE the existing events. Stay child-safe and grounded.${preserve}`,
      cozy:        `Make the story below MORE COZY, warm, and comforting — soft moments, bedtime feel, family or friendship warmth.${preserve}`,
      diverse:     `Add diversity to the story below — different cultures, abilities, family shapes — without removing existing characters. Stay natural and child-safe.${preserve}`,
      musical:     `Add music, songs, rhyme, or rhythm to the story below — make it sing-along friendly.${preserve}`,
    };
    const polishMode = (["intense", "playful", "funny", "adventure", "emotional"] as ModifyKind[]).includes(kind) ? kind : "custom";
    // For the 5 built-in polishModes (intense/playful/funny/adventure/emotional) we also
    // want the preserve-names rule — pass it via customInstruction even when mode is built-in,
    // because the scene-edit endpoint uses polishIntent(mode) for built-in modes which doesn't
    // include name preservation strongly enough.
    const customInstruction = polishMode === "custom"
      ? customInstructions[kind]
      : `${kind === "intense" ? "MAKE IT MORE INTENSE. Raise the stakes. Sharpen the tension. Tighten sentences. Use stronger verbs, harsher consequences, urgent stakes." :
          kind === "playful" ? "ADD PLAYFUL ENERGY — light bouncy rhythm, small games, characters being silly together. Joyful, safe, suitable for young children." :
          kind === "funny" ? "MAKE IT FUNNIER — gentle silly humor appropriate for children. Add a small surprising laugh, a playful mistake, or a soft joke. Keep it kind, no sarcasm, no scary or mean humor." :
          kind === "adventure" ? "ADD GENTLE ADVENTURE — a small safe discovery, a tiny challenge, characters exploring with curiosity. Excitement that is age-appropriate, never scary or dangerous." :
          "MAKE IT MORE EMOTIONAL. Emphasize what the characters FEEL. Surface the internal weight of the moment — fear, grief, longing, joy. Bring the emotion to the surface."
        }${preserve}`;
    // Pass via polishMode="custom" so the scene-edit goal honors our preserve-rule
    // instead of falling back to polishIntent(mode) which doesn't include it.
    const effectivePolishMode = "custom";
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "polish",
          polishMode: effectivePolishMode,
          customInstruction,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          scene: { id: "prompt-modify", title: "Story idea", description: textContent },
          childContext: { ageGroup, safetyLevel },
        }),
      });
      const data = await res.json();
      const newText = data.scene?.description || data.newDescription || data.polishedText || data.text;
      if (newText && data.ok !== false) {
        setTextContent(newText);
        setLastAction(`Story idea: ${kind} applied`);
      } else if (data.error) {
        setLastAction(`${kind} failed: ${data.error.slice(0, 200)}`);
      }
    } catch (err) {
      console.error(`[modifyPrompt children] ${kind} error:`, err);
      setLastAction(`${kind} failed`);
    } finally {
      setModifyingPrompt(null);
    }
  }

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
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

        {/* Story Length */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Story Length</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
            {[
              { min: 2,  label: "2 min",   note: "Tiny" },
              { min: 5,  label: "5 min",   note: "Short" },
              { min: 10, label: "10 min",  note: "Medium" },
              { min: 20, label: "20 min",  note: "Long" },
              { min: 40, label: "40 min",  note: "Very long" },
              { min: 60, label: "60 min",  note: "Movie" },
            ].map(L => (
              <div key={L.min} onClick={() => setTargetSeconds(L.min * 60)}
                style={{ padding: 8, borderRadius: 8, border: `1px solid ${storyLengthMin === L.min ? childAccent : border}`, background: storyLengthMin === L.min ? `${childAccent}15` : s2, cursor: "pointer", textAlign: "center" as const }}>
                <div style={{ color: storyLengthMin === L.min ? childAccent : "#fff", fontWeight: 700, fontSize: 12 }}>{L.label}</div>
                <div style={{ color: muted, fontSize: 9 }}>{L.note}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: muted, marginTop: 8, marginBottom: 0 }}>You can also type duration into the Story Idea (e.g. &quot;39 min long&quot;) and it will override this setting.</p>
        </div>

        {/* Learning Mode */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Learning Mode</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
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

        {/* Henry 2026-06-15: ABC Flashcard Builder — pick letters, auto words, one
            flashcard scene per letter ("A is for Apple" with picture + perfect spelling). */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>ABC Flashcard Builder</span>
          <p style={{ fontSize: 10, color: muted, marginTop: 4, marginBottom: 8 }}>
            Tick letters → each makes a flashcard scene: big <b>A a</b> + a picture + the word spelled (e.g. <b>apple</b>). Words auto-fill and are editable. Narrator says &quot;A is for Apple&quot;.
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setAbcLetters(new Set(ABC_ALL_LETTERS))}
              style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 10, cursor: "pointer" }}>Select A–Z</button>
            <button type="button" onClick={() => setAbcLetters(new Set())}
              style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: muted, fontSize: 10, cursor: "pointer" }}>Clear</button>
            <span style={{ fontSize: 10, color: muted, alignSelf: "center" }}>{abcLetters.size} selected</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(34px, 1fr))", gap: 4, marginBottom: 10 }}>
            {ABC_ALL_LETTERS.map(L => {
              const on = abcLetters.has(L);
              return (
                <button key={L} type="button"
                  onClick={() => setAbcLetters(prev => { const n = new Set(prev); if (n.has(L)) n.delete(L); else n.add(L); return n; })}
                  title={`${L} is for ${ABC_DEFAULT_WORDS[L]}`}
                  style={{ padding: "6px 0", borderRadius: 8, border: `1px solid ${on ? childAccent : border}`, background: on ? `${childAccent}22` : s2, color: on ? childAccent : "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{L}</button>
              );
            })}
          </div>
          {abcLetters.size > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6, marginBottom: 10 }}>
              {Array.from(abcLetters).sort().map(L => (
                <div key={L} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: childAccent, fontSize: 12, width: 16 }}>{L}</span>
                  <input value={abcWords[L] ?? ABC_DEFAULT_WORDS[L]} maxLength={20}
                    onChange={e => setAbcWords(prev => ({ ...prev, [L]: e.target.value }))}
                    style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 11 }} />
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={generateAbcScenes} disabled={abcLetters.size === 0}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: abcLetters.size === 0 ? "#444" : childAccent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: abcLetters.size === 0 ? "not-allowed" : "pointer" }}>
            Generate {abcLetters.size > 0 ? abcLetters.size : ""} ABC Flashcard Scene{abcLetters.size === 1 ? "" : "s"}
          </button>
        </div>

        {/* Production System */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Production System</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
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
      projectTitle, textContent, expandedContent, visualStyle, narrationStyle, narrationProvider, musicChoice, musicGenre,
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
      const listRes = await fetch("/api/hybrid/saved-state?list=true");
      const listData = await listRes.json();
      if (listData.projects) {
        const filtered = listData.projects.filter((p: { id: string }) =>
          p.id.startsWith("child_") || p.id.startsWith("ghs_children")
        );
        setProjectsList(filtered);
      }
    } catch { /* silent */ }
  }

  // ── New Project — save current then start fresh ──
  async function newProject() {
    isRestoringRef.current = true;
    await flushCurrentProject();
    const newKey = `ghs_children_${Date.now()}`;
    activeProjectIdRef.current = newKey;
    window.history.replaceState(null, "", `/dashboard/children-planner?projectId=${encodeURIComponent(newKey)}`);
    // Henry 2026-06-02: name new project by timestamp so the My Projects panel
    // distinguishes them instead of showing N "Untitled Children Project" rows.
    const newTitle = `Untitled (${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
    setProjectTitle(newTitle);
    setTextContent(""); setExpandedContent(""); setVisualStyle("storybook"); setNarrationStyle("gentle");
    setMusicChoice("soft_story"); setAgeGroup("preschool"); setSafetyLevel("high"); setLearningMode("storybook");
    setSavedChars([]); setSelectedCharIds([]); setCharacters([]); setChildScenes([]); setSceneImages({}); setSceneVideos({});
    setSceneBeatImages({}); setSelectedBeatImages({});
    setUseMaxImageScenes(new Set());
    setScriptSegments([]); setScreenplay(""); setSelectedMusicUrl(null); setSelectedMusicName("");
    setSavedCuts([]); setActiveTab("design"); setLastAction("New project started");
    setShowProjects(false);
    isRestoringRef.current = false;
    // Henry 2026-06-02: persist the fresh empty project IMMEDIATELY so it
    // appears as the active OPEN entry in My Projects list right away. Before
    // this, the panel still showed the OLD project as OPEN until user typed
    // something — the new project felt invisible.
    setTimeout(() => { void flushCurrentProject(); }, 50);
  }

  // Henry 2026-06-02: delete a project from the DB (My Projects list)
  async function deleteChildProject(id: string, title: string) {
    const ok = window.confirm(`Delete "${title || "Untitled"}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) { setLastAction(`Delete failed (${res.status})`); return; }
      // If deleted the active project, switch to a fresh one
      if (id === activeProjectIdRef.current) {
        await newProject();
      } else {
        // Just refresh the list
        const listRes = await fetch("/api/hybrid/saved-state?list=true");
        const listData = await listRes.json();
        if (listData.projects) {
          const filtered = listData.projects.filter((p: { id: string }) =>
            p.id.startsWith("child_") || p.id.startsWith("ghs_children")
          );
          setProjectsList(filtered);
        }
        setLastAction(`Deleted "${title || "Untitled"}"`);
      }
    } catch (err) {
      setLastAction(`Delete error: ${(err as Error)?.message?.slice(0, 100) || "unknown"}`);
    }
  }

  // Henry 2026-06-02: de-vocarize — simplify the current story text for target age
  async function devocarize(age: number) {
    if (!textContent.trim()) { setLastAction("Add story text first"); return; }
    setDevocarizing(age);
    setLastAction(`Simplifying story for age ${age}…`);
    try {
      const res = await fetch("/api/children/devocarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textContent, age }),
      });
      const data = await res.json() as { simplified?: string; error?: string; model?: string };
      if (!res.ok || !data.simplified) {
        setLastAction(`De-vocarize failed: ${data.error || `HTTP ${res.status}`}`);
        return;
      }
      // Replace the text content. Original is gone — user can Ctrl+Z if browser kept it,
      // OR they can re-type. We don't keep a backup field; deliberate keep-it-simple.
      setTextContent(data.simplified);
      setLastAction(`Simplified for age ${age} via ${data.model || "LLM"}`);
    } catch (err) {
      setLastAction(`De-vocarize error: ${(err as Error)?.message?.slice(0, 100) || "unknown"}`);
    } finally {
      setDevocarizing(null);
    }
  }

  // Henry 2026-06-02: export a project as JSON download
  async function exportChildProject(id: string, title: string) {
    try {
      const res = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(id)}`);
      const j = await res.json();
      if (!j.found || !j.data) { setLastAction("Export failed: project data missing"); return; }
      const payload = { projectId: id, title, exportedAt: new Date().toISOString(), data: j.data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = (title || "untitled").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40);
      a.href = url;
      a.download = `children_project_${safe}_${id.slice(-8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastAction(`Exported "${title || "Untitled"}"`);
    } catch (err) {
      setLastAction(`Export error: ${(err as Error)?.message?.slice(0, 100) || "unknown"}`);
    }
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
            if (typeof d.studioName === "string") setStudioName(d.studioName);
        if (d.narrationProvider) setNarrationProvider(d.narrationProvider);
        if (d.musicChoice)      setMusicChoice(d.musicChoice);
        if (d.musicGenre)       setMusicGenre(d.musicGenre);
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
        <input value={projectTitle} onChange={e => { userEditedTitleRef.current = true; setProjectTitle(e.target.value); }}
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
                    <div key={proj.id} style={{ borderRadius: 12, border: `2px solid ${isActive ? ds.color.gold : ds.color.line}`, background: isActive ? `${ds.color.gold}08` : ds.color.paper, padding: "12px 14px", position: "relative" as const }}>
                      <div onClick={() => isActive ? setShowProjects(false) : loadChildProject(proj.id)} style={{ cursor: "pointer", paddingBottom: 28 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? ds.color.gold : "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.title || "Untitled"}</p>
                        <p style={{ fontSize: 9, color: ds.color.mute }}>{proj.sceneCount} scenes · {proj.characterCount} chars</p>
                        <p style={{ fontSize: 8, color: ds.color.mute, marginTop: 4 }}>{new Date(proj.lastModified).toLocaleDateString()}</p>
                        {isActive && <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 6, background: ds.color.gold, color: "#000", fontWeight: 800, display: "inline-block", marginTop: 4 }}>OPEN</span>}
                      </div>
                      {/* Henry 2026-06-02: Export + Delete per project card */}
                      {/* Henry 2026-06-02 (followup): made the action buttons LARGE,
                          clearly labeled, full-width row at the bottom. Previous version
                          had 8px text + bare emoji — Henry reported "not working" because
                          the targets were essentially invisible. */}
                      <div style={{ position: "absolute" as const, bottom: 6, right: 6, left: 6, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          title="Export project as JSON"
                          onClick={e => { e.stopPropagation(); exportChildProject(proj.id, proj.title); }}
                          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${ds.color.line2}`, background: `${ds.color.gold}10`, color: ds.color.gold, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Export
                        </button>
                        <button
                          title="Delete project (cannot be undone)"
                          onClick={e => { e.stopPropagation(); deleteChildProject(proj.id, proj.title); }}
                          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid #e05353`, background: "#e0535320", color: "#ff8a8a", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          Delete
                        </button>
                      </div>
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
      {/* OVERVIEW TAB — extracted Wave 1.5 */}
      {activeTab === "overview" && (
        <OverviewTab
          productionSystem={productionSystem}
          textContent={textContent}
          styleProgress={styleProgress}
          generatedVideoUrl={generatedVideoUrl}
          review1Done={review1Done}
          review2Done={review2Done}
          contentProgress={contentProgress}
          previewProgress={previewProgress}
          reviewProgress={reviewProgress}
          lastAction={lastAction}
          designComplete={designComplete}
          contentImage={contentImage}
          movieGenre={movieGenre}
          movieSceneCount={movieSceneCount}
          movieSceneDuration={movieSceneDuration}
          MOVIE_GENRES={MOVIE_GENRES}
          MOVIE_SCENE_COUNTS={MOVIE_SCENE_COUNTS}
          MOVIE_SCENE_DURATIONS={MOVIE_SCENE_DURATIONS}
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          childAccent={childAccent}
          childSafe={childSafe}
          muted={muted}
          s2={s2}
          border={border}
          C2={C2}
          C3={C3}
          C4={C4}
          setProductionSystem={setProductionSystem}
          setMovieGenre={setMovieGenre}
          setMovieSceneCount={setMovieSceneCount}
          setMovieSceneDuration={setMovieSceneDuration}
          setActiveTab={setActiveTab}
          setContentImage={setContentImage}
          setLastAction={setLastAction}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DESIGN TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "design" && renderDesign()}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS TAB — Inline Registry (AI-first)                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS TAB — extracted Wave 2.5                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "characters" && (
        <CharactersTab
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          s2={s2}
          surface={surface}
          border={border}
          muted={muted}
          childAccent={childAccent}
          C4={C4}
          dsLilac={ds.color.lilac}
          characters={characters}
          setCharacters={setCharacters as unknown as React.Dispatch<React.SetStateAction<import("./tabs/CharactersTab").ChildCharacterIdentity[]>>}
          visionProvider={visionProvider}
          setVisionProvider={setVisionProvider}
          buildAllStoryCharacters={buildAllStoryCharacters}
          buildingAllChars={buildingAllChars}
          buildAllProgress={buildAllProgress}
          expandedContent={expandedContent}
          textContent={textContent}
          charTabName={charTabName}
          setCharTabName={setCharTabName}
          buildCharacterInline={buildCharacterInline}
          charTabCreating={charTabCreating}
          batchPortraitProgress={batchPortraitProgress}
          setBatchPortraitProgress={setBatchPortraitProgress}
          generateCharacterPortrait={generateCharacterPortrait}
          setLastAction={setLastAction}
          showCharacterPicker={showCharacterPicker}
          setShowCharacterPicker={setShowCharacterPicker}
          uiError={uiError}
          setUiError={setUiError}
          photoDragOver={photoDragOver}
          setPhotoDragOver={setPhotoDragOver}
          importingFromPhoto={importingFromPhoto}
          photoImportName={photoImportName}
          setPhotoImportName={setPhotoImportName}
          importCharacterFromPhoto={importCharacterFromPhoto}
          photoImportLog={photoImportLog}
          setPhotoImportLog={setPhotoImportLog}
          inlinePreview={inlinePreview}
          setInlinePreview={setInlinePreview as unknown as React.Dispatch<React.SetStateAction<import("./tabs/CharactersTab").ChildCharacterIdentity | null>>}
          acceptInlineCharacter={acceptInlineCharacter}
          editingCharId={editingCharId}
          setEditingCharId={setEditingCharId}
          generatingPortrait={generatingPortrait}
          buildVisualDescription={buildVisualDescription}
          normalizeImageUrl={normalizeImageUrl}
          analyzingCharacter={analyzingCharacter}
          analyzeCharacterImage={analyzeCharacterImage}
          savingCharacter={savingCharacter}
          savedCharacter={savedCharacter}
          saveCharacterToRegistry={saveCharacterToRegistry}
          openImagePicker={openImagePicker}
          charPortraitModel={charPortraitModel}
          setCharPortraitModel={setCharPortraitModel}
          charRefImages={charRefImages}
          imagePickerForCharId={imagePickerForCharId}
          setImagePickerForCharId={setImagePickerForCharId}
          imagePickerAssets={imagePickerAssets}
          imagePickerLoading={imagePickerLoading}
          assignImageToCharacter={assignImageToCharacter}
          setActiveTab={setActiveTab}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONTENT INPUT TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONTENT/STORY TAB — extracted Wave 2.3                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <StoryTab
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          s2={s2}
          border={border}
          muted={muted}
          childAccent={childAccent}
          childSafe={childSafe}
          LEARNING_MODES={LEARNING_MODES}
          learningMode={learningMode}
          setLearningMode={setLearningMode as unknown as (id: string) => void}
          topicParam={topicParam}
          charactersParam={charactersParam}
          contentParam={contentParam}
          langParam={langParam}
          lang2Param={lang2Param}
          isBilingual={isBilingual}
          textContent={textContent}
          setTextContent={setTextContent}
          storyEra={storyEra}
          setStoryEra={setStoryEra}
          storyCulture={storyCulture}
          setStoryCulture={setStoryCulture}
          expandContent={expandContent}
          deterministicBuild={isDeterministicMode(resolveChildMode(contentParam, learningMode))}
          expandingContent={expandingContent}
          expandStory={expandStory}
          expanding={expanding}
          modifyPrompt={modifyPrompt}
          modifyingPrompt={modifyingPrompt}
          prefillPrompt={prefillPrompt}
          prefillingPrompt={prefillingPrompt}
          devocarize={devocarize}
          devocarizing={devocarizing}
          extractChildCharacters={extractChildCharacters}
          extractingChars={extractingChars}
          storyAiProvider={storyAiProvider}
          setStoryAiProvider={setStoryAiProvider}
          expandedContent={expandedContent}
          childScenes={childScenes}
          runningIntelligence={runningIntelligence}
          runSceneIntelligence={runSceneIntelligence}
          sceneIntelligence={sceneIntelligence}
          SCENE_ENERGY_COLOR={SCENE_ENERGY_COLOR}
          autoSfx={autoSfx}
          contentImage={contentImage}
          setContentImage={setContentImage}
          tone={tone}
          setTone={setTone as unknown as (s: string) => void}
          setLastAction={setLastAction}
          setActiveTab={setActiveTab}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STYLE & VOICE TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STYLE TAB — extracted Wave 2.2 of children-planner segregation        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "style" && (
        <StyleTab
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          s2={s2}
          border={border}
          muted={muted}
          childAccent={childAccent}
          childSafe={childSafe}
          C2={C2}
          C4={C4}
          effectiveVideoModelId={effectiveVideoModelId}
          effectiveImageModelId={effectiveImageModelId}
          setAidMode={setAidMode}
          setShowAidPicker={setShowAidPicker}
          genSeed={genSeed}
          setGenSeed={setGenSeed}
          NARRATION_STYLES={NARRATION_STYLES}
          narrationStyle={narrationStyle}
          setNarrationStyle={setNarrationStyle}
          effectiveNarrationProvider={effectiveNarrationProvider}
          setNarrationProvider={setNarrationProvider}
          patchProjectSettings={patchProjectSettings}
          narrationText={narrationText}
          setNarrationText={setNarrationText}
          setNarrationSettings={setNarrationSettings}
          VISUAL_STYLES={VISUAL_STYLES}
          effectiveProjectStyle={effectiveProjectStyle}
          setVisualStyle={setVisualStyle}
          wordOverlayEnabled={wordOverlayEnabled}
          setWordOverlayEnabled={setWordOverlayEnabled}
          MUSIC_CHOICES={MUSIC_CHOICES}
          MUSIC_GENRES={MUSIC_GENRES}
          musicChoice={musicChoice}
          setMusicChoice={setMusicChoice}
          musicGenre={musicGenre}
          setMusicGenre={setMusicGenre}
          autoSfx={autoSfx}
          setAutoSfx={setAutoSfx}
          loadMusicLibrary={loadMusicLibrary}
          loadingMusic={loadingMusic}
          musicLibrary={musicLibrary}
          aiPickMusic={aiPickMusic}
          aiPickingMusic={aiPickingMusic}
          selectedMusicName={selectedMusicName}
          selectedMusicUrl={selectedMusicUrl}
          aiMusicPickLog={aiMusicPickLog}
          soundTab={soundTab}
          setSoundTab={setSoundTab}
          fsNoKey={fsNoKey}
          fsQuery={fsQuery}
          setFsQuery={setFsQuery}
          searchFreesound={searchFreesound}
          fsSearching={fsSearching}
          fsResults={fsResults}
          fsSaved={fsSaved}
          fsSaving={fsSaving}
          sfxPreviewId={sfxPreviewId}
          setSfxPreviewId={setSfxPreviewId}
          saveFreesound={saveFreesound}
          sfxDesc={sfxDesc}
          setSfxDesc={setSfxDesc}
          generateElevenLabsSfx={generateElevenLabsSfx}
          sfxGenerating={sfxGenerating}
          sfxGeneratedUrl={sfxGeneratedUrl}
          expandedContent={expandedContent}
          textContent={textContent}
          readAlongText={readAlongText}
          childScenes={childScenes}
          savedChars={savedChars}
          ageGroup={ageGroup}
          tone={tone}
          learningMode={learningMode}
          setReadAlongText={setReadAlongText}
          highlightMode={highlightMode}
          setHighlightMode={setHighlightMode}
          readSpeed={readSpeed}
          setReadSpeed={setReadSpeed}
          fontSize={fontSize}
          setFontSize={setFontSize}
          highlightColor={highlightColor}
          setHighlightColor={setHighlightColor}
          setLastAction={setLastAction}
          setPlanning={setPlanning}
          planning={planning}
          setActiveTab={setActiveTab}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REVIEW 1 TAB — extracted Wave 1 of children-planner segregation       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "review1" && (
        <Review1Tab
          textContent={textContent}
          styleProgress={styleProgress}
          ageParam={ageParam}
          narrationStyle={narrationStyle}
          effectiveProjectStyle={effectiveProjectStyle}
          musicChoice={musicChoice}
          review1Done={review1Done}
          generating={generating}
          generationProgress={generationProgress}
          generationError={generationError}
          NARRATION_STYLES={NARRATION_STYLES}
          VISUAL_STYLES={VISUAL_STYLES}
          MUSIC_CHOICES={MUSIC_CHOICES}
          cardStyle={cardStyle}
          childSafe={childSafe}
          muted={muted}
          s2={s2}
          border={border}
          setReview1Done={setReview1Done}
          setLastAction={setLastAction}
          generateChildrenContent={generateChildrenContent}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW TAB                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW TAB — extracted Wave 1.2 */}
      {activeTab === "preview" && (
        <PreviewTab
          generatedVideoUrl={generatedVideoUrl}
          generatedMusicUrl={generatedMusicUrl}
          generating={generating}
          generationProgress={generationProgress}
          musicFallbackReason={musicFallbackReason}
          cardStyle={cardStyle}
          muted={muted}
          s2={s2}
          border={border}
          childSafe={childSafe}
          childAccent={childAccent}
          setActiveTab={setActiveTab}
          setReview1Done={setReview1Done}
          setGeneratedVideoUrl={setGeneratedVideoUrl}
          setGeneratedMusicUrl={setGeneratedMusicUrl}
          setLastAction={setLastAction}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ASSEMBLY TAB — BUILD YOUR VIDEO                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ASSEMBLY TAB — extracted Wave 3.2                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "assembly" && (
        <AssemblyTab
          cardStyle={cardStyle}
          s2={s2}
          border={border}
          muted={muted}
          childAccent={childAccent}
          childSafe={childSafe}
          expandedContent={expandedContent}
          textContent={textContent}
          childScenes={childScenes}
          sceneImages={sceneImages}
          sceneVideos={sceneVideos}
          sceneBeatImages={sceneBeatImages}
          selectedBeatImages={selectedBeatImages}
          setSelectedBeatImages={setSelectedBeatImages}
          makeChildSceneBeatImages={makeChildSceneBeatImages}
          generatingMaxBeats={generatingMaxBeats}
          maxBeatsProgress={maxBeatsProgress}
          useMaxImageScenes={useMaxImageScenes}
          setUseMaxImageScenes={setUseMaxImageScenes}
          sceneMaxTarget={sceneMaxTarget}
          setSceneMaxTarget={setSceneMaxTarget}
          sceneGenProgress={sceneGenProgress}
          generatingSceneVideos={generatingSceneVideos}
          makeSceneVideo={makeSceneVideo}
          setPreviewScene={setPreviewScene}
          assemblySelectedIds={assemblySelectedIds}
          setAssemblySelectedIds={setAssemblySelectedIds}
          assemblyMediaPrefs={assemblyMediaPrefs}
          setAssemblyMediaPrefs={setAssemblyMediaPrefs}
          resolveNarrationText={resolveNarrationText}
          effectiveNarrationProvider={effectiveNarrationProvider}
          narratorAudioUrl={narratorAudioUrl}
          setNarratorAudioUrl={setNarratorAudioUrl}
          narratorWordTimings={narratorWordTimings}
          narratorSubText={narratorSubText}
          setNarratorWordTimings={setNarratorWordTimings}
          setNarratorSubText={setNarratorSubText}
          setLastAction={setLastAction}
          setUiError={setUiError}
          tone={tone}
          SOUND_TIERS={SOUND_TIERS}
          effectiveSoundTier={effectiveSoundTier}
          selectedMusicUrl={selectedMusicUrl}
          setSelectedMusicUrl={setSelectedMusicUrl}
          generatedMusicUrl={generatedMusicUrl}
          setGeneratedMusicUrl={setGeneratedMusicUrl}
          aiSupervisorReport={aiSupervisorReport}
          setAiSupervisorReport={setAiSupervisorReport}
          aiSupervisorRunning={aiSupervisorRunning}
          runAiSupervisor={runAiSupervisor}
          effectiveSubtitleConfig={effectiveSubtitleConfig}
          subtitleConfig={subtitleConfig}
          setSubtitleConfig={setSubtitleConfig}
          patchProjectSettings={patchProjectSettings}
          subtitleMatchResult={subtitleMatchResult}
          setSubtitleMatchResult={setSubtitleMatchResult}
          introUrl={introUrl}
          setIntroUrl={setIntroUrl}
          outroUrl={outroUrl}
          setOutroUrl={setOutroUrl}
          generatingIntro={generatingIntro}
          setGeneratingIntro={setGeneratingIntro}
          generatingOutro={generatingOutro}
          setGeneratingOutro={setGeneratingOutro}
          projectTitle={projectTitle}
          topicParam={topicParam}
          contentParam={contentParam}
          studioName={studioName}
          setStudioName={setStudioName}
          characters={characters}
          writtenBy={writtenBy}
          setWrittenBy={setWrittenBy}
          madeBy={madeBy}
          setMadeBy={setMadeBy}
          ideaFrom={ideaFrom}
          setIdeaFrom={setIdeaFrom}
          imageFlipRate={imageFlipRate}
          setImageFlipRate={setImageFlipRate}
          pacingPlan={pacingPlan}
          buildingPacingPlan={buildingPacingPlan}
          buildPacingPlan={buildPacingPlan}
          buildingPacingNarration={buildingPacingNarration}
          generatePacingNarration={generatePacingNarration}
          pacingAudioUrl={pacingAudioUrl}
          pacingVideoUrl={pacingVideoUrl}
          assemblingPacingVideo={assemblingPacingVideo}
          assemblePacingVideo={assemblePacingVideo}
          pacingActiveEntryIdx={pacingActiveEntryIdx}
          setPacingActiveEntryIdx={setPacingActiveEntryIdx}
          assembleMovie={assembleMovie}
          assembling={assembling}
          assembledUrl={assembledUrl}
          assemblyElapsedSec={assemblyElapsedSec}
          assemblePercent={assemblePercent}
          assemblyError={assemblyError}
          setAssemblyError={setAssemblyError}
          setActiveTab={setActiveTab}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REVIEW 2 TAB — MANDATORY FINAL SAFETY CHECK                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* REVIEW 2 TAB — extracted Wave 1.4 */}
      {activeTab === "review2" && (
        <Review2Tab
          savedCuts={savedCuts}
          showCutsPanel={showCutsPanel}
          assemblyName={assemblyName}
          assemblySelectedIds={assemblySelectedIds}
          assembledUrl={assembledUrl}
          generatedVideoUrl={generatedVideoUrl}
          finalVideoUrl={finalVideoUrl}
          review2Done={review2Done}
          saving={saving}
          saveError={saveError}
          preflightResult={preflightResult}
          preflightRunning={preflightRunning}
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          childSafe={childSafe}
          childAccent={childAccent}
          muted={muted}
          s2={s2}
          border={border}
          surface={surface}
          setActiveTab={setActiveTab}
          setShowCutsPanel={setShowCutsPanel}
          setAssemblyName={setAssemblyName}
          setSavedCuts={setSavedCuts as unknown as React.Dispatch<React.SetStateAction<import("./tabs/Review2Tab").SavedCut[]>>}
          setGeneratedVideoUrl={setGeneratedVideoUrl}
          setReview2Done={setReview2Done}
          setLastAction={setLastAction}
          runPreflight={runPreflight}
          handleFinalRender={handleFinalRender}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SOUND TAB — SC: 5-tier model selector, parse script, narration     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sound" && (
        <SoundTab
          cardStyle={cardStyle}
          muted={muted}
          childAccent={childAccent}
          childSafe={childSafe}
          C4={C4}
          effectiveSubtitleConfig={effectiveSubtitleConfig}
          SOUND_TIERS={SOUND_TIERS}
          effectiveSoundTier={effectiveSoundTier}
          setSoundTier={setSoundTier as unknown as (id: string) => void}
          setModelSettings={setModelSettings as unknown as React.Dispatch<React.SetStateAction<{ soundModel: string } & Record<string, unknown>>>}
          patchProjectSettings={patchProjectSettings}
          scriptSegments={scriptSegments}
          setActiveTab={setActiveTab}
          voiceTierConfig={voiceTierConfig}
          setVoiceTierConfig={setVoiceTierConfig}
          userVoiceTier={voiceTierGate(getUserTier())}
          getVoiceById={getVoiceById}
          setNarrationProvider={setNarrationProvider}
          narrationSpeed={narrationSpeed}
          setNarrationSpeed={setNarrationSpeed}
          narrationGenerating={narrationGenerating}
          textContent={textContent}
          narrationText={narrationText}
          setNarrationText={setNarrationText}
          generateNarration={generateNarration}
          narratorAudioUrl={narratorAudioUrl}
          narratorWordTimings={narratorWordTimings}
          narratorSubText={narratorSubText}
          runningAudioPlan={runningAudioPlan}
          childScenes={childScenes}
          audioPlans={audioPlans}
          runChildrenAudioPlan={runChildrenAudioPlan}
          savedChars={savedChars}
          selectedCharIds={selectedCharIds}
          characters={characters}
          characterVoices={characterVoices}
          setCharacterVoices={setCharacterVoices}
          musicTier={musicTier}
          setMusicTier={setMusicTier}
          musicGenerating={musicGenerating}
          generateChildrenMusic={generateChildrenMusic}
          generatedMusicUrl={generatedMusicUrl}
          musicFallbackReason={musicFallbackReason}
          autoSfx={autoSfx}
          setAutoSfx={setAutoSfx}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCRIPT & STORY PLAN TAB                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCRIPT TAB — extracted Wave 1.3 */}
      {activeTab === "script" && (
        <ScriptTab
          textContent={textContent}
          childScenes={childScenes}
          scriptSegments={scriptSegments}
          polishingScene={polishingScene}
          parsingScript={parsingScript}
          cardStyle={cardStyle}
          muted={muted}
          border={border}
          childAccent={childAccent}
          C2={C2}
          setActiveTab={setActiveTab}
          setChildScenes={setChildScenes as unknown as React.Dispatch<React.SetStateAction<import("./tabs/_shared-types").ChildScene[]>>}
          setScriptSegments={setScriptSegments}
          handlePolishScene={handlePolishScene}
          handleChildSceneOp={handleChildSceneOp}
          handleAdultWordCheck={handleAdultWordCheck}
          parseScript={parseScript}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCENE BOARD TAB — hybrid-style per-scene cards, children-adapted    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCENE BOARD TAB — extracted Wave 3.1                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sceneBoard" && (
        <SceneBoardTab
          cardStyle={cardStyle}
          labelStyle={labelStyle}
          s2={s2}
          border={border}
          muted={muted}
          childAccent={childAccent}
          childSafe={childSafe}
          childScenes={childScenes}
          setChildScenes={setChildScenes as unknown as React.Dispatch<React.SetStateAction<import("./tabs/SceneBoardTab").SceneBoardScene[]>>}
          storyEra={storyEra}
          storyCulture={storyCulture}
          runChildrenEstablishAll={runChildrenEstablishAll}
          establishingAllChild={establishingAllChild}
          establishingShotsChild={establishingShotsChild}
          establishingModeChild={establishingModeChild}
          setEstablishingModeChild={setEstablishingModeChild}
          genChildEstablishingShotImage={genChildEstablishingShotImage}
          continuousMotionEnabled={continuousMotionEnabled}
          setContinuousMotionEnabled={setContinuousMotionEnabled}
          cmError={cmError}
          setCmError={setCmError}
          cmStatus={cmStatus}
          setCmStatus={setCmStatus}
          cmFinalVideoUrl={cmFinalVideoUrl}
          setCmFinalVideoUrl={setCmFinalVideoUrl}
          cmTotalDuration={cmTotalDuration}
          setCmTotalDuration={setCmTotalDuration}
          cmSegmentDuration={cmSegmentDuration}
          setCmSegmentDuration={setCmSegmentDuration}
          cmProvider={cmProvider}
          setCmProvider={setCmProvider}
          cmRunning={cmRunning}
          startContinuousMotion={startContinuousMotion}
          generateScenesFromStory={generateScenesFromStory}
          generatingScenesFromStory={generatingScenesFromStory}
          textContent={textContent}
          readAlongText={readAlongText}
          sceneImages={sceneImages}
          setSceneImages={setSceneImages}
          generatingSceneImage={generatingSceneImage}
          generatingVariations={generatingVariations}
          sceneCharAssignments={sceneCharAssignments}
          setSceneCharAssignments={setSceneCharAssignments}
          setLightboxImage={setLightboxImage}
          importFileRefs={importFileRefs}
          sceneStyles={sceneStyles}
          setSceneStyles={setSceneStyles}
          effectiveProjectStyle={effectiveProjectStyle}
          generateSceneBoardImageVariations={generateSceneBoardImageVariations}
          generateSceneBoardImage={generateSceneBoardImage}
          sceneBeatImages={sceneBeatImages}
          selectedBeatImages={selectedBeatImages}
          setSelectedBeatImages={setSelectedBeatImages}
          generatingMaxBeats={generatingMaxBeats}
          maxBeatsProgress={maxBeatsProgress}
          makeChildSceneBeatImages={makeChildSceneBeatImages}
          setPreviewScene={setPreviewScene}
          sceneVideos={sceneVideos}
          generatingSceneVideos={generatingSceneVideos}
          makeSceneVideo={makeSceneVideo}
          generateSceneSfx={generateSceneSfx}
          generatingSceneSfx={generatingSceneSfx}
          generateSceneMusic={generateSceneMusic}
          generatingSceneMusic={generatingSceneMusic}
          sceneMusicUrls={sceneMusicUrls}
          sceneContinuousMotion={sceneContinuousMotion}
          setSceneContinuousMotion={setSceneContinuousMotion}
          sceneTitleTimers={sceneTitleTimers}
          sceneDurations={sceneDurations}
          setSceneDurations={setSceneDurations}
          contentParam={contentParam}
          topicParam={topicParam}
          setLastAction={setLastAction}
          handlePolishScene={handlePolishScene}
          polishingScene={polishingScene}
          archiveScene={archiveScene}
          archivedScenes={archivedScenes as unknown as import("./tabs/SceneBoardTab").SceneBoardScene[]}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          restoreScene={restoreScene}
          savedChars={savedChars}
          characters={characters}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCREENPLAY TAB                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCREENPLAY TAB — extracted Wave 2.4                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "screenplay" && (
        <ScreenplayTab
          cardStyle={cardStyle}
          s2={s2}
          border={border}
          muted={muted}
          childAccent={childAccent}
          childSafe={childSafe}
          writtenBy={writtenBy}
          setWrittenBy={setWrittenBy}
          madeBy={madeBy}
          setMadeBy={setMadeBy}
          ideaFrom={ideaFrom}
          setIdeaFrom={setIdeaFrom}
          textContent={textContent}
          expandedContent={expandedContent}
          screenplay={screenplay}
          setScreenplay={setScreenplay}
          generatingScreenplay={generatingScreenplay}
          screenplayError={screenplayError}
          generateScreenplay={generateScreenplay}
          parsingScript={parsingScript}
          parseScript={parseScript}
          sendingToScenes={sendingToScenes}
          sendScreenplayToContent={sendScreenplayToContent}
          sendToScenesResult={sendToScenesResult}
          showScriptReview={showScriptReview}
          setShowScriptReview={setShowScriptReview}
          scriptSegments={scriptSegments}
          studioName={studioName}
          projectTitle={projectTitle}
          contentParam={contentParam}
          ageGroup={ageGroup}
          AGE_AUDIENCE={AGE_AUDIENCE}
          setActiveTab={setActiveTab}
        />
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
