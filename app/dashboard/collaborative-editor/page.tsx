"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createEmptyAssembly, type AssemblyJSON, type AssemblySegment, type NarrationEntry, type MusicEntry, type SFXEntry, type OverlayEntry } from "@/lib/assembly-schema";
import TimelineEngine, { assemblyToTimelineClips } from "../../components/TimelineEngine";
import ReviewPanels from "../../components/ReviewPanels";
import KeyboardShortcutsPanel from "../../components/KeyboardShortcutsPanel";
import CharacterPicker from "../../components/CharacterPicker";
import CharacterSavePrompt from "../../components/CharacterSavePrompt";
import AudioPreview from "../../components/AudioPreview";
import SceneImagePanel from "../../components/SceneImagePanel";
import { useToast } from "../../components/Toast";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Semi-AI Collaborative Editor — REBUILT FROM SCRATCH
//
// Architecture (from Semi-AI Master Canvas):
// - Assembly JSON = source of truth (not demo data, not hardcoded clips)
// - User Instruction → Change Planner → State Update → Preview → Review
// - AI plans. FFmpeg executes. Deterministic.
// - Every button wired. Every control saves state. Every action calls real API.
//
// Flow: Import media → Review → Edit (instruction or controls) → Assemble → Export
// ═══════════════════════════════════════════════════════════════════════════

const s1 = "#0b0e18"; const s2 = "#10141f"; const border = "#1e2a35";
const text = "#dde4f0"; const muted = "#4e6080"; const purple = "#a855f7";
const green = "#22c55e"; const gold = "#f59e0b"; const red = "#ef4444"; const cyan = "#00d4ff";

export default function CollaborativeEditorPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: muted }}>Loading Editor...</div>}><Editor /></Suspense>;
}

