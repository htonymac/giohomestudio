"use client";

import { useState, useEffect, useCallback } from "react";
import NarrationControls from "../../components/NarrationControls";
import type { NarrationSettings } from "../../components/NarrationControls";
import type { SceneIntelligenceData } from "../../api/hybrid/scene-intelligence/route";
import { ds } from "../../../lib/designSystem";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { HeroTitle } from "../../components/hero/HeroTitle";
import * as Icon from "../../components/icons";

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
// GHS Music Video Planner — Dedicated deep planning for music videos
// 2 AI layers: Planner (concept + storyboard) + Reviewer (pacing + quality)
// Non-LLM engines: Song Structure, Caption/Lyric Timing, Generation Strategy
//
// Flow: Import song → AI analyzes → Choose video mode → Storyboard → Preview → Render
// ═══════════════════════════════════════════════════════════════════════════

const VIDEO_MODES = [
  { id: "official",    label: "Official Music Video",    desc: "Full cinematic music video with AI scenes" },
  { id: "lyric",       label: "Lyric Video",             desc: "Timed lyrics with mood visuals" },
  { id: "visualizer",  label: "Visualizer",              desc: "Waveform/motion background with branding" },
  { id: "image-mv",    label: "Image Music Video",       desc: "Your photos animated to music" },
  { id: "performance", label: "AI Artist Performance",   desc: "AI avatar performing your song" },
  { id: "commercial",  label: "Commercial Music Promo",  desc: "Product/brand music promo" },
  { id: "dance",       label: "Dance Mode",              desc: "Energetic rhythm-driven visuals" },
  { id: "children",    label: "Children Music Video",    desc: "Safe, bright, educational" },
];

const VISUAL_STYLES = [
  "Cinematic", "Street", "Luxury", "Abstract", "Nature", "Urban",
  "Fantasy", "Neon", "Worship Glow", "Dark Moody", "Energetic", "Minimalist",
];

// SCENE_ENV_ICON removed — env type shown as text label (v14: no emoji)

const SCENE_ENERGY_COLOR: Record<string, string> = {
  chaotic: "#ef4444", tense: "#eab308", dramatic: "#a855f7",
  mysterious: "#6366f1", peaceful: "#22d3ee", calm: "#22d3ee",
};

interface Scene {
  scene: number;
  section: string;
  duration: string;
  prompt: string;
  style: string;
  movement: string;
  caption: string;
  genMethod: string;
  status: string;
  outputUrl?: string;
}

// ── v14 style helpers ──
const surface = ds.color.card;
const border = ds.color.line;
const muted = ds.color.mute;
const accent = ds.color.lilac;
const cardStyle: React.CSSProperties = { background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: 16, padding: 24 };
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: ds.color.mute, marginBottom: 8, display: "block", fontFamily: ds.font.mono };
const inputStyle: React.CSSProperties = { width: "100%", background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: ds.font.sans };

interface MvProject { id: string; title: string; videoMode: string | null; status: string; updatedAt: string }

type MvTab = "overview" | "song" | "analysis" | "storyboard" | "screenplay" | "captions" | "audio" | "assembly";
const MV_TABS: { id: MvTab; label: string; step?: number }[] = [
  { id: "overview",   label: "Overview" },
  { id: "song",       label: "Song Input", step: 1 },
  { id: "analysis",   label: "Mode & AI",  step: 2 },
  { id: "storyboard", label: "Storyboard", step: 3 },
  { id: "screenplay", label: "Screenplay", step: 4 },
  { id: "captions",   label: "Captions",   step: 5 },
  { id: "audio",      label: "Audio",      step: 6 },
  { id: "assembly",   label: "Assembly",   step: 7 },
];

