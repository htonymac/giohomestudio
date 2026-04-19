"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NarrationControls from "../../components/NarrationControls";
import type { NarrationSettings } from "../../components/NarrationControls";
import CharacterPicker from "../../components/CharacterPicker";
import type { SceneIntelligenceData } from "../../api/hybrid/scene-intelligence/route";

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

const SCENE_ENV_ICON: Record<string, string> = {
  "city-street": "🏙", "open-market": "🛒", "indoor-market": "🏪",
  "bush-forest": "🌿", "village": "🏘", "beach": "🏖",
  "riverbank": "🌊", "church-mosque": "⛪", "hospital": "🏥",
  "office": "💼", "indoor-room": "🏠", "forest-night": "🌲",
  "night-street": "🌙", "rain-scene": "🌧", "rooftop": "🏢",
  "car-interior": "🚗", "school": "🏫",
};

const SCENE_ENERGY_COLOR: Record<string, string> = {
  chaotic: "#ef4444", tense: "#eab308", dramatic: "#a855f7",
  mysterious: "#6366f1", peaceful: "#22d3ee", calm: "#22d3ee",
};

// ── Colors — Magical Storybook Studio ──
const surface = "#1e1040";      // deep midnight purple
const s2 = "#140a2e";           // darker for nested surfaces
const border = "#4a2080";       // glowing purple border
const muted = "#9878c8";        // soft lavender
const childAccent = "#FFD700";  // sunshine yellow (main accent)
const childSafe = "#00E5CC";    // teal-green (safety indicator)
const C2 = "#FF6B9D";           // hot pink
const C3 = "#FF8C42";           // warm orange
const C4 = "#48CAE4";           // sky blue
const bgGrad = "linear-gradient(160deg, #1a0a38 0%, #120833 40%, #0e1428 100%)";

// ── Shared styles ──
const cardStyle: React.CSSProperties = {
  background: "rgba(30,16,64,0.85)",
  border: `1px solid rgba(74,32,128,0.6)`,
  borderRadius: 18,
  padding: 20,
  marginBottom: 12,
  boxShadow: "0 4px 24px rgba(100,0,200,0.08)",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
  textTransform: "uppercase" as const, color: muted, marginBottom: 8, display: "block",
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
  { id: "none", label: "No Music", icon: "🔇" },
  { id: "soft_story", label: "Soft Storybook", icon: "📖" },
  { id: "abc_learning", label: "ABC Learning", icon: "🔤" },
  { id: "counting", label: "Counting Rhythm", icon: "🔢" },
  { id: "nursery", label: "Nursery Rhyme", icon: "🌙" },
  { id: "playful", label: "Playful Learning", icon: "🎈" },
  { id: "bedtime", label: "Calm Bedtime", icon: "💤" },
  { id: "classroom", label: "Bright Classroom", icon: "🎓" },
];

const VISUAL_STYLES = [
  { id: "storybook",  label: "Storybook",      icon: "📖", colors: "#FFF8E1, #FF8A65", desc: "Warm illustrated book style" },
  { id: "cartoon",   label: "Bright Cartoon",  icon: "🎨", colors: "#E3F2FD, #FF5722", desc: "Bold colorful animation" },
  { id: "classroom", label: "Classroom",        icon: "🏫", colors: "#E8F5E9, #2196F3", desc: "Clean educational layout" },
  { id: "nursery",   label: "Nursery Soft",    icon: "🍼", colors: "#FCE4EC, #CE93D8", desc: "Pastel gentle nursery" },
  { id: "fantasy",   label: "Fantasy Land",    icon: "🧚", colors: "#E8EAF6, #7C4DFF", desc: "Magical fantasy world" },
  { id: "animals",   label: "Animal World",    icon: "🦁", colors: "#FFF3E0, #FF9800", desc: "Jungle animal adventure" },
  { id: "space",     label: "Outer Space",     icon: "🚀", colors: "#E1F5FE, #0288D1", desc: "Space exploration" },
  { id: "ocean",     label: "Ocean World",     icon: "🐠", colors: "#E0F7FA, #00BCD4", desc: "Underwater adventure" },
];

const AGE_GROUPS = [
  { id: "toddler",   label: "Toddlers",      age: "2-3 years", icon: "🍼", desc: "Letters, colours, sounds, simple words" },
  { id: "preschool", label: "Pre-school",    age: "3-5 years", icon: "🎈", desc: "Phonics, counting, short stories, shapes" },
  { id: "early",     label: "Early School",  age: "5-8 years", icon: "📚", desc: "Reading, sentences, science, numbers" },
  { id: "older",     label: "Older Kids",    age: "8-12 years", icon: "🚀", desc: "Full stories, projects, advanced topics" },
];

const AGE_AUDIENCE: Record<string, string> = {
  toddler: "2-3 year olds",
  preschool: "3-5 year olds",
  early: "5-8 year olds",
  older: "8-12 year olds",
};