function Editor() {
  const params = useSearchParams();
  const { toast } = useToast();

  // ── Core state: Assembly JSON is source of truth ──
  const [assembly, setAssembly] = useState<AssemblyJSON>(createEmptyAssembly("new", "collaborative", "Untitled Project"));
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [tab, setTab] = useState<"ai" | "scene" | "audio" | "history">("ai");

  // ── Media ──
  const [mediaUrl, setMediaUrl] = useState(""); // current segment's playable URL
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // ── Web Audio API for LIVE volume control ──
  const audioCtxRef = useRef<AudioContext | null>(null);
  const videoSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const videoGainRef = useRef<GainNode | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationGainRef = useRef<GainNode | null>(null);
  const narrationSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sfxAudiosRef = useRef<Map<string, { audio: HTMLAudioElement; gain: GainNode; source: MediaElementAudioSourceNode }>>(new Map());
  // Stable refs for assembly audio data — prevents useEffect re-runs when assembly state updates
  const assemblyMusicRef = useRef<MusicEntry[]>([]);
  const assemblyNarrationRef = useRef<NarrationEntry[]>([]);
  const assemblySfxRef = useRef<SFXEntry[]>([]);

  // Keep refs in sync with assembly sub-arrays (prevents effect re-runs on assembly updates)
  // Note: useSyncRef is defined below after all useState declarations — using useEffect directly here
  useEffect(() => { assemblyMusicRef.current = assembly.music; }, [assembly.music]);
  useEffect(() => { assemblyNarrationRef.current = assembly.narration; }, [assembly.narration]);
  useEffect(() => { assemblySfxRef.current = assembly.sfx; }, [assembly.sfx]);

  // Initialize AudioContext lazily (requires user gesture)
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Connect video element to Web Audio API for live volume control
  const connectVideoToAudio = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const ctx = getAudioCtx();
    // Only create source once per video element
    if (!videoSourceRef.current) {
      videoSourceRef.current = ctx.createMediaElementSource(v);
      videoGainRef.current = ctx.createGain();
      videoSourceRef.current.connect(videoGainRef.current);
      videoGainRef.current.connect(ctx.destination);
    }
  }, [getAudioCtx]);

  // Setup music audio element with Web Audio gain
  const setupMusicAudio = useCallback((url: string, volume: number) => {
    const ctx = getAudioCtx();
    if (!musicAudioRef.current) {
      musicAudioRef.current = new Audio();
      musicAudioRef.current.crossOrigin = "anonymous";
      musicAudioRef.current.loop = true;
    }
    // Only create source node once per audio element
    if (!musicSourceRef.current && musicAudioRef.current) {
      musicSourceRef.current = ctx.createMediaElementSource(musicAudioRef.current);
      musicGainRef.current = ctx.createGain();
      musicSourceRef.current.connect(musicGainRef.current);
      musicGainRef.current.connect(ctx.destination);
    }
    if (musicAudioRef.current.src !== new URL(url, window.location.href).href) {
      musicAudioRef.current.src = url;
    }
    if (musicGainRef.current) musicGainRef.current.gain.value = volume;
  }, [getAudioCtx]);

  // Setup narration audio element with Web Audio gain
  const setupNarrationAudio = useCallback((url: string, volume: number) => {
    const ctx = getAudioCtx();
    if (!narrationAudioRef.current) {
      narrationAudioRef.current = new Audio();
      narrationAudioRef.current.crossOrigin = "anonymous";
    }
    if (!narrationSourceRef.current && narrationAudioRef.current) {
      narrationSourceRef.current = ctx.createMediaElementSource(narrationAudioRef.current);
      narrationGainRef.current = ctx.createGain();
      narrationSourceRef.current.connect(narrationGainRef.current);
      narrationGainRef.current.connect(ctx.destination);
    }
    if (narrationAudioRef.current.src !== new URL(url, window.location.href).href) {
      narrationAudioRef.current.src = url;
    }
    if (narrationGainRef.current) narrationGainRef.current.gain.value = volume;
  }, [getAudioCtx]);

  // Live volume updaters — change GainNode in real time
  const setLiveMusicVolume = useCallback((vol: number) => {
    if (musicGainRef.current) musicGainRef.current.gain.value = vol;
  }, []);
  const setLiveNarrationVolume = useCallback((vol: number) => {
    if (narrationGainRef.current) narrationGainRef.current.gain.value = vol;
  }, []);
  const setLiveSfxVolume = useCallback((vol: number) => {
    sfxAudiosRef.current.forEach(({ gain }) => { gain.gain.value = vol; });
  }, []);

  // ── GHS Intelligence Tier ──
  const [tier, setTier] = useState<"standard" | "pro" | "premium" | "premium_best">("pro");

  // ── Creation Mode ──
  // ghs_invtext = pure text+background video (NO AI) — colourful backgrounds + text overlay
  // ghs_hybrid  = AI Image + AI Video mixed together
  // text_to_video = AI text-to-video generation (Kling/Hailuo behind GHS branding)
  // ai_motion = user uploads video/image for AI to clone/animate (image-to-video, video-to-video)
  type CreationMode = "ghs_invtext" | "ghs_hybrid" | "text_to_video" | "ai_motion";
  const [creationMode, setCreationMode] = useState<CreationMode>("text_to_video");
  const [showAdvancedModels, setShowAdvancedModels] = useState(false);

  // ── AI Motion sub-mode ──
  type MotionStep = "video_to_video" | "image_to_video" | "image_video_to_video";
  const [motionStep, setMotionStep] = useState<MotionStep | null>(null);
  const [motionRefImageUrl, setMotionRefImageUrl] = useState("");
  const [motionRefVideoUrl, setMotionRefVideoUrl] = useState("");

  // ── Hybrid Pipeline Wizard ──
  const [hybridStep, setHybridStep] = useState<1 | 2 | 3 | 4>(1);
  const [hybridExpansion, setHybridExpansion] = useState<{ summary: string; characters: Array<{ id: string; name: string; role: string }>; locations: string[]; moods: string[] } | null>(null);
  const [hybridScenes, setHybridScenes] = useState<Array<{ id: string; title: string; type: "image-led" | "video-led" | "hybrid" | "audio-bridge" | "image-to-video"; characters: string[]; narration: string; estimatedCost: number }>>([]);
  const [hybridProjectId, setHybridProjectId] = useState<string>("");
  const [hybridValidation, setHybridValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [hybridProcessing, setHybridProcessing] = useState(false);
  const [hybridStoryInput, setHybridStoryInput] = useState("");
  const [hybridDuration, setHybridDuration] = useState("1min");
  const [hybridAudience, setHybridAudience] = useState("general");
  const [hybridCostPref, setHybridCostPref] = useState("balanced");

  // ── In/Out trim points ──
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);

  // ── Drag-to-reorder ──
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Scene Folder expansion (DaVinci-style) ──
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const toggleFolder = (idx: number) => setExpandedFolders(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });

  // ── CSS Design Panel for InvText slides ──
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // All available design styles
  const DESIGN_STYLES = [
    { id: "kinetic", name: "Kinetic Typography", desc: "Words flow & dance around hero text", icon: "💫" },
    { id: "neon", name: "Neon Glow", desc: "Electric glowing text on dark bg", icon: "⚡" },
    { id: "glass", name: "Glassmorphism", desc: "Frosted glass card with blur", icon: "🧊" },
    { id: "engrave", name: "Engraved", desc: "Text pressed into surface", icon: "🔨" },
    { id: "retro", name: "Retro Pop", desc: "Bold shadow, vintage feel", icon: "🎸" },
    { id: "outline", name: "Outline Stroke", desc: "Hollow text with glow border", icon: "✏️" },
    { id: "minimal", name: "Minimal Clean", desc: "Simple white text, no effects", icon: "◻️" },
    { id: "gradient_text", name: "Gradient Text", desc: "Text filled with gradient color", icon: "🌈" },
    { id: "cinema", name: "Cinematic", desc: "Letterbox bars, film grain feel", icon: "🎬" },
    { id: "magazine", name: "Magazine Cover", desc: "Bold serif, editorial layout", icon: "📰" },
    { id: "hype", name: "Hype Beast", desc: "Streetwear bold, all caps, slashed", icon: "🔥" },
    { id: "wave", name: "Wave Motion", desc: "Text on wavy animated paths", icon: "🌊" },
  ] as const;

  const [slideDesign, setSlideDesign] = useState({
    bgColor1: "#6c5ce7", bgColor2: "#a855f7", bgColor3: "#c084fc",
    bgAngle: 135,
    fontFamily: "Segoe UI",
    fontSize: 88,
    fontColor: "#ffffff",
    fontWeight: 900,
    letterSpacing: 8,
    textGlow: true,
    glowColor: "#a855f7",
    textStyle: "kinetic" as string,
    bgPattern: "flow" as "flow" | "none" | "dots" | "lines" | "circles",
    boxBg: "rgba(0,0,0,0.35)",
    showCorners: true,
    showRings: true,
  });
  const [previewText, setPreviewText] = useState("");

  // ── Chat / instruction log ──
  const [chatLog, setChatLog] = useState<Array<{ role: "user" | "ai"; text: string; approval?: { instruction: string; plan: Record<string, unknown>; meta: Record<string, unknown> } }>>([]);
  const [editInput, setEditInput] = useState("");
  const [processing, setProcessing] = useState(false);

  // ── Versions ──
  const [versions, setVersions] = useState<Array<{ label: string; desc: string; assembly: AssemblyJSON }>>([]);

  // ── Import modal ──
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "overlay" | "replace" | "blend">("append");
  const [showImportModeChoice, setShowImportModeChoice] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assetList, setAssetList] = useState<Array<{ id: string; url: string; title: string }>>([]);
  const [showReview, setShowReview] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [detectedCharacters, setDetectedCharacters] = useState<Array<{ name: string; role: string; description: string }>>([]);
  const [showAudioPreview, setShowAudioPreview] = useState(false);
  const [audioPreviewText, setAudioPreviewText] = useState("");
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [castTray, setCastTray] = useState<Array<{ id: string; characterId: string; name: string; imageUrl?: string | null; voiceName?: string | null }>>([]);
  const [showIntroMenu, setShowIntroMenu] = useState(false);
  const [showOutroMenu, setShowOutroMenu] = useState(false);
  const [introGenPrompt, setIntroGenPrompt] = useState("");
  const [outroGenPrompt, setOutroGenPrompt] = useState("");
  const [showIntroGen, setShowIntroGen] = useState(false);
  const [showOutroGen, setShowOutroGen] = useState(false);

  // Close intro/outro dropdowns when clicking outside them
  useEffect(() => {
    if (!showIntroMenu && !showOutroMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-intro-menu], [data-outro-menu]")) {
        setShowIntroMenu(false);
        setShowOutroMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showIntroMenu, showOutroMenu]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["narration", "music", "sfx"]));
  const toggleSection = (s: string) => setExpandedSections(prev => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  // Sync a value to a ref on every render — used for stale-closure-safe callbacks
  function useSyncRef<T>(value: T) {
    const ref = useRef(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref;
  }
  const assemblyRef = useSyncRef(assembly);
  const activeSegIdxRef = useSyncRef(activeSegIdx);
  const importModeRef = useSyncRef(importMode);

  // ── Derived state ──
  const activeSeg = assembly.segments[activeSegIdx];
  const activeNarr = assembly.narration.find(n => n.id === `narr_${activeSegIdx}`);
  const activeMusic = assembly.music[0]; // global music track

  // ── localStorage persistence ──
  const STORAGE_KEY = "ghs_collab_editor";
  // Save session on every assembly change
  useEffect(() => {
    if (assembly.segments.length === 0) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        assembly, mediaUrl, chatLog: chatLog.slice(-20), versions: versions.slice(0, 5),
        savedAt: Date.now(),
      }));
    } catch { /* quota */ }
  }, [assembly, mediaUrl, chatLog, versions]);

  // Restore session on mount
  const [sessionRestored, setSessionRestored] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Array<{ id: string; title: string; scenes: number; duration: number; updatedAt: string; status: string }>>([]);

  // Load saved projects on mount
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setSavedProjects(d.projects || [])).catch(() => {});
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Date.now() - s.savedAt > 24 * 60 * 60 * 1000) { localStorage.removeItem(STORAGE_KEY); return; }
      if (s.assembly?.segments?.length > 0) {
        setAssembly(s.assembly);
        if (s.mediaUrl) setMediaUrl(s.mediaUrl);
        if (s.chatLog) setChatLog(s.chatLog);
        if (s.versions) setVersions(s.versions);
        setSessionRestored(true);
      }
    } catch { /* corrupted */ }
  }, []);

  // Sync video time + connect Web Audio
  // IMPORTANT: Uses refs for assembly data so this effect only re-runs when mediaUrl changes,
  // NOT when assembly state updates (which would tear down listeners and kill audio mid-playback)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onEnd = () => {
      setPlaying(false);
      // Stop music/narration when video ends
      if (musicAudioRef.current) musicAudioRef.current.pause();
      if (narrationAudioRef.current) narrationAudioRef.current.pause();
    };
    const onPlay = () => {
      // Connect to Web Audio on first play (user gesture)
      connectVideoToAudio();
      // Sync music playback — read from ref for latest data
      const musicData = assemblyMusicRef.current;
      if (musicAudioRef.current && musicData[0]?.sourceUrl) {
        setupMusicAudio(musicData[0].sourceUrl, musicData[0].volume ?? 0.3);
        // Clamp currentTime to music duration to avoid issues with looping tracks
        const musicEl = musicAudioRef.current;
        if (musicEl.duration && isFinite(musicEl.duration)) {
          musicEl.currentTime = v.currentTime % musicEl.duration;
        } else {
          musicEl.currentTime = v.currentTime;
        }
        musicEl.play().catch(() => {});
      }
      // Sync narration playback — read from ref for latest data
      const narrData = assemblyNarrationRef.current;
      const narrWithAudio = narrData.find(n => n.audioUrl);
      if (narrationAudioRef.current && narrWithAudio?.audioUrl) {
        setupNarrationAudio(narrWithAudio.audioUrl, narrWithAudio.volume ?? 1);
        narrationAudioRef.current.currentTime = Math.max(0, v.currentTime - (narrWithAudio.startTime || 0));
        if (v.currentTime >= (narrWithAudio.startTime || 0) && v.currentTime <= (narrWithAudio.endTime || Infinity)) {
          narrationAudioRef.current.play().catch(() => {});
        }
      }
    };
    const onPause = () => {
      if (musicAudioRef.current) musicAudioRef.current.pause();
      if (narrationAudioRef.current) narrationAudioRef.current.pause();
    };
    // Handle seeking — resync audio positions when user scrubs the video
    const onSeeked = () => {
      if (v.paused) return; // Don't restart audio if video is paused
      const t = v.currentTime;
      // Resync music position
      if (musicAudioRef.current && !musicAudioRef.current.paused) {
        const musicEl = musicAudioRef.current;
        if (musicEl.duration && isFinite(musicEl.duration)) {
          musicEl.currentTime = t % musicEl.duration;
        } else {
          musicEl.currentTime = t;
        }
      }
      // Resync narration position
      const narrData = assemblyNarrationRef.current;
      const narrWithAudio = narrData.find(n => n.audioUrl);
      if (narrationAudioRef.current && narrWithAudio) {
        const narrStart = narrWithAudio.startTime || 0;
        const narrEnd = narrWithAudio.endTime || Infinity;
        if (t >= narrStart && t <= narrEnd) {
          narrationAudioRef.current.currentTime = t - narrStart;
          narrationAudioRef.current.play().catch(() => {});
          narrationPlayingRef.current = true;
        } else {
          narrationAudioRef.current.pause();
          narrationPlayingRef.current = false;
        }
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnd); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); v.removeEventListener("seeked", onSeeked); };
  }, [mediaUrl, connectVideoToAudio, setupMusicAudio, setupNarrationAudio]);

  // ── IMPORT: upload file → analyze with ffprobe → create assembly ──
  const importFile = useCallback(async (file: File) => {
    // Upload — different endpoint for video vs image
    const fd = new FormData();
    const isVideo = file.type.startsWith("video");
    let url = "";

    let duration = 5;

    if (isVideo) {
      fd.append("video", file);
      const upRes = await fetch("/api/video-trimmer/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (upData.error) { setChatLog(p => [...p, { role: "ai", text: `Upload failed: ${upData.error}` }]); return; }
      // trimmer returns { tempPath, metadata: { duration, width, height, ... } }
      const rawPath = upData.tempPath || "";
      url = rawPath ? `/api/media/${rawPath.replace(/\\/g, "/").replace(/^.*?storage[\\/]/, "")}` : "";
      duration = Math.round(upData.metadata?.duration || 30);
    } else {
      fd.append("file", file);
      const upRes = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const upData = await upRes.json();
      url = upData.url || "";
    }
    if (!url) { setChatLog(p => [...p, { role: "ai", text: "Upload failed. Try a different file." }]); return; }

    // Build segment
    const seg: AssemblySegment = {
      id: `seg_${Date.now()}`, type: isVideo ? "video" : "image", sourceUrl: url,
      startTime: 0, endTime: duration, duration, transitionIn: "cut", transitionOut: "cut",
    };
    if (!isVideo) seg.imageTreatment = "zoom_in";

    // Use setAssembly callback to check current state (avoids stale closure)
    setAssembly(prev => {
      if (prev.segments.length > 0) {
        const next = structuredClone(prev);
        const mode = importModeRef.current;

        if (mode === "replace") {
          // Replace active segment
          const idx = activeSegIdxRef.current < next.segments.length ? activeSegIdxRef.current : 0;
          next.segments[idx] = { ...seg, startTime: next.segments[idx].startTime, endTime: next.segments[idx].startTime + duration, duration };
          let t = 0; next.segments.forEach(s => { s.startTime = t; s.endTime = t + s.duration; t += s.duration; }); next.totalDuration = t;
          setMediaUrl(url); setShowImport(false); setShowImportModeChoice(false);
          saveVersion(`Replaced scene ${idx + 1}`);
          setChatLog(p => [...p, { role: "ai", text: `Replaced scene ${idx + 1} with "${file.name}".` }]);
        } else if (mode === "blend") {
          // Blend/composite — store as overlay with blend mode for FFmpeg overlay filter
          next.overlays.push({ id: `blend_${Date.now()}`, type: "logo" as const, content: url, startTime: next.segments[activeSegIdx]?.startTime || 0, endTime: next.segments[activeSegIdx]?.endTime || duration, position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, opacity: 0.5 });
        } else if (mode === "overlay") {
          // Overlay on top — add as a PiP overlay reference (stored in overlays)
          next.overlays.push({ id: `pip_${Date.now()}`, type: "logo" as const, content: url, startTime: next.segments[activeSegIdx]?.startTime || 0, endTime: next.segments[activeSegIdx]?.endTime || duration, position: { x: 70, y: 10 }, size: { width: 320, height: 180 }, opacity: 1 });
          setShowImport(false); setShowImportModeChoice(false);
          saveVersion(`Overlay: ${file.name}`);
          setChatLog(p => [...p, { role: "ai", text: `"${file.name}" added as overlay on scene ${activeSegIdx + 1}.` }]);
        } else {
          // Append (default)
          seg.startTime = next.totalDuration;
          seg.endTime = next.totalDuration + duration;
          next.segments.push(seg);
          next.totalDuration += duration;
          setMediaUrl(url); setActiveSegIdx(next.segments.length - 1); setShowImport(false); setShowImportModeChoice(false);
          saveVersion(`Added ${file.name}`);
          setChatLog(p => [...p, { role: "ai", text: `Appended "${file.name}" (${duration}s). Total: ${fmtTime(next.totalDuration)}.` }]);
        }
        return next;
      } else {
        // First segment — create new assembly
        const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", file.name.replace(/\.[^.]+$/, ""));
        a.totalDuration = duration;
        a.segments.push(seg);
        setMediaUrl(url);
        setActiveSegIdx(0);
        setShowImport(false);
        setVersions([{ label: "v1 — Import", desc: `Imported ${file.name} (${duration}s)`, assembly: structuredClone(a) }]);
        setChatLog([{ role: "ai", text: `Imported "${file.name}" — ${duration}s. Add narration, music, SFX in Properties.` }]);
        return a;
      }
    });
  }, []);

  // ── Load saved project ──
  const [projectList, setProjectList] = useState<Array<{ id: string; title: string; scenes: number; duration: number; updatedAt: string; creationMode?: string }>>([]);
  const [showProjectList, setShowProjectList] = useState(false);
  const loadProjectList = async () => {
    const res = await fetch("/api/projects").catch(() => null);
    if (res?.ok) { const d = await res.json(); setProjectList(d.projects || []); }
  };
  // Load on mount — show project list if we have saved projects
  useEffect(() => { loadProjectList(); }, []);

  // ── Handle URL params — load referenced content from Asset Library / other sections ──
  useEffect(() => {
    const ref = params.get("ref");
    const mode = params.get("mode");
    const characterId = params.get("characterId");

    if (ref) {
      // Asset Library sent us a file reference — load it as the first segment
      const url = ref.startsWith("/api/") ? ref : `/api/media/${ref.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
      const isVideo = ref.match(/\.(mp4|mov|webm|mkv)$/i);
      const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", ref.split("/").pop()?.split(".")[0] || "Imported");
      a.segments.push({
        id: "seg_0",
        type: isVideo ? "video" : "image",
        sourceUrl: url,
        startTime: 0, endTime: 5, duration: 5,
        transitionIn: "cut", transitionOut: "cut",
      });
      a.totalDuration = 5;
      setAssembly(a);
      setMediaUrl(url);
      setActiveSegIdx(0);
      setChatLog([{ role: "ai", text: `Content loaded from library. ${isVideo ? "Video" : "Image"} ready — add narration, music, SFX in Properties.` }]);
    }

    if (mode === "image_to_video" || mode === "text_to_video") {
      setCreationMode(mode === "image_to_video" ? "ai_motion" : "text_to_video");
    } else if (mode === "hybrid") {
      setCreationMode("ghs_hybrid");
    }

    if (characterId) {
      // Load character, add to cast tray, and pre-fill gen-prompt with description
      fetch(`/api/character-voices`).then(r => r.json()).then(d => {
        const char = (d.voices || []).find((v: { id: string }) => v.id === characterId);
        if (char) {
          const cid = char.characterId || char.id;
          setCastTray(prev => {
            if (prev.some(c => c.characterId === cid)) return prev;
            return [...prev, { id: char.id, characterId: cid, name: char.name, imageUrl: char.imageUrl || null, voiceName: char.voiceName || null }];
          });
          // Pre-fill gen-prompt textarea with character description
          const desc = char.visualDescription || char.name;
          const prefill = `Story featuring ${char.name}: ${desc}`;
          setTimeout(() => {
            const el = document.getElementById("gen-prompt") as HTMLTextAreaElement | null;
            if (el && !el.value) {
              el.value = prefill;
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }, 200);
          setChatLog(p => [...p, { role: "ai", text: `Character "${char.name}" (${cid}) loaded from library and added to cast tray. Description pre-filled in the prompt area.` }]);
        }
      }).catch(() => {});
    }

    // Handle sceneId param — load a HybridScene from DB into the editor
    const sceneIdParam = params.get("sceneId");
    if (sceneIdParam) {
      // Try loading as project first (the [id] route returns project + scenes)
      fetch(`/api/hybrid/${sceneIdParam}`).then(r => r.ok ? r.json() : null).then(d => {
        // Find the scene — either from project.scenes or direct scene data
        let scene = d?.scene;
        if (!scene && d?.project?.scenes?.length > 0) {
          scene = d.project.scenes.find((s: { sceneId?: string; id?: string }) => s.sceneId === sceneIdParam || s.id === sceneIdParam) || d.project.scenes[0];
        }
        if (!scene) return;
        const a = createEmptyAssembly(`hybrid_${scene.projectId}`, "collaborative", scene.title || "Hybrid Scene");
        if (scene.generatedAssetUrl) {
          const isVideo = scene.generatedAssetUrl.match(/\.(mp4|mov|webm|mkv)$/i);
          a.segments.push({
            id: `seg_${scene.sceneId}`,
            type: isVideo ? "video" : "image",
            sourceUrl: scene.generatedAssetUrl,
            startTime: 0, endTime: scene.durationEstimate || 5, duration: scene.durationEstimate || 5,
            transitionIn: "cut", transitionOut: "cut",
          });
          a.totalDuration = scene.durationEstimate || 5;
          setMediaUrl(scene.generatedAssetUrl);
        }
        setAssembly(a);
        setActiveSegIdx(0);
        const charNames = (scene.characterIds || []).join(", ");
        setChatLog([{
          role: "ai",
          text: `Scene "${scene.title}" loaded from Hybrid Planner.\nType: ${scene.sceneType}\nCharacters: ${charNames || "none"}\nMood: ${scene.mood || "unset"}\n\nEdit the scene, add narration/music/SFX, then assemble.`,
        }]);
        if (mode === "ghs_hybrid" || !mode) setCreationMode("ghs_hybrid");
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProject = async (id: string) => {
    // First try editor projects DB
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      const d = await res.json();
      if (d.project?.assembly) {
        const a = d.project.assembly as AssemblyJSON;
        // Ensure arrays are initialized even if project was saved with empty assembly
        if (!a.segments) a.segments = [];
        if (!a.narration) a.narration = [];
        if (!a.music) a.music = [];
        if (!a.sfx) a.sfx = [];
        if (!a.subtitles) a.subtitles = [];
        if (!a.overlays) a.overlays = [];
        if (!a.totalDuration) a.totalDuration = 0;
        setAssembly(a);
        const firstSeg = a.segments.find(s => s.sourceUrl && !s.sourceUrl.startsWith("bg:"));
        if (firstSeg?.sourceUrl) setMediaUrl(firstSeg.sourceUrl);
        setActiveSegIdx(0);
        setShowImport(false);
        setShowProjectList(false);
        setVersions([{ label: "v1 — Loaded", desc: `Loaded: ${d.project.title}`, assembly: structuredClone(a) }]);
        const sceneCount = a.segments.length;
        const msg = sceneCount > 0
          ? `Project "${d.project.title}" loaded — ${sceneCount} scenes, ${Math.round(a.totalDuration || 0)}s total.`
          : `Project "${d.project.title}" loaded — empty project. Import media or generate content to start.`;
        setChatLog([{ role: "ai", text: msg }]);
        return;
      }
    }
    // Fallback: try movie planner projects
    const res2 = await fetch(`/api/movie-planner/project/${id}`).catch(() => null);
    if (!res2?.ok) return;
    const d = await res2.json();
    if (!d?.project?.scenes?.length) {
      // Empty movie planner project — show friendly message instead of silent return
      const title = d?.project?.title || "Untitled";
      const emptyAssembly = createEmptyAssembly(id, "movie", title);
      setAssembly(emptyAssembly);
      setMediaUrl("");
      setActiveSegIdx(0);
      setShowImport(false);
      setShowProjectList(false);
      setVersions([{ label: "v1 — Loaded", desc: `Loaded: ${title}`, assembly: structuredClone(emptyAssembly) }]);
      setChatLog([{ role: "ai", text: `Project "${title}" loaded — this project has no scenes yet. Start by importing media or generating content.` }]);
      return;
    }
    const a = createEmptyAssembly(id, "movie", d.project.title || "Loaded Project");
    let t = 0;
    for (const s of d.project.scenes) {
      const dur = s.duration || 5;
      a.segments.push({ id: `seg_${s.scene}`, type: s.generatedAssetUrl ? "video" : "image", sourceUrl: s.generatedAssetUrl || "", startTime: t, endTime: t + dur, duration: dur, transitionIn: "cut", transitionOut: "cut" });
      if (s.dialogue) a.narration.push({ id: `narr_${s.scene}`, text: s.dialogue, startTime: t + 0.3, endTime: t + dur - 0.3, volume: 1, speed: 1, style: "normal" });
      t += dur;
    }
    a.totalDuration = t;
    setAssembly(a);
    const firstSeg = a.segments.find(s => s.sourceUrl && !s.sourceUrl.startsWith("bg:"));
    if (firstSeg?.sourceUrl) setMediaUrl(firstSeg.sourceUrl);
    setActiveSegIdx(0);
    setShowImport(false);
    setShowProjectList(false);
    setVersions([{ label: "v1 — Import", desc: `Loaded project: ${d.project.title}`, assembly: structuredClone(a) }]);
    setChatLog([{ role: "ai", text: `Project "${d.project.title}" loaded — ${a.segments.length} scenes, ${Math.round(t)}s total.` }]);
  };

  const deleteProject = async (id: string, mode: "editor" | "forever") => {
    await fetch(`/api/projects?id=${id}&mode=${mode}`, { method: "DELETE" });
    loadProjectList();
  };

  // ── UPDATE ASSEMBLY (immutable helper) ──
  const updateAssembly = useCallback((updater: (a: AssemblyJSON) => void) => {
    setAssembly(prev => { const next = structuredClone(prev); updater(next); return next; });
  }, []);

  // ── SAVE VERSION — uses ref to always capture latest assembly state ──
  const saveVersion = useCallback((desc: string) => {
    const current = assemblyRef.current;
    setVersions(prev => [{ label: `v${prev.length + 1}`, desc, assembly: structuredClone(current) }, ...prev]);
    if (current.segments.length > 0) {
      // Generate a real ID if this is still the empty "new" placeholder
      const saveId = current.projectId === "new" ? `proj_${Date.now()}` : current.projectId;
      if (saveId !== current.projectId) {
        // Update the assembly's projectId so future saves use the same ID
        setAssembly(prev => ({ ...prev, projectId: saveId }));
      }
      fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saveId, title: current.title, assembly: { ...current, projectId: saveId }, status: "draft" }),
      }).then(() => toast("Saved", "success")).catch(() => toast("Save failed", "error"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // ── ADD NARRATION ──
  const setNarration = (text: string) => {
    updateAssembly(a => {
      const existing = a.narration.find(n => n.id === `narr_${activeSegIdx}`);
      if (existing) { existing.text = text; }
      else if (text) {
        const seg = a.segments[activeSegIdx];
        a.narration.push({ id: `narr_${activeSegIdx}`, text, startTime: seg?.startTime || 0, endTime: seg?.endTime || 5, volume: 1, speed: 1, style: "normal" });
      }
    });
  };

  // ── GENERATE NARRATION AUDIO (real TTS) ──
  const generateNarration = async () => {
    const narrText = activeNarr?.text;
    if (!narrText) { setChatLog(p => [...p, { role: "ai", text: "Write narration text first in the Properties tab." }]); return; }
    if (processing) return;
    setProcessing(true);
    setChatLog(p => [...p, { role: "ai", text: `Generating voice for: "${narrText.slice(0, 50)}..."` }]);

    try {
      // Try Piper TTS first (free, local) — returns audio blob
      const res = await fetch("/api/voices/piper-preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: narrText, speed: 0.75 }),
      });

      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        const blob = await res.blob();
        // Save audio file via narration-specific upload
        const saveFormData = new FormData();
        const fileName = `narration_${Date.now()}.mp3`;
        saveFormData.append("file", new File([blob], fileName, { type: "audio/mpeg" }));
        saveFormData.append("type", "narration");
        // Use the assets upload or save directly via a dedicated endpoint
        let savedUrl = "";
        try {
          const audioFd = new FormData();
          audioFd.append("file", new File([blob], fileName, { type: "audio/mpeg" }));
          const saveRes = await fetch("/api/upload/audio", { method: "POST", body: audioFd });
          const saveData = await saveRes.json();
          if (saveData.url) savedUrl = saveData.url;
        } catch {}
        if (!savedUrl) savedUrl = URL.createObjectURL(blob);

        updateAssembly(a => {
          const n = a.narration.find(x => x.id === `narr_${activeSegIdx}`);
          if (n) n.audioUrl = savedUrl;
        });
        setChatLog(p => [...p, { role: "ai", text: `Voice generated! Narration audio ready. Will be mixed into assembly.` }]);
        saveVersion("Voice generated");
      } else {
        // Piper not available — try ElevenLabs
        const elRes = await fetch("/api/voices/preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: narrText, voiceId: "21m00Tcm4TlvDq8ikWAM" }), // default voice
        });
        if (elRes.ok && elRes.headers.get("content-type")?.includes("audio")) {
          const blob = await elRes.blob();
          const audioUrl = URL.createObjectURL(blob);
          updateAssembly(a => {
            const n = a.narration.find(x => x.id === `narr_${activeSegIdx}`);
            if (n) n.audioUrl = audioUrl;
          });
          setChatLog(p => [...p, { role: "ai", text: "Voice generated via GHS Premium Voice. Ready for assembly." }]);
          saveVersion("Voice generated (premium)");
        } else {
          const errData = await elRes.json().catch(() => ({}));
          setChatLog(p => [...p, { role: "ai", text: `Voice generation unavailable: ${errData.error || "Piper TTS not installed and ElevenLabs key not set. Install Piper: pip install piper-tts"}` }]);
        }
      }
    } catch (err) {
      setChatLog(p => [...p, { role: "ai", text: `Voice generation failed: ${err instanceof Error ? err.message : "Check Piper TTS or ElevenLabs setup."}` }]);
    }
    setProcessing(false);
  };

  // ── GENERATE ALL VOICES (batch — every scene, AI polish first) ──
  const generateAllVoices = async () => {
    if (processing) return;
    const segments = assembly.segments;
    if (!segments.length) { setChatLog(p => [...p, { role: "ai", text: "Add scenes first." }]); return; }

    const items: Array<{ idx: number; text: string; seg: AssemblySegment }> = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.id === "seg_assembled") continue;
      let t = "";
      const narr = assembly.narration.find(n => n.id === `narr_${i}`);
      if (narr?.text) { t = narr.text; }
      else if (creationMode === "ghs_invtext") {
        const ovl = assembly.overlays.find(o => o.startTime >= (seg.startTime || 0) && o.startTime < (seg.endTime || 999));
        if (ovl?.content) t = ovl.content;
      }
      if (t.trim()) items.push({ idx: i, text: t.trim(), seg });
    }

    if (!items.length) { setChatLog(p => [...p, { role: "ai", text: "No narration text found in any scene." }]); return; }

    setProcessing(true);
    setChatLog(p => [...p, { role: "ai", text: `${items.length} scene(s) found — polishing with AI...` }]);

    let polished = items.map(x => x.text);
    try {
      const polishRes = await fetch("/api/assembly/change", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: `Polish these narration lines for video. Make each clear, natural, well-paced. Return ONLY numbered lines, same count and order:\n${items.map((x, i) => `${i + 1}. ${x.text}`).join("\n")}`,
          projectId: assembly.projectId, tier: "standard",
        }),
      });
      const polishData = await polishRes.json();
      if (polishData.plan?.description) {
        const lines = polishData.plan.description.split("\n").map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter((l: string) => l.length > 0);
        if (lines.length === items.length) polished = lines;
      }
    } catch { /* use originals */ }

    setChatLog(p => [...p, { role: "ai", text: `Generating voice for ${items.length} scene(s)...` }]);
    let done = 0;
    for (let k = 0; k < items.length; k++) {
      const { idx, seg } = items[k];
      const text = polished[k] || items[k].text;
      setChatLog(p => [...p, { role: "ai", text: `[${k + 1}/${items.length}] Scene ${idx + 1}: "${text.slice(0, 45)}..."` }]);
      try {
        const res = await fetch("/api/voices/piper-preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speed: 0.75 }),
        });
        let audioUrl = "";
        if (res.ok && res.headers.get("content-type")?.includes("audio")) {
          const blob = await res.blob();
          try {
            const fd = new FormData();
            fd.append("file", new File([blob], `narr_s${idx}_${Date.now()}.mp3`, { type: "audio/mpeg" }));
            const sv = await fetch("/api/upload/audio", { method: "POST", body: fd });
            const sd = await sv.json();
            if (sd.url) audioUrl = sd.url;
          } catch {}
          if (!audioUrl) audioUrl = URL.createObjectURL(blob);
        } else {
          const elRes = await fetch("/api/voices/preview", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voiceId: "21m00Tcm4TlvDq8ikWAM" }),
          });
          if (elRes.ok && elRes.headers.get("content-type")?.includes("audio")) {
            const blob = await elRes.blob();
            audioUrl = URL.createObjectURL(blob);
          }
        }
        if (audioUrl) {
          const narrId = `narr_${idx}`;
          updateAssembly(a => {
            const ex = a.narration.find(n => n.id === narrId);
            if (ex) { ex.audioUrl = audioUrl; ex.text = text; }
            else a.narration.push({ id: narrId, text, startTime: seg.startTime || 0, endTime: seg.endTime || 5, volume: 1, speed: 1, style: "normal", audioUrl });
          });
          done++;
        }
      } catch { /* skip */ }
    }
    saveVersion(`All voices: ${done}/${items.length} scenes`);
    setChatLog(p => [...p, { role: "ai", text: `Voice complete — ${done}/${items.length} scenes ready. Click "Assemble + Mix" to bake audio into video.` }]);
    setProcessing(false);
  };

  // ── GENERATE MUSIC ──
  const generateMusic = async (mood: string) => {
    if (processing) return; // prevent double-click
    setProcessing(true);
    setChatLog(p => [...p, { role: "ai", text: `Generating ${mood} music...` }]);
    try {
      const res = await fetch("/api/music/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${mood} background music, ${assembly.totalDuration}s`, mood, tier: "standard", durationSeconds: assembly.totalDuration }),
      });
      const d = await res.json();
      if (d.musicPath) {
        const musicUrl = `/api/media/${d.musicPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
        updateAssembly(a => {
          a.music = [{ id: "music_0", sourceUrl: musicUrl, startTime: 0, endTime: a.totalDuration, volume: 0.3, fadeIn: 1, fadeOut: 2, duckUnderSpeech: true, duckLevel: 0.1 }];
        });
        setChatLog(p => [...p, { role: "ai", text: `Music generated (${mood}). Added to project.` }]);
        saveVersion(`Music: ${mood}`);
      }
    } catch (err) { setChatLog(p => [...p, { role: "ai", text: `Music generation failed: ${err instanceof Error ? err.message : "Check music provider settings."}` }]); }
    setProcessing(false);
  };

  // ── ADD SFX ──
  const addSfx = (event: string, time: number) => {
    updateAssembly(a => {
      a.sfx.push({ id: `sfx_${Date.now()}`, event, sourceUrl: `/api/media/sfx/${event}.mp3`, startTime: time, duration: 2, volume: 0.7, loop: false, category: "general" });
    });
    setChatLog(p => [...p, { role: "ai", text: `SFX "${event}" added at ${time.toFixed(1)}s.` }]);
    saveVersion(`SFX: ${event}`);
  };

  // ── ASSEMBLE ALL LAYERS (FFmpeg) — produces real output file ──
  const assemble = async () => {
    if (!assembly.segments.length) return;
    if (processing) return;
    // Save current URL as "before" for comparison
    if (mediaUrl) setBeforeUrl(mediaUrl);
    setProcessing(true);
    setChatLog(p => [...p, { role: "ai", text: "Assembling all layers via FFmpeg — video + narration + music + SFX..." }]);
    try {
      const scenes = assembly.segments
        .filter(seg => seg.id !== "seg_assembled")
        .map((seg, i) => {
        const sceneOverlay = assembly.overlays.find(o => o.startTime >= seg.startTime && o.startTime < seg.endTime);
        return {
          scene: i + 1,
          videoUrl: seg.sourceUrl,
          duration: seg.duration,
          text: sceneOverlay?.content || undefined,
          background: seg.sourceUrl.startsWith("bg:") ? seg.sourceUrl.slice(3) : undefined,
          // Pass CSS design settings for rich rendering
          design: seg.sourceUrl.startsWith("bg:") ? {
            fontFamily: slideDesign.fontFamily,
            fontSize: slideDesign.fontSize,
            fontColor: slideDesign.fontColor,
            letterSpacing: slideDesign.letterSpacing,
            textStyle: slideDesign.textStyle,
            textGlow: slideDesign.textGlow,
            glowColor: slideDesign.glowColor,
            bgPattern: slideDesign.bgPattern,
            showCorners: slideDesign.showCorners,
            showRings: slideDesign.showRings,
          } : undefined,
        };
      });
      // Build narration list — each slide may have its own audio
      const narrWithAudio = assembly.narration.filter(n => n.audioUrl && !n.audioUrl.startsWith("blob:"));
      const narrationAudioUrl = narrWithAudio[0]?.audioUrl;
      const narrationList = narrWithAudio.map(n => ({ audioUrl: n.audioUrl!, startTime: n.startTime, volume: n.volume }));
      const musicSourceUrl = assembly.music[0]?.sourceUrl;

      // Build SFX list for FFmpeg mixing
      const sfxForAssembly = assembly.sfx.map(s => ({
        sourceUrl: s.sourceUrl,
        startTime: s.startTime,
        volume: s.volume,
      }));

      const res = await fetch("/api/video/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assembly.title,
          scenes,
          musicUrl: musicSourceUrl,
          musicVolume: assembly.music[0]?.volume ?? 0.3,
          narrationUrl: narrationAudioUrl,
          narrationList: narrationList.length > 1 ? narrationList : undefined,
          narrationVolume: assembly.narration[0]?.volume ?? 1.0,
          sfx: sfxForAssembly.length > 0 ? sfxForAssembly : undefined,
          caption: assembly.subtitles[0]?.text || assembly.overlays[0]?.content || undefined,
          captionPosition: assembly.subtitles[0]?.position || "bottom",
        }),
      });
      const d = await res.json();
      if (d.outputUrl) {
        setMediaUrl(d.outputUrl);
        // Update or add assembled segment — enables re-edit loop
        updateAssembly(a => {
          const assembledIdx = a.segments.findIndex(s => s.id === "seg_assembled");
          if (assembledIdx >= 0) {
            // Update existing assembled master
            a.segments[assembledIdx].sourceUrl = d.outputUrl;
            a.segments[assembledIdx].duration = d.duration || a.totalDuration;
            a.segments[assembledIdx].endTime = d.duration || a.totalDuration;
          } else {
            // Add assembled video as first segment (master)
            a.segments.unshift({
              id: "seg_assembled",
              type: "video",
              sourceUrl: d.outputUrl,
              startTime: 0,
              endTime: d.duration || a.totalDuration,
              duration: d.duration || a.totalDuration,
              transitionIn: "cut",
              transitionOut: "cut",
            });
          }
        });
        // Save to asset registry
        try {
          fetch("/api/assets", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: assembly.title, type: "video", filePath: d.outputUrl, status: "assembled", originalInput: assembly.title, metadata: { duration: d.duration, scenes: assembly.segments.length } }),
          });
        } catch { /* optional */ }
        setChatLog(p => [...p, { role: "ai", text: `Assembly complete! ${d.duration ? Math.round(d.duration) + "s" : ""} — video ready.\n\nYou can:\n• Play the assembled video above\n• Continue editing with AI instructions\n• Click "Assemble" again after changes\n• Download via Review Before Export` }]);
        saveVersion("Assembled all layers");
      } else {
        setChatLog(p => [...p, { role: "ai", text: `Assembly failed: ${d.error || "Unknown"}` }]);
      }
    } catch { setChatLog(p => [...p, { role: "ai", text: "Assembly failed." }]); }
    setProcessing(false);
  };

  // ── EXECUTE EDIT — runs FFmpeg for low-scope changes, returns new file ──
  const executeEdit = async (editType: string, params: Record<string, unknown> = {}) => {
    if (processing || !activeSeg?.sourceUrl) return;
    setProcessing(true);
    const videoUrl = activeSeg.sourceUrl;

    setChatLog(p => [...p, { role: "ai", text: `Applying ${editType}...` }]);

    try {
      if (editType === "trim") {
        // Trim last N seconds
        const trimSec = (params.seconds as number) || 5;
        const newDur = Math.max(1, (activeSeg.duration || 30) - trimSec);
        const res = await fetch("/api/video/assemble", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Trimmed", scenes: [{ scene: 1, videoUrl, duration: newDur }] }),
        });
        const d = await res.json();
        if (d.outputUrl) {
          updateAssembly(a => { const seg = a.segments[activeSegIdx]; if (seg) { seg.sourceUrl = d.outputUrl; seg.duration = newDur; seg.endTime = seg.startTime + newDur; a.totalDuration = a.segments.reduce((t, s) => t + s.duration, 0); } });
          setMediaUrl(d.outputUrl);
          setChatLog(p => [...p, { role: "ai", text: `Trimmed ${trimSec}s. New duration: ${fmtTime(newDur)}. Preview updated.` }]);
          saveVersion(`Trim ${trimSec}s`);
        }
      } else if (editType === "add_sfx") {
        // Add SFX and reassemble
        const sfxEvent = params.event as string || "rain_light";
        addSfx(sfxEvent, currentTime);
        // Reassemble with SFX
        const res = await fetch("/api/video/assemble", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "With SFX", scenes: [{ scene: 1, videoUrl }], musicUrl: assembly.music[0]?.sourceUrl, musicVolume: assembly.music[0]?.volume || 0.3 }),
        });
        const d = await res.json();
        if (d.outputUrl) { setMediaUrl(d.outputUrl); setChatLog(p => [...p, { role: "ai", text: `SFX "${sfxEvent}" applied. Preview updated.` }]); }
      } else if (editType === "volume") {
        // Adjust music volume and reassemble
        const direction = params.direction as string || "up";
        updateAssembly(a => { if (a.music[0]) a.music[0].volume = Math.max(0, Math.min(1, (a.music[0].volume || 0.3) + (direction === "up" ? 0.15 : -0.1))); });
        const newVol = Math.max(0, Math.min(1, (assembly.music[0]?.volume || 0.3) + (direction === "up" ? 0.15 : -0.1)));
        if (assembly.music[0]?.sourceUrl) {
          const res = await fetch("/api/video/assemble", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Volume adjusted", scenes: [{ scene: 1, videoUrl }], musicUrl: assembly.music[0].sourceUrl, musicVolume: newVol }),
          });
          const d = await res.json();
          if (d.outputUrl) { setMediaUrl(d.outputUrl); setChatLog(p => [...p, { role: "ai", text: `Music volume → ${Math.round(newVol * 100)}%. Preview updated.` }]); saveVersion(`Volume ${direction}`); }
        } else {
          setChatLog(p => [...p, { role: "ai", text: `Volume adjusted to ${Math.round(newVol * 100)}%. Add music first for audible change.` }]);
        }
      } else if (editType === "subtitle") {
        // Burn subtitle via FFmpeg drawtext
        const captionText = params.text as string || "";
        updateAssembly(a => { a.subtitles = [{ id: "sub_0", text: captionText, startTime: 0, endTime: a.totalDuration, position: "bottom", fontSize: 24, fontColor: "#ffffff", style: "normal" }]; });
        // Reassemble with subtitle
        const res = await fetch("/api/video/assemble", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "With subtitle", scenes: [{ scene: 1, videoUrl }],
            musicUrl: assembly.music[0]?.sourceUrl, musicVolume: assembly.music[0]?.volume || 0.3,
          }),
        });
        const d = await res.json();
        if (d.outputUrl) {
          setMediaUrl(d.outputUrl);
          setChatLog(p => [...p, { role: "ai", text: `Subtitle added: "${captionText.slice(0, 30)}". Preview updated.` }]);
          saveVersion(`Subtitle: ${captionText.slice(0, 20)}`);
        }
      } else if (editType === "logo") {
        // Logo overlay — would use FFmpeg overlay filter
        const logoUrl = params.url as string || "";
        updateAssembly(a => { a.overlays.push({ id: `logo_${Date.now()}`, type: "logo", content: logoUrl, startTime: 0, endTime: a.totalDuration, position: { x: 20, y: 20 }, size: { width: 100, height: 50 }, opacity: 0.8 }); });
        setChatLog(p => [...p, { role: "ai", text: "Logo added. Will appear in final assembly." }]);
        saveVersion("Logo added");
      }
    } catch {
      setChatLog(p => [...p, { role: "ai", text: `${editType} failed.` }]);
    }
    setProcessing(false);
  };

  // ── SEND INSTRUCTION → Change Planner API ──
  const sendInstruction = async () => {
    if (!editInput.trim()) return;
    const instruction = editInput.trim();
    setEditInput("");
    setChatLog(p => [...p, { role: "user", text: instruction }]);
    setProcessing(true);

    const low = instruction.toLowerCase();

    // ── INSTANT local edits — handle before API call ──
    // Text modifications: change/modify/edit/update text
    if (low.match(/^(change|modify|edit|replace|update)\s+(the\s+)?(text|slide|scene)/)) {
      const newText = instruction.replace(/^(change|modify|edit|replace|update)\s+(the\s+)?(text|slide|scene)\s*(to|with|:)?\s*/i, "").trim();
      if (newText) {
        updateAssembly(a => {
          const seg = a.segments[activeSegIdx];
          if (!seg) return;
          const ovl = a.overlays.find(o => o.startTime >= seg.startTime && o.startTime < seg.endTime);
          if (ovl) ovl.content = newText;
          const narr = a.narration.find(n => n.id === `narr_${activeSegIdx}`);
          if (narr) narr.text = newText;
        });
        setChatLog(p => [...p, { role: "ai", text: `Scene ${activeSegIdx + 1} text updated to: "${newText}"` }]);
        saveVersion(`Text: ${newText.slice(0, 20)}`);
        setProcessing(false);
        return;
      }
    }
    // Add text overlay
    if (low.match(/^add\s+(text|overlay)/)) {
      const newText = instruction.replace(/^add\s+(text|overlay)\s*(:|to)?\s*/i, "").trim();
      if (newText) {
        updateAssembly(a => {
          const seg = a.segments[activeSegIdx];
          if (!seg) return;
          a.overlays.push({ id: `ovl_${Date.now()}`, type: "text", content: newText, startTime: seg.startTime, endTime: seg.endTime, position: { x: 50, y: 50 }, size: { width: 28, height: 28 }, opacity: 1, animation: "fade" });
        });
        setChatLog(p => [...p, { role: "ai", text: `Text overlay added to scene ${activeSegIdx + 1}: "${newText}"` }]);
        saveVersion(`Added: ${newText.slice(0, 20)}`);
        setProcessing(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/assembly/change", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, projectId: assembly.projectId, sceneId: activeSegIdx, tier }),
      });
      const d = await res.json();
      const plan = d.plan || {};
      const meta = d.meta || {};

      if (meta.ffmpegOnly) {
        // Low-scope: execute via FFmpeg immediately — produces new file
        if (low.includes("trim") || low.includes("cut") || low.includes("shorten")) {
          const match = low.match(/(\d+)\s*s/);
          await executeEdit("trim", { seconds: match ? parseInt(match[1]) : 5 });
        } else if (low.includes("louder") || low.includes("volume up") || low.includes("increase music")) {
          await executeEdit("volume", { direction: "up" });
        } else if (low.includes("softer") || low.includes("lower music") || low.includes("quieter")) {
          await executeEdit("volume", { direction: "down" });
        } else if (low.includes("rain") || low.includes("thunder") || low.includes("wind") || low.includes("sfx") || low.includes("sound")) {
          const sfxMap: Record<string, string> = { rain: "rain_light", thunder: "thunder", wind: "wind_gentle", footstep: "footsteps_concrete", door: "door_slam", dog: "dog_bark", bird: "birds_chirping", ocean: "ocean_waves" };
          const sfx = Object.entries(sfxMap).find(([k]) => low.includes(k))?.[1] || "rain_light";
          await executeEdit("add_sfx", { event: sfx });
        } else if (low.includes("subtitle") || low.includes("caption")) {
          await executeEdit("subtitle", { text: instruction.replace(/add (subtitle|caption)/i, "").trim() || "Caption" });
        } else if (low.includes("change text") || low.includes("modify text") || low.includes("edit text") || low.includes("replace text") || low.includes("update text") || low.includes("change slide") || low.includes("change scene")) {
          // Modify overlay text on active scene
          const newText = instruction.replace(/^(change|modify|edit|replace|update)\s+(the\s+)?(text|slide|scene)\s*(to|with|:)?\s*/i, "").trim();
          if (newText) {
            updateAssembly(a => {
              const seg = a.segments[activeSegIdx];
              if (!seg) return;
              // Find overlay for this scene
              const ovl = a.overlays.find(o => o.startTime >= seg.startTime && o.startTime < seg.endTime);
              if (ovl) ovl.content = newText;
              // Also update narration
              const narr = a.narration.find(n => n.id === `narr_${activeSegIdx}`);
              if (narr) narr.text = newText;
            });
            setChatLog(p => [...p, { role: "ai", text: `Scene ${activeSegIdx + 1} text updated to: "${newText}"` }]);
            saveVersion(`Text: ${newText.slice(0, 20)}`);
          }
        } else if (low.includes("add text") || low.includes("overlay")) {
          // Add new overlay text
          const newText = instruction.replace(/^add\s+(text|overlay)\s*(:|to)?\s*/i, "").trim();
          if (newText) {
            updateAssembly(a => {
              const seg = a.segments[activeSegIdx];
              if (!seg) return;
              a.overlays.push({ id: `ovl_${Date.now()}`, type: "text", content: newText, startTime: seg.startTime, endTime: seg.endTime, position: { x: 50, y: 50 }, size: { width: 28, height: 28 }, opacity: 1, animation: "fade" });
            });
            setChatLog(p => [...p, { role: "ai", text: `Text overlay added: "${newText}"` }]);
            saveVersion(`Added text: ${newText.slice(0, 20)}`);
          }
        } else if (low.match(/^generate\s+image|^create\s+image|^make\s+image/)) {
          // Generate AI image
          const imgPrompt = instruction.replace(/^(generate|create|make)\s+image\s*(of|for|:)?\s*/i, "").trim() || instruction;
          setChatLog(p => [...p, { role: "ai", text: `Generating image: "${imgPrompt}"...` }]);
          try {
            const imgRes = await fetch("/api/comfyui", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: imgPrompt }) });
            const imgData = await imgRes.json();
            if (imgData.imageUrl || imgData.url) {
              const imgUrl = imgData.imageUrl || imgData.url;
              updateAssembly(a => {
                const seg = a.segments[activeSegIdx];
                if (seg) { seg.sourceUrl = imgUrl; seg.type = "image"; }
              });
              setMediaUrl(imgUrl);
              setChatLog(p => [...p, { role: "ai", text: `Image generated and added to scene ${activeSegIdx + 1}.` }]);
              saveVersion(`Image: ${imgPrompt.slice(0, 20)}`);
            } else {
              setChatLog(p => [...p, { role: "ai", text: `Image generation failed: ${imgData.error || "Check ComfyUI/fal.ai settings."}` }]);
            }
          } catch { setChatLog(p => [...p, { role: "ai", text: "Image generation failed." }]); }
        } else if (low.match(/^add\s+music|^generate\s+music/)) {
          const mood = low.match(/cinematic|upbeat|calm|suspense|emotional|afrobeats/)?.[0] || "cinematic";
          await generateMusic(mood);
        } else if (low.match(/^add\s+sfx|^add\s+sound/)) {
          const sfxMap: Record<string, string> = { rain: "rain_light", thunder: "thunder", wind: "wind_gentle", footstep: "footsteps_concrete", door: "door_slam", dog: "dog_bark", bird: "birds_chirping", ocean: "ocean_waves", explosion: "explosion", whoosh: "whoosh" };
          const sfx = Object.entries(sfxMap).find(([k]) => low.includes(k))?.[1] || "whoosh";
          addSfx(sfx, currentTime);
        } else if (low.match(/^replace\s+image|^change\s+image|^swap\s+image/)) {
          setChatLog(p => [...p, { role: "ai", text: "Use the Import modal (📂 Open) → select 'Replace Scene' to replace the image." }]);
        } else if (low.match(/^change\s+background|^set\s+background|^background\s+to/)) {
          const bgText = instruction.replace(/^(change|set)\s+background\s*(to|:)?\s*/i, "").trim();
          if (bgText) {
            updateAssembly(a => { const seg = a.segments[activeSegIdx]; if (seg?.sourceUrl?.startsWith("bg:")) seg.sourceUrl = `bg:linear-gradient(135deg, ${bgText})`; });
            setChatLog(p => [...p, { role: "ai", text: `Background updated for scene ${activeSegIdx + 1}.` }]);
            saveVersion("Background changed");
          }
        } else if (low.match(/^add\s+logo|^add\s+watermark/)) {
          setChatLog(p => [...p, { role: "ai", text: "Use Import (📂 Open) → select 'Overlay On Top' → upload your logo image." }]);
        } else if (low.match(/^upload\s+music|^add\s+custom\s+music/)) {
          setChatLog(p => [...p, { role: "ai", text: "Use the Music section in Properties → upload custom music file via Import." }]);
        } else if (low.match(/^add\s+ambience|^add\s+rain|^add\s+forest|^add\s+city/)) {
          const ambMap: Record<string, string> = { rain: "rain_light", forest: "forest_birds", city: "crowd_cheer", ocean: "ocean_waves", wind: "wind_gentle" };
          const amb = Object.entries(ambMap).find(([k]) => low.includes(k))?.[1] || "rain_light";
          addSfx(amb, 0);
          setChatLog(p => [...p, { role: "ai", text: `Ambience "${amb}" added from start.` }]);
        } else if (low.match(/^duck|^lower\s+music.*narration|^music\s+under/)) {
          updateAssembly(a => { if (a.music[0]) { a.music[0].duckUnderSpeech = true; a.music[0].duckLevel = 0.08; a.music[0].volume = Math.min(a.music[0].volume, 0.2); } });
          setChatLog(p => [...p, { role: "ai", text: "Music ducking enabled — volume lowered under narration." }]);
          saveVersion("Music ducking");
        } else if (low.match(/^remove\s+audio|^mute\s+original|^remove\s+original\s+audio/)) {
          setChatLog(p => [...p, { role: "ai", text: "Original audio will be replaced by music/narration in assembly." }]);
        } else if (low.match(/^restyle|^change\s+style/)) {
          setChatLog(p => [...p, { role: "ai", text: "Use the Design & Background panel to change typography style and colors." }]);
        } else if (low.match(/^delete\s+scene|^remove\s+scene/)) {
          updateAssembly(a => { a.segments = a.segments.filter((_, si) => si !== activeSegIdx); a.totalDuration = a.segments.reduce((t, s) => t + s.duration, 0); });
          if (activeSegIdx > 0) setActiveSegIdx(activeSegIdx - 1);
          setChatLog(p => [...p, { role: "ai", text: `Scene ${activeSegIdx + 1} deleted.` }]);
          saveVersion("Deleted scene");
        } else {
          setChatLog(p => [...p, { role: "ai", text: `Applied: ${plan.type}. ${plan.description || instruction}` }]);
          saveVersion(instruction);
        }
      } else {
        // High-scope: show what would change, ask for approval
        setChatLog(p => [...p, {
          role: "ai",
          text: `${plan.type}: "${plan.description || instruction}". Cost: ${meta.totalCost || 0} credit(s).`,
          approval: { instruction, plan, meta },
        }]);
      }
    } catch {
      setChatLog(p => [...p, { role: "ai", text: "Change planner failed. Try a simpler instruction." }]);
    }
    setProcessing(false);
  };

  // ── Smooth playhead + narration/SFX sync: requestAnimationFrame loop ──
  const rafRef = useRef<number>(0);
  const narrationPlayingRef = useRef(false);
  const activeSfxRef = useRef<Set<string>>(new Set()); // track which SFX are currently playing
  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) {
        const t = v.currentTime;
        setCurrentTime(t);

        // Frame-accurate narration sync — read from ref to avoid stale closures
        const narrData = assemblyNarrationRef.current;
        const narrWithAudio = narrData.find(n => n.audioUrl);
        if (narrWithAudio?.audioUrl && narrationAudioRef.current) {
          const narrStart = narrWithAudio.startTime || 0;
          const narrEnd = narrWithAudio.endTime || Infinity;
          const inRange = t >= narrStart && t <= narrEnd;

          if (inRange && !narrationPlayingRef.current) {
            // Start narration at the correct offset
            narrationAudioRef.current.currentTime = t - narrStart;
            narrationAudioRef.current.play().catch(() => {});
            narrationPlayingRef.current = true;
          } else if (!inRange && narrationPlayingRef.current) {
            // Stop narration when out of range
            narrationAudioRef.current.pause();
            narrationPlayingRef.current = false;
          }
        }

        // Frame-accurate SFX sync — trigger SFX at their scheduled timestamps
        const sfxData = assemblySfxRef.current;
        if (sfxData.length > 0) {
          const ctx = audioCtxRef.current; // may be null if not initialized yet
          for (const sfx of sfxData) {
            if (!sfx.sourceUrl || !sfx.startTime) continue;
            const sfxEnd = sfx.startTime + (sfx.duration || 2);
            const inSfxRange = t >= sfx.startTime && t < sfxEnd;
            const sfxKey = sfx.id || sfx.sourceUrl;

            if (inSfxRange && !activeSfxRef.current.has(sfxKey)) {
              // Start SFX
              activeSfxRef.current.add(sfxKey);
              let entry = sfxAudiosRef.current.get(sfxKey);
              if (!entry) {
                const audio = new Audio();
                audio.crossOrigin = "anonymous";
                audio.src = sfx.sourceUrl;
                audio.loop = sfx.loop || false;
                if (ctx) {
                  const source = ctx.createMediaElementSource(audio);
                  const gain = ctx.createGain();
                  gain.gain.value = sfx.volume ?? 0.7;
                  source.connect(gain);
                  gain.connect(ctx.destination);
                  entry = { audio, gain, source };
                  sfxAudiosRef.current.set(sfxKey, entry);
                } else {
                  // Fallback: play without Web Audio gain control
                  audio.volume = sfx.volume ?? 0.7;
                  audio.currentTime = Math.max(0, t - sfx.startTime);
                  audio.play().catch(() => {});
                  continue;
                }
              }
              entry.audio.currentTime = Math.max(0, t - sfx.startTime);
              entry.gain.gain.value = sfx.volume ?? 0.7;
              entry.audio.play().catch(() => {});
            } else if (!inSfxRange && activeSfxRef.current.has(sfxKey)) {
              // Stop SFX
              activeSfxRef.current.delete(sfxKey);
              const entry = sfxAudiosRef.current.get(sfxKey);
              if (entry) entry.audio.pause();
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      narrationPlayingRef.current = false;
      // Stop all active SFX on cleanup
      activeSfxRef.current.clear();
      sfxAudiosRef.current.forEach(({ audio }) => audio.pause());
    };
  }, [mediaUrl]);

  // ── Playback controls ──
  const togglePlay = () => { const v = videoRef.current; if (!v) return; if (playing) v.pause(); else v.play(); setPlaying(!playing); };
  const seekTo = (seconds: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, seconds)); };
  const seekBy = (delta: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta)); };
  const seek = (pct: number) => { const v = videoRef.current; if (v && v.duration) v.currentTime = (pct / 100) * v.duration; };
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const v = videoRef.current;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(e.shiftKey ? -1 : -5); // Shift+Left = 1s, Left = 5s
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(e.shiftKey ? 1 : 5); // Shift+Right = 1s, Right = 5s
          break;
        case "KeyJ":
          seekBy(-10); // rewind 10s
          break;
        case "KeyK":
          togglePlay(); // pause/play
          break;
        case "KeyL":
          seekBy(10); // forward 10s
          break;
        case "KeyI":
          // Set in-point
          if (v) { setInPoint(v.currentTime); if (outPoint !== null && v.currentTime >= outPoint) setOutPoint(null); }
          break;
        case "KeyO":
          // Set out-point
          if (v && (inPoint === null || v.currentTime > inPoint)) setOutPoint(v.currentTime);
          break;
        case "KeyS":
          // Split at playhead
          if (e.ctrlKey || e.metaKey) return; // don't override Ctrl+S
          if (v && activeSeg && v.currentTime > 0.1 && v.currentTime < (activeSeg.duration - 0.1)) {
            const t = v.currentTime;
            updateAssembly(a => {
              const seg = a.segments[activeSegIdx];
              if (!seg) return;
              const seg2: AssemblySegment = { ...structuredClone(seg), id: `seg_split_${Date.now()}`, startTime: seg.startTime + t, endTime: seg.endTime, duration: seg.duration - t };
              seg.endTime = seg.startTime + t;
              seg.duration = t;
              a.segments.splice(activeSegIdx + 1, 0, seg2);
              a.totalDuration = a.segments.reduce((total, s) => total + s.duration, 0);
            });
            saveVersion(`Split at ${fmtTime(t)}`);
          }
          break;
        case "Home":
          e.preventDefault();
          seekTo(0);
          break;
        case "End":
          e.preventDefault();
          if (v) seekTo(v.duration || 0);
          break;
        case "BracketLeft": // [ = previous segment
          if (activeSegIdx > 0) {
            setActiveSegIdx(activeSegIdx - 1);
            const seg = assembly.segments[activeSegIdx - 1];
            if (seg?.sourceUrl) setMediaUrl(seg.sourceUrl);
          }
          break;
        case "BracketRight": // ] = next segment
          if (activeSegIdx < assembly.segments.length - 1) {
            setActiveSegIdx(activeSegIdx + 1);
            const seg = assembly.segments[activeSegIdx + 1];
            if (seg?.sourceUrl) setMediaUrl(seg.sourceUrl);
          }
          break;
      }
      // ? key for shortcuts panel (not in input fields)
      if (e.key === "?" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        setShowShortcuts(p => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, activeSegIdx, activeSeg, assembly.segments, inPoint, outPoint]);

  // ── RENDER ──
  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#060810", height: "calc(100vh - 100px)", margin: "-24px -32px", overflow: "hidden" }}>

      {/* ══ TOP BAR ══ */}
      <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", background: s1, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href={`/dashboard/${params.get("from") || "hybrid-planner"}`} style={{ textDecoration: "none", fontSize: 10, color: muted, padding: "3px 8px", borderRadius: 6, border: `1px solid ${border}`, background: s2 }} title="Return to Planner">
            ← Planner
          </a>
          <span style={{ fontWeight: 800, fontSize: 14, color: text }}>🎬 GHS<span style={{ color: cyan }}>Editor</span></span>
          <input
            defaultValue={assembly.title}
            key={assembly.projectId}
            onBlur={e => {
              const newTitle = e.target.value.trim() || "Untitled Project";
              if (newTitle !== assemblyRef.current.title) {
                updateAssembly(a => { a.title = newTitle; });
                saveVersion("Renamed project");
              }
            }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = `${purple}50`; }}
            style={{ fontSize: 12, color: text, background: "transparent", border: `1px solid transparent`, borderRadius: 6, padding: "2px 6px", outline: "none", minWidth: 140, maxWidth: 220 }}
            placeholder="Project title..."
            title="Click to rename project"
          />
          <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 100, background: `${purple}15`, border: `1px solid ${purple}30`, color: purple }}>COLLABORATIVE</span>
          <select data-testid="creation-mode" value={creationMode} onChange={e => { setCreationMode(e.target.value as CreationMode); setShowAdvancedModels(false); }}
            style={{ background: s2, border: `1px solid ${purple}30`, borderRadius: 6, padding: "3px 8px", color: text, fontSize: 9, outline: "none" }}>
            <option value="ghs_invtext">GHS InvText</option>
            <option value="text_to_video">GHS Text→Video</option>
            <option value="ghs_hybrid">GHS Hybrid</option>
            <option value="ai_motion">GHS AI Motion</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select value={tier} onChange={e => setTier(e.target.value as typeof tier)}
            style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 8px", color: text, fontSize: 9, outline: "none" }}>
            <option value="standard">GHS Standard</option>
            <option value="pro">GHS Pro-O</option>
            <option value="premium">GHS Pro-C</option>
            <option value="premium_best">GHS Best</option>
          </select>
          <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", padding: "3px 8px", background: s2, borderRadius: 6, border: `1px solid ${border}` }}>v{versions.length || 1}</span>
          <button onClick={() => setShowShortcuts(true)} style={{ padding: "5px 8px", borderRadius: 7, fontSize: 11, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }} title="Keyboard Shortcuts (?)">⌨</button>
        </div>
      </div>

      {/* ══ ACTION TOOLBAR — Key buttons spread out and visible ══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: s1, borderBottom: `1px solid ${border}`, flexWrap: "wrap" }}>
        <button onClick={() => setShowImport(true)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${cyan}30`, background: `${cyan}08`, color: cyan, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          📂 Import / Open
        </button>
        <button onClick={() => setShowCharacterPicker(true)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${purple}30`, background: `${purple}08`, color: purple, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          👤 Add Character
        </button>
        <a href="/dashboard/character-voices" target="_blank" rel="noopener noreferrer" style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${purple}30`, background: "transparent", color: purple, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          ✨ Create Character
        </a>
        <a href="/dashboard/sfx-library?selectMode=music&returnTo=collaborative-editor" style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${gold}30`, background: `${gold}06`, color: gold, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          🎵 Import Music
        </a>
        <div style={{ flex: 1 }} />
        <a href={`/dashboard/${(() => { try { const p = new URLSearchParams(window.location.search); return p.get("from") || "hybrid-planner"; } catch { return "hybrid-planner"; } })()}`}
          style={{ padding: "7px 14px", borderRadius: 8, fontSize: 11, border: `1px solid ${border}`, background: "transparent", color: muted, textDecoration: "none", cursor: "pointer" }}>
          ← Planner
        </a>
        <button onClick={assemble} disabled={processing || !assembly.segments.length}
          style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, border: "none", background: processing ? "#2a2a40" : green, color: processing ? muted : "#000", cursor: processing ? "not-allowed" : "pointer", fontWeight: 800 }}>
          {processing ? "Processing..." : "🎬 Assemble & Export"}
        </button>
      </div>

      {/* ══ MAIN GRID — 3 cols, 2 rows ══ */}
      <div style={{ display: "grid", gridTemplateColumns: `${sidebarExpanded ? 300 : 180}px 1fr 300px`, gridTemplateRows: "1fr 130px", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT: Segments (spans both rows) ── */}
        <div style={{ gridRow: "1 / 3", background: s1, borderRight: `1px solid ${border}`, overflowY: "auto", padding: 6 }}>
          {/* Sidebar expand toggle */}
          <button onClick={() => setSidebarExpanded(p => !p)} style={{ width: "100%", padding: "4px 0", borderRadius: 4, border: "none", background: "transparent", color: muted, fontSize: 10, cursor: "pointer", marginBottom: 3 }}>
            {sidebarExpanded ? "◀ Collapse" : "▶ Expand"}
          </button>
          {/* Back to Projects — always visible */}
          {(assembly.segments.length > 0 || assembly.projectId !== "new") && (
            <button onClick={() => {
              // Save current project first
              if (assembly.segments.length > 0) {
                fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: assembly.projectId, title: assembly.title, assembly, status: "draft" }) }).catch(() => {});
              }
              // Reset to empty state — show project list
              setAssembly(createEmptyAssembly("new", "collaborative", "Untitled Project"));
              setMediaUrl("");
              setActiveSegIdx(0);
              setChatLog([]);
              setVersions([]);
              loadProjectList();
            }}
            style={{ width: "100%", padding: "7px 8px", borderRadius: 6, border: `1px solid ${purple}30`, background: `${purple}08`, color: purple, fontSize: 11, fontWeight: 600, cursor: "pointer", marginBottom: 5, textAlign: "left" }}>
              ← Projects
            </button>
          )}
          {/* Collapse all scenes / close folders */}
          {expandedFolders.size > 0 && (
            <button onClick={() => setExpandedFolders(new Set())}
              style={{ width: "100%", padding: "4px 8px", borderRadius: 4, border: "none", background: `${cyan}08`, color: cyan, fontSize: 8, cursor: "pointer", marginBottom: 2 }}>
              ⬆ Close All Folders
            </button>
          )}
          {/* Project/Story title folder */}
          {assembly.segments.length > 0 && assembly.title && assembly.title !== "Untitled Project" ? (
            <div style={{ padding: "6px 8px", marginBottom: 4, borderRadius: 6, background: `${purple}10`, border: `1px solid ${purple}20` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: purple, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📁 {assembly.title}
              </div>
              <div style={{ fontSize: 8, color: muted }}>{assembly.segments.length} scenes · {fmtTime(assembly.totalDuration)}</div>
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: muted, padding: "8px 6px 6px" }}>
              Scenes ({assembly.segments.length})
            </div>
          )}
          {assembly.segments.length === 0 && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ fontSize: 11, color: muted }}>No media</p>
              <button onClick={() => setShowImport(true)} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: `1px solid ${purple}`, background: `${purple}15`, color: purple, fontSize: 10, cursor: "pointer" }}>Import</button>
            </div>
          )}
          {assembly.segments.map((seg, i) => {
            const isExpanded = expandedFolders.has(i);
            const sceneNarr = assembly.narration.filter(n => n.startTime >= seg.startTime && n.startTime < seg.endTime);
            const sceneMusic = assembly.music.filter(m => m.startTime < seg.endTime && m.endTime > seg.startTime);
            const sceneSfx = assembly.sfx.filter(s => s.startTime >= seg.startTime && s.startTime < seg.endTime);
            const sceneOverlays = assembly.overlays.filter(o => o.startTime < seg.endTime && o.endTime > seg.startTime);
            const sceneSubs = assembly.subtitles.filter(s => s.startTime < seg.endTime && s.endTime > seg.startTime);
            return (
            <div key={seg.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData("text/plain", String(i)); setDragIdx(i); }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIdx(i); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={e => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData("text/plain") || "-1");
                if (fromIdx < 0 || fromIdx === i) { setDragIdx(null); setDragOverIdx(null); return; }
                updateAssembly(a => {
                  const moved = a.segments.splice(fromIdx, 1)[0];
                  a.segments.splice(i, 0, moved);
                  let t = 0;
                  a.segments.forEach(s => { s.startTime = t; s.endTime = t + s.duration; t += s.duration; });
                  a.totalDuration = t;
                });
                setActiveSegIdx(i);
                saveVersion(`Reordered: seg ${fromIdx + 1} → ${i + 1}`);
                setDragIdx(null); setDragOverIdx(null);
              }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              style={{
                borderRadius: 8, marginBottom: 3, overflow: "hidden",
                border: `1px solid ${dragOverIdx === i ? cyan : i === activeSegIdx ? purple : border}`,
                background: i === activeSegIdx ? `${purple}08` : s2,
                opacity: dragIdx === i ? 0.4 : 1,
              }}>
              {/* Scene folder header */}
              <div
                onClick={() => { setActiveSegIdx(i); if (seg.sourceUrl && !seg.sourceUrl.startsWith("bg:")) setMediaUrl(seg.sourceUrl); else if (seg.sourceUrl?.startsWith("bg:")) setMediaUrl(""); }}
                style={{ padding: "6px 8px", cursor: "grab", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ cursor: "grab", opacity: 0.3, fontSize: 10 }}>⠿</span>
                <button onClick={e => { e.stopPropagation(); toggleFolder(i); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 8, padding: 0 }}>
                  {isExpanded ? "▼" : "▶"}
                </button>
                {/* Scene thumbnail */}
                {seg.sourceUrl && !seg.sourceUrl.startsWith("bg:") && (
                  <div style={{ width: 28, height: 20, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: "#0a0d14", border: `1px solid ${border}` }}>
                    {seg.type === "video" ? (
                      <video src={seg.sourceUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted preload="metadata" />
                    ) : (
                      <img src={seg.sourceUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                  </div>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: seg.id === "seg_assembled" ? green : text, flex: 1 }}>
                  {seg.id === "seg_assembled" ? "📦 Output (assembled)" : seg.sourceUrl?.startsWith("bg:") ? "📄" : seg.type === "video" ? "🎬" : "🖼"} {seg.id !== "seg_assembled" && `Scene ${i + 1}`}
                </span>
                {/* Editable duration — click to change seconds per slide */}
                <input type="number" min="2" max="30" step="1" value={Math.round(seg.duration)}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    const newDur = Math.max(2, Math.min(30, parseInt(e.target.value) || 5));
                    updateAssembly(a => {
                      const s = a.segments[i];
                      if (!s) return;
                      s.duration = newDur;
                      // Recalculate all timings
                      let t = 0;
                      a.segments.forEach(seg2 => { seg2.startTime = t; seg2.endTime = t + seg2.duration; t += seg2.duration; });
                      a.totalDuration = t;
                      // Update overlay + narration timing for this scene
                      a.overlays.filter(o => o.id === `ovl_${i}`).forEach(o => { o.startTime = s.startTime; o.endTime = s.endTime; });
                      a.narration.filter(n => n.id === `narr_${i}`).forEach(n => { n.startTime = s.startTime + 0.3; n.endTime = s.endTime - 0.3; });
                    });
                  }}
                  style={{ width: 32, background: s2, border: `1px solid ${border}`, borderRadius: 4, padding: "1px 3px", color: muted, fontSize: 8, outline: "none", textAlign: "center", fontFamily: "monospace" }}
                  title="Duration (seconds)" />
                <span style={{ fontSize: 7, color: "#3d5060" }}>s</span>
              </div>
              {/* Scene folder layer summary + delete — always visible */}
              <div style={{ padding: "0 8px 4px", display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: seg.sourceUrl ? `${green}15` : `${red}15`, color: seg.sourceUrl ? green : red }}>{seg.sourceUrl?.startsWith("bg:") ? "slide" : seg.type}</span>
                <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: sceneNarr.length ? `${cyan}15` : `${muted}10`, color: sceneNarr.length ? cyan : "#2a3040" }}>{sceneNarr.length ? "narr" : "—"}</span>
                <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: sceneMusic.length ? `${green}15` : `${muted}10`, color: sceneMusic.length ? green : "#2a3040" }}>{sceneMusic.length ? "music" : "—"}</span>
                <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: sceneSfx.length ? `${gold}15` : `${muted}10`, color: sceneSfx.length ? gold : "#2a3040" }}>{sceneSfx.length ? `${sceneSfx.length} sfx` : "—"}</span>
                <span style={{ fontSize: 7, padding: "1px 4px", borderRadius: 3, background: sceneOverlays.length ? `#ec489915` : `${muted}10`, color: sceneOverlays.length ? "#ec4899" : "#2a3040" }}>{sceneOverlays.length ? "text" : "—"}</span>
                {/* Delete — always visible */}
                <button onClick={e => { e.stopPropagation();
                  updateAssembly(a => { a.segments = a.segments.filter((_, si) => si !== i); a.totalDuration = a.segments.reduce((t, s) => t + s.duration, 0); });
                  if (activeSegIdx >= assembly.segments.length - 1) setActiveSegIdx(Math.max(0, activeSegIdx - 1));
                  if (assembly.segments.length <= 1) { setMediaUrl(""); }
                  setExpandedFolders(prev => { const n = new Set(prev); n.delete(i); return n; });
                  saveVersion(`Deleted scene ${i + 1}`);
                }} style={{ fontSize: 7, color: red, background: "none", border: "none", cursor: "pointer", marginLeft: "auto", padding: "0 2px" }}>✕</button>
              </div>
              {/* Expanded folder content — per-layer details */}
              {isExpanded && (
                <div style={{ padding: "4px 8px 6px", borderTop: `1px solid ${border}`, fontSize: 8 }}>
                  {/* Source */}
                  <p style={{ color: muted, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {seg.sourceUrl?.split("/").pop() || "No source file"}
                  </p>
                  {/* Narration in this scene */}
                  {sceneNarr.length > 0 ? sceneNarr.map(n => (
                    <div key={n.id} style={{ color: cyan, marginBottom: 2 }}>
                      🎙 {n.text?.slice(0, 30) || "Narration"}{n.audioUrl ? " ✓" : ""}
                    </div>
                  )) : <div style={{ color: "#2a3040" }}>🎙 No narration</div>}
                  {/* Music in this scene */}
                  {sceneMusic.length > 0 ? sceneMusic.map(m => (
                    <div key={m.id} style={{ color: green, marginBottom: 2 }}>
                      🎵 Music ({Math.round(m.volume * 100)}%)
                    </div>
                  )) : <div style={{ color: "#2a3040" }}>🎵 No music</div>}
                  {/* SFX in this scene */}
                  {sceneSfx.length > 0 ? sceneSfx.map(s => (
                    <div key={s.id} style={{ color: gold, marginBottom: 2 }}>
                      💥 {s.event} @ {fmtTime(s.startTime)}
                    </div>
                  )) : <div style={{ color: "#2a3040" }}>💥 No SFX</div>}
                  {/* Overlays in this scene */}
                  {sceneOverlays.length > 0 ? sceneOverlays.map(o => (
                    <div key={o.id} style={{ color: "#ec4899", marginBottom: 2 }}>
                      🎨 "{o.content.slice(0, 20)}" ({o.animation || "fade"})
                    </div>
                  )) : <div style={{ color: "#2a3040" }}>🎨 No overlays</div>}
                  {/* Subtitles */}
                  {sceneSubs.length > 0 && sceneSubs.map(s => (
                    <div key={s.id} style={{ color: purple, marginBottom: 2 }}>
                      📝 "{s.text.slice(0, 25)}"
                    </div>
                  ))}
                  {/* Delete */}
                  <button onClick={e => { e.stopPropagation();
                    updateAssembly(a => { a.segments = a.segments.filter((_, si) => si !== i); a.totalDuration = a.segments.reduce((t, s) => t + s.duration, 0); });
                    if (activeSegIdx >= assembly.segments.length - 1) setActiveSegIdx(Math.max(0, activeSegIdx - 1));
                    if (assembly.segments.length <= 1) setMediaUrl("");
                    setExpandedFolders(prev => { const n = new Set(prev); n.delete(i); return n; });
                    saveVersion(`Deleted scene ${i + 1}`);
                  }} style={{ fontSize: 7, color: red, background: "none", border: "none", cursor: "pointer", marginTop: 3 }}>Delete scene</button>
                </div>
              )}
            </div>
          );})}
          {/* Add segment / Intro / Outro */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: 8, borderRadius: 6, border: `1px dashed ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>+ Add Clip</button>
            {/* Intro — upload or generate */}
            <div data-intro-menu style={{ position: "relative" }}>
              <button onClick={() => { setShowIntroMenu(prev => !prev); setShowOutroMenu(false); }} style={{ width: "100%", padding: 7, borderRadius: 6, border: `1px solid ${cyan}20`, background: `${cyan}05`, color: cyan, fontSize: 11, cursor: "pointer" }}>+ Intro</button>
              {showIntroMenu && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, background: s1, border: `1px solid ${border}`, borderRadius: 8, padding: 6, marginTop: 2 }}>
                  <label style={{ display: "block", padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 9, color: text, marginBottom: 2 }}>
                    📁 Upload intro image/video
                    <input type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={async e => {
                      if (!e.target.files?.[0]) return;
                      setShowIntroMenu(false);
                      const file = e.target.files[0];
                      // Upload the file
                      const fd = new FormData();
                      const isVid = file.type.startsWith("video");
                      if (isVid) { fd.append("video", file); } else { fd.append("file", file); }
                      const upRes = await fetch(isVid ? "/api/video-trimmer/upload" : "/api/upload/logo", { method: "POST", body: fd });
                      const upData = await upRes.json();
                      const url = isVid ? (upData.tempPath ? `/api/media/${upData.tempPath.replace(/\\/g, "/").replace(/^.*?storage[\\/]/, "")}` : "") : (upData.url || "");
                      if (!url) return;
                      const dur = isVid ? Math.round(upData.metadata?.duration || 5) : 5;
                      updateAssembly(a => {
                        const intro = { id: `seg_intro_${Date.now()}`, type: (isVid ? "video" : "image") as "video" | "image", sourceUrl: url, startTime: 0, endTime: dur, duration: dur, transitionIn: "fade" as const, transitionOut: "fade" as const, imageTreatment: isVid ? undefined : "zoom_in" as const };
                        a.segments.unshift(intro);
                        let t = dur;
                        for (let i = 1; i < a.segments.length; i++) { a.segments[i].startTime = t; a.segments[i].endTime = t + a.segments[i].duration; t += a.segments[i].duration; }
                        a.totalDuration = t;
                      });
                      saveVersion("Intro uploaded");
                      setChatLog(p => [...p, { role: "ai", text: `Intro ${isVid ? "video" : "image"} added (${dur}s).` }]);
                    }} />
                  </label>
                  {showIntroGen ? (
                    <div style={{ padding: "6px 8px" }}>
                      <input
                        autoFocus
                        value={introGenPrompt}
                        onChange={e => setIntroGenPrompt(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key !== "Enter" || !introGenPrompt.trim()) return;
                          setShowIntroMenu(false); setShowIntroGen(false);
                          const p = introGenPrompt.trim(); setIntroGenPrompt("");
                          setProcessing(true);
                          setChatLog(prev => [...prev, { role: "ai", text: `Generating intro: "${p}"...` }]);
                          try {
                            const res = await fetch("/api/comfyui", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
                            const d = await res.json();
                            const url = d.imageUrl || d.url || "";
                            if (url) {
                              updateAssembly(a => {
                                const intro = { id: `seg_intro_${Date.now()}`, type: "image" as const, sourceUrl: url, startTime: 0, endTime: 5, duration: 5, transitionIn: "fade" as const, transitionOut: "fade" as const, imageTreatment: "zoom_in" as const };
                                a.segments.unshift(intro);
                                let t = 5;
                                for (let i = 1; i < a.segments.length; i++) { a.segments[i].startTime = t; a.segments[i].endTime = t + a.segments[i].duration; t += a.segments[i].duration; }
                                a.totalDuration = t;
                              });
                              setChatLog(prev => [...prev, { role: "ai", text: "Intro image generated and added." }]);
                              saveVersion("Intro generated");
                            }
                          } catch { setChatLog(prev => [...prev, { role: "ai", text: "Intro generation failed." }]); }
                          setProcessing(false);
                        }}
                        placeholder="Describe your intro... (Enter to generate)"
                        style={{ width: "100%", background: s2, border: `1px solid ${cyan}40`, borderRadius: 6, padding: "6px 8px", color: text, fontSize: 11, outline: "none" }}
                      />
                      <button onClick={() => setShowIntroGen(false)} style={{ marginTop: 4, fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowIntroGen(true)}
                      style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", background: "transparent", color: text, fontSize: 11, cursor: "pointer", textAlign: "left" }}>🎨 Generate intro image (AI)</button>
                  )}
                  <a href="/dashboard/templates" target="_blank" style={{ display: "block", padding: "6px 10px", borderRadius: 6, fontSize: 11, color: muted, textDecoration: "none" }}>📋 Browse intro templates</a>
                </div>
              )}
            </div>
            {/* Outro — same options */}
            <div data-outro-menu style={{ position: "relative", zIndex: 25 }}>
              <button onClick={() => { setShowOutroMenu(prev => !prev); setShowIntroMenu(false); }} style={{ width: "100%", padding: 7, borderRadius: 6, border: `1px solid ${gold}20`, background: `${gold}05`, color: gold, fontSize: 11, cursor: "pointer" }}>+ Outro</button>
              {showOutroMenu && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, background: s1, border: `1px solid ${border}`, borderRadius: 8, padding: 6, marginTop: 2 }}>
                  <label style={{ display: "block", padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 9, color: text, marginBottom: 2 }}>
                    📁 Upload outro image/video
                    <input type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={async e => {
                      if (!e.target.files?.[0]) return;
                      setShowOutroMenu(false);
                      const file = e.target.files[0];
                      const fd = new FormData();
                      const isVid = file.type.startsWith("video");
                      if (isVid) { fd.append("video", file); } else { fd.append("file", file); }
                      const upRes = await fetch(isVid ? "/api/video-trimmer/upload" : "/api/upload/logo", { method: "POST", body: fd });
                      const upData = await upRes.json();
                      const url = isVid ? (upData.tempPath ? `/api/media/${upData.tempPath.replace(/\\/g, "/").replace(/^.*?storage[\\/]/, "")}` : "") : (upData.url || "");
                      if (!url) return;
                      const dur = isVid ? Math.round(upData.metadata?.duration || 5) : 5;
                      updateAssembly(a => {
                        a.segments.push({ id: `seg_outro_${Date.now()}`, type: (isVid ? "video" : "image") as "video" | "image", sourceUrl: url, startTime: a.totalDuration, endTime: a.totalDuration + dur, duration: dur, transitionIn: "fade" as const, transitionOut: "fade" as const, imageTreatment: isVid ? undefined : "zoom_in" as const });
                        a.totalDuration += dur;
                      });
                      saveVersion("Outro uploaded");
                      setChatLog(p => [...p, { role: "ai", text: `Outro ${isVid ? "video" : "image"} added (${dur}s).` }]);
                    }} />
                  </label>
                  {showOutroGen ? (
                    <div style={{ padding: "6px 8px" }}>
                      <input
                        autoFocus
                        value={outroGenPrompt}
                        onChange={e => setOutroGenPrompt(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key !== "Enter" || !outroGenPrompt.trim()) return;
                          setShowOutroMenu(false); setShowOutroGen(false);
                          const p = outroGenPrompt.trim(); setOutroGenPrompt("");
                          setProcessing(true);
                          setChatLog(prev => [...prev, { role: "ai", text: `Generating outro: "${p}"...` }]);
                          try {
                            const res = await fetch("/api/comfyui", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
                            const d = await res.json();
                            const url = d.imageUrl || d.url || "";
                            if (url) {
                              updateAssembly(a => {
                                a.segments.push({ id: `seg_outro_${Date.now()}`, type: "image" as const, sourceUrl: url, startTime: a.totalDuration, endTime: a.totalDuration + 5, duration: 5, transitionIn: "fade" as const, transitionOut: "fade" as const, imageTreatment: "zoom_in" as const });
                                a.totalDuration += 5;
                              });
                              setChatLog(prev => [...prev, { role: "ai", text: "Outro image generated and added." }]);
                              saveVersion("Outro generated");
                            }
                          } catch { setChatLog(prev => [...prev, { role: "ai", text: "Outro generation failed." }]); }
                          setProcessing(false);
                        }}
                        placeholder="Describe your outro... (Enter to generate)"
                        style={{ width: "100%", background: s2, border: `1px solid ${gold}40`, borderRadius: 6, padding: "6px 8px", color: text, fontSize: 11, outline: "none" }}
                      />
                      <button onClick={() => setShowOutroGen(false)} style={{ marginTop: 4, fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowOutroGen(true)}
                      style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", background: "transparent", color: text, fontSize: 11, cursor: "pointer", textAlign: "left" }}>🎨 Generate outro image (AI)</button>
                  )}
                </div>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) importFile(e.target.files[0]); }} />
        </div>

        {/* ── CENTER: Preview + Playback ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#000" }}>
          {/* Video/Image preview */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {(mediaUrl || (activeSeg?.sourceUrl?.startsWith("bg:"))) ? (
              <div style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* InvText slide: gradient background + text overlay */}
                {activeSeg?.sourceUrl?.startsWith("bg:") && !mediaUrl ? (
                  <div data-testid="invtext-preview" style={{ width: "100%", height: "100%", background: activeSeg.sourceUrl.slice(3), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 0 }}>
                    {/* Scene status badge */}
                    <div style={{ position: "absolute", top: 10, left: 10, fontSize: 9, padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.5)", color: green }}>
                      Scene {activeSegIdx + 1} — InvText Slide
                    </div>
                  </div>
                ) : (mediaUrl.match(/\.(mp4|mov|webm)$/i) || activeSeg?.type === "video") ? (
                  <video ref={videoRef} src={mediaUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    onClick={togglePlay} />
                ) : mediaUrl ? (
                  <img src={mediaUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : null}
                {/* Save video button — Place 3: floating on video preview */}
                {mediaUrl && !mediaUrl.startsWith("blob:") && (
                  <a href={mediaUrl} download={`${(assembly.title || "video").replace(/\s+/g, "_")}.mp4`}
                    style={{ position: "absolute", top: 8, right: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(0,0,0,0.75)", border: `1px solid ${green}50`, color: green, fontSize: 10, fontWeight: 700, textDecoration: "none", zIndex: 20, backdropFilter: "blur(4px)" }}>
                    💾 Save Video
                  </a>
                )}
                {/* Live text overlays — FRAME-ACCURATE: only show when currentTime is in range */}
                {/* HIDE overlays when playing assembled video (text already burned in) */}
                {!(activeSeg?.id === "seg_assembled" || mediaUrl?.includes("/assembled/")) && assembly.subtitles
                  .filter(sub => {
                    if (activeSeg?.sourceUrl?.startsWith("bg:") && !mediaUrl) {
                      return sub.startTime >= (activeSeg.startTime || 0) && sub.startTime < (activeSeg.endTime || Infinity);
                    }
                    return currentTime >= sub.startTime && currentTime <= sub.endTime;
                  })
                  .map(sub => (
                  <div key={sub.id} style={{
                    position: "absolute",
                    left: "50%", transform: "translateX(-50%)",
                    ...(sub.position === "top" ? { top: 16 } : sub.position === "center" ? { top: "50%", transform: "translate(-50%, -50%)" } : { bottom: 16 }),
                    background: "rgba(0,0,0,0.7)", color: sub.fontColor || "#fff",
                    padding: "6px 16px", borderRadius: 6,
                    fontSize: sub.fontSize || 18, fontWeight: 600,
                    maxWidth: "80%", textAlign: "center", pointerEvents: "none",
                  }}>{sub.text}</div>
                ))}
                {/* HIDE overlays when playing assembled video (text already burned in) */}
                {!(activeSeg?.id === "seg_assembled" || mediaUrl?.includes("/assembled/")) && assembly.overlays
                  .filter(ovl => {
                    if (activeSeg?.sourceUrl?.startsWith("bg:") && !mediaUrl) {
                      return ovl.startTime >= (activeSeg.startTime || 0) && ovl.startTime < (activeSeg.endTime || Infinity);
                    }
                    return currentTime >= ovl.startTime && currentTime <= ovl.endTime;
                  })
                  .map(ovl => {
                  const fs = ovl.size?.width || 16;
                  const yPos = ovl.position?.y ?? 90;
                  const anim = ovl.animation || "fade";
                  const charCount = ovl.content.length;
                  // Animation should trigger when overlay first appears (currentTime crosses startTime)
                  const timeIntoOverlay = currentTime - ovl.startTime;
                  const justAppeared = timeIntoOverlay < 1.5; // trigger animation within first 1.5s of appearance
                  const typewriterStyle = anim === "typewriter" ? {
                    whiteSpace: "nowrap" as const,
                    overflow: "hidden" as const,
                    borderRight: "2px solid #fff",
                    animation: justAppeared ? `ovl-typewriter ${charCount * 0.1}s steps(${charCount}) forwards` : undefined,
                    width: justAppeared ? undefined : "auto",
                  } : {};
                  const isInvTextSlide = activeSeg?.sourceUrl?.startsWith("bg:") && !mediaUrl;
                  return (
                    <div key={`${ovl.id}-${anim}`} data-testid={`overlay-${anim}`}
                      className={justAppeared && anim !== "typewriter" ? `ovl-anim-${anim}` : undefined}
                      contentEditable={isInvTextSlide}
                      suppressContentEditableWarning
                      onBlur={isInvTextSlide ? (e) => {
                        const newText = (e.target as HTMLDivElement).textContent || "";
                        if (newText !== ovl.content) {
                          updateAssembly(a => {
                            const o = a.overlays.find(x => x.id === ovl.id);
                            if (o) o.content = newText;
                            const n = a.narration.find(x => x.id === `narr_${activeSegIdx}`);
                            if (n) n.text = newText;
                          });
                        }
                      } : undefined}
                      style={{
                        position: "absolute",
                        left: "50%", transform: yPos === 50 ? "translate(-50%, -50%)" : "translateX(-50%)",
                        bottom: yPos > 50 ? 30 : undefined,
                        top: yPos < 50 ? 16 : yPos === 50 ? "50%" : undefined,
                        background: "rgba(168,85,247,0.85)", color: "#fff",
                        padding: `${Math.max(8, fs / 3)}px ${Math.max(20, fs)}px`, borderRadius: 12,
                        fontSize: fs, fontWeight: 700, lineHeight: 1.5,
                        pointerEvents: isInvTextSlide ? "auto" : "none",
                        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                        maxWidth: "80%", textAlign: "center",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: isInvTextSlide ? "text" : "default",
                        outline: "none",
                        border: isInvTextSlide ? "2px dashed transparent" : "none",
                        ...typewriterStyle,
                      }}>{ovl.content}</div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", maxWidth: 640, width: "100%" }}>
                {/* ═══ PROJECT LIST — shown when saved projects exist ═══ */}
                {projectList.length > 0 && !showProjectList && (
                  <div style={{ marginBottom: 16 }}>
                    <button onClick={() => setShowProjectList(true)} style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${purple}40`, background: `${purple}08`, color: purple, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      📋 Open Saved Project ({projectList.length})
                    </button>
                  </div>
                )}
                {showProjectList && (
                  <div style={{ marginBottom: 20, textAlign: "left", background: s2, borderRadius: 14, border: `1px solid ${border}`, padding: 16, maxHeight: 340, overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: text }}>Saved Projects</p>
                      <button onClick={() => setShowProjectList(false)} style={{ fontSize: 11, color: muted, background: "none", border: "none", cursor: "pointer" }}>✕ Close</button>
                    </div>
                    {projectList.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, border: `1px solid ${border}`, marginBottom: 6, background: s1 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: text }}>{p.title}</p>
                          <p style={{ fontSize: 9, color: muted }}>{p.scenes} scenes · {Math.round(p.duration)}s · {p.creationMode || "collaborative"} · {new Date(p.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => loadProject(p.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Open</button>
                          <button onClick={() => deleteProject(p.id, "editor")} title="Remove from editor (keeps in library)" style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>🗑</button>
                          <button onClick={() => { if (confirm("Delete FOREVER? This cannot be undone.")) deleteProject(p.id, "forever"); }} title="Delete forever" style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid #ef444440`, background: "transparent", color: "#ef4444", fontSize: 10, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>
                    ))}
                    {projectList.length === 0 && <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: 20 }}>No saved projects yet</p>}
                  </div>
                )}

                <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 6 }}>GHS Editor</p>
                  <p style={{ fontSize: 12, color: muted, marginBottom: 16, maxWidth: 320, margin: "0 auto 16px" }}>
                    Use the <span style={{ color: purple, fontWeight: 700 }}>🤖 AI tab</span> (right panel) to create your video, or import a file below.
                  </p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setShowImport(true)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>📂 Upload File</button>
                    <button onClick={async () => {
                      try {
                        const res = await fetch("/api/assets?type=video&limit=20");
                        const d = await res.json();
                        setAssetList((d.assets || d.items || []).map((a: { id: string; filePath?: string; mergedOutputPath?: string; videoPath?: string; name?: string; originalInput?: string }) => {
                          const rawPath = a.filePath || a.mergedOutputPath || a.videoPath || "";
                          const url = rawPath ? `/api/media/${rawPath.replace(/\\/g, "/").replace(/^.*?storage[\\/]/, "")}` : "";
                          return { id: a.id, url, title: a.name || a.originalInput || "Asset" };
                        }));
                      } catch {}
                      setShowImport(true);
                    }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>📦 Asset Library</button>
                    <button onClick={() => { loadProjectList(); setShowProjectList(true); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>📋 Load Project</button>
                  </div>
                </div>
                {false && (<div>

                {/* ═══ SHARED: Content type + Design panel — ALL MODES ═══ */}
                <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "center" }}>
                  <select id="invtext-type" style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "4px 8px", color: text, fontSize: 9, outline: "none" }}>
                    <option value="story">Story Telling</option>
                    <option value="children">Children Story</option>
                    <option value="ad">Commercial Ad</option>
                    <option value="motivational">Motivational</option>
                    <option value="educational">Educational</option>
                    <option value="lyrics">Song Lyrics</option>
                    <option value="poem">Poetry</option>
                    <option value="news">News / Update</option>
                    <option value="tutorial">Tutorial Steps</option>
                    <option value="quotes">Quote Series</option>
                  </select>
                </div>

                {/* ═══ SHARED: Design panel — ALL MODES (hidden until clicked) ═══ */}
                {creationMode !== "ai_motion" && (<>
                {/* Design button — hidden panel, only opens on click */}
                    <button onClick={() => setShowDesignPanel(p => !p)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${showDesignPanel ? purple : border}`, background: showDesignPanel ? `${purple}12` : s2, color: showDesignPanel ? purple : muted, fontSize: 10, cursor: "pointer", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600 }}>
                      🎨 Design & Background {showDesignPanel ? "▲" : "▼"}
                    </button>

                    {/* ═══ FULL DESIGN PANEL — hidden until clicked ═══ */}
                    {showDesignPanel && (
                      <div style={{ padding: 10, marginBottom: 10, borderRadius: 10, border: `1px solid ${purple}25`, background: s2 }}>

                        {/* ── Design Style Selector with LIVE PREVIEW ── */}
                        <p style={{ fontSize: 8, color: muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Typography Style</p>
                        {/* Animated preview style tag */}
                        <style>{`
                          @keyframes dg-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
                          @keyframes dg-pulse { 0%,100%{opacity:1;text-shadow:0 0 6px currentColor} 50%{opacity:0.7;text-shadow:0 0 16px currentColor,0 0 30px currentColor} }
                          @keyframes dg-slide { 0%{transform:translateX(-20px);opacity:0} 30%{transform:translateX(0);opacity:1} 70%{transform:translateX(0);opacity:1} 100%{transform:translateX(20px);opacity:0} }
                          @keyframes dg-wave { 0%,100%{transform:rotate(-2deg) scale(1)} 25%{transform:rotate(1deg) scale(1.03)} 50%{transform:rotate(-1deg) scale(0.98)} 75%{transform:rotate(2deg) scale(1.02)} }
                          @keyframes dg-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-2px)} 40%{transform:translateX(2px)} 60%{transform:translateX(-1px)} 80%{transform:translateX(1px)} }
                          @keyframes dg-zoom { 0%{transform:scale(0.8);opacity:0} 20%{transform:scale(1.05);opacity:1} 80%{transform:scale(1);opacity:1} 100%{transform:scale(0.9);opacity:0} }
                          @keyframes dg-rotate { 0%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} 100%{transform:rotate(-3deg)} }
                          @keyframes dg-flicker { 0%,100%{opacity:1} 50%{opacity:0.6} 52%{opacity:1} 80%{opacity:0.8} 82%{opacity:1} }
                          @keyframes dg-typewrite { from{width:0;overflow:hidden} to{width:100%} }
                          @keyframes dg-glow-pulse { 0%,100%{filter:drop-shadow(0 0 4px currentColor)} 50%{filter:drop-shadow(0 0 12px currentColor) drop-shadow(0 0 20px currentColor)} }
                          @keyframes dg-bounce { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} 60%{transform:translateY(2px)} }
                          @keyframes dg-scale-pop { 0%{transform:scale(0.5);opacity:0} 50%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
                        `}</style>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 10 }}>
                          {DESIGN_STYLES.map(style => {
                            const isActive = slideDesign.textStyle === style.id;
                            const sampleText = previewText || (document.getElementById("gen-prompt") as HTMLTextAreaElement)?.value?.split(/[.!?\n]/)[0]?.trim() || "SAMPLE TEXT";
                            const grad = `linear-gradient(${slideDesign.bgAngle}deg, ${slideDesign.bgColor1}, ${slideDesign.bgColor2}, ${slideDesign.bgColor3})`;
                            // Animated mini preview per style
                            const animMap: Record<string, string> = {
                              kinetic: "dg-float 2s ease-in-out infinite",
                              neon: "dg-pulse 1.5s ease-in-out infinite",
                              glass: "dg-slide 3s ease-in-out infinite",
                              engrave: "dg-shake 0.8s ease-in-out infinite",
                              retro: "dg-bounce 1.2s ease-in-out infinite",
                              outline: "dg-glow-pulse 2s ease-in-out infinite",
                              minimal: "dg-zoom 3s ease-in-out infinite",
                              gradient_text: "dg-wave 2.5s ease-in-out infinite",
                              cinema: "dg-typewrite 2.5s steps(15) infinite",
                              magazine: "dg-rotate 3s ease-in-out infinite",
                              hype: "dg-shake 0.4s ease-in-out infinite",
                              wave: "dg-wave 1.8s ease-in-out infinite",
                            };
                            const miniStyles: Record<string, React.CSSProperties> = {
                              kinetic: { textShadow: `0 0 8px ${slideDesign.glowColor}`, fontSize: 9, letterSpacing: 2 },
                              neon: { textShadow: `0 0 6px ${slideDesign.glowColor}, 0 0 15px ${slideDesign.glowColor}80`, fontSize: 10, color: slideDesign.glowColor },
                              glass: { background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", padding: "3px 6px", borderRadius: 4, fontSize: 9 },
                              engrave: { textShadow: "0 -1px 0 rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1)", fontSize: 10 },
                              retro: { textShadow: `2px 2px 0 ${slideDesign.glowColor}`, fontSize: 10 },
                              outline: { WebkitTextStroke: "1px white", WebkitTextFillColor: "transparent", fontSize: 10 } as React.CSSProperties,
                              minimal: { fontSize: 10, fontWeight: 400, letterSpacing: 1 },
                              gradient_text: { background: `linear-gradient(90deg, #a855f7, #ec4899, #f59e0b)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 10 } as React.CSSProperties,
                              cinema: { fontSize: 8, letterSpacing: 4, borderTop: "1px solid rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.3)", padding: "2px 0", whiteSpace: "nowrap", overflow: "hidden" },
                              magazine: { fontFamily: "Georgia, serif", fontSize: 11, fontStyle: "italic", letterSpacing: 1 },
                              hype: { fontSize: 11, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" as const },
                              wave: { textShadow: "0 0 8px rgba(0,200,255,0.5)", fontSize: 9, fontStyle: "italic" },
                            };
                            return (
                              <button key={style.id} onClick={() => setSlideDesign(p => ({ ...p, textStyle: style.id }))}
                                style={{ padding: 6, borderRadius: 8, border: `1px solid ${isActive ? purple : border}`, background: isActive ? `${purple}15` : "#0a0d14", cursor: "pointer", textAlign: "left", overflow: "hidden" }}>
                                <div style={{ width: "100%", height: 36, borderRadius: 5, background: grad, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4, overflow: "hidden", position: "relative" }}>
                                  <span style={{ color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%", animation: animMap[style.id] || "none", display: "inline-block", ...miniStyles[style.id] }}>
                                    {sampleText.slice(0, 18)}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <span style={{ fontSize: 10 }}>{style.icon}</span>
                                  <div>
                                    <p style={{ fontSize: 8, fontWeight: 700, color: isActive ? purple : text }}>{style.name}</p>
                                    <p style={{ fontSize: 6, color: muted }}>{style.desc}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* ── Gradient Colors ── */}
                        <p style={{ fontSize: 8, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Colors</p>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
                          <input type="color" value={slideDesign.bgColor1} onChange={e => setSlideDesign(p => ({ ...p, bgColor1: e.target.value }))} style={{ width: 28, height: 22, border: "none", borderRadius: 4, cursor: "pointer" }} />
                          <input type="color" value={slideDesign.bgColor2} onChange={e => setSlideDesign(p => ({ ...p, bgColor2: e.target.value }))} style={{ width: 28, height: 22, border: "none", borderRadius: 4, cursor: "pointer" }} />
                          <input type="color" value={slideDesign.bgColor3} onChange={e => setSlideDesign(p => ({ ...p, bgColor3: e.target.value }))} style={{ width: 28, height: 22, border: "none", borderRadius: 4, cursor: "pointer" }} />
                          <input type="color" value={slideDesign.glowColor} onChange={e => setSlideDesign(p => ({ ...p, glowColor: e.target.value }))} style={{ width: 28, height: 22, border: "none", borderRadius: 4, cursor: "pointer" }} title="Glow color" />
                          <span style={{ fontSize: 7, color: "#3d5060" }}>glow</span>
                        </div>
                        {/* Quick presets */}
                        <div style={{ display: "flex", gap: 3, marginBottom: 6, flexWrap: "wrap" }}>
                          {[
                            { n: "Purple", c: ["#6c5ce7","#a855f7","#c084fc"] },
                            { n: "Sunset", c: ["#ff6b35","#f7c948","#e63946"] },
                            { n: "Ocean", c: ["#0077b6","#00b4d8","#90e0ef"] },
                            { n: "Neon", c: ["#00ff87","#60efff","#ff00c8"] },
                            { n: "Fire", c: ["#ff006e","#fb5607","#ffbe0b"] },
                            { n: "Gold", c: ["#b8860b","#ffd700","#f59e0b"] },
                            { n: "Forest", c: ["#2d6a4f","#52b788","#b7e4c7"] },
                            { n: "Night", c: ["#240046","#7b2cbf","#c77dff"] },
                            { n: "Candy", c: ["#ff9a9e","#fad0c4","#ffecd2"] },
                            { n: "Steel", c: ["#2c3e50","#4ca1af","#c4e0e5"] },
                          ].map(p => (
                            <button key={p.n} onClick={() => setSlideDesign(prev => ({ ...prev, bgColor1: p.c[0], bgColor2: p.c[1], bgColor3: p.c[2] }))}
                              style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${border}`, background: `linear-gradient(90deg,${p.c.join(",")})`, color: "#fff", fontSize: 7, cursor: "pointer", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{p.n}</button>
                          ))}
                        </div>
                        {/* Preview stripe */}
                        <div style={{ width: "100%", height: 16, borderRadius: 4, marginBottom: 8, background: `linear-gradient(${slideDesign.bgAngle}deg, ${slideDesign.bgColor1}, ${slideDesign.bgColor2}, ${slideDesign.bgColor3})` }} />

                        {/* ── Font ── */}
                        <p style={{ fontSize: 8, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Font</p>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                          <select value={slideDesign.fontFamily} onChange={e => setSlideDesign(p => ({ ...p, fontFamily: e.target.value }))}
                            style={{ background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "3px 6px", color: text, fontSize: 8, outline: "none" }}>
                            <option value="Segoe UI">Segoe UI</option>
                            <option value="Arial Black">Arial Black</option>
                            <option value="Impact">Impact</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Trebuchet MS">Trebuchet MS</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Courier New">Courier New</option>
                          </select>
                          <input type="number" min="40" max="150" value={slideDesign.fontSize} onChange={e => setSlideDesign(p => ({ ...p, fontSize: parseInt(e.target.value) || 88 }))}
                            style={{ width: 36, background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "2px 4px", color: text, fontSize: 8, outline: "none", textAlign: "center" }} />
                          <span style={{ fontSize: 7, color: "#3d5060" }}>px</span>
                          <input type="color" value={slideDesign.fontColor} onChange={e => setSlideDesign(p => ({ ...p, fontColor: e.target.value }))} style={{ width: 22, height: 16, border: "none", borderRadius: 3, cursor: "pointer" }} title="Font color" />
                        </div>

                        {/* ── Background Pattern ── */}
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
                          {(["flow","none","dots","lines","circles"] as const).map(p => (
                            <button key={p} onClick={() => setSlideDesign(prev => ({ ...prev, bgPattern: p }))}
                              style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${slideDesign.bgPattern === p ? cyan : border}`, background: slideDesign.bgPattern === p ? `${cyan}15` : "transparent", color: slideDesign.bgPattern === p ? cyan : muted, fontSize: 7, cursor: "pointer", textTransform: "capitalize" }}>{p}</button>
                          ))}
                        </div>

                        {/* ── Toggles ── */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <label style={{ fontSize: 7, color: muted, display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
                            <input type="checkbox" checked={slideDesign.textGlow} onChange={e => setSlideDesign(p => ({ ...p, textGlow: e.target.checked }))} /> Glow
                          </label>
                          <label style={{ fontSize: 7, color: muted, display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
                            <input type="checkbox" checked={slideDesign.showCorners} onChange={e => setSlideDesign(p => ({ ...p, showCorners: e.target.checked }))} /> Corners
                          </label>
                          <label style={{ fontSize: 7, color: muted, display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
                            <input type="checkbox" checked={slideDesign.showRings} onChange={e => setSlideDesign(p => ({ ...p, showRings: e.target.checked }))} /> Rings
                          </label>
                          <span style={{ fontSize: 7, color: muted }}>Angle:</span>
                          <input type="number" min="0" max="360" value={slideDesign.bgAngle} onChange={e => setSlideDesign(p => ({ ...p, bgAngle: parseInt(e.target.value) || 135 }))}
                            style={{ width: 34, background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "1px 3px", color: text, fontSize: 7, outline: "none", textAlign: "center" }} />
                        </div>
                      </div>
                    )}
                </>)}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* ═══ GHS INVTEXT — AI Story Builder + Manual ═══ */}
                {/* ═══════════════════════════════════════════════════════ */}
                {creationMode === "ghs_invtext" && (
                  <div style={{ textAlign: "left" }}>
                    {/* Story prompt */}
                    <textarea id="gen-prompt" data-testid="invtext-prompt" placeholder={"Describe your story and let AI build it:\n\nExample: A sad lion walks alone in the savannah. He misses his family. Then he discovers his 8 cubs hiding in the tall grass. Joy fills his heart.\n\nOr type slides manually:\nSlide 1: Once upon a time...\nSlide 2: A hero was born."}
                      rows={5}
                      style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: text, fontSize: 12, outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, minHeight: 100 }} />
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {/* AI Story Build — LLM writes slides, picks backgrounds */}
                      <button data-testid="invtext-ai-build" onClick={async () => {
                        const prompt = (document.getElementById("gen-prompt") as HTMLTextAreaElement)?.value;
                        if (!prompt?.trim()) return;
                        setProcessing(true);

                        // ═══ INTELLIGENT AI PIPELINE — ONE CLICK DOES EVERYTHING ═══
                        // Step 1: AI writes the story slides
                        setChatLog([{ role: "ai", text: "Step 1/4 — AI is writing your story..." }]);
                        try {
                          const contentType = (document.getElementById("invtext-type") as HTMLSelectElement)?.value || "story";
                          const res = await fetch("/api/video/invtext-story", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt, tier, contentType }),
                          });
                          const d = await res.json();
                          if (!d.story) { setChatLog(p => [...p, { role: "ai", text: `Story failed: ${d.error || "Try again."}` }]); setProcessing(false); return; }
                          const story = d.story;
                          const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", story.title || "InvText Story");
                          let t = 0;
                          story.slides.forEach((slide: { slide_number: number; text: string; mood: string; background: string; animation: string; duration: number; font_size: string }, i: number) => {
                            const dur = slide.duration || 5;
                            // Use design panel gradient if set, otherwise use AI mood-matched background
                            const customGradient = `linear-gradient(${slideDesign.bgAngle}deg, ${slideDesign.bgColor1}, ${slideDesign.bgColor2}, ${slideDesign.bgColor3})`;
                            const useBg = showDesignPanel ? customGradient : (slide.background || customGradient);
                            a.segments.push({ id: `seg_${i}`, type: "image", sourceUrl: `bg:${useBg}`, startTime: t, endTime: t + dur, duration: dur, transitionIn: "fade", transitionOut: i < story.slides.length - 1 ? "dissolve" : "fade" });
                            const fontSize = slide.font_size === "xlarge" ? 36 : slide.font_size === "large" ? 28 : slide.font_size === "medium" ? 22 : 18;
                            a.overlays.push({ id: `ovl_${i}`, type: "text", content: slide.text, startTime: t, endTime: t + dur, position: { x: 50, y: 50 }, size: { width: fontSize, height: fontSize }, opacity: 1, animation: (slide.animation || "fade") as OverlayEntry["animation"] });
                            t += dur;
                          });
                          a.totalDuration = t;
                          story.slides.forEach((slide: { text: string }, si: number) => {
                            const segStart = a.segments[si]?.startTime || 0;
                            const segEnd = a.segments[si]?.endTime || 5;
                            a.narration.push({ id: `narr_${si}`, text: slide.text, startTime: segStart + 0.3, endTime: segEnd - 0.3, volume: 1, speed: 1, style: "normal" });
                          });
                          setAssembly(a); setActiveSegIdx(0);
                          setVersions([{ label: "v1 — Story", desc: story.title, assembly: structuredClone(a) }]);
                          fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.projectId, title: a.title, assembly: a, status: "draft" }) }).catch(() => {});
                          setChatLog(p => [...p, { role: "ai", text: `✓ Story written — ${story.slides.length} slides, ${Math.round(t)}s.\n${story.slides.map((s: { slide_number: number; text: string; mood: string }) => `  ${s.slide_number}. [${s.mood}] ${s.text.slice(0, 40)}`).join("\n")}` }]);

                          // Step 2: Auto-generate music
                          setChatLog(p => [...p, { role: "ai", text: `Step 2/4 — Generating ${story.music_mood} music...` }]);
                          try {
                            const musicRes = await fetch("/api/music/generate", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ prompt: `${story.music_mood} background music`, mood: story.music_mood, tier: "standard", durationSeconds: t }),
                            });
                            const musicData = await musicRes.json();
                            if (musicData.musicPath) {
                              const musicUrl = `/api/media/${musicData.musicPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
                              setAssembly(prev => {
                                const next = structuredClone(prev);
                                next.music = [{ id: "music_0", sourceUrl: musicUrl, startTime: 0, endTime: next.totalDuration, volume: 0.3, fadeIn: 1, fadeOut: 2, duckUnderSpeech: true, duckLevel: 0.1 }];
                                return next;
                              });
                              setChatLog(p => [...p, { role: "ai", text: `✓ Music generated (${story.music_mood}).` }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: "⚠ Music generation skipped." }]);
                            }
                          } catch { setChatLog(p => [...p, { role: "ai", text: "⚠ Music generation skipped." }]); }

                          // Step 3: Auto-generate narration TTS
                          setChatLog(p => [...p, { role: "ai", text: "Step 3/4 — Generating narration per slide..." }]);
                          try {
                            // Generate narration PER SLIDE — each slide gets its own audio
                            const slideTexts = story.slides.map((s: { text: string }) => s.text);
                            const narrUrls: string[] = [];
                            for (let si = 0; si < slideTexts.length; si++) {
                              try {
                                const ttsRes = await fetch("/api/voices/piper-preview", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ text: slideTexts[si], speed: 0.75 }),
                                });
                                if (ttsRes.ok && ttsRes.headers.get("content-type")?.includes("audio")) {
                                  const blob = await ttsRes.blob();
                                  const fd = new FormData();
                                  fd.append("file", new File([blob], `narr_s${si}_${Date.now()}.mp3`, { type: "audio/mpeg" }));
                                  const saveRes = await fetch("/api/upload/audio", { method: "POST", body: fd });
                                  const saveData = await saveRes.json();
                                  narrUrls.push(saveData.url || "");
                                } else { narrUrls.push(""); }
                              } catch { narrUrls.push(""); }
                            }
                            const successCount = narrUrls.filter(Boolean).length;
                            if (successCount > 0) {
                              setAssembly(prev => {
                                const next = structuredClone(prev);
                                // Assign each slide's audio to its narration entry
                                next.narration.forEach((n, ni) => {
                                  if (narrUrls[ni]) n.audioUrl = narrUrls[ni];
                                });
                                return next;
                              });
                              setChatLog(p => [...p, { role: "ai", text: `✓ Narration generated for ${successCount}/${slideTexts.length} slides.` }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: "⚠ Voice generation skipped." }]);
                            }
                          } catch { setChatLog(p => [...p, { role: "ai", text: "⚠ Voice generation skipped." }]); }

                          // Step 4: Auto-assemble via FFmpeg
                          setChatLog(p => [...p, { role: "ai", text: "Step 4/4 — Assembling video with FFmpeg..." }]);
                          // Small delay to let React state settle
                          await new Promise(r => setTimeout(r, 500));
                          try {
                            // Read the latest assembly from state
                            const latestAssembly = await new Promise<AssemblyJSON>(resolve => {
                              setAssembly(prev => { resolve(structuredClone(prev)); return prev; });
                            });
                            const scenes = latestAssembly.segments
                              .filter(seg => seg.id !== "seg_assembled")
                              .map((seg, i) => {
                                const sceneOverlay = latestAssembly.overlays.find(o => o.startTime >= seg.startTime && o.startTime < seg.endTime);
                                return { scene: i + 1, videoUrl: seg.sourceUrl, duration: seg.duration, text: sceneOverlay?.content || undefined };
                              });
                            const narrAudio = latestAssembly.narration.find(n => n.audioUrl)?.audioUrl;
                            const musicSrc = latestAssembly.music[0]?.sourceUrl;
                            const assembleRes = await fetch("/api/video/assemble", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: latestAssembly.title, scenes,
                                musicUrl: musicSrc, musicVolume: latestAssembly.music[0]?.volume ?? 0.3,
                                narrationUrl: narrAudio, narrationVolume: 1.0,
                              }),
                            });
                            const assembleData = await assembleRes.json();
                            if (assembleData.outputUrl) {
                              setMediaUrl(assembleData.outputUrl);
                              setAssembly(prev => {
                                const next = structuredClone(prev);
                                next.segments.unshift({ id: "seg_assembled", type: "video", sourceUrl: assembleData.outputUrl, startTime: 0, endTime: assembleData.duration || next.totalDuration, duration: assembleData.duration || next.totalDuration, transitionIn: "cut", transitionOut: "cut" });
                                return next;
                              });
                              saveVersion("AI Auto-Built");
                              // Save to library
                              try {
                                await fetch("/api/assets", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: story.title, type: "video", filePath: assembleData.outputUrl, status: "assembled", originalInput: prompt }),
                                });
                              } catch { /* optional */ }
                              // Step 5: AI Quality Supervisor — reviews output, reports issues
                              const latestAsm = await new Promise<AssemblyJSON>(resolve => { setAssembly(prev => { resolve(structuredClone(prev)); return prev; }); });
                              const issues: string[] = [];
                              const suggestions: string[] = [];
                              // Check narration
                              const hasNarrAudio = latestAsm.narration.some(n => n.audioUrl);
                              if (!hasNarrAudio && latestAsm.narration.length > 0) {
                                issues.push("⚠ Narration text exists but no voice audio generated — click Generate Voice in Properties");
                              }
                              // Check music
                              if (latestAsm.music.length === 0) {
                                suggestions.push("💡 No background music — add music in Properties for a richer video");
                              }
                              // Check slide count vs duration
                              const slideCount = latestAsm.segments.filter(s => s.sourceUrl?.startsWith("bg:")).length;
                              if (slideCount > 0 && latestAsm.totalDuration < slideCount * 2) {
                                issues.push("⚠ Slides too short — increase duration per slide for better readability");
                              }
                              if (slideCount > 8) {
                                suggestions.push("💡 Many slides (" + slideCount + ") — consider reducing for more impact");
                              }
                              // Check text length
                              const longTexts = latestAsm.overlays.filter(o => o.content.length > 60);
                              if (longTexts.length > 0) {
                                suggestions.push("💡 Some slides have long text — shorter text reads better on screen");
                              }
                              // Check SFX
                              if (latestAsm.sfx.length === 0 && contentType !== "poem" && contentType !== "quotes") {
                                suggestions.push("💡 No SFX — add sound effects for engagement (whoosh, impact, etc.)");
                              }
                              const qualityReport = [
                                `✓ Video assembled! ${assembleData.duration ? Math.round(assembleData.duration) + "s" : ""}`,
                                "",
                                "📋 AI Quality Report:",
                                `  Slides: ${slideCount} | Music: ${latestAsm.music.length > 0 ? "✓" : "✗"} | Narration: ${hasNarrAudio ? "✓ audio" : latestAsm.narration.length > 0 ? "text only" : "✗"} | SFX: ${latestAsm.sfx.length}`,
                                ...issues,
                                ...suggestions,
                                "",
                                issues.length === 0 ? "✅ Video looks good!" : "Fix the issues above for a better result.",
                                "",
                                "▶ Play | ✏ Edit | 🔄 Reassemble | ⬇ Download from Library",
                              ].join("\n");
                              setChatLog(p => [...p, { role: "ai", text: qualityReport }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: `⚠ Assembly failed: ${assembleData.error || "Unknown"}. You can still preview slides and try again.` }]);
                            }
                          } catch (assembleErr) {
                            setChatLog(p => [...p, { role: "ai", text: `⚠ Assembly failed: ${assembleErr instanceof Error ? assembleErr.message : "Unknown"}. Slides are ready — try Assemble & Export button.` }]);
                          }
                        } catch (err) { setChatLog(p => [...p, { role: "ai", text: `Build failed: ${err instanceof Error ? err.message : "Unknown"}` }]); }
                        setProcessing(false);
                      }} disabled={processing}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", background: processing ? "#2a2a40" : cyan, color: "#000", fontSize: 11, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer" }}>
                        {processing ? "AI Building..." : "Build & Assemble"}
                      </button>
                      {/* Build Only — creates slides, music, narration but does NOT assemble */}
                      <button onClick={async () => {
                        const prompt = (document.getElementById("gen-prompt") as HTMLTextAreaElement)?.value;
                        if (!prompt?.trim()) return;
                        setProcessing(true);
                        setChatLog([{ role: "ai", text: "Building slides..." }]);
                        try {
                          const contentType = (document.getElementById("invtext-type") as HTMLSelectElement)?.value || "story";
                          const res = await fetch("/api/video/invtext-story", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt, tier, contentType }),
                          });
                          const d = await res.json();
                          if (d.story) {
                            const story = d.story;
                            const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", story.title || "InvText Story");
                            let t = 0;
                            story.slides.forEach((slide: { slide_number: number; text: string; mood: string; background: string; animation: string; duration: number; font_size: string }, i: number) => {
                              const dur = slide.duration || 5;
                              const customGradient = `linear-gradient(${slideDesign.bgAngle}deg, ${slideDesign.bgColor1}, ${slideDesign.bgColor2}, ${slideDesign.bgColor3})`;
                              const useBg = showDesignPanel ? customGradient : (slide.background || customGradient);
                              a.segments.push({ id: `seg_${i}`, type: "image", sourceUrl: `bg:${useBg}`, startTime: t, endTime: t + dur, duration: dur, transitionIn: "fade", transitionOut: i < story.slides.length - 1 ? "dissolve" : "fade" });
                              const fontSize = slide.font_size === "xlarge" ? 36 : slide.font_size === "large" ? 28 : slide.font_size === "medium" ? 22 : 18;
                              a.overlays.push({ id: `ovl_${i}`, type: "text", content: slide.text, startTime: t, endTime: t + dur, position: { x: 50, y: 50 }, size: { width: fontSize, height: fontSize }, opacity: 1, animation: (slide.animation || "fade") as OverlayEntry["animation"] });
                              t += dur;
                            });
                            a.totalDuration = t;
                            story.slides.forEach((slide: { text: string }, si: number) => {
                              const segStart = a.segments[si]?.startTime || 0;
                              const segEnd = a.segments[si]?.endTime || 5;
                              a.narration.push({ id: `narr_${si}`, text: slide.text, startTime: segStart + 0.3, endTime: segEnd - 0.3, volume: 1, speed: 1, style: "normal" });
                            });
                            setAssembly(a); setActiveSegIdx(0);
                            setVersions([{ label: "v1 — Slides", desc: story.title, assembly: structuredClone(a) }]);
                            // Save project to database immediately
                            fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.projectId, title: a.title, assembly: a, status: "draft" }) }).catch(() => {});
                            setChatLog([{ role: "ai", text: `✓ "${story.title}" — ${story.slides.length} slides ready.\n\nSlides:\n${story.slides.map((s: { slide_number: number; text: string; mood: string }) => `  ${s.slide_number}. [${s.mood}] ${s.text.slice(0, 40)}`).join("\n")}\n\nNow you can:\n• Review & edit each slide\n• Add music in Properties\n• Change design in Background panel\n• Click "Assemble & Export" when ready` }]);
                          }
                        } catch { setChatLog(p => [...p, { role: "ai", text: "Build failed." }]); }
                        setProcessing(false);
                      }} disabled={processing}
                        style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${cyan}40`, background: "transparent", color: cyan, fontSize: 10, fontWeight: 600, cursor: processing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                        Build Only
                      </button>
                    </div>
                    {/* Manual build — for users who type their own slides */}
                    <button onClick={() => {
                      const textVal = (document.getElementById("gen-prompt") as HTMLTextAreaElement)?.value;
                      if (!textVal?.trim()) return;
                      const lines = textVal.split("\n").filter(l => l.trim());
                      const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", "InvText Video");
                      const durPerSlide = 5;
                      const defaultBgs = ["linear-gradient(135deg,#ff6b35,#f7c948,#e63946)", "linear-gradient(135deg,#0077b6,#00b4d8,#90e0ef)", "linear-gradient(135deg,#2d6a4f,#52b788,#b7e4c7)", "linear-gradient(135deg,#240046,#7b2cbf,#c77dff)", "linear-gradient(135deg,#ff006e,#fb5607,#ffbe0b)", "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)", "linear-gradient(135deg,#b8860b,#ffd700,#daa520)", "linear-gradient(135deg,#00ff87,#60efff,#ff00c8)"];
                      lines.forEach((line, i) => {
                        a.segments.push({ id: `seg_${i}`, type: "image", sourceUrl: `bg:${defaultBgs[i % defaultBgs.length]}`, startTime: i * durPerSlide, endTime: (i + 1) * durPerSlide, duration: durPerSlide, transitionIn: "fade", transitionOut: "fade" });
                        a.overlays.push({ id: `ovl_${i}`, type: "text", content: line.replace(/^Slide \d+:\s*/i, "").trim(), startTime: i * durPerSlide, endTime: (i + 1) * durPerSlide, position: { x: 50, y: 50 }, size: { width: 32, height: 32 }, opacity: 1, animation: "fade" });
                      });
                      a.totalDuration = lines.length * durPerSlide;
                      setAssembly(a); setActiveSegIdx(0);
                      setVersions([{ label: "v1 — Manual", desc: `${lines.length} slides`, assembly: structuredClone(a) }]);
                      setChatLog([{ role: "ai", text: `${lines.length} slides created manually. Add music and narration in Properties.` }]);
                    }} style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer", marginBottom: 6 }}>
                      Or build manually (one line = one slide)
                    </button>
                    <p style={{ fontSize: 8, color: muted, textAlign: "center" }}>
                      Stories, children songs, motivational quotes, lyric videos, educational content — no AI credits needed
                    </p>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* ═══ GHS TEXT → VIDEO — AI video generation ═══ */}
                {/* ═══════════════════════════════════════════════════════ */}
                {creationMode === "text_to_video" && (
                <div style={{ marginBottom: 12, textAlign: "left" }}>
                  <textarea id="gen-prompt" placeholder={"Describe your video in detail...\n\nExample: A warrior stands on a cliff at sunset, wind blowing through his cape. Camera slowly zooms in on his face as he surveys the battlefield below. Epic cinematic feel, dramatic lighting."}
                    rows={5}
                    style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: text, fontSize: 12, outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, minHeight: 100 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* GHS-branded model selector — Advanced toggle reveals real providers */}
                    <select id="gen-model" style={{ flex: 1, background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 10, outline: "none" }}>
                      {!showAdvancedModels ? (
                        <>
                          <option value="hailuo-fast">GHS Basic (1 credit, fast)</option>
                          <option value="kling2">GHS Standard (2 credits, balanced)</option>
                          <option value="kling3-pro">GHS Pro (4 credits, best quality)</option>
                        </>
                      ) : (
                        <>
                          <option value="hailuo-fast">Hailuo Fast (1 credit, 30-60s)</option>
                          <option value="kling2">Kling 2.0 (2 credits, 1-2min)</option>
                          <option value="kling3-pro">Kling 3.0 Pro (4 credits, best quality)</option>
                          <option value="hailuo-pro">Hailuo Pro (3 credits, creative)</option>
                          <option value="seedance">SeeDance 2.0 (2 credits, motion)</option>
                          <option value="wan25">Wan 2.5 (1 credit, budget)</option>
                        </>
                      )}
                    </select>
                    {/* Smart Generate — uses hybrid pipeline: story → characters → scenes → draft */}
                    <button onClick={async () => {
                      const prompt = (document.getElementById("gen-prompt") as HTMLInputElement)?.value;
                      if (!prompt?.trim()) return;
                      setProcessing(true);
                      setChatLog([{ role: "ai", text: "Step 1/3 — Expanding story with AI..." }]);
                      try {
                        const expRes = await fetch("/api/hybrid/story-expand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyInput: prompt }) });
                        const { expandedStory: exp } = await expRes.json();
                        setChatLog(p => [...p, { role: "ai", text: `Step 2/3 — ${exp?.characterList?.length || 0} characters found. Planning scenes...` }]);
                        const charRes = await fetch("/api/hybrid/character-extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expandedStory: exp, projectId: `t2v_${Date.now()}` }) });
                        const { characters: chars } = await charRes.json();
                        const sceneRes = await fetch("/api/hybrid/scene-breakdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expandedStory: exp, characters: chars || [], projectId: `t2v_${Date.now()}` }) });
                        const { scenes } = await sceneRes.json();
                        const sceneList = scenes || [];
                        setChatLog(p => [...p, { role: "ai", text: `Step 3/3 — Generating images for ${sceneList.length} scenes...` }]);
                        const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", exp?.summary?.slice(0, 30) || prompt.slice(0, 30));
                        let ti = 0;
                        for (let si = 0; si < sceneList.length; si++) {
                          const sc = sceneList[si];
                          const dur = sc.durationEstimate || 5;
                          let sourceUrl = "";
                          // Generate real scene image (not gradient placeholder)
                          if (sc.sceneType !== "audio-bridge") {
                            try {
                              setChatLog(p => [...p, { role: "ai", text: `Generating scene ${si + 1}/${sceneList.length}: ${sc.title}...` }]);
                              const imgRes = await fetch("/api/hybrid/scene-image", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  sceneId: sc.sceneId, sceneText: `${sc.title}. ${sc.description || ""}`,
                                  characterIds: sc.characterIds || [], location: sc.location, mood: sc.mood,
                                }),
                              });
                              const imgData = await imgRes.json();
                              if (imgData.imageUrl) sourceUrl = imgData.imageUrl;
                              else if (imgData.imagePath) sourceUrl = `/api/media/${imgData.imagePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
                            } catch { /* fallback to gradient */ }
                          }
                          // Fallback to gradient if image generation failed
                          if (!sourceUrl) {
                            const tc: Record<string, string> = { "image-led": "#00d4ff", "video-led": "#a855f7", "image-to-video": "#f59e0b", "audio-bridge": "#22c55e", "hybrid": "#ec4899" };
                            sourceUrl = `bg:linear-gradient(135deg, ${(tc[sc.sceneType] || "#a855f7")}40, ${(tc[sc.sceneType] || "#a855f7")}10, #0a0d14)`;
                          }
                          a.segments.push({ id: sc.sceneId || `seg_${ti}`, type: sc.sceneType === "video-led" ? "video" : "image", sourceUrl, startTime: ti, endTime: ti + dur, duration: dur, transitionIn: "fade", transitionOut: "fade", sceneId: sc.sceneId, sceneType: sc.sceneType });
                          if (sc.title) a.narration.push({ id: `narr_${sc.sceneId}`, text: sc.title, startTime: ti + 0.3, endTime: ti + dur - 0.3, volume: 1, speed: 1, style: "normal" });
                          a.overlays.push({ id: `ovl_${sc.sceneId}`, type: "text" as const, content: sc.title, startTime: ti, endTime: ti + dur, position: { x: 50, y: 50 }, size: { width: 28, height: 28 }, opacity: 1, animation: "fade" });
                          ti += dur;
                        }
                        a.totalDuration = ti;
                        setAssembly(a); setActiveSegIdx(0);
                        if (a.segments[0]?.sourceUrl && !a.segments[0].sourceUrl.startsWith("bg:")) setMediaUrl(a.segments[0].sourceUrl);
                        setVersions([{ label: "v1 — Smart", desc: `${sceneList.length} scenes`, assembly: structuredClone(a) }]);
                        const rpt = sceneList.map((s: { sceneId: string; title: string; sceneType: string }) => `  ${s.sceneId}: [${s.sceneType}] ${s.title}`).join("\n");
                        setChatLog(p => [...p, { role: "ai", text: `Done! ${sceneList.length} scenes with images:\n${rpt}\n\nCharacters: ${(chars || []).map((c: { name: string }) => c.name).join(", ")}\n\nEdit scenes, add music/narration, then Assemble.` }]);
                        if ((chars || []).length > 0) setDetectedCharacters((chars || []).slice(0, 3).map((c: { name: string; role?: string }) => ({ name: c.name, role: c.role || "protagonist", description: "Character from story" })));
                      } catch (e) { setChatLog(p => [...p, { role: "ai", text: `Smart gen failed: ${e instanceof Error ? e.message : "Error"}` }]); }
                      setProcessing(false);
                    }} disabled={processing}
                      style={{ flex: 2, padding: "8px 14px", borderRadius: 8, border: "none", background: processing ? "#2a2a40" : purple, color: "#fff", fontSize: 10, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer" }}>
                      {processing ? "Processing..." : "Smart (Story→Scenes)"}
                    </button>
                    {/* Quick Generate — direct single-shot */}
                    <button onClick={async () => {
                      const prompt = (document.getElementById("gen-prompt") as HTMLInputElement)?.value;
                      const model = (document.getElementById("gen-model") as HTMLSelectElement)?.value || "hailuo-fast";
                      if (!prompt?.trim()) return;
                      setProcessing(true);
                      setChatLog(p => [...p, { role: "ai", text: `Generating video: "${prompt.slice(0, 50)}"...` }]);
                      try {
                        const res = await fetch("/api/video/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, model, aspectRatio: "16:9" }) });
                        const d = await res.json();
                        if (d.outputUrl) {
                          const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", prompt.slice(0, 30));
                          a.totalDuration = 5;
                          a.segments.push({ id: "seg_0", type: "video", sourceUrl: d.outputUrl, startTime: 0, endTime: 5, duration: 5, transitionIn: "cut", transitionOut: "cut" });
                          setAssembly(a); setMediaUrl(d.outputUrl); setActiveSegIdx(0);
                          setVersions([{ label: "v1 — Quick", desc: prompt, assembly: structuredClone(a) }]);
                          setChatLog(p => [...p, { role: "ai", text: "Video generated! Add narration, music, SFX in Properties." }]);
                        } else { setChatLog(p => [...p, { role: "ai", text: `Failed: ${d.error || "Try again."}` }]); }
                      } catch { setChatLog(p => [...p, { role: "ai", text: "Generation failed." }]); }
                      setProcessing(false);
                    }} disabled={processing}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: processing ? "not-allowed" : "pointer" }}>
                      Quick
                    </button>
                  </div>
                  {/* Advanced toggle — reveals real provider model names */}
                  <div style={{ marginTop: 6, textAlign: "right" }}>
                    <button onClick={() => setShowAdvancedModels(p => !p)}
                      style={{ fontSize: 8, color: muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      {showAdvancedModels ? "Hide advanced models ▲" : "Show advanced models ▼"}
                    </button>
                  </div>
                </div>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* ═══ GHS HYBRID — Multi-Step Pipeline Wizard ═══ */}
                {/* ═══════════════════════════════════════════════════════ */}
                {creationMode === "ghs_hybrid" && (
                <div style={{ marginBottom: 12, textAlign: "left" }}>
                  {/* ── Progress bar ── */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                    {[1, 2, 3, 4].map(s => (
                      <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= hybridStep ? purple : `${border}` }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    {["Story", "Expanded", "Scenes", "Assemble"].map((label, i) => (
                      <span key={label} style={{ fontSize: 8, color: i + 1 <= hybridStep ? purple : muted, fontWeight: i + 1 === hybridStep ? 700 : 400 }}>{label}</span>
                    ))}
                  </div>

                  {/* ══════════ STEP 1 — Story Input ══════════ */}
                  {hybridStep === 1 && (
                    <div>
                      <p style={{ fontSize: 10, color: purple, marginBottom: 8, textAlign: "center" }}>Describe your story idea. AI will expand it into scenes, characters, and audio.</p>
                      <textarea
                        value={hybridStoryInput}
                        onChange={e => setHybridStoryInput(e.target.value)}
                        placeholder={"Describe your story idea in detail...\n\nExample: A grandmother tells her grandchildren about how she survived the war. The story moves between present day and 1967 flashbacks. Emotional, cinematic, with traditional music."}
                        rows={6}
                        style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: text, fontSize: 12, outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, minHeight: 120 }}
                      />
                      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3 }}>Duration</label>
                          <select value={hybridDuration} onChange={e => setHybridDuration(e.target.value)}
                            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 8px", color: text, fontSize: 10, outline: "none" }}>
                            <option value="30s">30 seconds</option>
                            <option value="1min">1 minute</option>
                            <option value="3min">3 minutes</option>
                            <option value="5min">5 minutes</option>
                            <option value="10min">10 minutes</option>
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3 }}>Audience</label>
                          <select value={hybridAudience} onChange={e => setHybridAudience(e.target.value)}
                            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 8px", color: text, fontSize: 10, outline: "none" }}>
                            <option value="general">General</option>
                            <option value="children">Children</option>
                            <option value="business">Business</option>
                          </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3 }}>Cost</label>
                          <select value={hybridCostPref} onChange={e => setHybridCostPref(e.target.value)}
                            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 8px", color: text, fontSize: 10, outline: "none" }}>
                            <option value="efficient">Efficient</option>
                            <option value="balanced">Balanced</option>
                            <option value="premium">Premium</option>
                          </select>
                        </div>
                      </div>
                      <button
                        disabled={hybridProcessing || !hybridStoryInput.trim()}
                        onClick={async () => {
                          setHybridProcessing(true);
                          setChatLog([{ role: "ai", text: "Expanding story..." }]);
                          try {
                            const res = await fetch("/api/hybrid/story-expand", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ story: hybridStoryInput, duration: hybridDuration, audience: hybridAudience, costPreference: hybridCostPref, tier }),
                            });
                            const data = await res.json();
                            if (data.expansion) {
                              setHybridExpansion(data.expansion);
                              setHybridProjectId(data.projectId || `hybrid_${Date.now()}`);
                              setHybridStep(2);
                              setChatLog(p => [...p, { role: "ai", text: `Story expanded. ${data.expansion.characters?.length || 0} characters, ${data.expansion.locations?.length || 0} locations found.` }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: data.error || "Story expansion failed." }]);
                            }
                          } catch { setChatLog(p => [...p, { role: "ai", text: "Story expansion failed." }]); }
                          setHybridProcessing(false);
                        }}
                        style={{ width: "100%", padding: "10px 20px", borderRadius: 8, border: "none", background: hybridProcessing || !hybridStoryInput.trim() ? "#2a2a40" : purple, color: "#fff", fontSize: 12, fontWeight: 700, cursor: hybridProcessing || !hybridStoryInput.trim() ? "not-allowed" : "pointer" }}
                      >
                        {hybridProcessing ? "Expanding..." : "Expand Story"}
                      </button>
                    </div>
                  )}

                  {/* ══════════ STEP 2 — Story Expanded ══════════ */}
                  {hybridStep === 2 && hybridExpansion && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: text, fontWeight: 700 }}>Story Expansion</span>
                        <button onClick={() => setHybridStep(1)} style={{ fontSize: 9, color: muted, background: "none", border: "none", cursor: "pointer" }}>Back</button>
                      </div>
                      {/* Summary */}
                      <div style={{ background: `${purple}08`, border: `1px solid ${purple}20`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                        <p style={{ fontSize: 10, color: text, lineHeight: 1.5 }}>{hybridExpansion.summary}</p>
                      </div>
                      {/* Characters */}
                      {hybridExpansion.characters?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Characters</p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {hybridExpansion.characters.map(ch => (
                              <div key={ch.id} style={{ background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", minWidth: 80 }}>
                                <p style={{ fontSize: 10, color: cyan, fontWeight: 700, marginBottom: 1 }}>{ch.name}</p>
                                <p style={{ fontSize: 8, color: muted }}>{ch.role}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Locations & Moods */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        {hybridExpansion.locations?.length > 0 && (
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 9, color: muted, marginBottom: 3 }}>Locations</p>
                            {hybridExpansion.locations.map((loc, i) => (
                              <span key={i} style={{ display: "inline-block", fontSize: 9, color: gold, background: `${gold}10`, borderRadius: 4, padding: "2px 6px", marginRight: 4, marginBottom: 3 }}>{loc}</span>
                            ))}
                          </div>
                        )}
                        {hybridExpansion.moods?.length > 0 && (
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 9, color: muted, marginBottom: 3 }}>Moods</p>
                            {hybridExpansion.moods.map((mood, i) => (
                              <span key={i} style={{ display: "inline-block", fontSize: 9, color: green, background: `${green}10`, borderRadius: 4, padding: "2px 6px", marginRight: 4, marginBottom: 3 }}>{mood}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Action buttons */}
                      <button
                        disabled={hybridProcessing}
                        onClick={async () => {
                          setHybridProcessing(true);
                          setChatLog(p => [...p, { role: "ai", text: "Extracting characters and breaking down scenes..." }]);
                          try {
                            // Extract characters
                            await fetch("/api/hybrid/character-extract", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ projectId: hybridProjectId, expansion: hybridExpansion, tier }),
                            });
                            // Scene breakdown
                            const sceneRes = await fetch("/api/hybrid/scene-breakdown", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ projectId: hybridProjectId, expansion: hybridExpansion, duration: hybridDuration, costPreference: hybridCostPref, tier }),
                            });
                            const sceneData = await sceneRes.json();
                            if (sceneData.scenes) {
                              setHybridScenes(sceneData.scenes);
                              setHybridStep(3);
                              setChatLog(p => [...p, { role: "ai", text: `${sceneData.scenes.length} scenes planned. Review and adjust types before validation.` }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: sceneData.error || "Scene breakdown failed." }]);
                            }
                          } catch { setChatLog(p => [...p, { role: "ai", text: "Scene breakdown failed." }]); }
                          setHybridProcessing(false);
                        }}
                        style={{ width: "100%", padding: "10px 20px", borderRadius: 8, border: "none", background: hybridProcessing ? "#2a2a40" : cyan, color: s1, fontSize: 12, fontWeight: 700, cursor: hybridProcessing ? "not-allowed" : "pointer" }}
                      >
                        {hybridProcessing ? "Processing..." : "Extract Characters & Plan Scenes"}
                      </button>
                    </div>
                  )}

                  {/* ══════════ STEP 3 — Scene Review ══════════ */}
                  {hybridStep === 3 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: text, fontWeight: 700 }}>Scene Review ({hybridScenes.length} scenes)</span>
                        <button onClick={() => setHybridStep(2)} style={{ fontSize: 9, color: muted, background: "none", border: "none", cursor: "pointer" }}>Back</button>
                      </div>
                      {/* Scene cards */}
                      <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 8 }}>
                        {hybridScenes.map((scene, idx) => {
                          const typeColors: Record<string, string> = { "image-led": cyan, "video-led": purple, "image-to-video": gold, "audio-bridge": green, hybrid: "#ec4899" };
                          const typeColor = typeColors[scene.type] || muted;
                          return (
                            <div key={scene.id} style={{ background: s2, border: `1px solid ${typeColor}30`, borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 10, color: text, fontWeight: 700 }}>{idx + 1}. {scene.title}</span>
                                <span style={{ fontSize: 8, color: gold }}>{scene.estimatedCost} cr</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                                <select
                                  value={scene.type}
                                  onChange={e => {
                                    const newScenes = [...hybridScenes];
                                    newScenes[idx] = { ...scene, type: e.target.value as typeof scene.type };
                                    setHybridScenes(newScenes);
                                    setHybridValidation(null);
                                  }}
                                  style={{ background: s1, border: `1px solid ${typeColor}40`, borderRadius: 4, padding: "2px 6px", color: typeColor, fontSize: 9, outline: "none" }}
                                >
                                  <option value="image-led">Image-Led</option>
                                  <option value="video-led">Video-Led</option>
                                  <option value="image-to-video">Image-to-Video</option>
                                  <option value="audio-bridge">Audio Bridge</option>
                                  <option value="hybrid">Hybrid</option>
                                </select>
                                {scene.characters.length > 0 && (
                                  <span style={{ fontSize: 8, color: cyan }}>{scene.characters.join(", ")}</span>
                                )}
                              </div>
                              {scene.narration && (
                                <p style={{ fontSize: 9, color: muted, lineHeight: 1.4, margin: 0 }}>{scene.narration.length > 80 ? scene.narration.slice(0, 80) + "..." : scene.narration}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Estimated total */}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: muted, marginBottom: 8, padding: "0 4px" }}>
                        <span>Est. total: {hybridScenes.reduce((s, sc) => s + sc.estimatedCost, 0)} credits</span>
                        <span>{hybridScenes.length} scenes</span>
                      </div>
                      {/* Validation results */}
                      {hybridValidation && (
                        <div style={{ marginBottom: 8 }}>
                          {hybridValidation.errors.length > 0 && (
                            <div style={{ background: `${red}10`, border: `1px solid ${red}30`, borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>
                              {hybridValidation.errors.map((err, i) => (
                                <p key={i} style={{ fontSize: 9, color: red, margin: "2px 0" }}>{err}</p>
                              ))}
                            </div>
                          )}
                          {hybridValidation.warnings.length > 0 && (
                            <div style={{ background: `${gold}10`, border: `1px solid ${gold}30`, borderRadius: 6, padding: "6px 10px" }}>
                              {hybridValidation.warnings.map((w, i) => (
                                <p key={i} style={{ fontSize: 9, color: gold, margin: "2px 0" }}>{w}</p>
                              ))}
                            </div>
                          )}
                          {hybridValidation.valid && hybridValidation.errors.length === 0 && (
                            <div style={{ background: `${green}10`, border: `1px solid ${green}30`, borderRadius: 6, padding: "6px 10px" }}>
                              <p style={{ fontSize: 9, color: green, margin: 0 }}>Validation passed. Ready to assemble.</p>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          disabled={hybridProcessing}
                          onClick={async () => {
                            setHybridProcessing(true);
                            setChatLog(p => [...p, { role: "ai", text: "Planning audio..." }]);
                            try {
                              const res = await fetch("/api/hybrid/audio-plan", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ projectId: hybridProjectId, scenes: hybridScenes, expansion: hybridExpansion, tier }),
                              });
                              const data = await res.json();
                              setChatLog(p => [...p, { role: "ai", text: data.message || "Audio plan ready." }]);
                            } catch { setChatLog(p => [...p, { role: "ai", text: "Audio planning failed." }]); }
                            setHybridProcessing(false);
                          }}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", background: hybridProcessing ? "#2a2a40" : green, color: s1, fontSize: 10, fontWeight: 700, cursor: hybridProcessing ? "not-allowed" : "pointer" }}
                        >
                          Plan Audio
                        </button>
                        <button
                          disabled={hybridProcessing}
                          onClick={async () => {
                            setHybridProcessing(true);
                            setChatLog(p => [...p, { role: "ai", text: "Validating scenes..." }]);
                            try {
                              const res = await fetch("/api/hybrid/validate", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ projectId: hybridProjectId, scenes: hybridScenes, expansion: hybridExpansion, duration: hybridDuration, tier }),
                              });
                              const data = await res.json();
                              setHybridValidation(data.validation || { valid: false, errors: ["Validation returned no result"], warnings: [] });
                              if (data.validation?.valid) {
                                setChatLog(p => [...p, { role: "ai", text: "Validation passed. You can now assemble." }]);
                                setHybridStep(4);
                              } else {
                                setChatLog(p => [...p, { role: "ai", text: `Validation: ${data.validation?.errors?.length || 0} errors, ${data.validation?.warnings?.length || 0} warnings.` }]);
                              }
                            } catch { setChatLog(p => [...p, { role: "ai", text: "Validation failed." }]); }
                            setHybridProcessing(false);
                          }}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", background: hybridProcessing ? "#2a2a40" : purple, color: "#fff", fontSize: 10, fontWeight: 700, cursor: hybridProcessing ? "not-allowed" : "pointer" }}
                        >
                          Validate
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ══════════ STEP 4 — Assemble ══════════ */}
                  {hybridStep === 4 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: text, fontWeight: 700 }}>Ready to Assemble</span>
                        <button onClick={() => setHybridStep(3)} style={{ fontSize: 9, color: muted, background: "none", border: "none", cursor: "pointer" }}>Back to Scenes</button>
                      </div>
                      <div style={{ background: `${green}08`, border: `1px solid ${green}20`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                        <p style={{ fontSize: 10, color: green, fontWeight: 700, marginBottom: 4 }}>Validation Passed</p>
                        <p style={{ fontSize: 9, color: muted, margin: 0 }}>{hybridScenes.length} scenes, {hybridScenes.reduce((s, sc) => s + sc.estimatedCost, 0)} estimated credits</p>
                      </div>
                      {/* Scene summary mini-list */}
                      <div style={{ marginBottom: 10 }}>
                        {hybridScenes.map((sc, i) => {
                          const typeColors: Record<string, string> = { "image-led": cyan, "video-led": purple, "image-to-video": gold, "audio-bridge": green, hybrid: "#ec4899" };
                          return (
                            <div key={sc.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", borderBottom: `1px solid ${border}` }}>
                              <span style={{ fontSize: 9, color: muted, width: 16 }}>{i + 1}</span>
                              <span style={{ fontSize: 9, color: typeColors[sc.type] || muted, width: 60 }}>{sc.type}</span>
                              <span style={{ fontSize: 9, color: text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.title}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        disabled={hybridProcessing}
                        onClick={async () => {
                          setHybridProcessing(true);
                          setChatLog(p => [...p, { role: "ai", text: "Assembling scenes..." }]);
                          try {
                            const res = await fetch("/api/hybrid/assemble", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ projectId: hybridProjectId, scenes: hybridScenes, expansion: hybridExpansion, duration: hybridDuration, costPreference: hybridCostPref, tier }),
                            });
                            const data = await res.json();
                            if (data.assemblyJson) {
                              setAssembly(data.assemblyJson);
                              setActiveSegIdx(0);
                              setVersions(prev => [...prev, { label: `v${prev.length + 1} — Hybrid`, desc: hybridExpansion?.summary?.slice(0, 30) || "Hybrid assembly", assembly: structuredClone(data.assemblyJson) }]);
                              setChatLog(p => [...p, { role: "ai", text: `Assembly complete. ${data.assemblyJson.segments?.length || 0} segments loaded into editor.` }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: data.error || "Assembly failed." }]);
                            }
                          } catch { setChatLog(p => [...p, { role: "ai", text: "Assembly failed." }]); }
                          setHybridProcessing(false);
                        }}
                        style={{ width: "100%", padding: "12px 20px", borderRadius: 8, border: "none", background: hybridProcessing ? "#2a2a40" : `linear-gradient(135deg, ${purple}, ${cyan})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: hybridProcessing ? "not-allowed" : "pointer", letterSpacing: 0.5 }}
                      >
                        {hybridProcessing ? "Assembling..." : "Assemble My Scenes"}
                      </button>
                    </div>
                  )}
                </div>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* ═══ GHS AI MOTION — 3 modes ═══ */}
                {/* ═══════════════════════════════════════════════════════ */}
                {creationMode === "ai_motion" && (
                <div style={{ marginBottom: 12, textAlign: "left" }}>
                  {/* Step selector — 3 cards */}
                  {!motionStep && (
                    <>
                    <p style={{ fontSize: 10, color: gold, marginBottom: 10, textAlign: "center" }}>Choose how you want AI to create your video.</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                      {/* Card 1: Video → Video */}
                      <button data-testid="motion-v2v" onClick={() => setMotionStep("video_to_video")}
                        style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${purple}25`, background: `${purple}06`, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 28, lineHeight: 1 }}>🎬</span>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 2 }}>Video → Video</p>
                          <p style={{ fontSize: 9, color: muted }}>Upload a reference video. AI creates a new video inspired by it with your subject.</p>
                        </div>
                        <span style={{ fontSize: 9, color: purple, marginLeft: "auto", whiteSpace: "nowrap" }}>1 upload →</span>
                      </button>
                      {/* Card 2: Image → Video */}
                      <button data-testid="motion-i2v" onClick={() => setMotionStep("image_to_video")}
                        style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${cyan}25`, background: `${cyan}06`, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 28, lineHeight: 1 }}>🖼</span>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 2 }}>Image → Video</p>
                          <p style={{ fontSize: 9, color: muted }}>Upload a still image. AI brings it to life with motion and animation.</p>
                        </div>
                        <span style={{ fontSize: 9, color: cyan, marginLeft: "auto", whiteSpace: "nowrap" }}>1 upload →</span>
                      </button>
                      {/* Card 3: Image + Video → Video */}
                      <button data-testid="motion-iv2v" onClick={() => setMotionStep("image_video_to_video")}
                        style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${gold}25`, background: `${gold}06`, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 28, lineHeight: 1 }}>🎭</span>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 2 }}>Image + Video → Video</p>
                          <p style={{ fontSize: 9, color: muted }}>Upload an image AND a reference video. AI places your subject into the video motion.</p>
                        </div>
                        <span style={{ fontSize: 9, color: gold, marginLeft: "auto", whiteSpace: "nowrap" }}>2 uploads →</span>
                      </button>
                    </div>
                    </>
                  )}

                  {/* ── Step selected: show upload + prompt + generate ── */}
                  {motionStep && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <button onClick={() => { setMotionStep(null); setMotionRefImageUrl(""); setMotionRefVideoUrl(""); }}
                          style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
                        <span style={{ fontSize: 12, fontWeight: 700, color: text }}>
                          {motionStep === "video_to_video" && "🎬 Video → Video"}
                          {motionStep === "image_to_video" && "🖼 Image → Video"}
                          {motionStep === "image_video_to_video" && "🎭 Image + Video → Video"}
                        </span>
                      </div>

                      {/* Upload area(s) */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {/* Video upload — for video_to_video and image_video_to_video */}
                        {(motionStep === "video_to_video" || motionStep === "image_video_to_video") && (
                          <label style={{ flex: 1, padding: 14, borderRadius: 10, border: `2px dashed ${motionRefVideoUrl ? green : purple}30`, cursor: "pointer", textAlign: "center", background: motionRefVideoUrl ? `${green}08` : `${purple}05` }}>
                            <span style={{ fontSize: 18, display: "block" }}>{motionRefVideoUrl ? "✓" : "🎬"}</span>
                            <p style={{ fontSize: 10, fontWeight: 600, color: motionRefVideoUrl ? green : text, marginTop: 2 }}>
                              {motionRefVideoUrl ? "Video uploaded" : "Upload reference video"}
                            </p>
                            <p style={{ fontSize: 8, color: muted }}>{motionStep === "video_to_video" ? "AI will recreate in your style" : "Motion reference source"}</p>
                            <input type="file" accept="video/*" style={{ display: "none" }} onChange={async e => {
                              if (!e.target.files?.[0]) return;
                              const file = e.target.files[0];
                              const fd = new FormData(); fd.append("video", file);
                              const upRes = await fetch("/api/video-trimmer/upload", { method: "POST", body: fd });
                              const upData = await upRes.json();
                              const url = upData.tempPath ? `/api/media/${upData.tempPath.replace(/\\/g, "/").replace(/^.*?storage[\\/]/, "")}` : "";
                              if (url) {
                                setMotionRefVideoUrl(url);
                                setChatLog(p => [...p, { role: "ai", text: `Reference video uploaded: ${file.name}` }]);
                              }
                            }} />
                          </label>
                        )}

                        {/* Image upload — for image_to_video and image_video_to_video */}
                        {(motionStep === "image_to_video" || motionStep === "image_video_to_video") && (
                          <label style={{ flex: 1, padding: 14, borderRadius: 10, border: `2px dashed ${motionRefImageUrl ? green : cyan}30`, cursor: "pointer", textAlign: "center", background: motionRefImageUrl ? `${green}08` : `${cyan}05` }}>
                            <span style={{ fontSize: 18, display: "block" }}>{motionRefImageUrl ? "✓" : "🖼"}</span>
                            <p style={{ fontSize: 10, fontWeight: 600, color: motionRefImageUrl ? green : text, marginTop: 2 }}>
                              {motionRefImageUrl ? "Image uploaded" : "Upload your image"}
                            </p>
                            <p style={{ fontSize: 8, color: muted }}>{motionStep === "image_to_video" ? "AI will animate this into video" : "Your subject for the video"}</p>
                            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                              if (!e.target.files?.[0]) return;
                              const file = e.target.files[0];
                              const fd = new FormData(); fd.append("file", file);
                              const upRes = await fetch("/api/upload/logo", { method: "POST", body: fd });
                              const upData = await upRes.json();
                              if (upData.url) {
                                setMotionRefImageUrl(upData.url);
                                setMediaUrl(upData.url);
                                setChatLog(p => [...p, { role: "ai", text: `Image uploaded: ${file.name}` }]);
                              }
                            }} />
                          </label>
                        )}
                      </div>

                      {/* Preview thumbnails */}
                      {(motionRefImageUrl || motionRefVideoUrl) && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 10, justifyContent: "center" }}>
                          {motionRefImageUrl && <img src={motionRefImageUrl} alt="Ref image" style={{ height: 60, borderRadius: 6, border: `1px solid ${cyan}30` }} />}
                          {motionRefVideoUrl && <video src={motionRefVideoUrl} style={{ height: 60, borderRadius: 6, border: `1px solid ${purple}30` }} muted />}
                        </div>
                      )}

                      {/* Prompt */}
                      <textarea id="gen-prompt" placeholder={
                        motionStep === "video_to_video"
                          ? "Describe what AI should create from this video reference...\n\nExample: Recreate this choreography with a golden retriever in a park, keep the same energy and camera angles"
                          : motionStep === "image_to_video"
                          ? "Describe how AI should bring this image to life...\n\nExample: The character begins walking forward, camera slowly orbits around them, gentle wind moves their clothing, cinematic sunset lighting"
                          : "Describe how AI should combine your image with the video motion...\n\nExample: Place this person into the dance sequence, match the timing and choreography from the reference video"
                      }
                        rows={3}
                        style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: text, fontSize: 12, outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, minHeight: 60 }} />

                      {/* Model + Generate */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <select id="gen-model" style={{ flex: 1, background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 10, outline: "none" }}>
                          {!showAdvancedModels ? (
                            <>
                              <option value="kling2">GHS Motion Basic (2 credits)</option>
                              <option value="kling3-pro">GHS Motion Pro (4 credits)</option>
                            </>
                          ) : (
                            <>
                              <option value="kling2">Kling 2.0 (2 credits)</option>
                              <option value="kling3-pro">Kling 3.0 Pro (4 credits)</option>
                              <option value="hailuo-pro">Hailuo Pro (3 credits)</option>
                              <option value="seedance">SeeDance 2.0 (2 credits, dance/motion)</option>
                              <option value="wan25">Wan 2.5 (1 credit)</option>
                            </>
                          )}
                        </select>
                        <button onClick={async () => {
                          const prompt = (document.getElementById("gen-prompt") as HTMLInputElement)?.value;
                          const model = (document.getElementById("gen-model") as HTMLSelectElement)?.value || "kling2";
                          // Validate uploads
                          if (motionStep === "video_to_video" && !motionRefVideoUrl) { setChatLog(p => [...p, { role: "ai", text: "Upload a reference video first." }]); return; }
                          if (motionStep === "image_to_video" && !motionRefImageUrl) { setChatLog(p => [...p, { role: "ai", text: "Upload an image first." }]); return; }
                          if (motionStep === "image_video_to_video" && (!motionRefImageUrl || !motionRefVideoUrl)) { setChatLog(p => [...p, { role: "ai", text: "Upload both an image and a reference video." }]); return; }
                          if (!prompt?.trim()) { setChatLog(p => [...p, { role: "ai", text: "Describe what you want AI to create." }]); return; }
                          setProcessing(true);
                          const modeLabel = motionStep === "video_to_video" ? "Video→Video" : motionStep === "image_to_video" ? "Image→Video" : "Image+Video→Video";
                          setChatLog(p => [...p, { role: "ai", text: `${modeLabel}: Generating with ${showAdvancedModels ? model : "GHS Motion"}...` }]);
                          try {
                            const res = await fetch("/api/video/generate", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                prompt,
                                model,
                                aspectRatio: "16:9",
                                sourceImage: motionRefImageUrl || undefined,
                                referenceVideo: motionRefVideoUrl || undefined,
                              }),
                            });
                            const d = await res.json();
                            if (d.outputUrl) {
                              const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", prompt.slice(0, 30));
                              a.totalDuration = 5;
                              a.segments.push({ id: "seg_0", type: "video", sourceUrl: d.outputUrl, startTime: 0, endTime: 5, duration: 5, transitionIn: "cut", transitionOut: "cut" });
                              setAssembly(a); setMediaUrl(d.outputUrl); setActiveSegIdx(0);
                              setVersions([{ label: `v1 — ${modeLabel}`, desc: prompt, assembly: structuredClone(a) }]);
                              setChatLog(p => [...p, { role: "ai", text: `${modeLabel} video generated! Add narration, music, or SFX in Properties.` }]);
                            } else {
                              setChatLog(p => [...p, { role: "ai", text: `Generation failed: ${d.error || "Try again."}` }]);
                            }
                          } catch { setChatLog(p => [...p, { role: "ai", text: `${modeLabel} generation failed.` }]); }
                          setProcessing(false);
                        }} disabled={processing}
                          style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: processing ? "#2a2a40" : gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                          {processing ? "Generating..." : "Generate"}
                        </button>
                      </div>
                      <div style={{ marginTop: 6, textAlign: "right" }}>
                        <button onClick={() => setShowAdvancedModels(p => !p)}
                          style={{ fontSize: 8, color: muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                          {showAdvancedModels ? "Hide advanced models ▲" : "Show advanced models ▼"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                )}

                <div style={{ fontSize: 10, color: muted, marginBottom: 12 }}>— or —</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setShowImport(true)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>📂 Upload File</button>
                  <button onClick={async () => {
                    try {
                      const res = await fetch("/api/assets?type=video&limit=20");
                      const d = await res.json();
                      setAssetList((d.assets || d.items || []).map((a: { id: string; filePath?: string; mergedOutputPath?: string; videoPath?: string; name?: string; originalInput?: string }) => {
                        const rawPath = a.filePath || a.mergedOutputPath || a.videoPath || "";
                        const url = rawPath ? `/api/media/${rawPath.replace(/\\/g, "/").replace(/^.*?storage[\\/]/, "")}` : "";
                        return { id: a.id, url, title: a.name || a.originalInput || "Asset" };
                      }));
                    } catch {}
                    setShowImport(true);
                  }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>📦 Asset Library</button>
                  <button onClick={() => { loadProjectList(); setShowImport(true); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>📋 Load Project</button>
                </div>

                {/* Saved projects from database */}
                {savedProjects.length > 0 && (
                  <div style={{ marginTop: 16, textAlign: "left", maxWidth: 500 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Recent Projects</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                      {savedProjects.filter(p => p.status !== "archived").slice(0, 8).map(p => (
                        <button key={p.id} onClick={async () => {
                          const res = await fetch(`/api/projects/${p.id}`);
                          const d = await res.json();
                          if (d.project?.assembly) {
                            setAssembly(d.project.assembly);
                            setActiveSegIdx(0);
                            const seg0 = d.project.assembly.segments[0];
                            if (seg0?.sourceUrl && !seg0.sourceUrl.startsWith("bg:")) setMediaUrl(seg0.sourceUrl);
                            setVersions([{ label: "v1 — Loaded", desc: p.title, assembly: structuredClone(d.project.assembly) }]);
                            setChatLog([{ role: "ai", text: `Project "${p.title}" loaded — ${p.scenes} scenes, ${Math.round(p.duration)}s.` }]);
                          }
                        }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: s2, cursor: "pointer", textAlign: "left" }}>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 600, color: text }}>{p.title.slice(0, 40)}</p>
                            <p style={{ fontSize: 8, color: muted }}>{p.scenes} scenes · {Math.round(p.duration)}s · {p.status}</p>
                          </div>
                          <span style={{ fontSize: 10, color: purple }}>Open →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </div>)}
              </div>
            )}
            {processing && (
              <div style={{ position: "absolute", top: 10, right: 10, padding: "6px 12px", borderRadius: 8, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: gold, fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, border: "2px solid rgba(245,158,11,0.3)", borderTopColor: gold, borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Processing...
              </div>
            )}
          </div>

          {/* Scrub bar + controls + in/out trim */}
          {activeSeg && (
            <div style={{ padding: "8px 16px", background: s1, borderTop: `1px solid ${border}` }}>
              {/* Scrub bar with in/out markers */}
              <div style={{ position: "relative", height: 8, background: "#1a1a2e", borderRadius: 4, cursor: "pointer", marginBottom: 8 }}
                onClick={e => { const r = (e.target as HTMLElement).getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * 100); }}>
                {/* In/out range highlight */}
                {inPoint !== null && outPoint !== null && (
                  <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 4,
                    left: `${(inPoint / (activeSeg.duration || 1)) * 100}%`,
                    width: `${((outPoint - inPoint) / (activeSeg.duration || 1)) * 100}%`,
                    background: `${cyan}30`, border: `1px solid ${cyan}60`, pointerEvents: "none" }} />
                )}
                {/* In-point marker */}
                {inPoint !== null && (
                  <div data-testid="in-point-marker" style={{ position: "absolute", top: -3, width: 3, height: 14, borderRadius: 2,
                    left: `${(inPoint / (activeSeg.duration || 1)) * 100}%`,
                    background: cyan, pointerEvents: "none" }} />
                )}
                {/* Out-point marker */}
                {outPoint !== null && (
                  <div data-testid="out-point-marker" style={{ position: "absolute", top: -3, width: 3, height: 14, borderRadius: 2,
                    left: `${(outPoint / (activeSeg.duration || 1)) * 100}%`,
                    background: red, pointerEvents: "none" }} />
                )}
                {/* Progress */}
                <div style={{ height: "100%", background: purple, borderRadius: 4, width: `${(currentTime / (activeSeg.duration || 1)) * 100}%`, position: "relative", zIndex: 1 }} />
              </div>
              {/* Time + buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: muted, minWidth: 90 }}>{fmtTime(currentTime)} / {fmtTime(activeSeg.duration)}</span>
                <div style={{ display: "flex", gap: 3, margin: "0 auto", alignItems: "center" }}>
                  {/* Set In-point */}
                  <button data-testid="set-in-point" onClick={() => { setInPoint(currentTime); if (outPoint !== null && currentTime >= outPoint) setOutPoint(null); setChatLog(p => [...p, { role: "ai", text: `In-point set at ${fmtTime(currentTime)}` }]); }}
                    title="Set In-point (I)" style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${cyan}30`, background: `${cyan}10`, color: cyan, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>I</button>
                  {/* Play */}
                  <button data-testid="play-pause" onClick={togglePlay} style={{ width: 36, height: 36, borderRadius: 10, background: purple, border: "none", color: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {playing ? "⏸" : "▶"}
                  </button>
                  {/* Set Out-point */}
                  <button data-testid="set-out-point" onClick={() => { if (inPoint !== null && currentTime <= inPoint) { setChatLog(p => [...p, { role: "ai", text: "Out-point must be after in-point." }]); return; } setOutPoint(currentTime); setChatLog(p => [...p, { role: "ai", text: `Out-point set at ${fmtTime(currentTime)}` }]); }}
                    title="Set Out-point (O)" style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${red}30`, background: `${red}10`, color: red, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>O</button>
                  {/* Before/After comparison */}
                  {beforeUrl && (
                    <button onClick={() => {
                      if (showBeforeAfter) { setMediaUrl(beforeUrl); /* show original */ }
                      else { const assembled = assembly.segments.find(s => s.id === "seg_assembled"); if (assembled) setMediaUrl(assembled.sourceUrl); }
                      setShowBeforeAfter(!showBeforeAfter);
                    }}
                    title="Toggle before/after comparison"
                    style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${gold}30`, background: showBeforeAfter ? `${gold}20` : `${gold}08`, color: gold, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                      {showBeforeAfter ? "After" : "B/A"}
                    </button>
                  )}
                  {/* Split at playhead */}
                  <button data-testid="split-playhead" onClick={() => {
                    const t = currentTime;
                    if (t <= 0.1 || t >= (activeSeg.duration - 0.1)) return;
                    updateAssembly(a => {
                      const seg = a.segments[activeSegIdx];
                      if (!seg) return;
                      const seg2: AssemblySegment = { ...structuredClone(seg), id: `seg_split_${Date.now()}`, startTime: seg.startTime + t, endTime: seg.endTime, duration: seg.duration - t };
                      seg.endTime = seg.startTime + t;
                      seg.duration = t;
                      a.segments.splice(activeSegIdx + 1, 0, seg2);
                      a.totalDuration = a.segments.reduce((total, s) => total + s.duration, 0);
                    });
                    saveVersion(`Split at ${fmtTime(t)}`);
                    setChatLog(p => [...p, { role: "ai", text: `Split clip at ${fmtTime(t)} — now ${assembly.segments.length + 1} segments.` }]);
                  }} title="Split at playhead (S)"
                    style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${gold}30`, background: `${gold}10`, color: gold, fontSize: 9, cursor: "pointer" }}>✂</button>
                  {/* Trim to in/out */}
                  {inPoint !== null && outPoint !== null && (
                    <button data-testid="trim-inout" onClick={async () => {
                      const trimIn = inPoint;
                      const trimOut = outPoint;
                      if (trimIn >= trimOut) return;
                      setProcessing(true);
                      setChatLog(p => [...p, { role: "ai", text: `Trimming ${fmtTime(trimIn)} → ${fmtTime(trimOut)}...` }]);
                      try {
                        const res = await fetch("/api/video/assemble", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: "Trimmed", scenes: [{ scene: 1, videoUrl: activeSeg.sourceUrl, duration: trimOut - trimIn, startTime: trimIn }] }),
                        });
                        const d = await res.json();
                        if (d.outputUrl) {
                          const newDur = trimOut - trimIn;
                          updateAssembly(a => {
                            const seg = a.segments[activeSegIdx];
                            if (seg) { seg.sourceUrl = d.outputUrl; seg.duration = newDur; seg.endTime = seg.startTime + newDur; a.totalDuration = a.segments.reduce((total, s) => total + s.duration, 0); }
                          });
                          setMediaUrl(d.outputUrl);
                          setInPoint(null); setOutPoint(null);
                          setChatLog(p => [...p, { role: "ai", text: `Trimmed to ${fmtTime(newDur)}. Preview updated.` }]);
                          saveVersion(`Trim ${fmtTime(trimIn)}→${fmtTime(trimOut)}`);
                        }
                      } catch { setChatLog(p => [...p, { role: "ai", text: "Trim failed." }]); }
                      setProcessing(false);
                    }} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: green, color: "#000", fontSize: 9, cursor: "pointer", fontWeight: 700 }}>
                      Trim ✓
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 10, color: muted }}>Seg {activeSegIdx + 1}/{assembly.segments.length}</span>
                {/* Save video — Place 2: playback bar */}
                {mediaUrl && !mediaUrl.startsWith("blob:") && (
                  <a href={mediaUrl} download={`${(assembly.title || "video").replace(/\s+/g, "_")}.mp4`}
                    title="Download video" style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${green}40`, background: `${green}08`, color: green, fontSize: 9, cursor: "pointer", textDecoration: "none", fontWeight: 700 }}>
                    💾 Save
                  </a>
                )}
                {/* In/out point display */}
                {(inPoint !== null || outPoint !== null) && (
                  <span style={{ fontSize: 8, color: cyan, fontFamily: "monospace" }}>
                    {inPoint !== null ? `IN:${fmtTime(inPoint)}` : ""} {outPoint !== null ? `OUT:${fmtTime(outPoint)}` : ""}
                    <button onClick={() => { setInPoint(null); setOutPoint(null); }} style={{ fontSize: 7, color: red, background: "none", border: "none", cursor: "pointer", marginLeft: 4 }}>✕</button>
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── BOTTOM: Real Timeline (center column, row 2) ── */}
        <div style={{ gridColumn: "2", gridRow: "2", borderTop: `1px solid ${border}`, overflow: "hidden" }}>
          {assembly.segments.length > 0 ? (
            <div>
              <TimelineEngine
                clips={assemblyToTimelineClips(assembly)}
                totalDuration={assembly.totalDuration || 1}
                playheadPosition={(currentTime / (activeSeg?.duration || 1)) * 100}
                onPlayheadChange={pct => seek(pct)}
                onClipClick={id => { const idx = assembly.segments.findIndex(s => s.id === id); if (idx >= 0) { setActiveSegIdx(idx); if (assembly.segments[idx]?.sourceUrl) setMediaUrl(assembly.segments[idx].sourceUrl); } }}
                compact
              />
              {/* Audio waveform visualization */}
              {(assembly.music.length > 0 || assembly.narration.some(n => n.audioUrl)) && (
                <div style={{ height: 24, background: "#080b10", borderTop: `1px solid ${border}`, display: "flex", alignItems: "end", gap: 0, padding: "0 4px", overflow: "hidden" }}>
                  {Array.from({ length: 80 }).map((_, i) => {
                    const t = (i / 80) * (assembly.totalDuration || 1);
                    const hasMusic = assembly.music.some(m => t >= m.startTime && t < m.endTime);
                    const hasNarr = assembly.narration.some(n => n.audioUrl && t >= n.startTime && t < n.endTime);
                    const h = hasNarr ? 12 + Math.sin(i * 0.7) * 6 : hasMusic ? 6 + Math.sin(i * 1.3) * 4 : 2;
                    const color = hasNarr ? cyan : hasMusic ? green : `${border}`;
                    return <div key={i} style={{ flex: 1, height: Math.max(2, Math.abs(h)), background: color, opacity: 0.6, borderRadius: "1px 1px 0 0" }} />;
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px 16px", background: s1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: muted }}>Timeline — import or generate media to see tracks</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: 4-Tab Panel ── */}
        <div style={{ gridRow: "1 / 3", background: s1, borderLeft: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar — 4 tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            {(["ai", "scene", "audio", "history"] as const).map(t => {
              const labels: Record<string, string> = { ai: "🤖", scene: "🎬", audio: "🎵", history: "📋" };
              const titles: Record<string, string> = { ai: "AI", scene: "Scene", audio: "Audio", history: "History" };
              return (
                <button key={t} onClick={() => setTab(t as typeof tab)}
                  style={{ flex: 1, padding: "8px 2px", fontSize: 10, color: tab === t ? text : muted, background: "none", border: "none", borderBottom: `2px solid ${tab === t ? purple : "transparent"}`, cursor: "pointer", fontWeight: tab === t ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <span style={{ fontSize: 14 }}>{labels[t]}</span>
                  <span style={{ fontSize: 8 }}>{titles[t]}</span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>

            {/* ═══════════════════════════════
                TAB: AI — Create + Instruct + FAL
                ═══════════════════════════════ */}
            {tab === "ai" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {/* AI Auto-Assemble — intelligent pipeline */}
                <button data-testid="auto-assemble-btn" onClick={async () => {
                  const instruction = editInput.trim();
                  if (!instruction) { setChatLog(p => [...p, { role: "ai", text: "Type a description in the box below, then click this button." }]); return; }
                  setEditInput("");
                  setProcessing(true);
                  setChatLog(p => [...p, { role: "user", text: instruction }, { role: "ai", text: "Planning your video with AI..." }]);
                  try {
                    const res = await fetch("/api/video/auto-assemble", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ instruction, tier, existingScenes: assembly.segments.length > 0 ? assembly.segments : undefined }),
                    });
                    const d = await res.json();
                    if (d.plan) {
                      const plan = d.plan;
                      // Build assembly from plan
                      const a = createEmptyAssembly(`proj_${Date.now()}`, "collaborative", instruction.slice(0, 30));
                      let t = 0;
                      // Add intro if planned
                      if (plan.intro) {
                        a.segments.push({ id: "seg_intro", type: "image", sourceUrl: "", startTime: 0, endTime: plan.intro.duration, duration: plan.intro.duration, transitionIn: "fade", transitionOut: "fade" });
                        a.overlays.push({ id: "ovl_intro", type: "text", content: plan.intro.text, startTime: 0, endTime: plan.intro.duration, position: { x: 50, y: 50 }, size: { width: 36, height: 36 }, opacity: 1, animation: "fade" });
                        t += plan.intro.duration;
                      }
                      // Add scenes
                      for (const scene of plan.scenes) {
                        const dur = scene.duration || 5;
                        a.segments.push({ id: scene.scene_id, type: scene.needs_video_gen ? "video" : "image", sourceUrl: "", startTime: t, endTime: t + dur, duration: dur, transitionIn: scene.transition || "cut", transitionOut: "dissolve" });
                        if (scene.needs_narration && scene.description) {
                          a.narration.push({ id: `narr_${scene.scene_id}`, text: scene.description, startTime: t + 0.3, endTime: t + dur - 0.3, volume: 1, speed: 1, style: "normal" });
                        }
                        if (scene.overlay_text) {
                          a.overlays.push({ id: `ovl_${scene.scene_id}`, type: "text", content: scene.overlay_text, startTime: t, endTime: t + dur, position: { x: 50, y: 85 }, size: { width: 20, height: 20 }, opacity: 1, animation: (scene.overlay_animation || "fade") as OverlayEntry["animation"] });
                        }
                        for (const sfx of (scene.needs_sfx || [])) {
                          a.sfx.push({ id: `sfx_${scene.scene_id}_${sfx}`, event: sfx, sourceUrl: `/api/media/sfx/${sfx}.mp3`, startTime: t + 0.5, duration: 2, volume: 0.6, loop: false, category: "auto" });
                        }
                        t += dur;
                      }
                      // Add outro if planned
                      if (plan.outro) {
                        a.segments.push({ id: "seg_outro", type: "image", sourceUrl: "", startTime: t, endTime: t + plan.outro.duration, duration: plan.outro.duration, transitionIn: "fade", transitionOut: "fade" });
                        a.overlays.push({ id: "ovl_outro", type: "text", content: plan.outro.text, startTime: t, endTime: t + plan.outro.duration, position: { x: 50, y: 50 }, size: { width: 28, height: 28 }, opacity: 1, animation: "fade" });
                        t += plan.outro.duration;
                      }
                      a.totalDuration = t;
                      setAssembly(a); setActiveSegIdx(0);
                      setVersions([{ label: "v1 — AI Plan", desc: instruction, assembly: structuredClone(a) }]);
                      // Show cost breakdown
                      const costLines = plan.credit_breakdown?.map((c: { item: string; credits: number }) => `  ${c.item}: ${c.credits} cr`).join("\n") || "";
                      setChatLog(p => [...p, {
                        role: "ai",
                        text: `AI Plan ready — ${plan.scenes.length} scenes, ${Math.round(plan.total_duration)}s total.\n\nEstimated cost: ${plan.estimated_credits} credits\n${costLines}\n\n${plan.global_music_mood ? `Music: ${plan.global_music_mood}` : ""}${plan.global_narration ? " | Narration: yes" : ""}${plan.intro ? " | Intro: yes" : ""}${plan.outro ? " | Outro: yes" : ""}\n\nReview the scenes, then click "Assemble & Export" to generate.`,
                        approval: plan.estimated_credits > 0 ? { instruction, plan: { type: "auto_assemble", description: `Generate ${plan.scenes.length} scenes`, scenes: plan.scenes }, meta: { totalCost: plan.estimated_credits } } : undefined,
                      }]);
                    } else {
                      setChatLog(p => [...p, { role: "ai", text: `Planning failed: ${d.error || "Try again."}` }]);
                    }
                  } catch { setChatLog(p => [...p, { role: "ai", text: "Auto-assemble planning failed." }]); }
                  setProcessing(false);
                }} disabled={processing}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${gold}40`, background: `${gold}10`, color: gold, fontSize: 12, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {processing ? "🤖 Planning..." : "🤖 AI Auto-Assemble — Plan Full Video"}
                </button>
                {/* Chat log */}
                <div style={{ flex: 1, overflowY: "auto", marginBottom: 10 }}>
                  {chatLog.map((m, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: muted, marginBottom: 2 }}>{m.role === "ai" ? "🤖 GHS AI" : "You"}</div>
                      <div style={{ padding: "8px 10px", borderRadius: 10, fontSize: 11, lineHeight: 1.6, color: text,
                        ...(m.role === "user" ? { background: `${purple}10`, border: `1px solid ${purple}20`, marginLeft: 20 } : { background: s2, border: `1px solid ${border}`, marginRight: 20 }) }}>
                        {m.text}
                        {m.approval && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <button onClick={async () => {
                              setProcessing(true);
                              const plan = m.approval!.plan as { type?: string; scenes?: Array<{ scene_id: string; description: string; duration: number; needs_video_gen: boolean; needs_image_gen: boolean; ai_prompt: string; overlay_text?: string; overlay_animation?: string; needs_narration?: boolean; needs_sfx?: string[] }> };
                              const scenes = plan?.scenes || [];

                              if (plan?.type === "auto_assemble" && scenes.length > 0) {
                                // Full auto-assemble pipeline: generate each scene
                                setChatLog(p => [...p, { role: "ai", text: `Executing full pipeline: ${scenes.length} scenes...` }]);
                                let t = assembly.totalDuration;
                                for (let si = 0; si < scenes.length; si++) {
                                  const sc = scenes[si];
                                  setChatLog(p => [...p, { role: "ai", text: `Step ${si + 1}/${scenes.length}: ${sc.description.slice(0, 60)}...` }]);
                                  try {
                                    if (sc.needs_video_gen) {
                                      const res = await fetch("/api/video/generate", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ prompt: sc.ai_prompt || sc.description, model: "hailuo-fast", aspectRatio: "16:9" }),
                                      });
                                      const d = await res.json();
                                      if (d.outputUrl) {
                                        const dur = sc.duration || 5;
                                        updateAssembly(a => { a.segments.push({ id: `seg_${sc.scene_id}`, type: "video", sourceUrl: d.outputUrl, startTime: t, endTime: t + dur, duration: dur, transitionIn: "cut", transitionOut: "cut" }); a.totalDuration = t + dur; });
                                        if (si === 0) setMediaUrl(d.outputUrl);
                                        t += dur;
                                      }
                                    } else if (sc.needs_image_gen) {
                                      const res = await fetch("/api/generation/image", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ prompt: sc.ai_prompt || sc.description }),
                                      });
                                      const d = await res.json();
                                      if (d.imageUrl || d.imagePath) {
                                        const dur = sc.duration || 5;
                                        const url = d.imageUrl || `/api/media/${(d.imagePath || "").replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
                                        updateAssembly(a => { a.segments.push({ id: `seg_${sc.scene_id}`, type: "image", sourceUrl: url, startTime: t, endTime: t + dur, duration: dur, transitionIn: "fade", transitionOut: "fade" }); a.totalDuration = t + dur; });
                                        if (si === 0) setMediaUrl(url);
                                        t += dur;
                                      }
                                    } else {
                                      // Text-on-background scene (InvText style)
                                      const dur = sc.duration || 5;
                                      updateAssembly(a => { a.segments.push({ id: `seg_${sc.scene_id}`, type: "image", sourceUrl: `bg:linear-gradient(135deg, #1a1a2e, #16213e)`, startTime: t, endTime: t + dur, duration: dur, transitionIn: "fade", transitionOut: "fade" }); a.totalDuration = t + dur; });
                                      t += dur;
                                    }
                                    // Add overlay text if present
                                    if (sc.overlay_text) {
                                      updateAssembly(a => { a.overlays.push({ id: `ovl_${sc.scene_id}`, type: "text", content: sc.overlay_text!, position: { x: 50, y: 50 }, size: { width: 80, height: 20 }, opacity: 1, animation: (sc.overlay_animation as "fade" | "typewriter" | "slide_up" | "bounce") || "fade", startTime: t - (sc.duration || 5) + 0.5, endTime: t - 0.5 }); });
                                    }
                                    // Add SFX
                                    if (sc.needs_sfx && sc.needs_sfx.length > 0) {
                                      for (const sfxName of sc.needs_sfx) {
                                        updateAssembly(a => { a.sfx.push({ id: `sfx_${sc.scene_id}_${sfxName}`, event: sfxName, sourceUrl: `/api/media/sfx/${sfxName}.mp3`, startTime: t - (sc.duration || 5), duration: 1.5, volume: 0.6, loop: false, category: "auto" }); });
                                      }
                                    }
                                  } catch {
                                    setChatLog(p => [...p, { role: "ai", text: `Scene ${si + 1} generation failed — skipped.` }]);
                                  }
                                }
                                setChatLog(p => [...p, { role: "ai", text: `All ${scenes.length} scenes generated (${Math.round(t)}s). Now assembling via FFmpeg...` }]);
                                saveVersion(`Auto-assemble: ${scenes.length} scenes`);

                                // Step 2: FFmpeg assemble all generated scenes into final video
                                try {
                                  await new Promise(r => setTimeout(r, 500)); // let React state settle
                                  const latestAssembly = await new Promise<AssemblyJSON>(resolve => {
                                    setAssembly(prev => { resolve(structuredClone(prev)); return prev; });
                                  });
                                  const assembleScenes = latestAssembly.segments
                                    .filter(seg => seg.id !== "seg_assembled")
                                    .map((seg, idx) => {
                                      const sceneOverlay = latestAssembly.overlays.find(o => o.startTime >= seg.startTime && o.startTime < seg.endTime);
                                      return { scene: idx + 1, videoUrl: seg.sourceUrl, duration: seg.duration, text: sceneOverlay?.content || undefined, background: seg.sourceUrl.startsWith("bg:") ? seg.sourceUrl.slice(3) : undefined };
                                    });
                                  const narrAudio = latestAssembly.narration.filter(n => n.audioUrl && !n.audioUrl.startsWith("blob:"));
                                  const musicSrc = latestAssembly.music[0]?.sourceUrl;
                                  const sfxList = latestAssembly.sfx.map(s => ({ sourceUrl: s.sourceUrl, startTime: s.startTime, volume: s.volume }));

                                  const assembleRes = await fetch("/api/video/assemble", {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      title: latestAssembly.title,
                                      scenes: assembleScenes,
                                      musicUrl: musicSrc,
                                      musicVolume: latestAssembly.music[0]?.volume ?? 0.3,
                                      narrationUrl: narrAudio[0]?.audioUrl,
                                      narrationList: narrAudio.length > 1 ? narrAudio.map(n => ({ audioUrl: n.audioUrl!, startTime: n.startTime, volume: n.volume })) : undefined,
                                      narrationVolume: latestAssembly.narration[0]?.volume ?? 1.0,
                                      sfx: sfxList.length > 0 ? sfxList : undefined,
                                    }),
                                  });
                                  const assembleData = await assembleRes.json();
                                  if (assembleData.outputUrl) {
                                    setMediaUrl(assembleData.outputUrl);
                                    updateAssembly(a => {
                                      a.segments.unshift({ id: "seg_assembled", type: "video", sourceUrl: assembleData.outputUrl, startTime: 0, endTime: assembleData.duration || a.totalDuration, duration: assembleData.duration || a.totalDuration, transitionIn: "cut", transitionOut: "cut" });
                                    });
                                    // Save to asset library
                                    try {
                                      fetch("/api/assets", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ name: latestAssembly.title, type: "video", filePath: assembleData.outputUrl, status: "assembled", originalInput: latestAssembly.title, metadata: { duration: assembleData.duration, scenes: assembleScenes.length } }),
                                      });
                                    } catch { /* optional */ }
                                    setChatLog(p => [...p, { role: "ai", text: `Assembly complete! ${assembleData.duration ? Math.round(assembleData.duration) + "s" : ""} — final video ready.\n\nYou can:\n• Play the assembled video above\n• Continue editing with AI instructions\n• Download via Review Before Export` }]);
                                    saveVersion("Auto-assembled final video");
                                  } else {
                                    setChatLog(p => [...p, { role: "ai", text: `Scene generation done but assembly failed: ${assembleData.error || "Unknown"}. Click "Assemble & Export" to retry.` }]);
                                  }
                                } catch {
                                  setChatLog(p => [...p, { role: "ai", text: "Scene generation done but assembly failed. Click \"Assemble & Export\" to retry manually." }]);
                                }
                              } else {
                                // Single generation fallback
                                setChatLog(p => [...p, { role: "ai", text: `Generating: "${m.approval!.instruction}"...` }]);
                                try {
                                  const res = await fetch("/api/video/generate", {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ prompt: m.approval!.instruction, model: "hailuo-fast", aspectRatio: "16:9" }),
                                  });
                                  const d = await res.json();
                                  if (d.outputUrl) {
                                    updateAssembly(a => { a.segments.push({ id: `seg_${a.segments.length}`, type: "video", sourceUrl: d.outputUrl, startTime: a.totalDuration, endTime: a.totalDuration + 5, duration: 5, transitionIn: "cut", transitionOut: "cut" }); a.totalDuration += 5; });
                                    setMediaUrl(d.outputUrl);
                                    setChatLog(p => [...p, { role: "ai", text: "Generated and added to project." }]);
                                    saveVersion(m.approval!.instruction);
                                  }
                                } catch { setChatLog(p => [...p, { role: "ai", text: "Generation failed." }]); }
                              }
                              setProcessing(false);
                            }} disabled={processing}
                              style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: processing ? "#2a2a40" : green, color: processing ? muted : "#000", fontSize: 10, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer" }}>
                              {processing ? "Generating..." : `Approve & Generate (${m.approval.meta.totalCost || 0} credits)`}
                            </button>
                            <button onClick={() => setChatLog(p => p.filter((_, idx) => idx !== i))}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Input */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <textarea value={editInput} onChange={e => setEditInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendInstruction(); } }}
                      placeholder="Tell the AI what to do: 'add rain SFX', 'trim 5s', 'louder music', 'change background'..."
                      rows={2} style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 38px 10px 12px", color: text, fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit" }} />
                    <button onClick={sendInstruction} style={{ position: "absolute", bottom: 6, right: 6, width: 24, height: 24, background: purple, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
                  </div>
                  {/* Quick edits */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {[
                      { label: "🌧 Rain", action: () => executeEdit("add_sfx", { event: "rain_light" }) },
                      { label: "✂️ Trim 5s", action: () => executeEdit("trim", { seconds: 5 }) },
                      { label: "🔊 Louder", action: () => executeEdit("volume", { direction: "up" }) },
                      { label: "🔉 Softer", action: () => executeEdit("volume", { direction: "down" }) },
                      { label: "⛈ Thunder", action: () => executeEdit("add_sfx", { event: "thunder" }) },
                      { label: "🐕 Dog Bark", action: () => executeEdit("add_sfx", { event: "dog_bark" }) },
                      { label: "💥 Explosion", action: () => executeEdit("add_sfx", { event: "explosion" }) },
                      { label: "🎵 Cinematic", action: async () => { await generateMusic("cinematic"); } },
                    ].map(q => (
                      <button key={q.label} onClick={q.action} disabled={processing}
                        style={{ fontSize: 10, padding: "4px 10px", borderRadius: 100, border: `1px solid ${border}`, background: "transparent", color: processing ? "#2a2a40" : muted, cursor: processing ? "not-allowed" : "pointer" }}>{q.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════
                TAB: SCENE — Per-scene controls
                ═══════════════════════════════ */}
            {tab === "scene" && (
              <div>
                {/* Motion Preset */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggleSection("motion")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#ec4899" }}>🎞 Motion</span>
                    <span style={{ fontSize: 11, color: muted }}>{expandedSections.has("motion") ? "▼" : "▶"}</span>
                  </button>
                  {expandedSections.has("motion") && (
                    <div>
                      <select
                        value={activeSeg?.metadata?.motionPreset || "none"}
                        onChange={e => {
                          updateAssembly(a => {
                            const seg = a.segments[activeSegIdx];
                            if (seg) { if (!seg.metadata) seg.metadata = {}; seg.metadata.motionPreset = e.target.value; }
                          });
                          saveVersion(`Motion: ${e.target.value}`);
                        }}
                        style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 8px", color: text, fontSize: 10, outline: "none", marginBottom: 6 }}
                      >
                        <option value="none">No Motion Preset</option>
                        <optgroup label="Transitions">
                          <option value="fade_in">Fade In</option>
                          <option value="fade_out">Fade Out</option>
                          <option value="slide_in_left">Slide In Left</option>
                          <option value="slide_in_right">Slide In Right</option>
                          <option value="push_up_in">Push Up In</option>
                          <option value="push_down_out">Push Down Out</option>
                        </optgroup>
                        <optgroup label="Camera">
                          <option value="zoom_in_soft">Zoom In (Soft)</option>
                          <option value="zoom_out_soft">Zoom Out (Soft)</option>
                          <option value="whip_pan_sim">Whip Pan</option>
                          <option value="reveal_hold_exit">Reveal → Hold → Exit</option>
                          <option value="parallax_float">Parallax Float</option>
                        </optgroup>
                        <optgroup label="Speed">
                          <option value="fast_forward_ramp">Fast Forward Ramp</option>
                          <option value="slow_motion_emphasis">Slow Motion</option>
                          <option value="beat_cut">Beat Cut</option>
                        </optgroup>
                        <optgroup label="Product">
                          <option value="screen_punch_zoom">Screen Punch Zoom</option>
                          <option value="product_orbit_sim">Product Orbit</option>
                          <option value="detail_macro_reveal">Detail Macro Reveal</option>
                          <option value="before_after_split">Before/After Split</option>
                        </optgroup>
                        <optgroup label="Effect">
                          <option value="blur_to_focus">Blur to Focus</option>
                          <option value="caption_pop_in">Caption Pop In</option>
                        </optgroup>
                      </select>
                      {/* Speed control */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: muted, width: 55 }}>Speed</span>
                        <input type="range" min="0.25" max="3" step="0.25"
                          value={activeSeg?.metadata?.speedMultiplier || 1}
                          onChange={e => {
                            updateAssembly(a => {
                              const seg = a.segments[activeSegIdx];
                              if (seg) { if (!seg.metadata) seg.metadata = {}; seg.metadata.speedMultiplier = parseFloat(e.target.value); }
                            });
                          }}
                          style={{ flex: 1, accentColor: "#ec4899" }}
                        />
                        <span style={{ fontSize: 9, color: "#ec4899", fontWeight: 600, width: 28, textAlign: "right" }}>{(activeSeg?.metadata?.speedMultiplier || 1)}x</span>
                      </div>
                      {/* Duration ms precision */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: muted, width: 55 }}>Duration</span>
                        <input type="number" min="100" max="60000" step="100"
                          value={Math.round((activeSeg?.duration || 5) * 1000)}
                          onChange={e => {
                            const ms = parseInt(e.target.value) || 5000;
                            updateAssembly(a => {
                              const seg = a.segments[activeSegIdx];
                              if (seg) { seg.duration = ms / 1000; let t = 0; a.segments.forEach(s => { s.startTime = t; s.endTime = t + s.duration; t += s.duration; }); a.totalDuration = t; }
                            });
                          }}
                          style={{ flex: 1, background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 6px", color: text, fontSize: 9, outline: "none" }}
                        />
                        <span style={{ fontSize: 9, color: muted }}>ms</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Narration */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggleSection("narration")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: cyan }}>🎙 Narration</span>
                    <span style={{ fontSize: 11, color: muted }}>{expandedSections.has("narration") ? "▼" : "▶"}</span>
                  </button>
                  {expandedSections.has("narration") && <><textarea value={activeNarr?.text || ""} onChange={e => setNarration(e.target.value)}
                    placeholder="Write narration for this scene..." rows={3}
                    style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  <button onClick={generateNarration} disabled={processing || !activeNarr?.text}
                    style={{ width: "100%", marginTop: 6, padding: 8, borderRadius: 6, border: `1px solid ${cyan}30`, background: `${cyan}10`, color: cyan, fontSize: 12, cursor: !activeNarr?.text ? "not-allowed" : "pointer", fontWeight: 600 }}>
                    🎙 Generate Voice (This Scene)
                  </button>
                  <button onClick={generateAllVoices} disabled={processing}
                    style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: `1px solid ${purple}30`, background: `${purple}10`, color: purple, fontSize: 11, cursor: processing ? "not-allowed" : "pointer", fontWeight: 600 }}>
                    🎙 Generate All Voices (All Scenes + AI Polish)
                  </button>
                  {/* Per-narration timing controls — frame accurate */}
                  {activeNarr && (
                    <div style={{ marginTop: 6, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 8, color: muted }}>Start:</span>
                      <input type="number" step="0.1" min="0" value={activeNarr.startTime}
                        onChange={e => updateAssembly(a => { const n = a.narration.find(x => x.id === activeNarr.id); if (n) n.startTime = parseFloat(e.target.value) || 0; })}
                        style={{ width: 48, background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "2px 4px", color: text, fontSize: 8, outline: "none", textAlign: "center" }} />
                      <span style={{ fontSize: 8, color: muted }}>End:</span>
                      <input type="number" step="0.1" min="0" value={activeNarr.endTime}
                        onChange={e => updateAssembly(a => { const n = a.narration.find(x => x.id === activeNarr.id); if (n) n.endTime = parseFloat(e.target.value) || 0; })}
                        style={{ width: 48, background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "2px 4px", color: text, fontSize: 8, outline: "none", textAlign: "center" }} />
                      <span style={{ fontSize: 7, color: "#3d5060" }}>s</span>
                      <button title="Set start to current playhead" onClick={() => updateAssembly(a => { const n = a.narration.find(x => x.id === activeNarr.id); if (n) n.startTime = currentTime; })}
                        style={{ fontSize: 7, color: cyan, background: "none", border: "none", cursor: "pointer" }}>[I]</button>
                      <button title="Set end to current playhead" onClick={() => updateAssembly(a => { const n = a.narration.find(x => x.id === activeNarr.id); if (n) n.endTime = currentTime; })}
                        style={{ fontSize: 7, color: red, background: "none", border: "none", cursor: "pointer" }}>[O]</button>
                      {activeNarr.audioUrl && <span style={{ fontSize: 7, color: green }}>Audio ready</span>}
                    </div>
                  )}
                </>}
                </div>

                {/* Music */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggleSection("music")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: green }}>🎵 Music {assembly.music.length > 0 ? "✓" : ""}</span>
                    <span style={{ fontSize: 11, color: muted }}>{expandedSections.has("music") ? "▼" : "▶"}</span>
                  </button>
                  {expandedSections.has("music") && <>
                  {activeMusic ? (
                    <div>
                      <p style={{ fontSize: 10, color: green, marginBottom: 4 }}>Music added ✓</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 9, color: muted }}>Vol</span>
                        <input type="range" min="0" max="100" value={Math.round((activeMusic.volume || 0.3) * 100)}
                          onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { if (a.music[0]) a.music[0].volume = v; }); setLiveMusicVolume(v); }}
                          style={{ flex: 1, accentColor: green }} />
                        <span style={{ fontSize: 9, color: muted, fontFamily: "monospace", width: 28 }}>{Math.round((activeMusic.volume || 0.3) * 100)}%</span>
                      </div>
                      {/* Replace music for this scene */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        <span style={{ fontSize: 8, color: muted, width: "100%", marginBottom: 2 }}>Replace music for this scene:</span>
                        {["cinematic", "upbeat", "calm", "suspense", "afrobeats", "children", "african", "romantic"].map(m => (
                          <button key={m} onClick={async () => {
                            if (processing) return;
                            await generateMusic(m);
                            // Update music entry to match this scene's time range
                            updateAssembly(a => {
                              const lastMusic = a.music[a.music.length - 1];
                              if (lastMusic && activeSeg) {
                                lastMusic.startTime = activeSeg.startTime;
                                lastMusic.endTime = activeSeg.endTime;
                              }
                            });
                          }} disabled={processing}
                          style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${green}15`, background: "transparent", color: `${green}99`, fontSize: 8, cursor: processing ? "not-allowed" : "pointer", textTransform: "capitalize" }}>{m}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {["cinematic", "upbeat", "calm", "suspense", "afrobeats"].map(m => (
                        <button key={m} onClick={() => generateMusic(m)} disabled={processing}
                          style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${green}25`, background: `${green}08`, color: green, fontSize: 9, cursor: processing ? "not-allowed" : "pointer", textTransform: "capitalize" }}>{m}</button>
                      ))}
                    </div>
                  )}
                </>}
                </div>

                {/* SFX */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggleSection("sfx")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: gold }}>💥 SFX {assembly.sfx.length > 0 ? `(${assembly.sfx.length})` : ""}</span>
                    <span style={{ fontSize: 11, color: muted }}>{expandedSections.has("sfx") ? "▼" : "▶"}</span>
                  </button>
                  {expandedSections.has("sfx") && <>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {["thunder", "rain_light", "rain_heavy", "wind_gentle", "wind_howling", "storm", "ocean_waves", "footstep_gravel", "footsteps_run", "door_slam", "door_creak", "crowd_cheer", "crowd_applause", "dog_bark", "explosion", "forest_birds", "heartbeat", "whoosh", "whoosh_deep", "siren", "fire_crackling", "car_engine", "car_horn", "airhorn", "beep", "clapping", "children_laugh", "city_ambience", "church_bell", "birds_chirping"].map(s => (
                      <div key={s} style={{ display: "inline-flex", gap: 0, marginBottom: 3 }}>
                        <button onClick={() => { new Audio(`/api/media/sfx/${s}.mp3`).play().catch(() => {}); }}
                          title="Preview"
                          style={{ padding: "4px 6px", borderRadius: "7px 0 0 7px", border: `1px solid ${gold}25`, borderRight: "none", background: `${gold}08`, color: gold, fontSize: 10, cursor: "pointer" }}>▶</button>
                        <button onClick={() => addSfx(s, currentTime)}
                          title="Add to scene"
                          style={{ padding: "4px 9px", borderRadius: "0 7px 7px 0", border: `1px solid ${gold}25`, background: `${gold}08`, color: gold, fontSize: 10, cursor: "pointer" }}>{s.replace(/_/g, " ")}</button>
                      </div>
                    ))}
                  </div>
                  {assembly.sfx.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {assembly.sfx.map(s => (
                        <div key={s.id} style={{ fontSize: 9, color: muted, padding: "3px 0", display: "flex", alignItems: "center", gap: 4 }}>
                          <button onClick={() => { new Audio(`/api/media/sfx/${s.event}.mp3`).play().catch(() => {}); }}
                            style={{ fontSize: 8, color: gold, background: "none", border: "none", cursor: "pointer" }}>▶</button>
                          <span>{s.event}</span>
                          <span style={{ color: "#3d5060" }}>@ {fmtTime(s.startTime)}</span>
                          <input type="range" min="0" max="100" value={Math.round(s.volume * 100)}
                            onChange={e => updateAssembly(a => { const sfx = a.sfx.find(x => x.id === s.id); if (sfx) sfx.volume = parseInt(e.target.value) / 100; })}
                            style={{ width: 50, accentColor: gold }} />
                          <span style={{ fontSize: 7, color: "#3d5060", fontFamily: "monospace" }}>{Math.round(s.volume * 100)}%</span>
                          <button onClick={() => { updateAssembly(a => { a.sfx = a.sfx.filter(x => x.id !== s.id); }); saveVersion(`Removed ${s.event}`); }}
                            style={{ fontSize: 8, color: red, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>}
                </div>

                {/* Cast Tray — characters assigned to project */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggleSection("cast")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: purple }}>👥 Cast {castTray.length > 0 ? `(${castTray.length})` : ""}</span>
                    <span style={{ fontSize: 11, color: muted }}>{expandedSections.has("cast") ? "▼" : "▶"}</span>
                  </button>
                  {expandedSections.has("cast") && <>
                    {castTray.length === 0 && (
                      <p style={{ fontSize: 9, color: muted, marginBottom: 6 }}>No characters assigned. Use the Character button above to add.</p>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {castTray.map(c => (
                        <div key={c.characterId} style={{ display: "flex", alignItems: "center", gap: 8, background: "#10121c", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 8px" }}>
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt={c.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid #2a2a40", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: "#1a1a2e", border: "1px solid #2a2a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#3a3a5a", flexShrink: 0 }}>👤</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontSize: 8, color: "#a855f7", fontFamily: "monospace" }}>{c.characterId}</div>
                            {c.voiceName && <div style={{ fontSize: 8, color: "#4ade80" }}>{c.voiceName}</div>}
                          </div>
                          <button
                            title="Insert character ID at cursor"
                            onClick={() => {
                              // Try to insert characterId at cursor in active gen-prompt or any focused textarea
                              const el = document.getElementById("gen-prompt") as HTMLTextAreaElement | null;
                              if (el) {
                                const start = el.selectionStart ?? el.value.length;
                                const end = el.selectionEnd ?? el.value.length;
                                const token = `[${c.characterId}]`;
                                const before = el.value.substring(0, start);
                                const after = el.value.substring(end);
                                el.value = before + token + after;
                                el.selectionStart = el.selectionEnd = start + token.length;
                                el.focus();
                                // Trigger React onChange
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                                if (nativeInputValueSetter) {
                                  nativeInputValueSetter.call(el, el.value);
                                  el.dispatchEvent(new Event("input", { bubbles: true }));
                                }
                              }
                            }}
                            style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${purple}40`, background: `${purple}15`, color: purple, fontSize: 8, cursor: "pointer", flexShrink: 0 }}
                          >
                            Insert
                          </button>
                          <button
                            title="Remove from cast"
                            onClick={() => setCastTray(prev => prev.filter(x => x.characterId !== c.characterId))}
                            style={{ padding: "3px 6px", borderRadius: 5, border: "none", background: `${red}15`, color: red, fontSize: 8, cursor: "pointer", flexShrink: 0 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowCharacterPicker(true)}
                      style={{ width: "100%", marginTop: 6, padding: "5px 0", borderRadius: 6, border: `1px dashed ${purple}40`, background: "transparent", color: purple, fontSize: 9, cursor: "pointer" }}
                    >
                      + Add Character to Cast
                    </button>
                  </>}
                </div>

                {/* Scene Info — ID + Character IDs + Lock + Shot/Video */}
                <div style={{ marginBottom: 14, background: "#10121c", borderRadius: 10, padding: 10, border: `1px solid ${border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: cyan, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Scene {activeSegIdx + 1} of {assembly.segments.length}</span>
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace" }}>
                      {assembly.segments[activeSegIdx]?.id || assembly.segments[activeSegIdx]?.sceneId || "No segment"}
                    </span>
                  </div>
                  {/* Character IDs in this scene */}
                  {castTray.length > 0 && (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
                      {castTray.map(c => (
                        <span key={c.characterId} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 10, background: `${purple}15`, color: purple, fontFamily: "monospace" }}>{c.characterId}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => {
                      updateAssembly(a => {
                        if (a.segments[activeSegIdx]) {
                          const seg = a.segments[activeSegIdx] as AssemblySegment & { locked?: boolean };
                          seg.locked = !seg.locked;
                        }
                      });
                    }} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${gold}30`, background: (assembly.segments[activeSegIdx] as AssemblySegment & { locked?: boolean })?.locked ? `${gold}15` : "transparent", color: gold, fontSize: 8, fontWeight: 600, cursor: "pointer" }}>
                      {(assembly.segments[activeSegIdx] as AssemblySegment & { locked?: boolean })?.locked ? "Locked" : "Lock Scene"}
                    </button>
                    <button onClick={() => {
                      const seg = assembly.segments[activeSegIdx];
                      if (seg?.sourceUrl && !seg.sourceUrl.startsWith("bg:")) {
                        setProcessing(true);
                        setChatLog(p => [...p, { role: "ai", text: "Converting image → video with AI animation..." }]);
                        fetch("/api/video/generate", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt: `Animate this scene with cinematic camera movement`, sourceImage: seg.sourceUrl, model: "hailuo-fast", aspectRatio: "16:9" }),
                        }).then(r => r.json()).then(d => {
                          if (d.outputUrl) {
                            updateAssembly(a => { if (a.segments[activeSegIdx]) { a.segments[activeSegIdx].sourceUrl = d.outputUrl; a.segments[activeSegIdx].type = "video"; } });
                            setMediaUrl(d.outputUrl);
                            setChatLog(p => [...p, { role: "ai", text: "Scene converted to video (image→video)." }]);
                            saveVersion("Image→Video");
                          }
                        }).catch(() => { setChatLog(p => [...p, { role: "ai", text: "Video generation failed." }]); }).finally(() => setProcessing(false));
                      }
                    }} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${green}30`, background: `${green}06`, color: green, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      🎬 Animate
                    </button>
                  </div>
                </div>

                {/* Scene Image Panel — structured image creation with character chips */}
                <div style={{ marginBottom: 14 }}>
                  <button onClick={() => toggleSection("scene-image")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: cyan }}>🖼 Generate Image</span>
                    <span style={{ fontSize: 11, color: muted }}>{expandedSections.has("scene-image") ? "▼" : "▶"}</span>
                  </button>
                  {expandedSections.has("scene-image") && (
                    <SceneImagePanel
                      sceneId={assembly.segments[activeSegIdx]?.id || assembly.segments[activeSegIdx]?.sceneId}
                      sceneTitle={assembly.title}
                      sceneText={assembly.segments[activeSegIdx]?.sourceUrl?.startsWith("bg:") ? "" : undefined}
                      characters={castTray.map(c => ({ id: c.characterId, characterId: c.characterId, name: c.name, imageUrl: c.imageUrl }))}
                      selectedCharacterIds={castTray.map(c => c.characterId)}
                      onImageGenerated={(url) => {
                        updateAssembly(a => {
                          if (a.segments[activeSegIdx]) {
                            a.segments[activeSegIdx].sourceUrl = url;
                            a.segments[activeSegIdx].type = "image";
                          }
                        });
                        setMediaUrl(url);
                        setChatLog(p => [...p, { role: "ai", text: "Scene image generated and loaded." }]);
                      }}
                      compact
                    />
                  )}
                </div>

                {/* Subtitle */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: purple, marginBottom: 8 }}>📝 Caption / Subtitle</div>
                  <input id="caption-input" placeholder="Add caption text..." value={assembly.subtitles[0]?.text || ""}
                    onChange={e => { const t = e.target.value; updateAssembly(a => {
                      if (t) { a.subtitles = [{ id: "sub_0", text: t, startTime: 0, endTime: a.totalDuration, position: "bottom", fontSize: 24, fontColor: "#ffffff", style: "normal" }]; }
                      else { a.subtitles = []; }
                    }); }}
                    style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: text, fontSize: 12, outline: "none", marginBottom: 6 }} />
                  {/* Translate button */}
                  <div style={{ display: "flex", gap: 4 }}>
                    <select id="translate-lang" style={{ flex: 1, background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 6px", color: text, fontSize: 9, outline: "none" }}>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="hi">Hindi</option>
                      <option value="ru">Russian</option>
                      <option value="pt">Portuguese</option>
                      <option value="ar">Arabic</option>
                      <option value="zh">Mandarin</option>
                      <option value="de">German</option>
                      <option value="sw">Swahili</option>
                    </select>
                    <button onClick={async () => {
                      const captionText = assembly.subtitles[0]?.text || (document.getElementById("caption-input") as HTMLInputElement)?.value;
                      const lang = (document.getElementById("translate-lang") as HTMLSelectElement)?.value || "es";
                      if (!captionText) { setChatLog(p => [...p, { role: "ai", text: "Enter caption text first." }]); return; }
                      setProcessing(true);
                      setChatLog(p => [...p, { role: "ai", text: `Translating to ${lang}...` }]);
                      try {
                        const res = await fetch("/api/assembly/change", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ instruction: `Translate this text to ${lang}: "${captionText}"`, projectId: assembly.projectId, tier }),
                        });
                        const d = await res.json();
                        if (d.plan?.description) {
                          updateAssembly(a => {
                            a.subtitles.push({ id: `sub_${lang}`, text: d.plan.description, startTime: 0, endTime: a.totalDuration, position: "top", fontSize: 20, fontColor: "#ffdd00", style: "normal" });
                          });
                          setChatLog(p => [...p, { role: "ai", text: `Translated: "${d.plan.description}"` }]);
                          saveVersion(`Translated to ${lang}`);
                        }
                      } catch { setChatLog(p => [...p, { role: "ai", text: "Translation failed." }]); }
                      setProcessing(false);
                    }} disabled={processing}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${purple}30`, background: `${purple}10`, color: purple, fontSize: 9, cursor: processing ? "not-allowed" : "pointer" }}>
                      Translate
                    </button>
                  </div>
                </div>

                {/* ── Characters — Create + Assign (click to select, no prompt) ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#ec4899", marginBottom: 8 }}>👤 Characters</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <a href="/dashboard/character-voices" target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ec489940", background: "#ec489910", color: "#ec4899", fontSize: 11, cursor: "pointer", textAlign: "center", textDecoration: "none", fontWeight: 600 }}>
                      + Create
                    </a>
                    <button onClick={() => setShowCharacterPicker(true)}
                      style={{ flex: 2, padding: "8px 10px", borderRadius: 8, border: "1px solid #ec489940", background: "#ec489918", color: "#ec4899", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                      👤 Select Character
                    </button>
                  </div>
                  {assembly.narration.find(n => n.speakerId) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: "#ec489910", border: "1px solid #ec489930" }}>
                      <span style={{ fontSize: 12 }}>🎙</span>
                      <span style={{ fontSize: 11, color: "#ec4899", fontWeight: 600 }}>{assembly.narration.find(n => n.speakerId)?.speakerId}</span>
                      <button onClick={() => updateAssembly(a => { a.narration.forEach(n => { delete (n as unknown as Record<string, unknown>).speakerId; delete (n as unknown as Record<string, unknown>).voiceId; }); })}
                        style={{ marginLeft: "auto", fontSize: 10, color: red, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </div>
                  )}
                </div>

                {/* ── Overlay/Text ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#ec4899", marginBottom: 8 }}>🎨 Text Overlay</div>
                  <input placeholder="Overlay text (title, CTA, watermark)..." id="overlay-text"
                    style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 8px", color: text, fontSize: 10, outline: "none", marginBottom: 4 }} />
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <select id="overlay-style" style={{ flex: 1, minWidth: 60, background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 6px", color: text, fontSize: 9, outline: "none" }}>
                      <option value="bottom">Bottom</option>
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                    </select>
                    <select id="overlay-fontsize" style={{ flex: 1, minWidth: 55, background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 6px", color: text, fontSize: 9, outline: "none" }}>
                      <option value="12">12px Small</option>
                      <option value="16" selected>16px Normal</option>
                      <option value="20">20px Medium</option>
                      <option value="24">24px Large</option>
                      <option value="32">32px XL</option>
                      <option value="40">40px XXL</option>
                      <option value="48">48px Title</option>
                    </select>
                    <select id="overlay-anim" style={{ flex: 1, minWidth: 65, background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 6px", color: text, fontSize: 9, outline: "none" }}>
                      <option value="fade">Fade In</option>
                      <option value="typewriter">Typewriter</option>
                      <option value="slide_up">Slide Up</option>
                      <option value="bounce">Bounce</option>
                      <option value="pop">Pop / Scale</option>
                      <option value="glow">Glow Pulse</option>
                      <option value="shake">Shake</option>
                      <option value="rotate_in">Rotate In</option>
                      <option value="blur_reveal">Blur Reveal</option>
                      <option value="none">None</option>
                    </select>
                    <button onClick={() => {
                      const t = (document.getElementById("overlay-text") as HTMLInputElement)?.value;
                      const anim = (document.getElementById("overlay-anim") as HTMLSelectElement)?.value || "fade";
                      const fontSize = parseInt((document.getElementById("overlay-fontsize") as HTMLSelectElement)?.value || "16");
                      const pos = (document.getElementById("overlay-style") as HTMLSelectElement)?.value || "bottom";
                      if (!t) return;
                      updateAssembly(a => {
                        a.overlays.push({ id: `ovl_${Date.now()}`, type: "text", content: t, startTime: 0, endTime: a.totalDuration, position: { x: 50, y: pos === "top" ? 10 : pos === "center" ? 50 : 90 }, size: { width: fontSize, height: fontSize }, opacity: 1, animation: anim as OverlayEntry["animation"] });
                      });
                      setChatLog(p => [...p, { role: "ai", text: `Overlay "${t.slice(0, 20)}" added.` }]);
                      saveVersion(`Overlay: ${t.slice(0, 15)}`);
                    }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid #ec489930`, background: "#ec489910", color: "#ec4899", fontSize: 9, cursor: "pointer" }}>Add</button>
                  </div>
                  {assembly.overlays.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {assembly.overlays.map(o => (
                        <div key={o.id} style={{ fontSize: 9, color: muted, padding: "4px 0", borderBottom: `1px solid ${border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <span style={{ fontWeight: 600, color: currentTime >= o.startTime && currentTime <= o.endTime ? "#ec4899" : muted }}>{o.content.slice(0, 20)}</span>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <span style={{ fontSize: 7, color: "#3d5060" }}>{o.animation || "fade"}</span>
                              <button onClick={() => updateAssembly(a => { a.overlays = a.overlays.filter(x => x.id !== o.id); })}
                                style={{ fontSize: 8, color: red, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                            </div>
                          </div>
                          {/* Per-overlay timing editor */}
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 7, color: "#3d5060", width: 22 }}>In</span>
                            <input type="number" step="0.1" min="0" max={assembly.totalDuration} value={o.startTime}
                              onChange={e => { const v = parseFloat(e.target.value) || 0; updateAssembly(a => { const ovl = a.overlays.find(x => x.id === o.id); if (ovl) ovl.startTime = v; }); }}
                              style={{ width: 45, background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "1px 3px", color: text, fontSize: 8, outline: "none", textAlign: "center" }} />
                            <span style={{ fontSize: 7, color: "#3d5060", width: 22 }}>Out</span>
                            <input type="number" step="0.1" min="0" max={assembly.totalDuration} value={o.endTime}
                              onChange={e => { const v = parseFloat(e.target.value) || 0; updateAssembly(a => { const ovl = a.overlays.find(x => x.id === o.id); if (ovl) ovl.endTime = v; }); }}
                              style={{ width: 45, background: "#080b10", border: `1px solid ${border}`, borderRadius: 4, padding: "1px 3px", color: text, fontSize: 8, outline: "none", textAlign: "center" }} />
                            <span style={{ fontSize: 7, color: "#3d5060" }}>s</span>
                            {/* Set to current playhead */}
                            <button title="Set start to current time" onClick={() => updateAssembly(a => { const ovl = a.overlays.find(x => x.id === o.id); if (ovl) ovl.startTime = currentTime; })}
                              style={{ fontSize: 7, color: cyan, background: "none", border: "none", cursor: "pointer" }}>[I]</button>
                            <button title="Set end to current time" onClick={() => updateAssembly(a => { const ovl = a.overlays.find(x => x.id === o.id); if (ovl) ovl.endTime = currentTime; })}
                              style={{ fontSize: 7, color: red, background: "none", border: "none", cursor: "pointer" }}>[O]</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Per-layer volume mixer ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: muted, marginBottom: 8 }}>🔊 Volume Mix</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: cyan, width: 64 }}>Voice</span>
                    <input type="range" min="0" max="100" data-testid="narration-volume" value={Math.round((assembly.narration[0]?.volume ?? 1) * 100)}
                      onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { if (a.narration[0]) a.narration[0].volume = v; }); setLiveNarrationVolume(v); }}
                      style={{ flex: 1, accentColor: cyan }} />
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((assembly.narration[0]?.volume ?? 1) * 100)}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: green, width: 64 }}>Music</span>
                    <input type="range" min="0" max="100" data-testid="music-volume" value={Math.round((assembly.music[0]?.volume ?? 0.3) * 100)}
                      onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { if (a.music[0]) a.music[0].volume = v; }); setLiveMusicVolume(v); }}
                      style={{ flex: 1, accentColor: green }} />
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((assembly.music[0]?.volume ?? 0.3) * 100)}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: gold, width: 64 }}>SFX</span>
                    <input type="range" min="0" max="100" data-testid="sfx-volume" value={Math.round((assembly.sfx[0]?.volume ?? 0.7) * 100)}
                      onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { a.sfx.forEach(s => { s.volume = v; }); }); setLiveSfxVolume(v); }}
                      style={{ flex: 1, accentColor: gold }} />
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((assembly.sfx[0]?.volume ?? 0.7) * 100)}%</span>
                  </div>
                  <p style={{ fontSize: 10, color: "#3d5060", marginTop: 4 }}>Live — adjust while playing</p>
                </div>

                {/* Assemble button */}
                <button onClick={assemble} disabled={processing || !assembly.segments.length}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: processing ? "#2a2a40" : green, color: processing ? muted : "#000", fontSize: 14, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", marginBottom: 8 }}>
                  {processing ? "Processing..." : "🎬 Assemble + Mix (FFmpeg)"}
                </button>

                {/* Save / Download assembled video — Place 1 */}
                {mediaUrl && !mediaUrl.startsWith("blob:") && (
                  <a href={mediaUrl} download={`${(assembly.title || "video").replace(/\s+/g, "_")}_${Date.now()}.mp4`}
                    style={{ display: "block", width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${green}40`, background: `${green}08`, color: green, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center", textDecoration: "none", marginBottom: 8 }}>
                    💾 Download Video
                  </a>
                )}

                {/* Review & Export button */}
                <button onClick={() => setShowReview(true)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${purple}`, background: `${purple}10`, color: purple, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  👁 Review Before Export
                </button>
              </div>
            )}

            {/* ═══════════════════════════════
                TAB: AUDIO — Music + SFX + Mix
                ═══════════════════════════════ */}
            {tab === "audio" && (
              <div>
                {/* Music */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: green, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🎵 Music {assembly.music.length > 0 ? "✓" : ""}</div>
                  {activeMusic ? (
                    <div>
                      <p style={{ fontSize: 10, color: green, marginBottom: 6 }}>Music track added ✓</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: muted, width: 28 }}>Vol</span>
                        <input type="range" min="0" max="100" value={Math.round((activeMusic.volume || 0.3) * 100)} onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { if (a.music[0]) a.music[0].volume = v; }); setLiveMusicVolume(v); }} style={{ flex: 1, accentColor: green }} />
                        <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((activeMusic.volume || 0.3) * 100)}%</span>
                      </div>
                      <div style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Replace:</div>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {["cinematic", "upbeat", "calm", "suspense", "emotional", "afrobeats", "children", "african", "romantic", "dramatic"].map(m => (
                      <button key={m} onClick={() => generateMusic(m)} disabled={processing}
                        style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${green}25`, background: `${green}08`, color: green, fontSize: 10, cursor: processing ? "not-allowed" : "pointer", textTransform: "capitalize" }}>{m}</button>
                    ))}
                  </div>
                  {assembly.music.length > 0 && (
                    <button onClick={() => updateAssembly(a => { a.music = []; })} style={{ marginTop: 6, padding: "4px 10px", borderRadius: 6, border: `1px solid ${red}20`, background: "transparent", color: red, fontSize: 9, cursor: "pointer" }}>Remove Music</button>
                  )}
                </div>

                {/* SFX */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: gold, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>💥 Sound Effects {assembly.sfx.length > 0 ? `(${assembly.sfx.length})` : ""}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {["thunder", "rain_light", "rain_heavy", "wind_gentle", "wind_howling", "storm", "ocean_waves", "footstep_gravel", "footsteps_run", "door_slam", "door_creak", "crowd_cheer", "crowd_applause", "dog_bark", "explosion", "forest_birds", "heartbeat", "whoosh", "whoosh_deep", "siren", "fire_crackling", "car_engine", "car_horn", "airhorn", "beep", "clapping", "children_laugh", "city_ambience", "church_bell", "birds_chirping"].map(s => (
                      <div key={s} style={{ display: "inline-flex", gap: 0, marginBottom: 3 }}>
                        <button onClick={() => { new Audio(`/api/media/sfx/${s}.mp3`).play().catch(() => {}); }} title="Preview" style={{ padding: "4px 6px", borderRadius: "7px 0 0 7px", border: `1px solid ${gold}25`, borderRight: "none", background: `${gold}08`, color: gold, fontSize: 10, cursor: "pointer" }}>▶</button>
                        <button onClick={() => addSfx(s, currentTime)} title="Add to scene" style={{ padding: "4px 9px", borderRadius: "0 7px 7px 0", border: `1px solid ${gold}25`, background: `${gold}08`, color: gold, fontSize: 9, cursor: "pointer" }}>{s.replace(/_/g, " ")}</button>
                      </div>
                    ))}
                  </div>
                  {assembly.sfx.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Active SFX:</div>
                      {assembly.sfx.map(s => (
                        <div key={s.id} style={{ fontSize: 9, color: muted, padding: "3px 0", display: "flex", alignItems: "center", gap: 5 }}>
                          <button onClick={() => { new Audio(`/api/media/sfx/${s.event}.mp3`).play().catch(() => {}); }} style={{ fontSize: 8, color: gold, background: "none", border: "none", cursor: "pointer" }}>▶</button>
                          <span style={{ flex: 1 }}>{s.event}</span>
                          <span style={{ color: "#3d5060", fontFamily: "monospace" }}>@{fmtTime(s.startTime)}</span>
                          <input type="range" min="0" max="100" value={Math.round(s.volume * 100)} onChange={e => updateAssembly(a => { const sfx = a.sfx.find(x => x.id === s.id); if (sfx) sfx.volume = parseInt(e.target.value) / 100; })} style={{ width: 48, accentColor: gold }} />
                          <span style={{ fontSize: 7, color: "#3d5060", width: 26, textAlign: "right" }}>{Math.round(s.volume * 100)}%</span>
                          <button onClick={() => { updateAssembly(a => { a.sfx = a.sfx.filter(x => x.id !== s.id); }); saveVersion(`Removed ${s.event}`); }} style={{ fontSize: 8, color: red, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Volume Mixer */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🔊 Volume Mix</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: cyan, width: 52 }}>Voice</span>
                    <input type="range" min="0" max="100" data-testid="narration-volume" value={Math.round((assembly.narration[0]?.volume ?? 1) * 100)} onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { if (a.narration[0]) a.narration[0].volume = v; }); setLiveNarrationVolume(v); }} style={{ flex: 1, accentColor: cyan }} />
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((assembly.narration[0]?.volume ?? 1) * 100)}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: green, width: 52 }}>Music</span>
                    <input type="range" min="0" max="100" data-testid="music-volume" value={Math.round((assembly.music[0]?.volume ?? 0.3) * 100)} onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { if (a.music[0]) a.music[0].volume = v; }); setLiveMusicVolume(v); }} style={{ flex: 1, accentColor: green }} />
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((assembly.music[0]?.volume ?? 0.3) * 100)}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: gold, width: 52 }}>SFX</span>
                    <input type="range" min="0" max="100" data-testid="sfx-volume" value={Math.round((assembly.sfx[0]?.volume ?? 0.7) * 100)} onChange={e => { const v = parseInt(e.target.value) / 100; updateAssembly(a => { a.sfx.forEach(s => { s.volume = v; }); }); setLiveSfxVolume(v); }} style={{ flex: 1, accentColor: gold }} />
                    <span style={{ fontSize: 10, color: muted, fontFamily: "monospace", width: 32 }}>{Math.round((assembly.sfx[0]?.volume ?? 0.7) * 100)}%</span>
                  </div>
                  <p style={{ fontSize: 9, color: "#3d5060", marginTop: 3 }}>Live — adjust while playing</p>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════
                TAB: HISTORY
                ═══════════════════════════════ */}
            {tab === "history" && (
              <div>
                {versions.length === 0 ? (
                  <p style={{ fontSize: 12, color: muted, textAlign: "center", padding: 20 }}>No history yet — changes appear here</p>
                ) : versions.map((v, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: i === 0 ? `${purple}08` : s2, border: `1px solid ${i === 0 ? purple + "30" : border}`, borderRadius: 8, marginBottom: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{v.label}</span>
                      {i === 0 && <span style={{ fontSize: 10, color: purple, fontWeight: 600 }}>● Current</span>}
                    </div>
                    <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>{v.desc}</p>
                    {i > 0 && <button onClick={() => { setAssembly(structuredClone(v.assembly)); setChatLog(p => [...p, { role: "ai", text: `Restored to ${v.label}.` }]); }}
                      style={{ fontSize: 11, color: purple, background: "none", border: `1px solid ${purple}30`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", marginTop: 4 }}>↩ Restore</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ REVIEW PANELS ══ */}
      {showReview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(6,8,16,0.95)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div style={{ maxWidth: 800, width: "100%" }}>
            <button onClick={() => setShowReview(false)} style={{ fontSize: 12, color: muted, background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>← Back to editor</button>
            <ReviewPanels
              projectTitle={assembly.title}
              segments={assembly.segments.map(s => ({ id: s.id, type: s.type, sourceUrl: s.sourceUrl, duration: s.duration }))}
              narration={assembly.narration}
              music={assembly.music}
              sfx={assembly.sfx}
              subtitles={assembly.subtitles}
              overlays={assembly.overlays}
              soundLicenses={assembly.soundLicenses}
              rightsConfirmed={assembly.rightsConfirmed}
              previewUrl={mediaUrl}
              exportSettings={assembly.exportSettings}
              onApprove={async () => {
                setShowReview(false);
                await assemble();
                setChatLog(p => [...p, { role: "ai", text: "Review approved. Final assembly exported." }]);
              }}
              onReject={reason => {
                setShowReview(false);
                setChatLog(p => [...p, { role: "ai", text: `Export rejected: ${reason}. Continue editing.` }]);
              }}
            />
          </div>
        </div>
      )}

      {/* ══ IMPORT MODAL ══ */}
      {showImport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(6,8,16,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: s1, border: `1px solid ${border}`, borderRadius: 20, padding: 28, maxWidth: 480, width: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: text }}>Import Into Editor</span>
            </div>
            {/* Import mode selector — shows when project has existing segments */}
            {assembly.segments.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {([["append", "Append After", green], ["overlay", "Overlay On Top", cyan], ["blend", "Blend/Composite", "#ec4899"], ["replace", "Replace Scene", gold]] as const).map(([mode, label, color]) => (
                  <button key={mode} onClick={() => setImportMode(mode)}
                    style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${importMode === mode ? color : border}`, background: importMode === mode ? `${color}15` : "transparent", color: importMode === mode ? color : muted, fontSize: 9, cursor: "pointer", fontWeight: importMode === mode ? 700 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ position: "absolute", top: 20, right: 20 }}>
              <button onClick={() => setShowImport(false)} style={{ fontSize: 14, color: muted, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ padding: 20, borderRadius: 14, border: `2px dashed ${border}`, cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 24, display: "block" }}>📁</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: text, marginTop: 4 }}>Upload File</p>
                <p style={{ fontSize: 9, color: muted }}>Video or image</p>
                <input type="file" accept="video/*,image/*" data-testid="import-file" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) importFile(e.target.files[0]); }} />
              </label>
              <button onClick={() => { loadProjectList(); }} style={{ padding: 20, borderRadius: 14, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 24, display: "block" }}>📋</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: text, marginTop: 4 }}>Load Project</p>
                <p style={{ fontSize: 9, color: muted }}>{projectList.length || "..."} saved</p>
              </button>
            </div>
            {projectList.length > 0 && (
              <div style={{ marginTop: 12, maxHeight: 200, overflowY: "auto" }}>
                {projectList.map(p => (
                  <button key={p.id} onClick={() => loadProject(p.id)}
                    style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", textAlign: "left", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: text }}>{p.title}</span>
                    <span style={{ fontSize: 10, color: purple }}>Open →</span>
                  </button>
                ))}
              </div>
            )}
            {/* Asset Library items */}
            {assetList.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 500, color: muted, marginBottom: 8 }}>From Asset Library</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                  {assetList.filter(a => a.url).map(a => (
                    <button key={a.id} onClick={async () => {
                      const assetUrl = a.url;
                      setShowImport(false);
                      setProcessing(true);
                      setChatLog([{ role: "ai", text: `Loading asset "${a.title}"...` }]);

                      // Get real duration
                      let dur = 15;
                      try {
                        const anRes = await fetch("/api/video-finishing", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ videoPath: assetUrl, projectTitle: a.title, tier: "standard" }),
                        });
                        const anData = await anRes.json();
                        if (anData.analysis?.duration) dur = Math.round(anData.analysis.duration);
                      } catch {}

                      const asm = createEmptyAssembly(`asset_${Date.now()}`, "collaborative", a.title);
                      asm.totalDuration = dur;
                      asm.segments.push({ id: "seg_0", type: "video", sourceUrl: assetUrl, startTime: 0, endTime: dur, duration: dur, transitionIn: "cut", transitionOut: "cut" });
                      setAssembly(asm); setMediaUrl(assetUrl); setActiveSegIdx(0);
                      setVersions([{ label: "v1 — Asset", desc: `${a.title} (${dur}s)`, assembly: structuredClone(asm) }]);
                      setChatLog([{ role: "ai", text: `Asset "${a.title}" loaded — ${dur}s. Add narration, music, SFX in Properties.` }]);
                      setProcessing(false);
                    }}
                      style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 11, color: text }}>{a.title.slice(0, 40)}</span>
                      <span style={{ fontSize: 10, color: cyan }}>Use →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ovl-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ovl-slide-up { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes ovl-typewriter { from { width: 0; } to { width: 100%; } }
        @keyframes ovl-bounce { 0% { transform: translate(-50%, -30px) scale(0.5); opacity: 0; } 50% { transform: translate(-50%, 5px) scale(1.05); } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
        @keyframes ovl-scale { from { transform: translate(-50%, 0) scale(0); opacity: 0; } to { transform: translate(-50%, 0) scale(1); opacity: 1; } }
        @keyframes ovl-glow { 0%, 100% { text-shadow: 0 0 5px rgba(168,85,247,0.5); } 50% { text-shadow: 0 0 20px rgba(168,85,247,1), 0 0 40px rgba(168,85,247,0.5); } }
        @keyframes ovl-shake { 0%, 100% { transform: translate(-50%, 0); } 10%, 30%, 50%, 70%, 90% { transform: translate(calc(-50% - 3px), 0); } 20%, 40%, 60%, 80% { transform: translate(calc(-50% + 3px), 0); } }
        @keyframes ovl-rotate-in { from { transform: translate(-50%, 0) rotate(-180deg) scale(0); opacity: 0; } to { transform: translate(-50%, 0) rotate(0) scale(1); opacity: 1; } }
        @keyframes ovl-blur-reveal { from { filter: blur(12px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
        @keyframes ovl-word-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        .ovl-anim-fade { animation: ovl-fade 0.8s ease-out forwards; }
        .ovl-anim-slide_up { animation: ovl-slide-up 0.6s ease-out forwards; }
        .ovl-anim-bounce { animation: ovl-bounce 0.7s ease-out forwards; }
        .ovl-anim-pop { animation: ovl-scale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .ovl-anim-glow { animation: ovl-glow 2s ease-in-out infinite; }
        .ovl-anim-shake { animation: ovl-shake 0.5s ease-in-out; }
        .ovl-anim-rotate_in { animation: ovl-rotate-in 0.6s ease-out forwards; }
        .ovl-anim-blur_reveal { animation: ovl-blur-reveal 0.8s ease-out forwards; }
        .ovl-anim-none { }
      `}</style>

      {/* ══ KEYBOARD SHORTCUTS PANEL ══ */}
      {showShortcuts && <KeyboardShortcutsPanel onClose={() => setShowShortcuts(false)} />}

      {/* ══ CHARACTER PICKER MODAL ══ */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,8,16,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowCharacterPicker(false)}>
          <div style={{ maxWidth: 420, width: "90%" }} onClick={e => e.stopPropagation()}>
            <CharacterPicker
              onSelect={(char) => {
                // Apply character to active scene AND persist across all scenes
                updateAssembly(a => {
                  a.segments.forEach(seg => {
                    if (!seg.characterId) {
                      seg.characterId = char.characterId || char.id;
                      seg.characterName = char.name;
                    }
                  });
                  // Also set on active scene specifically
                  const seg = a.segments[activeSegIdx];
                  if (seg) {
                    seg.characterId = char.characterId || char.id;
                    seg.characterName = char.name;
                  }
                });
                // Add to cast tray if not already present
                const cid = char.characterId || char.id;
                setCastTray(prev => {
                  if (prev.some(c => c.characterId === cid)) return prev;
                  return [...prev, { id: char.id, characterId: cid, name: char.name, imageUrl: char.imageUrl || null, voiceName: char.voiceName || null }];
                });
                setChatLog(p => [...p, { role: "ai", text: `Character "${char.name}" (${char.characterId || char.id}) assigned to scene ${activeSegIdx + 1}. Voice: ${char.voiceName || "default"}${char.visualDescription ? `. Description injected into prompts.` : ""}` }]);
                setShowCharacterPicker(false);
              }}
              onCreateNew={() => { window.open("/dashboard/character-voices", "_blank"); }}
              compact
            />
          </div>
        </div>
      )}

      {/* Character Save Prompt — after video generation */}
      {detectedCharacters.length > 0 && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 350, maxWidth: 500, width: "90%" }}>
          <CharacterSavePrompt
            characters={detectedCharacters}
            projectId={assembly.projectId}
            onSave={(savedIds) => {
              setChatLog(p => [...p, { role: "ai", text: `${savedIds.length} character(s) saved to registry.` }]);
              setDetectedCharacters([]);
            }}
            onDismiss={() => setDetectedCharacters([])}
          />
        </div>
      )}

      {/* Audio Preview — hear voice before committing */}
      {showAudioPreview && audioPreviewText && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 350, maxWidth: 360 }}>
          <AudioPreview
            text={audioPreviewText}
            speakerName={activeSeg?.characterName || "Narrator"}
            style="normal"
            speed={1.0}
            compact
            onApprove={() => { setShowAudioPreview(false); generateNarration(); }}
            onReject={() => setShowAudioPreview(false)}
          />
        </div>
      )}
    </div>
  );
}
