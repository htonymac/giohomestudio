"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { DestinationPage } from "@/types/content";
import type { SpeechStyle, ElevenLabsModel } from "@/types/providers";
import type { OutputMode } from "@/modules/timeline/types";
import NarrationPanel from "../components/NarrationPanel";
import { DEFAULT_NARRATION_SETTINGS, type NarrationSettings } from "@/modules/voice-provider/accent-profiles";

interface ContinuationSuggestion {
  id: string;
  label: string;
  description: string;
  storyContext: string;
  promptSeed: string;
  keepCasting: boolean;
  keepVoice: boolean;
}

interface VoiceOption {
  id: string;
  name: string;
}

interface RegisteredCharacter {
  id: string;
  name: string;
  role: string | null;
  imageUrl: string | null;
  isNarrator: boolean;
  voiceId: string | null;
  voiceName: string | null;
  defaultSpeechStyle: string | null;
  visualDescription: string | null;
  language?: string | null;
}

// ── Static cost estimates (credits/USD approximations) ────────
const COST_ESTIMATES: Record<string, Record<string, string>> = {
  runway:     { draft: "free (mock)", standard: "~$0.05–0.10", high: "~$0.10–0.25" },
  kling:      { draft: "free (mock)", standard: "~$0.08–0.15", high: "~$0.15–0.30" },
  mock_video: { draft: "free",        standard: "free (mock)",  high: "free (mock)"  },
};

function getCostEstimate(provider: string, quality: string): string {
  const p = provider || "runway";
  return COST_ESTIMATES[p]?.[quality] ?? "—";
}

const OUTPUT_MODES: { id: OutputMode; label: string; icon: string; desc: string; live: boolean }[] = [
  { id: "text_to_video",  label: "Text → Video",   icon: "🎬", desc: "AI generates full video clips",            live: true  },
  { id: "text_to_audio",  label: "Text → Audio",   icon: "🎙", desc: "Narration + dialogue + music only",        live: true  },
  { id: "images_audio",   label: "Images + Audio",  icon: "🖼", desc: "Still images synced to narration",         live: true  },
  { id: "image_to_video", label: "Image → Video",   icon: "🎭", desc: "Animate a saved character or uploaded image", live: true },
  { id: "hybrid",         label: "Hybrid",          icon: "⚡", desc: "Video for key scenes, images for rest",    live: true  },
  { id: "video_to_video", label: "Video → Video",   icon: "🔄", desc: "Transform an existing video",              live: true  },
];