const LEARNING_MODES = [
  { id: "storybook",    label: "Storybook",      icon: "📖", desc: "Full illustrated story with narration" },
  { id: "read_along",   label: "Read-Along",     icon: "🔤", desc: "Text synced with highlighted narration" },
  { id: "word",         label: "Word Learning",  icon: "🔡", desc: "Single word focus with pronunciation" },
  { id: "sentence",     label: "Sentences",      icon: "📝", desc: "Sentence-by-sentence reading" },
  { id: "poem",         label: "Poem / Rhyme",   icon: "🎶", desc: "Rhythmic poem with beat-sync" },
  { id: "phonics",      label: "Phonics",         icon: "🔊", desc: "Letter sounds and phonics drill" },
  { id: "video_lesson", label: "Video Lesson",   icon: "🎥", desc: "Educational structured lesson" },
];

const MOVIE_GENRES = ["Adventure", "Fantasy", "Animals", "Space", "Ocean", "Jungle", "Fairytale"];
const MOVIE_SCENE_COUNTS = [3, 5, 7, 10];
const MOVIE_SCENE_DURATIONS = ["3s", "5s", "8s", "10s"];

// ── Tab type ──
type WorkshopTab = "overview" | "design" | "characters" | "content" | "style" | "screenplay" | "review1" | "preview" | "review2";

