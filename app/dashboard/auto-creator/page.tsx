"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useGate } from "../../components/PreGenerationGate";
import exifr from "exifr";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

// ── Types ────────────────────────────────────────────────────────────────────

interface ExifData {
  dateTaken?: string;
  location?: string;
  camera?: string;
  lat?: number;
  lng?: number;
}

interface MediaItem {
  id: string;
  name: string;
  type: "image" | "video";
  url: string;
  file: File;
  serverUrl?: string; // persistent server URL (survives page refresh)
  exif?: ExifData;
}

interface DetectedActivity {
  label: string;
  confidence: string;
  icon?: string;
}

interface Suggestion {
  id: string;
  title: string;
  type: string;
  style: string;
  description: string;
  caption_preview: string;
  cta: string;
  music_mood: string;
  estimated_duration?: number;
}

interface Draft {
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  voice_script: string;
  music_mood: string;
  music_genre: string;
  transitions: string[];
  aspect_ratio: string;
  platform_tips: string;
  estimated_credits: number;
}

// ── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "instagram",  label: "Instagram", color: "#E1306C", formats: ["Reel", "Post", "Story", "Carousel"], bestRatio: "9:16" },
  { id: "tiktok",     label: "TikTok", color: "#00F2EA", formats: ["Short Video", "Photo Post"], bestRatio: "9:16" },
  { id: "youtube",    label: "YouTube", color: "#FF0000", formats: ["Shorts", "Video", "Thumbnail"], bestRatio: "16:9" },
  { id: "facebook",   label: "Facebook", color: "#1877F2", formats: ["Reel", "Post", "Story"], bestRatio: "1:1" },
  { id: "threads",    label: "Threads", color: "#000000", formats: ["Text + Image", "Carousel"], bestRatio: "1:1" },
  { id: "whatsapp",   label: "WhatsApp Status", color: "#25D366", formats: ["Status Image", "Status Video"], bestRatio: "9:16" },
];

const STYLE_COLORS: Record<string, string> = {
  classy: "#d4a843", luxury: "#a855f7", hype: "#ef4444", storytelling: "#3b82f6",
  cinematic: "#6366f1", minimalist: "#6b7280", premium_business: "#10b981",
  playful: "#f97316", direct_sales: "#dc2626", spiritual: "#8b5cf6",
};

// ── Shared styles ────────────────────────────────────────────────────────────

const panelBg = ds.color.card;
const border = ds.color.line;
const accent = ds.color.lilac;

