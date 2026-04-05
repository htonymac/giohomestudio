"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type Tool = "trim" | "narrate";

interface VoiceOption {
  id: string;
  name: string;
}

interface JobResult {
  contentItemId: string;
  message: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#12121a", border: "1px solid #2a2a40", borderRadius: 14, padding: "24px 28px" }}>
      <div className="flex items-center gap-3 mb-6">
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ color: "#e0e0f8", fontWeight: 600, fontSize: 17 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", color: "#9090b0", fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </label>
  );
}

function FileDropZone({ onChange, onClear, accept, file }: { onChange: (f: File) => void; onClear?: () => void; accept: string; file: File | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files?.[0]) onChange(files[0]);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragging ? "#7c5cfc" : "#2a2a40"}`,
          borderRadius: 10,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(124,92,252,0.06)" : "transparent",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={e => handleFiles(e.target.files)}
        />
        {file ? (
          <div>
            <p style={{ color: "#c0c0e0", fontSize: 13, fontWeight: 500 }}>{file.name}</p>
            <p style={{ color: "#5a5a7a", fontSize: 11, marginTop: 2 }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB · click to replace
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: "#5a5a7a", fontSize: 13 }}>Drop video here or click to browse</p>
            <p style={{ color: "#3a3a5a", fontSize: 11, marginTop: 3 }}>MP4, MOV, WEBM, AVI</p>
          </div>
        )}
      </div>
      {file && onClear && (
        <button
          onClick={e => { e.stopPropagation(); onClear(); }}
          title="Remove file"
          style={{
            position: "absolute", top: 6, right: 8,
            background: "none", border: "none", cursor: "pointer",
            color: "#f87171", fontSize: 16, lineHeight: 1, padding: "2px 6px",
          }}
        >✕</button>
      )}
    </div>
  );
}

function JobDone({ result, onReset }: { result: JobResult; onReset: () => void }) {
  return (
    <div style={{ background: "#0a1a0a", border: "1px solid #2a3a2a", borderRadius: 10, padding: "16px 20px", marginTop: 16 }}>
      <p style={{ color: "#4ade80", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Processing started</p>
      <p style={{ color: "#9090b0", fontSize: 12, marginBottom: 12 }}>{result.message}</p>
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/content/${result.contentItemId}`}
          style={{ color: "#7c5cfc", fontSize: 13, fontWeight: 500, textDecoration: "underline" }}
        >
          Open in content detail →
        </Link>
        <Link
          href="/dashboard/review"
          style={{ color: "#5a5a7a", fontSize: 12 }}
        >
          Go to Review Queue
        </Link>
      </div>
      <button
        onClick={onReset}
        style={{ marginTop: 14, color: "#5a5a7a", fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        ← Process another video
      </button>
    </div>
  );
}

// ── Trim tool ─────────────────────────────────────────────────────────────────

