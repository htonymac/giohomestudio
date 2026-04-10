"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import exifr from "exifr";

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
  exif?: ExifData;
}

interface DetectedActivity {
  label: string;
  confidence: string;
  icon: string;
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
  { id: "instagram",  label: "Instagram",  icon: "📷", color: "#E1306C", formats: ["Reel", "Post", "Story", "Carousel"], bestRatio: "9:16" },
  { id: "tiktok",     label: "TikTok",     icon: "🎵", color: "#00F2EA", formats: ["Short Video", "Photo Post"], bestRatio: "9:16" },
  { id: "youtube",    label: "YouTube",    icon: "📺", color: "#FF0000", formats: ["Shorts", "Video", "Thumbnail"], bestRatio: "16:9" },
  { id: "facebook",   label: "Facebook",   icon: "📘", color: "#1877F2", formats: ["Reel", "Post", "Story"], bestRatio: "1:1" },
  { id: "threads",    label: "Threads",    icon: "🧵", color: "#000000", formats: ["Text + Image", "Carousel"], bestRatio: "1:1" },
  { id: "whatsapp",   label: "WhatsApp Status", icon: "💬", color: "#25D366", formats: ["Status Image", "Status Video"], bestRatio: "9:16" },
];

const STYLE_COLORS: Record<string, string> = {
  classy: "#d4a843", luxury: "#a855f7", hype: "#ef4444", storytelling: "#3b82f6",
  cinematic: "#6366f1", minimalist: "#6b7280", premium_business: "#10b981",
  playful: "#f97316", direct_sales: "#dc2626", spiritual: "#8b5cf6",
};

// ── Shared styles ────────────────────────────────────────────────────────────

const panelBg = "#0e0e1a";
const border = "#1e1e30";
const accent = "#7c5cfc";

