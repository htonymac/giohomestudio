"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/types/content";

// ── Voice option (from /api/voices) ──────────────────────────
interface VoiceOption {
  id: string;
  name: string;
  category?: "man" | "woman" | "boy" | "girl";
  quality?: string;
  accent?: string;
  languages?: string[];
}

// ── Supervisor plan fields we surface in review ───────────────
interface SupervisorPlan {
  inferredSoundEvents?: string[];
  inferredDialogueStructure?: "narration_only" | "dialogue_present" | "mixed";
  inferredSpeakerCount?: number;
  recommendedAudioMode?: string;
  inferredSFXNeed?: boolean;
  environmentType?: string;
  duckingPlan?: string;
  sceneType?: string;
  emotionalTone?: string;
}

// ── Shared voice list (loaded once, shared across all cards) ──
let cachedVoices: VoiceOption[] | null = null;
async function loadVoices(): Promise<VoiceOption[]> {
  if (cachedVoices) return cachedVoices;
  try {
    const res = await fetch("/api/voices");
    const data = await res.json();
    cachedVoices = data.voices ?? [];
    return cachedVoices!;
  } catch { return []; }
}

// ── Music source display labels ───────────────────────────────
const MUSIC_SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  stock:     { label: "stock",     color: "bg-blue-950/60 text-blue-400"   },
  pixabay:   { label: "pixabay",   color: "bg-cyan-950/60 text-cyan-400"   },
  uploaded:  { label: "uploaded",  color: "bg-yellow-950/60 text-yellow-400"},
  generated: { label: "generated", color: "bg-green-950/60 text-green-400" },
  fallback:  { label: "fallback",  color: "bg-orange-950/60 text-orange-400"},
  manual:    { label: "uploaded",  color: "bg-yellow-950/60 text-yellow-400"},
};

