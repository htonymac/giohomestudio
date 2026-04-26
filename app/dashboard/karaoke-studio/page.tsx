"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const VoiceRecorder = dynamic(() => import("../../components/VoiceRecorder"), { ssr: false });

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

type PageState = "record" | "analyze" | "done";

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KaraokeStudioPage() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("record");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [analyzeProgress, setAnalyzeProgress] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload file to API ──────────────────────────────────────────────────────

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

      if (!res.ok || data.error) {
        throw new Error(data.error || "Upload failed");
      }

      setRecordingId(data.recordingId);
      setUploadProgress("Upload complete.");
      setPageState("analyze");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Trigger analysis ────────────────────────────────────────────────────────

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

      if (!res.ok || data.error) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysis(data.analysis as AnalysisResult);
      setAnalyzeProgress("Analysis complete.");
      setPageState("done");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // ── Recording complete callback ─────────────────────────────────────────────

  const handleRecordingComplete = useCallback(async (blob: Blob, _durationSec: number) => {
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
    await uploadAudio(file);
  }, [uploadAudio]);

  // ── File drop / input ───────────────────────────────────────────────────────

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

  // ── Send to Music Video Planner ─────────────────────────────────────────────

  const sendToMVPlanner = () => {
    if (!recordingId) return;
    router.push(`/dashboard/music-video-planner?karaokeId=${recordingId}`);
  };

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

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Karaoke Studio
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#7b7b80" }}>
          Record or upload your voice. AI transcribes, analyses tempo, key, mood, and genre.
        </p>
      </div>

      {/* ── Section 1: Record / Upload ─────────────────────────────────────── */}
      <Section title="1 — Record or Upload Your Voice">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

          {/* Live recorder */}
          <div style={{
            flex: "1 1 280px",
            background: "#151518",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#c5c5c8", alignSelf: "flex-start" }}>Live Recording</p>
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
          </div>

          {/* File upload */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: "1 1 280px",
              background: "#151518",
              border: "2px dashed rgba(167,139,250,0.25)",
              borderRadius: 12,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              cursor: "pointer",
              transition: "border-color 0.2s",
              minHeight: 200,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#c5c5c8" }}>
              Drop audio file here
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#55555a", textAlign: "center" }}>
              MP3, WAV, M4A, AAC, OGG, WEBM<br />Max 50 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Upload status */}
        {isUploading && (
          <div style={{ marginTop: 16, padding: "10px 16px", background: "#151518", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
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
              Uploaded: {uploadedFileName} — ID: <code style={{ fontSize: 11, color: "#7b7b80" }}>{recordingId}</code>
            </p>
          </div>
        )}
      </Section>

      {/* ── Section 2: Analyze ─────────────────────────────────────────────── */}
      {(pageState === "analyze" || pageState === "done") && recordingId && (
        <Section title="2 — AI Analysis" accent="#7cc4ff">
          {pageState === "analyze" && !isAnalyzing && !analysis && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#c5c5c8" }}>
                Ready to analyse. This will transcribe your voice using Whisper and extract tempo, key, mood, and genre with librosa.
              </p>
              <button
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
              <div style={{
                marginTop: 10,
                height: 3,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #a78bfa, #7cc4ff)",
                  animation: "shimmer 1.5s ease-in-out infinite",
                  width: "40%",
                }} />
              </div>
              <style>{`
                @keyframes shimmer {
                  0% { transform: translateX(-200%); }
                  100% { transform: translateX(400%); }
                }
              `}</style>
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
                style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,122,69,0.3)",
                  background: "transparent",
                  color: "#ff7a45",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Results */}
          {analysis && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Stat grid */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <StatCard label="Duration" value={formatDuration(analysis.duration_seconds)} />
                <StatCard label="Tempo" value={`${analysis.tempo_bpm} BPM`} sub={`→ ${analysis.suggested_genre}`} />
                <StatCard label="Key" value={analysis.detected_key} />
                <StatCard label="Energy" value={energyLabel(analysis.energy_level)} sub={analysis.energy_level.toFixed(4)} />
                <StatCard label="Mood" value={analysis.mood} />
                <StatCard label="Vocal Quality" value={`${Math.round(analysis.vocal_quality_score * 100)}%`} />
              </div>

              {/* Genre badge */}
              <div style={{
                padding: "12px 16px",
                background: "rgba(167,139,250,0.08)",
                borderRadius: 8,
                border: "1px solid rgba(167,139,250,0.2)",
              }}>
                <p style={{ margin: 0, fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>
                  Suggested genre: {analysis.suggested_genre} or {analysis.mood === "Melancholic" || analysis.mood === "Calm" ? "R&B" : "Afrobeats"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#55555a" }}>
                  Beat times detected: {analysis.beat_times.length} markers · Brightness: {Math.round(analysis.brightness)} Hz
                </p>
              </div>

              {/* Transcription */}
              {analysis.transcription && (
                <div style={{
                  padding: "16px",
                  background: "#151518",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>
                    Transcription
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: "#c5c5c8", lineHeight: 1.7 }}>
                    &ldquo;{analysis.transcription}&rdquo;
                  </p>
                  {analysis.word_timestamps.length > 0 && (
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#55555a" }}>
                      {analysis.word_timestamps.length} words with timestamps
                    </p>
                  )}
                </div>
              )}

              {!analysis.transcription && (
                <div style={{
                  padding: "12px 16px",
                  background: "#151518",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#7b7b80" }}>
                    No transcription — audio may be instrumental or too quiet for Whisper. All other analysis completed.
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── Section 3: Send to Music Video Planner ─────────────────────────── */}
      {pageState === "done" && recordingId && (
        <Section title="3 — Next Steps" accent="#ff9a3c">
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
              onClick={() => {
                setPageState("record");
                setRecordingId(null);
                setAnalysis(null);
                setUploadError(null);
                setAnalyzeError(null);
                setUploadedFileName("");
              }}
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
              Record Another
            </button>
          </div>

          {/* Stubbed features notice */}
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,154,60,0.06)", borderRadius: 8, border: "1px solid rgba(255,154,60,0.15)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#ff9a3c", fontWeight: 600 }}>Phase 2 features (not yet active)</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#55555a" }}>
              Melody extraction (basic-pitch) · Vocal isolation (Demucs) · Voice enhancement (RVC) · Audio editor with EQ/reverb/autotune
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}
