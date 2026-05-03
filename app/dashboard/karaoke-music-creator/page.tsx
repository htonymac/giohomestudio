"use client";

/**
 * Karaoke Music Creator — Surface 1 (under Create)
 * Path: /dashboard/karaoke-music-creator
 *
 * Owns ONLY:
 * 1. Mode A-E selector (canvas §4)
 * 2. 5 input methods (canvas §3)
 * 3. Routes to Planner with ?recordingId=…&mode=…
 *
 * Canvas §29: Voice is truth. Flow is authority.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const VoiceRecorder = dynamic(() => import("../../components/VoiceRecorder"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

type KaraokeMode = "A" | "B" | "C" | "D" | "E";

interface ModeCard {
  id: KaraokeMode;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}

interface RecentRecording {
  id: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

// ── Mode definitions (canvas §4 from GHS Karaoke.docx) ───────────────────────

const MODES: ModeCard[] = [
  {
    id: "A",
    icon: "🎵",
    title: "Voice → Music",
    subtitle: "Build music around your vocal idea",
    color: "#a78bfa",
  },
  {
    id: "B",
    icon: "🎤",
    title: "Voice → Karaoke",
    subtitle: "Lyric timing + karaoke export",
    color: "#7cc4ff",
  },
  {
    id: "C",
    icon: "✨",
    title: "Voice → Polished Demo",
    subtitle: "Rough recording → polished demo",
    color: "#7ae0c3",
  },
  {
    id: "D",
    icon: "📝",
    title: "Voice → Lyrics + Music",
    subtitle: "Lyrics first, then music follows",
    color: "#ffb347",
  },
  {
    id: "E",
    icon: "🥁",
    title: "Voice → Beat Match",
    subtitle: "Your chant + best beat family",
    color: "#ff7ab8",
  },
];

// ── UI helpers ─────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
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
      }}
    >
      {message}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const KARAOKE_CREATOR_DB_KEY = "ghs_karaoke_creator_session";

export default function KaraokeMusicCreatorPage() {
  const router = useRouter();

  const [selectedMode, setSelectedMode] = useState<KaraokeMode | null>(null);
  const restoredRef = useRef(false);
  const [toastMsg, setToastMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [recentRecordings, setRecentRecordings] = useState<RecentRecording[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<{id: string; fileName?: string; fileUrl?: string; name?: string}[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => setToastMsg(msg), []);

  const inputEnabled = selectedMode !== null;

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

  // ── Load asset library ───────────────────────────────────────────────────────

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/assets?type=music");
      const data = await res.json();
      if (data.assets) setLibraryAssets(data.assets.slice(0, 20));
      else if (Array.isArray(data)) setLibraryAssets(data.slice(0, 20));
    } catch {
      setLibraryAssets([]);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // ── Restore mode on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/hybrid/saved-state?localId=${KARAOKE_CREATOR_DB_KEY}`)
      .then(r => r.json())
      .then(d => {
        if (!d.found || !d.data) return;
        const s = d.data as Record<string, unknown>;
        if (s.activeMode && ["A","B","C","D","E"].includes(s.activeMode as string)) {
          setSelectedMode(s.activeMode as KaraokeMode);
        }
      })
      .catch(() => {})
      .finally(() => { restoredRef.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist selected mode on change ──────────────────────────────────────
  useEffect(() => {
    if (!restoredRef.current) return;
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: KARAOKE_CREATOR_DB_KEY, data: { activeMode: selectedMode ?? null } }),
    }).catch(() => {});
  }, [selectedMode]);

  // ── Upload and route to planner ─────────────────────────────────────────────

  const uploadAndRoute = useCallback(async (file: File) => {
    if (!selectedMode) {
      showToast("Pick a Mode first before uploading.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", "anonymous");

      const res = await fetch("/api/karaoke/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Upload failed");

      const { recordingId } = data;

      // Save mode on recording
      try {
        await fetch(`/api/karaoke/set-mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId, mode: selectedMode }),
        });
      } catch {
        // Non-fatal — mode also passed as query param
      }

      router.push(`/dashboard/karaoke-music-planner?recordingId=${recordingId}&mode=${selectedMode}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
    }
  }, [selectedMode, router, showToast]);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
    await uploadAndRoute(file);
  }, [uploadAndRoute]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAndRoute(file);
  }, [uploadAndRoute]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadAndRoute(file);
  }, [uploadAndRoute]);

  const importFromUrl = useCallback(async () => {
    if (!urlInput.trim() || !selectedMode) return;
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
      router.push(`/dashboard/karaoke-music-planner?recordingId=${data.recordingId}&mode=${selectedMode}`);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "URL import failed");
      setIsImportingUrl(false);
    }
  }, [urlInput, selectedMode, router]);

  const pickRecent = useCallback((rec: RecentRecording) => {
    if (!selectedMode) {
      showToast("Pick a Mode first.");
      return;
    }
    router.push(`/dashboard/karaoke-music-planner?recordingId=${rec.id}&mode=${selectedMode}`);
  }, [selectedMode, router, showToast]);

  const pickLibraryAsset = useCallback((asset: {id: string; fileUrl?: string; name?: string; fileName?: string}) => {
    if (!selectedMode) {
      showToast("Pick a Mode first.");
      return;
    }
    // Library assets go through upload-by-url if they have a URL
    if (asset.fileUrl) {
      router.push(`/dashboard/karaoke-music-planner?recordingId=${asset.id}&mode=${selectedMode}`);
    } else {
      showToast("Asset has no playable URL.");
    }
  }, [selectedMode, router, showToast]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: "32px 24px",
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: "'Geist', 'Inter', sans-serif",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg("")} />}

      {/* Karaoke status banner */}
      <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20 }}>🎵</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", margin: "0 0 4px" }}>Karaoke Studio — Setup In Progress</p>
          <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, margin: 0 }}>
            <strong style={{ color: "#d1d5db" }}>Working now:</strong> Voice recording, audio analysis, lyrics extraction, music generation (&#x2264;47s tracks via FAL).<br/>
            <strong style={{ color: "#d1d5db" }}>Coming soon:</strong> Kie.ai/Suno lyrical music, Mubert long-form tracks, vocal isolation, and voice enhancement (requires server migration).<br/>
            For full video production now, use the <strong style={{ color: "#f59e0b" }}>Hybrid Planner</strong> or <strong style={{ color: "#f59e0b" }}>Movie Planner</strong>.
          </p>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: "-0.6px",
            background: "linear-gradient(135deg, #a78bfa, #7cc4ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Karaoke Music Creator
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 16, color: "#7b7b80" }}>
          Voice → Music. Your idea, your song.
        </p>
      </div>

      {/* ── Step 1: Mode picker (canvas §4) ──────────────────────────────── */}
      <div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            fontWeight: 700,
            color: "#55555a",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Step 1 — Pick your mode
        </p>
        <div
          data-testid="mode-picker"
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          {MODES.map((mode) => {
            const active = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                data-testid={`mode-card-${mode.id}`}
                onClick={() => setSelectedMode(mode.id)}
                style={{
                  flex: "1 1 160px",
                  minWidth: 140,
                  maxWidth: 200,
                  padding: "18px 16px",
                  borderRadius: 12,
                  border: `2px solid ${active ? mode.color : "rgba(255,255,255,0.07)"}`,
                  background: active ? `${mode.color}14` : "#0e0e10",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  transition: "all 0.15s",
                  boxShadow: active ? `0 0 20px ${mode.color}26` : "none",
                }}
              >
                <span style={{ fontSize: 24 }}>{mode.icon}</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: active ? mode.color : "#c5c5c8",
                    }}
                  >
                    {mode.title}
                  </p>
                  <p
                    style={{
                      margin: "3px 0 0",
                      fontSize: 11,
                      color: active ? mode.color : "#55555a",
                      lineHeight: 1.4,
                    }}
                  >
                    {mode.subtitle}
                  </p>
                </div>
                {active && (
                  <span
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      color: mode.color,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    SELECTED
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedMode && (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#7b7b80" }}>
            Mode {selectedMode} selected:{" "}
            <span style={{ color: "#c5c5c8" }}>
              {MODES.find((m) => m.id === selectedMode)?.subtitle}
            </span>
          </p>
        )}
      </div>

      {/* ── Step 2: Input section (enabled after mode pick) ──────────────── */}
      <div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            fontWeight: 700,
            color: inputEnabled ? "#55555a" : "#2a2a2e",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Step 2 — Provide your voice{!inputEnabled && " (pick a mode first)"}
        </p>

        <div
          data-testid="input-section"
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            opacity: inputEnabled ? 1 : 0.35,
            pointerEvents: inputEnabled ? "auto" : "none",
            transition: "opacity 0.2s",
          }}
        >
          {/* Method 1 — Browser recording */}
          <div
            style={{
              flex: "1 1 240px",
              background: "#0e0e10",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                color: "#7b7b80",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Record Now
            </p>
            <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
          </div>

          {/* Method 2 — Upload file */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputEnabled && fileInputRef.current?.click()}
            data-testid="upload-drop-zone"
            style={{
              flex: "1 1 160px",
              background: "#0e0e10",
              border: "2px dashed rgba(167,139,250,0.25)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: inputEnabled ? "pointer" : "default",
              minHeight: 120,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#c5c5c8" }}>
              {isUploading ? "Uploading…" : "Upload File"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#55555a", textAlign: "center" }}>
              MP3 · WAV · M4A · AAC · OGG · WEBM
              <br />
              Max 50MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>

          {/* Method 3 — Asset Library */}
          <div
            style={{
              flex: "1 1 160px",
              background: "#0e0e10",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                color: "#7b7b80",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Asset Library
            </p>
            <button
              data-testid="show-library-btn"
              onClick={() => {
                setShowLibrary(!showLibrary);
                if (!showLibrary) loadLibrary();
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#c5c5c8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {showLibrary ? "Hide library" : "Browse music assets"}
            </button>
            {showLibrary && (
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {libraryAssets.length === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>No music assets.</p>
                )}
                {libraryAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => pickLibraryAsset(asset)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 5,
                      border: "1px solid rgba(255,255,255,0.05)",
                      background: "#151518",
                      color: "#c5c5c8",
                      fontSize: 11,
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {asset.name || asset.fileName || asset.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Method 4 — Recent recordings */}
          <div
            style={{
              flex: "1 1 160px",
              background: "#0e0e10",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                color: "#7b7b80",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Recent Recordings
            </p>
            <button
              data-testid="show-recent-btn"
              onClick={() => {
                setShowRecent(!showRecent);
                if (!showRecent) loadRecent();
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "#c5c5c8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {showRecent ? "Hide recent" : "Pick a recording"}
            </button>
            {showRecent && (
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {recentRecordings.length === 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>No recordings yet.</p>
                )}
                {recentRecordings.map((rec) => (
                  <button
                    key={rec.id}
                    data-testid={`recent-rec-${rec.id}`}
                    onClick={() => pickRecent(rec)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 5,
                      border: "1px solid rgba(255,255,255,0.05)",
                      background: "#151518",
                      color: "#c5c5c8",
                      fontSize: 11,
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
          </div>

          {/* Method 5 — Paste URL */}
          <div
            style={{
              flex: "1 1 200px",
              background: "#0e0e10",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                color: "#7b7b80",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
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
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "#151518",
                color: "#fff",
                fontSize: 12,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button
              data-testid="import-url-btn"
              onClick={importFromUrl}
              disabled={isImportingUrl || !urlInput.trim()}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
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
            {urlError && (
              <p style={{ margin: 0, fontSize: 11, color: "#ff7a45" }}>{urlError}</p>
            )}
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "rgba(255,122,69,0.08)",
              border: "1px solid rgba(255,122,69,0.2)",
              borderRadius: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "#ff7a45" }}>
              Upload error: {uploadError}
            </p>
          </div>
        )}
      </div>

      {/* ── What happens next ────────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px 20px",
          background: "rgba(167,139,250,0.05)",
          border: "1px solid rgba(167,139,250,0.12)",
          borderRadius: 10,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg,#a78bfa,#7cc4ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 16 }}>→</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#c5c5c8" }}>
            After upload: full 18-step workshop opens
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#55555a", lineHeight: 1.5 }}>
            Analysis → Flow Profiling → Beat Recommendation → Production Brief → Music Generation → Mix → Export.
            Steps 2, 4, 11 (Demucs / Basic Pitch / RVC) are marked post-Linux — everything else runs now.
          </p>
        </div>
      </div>
    </div>
  );
}