type ProviderTier = "real" | "mock" | "stock" | "fallback";
const PROVIDER_META: Record<string, { label: string; tier: ProviderTier }> = {
  runway:        { label: "Runway",         tier: "real"     },
  kling:         { label: "Kling",          tier: "real"     },
  elevenlabs:    { label: "ElevenLabs",     tier: "real"     },
  kie_ai:        { label: "Kie.ai",         tier: "real"     },
  stock_library: { label: "stock",          tier: "stock"    },
  mock_video:    { label: "mock_video",     tier: "fallback" },
  mock_voice:    { label: "mock_voice",     tier: "fallback" },
  mock_music:    { label: "mock_music",     tier: "mock"     },
};
const TIER_STYLE: Record<ProviderTier, string> = {
  real:     "bg-green-900/60 text-green-300 border border-green-800",
  stock:    "bg-blue-900/60 text-blue-300 border border-blue-800",
  mock:     "bg-yellow-900/60 text-yellow-300 border border-yellow-800",
  fallback: "bg-orange-900/60 text-orange-300 border border-orange-800",
};
function ProviderBadge({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  const meta = PROVIDER_META[name] ?? { label: name, tier: "mock" as ProviderTier };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${TIER_STYLE[meta.tier]}`}>
      {meta.label}
    </span>
  );
}

function toMediaUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  const clean = p.replace(/\\/g, "/").replace(/^(\.\/|\/)?storage\//, "");
  return `/api/media/${clean}`;
}

// ── SFX category color ────────────────────────────────────────
const SFX_CATEGORY_STYLE: Record<string, string> = {
  weather: "bg-sky-950/60 text-sky-400 border border-sky-900/50",
  crowd:   "bg-amber-950/60 text-amber-400 border border-amber-900/50",
  action:  "bg-red-950/60 text-red-400 border border-red-900/50",
  nature:  "bg-green-950/60 text-green-400 border border-green-900/50",
  urban:   "bg-slate-800 text-slate-400 border border-slate-700",
  horror:  "bg-purple-950/60 text-purple-400 border border-purple-900/50",
  animal:  "bg-lime-950/60 text-lime-400 border border-lime-900/50",
  vehicle: "bg-zinc-800 text-zinc-400 border border-zinc-700",
};

// Basic SFX event → category mapping (client-side, no DB needed)
const SFX_EVENT_CATEGORIES: Record<string, keyof typeof SFX_CATEGORY_STYLE> = {
  thunder: "weather", rain_light: "weather", rain_heavy: "weather",
  wind: "weather", storm: "weather",
  crowd_cheer: "crowd", crowd_murmur: "crowd", crowd_panic: "crowd",
  gunshot: "action", explosion: "action", sword_clash: "action",
  footsteps: "action", footsteps_run: "action", fire_crackling: "action",
  door_creak: "action", horse_gallop: "action",
  ocean_waves: "nature", forest_ambience: "nature", river_stream: "nature",
  city_traffic: "urban", church_bell: "urban", market_noise: "urban",
  horror_sting: "horror", heartbeat: "horror",
  dog_bark: "animal",
  engine_hum: "vehicle", road_noise: "vehicle", cabin_ambience: "vehicle",
};

// ── Music genre / mood options ────────────────────────────────
const MUSIC_MOODS = [
  "epic", "war", "rain", "calm", "emotional", "action",
  "suspense", "dance", "upbeat", "dramatic", "nature", "heavy_rain",
];
const MUSIC_GENRES = [
  { value: "", label: "Auto" },
  { value: "cinematic", label: "Cinematic" },
  { value: "orchestral", label: "Orchestral" },
  { value: "ambient", label: "Ambient" },
  { value: "electronic", label: "Electronic" },
  { value: "acoustic", label: "Acoustic" },
  { value: "hip_hop", label: "Hip-Hop" },
];

// ── Voice language options with honest support labels ─────────
const VOICE_LANGUAGES = [
  { value: "",   label: "Auto-detect" },
  { value: "en", label: "English", supported: true },
  { value: "es", label: "Spanish", supported: true },
  { value: "fr", label: "French",  supported: true },
  { value: "de", label: "German",  supported: true },
  { value: "pt", label: "Portuguese", supported: true },
  { value: "ar", label: "Arabic",  supported: true },
  { value: "hi", label: "Hindi",   supported: true },
  { value: "it", label: "Italian", supported: true },
  { value: "pl", label: "Polish",  supported: true },
  { value: "yo", label: "Yoruba (partial — quality varies)", supported: false },
  { value: "ig", label: "Igbo (partial — quality varies)",   supported: false },
  { value: "ha", label: "Hausa (partial — quality varies)",  supported: false },
  { value: "sw", label: "Swahili", supported: true },
  { value: "zu", label: "Zulu (partial — quality varies)",   supported: false },
  { value: "pidgin", label: "Nigerian Pidgin (best effort — use English model)", supported: false },
];

// ── Voice category filter labels ──────────────────────────────
type VoiceCategory = "all" | "man" | "woman" | "boy" | "girl";
const VOICE_CAT_LABELS: Record<VoiceCategory, string> = {
  all: "All", man: "Man", woman: "Woman", boy: "Boy", girl: "Girl",
};

function ReviewCard({
  item,
  onAction,
  actionLoading,
  onItemUpdated,
}: {
  item: ContentItem;
  onAction: (id: string, action: "approve" | "reject", note?: string) => void;
  actionLoading: string | null;
  onItemUpdated?: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const videoUrl = toMediaUrl(item.mergedOutputPath);
  const voiceUrl  = toMediaUrl(item.voicePath);
  const musicUrl  = toMediaUrl(item.musicPath);

  // Extract supervisor plan data
  const plan = (item.supervisorPlan ?? {}) as SupervisorPlan;
  const sfxEvents = plan.inferredSoundEvents ?? [];
  const dialogueStructure = plan.inferredDialogueStructure ?? "narration_only";
  const speakerCount = plan.inferredSpeakerCount ?? 1;
  const isMultiVoice = dialogueStructure !== "narration_only" || speakerCount > 1;

  // ── Volume controls ──────────────────────────────────────────
  const [narrationVol, setNarrationVol] = useState(item.narrationVolume ?? 1.0);
  const [musicVol, setMusicVol]         = useState(item.musicVolume ?? 0.85);
  const [showMixPanel, setShowMixPanel] = useState(false);
  const [mixSaving, setMixSaving]       = useState(false);
  const [mixMsg, setMixMsg]             = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSaveMix() {
    setMixSaving(true);
    setMixMsg(null);
    const res = await fetch(`/api/content/${item.id}/remerge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceVolume: narrationVol, musicVolume: musicVol }),
    });
    const data = await res.json();
    setMixSaving(false);
    if (res.ok) {
      setMixMsg({ ok: true, text: "Mix re-applied" });
      onItemUpdated?.();
    } else {
      setMixMsg({ ok: false, text: data.error ?? "Failed" });
    }
  }

  // ── Voice editor ─────────────────────────────────────────────
  const [showVoiceEditor, setShowVoiceEditor] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceId, setVoiceId] = useState(item.voiceId ?? "");
  const [voiceLang, setVoiceLang] = useState(item.voiceLanguage ?? "");
  const [narration, setNarration] = useState(item.narrationScript ?? item.originalInput ?? "");
  const [narrationSpeed, setNarrationSpeed] = useState(item.narrationSpeed ?? 1.0);
  const [voiceCategory, setVoiceCategory] = useState<VoiceCategory>("all");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenMsg, setRegenMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const uploadVoiceRef = useRef<HTMLInputElement>(null);
  const [uploadVoiceLoading, setUploadVoiceLoading] = useState(false);
  // Voice preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (showVoiceEditor && voices.length === 0) {
      loadVoices().then(setVoices);
    }
  }, [showVoiceEditor]);

  const filteredVoices = voices.filter(v =>
    voiceCategory === "all" || v.category === voiceCategory
  );

  async function handleVoicePreview() {
    if (!voiceId) return;
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        // Auto-play when ready
        setTimeout(() => previewAudioRef.current?.play(), 100);
      } else {
        setRegenMsg({ ok: false, text: "Preview not available (ElevenLabs key needed)" });
      }
    } catch {
      setRegenMsg({ ok: false, text: "Preview failed" });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRegenVoice() {
    setRegenLoading(true);
    setRegenMsg(null);
    const res = await fetch(`/api/content/${item.id}/regenerate-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        narrationScript: narration.trim() || undefined,
        voiceId: voiceId || undefined,
        voiceLanguage: voiceLang || undefined,
        narrationSpeed: narrationSpeed !== 1.0 ? narrationSpeed : undefined,
      }),
    });
    const data = await res.json();
    setRegenLoading(false);
    if (res.ok) {
      setRegenMsg({ ok: true, text: "Voice regenerated + re-merged" });
      onItemUpdated?.();
    } else {
      setRegenMsg({ ok: false, text: data.error ?? "Failed" });
    }
  }

  async function handleUploadVoice(file: File) {
    setUploadVoiceLoading(true);
    setRegenMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/content/${item.id}/upload-voice`, { method: "POST", body: form });
    const data = await res.json();
    setUploadVoiceLoading(false);
    if (res.ok) {
      setRegenMsg({ ok: true, text: "Voice replaced + re-merged" });
      onItemUpdated?.();
    } else {
      setRegenMsg({ ok: false, text: data.error ?? "Upload failed" });
    }
  }

  // ── Music editor ─────────────────────────────────────────────
  const [showMusicEditor, setShowMusicEditor] = useState(false);
  const [musicMood, setMusicMood] = useState(item.musicGenre ?? "epic");
  const [musicGenreEdit, setMusicGenreEdit] = useState(item.musicGenre ?? "");
  const [regenMusicLoading, setRegenMusicLoading] = useState(false);
  const [musicMsg, setMusicMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const uploadMusicRef = useRef<HTMLInputElement>(null);
  const [uploadMusicLoading, setUploadMusicLoading] = useState(false);
  const musicFileName = item.musicPath
    ? item.musicPath.replace(/\\/g, "/").split("/").pop()
    : null;
  const musicSourceMeta = item.musicSource
    ? (MUSIC_SOURCE_LABELS[item.musicSource] ?? { label: item.musicSource, color: "bg-gray-800 text-gray-400" })
    : null;

  async function handleRegenMusic() {
    setRegenMusicLoading(true);
    setMusicMsg(null);
    const res = await fetch(`/api/content/${item.id}/regenerate-music`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood: musicMood || "epic",
        genre: musicGenreEdit || undefined,
      }),
    });
    const data = await res.json();
    setRegenMusicLoading(false);
    if (res.ok) {
      setMusicMsg({ ok: true, text: "Music replaced" });
      onItemUpdated?.();
    } else {
      setMusicMsg({ ok: false, text: data.error ?? "Failed" });
    }
  }

  async function handleUploadMusic(file: File) {
    setUploadMusicLoading(true);
    setMusicMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/content/${item.id}/upload-music`, { method: "POST", body: form });
    const data = await res.json();
    setUploadMusicLoading(false);
    if (res.ok) {
      setMusicMsg({ ok: true, text: "Music uploaded + re-merged" });
      onItemUpdated?.();
    } else {
      setMusicMsg({ ok: false, text: data.error ?? "Upload failed" });
    }
  }

  // ── SFX panel ────────────────────────────────────────────────
  const [showSFXPanel, setShowSFXPanel] = useState(false);
  const [sfxRemergeLoading, setSFXRemergeLoading] = useState(false);
  const [sfxMsg, setSFXMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleRemergeNoSFX() {
    setSFXRemergeLoading(true);
    setSFXMsg(null);
    const res = await fetch(`/api/content/${item.id}/remerge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setSFXRemergeLoading(false);
    if (res.ok) {
      setSFXMsg({ ok: true, text: "Re-merged (SFX layer removed)" });
      onItemUpdated?.();
    } else {
      setSFXMsg({ ok: false, text: data.error ?? "Failed" });
    }
  }

  // ── Dialogue panel ────────────────────────────────────────────
  const [showDialoguePanel, setShowDialoguePanel] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Video preview — aspect-ratio-aware, click to open detail */}
      {(() => {
        const ar = (item.aspectRatio as string) ?? "9:16";
        const arCss = ar === "16:9" ? "16/9" : ar === "1:1" ? "1/1" : "9/16";
        const isPortrait = ar === "9:16";
        return (
          <div
            className="cursor-pointer relative overflow-hidden bg-black"
            style={{
              aspectRatio: arCss,
              maxHeight: isPortrait ? 360 : undefined,
            }}
            onClick={() => router.push(`/dashboard/content/${item.id}`)}
            title="Click to open full detail page"
          >
            <span className="absolute top-2 left-2 z-10 text-[10px] font-mono bg-black/60 text-white/70 px-1.5 py-0.5 rounded">
              {ar}
            </span>
            {/* Audio-only mode badge */}
            {(item.outputMode === "text_to_audio" || item.audioMode === "audio_only") && (
              <span className="absolute top-2 right-2 z-10 text-[10px] font-mono bg-indigo-900/80 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded">
                audio-only
              </span>
            )}
            {videoUrl ? (
              <video
                src={videoUrl}
                className="w-full h-full object-contain pointer-events-none"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                {item.mergedOutputPath ? "File missing — click to inspect" : "No output yet"}
              </div>
            )}
          </div>
        );
      })()}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 font-mono truncate mb-0.5">{item.id}</p>
            <p
              className="text-white font-medium text-sm cursor-pointer hover:text-blue-300 transition-colors"
              onClick={() => router.push(`/dashboard/content/${item.id}`)}
            >
              {item.originalInput}
            </p>
          </div>
          <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded shrink-0">
            IN_REVIEW
          </span>
        </div>

        {/* Destination */}
        {item.destinationPage && (
          <p className="text-xs text-gray-500 mb-2">
            → {item.destinationPage.name}
            <span className="text-gray-700 ml-1">({item.destinationPage.platform})</span>
          </p>
        )}

        {/* Provider badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {item.requestedVideoProvider && item.requestedVideoProvider !== item.videoProvider ? (
            <span className="flex items-center gap-1">
              <ProviderBadge name={item.requestedVideoProvider} />
              <span className="text-gray-600 text-xs">→</span>
              <ProviderBadge name={item.videoProvider} />
            </span>
          ) : (
            <ProviderBadge name={item.videoProvider} />
          )}
          <ProviderBadge name={item.voiceProvider} />
          {item.requestedMusicProvider && item.requestedMusicProvider !== item.musicProvider ? (
            <span className="flex items-center gap-1">
              <ProviderBadge name={item.requestedMusicProvider} />
              <span className="text-gray-600 text-xs">→</span>
              <ProviderBadge name={item.musicProvider} />
            </span>
          ) : (
            <ProviderBadge name={item.musicProvider} />
          )}
        </div>

        {/* Audio tags */}
        {(item.audioMode || item.voiceId || item.voiceLanguage || item.narrationSpeed != null ||
          item.narrationVolume != null || item.musicVolume != null || item.musicGenre || item.musicRegion) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.audioMode && item.audioMode !== "voice_music" && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                item.audioMode === "voice_only"
                  ? "bg-blue-950/60 text-blue-400"
                  : "bg-purple-950/60 text-purple-400"
              }`}>
                {item.audioMode.replace(/_/g, "-")}
              </span>
            )}
            {item.voiceId && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono" title={`Voice ID: ${item.voiceId}`}>
                voice:{item.voiceId.slice(0, 8)}…
              </span>
            )}
            {item.voiceLanguage && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                lang:{item.voiceLanguage}
              </span>
            )}
            {item.narrationSpeed != null && item.narrationSpeed !== 1.0 && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {item.narrationSpeed.toFixed(2)}×
              </span>
            )}
            {item.narrationVolume != null && item.narrationVolume !== 1.0 && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                narr:{Math.round(item.narrationVolume * 100)}%
              </span>
            )}
            {item.musicGenre && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {item.musicGenre.replace("_", "-")}
              </span>
            )}
            {item.musicRegion && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {item.musicRegion.replace("_", "-")}
              </span>
            )}
            {item.musicVolume != null && item.musicVolume !== 0.85 && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                mvol:{Math.round(item.musicVolume * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Identity tags */}
        {(item.castingEthnicity || item.castingGender || item.castingAge || item.cultureContext) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.castingEthnicity && (
              <span className="text-xs bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 px-1.5 py-0.5 rounded font-mono">
                {item.castingEthnicity}
              </span>
            )}
            {item.castingGender && (
              <span className="text-xs bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 px-1.5 py-0.5 rounded font-mono">
                {item.castingGender}
              </span>
            )}
            {item.castingAge && (
              <span className="text-xs bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 px-1.5 py-0.5 rounded font-mono">
                {item.castingAge.replace("_", " ")}
              </span>
            )}
            {item.cultureContext && (
              <span className="text-xs bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 px-1.5 py-0.5 rounded font-mono">
                {item.cultureContext}
              </span>
            )}
          </div>
        )}

        {/* Control tags */}
        {(item.videoType || item.visualStyle || item.videoQuality) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.videoType && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {item.videoType.replace("_", " ")}
              </span>
            )}
            {item.visualStyle && (
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {item.visualStyle.replace("_", " ")}
              </span>
            )}
            {item.videoQuality && item.videoQuality !== "standard" && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                item.videoQuality === "draft"
                  ? "bg-yellow-950/60 text-yellow-500"
                  : "bg-blue-950/60 text-blue-400"
              }`}>
                {item.videoQuality}
              </span>
            )}
          </div>
        )}

        {/* Supervisor scene context (if available) */}
        {(plan.sceneType || plan.emotionalTone || plan.duckingPlan) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {plan.sceneType && (
              <span className="text-xs bg-violet-950/50 text-violet-400 border border-violet-900/40 px-1.5 py-0.5 rounded font-mono">
                scene:{plan.sceneType}
              </span>
            )}
            {plan.emotionalTone && (
              <span className="text-xs bg-rose-950/50 text-rose-400 border border-rose-900/40 px-1.5 py-0.5 rounded font-mono">
                tone:{plan.emotionalTone}
              </span>
            )}
            {plan.duckingPlan && plan.duckingPlan !== "none" && (
              <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded font-mono">
                duck:{plan.duckingPlan}
              </span>
            )}
          </div>
        )}

        {/* Voice audio preview */}
        {voiceUrl && (
          <div className="mb-2">
            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1.5">
              Voice preview
              {item.voiceSource && (
                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                  item.voiceSource === "generated" ? "bg-green-950/60 text-green-500" :
                  item.voiceSource === "uploaded"  ? "bg-yellow-950/60 text-yellow-500" :
                  "bg-gray-800 text-gray-600"
                }`}>{item.voiceSource}</span>
              )}
            </p>
            <audio src={voiceUrl} controls className="w-full" preload="metadata" style={{ height: 30 }} />
          </div>
        )}

        {/* Music preview */}
        {musicUrl && (
          <div className="mb-2">
            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1.5">
              Music preview
              {musicSourceMeta && (
                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${musicSourceMeta.color}`}>
                  {musicSourceMeta.label}
                </span>
              )}
              {musicFileName && (
                <span className="text-gray-700 font-mono text-[10px] truncate max-w-[120px]">
                  {musicFileName}
                </span>
              )}
            </p>
            <audio src={musicUrl} controls className="w-full" preload="metadata" style={{ height: 30 }} />
          </div>
        )}

        {/* ── Mix / Volume panel ─────────────────────────────── */}
        <div className="mb-2">
          <button
            onClick={() => setShowMixPanel(v => !v)}
            className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>🎚</span>
              <span>Volume mix — narration & music</span>
            </span>
            <span>{showMixPanel ? "▲" : "▼"}</span>
          </button>

          {showMixPanel && (
            <div className="mt-1 border border-gray-800 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Narration: {Math.round(narrationVol * 100)}%
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={narrationVol}
                  onChange={e => setNarrationVol(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Music: {Math.round(musicVol * 100)}%
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={musicVol}
                  onChange={e => setMusicVol(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleSaveMix}
                  disabled={mixSaving}
                  className="text-xs bg-indigo-900/70 hover:bg-indigo-800/70 text-indigo-300 border border-indigo-800/60 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {mixSaving ? "Applying…" : "↻ Re-merge with new mix"}
                </button>
                {mixMsg && (
                  <span className={`text-xs ${mixMsg.ok ? "text-green-400" : "text-red-400"}`}>
                    {mixMsg.ok ? "✓ " : "✗ "}{mixMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Voice editor panel ─────────────────────────────── */}
        <div className="mb-2">
          <button
            onClick={() => setShowVoiceEditor(v => !v)}
            className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>🎙</span>
              <span>Voice — narration, speed, language</span>
              {item.voiceProvider && (
                <span className="text-gray-700 font-mono">({item.voiceProvider})</span>
              )}
            </span>
            <span>{showVoiceEditor ? "▲" : "▼"}</span>
          </button>

          {showVoiceEditor && (
            <div className="mt-1 border border-gray-800 rounded-lg overflow-hidden">
              {/* Narration text */}
              <div className="p-3 border-b border-gray-800/60">
                <label className="text-xs text-gray-600 block mb-1.5">Narration script</label>
                <textarea
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-600 resize-none"
                  placeholder="What the voice says…"
                />
                <p className="text-[10px] text-gray-700 mt-1">
                  For multi-speaker dialogue, use: NARRATOR: text / JOHN: "quote" / [SFX: thunder]
                </p>
              </div>

              {/* Speed */}
              <div className="p-3 border-b border-gray-800/60">
                <label className="text-xs text-gray-600 block mb-1">
                  Speech speed: {narrationSpeed.toFixed(2)}×
                  <span className="text-gray-700 ml-2">(0.7 = slow · 1.0 = normal · 1.2 = fast)</span>
                </label>
                <input
                  type="range" min={0.7} max={1.2} step={0.05}
                  value={narrationSpeed}
                  onChange={e => setNarrationSpeed(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Voice category filter + voice selector */}
              <div className="p-3 border-b border-gray-800/60">
                <label className="text-xs text-gray-600 block mb-1.5">Voice</label>
                {/* Category chips */}
                <div className="flex gap-1 flex-wrap mb-2">
                  {(Object.keys(VOICE_CAT_LABELS) as VoiceCategory[]).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setVoiceCategory(cat)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        voiceCategory === cat
                          ? "bg-indigo-900 text-indigo-300 border-indigo-700"
                          : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      {VOICE_CAT_LABELS[cat]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select
                    value={voiceId}
                    onChange={e => { setVoiceId(e.target.value); setPreviewUrl(null); }}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Default (Sarah — woman)</option>
                    {filteredVoices.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.category ? ` (${v.category})` : ""}{v.quality ? ` · ${v.quality}` : ""}{v.accent ? ` · ${v.accent}` : ""}
                      </option>
                    ))}
                    {filteredVoices.length === 0 && voices.length > 0 && (
                      <option disabled>No voices in this category</option>
                    )}
                    {voices.length === 0 && <option disabled>Loading…</option>}
                  </select>
                  {/* Preview voice sample */}
                  {voiceId && (
                    <button
                      onClick={handleVoicePreview}
                      disabled={previewLoading}
                      title="Preview this voice (requires ElevenLabs key)"
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 px-2 py-1.5 rounded transition-colors disabled:opacity-50 shrink-0"
                    >
                      {previewLoading ? "…" : "▶ Sample"}
                    </button>
                  )}
                </div>
                {/* Voice preview audio */}
                {previewUrl && (
                  <div className="mt-2">
                    <audio ref={previewAudioRef} src={previewUrl} controls className="w-full" style={{ height: 28 }} />
                  </div>
                )}
              </div>

              {/* Language */}
              <div className="p-3 border-b border-gray-800/60">
                <label className="text-xs text-gray-600 block mb-1">Language / Dialect</label>
                <select
                  value={voiceLang}
                  onChange={e => setVoiceLang(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-600"
                >
                  {VOICE_LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>
                      {l.label}{l.supported === false ? "" : ""}
                    </option>
                  ))}
                </select>
                {voiceLang && VOICE_LANGUAGES.find(l => l.value === voiceLang)?.supported === false && (
                  <p className="text-[10px] text-yellow-600 mt-1">
                    This language has partial support only. Quality may vary. ElevenLabs multilingual model will be used.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="p-3 flex gap-2 items-center flex-wrap">
                <button
                  onClick={handleRegenVoice}
                  disabled={regenLoading}
                  className="text-xs bg-indigo-900/70 hover:bg-indigo-800/70 text-indigo-300 border border-indigo-800/60 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {regenLoading ? "Regenerating…" : "↻ Regenerate voice"}
                </button>
                <button
                  onClick={() => uploadVoiceRef.current?.click()}
                  disabled={uploadVoiceLoading}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {uploadVoiceLoading ? "Uploading…" : "↑ Upload audio"}
                </button>
                <input
                  ref={uploadVoiceRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadVoice(f); }}
                />
                {regenMsg && (
                  <span className={`text-xs ${regenMsg.ok ? "text-green-400" : "text-red-400"}`}>
                    {regenMsg.ok ? "✓ " : "✗ "}{regenMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Music editor panel ─────────────────────────────── */}
        <div className="mb-2">
          <button
            onClick={() => setShowMusicEditor(v => !v)}
            className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>🎵</span>
              <span>Music — change, upload, or replace</span>
              {musicSourceMeta && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${musicSourceMeta.color}`}>
                  {musicSourceMeta.label}
                </span>
              )}
            </span>
            <span>{showMusicEditor ? "▲" : "▼"}</span>
          </button>

          {showMusicEditor && (
            <div className="mt-1 border border-gray-800 rounded-lg overflow-hidden">
              {/* Current music info */}
              {item.musicPath && (
                <div className="p-3 border-b border-gray-800/60 bg-gray-800/30">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-700 uppercase tracking-wide">Current:</span>
                    {musicSourceMeta && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${musicSourceMeta.color}`}>
                        {musicSourceMeta.label}
                      </span>
                    )}
                    {musicFileName && (
                      <span className="text-[10px] text-gray-600 font-mono truncate max-w-[160px]">{musicFileName}</span>
                    )}
                    {item.musicProvider && (
                      <ProviderBadge name={item.musicProvider} />
                    )}
                  </div>
                </div>
              )}

              {/* Mood selector */}
              <div className="p-3 border-b border-gray-800/60">
                <label className="text-xs text-gray-600 block mb-1.5">Mood for new music</label>
                <div className="flex flex-wrap gap-1">
                  {MUSIC_MOODS.map(m => (
                    <button
                      key={m}
                      onClick={() => setMusicMood(m)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors capitalize ${
                        musicMood === m
                          ? "bg-pink-900/70 text-pink-300 border-pink-800"
                          : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      {m.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre selector */}
              <div className="p-3 border-b border-gray-800/60">
                <label className="text-xs text-gray-600 block mb-1">Genre (optional)</label>
                <select
                  value={musicGenreEdit}
                  onChange={e => setMusicGenreEdit(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-pink-600"
                >
                  {MUSIC_GENRES.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="p-3 flex gap-2 items-center flex-wrap">
                <button
                  onClick={handleRegenMusic}
                  disabled={regenMusicLoading}
                  className="text-xs bg-pink-900/70 hover:bg-pink-800/70 text-pink-300 border border-pink-800/60 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {regenMusicLoading ? "Fetching…" : "↻ Get new music track"}
                </button>
                <button
                  onClick={() => uploadMusicRef.current?.click()}
                  disabled={uploadMusicLoading}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {uploadMusicLoading ? "Uploading…" : "↑ Upload track"}
                </button>
                <input
                  ref={uploadMusicRef}
                  type="file"
                  accept=".mp3,.wav,.aac,.m4a"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadMusic(f); }}
                />
                {musicMsg && (
                  <span className={`text-xs ${musicMsg.ok ? "text-green-400" : "text-red-400"}`}>
                    {musicMsg.ok ? "✓ " : "✗ "}{musicMsg.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SFX / Environment panel ────────────────────────── */}
        {(sfxEvents.length > 0 || plan.inferredSFXNeed) && (
          <div className="mb-2">
            <button
              onClick={() => setShowSFXPanel(v => !v)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>🔊</span>
                <span>SFX / Environment</span>
                {sfxEvents.length > 0 && (
                  <span className="bg-sky-950/70 text-sky-400 border border-sky-900/50 text-[10px] px-1.5 py-0.5 rounded font-mono">
                    {sfxEvents.length} detected
                  </span>
                )}
              </span>
              <span>{showSFXPanel ? "▲" : "▼"}</span>
            </button>

            {showSFXPanel && (
              <div className="mt-1 border border-gray-800 rounded-lg p-3 space-y-3">
                {sfxEvents.length > 0 ? (
                  <>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1.5">
                        Supervisor detected these sound events:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {sfxEvents.map(event => {
                          const cat = SFX_EVENT_CATEGORIES[event] ?? "action";
                          return (
                            <span
                              key={event}
                              className={`text-[10px] px-2 py-0.5 rounded font-mono ${SFX_CATEGORY_STYLE[cat] ?? "bg-gray-800 text-gray-400"}`}
                            >
                              {event.replace(/_/g, " ")}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {plan.environmentType && (
                      <p className="text-[10px] text-gray-600">
                        Environment: <span className="text-gray-400">{plan.environmentType}</span>
                      </p>
                    )}
                    <div className="flex gap-2 items-center flex-wrap">
                      <button
                        onClick={handleRemergeNoSFX}
                        disabled={sfxRemergeLoading}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                      >
                        {sfxRemergeLoading ? "Processing…" : "↻ Re-merge without SFX"}
                      </button>
                      {sfxMsg && (
                        <span className={`text-xs ${sfxMsg.ok ? "text-green-400" : "text-red-400"}`}>
                          {sfxMsg.ok ? "✓ " : "✗ "}{sfxMsg.text}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-700">
                      SFX files are in storage/sfx/. Drop MP3 files with matching names to activate each event.
                      To add SFX back, re-generate from Studio with SFX enabled.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-600">
                    Supervisor flagged SFX need but could not detect specific events from this prompt.
                    You can re-generate from Studio with explicit SFX tags in the narration script.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Dialogue / Multi-voice panel ─────────────────────── */}
        {isMultiVoice && (
          <div className="mb-2">
            <button
              onClick={() => setShowDialoguePanel(v => !v)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>👥</span>
                <span>Multi-voice dialogue</span>
                <span className="text-[10px] bg-violet-950/60 text-violet-400 border border-violet-900/50 px-1.5 py-0.5 rounded font-mono">
                  {speakerCount} speaker{speakerCount !== 1 ? "s" : ""}
                </span>
              </span>
              <span>{showDialoguePanel ? "▲" : "▼"}</span>
            </button>

            {showDialoguePanel && (
              <div className="mt-1 border border-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] text-gray-600 uppercase tracking-wide block mb-0.5">Structure</span>
                    <span className="text-xs text-violet-300 font-mono">
                      {dialogueStructure.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-600 uppercase tracking-wide block mb-0.5">Speakers</span>
                    <span className="text-xs text-violet-300 font-mono">{speakerCount}</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600">
                  Multi-voice dialogue uses character voice registry. Assign voices in{" "}
                  <button
                    onClick={() => router.push("/dashboard/character-voices")}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Character Voices →
                  </button>
                </p>
                <p className="text-[10px] text-gray-600">
                  To use dialogue format in narration script:
                  <code className="ml-1 bg-gray-800 px-1 rounded">NARRATOR: text</code> /
                  <code className="ml-1 bg-gray-800 px-1 rounded">JOHN: "quote"</code> /
                  <code className="ml-1 bg-gray-800 px-1 rounded">JOHN [whisper]: "text"</code>
                </p>
                <button
                  onClick={handleRegenVoice}
                  disabled={regenLoading}
                  className="text-xs bg-violet-900/70 hover:bg-violet-800/70 text-violet-300 border border-violet-800/60 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {regenLoading ? "Regenerating…" : "↻ Re-generate multi-voice narration"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* View full details link */}
        <button
          onClick={() => router.push(`/dashboard/content/${item.id}`)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors mb-3 block"
        >
          View full details, version history, audio tracks →
        </button>

        {/* Actions */}
        {showRejectInput ? (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Rejection reason (optional)"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-700 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onAction(item.id, "reject", note || undefined);
                  setShowRejectInput(false);
                  setNote("");
                }}
                disabled={actionLoading === item.id}
                className="flex-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => { setShowRejectInput(false); setNote(""); }}
                className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onAction(item.id, "approve")}
              disabled={actionLoading === item.id}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {actionLoading === item.id ? "Processing..." : "Approve"}
            </button>
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={actionLoading === item.id}
              className="flex-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentlyActioned, setRecentlyActioned] = useState<{ id: string; action: "approved" | "rejected" }[]>([]);

  async function fetchQueue() {
    setLoading(true);
    const res = await fetch("/api/review");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchQueue(); }, []);

  async function handleAction(id: string, action: "approve" | "reject", note?: string) {
    setActionLoading(id);
    await fetch(`/api/review/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setRecentlyActioned((prev) => [...prev, { id, action: action === "approve" ? "approved" : "rejected" }]);
    await fetchQueue();
    setActionLoading(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Review Queue</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Audio finishing desk — edit narration, voice, music, SFX before approving
          </p>
        </div>
        <button
          onClick={fetchQueue}
          className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Recently actioned */}
      {recentlyActioned.length > 0 && (
        <div className="mb-6 space-y-2">
          {recentlyActioned.map(({ id, action }) => (
            <div
              key={id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                action === "approved"
                  ? "bg-green-900/30 border-green-800 text-green-300"
                  : "bg-red-900/30 border-red-800 text-red-300"
              }`}
            >
              <span>
                {action === "approved" ? "✓ Approved" : "✗ Rejected"} —{" "}
                <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
              </span>
              <button
                onClick={() => router.push(`/dashboard/content/${id}`)}
                className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                View details →
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && items.length === 0 && recentlyActioned.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg">No items pending review.</p>
          <p className="text-sm mt-1">Generate content from the Studio to see it here.</p>
        </div>
      )}

      {!loading && items.length === 0 && recentlyActioned.length > 0 && (
        <div className="text-center py-8 text-gray-600">
          <p className="text-sm">Queue is empty. Use the links above to view your actioned items.</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            onAction={handleAction}
            onItemUpdated={fetchQueue}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </div>
  );
}