export default function StudioPage() {
  const searchParams = useSearchParams();

  const [input, setInput] = useState("");
  const [reviseFromId, setReviseFromId] = useState<string | null>(null);

  // Core controls
  const [outputMode, setOutputMode] = useState<OutputMode>("text_to_video");

  const [duration, setDuration] = useState(5);
  const [videoProvider, setVideoProvider] = useState<"runway" | "kling" | "">("");
  const [videoQuality, setVideoQuality] = useState<"draft" | "standard" | "high">("standard");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [aiAutoMode, setAiAutoMode] = useState(true);

  // Style controls
  const [videoType, setVideoType] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [customSubjectDescription, setCustomSubjectDescription] = useState("");

  // Casting & Identity
  const [castingEthnicity, setCastingEthnicity] = useState("");
  const [castingGender, setCastingGender] = useState("");
  const [castingAge, setCastingAge] = useState("");
  const [castingCount, setCastingCount] = useState("");
  const [cultureContext, setCultureContext] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");

  // Audio mode
  const [audioMode, setAudioMode] = useState<"voice_music" | "voice_only" | "music_only" | "audio_only">("voice_music");

  // Speech style override
  const [speechStyle, setSpeechStyle] = useState<SpeechStyle | "">("");

  // Voice controls
  const [requestedVoiceProvider, setRequestedVoiceProvider] = useState<"" | "elevenlabs" | "mock_voice">("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("");
  const [voiceModel, setVoiceModel] = useState<ElevenLabsModel | ("")>("");
  const [narrationSpeed, setNarrationSpeed] = useState(1.0);
  const [narrationVolume, setNarrationVolume] = useState(1.0);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voiceDemoLoading, setVoiceDemoLoading] = useState(false);
  const [registryVoices, setRegistryVoices] = useState<RegisteredCharacter[]>([]);
  const [voicePickerFilter, setVoicePickerFilter] = useState<"all" | "narrator">("narrator");

  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [narrationSettings, setNarrationSettings] = useState<NarrationSettings>(DEFAULT_NARRATION_SETTINGS);

  // Music controls
  const [musicMood, setMusicMood] = useState("epic");
  const [musicProvider, setMusicProvider] = useState<"" | "stock_library" | "mock_music">("");
  const [musicGenre, setMusicGenre] = useState("");
  const [musicRegion, setMusicRegion] = useState("");
  const [musicVolume, setMusicVolume] = useState(0.85);

  // Destination
  const [destinationPageId, setDestinationPageId] = useState("");
  const [pages, setPages] = useState<DestinationPage[]>([]);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // ── Story continuation ────────────────────────────────────
  const [continueFromId, setContinueFromId] = useState<string | null>(null);
  const [continueFromInput, setContinueFromInput] = useState<string>("");
  const [storyContext, setStoryContext] = useState("");
  const [storyThreadId, setStoryThreadId] = useState<string | undefined>(undefined);
  const [continuationSuggestions, setContinuationSuggestions] = useState<ContinuationSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // ── Supervisor preview ────────────────────────────────────
  const [supervisorPreview, setSupervisorPreview] = useState<Record<string, unknown> | null>(null);
  const [supervisorLoading, setSupervisorLoading] = useState(false);

  // ── Translation ───────────────────────────────────────────
  const [translateLang, setTranslateLang] = useState("fr");
  const [translateLoading, setTranslateLoading] = useState(false);

  // ── Video-to-video source ─────────────────────────────────
  const [v2vFile, setV2vFile] = useState<File | null>(null);
  const [v2vPath, setV2vPath] = useState<string>("");
  const [v2vUploading, setV2vUploading] = useState(false);

  // ── Image-to-video source ─────────────────────────────────
  // selectedI2vChar: character picked from registry (reuse saved image)
  const [selectedI2vChar, setSelectedI2vChar] = useState<RegisteredCharacter | null>(null);
  const [i2vLocalUpload, setI2vLocalUpload] = useState<{ name: string; path: string } | null>(null);
  const [i2vLocalUploading, setI2vLocalUploading] = useState(false);
  const [imageActionPrompt, setImageActionPrompt] = useState("");

  // ── Character casting preview ─────────────────────────────
  const [castChars, setCastChars] = useState<RegisteredCharacter[]>([]);
  const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
  const [castingConfirmed, setCastingConfirmed] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // ── Revise flow — pre-fill form from existing item ────────────
  const loadReviseItem = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/registry/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const item = data.item;
      if (!item) return;

      setReviseFromId(id);
      setInput(item.originalInput ?? "");
      setDuration(item.durationSeconds ?? 5);
      setVideoQuality((item.videoQuality as "draft" | "standard" | "high") ?? "standard");
      setAspectRatio((item.aspectRatio as "9:16" | "16:9" | "1:1") ?? "9:16");
      setVideoProvider((item.requestedVideoProvider as "runway" | "kling" | "") ?? "");
      setAiAutoMode(item.aiAutoMode !== false);
      setVideoType(item.videoType ?? "");
      setVisualStyle(item.visualStyle ?? "");
      setSubjectType(item.subjectType ?? "");
      setCustomSubjectDescription(item.customSubjectDescription ?? "");
      setCastingEthnicity(item.castingEthnicity ?? "");
      setCastingGender(item.castingGender ?? "");
      setCastingAge(item.castingAge ?? "");
      setCastingCount(item.castingCount ?? "");
      setCultureContext(item.cultureContext ?? "");
      setReferenceImageUrl(item.referenceImageUrl ?? "");
      setAudioMode((item.audioMode as "voice_music" | "voice_only" | "music_only" | "audio_only") ?? "voice_music");
      setRequestedVoiceProvider((item.requestedVoiceProvider as "" | "elevenlabs" | "mock_voice") ?? "");
      setVoiceId(item.voiceId ?? "");
      setVoiceLanguage(item.voiceLanguage ?? "");
      setVoiceModel((item.voiceModel as typeof voiceModel) ?? "");
      setNarrationSpeed(item.narrationSpeed ?? 1.0);
      setNarrationVolume(item.narrationVolume ?? 1.0);
      setMusicProvider((item.requestedMusicProvider as "" | "stock_library" | "mock_music") ?? "");
      setMusicGenre(item.musicGenre ?? "");
      setMusicRegion(item.musicRegion ?? "");
      setMusicVolume(item.musicVolume ?? 0.85);
      setDestinationPageId(item.destinationPageId ?? "");
    } catch {
      // silently ignore — revise is best-effort
    }
  }, []);

  useEffect(() => {
    const reviseId = searchParams.get("revise");
    if (reviseId) loadReviseItem(reviseId);
    const continueId = searchParams.get("continue");
    if (continueId) {
      loadContinueItem(continueId);
      const seed = searchParams.get("promptSeed");
      if (seed) setInput(seed);
    }
  }, [searchParams, loadReviseItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear i2v selections when leaving image_to_video mode
  useEffect(() => {
    if (outputMode !== "image_to_video") {
      setSelectedI2vChar(null);
      setI2vLocalUpload(null);
      setImageActionPrompt("");
    }
  }, [outputMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync audioMode when output mode changes
  useEffect(() => {
    if (outputMode === "text_to_audio") {
      setAudioMode("audio_only");
    } else if (audioMode === "audio_only") {
      setAudioMode("voice_music");
    }
  }, [outputMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/destination-pages")
      .then((r) => r.json())
      .then((d) => setPages(d.pages ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => {
        setVoices(d.voices ?? []);
        setVoicesLoading(false);
      })
      .catch(() => setVoicesLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/character-voices")
      .then((r) => r.json())
      .then((d) => setRegistryVoices(d.voices ?? []))
      .catch(() => {});
  }, []);

  async function loadContinueItem(id: string) {
    try {
      setSuggestionsLoading(true);
      const [itemRes, suggestRes] = await Promise.all([
        fetch(`/api/registry/${id}`),
        fetch(`/api/content/${id}/suggest-continuation`, { method: "POST" }),
      ]);
      if (!itemRes.ok) return;
      const itemData = await itemRes.json();
      const item = itemData.item;
      if (!item) return;

      setContinueFromId(id);
      setContinueFromInput(item.originalInput ?? "");

      // Carry settings from the source scene
      if (item.castingEthnicity) setCastingEthnicity(item.castingEthnicity);
      if (item.castingGender)    setCastingGender(item.castingGender);
      if (item.castingAge)       setCastingAge(item.castingAge);
      if (item.cultureContext)   setCultureContext(item.cultureContext);
      if (item.aspectRatio)      setAspectRatio(item.aspectRatio);
      if (item.visualStyle)      setVisualStyle(item.visualStyle);
      if (item.voiceId)          setVoiceId(item.voiceId);
      if (item.voiceLanguage)    setVoiceLanguage(item.voiceLanguage);
      if (item.audioMode)        setAudioMode(item.audioMode as "voice_music" | "voice_only" | "music_only" | "audio_only");

      if (suggestRes.ok) {
        const suggestData = await suggestRes.json();
        setContinuationSuggestions(suggestData.suggestions ?? []);
        if (suggestData.sourceSettings?.storyThreadId) {
          setStoryThreadId(suggestData.sourceSettings.storyThreadId);
        }
      }
    } catch {
      // best-effort
    } finally {
      setSuggestionsLoading(false);
    }
  }

  function applySuggestion(s: ContinuationSuggestion, source: { voiceId?: string; castingEthnicity?: string; castingGender?: string; castingAge?: string }) {
    setInput(s.promptSeed);
    setStoryContext(s.storyContext);
    if (!s.keepVoice) setVoiceId("");
    if (!s.keepCasting) {
      setCastingEthnicity("");
      setCastingGender("");
      setCastingAge("");
    }
  }

  async function handleVoiceDemo() {
    const id = voiceId || "EXAVITQu4vr4xnSDxMaL"; // fallback to Sarah
    setVoiceDemoLoading(true);
    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: id, language: voiceLanguage || undefined }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setVoiceDemoLoading(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setVoiceDemoLoading(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch { setVoiceDemoLoading(false); }
  }

  async function handlePreviewPlan() {
    if (!input.trim()) return;
    setSupervisorLoading(true);
    setSupervisorPreview(null);
    try {
      const res = await fetch("/api/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPrompt: input.trim(),
          overrides: {
            videoType: videoType || undefined,
            visualStyle: visualStyle || undefined,
            aspectRatio,
            musicMood: musicMood || undefined,
            musicGenre: musicGenre || undefined,
            castingEthnicity: castingEthnicity || undefined,
            cultureContext: cultureContext || undefined,
            audioMode,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSupervisorPreview(data.plan);
        setCastChars(registryVoices);
        setSelectedCharIds(new Set(registryVoices.map(c => c.id)));
        setCastingConfirmed(false);
        setShowQuickAdd(false);
      }
    } catch {}
    setSupervisorLoading(false);
  }

  async function handleTranslate() {
    if (!input.trim()) return;
    setTranslateLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim(), targetLanguage: translateLang }),
      });
      const data = await res.json();
      if (res.ok && data.translated) setInput(data.translated);
    } catch {}
    setTranslateLoading(false);
  }

  async function handleV2vUpload(file: File) {
    setV2vUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v2v/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setV2vFile(file);
        setV2vPath(data.filePath);
      }
    } catch {}
    setV2vUploading(false);
  }

  async function handleI2vLocalUpload(file: File) {
    setI2vLocalUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v2v/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setI2vLocalUpload({ name: file.name, path: data.filePath });
        setSelectedI2vChar(null);
      }
    } catch {}
    setI2vLocalUploading(false);
  }

  // Resolve the final reference image URL for the pipeline.
  // Priority for image_to_video: saved character → one-time upload → manual field.
  function resolveReferenceImage(): string | undefined {
    if (outputMode === "image_to_video") {
      if (selectedI2vChar?.imageUrl) return selectedI2vChar.imageUrl;
      if (i2vLocalUpload?.path) return i2vLocalUpload.path;
    }
    return referenceImageUrl.trim() || undefined;
  }

  async function handleGenerate() {
    const effectiveInput = input.trim() || (outputMode === "image_to_video" ? imageActionPrompt.trim() : "");
    if (!effectiveInput) return;
    if (outputMode === "image_to_video" && !selectedI2vChar?.imageUrl && !i2vLocalUpload?.path) {
      setStatus("error");
      setMessage("Pick a saved character or upload an image to use Image → Video mode.");
      return;
    }
    if (outputMode === "video_to_video" && !v2vPath) {
      setStatus("error");
      setMessage("Please upload a source video for Video → Video mode.");
      return;
    }
    setStatus("loading");
    setMessage("");

    try {
      const body: Record<string, unknown> = {
        rawInput: effectiveInput,
        outputMode,
        durationSeconds: duration,
        aspectRatio,
        destinationPageId: destinationPageId || undefined,
        // core
        videoProvider: videoProvider || undefined,
        videoQuality,
        aiAutoMode,
        // style
        videoType: videoType || undefined,
        visualStyle: visualStyle || undefined,
        subjectType: subjectType || undefined,
        customSubjectDescription: subjectType === "custom_character" ? customSubjectDescription || undefined : undefined,
        // casting / identity
        castingEthnicity: castingEthnicity || undefined,
        castingGender: castingGender || undefined,
        castingAge: castingAge || undefined,
        castingCount: castingCount || undefined,
        cultureContext: cultureContext || undefined,
        referenceImageUrl: resolveReferenceImage(),
        // image-to-video
        imageActionPrompt: imageActionPrompt.trim() || undefined,
        // audio mode
        audioMode,
        // voice
        speechStyle: speechStyle || undefined,
        requestedVoiceProvider: requestedVoiceProvider || undefined,
        // If a voice was designed/chosen via NarrationPanel, use it; else fall back to the manual dropdown selection
        voiceId: (narrationEnabled && narrationSettings.voiceId) ? narrationSettings.voiceId : (voiceId || undefined),
        voiceLanguage: voiceLanguage || undefined,
        voiceModel: voiceModel || undefined,
        narrationSpeed: narrationSpeed !== 1.0 ? narrationSpeed : undefined,
        narrationVolume: narrationVolume !== 1.0 ? narrationVolume : undefined,
        ...(narrationEnabled && {
          accentLocale: narrationSettings.locale,
          accentDeliveryStyle: narrationSettings.deliveryStyle,
          accentSpeakerProfile: narrationSettings.speakerProfile,
        }),
        // music
        musicMood,
        musicProvider: musicProvider || undefined,
        musicGenre: musicGenre || undefined,
        musicRegion: musicRegion || undefined,
        musicVolume,
        // Story continuation
        storyContext: storyContext.trim() || undefined,
        previousContentItemId: continueFromId ?? undefined,
        storyThreadId: storyThreadId ?? undefined,
        // Video-to-video source
        sourceVideoPath: v2vPath || undefined,
        // Character casting — names of selected characters from registry
        castingCharacters: castChars.length > 0
          ? castChars.filter(c => selectedCharIds.has(c.id)).map(c => c.name)
          : undefined,
      };

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setStatus("success");
        const verb = reviseFromId ? "Revision" : "Pipeline";
        setMessage(`${verb} started. Your content is being generated. Check the Review tab when ready.`);
        setInput("");
        setReviseFromId(null);
        setContinueFromId(null);
        setContinueFromInput("");
        setStoryContext("");
        setContinuationSuggestions([]);
        setSupervisorPreview(null);
        setCastChars([]);
        setSelectedCharIds(new Set());
        setCastingConfirmed(false);
      } else {
        const err = await res.json();
        setStatus("error");
        setMessage(err.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Is the server running?");
    }
  }

  const selectCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600";
  const labelCls = "block text-xs text-gray-400 mb-1 font-medium";
  const pctLabel = (val: number) => `${Math.round(val * 100)}%`;

  const voiceDisabled = audioMode === "music_only";
  const musicDisabled = audioMode === "voice_only";
  const identityActive = !!(castingEthnicity || castingGender || castingAge || castingCount || cultureContext);
  const charsWithImages = registryVoices.filter(c => c.imageUrl);
  const charsWithoutImages = registryVoices.filter(c => !c.imageUrl);

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-white mb-1">Studio</h1>

      {/* ── Output mode selector ──────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: "#3a3a5a", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
          Output Mode
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {OUTPUT_MODES.map(m => {
            const active = outputMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => m.live && setOutputMode(m.id)}
                title={m.live ? m.desc : `${m.desc} — coming soon`}
                style={{
                  background: active ? "#7c5cfc22" : "#0f0f1a",
                  border: `1px solid ${active ? "#7c5cfc" : "#1e1e38"}`,
                  borderRadius: 10,
                  padding: "10px 8px",
                  cursor: m.live ? "pointer" : "default",
                  opacity: m.live ? 1 : 0.45,
                  textAlign: "center",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <p style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: active ? "#a080ff" : "#7070a0", lineHeight: 1.2 }}>{m.label}</p>
                {!m.live && <p style={{ fontSize: 9, color: "#3a3a5a", marginTop: 2 }}>Soon</p>}
              </button>
            );
          })}
        </div>
        {outputMode === "text_to_audio" && (
          <p style={{ fontSize: 11, color: "#60a5fa", marginTop: 8, background: "#0d1a2e", border: "1px solid #1a3a5a", borderRadius: 6, padding: "6px 12px" }}>
            Audio-only mode — video controls are hidden. Output will be MP3/WAV narration with music and SFX.
          </p>
        )}
      </div>

      {/* ── Story continuation banner ──────────────────────── */}
      {continueFromId ? (
        <div style={{ background: "#1a1a2e", border: "1px solid #7c5cfc44", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p style={{ color: "#7c5cfc", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                ◈ Continuing a story
              </p>
              <p style={{ color: "#9090b0", fontSize: 12 }}>
                From: <span style={{ color: "#c0c0e0" }}>&ldquo;{continueFromInput.slice(0, 80)}{continueFromInput.length > 80 ? "…" : ""}&rdquo;</span>
              </p>
            </div>
            <button
              onClick={() => { setContinueFromId(null); setContinueFromInput(""); setStoryContext(""); setContinuationSuggestions([]); }}
              style={{ color: "#5a5a7a", fontSize: 12, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              ✕ Start fresh
            </button>
          </div>

          {/* Supervisor suggestion chips */}
          {suggestionsLoading ? (
            <p style={{ color: "#5a5a7a", fontSize: 12, marginTop: 12 }}>Loading story suggestions…</p>
          ) : continuationSuggestions.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ color: "#5a5a7a", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Supervisor suggests — click to continue:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {continuationSuggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => applySuggestion(s, { voiceId, castingEthnicity, castingGender, castingAge })}
                    title={s.description}
                    style={{
                      background: storyContext === s.storyContext ? "#7c5cfc22" : "#12121a",
                      border: `1px solid ${storyContext === s.storyContext ? "#7c5cfc" : "#2a2a40"}`,
                      color: storyContext === s.storyContext ? "#a080ff" : "#9090b0",
                      borderRadius: 7,
                      padding: "6px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Story context display / edit */}
          {storyContext && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, color: "#5a5a7a", display: "block", marginBottom: 4 }}>
                Story context (what the AI knows about what happened before):
              </label>
              <textarea
                value={storyContext}
                onChange={e => setStoryContext(e.target.value)}
                rows={3}
                style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: 7, padding: "8px 10px", color: "#a0a0c0", fontSize: 12, resize: "vertical" }}
              />
            </div>
          )}
        </div>
      ) : reviseFromId ? (
        <p className="text-yellow-400 text-sm mb-6 bg-yellow-950/30 border border-yellow-900/40 rounded-lg px-3 py-2">
          Revising item <span className="font-mono">{reviseFromId.slice(0, 8)}…</span> — settings pre-filled from original. Edit and generate to create a new version.
        </p>
      ) : (
        <p className="text-gray-500 mb-6 text-sm">
          Describe your idea. GioHomeStudio will enhance your prompt and generate a video, voice, and music track.
        </p>
      )}

      <div className="space-y-5">

        {/* Idea input */}
        <div>
          <label className={labelCls}>
            {outputMode === "image_to_video"
              ? "Context / narration for this scene (optional)"
              : "Your idea"}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={outputMode === "image_to_video"
              ? "Optional — add narration or story context for this scene..."
              : "e.g. A cat flying off a cliff at golden hour..."}
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none text-sm"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#4a4a6a" }}>Translate to:</span>
            <select
              value={translateLang}
              onChange={e => setTranslateLang(e.target.value)}
              style={{ background: "#0f0f1a", border: "1px solid #2a2a40", color: "#8080a0", borderRadius: 4, padding: "2px 6px", fontSize: 11 }}
            >
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
              <option value="yo">Yoruba</option>
              <option value="ha">Hausa</option>
              <option value="ig">Igbo</option>
              <option value="sw">Swahili</option>
              <option value="pcm">Pidgin</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
            </select>
            <button
              onClick={handleTranslate}
              disabled={translateLoading || !input.trim()}
              style={{
                background: "#1a2a3a", border: "1px solid #1e3a5a", color: "#60a0e0",
                borderRadius: 4, padding: "2px 10px", fontSize: 11, cursor: "pointer",
                opacity: translateLoading || !input.trim() ? 0.5 : 1,
              }}
            >
              {translateLoading ? "Translating…" : "Translate Script"}
            </button>
          </div>
        </div>

        {/* Video-to-video source upload */}
        {outputMode === "video_to_video" && (
          <div style={{ background: "#0d1525", border: "1px solid #1a3a5a", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#60a0e0", marginBottom: 8 }}>Source Video (required)</p>
            {v2vPath ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#4ade80" }}>✓ {v2vFile?.name}</span>
                <button
                  onClick={() => { setV2vFile(null); setV2vPath(""); }}
                  style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer" }}
                >✕ Remove</button>
              </div>
            ) : (
              <label style={{ cursor: "pointer", display: "block" }}>
                <div style={{
                  border: "1px dashed #1a3a5a", borderRadius: 8, padding: "18px 0",
                  textAlign: "center", color: "#4a6a8a", fontSize: 12,
                  background: v2vUploading ? "#0a1a2a" : "transparent",
                }}>
                  {v2vUploading ? "Uploading…" : "Click to upload your source video (MP4, MOV, WebM)"}
                </div>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleV2vUpload(f); }}
                />
              </label>
            )}
            <p style={{ fontSize: 10, color: "#3a5a7a", marginTop: 6 }}>
              The pipeline will use this video directly — no AI generation — and add your narration and music on top.
            </p>
          </div>
        )}

        {/* ── Image → Video: character/image source picker ── */}
        {outputMode === "image_to_video" && (
          <div style={{ background: "#0d1a10", border: "1px solid #1a4a24", borderRadius: 10, padding: "16px 18px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 4 }}>
              🎭 Image → Video — Character Source
            </p>
            <p style={{ fontSize: 11, color: "#3a6a44", marginBottom: 14 }}>
              Pick a saved character to reuse their image — no upload needed. Or upload a one-time image below.
            </p>

            {/* Saved characters with images */}
            {charsWithImages.length > 0 ? (
              <div>
                <p style={{ fontSize: 10, color: "#3a6a44", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Saved characters — click to reuse
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                  {charsWithImages.map(c => {
                    const active = selectedI2vChar?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedI2vChar(active ? null : c);
                          setI2vLocalFile(null);
                          setI2vLocalPath("");
                          // Also wire voice identity + speech style
                          if (!active) {
                            if (c.voiceId) {
                              setVoiceId(c.voiceId);
                              if (outputMode !== "text_to_audio") setAudioMode("voice_music");
                            }
                            if (c.language) setVoiceLanguage(c.language);
                            if (c.defaultSpeechStyle) setSpeechStyle(c.defaultSpeechStyle as SpeechStyle);
                          }
                        }}
                        title={c.visualDescription ?? c.name}
                        style={{
                          background: active ? "#0a2a10" : "#0d1a10",
                          border: `2px solid ${active ? "#4ade80" : "#1a4a24"}`,
                          borderRadius: 10,
                          padding: 6,
                          cursor: "pointer",
                          width: 90,
                          textAlign: "center",
                          transition: "border-color 0.15s",
                        }}
                      >
                        <img
                          src={`/api/media/file?path=${encodeURIComponent(c.imageUrl!)}`}
                          alt={c.name}
                          style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 6, display: "block", margin: "0 auto 4px" }}
                          onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3Crect width='70' height='70' fill='%231a2a1a'/%3E%3Ctext x='35' y='42' text-anchor='middle' font-size='24' fill='%234a6a4a'%3E👤%3C/text%3E%3C/svg%3E"; }}
                        />
                        <p style={{ fontSize: 10, color: active ? "#4ade80" : "#5a8a5a", lineHeight: 1.2, wordBreak: "break-word" }}>{c.name}</p>
                        <p style={{ fontSize: 9, color: "#3a5a3a", marginTop: 1 }}>{c.role ?? (c.isNarrator ? "narrator" : "")}</p>
                        {active && <p style={{ fontSize: 9, color: "#4ade80", marginTop: 2 }}>✓ selected</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#3a5a3a", marginBottom: 12 }}>
                No saved characters with images yet.{" "}
                <a href="/dashboard/character-voices" style={{ color: "#4ade80", textDecoration: "underline" }}>
                  Add one in the Character & Voice Registry →
                </a>
              </p>
            )}

            {/* Also show characters without images with a hint */}
            {charsWithoutImages.length > 0 && (
              <p style={{ fontSize: 10, color: "#2a4a2a", marginBottom: 10 }}>
                {charsWithoutImages.length} character(s) in registry have no image yet —
                <a href="/dashboard/character-voices" style={{ color: "#3a8a4a", marginLeft: 4, textDecoration: "underline" }}>
                  open registry to add images
                </a>
              </p>
            )}

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#1a3a1a" }} />
              <span style={{ fontSize: 10, color: "#2a4a2a" }}>or upload for this session only</span>
              <div style={{ flex: 1, height: 1, background: "#1a3a1a" }} />
            </div>

            {/* One-time local upload */}
            {i2vLocalUpload ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#4ade80" }}>✓ {i2vLocalUpload.name}</span>
                <button
                  onClick={() => setI2vLocalUpload(null)}
                  style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer" }}
                >✕ Remove</button>
              </div>
            ) : (
              <label style={{ cursor: "pointer", display: "block", marginBottom: 12 }}>
                <div style={{
                  border: "1px dashed #1a4a24", borderRadius: 8, padding: "14px 0",
                  textAlign: "center", color: "#3a6a44", fontSize: 12,
                  background: i2vLocalUploading ? "#0a1a0a" : "transparent",
                }}>
                  {i2vLocalUploading ? "Uploading…" : "Click to upload a one-time image (JPG, PNG, WebP) — not saved to library"}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleI2vLocalUpload(f); }}
                />
              </label>
            )}

            {/* Action prompt */}
            <div>
              <label style={{ fontSize: 11, color: "#3a6a44", display: "block", marginBottom: 4 }}>
                Action prompt — what should this character do?
              </label>
              <textarea
                value={imageActionPrompt}
                onChange={e => setImageActionPrompt(e.target.value)}
                rows={2}
                placeholder="e.g. make her turn slowly and smile at the camera, make him draw his sword, make them walk forward with confidence"
                style={{
                  width: "100%", background: "#0a1a0a", border: "1px solid #1a4a24",
                  borderRadius: 7, padding: "8px 10px", color: "#c0ffc0", fontSize: 12,
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Active selection summary */}
            {(selectedI2vChar || i2vLocalUpload) && (
              <div style={{ marginTop: 12, background: "#0a2a10", border: "1px solid #2a5a2a", borderRadius: 7, padding: "10px 12px" }}>
                <p style={{ fontSize: 10, color: "#4ade80", fontWeight: 600, marginBottom: 4 }}>
                  {selectedI2vChar ? `Using saved character: ${selectedI2vChar.name}` : `Using uploaded image: ${i2vLocalUpload!.name}`}
                </p>
                {selectedI2vChar?.visualDescription && (
                  <p style={{ fontSize: 11, color: "#5a9a6a", marginBottom: 4 }}>
                    {selectedI2vChar.visualDescription}
                  </p>
                )}
                {selectedI2vChar?.voiceName && (
                  <p style={{ fontSize: 10, color: "#3a7a4a" }}>Voice: {selectedI2vChar.voiceName}</p>
                )}
              </div>
            )}

            {!selectedI2vChar && !i2vLocalUpload && (
              <p style={{ fontSize: 10, color: "#f87171", marginTop: 8 }}>
                ⚠ Select a character above or upload an image to continue
              </p>
            )}
          </div>
        )}

        {/* ── Core ── */}
        <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Core</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className={labelCls}>Duration</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={selectCls}>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
              </select>
            </div>
            {outputMode !== "text_to_audio" && (
              <div>
                <label className={labelCls} title="Output format: 9:16 portrait for Reels/Shorts, 16:9 landscape for YouTube, 1:1 square for Instagram feed.">
                  Output format
                </label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")} className={selectCls}>
                  <option value="9:16">9:16 — Portrait (Reels / Shorts)</option>
                  <option value="16:9">16:9 — Landscape (YouTube)</option>
                  <option value="1:1">1:1 — Square (Instagram)</option>
                </select>
              </div>
            )}
            {outputMode === "text_to_video" && (
              <>
                <div>
                  <label className={labelCls} title="Runway and Kling are real AI video APIs. Auto selects based on VIDEO_PROVIDER env var.">Video provider</label>
                  <select value={videoProvider} onChange={(e) => setVideoProvider(e.target.value as "runway" | "kling" | "")} className={selectCls}>
                    <option value="">Auto</option>
                    <option value="runway">Runway</option>
                    <option value="kling">Kling</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} title="Draft uses mock video — no API credits. High requests 10s from the provider.">Video quality</label>
                  <select value={videoQuality} onChange={(e) => setVideoQuality(e.target.value as "draft" | "standard" | "high")} className={selectCls}>
                    <option value="draft">Draft (mock — fast)</option>
                    <option value="standard">Standard</option>
                    <option value="high">High (10s clip)</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className={labelCls} title="On: full cinematic prompt enhancement. Off: minimal changes to your raw text.">AI auto mode</label>
              <select value={aiAutoMode ? "on" : "off"} onChange={(e) => setAiAutoMode(e.target.value === "on")} className={selectCls}>
                <option value="on">On — full enhancement</option>
                <option value="off">Off — minimal changes</option>
              </select>
            </div>
          </div>
          {/* Cost estimate — only for video modes */}
          {outputMode === "text_to_video" && (
            <p className="text-xs text-gray-700 mt-3">
              Estimated cost: <span className="text-gray-500">{getCostEstimate(videoProvider, videoQuality)}</span>
              <span className="text-gray-700 ml-2">+ ElevenLabs voice ~$0.002/char · Music: free (stock/mock)</span>
            </p>
          )}
        </div>

        {/* ── Style — hidden for audio-only mode ── */}
        {outputMode !== "text_to_audio" && <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Style</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} title="Sets the opening cinematic prefix injected before your raw prompt.">Video type</label>
              <select value={videoType} onChange={(e) => setVideoType(e.target.value)} className={selectCls}>
                <option value="">— Any —</option>
                <option value="cinematic">Cinematic</option>
                <option value="ad_promo">Ad / Promo</option>
                <option value="realistic">Realistic</option>
                <option value="animation">Animation</option>
                <option value="storytelling">Storytelling</option>
                <option value="social_short">Social Short</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Injected as a style descriptor after your main prompt.">Visual style</label>
              <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} className={selectCls}>
                <option value="">— Any —</option>
                <option value="photorealistic">Photorealistic</option>
                <option value="stylized">Stylized</option>
                <option value="anime">Anime</option>
                <option value="3d">3D</option>
                <option value="cinematic_dark">Cinematic Dark</option>
                <option value="bright_commercial">Bright Commercial</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Custom character overrides this with a free-text description.">Subject / actor type</label>
              <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)} className={selectCls}>
                <option value="">— Any —</option>
                <option value="human">Human</option>
                <option value="animal">Animal</option>
                <option value="product">Product</option>
                <option value="scene_only">Scene only</option>
                <option value="custom_character">Custom character</option>
              </select>
            </div>
            {subjectType === "custom_character" && (
              <div className="col-span-2 md:col-span-3">
                <label className={labelCls}>Custom character description</label>
                <input
                  type="text"
                  value={customSubjectDescription}
                  onChange={(e) => setCustomSubjectDescription(e.target.value)}
                  placeholder="e.g. a tall woman in red armor with silver hair"
                  maxLength={200}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>
        </div>}

        {/* ── Casting & Identity ── */}
        <div className={`border rounded-xl p-4 ${identityActive ? "border-indigo-800/60 bg-indigo-950/10" : "border-gray-800"}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Casting & Identity</p>
            {identityActive && (
              <span className="text-xs text-indigo-400 bg-indigo-950/40 border border-indigo-800/50 px-2 py-0.5 rounded">
                Identity signals active — will be injected first in prompt
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Set to control who appears in the video. These signals are injected before your idea text so AI models receive a clear casting directive.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelCls} title="Ethnicity of the main subject. Injected as the first descriptor in the enhanced prompt to prevent AI from defaulting to generic western appearances.">
                Ethnicity
              </label>
              <select value={castingEthnicity} onChange={(e) => setCastingEthnicity(e.target.value)} className={selectCls}>
                <option value="">— Not set (AI decides) —</option>
                <option value="african">African (Black African)</option>
                <option value="black">Black</option>
                <option value="white">White / Caucasian</option>
                <option value="asian">Asian (East Asian)</option>
                <option value="arab">Arab / Middle Eastern</option>
                <option value="mixed">Mixed race</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Gender of the main subject.">Gender</label>
              <select value={castingGender} onChange={(e) => setCastingGender(e.target.value)} className={selectCls}>
                <option value="">— Not set —</option>
                <option value="female">Female (woman)</option>
                <option value="male">Male (man)</option>
                <option value="nonbinary">Non-binary (person)</option>
                <option value="mixed_gender">Mixed (people)</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Age group of the main subject.">Age group</label>
              <select value={castingAge} onChange={(e) => setCastingAge(e.target.value)} className={selectCls}>
                <option value="">— Not set —</option>
                <option value="young_adult">Young adult</option>
                <option value="adult">Adult</option>
                <option value="teen">Teenager</option>
                <option value="senior">Elderly / Senior</option>
                <option value="child">Child</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="How many people appear — solo, duo, group, or crowd.">Cast size</label>
              <select value={castingCount} onChange={(e) => setCastingCount(e.target.value)} className={selectCls}>
                <option value="">— Not set —</option>
                <option value="solo">Solo (one person)</option>
                <option value="duo">Duo (two people)</option>
                <option value="group">Group</option>
                <option value="crowd">Crowd</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Cultural setting and environment to be injected. Controls background, props, and world context.">Cultural context</label>
              <select value={cultureContext} onChange={(e) => setCultureContext(e.target.value)} className={selectCls}>
                <option value="">— Not set —</option>
                <option value="african">African</option>
                <option value="arab">Arab / Middle Eastern</option>
                <option value="asian">Asian</option>
                <option value="latin">Latin American</option>
                <option value="western">Western</option>
                <option value="global">Global / Universal</option>
              </select>
            </div>
            <div>
              <label className={labelCls} title="Paste a URL to a reference image. Used as a visual consistency hint in the prompt.">
                Reference image URL
              </label>
              <div className="flex gap-2 items-start">
                <input
                  type="text"
                  value={referenceImageUrl}
                  onChange={(e) => setReferenceImageUrl(e.target.value)}
                  placeholder="https://… or local path — or pick a character above to auto-fill"
                  maxLength={500}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
                {referenceImageUrl && (
                  <img
                    src={referenceImageUrl.startsWith("http") ? referenceImageUrl : `/api/media/file?path=${encodeURIComponent(referenceImageUrl)}`}
                    alt="Reference"
                    className="w-9 h-9 object-cover rounded border border-gray-700 flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    onLoad={e => { (e.target as HTMLImageElement).style.display = "block"; }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Live preview of identity descriptor */}
          {identityActive && (
            <div className="mt-2 bg-indigo-950/30 border border-indigo-800/40 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-0.5">Prompt injection preview:</p>
              <p className="text-indigo-300 text-xs font-mono">
                {[
                  castingCount === "solo" ? "a single" : castingCount === "duo" ? "two" : castingCount === "group" ? "a group of" : castingCount === "crowd" ? "a large crowd of" : "a",
                  castingAge === "child" ? "young child" : castingAge === "teen" ? "teenager" : castingAge === "young_adult" ? "young adult" : castingAge === "adult" ? "adult" : castingAge === "senior" ? "elderly person" : "",
                  castingEthnicity === "african" ? "Black African" : castingEthnicity === "black" ? "Black" : castingEthnicity === "white" ? "White Caucasian" : castingEthnicity === "asian" ? "East Asian" : castingEthnicity === "arab" ? "Arab Middle Eastern" : castingEthnicity === "mixed" ? "mixed-race" : "",
                  castingGender === "male" ? "man" : castingGender === "female" ? "woman" : castingGender === "nonbinary" ? "person" : castingGender === "mixed_gender" ? "people" : "person",
                ].filter(Boolean).join(" ")}
                {cultureContext ? ` — in ${cultureContext} setting` : ""}
              </p>
            </div>
          )}
        </div>

        {/* ── Audio ── */}
        <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Audio</p>

          {/* Audio mode */}
          <div className="mb-4">
            <label className={labelCls} title="voice_music: both generated · voice_only: no music · music_only: no narration · audio_only: no video, pure audio output">Audio mode</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([
                ["voice_music",  "Voice + Music"],
                ["voice_only",   "Voice only"],
                ["music_only",   "Music only"],
                ["audio_only",   "Audio only"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAudioMode(mode)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    audioMode === mode
                      ? "bg-blue-700 border-blue-600 text-white"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {audioMode === "audio_only" && (
              <p className="text-xs text-amber-600/80 mt-1.5">Audio only — voice + music merged without video. No video generation costs.</p>
            )}
          </div>

          {/* Voice subsection */}
          <div className={`mb-4 ${voiceDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              Voice
              {voiceDisabled && <span className="text-orange-600 normal-case tracking-normal">(skipped — music only mode)</span>}
            </p>

            {/* ── Character voice picker from registry ── */}
            {registryVoices.length > 0 && (
              <div className="mb-3 bg-gray-950 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">Pick from registry</p>
                  <div className="flex gap-1">
                    {(["narrator", "all"] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setVoicePickerFilter(f)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${voicePickerFilter === f ? "bg-indigo-900/50 border-indigo-700 text-indigo-300" : "bg-transparent border-gray-700 text-gray-500"}`}
                      >
                        {f === "narrator" ? "Narrators" : "All"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {registryVoices
                    .filter(c => voicePickerFilter === "all" || c.isNarrator)
                    .map(c => {
                      const isSelected = voiceId === (c.voiceId ?? "");
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setVoiceId(c.voiceId ?? "");
                            if (c.language) setVoiceLanguage(c.language);
                            if (c.defaultSpeechStyle) setSpeechStyle(c.defaultSpeechStyle as SpeechStyle);
                            if (c.voiceId && outputMode !== "text_to_audio") setAudioMode("voice_music");
                            // Auto-populate reference image when the character has one saved
                            if (c.imageUrl) setReferenceImageUrl(c.imageUrl);
                          }}
                          title={c.voiceId ? `Voice ID: ${c.voiceId}` : "No voice ID set — assign one in Voice Registry first"}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            isSelected
                              ? "bg-indigo-900/60 border-indigo-600 text-indigo-200"
                              : c.voiceId
                              ? "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                              : "bg-gray-950 border-gray-800 text-gray-700 cursor-not-allowed"
                          }`}
                        >
                          {c.isNarrator ? "🎙 " : ""}{c.name}
                          {!c.voiceId && <span className="ml-1 text-gray-700">·no ID</span>}
                        </button>
                      );
                    })}
                </div>
                {voiceId && (
                  <button
                    type="button"
                    onClick={() => setVoiceId("")}
                    className="text-xs text-gray-600 mt-2 hover:text-gray-400 transition-colors"
                  >
                    ✕ Clear selection
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              <div>
                <label className={labelCls}>Voice provider</label>
                <select value={requestedVoiceProvider} onChange={(e) => setRequestedVoiceProvider(e.target.value as "" | "elevenlabs" | "mock_voice")} className={selectCls}>
                  <option value="">Auto (ElevenLabs if key set)</option>
                  <option value="elevenlabs">ElevenLabs (force)</option>
                  <option value="mock_voice">Mock voice (test)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>ElevenLabs model</label>
                <select value={voiceModel} onChange={(e) => setVoiceModel(e.target.value as typeof voiceModel)} className={selectCls}>
                  <option value="">Auto (language-driven)</option>
                  <option value="eleven_multilingual_v2">Multilingual v2 — highest quality</option>
                  <option value="eleven_turbo_v2_5">Turbo v2.5 — fast + multilingual</option>
                  <option value="eleven_flash_v2_5">Flash v2.5 — fastest, cheapest</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Voice (ElevenLabs ID override)</label>
                {voicesLoading ? (
                  <div className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-600 text-sm">
                    Loading voices...
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={`${selectCls} flex-1`}>
                      <option value="">— Default (Sarah) —</option>
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleVoiceDemo}
                      disabled={voiceDemoLoading || voiceDisabled}
                      title={voiceLanguage ? `Demo in: ${voiceLanguage}` : "Demo voice (English)"}
                      className="flex-none text-xs px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {voiceDemoLoading ? "…" : "▶"}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls} title="Non-English routes ElevenLabs to turbo_v2_5 model with explicit language_code. English stays on multilingual_v2.">Language</label>
                <select value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} className={selectCls}>
                  <option value="">— Auto-detect —</option>
                  <optgroup label="Major languages">
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="pt">Portuguese</option>
                    <option value="it">Italian</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese (Mandarin)</option>
                    <option value="ar">Arabic</option>
                    <option value="hi">Hindi</option>
                    <option value="ru">Russian</option>
                    <option value="nl">Dutch</option>
                    <option value="pl">Polish</option>
                    <option value="tr">Turkish</option>
                    <option value="id">Indonesian</option>
                  </optgroup>
                  <optgroup label="African languages (turbo_v2_5)">
                    <option value="sw">Swahili</option>
                    <option value="yo">Yoruba</option>
                    <option value="ig">Igbo</option>
                    <option value="ha">Hausa</option>
                    <option value="am">Amharic</option>
                    <option value="zu">Zulu</option>
                    <option value="xh">Xhosa</option>
                    <option value="af">Afrikaans</option>
                    <option value="so">Somali</option>
                    <option value="sn">Shona</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="vi">Vietnamese</option>
                    <option value="th">Thai</option>
                    <option value="uk">Ukrainian</option>
                    <option value="ro">Romanian</option>
                    <option value="cs">Czech</option>
                    <option value="hu">Hungarian</option>
                    <option value="fi">Finnish</option>
                    <option value="sv">Swedish</option>
                    <option value="da">Danish</option>
                    <option value="no">Norwegian</option>
                    <option value="el">Greek</option>
                    <option value="he">Hebrew</option>
                    <option value="bn">Bengali</option>
                    <option value="ms">Malay</option>
                    <option value="tl">Filipino (Tagalog)</option>
                  </optgroup>
                </select>
              </div>
            </div>
            {/* Speech style override */}
            <div className="mb-3">
              <label className={labelCls} title="Override the AI supervisor's detected speech style. Controls ElevenLabs voice_settings: whisper lowers stability, emotional raises expressiveness, commanding increases stability.">
                Speech style <span className="text-gray-700 font-normal">(leave blank for AI to decide)</span>
              </label>
              <select value={speechStyle} onChange={(e) => setSpeechStyle(e.target.value as typeof speechStyle)} className={selectCls}>
                <option value="">— Auto (supervisor decides) —</option>
                <option value="normal">Normal — balanced delivery</option>
                <option value="whisper">Whisper — soft, intimate</option>
                <option value="emotional">Emotional — expressive, heartfelt</option>
                <option value="commanding">Commanding — authoritative, bold</option>
                <option value="trembling">Trembling — fearful, shaky</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} title="Passed as ElevenLabs speed parameter (0.7–1.2). Only sent if different from 1.0.">
                  Narration speed
                  <span className="ml-1 text-gray-600">{narrationSpeed.toFixed(2)}×</span>
                </label>
                <input
                  type="range"
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  value={narrationSpeed}
                  onChange={(e) => setNarrationSpeed(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-700 mt-0.5">
                  <span>0.7× slow</span>
                  <span>1.0× normal</span>
                  <span>1.2× fast</span>
                </div>
              </div>
              <div>
                <label className={labelCls} title="Voice level in the FFmpeg amix filter. 100% = full volume, 50% = duck the voice.">
                  Narration volume
                  <span className="ml-1 text-gray-600">{pctLabel(narrationVolume)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={narrationVolume}
                  onChange={(e) => setNarrationVolume(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-700 mt-0.5">
                  <span>0%</span>
                  <span>100% (default)</span>
                </div>
              </div>
            </div>
          </div>

          <NarrationPanel
            value={narrationSettings}
            onChange={setNarrationSettings}
            narrationEnabled={narrationEnabled}
            onNarrationEnabledChange={setNarrationEnabled}
          />

          {/* Music subsection */}
          <div className={musicDisabled ? "opacity-40 pointer-events-none" : ""}>
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-2">
              Music
              {musicDisabled && <span className="text-orange-600 normal-case tracking-normal">(skipped — voice only mode)</span>}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              <div>
                <label className={labelCls}>Music mood <span className="text-gray-700 font-normal">(auto if blank)</span></label>
                <select value={musicMood} onChange={(e) => setMusicMood(e.target.value)} className={selectCls}>
                  <option value="">Auto (AI picks)</option>
                  <option value="epic">Epic</option>
                  <option value="calm">Calm</option>
                  <option value="emotional">Emotional</option>
                  <option value="upbeat">Upbeat</option>
                  <option value="dramatic">Dramatic</option>
                  <option value="war">War / Battle</option>
                  <option value="action">Action</option>
                  <option value="suspense">Suspense</option>
                  <option value="dance">Dance</option>
                  <option value="rain">Rain / Ambient</option>
                  <option value="heavy_rain">Heavy Rain</option>
                  <option value="nature">Nature</option>
                </select>
              </div>
              <div>
                <label className={labelCls} title="Combined with mood and region to match a stock file: {mood}_{genre}_{region}.mp3">Music genre</label>
                <select value={musicGenre} onChange={(e) => setMusicGenre(e.target.value)} className={selectCls}>
                  <option value="">— Any —</option>
                  <option value="cinematic">Cinematic</option>
                  <option value="orchestral">Orchestral</option>
                  <option value="electronic">Electronic</option>
                  <option value="acoustic">Acoustic</option>
                  <option value="ambient">Ambient</option>
                  <option value="hip_hop">Hip-Hop</option>
                </select>
              </div>
              <div>
                <label className={labelCls} title="Regional vibe routes stock file selection. Add e.g. epic_orchestral_african.mp3 to stock/music/stock/ to activate.">Regional vibe</label>
                <select value={musicRegion} onChange={(e) => setMusicRegion(e.target.value)} className={selectCls}>
                  <option value="">— Global —</option>
                  <option value="western">Western</option>
                  <option value="latin">Latin</option>
                  <option value="asian">Asian</option>
                  <option value="middle_eastern">Middle Eastern</option>
                  <option value="african">African</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Music provider</label>
                <select value={musicProvider} onChange={(e) => setMusicProvider(e.target.value as "" | "stock_library" | "mock_music")} className={selectCls}>
                  <option value="">Auto</option>
                  <option value="stock_library">Stock Library</option>
                  <option value="mock_music">Mock (test tone)</option>
                </select>
              </div>
              <div>
                <label className={labelCls} title="Music ducking level in FFmpeg amix. 85% is a good default for narration + music.">
                  Music volume / ducking
                  <span className="ml-1 text-gray-600">{pctLabel(musicVolume)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-700 mt-0.5">
                  <span>0%</span>
                  <span>85% (default)</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Destination ── */}
        <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Destination</p>
          <div>
            <label className={labelCls}>Destination page</label>
            <select value={destinationPageId} onChange={(e) => setDestinationPageId(e.target.value)} className={selectCls}>
              <option value="">— No destination —</option>
              {pages.filter((p) => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.platform}{p.handle ? ` · ${p.handle}` : ""})
                </option>
              ))}
            </select>
            {pages.length === 0 && (
              <p className="text-xs text-gray-600 mt-1">
                <a href="/dashboard/destination-pages" className="text-blue-400 hover:text-blue-300">Add a destination page</a>
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {videoQuality === "draft" && (
          <p className="text-xs text-yellow-600 bg-yellow-950/30 border border-yellow-900/40 rounded-lg px-3 py-2">
            Draft mode — real video provider is skipped. Mock video used. No API credits consumed.
          </p>
        )}

        {/* Action row */}
        <div className="flex gap-3">
          <button
            onClick={handlePreviewPlan}
            disabled={supervisorLoading || !input.trim()}
            className="flex-none bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 border border-gray-700 py-3 px-4 rounded-lg font-medium transition-colors text-sm"
            title="Ask the AI Supervisor to analyze your prompt and preview what it plans to do — before you generate"
          >
            {supervisorLoading ? "Analyzing…" : "Preview Plan"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={status === "loading" || !input.trim()}
            className="flex-1 text-white py-3 rounded-lg font-medium transition-colors text-sm"
            style={{ background: "linear-gradient(135deg, #7c5cfc, #5a3db8)" }}
          >
            {status === "loading"
              ? "Generating…"
              : reviseFromId
              ? "Generate Revised Version"
              : outputMode === "text_to_audio"
              ? "Generate Audio"
              : "Assemble in Auto Mode"}
          </button>
        </div>

        {/* Supervisor preview panel */}
        {supervisorPreview && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#2a2a40", background: "#12121a" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "#2a2a40" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "#9090b0" }}>AI Supervisor Plan</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{
                  background: supervisorPreview.supervisedBy === "ollama" ? "rgba(74,222,128,0.12)" : "rgba(250,204,21,0.12)",
                  color: supervisorPreview.supervisedBy === "ollama" ? "#4ade80" : "#facc15",
                  border: `1px solid ${supervisorPreview.supervisedBy === "ollama" ? "rgba(74,222,128,0.2)" : "rgba(250,204,21,0.2)"}`,
                }}>
                  {String(supervisorPreview.supervisedBy)}
                </span>
              </div>
              <button onClick={() => { setSupervisorPreview(null); setCastChars([]); setSelectedCharIds(new Set()); setCastingConfirmed(false); setShowQuickAdd(false); }} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
            </div>
            <div className="px-4 py-3 text-xs space-y-1">
              {/* Core plan fields */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {([
                  ["Intent",       supervisorPreview.contentIntent],
                  ["Video type",   supervisorPreview.inferredVideoType],
                  ["Visual style", supervisorPreview.inferredVisualStyle],
                  ["Music mood",   supervisorPreview.inferredMusicMood],
                  ["Aspect ratio", supervisorPreview.inferredAspectRatio],
                  ["Subject",      supervisorPreview.inferredSubjectType],
                ] as [string, unknown][])
                  .filter(([, v]) => !!v)
                  .map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                      <span style={{ color: "#5a5a7a", minWidth: 76 }}>{label}</span>
                      <span style={{ color: "#c0c0e0" }}>{String(value)}</span>
                    </div>
                  ))}
                {typeof supervisorPreview.confidence === "number" && (
                  <div className="flex gap-2 col-span-2 pt-1.5 border-t" style={{ borderColor: "#2a2a40" }}>
                    <span style={{ color: "#5a5a7a" }}>Confidence</span>
                    <span style={{ color: "#7c5cfc" }}>{Math.round((supervisorPreview.confidence as number) * 100)}%</span>
                  </div>
                )}
              </div>

              {/* Scene Audio Director fields (Pass B) */}
              {!!(supervisorPreview.sceneType || supervisorPreview.emotionalTone || supervisorPreview.speechStyle ||
                supervisorPreview.tensionLevel != null || supervisorPreview.environmentType ||
                supervisorPreview.recommendedAudioMode) && (
                <div className="pt-2 border-t" style={{ borderColor: "#2a2a40" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#5a5a7a" }}>Scene Audio Director</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    {([
                      ["Scene type",   supervisorPreview.sceneType],
                      ["Emotion",      supervisorPreview.emotionalTone],
                      ["Speech style", supervisorPreview.speechStyle],
                      ["Environment",  supervisorPreview.environmentType],
                      ["Audio mode",   supervisorPreview.recommendedAudioMode],
                      ["Ducking",      supervisorPreview.duckingPlan],
                      ["Pause",        supervisorPreview.pauseStrategy],
                    ] as [string, unknown][])
                      .filter(([, v]) => !!v)
                      .map(([label, value]) => (
                        <div key={label} className="flex gap-2">
                          <span style={{ color: "#5a5a7a", minWidth: 76 }}>{label}</span>
                          <span style={{ color: "#a0d0ff" }}>{String(value)}</span>
                        </div>
                      ))}
                    {supervisorPreview.tensionLevel != null && (
                      <div className="flex gap-2">
                        <span style={{ color: "#5a5a7a", minWidth: 76 }}>Tension</span>
                        <span style={{ color: "#a0d0ff" }}>
                          {"▮".repeat(Number(supervisorPreview.tensionLevel))}{"▯".repeat(3 - Number(supervisorPreview.tensionLevel))}
                          <span className="ml-1 opacity-60">{String(supervisorPreview.tensionLevel)}/3</span>
                        </span>
                      </div>
                    )}
                    {!!supervisorPreview.ambienceNeed && (
                      <div className="flex gap-2">
                        <span style={{ color: "#5a5a7a", minWidth: 76 }}>Ambience</span>
                        <span style={{ color: "#4ade80" }}>recommended</span>
                      </div>
                    )}
                  </div>
                  {Array.isArray(supervisorPreview.inferredSoundEvents) && (supervisorPreview.inferredSoundEvents as string[]).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span style={{ color: "#5a5a7a" }}>SFX:</span>
                      {(supervisorPreview.inferredSoundEvents as string[]).map((e) => (
                        <span key={e} className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: "#1a2a1a", color: "#4ade80", border: "1px solid #2a3a2a" }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Character Casting Preview ── */}
        {supervisorPreview && (
          <div style={{ background: "#0f0f1a", border: "1px solid #2a2a40", borderRadius: 12, overflow: "hidden" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #1e1e38" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#7070a0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Character Casting
                </span>
                {castChars.length > 0 && (
                  <span style={{ fontSize: 10, background: "#7c5cfc22", color: "#7c5cfc", borderRadius: 4, padding: "1px 7px", border: "1px solid #7c5cfc44" }}>
                    {selectedCharIds.size} / {castChars.length} selected
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!castingConfirmed ? (
                  <>
                    <button
                      onClick={() => setShowQuickAdd(v => !v)}
                      style={{ fontSize: 11, background: "none", border: "1px solid #2a2a40", borderRadius: 5, padding: "3px 10px", color: "#7070a0", cursor: "pointer" }}
                    >
                      + New character
                    </button>
                    {castChars.length > 0 && (
                      <button
                        onClick={() => setCastingConfirmed(true)}
                        style={{ fontSize: 11, background: "#7c5cfc", border: "none", borderRadius: 5, padding: "4px 12px", color: "#fff", cursor: "pointer" }}
                      >
                        Confirm cast
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setCastingConfirmed(false)}
                    style={{ fontSize: 11, background: "#1a3a1a", border: "1px solid #2a4a2a", borderRadius: 5, padding: "3px 10px", color: "#4ade80", cursor: "pointer" }}
                  >
                    ✓ Cast confirmed — edit
                  </button>
                )}
              </div>
            </div>

            {/* Character cards grid */}
            {castChars.length === 0 ? (
              <div style={{ padding: "16px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#3a3a5a" }}>No characters registered yet.</p>
                <a href="/dashboard/character-voices" style={{ fontSize: 11, color: "#7c5cfc", textDecoration: "none" }}>
                  Go to Character Registry →
                </a>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 16px" }}>
                {castChars.map(c => {
                  const selected = selectedCharIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (castingConfirmed) return;
                        setSelectedCharIds(prev => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        });
                      }}
                      title={c.visualDescription ?? c.name}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        padding: "8px 10px", borderRadius: 10,
                        cursor: castingConfirmed ? "default" : "pointer",
                        background: selected ? "#7c5cfc18" : "#141420",
                        border: `1px solid ${selected ? "#7c5cfc66" : "#1e1e38"}`,
                        minWidth: 72, opacity: castingConfirmed && !selected ? 0.3 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40" }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: "#1a1a2e", border: "1px solid #2a2a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                          {c.isNarrator ? "🎙" : "👤"}
                        </div>
                      )}
                      <span style={{ fontSize: 10, color: selected ? "#c0b0ff" : "#5a5a7a", fontWeight: 600, textAlign: "center", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name.replaceAll("_", " ")}
                      </span>
                      {c.role && (
                        <span style={{ fontSize: 9, color: "#7070a0", textAlign: "center", maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.role.replaceAll("_", " ")}
                        </span>
                      )}
                      {selected && (
                        <span style={{ fontSize: 9, color: "#7c5cfc", background: "#7c5cfc22", borderRadius: 3, padding: "0 5px" }}>CAST</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick-add new character */}
            {showQuickAdd && !castingConfirmed && (
              <div style={{ borderTop: "1px solid #1e1e38", padding: "10px 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={quickAddName}
                  onChange={e => setQuickAddName(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Escape") setShowQuickAdd(false); }}
                  placeholder="CHARACTER NAME (e.g. MAMA, HERO)"
                  autoFocus
                  style={{ flex: 1, minWidth: 200, background: "#12121a", color: "#fff", border: "1px solid #2a2a40", borderRadius: 6, padding: "5px 10px", fontSize: 12 }}
                />
                <button
                  onClick={async () => {
                    if (!quickAddName.trim()) return;
                    setQuickAddSaving(true);
                    try {
                      const res = await fetch("/api/character-voices", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: quickAddName.trim() }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const newChar = data.voice as RegisteredCharacter;
                        setCastChars(prev => [...prev, newChar]);
                        setSelectedCharIds(prev => new Set([...prev, newChar.id]));
                        setQuickAddName("");
                        setShowQuickAdd(false);
                      }
                    } finally {
                      setQuickAddSaving(false);
                    }
                  }}
                  disabled={quickAddSaving || !quickAddName.trim()}
                  style={{ background: "#7c5cfc", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, color: "#fff", cursor: "pointer", opacity: quickAddSaving ? 0.6 : 1, flexShrink: 0 }}
                >
                  {quickAddSaving ? "Saving…" : "Save character"}
                </button>
                <a
                  href="/dashboard/character-voices"
                  target="_blank"
                  style={{ fontSize: 11, color: "#5a5a7a", textDecoration: "none", flexShrink: 0 }}
                  title="Open full character registry in new tab"
                >
                  Full registry ↗
                </a>
                <button
                  onClick={() => setShowQuickAdd(false)}
                  style={{ background: "none", border: "none", color: "#5a5a7a", fontSize: 12, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Confirmed cast summary */}
            {castingConfirmed && selectedCharIds.size > 0 && (
              <div style={{ borderTop: "1px solid #1e1e38", padding: "8px 16px" }}>
                <p style={{ fontSize: 11, color: "#5a5a7a" }}>
                  {selectedCharIds.size} character{selectedCharIds.size !== 1 ? "s" : ""} cast for this scene.
                  Their voice profiles will be matched during generation.
                </p>
              </div>
            )}
          </div>
        )}

        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm ${
            status === "success"
              ? "bg-green-900/40 text-green-300 border border-green-800"
              : "bg-red-900/40 text-red-300 border border-red-800"
          }`}>
            {message}
            {status === "success" && (
              <a href="/dashboard/review" className="ml-2 underline hover:no-underline">Check Review →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