const cardStyle: React.CSSProperties = { background: panelBg, border: `1px solid ${border}`, borderRadius: 14, padding: 24 };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6060a0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 };
const btnPrimary: React.CSSProperties = { padding: "14px 28px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" };
const btnSm: React.CSSProperties = { fontSize: 12, padding: "8px 14px", borderRadius: 8, border: `1px solid #2a2a40`, background: "#1a1a2e", color: "#a080ff", cursor: "pointer", fontWeight: 600 };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AIContentCreatorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

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
  const [voiceMode, setVoiceMode] = useState<"none" | "ai" | "record">("none");
  const [recording, setRecording] = useState(false);
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Session recovery (localStorage) ──
  const STORAGE_KEY = "ghs_ai_creator_session";
  const [showResume, setShowResume] = useState(false);

  // Save session on every meaningful state change
  useEffect(() => {
    if (step === 1 && !selectedPlatform) return; // don't save empty state
    const session = {
      step,
      selectedPlatform,
      selectedFormat,
      // media files can't be stored — save names for context
      mediaNames: media.map(m => ({ id: m.id, name: m.name, type: m.type })),
      detectedActivities,
      suggestions,
      selectedSuggestion,
      draft,
      sugProvider,
      savedAt: Date.now(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* ignore */ }
  }, [step, selectedPlatform, selectedFormat, media, detectedActivities, suggestions, selectedSuggestion, draft, sugProvider]);

  // Check for saved session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      // Only show resume if session is less than 24 hours old and past step 1
      const age = Date.now() - (session.savedAt ?? 0);
      if (age < 24 * 60 * 60 * 1000 && session.step > 1) {
        setShowResume(true);
      }
    } catch { /* ignore */ }
  }, []);

  function resumeSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.selectedPlatform) setSelectedPlatform(s.selectedPlatform);
      if (s.selectedFormat) setSelectedFormat(s.selectedFormat);
      if (s.detectedActivities) setDetectedActivities(s.detectedActivities);
      if (s.suggestions) setSuggestions(s.suggestions);
      if (s.selectedSuggestion) setSelectedSuggestion(s.selectedSuggestion);
      if (s.draft) setDraft(s.draft);
      if (s.sugProvider) setSugProvider(s.sugProvider);
      // Media files can't be restored from localStorage — user will need to re-upload
      // But we can bring them back to the step they were on (or one step back if media-dependent)
      const resumeStep = s.step <= 2 ? (s.selectedPlatform ? 2 : 1) : s.step;
      setStep(resumeStep as 1 | 2 | 3 | 4 | 5);
      setShowResume(false);
    } catch { setShowResume(false); }
  }

  function dismissResume() {
    setShowResume(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  // ── Helpers ──

  const platform = PLATFORMS.find(p => p.id === selectedPlatform);

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

    try {
      // Upload actual image files for vision AI analysis
      const imageFiles = media.filter(m => m.type === "image").slice(0, 4);
      let analyzeData: { activities?: DetectedActivity[]; image_analysis?: unknown[] } = {};

      if (imageFiles.length > 0) {
        const fd = new FormData();
        for (const m of imageFiles) fd.append("file", m.file);
        fd.append("platform", selectedPlatform ?? "");
        fd.append("format", selectedFormat ?? "");

        const analyzeRes = await fetch("/api/auto-creator/analyze", { method: "POST", body: fd });
        analyzeData = await analyzeRes.json();
      }

      // Add EXIF-based activities
      const exifActivities: DetectedActivity[] = [];
      const withDates = media.filter(m => m.exif?.dateTaken);
      if (withDates.length > 0) exifActivities.push({ label: `Photos from ${withDates[0].exif!.dateTaken}`, confidence: "high", icon: "📅" });
      const withLocation = media.filter(m => m.exif?.location);
      if (withLocation.length > 0) exifActivities.push({ label: `Location: ${withLocation[0].exif!.location}`, confidence: "high", icon: "📍" });
      const withCamera = media.filter(m => m.exif?.camera);
      if (withCamera.length > 0) exifActivities.push({ label: `Shot on ${withCamera[0].exif!.camera}`, confidence: "high", icon: "📷" });
      const hasVideos = media.some(m => m.type === "video");
      if (hasVideos) exifActivities.push({ label: `${media.filter(m => m.type === "video").length} video clip(s)`, confidence: "high", icon: "🎥" });

      // Merge vision AI activities + EXIF activities
      const allActivities = [...(analyzeData.activities ?? []), ...exifActivities];
      if (allActivities.length === 0) {
        allActivities.push({ label: `${media.length} files ready for content`, confidence: "high", icon: "✨" });
      }
      setDetectedActivities(allActivities);
    } catch {
      setDetectedActivities([
        { label: "Media uploaded successfully", confidence: "high", icon: "✅" },
        { label: "Ready for content suggestions", confidence: "high", icon: "💡" },
      ]);
    }

    setAnalyzing(false);
    setStep(3);
  }, [media, selectedPlatform, selectedFormat]);

  // ── Step 4: Get suggestions ──
  async function getSuggestions() {
    if (suggestions.length > 0) { setStep(4); return; }
    setSuggestionsLoading(true);
    try {
      const res = await fetch("/api/auto-creator/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media: media.map(m => ({ name: m.name, type: m.type })),
          platform: selectedPlatform,
          format: selectedFormat,
          context: `Create ${selectedFormat} content for ${platform?.label}. Activities detected: ${detectedActivities.map(a => a.label).join(", ")}`,
        }),
      });
      const data = await res.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
        setSugProvider(data.provider ?? "");
      }
    } catch { /* ignore */ }
    setSuggestionsLoading(false);
    setStep(4);
  }

  // ── Step 5: Generate draft ──
  async function generateDraft(sug: Suggestion) {
    setSelectedSuggestion(sug);
    setDraftLoading(true);
    setDraft(null);
    try {
      const res = await fetch("/api/auto-creator/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion: sug,
          mediaNames: media.map(m => m.name),
          platform: selectedPlatform,
          format: selectedFormat,
          context: `Platform: ${platform?.label}, Format: ${selectedFormat}`,
        }),
      });
      const data = await res.json();
      if (data.draft) setDraft(data.draft);
    } catch { /* ignore */ }
    setDraftLoading(false);
    setStep(5);
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
      if (data.outputUrl) {
        const enhancedRes = await fetch(data.outputUrl);
        const blob = await enhancedRes.blob();
        const newFile = new File([blob], `enhanced_${m.name}`, { type: blob.type });
        setMedia(prev => prev.map(item =>
          item.id === m.id
            ? { ...item, url: URL.createObjectURL(blob), file: newFile, name: `enhanced_${m.name}` }
            : item
        ));
      }
    } catch { /* ignore */ }
    setEnhancingId(null);
  }

  // ── Edit draft fields ──
  function updateDraft(patch: Partial<Draft>) {
    setDraft(prev => prev ? { ...prev, ...patch } : prev);
  }

  // ── Navigation ──
  function sendToStudio() {
    if (!draft) return;
    clearSession();
    const params = new URLSearchParams({ prompt: draft.voice_script || draft.caption });
    window.location.href = `/dashboard?${params.toString()}`;
  }

  function sendToAdEditor() {
    if (!draft) return;
    clearSession();
    const params = new URLSearchParams({ prompt: draft.caption });
    if (platform?.bestRatio) params.set("ar", platform.bestRatio);
    window.location.href = `/dashboard/ad-editor?${params.toString()}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Hero with background video ── */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 28, minHeight: 200 }}>
        <video autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }}
          src="/api/media/intro/demo-short-reel.mp4" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(8,8,24,0.92), rgba(124,92,252,0.12))" }} />
        <div style={{ position: "relative", padding: "40px 36px" }}>
          <p style={{ fontSize: 14, color: accent, fontWeight: 600, marginBottom: 6 }}>Hi Boss!</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>
            AI Content Creator
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 500 }}>
            Turn your daily media into scroll-stopping content. Pick a platform, upload your photos or videos, and AI handles the rest — captions, hashtags, voice scripts, music.
          </p>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {[
          { n: 1, label: "Platform" },
          { n: 2, label: "Media" },
          { n: 3, label: "Analysis" },
          { n: 4, label: "Ideas" },
          { n: 5, label: "Preview" },
        ].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{
              height: 4, borderRadius: 2, marginBottom: 6,
              background: step >= s.n ? accent : "#1e1e30",
              transition: "background 0.3s",
            }} />
            <p style={{ fontSize: 9, color: step >= s.n ? accent : "#404060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>
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
            <p style={{ fontSize: 13, color: "#e0e0f0", fontWeight: 600 }}>You left off mid-session</p>
            <p style={{ fontSize: 11, color: "#6060a0" }}>Pick up where you stopped? (Media files need re-upload)</p>
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

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* STEP 1 — Where do you need content? */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={cardStyle}>
          <p style={sectionLabel}>Where do you need content?</p>
          <p style={{ fontSize: 12, color: "#6060a0", marginBottom: 20 }}>
            Select the platform so AI can optimize format, size, and caption style.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => { setSelectedPlatform(p.id); setSelectedFormat(null); }}
                style={{
                  padding: "24px 16px", borderRadius: 16, border: `2px solid ${selectedPlatform === p.id ? p.color : "transparent"}`,
                  background: selectedPlatform === p.id
                    ? `linear-gradient(135deg, ${p.color}18, ${p.color}08)`
                    : "linear-gradient(135deg, #141424, #1a1a2e)",
                  cursor: "pointer", textAlign: "center", transition: "all 0.3s",
                  boxShadow: selectedPlatform === p.id ? `0 4px 20px ${p.color}20` : "none",
                }}
                onMouseEnter={e => { if (selectedPlatform !== p.id) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
                <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>{p.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: selectedPlatform === p.id ? p.color : "#e0e0f0", display: "block" }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 10, color: selectedPlatform === p.id ? `${p.color}aa` : "#404060", display: "block", marginTop: 4 }}>
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
                      background: selectedFormat === f ? `${platform.color}20` : "#1a1a2e",
                      borderColor: selectedFormat === f ? platform.color : "#2a2a40",
                      color: selectedFormat === f ? platform.color : "#a0a0c0",
                    }}>
                    {f}
                  </button>
                ))}
              </div>
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
              <p style={{ fontSize: 12, color: "#6060a0" }}>
                {platform?.icon} {selectedFormat} for {platform?.label} &middot; Best ratio: {platform?.bestRatio}
              </p>
            </div>
            <button onClick={() => setStep(1)} style={{ ...btnSm, fontSize: 10 }}>Change Platform</button>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            style={{
              border: "2px dashed #2a2a40", borderRadius: 14, padding: "48px 20px",
              textAlign: "center", cursor: "pointer", marginBottom: 20,
              background: "rgba(124,92,252,0.03)", transition: "border-color 0.2s",
            }}
          >
            <p style={{ fontSize: 36, marginBottom: 10 }}>📸</p>
            <p style={{ fontSize: 14, color: "#e0e0f0", fontWeight: 600 }}>
              Drop your images or videos here
            </p>
            <p style={{ fontSize: 11, color: "#404060", marginTop: 6 }}>
              Photos from your outing, product shots, event clips — whatever you did today
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }}
            onChange={e => { if (e.target.files) handleFiles(e.target.files); }} />

          {/* Uploaded media grid */}
          {media.length > 0 && (
            <>
              <p style={{ ...sectionLabel, marginTop: 16 }}>Uploaded ({media.length})</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 20 }}>
                {media.map(m => (
                  <div key={m.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${border}`, aspectRatio: "1", background: "#0a0a18" }}>
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
                      {m.exif?.location && <span style={{ fontSize: 8, color: "#3b82f6", display: "block" }}>📍 {m.exif.location}</span>}
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
              background: analyzing ? "#2a2a40" : accent,
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
          <p style={{ fontSize: 12, color: "#6060a0", marginBottom: 20 }}>
            Here&apos;s what AI detected from your media today:
          </p>

          {/* Detected activities */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {detectedActivities.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 10,
                background: "#1a1a2e", border: `1px solid ${border}`,
              }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: "#e0e0f0", fontWeight: 600 }}>{a.label}</p>
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
              onClick={getSuggestions}
              disabled={suggestionsLoading}
              style={{ ...btnPrimary, flex: 2, background: suggestionsLoading ? "#2a2a40" : accent }}
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
              <p style={{ fontSize: 10, color: "#404060" }}>
                {selectedFormat} &middot; {media.length} media files &middot; {sugProvider && `AI: ${sugProvider}`}
              </p>
            </div>
            <button onClick={() => setStep(3)} style={btnSm}>Back</button>
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
                    <span style={{ fontSize: 9, color: "#404060" }}>{s.type}</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 11, color: "#8080b0", lineHeight: 1.6, marginBottom: 10 }}>{s.description}</p>
                  <p style={{ fontSize: 10, color: "#6060a0", fontStyle: "italic", marginBottom: 12, lineHeight: 1.5 }}>
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
                      background: draftLoading && selectedSuggestion?.id === s.id ? "#2a2a40" : accent,
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
            <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Caption (editable)</p>
              <textarea
                value={draft.caption}
                onChange={e => updateDraft({ caption: e.target.value })}
                rows={4}
                style={{ width: "100%", fontSize: 13, color: "#e0e0f0", lineHeight: 1.8, background: "transparent", border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 12px", resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 9, color: "#505070", marginBottom: 4 }}>Hashtags (edit below)</p>
                <input
                  value={draft.hashtags.map(h => `#${h}`).join(" ")}
                  onChange={e => updateDraft({ hashtags: e.target.value.split(/\s+/).map(t => t.replace(/^#/, "")).filter(Boolean) })}
                  style={{ width: "100%", fontSize: 11, color: accent, background: "transparent", border: "1px solid #2a2a40", borderRadius: 6, padding: "6px 10px", outline: "none" }}
                />
              </div>
            </div>

            {/* Voice script — editable */}
            <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Voice Narration Script (editable)</p>
              <textarea
                value={draft.voice_script}
                onChange={e => updateDraft({ voice_script: e.target.value })}
                rows={3}
                placeholder="Add narration script here..."
                style={{ width: "100%", fontSize: 12, color: "#a0a0c0", lineHeight: 1.8, fontStyle: "italic", background: "transparent", border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 12px", resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />
            </div>

            {/* Platform tip */}
            {draft.platform_tips && (
              <div style={{ background: "rgba(124,92,252,0.06)", border: `1px solid rgba(124,92,252,0.15)`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: accent }}>
                  {platform?.icon} {draft.platform_tips}
                </p>
              </div>
            )}

            {/* Voice narration picker with recording */}
            <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Voice Narration</p>
              <div style={{ display: "flex", gap: 6, marginBottom: voiceMode === "record" ? 12 : 0 }}>
                {([
                  { id: "none" as const, label: "No Narration", icon: "🔇" },
                  { id: "ai" as const, label: "AI Voice", icon: "🤖" },
                  { id: "record" as const, label: "My Voice", icon: "🎙" },
                ]).map(v => (
                  <button key={v.id} onClick={() => {
                    setVoiceMode(v.id);
                    if (v.id === "none") updateDraft({ voice_script: "" });
                    else if (v.id === "ai" && !draft.voice_script) updateDraft({ voice_script: "Add narration text above" });
                  }}
                    style={{ flex: 1, padding: "10px 10px", borderRadius: 8, border: `1px solid ${voiceMode === v.id ? accent : "#2a2a40"}`, background: voiceMode === v.id ? `${accent}10` : "transparent", color: voiceMode === v.id ? accent : "#6060a0", fontSize: 11, cursor: "pointer", fontWeight: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 16 }}>{v.icon}</span>
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Voice recording interface */}
              {voiceMode === "record" && (
                <div style={{ background: "#141424", borderRadius: 10, padding: 14, border: "1px solid #2a2a40" }}>
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
                      {recording ? "⏹" : "🎙"}
                    </button>
                    <div>
                      <p style={{ fontSize: 12, color: recording ? "#ef4444" : "#fff", fontWeight: 600 }}>
                        {recording ? "Recording... tap to stop" : "Tap to record your voice"}
                      </p>
                      <p style={{ fontSize: 10, color: "#6060a0" }}>Read the narration script above into your microphone</p>
                    </div>
                  </div>

                  {voiceRecordingUrl && (
                    <div>
                      <audio src={voiceRecordingUrl} controls style={{ width: "100%", height: 36 }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button onClick={() => setVoiceRecordingUrl(null)}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #2a2a40", background: "transparent", color: "#ef4444", cursor: "pointer" }}>
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
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a2a40" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: 10, color: "#6060a0" }}>Or upload a voice file:</span>
                      <input type="file" accept="audio/*" style={{ fontSize: 10, color: "#6060a0" }}
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
            <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Music</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Afrobeats", "Pop", "Gospel", "Cinematic", "Calm", "Upbeat", "No Music"].map(m => (
                  <button key={m} onClick={() => updateDraft({ music_mood: m === "No Music" ? "" : m })}
                    style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${draft.music_mood === m ? accent : "#2a2a40"}`, background: draft.music_mood === m ? `${accent}15` : "transparent", color: draft.music_mood === m ? accent : "#6060a0", fontSize: 10, cursor: "pointer" }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={sendToStudio} style={{ ...btnPrimary, flex: 1 }}>
                Open in Video Studio
              </button>
              <button onClick={sendToAdEditor} style={{ ...btnSm, flex: 1, textAlign: "center", fontSize: 13, padding: "14px 16px" }}>
                Open in Ad Editor
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => {
                clearSession();
                window.location.href = "/dashboard/review";
              }} style={{ ...btnSm, flex: 1, textAlign: "center", background: "rgba(34,197,94,0.08)", color: "#22c55e", borderColor: "rgba(34,197,94,0.2)" }}>
                Send to Review Queue
              </button>
              <button onClick={() => setStep(4)} style={{ ...btnSm, flex: 1, textAlign: "center" }}>
                Back to Ideas
              </button>
              <button onClick={() => selectedSuggestion && generateDraft(selectedSuggestion)}
                style={{ ...btnSm, flex: 1, textAlign: "center" }}>
                Regenerate
              </button>
            </div>
          </div>

          {/* Right panel — metadata */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={cardStyle}>
              <p style={{ ...sectionLabel, fontSize: 9 }}>Platform</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>{platform?.icon}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{platform?.label}</p>
                  <p style={{ fontSize: 10, color: "#6060a0" }}>{selectedFormat} &middot; {draft.aspect_ratio}</p>
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
              <p style={{ fontSize: 13, color: "#e0e0f0" }}>{draft.music_mood}</p>
              <p style={{ fontSize: 11, color: "#6060a0" }}>{draft.music_genre}</p>
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
              <p style={{ fontSize: 9, color: "#404060" }}>Credits charged only after you approve generation</p>
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
                          style={{ fontSize: 8, padding: "2px 5px", borderRadius: 4, border: "none", background: enhancingId === m.id ? "#2a2a40" : "rgba(16,185,129,0.8)", color: "#fff", cursor: "pointer" }}>
                          {enhancingId === m.id ? "..." : m.name.startsWith("enhanced_") ? "Re-enhance" : "Enhance"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {media.length > 4 && <p style={{ fontSize: 9, color: "#404060", marginTop: 4 }}>+{media.length - 4} more</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
