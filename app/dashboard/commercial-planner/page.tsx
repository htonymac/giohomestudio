"use client";

import { useState, useEffect, Suspense } from "react";
import CharacterPicker from "../../components/CharacterPicker";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import type { SceneIntelligenceData } from "../../api/hybrid/scene-intelligence/route";
import AnimatedStickerPicker, { type StickerOverlay } from "../../components/AnimatedStickerPicker";
import { ds } from "../../../lib/designSystem";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { HeroTitle } from "../../components/hero/HeroTitle";
import * as Icon from "../../components/icons";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Commercial Planner — PRODUCTION WORKSHOP
// Tabs: Overview | Brief | Cast | Script & Scenes | Audio & VO | Assembly
// For ad campaigns, product promos, brand commercials — NOT narrative movies
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ──
interface CommercialCharacter {
  characterId: string;
  displayName: string;
  role: "spokesperson" | "actor" | "voiceover" | "brand_mascot" | "product";
  voiceId: string;
  imageUrl?: string;
  description: string;
  voiceType?: string; // "deep", "warm", "authoritative", "enthusiastic", "soft", "youthful"
}

interface CommercialScene {
  sceneId: string;
  scene: number;
  sceneSection: "hook" | "problem" | "solution" | "product" | "testimonial" | "cta" | "outro" | "branding";
  title: string;
  duration: number;
  description: string;
  voiceoverScript: string;
  onScreenText: string;
  characterIds: string[];
  sceneType: "video" | "image" | "image-to-video" | "text-card" | "product-shot";
  mood: string;
  cameraStyle: string;
  status: "draft" | "approved" | "generating" | "generated";
  imageUrl?: string;
}

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

interface BriefData {
  brandName: string;
  productName: string;
  tagline: string;
  objective: "awareness" | "conversion" | "retention" | "launch" | "seasonal" | "promo";
  targetAudience: string;
  keyMessage: string;
  callToAction: string;
  budget: "low" | "medium" | "premium";
  platform: string;
  format: "15s" | "30s" | "60s" | "90s" | "2min" | "custom";
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  brandColors: string;
  brandTone: "professional" | "friendly" | "luxury" | "energetic" | "emotional" | "humorous" | "authoritative" | "inspirational";
  productImages: string[];
}

type WorkshopTab = "overview" | "design" | "brief" | "cast" | "scenes" | "screenplay" | "audio" | "assembly";

const WORKSHOP_TABS: { id: WorkshopTab; label: string; step?: number }[] = [
  { id: "overview",    label: "Overview" },
  { id: "design",      label: "Brand Design",    step: 0 },
  { id: "brief",       label: "Campaign Brief",  step: 1 },
  { id: "cast",        label: "Cast & Talent",   step: 2 },
  { id: "scenes",      label: "Script & Scenes", step: 3 },
  { id: "screenplay",  label: "Screenplay",      step: 4 },
  { id: "audio",       label: "Audio & VO",      step: 5 },
  { id: "assembly",    label: "Assembly",        step: 6 },
];

const FORMATS = ["15s", "30s", "60s", "90s", "2min", "custom"];
const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Facebook", "TV", "WhatsApp", "Website", "Multi-platform"];
const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:5"];
const OBJECTIVES = ["awareness", "conversion", "retention", "launch", "seasonal", "promo"];
const BRAND_TONES = ["professional", "friendly", "luxury", "energetic", "emotional", "humorous", "authoritative", "inspirational"];
const BUDGETS = ["low", "medium", "premium"];
const SCENE_SECTIONS = ["hook", "problem", "solution", "product", "testimonial", "cta", "outro", "branding"];
const SCENE_TYPES = ["video", "image", "image-to-video", "text-card", "product-shot"];
const MUSIC_CHOICES = ["none", "upbeat_corporate", "soft_emotional", "energetic_pump", "luxury_ambient", "comedy_quirky", "afrobeat_vibe", "inspirational_rise", "dramatic_reveal"];
const VO_STYLES = ["professional_male", "professional_female", "friendly_casual", "authoritative", "warm_emotional", "enthusiastic", "luxury_calm", "local_accent"];
const VISUAL_STYLES_AD = [
  { id: "luxury",    label: "Luxury",    desc: "Premium, aspirational, clean whites/golds" },
  { id: "energetic", label: "Energetic", desc: "Bold, fast, high-contrast, youth appeal" },
  { id: "minimal",   label: "Minimal",   desc: "Clean, modern, focused on product" },
  { id: "bold",      label: "Bold",      desc: "Strong colors, big text, direct message" },
  { id: "warm",      label: "Warm",      desc: "Friendly, approachable, home/family feel" },
  { id: "corporate", label: "Corporate", desc: "Professional, trust-building, B2B" },
  { id: "fun",       label: "Fun",       desc: "Playful, colorful, lighthearted" },
  { id: "emotional", label: "Emotional", desc: "Story-driven, moving, connection-first" },
];
const PRODUCT_CATEGORIES = ["Food & Beverage", "Real Estate", "Fashion & Beauty", "Technology", "Health & Fitness", "Financial Services", "Entertainment", "Automotive", "Education", "Retail"];

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

// ── v14 style helpers (mapped to ds tokens) ──
const surface = ds.color.card;         // #151518
const s2 = ds.color.paper;             // #0e0e10
const border = ds.color.line;          // rgba(255,255,255,.06)
const muted = ds.color.mute;           // #7b7b80
const accent = ds.color.mint;          // #7ae0c3
const purple = ds.color.lilac;         // #a78bfa
const gold = ds.color.gold;            // #ffb347
const red = "#ef4444";
const blue = ds.color.sky;             // #7cc4ff
const orange = ds.color.btnC;          // #ff9a3c