const cardStyle: React.CSSProperties = { background: panelBg, border: `1px solid ${border}`, borderRadius: ds.radius.md, padding: 24 };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: ds.color.mute, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 10, fontFamily: ds.font.mono };
const btnPrimary: React.CSSProperties = { padding: "14px 28px", borderRadius: 12, border: "none", background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" };
const btnSm: React.CSSProperties = { fontSize: 12, padding: "8px 14px", borderRadius: 8, border: `1px solid ${ds.color.line}`, background: ds.color.paper, color: ds.color.lilac, cursor: "pointer", fontWeight: 600 };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AIContentCreatorPage() {
  const { requireGate, GateModal } = useGate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);

  // AI Intelligence Tier
  const [aiTier, setAiTier] = useState<AITier>("pro");

  // Step 1: Platform
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  // Step 2: Media
  const [media, setMedia] = useState<MediaItem[]>([]);

  // Step 3: AI Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedActivities, setDetectedActivities] = useState<DetectedActivity[]>([]);

  // Step 4: Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sugProvider, setSugProvider] = useState("");

  // Step 5: Draft
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [enhancingId, setEnhancingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contentRightsAgreed, setContentRightsAgreed] = useState(false);
  const [showRightsDialog, setShowRightsDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"none" | "ai" | "record">("none");
  const [recording, setRecording] = useState(false);
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Step 6: Talking Head (Lip-Sync)
  const [talkingHeadUrl, setTalkingHeadUrl] = useState<string | null>(null);
  const [generatingTalkingHead, setGeneratingTalkingHead] = useState(false);
  const [portraitForLipSync, setPortraitForLipSync] = useState<string | null>(null);

  // Step 6: Video Production
  const [narrationAudioUrl, setNarrationAudioUrl] = useState<string | null>(null);
  const [generatingNarration, setGeneratingNarration] = useState(false);
  const [mediaOrder, setMediaOrder] = useState<string[]>([]);
  const [trimSettings, setTrimSettings] = useState<Record<string, { start: number; end: number }>>({});
  const [textOverlays, setTextOverlays] = useState<{ text: string; position: string; fontSize: number; animation: string; inTime: number; outTime: number }[]>([]);
  const [introType, setIntroType] = useState<string | null>(null);
  const [outroType, setOutroType] = useState<string | null>(null);
  const [introDuration, setIntroDuration] = useState(3);
  const [outroDuration, setOutroDuration] = useState(3);
  const [assembledVideoUrl, setAssembledVideoUrl] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [sfxList, setSfxList] = useState<{ event: string; time: number }[]>([]);
  const [buildingVideo, setBuildingVideo] = useState(false);

  // Step 7: Preview & Polish
  const [narrationVolume, setNarrationVolume] = useState(80);
  const [musicVolume, setMusicVolume] = useState(50);
  const [qualityTier, setQualityTier] = useState<"draft" | "standard" | "premium">("standard");
  const [retrimStart, setRetrimStart] = useState(0);
  const [retrimEnd, setRetrimEnd] = useState(0);
  const [showRetrim, setShowRetrim] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<"tiktok" | "youtube" | "minimal" | "bold_white" | "neon">("tiktok");
  const [burningCaptions, setBurningCaptions] = useState(false);
  const [captionedVideoUrl, setCaptionedVideoUrl] = useState<string | null>(null);

  // ── Session recovery (DB-persisted, no localStorage) ──
  const AUTO_CREATOR_PROJECT_ID = "ghs_auto_creator_default";
  const [showResume, setShowResume] = useState(false);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved state on mount
  useEffect(() => {
    async function loadSavedState() {
      try {
        const res = await fetch(`/api/hybrid/saved-state?localId=${AUTO_CREATOR_PROJECT_ID}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json.found || !json.data) return;
        const session = json.data as Record<string, unknown>;
        const savedAt = typeof session.savedAt === "number" ? session.savedAt : 0;
        const age = Date.now() - savedAt;
        if (age < 24 * 60 * 60 * 1000 && typeof session.step === "number" && session.step > 1) {
          setShowResume(true);
        }
      } catch { /* ignore */ }
    }
    loadSavedState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save to DB on every meaningful state change
  useEffect(() => {
    if (step === 1 && !selectedPlatform) return; // don't save empty state
    if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(async () => {
      const session = {
        step,
        selectedPlatform,
        selectedFormat,
        aiTier,
        mediaItems: media.map(m => ({ id: m.id, name: m.name, type: m.type, serverUrl: m.serverUrl || "" })),
        detectedActivities,
        suggestions,
        selectedSuggestion,
        draft,
        sugProvider,
        musicUrl,
        narrationAudioUrl,
        assembledVideoUrl,
        savedAt: Date.now(),
      };
      try {
        await fetch("/api/hybrid/saved-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localId: AUTO_CREATOR_PROJECT_ID, data: session }),
        });
      } catch { /* ignore — non-blocking */ }
    }, 1200);
    return () => { if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current); };
  }, [step, selectedPlatform, selectedFormat, aiTier, media, detectedActivities, suggestions, selectedSuggestion, draft, sugProvider, musicUrl, narrationAudioUrl, assembledVideoUrl]);

  // Pick up selected music from SFX Library (select+return flow)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ghs_selected_music");
      if (!raw) return;
      const selected = JSON.parse(raw);
      if (selected.url && Date.now() - (selected.timestamp ?? 0) < 5 * 60 * 1000) {
        setMusicUrl(selected.url);
        localStorage.removeItem("ghs_selected_music");
        // Auto-resume session if we came from select mode
        fetch(`/api/hybrid/saved-state?localId=${AUTO_CREATOR_PROJECT_ID}`)
          .then(r => r.json())
          .then((json) => {
            if (json.found && json.data && json.data.step >= 6) {
              resumeFromData(json.data);
            }
          })
          .catch(() => { /* ignore */ });
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resumeFromData(s: Record<string, unknown>) {
    if (s.selectedPlatform) setSelectedPlatform(s.selectedPlatform as string);
    if (s.selectedFormat) setSelectedFormat(s.selectedFormat as string);
    if (s.detectedActivities) setDetectedActivities(s.detectedActivities as DetectedActivity[]);
    if (s.suggestions) setSuggestions(s.suggestions as Suggestion[]);
    if (s.selectedSuggestion) setSelectedSuggestion(s.selectedSuggestion as Suggestion);
    if (s.draft) setDraft(s.draft as Draft);
    if (s.sugProvider) setSugProvider(s.sugProvider as string);
    if (s.aiTier) setAiTier(s.aiTier as AITier);
    if (s.musicUrl) setMusicUrl(s.musicUrl as string);
    if (s.narrationAudioUrl) setNarrationAudioUrl(s.narrationAudioUrl as string);
    if (s.assembledVideoUrl) setAssembledVideoUrl(s.assembledVideoUrl as string);
    const mediaItems = s.mediaItems as Array<{ id: string; name: string; type: string; serverUrl: string }> | undefined;
    if (mediaItems && mediaItems.length > 0) {
      const restored: MediaItem[] = mediaItems
        .filter(m => m.serverUrl)
        .map(m => ({
          id: m.id,
          name: m.name,
          type: m.type as "image" | "video",
          url: m.serverUrl,
          serverUrl: m.serverUrl,
          file: new File([], m.name),
        }));
      if (restored.length > 0) {
        setMedia(restored);
        setMediaOrder(restored.map(m => m.id));
      }
    }
    const rawStep = typeof s.step === "number" ? s.step : 1;
    const resumeStep = rawStep <= 2 ? (s.selectedPlatform ? 2 : 1) : rawStep;
    setStep(resumeStep as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
    setShowResume(false);
  }

  function resumeSession() {
    fetch(`/api/hybrid/saved-state?localId=${AUTO_CREATOR_PROJECT_ID}`)
      .then(r => r.json())
      .then((json) => {
        if (json.found && json.data) {
          resumeFromData(json.data as Record<string, unknown>);
        } else {
          setShowResume(false);
        }
      })
      .catch(() => { setShowResume(false); });
  }

  function dismissResume() {
    setShowResume(false);
  }

  function clearSession() {
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: AUTO_CREATOR_PROJECT_ID, data: { step: 1, savedAt: 0 } }),
    }).catch(() => { /* ignore */ });
  }

  // ── Helpers ──

  const platform = PLATFORMS.find(p => p.id === selectedPlatform);

  function requestFiles(files: FileList) {
    if (contentRightsAgreed) {
      handleFiles(files);
    } else {
      setPendingFiles(files);
      setShowRightsDialog(true);
    }
  }

  function confirmRightsAndProceed() {
    setContentRightsAgreed(true);
    setShowRightsDialog(false);
    if (pendingFiles) {
      handleFiles(pendingFiles);
      setPendingFiles(null);
    }
  }

  async function handleFiles(files: FileList) {
    const items: MediaItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isImage = f.type.startsWith("image");
      const item: MediaItem = {
        id: `m_${Date.now()}_${i}`,
        name: f.name,
        type: isImage ? "image" : "video",
        url: URL.createObjectURL(f),
        file: f,
      };

      // Upload to server immediately so URL persists across sessions
      try {
        const uploadFd = new FormData();
        uploadFd.append("file", f);
        const uploadEndpoint = isImage ? "/api/upload/logo" : "/api/upload/video";
        const uploadRes = await fetch(uploadEndpoint, { method: "POST", body: uploadFd });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const serverUrl = uploadData.url || uploadData.audioUrl || (uploadData.filePath ? `/api/media/${uploadData.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}` : "");
          if (serverUrl) {
            (item as MediaItem & { serverUrl?: string }).serverUrl = serverUrl;
          }
        }
      } catch { /* upload failed silently — will re-upload during Build */ }

      // Read EXIF from images
      if (isImage) {
        try {
          const exif = await exifr.parse(f, { pick: ["DateTimeOriginal", "Make", "Model", "GPSLatitude", "GPSLongitude"] });
          if (exif) {
            item.exif = {
              dateTaken: exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined,
              camera: [exif.Make, exif.Model].filter(Boolean).join(" ") || undefined,
              lat: exif.GPSLatitude ?? exif.latitude,
              lng: exif.GPSLongitude ?? exif.longitude,
              location: (exif.GPSLatitude || exif.latitude) ? `${(exif.GPSLatitude ?? exif.latitude).toFixed(3)}, ${(exif.GPSLongitude ?? exif.longitude).toFixed(3)}` : undefined,
            };
          }
        } catch { /* no EXIF data */ }
      }
      items.push(item);
    }
    setMedia(prev => [...prev, ...items]);
  }

  function removeMedia(id: string) {
    setMedia(prev => prev.filter(m => m.id !== id));
  }

  // ── Step 3: Analyze media with AI (uploads actual images for vision analysis) ──
  const analyzeMedia = useCallback(async () => {
    setAnalyzing(true);
    setDetectedActivities([]);
    setErrorMsg(null);

    try {
      // Upload actual image files for vision AI analysis
      const imageFiles = media.filter(m => m.type === "image").slice(0, 4);
      let analyzeData: { activities?: DetectedActivity[]; image_analysis?: unknown[]; error?: string } = {};

      if (imageFiles.length > 0) {
        const fd = new FormData();
        for (const m of imageFiles) fd.append("file", m.file);
        fd.append("platform", selectedPlatform ?? "");
        fd.append("format", selectedFormat ?? "");

        const analyzeRes = await fetch("/api/auto-creator/analyze", { method: "POST", body: fd });
        analyzeData = await analyzeRes.json();
        if (!analyzeRes.ok || analyzeData.error) {
          console.warn("[analyze] API error:", analyzeData.error);
          // Don't block — continue with EXIF/fallback activities
        }
      }

      // Add EXIF-based activities
      const exifActivities: DetectedActivity[] = [];
      const withDates = media.filter(m => m.exif?.dateTaken);
      if (withDates.length > 0) exifActivities.push({ label: `Photos from ${withDates[0].exif!.dateTaken}`, confidence: "high" });
      const withLocation = media.filter(m => m.exif?.location);
      if (withLocation.length > 0) exifActivities.push({ label: `Location: ${withLocation[0].exif!.location}`, confidence: "high" });
      const withCamera = media.filter(m => m.exif?.camera);
      if (withCamera.length > 0) exifActivities.push({ label: `Shot on ${withCamera[0].exif!.camera}`, confidence: "high" });
      const hasVideos = media.some(m => m.type === "video");
      if (hasVideos) exifActivities.push({ label: `${media.filter(m => m.type === "video").length} video clip(s)`, confidence: "high" });

      // Merge vision AI activities + EXIF activities
      const allActivities = [...(analyzeData.activities ?? []), ...exifActivities];
      if (allActivities.length === 0) {
        allActivities.push({ label: `${media.length} files ready for content`, confidence: "high" });
      }
      setDetectedActivities(allActivities);
    } catch (err) {
      console.error("[analyze] Error:", err);
      setDetectedActivities([
        { label: "Media uploaded successfully", confidence: "high" },
        { label: "Ready for content suggestions", confidence: "high" },
      ]);
    }

    setAnalyzing(false);
    setStep(3);
  }, [media, selectedPlatform, selectedFormat]);

  // ── Step 4: Get suggestions ──
  async function getSuggestions(forceRefresh = false) {
    if (!forceRefresh && suggestions.length > 0) { setStep(4); return; }
    setSuggestionsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auto-creator/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media: media.map(m => ({ name: m.name, type: m.type })),
          platform: selectedPlatform,
          format: selectedFormat,
          tier: aiTier,
          context: `Create ${selectedFormat} content for ${platform?.label}. Activities detected: ${detectedActivities.map(a => a.label).join(", ")}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(`Suggestions failed: ${data.error || `HTTP ${res.status}`}`);
        setSuggestionsLoading(false);
        return; // Stay on current step so user can retry
      }
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setSugProvider(data.provider ?? "");
        setStep(4);
      } else {
        setErrorMsg("AI returned no suggestions. Try adding more media or changing the platform.");
      }
    } catch (err) {
      console.error("[suggest] Error:", err);
      setErrorMsg(`Failed to get suggestions: ${err instanceof Error ? err.message : "Network error"}`);
    }
    setSuggestionsLoading(false);
  }

  // ── Step 5: Generate draft ──
  async function generateDraft(sug: Suggestion) {
    try { await requireGate(); } catch { return; }
    setSelectedSuggestion(sug);
    setDraftLoading(true);
    setDraft(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auto-creator/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion: sug,
          mediaNames: media.map(m => m.name),
          platform: selectedPlatform,
          format: selectedFormat,
          tier: aiTier,
          context: `Platform: ${platform?.label}, Format: ${selectedFormat}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(`Draft generation failed: ${data.error || `HTTP ${res.status}`}`);
        setDraftLoading(false);
        return; // Stay on step 4 so user can retry
      }
      if (data.draft) {
        setDraft(data.draft);
        setSavedToLibrary(false);
        setStep(5);
      } else {
        setErrorMsg("AI returned an empty draft. Try a different suggestion or regenerate.");
      }
    } catch (err) {
      console.error("[draft] Error:", err);
      setErrorMsg(`Failed to generate draft: ${err instanceof Error ? err.message : "Network error"}`);
    }
    setDraftLoading(false);
  }

  // ── Enhance image ──
  const [beforeAfter, setBeforeAfter] = useState<Record<string, string>>({}); // id → original url

  async function enhanceImage(m: MediaItem) {
    setEnhancingId(m.id);
    try {
      // Save original for before/after toggle
      setBeforeAfter(prev => ({ ...prev, [m.id]: m.url }));

      const fd = new FormData();
      fd.append("file", m.file);
      fd.append("mode", "enhance");
      const res = await fetch("/api/image/enhance", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(`Image enhance failed: ${data.error || `HTTP ${res.status}`}`);
      } else if (data.outputUrl) {
        const enhancedRes = await fetch(data.outputUrl);
        if (!enhancedRes.ok) {
          setErrorMsg(`Failed to fetch enhanced image: HTTP ${enhancedRes.status}`);
          setEnhancingId(null);
          return;
        }
        const blob = await enhancedRes.blob();
        const newFile = new File([blob], `enhanced_${m.name}`, { type: blob.type });
        setMedia(prev => prev.map(item =>
          item.id === m.id
            ? { ...item, url: URL.createObjectURL(blob), file: newFile, name: `enhanced_${m.name}` }
            : item
        ));
      }
    } catch (err) {
      setErrorMsg(`Image enhance failed: ${err instanceof Error ? err.message : "Network error"}`);
    }
    setEnhancingId(null);
  }

  // ── Save draft to Asset Library ──
  async function saveToLibrary() {
    if (!draft || savingToLibrary) return;
    setSavingToLibrary(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auto-creator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          suggestion: selectedSuggestion,
          platform: selectedPlatform,
          format: selectedFormat,
          mediaNames: media.map(m => m.name),
          tier: aiTier,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(`Save failed: ${data.error || `HTTP ${res.status}`}`);
      } else {
        setSavedToLibrary(true);
      }
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : "Network error"}`);
    }
    setSavingToLibrary(false);
  }

  // ── Edit draft fields ──
  function updateDraft(patch: Partial<Draft>) {
    setDraft(prev => prev ? { ...prev, ...patch } : prev);
  }

  // ── Navigation ──
  async function sendToStudio() {
    if (!draft) return;
    // Save to library before navigating
    if (!savedToLibrary) await saveToLibrary();
    clearSession();
    const params = new URLSearchParams({ prompt: draft.voice_script || draft.caption });
    window.location.href = `/dashboard/collaborative-editor?${params.toString()}`;
  }

  async function sendToAdEditor() {
    if (!draft) return;
    // Save to library before navigating
    if (!savedToLibrary) await saveToLibrary();
    clearSession();
    const params = new URLSearchParams({ prompt: draft.caption });
    if (platform?.bestRatio) params.set("ar", platform.bestRatio);
    window.location.href = `/dashboard/ad-editor?${params.toString()}`;
  }

  async function sendToReview() {
    if (!draft) return;
    // Save to library first
    if (!savedToLibrary) await saveToLibrary();
    // Update the saved content item status to IN_REVIEW so it appears in Review Queue
    try {
      const saveRes = await fetch("/api/auto-creator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, suggestion: selectedSuggestion, platform: selectedPlatform, format: selectedFormat, mediaNames: media.map(m => m.name), tier: aiTier }),
      });
      if (saveRes.ok) {
        const saveData = await saveRes.json();
        if (saveData.contentId) {
          const statusRes = await fetch(`/api/content/${saveData.contentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "IN_REVIEW" }),
          });
          if (!statusRes.ok) console.error("[auto-creator] status update failed", statusRes.status);
        }
      } else {
        console.error("[auto-creator] save for review failed", saveRes.status);
      }
    } catch { /* best effort */ }
    clearSession();
    window.location.href = "/dashboard/review";
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <GateModal />

      <HeroTitle
        kicker="AI Studio"
        title="Auto"
        italic="Creator"
        sub="Turn your daily media into scroll-stopping content. Pick a platform, upload your photos or videos, and AI handles the rest — captions, hashtags, voice scripts, music."
      />

      {/* ── Progress bar ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {[
          { n: 1, label: "Platform" },
          { n: 2, label: "Media" },
          { n: 3, label: "Analysis" },
          { n: 4, label: "Ideas" },
          { n: 5, label: "Script" },
          { n: 6, label: "Build" },
          { n: 7, label: "Polish" },
          { n: 8, label: "Export" },
        ].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{
              height: 4, borderRadius: 2, marginBottom: 6,
              background: step >= s.n ? ds.color.lilac : ds.color.line,
              transition: "background 0.3s",
            }} />
            <p style={{ fontSize: 9, color: step >= s.n ? ds.color.lilac : ds.color.mute2, fontWeight: step === s.n ? 700 : 400, textAlign: "center", fontFamily: ds.font.mono }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Resume banner ── */}
      {showResume && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderRadius: 12, marginBottom: 16,
          background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.2)",
        }}>
          <div>
            <p style={{ fontSize: 13, color: ds.color.ink, fontWeight: 600 }}>You left off mid-session</p>
            <p style={{ fontSize: 11, color: ds.color.mute }}>Pick up where you stopped? Your media and progress are saved.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resumeSession} style={{ ...btnSm, background: accent, color: "#fff", borderColor: accent }}>
              Resume
            </button>
            <button onClick={dismissResume} style={{ ...btnSm, fontSize: 10 }}>
              Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {errorMsg && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
        }}>
          <p style={{ fontSize: 12, color: "#f87171", flex: 1 }}>{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)}
            style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#f87171", cursor: "pointer", marginLeft: 12, fontWeight: 600 }}>
            Dismiss
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1 — Where do you need content? */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={cardStyle}>
          <p style={sectionLabel}>Where do you need content?</p>
          <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 20 }}>
            Select the platform so AI can optimize format, size, and caption style.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => { setSelectedPlatform(p.id); setSelectedFormat(null); }}
                style={{
                  padding: "24px 16px", borderRadius: 16, border: `2px solid ${selectedPlatform === p.id ? p.color : "transparent"}`,
                  background: selectedPlatform === p.id
                    ? `linear-gradient(135deg, ${p.color}18, ${p.color}08)`
                    : "linear-gradient(135deg, ds.color.paper, ds.color.paper)",
                  cursor: "pointer", textAlign: "center", transition: "all 0.3s",
                  boxShadow: selectedPlatform === p.id ? `0 4px 20px ${p.color}20` : "none",
                }}
                onMouseEnter={e => { if (selectedPlatform !== p.id) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: selectedPlatform === p.id ? p.color : ds.color.ink, display: "block", marginBottom: 4 }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 10, color: selectedPlatform === p.id ? `${p.color}aa` : ds.color.mute2, display: "block", marginTop: 4 }}>
                  {p.formats.length} formats
                </span>
              </button>
            ))}
          </div>

          {/* Format selection */}
          {selectedPlatform && platform && (
            <div style={{ marginBottom: 24 }}>
              <p style={sectionLabel}>What type of content?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {platform.formats.map(f => (
                  <button key={f} onClick={() => setSelectedFormat(f)}
                    style={{
                      ...btnSm, fontSize: 13, padding: "10px 18px",
                      background: selectedFormat === f ? `${platform.color}20` : ds.color.paper,
                      borderColor: selectedFormat === f ? platform.color : ds.color.line2,
                      color: selectedFormat === f ? platform.color : "#a0a0c0",
                    }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Intelligence Tier */}
          {selectedPlatform && selectedFormat && (
            <div style={{ marginBottom: 20 }}>
              <p style={sectionLabel}>AI Intelligence Level</p>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 10 }}>Higher tier = better captions, smarter hashtags, stronger voice scripts</p>
              <AITierSelector value={aiTier} onChange={setAiTier} showBest />
            </div>
          )}

          {/* Next */}
          {selectedPlatform && selectedFormat && (
            <button onClick={() => setStep(2)} style={{ ...btnPrimary, background: platform?.color ?? accent }}>
              Next — Upload Your Media
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 2 — Upload images / videos */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={sectionLabel}>Upload your media</p>
              <p style={{ fontSize: 12, color: ds.color.mute }}>
                {selectedFormat} for {platform?.label} &middot; Best ratio: {platform?.bestRatio}
              </p>
            </div>
            <button onClick={() => setStep(1)} style={{ ...btnSm, fontSize: 10 }}>Change Platform</button>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) requestFiles(e.dataTransfer.files); }}
            style={{
              border: "2px dashed ds.color.line2", borderRadius: 14, padding: "48px 20px",
              textAlign: "center", cursor: "pointer", marginBottom: 20,
              background: "rgba(124,92,252,0.03)", transition: "border-color 0.2s",
            }}
          >
            <p style={{ fontSize: 36, marginBottom: 10 }}></p>
            <p style={{ fontSize: 14, color: ds.color.ink, fontWeight: 600 }}>
              Drop your images or videos here
            </p>
            <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 6 }}>
              Photos from your outing, product shots, event clips — whatever you did today
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }}
            onChange={e => { if (e.target.files) requestFiles(e.target.files); }} />

          {/* Import from library buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <a href="/dashboard/assets" target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 14px", borderRadius: 10, border: "1px solid ds.color.line2",
                background: ds.color.paper, color: "#60a5fa", fontSize: 11, fontWeight: 600,
                textDecoration: "none", cursor: "pointer",
              }}>
              Browse Asset Library
            </a>
            <a href="/dashboard/character-voices" target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "10px 14px", borderRadius: 10, border: "1px solid #a855f720",
                background: "#a855f708", color: "#a855f7", fontSize: 11, fontWeight: 600,
                textDecoration: "none", cursor: "pointer",
              }}>
              Import Character
            </a>
          </div>

          {/* Uploaded media grid */}
          {media.length > 0 && (
            <>
              <p style={{ ...sectionLabel, marginTop: 16 }}>Uploaded ({media.length})</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 20 }}>
                {media.map(m => (
                  <div key={m.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${border}`, aspectRatio: "1", background: ds.color.paper }}>
                    {m.type === "image" ? (
                      <img src={m.url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    )}
                    <button onClick={() => removeMedia(m.id)}
                      style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.8)", color: "#f87171", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", padding: "3px 7px", fontWeight: 700 }}>
                      x
                    </button>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.85))", padding: "14px 8px 6px" }}>
                      <span style={{ fontSize: 9, color: "#a0a0c0", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name}
                      </span>
                      {m.exif?.dateTaken && <span style={{ fontSize: 8, color: "#505070", display: "block" }}>{m.exif.dateTaken}</span>}
                      {m.exif?.camera && <span style={{ fontSize: 8, color: "#505070", display: "block" }}>{m.exif.camera}</span>}
                      {m.exif?.location && <span style={{ fontSize: 8, color: "#3b82f6", display: "block" }}>{m.exif.location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Analyze button */}
          <button
            onClick={analyzeMedia}
            disabled={media.length === 0 || analyzing}
            style={{
              ...btnPrimary,
              opacity: media.length === 0 ? 0.4 : 1,
              background: analyzing ? ds.color.line2 : accent,
            }}
          >
            {analyzing ? "AI is analyzing your media..." : `Analyze ${media.length} file${media.length !== 1 ? "s" : ""} with AI`}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 3 — AI Activity Detection */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div style={cardStyle}>
          <p style={sectionLabel}>AI Activity Detection</p>
          <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 20 }}>
            Here&apos;s what AI detected from your media today:
          </p>

          {/* Detected activities */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {detectedActivities.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 10,
                background: ds.color.paper, border: `1px solid ${border}`,
              }}>
                
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: ds.color.ink, fontWeight: 600 }}>{a.label}</p>
                </div>
                <span style={{
                  fontSize: 9, padding: "3px 10px", borderRadius: 20,
                  background: a.confidence === "high" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                  color: a.confidence === "high" ? "#22c55e" : "#f59e0b",
                  fontWeight: 600,
                }}>
                  {a.confidence}
                </span>
              </div>
            ))}
          </div>

          {/* Media thumbnails strip */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto" }}>
            {media.map(m => (
              <div key={m.id} style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1px solid ${border}` }}>
                {m.type === "image" ? (
                  <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ ...btnSm, flex: 1, textAlign: "center" }}>
              Add More Media
            </button>
            <button
              onClick={() => getSuggestions()}
              disabled={suggestionsLoading}
              style={{ ...btnPrimary, flex: 2, background: suggestionsLoading ? ds.color.line2 : accent }}
            >
              {suggestionsLoading ? "AI is creating ideas..." : "Show Me Content Ideas"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 4 — Content Suggestions */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={sectionLabel}>Content Ideas for {platform?.label}</p>
              <p style={{ fontSize: 10, color: ds.color.mute2 }}>
                {selectedFormat} &middot; {media.length} media files &middot; {sugProvider && `AI: ${sugProvider}`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => getSuggestions(true)} style={{ ...btnSm, fontSize: 10 }}>Refresh Ideas</button>
              <button onClick={() => setStep(3)} style={btnSm}>Back</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {suggestions.map(s => {
              const styleColor = STYLE_COLORS[s.style] ?? accent;
              return (
                <div key={s.id} style={{
                  ...cardStyle, cursor: "pointer",
                  borderColor: selectedSuggestion?.id === s.id ? accent : border,
                  transition: "border-color 0.2s, transform 0.2s",
                }}
                  onClick={() => generateDraft(s)}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{
                      fontSize: 9, padding: "3px 10px", borderRadius: 20,
                      background: `${styleColor}18`, color: styleColor,
                      fontWeight: 700, textTransform: "capitalize",
                    }}>
                      {s.style}
                    </span>
                    <span style={{ fontSize: 9, color: ds.color.mute2 }}>{s.type}</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 11, color: "#8080b0", lineHeight: 1.6, marginBottom: 10 }}>{s.description}</p>
                  <p style={{ fontSize: 10, color: ds.color.mute, fontStyle: "italic", marginBottom: 12, lineHeight: 1.5 }}>
                    &ldquo;{s.caption_preview}&rdquo;
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "#505070" }}>{s.music_mood}</span>
                    {s.estimated_duration ? <span style={{ fontSize: 9, color: "#505070" }}>{s.estimated_duration}s</span> : null}
                  </div>
                  <button
                    disabled={draftLoading && selectedSuggestion?.id === s.id}
                    style={{
                      ...btnPrimary, marginTop: 12, fontSize: 12, padding: "10px 16px",
                      background: draftLoading && selectedSuggestion?.id === s.id ? ds.color.line2 : accent,
                    }}>
                    {draftLoading && selectedSuggestion?.id === s.id ? "Creating draft..." : "Create Draft"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 5 — Draft Preview */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 5 && draft && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          {/* Main preview */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={sectionLabel}>Draft Preview</p>
              <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>
                No credits spent yet
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.02em" }}>
              {draft.title}
            </h2>

            {/* Caption — editable */}
            <div style={{ background: ds.color.paper, borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Caption (editable)</p>
              <textarea
                value={draft.caption}
                onChange={e => updateDraft({ caption: e.target.value })}
                rows={4}
                style={{ width: "100%", fontSize: 13, color: ds.color.ink, lineHeight: 1.8, background: "transparent", border: "1px solid ds.color.line2", borderRadius: 8, padding: "10px 12px", resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 9, color: "#505070", marginBottom: 4 }}>Hashtags (edit below)</p>
                <input
                  value={draft.hashtags.map(h => `#${h}`).join(" ")}
                  onChange={e => updateDraft({ hashtags: e.target.value.split(/\s+/).map(t => t.replace(/^#/, "")).filter(Boolean) })}
                  style={{ width: "100%", fontSize: 11, color: accent, background: "transparent", border: "1px solid ds.color.line2", borderRadius: 6, padding: "6px 10px", outline: "none" }}
                />
              </div>
            </div>

            {/* Voice script — editable */}
            <div style={{ background: ds.color.paper, borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Voice Narration Script (editable)</p>
              <textarea
                value={draft.voice_script}
                onChange={e => updateDraft({ voice_script: e.target.value })}
                rows={3}
                placeholder="Add narration script here..."
                style={{ width: "100%", fontSize: 12, color: "#a0a0c0", lineHeight: 1.8, fontStyle: "italic", background: "transparent", border: "1px solid ds.color.line2", borderRadius: 8, padding: "10px 12px", resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />
            </div>

            {/* Platform tip */}
            {draft.platform_tips && (
              <div style={{ background: "rgba(124,92,252,0.06)", border: `1px solid rgba(124,92,252,0.15)`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: accent }}>
                  {draft.platform_tips}
                </p>
              </div>
            )}

            {/* Voice narration picker with recording */}
            <div style={{ background: ds.color.paper, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Voice Narration</p>
              <div style={{ display: "flex", gap: 6, marginBottom: voiceMode === "record" ? 12 : 0 }}>
                {([
                  { id: "none" as const, label: "No Narration" },
                  { id: "ai" as const, label: "AI Voice" },
                  { id: "record" as const, label: "My Voice" },
                ]).map(v => (
                  <button key={v.id} onClick={() => {
                    setVoiceMode(v.id);
                    if (v.id === "none") updateDraft({ voice_script: "" });
                    else if (v.id === "ai" && !draft.voice_script) updateDraft({ voice_script: "Add narration text above" });
                  }}
                    style={{ flex: 1, padding: "10px 10px", borderRadius: 8, border: `1px solid ${voiceMode === v.id ? accent : ds.color.line2}`, background: voiceMode === v.id ? `${accent}10` : "transparent", color: voiceMode === v.id ? accent : ds.color.mute, fontSize: 11, cursor: "pointer", fontWeight: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Voice recording interface */}
              {voiceMode === "record" && (
                <div style={{ background: ds.color.paper, borderRadius: 10, padding: 14, border: "1px solid ds.color.line2" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <button
                      onClick={async () => {
                        if (recording) {
                          // Stop recording
                          mediaRecorderRef.current?.stop();
                          setRecording(false);
                        } else {
                          // Start recording
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            const recorder = new MediaRecorder(stream);
                            mediaRecorderRef.current = recorder;
                            chunksRef.current = [];
                            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                            recorder.onstop = () => {
                              const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                              setVoiceRecordingUrl(URL.createObjectURL(blob));
                              stream.getTracks().forEach(t => t.stop());
                            };
                            recorder.start();
                            setRecording(true);
                          } catch { alert("Microphone access denied. Please allow microphone in browser settings."); }
                        }
                      }}
                      style={{
                        width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: recording ? "#ef4444" : accent,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, color: "#fff",
                        animation: recording ? "pulse-rec 1s infinite" : "none",
                      }}>
                      {recording ? "⏹" : ""}
                    </button>
                    <div>
                      <p style={{ fontSize: 12, color: recording ? "#ef4444" : "#fff", fontWeight: 600 }}>
                        {recording ? "Recording... tap to stop" : "Tap to record your voice"}
                      </p>
                      <p style={{ fontSize: 10, color: ds.color.mute }}>Read the narration script above into your microphone</p>
                    </div>
                  </div>

                  {voiceRecordingUrl && (
                    <div>
                      <audio src={voiceRecordingUrl} controls style={{ width: "100%", height: 36 }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button onClick={() => setVoiceRecordingUrl(null)}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid ds.color.line2", background: "transparent", color: "#ef4444", cursor: "pointer" }}>
                          Re-record
                        </button>
                        <button
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", cursor: "pointer" }}>
                          Use this recording
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload voice file option */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid ds.color.line2" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: 10, color: ds.color.mute }}>Or upload a voice file:</span>
                      <input type="file" accept="audio/*" style={{ fontSize: 10, color: ds.color.mute }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setVoiceRecordingUrl(URL.createObjectURL(f));
                        }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <style>{`@keyframes pulse-rec { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } }`}</style>

            {/* Music selection */}
            <div style={{ background: ds.color.paper, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Music</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Afrobeats", "Pop", "Gospel", "Cinematic", "Calm", "Upbeat", "No Music"].map(m => (
                  <button key={m} onClick={() => updateDraft({ music_mood: m === "No Music" ? "" : m })}
                    style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${draft.music_mood === m ? accent : ds.color.line2}`, background: draft.music_mood === m ? `${accent}15` : "transparent", color: draft.music_mood === m ? accent : ds.color.mute, fontSize: 10, cursor: "pointer" }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Next — Build Video */}
            <button onClick={() => {
              // Initialize media order from current media if not set
              if (mediaOrder.length === 0) setMediaOrder(media.map(m => m.id));
              // Initialize text overlays from draft
              if (textOverlays.length === 0) {
                setTextOverlays([
                  { text: draft.title, position: "center", fontSize: 32, animation: "fade", inTime: 0, outTime: 3 },
                  { text: draft.caption.slice(0, 100), position: "bottom-center", fontSize: 16, animation: "slide_up", inTime: 1, outTime: 0 },
                ]);
              }
              setStep(6);
            }} style={{ ...btnPrimary, marginTop: 16, background: "#a855f7" }}>
              Next — Build Video
            </button>
            <button onClick={() => setStep(4)} style={{ ...btnSm, width: "100%", marginTop: 8, textAlign: "center" }}>
              Back to Ideas
            </button>
          </div>

          {/* Right panel — metadata */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={cardStyle}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Platform</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}></span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{platform?.label}</p>
                  <p style={{ fontSize: 10, color: ds.color.mute }}>{selectedFormat} &middot; {draft.aspect_ratio}</p>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>CTA (editable)</p>
              <input
                value={draft.cta}
                onChange={e => updateDraft({ cta: e.target.value })}
                style={{ width: "100%", fontSize: 13, fontWeight: 700, color: accent, background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 8, padding: "8px 12px", textAlign: "center", outline: "none" }}
              />
            </div>

            <div style={cardStyle}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Music</p>
              <p style={{ fontSize: 13, color: ds.color.ink }}>{draft.music_mood}</p>
              <p style={{ fontSize: 11, color: ds.color.mute }}>{draft.music_genre}</p>
            </div>

            <div style={{ ...cardStyle, borderColor: "rgba(245,158,11,0.2)" }}>
              <p style={{ ...sectionLabel, fontSize: 9, color: "#f59e0b" }}>Credit Approval</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <p style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{draft.estimated_credits}</p>
                <span style={{ fontSize: 10, color: "#f59e0b" }}>credits needed</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#22c55e" }}>Your balance</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>50 credits</span>
              </div>
              <p style={{ fontSize: 9, color: ds.color.mute2 }}>Credits charged only after you approve generation</p>
              <a href="/dashboard/budget" style={{ fontSize: 9, color: accent, textDecoration: "none", display: "block", marginTop: 4 }}>
                Top up credits →
              </a>
            </div>

            <div style={cardStyle}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Media ({media.length})</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {media.slice(0, 4).map(m => (
                  <div key={m.id} style={{ position: "relative", borderRadius: 6, overflow: "hidden", aspectRatio: "1", border: `1px solid ${border}` }}>
                    {m.type === "image" ? (
                      <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                    )}
                    {m.type === "image" && (
                      <div style={{ position: "absolute", bottom: 2, right: 2, display: "flex", gap: 2 }}>
                        {beforeAfter[m.id] && (
                          <button onClick={() => {
                            // Toggle between before/after
                            const origUrl = beforeAfter[m.id];
                            setBeforeAfter(prev => ({ ...prev, [m.id]: m.url }));
                            setMedia(prev => prev.map(item => item.id === m.id ? { ...item, url: origUrl } : item));
                          }}
                            style={{ fontSize: 7, padding: "2px 4px", borderRadius: 3, border: "none", background: "rgba(245,158,11,0.8)", color: "#fff", cursor: "pointer" }}>
                            B/A
                          </button>
                        )}
                        <button onClick={() => enhanceImage(m)} disabled={enhancingId === m.id}
                          style={{ fontSize: 8, padding: "2px 5px", borderRadius: 4, border: "none", background: enhancingId === m.id ? ds.color.line2 : "rgba(16,185,129,0.8)", color: "#fff", cursor: "pointer" }}>
                          {enhancingId === m.id ? "..." : m.name.startsWith("enhanced_") ? "Re-enhance" : "Enhance"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {media.length > 4 && <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 4 }}>+{media.length - 4} more</p>}
            </div>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 6 — Video Production */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 6 && draft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ ...sectionLabel, color: "#a855f7" }}>Step 6 — Video Production</p>
              <p style={{ fontSize: 12, color: ds.color.mute }}>Assemble your video from the draft</p>
            </div>
            <button onClick={() => setStep(5)} style={btnSm}>Back to Script</button>
          </div>

          {/* 1. Narration Generation */}
          <div style={{ ...cardStyle, borderColor: "#a855f720" }}>
            <p style={sectionLabel}>Narration</p>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12 }}>
              Generate AI narration from your voice script ({draft.voice_script.length} chars)
            </p>
            {!narrationAudioUrl ? (
              <button
                onClick={async () => {
                  setGeneratingNarration(true);
                  setErrorMsg(null);
                  try {
                    const res = await fetch("/api/tts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: draft.voice_script, voice: "default", speed: 1.0 }),
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) {
                      setErrorMsg(`Narration failed: ${data.error || `HTTP ${res.status}`}`);
                    } else if (data.audioUrl) {
                      setNarrationAudioUrl(data.audioUrl);
                    }
                  } catch (err) {
                    setErrorMsg(`Narration failed: ${err instanceof Error ? err.message : "Network error"}`);
                  }
                  setGeneratingNarration(false);
                }}
                disabled={generatingNarration || !draft.voice_script}
                style={{ ...btnPrimary, background: generatingNarration ? ds.color.line2 : "#a855f7" }}
              >
                {generatingNarration ? "Generating narration..." : "Generate AI Narration"}
              </button>
            ) : (
              <div>
                <audio src={narrationAudioUrl} controls style={{ width: "100%", height: 40, marginBottom: 8 }} />
                <button onClick={() => setNarrationAudioUrl(null)} style={{ ...btnSm, fontSize: 10 }}>
                  Re-generate Narration
                </button>
              </div>
            )}
          </div>

          {/* 1b. Talking Head (Lip-Sync) — magic chain */}
          {media.some(m => m.type === "image") && (
            <div style={{ ...cardStyle, borderColor: "rgba(236,72,153,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={sectionLabel}>Talking Head (Lip-Sync)</p>
                <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: "rgba(236,72,153,0.12)", color: "#ec4899", fontWeight: 600 }}>FAL Hedra</span>
              </div>
              <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12 }}>
                Select your portrait — AI lip-syncs it to your narration audio. This is the magic chain differentiator.
              </p>

              {/* Portrait selector */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
                {media.filter(m => m.type === "image").map(m => (
                  <div key={m.id} onClick={() => setPortraitForLipSync(m.id)}
                    style={{
                      width: 80, height: 80, borderRadius: 10, overflow: "hidden", flexShrink: 0, cursor: "pointer",
                      border: `2px solid ${portraitForLipSync === m.id ? "#ec4899" : ds.color.line2}`,
                      boxShadow: portraitForLipSync === m.id ? "0 0 12px rgba(236,72,153,0.4)" : "none",
                      transition: "all 0.2s",
                    }}>
                    <img src={m.url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>

              {!talkingHeadUrl ? (
                <button
                  disabled={!portraitForLipSync || !narrationAudioUrl || generatingTalkingHead}
                  onClick={async () => {
                    const portraitMedia = media.find(m => m.id === portraitForLipSync);
                    if (!portraitMedia || !narrationAudioUrl) return;
                    setGeneratingTalkingHead(true);
                    setErrorMsg(null);
                    try {
                      const imgUrl = portraitMedia.serverUrl || portraitMedia.url;
                      const res = await fetch("/api/avatar/lip-sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ imageUrl: imgUrl, audioUrl: narrationAudioUrl, aspectRatio: draft.aspect_ratio || "9:16" }),
                      });
                      const data = await res.json();
                      if (data.videoUrl) {
                        setTalkingHeadUrl(data.videoUrl);
                        // Add as first scene in the assembly
                        const newId = `talking_head_${Date.now()}`;
                        setMedia(prev => [{ id: newId, name: "Talking Head", type: "video" as const, url: data.videoUrl, serverUrl: data.videoUrl, file: new File([], "talking_head.mp4") }, ...prev]);
                        setMediaOrder(prev => [newId, ...prev.filter(id => id !== newId)]);
                      } else {
                        setErrorMsg("Lip-sync failed: " + (data.error || "No video returned from FAL Hedra"));
                      }
                    } catch (err) {
                      setErrorMsg("Lip-sync failed: " + (err instanceof Error ? err.message : "Network error"));
                    }
                    setGeneratingTalkingHead(false);
                  }}
                  style={{
                    ...btnPrimary, fontSize: 13,
                    background: (generatingTalkingHead || !portraitForLipSync || !narrationAudioUrl) ? ds.color.line2 : "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                    opacity: (!portraitForLipSync || !narrationAudioUrl) && !generatingTalkingHead ? 0.5 : 1,
                  }}>
                  {generatingTalkingHead ? "Generating lip-sync... (2-4 min)" :
                   !narrationAudioUrl ? "️ Generate narration first (section above)" :
                   !portraitForLipSync ? "Select a portrait above first" :
                   "Generate Talking Head Video"}
                </button>
              ) : (
                <div>
                  <video src={talkingHeadUrl} controls style={{ width: "100%", maxHeight: 280, borderRadius: 10, marginBottom: 10, display: "block" }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>Added as Scene 1 in assembly</span>
                    <button onClick={() => { setTalkingHeadUrl(null); setPortraitForLipSync(null); }} style={{ ...btnSm, fontSize: 9, marginLeft: "auto" }}>
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Video Assembly Panel — Media ordering */}
          <div style={{ ...cardStyle, borderColor: "#a855f720" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={sectionLabel}>Media Assembly</p>
                <p style={{ fontSize: 11, color: ds.color.mute }}>
                  Drag to reorder, or use arrows. {mediaOrder.length} clip{mediaOrder.length !== 1 ? "s" : ""}.
                </p>
              </div>
              {mediaOrder.length > 1 && (
                <button
                  onClick={() => {
                    // Fisher-Yates shuffle
                    const shuffled = [...mediaOrder];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    setMediaOrder(shuffled);
                  }}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #a855f730", background: "#a855f708", color: "#a855f7", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  Shuffle
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mediaOrder.map((id, idx) => {
                const m = media.find(x => x.id === id);
                if (!m) return null;
                const trim = trimSettings[id] || { start: 0, end: 0 };
                return (
                  <div key={id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData("text/plain", id); e.currentTarget.style.opacity = "0.5"; }}
                    onDragEnd={e => { e.currentTarget.style.opacity = "1"; }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#a855f7"; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = ds.color.line2; }}
                    onDrop={e => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = ds.color.line2;
                      const dragId = e.dataTransfer.getData("text/plain");
                      if (dragId && dragId !== id) {
                        const newOrder = [...mediaOrder];
                        const fromIdx = newOrder.indexOf(dragId);
                        const toIdx = newOrder.indexOf(id);
                        if (fromIdx >= 0 && toIdx >= 0) {
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, dragId);
                          setMediaOrder(newOrder);
                        }
                      }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 10,
                      background: ds.color.paper, border: `1px solid ds.color.line2`,
                      cursor: "grab", transition: "border-color 0.15s",
                    }}>
                    {/* Drag handle + reorder buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        onClick={() => {
                          if (idx === 0) return;
                          const newOrder = [...mediaOrder];
                          [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                          setMediaOrder(newOrder);
                        }}
                        disabled={idx === 0}
                        style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid ds.color.line2", background: "transparent", color: idx === 0 ? ds.color.line2 : "#a0a0c0", cursor: idx === 0 ? "default" : "pointer" }}>
                        ▲
                      </button>
                      <button
                        onClick={() => {
                          if (idx === mediaOrder.length - 1) return;
                          const newOrder = [...mediaOrder];
                          [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                          setMediaOrder(newOrder);
                        }}
                        disabled={idx === mediaOrder.length - 1}
                        style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid ds.color.line2", background: "transparent", color: idx === mediaOrder.length - 1 ? ds.color.line2 : "#a0a0c0", cursor: idx === mediaOrder.length - 1 ? "default" : "pointer" }}>
                        ▼
                      </button>
                    </div>

                    {/* Thumbnail */}
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, border: `1px solid ds.color.line2` }}>
                      {m.type === "image" ? (
                        <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: ds.color.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
                      <p style={{ fontSize: 10, color: ds.color.mute }}>{m.type === "video" ? "Video clip" : "Image"}</p>
                    </div>

                    {/* Trim controls */}
                    {m.type === "video" && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div>
                          <label style={{ fontSize: 8, color: "#505070", display: "block" }}>Start (s)</label>
                          <input type="number" min={0} step={0.1} value={trim.start}
                            onChange={e => setTrimSettings(prev => ({ ...prev, [id]: { ...trim, start: parseFloat(e.target.value) || 0 } }))}
                            style={{ width: 50, fontSize: 11, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 8, color: "#505070", display: "block" }}>End (s)</label>
                          <input type="number" min={0} step={0.1} value={trim.end}
                            onChange={e => setTrimSettings(prev => ({ ...prev, [id]: { ...trim, end: parseFloat(e.target.value) || 0 } }))}
                            style={{ width: 50, fontSize: 11, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                        </div>
                      </div>
                    )}

                    {/* Remove button */}
                    <button onClick={() => {
                      setMediaOrder(prev => prev.filter(x => x !== id));
                    }} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#f87171", cursor: "pointer", fontWeight: 700 }}>
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Text Overlay Designer */}
          <div style={{ ...cardStyle, borderColor: "#a855f720" }}>
            <p style={sectionLabel}>Text Overlays</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {textOverlays.map((overlay, idx) => (
                <div key={idx} style={{ background: ds.color.paper, borderRadius: 10, padding: 14, border: "1px solid ds.color.line2" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, color: "#a855f7", fontWeight: 600 }}>Overlay {idx + 1}</p>
                    <button onClick={() => setTextOverlays(prev => prev.filter((_, i) => i !== idx))}
                      style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#f87171", cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                  <textarea value={overlay.text}
                    onChange={e => {
                      const updated = [...textOverlays];
                      updated[idx] = { ...overlay, text: e.target.value };
                      setTextOverlays(updated);
                    }}
                    rows={2}
                    style={{ width: "100%", fontSize: 12, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 6, padding: "8px 10px", outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {/* Position */}
                    <div>
                      <label style={{ fontSize: 8, color: "#505070", display: "block", marginBottom: 4 }}>Position</label>
                      <select value={overlay.position}
                        onChange={e => { const updated = [...textOverlays]; updated[idx] = { ...overlay, position: e.target.value }; setTextOverlays(updated); }}
                        style={{ fontSize: 10, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }}>
                        <option value="top">Top</option>
                        <option value="center">Center</option>
                        <option value="bottom">Bottom</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-center">Bottom Center</option>
                      </select>
                    </div>
                    {/* Font size */}
                    <div>
                      <label style={{ fontSize: 8, color: "#505070", display: "block", marginBottom: 4 }}>Size</label>
                      <input type="number" min={10} max={72} value={overlay.fontSize}
                        onChange={e => { const updated = [...textOverlays]; updated[idx] = { ...overlay, fontSize: parseInt(e.target.value) || 16 }; setTextOverlays(updated); }}
                        style={{ width: 50, fontSize: 10, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                    </div>
                    {/* Animation */}
                    <div>
                      <label style={{ fontSize: 8, color: "#505070", display: "block", marginBottom: 4 }}>Animation</label>
                      <select value={overlay.animation}
                        onChange={e => { const updated = [...textOverlays]; updated[idx] = { ...overlay, animation: e.target.value }; setTextOverlays(updated); }}
                        style={{ fontSize: 10, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }}>
                        <option value="fade">Fade</option>
                        <option value="typewriter">Typewriter</option>
                        <option value="slide_up">Slide Up</option>
                        <option value="pop">Pop</option>
                      </select>
                    </div>
                    {/* Timing */}
                    <div>
                      <label style={{ fontSize: 8, color: "#505070", display: "block", marginBottom: 4 }}>In (s)</label>
                      <input type="number" min={0} step={0.5} value={overlay.inTime}
                        onChange={e => { const updated = [...textOverlays]; updated[idx] = { ...overlay, inTime: parseFloat(e.target.value) || 0 }; setTextOverlays(updated); }}
                        style={{ width: 50, fontSize: 10, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 8, color: "#505070", display: "block", marginBottom: 4 }}>Out (s)</label>
                      <input type="number" min={0} step={0.5} value={overlay.outTime}
                        onChange={e => { const updated = [...textOverlays]; updated[idx] = { ...overlay, outTime: parseFloat(e.target.value) || 0 }; setTextOverlays(updated); }}
                        style={{ width: 50, fontSize: 10, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setTextOverlays(prev => [...prev, { text: "", position: "bottom-center", fontSize: 16, animation: "fade", inTime: 0, outTime: 3 }])}
                style={{ ...btnSm, textAlign: "center" }}>
                + Add Text Overlay
              </button>
            </div>
          </div>

          {/* 4. Intro / Outro Controls */}
          <div style={{ ...cardStyle, borderColor: "#a855f720" }}>
            <p style={sectionLabel}>Intro & Outro</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Intro */}
              <div style={{ background: ds.color.paper, borderRadius: 10, padding: 14, border: "1px solid ds.color.line2" }}>
                <p style={{ fontSize: 11, color: ds.color.ink, fontWeight: 600, marginBottom: 8 }}>Intro</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {[
                    { id: "fade_from_black", label: "Fade from Black" },
                    { id: "title_card", label: "Title Card" },
                    { id: "logo_reveal", label: "Logo Reveal" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setIntroType(introType === t.id ? null : t.id)}
                      style={{ ...btnSm, fontSize: 10, background: introType === t.id ? "#a855f715" : "transparent", borderColor: introType === t.id ? "#a855f7" : ds.color.line2, color: introType === t.id ? "#a855f7" : ds.color.mute }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {introType && (
                  <div>
                    <label style={{ fontSize: 9, color: "#505070" }}>Duration (s): </label>
                    <input type="number" min={1} max={10} value={introDuration}
                      onChange={e => setIntroDuration(parseInt(e.target.value) || 3)}
                      style={{ width: 50, fontSize: 11, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                  </div>
                )}
              </div>
              {/* Outro */}
              <div style={{ background: ds.color.paper, borderRadius: 10, padding: 14, border: "1px solid ds.color.line2" }}>
                <p style={{ fontSize: 11, color: ds.color.ink, fontWeight: 600, marginBottom: 8 }}>Outro</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {[
                    { id: "cta_card", label: "CTA Card" },
                    { id: "subscribe", label: "Subscribe" },
                    { id: "logo", label: "Logo" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setOutroType(outroType === t.id ? null : t.id)}
                      style={{ ...btnSm, fontSize: 10, background: outroType === t.id ? "#a855f715" : "transparent", borderColor: outroType === t.id ? "#a855f7" : ds.color.line2, color: outroType === t.id ? "#a855f7" : ds.color.mute }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {outroType && (
                  <div>
                    <label style={{ fontSize: 9, color: "#505070" }}>Duration (s): </label>
                    <input type="number" min={1} max={10} value={outroDuration}
                      onChange={e => setOutroDuration(parseInt(e.target.value) || 3)}
                      style={{ width: 50, fontSize: 11, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Music Selection */}
          <div style={{ ...cardStyle, borderColor: "#a855f720" }}>
            <p style={sectionLabel}>Background Music</p>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 10 }}>
              Mood: {draft.music_mood || "Not set"} &middot; Genre: {draft.music_genre || "Auto"}
            </p>
            {!musicUrl ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Generate Music */}
                <button
                  onClick={async () => {
                    setGeneratingMusic(true);
                    setErrorMsg(null);
                    try {
                      const res = await fetch("/api/music/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mood: draft.music_mood, genre: draft.music_genre, duration: 30 }),
                      });
                      const data = await res.json();
                      if (!res.ok || data.error) {
                        setErrorMsg(`Music generation failed: ${data.error || `HTTP ${res.status}`}`);
                      } else if (data.audioUrl || data.url) {
                        setMusicUrl(data.audioUrl || data.url);
                      } else {
                        setErrorMsg("Music generation returned no audio URL");
                      }
                    } catch (err) {
                      setErrorMsg(`Music generation failed: ${err instanceof Error ? err.message : "Network error"}`);
                    }
                    setGeneratingMusic(false);
                  }}
                  disabled={generatingMusic}
                  style={{ ...btnPrimary, background: generatingMusic ? ds.color.line2 : "#a855f7" }}
                >
                  {generatingMusic ? "Generating music..." : "Generate Background Music"}
                </button>

                {/* Upload Music from File */}
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 14px", borderRadius: 10, border: "1px solid ds.color.line2",
                    background: ds.color.paper, color: ds.color.ink, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    <span></span> Upload Music File
                    <input type="file" accept="audio/*" style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setGeneratingMusic(true);
                        setErrorMsg(null);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("category", "music");
                          const res = await fetch("/api/upload/audio", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.url || data.audioUrl || data.filePath) {
                            setMusicUrl(data.url || data.audioUrl || `/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`);
                          } else {
                            setErrorMsg("Upload succeeded but no URL returned");
                          }
                        } catch (err) {
                          setErrorMsg(`Music upload failed: ${err instanceof Error ? err.message : "Error"}`);
                        }
                        setGeneratingMusic(false);
                      }}
                    />
                  </label>

                  {/* Browse SFX Library for music tracks */}
                  <a href="/dashboard/sfx-library?selectMode=music&returnTo=auto-creator"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 14px", borderRadius: 10, border: "1px solid #a855f720",
                      background: "#a855f708", color: "#a855f7", fontSize: 12, fontWeight: 600,
                      textDecoration: "none", cursor: "pointer",
                    }}>
                    <span></span> Browse Music Library
                  </a>
                </div>

                <p style={{ fontSize: 9, color: "#505070" }}>
                  Generate AI music, upload your own MP3/WAV, or browse the SFX Library to pick a track.
                </p>
              </div>
            ) : (
              <div>
                <audio src={musicUrl} controls style={{ width: "100%", height: 40, marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setMusicUrl(null)} style={{ ...btnSm, fontSize: 10, flex: 1 }}>
                    Re-generate Music
                  </button>
                  <label style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "6px 10px", borderRadius: 6, border: "1px solid ds.color.line2",
                    background: "transparent", color: ds.color.mute, fontSize: 10, cursor: "pointer",
                  }}>
                    Replace (Upload)
                    <input type="file" accept="audio/*" style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("category", "music");
                          const res = await fetch("/api/upload/audio", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.url || data.audioUrl || data.filePath) {
                            setMusicUrl(data.url || data.audioUrl || `/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`);
                          }
                        } catch { /* ignore */ }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 6. SFX Quick Add */}
          <div style={{ ...cardStyle, borderColor: "#a855f720" }}>
            <p style={sectionLabel}>Sound Effects</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {[
                { event: "whoosh", label: "Whoosh" },
                { event: "impact", label: "Impact" },
                { event: "notification", label: "Notification" },
                { event: "transition", label: "Transition" },
                { event: "sparkle", icon: "⭐", label: "Sparkle" },
                { event: "applause", label: "Applause" },
              ].map(sfx => (
                <button key={sfx.event}
                  onClick={() => setSfxList(prev => [...prev, { event: sfx.event, time: 0 }])}
                  style={{ ...btnSm, display: "flex", alignItems: "center", gap: 6 }}>
                  {sfx.label}
                </button>
              ))}
            </div>
            {sfxList.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sfxList.map((sfx, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: ds.color.paper, border: "1px solid ds.color.line2" }}>
                    <span style={{ fontSize: 12, color: ds.color.ink, flex: 1 }}>{sfx.event}</span>
                    <label style={{ fontSize: 9, color: "#505070" }}>at</label>
                    <input type="number" min={0} step={0.5} value={sfx.time}
                      onChange={e => {
                        const updated = [...sfxList];
                        updated[idx] = { ...sfx, time: parseFloat(e.target.value) || 0 };
                        setSfxList(updated);
                      }}
                      style={{ width: 50, fontSize: 10, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "4px 6px", outline: "none" }} />
                    <label style={{ fontSize: 9, color: "#505070" }}>s</label>
                    <button onClick={() => setSfxList(prev => prev.filter((_, i) => i !== idx))}
                      style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#f87171", cursor: "pointer" }}>
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Build Video button */}
          <button
            onClick={async () => {
              setBuildingVideo(true);
              setErrorMsg(null);
              try {
                // Step 1: Upload each media file — images via /api/upload/logo, videos via /api/upload/video
                const uploadedScenes: { scene: number; videoUrl: string; duration: number; text?: string; background?: string }[] = [];

                for (let i = 0; i < mediaOrder.length; i++) {
                  const id = mediaOrder[i];
                  const m = media.find(x => x.id === id);
                  if (!m) continue;

                  const isImage = m.type === "image" || m.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(m.name);
                  const isVideo = m.type === "video" || m.type.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(m.name);

                  let url = "";
                  let duration = 5;

                  // Use server URL if already uploaded (from previous upload or resume)
                  if (m.serverUrl) {
                    url = m.serverUrl;
                    duration = isImage ? 5 : 10;
                  } else if (isImage) {
                    // Upload image via /api/upload/logo (accepts images)
                    const fd = new FormData();
                    fd.append("file", m.file);
                    const uploadRes = await fetch("/api/upload/logo", { method: "POST", body: fd });
                    const uploadData = await uploadRes.json();
                    if (!uploadRes.ok || uploadData.error) {
                      setErrorMsg(`Upload failed for ${m.name}: ${uploadData.error || "Unknown error"}`);
                      setBuildingVideo(false);
                      return;
                    }
                    url = uploadData.url || `/api/media/${(uploadData.filePath || "").replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
                    duration = 5;
                  } else if (isVideo) {
                    // Upload video
                    const fd = new FormData();
                    fd.append("file", m.file);
                    const uploadRes = await fetch("/api/upload/video", { method: "POST", body: fd });
                    const uploadData = await uploadRes.json();
                    if (!uploadRes.ok || uploadData.error) {
                      setErrorMsg(`Upload failed for ${m.name}: ${uploadData.error || "Unknown error"}`);
                      setBuildingVideo(false);
                      return;
                    }
                    url = uploadData.url || `/api/media/${(uploadData.filePath || "").replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
                    duration = uploadData.duration || 10;
                  } else {
                    setErrorMsg(`Unsupported file type: ${m.name} (${m.type})`);
                    setBuildingVideo(false);
                    return;
                  }

                  const trim = trimSettings[id] || { start: 0, end: 0 };
                  // Find text overlay for this scene
                  const overlay = textOverlays.find(ov => ov.inTime >= (i * 5) && ov.inTime < ((i + 1) * 5));
                  // For images: use caption from draft as overlay text if no specific overlay
                  const sceneText = overlay?.text || (isImage ? (draft.caption || draft.title || "") : undefined);

                  if (isImage) {
                    // Image scenes: use img: prefix so assemble API converts to video slide
                    uploadedScenes.push({
                      scene: i + 1,
                      videoUrl: `img:${url}`,
                      duration: trim.end > 0 ? (trim.end - trim.start) : duration,
                      text: sceneText,
                    });
                  } else {
                    uploadedScenes.push({
                      scene: i + 1,
                      videoUrl: url,
                      duration: trim.end > 0 ? (trim.end - trim.start) : duration,
                      text: overlay?.text,
                    });
                  }
                }

                if (uploadedScenes.length === 0) {
                  setErrorMsg("No media files to assemble");
                  setBuildingVideo(false);
                  return;
                }

                // Step 2: Call assemble API with JSON (not FormData)
                const assemblyPayload = {
                  title: draft.title,
                  scenes: uploadedScenes,
                  musicUrl: musicUrl || undefined,
                  narrationUrl: narrationAudioUrl || undefined,
                  musicVolume: 0.3,
                  narrationVolume: 0.8,
                  sfx: sfxList.map(s => ({
                    sourceUrl: `/api/media/sfx/${s.event}.mp3`,
                    startTime: s.time,
                    volume: 0.6,
                  })),
                  aspectRatio: draft.aspect_ratio || "9:16",
                  outputFormat: "mp4" as const,
                };

                const res = await fetch("/api/video/assemble", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(assemblyPayload),
                });
                const data = await res.json();
                if (!res.ok || data.error) {
                  setErrorMsg(`Video build failed: ${data.error || `HTTP ${res.status}`}`);
                } else if (data.outputUrl || data.videoUrl) {
                  setAssembledVideoUrl(data.outputUrl || data.videoUrl);
                  setStep(7);
                } else {
                  setErrorMsg("Assembly completed but no video URL returned");
                }
              } catch (err) {
                setErrorMsg(`Video build failed: ${err instanceof Error ? err.message : "Network error"}`);
              }
              setBuildingVideo(false);
            }}
            disabled={buildingVideo || mediaOrder.length === 0}
            style={{ ...btnPrimary, background: (buildingVideo || mediaOrder.length === 0) ? ds.color.line2 : "#a855f7", fontSize: 16, padding: "18px 28px" }}
          >
            {buildingVideo ? "Building video..." : `Build Video (${mediaOrder.length} clips)`}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 7 — Preview & Polish */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 7 && draft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ ...sectionLabel, color: "#00d4ff" }}>Step 7 — Preview & Polish</p>
              <p style={{ fontSize: 12, color: ds.color.mute }}>Review your assembled video and fine-tune</p>
            </div>
            <button onClick={() => setStep(6)} style={btnSm}>Back to Build</button>
          </div>

          {/* Video Player */}
          <div style={{ ...cardStyle, borderColor: "#00d4ff20" }}>
            <p style={sectionLabel}>Video Preview</p>
            {assembledVideoUrl ? (
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 16 }}>
                <video
                  src={assembledVideoUrl}
                  controls
                  style={{ width: "100%", maxHeight: 480, display: "block" }}
                />
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: "center", background: ds.color.card, borderRadius: 12, marginBottom: 16 }}>
                <p style={{ fontSize: 16, marginBottom: 8 }}></p>
                <p style={{ fontSize: 13, color: ds.color.ink, fontWeight: 600, marginBottom: 4 }}>No video built yet</p>
                <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12 }}>Go back to Build step to create your video</p>
                <button onClick={() => setStep(6)} style={{ ...btnPrimary, background: "#a855f7" }}>Back to Build</button>
              </div>
            )}

            {/* Re-trim controls */}
            {showRetrim && (
              <div style={{ background: ds.color.paper, borderRadius: 10, padding: 14, border: "1px solid ds.color.line2", marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: "#00d4ff", fontWeight: 600, marginBottom: 8 }}>Trim Video</p>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: 9, color: "#505070", display: "block", marginBottom: 4 }}>Start (s)</label>
                    <input type="number" min={0} step={0.5} value={retrimStart}
                      onChange={e => setRetrimStart(parseFloat(e.target.value) || 0)}
                      style={{ width: 70, fontSize: 12, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "6px 8px", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "#505070", display: "block", marginBottom: 4 }}>End (s)</label>
                    <input type="number" min={0} step={0.5} value={retrimEnd}
                      onChange={e => setRetrimEnd(parseFloat(e.target.value) || 0)}
                      style={{ width: 70, fontSize: 12, color: ds.color.ink, background: ds.color.card, border: "1px solid ds.color.line2", borderRadius: 4, padding: "6px 8px", outline: "none" }} />
                  </div>
                </div>
              </div>
            )}
            <button onClick={() => setShowRetrim(!showRetrim)}
              style={{ ...btnSm, marginBottom: 12 }}>
              {showRetrim ? "Hide Trim Controls" : "Re-trim"}
            </button>
          </div>

          {/* Volume Sliders */}
          <div style={{ ...cardStyle, borderColor: "#00d4ff20" }}>
            <p style={sectionLabel}>Audio Levels</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: ds.color.ink }}>Narration Volume</label>
                  <span style={{ fontSize: 11, color: "#00d4ff" }}>{narrationVolume}%</span>
                </div>
                <input type="range" min={0} max={100} value={narrationVolume}
                  onChange={e => setNarrationVolume(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#00d4ff" }} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: ds.color.ink }}>Music Volume</label>
                  <span style={{ fontSize: 11, color: "#00d4ff" }}>{musicVolume}%</span>
                </div>
                <input type="range" min={0} max={100} value={musicVolume}
                  onChange={e => setMusicVolume(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "#00d4ff" }} />
              </div>
            </div>
          </div>

          {/* Quality Selector */}
          <div style={{ ...cardStyle, borderColor: "#00d4ff20" }}>
            <p style={sectionLabel}>Render Quality</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {([
                { id: "draft" as const, label: "Draft", desc: "Fast preview" },
                { id: "standard" as const, label: "Standard", desc: "Balanced quality" },
                { id: "premium" as const, label: "Premium", desc: "Best quality" },
              ]).map(q => (
                <button key={q.id} onClick={() => setQualityTier(q.id)}
                  style={{
                    padding: "14px 10px", borderRadius: 10, border: `1px solid ${qualityTier === q.id ? "#00d4ff" : ds.color.line2}`,
                    background: qualityTier === q.id ? "#00d4ff10" : "transparent", cursor: "pointer", textAlign: "center",
                  }}>
                  
                  <p style={{ fontSize: 12, fontWeight: 700, color: qualityTier === q.id ? "#00d4ff" : ds.color.ink }}>{q.label}</p>
                  <p style={{ fontSize: 9, color: "#505070" }}>{q.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Caption (Text on Screen) */}
          {assembledVideoUrl && (
            <div style={{ ...cardStyle, borderColor: "rgba(234,179,8,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={sectionLabel}>Text on Screen (Auto-Captions)</p>
                <span style={{ fontSize: 9, color: "#eab308", padding: "3px 8px", borderRadius: 20, background: "rgba(234,179,8,0.1)", fontWeight: 600 }}>Whisper AI</span>
              </div>
              <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12 }}>
                Auto-transcribe your video and burn bold word-by-word captions — CapCut / TikTok style.
              </p>

              {/* Style picker */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {([
                  { id: "tiktok" as const, label: "TikTok Bold", color: "#00F2EA" },
                  { id: "bold_white" as const, label: "Impact White", color: "#ffffff" },
                  { id: "youtube" as const, label: "YouTube", color: "#FF0000" },
                  { id: "neon" as const, label: "Neon", color: "#00FFFF" },
                  { id: "minimal" as const, label: "Minimal", color: "#888888" },
                ]).map(s => (
                  <button key={s.id} onClick={() => setCaptionStyle(s.id)}
                    style={{
                      ...btnSm, fontSize: 10,
                      borderColor: captionStyle === s.id ? s.color : ds.color.line2,
                      color: captionStyle === s.id ? s.color : ds.color.mute,
                      background: captionStyle === s.id ? `${s.color}12` : "transparent",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>

              {captionedVideoUrl ? (
                <div>
                  <video src={captionedVideoUrl} controls style={{ width: "100%", maxHeight: 260, borderRadius: 10, marginBottom: 8, display: "block" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setAssembledVideoUrl(captionedVideoUrl); setCaptionedVideoUrl(null); }}
                      style={{ ...btnSm, fontSize: 10, flex: 1, textAlign: "center", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }}>
                      Use as Final Video
                    </button>
                    <button onClick={() => setCaptionedVideoUrl(null)} style={{ ...btnSm, fontSize: 10 }}>
                      Redo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={burningCaptions}
                  onClick={async () => {
                    setBurningCaptions(true);
                    setErrorMsg(null);
                    try {
                      const res = await fetch("/api/video/burn-captions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          videoUrl: assembledVideoUrl,
                          transcribe: true,
                          style: captionStyle,
                          position: "bottom",
                          wordsPerGroup: 3,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok || data.error) {
                        setErrorMsg(`Caption burn failed: ${data.error || `HTTP ${res.status}`}`);
                      } else if (data.outputUrl) {
                        setCaptionedVideoUrl(data.outputUrl);
                      }
                    } catch (err) {
                      setErrorMsg(`Caption burn failed: ${err instanceof Error ? err.message : "Network error"}`);
                    }
                    setBurningCaptions(false);
                  }}
                  style={{ ...btnPrimary, background: burningCaptions ? ds.color.line2 : "#eab308", color: "#000", fontWeight: 800 }}>
                  {burningCaptions ? "Transcribing + burning captions..." : "Burn Captions onto Video"}
                </button>
              )}
            </div>
          )}

          {/* Rebuild button */}
          <button
            onClick={async () => {
              setBuildingVideo(true);
              setErrorMsg(null);
              try {
                // Re-upload media files and reassemble with new volume/quality settings
                const uploadedScenes: { scene: number; videoUrl: string; duration: number }[] = [];

                for (let i = 0; i < mediaOrder.length; i++) {
                  const id = mediaOrder[i];
                  const m = media.find(x => x.id === id);
                  if (!m) continue;

                  const fd = new FormData();
                  fd.append("file", m.file);
                  const uploadRes = await fetch("/api/upload/video", { method: "POST", body: fd });
                  const uploadData = await uploadRes.json();
                  if (!uploadRes.ok) continue;

                  const url = uploadData.url || `/api/media/${(uploadData.filePath || "").replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
                  const trim = trimSettings[id] || { start: 0, end: 0 };
                  uploadedScenes.push({
                    scene: i + 1,
                    videoUrl: url,
                    duration: trim.end > 0 ? (trim.end - trim.start) : (uploadData.duration || 5),
                  });
                }

                if (uploadedScenes.length === 0 && assembledVideoUrl) {
                  // Use existing assembled video as single scene for re-trim/volume adjust
                  uploadedScenes.push({ scene: 1, videoUrl: assembledVideoUrl, duration: 30 });
                }

                const assemblyPayload = {
                  title: draft.title,
                  scenes: uploadedScenes,
                  musicUrl: musicUrl || undefined,
                  narrationUrl: narrationAudioUrl || undefined,
                  musicVolume: musicVolume / 100,
                  narrationVolume: narrationVolume / 100,
                  sfx: sfxList.map(s => ({
                    sourceUrl: `/api/media/sfx/${s.event}.mp3`,
                    startTime: s.time,
                    volume: 0.6,
                  })),
                  aspectRatio: draft.aspect_ratio || "9:16",
                  outputFormat: "mp4" as const,
                };

                const res = await fetch("/api/video/assemble", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(assemblyPayload),
                });
                const data = await res.json();
                if (!res.ok || data.error) {
                  setErrorMsg(`Rebuild failed: ${data.error || `HTTP ${res.status}`}`);
                } else if (data.outputUrl || data.videoUrl) {
                  setAssembledVideoUrl(data.outputUrl || data.videoUrl);
                }
              } catch (err) {
                setErrorMsg(`Rebuild failed: ${err instanceof Error ? err.message : "Network error"}`);
              }
              setBuildingVideo(false);
            }}
            disabled={buildingVideo}
            style={{ ...btnPrimary, background: buildingVideo ? ds.color.line2 : "#00d4ff", color: "#000", fontWeight: 800 }}
          >
            {buildingVideo ? "Rebuilding..." : "Rebuild with Adjustments"}
          </button>

          <button onClick={() => setStep(8)}
            style={{ ...btnPrimary, background: "#22c55e", color: "#000", fontWeight: 800 }}>
            Next — Export & Publish
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 8 — Export & Publish */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 8 && draft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ ...sectionLabel, color: "#22c55e" }}>Step 8 — Export & Publish</p>
              <p style={{ fontSize: 12, color: ds.color.mute }}>Download, save, or send your content for review</p>
            </div>
            <button onClick={() => setStep(7)} style={btnSm}>Back to Preview</button>
          </div>

          {/* Video preview card */}
          {assembledVideoUrl && (
            <div style={{ ...cardStyle, borderColor: "#22c55e20" }}>
              <p style={sectionLabel}>Final Video</p>
              <video src={assembledVideoUrl} controls
                style={{ width: "100%", maxHeight: 320, borderRadius: 10, display: "block", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: ds.color.ink, flex: 1 }}>{draft.title}</span>
                <span style={{ fontSize: 10, color: "#22c55e", padding: "3px 10px", borderRadius: 20, background: "rgba(34,197,94,0.12)", fontWeight: 600 }}>
                  Ready
                </span>
              </div>
            </div>
          )}

          {/* Save to library confirmation */}
          {savedToLibrary && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
            }}>
              <span style={{ fontSize: 14 }}></span>
              <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Saved to Asset Library & All Content</p>
            </div>
          )}

          {/* Primary actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => {
              if (!savedToLibrary) await saveToLibrary();
              if (assembledVideoUrl) {
                // Download the assembled video
                const a = document.createElement("a");
                a.href = assembledVideoUrl;
                a.download = `ghs_video_${Date.now()}.mp4`;
                a.click();
              } else {
                // Fallback: download draft JSON
                const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `ghs_content_${Date.now()}.json`; a.click();
                URL.revokeObjectURL(url);
              }
            }} style={{ ...btnPrimary, flex: 1, background: "#22c55e", color: "#000", fontWeight: 800 }}>
              ⬇ Download Content
            </button>
            <button onClick={saveToLibrary}
              disabled={savingToLibrary || savedToLibrary}
              style={{
                ...btnPrimary, flex: 1,
                background: savedToLibrary ? "rgba(34,197,94,0.1)" : accent,
                color: savedToLibrary ? "#22c55e" : "#fff",
                opacity: savedToLibrary ? 0.7 : 1,
              }}>
              {savingToLibrary ? "Saving..." : savedToLibrary ? "Saved to Library" : "Render to Library"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sendToReview}
              style={{ ...btnPrimary, flex: 1, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
              Send to Review
            </button>
            <button disabled style={{ ...btnPrimary, flex: 1, opacity: 0.4, background: ds.color.paper, color: ds.color.mute, border: "1px solid ds.color.line2" }}>
              Post on Social (Coming Soon)
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(6)}
              style={{ ...btnSm, flex: 1, textAlign: "center" }}>
              Regenerate (Back to Build)
            </button>
            <button onClick={() => setStep(5)}
              style={{ ...btnSm, flex: 1, textAlign: "center" }}>
              Back to Script
            </button>
          </div>
        </div>
      )}

      {/* ═══ Content Rights Agreement Dialog ═══ */}
      {showRightsDialog && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        }} onClick={() => { setShowRightsDialog(false); setPendingFiles(null); }}>
          <div style={{
            background: "#141420", border: "1px solid ds.color.line2", borderRadius: 16,
            padding: 28, maxWidth: 520, width: "90%", maxHeight: "80vh", overflowY: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}></span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Content Rights Agreement</h3>
            </div>

            <div style={{ fontSize: 12, color: "#a0a0c0", lineHeight: 1.7, marginBottom: 16 }}>
              <p style={{ marginBottom: 10 }}>Before importing content into GioHomeStudio, please confirm:</p>
              <div style={{ background: ds.color.paper, borderRadius: 10, padding: 14, border: "1px solid ds.color.line2", marginBottom: 10 }}>
                <p style={{ fontWeight: 600, color: ds.color.ink, marginBottom: 6 }}>I confirm that:</p>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li style={{ marginBottom: 4 }}>I own or have permission to use this content</li>
                  <li style={{ marginBottom: 4 }}>This content does not infringe on anyone&apos;s copyright</li>
                  <li style={{ marginBottom: 4 }}>I am not uploading someone else&apos;s images, videos, or creative work without their permission</li>
                  <li style={{ marginBottom: 4 }}>I accept responsibility for the content I create using these materials</li>
                  <li>I understand that GioHomeStudio is not liable for content I publish</li>
                </ul>
              </div>
              <p style={{ color: "#f59e0b", fontSize: 11 }}>
                Uploading copyrighted content without permission may result in legal consequences. GioHomeStudio does not claim ownership of your uploaded content.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowRightsDialog(false); setPendingFiles(null); }}
                style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid ds.color.line2", background: "transparent", color: "#7070a0", fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirmRightsAndProceed}
                style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "none", background: "#22c55e", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                I Agree — Import Content
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