export default function MusicVideoPlannerPage() {
  const [activeTab, setActiveTab] = useState<MvTab>("overview");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<MvProject[]>([]);
  const [saving, setSaving] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  // Load project list
  useEffect(() => {
    fetch("/api/music-video/project").then(r => r.json()).then(d => {
      if (d.projects) setProjectList(d.projects);
    }).catch(() => {});
  }, []);

  // Step 1: Song input
  const [songSource, setSongSource] = useState<"upload" | "generate" | "library">("upload");
  const [songTitle, setSongTitle] = useState("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");

  // Step 2: Mode + style
  const [videoMode, setVideoMode] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [artistName, setArtistName] = useState("");

  // Step 3: AI analysis result
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    energy: string; mood: string; genre: string; sections: string; suggestions: string[];
    bpm?: number; danceability?: number; cameraStyle?: string; recommendedModel?: string;
  } | null>(null);
  const [lastAction, setLastAction] = useState<string>("");

  // Scene images
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [generatingImage, setGeneratingImage] = useState<number | null>(null);

  // Assembly
  const [musicStyle, setMusicStyle] = useState("");

  // Step 4: Storyboard
  const [storyboard, setStoryboard] = useState<Scene[]>([]);
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

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

  // Step 5: Render
  const [videoModel, setVideoModel] = useState("hailuo-fast");
  const [renderingScene, setRenderingScene] = useState<number | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  const [assemblySelectedIds, setAssemblySelectedIds] = useState<string[]>([]);

  // Narration controls
  const [narrationText, setNarrationText] = useState("");
  const [narrationSettings, setNarrationSettings] = useState<Partial<NarrationSettings>>({});

  // ── Auto Time Stamp ──
  const [loadingAutoTimestamp, setLoadingAutoTimestamp] = useState(false);
  const [autoTimestampPlan, setAutoTimestampPlan] = useState<null | { totalDuration: number; segmentCount: number; segments: Array<{ id: string; title: string; startTime: number; endTime: number; duration: number; narrationText: string }> }>(null);

  // ── Story AI provider ──
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-haiku-4-5-20251001");

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

  // ── Assembly Named Cuts ──
  const [assemblyName, setAssemblyName] = useState("Main Cut");
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; sceneIds: string[]; videoUrl?: string; savedAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("ghs_mv_cuts") || "[]"); } catch { return []; }
  });
  const [showCutsPanel, setShowCutsPanel] = useState(false);

  // ── Analyze song ──
  async function analyzeSong() {
    if (!songTitle.trim() && !lyrics.trim()) {
      setLastAction("Add song title or lyrics first");
      return;
    }
    setAnalyzing(true);
    setLastAction("AI is analyzing your song...");
    try {
      const res = await fetch("/api/music-video/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songTitle,
          artist: artistName,
          lyrics,
          genre: analysis?.genre || "",
          videoMode,
          visualStyle,
          language: "English",
        }),
      });
      const data = await res.json();
      if (data.ok || data.energy || data.mood) {
        setAnalysis({
          energy: data.energy || data.musicAnalysis?.energy || "medium",
          mood: data.mood || data.musicAnalysis?.mood || "cinematic",
          genre: data.genre || data.musicAnalysis?.genre || "",
          sections: data.sections || data.sectionPlan?.map((s: { name: string }) => s.name).join(", ") || "intro, verse, chorus, outro",
          suggestions: data.suggestions || data.recommendations?.suggestedVideoModes || [],
          bpm: data.bpm || data.musicAnalysis?.bpm,
          danceability: data.danceability || data.musicAnalysis?.danceability,
          cameraStyle: data.cameraStyle || data.danceIntelligence?.cameraStyle,
          recommendedModel: data.recommendedModel || data.recommendations?.suggestedModel,
        });
        if (data.recommendedModel || data.recommendations?.suggestedModel) {
          setVideoModel(data.recommendedModel || data.recommendations?.suggestedModel);
        }
        setLastAction("Analysis complete — go to Storyboard");
        setActiveTab("analysis");
      } else {
        const profile = data.musicProfile ?? {};
        const recs = data.recommendations ?? {};
        const dance = data.danceIntelligence ?? {};
        const sectionArr = (data.sections ?? []) as Array<{ name: string }>;
        const sectionsStr = sectionArr.length > 0
          ? sectionArr.map((s: { name: string }) => s.name).join(", ")
          : "intro, verse, chorus, outro";
        setAnalysis({
          energy: (profile.energy as string) ?? "medium",
          mood: videoMode === "official" ? "cinematic" : "energetic",
          genre: songTitle.toLowerCase().includes("afro") ? "Afrobeats" : ((profile.genre as string) ?? "Contemporary"),
          sections: sectionsStr,
          suggestions: [
            `BPM: ${profile.bpm ?? "~120"} · Danceability: ${Math.round(((profile.danceability as number) ?? 0.5) * 100)}%`,
            `Best mode: ${recs.bestVideoMode ?? videoMode}`,
            `Camera: ${(dance.cameraStyle as string) ?? "smooth tracking"}`,
          ].filter(Boolean),
          bpm: profile.bpm,
          danceability: profile.danceability,
          cameraStyle: dance.cameraStyle,
          recommendedModel: recs.suggestedModel,
        });
        if (recs.suggestedModel) setVideoModel(recs.suggestedModel);
        setLastAction("Basic analysis done — generate storyboard");
        setActiveTab("analysis");
      }
    } catch {
      // Fallback analysis
      setAnalysis({
        energy: "medium",
        mood: "cinematic",
        genre: "",
        sections: "intro, verse, chorus, outro",
        suggestions: ["Cinematic shots", "Performance footage", "Story narrative"],
      });
      setLastAction("Analysis failed — using defaults");
      setActiveTab("analysis");
    }
    setAnalyzing(false);
  }

  // ── Save project to DB ──
  const saveProject = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/music-video/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId ?? undefined,
          title: songTitle || "Untitled Music Video",
          songTitle, lyrics, videoMode, visualStyle, artistName,
          status: storyboard.length > 0 ? "planned" : "draft",
          musicProfile: analysis,
          storyboard,
        }),
      });
      const data = await res.json();
      if (data.project) {
        if (!projectId) setProjectId(data.project.id);
        fetch("/api/music-video/project").then(r => r.json()).then(d => {
          if (d.projects) setProjectList(d.projects);
        }).catch(() => {});
      }
    } catch { /* ignore */ }
    setSaving(false);
  }, [projectId, songTitle, lyrics, videoMode, visualStyle, artistName, analysis, storyboard]);

  // ── Load project ──
  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/music-video/project/${id}`);
      const data = await res.json();
      if (data.project) {
        const p = data.project;
        setProjectId(p.id);
        setSongTitle(p.songTitle ?? "");
        setLyrics(p.lyrics ?? "");
        setVideoMode(p.videoMode ?? "");
        setVisualStyle(p.visualStyle ?? "");
        setArtistName(p.artistName ?? "");
        if (p.storyboard) setStoryboard(p.storyboard as Scene[]);
        if (p.musicProfile) setAnalysis(p.musicProfile as typeof analysis);
        setActiveTab(p.storyboard ? "storyboard" : p.videoMode ? "analysis" : "song");
        setShowProjects(false);
      }
    } catch { /* ignore */ }
  }

  async function generateStoryboard() {
    if (!analysis) { setLastAction("Analyze song first"); return; }
    setStoryboardLoading(true);
    setLastAction("Generating storyboard from song analysis...");
    try {
      const sections = analysis.sections.split(",").map(s => s.trim()).filter(Boolean);
      const res = await fetch("/api/music-video/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songTitle,
          artist: artistName,
          lyrics,
          videoMode,
          visualStyle,
          energy: analysis.energy,
          mood: analysis.mood,
          genre: analysis.genre,
          sections,
          requestStoryboard: true,
          sceneCount: Math.min(Math.max(sections.length, 4), 8),
        }),
      });
      const data = await res.json();

      const storyboardScenes: Scene[] = [];

      if (data.storyboard?.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.storyboard.forEach((s: any, i: number) => {
          storyboardScenes.push({
            scene: i + 1,
            section: s.section || sections[i] || `Section ${i + 1}`,
            duration: s.duration || "4-6s",
            prompt: s.prompt || s.visualPrompt || `${analysis.mood} ${visualStyle} scene for ${songTitle} ${s.section || ""}`,
            style: visualStyle,
            movement: s.movement || s.cameraMovement || "slow zoom",
            caption: s.caption || s.lyricLine || "",
            genMethod: s.generationMethod || (s.section?.toLowerCase().includes("chorus") ? "video-led" : "image-to-video"),
            status: "planned",
          });
        });
      } else {
        // Build from sections analysis
        for (const [i, sec] of sections.entries()) {
          storyboardScenes.push({
            scene: i + 1,
            section: sec,
            duration: sec.includes("chorus") ? "6-8s" : "4-6s",
            prompt: `${analysis.mood} ${visualStyle} visual for ${songTitle} — ${sec} section. ${analysis.energy} energy.`,
            style: visualStyle,
            movement: sec.includes("chorus") ? "dynamic cut" : "slow pan",
            caption: lyrics.split("\n")[i * 2] || "",
            genMethod: sec.includes("chorus") || sec.includes("hook") ? "video-led" : "image-to-video",
            status: "planned",
          });
        }
      }

      setStoryboard(storyboardScenes);
      setLastAction(`Storyboard: ${storyboardScenes.length} scenes planned`);
      setActiveTab("storyboard");
      // Auto-save after storyboard
      setTimeout(() => saveProject(), 500);
    } catch {
      setLastAction("Storyboard generation failed — try again");
    }
    setStoryboardLoading(false);
  }

  // ── Generate scene image ──
  async function makeSceneImage(scene: Scene) {
    setGeneratingImage(scene.scene);
    try {
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${scene.prompt}. Style: ${scene.style}. Music video for: ${songTitle} by ${artistName || "artist"}. Mood: ${analysis?.mood || "cinematic"}.`,
          style: visualStyle || "cinematic",
          sceneType: scene.genMethod === "video-led" ? "video-led" : "image-led",
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setSceneImages(prev => ({ ...prev, [scene.scene]: data.imageUrl }));
        setStoryboard(prev => prev.map(s => s.scene === scene.scene ? { ...s, status: "generated" } : s));
        setLastAction(`Scene ${scene.scene} image generated`);
      }
    } catch { setLastAction("Image generation failed"); }
    setGeneratingImage(null);
  }

  // ── Assemble music video ──
  async function assembleMusicVideo() {
    setAssembling(true);
    setLastAction("Assembling music video...");
    try {
      const sceneList = storyboard.map(s => ({
        sceneId: `mv_sc${s.scene}`,
        imageUrl: sceneImages[s.scene] || "",
        narration: s.caption,
        duration: parseInt(s.duration) || 5,
        musicStyle: analysis?.mood || videoMode,
      }));
      const res = await fetch("/api/hybrid/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scenes: sceneList,
          music: songUrl || musicStyle,
          narrationStyle: "none",
          title: `${songTitle} — Music Video`,
        }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        setLastAction("Music video assembled!");
      }
    } catch { setLastAction("Assembly failed"); }
    setAssembling(false);
  }

  // ── expandStory pipeline ──
  async function expandStory() {
    const storyInput = lyrics || songTitle;
    if (!storyInput.trim()) { setLastAction("Add song title or lyrics first"); return; }
    setExpanding(true);
    setLastAction("AI is expanding your music video concept...");
    try {
      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: `Music video for "${songTitle}" by ${artistName || "artist"}. Mode: ${videoMode}. Visual style: ${visualStyle}. Lyrics: ${storyInput.slice(0, 500)}`,
          genre: analysis?.genre || videoMode || "music-video", tone: analysis?.mood || "cinematic",
          audience: "music fans", language: "English",
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
        }),
      });
      const expandData = await expandRes.json();

      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: expandData.expandedStory?.summary || expandData.summary || storyInput, fullScript: lyrics },
          genre: "music-video", format: videoMode,
        }),
      });
      const sceneData = await sceneRes.json();
      const planned = sceneData.scenes as Array<{ title?: string; description?: string; visualDescription?: string; dialogue?: string }> | undefined;
      if (planned && planned.length > 0) {
        const baseScenes: Scene[] = planned.map((p, i) => ({
          scene: i + 1,
          section: p.title || `Scene ${i + 1}`,
          duration: "5s",
          prompt: p.description || p.visualDescription || `${analysis?.mood || "cinematic"} ${visualStyle} scene for ${songTitle}`,
          style: visualStyle,
          movement: "smooth pan",
          caption: p.dialogue || "",
          genMethod: "image-to-video",
          status: "planned",
        }));
        setStoryboard(prev => prev.length === 0 ? baseScenes : prev);
        setLastAction(`AI built ${baseScenes.length} storyboard scenes — review Storyboard tab`);
        // auto-run scene intelligence after planning
        setTimeout(() => runSceneIntelligence(), 500);
      } else {
        setLastAction("AI concept expanded — generate storyboard manually");
      }
    } catch { setLastAction("AI expansion failed — try again"); }
    setExpanding(false);
  }

  async function runAutoTimestamp() {
    setLoadingAutoTimestamp(true);
    try {
      const sceneTexts = storyboard.map(s => `${s.section}: ${s.prompt}`);
      // Estimate total from storyboard duration strings (e.g. "4-6s" → mid 5s)
      const totalDur = storyboard.reduce((sum, s) => {
        const match = s.duration.match(/(\d+)/g);
        if (match && match.length >= 2) return sum + (parseInt(match[0]) + parseInt(match[1])) / 2;
        if (match && match.length === 1) return sum + parseInt(match[0]);
        return sum + 5;
      }, 0) || 60;

      const res = await fetch("/api/timeline/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: lyrics || songTitle,
          scenes: sceneTexts.length > 0 ? sceneTexts : undefined,
          mode: "scene",
          targetDuration: totalDur,
        }),
      });
      const data = await res.json();
      if (data.plan) {
        setAutoTimestampPlan(data.plan);
        setLastAction(`Auto Time Stamp: ${data.plan.segmentCount} segments, ${data.plan.totalDuration.toFixed(1)}s total`);
      }
    } catch (err) {
      console.error("autoTimestamp failed:", err);
    }
    setLoadingAutoTimestamp(false);
  }

  async function runSceneIntelligence() {
    if (storyboard.length === 0) return;
    setRunningIntelligence(true);
    try {
      const res = await fetch("/api/hybrid/scene-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: storyboard.map(s => ({
            sceneId: String(s.scene),
            title: s.section,
            description: s.prompt,
            location: "",
            timeOfDay: "",
            mood: s.style,
          })),
          storyContext: `${songTitle} by ${artistName || "artist"}`,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.intelligence)) {
        const map: Record<string, SceneIntelligenceData> = {};
        for (const item of data.intelligence) map[item.sceneId] = item;
        setSceneIntelligence(map);
        setStoryboard(prev => prev.map(s => {
          const intel = map[String(s.scene)];
          if (!intel) return s;
          return {
            ...s,
            style: s.style || intel.energyLevel,
          };
        }));
      }
    } catch (err) {
      console.warn("Scene intelligence failed:", err);
    }
    setRunningIntelligence(false);
  }

  // ── makeSceneVideo (SSE streaming) ──
  async function makeSceneVideo(scene: Scene) {
    const sceneId = `mv_sc${scene.scene}`;
    const existingImage = sceneImages[scene.scene];
    if (!existingImage) { setLastAction(`Scene ${scene.scene} needs an image first`); return; }
    setGeneratingSceneVideos(prev => new Set(prev).add(sceneId));
    setSceneGenProgress(prev => ({ ...prev, [sceneId]: { percent: 2, message: "Connecting..." } }));
    setLastAction(`Generating video for Scene ${scene.scene}...`);
    try {
      const response = await fetch("/api/hybrid/scene-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, projectId, sceneText: `${scene.section}. ${scene.prompt}`, imageUrl: existingImage, duration: 5, motionDescription: scene.movement || "" }),
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
              setStoryboard(prev => prev.map(s => s.scene === scene.scene ? { ...s, status: "generated" } : s));
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

  // ── assembleMovie — beat-sync music video assembly ──
  async function assembleMovie() {
    setAssembling(true); setAssemblyComplete(false);
    const ids = assemblySelectedIds.length > 0 ? assemblySelectedIds : storyboard.map(s => `mv_sc${s.scene}`);
    const selectedScenes = storyboard.filter(s => ids.includes(`mv_sc${s.scene}`));

    // Build section timing from analysis if available
    let sections: Array<{ label: string; startSec: number; durationSec: number }> | undefined;
    if (analysis?.sections) {
      const lines = analysis.sections.split("\n").filter(Boolean);
      let cursor = 0;
      sections = lines.map((line, i) => {
        const match = line.match(/(\d+)\s*s/i);
        const dur = match ? parseInt(match[1]) : 15;
        const sec = { label: `section_${i}`, startSec: cursor, durationSec: dur };
        cursor += dur;
        return sec;
      });
    }

    // Map scenes to their video/image sources
    const mvScenes = selectedScenes.map((s, i) => {
      const sceneId = `mv_sc${s.scene}`;
      const videoUrl = sceneVideos[sceneId] || s.outputUrl || "";
      const imageUrl = sceneImages[s.scene] || "";
      // Parse duration from "5s" format
      const durNum = parseInt(s.duration) || 5;
      return {
        scene: s.scene,
        videoUrl: videoUrl || imageUrl || "",
        sectionLabel: sections?.[i]?.label,
        targetDurationSec: sections?.[i]?.durationSec || durNum,
        caption: s.caption || "",
      };
    }).filter(s => s.videoUrl);

    if (mvScenes.length === 0) { setLastAction("No scenes have video or images yet"); setAssembling(false); return; }

    setLastAction(`Assembling ${mvScenes.length} scenes with beat-sync…`);

    // Generate narration TTS if narrationText is set
    let resolvedNarrationUrl: string | undefined;
    if (narrationText.trim()) {
      try {
        setLastAction("Generating narration voiceover…");
        const ttsRes = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: narrationText.trim(), voiceId: narrationSettings?.voiceId }),
        });
        const ttsData = await ttsRes.json();
        if (ttsData.audioUrl) resolvedNarrationUrl = ttsData.audioUrl;
      } catch { /* narration optional — continue without */ }
      setLastAction(`Assembling ${mvScenes.length} scenes with beat-sync…`);
    }

    try {
      const res = await fetch("/api/music-video/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: `${songTitle} — Music Video`,
          songUrl: songUrl || selectedMusicUrl || undefined,
          songPath: undefined,
          scenes: mvScenes,
          sections,
          musicVolume: 0.85,
          narrationUrl: resolvedNarrationUrl,
          captions: !!(mvScenes.some(s => s.caption)),
          captionStyle: "white",
        }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        setAssembledUrl(data.outputUrl);
        setAssemblyComplete(true);
        setLastAction(`Music video assembled! (${Math.round(data.duration || 0)}s)`);
      } else {
        setLastAction(data.error || "Assembly failed — check server logs");
      }
    } catch (e) { setLastAction(`Assembly failed: ${e instanceof Error ? e.message : String(e)}`); }
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
      const storyContext = `Music video for "${songTitle}" by ${artistName || "artist"}. Mode: ${videoMode}. Visual style: ${visualStyle}. Mood: ${analysis?.mood || "cinematic"}.`;
      const trackList = tracks.map((t, i) => `${i + 1}. "${t.name}"${t.tags?.length ? ` [${t.tags.slice(0, 4).join(", ")}]` : ""}`).join("\n");
      setAiMusicPickLog("Asking AI to pick best track...");
      const llmRes = await fetch("/api/llm/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Pick best background music track for: ${storyContext}\n\nTRACKS:\n${trackList}\n\nReply JSON only: {"trackNumber": 1, "trackName": "name", "reason": "why"}`, role: "quality", maxTokens: 200 }),
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

  // ── Render scene ──
  async function renderSingleScene(sceneNum: number) {
    const scene = storyboard.find(s => s.scene === sceneNum);
    if (!scene) return;
    setRenderingScene(sceneNum);
    setStoryboard(prev => prev.map(s => s.scene === sceneNum ? { ...s, status: "generating" } : s));
    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${scene.prompt}. Camera: ${scene.movement}. Style: ${scene.style}.`, model: videoModel }),
      });
      const data = await res.json();
      setStoryboard(prev => prev.map(s => s.scene === sceneNum ? { ...s, status: data.outputUrl ? "generated" : "needs_edit", outputUrl: data.outputUrl } : s));
    } catch {
      setStoryboard(prev => prev.map(s => s.scene === sceneNum ? { ...s, status: "needs_edit" } : s));
    }
    setRenderingScene(null);
  }

  // ── Generate Screenplay (AI) ──
  async function generateScreenplay() {
    const source = lyrics || songTitle;
    if (!source.trim()) { setScreenplayError("Add song title or lyrics first."); return; }
    setGeneratingScreenplay(true);
    setScreenplayError("");
    try {
      const res = await fetch("/api/hybrid/screenplay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: songTitle,
          summary: lyrics || `Music video for ${songTitle} by ${artistName || "artist"}`,
          scenes: storyboard.map((s, i) => ({ scene: i + 1, title: s.section, visualDescription: s.prompt, dialogue: s.caption })),
          genre: analysis?.genre || videoMode,
          tone: analysis?.mood || "cinematic",
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

  // ── Parse Script into segments ──
  async function parseScript() {
    const textToParse = screenplay || lyrics || songTitle;
    if (!textToParse.trim()) { setLastAction("Add lyrics or generate screenplay first."); return; }
    setParsingScript(true);
    try {
      const res = await fetch("/api/hybrid/parse-script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToParse,
          knownCharacters: artistName ? [artistName] : [],
        }),
      });
      const data = await res.json();
      if (data.ok && data.segments) {
        setScriptSegments(data.segments);
        setShowScriptReview(true);
        setLastAction(`Script parsed — ${data.segments.length} segments`);
      } else {
        setLastAction(data.error || "Script parsing failed");
      }
    } catch (err) {
      setLastAction("Script parse error: " + String(err));
    }
    setParsingScript(false);
  }

  // ── Send screenplay to storyboard scenes ──
  async function sendScreenplayToScenes() {
    if (!screenplay || storyboard.length === 0) return;
    setSendingToScenes(true);
    setSendToScenesResult("");
    const lines = screenplay.split("\n");
    let currentSceneNum = 0;
    const sceneBlocks: Array<{ sceneNum: number; lines: string[] }> = [];
    let currentBlock: string[] = [];
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
    setStoryboard(prev => prev.map((s, i) => {
      const block = sceneBlocks[i];
      if (!block) return s;
      const caption = block.lines.filter(l => l && !/^[A-Z][A-Z\s\-'().]+$/.test(l) && !l.startsWith("(")).join(" ");
      return { ...s, caption };
    }));
    setSendToScenesResult(`Screenplay sent to ${sceneBlocks.length} scenes.`);
    setSendingToScenes(false);
    await parseScript();
  }

  const sceneImageCount = Object.keys(sceneImages).length;

  return (
    <div style={{ background: ds.color.paper, minHeight: "100vh", padding: "0 0 60px", fontFamily: ds.font.sans }}>
      {/* ── Page Header ── */}
      <div style={{ padding: "24px 32px 0" }}>
        <HeroTitle
          kicker="Music Video Studio"
          title="Music Video"
          italic="Planner"
          sub="Import song → AI analyzes → storyboard → preview → render"
        />
      </div>

      {/* ── Project toolbar ── */}
      <div style={{ padding: "12px 32px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 12, color: ds.color.ink, fontWeight: 600 }}>{songTitle || "New Project"}</span>
        {lastAction && <span style={{ fontSize: 11, color: ds.color.mint, marginLeft: 8 }}>{lastAction}</span>}
        <button onClick={() => saveProject()} disabled={saving}
          style={{ marginLeft: "auto", fontSize: 11, padding: "5px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: `${ds.color.lilac}10`, color: ds.color.lilac, cursor: "pointer", fontWeight: 600 }}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setShowProjects(!showProjects)}
          style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
          Projects ({projectList.length})
        </button>
      </div>

      {/* Recent projects */}
      {showProjects && (
        <div style={{ margin: "12px 32px 0", ...cardStyle, maxHeight: 200, overflowY: "auto" }}>
          {projectList.length === 0 && <p style={{ fontSize: 12, color: muted }}>No saved projects yet</p>}
          {projectList.map(p => (
            <div key={p.id} onClick={() => loadProject(p.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, marginBottom: 3, background: projectId === p.id ? `${ds.color.lilac}08` : "transparent", cursor: "pointer", border: `1px solid ${projectId === p.id ? `${ds.color.lilac}30` : "transparent"}` }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{p.title}</span>
                <span style={{ fontSize: 9, color: muted, marginLeft: 8 }}>{p.videoMode ?? ""} &middot; {p.status}</span>
              </div>
              <span style={{ fontSize: 9, color: muted }}>{new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── v14 Tab Bar ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${ds.color.line}`, background: ds.color.paper, overflowX: "auto", marginTop: 16, padding: "0 32px" }}>
        {MV_TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: "13px 18px", background: "none", border: "none",
                color: active ? ds.color.ink : ds.color.mute,
                fontWeight: 700, fontSize: 10, fontFamily: ds.font.mono, letterSpacing: "0.18em",
                textTransform: "uppercase" as const, cursor: "pointer", position: "relative",
                whiteSpace: "nowrap", transition: "color .18s",
              }}>
              {active && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#a78bfa,#d17bff,#ff9a3c,#f5a623)", borderRadius: "2px 2px 0 0" }} />}
              {t.label}
              {t.step && <span style={{ marginLeft: 5, fontSize: 8, padding: "1px 5px", borderRadius: 10, background: `${ds.color.lilac}22`, color: ds.color.lilac }}>{t.step}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding: "0 32px" }}>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, gridColumn: "1/-1" }}>
            {[
              { label: "Song", value: songTitle || "None", color: "#00d4ff" },
              { label: "Mode", value: videoMode || "Not set", color: "#ec4899" },
              { label: "Scenes", value: storyboard.length, color: "#22c55e" },
              { label: "Generated", value: storyboard.filter(s => s.status === "generated").length, color: "#f59e0b" },
            ].map(stat => (
              <div key={stat.label} style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 12, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: "#5a7080", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 12 }}>Quick Actions</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              <button onClick={() => setActiveTab("song")} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" as const }}>{songTitle ? "Edit Song" : "Add Song"}</button>
              <button onClick={() => setActiveTab("analysis")} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" as const }}>{videoMode ? "Edit Mode" : "Choose Video Mode"}</button>
              <button onClick={() => setActiveTab("storyboard")} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" as const }}>{storyboard.length > 0 ? `Storyboard (${storyboard.length} scenes)` : "Build Storyboard"}</button>
              <button onClick={() => setActiveTab("assembly")} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#ec4899", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Go to Assembly</button>
            </div>
          </div>
          <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 12 }}>Production Status</p>
            {[
              { label: "Song ready", done: !!songTitle },
              { label: "Video mode selected", done: !!videoMode },
              { label: "Analysis complete", done: !!analysis },
              { label: "Storyboard built", done: storyboard.length > 0 },
              { label: "Scenes rendered", done: storyboard.some(s => s.status === "generated") },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1e2a35" }}>
                <span style={{ color: item.done ? "#22c55e" : "#5a7080" }}>{item.done ? "OK" : "–"}</span>
                <span style={{ fontSize: 12, color: item.done ? "#ddd" : "#5a7080" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SCREENPLAY TAB ═══ */}
      {activeTab === "screenplay" && (
        <div>
          {!screenplay && !generatingScreenplay && (
            <div style={{ ...cardStyle, borderColor: "rgba(168,85,247,0.2)", marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Screenplay</p>
              <p style={{ fontSize: 11, color: muted, marginBottom: 16 }}>Generate a formatted screenplay from your song and storyboard, or paste your own script and parse it into narrator/dialogue segments.</p>
              {!songTitle.trim() && !lyrics.trim() ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Add song title or lyrics first — go to Song Input tab.</p>
                  <button onClick={() => setActiveTab("song")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#a855f7", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Song Input</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>Written by:</span>
                    <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Your name"
                      style={{ flex: 1, background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", maxWidth: 280 }} />
                  </div>
                  {screenplayError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{screenplayError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={generateScreenplay}
                      style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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

          {generatingScreenplay && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              
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
                    style={{ background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", width: 160 }} />
                </div>
                <button onClick={generateScreenplay}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(168,85,247,0.4)", background: "transparent", color: "#a855f7", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Regenerate
                </button>
                <button onClick={() => { const blob = new Blob([screenplay], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${songTitle || "screenplay"}.txt`; a.click(); }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Download .txt
                </button>
                <button onClick={parseScript} disabled={parsingScript}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
                  {parsingScript ? "Parsing..." : "Parse Script"}
                </button>
                <button onClick={sendScreenplayToScenes} disabled={sendingToScenes || storyboard.length === 0}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? "rgba(245,158,11,0.6)" : "#f59e0b", color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes || storyboard.length === 0 ? "default" : "pointer", opacity: storyboard.length === 0 ? 0.4 : 1 }}>
                  {sendingToScenes ? "Sending..." : "Send to Storyboard →"}
                </button>
              </div>

              {sendToScenesResult && (
                <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon.Check style={{ width: 14, height: 14, color: accent, flexShrink: 0 }} />
                  <p style={{ fontSize: 11, color: accent, flex: 1 }}>{sendToScenesResult}</p>
                  <button onClick={() => setActiveTab("storyboard")} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Go to Storyboard</button>
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
                      <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: seg.type === "dialogue" ? "rgba(0,212,255,0.1)" : "rgba(168,85,247,0.1)", borderLeft: `3px solid ${seg.type === "dialogue" ? "#00d4ff" : "#a855f7"}` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: seg.type === "dialogue" ? "#00d4ff" : "#a855f7", textTransform: "uppercase", marginRight: 8 }}>
                          {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "NARR"}
                        </span>
                        <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
                style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "'Courier New', Courier, monospace", minHeight: 400, lineHeight: 1.8, resize: "vertical" as const, whiteSpace: "pre-wrap" }} />

              <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
                <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
                  <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>GIO HOME AI STUDIO</p>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(songTitle || "UNTITLED").toUpperCase()}</h1>
                  {(analysis?.genre || videoMode) && <p style={{ fontSize: 11, color: "#777", marginBottom: 24, fontStyle: "italic" }}>{[analysis?.genre, videoMode].filter(Boolean).join(" · ")}</p>}
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

      {/* Captions tab */}
      {activeTab === "captions" && (
        <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Captions &amp; Lyrics</h2>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Caption Display Mode</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Full Lyrics", "Key Lines Only", "Subtitle Style", "No Captions"].map(m => (
                <button key={m} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Caption Position</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Top", "Center", "Bottom"].map(p => (
                <button key={p} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Font Style</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Bold Modern", "Clean Sans", "Italic Drama", "Worship Serif"].map(f => (
                <button key={f} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>{f}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Lyrics / Caption Text</p>
            <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={6} placeholder="Paste or edit your lyrics here for timed captions..." style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" as const }} />
          </div>
          <button onClick={() => setActiveTab("storyboard")} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#ec4899", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>→ Go to Storyboard</button>
        </div>
      )}

      {/* Audio tab */}
      {activeTab === "audio" && (
        <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><Icon.Mic style={{ width: 18, height: 18 }} /> Audio &amp; Narration</h2>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Narration Intro / Outro</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Intro voiceover</p>
                <input placeholder="e.g. 'Presenting the official video for...'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Outro voiceover</p>
                <input placeholder="e.g. 'Stream now on all platforms'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 8 }}>Narration Controls</p>
            <NarrationControls narrationText={narrationText} onNarrationChange={setNarrationText} onSettingsChange={setNarrationSettings} compact={true} />
          </div>

          {/* Music Library Picker */}
          <div style={{ marginBottom: 20, background: "#080b10", borderRadius: 12, padding: 16, border: "1px solid #1e2a35" }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>Music Library</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
              <button onClick={() => { setShowMusicPicker(p => !p); if (!showMusicPicker && musicLibrary.length === 0) loadMusicLibrary(); }}
                style={{ padding: "7px 14px", borderRadius: 9, border: "1px solid rgba(124,92,252,0.4)", background: "rgba(124,92,252,0.1)", color: "#7c5cfc", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {showMusicPicker ? "Close Library" : "Browse Music Library"}
              </button>
              <button onClick={aiPickMusic} disabled={aiPickingMusic}
                style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: aiPickingMusic ? "#2a2a40" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
                {aiPickingMusic ? "AI Picking…" : "AI Pick"}
              </button>
              {selectedMusicName && <span style={{ fontSize: 11, color: "#22c55e", alignSelf: "center", display: "flex", alignItems: "center", gap: 4 }}><Icon.Check style={{ width: 11, height: 11 }} /> {selectedMusicName}</span>}
            </div>
            {aiMusicPickLog && <p style={{ fontSize: 10, color: aiMusicPickLog.startsWith("Selected:") ? "#22c55e" : muted, marginBottom: 8 }}>{aiMusicPickLog}</p>}
            {showMusicPicker && (
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {loadingMusic ? <p style={{ fontSize: 11, color: muted }}>Loading…</p> : musicLibrary.length === 0 ? (
                  <p style={{ fontSize: 11, color: muted }}>No music in library yet. <a href="/dashboard/music-studio" target="_blank" rel="noopener noreferrer" style={{ color: "#7c5cfc" }}>Generate music first.</a></p>
                ) : musicLibrary.map(track => {
                  const mediaUrl = `/api/media/${track.filePath}`;
                  const isSelected = selectedMusicUrl === mediaUrl;
                  return (
                    <div key={track.id} onClick={() => { setSelectedMusicUrl(mediaUrl); setSelectedMusicName(track.name); setShowMusicPicker(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isSelected ? "rgba(124,92,252,0.15)" : "#0d1117", border: `1px solid ${isSelected ? "#7c5cfc" : border}`, cursor: "pointer" }}>
                      <span style={{ fontSize: 11, color: "#fff", flex: 1 }}>{track.name}</span>
                      {isSelected && <Icon.Check style={{ width: 10, height: 10, color: "#7c5cfc", flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sound Effects Browser */}
          <div style={{ marginBottom: 20, background: "#080b10", borderRadius: 12, padding: 16, border: "1px solid #1e2a35" }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>Sound Effects</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["freesound", "elevenlabs"] as const).map(t => (
                <button key={t} onClick={() => setSoundTab(t)}
                  style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${soundTab === t ? "#00d4ff" : border}`, background: soundTab === t ? "rgba(0,212,255,0.1)" : "transparent", color: soundTab === t ? "#00d4ff" : muted, fontSize: 10, cursor: "pointer" }}>
                  {t === "freesound" ? "Freesound Library" : "AI Generate SFX"}
                </button>
              ))}
            </div>
            {soundTab === "freesound" && (
              <div>
                {fsNoKey && <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 10 }}><p style={{ fontSize: 11, color: "#f59e0b" }}>Freesound API key not configured.</p></div>}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={fsQuery} onChange={e => setFsQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFreesound()}
                    placeholder="Search: beat drop, crowd, vinyl..." style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 12 }} />
                  <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                    style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: fsSearching ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 11, fontWeight: 700, cursor: fsSearching ? "not-allowed" : "pointer" }}>
                    {fsSearching ? "..." : "Search"}
                  </button>
                </div>
                {fsResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                    {fsResults.map(sound => (
                      <div key={sound.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#0d1117", border: "1px solid #1e2a35" }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{sound.name}</p>
                          <p style={{ fontSize: 9, color: muted }}>{sound.duration.toFixed(1)}s · {sound.username}</p>
                        </div>
                        <button onClick={() => setSfxPreviewId(sfxPreviewId === sound.id ? null : sound.id)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(0,212,255,0.4)", background: "transparent", color: "#00d4ff", cursor: "pointer" }}>
                          {sfxPreviewId === sound.id ? "▐▐" : "▶"}
                        </button>
                        {sfxPreviewId === sound.id && <audio src={sound.previewUrl} autoPlay onEnded={() => setSfxPreviewId(null)} style={{ display: "none" }} />}
                        <button onClick={() => saveFreesound(sound)} disabled={fsSaving === sound.id || fsSaved.has(sound.id)}
                          style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: fsSaved.has(sound.id) ? "rgba(34,197,94,0.15)" : "transparent", color: fsSaved.has(sound.id) ? "#22c55e" : muted, cursor: "pointer", fontWeight: 600 }}>
                          {fsSaved.has(sound.id) ? "Saved" : fsSaving === sound.id ? "..." : "Save"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {soundTab === "elevenlabs" && (
              <div>
                <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Describe a sound effect and ElevenLabs AI will generate it.</p>
                <input value={sfxDesc} onChange={e => setSfxDesc(e.target.value)} placeholder="e.g. Crowd cheering at concert, bass drop" style={{ ...inputStyle, marginBottom: 8 }} />
                <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: sfxGenerating ? "#2a2a40" : "#7c5cfc", color: "#fff", fontSize: 11, fontWeight: 700, cursor: sfxGenerating ? "not-allowed" : "pointer" }}>
                  {sfxGenerating ? "Generating SFX..." : "Generate SFX"}
                </button>
                {sfxGeneratedUrl && <audio src={sfxGeneratedUrl} controls style={{ width: "100%", marginTop: 10 }} />}
              </div>
            )}
          </div>

          <button onClick={() => setActiveTab("assembly")} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#22c55e", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>→ Go to Assembly</button>
        </div>
      )}

      {/* ═══ SONG TAB ═══ */}
      {activeTab === "song" && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Your Song</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["upload", "generate", "library"] as const).map(s => (
              <button key={s} onClick={() => setSongSource(s)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${songSource === s ? "#00d4ff" : border}`, background: songSource === s ? "rgba(0,212,255,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>{s === "library" ? "From Library" : s === "generate" ? "Generate New" : "Upload Song"}</p>
              </button>
            ))}
          </div>

          {songSource === "upload" && (
            <div style={{ border: `2px dashed ${border}`, borderRadius: 16, padding: 40, textAlign: "center", cursor: "pointer", marginBottom: 20 }}
              onClick={() => document.getElementById("songUpload")?.click()}>
              <Icon.Music style={{ width: 28, height: 28, color: muted, marginBottom: 8 }} />
              <p style={{ fontSize: 14, color: muted }}>Upload MP3, WAV, or AAC</p>
              <input id="songUpload" type="file" accept="audio/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setSongFile(f); setSongUrl(URL.createObjectURL(f)); setSongTitle(f.name.replace(/\.[^.]+$/, "")); } }} />
              {songFile && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>Selected: {songFile.name}</p>}
            </div>
          )}

          {songSource === "generate" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Create your song first in the <a href="/dashboard/music-video" style={{ color: "#00d4ff", textDecoration: "none" }}>Music Studio</a>, then come back here to plan the video.</p>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Song Title</label>
            <input value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="e.g. City Lights" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Lyrics (optional — helps with lyric timing)</label>
            <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={4}
              placeholder="Paste your lyrics here..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {songUrl && (
            <div style={{ marginBottom: 16 }}>
              <audio src={songUrl} controls style={{ width: "100%" }} />
            </div>
          )}

          {/* ── Expand with AI Intelligence ── */}
          <div style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#00d4ff", marginBottom: 4 }}>Expand with AI Intelligence</p>
            <p style={{ fontSize: 11, color: muted, marginBottom: 10 }}>AI reads your song and lyrics and automatically builds storyboard scenes, extracts mood, and plans the visual narrative.</p>
            <button onClick={expandStory} disabled={expanding || (!songTitle.trim() && !lyrics.trim())}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: expanding ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 12, fontWeight: 700, cursor: expanding ? "not-allowed" : "pointer" }}>
              {expanding ? "AI Expanding..." : "Expand with AI Intelligence"}
            </button>
            {lastAction.includes("AI") && <p style={{ fontSize: 10, color: muted, marginTop: 6 }}>{lastAction}</p>}
          </div>

          <button onClick={() => setActiveTab("analysis")} disabled={!songTitle.trim()}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: songTitle.trim() ? "#00d4ff" : "#2a2a40", color: "#000", fontSize: 16, fontWeight: 700, cursor: songTitle.trim() ? "pointer" : "not-allowed" }}>
            Next — Choose Video Mode →
          </button>
        </div>
      )}

      {/* ═══ ANALYSIS TAB (Mode + AI) ═══ */}
      {activeTab === "analysis" && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>What kind of music video?</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 24 }}>
            {VIDEO_MODES.map(m => (
              <button key={m.id} onClick={() => setVideoMode(m.id)}
                style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${videoMode === m.id ? ds.color.lilac : border}`, background: videoMode === m.id ? `${ds.color.lilac}08` : "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                  <p style={{ fontSize: 10, color: muted }}>{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <label style={labelStyle}>Visual Style</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {VISUAL_STYLES.map(s => (
              <button key={s} onClick={() => setVisualStyle(s)}
                style={{ padding: "7px 14px", borderRadius: 100, border: `1px solid ${visualStyle === s ? "#00d4ff" : border}`, background: visualStyle === s ? "rgba(0,212,255,0.1)" : "transparent", color: visualStyle === s ? "#00d4ff" : muted, fontSize: 12, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Artist / Brand Name (optional)</label>
            <input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="For title cards and branding" style={inputStyle} />
          </div>

          {/* Narration intro/outro */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Narration Intro / Outro (optional)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Intro voiceover</p>
                <input placeholder="e.g. 'Presenting the official video for...'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Outro voiceover</p>
                <input placeholder="e.g. 'Stream now on all platforms'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["No Narration", "AI Voice", "My Voice"].map(v => (
                <button key={v} style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Commercial promo controls — only show when commercial mode selected */}
          {videoMode === "commercial" && (
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 14, background: "rgba(255,107,53,0.04)", border: "1px solid rgba(255,107,53,0.15)" }}>
              <p style={{ ...labelStyle, color: "#ff6b35" }}>Commercial Promo Controls</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>CTA Text</p>
                  <input placeholder="e.g. 'Order Now', 'Visit Us'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>WhatsApp / Contact</p>
                  <input placeholder="+234 800 000 0000" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Website (optional)</p>
                  <input placeholder="www.yourbrand.com" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Logo</p>
                  <div style={{ border: `1px dashed ${border}`, borderRadius: 8, padding: "8px 12px", textAlign: "center", cursor: "pointer", fontSize: 10, color: muted }}>
                    Upload logo
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Show CTA Card", "Show WhatsApp", "Show Logo", "Show Website"].map(opt => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: muted, cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: "#ff6b35" }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* GHS AI Tier */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <p style={{ ...labelStyle, marginBottom: 0 }}>AI Quality</p>
              <span title="Free = Local LLM (no cost) · Standard = Claude Haiku (low cost) · Pro = Claude Sonnet (billed)" style={{ fontSize: 12, color: "#505070", cursor: "default" }}>ⓘ</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {([
                { badge: "FREE", label: "GHS Free",     color: "#22c55e", provider: "ollama",                          desc: "Local · No cost" },
                { badge: "STD",  label: "GHS Standard", color: "#3b82f6", provider: "claude:claude-haiku-4-5-20251001", desc: "Fast · Low cost" },
                { badge: "PRO",  label: "GHS Pro",      color: "#a855f7", provider: "claude:claude-sonnet-4-6",         desc: "Best quality" },
              ] as const).map(t => {
                const isActive = storyAiProvider === t.provider;
                return (
                  <button key={t.badge} onClick={() => setStoryAiProvider(t.provider)}
                    style={{ padding: "10px 6px", borderRadius: 10, border: `1px solid ${isActive ? t.color : border}`, background: isActive ? `${t.color}15` : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: t.color }}>{t.badge}</span>
                    <span style={{ fontSize: 9, color: isActive ? "#e0dcff" : muted, textAlign: "center" as const }}>{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveTab("song")} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>← Song</button>
            <button onClick={analyzeSong} disabled={!videoMode || analyzing}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (!videoMode || analyzing) ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              {analyzing ? "AI Analyzing Song..." : "Analyze Song & Plan Video"}
            </button>
          </div>
        </div>
      )}

      {/* Analysis results shown inline in analysis tab */}
      {activeTab === "analysis" && analysis && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Song Analysis</h2>

          {/* Core stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Energy", value: analysis.energy },
              { label: "Mood", value: analysis.mood },
              { label: "Genre", value: analysis.genre || "—" },
              { label: "Sections", value: analysis.sections.split(",").length + " parts" },
            ].map(a => (
              <div key={a.label} style={{ background: "#080b10", borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 9, color: "#00d4ff", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>{a.label}</p>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 600, textTransform: "capitalize" as const }}>{a.value}</p>
              </div>
            ))}
          </div>

          {/* Extended stats */}
          {(analysis.bpm || analysis.danceability || analysis.cameraStyle || analysis.recommendedModel) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {analysis.bpm && (
                <div style={{ background: "#080b10", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 9, color: "#ec4899", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>BPM</p>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{analysis.bpm}</p>
                </div>
              )}
              {analysis.danceability != null && (
                <div style={{ background: "#080b10", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 9, color: "#ec4899", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Danceability</p>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{Math.round(analysis.danceability * 100)}%</p>
                </div>
              )}
              {analysis.cameraStyle && (
                <div style={{ background: "#080b10", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 9, color: "#f59e0b", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Camera Style</p>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{analysis.cameraStyle}</p>
                </div>
              )}
              {analysis.recommendedModel && (
                <div style={{ background: "#080b10", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 9, color: "#a855f7", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>Recommended Model</p>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{analysis.recommendedModel}</p>
                </div>
              )}
            </div>
          )}

          {/* Song sections breakdown */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ ...labelStyle }}>Song Sections (drives storyboard)</p>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {analysis.sections.split(",").map((sec, i) => (
                <span key={i} style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff", fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const }}>
                  {i + 1}. {sec.trim()}
                </span>
              ))}
            </div>
          </div>

          {/* AI Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ ...labelStyle }}>AI Suggestions</p>
              {analysis.suggestions.map((s, i) => (
                <p key={i} style={{ fontSize: 12, color: "#e0e0f0", marginBottom: 6 }}>• {s}</p>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={generateStoryboard} disabled={storyboardLoading}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: storyboardLoading ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 16, fontWeight: 700, cursor: storyboardLoading ? "not-allowed" : "pointer" }}>
              {storyboardLoading ? "Building Storyboard..." : "Generate Storyboard from Analysis"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ AID MODEL PICKER MODAL ═══ */}
      {showAidPicker && (() => {
        const AID_MODELS = AID_VIDEO_MODELS;
        const IMAGE_MODELS_AID = AID_IMAGE_MODELS;
        type StyleKey = "all"|"2d"|"3d"|"cartoon"|"realistic";
        const ADVISER: Record<StyleKey, { title:string; msg:string; cheapestId:string; bestId:string; bestLabel:string }> = {
          all:      { title:"All Models",             msg:"Showing all models sorted by price. MuAPI is 40–58% cheaper than FAL for the same quality tier.",                                                     cheapestId:"segmind_pruna_video",  bestId:"fal_kling_3_pro",        bestLabel:"Top Overall" },
          "2d":     { title:"2D / Illustration Style", msg:"Seedance 2.0 (MuAPI) is the best model for 2D flat animation — clean outlines, flat colour fills, smooth motion.",       cheapestId:"muapi_seedance_v1_pro", bestId:"muapi_seedance_v2_1080p", bestLabel:"Best 2D" },
          "3d":     { title:"3D / Cinematic Style",    msg:"Kling 2.5 Direct ★ is the best 3D model — direct API, no FAL overhead.",                                                  cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_std",  bestLabel:"Best 3D Direct" },
          cartoon:  { title:"Cartoon / Animated",      msg:"Seedance 2.0 (MuAPI) at $0.08 is the best cartoon model. Hailuo Pro is the best cartoon on FAL.",                          cheapestId:"muapi_seedance_v1_pro", bestId:"fal_hailuo_pro",          bestLabel:"Best Cartoon" },
          realistic:{ title:"Realistic / Photorealistic",msg:"Kling 2.5 Pro Direct ★ ($0.20) is the most realistic direct API option.",                                               cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_pro",  bestLabel:"Most Realistic" },
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

      {/* ═══ STORYBOARD TAB ═══ */}
      {activeTab === "storyboard" && (
        <div>
          {storyboard.length === 0 && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Icon.Film style={{ width: 40, height: 40, color: muted, marginBottom: 12 }} />
              <p style={{ color: "#5a7080", marginBottom: 16 }}>No storyboard yet. Complete song & analysis first, then generate.</p>
              <button onClick={generateStoryboard} disabled={storyboardLoading || !analysis} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: analysis ? "#ec4899" : "#2a2a40", color: analysis ? "#fff" : "#5a7080", fontSize: 13, fontWeight: 700, cursor: analysis ? "pointer" : "not-allowed" }}>
                {storyboardLoading ? "Building..." : "Generate Storyboard"}
              </button>
            </div>
          )}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Storyboard — {storyboard.length} scenes</h2>
              <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>{videoMode}</span>
            </div>

            {/* ── AID Model Picker buttons ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(124,92,252,0.4)", background: "rgba(124,92,252,0.1)", color: "#7c5cfc", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Video Model: <span style={{ color: "#fff" }}>{selectedVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid rgba(0,212,255,0.4)", background: "rgba(0,212,255,0.1)", color: "#00d4ff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Image Model: <span style={{ color: "#fff" }}>{selectedImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button
                disabled={runningIntelligence || storyboard.length === 0}
                onClick={runSceneIntelligence}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4ade8030", background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}
              >
                {runningIntelligence ? "Detecting..." : "Scene Intelligence"}
              </button>
              <button
                disabled={loadingAutoTimestamp || storyboard.length === 0}
                onClick={runAutoTimestamp}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #7c5cfc30", background: loadingAutoTimestamp ? "#1a1a2a" : "#0d0d1a", color: "#7c5cfc", fontSize: 10, fontWeight: 700, cursor: loadingAutoTimestamp ? "not-allowed" : "pointer", opacity: loadingAutoTimestamp ? 0.6 : 1 }}
              >
                {loadingAutoTimestamp ? "Timestamping..." : "Auto Time Stamp"}
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

            {/* ── Auto Time Stamp Results ── */}
            {autoTimestampPlan && (
              <div style={{ margin: "12px 0", padding: "12px 16px", borderRadius: 10, background: "#7c5cfc08", border: "1px solid #7c5cfc30" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#7c5cfc" }}>
                    Auto Time Stamp — {autoTimestampPlan.segmentCount} segments · {autoTimestampPlan.totalDuration.toFixed(1)}s
                  </span>
                  <button onClick={() => setAutoTimestampPlan(null)} style={{ padding: "2px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>
                    Clear
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                  {autoTimestampPlan.segments.map(seg => (
                    <div key={seg.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 10 }}>
                      <span style={{ color: "#7c5cfc", fontFamily: "monospace", minWidth: 80 }}>{seg.startTime.toFixed(1)}–{seg.endTime.toFixed(1)}s</span>
                      <span style={{ color: "#fff", fontWeight: 600, minWidth: 120 }}>{seg.title}</span>
                      <span style={{ color: muted, flex: 1 }}>{seg.narrationText.slice(0, 80)}{seg.narrationText.length > 80 ? "…" : ""}</span>
                      <span style={{ color: muted, fontFamily: "monospace" }}>{seg.duration.toFixed(1)}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {storyboard.map(s => (
              <div key={s.scene} style={{ padding: "14px 0", borderBottom: `1px solid ${border}` }}>
                <div style={{ display: "flex", gap: 12 }}>
                  {/* Scene thumbnail or number */}
                  <div style={{ width: 64, height: 48, borderRadius: 8, background: "#080b10", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: `1px solid ${sceneImages[s.scene] ? "rgba(0,212,255,0.3)" : border}` }}>
                    {sceneImages[s.scene]
                      ? <img src={sceneImages[s.scene]} alt={`Scene ${s.scene}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 14, fontWeight: 700, color: muted }}>{s.scene}</span>
                    }
                  </div>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setSelectedScene(selectedScene === s.scene ? null : s.scene)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.section}</p>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: muted }}>{s.duration}</span>
                        {s.status === "generated" && <span style={{ fontSize: 9, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>Image Ready</span>}
                        <span style={{ fontSize: 9, color: muted, background: "#080b10", padding: "2px 6px", borderRadius: 8 }}>{s.genMethod}</span>
                      </div>
                    </div>
                    {selectedScene === s.scene ? (
                      <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                        <textarea value={s.prompt} onChange={e => setStoryboard(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, prompt: e.target.value } : sc))}
                          rows={2} style={{ ...inputStyle, fontSize: 11, padding: "6px 8px", marginBottom: 6 }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <input value={s.movement} onChange={e => setStoryboard(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, movement: e.target.value } : sc))}
                            style={{ ...inputStyle, fontSize: 10, padding: "4px 8px", flex: 1 }} placeholder="Movement" />
                          <input value={s.caption} onChange={e => setStoryboard(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, caption: e.target.value } : sc))}
                            style={{ ...inputStyle, fontSize: 10, padding: "4px 8px", flex: 1 }} placeholder="Caption/Lyric line" />
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>{s.prompt.slice(0, 90)}{s.prompt.length > 90 ? "…" : ""}</p>
                    )}
                    {s.caption && selectedScene !== s.scene && (
                      <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 3, fontStyle: "italic" }}>"{s.caption.slice(0, 60)}"</p>
                    )}
                    {(() => {
                      const intel = sceneIntelligence[String(s.scene)];
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
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignSelf: "center" }}>
                    <button
                      onClick={() => makeSceneImage(s)}
                      disabled={generatingImage !== null}
                      style={{
                        fontSize: 10, padding: "6px 10px", borderRadius: 8,
                        background: sceneImages[s.scene] ? "rgba(34,197,94,0.1)" : "rgba(0,212,255,0.1)",
                        border: `1px solid ${sceneImages[s.scene] ? "rgba(34,197,94,0.3)" : "rgba(0,212,255,0.3)"}`,
                        color: sceneImages[s.scene] ? "#22c55e" : "#00d4ff",
                        cursor: generatingImage !== null ? "not-allowed" : "pointer",
                        fontWeight: 600, whiteSpace: "nowrap" as const,
                      }}>
                      {generatingImage === s.scene ? "..." : sceneImages[s.scene] ? "Re-gen" : "Gen Image"}
                    </button>
                    <button
                      onClick={() => makeSceneVideo(s)}
                      disabled={!sceneImages[s.scene] || generatingSceneVideos.has(`mv_sc${s.scene}`)}
                      style={{
                        fontSize: 10, padding: "6px 10px", borderRadius: 8,
                        background: sceneVideos[`mv_sc${s.scene}`] ? "rgba(124,92,252,0.15)" : "rgba(124,92,252,0.08)",
                        border: "1px solid rgba(124,92,252,0.3)", color: "#7c5cfc",
                        cursor: (!sceneImages[s.scene] || generatingSceneVideos.has(`mv_sc${s.scene}`)) ? "not-allowed" : "pointer",
                        fontWeight: 600, whiteSpace: "nowrap" as const, opacity: !sceneImages[s.scene] ? 0.4 : 1,
                      }}>
                      {generatingSceneVideos.has(`mv_sc${s.scene}`) ? "..." : sceneVideos[`mv_sc${s.scene}`] ? "New Video" : "Make Video"}
                    </button>
                  </div>
                </div>
                {sceneGenProgress[`mv_sc${s.scene}`] && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 3, background: border, borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${sceneGenProgress[`mv_sc${s.scene}`].percent}%`, background: "#7c5cfc", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 9, color: muted }}>{sceneGenProgress[`mv_sc${s.scene}`].message}</span>
                  </div>
                )}
                {sceneVideos[`mv_sc${s.scene}`] && (
                  <video src={sceneVideos[`mv_sc${s.scene}`]} controls style={{ width: "100%", borderRadius: 8, marginTop: 6, maxHeight: 100 }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveTab("analysis")} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>← Analysis</button>
            <button onClick={() => setActiveTab("assembly")}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: "#22c55e", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Approve Storyboard → Assembly
            </button>
          </div>
        </div>
      )}

      {/* ═══ ASSEMBLY TAB ═══ */}
      {activeTab === "assembly" && (
        <div style={cardStyle}>
          {storyboard.length === 0 && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#5a7080" }}>No storyboard yet. Build your storyboard first.</p>
              <button onClick={() => setActiveTab("storyboard")} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, border: "none", background: "#ec4899", color: "#fff", fontSize: 12, cursor: "pointer" }}>← Go to Storyboard</button>
            </div>
          )}
          {storyboard.length > 0 && (<>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Render Queue</h2>

          {/* ── Saved Cuts panel ── */}
          {savedCuts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowCutsPanel(p => !p)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", background: showCutsPanel ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.06)", color: "#f59e0b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Icon.Folder style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>Saved Cuts ({savedCuts.length})</span>
                <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap", flex: 1 }}>
                  {savedCuts.map(c => <span key={c.name} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>{c.name}</span>)}
                </div>
                <span style={{ fontSize: 10, color: muted }}>{showCutsPanel ? "▲ Close" : "▼ Open"}</span>
              </button>
              {showCutsPanel && (
                <div style={{ background: surface, border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: 12, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {savedCuts.map((c, ci) => (
                    <div key={c.name}
                      onClick={() => { setAssemblyName(c.name); if (c.videoUrl) setAssembledUrl(c.videoUrl); setShowCutsPanel(false); setLastAction(`Loaded cut: "${c.name}"`); }}
                      style={{ background: "#080b10", borderRadius: 10, border: `2px solid ${assemblyName === c.name ? "#f59e0b" : border}`, padding: 10, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {c.videoUrl ? <Icon.Film style={{ width: 13, height: 13, flexShrink: 0 }} /> : <Icon.Grid style={{ width: 13, height: 13, flexShrink: 0 }} />}
                        <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? "#f59e0b" : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => { const next = prev.filter((_, i) => i !== ci); try { localStorage.setItem("ghs_mv_cuts", JSON.stringify(next)); } catch {} return next; }); }}
                          style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}><Icon.X style={{ width: 10, height: 10 }} /></button>
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
                <label style={labelStyle}>Music Video / Cut Name</label>
                <input type="text" value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="Main Cut, Director's Cut, Lyric Version..."
                  style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }} />
              </div>
              <button
                onClick={() => {
                  if (!assemblyName.trim()) return;
                  setSavedCuts(prev => {
                    const sceneIds = storyboard.map((s, i) => `mv_sc${i + 1}`);
                    const existing = prev.findIndex(c => c.name === assemblyName);
                    const cut = { name: assemblyName, sceneIds, videoUrl: assembledUrl ?? undefined, savedAt: new Date().toISOString() };
                    const next = existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
                    try { localStorage.setItem("ghs_mv_cuts", JSON.stringify(next)); } catch {}
                    return next;
                  });
                  setLastAction(`Cut "${assemblyName}" saved`);
                }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
                Save Cut
              </button>
            </div>
          </div>

          {/* Model selector */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>Video AI Model</p>
            <p style={{ fontSize: 10, color: "#3d5060", marginBottom: 8 }}>Music Video & Dance</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
              {[
                { id: "seedance", label: "SeeDance 2.0", cost: "2 credits/scene", badge: "Dance" },
                { id: "kling25-turbo", label: "Kling 2.5 Turbo", cost: "3 credits/scene" },
                { id: "hailuo-pro", label: "Hailuo Pro", cost: "4 credits/scene" },
              ].map(m => (
                <button key={m.id} onClick={() => setVideoModel(m.id)}
                  style={{ padding: "10px 10px", borderRadius: 10, border: `1px solid ${videoModel === m.id ? "#00d4ff" : border}`, background: videoModel === m.id ? "rgba(0,212,255,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                  <p style={{ fontSize: 9, color: muted }}>{m.cost}</p>
                  {m.badge && <span style={{ fontSize: 8, color: "#00d4ff" }}>{m.badge}</span>}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: "#3d5060", marginBottom: 6 }}>Budget & Animation</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { id: "wan25", label: "Wan 2.5", cost: "1 credit/scene", badge: "Cheapest" },
                { id: "kling2", label: "Kling 2.1", cost: "1 credit/scene", badge: "Best price" },
                { id: "hailuo-fast", label: "Hailuo Fast", cost: "2 credits/scene", badge: "Fastest" },
              ].map(m => (
                <button key={m.id} onClick={() => setVideoModel(m.id)}
                  style={{ padding: "10px 10px", borderRadius: 10, border: `1px solid ${videoModel === m.id ? "#22c55e" : border}`, background: videoModel === m.id ? "rgba(34,197,94,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                  <p style={{ fontSize: 9, color: muted }}>{m.cost}</p>
                  {m.badge && <span style={{ fontSize: 8, color: "#22c55e" }}>{m.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Scenes */}
          {storyboard.map(s => (
            <div key={s.scene} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, marginBottom: 4, background: "#080b10", border: `1px solid ${s.status === "generated" ? "rgba(34,197,94,0.3)" : border}` }}>
              <span style={{ fontSize: 12, color: "#fff" }}>Scene {s.scene}: {s.section}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {s.status === "generated" && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>Done</span>}
                {s.status === "generating" && <span style={{ fontSize: 9, color: accent, fontWeight: 600 }}>Rendering...</span>}
                {s.status === "planned" && (
                  <button onClick={() => renderSingleScene(s.scene)} disabled={renderingScene !== null}
                    style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: `${accent}15`, color: accent, border: "none", cursor: "pointer" }}>Render</button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={async () => { for (const s of storyboard) { if (s.status === "planned") await renderSingleScene(s.scene); } }}
            disabled={renderingScene !== null}
            style={{ width: "100%", marginTop: 16, padding: 16, borderRadius: 14, border: "none", background: renderingScene !== null ? "#2a2a40" : accent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: renderingScene !== null ? "not-allowed" : "pointer" }}>
            {renderingScene !== null ? `Rendering Scene ${renderingScene}...` : "Render All Scenes"}
          </button>
          <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 8 }}>Credits charged per scene</p>

          {/* Scene selection for assembly */}
          {storyboard.length > 0 && (
            <div style={{ marginTop: 16, background: "#080b10", borderRadius: 12, padding: 14, border: "1px solid #1e2a35" }}>
              <p style={{ fontSize: 10, color: muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Select Scenes</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => setAssemblySelectedIds(storyboard.map(s => `mv_sc${s.scene}`))} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #1e2a35", background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>All</button>
                <button onClick={() => setAssemblySelectedIds([])} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #1e2a35", background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>None</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {storyboard.map(s => {
                  const id = `mv_sc${s.scene}`;
                  const selected = assemblySelectedIds.includes(id);
                  const hasContent = !!(sceneVideos[id] || sceneImages[s.scene]);
                  return (
                    <button key={id} onClick={() => setAssemblySelectedIds(prev => selected ? prev.filter(i => i !== id) : [...prev, id])}
                      style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${selected ? "#00d4ff" : border}`, background: selected ? "rgba(0,212,255,0.12)" : "transparent", color: selected ? "#00d4ff" : muted, fontSize: 10, cursor: "pointer" }}>
                      {s.scene} {s.section.slice(0, 8)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assemble final music video */}
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Assemble Music Video</p>
            {assembledUrl && (
              <div style={{ borderRadius: 8, overflow: "hidden", marginBottom: 12, border: `1px solid ${border}` }}>
                <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 280 }} />
                <a href={assembledUrl} download={`${songTitle || "music-video"}.mp4`}
                  style={{ display: "block", textAlign: "center", padding: "10px 0", background: "rgba(0,212,255,0.08)", color: "#00d4ff", fontSize: 12, fontWeight: 700, textDecoration: "none", borderTop: `1px solid ${border}` }}>
                  ⬇ Download Music Video
                </a>
              </div>
            )}

            {/* Primary assembleMovie (uses scene videos + images) */}
            <button
              onClick={assembleMovie}
              disabled={assembling || storyboard.length === 0}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: assembling ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 15, fontWeight: 700, cursor: (assembling || storyboard.length === 0) ? "not-allowed" : "pointer", marginBottom: 8 }}>
              {assembling ? "Assembling Music Video..." : assemblyComplete ? "Re-assemble Music Video" : `Assemble Music Video (${assemblySelectedIds.length || storyboard.length} scenes)`}
            </button>

            {/* Legacy image-based assembly */}
            {sceneImageCount > 0 && (
              <button
                onClick={assembleMusicVideo}
                disabled={assembling}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: assembling ? "#2a2a40" : "#ec4899", color: "#fff", fontSize: 13, fontWeight: 700, cursor: assembling ? "not-allowed" : "pointer", marginBottom: 8 }}>
                {assembling ? "..." : `Image Slideshow Assembly (${sceneImageCount} images + music)`}
              </button>
            )}

            {sceneImageCount === 0 && storyboard.length === 0 && (
              <p style={{ fontSize: 12, color: muted, textAlign: "center" }}>Generate scene images or render scenes first.</p>
            )}
            <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Merges scenes with your music track. Auto-saved to Asset Library.</p>
          </div>
          </>)}
        </div>
      )}
      </div>
    </div>
  );
}