const card: React.CSSProperties = { background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: 16, padding: 20, marginBottom: 12 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: ds.color.mute, marginBottom: 8, display: "block", fontFamily: ds.font.mono };
const inp: React.CSSProperties = { width: "100%", background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", fontFamily: ds.font.sans };
const btn = (_col?: string): React.CSSProperties => ({ padding: "10px 18px", borderRadius: 12, border: "none", background: "linear-gradient(120deg,#a78bfa,#d17bff,#ff9a3c,#f5a623,#a78bfa)", backgroundSize: "300% 100%", animation: "btnSweep 6s linear infinite", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const badge = (col: string): React.CSSProperties => ({ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${col}22`, color: col, fontWeight: 700, display: "inline-block" });

const SECTION_COLORS: Record<string, string> = {
  hook: "#ef4444", problem: "#f97316", solution: accent, product: blue,
  testimonial: purple, cta: gold, outro: "#ec4899", branding: "#06b6d4"
};

function defaultBrief(): BriefData {
  return { brandName: "", productName: "", tagline: "", objective: "awareness", targetAudience: "Adults 25-45", keyMessage: "", callToAction: "", budget: "medium", platform: "Instagram", format: "30s", aspectRatio: "9:16", brandColors: "", brandTone: "friendly", productImages: [] };
}

function mkScene(n: number, section: CommercialScene["sceneSection"] = "hook"): CommercialScene {
  return { sceneId: `CS${String(n).padStart(2,"0")}_${Date.now()}`, scene: n, sceneSection: section, title: `Scene ${n} — ${section}`, duration: 5, description: "", voiceoverScript: "", onScreenText: "", characterIds: [], sceneType: "video", mood: "", cameraStyle: "", status: "draft" };
}

function buildTemplateScenes(format: string): CommercialScene[] {
  const templates: Record<string, Array<{ section: CommercialScene["sceneSection"]; dur: number }>> = {
    "15s": [{ section: "hook", dur: 3 }, { section: "product", dur: 7 }, { section: "cta", dur: 5 }],
    "30s": [{ section: "hook", dur: 5 }, { section: "problem", dur: 5 }, { section: "solution", dur: 8 }, { section: "product", dur: 7 }, { section: "cta", dur: 5 }],
    "60s": [{ section: "hook", dur: 8 }, { section: "problem", dur: 8 }, { section: "solution", dur: 12 }, { section: "product", dur: 12 }, { section: "testimonial", dur: 10 }, { section: "cta", dur: 10 }],
    "90s": [{ section: "hook", dur: 8 }, { section: "problem", dur: 10 }, { section: "solution", dur: 15 }, { section: "product", dur: 18 }, { section: "testimonial", dur: 15 }, { section: "branding", dur: 8 }, { section: "cta", dur: 16 }],
  };
  const tpl = templates[format] || templates["30s"];
  return tpl.map((t, i) => ({ ...mkScene(i + 1, t.section), duration: t.dur }));
}

const LS_KEY = "ghs_commercial_planner_v1";
const PROJ_LIST_KEY = "ghs_commercial_proj_list";
const ACTIVE_KEY = "ghs_commercial_active_proj";

export default function CommercialPlannerPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: muted }}>Loading Commercial Workshop...</div>}><CommercialPlannerInner /></Suspense>;
}

function CommercialPlannerInner() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkshopTab>("overview");

  // ── Project ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Campaign");
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState("Project created");
  const [projectList, setProjectList] = useState<{id:string;title:string}[]>([]);

  // ── Design ──
  const [brandVisualStyle, setBrandVisualStyle] = useState<"luxury" | "energetic" | "minimal" | "bold" | "warm" | "corporate" | "fun" | "emotional">("minimal");
  const [productCategory, setProductCategory] = useState("");
  const [designComplete, setDesignComplete] = useState(false);
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-haiku-4-5-20251001");
  const [voiceoverText, setVoiceoverText] = useState("");

  // ── Brief ──
  const [brief, setBrief] = useState<BriefData>(defaultBrief());
  const [generatingScript, setGeneratingScript] = useState(false);
  const [extractingCast, setExtractingCast] = useState(false);

  // ── Cast ──
  const [cast, setCast] = useState<CommercialCharacter[]>([]);
  const [showCharPicker, setShowCharPicker] = useState(false);

  // ── Scenes ──
  const [scenes, setScenes] = useState<CommercialScene[]>([]);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [generatingSceneImage, setGeneratingSceneImage] = useState<string | null>(null);

  // ── Audio ──
  const [musicChoice, setMusicChoice] = useState("upbeat_corporate");
  const [voiceoverStyle, setVoiceoverStyle] = useState("professional_female");
  const [musicVolume, setMusicVolume] = useState(40);
  const [voiceoverNotes, setVoiceoverNotes] = useState("");
  const [jingleNotes, setJingleNotes] = useState("");

  // ── expandStory pipeline ──
  const [expanding, setExpanding] = useState(false);

  // ── Scene Intelligence ──
  const [sceneIntelligence, setSceneIntelligence] = useState<Record<string, SceneIntelligenceData>>({});
  const [runningIntelligence, setRunningIntelligence] = useState(false);

  // ── Scene Videos (SSE streaming) ──
  const [sceneVideos, setSceneVideos] = useState<Record<string, string>>({});
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

  // ── Music library picker ──
  interface MusicAsset { id: string; name: string; filePath: string; source: string; tags: string[] }
  const [musicLibrary, setMusicLibrary] = useState<MusicAsset[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusicUrl, setSelectedMusicUrl] = useState<string | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState("");
  const [aiPickingMusic, setAiPickingMusic] = useState(false);
  const [aiMusicPickLog, setAiMusicPickLog] = useState("");

  // ── Assembly ──
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  const [assemblySelectedIds, setAssemblySelectedIds] = useState<string[]>([]);

  // ── Color swatches ──
  const [brandSwatches, setBrandSwatches] = useState<string[]>(["#FF4500"]);

  // ── Product image upload ──
  const [uploadingProductImage, setUploadingProductImage] = useState(false);

  // ── Per-scene model overrides ──
  const [sceneImageModels, setSceneImageModels] = useState<Record<string, string>>({});
  const [sceneVideoModels, setSceneVideoModels] = useState<Record<string, string>>({});

  // ── AID model picker ──
  const [selectedVideoModelId, setSelectedVideoModelId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ghs_commercial_planner_video_model") || "fal_wan_lite";
    }
    return "fal_wan_lite";
  });
  const [selectedImageModelId, setSelectedImageModelId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ghs_commercial_planner_image_model") || "fal_flux_schnell";
    }
    return "fal_flux_schnell";
  });
  const [transparentBg, setTransparentBg] = useState(false);
  const [aiTier, setAiTier] = useState<AITier>("standard");
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

  // ── Sticker overlays ──
  const [commStickers, setCommStickers] = useState<StickerOverlay[]>([]);
  const [showStickerPanel, setShowStickerPanel] = useState(false);

  // ── Assembly named cuts ──
  const [assemblyName, setAssemblyName] = useState("Final Cut");
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; videoUrl?: string; savedAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("ghs_commercial_cuts") || "[]"); } catch { return []; }
  });
  const [showCutsPanel, setShowCutsPanel] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const list = JSON.parse(localStorage.getItem(PROJ_LIST_KEY) || "[]");
      setProjectList(list);
      const activeId = localStorage.getItem(ACTIVE_KEY);
      const raw = activeId ? localStorage.getItem(`ghs_comm_proj_${activeId}`) : localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.projectId) setProjectId(d.projectId);
        if (d.projectTitle) setProjectTitle(d.projectTitle);
        if (d.brief) setBrief(d.brief);
        if (d.cast) setCast(d.cast);
        if (d.scenes) setScenes(d.scenes);
        if (d.sceneImages) setSceneImages(d.sceneImages);
        if (d.musicChoice) setMusicChoice(d.musicChoice);
        if (d.voiceoverStyle) setVoiceoverStyle(d.voiceoverStyle);
        if (d.musicVolume != null) setMusicVolume(d.musicVolume);
        if (d.voiceoverNotes) setVoiceoverNotes(d.voiceoverNotes);
        if (d.brandVisualStyle) setBrandVisualStyle(d.brandVisualStyle);
        if (d.productCategory) setProductCategory(d.productCategory);
        if (d.designComplete != null) setDesignComplete(d.designComplete);
        if (d.storyAiProvider) setStoryAiProvider(d.storyAiProvider);
        if (d.voiceoverText) setVoiceoverText(d.voiceoverText);
        // Restore swatches from brandColors
        if (d.brief?.brandColors) {
          const saved = d.brief.brandColors.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (saved.length > 0) setBrandSwatches(saved);
        }
      }
      // Restore model preferences
      const savedImgModel = localStorage.getItem("ghs_commercial_planner_image_model");
      const savedVidModel = localStorage.getItem("ghs_commercial_planner_video_model");
      if (savedImgModel) setSelectedImageModelId(savedImgModel);
      if (savedVidModel) setSelectedVideoModelId(savedVidModel);
    } catch {}
  }, []);

  // Persist model selections to localStorage when changed
  useEffect(() => {
    if (mounted) localStorage.setItem("ghs_commercial_planner_image_model", selectedImageModelId);
  }, [selectedImageModelId, mounted]);
  useEffect(() => {
    if (mounted) localStorage.setItem("ghs_commercial_planner_video_model", selectedVideoModelId);
  }, [selectedVideoModelId, mounted]);

  function saveLocal() {
    if (!mounted) return;
    const id = projectId || `comm_${Date.now()}`;
    if (!projectId) setProjectId(id);
    const data = { projectId: id, projectTitle, brief, cast, scenes, sceneImages, musicChoice, voiceoverStyle, musicVolume, voiceoverNotes, jingleNotes, brandVisualStyle, productCategory, designComplete, storyAiProvider, voiceoverText, savedAt: new Date().toISOString() };
    localStorage.setItem(`ghs_comm_proj_${id}`, JSON.stringify(data));
    localStorage.setItem(ACTIVE_KEY, id);
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    setProjectList(prev => {
      const exists = prev.find(p => p.id === id);
      const updated = exists ? prev.map(p => p.id === id ? { ...p, title: projectTitle } : p) : [{ id, title: projectTitle }, ...prev];
      localStorage.setItem(PROJ_LIST_KEY, JSON.stringify(updated));
      return updated;
    });
    setLastAction(`Saved — ${new Date().toLocaleTimeString()}`);
    return id;
  }

  async function saveProject() {
    setSaving(true);
    saveLocal();
    setSaving(false);
  }

  function newProject() {
    saveLocal();
    setProjectId(null); setProjectTitle("Untitled Campaign"); setBrief(defaultBrief()); setCast([]); setScenes([]); setSceneImages({}); setMusicChoice("upbeat_corporate"); setVoiceoverStyle("professional_female"); setMusicVolume(40); setVoiceoverNotes(""); setAssembledUrl(null); setLastAction("New campaign");
  }

  function applyTemplate() {
    const tplScenes = buildTemplateScenes(brief.format);
    setScenes(tplScenes);
    setLastAction(`Template applied: ${brief.format} ${brief.format !== "custom" ? "commercial" : ""}`);
  }

  function updateScene(sceneId: string, updates: Partial<CommercialScene>) {
    setScenes(prev => prev.map(s => s.sceneId === sceneId ? { ...s, ...updates } : s));
  }

  async function generateAIScript() {
    if (!brief.brandName || !brief.productName) { setLastAction("Fill in brand name and product name first"); return; }
    setGeneratingScript(true);
    setLastAction("AI is writing your commercial script...");
    try {
      const manifest = `${brief.format} commercial for ${brief.brandName} — ${brief.productName}. Brand tone: ${brief.brandTone}. Visual style: ${brandVisualStyle}. Platform: ${brief.platform}. Objective: ${brief.objective}. Target: ${brief.targetAudience}. Key message: ${brief.keyMessage}. CTA: ${brief.callToAction}.`;
      const res = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: manifest,
          genre: "commercial",
          tone: brief.brandTone,
          audience: brief.targetAudience,
          language: "English",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          commercialContext: {
            format: brief.format,
            platform: brief.platform,
            objective: brief.objective,
            brandColors: brief.brandColors,
            brandVisualStyle,
            productCategory,
            callToAction: brief.callToAction,
          },
        }),
      });
      const d = await res.json();
      if (d.expandedStory || d.summary) {
        const summary = (d.expandedStory?.summary || d.summary || "").toString();
        setVoiceoverText(summary);
        const lines = summary.split(/[.!?]+/).filter(Boolean).map((s: string) => s.trim());
        setScenes(prev => {
          const base = prev.length === 0 ? buildTemplateScenes(brief.format) : prev;
          return base.map((s, i) => ({
            ...s,
            voiceoverScript: lines[i] ? lines[i] + "." : s.voiceoverScript,
          }));
        });
        setLastAction("AI script generated — review scenes");
      }
    } catch { setLastAction("Script generation failed"); }
    setGeneratingScript(false);
  }

  async function extractCastFromScript() {
    const scriptText = voiceoverText || scenes.map(s => s.voiceoverScript).join(" ");
    if (!scriptText.trim()) { setLastAction("Generate script first"); return; }
    setExtractingCast(true);
    setLastAction("Detecting cast from script...");
    try {
      const res = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: scriptText, characterList: [] },
          language: "English",
        }),
      });
      const data = await res.json();
      const detected = (data.characters || []) as Array<{ name: string; description?: string; role?: string }>;
      if (detected.length > 0) {
        const newCast = detected
          .filter(d => !cast.some(c => c.displayName.toLowerCase() === d.name.toLowerCase()))
          .map((d, i): CommercialCharacter => ({
            characterId: `CC${String(cast.length + i + 1).padStart(2, "0")}`,
            displayName: d.name,
            role: "actor" as const,
            voiceId: "",
            description: d.description || "",
            voiceType: "mid",
          }));
        setCast(prev => [...prev, ...newCast]);
        setLastAction(`${newCast.length} cast members detected`);
      } else {
        setLastAction("No cast detected — add manually in Cast tab");
      }
    } catch { setLastAction("Cast detection failed"); }
    setExtractingCast(false);
  }

  async function makeSceneImage(scene: CommercialScene) {
    setGeneratingSceneImage(scene.sceneId);
    try {
      const charRefs = cast.filter(c => scene.characterIds.includes(c.characterId)).map(c => `${c.displayName}: ${c.description}`).join(", ");
      const prompt = `Commercial scene for ${brief.brandName}. ${brief.productName} — ${brief.tagline}. Scene: ${scene.title}. ${scene.description}. Brand tone: ${brief.brandTone}. Style: ${scene.cameraStyle || "clean commercial photography"}.${charRefs ? ` Characters: ${charRefs}.` : ""} Professional ${brief.budget === "premium" ? "cinematic" : "clean"} advertising style.`;
      const useTransparent = transparentBg && selectedImageModelId.includes("ideogram_v3");
      const sceneImgModel = sceneImageModels[scene.sceneId] || (useTransparent ? "fal_ideogram_v3_transparent" : selectedImageModelId);
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: brief.budget === "premium" ? "cinematic-premium" : "clean-commercial",
          sceneType: scene.sceneType === "video" ? "video-led" : "image-led",
          modelId: sceneImgModel,
          transparentBg: useTransparent,
          productImages: (brief.productImages || []).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (d.imageUrl) {
        setSceneImages(prev => ({ ...prev, [scene.sceneId]: d.imageUrl }));
        updateScene(scene.sceneId, { status: "generated" });
        setLastAction(`Scene ${scene.scene} image generated`);
      }
    } catch { setLastAction("Image generation failed"); }
    setGeneratingSceneImage(null);
  }

  async function assembleCommercial() {
    setAssembling(true);
    const sceneList = scenes.map(s => ({ sceneId: s.sceneId, imageUrl: sceneImages[s.sceneId] || "", narration: s.voiceoverScript, duration: s.duration, onScreenText: s.onScreenText, musicStyle: musicChoice }));
    try {
      const res = await fetch("/api/hybrid/assemble", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, scenes: sceneList, music: musicChoice, narrationStyle: voiceoverStyle, title: `${brief.brandName} — ${brief.productName} ${brief.format}` }) });
      const d = await res.json();
      if (d.outputUrl) { setAssembledUrl(d.outputUrl); setLastAction("Commercial assembled"); }
    } catch { setLastAction("Assembly failed"); }
    setAssembling(false);
  }

  // ── Screenplay functions ──
  async function generateScreenplay() {
    const source = voiceoverText || brief.keyMessage || brief.tagline;
    if (!source.trim() && !brief.brandName.trim()) { setScreenplayError("Fill in your campaign brief first."); return; }
    setGeneratingScreenplay(true);
    setScreenplayError("");
    try {
      const res = await fetch("/api/hybrid/screenplay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${brief.brandName} — ${brief.productName}`,
          summary: voiceoverText || `${brief.keyMessage}. ${brief.tagline}. CTA: ${brief.callToAction}`,
          scenes: scenes.map(s => ({ scene: s.scene, title: s.title, description: s.description })),
          genre: "commercial",
          tone: brief.brandTone,
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

  async function parseScript() {
    const textToParse = screenplay || voiceoverText || brief.keyMessage;
    if (!textToParse.trim()) { setScreenplayError("Write or generate screenplay first."); return; }
    setParsingScript(true);
    try {
      const res = await fetch("/api/hybrid/parse-script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToParse,
          knownCharacters: cast.map(c => c.displayName),
        }),
      });
      const data = await res.json();
      if (data.ok && data.segments) {
        setScriptSegments(data.segments);
        setShowScriptReview(true);
        setLastAction(`Script parsed — ${data.segments.length} segments`);
      } else {
        setScreenplayError(data.error || "Script parsing failed");
      }
    } catch (err) {
      setScreenplayError("Script parse error: " + String(err));
    }
    setParsingScript(false);
  }

  async function sendScreenplayToScenes() {
    if (!screenplay) return;
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
      const scene = scenes.find(s => s.scene === block.sceneNum);
      if (scene) {
        const voText = block.lines.filter(l => l && !/^[A-Z][A-Z\s\-'().]+$/.test(l) && !l.startsWith("(")).join(" ");
        updateScene(scene.sceneId, { voiceoverScript: voText });
      }
    });
    setSendToScenesResult(`Screenplay sent to ${sceneBlocks.length} scenes. Go to Audio to generate voiceover.`);
    setSendingToScenes(false);
    await parseScript();
  }

  // ── expandStory pipeline ──
  async function expandStory() {
    const storyInput = brief.keyMessage || brief.tagline || `${brief.brandName} ${brief.productName} commercial`;
    if (!storyInput.trim()) { setLastAction("Fill in key message or brief first"); return; }
    setExpanding(true);
    setLastAction("AI is expanding your campaign concept...");
    try {
      const manifest = `${brief.format} commercial for ${brief.brandName} — ${brief.productName}. ${storyInput}. Brand tone: ${brief.brandTone}. Objective: ${brief.objective}.`;
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: manifest, genre: "commercial", tone: brief.brandTone,
          audience: brief.targetAudience, language: "English",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
        }),
      });
      const expandData = await expandRes.json();
      const summary = expandData.expandedStory?.summary || expandData.summary || "";
      if (summary) setVoiceoverText(summary);

      const charRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expandedStory: { summary, characterList: [] }, language: "English" }),
      });
      const charData = await charRes.json();
      const detected = (charData.characters || []) as Array<{ name: string; description?: string }>;
      if (detected.length > 0) {
        const newCast = detected.filter(d => !cast.some(c => c.displayName.toLowerCase() === d.name.toLowerCase())).map((d, i): CommercialCharacter => ({
          characterId: `CC${String(cast.length + i + 1).padStart(2, "0")}`,
          displayName: d.name, role: "actor" as const, voiceId: "",
          description: d.description || "", voiceType: "mid",
        }));
        if (newCast.length > 0) setCast(prev => [...prev, ...newCast]);
      }

      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expandedStory: { summary, fullScript: summary }, genre: "commercial", format: brief.format }),
      });
      const sceneData = await sceneRes.json();
      const planned = sceneData.scenes as Array<{ title?: string; description?: string; visualDescription?: string; dialogue?: string }> | undefined;
      if (planned && planned.length > 0) {
        const base = scenes.length === 0 ? buildTemplateScenes(brief.format) : scenes;
        setScenes(base.map((s, i) => ({
          ...s,
          title: planned[i]?.title || s.title,
          description: planned[i]?.description || planned[i]?.visualDescription || s.description,
          voiceoverScript: planned[i]?.dialogue || s.voiceoverScript,
        })));
      } else if (summary && scenes.length === 0) {
        const tplScenes = buildTemplateScenes(brief.format);
        const lines = summary.split(/[.!?]+/).filter(Boolean).map((l: string) => l.trim());
        setScenes(tplScenes.map((s, i) => ({ ...s, voiceoverScript: lines[i] ? lines[i] + "." : s.voiceoverScript })));
      }
      setLastAction("AI expansion complete — review Brief, Cast, and Scenes");
      // auto-run scene intelligence after planning
      setTimeout(() => runSceneIntelligence(), 500);
    } catch { setLastAction("AI expansion failed — try again"); }
    setExpanding(false);
  }

  async function runSceneIntelligence() {
    if (scenes.length === 0) return;
    setRunningIntelligence(true);
    try {
      const res = await fetch("/api/hybrid/scene-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenes.map(s => ({
            sceneId: s.sceneId,
            title: s.title,
            description: s.description,
            location: s.cameraStyle,
            timeOfDay: "",
            mood: s.mood,
          })),
          storyContext: brief.keyMessage || brief.tagline || `${brief.brandName} ${brief.productName} commercial`,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.intelligence)) {
        const map: Record<string, SceneIntelligenceData> = {};
        for (const item of data.intelligence) map[item.sceneId] = item;
        setSceneIntelligence(map);
        setScenes(prev => prev.map(s => {
          const intel = map[s.sceneId];
          if (!intel) return s;
          return {
            ...s,
            mood: s.mood || intel.energyLevel,
            cameraStyle: s.cameraStyle || intel.environmentType.replace(/-/g, " "),
          };
        }));
      }
    } catch (err) {
      console.warn("Scene intelligence failed:", err);
    }
    setRunningIntelligence(false);
  }

  // ── makeSceneVideo (SSE streaming) ──
  async function makeSceneVideo(scene: CommercialScene) {
    const sceneId = scene.sceneId;
    const existingImage = sceneImages[sceneId];
    if (!existingImage) { setLastAction(`Scene ${scene.scene} needs an image first`); return; }
    setGeneratingSceneVideos(prev => new Set(prev).add(sceneId));
    setSceneGenProgress(prev => ({ ...prev, [sceneId]: { percent: 2, message: "Connecting..." } }));
    setLastAction(`Generating video for Scene ${scene.scene}...`);
    try {
      const response = await fetch("/api/hybrid/scene-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, projectId, sceneText: `${scene.title}. ${scene.description}`, imageUrl: existingImage, duration: scene.duration, motionDescription: scene.cameraStyle || "", modelId: sceneVideoModels[sceneId] || selectedVideoModelId }),
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
              updateScene(sceneId, { status: "generated" });
              setLastAction(`Scene ${scene.scene} video ready`);
            } else if (evt.type === "error") {
              setSceneGenProgress(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
              setLastAction(`Video failed: ${evt.message as string}`);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch { setLastAction(`Video generation failed for Scene ${scene.scene}`); }
    setGeneratingSceneVideos(prev => { const s = new Set(prev); s.delete(sceneId); return s; });
  }

  // ── assembleMovie ──
  async function assembleMovie() {
    setAssembling(true);
    setAssemblyComplete(false);
    const ids = assemblySelectedIds.length > 0 ? assemblySelectedIds : scenes.map(s => s.sceneId);
    const selectedScenes = scenes.filter(s => ids.includes(s.sceneId));
    const assemblyScenes: Array<{ scene: number; videoUrl: string }> = [];
    for (const s of selectedScenes) {
      const videoUrl = sceneVideos[s.sceneId];
      const imageUrl = sceneImages[s.sceneId];
      if (videoUrl) assemblyScenes.push({ scene: s.scene, videoUrl });
      else if (imageUrl) assemblyScenes.push({ scene: s.scene, videoUrl: `img:${imageUrl}` });
    }
    if (assemblyScenes.length === 0) { setLastAction("No scenes have video or images yet"); setAssembling(false); return; }
    try {
      const res = await fetch("/api/video/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: `${brief.brandName} — ${brief.productName} ${brief.format}`, scenes: assemblyScenes, stickers: commStickers.length > 0 ? commStickers : undefined }),
      });
      const data = await res.json();
      if (data.outputUrl) { setAssembledUrl(data.outputUrl); setAssemblyComplete(true); setLastAction("Commercial assembled"); }
      else setLastAction(data.error || "Assembly failed");
    } catch { setLastAction("Assembly failed"); }
    setAssembling(false);
  }

  // ── FreeSound search / save ──
  async function searchFreesound(q?: string) {
    const query = q ?? fsQuery;
    if (!query.trim()) return;
    setFsSearching(true); setFsResults([]);
    try {
      const res = await fetch(`/api/sfx/freesound?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.noKey) { setFsNoKey(true); return; }
      setFsNoKey(false); setFsResults(data.results || []);
    } catch { setLastAction("Freesound search failed"); }
    finally { setFsSearching(false); }
  }

  async function saveFreesound(sound: { id: number; name: string; previewUrl: string; license: string; username: string; duration: number; tags: string[] }) {
    setFsSaving(sound.id);
    try {
      const res = await fetch("/api/sfx/freesound", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sound) });
      const data = await res.json();
      if (data.ok) { setFsSaved(prev => new Set([...prev, sound.id])); setLastAction(`"${sound.name}" saved to SFX library`); }
    } catch { /* ignore */ }
    finally { setFsSaving(null); }
  }

  async function generateElevenLabsSfx() {
    if (!sfxDesc.trim()) return;
    setSfxGenerating(true); setSfxGeneratedUrl(null);
    try {
      const res = await fetch("/api/sfx/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: sfxDesc.trim() }) });
      const data = await res.json();
      if (data.fileUrl) { setSfxGeneratedUrl(data.fileUrl); setLastAction(`SFX generated: "${sfxDesc.slice(0, 30)}"`); }
      else setLastAction(data.error || "SFX generation failed");
    } catch { setLastAction("SFX generation failed"); }
    finally { setSfxGenerating(false); }
  }

  // ── Music library ──
  async function loadMusicLibrary() {
    setLoadingMusic(true);
    try {
      const res = await fetch("/api/assets?type=music");
      const data = await res.json();
      setMusicLibrary((data.assets || data || []).filter((a: MusicAsset) => a.filePath || a.id));
    } catch { /* best effort */ }
    setLoadingMusic(false);
  }

  async function aiPickMusic() {
    setAiPickingMusic(true); setAiMusicPickLog("Loading music library...");
    try {
      let tracks = musicLibrary;
      if (tracks.length === 0) {
        const res = await fetch("/api/assets?type=music");
        const data = await res.json();
        tracks = (data.assets || data || []).filter((a: MusicAsset) => a.filePath || a.id);
        setMusicLibrary(tracks);
      }
      if (tracks.length === 0) { setAiMusicPickLog("No music in library. Add tracks first."); setAiPickingMusic(false); return; }
      const storyContext = voiceoverText || `${brief.brandName} ${brief.productName} ${brief.brandTone} commercial`;
      const trackList = tracks.map((t, i) => `${i + 1}. "${t.name}"${t.tags?.length ? ` [${t.tags.slice(0, 4).join(", ")}]` : ""}`).join("\n");
      setAiMusicPickLog("Asking AI to pick best track...");
      const llmRes = await fetch("/api/llm/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Pick best music for a ${brief.brandTone} ${brief.format} commercial for ${brief.brandName}.\n\nTRACKS:\n${trackList}\n\nReply JSON only: {"trackNumber": 1, "trackName": "name", "reason": "why"}`, role: "quality", maxTokens: 200 }),
      });
      const llmData = await llmRes.json();
      const raw = (llmData.text || llmData.response || "").trim();
      let picked: { trackNumber?: number; trackName?: string; reason?: string } = {};
      try { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); if (s !== -1 && e > s) picked = JSON.parse(raw.slice(s, e + 1)); } catch { /* ignore */ }
      const match = tracks.find(t => t.name.toLowerCase() === (picked.trackName || "").toLowerCase()) || (picked.trackNumber ? tracks[picked.trackNumber - 1] : null);
      if (match) { setSelectedMusicUrl(`/api/media/${match.filePath}`); setSelectedMusicName(match.name); setAiMusicPickLog(`Selected: "${match.name}"${picked.reason ? ` — ${picked.reason}` : ""}`); }
      else setAiMusicPickLog(`AI pick failed: ${raw.slice(0, 80)}`);
    } catch (err) { setAiMusicPickLog(`AI pick failed: ${err instanceof Error ? err.message : String(err)}`); }
    setAiPickingMusic(false);
  }

  // ── Progress ──
  const briefProgress = [brief.brandName, brief.productName, brief.keyMessage, brief.callToAction].filter(Boolean).length * 25;
  const sceneProgress = scenes.length > 0 ? Math.round(scenes.filter(s => s.description).length / scenes.length * 100) : 0;
  const imageProgress = scenes.length > 0 ? Math.round(Object.keys(sceneImages).length / scenes.length * 100) : 0;
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  const warnings: string[] = [];
  if (!brief.brandName) warnings.push("No brand name in brief");
  if (!brief.productName) warnings.push("No product name");
  if (!brief.callToAction) warnings.push("No call-to-action defined");
  if (scenes.length === 0) warnings.push("No scenes planned — apply a template");
  if (scenes.some(s => !s.voiceoverScript)) warnings.push("Some scenes missing voiceover script");

  function ProgressBar({ value, color = accent }: { value: number; color?: string }) {
    return <div style={{ height: 6, background: border, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 4, transition: "width 0.5s" }} /></div>;
  }

  function TabBar() {
    return (
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${ds.color.line}`, background: ds.color.paper, overflowX: "auto" }}>
        {WORKSHOP_TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "13px 18px", background: "none", border: "none", color: active ? ds.color.ink : ds.color.mute, fontWeight: 700, fontSize: 10, fontFamily: ds.font.mono, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", borderBottom: active ? "2px solid transparent" : "2px solid transparent", backgroundImage: active ? "none" : "none", position: "relative", whiteSpace: "nowrap", transition: "color .18s" }}>
              {active && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#a78bfa,#d17bff,#ff9a3c,#f5a623)", borderRadius: "2px 2px 0 0" }} />}
              {t.label}
              {t.step != null && <span style={{ marginLeft: 6, fontSize: 9, background: `${ds.color.lilac}22`, color: ds.color.lilac, borderRadius: 10, padding: "1px 6px", fontFamily: ds.font.mono }}>{t.step}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // ── TAB: Design ──
  function renderDesign() {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Brand Design</h2>
        <p style={{ color: ds.color.mute, fontSize: 13, margin: "0 0 20px" }}>Define the visual identity. Guides AI script generation, scenes, and assembly.</p>

        <div style={card}>
          <span style={lbl}>Campaign Name</span>
          <input style={inp} value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="e.g. FreshBrew Summer Campaign 2026" />
        </div>

        <div style={card}>
          <span style={lbl}>Product Category</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRODUCT_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setProductCategory(cat === productCategory ? "" : cat)}
                style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${productCategory === cat ? orange : border}`, background: productCategory === cat ? `${orange}20` : "transparent", color: productCategory === cat ? orange : muted, fontSize: 11, cursor: "pointer" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <span style={lbl}>Visual Style</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {VISUAL_STYLES_AD.map(v => (
              <div key={v.id} onClick={() => setBrandVisualStyle(v.id as typeof brandVisualStyle)}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${brandVisualStyle === v.id ? orange : border}`, background: brandVisualStyle === v.id ? `${orange}15` : s2, cursor: "pointer" }}>
                <div style={{ color: brandVisualStyle === v.id ? orange : "#fff", fontWeight: 700, fontSize: 12 }}>{v.label}</div>
                <div style={{ color: muted, fontSize: 10, marginTop: 2 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={card}>
            <span style={lbl}>Ad Format</span>
            <select style={inp} value={brief.format} onChange={e => setBrief(prev => ({ ...prev, format: e.target.value as BriefData["format"] }))}>
              {FORMATS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div style={card}>
            <span style={lbl}>Platform</span>
            <select style={inp} value={brief.platform} onChange={e => setBrief(prev => ({ ...prev, platform: e.target.value }))}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={card}>
          <span style={lbl}>AI Intelligence Tier</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {[
              { value: "ollama",                           label: "Local LLM",  sub: "Ollama · Free · No cloud cost",                    color: accent, badge: "FREE" },
              { value: "claude:claude-haiku-4-5-20251001", label: "Standard",   sub: "Claude Haiku 4.5 · Fast · Low cost",               color: blue,   badge: "FAST" },
              { value: "claude:claude-sonnet-4-6",         label: "Pro",        sub: "Claude Sonnet 4.6 · Best balance · Recommended",   color: purple, badge: "REC" },
              { value: "claude:claude-opus-4-7",           label: "Premium",    sub: "Claude Opus 4.7 · Highest quality · Most powerful",color: gold,   badge: "TOP" },
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
          <ButtonPrimary size="sm" onClick={() => { setDesignComplete(true); setActiveTab("brief"); setLastAction("Brand design set — fill campaign brief"); }}>
            Confirm Design — Campaign Brief
          </ButtonPrimary>
        </div>
      </div>
    );
  }

  // ── TAB: Overview ──
  function renderOverview() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Scenes", value: scenes.length, color: blue },
            { label: "Duration", value: `${totalDuration}s`, color: gold },
            { label: "Cast", value: cast.length, color: purple },
            { label: "Images", value: Object.keys(sceneImages).length, color: accent },
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
              { label: "Brief", val: briefProgress, color: orange },
              { label: "Script & Scenes", val: sceneProgress, color: blue },
              { label: "Scene Images", val: imageProgress, color: accent },
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
            <div style={lbl}>Campaign Summary</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{brief.brandName || "—"}</div>
              <div style={{ color: muted, fontSize: 12 }}>{brief.productName}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={badge(orange)}>{brief.format}</span>
              <span style={badge(blue)}>{brief.platform}</span>
              <span style={badge(purple)}>{brief.aspectRatio}</span>
              <span style={badge(gold)}>{brief.objective}</span>
              <span style={badge(muted)}>{brief.brandTone}</span>
            </div>
            {brief.tagline && <div style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>"{brief.tagline}"</div>}
            {brief.callToAction && <div style={{ fontSize: 12, color: accent, marginTop: 6 }}>CTA: {brief.callToAction}</div>}
          </div>
        </div>

        {warnings.length > 0 && (
          <div style={{ ...card, borderColor: `${red}44` }}>
            <div style={lbl}>Warnings</div>
            {warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: ds.color.ink2, padding: "6px 0", borderBottom: i < warnings.length - 1 ? `1px solid ${ds.color.line}` : "none" }}>{w}</div>
            ))}
          </div>
        )}

        <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ButtonPrimary size="sm" onClick={() => setActiveTab("design")}>Brand Design</ButtonPrimary>
          <ButtonPrimary size="sm" onClick={() => setActiveTab("brief")}>Campaign Brief</ButtonPrimary>
          <ButtonPrimary size="sm" onClick={saveProject} disabled={saving}>{saving ? "Saving…" : "Save"}</ButtonPrimary>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => { applyTemplate(); setActiveTab("scenes"); }}>Apply Template</button>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={newProject}>New Campaign</button>
          <span style={{ fontSize: 11, color: ds.color.mute, marginLeft: "auto" }}>Last: {lastAction}</span>
        </div>
      </div>
    );
  }

  // ── TAB: Brief ──
  function renderBrief() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Campaign Brief</h2>
            <p style={{ color: ds.color.mute, fontSize: 13, margin: "4px 0 0" }}>Define brand, product, audience, and commercial goals</p>
          </div>
          <ButtonPrimary size="sm" onClick={saveProject}>Save</ButtonPrimary>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={lbl}>Brand & Product</div>
            <div style={{ marginBottom: 10 }}><span style={lbl}>Brand Name</span><input style={inp} value={brief.brandName} onChange={e => setBrief(p => ({ ...p, brandName: e.target.value }))} placeholder="e.g. FreshBrew Coffee" /></div>
            <div style={{ marginBottom: 10 }}><span style={lbl}>Product / Service Name</span><input style={inp} value={brief.productName} onChange={e => setBrief(p => ({ ...p, productName: e.target.value }))} placeholder="e.g. FreshBrew Bold Blend" /></div>
            <div style={{ marginBottom: 10 }}><span style={lbl}>Tagline</span><input style={inp} value={brief.tagline} onChange={e => setBrief(p => ({ ...p, tagline: e.target.value }))} placeholder="e.g. Wake up to something bold" /></div>

            {/* ── Product Images ── */}
            <div style={{ marginBottom: 10 }}>
              <span style={lbl}>Product Images</span>
              <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Upload product shots used as reference in scene generation</p>
              {(brief.productImages || []).length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {(brief.productImages || []).map((url, idx) => (
                    <div key={idx} style={{ position: "relative", width: 72, height: 72 }}>
                      <img src={url} alt={`product-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${border}` }} />
                      <button
                        onClick={() => setBrief(p => ({ ...p, productImages: (p.productImages || []).filter((_, i) => i !== idx) }))}
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: red, border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px dashed ${border}`, background: ds.color.paper, color: muted, fontSize: 12, cursor: uploadingProductImage ? "not-allowed" : "pointer" }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  style={{ display: "none" }}
                  disabled={uploadingProductImage}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingProductImage(true);
                    try {
                      for (const file of files) {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
                        const d = await res.json();
                        if (d.filePath) {
                          const cleaned = d.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
                          const mediaUrl = `/api/media/${cleaned}`;
                          setBrief(p => ({ ...p, productImages: [...(p.productImages || []), mediaUrl] }));
                        }
                      }
                    } catch { setLastAction("Product image upload failed"); }
                    setUploadingProductImage(false);
                    e.target.value = "";
                  }}
                />
                {uploadingProductImage ? "Uploading…" : "+ Add Product Image"}
              </label>
            </div>

            {/* ── Brand Colors (swatches) ── */}
            <div>
              <span style={lbl}>Brand Colors</span>
              {/* Swatch preview row */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {brandSwatches.map((col, idx) => (
                  <div key={idx} style={{ width: 32, height: 32, borderRadius: 8, background: col, border: `2px solid ${border}`, flexShrink: 0 }} title={col} />
                ))}
              </div>
              {/* Color pickers */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {brandSwatches.map((col, idx) => (
                  <div key={idx} style={{ position: "relative" }}>
                    <input
                      type="color"
                      value={col}
                      onChange={e => {
                        const updated = brandSwatches.map((c, i) => i === idx ? e.target.value : c);
                        setBrandSwatches(updated);
                        setBrief(p => ({ ...p, brandColors: updated.join(", ") }));
                      }}
                      style={{ width: 36, height: 36, padding: 2, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", cursor: "pointer" }}
                      title={col}
                    />
                    {brandSwatches.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = brandSwatches.filter((_, i) => i !== idx);
                          setBrandSwatches(updated);
                          setBrief(p => ({ ...p, brandColors: updated.join(", ") }));
                        }}
                        style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: red, border: "none", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    )}
                  </div>
                ))}
                {brandSwatches.length < 8 && (
                  <button
                    onClick={() => {
                      const updated = [...brandSwatches, "#ffffff"];
                      setBrandSwatches(updated);
                      setBrief(p => ({ ...p, brandColors: updated.join(", ") }));
                    }}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px dashed ${border}`, background: "transparent", color: muted, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="Add color"
                  >+</button>
                )}
              </div>
              <p style={{ fontSize: 10, color: muted, marginTop: 6 }}>{brief.brandColors || "No colors set"}</p>
            </div>
          </div>

          <div style={card}>
            <div style={lbl}>Campaign Objective</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><span style={lbl}>Objective</span><select style={inp} value={brief.objective} onChange={e => setBrief(p => ({ ...p, objective: e.target.value as BriefData["objective"] }))}>{OBJECTIVES.map(o => <option key={o}>{o}</option>)}</select></div>
              <div><span style={lbl}>Brand Tone</span><select style={inp} value={brief.brandTone} onChange={e => setBrief(p => ({ ...p, brandTone: e.target.value as BriefData["brandTone"] }))}>{BRAND_TONES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><span style={lbl}>Budget Level</span><select style={inp} value={brief.budget} onChange={e => setBrief(p => ({ ...p, budget: e.target.value as BriefData["budget"] }))}>{BUDGETS.map(b => <option key={b}>{b}</option>)}</select></div>
              <div><span style={lbl}>Target Audience</span><input style={inp} value={brief.targetAudience} onChange={e => setBrief(p => ({ ...p, targetAudience: e.target.value }))} placeholder="Adults 25-40 urban" /></div>
            </div>
            <div style={{ marginTop: 8 }}><span style={lbl}>Key Message</span><textarea style={{ ...inp, resize: "vertical" }} rows={2} value={brief.keyMessage} onChange={e => setBrief(p => ({ ...p, keyMessage: e.target.value }))} placeholder="The main idea this commercial must communicate…" /></div>
            <div style={{ marginTop: 8 }}><span style={lbl}>Call to Action</span><input style={inp} value={brief.callToAction} onChange={e => setBrief(p => ({ ...p, callToAction: e.target.value }))} placeholder="e.g. Order now at freshbrew.ng" /></div>
          </div>

          <div style={card}>
            <div style={lbl}>Format & Platform</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><span style={lbl}>Format</span><select style={inp} value={brief.format} onChange={e => setBrief(p => ({ ...p, format: e.target.value as BriefData["format"] }))}>{FORMATS.map(f => <option key={f}>{f}</option>)}</select></div>
              <div><span style={lbl}>Platform</span><select style={inp} value={brief.platform} onChange={e => setBrief(p => ({ ...p, platform: e.target.value }))}>{PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}</select></div>
              <div><span style={lbl}>Aspect Ratio</span><select style={inp} value={brief.aspectRatio} onChange={e => setBrief(p => ({ ...p, aspectRatio: e.target.value as BriefData["aspectRatio"] }))}>{ASPECT_RATIOS.map(a => <option key={a}>{a}</option>)}</select></div>
            </div>
          </div>
        </div>

        {/* ── Expand with AI Intelligence ── */}
        <div style={{ ...card, background: `${purple}08`, borderColor: `${purple}30` }}>
          <div style={{ fontWeight: 700, color: purple, marginBottom: 6, fontSize: 13 }}>Expand with AI Intelligence</div>
          <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>AI reads your brief and automatically generates script ideas, detects cast, and plans scene cards. Fill in Brand Name and Key Message first.</p>
          <button style={{ ...btn(purple), opacity: expanding ? 0.6 : 1 }} onClick={expandStory} disabled={expanding}>
            {expanding ? "AI Expanding..." : "Expand with AI Intelligence"}
          </button>
          {lastAction.includes("expansion") && <p style={{ fontSize: 11, color: accent, marginTop: 6 }}>{lastAction}</p>}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <ButtonPrimary size="sm" onClick={saveProject}>Save Brief</ButtonPrimary>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => { applyTemplate(); setActiveTab("scenes"); }}>Apply {brief.format} Template</button>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => setActiveTab("cast")}>Cast →</button>
        </div>
      </div>
    );
  }

  // ── TAB: Cast ──
  function renderCast() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Cast & Talent</h2>
            <p style={{ color: ds.color.mute, fontSize: 13, margin: "4px 0 0" }}>Spokespeople, actors, voiceover artists, brand mascots</p>
          </div>
          <ButtonPrimary size="sm" onClick={() => setShowCharPicker(true)}>Import Character</ButtonPrimary>
        </div>

        {cast.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: ds.grad.tile.c3, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Users size={22} color="#fff" /></div>
            <div style={{ color: ds.color.mute, margin: "12px 0", fontSize: 13 }}>No talent yet. Import from Characters or add your brand spokesperson.</div>
            <ButtonPrimary size="sm" onClick={() => setShowCharPicker(true)}>Import Character</ButtonPrimary>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {cast.map(ch => (
            <div key={ch.characterId} style={{ ...card, position: "relative" }}>
              <button onClick={() => setCast(prev => prev.filter(c => c.characterId !== ch.characterId))} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: red, cursor: "pointer", display: "flex" }}><Icon.X size={14} /></button>
              <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: `${ds.color.lilac}33`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ch.imageUrl ? <img src={ch.imageUrl} alt={ch.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon.User size={20} color={ds.color.lilac} />}
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700 }}>{ch.displayName}</div>
                  <span style={badge(orange)}>{ch.role}</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><span style={lbl}>Role</span><select style={inp} value={ch.role} onChange={e => setCast(prev => prev.map(c => c.characterId === ch.characterId ? { ...c, role: e.target.value as CommercialCharacter["role"] } : c))}>
                {(["spokesperson", "actor", "voiceover", "brand_mascot", "product"] as const).map(r => <option key={r}>{r}</option>)}
              </select></div>
              {ch.voiceType && <div style={{ marginBottom: 8 }}><span style={lbl}>Voice Type</span><div style={{ fontSize: 12, color: blue, background: `${blue}15`, borderRadius: 8, padding: "6px 10px" }}>{ch.voiceType}</div></div>}
              <div><span style={lbl}>Description</span><input style={inp} value={ch.description} onChange={e => setCast(prev => prev.map(c => c.characterId === ch.characterId ? { ...c, description: e.target.value } : c))} placeholder="Confident, professional, 30s…" /></div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <ButtonPrimary size="sm" onClick={saveProject}>Save</ButtonPrimary>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => setActiveTab("scenes")}>Script & Scenes →</button>
        </div>

        {showCharPicker && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowCharPicker(false)}>
            <div style={{ background: surface, borderRadius: 16, maxWidth: 700, width: "100%", maxHeight: "80vh", overflow: "auto", border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#fff", fontWeight: 700 }}>Import Character</span>
                <button onClick={() => setShowCharPicker(false)} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
              <CharacterPicker
                onSelect={(char: any) => {
                  const id = char.id || char.characterId || `CC_${Date.now()}`;
                  setCast(prev => {
                    if (prev.find(c => c.characterId === id)) return prev;
                    return [...prev, { characterId: id, displayName: char.name || char.displayName, role: "actor", voiceId: char.voiceId || "", imageUrl: char.imageUrl, description: char.description || "" }];
                  });
                  setShowCharPicker(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── TAB: Script & Scenes ──
  function renderScenes() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Script & Scenes</h2>
            <p style={{ color: ds.color.mute, fontSize: 13, margin: "4px 0 0" }}>
              {scenes.length} scenes · {totalDuration}s total · {brief.format} format
              {commStickers.length > 0 && <span style={{ color: ds.color.btnC, marginLeft: 6 }}>· {commStickers.length} sticker{commStickers.length !== 1 ? "s" : ""}</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={applyTemplate}>Reset Template</button>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={() => setScenes(p => [...p, mkScene(p.length + 1, "cta")])}>+ Add Scene</button>
            <AITierSelector value={aiTier} onChange={setAiTier} compact />
            <ButtonPrimary size="sm" onClick={generateAIScript} disabled={generatingScript || !brief.brandName}>
              {generatingScript ? "Generating…" : "AI Script"}
            </ButtonPrimary>
            <button style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={extractCastFromScript} disabled={extractingCast}>
              {extractingCast ? "Detecting…" : "Extract Cast"}
            </button>
            <button
              disabled={runningIntelligence || scenes.length === 0}
              onClick={runSceneIntelligence}
              style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.mute, fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}
            >
              {runningIntelligence ? "Detecting..." : "Scene Intelligence"}
            </button>
          </div>
        </div>
        {runningIntelligence && (
          <p style={{ fontSize: 10, color: ds.color.mint, margin: "4px 0" }}>Scene Intelligence running — detecting environments and ambient sounds...</p>
        )}
        {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
          <p style={{ fontSize: 10, color: ds.color.mute, margin: "4px 0" }}>
            {Object.keys(sceneIntelligence).length} scenes have sound environment data
          </p>
        )}

        {/* ── AID Model Picker ── */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.ink2, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Video: <span style={{ color: ds.color.ink }}>{selectedVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.ink2, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Image: <span style={{ color: ds.color.ink }}>{selectedImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
            </div>
          </div>
        </div>

        {scenes.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: ds.grad.tile.c7, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Film size={22} color="#fff" /></div>
            <div style={{ color: ds.color.mute, margin: "12px 0", fontSize: 13 }}>No scenes yet. Apply a template based on your format ({brief.format}), or add scenes manually.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <ButtonPrimary size="sm" onClick={applyTemplate}>Apply {brief.format} Template</ButtonPrimary>
              <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => setScenes([mkScene(1, "hook")])}>+ Add Scene</button>
            </div>
          </div>
        )}

        {scenes.map(sc => {
          const img = sceneImages[sc.sceneId];
          const sectionColor = SECTION_COLORS[sc.sceneSection] || muted;
          const isExpanded = expandedSceneId === sc.sceneId;
          return (
            <div key={sc.sceneId} style={{ ...card, borderColor: img ? `${accent}44` : border }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 110, height: 62, borderRadius: 8, background: img ? "transparent" : s2, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${border}` }}>
                  {img ? <img src={img} alt={sc.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: muted, fontSize: 20 }}>📽</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color: muted, fontSize: 11 }}>{String(sc.scene).padStart(2,"0")}</span>
                    <span style={badge(sectionColor)}>{sc.sceneSection}</span>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{sc.title}</span>
                    <span style={{ color: muted, fontSize: 11 }}>{sc.duration}s</span>
                    <span style={badge(sc.status === "generated" ? accent : muted)}>{sc.status}</span>
                  </div>
                  {sc.voiceoverScript && <div style={{ fontSize: 11, color: "#bbb", marginBottom: 4, fontStyle: "italic" }}>VO: "{sc.voiceoverScript.slice(0, 80)}{sc.voiceoverScript.length > 80 ? "…" : ""}"</div>}
                  {sc.onScreenText && <div style={{ fontSize: 11, color: gold }}>Text: {sc.onScreenText}</div>}
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
                            <span key={i} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: `${ds.color.mint}15`, color: ds.color.mint, border: `1px solid ${ds.color.mint}30` }}>{sound}</span>
                          ))}
                          {intel.sfxEvents.length > 0 && (
                            <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: `${ds.color.gold}15`, color: ds.color.gold, border: `1px solid ${ds.color.gold}30` }}>{intel.sfxEvents[0]}</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* ── Per-scene model selectors ── */}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      data-testid={`img-model-${sc.sceneId}`}
                      value={sceneImageModels[sc.sceneId] || selectedImageModelId}
                      onChange={e => setSceneImageModels(prev => ({ ...prev, [sc.sceneId]: e.target.value }))}
                      style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6, border: `1px solid ${border}`, background: ds.color.paper, color: muted, cursor: "pointer" }}
                      title="Image model for this scene"
                    >
                      {AID_IMAGE_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select
                      data-testid={`vid-model-${sc.sceneId}`}
                      value={sceneVideoModels[sc.sceneId] || selectedVideoModelId}
                      onChange={e => setSceneVideoModels(prev => ({ ...prev, [sc.sceneId]: e.target.value }))}
                      style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6, border: `1px solid ${border}`, background: ds.color.paper, color: muted, cursor: "pointer" }}
                      title="Video model for this scene"
                    >
                      {AID_VIDEO_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  {(sceneImageModels[sc.sceneId] || selectedImageModelId).includes("ideogram_v3") && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={transparentBg} onChange={e => setTransparentBg(e.target.checked)} />
                      <span style={{ fontSize: 10, color: "#aaa" }}>Transparent Background (PNG)</span>
                    </label>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={() => makeSceneImage(sc)} disabled={generatingSceneImage === sc.sceneId}>{generatingSceneImage === sc.sceneId ? "Generating…" : img ? "Regen Image" : "Make Image"}</button>
                    <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={() => makeSceneVideo(sc)} disabled={!img || generatingSceneVideos.has(sc.sceneId)}>
                      {generatingSceneVideos.has(sc.sceneId) ? "..." : sceneVideos[sc.sceneId] ? "New Video" : "Make Video"}
                    </button>
                    <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={() => setExpandedSceneId(isExpanded ? null : sc.sceneId)}>{isExpanded ? "Close" : "Edit"}</button>
                    {img && <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${ds.color.mint}40`, background: `${ds.color.mint}10`, color: ds.color.mint, fontSize: 11, cursor: "pointer" }} onClick={() => updateScene(sc.sceneId, { status: "approved" })}>Approve</button>}
                    {img && <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 11, cursor: "pointer" }} onClick={async () => { try { const r = await fetch("/api/layerize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: img, projectType: "commercial", projectId }) }); const d = await r.json(); if (d.ok) alert(`Text layers extracted. Design ID: ${d.designId}`); else alert(`Layerize failed: ${d.error}`); } catch(e) { alert(`Error: ${e}`); } }}>Edit Text</button>}
                    <button style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${red}40`, background: `${red}10`, color: red, fontSize: 11, cursor: "pointer" }} onClick={() => setScenes(p => p.filter(s => s.sceneId !== sc.sceneId))}>Remove</button>
                  </div>
                  {sceneGenProgress[sc.sceneId] && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 4, background: border, borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${sceneGenProgress[sc.sceneId].percent}%`, background: purple, borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 9, color: muted }}>{sceneGenProgress[sc.sceneId].message}</span>
                    </div>
                  )}
                  {sceneVideos[sc.sceneId] && (
                    <div style={{ marginTop: 8 }}>
                      <video src={sceneVideos[sc.sceneId]} controls style={{ width: "100%", borderRadius: 8, maxHeight: 120 }} />
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div><span style={lbl}>Scene Title</span><input style={inp} value={sc.title} onChange={e => updateScene(sc.sceneId, { title: e.target.value })} /></div>
                    <div><span style={lbl}>Section</span><select style={inp} value={sc.sceneSection} onChange={e => updateScene(sc.sceneId, { sceneSection: e.target.value as CommercialScene["sceneSection"] })}>{SCENE_SECTIONS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div>
                      <span style={lbl}>Duration (seconds)</span>
                      <input style={inp} type="number" min={1} max={60} value={sc.duration} onChange={e => updateScene(sc.sceneId, { duration: +e.target.value })} />
                    </div>
                    <div><span style={lbl}>Scene Type</span><select style={inp} value={sc.sceneType} onChange={e => updateScene(sc.sceneId, { sceneType: e.target.value as CommercialScene["sceneType"] })}>{SCENE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                    <div><span style={lbl}>Camera Style</span><input style={inp} value={sc.cameraStyle} onChange={e => updateScene(sc.sceneId, { cameraStyle: e.target.value })} placeholder="Close-up product shot, wide establishing…" /></div>
                    <div><span style={lbl}>Mood</span><input style={inp} value={sc.mood} onChange={e => updateScene(sc.sceneId, { mood: e.target.value })} placeholder="Energetic, warm, confident…" /></div>
                    <div style={{ gridColumn: "1/-1" }}><span style={lbl}>Scene Description</span><textarea style={{ ...inp, resize: "vertical" }} rows={2} value={sc.description} onChange={e => updateScene(sc.sceneId, { description: e.target.value })} placeholder="Visual description of this scene…" /></div>
                    <div style={{ gridColumn: "1/-1" }}><span style={lbl}>Voiceover Script</span><textarea style={{ ...inp, resize: "vertical" }} rows={2} value={sc.voiceoverScript} onChange={e => updateScene(sc.sceneId, { voiceoverScript: e.target.value })} placeholder="What the voiceover says during this scene…" /></div>
                    <div style={{ gridColumn: "1/-1" }}><span style={lbl}>On-Screen Text / Supers</span><input style={inp} value={sc.onScreenText} onChange={e => updateScene(sc.sceneId, { onScreenText: e.target.value })} placeholder="Text displayed on screen, product name, CTA text…" /></div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <span style={lbl}>Characters in Scene</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {cast.map(ch => (
                          <button key={ch.characterId} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${sc.characterIds.includes(ch.characterId) ? orange : border}`, background: sc.characterIds.includes(ch.characterId) ? `${orange}22` : s2, color: sc.characterIds.includes(ch.characterId) ? orange : muted, fontSize: 11, cursor: "pointer" }}
                            onClick={() => updateScene(sc.sceneId, { characterIds: sc.characterIds.includes(ch.characterId) ? sc.characterIds.filter(id => id !== ch.characterId) : [...sc.characterIds, ch.characterId] })}>
                            {ch.displayName}
                          </button>
                        ))}
                        {cast.length === 0 && <span style={{ color: muted, fontSize: 11 }}>No cast — add talent in Cast tab</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {scenes.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <ButtonPrimary size="sm" onClick={saveProject}>Save</ButtonPrimary>
            <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => setActiveTab("screenplay")}>Screenplay →</button>
          </div>
        )}
      </div>
    );
  }

  // ── TAB: Screenplay ──
  function renderScreenplay() {
    const hasSource = !!voiceoverText || !!brief.keyMessage || !!brief.brandName;
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Screenplay</h2>
        <p style={{ color: ds.color.mute, fontSize: 13, margin: "0 0 20px" }}>Generate a formatted screenplay from your campaign brief, or paste your own script and parse it into voiceover segments.</p>

        {!screenplay && !generatingScreenplay && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: ds.color.ink, marginBottom: 8 }}>Generate or Paste Screenplay</p>
            <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 16 }}>Generate a full commercial screenplay from your brief, or paste your own script below and parse it into voiceover segments.</p>
            {!hasSource ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 12 }}>Fill in your campaign brief first.</p>
                <ButtonPrimary size="sm" onClick={() => setActiveTab("brief")}>Go to Brief</ButtonPrimary>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: ds.color.mute, flexShrink: 0 }}>Written by:</span>
                  <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Your name"
                    style={{ ...inp, maxWidth: 280 }} />
                </div>
                {screenplayError && <p style={{ fontSize: 12, color: red, marginBottom: 8 }}>{screenplayError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <ButtonPrimary size="sm" onClick={generateScreenplay}>Generate Screenplay</ButtonPrimary>
                  <button onClick={() => setScreenplay("FADE IN:\n\nINT. SCENE ONE - DAY\n\nPaste your screenplay here...\n\nFADE OUT.\n\nTHE END")}
                    style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 12, cursor: "pointer" }}>
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
                style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${orange}40`, background: "transparent", color: orange, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Regenerate
              </button>
              <button onClick={() => { const blob = new Blob([screenplay], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${brief.brandName || "screenplay"}.txt`; a.click(); }}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Download .txt
              </button>
              <button onClick={parseScript} disabled={parsingScript}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : blue, color: "#fff", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
                {parsingScript ? "Parsing..." : "Parse Script"}
              </button>
              <button onClick={sendScreenplayToScenes} disabled={sendingToScenes || scenes.length === 0}
                style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${gold}60` : gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes || scenes.length === 0 ? "default" : "pointer", opacity: scenes.length === 0 ? 0.4 : 1 }}>
                {sendingToScenes ? "Sending..." : "Send to Scenes →"}
              </button>
            </div>

            {sendToScenesResult && (
              <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${accent}10`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "flex" }}><Icon.Check size={14} /></span>
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
                        {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "VO"}
                      </span>
                      <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
              style={{ ...inp, minHeight: 400, fontFamily: "'Courier New', Courier, monospace", fontSize: 12, lineHeight: 1.8, resize: "vertical" as const, whiteSpace: "pre-wrap" as const, display: "block", width: "100%", boxSizing: "border-box" as const }} />

            {/* White paper preview */}
            <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
              <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
                <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase" as const, marginBottom: 2 }}>GIO HOME AI STUDIO</p>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase" as const, letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(brief.brandName || "UNTITLED").toUpperCase()}</h1>
                <p style={{ fontSize: 11, color: "#777", marginBottom: 24, fontStyle: "italic" }}>{brief.productName}{brief.tagline ? ` · ${brief.tagline}` : ""}</p>
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

        <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
          <ButtonPrimary size="sm" onClick={saveProject}>Save</ButtonPrimary>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => setActiveTab("audio")}>Audio & VO →</button>
        </div>
      </div>
    );
  }

  // ── TAB: Audio & VO ──
  function renderAudio() {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Audio & Voiceover</h2>
          <p style={{ color: ds.color.mute, fontSize: 13, margin: "4px 0 0" }}>Music, voiceover style, jingle, SFX, and audio library</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={lbl}>Background Music</div>
            <div style={{ marginBottom: 10 }}><span style={lbl}>Music Style</span><select style={inp} value={musicChoice} onChange={e => setMusicChoice(e.target.value)}>{MUSIC_CHOICES.map(m => <option key={m}>{m}</option>)}</select></div>
            <div>
              <span style={lbl}>Music Volume: {musicVolume}%</span>
              <input type="range" min={0} max={100} value={musicVolume} onChange={e => setMusicVolume(+e.target.value)} style={{ width: "100%", accentColor: orange }} />
            </div>
            <div style={{ marginTop: 10 }}><span style={lbl}>Jingle / Music Notes</span><textarea style={{ ...inp, resize: "vertical" }} rows={2} value={jingleNotes} onChange={e => setJingleNotes(e.target.value)} placeholder="e.g. Needs upbeat afrobeat jingle with brand hook at end…" /></div>
            {/* Music Library Picker */}
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              <button onClick={() => { setShowMusicPicker(p => !p); if (!showMusicPicker && musicLibrary.length === 0) loadMusicLibrary(); }}
                style={{ ...btn(purple), padding: "6px 14px", fontSize: 11 }}>
                {showMusicPicker ? "Close Library" : "Browse Music Library"}
              </button>
              <button onClick={aiPickMusic} disabled={aiPickingMusic}
                style={{ ...btn(gold), padding: "6px 14px", fontSize: 11, opacity: aiPickingMusic ? 0.6 : 1 }}>
                {aiPickingMusic ? "AI Picking…" : "AI Pick Music"}
              </button>
              {selectedMusicName && <span style={{ fontSize: 11, color: accent, alignSelf: "center" }}>✓ {selectedMusicName}</span>}
            </div>
            {aiMusicPickLog && <p style={{ fontSize: 10, color: aiMusicPickLog.startsWith("Selected:") ? accent : muted, marginTop: 6 }}>{aiMusicPickLog}</p>}
            {showMusicPicker && (
              <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {loadingMusic ? <p style={{ fontSize: 11, color: muted }}>Loading…</p> : musicLibrary.length === 0 ? (
                  <p style={{ fontSize: 11, color: muted }}>No music in library. <a href="/dashboard/music-studio" target="_blank" rel="noopener noreferrer" style={{ color: purple }}>Generate music first.</a></p>
                ) : musicLibrary.map(track => {
                  const mediaUrl = `/api/media/${track.filePath}`;
                  const isSelected = selectedMusicUrl === mediaUrl;
                  return (
                    <div key={track.id} onClick={() => { setSelectedMusicUrl(mediaUrl); setSelectedMusicName(track.name); setShowMusicPicker(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isSelected ? `${purple}15` : s2, border: `1px solid ${isSelected ? purple : border}`, cursor: "pointer" }}>
                      <span style={{ fontSize: 11, color: "#fff", flex: 1 }}>{track.name}</span>
                      {isSelected && <span style={{ fontSize: 10, color: purple, fontWeight: 700 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={lbl}>Voiceover</div>
            <div style={{ marginBottom: 10 }}><span style={lbl}>VO Style</span><select style={inp} value={voiceoverStyle} onChange={e => setVoiceoverStyle(e.target.value)}>{VO_STYLES.map(v => <option key={v}>{v}</option>)}</select></div>
            <div><span style={lbl}>VO Direction Notes</span><textarea style={{ ...inp, resize: "vertical" }} rows={4} value={voiceoverNotes} onChange={e => setVoiceoverNotes(e.target.value)} placeholder="Speed, emphasis, language, accent notes for the voiceover artist or AI voice…" /></div>
          </div>

          {/* SFX Browser */}
          <div style={{ ...card, gridColumn: "1/-1" }}>
            <div style={lbl}>Sound Effects</div>
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
                {fsNoKey && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${gold}08`, border: `1px solid ${gold}20`, marginBottom: 10 }}><p style={{ fontSize: 11, color: gold }}>Freesound API key not configured. Add FREESOUND_API_KEY to .env to enable search.</p></div>}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={fsQuery} onChange={e => setFsQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFreesound()}
                    placeholder="Search: jingle, brand reveal, swoosh..." style={{ ...inp, flex: 1, padding: "8px 12px", fontSize: 12 }} />
                  <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                    style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: fsSearching ? "#2a2a40" : blue, color: "#000", fontSize: 11, fontWeight: 700, cursor: fsSearching ? "not-allowed" : "pointer" }}>
                    {fsSearching ? "..." : "Search"}
                  </button>
                </div>
                {fsResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                    {fsResults.map(sound => (
                      <div key={sound.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: s2, border: `1px solid ${border}` }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{sound.name}</p>
                          <p style={{ fontSize: 9, color: muted }}>{sound.duration.toFixed(1)}s · {sound.username}</p>
                        </div>
                        <button onClick={() => setSfxPreviewId(sfxPreviewId === sound.id ? null : sound.id)}
                          style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, border: `1px solid ${blue}40`, background: "transparent", color: blue, cursor: "pointer" }}>
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
                {!fsSearching && fsResults.length === 0 && fsQuery && !fsNoKey && <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: "12px 0" }}>No results — try different keywords</p>}
              </div>
            )}
            {soundTab === "elevenlabs" && (
              <div>
                <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Describe a sound effect and ElevenLabs AI will generate it for your commercial.</p>
                <input value={sfxDesc} onChange={e => setSfxDesc(e.target.value)}
                  placeholder="e.g. Crisp coffee pour with sparkle reveal" style={{ ...inp, marginBottom: 8 }} />
                <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()}
                  style={{ ...btn(purple), width: "100%", opacity: sfxGenerating ? 0.6 : 1 }}>
                  {sfxGenerating ? "Generating SFX..." : "Generate SFX"}
                </button>
                {sfxGeneratedUrl && (
                  <div style={{ marginTop: 10 }}>
                    <audio src={sfxGeneratedUrl} controls style={{ width: "100%" }} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ ...card, gridColumn: "1/-1" }}>
            <div style={lbl}>VO Script Review</div>
            {scenes.filter(s => s.voiceoverScript).map(sc => (
              <div key={sc.sceneId} style={{ padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                <span style={badge(SECTION_COLORS[sc.sceneSection] || muted)}>{sc.sceneSection}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: muted }}>{sc.duration}s — </span>
                <span style={{ fontSize: 12, color: "#ddd" }}>{sc.voiceoverScript}</span>
              </div>
            ))}
            {!scenes.some(s => s.voiceoverScript) && <div style={{ color: muted, fontSize: 12 }}>No voiceover scripts yet — add them in Script & Scenes tab</div>}
            <div style={{ marginTop: 10, fontSize: 11, color: muted }}>Total VO duration: ~{Math.round(scenes.reduce((s, sc) => s + sc.duration, 0))}s</div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <ButtonPrimary size="sm" onClick={saveProject}>Save</ButtonPrimary>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={() => setActiveTab("assembly")}>Assembly →</button>
        </div>
      </div>
    );
  }

  // ── TAB: Assembly ──
  function renderAssembly() {
    const readyScenes = scenes.filter(s => sceneImages[s.sceneId] || s.status === "approved");
    const assemblyReady = readyScenes.length > 0;
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ color: ds.color.ink, fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Assembly</h2>
          <p style={{ color: ds.color.mute, fontSize: 13, margin: "4px 0 0" }}>Assemble the final {brief.format} commercial</p>
        </div>

        {/* ── Saved Cuts panel ── */}
        {savedCuts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={() => setShowCutsPanel(p => !p)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${gold}30`, background: showCutsPanel ? `${gold}10` : `${gold}06`, color: gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <span style={{ display: "flex" }}><Icon.Folder size={16} /></span>
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
                      <span style={{ fontSize: 13, display: "flex", alignItems: "center" }}>{c.videoUrl ? <Icon.Film size={12} /> : <Icon.Settings size={12} />}</span>
                      <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? gold : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => { const next = prev.filter((_, i) => i !== ci); try { localStorage.setItem("ghs_commercial_cuts", JSON.stringify(next)); } catch {} return next; }); }}
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
              <span style={lbl}>Commercial / Cut Name</span>
              <input type="text" value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="Final Cut, Director's Cut, Short Version..."
                style={{ ...inp, fontSize: 13, fontWeight: 600 }} />
            </div>
            <button
              onClick={() => {
                if (!assemblyName.trim()) return;
                setSavedCuts(prev => {
                  const existing = prev.findIndex(c => c.name === assemblyName);
                  const cut = { name: assemblyName, videoUrl: assembledUrl ?? undefined, savedAt: new Date().toISOString() };
                  const next = existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
                  try { localStorage.setItem("ghs_commercial_cuts", JSON.stringify(next)); } catch {}
                  return next;
                });
                setLastAction(`Cut "${assemblyName}" saved`);
              }}
              style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: ds.color.gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
              Save Cut
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={lbl}>Assembly Checklist</div>
          {[
            { check: !!brief.brandName, label: `Brand: ${brief.brandName || "Missing"}` },
            { check: !!brief.callToAction, label: `CTA: ${brief.callToAction || "Missing"}` },
            { check: scenes.length > 0, label: `Scenes: ${scenes.length} planned` },
            { check: readyScenes.length > 0, label: `Images: ${Object.keys(sceneImages).length}/${scenes.length} ready` },
            { check: scenes.some(s => s.voiceoverScript), label: "Voiceover scripts present" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${border}` }}>
              <span style={{ color: item.check ? ds.color.mint : red, fontSize: 16, display: "flex" }}>{item.check ? <Icon.Check size={14} /> : <Icon.X size={14} />}</span>
              <span style={{ fontSize: 13, color: item.check ? "#ddd" : muted }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Scene selection for assembly */}
        {scenes.length > 0 && (
          <div style={card}>
            <div style={lbl}>Select Scenes to Assemble</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button onClick={() => setAssemblySelectedIds(scenes.map(s => s.sceneId))} style={{ ...btn("#334"), padding: "4px 10px", fontSize: 10 }}>All</button>
              <button onClick={() => setAssemblySelectedIds([])} style={{ ...btn("#334"), padding: "4px 10px", fontSize: 10 }}>None</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {scenes.map(s => {
                const selected = assemblySelectedIds.includes(s.sceneId);
                const hasContent = !!(sceneVideos[s.sceneId] || sceneImages[s.sceneId]);
                return (
                  <button key={s.sceneId} onClick={() => setAssemblySelectedIds(prev => selected ? prev.filter(id => id !== s.sceneId) : [...prev, s.sceneId])}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${selected ? orange : border}`, background: selected ? `${orange}20` : "transparent", color: selected ? orange : muted, fontSize: 11, cursor: "pointer" }}>
                    {String(s.scene).padStart(2, "0")} {s.sceneSection} {hasContent ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ✨ Sticker Overlays */}
        <div style={{ ...card, marginBottom: 12 }}>
          <button
            onClick={() => setShowStickerPanel(p => !p)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: ds.color.btnC }}>Sticker Overlays {commStickers.length > 0 ? `(${commStickers.length})` : ""}</span>
            <span style={{ fontSize: 11, color: muted }}>{showStickerPanel ? "▲ Close" : "▼ Open"}</span>
          </button>
          {showStickerPanel && (
            <div style={{ marginTop: 10 }}>
              <AnimatedStickerPicker
                stickers={commStickers}
                onChange={setCommStickers}
                accentColor="#ef4444"
              />
            </div>
          )}
        </div>

        <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 4 }}>Final {brief.format} Commercial</div>
            <div style={{ fontSize: 12, color: muted }}>{brief.brandName} — {brief.productName} · {brief.platform} · {brief.aspectRatio} · Music: {musicChoice} · VO: {voiceoverStyle}{commStickers.length > 0 ? ` · ${commStickers.length} sticker(s)` : ""}</div>
          </div>
          <ButtonPrimary size="sm" disabled={!assemblyReady || assembling} onClick={assembleMovie}>
            {assembling ? "Assembling…" : assemblyReady ? "Assemble Commercial" : "Need Images First"}
          </ButtonPrimary>
        </div>

        {assembledUrl && (
          <div style={{ ...card, textAlign: "center" }}>
            <div style={lbl}>{assemblyComplete ? "Commercial Ready" : "Processing..."}</div>
            <video controls src={assembledUrl} style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <a href={assembledUrl} download style={{ padding: "8px 14px", borderRadius: 12, background: "linear-gradient(120deg,#a78bfa,#d17bff,#ff9a3c,#f5a623,#a78bfa)", backgroundSize: "300% 100%", animation: "btnSweep 6s linear infinite", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Download</a>
              <a href="/dashboard/commercial" style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, textDecoration: "none" }}>Open in Editor</a>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <ButtonPrimary size="sm" onClick={saveProject}>Save Campaign</ButtonPrimary>
        </div>
      </div>
    );
  }

  if (!mounted) return <div style={{ padding: 40, color: ds.color.mute, fontFamily: ds.font.sans }}>Loading...</div>;

  return (
    <div style={{ background: ds.color.paper, minHeight: "100vh", color: ds.color.ink, fontFamily: ds.font.sans }}>
      {/* ── Page Header ── */}
      <div style={{ padding: "24px 32px 0" }}>
        <HeroTitle kicker="Commercial Workshop" title="Campaign" italic="Production" sub={`${brief.brandName || "No brand"} · ${brief.format} · ${brief.platform}`} />
      </div>
      {/* ── Project toolbar ── */}
      <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${ds.color.line}` }}>
        <div style={{ flex: 1 }}>
          <input style={{ ...inp, fontWeight: 700, fontSize: 15, border: "none", background: "transparent", padding: "4px 0" }} value={projectTitle} onChange={e => setProjectTitle(e.target.value)} placeholder="Campaign name…" />
          <div style={{ fontSize: 10, color: ds.color.mute, marginTop: 2, fontFamily: ds.font.mono, letterSpacing: "0.1em", textTransform: "uppercase" }}>{lastAction}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {projectList.length > 0 && (
            <select style={{ ...inp, width: "auto", fontSize: 12, padding: "8px 12px" }} value={projectId || ""} onChange={e => {
              if (!e.target.value) return;
              const raw = localStorage.getItem(`ghs_comm_proj_${e.target.value}`);
              if (raw) {
                const d = JSON.parse(raw);
                setProjectId(d.projectId);
                setProjectTitle(d.projectTitle || "Untitled Campaign");
                setBrief(d.brief || defaultBrief());
                setCast(d.cast || []);
                setScenes(d.scenes || []);
                setSceneImages(d.sceneImages || {});
                setMusicChoice(d.musicChoice || "upbeat_corporate");
                setVoiceoverStyle(d.voiceoverStyle || "professional_female");
                setMusicVolume(d.musicVolume ?? 40);
                setVoiceoverNotes(d.voiceoverNotes || "");
                setBrandVisualStyle(d.brandVisualStyle || "minimal");
                setProductCategory(d.productCategory || "");
                setDesignComplete(d.designComplete ?? false);
                setStoryAiProvider(d.storyAiProvider || "auto");
                setVoiceoverText(d.voiceoverText || "");
                localStorage.setItem(ACTIVE_KEY, e.target.value);
              }
            }}>
              {projectList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <ButtonPrimary size="sm" onClick={saveProject} disabled={saving}>{saving ? "Saving…" : "Save"}</ButtonPrimary>
          <button style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }} onClick={newProject}>New</button>
          <a href="/dashboard/commercial" style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, textDecoration: "none" }}>Editor →</a>
        </div>
      </div>

      <TabBar />

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {activeTab === "overview"  && renderOverview()}
        {activeTab === "design"    && renderDesign()}
        {activeTab === "brief"     && renderBrief()}
        {activeTab === "cast"      && renderCast()}
        {activeTab === "scenes"    && renderScenes()}
        {activeTab === "screenplay" && renderScreenplay()}
        {activeTab === "audio"     && renderAudio()}
        {activeTab === "assembly"  && renderAssembly()}
      </div>

      {/* ── AID Model Picker Modal ── */}
      {showAidPicker && (() => {
        const models = aidMode === "video" ? AID_VIDEO_MODELS : (AID_IMAGE_MODELS as Array<{ id: string; name: string; price: number; network: string; res: string; color: string; scores?: { "2d": number; "3d": number; cartoon: number; realistic: number }; desc?: string }>);
        const filtered = aidStyle === "all" ? models : models.filter(m => m.scores ? m.scores[aidStyle] >= 3 : true);
        const sorted = [...filtered].sort((a, b) =>
          aidSort === "cheapest" ? a.price - b.price :
          aidSort === "quality"  ? ((b.scores?.[aidStyle === "all" ? "realistic" : aidStyle] ?? 0) - (a.scores?.[aidStyle === "all" ? "realistic" : aidStyle] ?? 0)) :
          b.price - a.price
        );
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: ds.color.card, borderRadius: 20, width: "100%", maxWidth: 780, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${ds.color.line2}` }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: 0 }}>
                    {aidMode === "video" ? "Video Model" : "Image Model"} Picker
                  </h2>
                  <p style={{ color: muted, fontSize: 11, margin: "2px 0 0" }}>Choose your AI generation model for this commercial</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["video", "image"] as const).map(m => (
                    <button key={m} onClick={() => setAidMode(m)}
                      style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${aidMode === m ? orange : border}`, background: aidMode === m ? `${orange}20` : "transparent", color: aidMode === m ? orange : muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {m === "video" ? "Video" : "Image"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAidPicker(false)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink2, fontSize: 12, cursor: "pointer" }}>Close</button>
              </div>
              <div style={{ padding: "12px 24px", borderBottom: `1px solid ${border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["all", "2d", "3d", "cartoon", "realistic"] as const).map(s => (
                    <button key={s} onClick={() => setAidStyle(s)}
                      style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${aidStyle === s ? orange : border}`, background: aidStyle === s ? `${orange}20` : "transparent", color: aidStyle === s ? orange : muted, fontSize: 10, cursor: "pointer" }}>
                      {s === "all" ? "All" : s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                  {(["cheapest", "quality", "expensive"] as const).map(s => (
                    <button key={s} onClick={() => setAidSort(s)}
                      style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${aidSort === s ? accent : border}`, background: aidSort === s ? `${accent}20` : "transparent", color: aidSort === s ? accent : muted, fontSize: 10, cursor: "pointer" }}>
                      {s === "cheapest" ? "Cheapest" : s === "quality" ? "Quality" : "Premium"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {sorted.map(model => {
                  const isSelected = aidMode === "video" ? selectedVideoModelId === model.id : selectedImageModelId === model.id;
                  return (
                    <div key={model.id} onClick={() => { if (aidMode === "video") setSelectedVideoModelId(model.id); else setSelectedImageModelId(model.id); setShowAidPicker(false); }}
                      style={{ background: s2, borderRadius: 12, border: `2px solid ${isSelected ? model.color : border}`, padding: 14, cursor: "pointer", position: "relative" }}>
                      {isSelected && <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: model.color }} />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.3, flex: 1, marginRight: 8 }}>{model.name}</span>
                        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: `${model.color}20`, color: model.color, flexShrink: 0 }}>{model.network}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, color: muted }}>{model.res}</span>
                        {"maxSec" in model && <span style={{ fontSize: 9, color: muted }}>·</span>}
                        {"maxSec" in model && <span style={{ fontSize: 9, color: muted }}>{(model as typeof AID_VIDEO_MODELS[0]).maxSec}s max</span>}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>${model.price.toFixed(3)}/gen</span>
                        {model.scores ? (
                          <div style={{ display: "flex", gap: 2 }}>
                            {(["2d","3d","cartoon","realistic"] as const).map(cat => (
                              <span key={cat} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: (model.scores![cat] ?? 0) >= 4 ? `${accent}30` : (model.scores![cat] ?? 0) >= 3 ? `${blue}20` : "#ffffff10", color: (model.scores![cat] ?? 0) >= 4 ? accent : (model.scores![cat] ?? 0) >= 3 ? blue : muted }}>
                                {cat[0].toUpperCase()}{model.scores![cat]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 9, color: muted }}>{(model as { desc?: string }).desc}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
