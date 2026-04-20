"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { SceneIntelligenceData } from "../../api/hybrid/scene-intelligence/route";
import DurationPicker from "../../components/DurationPicker";
import CharacterPicker from "../../components/CharacterPicker";
import { assetToMediaUrl, type MusicAsset } from "../../utils/mediaUrl";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Series Planner — PRODUCTION WORKSHOP
// Tabs: Overview | Bible | Characters | Episodes | Scene Board | Audio | Assembly
// Each episode is the organizational unit. Characters are shared series-wide.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ──

interface CharacterIdentity {
  characterId: string;
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
  imageUrl?: string;
  hasVoice?: boolean;
  hasImage?: boolean;
  species?: string;
  bodyBuild?: string;
  colorDescription?: string;
  faceFeatures?: string;
  clothingDetails?: string;
  accessories?: string;
  distinctiveFeatures?: string;
  ageAppearance?: string;
  imageLocked?: boolean;
  voiceType?: string;
}

interface SeriesScene {
  sceneId: string;
  scene: number;
  title: string;
  description: string;
  sceneType: "image-led" | "video-led" | "image-to-video" | "audio-bridge" | "hybrid";
  location: string;
  timeOfDay: string;
  mood: string;
  narrationScript: string;
  characterIds: string[];
  musicStyle: string;
  sfx: string;
  credits: number;
  status: "draft" | "approved" | "blocked" | "generating" | "generated";
  imageUrl?: string;
  narrationAudioUrl?: string;
}

interface SeriesEpisode {
  episodeId: string;
  number: number;
  title: string;
  synopsis: string;
  duration: string;
  status: "planning" | "scripted" | "generating" | "generated" | "approved" | "published";
  scenes: SeriesScene[];
  audioPlan: string;
  musicChoice: string;
  narrationStyle: string;
  assembledVideoUrl?: string;
}

interface StoryBible {
  worldDescription: string;
  lore: string;
  locations: string;
  timeline: string;
  rules: string;
  keyEvents: string;
  tone: string;
  themes: string;
}

type WorkshopTab = "overview" | "design" | "bible" | "characters" | "episodes" | "scenes" | "screenplay" | "audio" | "assembly";

const WORKSHOP_TABS: { id: WorkshopTab; label: string; icon: string; step?: number }[] = [
  { id: "overview",    label: "Overview",      icon: "🏠" },
  { id: "design",      label: "Series Design", icon: "🎨", step: 0 },
  { id: "bible",       label: "Series Bible",  icon: "📖", step: 1 },
  { id: "characters",  label: "Characters",    icon: "👥", step: 2 },
  { id: "episodes",    label: "Episodes",      icon: "🎬", step: 3 },
  { id: "scenes",      label: "Scene Board",   icon: "🖼", step: 4 },
  { id: "screenplay",  label: "Screenplay",    icon: "📄", step: 5 },
  { id: "audio",       label: "Audio & Music", icon: "🎵", step: 6 },
  { id: "assembly",    label: "Assembly",      icon: "🚀", step: 7 },
];

const GENRES = ["Drama", "Comedy", "Action", "Horror", "Sci-Fi", "Fantasy", "Romance", "Thriller", "Documentary", "Educational", "Motivational", "Kids", "Afrobeat Story", "Crime", "Adventure"];
const PLATFORMS = ["YouTube", "Instagram", "TikTok", "Facebook", "Netflix-style", "Multi-platform"];
const VISUAL_STYLES = ["Cinematic", "Animated", "Comic-style", "Photorealistic", "Artistic", "Minimal", "Retro", "Neon", "Afrobeats Energy"];
const EPISODE_DURATIONS = ["1-2 min", "3-5 min", "5-10 min", "10-20 min", "20-30 min", "45 min", "60 min"];
const MUSIC_CHOICES = ["none", "soft_drama", "action_intense", "comedy_light", "suspense_build", "afrobeat_energy", "worship_glow", "cinematic_score", "custom"];
const NARRATION_STYLES = ["none", "narrator", "character_voice", "documentary", "voiceover", "children_friendly"];
const SCENE_TYPES = [
  { id: "image-led",      label: "Image",    color: "#00d4ff", credits: 1 },
  { id: "video-led",      label: "Video",    color: "#a855f7", credits: 4 },
  { id: "image-to-video", label: "Img→Vid",  color: "#f59e0b", credits: 2 },
  { id: "audio-bridge",   label: "Audio",    color: "#22c55e", credits: 0 },
  { id: "hybrid",         label: "Hybrid",   color: "#ec4899", credits: 2 },
];

const SCENE_TYPE_MAP = Object.fromEntries(SCENE_TYPES.map(t => [t.id, t]));

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

// ── Scene Intelligence display constants ─────────────────────────────────

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

// ── Style helpers ──
const surface = "#0e1318";
const s2 = "#080b10";
const border = "#1e2a35";
const muted = "#5a7080";
const accent = "#22c55e";
const purple = "#a855f7";
const gold = "#f59e0b";
const red = "#ef4444";
const blue = "#00d4ff";