function TrimTool() {
  const [file, setFile]         = useState<File | null>(null);
  const [startSec, setStartSec] = useState("");
  const [endSec, setEndSec]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<JobResult | null>(null);

  function reset() {
    setFile(null); setStartSec(""); setEndSec(""); setError(null); setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Select a video file."); return; }
    const start = parseFloat(startSec);
    const end   = parseFloat(endSec);
    if (isNaN(start) || isNaN(end) || end <= start) {
      setError("End time must be greater than start time."); return;
    }
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("startSec", String(start));
    fd.append("endSec", String(end));
    try {
      const res  = await fetch("/api/video-tools/trim", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Trim failed."); return; }
      setResult(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) return <JobDone result={result} onReset={reset} />;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Label>Video file</Label>
        <FileDropZone onChange={setFile} onClear={() => setFile(null)} accept="video/*" file={file} />
      </div>

      <div className="flex gap-4">
        <div style={{ flex: 1 }}>
          <Label>Start (seconds)</Label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="0"
            value={startSec}
            onChange={e => setStartSec(e.target.value)}
            style={{ width: "100%", background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 12px", color: "#e0e0f8", fontSize: 14 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Label>End (seconds)</Label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="30"
            value={endSec}
            onChange={e => setEndSec(e.target.value)}
            style={{ width: "100%", background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 12px", color: "#e0e0f8", fontSize: 14 }}
          />
        </div>
      </div>

      {startSec && endSec && parseFloat(endSec) > parseFloat(startSec) && (
        <p style={{ color: "#5a5a7a", fontSize: 12 }}>
          Output duration: {(parseFloat(endSec) - parseFloat(startSec)).toFixed(1)}s
        </p>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      <button
        type="submit"
        disabled={loading || !file}
        style={{
          background: loading || !file ? "#2a2a40" : "linear-gradient(135deg, #7c5cfc, #a06ef8)",
          color: loading || !file ? "#5a5a7a" : "#fff",
          border: "none",
          borderRadius: 8,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: loading || !file ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {loading ? "Trimming…" : "Trim Video"}
      </button>
    </form>
  );
}

// ── Narrate tool ──────────────────────────────────────────────────────────────

function NarrateTool() {
  const [file, setFile]       = useState<File | null>(null);
  const [text, setText]       = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voices, setVoices]   = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<JobResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/voices", { signal: controller.signal })
      .then(r => r.json())
      .then(d => setVoices(d.voices ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function reset() {
    setFile(null); setText(""); setVoiceId(""); setError(null); setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Select a video file."); return; }
    if (!text.trim()) { setError("Enter narration text."); return; }
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("text", text.trim());
    if (voiceId) fd.append("voiceId", voiceId);
    try {
      const res  = await fetch("/api/video-tools/narrate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      setResult(data);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) return <JobDone result={result} onReset={reset} />;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Label>Video file</Label>
        <FileDropZone onChange={setFile} onClear={() => setFile(null)} accept="video/*" file={file} />
      </div>

      <div>
        <Label>Narration text</Label>
        <textarea
          rows={4}
          placeholder="Enter the narration script to add to this video…"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ width: "100%", background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 12px", color: "#e0e0f8", fontSize: 14, resize: "vertical" }}
        />
        <p style={{ color: "#3a3a5a", fontSize: 11, marginTop: 3 }}>
          {text.length} chars · ~{Math.ceil(text.split(/\s+/).filter(Boolean).length / 2.5)}s estimated
        </p>
      </div>

      {voices.length > 0 && (
        <div>
          <Label>Voice (optional)</Label>
          <select
            value={voiceId}
            onChange={e => setVoiceId(e.target.value)}
            style={{ width: "100%", background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 12px", color: "#e0e0f8", fontSize: 14 }}
          >
            <option value="">Default voice</option>
            {voices.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      <button
        type="submit"
        disabled={loading || !file || !text.trim()}
        style={{
          background: loading || !file || !text.trim() ? "#2a2a40" : "linear-gradient(135deg, #7c5cfc, #a06ef8)",
          color: loading || !file || !text.trim() ? "#5a5a7a" : "#fff",
          border: "none",
          borderRadius: 8,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: loading || !file || !text.trim() ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {loading ? "Processing…" : "Add Narration"}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VideoToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>("trim");

  const TOOLS: { id: Tool; label: string; icon: string; desc: string }[] = [
    { id: "trim",    label: "Trim Video",    icon: "✂",  desc: "Cut a clip to specific start and end times" },
    { id: "narrate", label: "Add Narration", icon: "🎙", desc: "Layer a voiceover onto an existing video" },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: "#e0e0f8", fontWeight: 700, fontSize: 22, marginBottom: 6 }}>
          Video Tools
        </h1>
        <p style={{ color: "#5a5a7a", fontSize: 14 }}>
          Transform and enhance existing videos. Processed clips go to the Review Queue.
        </p>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-3 mb-6">
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${activeTool === t.id ? "#7c5cfc" : "#2a2a40"}`,
              background: activeTool === t.id ? "rgba(124,92,252,0.12)" : "#12121a",
              color: activeTool === t.id ? "#a080ff" : "#7070a0",
              fontSize: 13,
              fontWeight: activeTool === t.id ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tool */}
      {activeTool === "trim" && (
        <SectionCard title="Trim Video" icon="✂">
          <p style={{ color: "#5a5a7a", fontSize: 13, marginBottom: 20 }}>
            Upload a video and set start and end times in seconds. The trimmed clip is saved and sent to Review.
            Uses stream copy — no quality loss, near-instant for most files.
          </p>
          <TrimTool />
        </SectionCard>
      )}

      {activeTool === "narrate" && (
        <SectionCard title="Add Narration" icon="🎙">
          <p style={{ color: "#5a5a7a", fontSize: 13, marginBottom: 20 }}>
            Upload a video and write narration text. The system generates a voiceover and overlays it
            onto the video. Uses ElevenLabs when configured, or mock voice as fallback.
          </p>
          <NarrateTool />
        </SectionCard>
      )}

      {/* Coming soon */}
      <div style={{ marginTop: 24, padding: "16px 20px", background: "#0e0e18", border: "1px solid #1a1a30", borderRadius: 10 }}>
        <p style={{ color: "#3a3a6a", fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
          Coming to Video Tools
        </p>
        <div className="flex gap-4 flex-wrap">
          {["Replace Music", "Add SFX", "Replace Voiceover", "Subtitle Burn-in"].map(f => (
            <span key={f} style={{ color: "#3a3a6a", fontSize: 12, background: "#1a1a2e", border: "1px solid #2a2a3a", borderRadius: 6, padding: "4px 10px" }}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
