"use client";

/**
 * GHS Karaoke Studio — doc-polished flow
 * §11 — 5 intervention levels, Option 1 always user's original line
 * §14 — Simple-label audio editor (KaraokeAudioEditor)
 * §19 — Voice-first toasts throughout
 * §23 — Inline AI hints above lyrics (dismissible)
 * §25 — Defaults safe, Reset to original, Natural Voice preset default
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { MixSettings } from "../../components/KaraokeAudioEditor";
import type { InterventionLevel, SubAction } from "../../api/karaoke/polish-lyrics/route";

const VoiceRecorder = dynamic(() => import("../../components/VoiceRecorder"), { ssr: false });
const KaraokeAudioEditor = dynamic(() => import("../../components/KaraokeAudioEditor"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  transcription: string;
  word_timestamps: { word: string; start: number; end: number }[];
  tempo_bpm: number;
  beat_times: number[];
  detected_key: string;
  energy_level: number;
  brightness: number;
  duration_seconds: number;
  suggested_genre: string;
  vocal_quality_score: number;
  mood: string;
}

interface Hint {
  id: string;
  text: string;
}

interface LyricOption {
  label: string;
  lyrics: string;
  rationale: string;
  isOriginal?: boolean;
}

interface LyricLine {
  id: string;
  text: string;
}

type PageState = "record" | "analyze" | "done";

// ── Intervention level descriptions ──────────────────────────────────────────

const INTERVENTION_LEVELS: { value: InterventionLevel; label: string; description: string }[] = [
  { value: "improve",       label: "Improve",        description: "Light vocabulary upgrade, same flow" },
  { value: "simplify",      label: "Simplify",        description: "Shorter words, clearer meaning" },
  { value: "strengthen",    label: "Strengthen",      description: "More emotional intensity, same meaning" },
  { value: "rewrite_light", label: "Rewrite (light)", description: "New phrasing, same meaning + style" },
  { value: "rewrite_full",  label: "Rewrite (full)",  description: "Fuller rewrite, preserves your core idea" },
];

const SUB_ACTIONS: { value: SubAction; label: string }[] = [
  { value: null,            label: "No style filter" },
  { value: "pidgin",        label: "Make it Pidgin" },
  { value: "gospel",        label: "Gospel feel" },
  { value: "yoruba",        label: "Yoruba mix" },
  { value: "children_safe", label: "Children-safe" },
  { value: "poetic",        label: "Poetic" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function energyLabel(e: number): string {
  if (e > 0.1) return "High";
  if (e > 0.05) return "Medium";
  return "Low";
}

function splitToLines(text: string): LyricLine[] {
  return text
    .split(/\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => ({ id: `line-${i}`, text: t }));
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      data-testid="toast-message"
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: 32,
        right: 32,
        background: "#1a1a1e",
        border: "1px solid rgba(167,139,250,0.3)",
        borderRadius: 10,
        padding: "12px 20px",
        maxWidth: 380,
        fontSize: 14,
        color: "#c5c5c8",
        fontWeight: 500,
        zIndex: 1000,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        cursor: "pointer",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#151518",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
      padding: "14px 16px",
      flex: "1 1 140px",
      minWidth: 120,
    }}>
      <p style={{ margin: 0, fontSize: 11, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#7b7b80" }}>{sub}</p>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children, accent = "#a78bfa" }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: "#0e0e10",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: 24,
      width: "100%",
    }}>
      <h2 style={{
        margin: "0 0 20px",
        fontSize: 16,
        fontWeight: 700,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ width: 3, height: 18, background: accent, borderRadius: 2, display: "inline-block" }} />
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Inline hint pill ──────────────────────────────────────────────────────────

function HintPill({ hint, onDismiss }: { hint: Hint; onDismiss: () => void }) {
  return (
    <div
      data-testid={`hint-${hint.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "rgba(124,196,255,0.07)",
        border: "1px solid rgba(124,196,255,0.2)",
        borderRadius: 8,
        fontSize: 13,
        color: "#7cc4ff",
      }}
    >
      <span style={{ flex: 1 }}>{hint.text}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss hint"
        style={{
          background: "none",
          border: "none",
          color: "#55555a",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Lyrics polish modal ───────────────────────────────────────────────────────

interface PolishModalProps {
  line: LyricLine;
  analysis: AnalysisResult | null;
  onApply: (newText: string) => void;
  onClose: () => void;
}

function PolishModal({ line, analysis, onApply, onClose }: PolishModalProps) {
  const [level, setLevel] = useState<InterventionLevel>("improve"); // §25 default = lightest
  const [subAction, setSubAction] = useState<SubAction>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<LyricOption[]>([]);
  const [error, setError] = useState<string>("");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const fetchOptions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setOptions([]);
    setSelectedIdx(null);

    try {
      const res = await fetch("/api/karaoke/polish-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLyrics: line.text,
          interventionLevel: level,
          subAction: subAction,
          analysis: analysis ? {
            tempo: analysis.tempo_bpm,
            key: analysis.detected_key,
            mood: analysis.mood,
            genre: analysis.suggested_genre,
          } : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Polish failed");
      setOptions(data.options || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polish failed");
    } finally {
      setIsLoading(false);
    }
  }, [line.text, level, subAction, analysis]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="polish-modal"
        style={{
          background: "#18181b",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: 28,
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>AI Lyrics Polish</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#55555a" }}>5 ways to say this. Your line is always option 1.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#55555a", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {/* Current line */}
        <div style={{ padding: "10px 14px", background: "rgba(167,139,250,0.06)", borderRadius: 8, border: "1px solid rgba(167,139,250,0.15)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#55555a" }}>Your line</p>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#c5c5c8", lineHeight: 1.5 }}>{line.text}</p>
        </div>

        {/* §11 — Intervention level picker (5 levels, default = improve) */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Intervention level
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {INTERVENTION_LEVELS.map((l) => (
              <button
                key={l.value}
                data-level={l.value}
                onClick={() => setLevel(l.value)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 7,
                  border: `1px solid ${level === l.value ? "#a78bfa" : "rgba(255,255,255,0.08)"}`,
                  background: level === l.value ? "rgba(167,139,250,0.12)" : "transparent",
                  color: level === l.value ? "#a78bfa" : "#c5c5c8",
                  fontSize: 13,
                  fontWeight: level === l.value ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{l.label}</span>
                <span style={{ fontSize: 11, color: level === l.value ? "#a78bfa" : "#55555a" }}>{l.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Optional sub-action */}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Style filter (optional)
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUB_ACTIONS.map((sa) => (
              <button
                key={String(sa.value)}
                data-subaction={String(sa.value)}
                onClick={() => setSubAction(sa.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${subAction === sa.value ? "#7cc4ff" : "rgba(255,255,255,0.08)"}`,
                  background: subAction === sa.value ? "rgba(124,196,255,0.1)" : "transparent",
                  color: subAction === sa.value ? "#7cc4ff" : "#7b7b80",
                  fontSize: 12,
                  fontWeight: subAction === sa.value ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {sa.label}
              </button>
            ))}
          </div>
        </div>

        {/* Get options button */}
        <button
          data-testid="get-polish-options-btn"
          onClick={fetchOptions}
          disabled={isLoading}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: isLoading ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg, #a78bfa, #7cc4ff)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: isLoading ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {isLoading ? "Getting options…" : "Get 5 options"}
        </button>

        {/* Error */}
        {error && (
          <p style={{ margin: 0, fontSize: 13, color: "#ff7a45" }}>Error: {error}</p>
        )}

        {/* §11 — 5 options, Option 1 = user's line */}
        {options.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#55555a" }}>
              5 ways to say this. Your line is option 1. Pick what feels right.
            </p>
            {options.map((opt, idx) => (
              <div
                key={idx}
                data-testid={`option-${idx}`}
                onClick={() => setSelectedIdx(idx === selectedIdx ? null : idx)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: `1px solid ${selectedIdx === idx ? "#a78bfa" : opt.isOriginal ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.07)"}`,
                  background: selectedIdx === idx
                    ? "rgba(167,139,250,0.12)"
                    : opt.isOriginal
                      ? "rgba(167,139,250,0.04)"
                      : "#151518",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", background: opt.isOriginal ? "#a78bfa" : "#1e1e22",
                    border: "1px solid rgba(167,139,250,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: opt.isOriginal ? "#fff" : "#7b7b80",
                    flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: opt.isOriginal ? "#a78bfa" : "#7b7b80" }}>
                    {opt.label}{opt.isOriginal ? " (your original)" : ""}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "#c5c5c8", lineHeight: 1.6, paddingLeft: 28 }}>
                  {opt.lyrics}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#55555a", paddingLeft: 28 }}>
                  {opt.rationale}
                </p>
              </div>
            ))}

            {selectedIdx !== null && (
              <button
                data-testid="apply-option-btn"
                onClick={() => {
                  onApply(options[selectedIdx].lyrics);
                  onClose();
                }}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #a78bfa, #7cc4ff)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Use option {selectedIdx + 1}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KaraokeStudioPage() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("record");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [analyzeProgress, setAnalyzeProgress] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // §23 — inline hints
  const [hints, setHints] = useState<Hint[]>([]);
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(new Set());
  const [isLoadingHints, setIsLoadingHints] = useState(false);

  // Lyrics editor state
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [polishingLine, setPolishingLine] = useState<LyricLine | null>(null);

  // Recent recordings
  const [recentRecordings, setRecentRecordings] = useState<{
    id: string; fileName: string; fileUrl: string; createdAt: string;
  }[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");

  // Toast §19
  const [toastMsg, setToastMsg] = useState<string>("");
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load recent recordings ──────────────────────────────────────────────────

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/karaoke/list?userId=anonymous");
      const data = await res.json();
      if (data.recordings) setRecentRecordings(data.recordings.slice(0, 8));
    } catch {
      // silent
    }
  }, []);

  // ── Load hints after analysis §23 ──────────────────────────────────────────

  const loadHints = useCallback(async (analysisData: AnalysisResult) => {
    setIsLoadingHints(true);
    try {
      const res = await fetch("/api/karaoke/hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: analysisData,
          lyrics: analysisData.transcription,
        }),
      });
      const data = await res.json();
      if (data.hints) setHints(data.hints);
    } catch {
      // hints are optional — silent fail
    } finally {
      setIsLoadingHints(false);
    }
  }, []);

  // ── Upload file ─────────────────────────────────────────────────────────────

  const uploadAudio = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}…`);
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", "anonymous");

      const res = await fetch("/api/karaoke/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || "Upload failed");

      setRecordingId(data.recordingId);
      if (data.fileUrl) setAudioUrl(data.fileUrl);
      setUploadProgress("Upload complete.");
      setPageState("analyze");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Import from URL ─────────────────────────────────────────────────────────

  const importFromUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlError("");
    setIsImportingUrl(true);
    try {
      const res = await fetch("/api/karaoke/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), userId: "anonymous" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "URL import failed");
      setRecordingId(data.recordingId);
      if (data.fileUrl) setAudioUrl(data.fileUrl);
      setUploadedFileName(data.fileName || "from-url");
      setPageState("analyze");
      setUrlInput("");
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "URL import failed");
    } finally {
      setIsImportingUrl(false);
    }
  }, [urlInput]);

  // ── Pick from library (recent) ──────────────────────────────────────────────

  const pickRecording = useCallback((rec: typeof recentRecordings[0]) => {
    setRecordingId(rec.id);
    if (rec.fileUrl) setAudioUrl(rec.fileUrl);
    setUploadedFileName(rec.fileName || rec.id);
    setShowRecent(false);

    // If already analyzed, populate
    setPageState("analyze");
    showToast(`Loaded: ${rec.fileName || rec.id}`);
  }, [showToast]);

  // ── Run analysis ────────────────────────────────────────────────────────────

  const runAnalysis = useCallback(async (id: string) => {
    setAnalyzeError(null);
    setIsAnalyzing(true);
    setAnalyzeProgress("Starting analysis — loading AI models (may take 30–60s)…");

    try {
      const res = await fetch("/api/karaoke/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: id }),
      });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || "Analysis failed");

      const result = data.analysis as AnalysisResult;
      setAnalysis(result);
      setAnalyzeProgress("Analysis complete.");
      setPageState("done");

      // §19 — voice-first analysis toast
      const genreHint = result.suggested_genre || "Afrobeats";
      const keyHint = result.detected_key || "";
      const bpmHint = result.tempo_bpm ? `${Math.round(result.tempo_bpm)} BPM` : "";
      showToast(`GHS understood your flow — ${bpmHint}${keyHint ? `, ${keyHint}` : ""}, ${genreHint} feel.`);

      // Populate lyrics from transcription
      if (result.transcription) {
        setLyricLines(splitToLines(result.transcription));
      }

      // §23 — load inline hints
      loadHints(result);

    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [showToast, loadHints]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
    await uploadAudio(file);
  }, [uploadAudio]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAudio(file);
  }, [uploadAudio]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadAudio(file);
  }, [uploadAudio]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const applyLyricOption = useCallback((lineId: string, newText: string) => {
    setLyricLines((prev) =>
      prev.map((l) => l.id === lineId ? { ...l, text: newText } : l)
    );
    // §19 — voice-first after polish apply
    showToast("5 ways to say this. Your line is option 1. Pick what feels right.");
  }, [showToast]);

  const dismissHint = useCallback((id: string) => {
    setDismissedHints((prev) => new Set([...prev, id]));
  }, []);

  const sendToMVPlanner = () => {
    if (!recordingId) return;
    router.push(`/dashboard/music-video-planner?karaokeId=${recordingId}`);
  };

  const resetAll = () => {
    setPageState("record");
    setRecordingId(null);
    setAudioUrl("");
    setAnalysis(null);
    setUploadError(null);
    setAnalyzeError(null);
    setUploadedFileName("");
    setLyricLines([]);
    setHints([]);
    setDismissedHints(new Set());
    setPolishingLine(null);
  };

  // Load recent on mount
  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const visibleHints = hints.filter((h) => !dismissedHints.has(h.id));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      padding: "24px",
      maxWidth: 900,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 24,
      fontFamily: "'Geist', 'Inter', sans-serif",
      color: "#fff",
    }}>

      {/* Toast §19 */}
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg("")} />}

      {/* Polish modal §11 */}
      {polishingLine && (
        <PolishModal
          line={polishingLine}
          analysis={analysis}
          onApply={(newText) => applyLyricOption(polishingLine.id, newText)}
          onClose={() => setPolishingLine(null)}
        />
      )}

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Karaoke Studio
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#7b7b80" }}>
          Your voice, your flow. AI builds around you.
        </p>
      </div>

      {/* ── Section 1: Multi-input ─────────────────────────────────────────── */}
      <Section title="1 — Start Here">
        {/* 5 input methods in one region, NOT separate modes */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

          {/* A — Live recording */}
          <div style={{
            flex: "1 1 260px",
            background: "#151518",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#c5c5c8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Live Recording
            </p>
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
          </div>

          {/* B — File upload */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: "1 1 180px",
              background: "#151518",
              border: "2px dashed rgba(167,139,250,0.25)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              minHeight: 160,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#c5c5c8" }}>Upload file</p>
            <p style={{ margin: 0, fontSize: 11, color: "#55555a", textAlign: "center" }}>MP3, WAV, M4A, AAC, OGG, WEBM</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>

          {/* C — From Library (recent) */}
          <div style={{
            flex: "1 1 180px",
            background: "#151518",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#c5c5c8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              From Library
            </p>
            <button
              data-testid="show-recent-btn"
              onClick={() => { setShowRecent(!showRecent); loadRecent(); }}
              style={{
                padding: "8px 14px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#c5c5c8",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {showRecent ? "Hide recent" : "Pick recent recording"}
            </button>
            {showRecent && recentRecordings.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                {recentRecordings.map((rec) => (
                  <button
                    key={rec.id}
                    data-testid={`recent-${rec.id}`}
                    onClick={() => pickRecording(rec)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "#0e0e10",
                      color: "#c5c5c8",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rec.fileName || rec.id}
                  </button>
                ))}
              </div>
            )}
            {showRecent && recentRecordings.length === 0 && (
              <p style={{ margin: 0, fontSize: 12, color: "#55555a" }}>No recordings yet.</p>
            )}
          </div>

          {/* D — Paste URL */}
          <div style={{
            flex: "1 1 200px",
            background: "#151518",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#c5c5c8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Paste URL
            </p>
            <input
              data-testid="url-input"
              type="url"
              placeholder="https://…/audio.mp3"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") importFromUrl(); }}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#0e0e10",
                color: "#fff",
                fontSize: 13,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button
              data-testid="import-url-btn"
              onClick={importFromUrl}
              disabled={isImportingUrl || !urlInput.trim()}
              style={{
                padding: "7px 14px",
                borderRadius: 7,
                border: "none",
                background: isImportingUrl ? "rgba(167,139,250,0.3)" : "#a78bfa",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: isImportingUrl || !urlInput.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isImportingUrl ? "Importing…" : "Import"}
            </button>
            {urlError && <p style={{ margin: 0, fontSize: 11, color: "#ff7a45" }}>{urlError}</p>}
          </div>

        </div>

        {/* Upload status */}
        {isUploading && (
          <div style={{ marginTop: 16, padding: "10px 16px", background: "#151518", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#7cc4ff" }}>{uploadProgress}</p>
          </div>
        )}
        {uploadError && (
          <div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(255,122,69,0.08)", borderRadius: 8, border: "1px solid rgba(255,122,69,0.2)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#ff7a45" }}>Upload error: {uploadError}</p>
          </div>
        )}
        {recordingId && !isUploading && (
          <div style={{ marginTop: 16, padding: "10px 16px", background: "rgba(122,224,195,0.06)", borderRadius: 8, border: "1px solid rgba(122,224,195,0.2)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#7ae0c3" }}>
              Loaded: {uploadedFileName} — ready to analyse.
            </p>
          </div>
        )}
      </Section>

      {/* ── Section 2: AI Analysis ─────────────────────────────────────────── */}
      {(pageState === "analyze" || pageState === "done") && recordingId && (
        <Section title="2 — AI Flow Analysis" accent="#7cc4ff">
          {pageState === "analyze" && !isAnalyzing && !analysis && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#c5c5c8" }}>
                GHS will transcribe and analyse your voice — tempo, key, mood, genre.
              </p>
              <button
                data-testid="run-analysis-btn"
                onClick={() => runAnalysis(recordingId)}
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #a78bfa, #7cc4ff)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Run Analysis
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div style={{ padding: "16px", background: "#151518", borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#7cc4ff" }}>{analyzeProgress}</p>
              <div style={{ marginTop: 10, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #a78bfa, #7cc4ff)",
                  animation: "shimmer 1.5s ease-in-out infinite",
                  width: "40%",
                }} />
              </div>
              <style>{`@keyframes shimmer { 0% { transform: translateX(-200%); } 100% { transform: translateX(400%); } }`}</style>
            </div>
          )}

          {analyzeError && (
            <div style={{ padding: "12px 16px", background: "rgba(255,122,69,0.08)", borderRadius: 8, border: "1px solid rgba(255,122,69,0.2)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#ff7a45", fontWeight: 600 }}>Analysis error</p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#7b7b80", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap" }}>
                {analyzeError}
              </p>
              <button
                onClick={() => runAnalysis(recordingId)}
                style={{ marginTop: 12, padding: "8px 16px", borderRadius: 6, border: "1px solid rgba(255,122,69,0.3)", background: "transparent", color: "#ff7a45", fontSize: 13, cursor: "pointer" }}
              >
                Retry
              </button>
            </div>
          )}

          {analysis && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <StatCard label="Duration" value={formatDuration(analysis.duration_seconds)} />
                <StatCard label="Tempo" value={`${Math.round(analysis.tempo_bpm)} BPM`} sub={`→ ${analysis.suggested_genre}`} />
                <StatCard label="Key" value={analysis.detected_key} />
                <StatCard label="Energy" value={energyLabel(analysis.energy_level)} />
                <StatCard label="Mood" value={analysis.mood} />
                <StatCard label="Vocal Quality" value={`${Math.round(analysis.vocal_quality_score * 100)}%`} />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Section 3: AI Hints (§23) ──────────────────────────────────────── */}
      {pageState === "done" && (visibleHints.length > 0 || isLoadingHints) && (
        <div data-testid="hints-section" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {isLoadingHints && (
            <p style={{ margin: 0, fontSize: 12, color: "#55555a" }}>Loading smart suggestions…</p>
          )}
          {visibleHints.map((hint) => (
            <HintPill key={hint.id} hint={hint} onDismiss={() => dismissHint(hint.id)} />
          ))}
        </div>
      )}

      {/* ── Section 4: Lyrics Editor (§11 intervention levels) ────────────── */}
      {pageState === "done" && (
        <Section title="3 — Lyrics Editor" accent="#a78bfa">
          {lyricLines.length === 0 ? (
            <div style={{ padding: "12px 0" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#7b7b80" }}>
                No transcription — audio may be instrumental or very quiet. You can still use the Audio Editor below.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#55555a" }}>
                Click [ai] on any line to get 5 rewrite options. Your original line is always option 1.
              </p>
              {lyricLines.map((line, idx) => (
                <div
                  key={line.id}
                  data-testid={`lyric-line-${idx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "#151518",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#55555a", fontFamily: "monospace", minWidth: 20 }}>
                    {idx + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, color: "#c5c5c8", lineHeight: 1.5 }}>{line.text}</span>
                  <button
                    data-testid={`ai-btn-${idx}`}
                    onClick={() => setPolishingLine(line)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(167,139,250,0.3)",
                      background: "rgba(167,139,250,0.08)",
                      color: "#a78bfa",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    [ai]
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Section 5: Audio Editor (§14 simple labels) ───────────────────── */}
      {pageState === "done" && (
        <Section title="4 — Polish Your Sound" accent="#ff9a3c">
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#7b7b80" }}>
            Simple controls — no music degree needed. Presets set everything at once.
          </p>
          <KaraokeAudioEditor
            audioUrl={audioUrl || undefined}
            recordingId={recordingId || undefined}
            onSave={() => {}}
            onToast={showToast}
          />
        </Section>
      )}

      {/* ── Section 6: Next Steps ─────────────────────────────────────────── */}
      {pageState === "done" && recordingId && (
        <Section title="5 — Next Steps" accent="#ff9a3c">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={sendToMVPlanner}
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #ff9a3c, #d17bff)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              Send to Music Video Planner
            </button>

            <button
              onClick={resetAll}
              style={{
                padding: "12px 24px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#c5c5c8",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Start over
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}