const card: React.CSSProperties = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginBottom: 12 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8, display: "block" };
const inp: React.CSSProperties = { width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" };
const btn = (col = accent): React.CSSProperties => ({ padding: "10px 20px", borderRadius: 10, border: "none", background: col, color: col === gold || col === accent ? "#000" : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const badge = (col: string): React.CSSProperties => ({ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${col}22`, color: col, fontWeight: 700, display: "inline-block" });

function mkEpisode(n: number): SeriesEpisode {
  return { episodeId: `EP${String(n).padStart(2,"0")}_${Date.now()}`, number: n, title: `Episode ${n}`, synopsis: "", duration: "5-10 min", status: "planning", scenes: [], audioPlan: "", musicChoice: "soft_drama", narrationStyle: "narrator" };
}

function mkScene(n: number): SeriesScene {
  return { sceneId: `SC${String(n).padStart(2,"0")}_${Date.now()}`, scene: n, title: `Scene ${n}`, description: "", sceneType: "image-led", location: "", timeOfDay: "day", mood: "", narrationScript: "", characterIds: [], musicStyle: "", sfx: "", credits: 1, status: "draft" };
}

function mkBible(): StoryBible {
  return { worldDescription: "", lore: "", locations: "", timeline: "", rules: "", keyEvents: "", tone: "", themes: "" };
}

const LS_KEY = "ghs_series_workshop_v1";
const PROJ_LIST_KEY = "ghs_series_proj_list";
const ACTIVE_KEY = "ghs_series_active_proj";

export default function SeriesPlannerPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: muted }}>Loading Series Workshop...</div>}><SeriesPlannerInner /></Suspense>;
}

function SeriesPlannerInner() {
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);

  // ── Workshop tab ──
  const [activeTab, setActiveTab] = useState<WorkshopTab>("overview");

  // ── Project ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [seriesTitle, setSeriesTitle] = useState("Untitled Series");
  const [genre, setGenre] = useState("Drama");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("YouTube");
  const [visualStyle, setVisualStyle] = useState("Cinematic");
  const [targetAudience, setTargetAudience] = useState("General");
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState("Project created");
  const [projectList, setProjectList] = useState<{id:string;title:string}[]>([]);

  // ── Story Bible ──
  const [bible, setBible] = useState<StoryBible>(mkBible());
  const [expandingBible, setExpandingBible] = useState(false);

  // ── Characters (series-wide cast) ──
  const [characters, setCharacters] = useState<CharacterIdentity[]>([]);
  const [showCharPicker, setShowCharPicker] = useState(false);

  // ── Episodes ──
  const [episodes, setEpisodes] = useState<SeriesEpisode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [expandingEpisode, setExpandingEpisode] = useState<string | null>(null);
  const [generatingEpisode, setGeneratingEpisode] = useState<string | null>(null);

  // ── Scene Board (for active episode) ──
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [generatingSceneImage, setGeneratingSceneImage] = useState<string | null>(null);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  // ── Audio ──
  const [globalMusicChoice, setGlobalMusicChoice] = useState("soft_drama");
  const [globalNarration, setGlobalNarration] = useState("narrator");

  // ── Assembly ──
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);

  // ── Design ──
  const [seriesFormat, setSeriesFormat] = useState<"long-form" | "short-form" | "episodic-shorts" | "mini-series">("episodic-shorts");
  const [episodeDuration, setEpisodeDuration] = useState("5-10 min");
  const [visualTheme, setVisualTheme] = useState("");
  const [designComplete, setDesignComplete] = useState(false);
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-haiku-4-5-20251001");
  const [expandingBible2, setExpandingBible2] = useState(false);
  const [extractingChars, setExtractingChars] = useState(false);
  const [buildingChars, setBuildingChars] = useState(false);
  const [buildCharProgress, setBuildCharProgress] = useState<string | null>(null);

  // ── AID model picker ──
  const [selectedVideoModelId, setSelectedVideoModelId] = useState("segmind_pruna_video");
  const [selectedImageModelId, setSelectedImageModelId] = useState("fal_flux_schnell");
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

  // ── Assembly named cuts ──
  const [assemblyName, setAssemblyName] = useState("Main Cut");
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; episodeId: string; videoUrl?: string; savedAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("ghs_series_cuts") || "[]"); } catch { return []; }
  });
  const [showCutsPanel, setShowCutsPanel] = useState(false);

  // ── Story expand pipeline ──
  const [expanding, setExpanding] = useState(false);

  // ── Scene Videos (SSE streaming) ──
  const [sceneVideos, setSceneVideos] = useState<Record<string, string>>({});
  const [sceneVideoVersions, setSceneVideoVersions] = useState<Record<string, string[]>>({});
  const [generatingSceneVideos, setGeneratingSceneVideos] = useState<Set<string>>(new Set());
  const [sceneGenProgress, setSceneGenProgress] = useState<Record<string, { percent: number; message: string }>>({});

  // ── Assembly (movie-style) ──
  const [assemblySceneProgress, setAssemblySceneProgress] = useState<Record<string, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  const [assemblySelectedIds, setAssemblySelectedIds] = useState<string[]>([]);

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

  // ── Music library ──
  const [musicLibrary, setMusicLibrary] = useState<MusicAsset[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusicUrl, setSelectedMusicUrl] = useState<string | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState("");
  const [aiPickingMusic, setAiPickingMusic] = useState(false);
  const [aiMusicPickLog, setAiMusicPickLog] = useState("");

  // ── Narration ──
  const [narrationScene, setNarrationScene] = useState<string | null>(null);

  // ── Error ──
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Scene Intelligence ──
  const [sceneIntelligence, setSceneIntelligence] = useState<Record<string, SceneIntelligenceData>>({});
  const [runningIntelligence, setRunningIntelligence] = useState(false);

  // ── Mounting / localStorage restore ──
  useEffect(() => {
    setMounted(true);
    // Load project list
    try {
      const list = JSON.parse(localStorage.getItem(PROJ_LIST_KEY) || "[]");
      setProjectList(list);
    } catch {}
    // Load active project
    try {
      const activeId = localStorage.getItem(ACTIVE_KEY);
      const raw = activeId ? localStorage.getItem(`ghs_series_proj_${activeId}`) : localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.projectId) setProjectId(d.projectId);
        if (d.seriesTitle) setSeriesTitle(d.seriesTitle);
        if (d.genre) setGenre(d.genre);
        if (d.tone) setTone(d.tone);
        if (d.platform) setPlatform(d.platform);
        if (d.visualStyle) setVisualStyle(d.visualStyle);
        if (d.targetAudience) setTargetAudience(d.targetAudience);
        if (d.bible) setBible(d.bible);
        if (d.characters) setCharacters(d.characters);
        if (d.episodes) setEpisodes(d.episodes);
        if (d.sceneImages) setSceneImages(d.sceneImages);
        if (d.globalMusicChoice) setGlobalMusicChoice(d.globalMusicChoice);
        if (d.globalNarration) setGlobalNarration(d.globalNarration);
        if (d.activeEpisodeId) setActiveEpisodeId(d.activeEpisodeId);
        if (d.seriesFormat) setSeriesFormat(d.seriesFormat);
        if (d.episodeDuration) setEpisodeDuration(d.episodeDuration);
        if (d.visualTheme) setVisualTheme(d.visualTheme);
        if (d.storyAiProvider) setStoryAiProvider(d.storyAiProvider);
        if (d.designComplete !== undefined) setDesignComplete(d.designComplete);
      }
    } catch {}
    // Check characterId param
    const charId = params.get("characterId");
    if (charId) {
      fetch(`/api/character-voices/${charId}`).then(r => r.json()).then(d => {
        if (d.id) {
          setCharacters(prev => {
            if (prev.find(c => c.characterId === d.id)) return prev;
            return [...prev, { characterId: d.id, displayName: d.name, roleType: d.role || "supporting", gender: d.gender || "", ageRange: d.ageRange || "", skinTone: "", hairStyle: "", wardrobeStyle: "", speechStyle: "", accentType: d.accent || "", emotionProfile: "", voiceId: d.voiceId || "", language: d.language || "English", imageUrl: d.imageUrl, hasVoice: !!d.voiceId, hasImage: !!d.imageUrl }];
          });
        }
      }).catch(() => {});
    }
  }, []);

  // ── Save to localStorage ──
  function saveLocal(): string {
    const id = projectId || `series_${Date.now()}`;
    if (!projectId) setProjectId(id);
    if (!mounted) return id;
    const data = { projectId: id, seriesTitle, genre, tone, platform, visualStyle, targetAudience, bible, characters, episodes, sceneImages, globalMusicChoice, globalNarration, activeEpisodeId, seriesFormat, episodeDuration, visualTheme, storyAiProvider, designComplete, savedAt: new Date().toISOString() };
    localStorage.setItem(`ghs_series_proj_${id}`, JSON.stringify(data));
    localStorage.setItem(ACTIVE_KEY, id);
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    setProjectList(prev => {
      const exists = prev.find(p => p.id === id);
      const updated = exists ? prev.map(p => p.id === id ? { ...p, title: seriesTitle } : p) : [{ id, title: seriesTitle }, ...prev];
      localStorage.setItem(PROJ_LIST_KEY, JSON.stringify(updated));
      return updated;
    });
    setLastAction(`Saved — ${new Date().toLocaleTimeString()}`);
    return id;
  }

  // ── Save to DB ──
  async function saveProject() {
    setSaving(true);
    const id = saveLocal();
    try {
      const payload = { id, title: seriesTitle, genre, tone, platform, visualStyle, targetAudience, bible, characters, episodes, globalMusicChoice, globalNarration };
      await fetch("/api/series/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setLastAction(`Saved to DB — ${new Date().toLocaleTimeString()}`);
    } catch { setLastAction("Save failed — stored locally"); }
    setSaving(false);
  }

  function newProject() {
    saveLocal();
    setProjectId(null); setSeriesTitle("Untitled Series"); setGenre("Drama"); setTone(""); setPlatform("YouTube"); setVisualStyle("Cinematic"); setTargetAudience("General"); setBible(mkBible()); setCharacters([]); setEpisodes([]); setSceneImages({}); setActiveEpisodeId(null); setAssembledUrl(null); setLastAction("New project");
  }

  // ── Episode helpers ──
  function addEpisode() {
    const ep = mkEpisode(episodes.length + 1);
    setEpisodes(prev => [...prev, ep]);
    setActiveEpisodeId(ep.episodeId);
    setActiveTab("scenes");
    setLastAction(`Added Episode ${ep.number}`);
  }

  function updateEpisode(epId: string, updates: Partial<SeriesEpisode>) {
    setEpisodes(prev => prev.map(ep => ep.episodeId === epId ? { ...ep, ...updates } : ep));
  }

  function deleteEpisode(epId: string) {
    setEpisodes(prev => prev.filter(ep => ep.episodeId !== epId));
    if (activeEpisodeId === epId) setActiveEpisodeId(null);
  }

  const activeEpisode = episodes.find(ep => ep.episodeId === activeEpisodeId) || null;

  // ── Scene helpers (for active episode) ──
  function addScene() {
    if (!activeEpisodeId) return;
    const ep = episodes.find(e => e.episodeId === activeEpisodeId);
    if (!ep) return;
    const sc = mkScene(ep.scenes.length + 1);
    updateEpisode(activeEpisodeId, { scenes: [...ep.scenes, sc] });
    setLastAction(`Added Scene ${sc.scene}`);
  }

  function updateScene(sceneId: string, updates: Partial<SeriesScene>) {
    if (!activeEpisodeId) return;
    const ep = episodes.find(e => e.episodeId === activeEpisodeId);
    if (!ep) return;
    updateEpisode(activeEpisodeId, { scenes: ep.scenes.map(s => s.sceneId === sceneId ? { ...s, ...updates } : s) });
  }

  async function makeSceneImage(scene: SeriesScene) {
    setGeneratingSceneImage(scene.sceneId);
    try {
      const chars = characters.filter(c => scene.characterIds.includes(c.characterId));
      const charRefs = chars.map(c => `[${c.characterId}] ${c.displayName}: ${c.colorDescription || ""} ${c.clothingDetails || ""}`).join(", ");
      const prompt = `Scene: ${scene.title}. ${scene.description}. Location: ${scene.location}. Mood: ${scene.mood}. Time: ${scene.timeOfDay}. Characters: ${charRefs || "no specific characters"}. Style: ${visualStyle}. Series genre: ${genre}.`;
      const res = await fetch("/api/hybrid/scene-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, style: visualStyle, sceneType: scene.sceneType, characterRefs: chars.map(c => ({ id: c.characterId, imageUrl: c.imageUrl, locked: c.imageLocked })) }) });
      const d = await res.json();
      if (d.imageUrl) {
        setSceneImages(prev => ({ ...prev, [scene.sceneId]: d.imageUrl }));
        updateScene(scene.sceneId, { status: "generated" });
        setLastAction(`Scene ${scene.scene} image generated`);
      }
    } catch { setLastAction("Scene image generation failed"); }
    setGeneratingSceneImage(null);
  }

  async function expandBible() {
    if (!bible.worldDescription.trim()) return;
    setExpandingBible(true);
    setLastAction("AI is expanding your series bible...");
    try {
      const res = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: bible.worldDescription,
          genre,
          tone,
          audience: targetAudience,
          language: "English",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          seriesContext: {
            format: seriesFormat,
            platform,
            episodeDuration,
            visualStyle,
            visualTheme,
            seriesTitle,
          },
        }),
      });
      const d = await res.json();
      if (d.expandedStory || d.summary) {
        const expanded = d.expandedStory || {};
        const summary = expanded.summary || d.summary || "";
        setBible(prev => ({
          ...prev,
          lore: summary,
          themes: expanded.themes || prev.themes,
          locations: expanded.locations || prev.locations,
          rules: expanded.rules || prev.rules,
        }));
        setLastAction("Bible expanded — now extract characters");
      }
    } catch { setLastAction("Bible expansion failed"); }
    setExpandingBible(false);
  }

  async function extractAndBuildCharacters() {
    const text = bible.lore || bible.worldDescription;
    if (!text.trim()) { setLastAction("Expand the bible first"); return; }
    setExtractingChars(true);
    setLastAction("Extracting characters from series bible...");
    try {
      const detectRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: text, characterList: [] },
          language: "English",
        }),
      });
      const detectData = await detectRes.json();
      const detected: Array<{ name: string; description?: string }> = detectData.characters || [];
      if (detected.length === 0) { setLastAction("No characters found — add them manually"); setExtractingChars(false); return; }
      setLastAction(`Found ${detected.length} characters — building identities...`);
      setBuildingChars(true);
      const builtSoFar: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }> = [];
      const newChars: CharacterIdentity[] = [];
      for (const det of detected) {
        const name = det.name;
        if (!name) continue;
        if (characters.some(c => c.displayName.toLowerCase() === name.toLowerCase())) continue;
        setBuildCharProgress(`Building ${name}...`);
        try {
          const buildRes = await fetch("/api/hybrid/character-build", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              characterName: name,
              storyText: text,
              artStyle: visualStyle,
              language: "English",
              existingCharacters: builtSoFar,
            }),
          });
          const buildData = await buildRes.json();
          if (buildData.ok && buildData.character) {
            const c = buildData.character;
            const newId = `CH${String(characters.length + newChars.length + 1).padStart(2, "0")}`;
            const built: CharacterIdentity = {
              characterId: newId,
              displayName: c.displayName || name,
              roleType: c.roleType || "supporting",
              gender: c.gender || "unknown",
              ageRange: c.ageRange || "adult",
              skinTone: c.skinTone || "",
              hairStyle: "",
              wardrobeStyle: c.wardrobeStyle || "",
              speechStyle: c.speechStyle || "normal",
              accentType: "",
              emotionProfile: c.emotionProfile || "",
              voiceId: c.voiceId || "",
              language: "English",
              imageUrl: undefined,
              hasVoice: !!c.voiceId,
              hasImage: false,
              voiceType: c.voiceType || "mid",
              species: c.species || "",
              bodyBuild: c.bodyBuild || "",
              colorDescription: c.colorDescription || "",
              faceFeatures: c.faceFeatures || "",
              clothingDetails: c.clothingDetails || "",
              accessories: c.accessories || "",
              distinctiveFeatures: c.distinctiveFeatures || "",
              ageAppearance: c.ageAppearance || "",
            };
            newChars.push(built);
            builtSoFar.push({ name: built.displayName, species: built.species, gender: built.gender, colorDescription: built.colorDescription });
          }
        } catch { /* skip one bad build */ }
      }
      if (newChars.length > 0) {
        setCharacters(prev => {
          const combined = [...prev];
          for (const nc of newChars) {
            if (!combined.some(c => c.displayName.toLowerCase() === nc.displayName.toLowerCase())) {
              combined.push(nc);
            }
          }
          return combined;
        });
        setLastAction(`${newChars.length} characters built — go to Characters to review`);
      }
    } catch { setLastAction("Character extraction failed"); }
    setExtractingChars(false);
    setBuildingChars(false);
    setBuildCharProgress(null);
  }

  async function generateEpisodeScenes(epId: string) {
    const ep = episodes.find(e => e.episodeId === epId);
    if (!ep) return;
    setGeneratingEpisode(epId);
    try {
      const res = await fetch("/api/hybrid/scene-breakdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story: ep.synopsis, genre, style: visualStyle, duration: ep.duration, audience: targetAudience, characters: characters.map(c => ({ id: c.characterId, name: c.displayName, role: c.roleType })) }) });
      const d = await res.json();
      if (d.scenes) {
        const mapped: SeriesScene[] = d.scenes.map((s: any, i: number) => ({ sceneId: `SC${String(i+1).padStart(2,"0")}_${Date.now()}`, scene: i+1, title: s.title || `Scene ${i+1}`, description: s.description || "", sceneType: s.sceneType || "image-led", location: s.location || "", timeOfDay: s.timeOfDay || "day", mood: s.mood || "", narrationScript: s.narration || "", characterIds: (s.characters || []).map((c: any) => c.id || c.characterId).filter(Boolean), musicStyle: s.musicStyle || "", sfx: s.sfx || "", credits: s.credits || 1, status: "draft" as const }));
        updateEpisode(epId, { scenes: mapped, status: "scripted" });
        setActiveEpisodeId(epId);
        setActiveTab("scenes");
        setLastAction(`Episode ${ep.number} scenes generated`);
      }
    } catch { setLastAction("Scene generation failed"); }
    setGeneratingEpisode(null);
  }

  async function assembleEpisode(epId: string) {
    const ep = episodes.find(e => e.episodeId === epId);
    if (!ep) return;
    setAssembling(true);
    const sceneList = ep.scenes.map(s => ({ sceneId: s.sceneId, imageUrl: sceneImages[s.sceneId] || "", narration: s.narrationScript, duration: 5, musicStyle: ep.musicChoice }));
    try {
      const res = await fetch("/api/hybrid/assemble", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, scenes: sceneList, music: ep.musicChoice, narrationStyle: ep.narrationStyle, title: `${seriesTitle} - ${ep.title}` }) });
      const d = await res.json();
      if (d.outputUrl) {
        setAssembledUrl(d.outputUrl);
        updateEpisode(epId, { assembledVideoUrl: d.outputUrl, status: "generated" });
        setLastAction(`Episode ${ep.number} assembled`);
      }
    } catch { setLastAction("Assembly failed"); }
    setAssembling(false);
  }

  // ── Expand Story + Extract Characters + Build Scenes (3-step pipeline) ──
  async function expandStory() {
    const storyInput = bible.worldDescription || bible.lore;
    if (!storyInput.trim()) { setLastAction("Write your series world description first"); return; }
    setExpanding(true);
    setLastAction("AI is reading your story and building the full production plan...");
    try {
      // STEP 1: Story Expansion
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: storyInput.trim(),
          genre: genre || undefined,
          tone: tone || undefined,
          language: "English",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
        }),
      });
      const expandData = await expandRes.json();
      if (!expandRes.ok || expandData.ok === false) {
        setLastAction(expandData.error || "Story expansion failed. Try again.");
        setExpanding(false);
        return;
      }
      const expandedObj = expandData.expandedStory || {};
      const storySummary: string = expandedObj.summary || expandData.summary || storyInput;
      setBible(prev => ({ ...prev, lore: storySummary }));
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
      const extractedChars: CharacterIdentity[] = [];
      if (charData.characters?.length > 0) {
        charData.characters.forEach((c: Record<string, unknown>, i: number) => {
          extractedChars.push({
            characterId: (c.characterId as string) || `CH${String(i + 1).padStart(2, "0")}`,
            displayName: (c.name as string) || (c.displayName as string) || `Character ${i + 1}`,
            roleType: (c.role as string) || (c.roleType as string) || "supporting",
            gender: (c.gender as string) || "unknown",
            ageRange: (c.age as string) || (c.ageRange as string) || "adult",
            skinTone: "", hairStyle: "", wardrobeStyle: (c.wardrobeStyle as string) || "",
            speechStyle: (c.speechStyle as string) || "normal", accentType: "", emotionProfile: (c.personality as string) || "",
            voiceId: "", language: "English", hasVoice: false, hasImage: false,
            species: "", bodyBuild: "", colorDescription: "", faceFeatures: "",
            clothingDetails: (c.visualDescription as string) || "", accessories: "", distinctiveFeatures: "", ageAppearance: "",
          });
        });
        const seenNames = new Set<string>();
        const deduped = extractedChars.filter(c => {
          const key = c.displayName.toLowerCase();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });
        setCharacters(prev => {
          const combined = [...prev];
          deduped.forEach(nc => { if (!combined.some(c => c.displayName.toLowerCase() === nc.displayName.toLowerCase())) combined.push(nc); });
          return combined;
        });
        setLastAction(`${deduped.length} characters found — planning scenes...`);
      }

      // STEP 3: Scene Breakdown
      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: storySummary,
          characters: extractedChars.map(c => ({ characterId: c.characterId, displayName: c.displayName, role: c.roleType })),
          projectId: projectId || undefined,
        }),
      });
      const sceneData = await sceneRes.json();
      if (sceneData.scenes?.length > 0) {
        const builtScenes: SeriesScene[] = sceneData.scenes.map((s: Record<string, unknown>, i: number) => ({
          sceneId: `SC${String(i + 1).padStart(2, "0")}_${Date.now()}`,
          scene: i + 1,
          title: (s.title as string) || `Scene ${i + 1}`,
          description: (s.description as string) || (s.narrativeDescription as string) || "",
          sceneType: ((s.sceneType as string) || "image-led") as SeriesScene["sceneType"],
          location: (s.location as string) || "",
          timeOfDay: (s.timeOfDay as string) || "day",
          mood: (s.mood as string) || "",
          narrationScript: (s.narrationScript as string) || "",
          characterIds: (s.characterIds as string[]) || [],
          musicStyle: (s.musicSuggestion as string) || "",
          sfx: (s.soundSuggestion as string) || "",
          credits: SCENE_TYPE_MAP[(s.sceneType as string) || "image-led"]?.credits || 1,
          status: "draft" as const,
        }));
        // Put scenes into the active episode or create a new one
        if (activeEpisodeId) {
          updateEpisode(activeEpisodeId, { scenes: builtScenes, status: "scripted" });
        } else {
          const ep = mkEpisode(episodes.length + 1);
          ep.scenes = builtScenes;
          ep.status = "scripted";
          setEpisodes(prev => [...prev, ep]);
          setActiveEpisodeId(ep.episodeId);
        }
        setActiveTab("scenes");
        setLastAction(`Story expanded · ${extractedChars.length} characters · ${builtScenes.length} scenes ready`);
        // auto-run scene intelligence after planning
        setTimeout(() => runSceneIntelligence(), 500);
      } else {
        setLastAction(`Story expanded · ${extractedChars.length} characters ready`);
      }
    } catch (err) {
      console.error("expandStory failed:", err);
      setLastAction("Story expansion failed: " + String(err));
    }
    setExpanding(false);
  }

  // ── Scene Intelligence ──
  async function runSceneIntelligence() {
    const ep = activeEpisode;
    if (!ep || ep.scenes.length === 0) return;
    setRunningIntelligence(true);
    try {
      const res = await fetch("/api/hybrid/scene-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: ep.scenes.map(s => ({
            sceneId: s.sceneId,
            title: s.title,
            description: s.description,
            location: s.location,
            timeOfDay: s.timeOfDay,
            mood: s.mood,
          })),
          storyContext: seriesTitle + (bible.worldDescription ? ": " + bible.worldDescription : ""),
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.intelligence)) {
        const map: Record<string, SceneIntelligenceData> = {};
        for (const item of data.intelligence) map[item.sceneId] = item;
        setSceneIntelligence(map);
        updateEpisode(ep.episodeId, {
          scenes: ep.scenes.map(s => {
            const intel = map[s.sceneId];
            if (!intel) return s;
            return {
              ...s,
              location: s.location || intel.environmentType.replace(/-/g, " "),
              timeOfDay: s.timeOfDay || intel.timeOfDay,
              mood: s.mood || intel.energyLevel,
              sfx: s.sfx || intel.sfxEvents.slice(0, 4).join(", "),
              ambience: (s as any).ambience || intel.ambienceSounds.slice(0, 3).join(", "),
            };
          }),
        });
      }
    } catch (err) {
      console.warn("Scene intelligence failed:", err);
    }
    setRunningIntelligence(false);
  }

  // ── Make Scene Video (SSE streaming) ──
  async function makeSceneVideo(scene: SeriesScene) {
    const sceneId = scene.sceneId;
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
          sceneText: `${scene.title}. ${scene.description}`,
          imageUrl: existingImage,
          duration: 5,
          motionDescription: "",
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
              updateScene(sceneId, { status: "generated" });
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

  // ── assembleMovie() — assemble selected scenes via /api/video/assemble ──
  async function assembleMovie(epId?: string) {
    const ep = epId ? episodes.find(e => e.episodeId === epId) : activeEpisode;
    if (!ep) return;
    setAssembling(true);
    setAssemblyComplete(false);
    const progress: Record<string, string> = {};
    ep.scenes.forEach(s => { progress[s.sceneId] = "queued"; });
    setAssemblySceneProgress({ ...progress });
    try {
      const assemblyScenes: Array<{ scene: number; videoUrl: string }> = [];
      const skipped: number[] = [];
      const selectedScenes = assemblySelectedIds.length > 0
        ? ep.scenes.filter(s => assemblySelectedIds.includes(s.sceneId))
        : ep.scenes;
      for (const s of selectedScenes) {
        const videoUrl = sceneVideos[s.sceneId] || undefined;
        const imageUrl = sceneImages[s.sceneId];
        if (videoUrl) {
          assemblyScenes.push({ scene: s.scene, videoUrl });
        } else if (imageUrl) {
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
        progress[String(s.scene)] = "processing";
        setAssemblySceneProgress({ ...progress });
        await new Promise(resolve => setTimeout(resolve, 200));
        progress[String(s.scene)] = "done";
        setAssemblySceneProgress({ ...progress });
      }
      const res = await fetch("/api/video/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, title: assemblyName || seriesTitle,
          scenes: assemblyScenes,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(`Assembly API error: ${data.error}`);
      } else if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        updateEpisode(ep.episodeId, { assembledVideoUrl: data.outputUrl, status: "generated" });
        try {
          await fetch("/api/asset-library", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: `${seriesTitle} — ${ep.title}`, type: "video", url: data.outputUrl, projectId }),
          });
        } catch { /* best effort */ }
      }
      setAssemblyComplete(true);
      setLastAction(`Episode ${ep.number} assembled`);
    } catch (err) {
      console.error("assembleMovie error:", err);
      setErrorMsg(`Assembly failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setAssembling(false);
    saveProject();
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
        body: JSON.stringify({ description: sfxDesc.trim() }),
      });
      const data = await res.json();
      if (data.fileUrl) { setSfxGeneratedUrl(data.fileUrl); setLastAction(`SFX generated: "${sfxDesc.slice(0, 30)}"`); }
      else setErrorMsg(data.error || "SFX generation failed");
    } catch { setErrorMsg("SFX generation failed"); }
    finally { setSfxGenerating(false); }
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
      const storyContext = (bible.lore || bible.worldDescription).slice(0, 400);
      const trackList = tracks.map((t, i) => `${i + 1}. "${t.name}"${t.tags?.length ? ` [${t.tags.slice(0, 4).join(", ")}]` : ""}`).join("\n");
      setAiMusicPickLog("Asking AI to pick best track...");
      const prompt = `You are a music supervisor for an animated series. Pick the best background track for this series.\n\nSERIES:\n${storyContext}\n\nAVAILABLE TRACKS:\n${trackList}\n\nReply with ONLY JSON: {"trackNumber": 2, "trackName": "exact name", "reason": "one sentence"}`;
      const llmRes = await fetch("/api/llm/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  // ── Generate narration audio per scene ──
  async function generateSceneNarration(scene: SeriesScene) {
    const text = scene.narrationScript;
    if (!text?.trim()) { setErrorMsg(`Scene ${scene.scene} has no narration text. Add text first.`); return; }
    setLastAction(`Generating narration audio for Scene ${scene.scene}...`);
    try {
      const res = await fetch("/api/hybrid/narrate-piper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text, sceneId: scene.sceneId,
          model: "en_US-lessac-medium", speed: 0.85,
        }),
      });
      const data = await res.json();
      if (data.audioUrl || data.filePath) {
        const audioUrl = data.audioUrl || `/api/media/${data.filePath}`;
        updateScene(scene.sceneId, { narrationAudioUrl: audioUrl });
        setLastAction(`Scene ${scene.scene} narration audio ready`);
      } else {
        setErrorMsg(data.error || "Narration generation failed");
      }
    } catch (err) {
      setErrorMsg(`Narration failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ── Generate Screenplay ──
  async function generateScreenplay() {
    const storyText = bible.lore || bible.worldDescription;
    if (!storyText.trim()) { setScreenplayError("Expand your series bible first."); return; }
    setGeneratingScreenplay(true);
    setScreenplayError("");
    try {
      const res = await fetch("/api/hybrid/screenplay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: seriesTitle,
          summary: storyText,
          scenes: activeEpisode?.scenes.map(s => ({ title: s.title, goal: s.description, visualDescription: s.description, dialogue: s.narrationScript })) ?? [],
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

  // ── Parse Script ──
  async function parseScript() {
    const textToParse = screenplay || bible.lore || bible.worldDescription;
    if (!textToParse.trim()) return;
    setParsingScript(true);
    try {
      const res = await fetch("/api/hybrid/parse-script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToParse,
          knownCharacters: characters.map(c => c.displayName),
        }),
      });
      const data = await res.json();
      if (data.ok && data.segments) {
        setScriptSegments(data.segments);
        setShowScriptReview(true);
        setLastAction(`Script parsed — ${data.segments.length} segments`);
      }
    } catch { /* ignore */ }
    setParsingScript(false);
  }

  // ── Send screenplay to scenes ──
  async function sendScreenplayToScenes() {
    if (!screenplay || !activeEpisode) return;
    setSendingToScenes(true);
    setSendToScenesResult("");
    const lines = screenplay.split("\n");
    const sceneBlocks: Array<{ sceneNum: number; lines: string[] }> = [];
    let currentBlock: string[] = [];
    let currentSceneNum = 0;
    lines.forEach(line => {
      const trimmed = line.trim();
      if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed)) {
        if (currentBlock.length > 0 && currentSceneNum > 0) sceneBlocks.push({ sceneNum: currentSceneNum, lines: currentBlock });
        currentSceneNum++;
        currentBlock = [trimmed];
      } else {
        currentBlock.push(trimmed);
      }
    });
    if (currentBlock.length > 0 && currentSceneNum > 0) sceneBlocks.push({ sceneNum: currentSceneNum, lines: currentBlock });
    sceneBlocks.forEach(block => {
      const sc = activeEpisode.scenes[block.sceneNum - 1];
      if (sc) {
        const narration = block.lines.filter(l => l && !/^[A-Z][A-Z\s\-'().]+$/.test(l) && !l.startsWith("(")).join(" ");
        updateScene(sc.sceneId, { narrationScript: narration });
      }
    });
    setSendToScenesResult(`Screenplay sent to ${sceneBlocks.length} scenes. Go to Audio to generate narration.`);
    setSendingToScenes(false);
    await parseScript();
  }

  // ── Progress calculations ──
  const allScenes = episodes.flatMap(ep => ep.scenes);
  const bibleProgress = [bible.worldDescription, bible.lore, bible.locations, bible.rules].filter(Boolean).length * 25;
  const charProgress = Math.min(100, characters.length * 20);
  const episodeProgress = Math.min(100, episodes.length * 10);
  const imageProgress = allScenes.length > 0 ? Math.round(Object.keys(sceneImages).length / allScenes.length * 100) : 0;
  const assemblyProgress = Math.round(episodes.filter(ep => ep.status === "generated" || ep.status === "approved" || ep.status === "published").length / Math.max(1, episodes.length) * 100);

  // ── Warnings ──
  const warnings: string[] = [];
  if (!bible.worldDescription) warnings.push("Series Bible: No world description yet");
  if (characters.length === 0) warnings.push("No series characters defined");
  if (episodes.length === 0) warnings.push("No episodes planned");
  characters.forEach(c => { if (!c.hasVoice) warnings.push(`${c.displayName}: No voice assigned`); });
  episodes.forEach(ep => { if (ep.scenes.length === 0) warnings.push(`${ep.title}: No scenes planned`); });

  // ── Render helpers ──
  function ProgressBar({ value, color = accent }: { value: number; color?: string }) {
    return <div style={{ height: 6, background: border, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 4, transition: "width 0.5s" }} /></div>;
  }

  function TabBar() {
    return (
      <div style={{ display: "flex", gap: 4, padding: "0 20px", borderBottom: `1px solid ${border}`, background: s2, overflowX: "auto" }}>
        {WORKSHOP_TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "14px 16px", background: "none", border: "none", color: active ? accent : muted, fontWeight: active ? 700 : 500, fontSize: 12, cursor: "pointer", borderBottom: active ? `2px solid ${accent}` : "2px solid transparent", whiteSpace: "nowrap", display: "flex", gap: 6, alignItems: "center" }}>
              <span>{t.icon}</span><span>{t.label}</span>
              {t.step && <span style={{ fontSize: 9, background: `${accent}22`, color: accent, borderRadius: 10, padding: "1px 6px" }}>{t.step}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // ── TAB: Overview ──
  function renderOverview() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Episodes", value: episodes.length, color: blue },
            { label: "Characters", value: characters.length, color: purple },
            { label: "Total Scenes", value: allScenes.length, color: gold },
            { label: "Images Ready", value: Object.keys(sceneImages).length, color: accent },
            { label: "Assembled", value: episodes.filter(e => !!e.assembledVideoUrl).length, color: "#ec4899" },
            { label: "Warnings", value: warnings.length, color: warnings.length > 0 ? red : accent },
          ].map(s => (
            <div key={s.label} style={{ ...card, textAlign: "center", marginBottom: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={card}>
            <div style={lbl}>Production Progress</div>
            {[
              { label: "Series Bible", val: bibleProgress, color: blue },
              { label: "Characters", val: charProgress, color: purple },
              { label: "Episodes", val: episodeProgress, color: gold },
              { label: "Scene Images", val: imageProgress, color: accent },
              { label: "Assembly", val: assemblyProgress, color: "#ec4899" },
            ].map(p => (
              <div key={p.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: muted }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: p.color, fontWeight: 700 }}>{p.val}%</span>
                </div>
                <ProgressBar value={p.val} color={p.color} />
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={lbl}>Series Info</div>
            <div style={{ marginBottom: 8 }}>
              <span style={lbl}>Title</span>
              <input style={inp} value={seriesTitle} onChange={e => setSeriesTitle(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><span style={lbl}>Genre</span><select style={inp} value={genre} onChange={e => setGenre(e.target.value)}>{GENRES.map(g => <option key={g}>{g}</option>)}</select></div>
              <div><span style={lbl}>Platform</span><select style={inp} value={platform} onChange={e => setPlatform(e.target.value)}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</select></div>
              <div><span style={lbl}>Visual Style</span><select style={inp} value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>{VISUAL_STYLES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><span style={lbl}>Audience</span><input style={inp} value={targetAudience} onChange={e => setTargetAudience(e.target.value)} /></div>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div style={{ ...card, borderColor: `${red}44` }}>
            <div style={lbl}>⚠️ Warnings & Blockers</div>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < warnings.length - 1 ? `1px solid ${border}` : "none" }}>
                <span style={{ color: red, fontSize: 13 }}>⚠</span>
                <span style={{ fontSize: 12, color: "#ddd" }}>{w}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn(accent)} onClick={saveProject} disabled={saving}>{saving ? "Saving…" : "💾 Save Series"}</button>
          <button style={btn(blue)} onClick={() => setActiveTab("design")}>📖 Write Bible</button>
          <button style={btn(purple)} onClick={() => setActiveTab("characters")}>👥 Add Characters</button>
          <button style={btn(gold)} onClick={() => { addEpisode(); }}>+ Add Episode</button>
          <button style={btn("#555")} onClick={newProject}>New Series</button>
          <span style={{ fontSize: 11, color: muted, marginLeft: "auto" }}>Last: {lastAction}</span>
        </div>
      </div>
    );
  }

  // ── TAB: Series Design ──
  function renderDesign() {
    const SERIES_FORMATS = [
      { id: "episodic-shorts", label: "Episodic Shorts", desc: "1-10 min per episode, optimized for social" },
      { id: "short-form", label: "Short Form", desc: "10-20 min episodes" },
      { id: "mini-series", label: "Mini Series", desc: "20-45 min episodes, limited run" },
      { id: "long-form", label: "Long Form", desc: "45+ min full episodes" },
    ];
    const VISUAL_THEMES = ["Dark Fantasy", "Bright Animated", "Gritty Realism", "Afrobeats Energy", "Nollywood Drama", "Sci-Fi", "Romance Drama", "Children's Animation", "Horror", "Historical Epic", "Comedy", "Documentary Style"];

    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>🎨 Series Design</h2>
        <p style={{ color: muted, fontSize: 12, margin: "0 0 20px" }}>Define the visual identity and format of your series. This feeds into your Bible, Characters, and Episodes.</p>

        <div style={card}>
          <span style={lbl}>Series Title</span>
          <input style={inp} value={seriesTitle} onChange={e => setSeriesTitle(e.target.value)} placeholder="e.g. The City Chronicles" />
        </div>

        <div style={card}>
          <span style={lbl}>Series Format</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {SERIES_FORMATS.map(f => (
              <div key={f.id} onClick={() => setSeriesFormat(f.id as "long-form" | "short-form" | "episodic-shorts" | "mini-series")}
                style={{ padding: 14, borderRadius: 10, border: `1px solid ${seriesFormat === f.id ? accent : border}`, background: seriesFormat === f.id ? `${accent}15` : s2, cursor: "pointer" }}>
                <div style={{ color: seriesFormat === f.id ? accent : "#fff", fontWeight: 700, fontSize: 12 }}>{f.label}</div>
                <div style={{ color: muted, fontSize: 10, marginTop: 3 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={card}>
            <span style={lbl}>Genre</span>
            <select style={inp} value={genre} onChange={e => setGenre(e.target.value)}>
              {GENRES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={card}>
            <span style={lbl}>Platform</span>
            <select style={inp} value={platform} onChange={e => setPlatform(e.target.value)}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={card}>
            <span style={lbl}>Visual Style</span>
            <select style={inp} value={visualStyle} onChange={e => setVisualStyle(e.target.value)}>
              {VISUAL_STYLES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={card}>
          <span style={lbl}>Visual Theme / Mood</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {VISUAL_THEMES.map(t => (
              <button key={t} onClick={() => setVisualTheme(t === visualTheme ? "" : t)}
                style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${visualTheme === t ? accent : border}`, background: visualTheme === t ? `${accent}20` : "transparent", color: visualTheme === t ? accent : muted, fontSize: 11, cursor: "pointer" }}>
                {t}
              </button>
            ))}
          </div>
          <input style={inp} value={visualTheme} onChange={e => setVisualTheme(e.target.value)} placeholder="Or type your own theme..." />
        </div>

        <div style={card}>
          <span style={lbl}>Tone</span>
          <input style={inp} value={tone} onChange={e => setTone(e.target.value)} placeholder="e.g. intense, dramatic, humorous, emotional..." />
        </div>

        <div style={card}>
          <span style={lbl}>Target Audience</span>
          <input style={inp} value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Young adults 18-30, Family, Kids 6-12..." />
        </div>

        <div style={card}>
          <span style={lbl}>Story Expansion Intelligence</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { value: "ollama",                        label: "Local LLM",  sub: "Ollama · Free · No cloud cost",                      color: accent, badge: "FREE" },
              { value: "claude:claude-haiku-4-5-20251001", label: "Standard",   sub: "Claude Haiku 4.5 · Fast · Low cost",                 color: blue,   badge: "FAST" },
              { value: "claude:claude-sonnet-4-6",      label: "Pro",        sub: "Claude Sonnet 4.6 · Best balance · Recommended",      color: purple, badge: "REC" },
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

        <div style={{ ...card, display: "flex", gap: 12 }}>
          <button style={btn(accent)} onClick={() => { setDesignComplete(true); setActiveTab("bible"); setLastAction("Design set — write your bible"); }}>
            ✅ Confirm Design → Go to Bible
          </button>
          <button style={btn("#555")} onClick={saveProject}>💾 Save</button>
        </div>
      </div>
    );
  }

  // ── TAB: Series Bible ──
  function renderBible() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>📖 Series Bible</h2>
            <p style={{ color: muted, fontSize: 12, margin: "4px 0 0" }}>Define your story universe — lore, world, rules, locations, timeline</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn(blue)} onClick={expandBible} disabled={expandingBible || !bible.worldDescription}>{expandingBible ? "Expanding…" : "✨ Expand Bible"}</button>
            <button style={{ ...btn(accent), background: expanding ? "#2a2a40" : `linear-gradient(135deg, ${accent}, #16a34a)` }} onClick={expandStory} disabled={expanding || (!bible.worldDescription && !bible.lore)}>
              {expanding ? "⏳ Building Plan..." : "🧠 Expand + Extract + Scenes"}
            </button>
            {(bible.lore || bible.worldDescription) && (
              <button style={btn(purple)} onClick={extractAndBuildCharacters} disabled={extractingChars || buildingChars}>
                {extractingChars ? "Extracting..." : buildingChars ? (buildCharProgress || "Building...") : "🎭 Extract Characters"}
              </button>
            )}
          </div>
          {expanding && <p style={{ fontSize: 10, color: accent, marginTop: 4 }}>Running 3-step pipeline: story expand → character extract → scene plan...</p>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { key: "worldDescription", label: "🌍 World Description", placeholder: "Describe the world, setting, era, universe of this series…", rows: 5 },
            { key: "lore", label: "📜 Lore & History", placeholder: "Key history, mythology, backstory, foundational events…", rows: 5 },
            { key: "locations", label: "📍 Key Locations", placeholder: "Important places, settings, environments that appear repeatedly…", rows: 4 },
            { key: "timeline", label: "⏰ Timeline", placeholder: "Chronological order of events, past/present/future…", rows: 4 },
            { key: "rules", label: "📋 World Rules", placeholder: "Laws of physics, magic systems, societal rules, what is possible/impossible…", rows: 4 },
            { key: "keyEvents", label: "🔑 Key Events", placeholder: "Major events that define the series arc…", rows: 4 },
            { key: "tone", label: "🎭 Tone & Atmosphere", placeholder: "Dark, hopeful, comedic, epic, grounded, fantastical…", rows: 3 },
            { key: "themes", label: "💡 Themes", placeholder: "Main themes: identity, power, love, survival, redemption…", rows: 3 },
          ].map(f => (
            <div key={f.key} style={card}>
              <span style={lbl}>{f.label}</span>
              <textarea style={{ ...inp, resize: "vertical" }} rows={f.rows} placeholder={f.placeholder} value={(bible as any)[f.key]} onChange={e => setBible(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button style={btn(accent)} onClick={saveProject}>💾 Save Bible</button>
          <button style={btn(purple)} onClick={() => setActiveTab("characters")}>Next: Characters →</button>
        </div>
      </div>
    );
  }

  // ── TAB: Characters ──
  function renderCharacters() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>👥 Series Characters</h2>
            <p style={{ color: muted, fontSize: 12, margin: "4px 0 0" }}>Recurring cast — shared across all episodes</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn(purple)} onClick={() => setShowCharPicker(true)}>📥 Import Character</button>
          </div>
        </div>

        {characters.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40 }}>👥</div>
            <div style={{ color: muted, margin: "12px 0" }}>No characters yet. Import from your Characters library or add new ones.</div>
            <button style={btn(purple)} onClick={() => setShowCharPicker(true)}>Import Characters</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {characters.map(ch => (
            <div key={ch.characterId} style={{ ...card, position: "relative" }}>
              <button onClick={() => setCharacters(prev => prev.filter(c => c.characterId !== ch.characterId))} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: red, cursor: "pointer", fontSize: 16 }}>✕</button>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: ch.imageUrl ? "transparent" : `${purple}33`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {ch.imageUrl ? <img src={ch.imageUrl} alt={ch.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24 }}>👤</span>}
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{ch.displayName}</div>
                  <div style={{ color: muted, fontSize: 11, marginTop: 2 }}>{ch.roleType}</div>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span style={badge(ch.hasVoice ? accent : red)}>{ch.hasVoice ? "✓ Voice" : "No Voice"}</span>
                    <span style={badge(ch.hasImage ? blue : "#888")}>{ch.hasImage ? "✓ Image" : "No Image"}</span>
                    {ch.voiceType && <span style={badge(purple)}>{ch.voiceType}</span>}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: muted }}>ID: {ch.characterId}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                {ch.speechStyle && <span>Speech: {ch.speechStyle} · </span>}
                {ch.accentType && <span>Accent: {ch.accentType}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button style={btn(accent)} onClick={saveProject}>💾 Save</button>
          <button style={btn(gold)} onClick={() => setActiveTab("episodes")}>Next: Episodes →</button>
        </div>

        {showCharPicker && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCharPicker(false)}>
            <div style={{ background: surface, borderRadius: 16, padding: 0, maxWidth: 680, width: "90%", maxHeight: "80vh", overflow: "auto", position: "relative" }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowCharPicker(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer", zIndex: 1 }}>✕</button>
              <CharacterPicker
                onSelect={(char: any) => {
                  setCharacters(prev => {
                    const id = char.id || char.characterId || `CH_${Date.now()}`;
                    if (prev.find(c => c.characterId === id)) return prev;
                    return [...prev, { characterId: id, displayName: char.name || char.displayName, roleType: char.role || char.roleType || "supporting", gender: char.gender || "", ageRange: char.ageRange || "", skinTone: char.skinTone || "", hairStyle: char.hairStyle || "", wardrobeStyle: char.wardrobeStyle || "", speechStyle: char.speechStyle || "", accentType: char.accent || char.accentType || "", emotionProfile: char.emotionProfile || "", voiceId: char.voiceId || "", language: char.language || "English", imageUrl: char.imageUrl, hasVoice: !!char.voiceId, hasImage: !!char.imageUrl }];
                  });
                  setShowCharPicker(false);
                }}
                onCreateNew={() => { window.open("/dashboard/character-voices", "_blank"); }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── TAB: Episodes ──
  function renderEpisodes() {
    const statusColors: Record<string, string> = { planning: muted, scripted: blue, generating: gold, generated: accent, approved: accent, published: purple };
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>🎬 Episodes</h2>
            <p style={{ color: muted, fontSize: 12, margin: "4px 0 0" }}>{episodes.length} episode{episodes.length !== 1 ? "s" : ""} planned — click to manage scenes</p>
          </div>
          <button style={btn(accent)} onClick={addEpisode}>+ Add Episode</button>
        </div>

        {episodes.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40 }}>🎬</div>
            <div style={{ color: muted, margin: "12px 0" }}>No episodes yet. Add your first episode to start planning scenes.</div>
            <button style={btn(accent)} onClick={addEpisode}>+ Add First Episode</button>
          </div>
        )}

        {episodes.map(ep => {
          const isActive = activeEpisodeId === ep.episodeId;
          const isExpanded = expandingEpisode === ep.episodeId;
          const epImages = ep.scenes.filter(s => sceneImages[s.sceneId]).length;
          return (
            <div key={ep.episodeId} style={{ ...card, borderColor: isActive ? `${accent}66` : border }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${statusColors[ep.status] || muted}22`, display: "flex", alignItems: "center", justifyContent: "center", color: statusColors[ep.status] || muted, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {String(ep.number).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <input style={{ ...inp, padding: "6px 10px", fontWeight: 700, fontSize: 14 }} value={ep.title} onChange={e => updateEpisode(ep.episodeId, { title: e.target.value })} />
                </div>
                <span style={badge(statusColors[ep.status] || muted)}>{ep.status}</span>
                <span style={{ fontSize: 11, color: muted }}>{ep.scenes.length} scenes · {epImages} img</span>
                <button style={{ ...btn(isActive ? accent : "#334"), padding: "8px 14px", fontSize: 11 }} onClick={() => { setActiveEpisodeId(ep.episodeId); setActiveTab("scenes"); }}>
                  {isActive ? "Active ✓" : "Open"}
                </button>
                <button style={{ ...btn("#334"), padding: "8px 14px", fontSize: 11 }} onClick={() => setExpandingEpisode(isExpanded ? null : ep.episodeId)}>
                  {isExpanded ? "▲" : "▼"}
                </button>
                <button style={{ ...btn(red), padding: "8px 14px", fontSize: 11 }} onClick={() => deleteEpisode(ep.episodeId)}>✕</button>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div><span style={lbl}>Synopsis</span><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={ep.synopsis} onChange={e => updateEpisode(ep.episodeId, { synopsis: e.target.value })} placeholder="Episode synopsis…" /></div>
                    <div>
                      <div><span style={lbl}>Duration</span><DurationPicker preset="episode" value={ep.duration} onChange={(label: string) => updateEpisode(ep.episodeId, { duration: label })} label="" accentColor="#7c5cfc" /></div>
                      <div style={{ marginTop: 8 }}><span style={lbl}>Music</span><select style={inp} value={ep.musicChoice} onChange={e => updateEpisode(ep.episodeId, { musicChoice: e.target.value })}>{MUSIC_CHOICES.map(m => <option key={m}>{m}</option>)}</select></div>
                      <div style={{ marginTop: 8 }}><span style={lbl}>Narration</span><select style={inp} value={ep.narrationStyle} onChange={e => updateEpisode(ep.episodeId, { narrationStyle: e.target.value })}>{NARRATION_STYLES.map(n => <option key={n}>{n}</option>)}</select></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btn(blue)} onClick={() => generateEpisodeScenes(ep.episodeId)} disabled={generatingEpisode === ep.episodeId || !ep.synopsis}>{generatingEpisode === ep.episodeId ? "Generating…" : "✨ Generate Scenes with AI"}</button>
                    <button style={btn(accent)} onClick={() => { setActiveEpisodeId(ep.episodeId); setActiveTab("scenes"); }}>🎬 Go to Scene Board</button>
                    {ep.scenes.length > 0 && <button style={btn(purple)} onClick={() => assembleEpisode(ep.episodeId)} disabled={assembling}>{assembling ? "Assembling…" : "🚀 Assemble Episode"}</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button style={btn(accent)} onClick={saveProject}>💾 Save</button>
          <button style={btn(blue)} onClick={() => activeEpisodeId ? setActiveTab("scenes") : undefined} disabled={!activeEpisodeId}>Next: Scene Board →</button>
        </div>
      </div>
    );
  }

  // ── TAB: Scene Board ──
  function renderScenes() {
    const ep = activeEpisode;
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>🖼 Scene Board</h2>
            <p style={{ color: muted, fontSize: 12, margin: "4px 0 0" }}>{ep ? `${ep.title} — ${ep.scenes.length} scene${ep.scenes.length !== 1 ? "s" : ""}` : "Select an episode first"}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {episodes.length > 0 && (
              <select style={{ ...inp, width: "auto" }} value={activeEpisodeId || ""} onChange={e => setActiveEpisodeId(e.target.value)}>
                <option value="">Select Episode</option>
                {episodes.map(ep => <option key={ep.episodeId} value={ep.episodeId}>{ep.title}</option>)}
              </select>
            )}
            {ep && <button style={btn(accent)} onClick={addScene}>+ Add Scene</button>}
            <button
              disabled={runningIntelligence || (ep ? ep.scenes.length === 0 : true)}
              onClick={runSceneIntelligence}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4ade8030", background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}
            >
              {runningIntelligence ? "⚡ Detecting..." : "🔊 Scene Intelligence"}
            </button>
          </div>
        </div>
        {runningIntelligence && (
          <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0 8px" }}>⚡ Scene Intelligence running — detecting environments and ambient sounds...</p>
        )}
        {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
          <p style={{ fontSize: 10, color: "#666", margin: "4px 0 8px" }}>
            🔊 {Object.keys(sceneIntelligence).length} scenes have sound environment data
          </p>
        )}

        {/* ── AI Model Picker (Scene Board) ── */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
              style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${accent}40`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              🎬 Video Model: <span style={{ color: "#fff" }}>{selectedVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
            </button>
            <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
              style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              🖼 Image Model: <span style={{ color: "#fff" }}>{selectedImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
            </button>
          </div>
        </div>

        {!ep && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40 }}>🎬</div>
            <div style={{ color: muted, margin: "12px 0" }}>No active episode. Go to Episodes tab to select or create one.</div>
            <button style={btn(gold)} onClick={() => setActiveTab("episodes")}>Go to Episodes</button>
          </div>
        )}

        {ep && ep.scenes.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40 }}>🖼</div>
            <div style={{ color: muted, margin: "12px 0" }}>No scenes yet. Add scenes manually or generate them from the Episodes tab.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={btn(accent)} onClick={addScene}>+ Add Scene</button>
              <button style={btn(blue)} onClick={() => setActiveTab("episodes")}>Generate from Episode</button>
            </div>
          </div>
        )}

        {ep && ep.scenes.map(sc => {
          const img = sceneImages[sc.sceneId];
          const vid = sceneVideos[sc.sceneId];
          const isExpanded = expandedSceneId === sc.sceneId;
          const sType = SCENE_TYPE_MAP[sc.sceneType];
          const genProg = sceneGenProgress[sc.sceneId];
          const isGenVideo = generatingSceneVideos.has(sc.sceneId);
          return (
            <div key={sc.sceneId} style={{ ...card, borderColor: vid ? `${purple}55` : img ? `${accent}44` : border }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 120, height: 68, borderRadius: 10, background: img ? "transparent" : `${border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {vid ? <video src={vid} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted loop autoPlay playsInline /> : img ? <img src={img} alt={sc.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: muted, fontSize: 24 }}>🖼</span>}
                  {vid && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 8, background: purple, color: "#fff", borderRadius: 4, padding: "1px 4px" }}>VID</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: muted, fontSize: 11 }}>SC{String(sc.scene).padStart(2,"0")}</span>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{sc.title}</span>
                    {sType && <span style={badge(sType.color)}>{sType.label}</span>}
                    <span style={badge(sc.status === "generated" || sc.status === "approved" ? accent : muted)}>{sc.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>{sc.description || "No description yet"}</div>
                  {/* Scene Intelligence card */}
                  {(() => {
                    const intel = sceneIntelligence[sc.sceneId];
                    if (!intel) return null;
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
                  {genProg && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: purple }}>{genProg.message}</span>
                        <span style={{ fontSize: 9, color: purple, fontWeight: 700 }}>{genProg.percent}%</span>
                      </div>
                      <div style={{ height: 4, background: border, borderRadius: 2 }}>
                        <div style={{ width: `${genProg.percent}%`, height: "100%", background: purple, borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={{ ...btn(blue), padding: "6px 12px", fontSize: 11 }} onClick={() => makeSceneImage(sc)} disabled={generatingSceneImage === sc.sceneId}>{generatingSceneImage === sc.sceneId ? "Generating…" : img ? "🔄 Regen Image" : "🖼 Make Image"}</button>
                    {img && <button style={{ ...btn(isGenVideo ? "#2a2a40" : purple), padding: "6px 12px", fontSize: 11 }} onClick={() => makeSceneVideo(sc)} disabled={isGenVideo}>{isGenVideo ? "⏳ Making Video..." : vid ? "🔄 Regen Video" : "🎬 Make Video"}</button>}
                    <button style={{ ...btn("#334"), padding: "6px 12px", fontSize: 11 }} onClick={() => setExpandedSceneId(isExpanded ? null : sc.sceneId)}>✏️ {isExpanded ? "Close" : "Edit"}</button>
                    {img && <button style={{ ...btn(accent), padding: "6px 12px", fontSize: 11 }} onClick={() => updateScene(sc.sceneId, { status: "approved" })}>✓ Approve</button>}
                    <button style={{ ...btn(red), padding: "6px 12px", fontSize: 11 }} onClick={() => { if (ep) updateEpisode(ep.episodeId, { scenes: ep.scenes.filter(s => s.sceneId !== sc.sceneId) }); }}>✕</button>
                  </div>
                  {vid && (
                    <div style={{ marginTop: 8 }}>
                      <video src={vid} controls style={{ width: "100%", maxHeight: 140, borderRadius: 8, background: "#000" }} />
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div><span style={lbl}>Title</span><input style={inp} value={sc.title} onChange={e => updateScene(sc.sceneId, { title: e.target.value })} /></div>
                    <div><span style={lbl}>Scene Type</span><select style={inp} value={sc.sceneType} onChange={e => updateScene(sc.sceneId, { sceneType: e.target.value as any })}>{SCENE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} ({t.credits} cr)</option>)}</select></div>
                    <div><span style={lbl}>Time of Day</span><select style={inp} value={sc.timeOfDay} onChange={e => updateScene(sc.sceneId, { timeOfDay: e.target.value })}>{["day","night","dawn","dusk","afternoon","midnight"].map(t => <option key={t}>{t}</option>)}</select></div>
                    <div><span style={lbl}>Location</span><input style={inp} value={sc.location} onChange={e => updateScene(sc.sceneId, { location: e.target.value })} placeholder="Marketplace, forest, rooftop…" /></div>
                    <div><span style={lbl}>Mood</span><input style={inp} value={sc.mood} onChange={e => updateScene(sc.sceneId, { mood: e.target.value })} placeholder="Tense, joyful, mysterious…" /></div>
                    <div>
                      <span style={lbl}>Characters in Scene</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {characters.map(ch => (
                          <button key={ch.characterId} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${sc.characterIds.includes(ch.characterId) ? accent : border}`, background: sc.characterIds.includes(ch.characterId) ? `${accent}22` : s2, color: sc.characterIds.includes(ch.characterId) ? accent : muted, fontSize: 11, cursor: "pointer" }}
                            onClick={() => updateScene(sc.sceneId, { characterIds: sc.characterIds.includes(ch.characterId) ? sc.characterIds.filter(id => id !== ch.characterId) : [...sc.characterIds, ch.characterId] })}>
                            {ch.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}><span style={lbl}>Description</span><textarea style={{ ...inp, resize: "vertical" }} rows={2} value={sc.description} onChange={e => updateScene(sc.sceneId, { description: e.target.value })} placeholder="Visual description of this scene…" /></div>
                    <div style={{ gridColumn: "1 / -1" }}><span style={lbl}>Narration Script</span><textarea style={{ ...inp, resize: "vertical" }} rows={2} value={sc.narrationScript} onChange={e => updateScene(sc.sceneId, { narrationScript: e.target.value })} placeholder="What the narrator says during this scene…" /></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {ep && ep.scenes.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button style={btn(accent)} onClick={saveProject}>💾 Save</button>
            <button style={btn(purple)} onClick={() => setActiveTab("screenplay")}>Next: Screenplay →</button>
          </div>
        )}
      </div>
    );
  }

  // ── TAB: Screenplay ──
  function renderScreenplay() {
    return (
      <div style={{ padding: 24 }}>
        {!screenplay && !generatingScreenplay && (
          <div style={{ ...card, borderColor: `${purple}20`, marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>📄 Screenplay</p>
            <p style={{ fontSize: 11, color: muted, marginBottom: 16 }}>Generate a full formatted screenplay from your series bible, or paste your own script below and parse it into narrator/dialogue segments.</p>
            {!bible.worldDescription && !bible.lore ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Write your series bible first — go to Series Bible tab.</p>
                <button onClick={() => setActiveTab("bible")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Bible</button>
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
                    ✍️ Generate Screenplay
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

        {generatingScreenplay && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✍️</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Writing your screenplay...</p>
            <p style={{ fontSize: 11, color: muted }}>15–30 seconds</p>
          </div>
        )}

        {screenplay && !generatingScreenplay && (
          <>
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
              <button onClick={() => { const blob = new Blob([screenplay], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${seriesTitle || "screenplay"}.txt`; a.click(); }}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Download .txt
              </button>
              <button onClick={parseScript} disabled={parsingScript}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : blue, color: "#000", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
                {parsingScript ? "Parsing..." : "Parse Script"}
              </button>
              <button onClick={sendScreenplayToScenes} disabled={sendingToScenes || !activeEpisode}
                style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${gold}60` : gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes || !activeEpisode ? "default" : "pointer", opacity: !activeEpisode ? 0.4 : 1 }}>
                {sendingToScenes ? "Sending..." : "Send to Scenes →"}
              </button>
            </div>

            {sendToScenesResult && (
              <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${accent}10`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
                <span>✅</span>
                <p style={{ fontSize: 11, color: accent, flex: 1 }}>{sendToScenesResult}</p>
                <button onClick={() => setActiveTab("audio")} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Go to Audio</button>
              </div>
            )}

            {showScriptReview && scriptSegments.length > 0 && (
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Parsed Script — {scriptSegments.length} segments</p>
                  <button onClick={() => setShowScriptReview(false)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Hide</button>
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {scriptSegments.map((seg, i) => (
                    <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: seg.type === "dialogue" ? `${blue}10` : `${purple}10`, borderLeft: `3px solid ${seg.type === "dialogue" ? blue : purple}` }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: seg.type === "dialogue" ? blue : purple, textTransform: "uppercase" as const, marginRight: 8 }}>
                        {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "NARR"}
                      </span>
                      <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
              style={{ ...inp, minHeight: 400, fontFamily: "'Courier New', Courier, monospace", fontSize: 12, lineHeight: 1.8, resize: "vertical" as const, whiteSpace: "pre-wrap" as const }} />

            <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
              <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
                <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase" as const, marginBottom: 2 }}>GIO HOME AI STUDIO</p>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase" as const, letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(seriesTitle || "UNTITLED SERIES").toUpperCase()}</h1>
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
    );
  }

  // ── TAB: Audio & Music ──
  function renderAudio() {
    const allScenesList = episodes.flatMap(ep => ep.scenes);
    return (
      <div style={{ padding: 24 }}>
        {errorMsg && (
          <div style={{ ...card, borderColor: `${red}40`, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: red }}>⚠️</span>
            <p style={{ fontSize: 11, color: red, flex: 1 }}>{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>🎵 Audio & Music</h2>
            <p style={{ color: muted, fontSize: 12, margin: "4px 0 0" }}>FreeSound browser, ElevenLabs SFX, music library, per-scene narration</p>
          </div>
          <a href="/dashboard/sfx-library?selectMode=music&returnTo=series-wizard" style={{ textDecoration: "none" }}>
            <button style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${accent}30`, background: `${accent}06`, color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Import Music
            </button>
          </a>
        </div>

        {/* ── SFX Library ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>SFX Library</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["freesound", "elevenlabs"] as const).map(t => (
              <button key={t} onClick={() => setSoundTab(t)}
                style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${soundTab === t ? blue : border}`, background: soundTab === t ? `${blue}10` : "transparent", color: soundTab === t ? blue : muted, fontSize: 10, cursor: "pointer" }}>
                {t === "freesound" ? "🌐 Freesound Library" : "🎵 AI Generate SFX"}
              </button>
            ))}
          </div>

          {soundTab === "freesound" && (
            <div>
              {fsNoKey && (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: `${gold}08`, border: `1px solid ${gold}20`, marginBottom: 10 }}>
                  <p style={{ fontSize: 11, color: gold }}>Freesound API key not configured. Add FREESOUND_API_KEY to your .env file.</p>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input value={fsQuery} onChange={e => setFsQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFreesound()}
                  placeholder="Search: footsteps, rain, crowd, thunder..." style={{ ...inp, flex: 1, padding: "8px 12px", fontSize: 12 }} />
                <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                  style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: fsSearching ? "#2a2a40" : blue, color: "#000", fontSize: 11, fontWeight: 700, cursor: fsSearching ? "not-allowed" : "pointer" }}>
                  {fsSearching ? "..." : "Search"}
                </button>
              </div>
              {fsResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                  {fsResults.map(sound => (
                    <div key={sound.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, border: `1px solid ${fsSaved.has(sound.id) ? `${accent}30` : border}` }}>
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
                        style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${accent}30`, background: fsSaved.has(sound.id) ? `${accent}15` : "transparent", color: fsSaved.has(sound.id) ? accent : muted, cursor: "pointer", fontWeight: 600 }}>
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
                placeholder="e.g. Heavy footsteps on wooden floor" style={{ ...inp, marginBottom: 8 }} />
              <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()}
                style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: sfxGenerating ? "#2a2a40" : purple, color: "#fff", fontSize: 13, fontWeight: 700, cursor: sfxGenerating ? "not-allowed" : "pointer", width: "100%" }}>
                {sfxGenerating ? "Generating SFX..." : "Generate SFX"}
              </button>
              {sfxGeneratedUrl && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: `${accent}08`, border: `1px solid ${accent}20` }}>
                  <p style={{ fontSize: 11, color: accent, marginBottom: 6 }}>SFX Generated</p>
                  <audio src={sfxGeneratedUrl} controls style={{ width: "100%" }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Music Library ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>🎵 Background Music</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={aiPickMusic} disabled={aiPickingMusic}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: aiPickingMusic ? "#2a2a40" : `linear-gradient(135deg, ${gold}, #d97706)`, color: aiPickingMusic ? muted : "#000", fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
              {aiPickingMusic ? "AI Picking…" : "🤖 AI Pick"}
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
              <p style={{ fontSize: 10, color: accent, marginBottom: 4 }}>✓ {selectedMusicName}</p>
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
                    <span style={{ fontSize: 14 }}>🎵</span>
                    <span style={{ fontSize: 11, flex: 1, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</span>
                    {isSelected && <span style={{ fontSize: 10, color: purple, fontWeight: 700 }}>✓ Selected</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Series-Wide Defaults ── */}
        <div style={card}>
          <div style={lbl}>Series-Wide Defaults</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><span style={lbl}>Default Music</span><select style={inp} value={globalMusicChoice} onChange={e => setGlobalMusicChoice(e.target.value)}>{MUSIC_CHOICES.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><span style={lbl}>Default Narration</span><select style={inp} value={globalNarration} onChange={e => setGlobalNarration(e.target.value)}>{NARRATION_STYLES.map(n => <option key={n}>{n}</option>)}</select></div>
          </div>
        </div>

        {/* ── Per-episode audio ── */}
        {episodes.map(ep => (
          <div key={ep.episodeId} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#fff" }}>EP{String(ep.number).padStart(2,"0")} — {ep.title}</div>
              <span style={badge(accent)}>{ep.scenes.length} scenes</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><span style={lbl}>Music</span><select style={inp} value={ep.musicChoice} onChange={e => updateEpisode(ep.episodeId, { musicChoice: e.target.value })}>{MUSIC_CHOICES.map(m => <option key={m}>{m}</option>)}</select></div>
              <div><span style={lbl}>Narration Style</span><select style={inp} value={ep.narrationStyle} onChange={e => updateEpisode(ep.episodeId, { narrationStyle: e.target.value })}>{NARRATION_STYLES.map(n => <option key={n}>{n}</option>)}</select></div>
              <div><span style={lbl}>Audio Notes</span><input style={inp} value={ep.audioPlan} onChange={e => updateEpisode(ep.episodeId, { audioPlan: e.target.value })} placeholder="Any specific audio notes…" /></div>
            </div>
          </div>
        ))}

        {/* ── Per-scene narration (active episode) ── */}
        {allScenesList.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 14, color: muted }}>No scenes yet. Go to Scene Board to create scenes first.</p>
            <button onClick={() => setActiveTab("scenes")} style={{ ...btn(accent), marginTop: 12 }}>Go to Scenes</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8, marginTop: 8 }}>Per-Scene Narration</p>
            {allScenesList.map(sc => {
              const isNarrationOpen = narrationScene === sc.sceneId;
              return (
                <div key={sc.sceneId} style={{ ...card, borderColor: `${accent}20` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>SC{String(sc.scene).padStart(2,"0")}: {sc.title}</p>
                    <span style={{ fontSize: 10, color: muted }}>{sc.mood || ""}</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 8, color: gold, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 3 }}>Narration</p>
                      <input value={sc.narrationScript} onChange={e => updateScene(sc.sceneId, { narrationScript: e.target.value })}
                        style={{ ...inp, fontSize: 9, padding: "3px 6px" }} placeholder="Narration text..." />
                    </div>
                    <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 8, color: purple, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 3 }}>Music Style</p>
                      <input value={sc.musicStyle} onChange={e => updateScene(sc.sceneId, { musicStyle: e.target.value })}
                        style={{ ...inp, fontSize: 9, padding: "3px 6px" }} placeholder="e.g. suspense" />
                    </div>
                    <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 8, color: blue, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 3 }}>SFX</p>
                      <input value={sc.sfx} onChange={e => updateScene(sc.sceneId, { sfx: e.target.value })}
                        style={{ ...inp, fontSize: 9, padding: "3px 6px" }} placeholder="footsteps, wind" />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button onClick={async () => {
                      try {
                        const res = await fetch("/api/narration/generate", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ sceneDescription: sc.description, sceneType: sc.sceneType, mood: sc.mood, characters: sc.characterIds, sceneNumber: sc.scene }),
                        });
                        const data = await res.json();
                        if (data.narrationText) { updateScene(sc.sceneId, { narrationScript: data.narrationText }); setLastAction(`AI narration written for Scene ${sc.scene}`); }
                      } catch { /* ignore */ }
                    }}
                      style={{ flex: 1, fontSize: 9, padding: "6px 10px", borderRadius: 6, border: `1px solid ${gold}30`, background: `${gold}06`, color: gold, cursor: "pointer", fontWeight: 600 }}>
                      AI Write Narration
                    </button>
                    <button onClick={() => generateSceneNarration(sc)} disabled={!sc.narrationScript?.trim()}
                      style={{ flex: 1, fontSize: 9, padding: "6px 10px", borderRadius: 6, border: `1px solid ${accent}30`, background: `${accent}06`, color: accent, cursor: !sc.narrationScript?.trim() ? "not-allowed" : "pointer", fontWeight: 600, opacity: !sc.narrationScript?.trim() ? 0.5 : 1 }}>
                      🔊 Generate Audio
                    </button>
                  </div>

                  {sc.narrationAudioUrl && (
                    <div style={{ marginBottom: 6, padding: "6px 8px", background: `${accent}08`, borderRadius: 8, border: `1px solid ${accent}20` }}>
                      <p style={{ fontSize: 9, color: accent, marginBottom: 4, fontWeight: 700 }}>🔊 Scene {sc.scene} Audio Ready</p>
                      <audio controls src={sc.narrationAudioUrl} style={{ width: "100%", height: 28 }} />
                    </div>
                  )}

                  <button onClick={() => setNarrationScene(isNarrationOpen ? null : sc.sceneId)}
                    style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1px solid ${gold}20`, background: `${gold}04`, color: gold, fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "left" as const }}>
                    {isNarrationOpen ? "Hide Narration Controls" : "Open Narration Controls"}
                  </button>
                </div>
              );
            })}
          </>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button style={btn(accent)} onClick={saveProject}>💾 Save</button>
          <button style={btn("#ec4899")} onClick={() => setActiveTab("assembly")}>Next: Assembly →</button>
        </div>
      </div>
    );
  }

  // ── TAB: Assembly ──
  function renderAssembly() {
    const readyEps = episodes.filter(ep => ep.scenes.length > 0 && ep.scenes.some(s => sceneImages[s.sceneId]));
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>🚀 Assembly</h2>
          <p style={{ color: muted, fontSize: 12, margin: "4px 0 0" }}>Assemble individual episodes or the full season</p>
        </div>

        {/* ── Saved Cuts panel ── */}
        {savedCuts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setShowCutsPanel(p => !p)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${gold}30`, background: showCutsPanel ? `${gold}10` : `${gold}06`, color: gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <span style={{ fontSize: 16 }}>📂</span>
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
                    onClick={() => { setAssemblyName(c.name); if (c.videoUrl) setAssembledUrl(c.videoUrl); setShowCutsPanel(false); setLastAction(`Loaded cut: "${c.name}"`); }}
                    style={{ background: s2, borderRadius: 10, border: `2px solid ${assemblyName === c.name ? gold : border}`, padding: 10, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{c.videoUrl ? "🎬" : "📋"}</span>
                      <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? gold : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => { const next = prev.filter((_, i) => i !== ci); try { localStorage.setItem("ghs_series_cuts", JSON.stringify(next)); } catch {} return next; }); }}
                        style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: red, fontSize: 10, cursor: "pointer" }}>✕</button>
                    </div>
                    <p style={{ fontSize: 9, color: muted }}>{new Date(c.savedAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Cut name + Save ── */}
        <div style={{ ...card, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <span style={lbl}>Series / Cut Name</span>
              <input type="text" value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="Main Cut, Director's Cut, Season 1..."
                style={{ ...inp, fontSize: 13, fontWeight: 600 }} />
            </div>
            <button
              onClick={() => {
                if (!assemblyName.trim()) return;
                const ep = episodes.find(e => e.assembledVideoUrl);
                setSavedCuts(prev => {
                  const existing = prev.findIndex(c => c.name === assemblyName);
                  const cut = { name: assemblyName, episodeId: activeEpisodeId || "", videoUrl: ep?.assembledVideoUrl ?? undefined, savedAt: new Date().toISOString() };
                  const next = existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
                  try { localStorage.setItem("ghs_series_cuts", JSON.stringify(next)); } catch {}
                  return next;
                });
                setLastAction(`Cut "${assemblyName}" saved`);
              }}
              style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
              💾 Save Cut
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={lbl}>Assembly Readiness</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: blue }}>{readyEps.length}</div><div style={{ fontSize: 11, color: muted }}>Episodes Ready</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: gold }}>{episodes.length - readyEps.length}</div><div style={{ fontSize: 11, color: muted }}>Needs Work</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{Object.keys(sceneImages).length}</div><div style={{ fontSize: 11, color: muted }}>Scene Images</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: purple }}>{episodes.filter(e => e.assembledVideoUrl).length}</div><div style={{ fontSize: 11, color: muted }}>Assembled</div></div>
          </div>
          <ProgressBar value={episodes.length > 0 ? Math.round(readyEps.length / episodes.length * 100) : 0} color={accent} />
        </div>

        {episodes.map(ep => {
          const epImages = ep.scenes.filter(s => sceneImages[s.sceneId]).length;
          const epVideos = ep.scenes.filter(s => sceneVideos[s.sceneId]).length;
          const ready = ep.scenes.length > 0 && (epImages > 0 || epVideos > 0);
          return (
            <div key={ep.episodeId} style={{ ...card, borderColor: ready ? `${accent}44` : border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#fff", marginBottom: 4 }}>EP{String(ep.number).padStart(2,"0")} — {ep.title}</div>
                  <div style={{ fontSize: 11, color: muted }}>{ep.scenes.length} scenes · {epImages} images · {epVideos} videos · Music: {ep.musicChoice}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {ep.assembledVideoUrl && <a href={ep.assembledVideoUrl} target="_blank" rel="noreferrer" style={{ ...btn(accent), textDecoration: "none", fontSize: 11, padding: "8px 14px" }}>▶ View</a>}
                  <button style={{ ...btn(ready ? purple : "#334"), padding: "8px 14px", fontSize: 11 }} disabled={!ready || assembling} onClick={() => assembleMovie(ep.episodeId)}>
                    {assembling ? "Assembling…" : ready ? "🚀 Assemble (Video)" : "Not Ready"}
                  </button>
                  <button style={{ ...btn(ready ? blue : "#334"), padding: "8px 14px", fontSize: 11 }} disabled={!ready || assembling} onClick={() => assembleEpisode(ep.episodeId)}>
                    {assembling ? "..." : "Hybrid Assemble"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {assembledUrl && (
          <div style={{ ...card, borderColor: `${accent}66`, textAlign: "center" }}>
            <div style={lbl}>✅ Latest Assembly</div>
            <video controls src={assembledUrl} style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
            <a href={assembledUrl} download style={btn(accent)}>⬇ Download</a>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button style={btn(accent)} onClick={saveProject}>💾 Save Series</button>
        </div>
      </div>
    );
  }

  if (!mounted) return <div style={{ padding: 40, color: muted }}>Loading Series Workshop...</div>;

  return (
    <div style={{ background: s2, minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      {/* Top bar */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 16, background: surface }}>
        <div style={{ flex: 1 }}>
          <input style={{ ...inp, fontWeight: 700, fontSize: 16, border: "none", background: "transparent", padding: "4px 0" }} value={seriesTitle} onChange={e => setSeriesTitle(e.target.value)} />
          <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{genre} · {platform} · {visualStyle} · {episodes.length} episodes</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {projectList.length > 0 && (
            <select style={{ ...inp, width: "auto", fontSize: 12 }} value={projectId || ""} onChange={e => {
              if (!e.target.value) return;
              const raw = localStorage.getItem(`ghs_series_proj_${e.target.value}`);
              if (raw) { const d = JSON.parse(raw); setProjectId(d.projectId); setSeriesTitle(d.seriesTitle || "Untitled Series"); setGenre(d.genre || "Drama"); setTone(d.tone || ""); setPlatform(d.platform || "YouTube"); setVisualStyle(d.visualStyle || "Cinematic"); setTargetAudience(d.targetAudience || "General"); setBible(d.bible || mkBible()); setCharacters(d.characters || []); setEpisodes(d.episodes || []); setSceneImages(d.sceneImages || {}); setGlobalMusicChoice(d.globalMusicChoice || "soft_drama"); setGlobalNarration(d.globalNarration || "narrator"); setActiveEpisodeId(d.activeEpisodeId || null); localStorage.setItem(ACTIVE_KEY, e.target.value); }
            }}>
              {projectList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <button style={btn(accent)} onClick={saveProject} disabled={saving}>{saving ? "Saving…" : "💾 Save"}</button>
          <button style={btn("#334")} onClick={newProject}>New</button>
        </div>
      </div>

      <TabBar />

      {/* ═══ AID MODEL PICKER MODAL ═══ */}
      {showAidPicker && (() => {
        const AID_MODELS = AID_VIDEO_MODELS;
        type StyleKey = "all"|"2d"|"3d"|"cartoon"|"realistic";
        const ADVISER: Record<StyleKey, { icon:string; title:string; msg:string; cheapestId:string; bestId:string; bestLabel:string }> = {
          all:      { icon:"🤖", title:"All Models",             msg:"Showing all models sorted by price. MuAPI is 40–58% cheaper than FAL for the same quality tier.",                                                     cheapestId:"segmind_pruna_video",  bestId:"fal_kling_3_pro",        bestLabel:"Top Overall" },
          "2d":     { icon:"✏️", title:"2D / Illustration Style", msg:"Seedance 2.0 (MuAPI) is the best model for 2D flat animation — clean outlines, flat colour fills, smooth motion. Avoid Kling/Runway for 2D.",       cheapestId:"muapi_seedance_v1_pro", bestId:"muapi_seedance_v2_1080p", bestLabel:"Best 2D" },
          "3d":     { icon:"🎲", title:"3D / Cinematic Style",    msg:"Kling 2.5 Direct ★ is the best 3D model — direct API, no FAL overhead. Start with Kling 1.6 Direct for budget drafts.",                            cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_std",  bestLabel:"Best 3D Direct" },
          cartoon:  { icon:"🎨", title:"Cartoon / Animated",      msg:"Seedance 2.0 (MuAPI) at $0.08 is the best cartoon model. Hailuo Pro is the best cartoon on FAL.",                                                   cheapestId:"muapi_seedance_v1_pro", bestId:"fal_hailuo_pro",          bestLabel:"Best Cartoon" },
          realistic:{ icon:"🎬", title:"Realistic / Photorealistic",msg:"Kling 2.5 Pro Direct ★ ($0.20) is the most realistic direct API option. Kling 2.5 Direct ★ ($0.10) is best value.",                              cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_pro",  bestLabel:"Most Realistic" },
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
                      <div style={{ fontSize:10, color:"#e2d9f3", fontWeight:600 }}>{cheapestMatch?.name}</div>
                      <div style={{ fontSize:8, color:"#888" }}>${cheapestMatch?.price}/s</div>
                    </div>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #c084fc40" }}>
                      <div style={{ fontSize:8, color:"#c084fc", fontWeight:700, marginBottom:1 }}>{adviser.bestLabel.toUpperCase()}</div>
                      <div style={{ fontSize:10, color:"#e2d9f3", fontWeight:600 }}>{bestMatch?.name}</div>
                      <div style={{ fontSize:8, color:"#888" }}>${bestMatch?.price}/s</div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ overflowY:"auto", flex:1, padding:"10px 20px 16px" }}>
                {isVideo ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {filteredModels.map(m => {
                      const sel = selectedVideoModelId === m.id;
                      const nc = networkColor[m.network] || "#888";
                      return (
                        <button key={m.id} onClick={() => { setSelectedVideoModelId(m.id); setShowAidPicker(false); }}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, border:sel?`2px solid ${m.color}`:"1px solid #1e1a3a", background:sel?"#1a0a30":"#0d0d1e", cursor:"pointer", textAlign:"left" }}>
                          <div style={{ width:10, height:10, borderRadius:"50%", background:m.color, flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:sel?"#e2d9f3":"#b0a8c8", marginBottom:1 }}>{m.name}</div>
                            <div style={{ fontSize:8, color:"#5a4f80" }}>{m.res} · {m.maxSec}s max</div>
                          </div>
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            <span style={{ fontSize:8, padding:"2px 6px", borderRadius:6, background:`${nc}15`, color:nc, fontWeight:700 }}>{m.network}</span>
                            <span style={{ fontSize:9, color:"#c084fc", fontWeight:700 }}>${m.price}/s</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {AID_IMAGE_MODELS.map(m => {
                      const sel = selectedImageModelId === m.id;
                      const nc = networkColor[m.network] || "#888";
                      return (
                        <button key={m.id} onClick={() => { setSelectedImageModelId(m.id); setShowAidPicker(false); }}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, border:sel?`2px solid ${m.color}`:"1px solid #1e1a3a", background:sel?"#1a0a30":"#0d0d1e", cursor:"pointer", textAlign:"left" }}>
                          <div style={{ width:10, height:10, borderRadius:"50%", background:m.color, flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:sel?"#e2d9f3":"#b0a8c8", marginBottom:1 }}>{m.name}</div>
                            <div style={{ fontSize:8, color:"#5a4f80" }}>{m.desc}</div>
                          </div>
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            <span style={{ fontSize:8, padding:"2px 6px", borderRadius:6, background:`${nc}15`, color:nc, fontWeight:700 }}>{m.network}</span>
                            <span style={{ fontSize:9, color:"#38bdf8", fontWeight:700 }}>${m.price}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "overview"   && renderOverview()}
        {activeTab === "design"     && renderDesign()}
        {activeTab === "bible"      && renderBible()}
        {activeTab === "characters" && renderCharacters()}
        {activeTab === "episodes"   && renderEpisodes()}
        {activeTab === "scenes"     && renderScenes()}
        {activeTab === "screenplay" && renderScreenplay()}
        {activeTab === "audio"      && renderAudio()}
        {activeTab === "assembly"   && renderAssembly()}
      </div>
    </div>
  );
}