const WORKSHOP_TABS: { id: WorkshopTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "\u{1F3E0}" },
  { id: "design", label: "Design", icon: "\u{1F3A8}" },
  { id: "characters", label: "Characters", icon: "\u{1F464}" },
  { id: "content", label: "Content", icon: "\u{1F4DD}" },
  { id: "style", label: "Style & Voice", icon: "\u{1F399}" },
  { id: "screenplay", label: "Screenplay", icon: "\u{1F4C4}" },
  { id: "review1", label: "Review 1", icon: "\u{1F6E1}" },
  { id: "preview", label: "Preview", icon: "\u{1F3AC}" },
  { id: "review2", label: "Final", icon: "\u2705" },
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
  const [activeTab, setActiveTab] = useState<WorkshopTab>("overview");
  const [lastAction, setLastAction] = useState("Workshop opened");
  const [textContent, setTextContent] = useState(topicPromptParam || "");
  const [narrationStyle, setNarrationStyle] = useState("gentle");
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
  const [selectedImageModelId, setSelectedImageModelId] = useState("segmind_pruna");
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
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; sceneIds: string[]; videoUrl?: string; savedAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("ghs_children_cuts") || "[]"); } catch { return []; }
  });
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
  interface ChildScene { scene: number; title: string; visualDescription: string; cameraDirection?: string; imageUrl?: string }
  const [childScenes, setChildScenes] = useState<ChildScene[]>([]);
  const [sceneVideos, setSceneVideos] = useState<Record<string, string>>({});
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [generatingSceneVideos, setGeneratingSceneVideos] = useState<Set<string>>(new Set());
  const [sceneGenProgress, setSceneGenProgress] = useState<Record<string, { percent: number; message: string }>>({});

  // ── Feature state: assembleMovie ──
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  const [assemblySelectedIds, setAssemblySelectedIds] = useState<string[]>([]);

  // ── Feature state: FreeSound + ElevenLabs SFX ──
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
      const expandData = await expandRes.json();
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
      const charData = await charRes.json();
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
      }

      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: summary || storyInput },
          genre: "children",
          tone: tone === "soft" ? "gentle" : "energetic",
          totalScenes: movieSceneCount,
          targetDuration: movieSceneDuration,
        }),
      });
      const sceneData = await sceneRes.json();
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
      const data = await res.json();
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
        body: JSON.stringify({ description: sfxDesc, duration_seconds: 5 }),
      });
      const data = await res.json();
      if (data.url || data.audioUrl) setSfxGeneratedUrl(data.url || data.audioUrl);
      else setLastAction("SFX generation failed: " + (data.error || "unknown"));
    } catch { setLastAction("ElevenLabs SFX generation failed"); }
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
      const storyData = await storyRes.json();

      setGenerationProgress("Step 2/3: Generating music...");
      // Step 2: Generate background music
      try {
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood: musicChoice === "soft_story" ? "calm" : musicChoice === "nursery" ? "children" : "upbeat", duration: 20 }),
        });
        const musicData = await musicRes.json();
        if (musicData.url || musicData.audioUrl) setGeneratedMusicUrl(musicData.url || musicData.audioUrl);
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
        const assembleData = await assembleRes.json();
        if (assembleData.outputUrl || assembleData.videoUrl) {
          setGeneratedVideoUrl(assembleData.outputUrl || assembleData.videoUrl);
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

  // Restore state from localStorage if returning from editor
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ghs_children_planner_return");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.timestamp && Date.now() - data.timestamp < 3600000) {
          if (data.activeTab) setActiveTab(data.activeTab);
          if (data.textContent) setTextContent(prev => prev || data.textContent);
          if (data.learningMode) setLearningMode(data.learningMode);
          if (data.productionSystem) setProductionSystem(data.productionSystem);
          if (data.movieGenre) setMovieGenre(data.movieGenre);
          if (data.movieSceneCount) setMovieSceneCount(data.movieSceneCount);
          if (data.movieSceneDuration) setMovieSceneDuration(data.movieSceneDuration);
          if (data.readAlongText) setReadAlongText(data.readAlongText);
          if (data.highlightMode) setHighlightMode(data.highlightMode);
          if (data.readSpeed) setReadSpeed(data.readSpeed);
          if (data.highlightColor) setHighlightColor(data.highlightColor);
          if (data.fontSize) setFontSize(data.fontSize);
          if (data.ageGroup) setAgeGroup(data.ageGroup);
          if (data.safetyLevel) setSafetyLevel(data.safetyLevel);
          if (data.designComplete) setDesignComplete(data.designComplete);
          if (data.expandedContent) setExpandedContent(data.expandedContent);
        }
        localStorage.removeItem("ghs_children_planner_return");
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>🎨 Learning Design</h2>
        <p style={{ color: muted, fontSize: 12, margin: "0 0 20px" }}>Set age group and learning mode first. This controls everything: vocabulary, pacing, visual safety, and narration style.</p>

        {/* Age Group */}
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <span style={labelStyle}>Age Group</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AGE_GROUPS.map(ag => (
              <div key={ag.id} onClick={() => setAgeGroup(ag.id as "toddler" | "preschool" | "early" | "older")}
                style={{ padding: 14, borderRadius: 10, border: `1px solid ${ageGroup === ag.id ? childAccent : border}`, background: ageGroup === ag.id ? `${childAccent}15` : s2, cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{ag.icon}</span>
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
                <span style={{ fontSize: 20 }}>{mode.icon}</span>
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
              { id: "hybrid", label: "Hybrid Story", desc: "Images + narration + music. Best for read-along. Recommended.", icon: "⚡" },
              { id: "movie", label: "Full Video", desc: "AI video per scene. More immersive but higher cost.", icon: "🎬" },
            ].map(ps => (
              <div key={ps.id} onClick={() => setProductionSystem(ps.id as "hybrid" | "movie")}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${productionSystem === ps.id ? childSafe : border}`, background: productionSystem === ps.id ? `${childSafe}15` : s2, cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span>{ps.icon}</span>
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
              { value: "ollama",                           label: "Local LLM",  sub: "Ollama · Free · No cloud cost",                    color: childSafe,   badge: "FREE" },
              { value: "claude:claude-haiku-4-5-20251001", label: "Standard",   sub: "Claude Haiku 4.5 · Fast · Low cost",               color: "#00d4ff",   badge: "FAST" },
              { value: "claude:claude-sonnet-4-6",         label: "Pro",        sub: "Claude Sonnet 4.6 · Best balance · Recommended",   color: childAccent, badge: "REC" },
              { value: "claude:claude-opus-4-7",           label: "Premium",    sub: "Claude Opus 4.7 · Highest quality · Most powerful", color: "#f59e0b",   badge: "TOP" },
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

        {/* Confirm Button */}
        <div style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => { setDesignComplete(true); setLastAction(`Design set: ${ageGroup}, ${learningMode}`); setActiveTab("content"); }}
            style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: childAccent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            ✅ Confirm Design → Add Content
          </button>
          {designComplete && (
            <span style={{ fontSize: 11, color: childSafe, fontWeight: 600 }}>✓ Design confirmed</span>
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
    <div style={{ background: bgGrad, minHeight: "100vh", padding: "0 0 60px" }}>
      {/* ── Magical Hero Banner ── */}
      <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", marginBottom: 20, minHeight: 180 }}>
        {/* Rainbow gradient background */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #2d0a60 0%, #1a0a50 30%, #0a1a50 60%, #0a2840 100%)" }} />
        {/* Floating stars */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {["★","✦","✶","⭐","🌟"].map((s, i) => (
            <span key={i} style={{ position: "absolute", fontSize: [14,18,10,22,12][i], opacity: 0.25,
              top: [`18%`,`60%`,`30%`,`15%`,`70%`][i], left: [`8%`,`85%`,`92%`,`60%`,`45%`][i],
              color: [childAccent, C2, C4, childAccent, C3][i] }}>{s}</span>
          ))}
        </div>
        {/* Rainbow arc top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg, ${C2}, ${C3}, ${childAccent}, ${childSafe}, ${C4}, #c084fc)` }} />

        <div style={{ position: "relative", padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {/* Safety badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${childSafe}18`, border: `1px solid ${childSafe}40`, padding: "4px 14px", borderRadius: 100, fontSize: 9, fontWeight: 700, color: childSafe, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 14 }}>
              🛡 Child-Safe Production Workshop
            </div>

            {/* Title row with big emoji */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 46, filter: "drop-shadow(0 0 12px rgba(255,215,0,0.4))" }}>📚</div>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: -0.5,
                  background: `linear-gradient(90deg, ${childAccent}, ${C2})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Children&apos;s Video Studio
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {branch === "video" ? "🎬 Animated Children Video" : "📖 Hybrid Story (Read-Along)"}
                  {contentParam ? ` · ${contentParam}` : ""}
                  {ageParam ? ` · ${ageParam}` : " · all ages"}
                  {isBilingual ? ` · 🌍 Bilingual (${langParam} + ${lang2Param})` : ""}
                </p>
              </div>
            </div>

            {/* Quick mood badges */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {["🎨 Creative", "🎶 Musical", "📖 Stories", "🧩 Learning", "🌈 Colorful"].map(b => (
                <span key={b} style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, alignItems: "flex-end" }}>
            <a href="/dashboard/children-video" style={{ fontSize: 11, color: muted, textDecoration: "none", padding: "8px 16px", borderRadius: 10, border: `1px solid ${border}`, display: "inline-block" }}>
              ← Children Video
            </a>
          </div>
        </div>
      </div>

      {/* ── Workshop Tab Bar — Bubbly Colorful ── */}
      {(() => {
        const TAB_COLORS: Record<string, string> = {
          overview:    childAccent,  // yellow
          design:      C3,           // orange
          characters:  C2,           // pink
          content:     "#c084fc",    // purple
          style:       C4,           // sky blue
          screenplay:  "#34d399",    // mint
          review1:     childSafe,    // teal
          preview:     "#f472b6",    // hot pink
          review2:     "#a3e635",    // lime
        };
        return (
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: `${s2}cc`, borderRadius: 18, padding: 6, border: `1px solid ${border}`, flexWrap: "wrap" as const }}>
            {WORKSHOP_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const tabColor = TAB_COLORS[tab.id] || childAccent;
              const hasContent =
                tab.id === "design" ? designComplete :
                tab.id === "characters" ? savedChars.length > 0 :
                tab.id === "content" ? !!textContent :
                tab.id === "style" ? !!(narrationStyle && visualStyle && musicChoice) :
                tab.id === "review1" ? review1Done :
                tab.id === "preview" ? !!generatedVideoUrl :
                tab.id === "review2" ? review2Done :
                true;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, minWidth: 70, padding: "10px 6px", borderRadius: 12, border: isActive ? "none" : `1px solid ${border}`,
                    background: isActive ? tabColor : "transparent",
                    color: isActive ? "#000" : hasContent ? tabColor : muted,
                    fontSize: 11, fontWeight: isActive ? 800 : hasContent ? 600 : 400,
                    cursor: "pointer", transition: "all 0.18s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    boxShadow: isActive ? `0 0 18px ${tabColor}55` : "none",
                  }}>
                  <span style={{ fontSize: 15 }}>{tab.icon}</span>
                  <span style={{ display: "block" }}>{tab.label}</span>
                  {hasContent && !isActive && (
                    <span style={{ fontSize: 9, color: tabColor }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

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
                style={{ flex: 1, padding: "12px 10px", borderRadius: 12, border: `2px solid ${productionSystem === "hybrid" ? childAccent : border}`, background: productionSystem === "hybrid" ? `${childAccent}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 20, display: "block", marginBottom: 4 }}>📖</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: productionSystem === "hybrid" ? childAccent : "#fff" }}>Hybrid Story</p>
                <p style={{ fontSize: 9, color: muted }}>InvText + images pipeline</p>
              </button>
              <button onClick={() => { setProductionSystem("movie"); setLastAction("System: Movie Mode"); }}
                style={{ flex: 1, padding: "12px 10px", borderRadius: 12, border: `2px solid ${productionSystem === "movie" ? childAccent : border}`, background: productionSystem === "movie" ? `${childAccent}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 20, display: "block", marginBottom: 4 }}>🎬</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: productionSystem === "movie" ? childAccent : "#fff" }}>Movie Mode</p>
                <p style={{ fontSize: 9, color: muted }}>Scenes + video generation</p>
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

          {/* Stats Grid — 4 colorful bubbles */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { emoji: "✏️", label: "Content", value: textContent ? "Ready!" : "Empty", color: childAccent, ok: !!textContent },
              { emoji: "🎨", label: "Style", value: styleProgress === 100 ? "Set!" : "Pending", color: C3, ok: styleProgress === 100 },
              { emoji: "🎬", label: "Preview", value: generatedVideoUrl ? "Done!" : "Not yet", color: C4, ok: !!generatedVideoUrl },
              { emoji: "🛡", label: "Safety", value: review1Done && review2Done ? "2/2 ✓" : review1Done ? "1/2" : "0/2", color: childSafe, ok: review1Done && review2Done },
            ].map(stat => (
              <div key={stat.label} style={{
                ...cardStyle, marginBottom: 0, textAlign: "center", padding: "18px 12px",
                border: `2px solid ${stat.ok ? stat.color + "50" : border}`,
                background: stat.ok ? `${stat.color}10` : "rgba(30,16,64,0.85)",
                boxShadow: stat.ok ? `0 0 20px ${stat.color}20` : "none",
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{stat.emoji}</div>
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
                  else if (styleProgress < 100) setActiveTab("style");
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
          <div style={{ ...cardStyle, marginBottom: 16, background: "rgba(20,10,50,0.7)", border: `1px solid rgba(255,215,0,0.15)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>🌈</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: childAccent }}>Sample Scenes</p>
                <p style={{ margin: 0, fontSize: 11, color: muted }}>Examples of what your children videos can look like</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {[
                { img: "/api/media/demo/child_abc.png",       label: "ABC Learning",    emoji: "🔤", color: C4 },
                { img: "/api/media/demo/child_colors.png",    label: "Color World",     emoji: "🎨", color: C2 },
                { img: "/api/media/demo/child_counting.png",  label: "Counting Fun",    emoji: "🔢", color: C3 },
                { img: "/api/media/demo/child_nursery.png",   label: "Nursery Rhyme",   emoji: "🍼", color: "#c084fc" },
                { img: "/api/media/demo/child_story.png",     label: "Story Time",      emoji: "📖", color: childSafe },
              ].map(scene => (
                <div key={scene.label} style={{ position: "relative", borderRadius: 14, overflow: "hidden", cursor: "pointer", border: `2px solid ${scene.color}30`, transition: "all 0.2s" }}
                  onClick={() => setContentImage(scene.img)}>
                  <img src={scene.img} alt={scene.label}
                    style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  {/* Label overlay */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 8px",
                    background: `linear-gradient(transparent, rgba(0,0,0,0.85))` }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: scene.color, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{scene.emoji}</span> {scene.label}
                    </p>
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
                <span style={{ fontSize: 14 }}>✅</span>
                <p style={{ margin: 0, fontSize: 12, color: childSafe }}>Demo image selected as content reference</p>
                <button onClick={() => setContentImage(null)} style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", borderRadius: 6, border: `1px solid ${childSafe}40`, background: "transparent", color: childSafe, cursor: "pointer" }}>Clear</button>
              </div>
            )}
          </div>

          {/* ── Demo Videos strip ── */}
          <div style={{ ...cardStyle, marginBottom: 16, background: "rgba(20,10,50,0.7)", border: `1px solid ${C2}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>🎬</span>
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
              { emoji: "🎨", label: designComplete ? "✓ Design" : "Set Design", color: C3, action: () => setActiveTab("design"), href: null },
              { emoji: "✏️", label: "Open Editor", color: childSafe, action: null, href: "/dashboard/collaborative-editor?from=children-planner" },
              { emoji: "👤", label: "Characters", color: C2, action: null, href: "/dashboard/character-voices" },
              { emoji: "🧒", label: "Children Video", color: C4, action: null, href: "/dashboard/children-video" },
            ].map(link => {
              const inner = (
                <div key={link.label} onClick={link.action ?? undefined} style={{
                  ...cardStyle, cursor: "pointer", textAlign: "center", padding: "18px 8px", marginBottom: 0,
                  border: `2px solid ${link.color}30`,
                  transition: "all 0.18s",
                }}>
                  <span style={{ fontSize: 28 }}>{link.emoji}</span>
                  <p style={{ fontSize: 11, color: link.color, fontWeight: 700, marginTop: 8, marginBottom: 0 }}>{link.label}</p>
                </div>
              );
              return link.href ? (
                <a key={link.label} href={link.href} style={{ textDecoration: "none" }}
                  onClick={() => { if (link.href?.includes("collaborative-editor")) { try { localStorage.setItem("ghs_children_planner_return", JSON.stringify({ activeTab, textContent, learningMode, productionSystem, movieGenre, movieSceneCount, movieSceneDuration, readAlongText, highlightMode, readSpeed, highlightColor, fontSize, ageGroup, safetyLevel, designComplete, expandedContent, timestamp: Date.now() })); } catch {} } }}>
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
                  <button onClick={() => setActiveTab("style")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
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
      {/* CHARACTERS TAB                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "characters" && (
        <div>
          {/* Header */}
          <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Characters</h2>
              <p style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                Add characters from your library to include in this children video.
                {selectedCharIds.length > 0 && <span style={{ color: childAccent, fontWeight: 600 }}> {selectedCharIds.length} selected</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCharPicker(true)}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${childAccent}`, background: `${childAccent}10`, color: childAccent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                + Import from Library
              </button>
              <a href="/dashboard/character-voices" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                  Create New
                </button>
              </a>
            </div>
          </div>

          {/* Character cards */}
          {loadingChars ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <p style={{ color: muted, fontSize: 12 }}>Loading characters...</p>
            </div>
          ) : savedChars.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40, borderStyle: "dashed" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>{"\u{1F464}"}</p>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>No characters yet</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4, marginBottom: 16 }}>Create characters in the Character Voices section and import them here.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <a href="/dashboard/character-voices" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: childAccent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Create Characters
                  </button>
                </a>
                <button onClick={() => setShowCharPicker(true)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  Import Existing
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
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
                          <span style={{ fontSize: 40, opacity: 0.3 }}>{"\u{1F464}"}</span>
                        </div>
                      )}
                      {isSelected && (
                        <div style={{ position: "absolute", top: 8, right: 8, background: childAccent, borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 12, color: "#000", fontWeight: 700 }}>{"\u2713"}</span>
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
                          {hasVoice ? `\u2713 Voice` : `\u2717 No Voice`}
                        </span>
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: hasImage ? `${childSafe}15` : "rgba(239,68,68,0.1)", color: hasImage ? childSafe : "#ef4444", fontWeight: 600 }}>
                          {hasImage ? `\u2713 Image` : `\u2717 No Image`}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => {
                          const next = isSelected ? selectedCharIds.filter(id => id !== char.id) : [...selectedCharIds, char.id];
                          setSelectedCharIds(next);
                          setLastAction(isSelected ? `Removed ${char.name}` : `Added ${char.name}`);
                        }}
                          style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "none", background: isSelected ? `${childAccent}20` : childAccent, color: isSelected ? childAccent : "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          {isSelected ? "Remove" : "Add to Video"}
                        </button>
                        <a href={`/dashboard/character-voices?edit=${char.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                          <button style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                            Edit
                          </button>
                        </a>
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
                    <span style={{ fontSize: 20, display: "block", marginBottom: 4 }}>{mode.icon}</span>
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
              {expandingContent ? "Expanding..." : "✨ Expand with AI"}
            </button>
            <button
              onClick={expandStory}
              disabled={expanding || !textContent.trim()}
              style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: expanding ? `${childSafe}10` : `${childSafe}20`, color: (expanding || !textContent.trim()) ? muted : childSafe, fontSize: 12, fontWeight: 700, cursor: (expanding || !textContent.trim()) ? "not-allowed" : "pointer" }}>
              {expanding ? "Building..." : "🏗️ Build Story with AI"}
            </button>
            {expandedContent && (
              <button
                onClick={extractChildCharacters}
                disabled={extractingChars !== "idle"}
                style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: `${childSafe}15`, color: extractingChars !== "idle" ? muted : childSafe, fontSize: 12, fontWeight: 600, cursor: extractingChars !== "idle" ? "not-allowed" : "pointer" }}>
                {extractingChars === "building" ? "Building Characters..." : extractingChars === "extracting" ? "Extracting..." : "👤 Extract Characters from Story"}
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
                  {runningIntelligence ? "⚡ Detecting..." : "🌟 Story Scenes"}
                </button>
              </div>
              {runningIntelligence && (
                <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0" }}>⚡ Scene Intelligence running — detecting environments and ambient sounds...</p>
              )}
              {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
                <p style={{ fontSize: 10, color: "#666", margin: "4px 0" }}>
                  🔊 {Object.keys(sceneIntelligence).length} scenes have sound environment data
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
                          const icon = SCENE_ENV_ICON[intel.environmentType] || "📍";
                          return (
                            <div style={{ margin: "8px 0", padding: "6px 8px", borderRadius: 8, background: "#ffffff05", border: "1px solid #ffffff0a" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                <span style={{ fontSize: 11 }}>{icon}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{intel.environmentType.replace(/-/g, " ")}</span>
                                <span style={{ fontSize: 8, color: "#666" }}>•</span>
                                <span style={{ fontSize: 8, color: "#666", textTransform: "capitalize" }}>{intel.timeOfDay}</span>
                                <span style={{ marginLeft: "auto", fontSize: 7, padding: "1px 5px", borderRadius: 4, background: `${energyColor}20`, color: energyColor, fontWeight: 700, textTransform: "uppercase" }}>{intel.energyLevel}</span>
                              </div>
                              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                {intel.ambienceSounds.slice(0, 4).map((sound, i) => (
                                  <span key={i} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#1a2a1a", color: "#4ade80", border: "1px solid #4ade8030" }}>🔊 {sound}</span>
                                ))}
                                {intel.sfxEvents.length > 0 && (
                                  <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#2a1a1a", color: "#eab308", border: "1px solid #eab30830" }}>⚡ {intel.sfxEvents[0]}</span>
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
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                🎬 Video Model: <span style={{ color: "#fff" }}>{selectedVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childSafe}40`, background: `${childSafe}10`, color: childSafe, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                🖼 Image Model: <span style={{ color: "#fff" }}>{selectedImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
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
                    <span style={{ fontSize: 14, display: "block", marginBottom: 2 }}>{v.icon}</span>
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
                <span style={{ fontSize: 18, display: "block", marginBottom: 4 }}>{m.icon}</span>
                <p style={{ fontSize: 9, fontWeight: 600, color: musicChoice === m.id ? childAccent : "#fff" }}>{m.label}</p>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 9, color: muted, marginBottom: 16 }}>Music is always secondary to narration. Voice stays at 100%, music at 18-35%. Music ducks when narration is active.</p>

          {/* ── Music Library Picker ── */}
          <p style={labelStyle}>Music Library</p>
          <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${border}`, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <button onClick={loadMusicLibrary} disabled={loadingMusic}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${childAccent}`, background: `${childAccent}10`, color: loadingMusic ? muted : childAccent, fontSize: 11, fontWeight: 700, cursor: loadingMusic ? "not-allowed" : "pointer" }}>
                {loadingMusic ? "Loading..." : "🎵 Browse Music Library"}
              </button>
              {musicLibrary.length > 0 && (
                <button onClick={aiPickMusic} disabled={aiPickingMusic}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${childSafe}`, background: `${childSafe}10`, color: aiPickingMusic ? muted : childSafe, fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
                  {aiPickingMusic ? "Picking..." : "🤖 AI Pick Music"}
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
              {([{ id: "freesound", label: "Sound Effects Browser" }, { id: "elevenlabs", label: "AI Audio Studio" }] as const).map(t => (
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
                              {saving ? "..." : saved ? "✓" : "Save"}
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

            {soundTab === "elevenlabs" && (
              <div>
                <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Describe a sound effect and AI generates it for you.</p>
                <textarea value={sfxDesc} onChange={e => setSfxDesc(e.target.value)} rows={3}
                  placeholder="e.g. Happy children laughing and playing, gentle bells ringing, magical sparkle sound..."
                  style={{ width: "100%", background: "#0a0d14", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical" as const, marginBottom: 8 }} />
                <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()}
                  style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: (sfxGenerating || !sfxDesc.trim()) ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: (sfxGenerating || !sfxDesc.trim()) ? "not-allowed" : "pointer" }}>
                  {sfxGenerating ? "Generating sound..." : "✨ Generate Sound Effect"}
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
              <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 14 }}>🔤 Read-Along Settings</p>

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
            {planning ? "Child-Safe Planner analyzing..." : !textContent.trim() ? "Enter content first" : "Generate Plan \u2192 First Review"}
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
            <span style={{ fontSize: 22 }}>{"\u{1F6E1}"}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>First Review — Safety Check</h2>
              <p style={{ fontSize: 11, color: muted }}>Review the plan before AI generates visuals. This is mandatory for children content.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Content Interpretation", check: "Text matches intended learning goal", icon: "\u{1F4DD}" },
              { label: "Age Appropriateness", check: `Content suitable for ${ageParam || "target"} age group`, icon: "\u{1F476}" },
              { label: "Narration Style", check: `${NARRATION_STYLES.find(n => n.id === narrationStyle)?.label} selected`, icon: "\u{1F5E3}" },
              { label: "Visual Plan", check: `${VISUAL_STYLES.find(v => v.id === visualStyle)?.label} — child-safe colors`, icon: "\u{1F3A8}" },
              { label: "Word Difficulty", check: "Words match selected age level", icon: "\u{1F4D6}" },
              { label: "Music Suitability", check: `${MUSIC_CHOICES.find(m => m.id === musicChoice)?.label} — narration priority`, icon: "\u{1F3B5}" },
            ].map(item => (
              <div key={item.label} style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span>{item.icon}</span>
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
              <p style={{ fontSize: 28, marginBottom: 8 }}>{"\u{1F3AC}"}</p>
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
                    <p style={{ fontSize: 28, marginBottom: 8 }}>{"\u{1F3AC}"}</p>
                    <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                      {generating ? (generationProgress || "Generating...") : "Preview not yet generated"}
                    </p>
                  </div>
                )}
              </div>

              {generatedMusicUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: s2, border: `1px solid ${border}`, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>{"\u{1F3B5}"}</span>
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
                <span style={{ fontSize: 16 }}>📂</span>
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
                        <span style={{ fontSize: 13 }}>{c.videoUrl ? "🎬" : "📋"}</span>
                        <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? childSafe : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => { const next = prev.filter((_, i) => i !== ci); try { localStorage.setItem("ghs_children_cuts", JSON.stringify(next)); } catch {} return next; }); }}
                          style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: "#ef4444", fontSize: 10, cursor: "pointer" }}>✕</button>
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
              <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 4 }}>🎬 Scene Videos</p>
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
                              {videoUrl && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${childSafe}15`, color: childSafe, fontWeight: 700 }}>✓ Video</span>}
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
                {assembling ? "Assembling story..." : assemblyComplete ? "✓ Story Assembled" : `🎬 Assemble ${assemblySelectedIds.length} Scene${assemblySelectedIds.length !== 1 ? "s" : ""} into Story`}
              </button>
              {assembledUrl && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: `${childSafe}08`, border: `1px solid ${childSafe}25`, marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: childSafe, fontWeight: 600, marginBottom: 6 }}>✓ Story assembled</p>
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
                    try { localStorage.setItem("ghs_children_cuts", JSON.stringify(next)); } catch {}
                    return next;
                  });
                  setLastAction(`Version "${assemblyName}" saved`);
                }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
                💾 Save Version
              </button>
            </div>
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
            <span style={{ fontSize: 22 }}>{"\u{1F6E1}"}</span>
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
              {saving ? "Saving to Library..." : finalVideoUrl ? "\u2713 Saved to Asset Library" : "\u2713 Both Reviews Passed — Render Final Video"}
            </button>
          </div>
          {saveError && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{saveError}</p>}

          {/* Export options — shown after save */}
          {finalVideoUrl && (
            <div style={{ marginTop: 16, padding: 20, borderRadius: 14, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: childSafe, marginBottom: 12 }}>{"\u2713"} Content saved to Asset Library</p>
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
                  onClick={() => { try { localStorage.setItem("ghs_children_planner_return", JSON.stringify({ activeTab, textContent, learningMode, productionSystem, movieGenre, movieSceneCount, movieSceneDuration, readAlongText, highlightMode, readSpeed, highlightColor, fontSize, ageGroup, safetyLevel, designComplete, expandedContent, timestamp: Date.now() })); } catch {} }}
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
      {/* SCREENPLAY TAB                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "screenplay" && (
        <div>
          {!screenplay && !generatingScreenplay && (
            <div style={{ ...cardStyle, borderColor: `${childAccent}20`, marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>📄 Story Script</p>
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
                      ✍️ Generate Story Script
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
              <div style={{ fontSize: 36, marginBottom: 12 }}>✍️</div>
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
                  <span>✅</span>
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
        const ADVISER: Record<StyleKey, { icon:string; title:string; msg:string; cheapestId:string; bestId:string; bestLabel:string }> = {
          all:      { icon:"🤖", title:"All Models",             msg:"Showing all models sorted by price. MuAPI is 40–58% cheaper than FAL for the same quality tier.",                                                     cheapestId:"segmind_pruna_video",  bestId:"fal_kling_3_pro",        bestLabel:"Top Overall" },
          "2d":     { icon:"✏️", title:"2D / Illustration Style", msg:"Seedance 2.0 (MuAPI) is the best model for 2D flat animation — ideal for children cartoons and illustrated storybooks.",       cheapestId:"muapi_seedance_v1_pro", bestId:"muapi_seedance_v2_1080p", bestLabel:"Best 2D" },
          "3d":     { icon:"🎲", title:"3D / Cinematic Style",    msg:"Kling 2.5 Direct ★ is the best 3D model. Use for realistic-looking children scenes.",                                                  cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_std",  bestLabel:"Best 3D Direct" },
          cartoon:  { icon:"🎨", title:"Cartoon / Animated",      msg:"Seedance 2.0 (MuAPI) at $0.08 is the best cartoon model — perfect for children storybooks. Hailuo Pro is best cartoon on FAL.",                          cheapestId:"muapi_seedance_v1_pro", bestId:"fal_hailuo_pro",          bestLabel:"Best Cartoon" },
          realistic:{ icon:"🎬", title:"Realistic / Photorealistic",msg:"Kling 2.5 Pro Direct ★ ($0.20) is the most realistic. Use sparingly for older children content.",                                               cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_pro",  bestLabel:"Most Realistic" },
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
                  <button onClick={() => setShowAidPicker(false)} style={{ background:"none", border:"none", color:"#666", fontSize:18, cursor:"pointer" }}>✕</button>
                </div>
                <div style={{ display:"flex", gap:0, borderRadius:10, overflow:"hidden", border:"1px solid #2a2456", width:"fit-content" }}>
                  {(["video","image"] as const).map(mode => (
                    <button key={mode} onClick={() => setAidMode(mode)} style={{ padding:"7px 24px", border:"none", cursor:"pointer", fontSize:11, fontWeight:800, background:aidMode===mode?(mode==="video"?"#7c3aed":"#0ea5e9"):"#12122a", color:aidMode===mode?"#fff":"#5a4f80", transition:"all 0.15s" }}>
                      {mode==="video"?"🎬 VIDEO":"🖼 IMAGE"}
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
                  {([{key:"cheapest",label:"💰 Cheapest",col:"#22c55e"},{key:"quality",label:"⭐ Quality",col:"#c084fc"},{key:"expensive",label:"👑 Premium",col:"#facc15"}] as {key:"cheapest"|"quality"|"expensive";label:string;col:string}[]).map(opt => (
                    <button key={opt.key} onClick={() => setAidSort(opt.key)} style={{ padding:"3px 10px", borderRadius:7, border:aidSort===opt.key?`1.5px solid ${opt.col}`:"1px solid #2a2456", background:aidSort===opt.key?`${opt.col}20`:"#12122a", color:aidSort===opt.key?opt.col:"#4a4070", fontSize:9, fontWeight:700, cursor:"pointer" }}>{opt.label}</button>
                  ))}
                </div>
              )}
              {isVideo && (
                <div style={{ margin:"10px 20px 0", padding:"11px 14px", borderRadius:10, background:"#0a0820", border:"1px solid #2a1f5a", flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#c084fc", marginBottom:4 }}>{adviser.icon} {adviser.title}</div>
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
                  <div style={{ fontSize:10, fontWeight:700, color:"#38bdf8", marginBottom:4 }}>🖼 Image Model Adviser</div>
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
                          {styleScore !== null && <span style={{ fontSize:9, color:"#5a4f80" }}>{"★".repeat(styleScore)}{"☆".repeat(5-styleScore)}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", marginLeft:8 }}>
                        {isSelected ? <div style={{ fontSize:14, color:m.color }}>✓</div> : <div style={{ fontSize:9, color:"#3a3060" }}>select</div>}
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
                        {isSelected ? <div style={{ fontSize:14, color:m.color }}>✓</div> : <div style={{ fontSize:9, color:"#3a3060" }}>select</div>}
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
    </div>
  );
}
