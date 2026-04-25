"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ds } from "../../../lib/designSystem";
import { HeroTitle } from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { Film, Mic, Image, Folder, X, Check } from "../../components/icons";
import ModelChip from "../../components/ModelChip";
import { generateSegments, formatRange, type Segment } from "./segment-utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Tool = "trim" | "narrate" | "motion" | "bg_image" | "bg_video" | "object_remove";
type ViewMode = "classic" | "timeline";

interface AiSuggestion {
  id: string;
  segId: string;
  text: string;
  action: "bg_video" | "object_remove" | "narrate" | "motion";
}

interface VoiceOption {
  id: string;
  name: string;
}

interface JobResult {
  contentItemId: string;
  message: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  background: ds.color.card,
  border: `1px solid ${ds.color.line2}`,
  padding: "10px 12px",
  borderRadius: ds.radius.sm,
  color: ds.color.ink,
  fontFamily: ds.font.sans,
  fontSize: 14,
  width: "100%",
  outline: "none",
};

const microLabel: React.CSSProperties = {
  fontFamily: ds.font.mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: ds.color.mute,
  display: "block",
  marginBottom: 6,
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card radius={14} padding="24px 28px">
      <h2 style={{ color: ds.color.ink, fontWeight: 800, fontSize: 16, marginBottom: 18, fontFamily: ds.font.sans, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={microLabel}>{children}</label>;
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
          border: `2px dashed ${dragging ? ds.color.lilac : ds.color.line2}`,
          borderRadius: ds.radius.sm,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(167,139,250,0.06)" : "transparent",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
        {file ? (
          <div>
            <p style={{ color: ds.color.ink2, fontSize: 13, fontWeight: 500 }}>{file.name}</p>
            <p style={{ color: ds.color.mute, fontSize: 11, marginTop: 2 }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB · click to replace
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: ds.color.mute, fontSize: 13 }}>Drop video here or click to browse</p>
            <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 3 }}>MP4, MOV, WEBM, AVI</p>
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
            color: ds.color.coral, lineHeight: 1, padding: "2px 6px",
            display: "flex", alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function JobDone({ result, onReset }: { result: JobResult; onReset: () => void }) {
  return (
    <Card radius={10} padding="16px 20px" style={{ marginTop: 16 }}>
      <p style={{ color: ds.color.mint, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Processing started</p>
      <p style={{ color: ds.color.mute, fontSize: 12, marginBottom: 12 }}>{result.message}</p>
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/content/${result.contentItemId}`} style={{ color: ds.color.lilac, fontSize: 13, fontWeight: 500, textDecoration: "underline" }}>
          Open in content detail →
        </Link>
        <Link href="/dashboard/review" style={{ color: ds.color.mute, fontSize: 12 }}>
          Go to Review Queue
        </Link>
      </div>
      <button
        onClick={onReset}
        style={{ marginTop: 14, color: ds.color.mute, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        ← Process another video
      </button>
    </Card>
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
          <input type="number" min="0" step="0.1" placeholder="0" value={startSec}
            onChange={e => setStartSec(e.target.value)} style={inputSt} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>End (seconds)</Label>
          <input type="number" min="0" step="0.1" placeholder="30" value={endSec}
            onChange={e => setEndSec(e.target.value)} style={inputSt} />
        </div>
      </div>

      {startSec && endSec && parseFloat(endSec) > parseFloat(startSec) && (
        <p style={{ color: ds.color.mute, fontSize: 12 }}>
          Output duration: {(parseFloat(endSec) - parseFloat(startSec)).toFixed(1)}s
        </p>
      )}

      {error && <p style={{ color: ds.color.coral, fontSize: 13 }}>{error}</p>}

      <ButtonPrimary type="submit" disabled={loading || !file}>
        {loading ? "Trimming…" : "Trim Video"}
      </ButtonPrimary>
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
        <textarea rows={4} placeholder="Enter the narration script to add to this video…" value={text}
          onChange={e => setText(e.target.value)} style={{ ...inputSt, resize: "vertical" }} />
        <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 3 }}>
          {text.length} chars · ~{Math.ceil(text.split(/\s+/).filter(Boolean).length / 2.5)}s estimated
        </p>
      </div>

      {voices.length > 0 && (
        <div>
          <Label>Voice (optional)</Label>
          <select value={voiceId} onChange={e => setVoiceId(e.target.value)} style={inputSt}>
            <option value="">Default voice</option>
            {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}

      {error && <p style={{ color: ds.color.coral, fontSize: 13 }}>{error}</p>}

      <ButtonPrimary type="submit" disabled={loading || !file || !text.trim()}>
        {loading ? "Processing…" : "Add Narration"}
      </ButtonPrimary>
    </form>
  );
}

// ── Motion Transfer tool ─────────────────────────────────────────────────────

function MotionTransferTool() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);

  function reset() {
    setImageFile(null); setVideoFile(null); setImagePreview(null); setError(null); setResult(null);
  }

  function handleImageSelect(f: File) {
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) { setError("Upload a still image."); return; }
    if (!videoFile) { setError("Upload a motion reference video."); return; }
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.append("image", imageFile);
    fd.append("video", videoFile);
    try {
      const res = await fetch("/api/video-tools/motion-transfer", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Motion transfer failed."); return; }
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
        <Label>Still Image (the subject to animate)</Label>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <FileDropZone onChange={handleImageSelect} onClear={() => { setImageFile(null); setImagePreview(null); }} accept="image/*" file={imageFile} />
          </div>
          {imagePreview && (
            <img src={imagePreview} alt="Preview" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${ds.color.line2}` }} />
          )}
        </div>
        <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 4 }}>
          Best results: clear subject, good lighting, face visible, PNG or JPG
        </p>
      </div>

      <div>
        <Label>Motion Reference Video (the movement to apply)</Label>
        <FileDropZone onChange={setVideoFile} onClear={() => setVideoFile(null)} accept="video/*" file={videoFile} />
        <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 4 }}>
          Example: someone dancing, waving, walking — the image will perform this motion
        </p>
      </div>

      <Card radius={8} padding="12px 16px">
        <p style={{ color: ds.color.mute, fontSize: 11, fontWeight: 700, marginBottom: 6, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>Examples</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            "Photo of a person + video of someone dancing = person dances",
            "Product image + video of rotating object = product rotates",
            "Character portrait + video of someone talking = character talks",
          ].map((ex, i) => (
            <p key={i} style={{ color: ds.color.mute2, fontSize: 11 }}>{i + 1}. {ex}</p>
          ))}
        </div>
      </Card>

      {error && <p style={{ color: ds.color.coral, fontSize: 13 }}>{error}</p>}

      <ButtonPrimary type="submit" disabled={loading || !imageFile || !videoFile}>
        {loading ? "Generating animation…" : "Animate Image"}
      </ButtonPrimary>
    </form>
  );
}

// ── Provider badge ──────────────────────────────────────────────────────────

function ProviderBadge({ name, via, cost, phase }: { name: string; via: string; cost: string; phase: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(167,139,250,0.12)", color: ds.color.lilac, fontFamily: ds.font.mono }}>{name}</span>
      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(124,196,255,0.1)", color: ds.color.sky, fontFamily: ds.font.mono }}>{via}</span>
      <span style={{ fontSize: 10, color: ds.color.mute }}>{cost}</span>
      <span style={{ fontSize: 10, color: ds.color.mute2, marginLeft: "auto" }}>{phase}</span>
    </div>
  );
}

// ── BG Image Removal tool ───────────────────────────────────────────────────

function BgImageTool() {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/image/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setResult(data.outputUrl);
      setProvider(data.provider);
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={microLabel}>Image file</label>
        <div onClick={() => ref.current?.click()} style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer" }}>
          {file ? <p style={{ color: ds.color.ink2, fontSize: 12 }}>{file.name}</p> : <p style={{ color: ds.color.mute, fontSize: 12 }}>Drop image or click to browse (JPG, PNG, WebP)</p>}
        </div>
        <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setResult(null); }}} />
      </div>
      {result && (
        <Card radius={8} padding={12}>
          <p style={{ color: ds.color.mint, fontSize: 11, marginBottom: 8 }}>{provider}</p>
          <img src={result} alt="No BG" style={{ maxWidth: "100%", borderRadius: 6, border: `1px solid ${ds.color.line2}`, background: "repeating-conic-gradient(#1a1a2e 0% 25%, #0a0a18 0% 50%) 0 0 / 16px 16px" }} />
          <a href={result} download style={{ display: "inline-block", marginTop: 8, color: ds.color.lilac, fontSize: 11, textDecoration: "underline" }}>Download PNG</a>
        </Card>
      )}
      {error && <p style={{ color: ds.color.coral, fontSize: 12 }}>{error}</p>}
      <ButtonPrimary onClick={run} disabled={loading || !file}>
        {loading ? "Removing background…" : "Remove Background"}
      </ButtonPrimary>
    </div>
  );
}

// ── BG Video Removal tool ───────────────────────────────────────────────────

function BgVideoTool() {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [newBg, setNewBg] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    if (newBg) fd.append("newBackground", newBg);
    try {
      const res = await fetch("/api/video/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setResult(data.outputUrl); setProvider(data.provider);
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={microLabel}>Video file</label>
        <div onClick={() => ref.current?.click()} style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer" }}>
          {file ? <p style={{ color: ds.color.ink2, fontSize: 12 }}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p> : <p style={{ color: ds.color.mute, fontSize: 12 }}>Drop video or click to browse</p>}
        </div>
        <input ref={ref} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setResult(null); }}} />
      </div>
      <div>
        <label style={microLabel}>New background (optional)</label>
        <input value={newBg} onChange={e => setNewBg(e.target.value)} placeholder="white, #000000, transparent, blue studio..." style={inputSt} />
      </div>
      {result && (
        <Card radius={8} padding={12}>
          <p style={{ color: ds.color.mint, fontSize: 11, marginBottom: 8 }}>{provider}</p>
          <video src={result} controls style={{ maxWidth: "100%", borderRadius: 6 }} />
          <a href={result} download style={{ display: "inline-block", marginTop: 8, color: ds.color.lilac, fontSize: 11, textDecoration: "underline" }}>Download</a>
        </Card>
      )}
      {error && <p style={{ color: ds.color.coral, fontSize: 12 }}>{error}</p>}
      <ButtonPrimary onClick={run} disabled={loading || !file}>
        {loading ? "Removing background…" : "Remove Video Background"}
      </ButtonPrimary>
    </div>
  );
}

// ── Object Removal tool ─────────────────────────────────────────────────────

function ObjectRemoveTool() {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!file || !prompt.trim()) return;
    setLoading(true); setError(""); setResult(null);
    const fd = new FormData(); fd.append("file", file); fd.append("prompt", prompt);
    try {
      const res = await fetch("/api/video/object-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setResult(data.outputUrl); setProvider(data.provider);
    } catch { setError("Network error"); } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={microLabel}>Video file</label>
        <div onClick={() => ref.current?.click()} style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer" }}>
          {file ? <p style={{ color: ds.color.ink2, fontSize: 12 }}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p> : <p style={{ color: ds.color.mute, fontSize: 12 }}>Drop video or click to browse</p>}
        </div>
        <input ref={ref} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setResult(null); }}} />
      </div>
      <div>
        <label style={microLabel}>What to remove</label>
        <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="the logo in top right, person walking in background, watermark..." style={inputSt} />
        <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 4 }}>Be specific. AI detects and erases this object from every frame.</p>
      </div>
      {result && (
        <Card radius={8} padding={12}>
          <p style={{ color: ds.color.mint, fontSize: 11, marginBottom: 8 }}>{provider}</p>
          <video src={result} controls style={{ maxWidth: "100%", borderRadius: 6 }} />
          <a href={result} download style={{ display: "inline-block", marginTop: 8, color: ds.color.lilac, fontSize: 11, textDecoration: "underline" }}>Download</a>
        </Card>
      )}
      {error && <p style={{ color: ds.color.coral, fontSize: 12 }}>{error}</p>}
      <ButtonPrimary onClick={run} disabled={loading || !file || !prompt.trim()}>
        {loading ? "Removing object…" : "Remove Object"}
      </ButtonPrimary>
    </div>
  );
}

// ── Timeline Editor (Phase 1) ────────────────────────────────────────────────

function TimelineEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [tempPath, setTempPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ url: string; provider: string; type: "video" | "image" } | null>(null);
  const [actionError, setActionError] = useState<string>("");
  const [narrationText, setNarrationText] = useState<string>("");
  const [realSuggestions, setRealSuggestions] = useState<AiSuggestion[]>([]);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);

  useEffect(() => {
    return () => { if (videoSrc && videoSrc.startsWith("blob:")) URL.revokeObjectURL(videoSrc); };
  }, [videoSrc]);

  async function handleImport(file: File) {
    setError(""); setStatusMsg(""); setUploading(true);
    setActionResult(null); setRealSuggestions([]);
    const blobUrl = URL.createObjectURL(file);
    setVideoSrc(blobUrl);
    setUploadedFile(file);
    setFileName(file.name);

    try {
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch("/api/video-trimmer/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setTempPath(data.tempPath ?? null);
        setStatusMsg(`Uploaded: ${(file.size / 1024 / 1024).toFixed(1)} MB`);
        const d = data?.metadata?.duration;
        if (typeof d === "number" && d > 0) {
          setDuration(d);
          const segs = generateSegments(d);
          setSegments(segs);
          setSelectedSegId(segs[0]?.id ?? null);
          // Fetch AI suggestions after upload
          fetchAiSuggestions(segs, d, file.name);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Upload failed (preview still works).");
      }
    } catch {
      setError("Network error uploading (preview still works).");
    } finally {
      setUploading(false);
    }
  }

  async function fetchAiSuggestions(segs: Segment[], totalDuration: number, videoName: string) {
    if (!process.env.NEXT_PUBLIC_AI_SUGGESTIONS_ENABLED && segs.length === 0) return;
    setLoadingAiSuggestions(true);
    try {
      const res = await fetch("/api/llm/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `I have a video "${videoName}" that is ${totalDuration.toFixed(1)}s long with ${segs.length} scenes. Give me 3 short, specific editing suggestions as a JSON array of strings. Each suggestion should be max 10 words and suggest an action like removing background, adding narration, removing objects, or motion effects. Example format: ["Scene 1 has noisy background — remove it?", "Scene 2 could use narration overlay", "Scene 3 has distracting object — erase?"]`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.polishedPrompt ?? "";
        // Try to extract JSON array from response
        const start = text.indexOf("[");
        const end = text.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          try {
            const parsed = JSON.parse(text.slice(start, end + 1)) as string[];
            const actionTypes: Array<"bg_video" | "object_remove" | "narrate" | "motion"> = ["bg_video", "narrate", "object_remove", "motion"];
            const built: AiSuggestion[] = parsed.slice(0, 3).map((txt, i) => ({
              id: `ai_${i}`,
              segId: segs[i % segs.length]?.id ?? segs[0].id,
              text: typeof txt === "string" ? txt : String(txt),
              action: actionTypes[i % actionTypes.length],
            }));
            setRealSuggestions(built);
          } catch { /* use fallback */ }
        }
      }
    } catch { /* use fallback suggestions */ } finally {
      setLoadingAiSuggestions(false);
    }
  }

  function handleVideoMetadata() {
    if (!videoRef.current) return;
    const d = videoRef.current.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    if (duration > 0) return;
    setDuration(d);
    const segs = generateSegments(d);
    setSegments(segs);
    setSelectedSegId(segs[0]?.id ?? null);
  }

  function selectSegment(seg: Segment) {
    setSelectedSegId(seg.id);
    if (videoRef.current) videoRef.current.currentTime = seg.start;
  }

  const selectedSeg = segments.find(s => s.id === selectedSegId) ?? null;

  // Use AI suggestions if available, fallback to static
  const suggestions: AiSuggestion[] = realSuggestions.length > 0
    ? realSuggestions
    : segments.length > 0
    ? [
        { id: "s1", segId: segments[0].id, text: `Scene 1 background — remove it?`, action: "bg_video" },
        ...(segments[2] ? [{ id: "s2", segId: segments[2].id, text: `Scene 3 has object — remove?`, action: "object_remove" as const }] : []),
        ...(segments[1] ? [{ id: "s3", segId: segments[1].id, text: `Scene 2 could use narration`, action: "narrate" as const }] : []),
      ]
    : [];

  function applySuggestion(s: AiSuggestion) {
    const seg = segments.find(x => x.id === s.segId);
    if (!seg) return;
    setSelectedSegId(seg.id);
    // Immediately run the action for the suggestion
    runAction(s.action);
  }

  async function runAction(action: "bg_video" | "object_remove" | "narrate" | "motion") {
    if (!selectedSeg || !uploadedFile) {
      setActionError("No video uploaded yet — import a video first.");
      return;
    }
    setActionRunning(action); setActionResult(null); setActionError(""); setStatusMsg("");

    try {
      if (action === "bg_video") {
        const fd = new FormData();
        fd.append("file", uploadedFile);
        const res = await fetch("/api/video/bg-remove", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "BG remove failed");
        setActionResult({ url: data.outputUrl, provider: data.provider ?? "fal.ai", type: "video" });
        setStatusMsg(`Background removed on ${formatRange(selectedSeg.start, selectedSeg.end)}`);

      } else if (action === "object_remove") {
        const fd = new FormData();
        fd.append("file", uploadedFile);
        fd.append("prompt", "Remove any distracting foreground object");
        const res = await fetch("/api/video/object-remove", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Object remove failed");
        setActionResult({ url: data.outputUrl, provider: data.provider ?? "fal.ai", type: "video" });
        setStatusMsg(`Object removed on ${formatRange(selectedSeg.start, selectedSeg.end)}`);

      } else if (action === "narrate") {
        const text = narrationText.trim() || `Narration for scene ${formatRange(selectedSeg.start, selectedSeg.end)}`;
        const fd = new FormData();
        fd.append("file", uploadedFile);
        fd.append("text", text);
        const res = await fetch("/api/video-tools/narrate", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Narration failed");
        setStatusMsg(`Narration queued (${data.contentItemId}) — processing in background`);

      } else if (action === "motion") {
        // Motion transfer needs image+video. Show helpful message directing to the full Motion Transfer tool.
        setStatusMsg(`Motion Transfer requires a still image + this video as motion reference. Use the Motion Transfer tool in Classic Tools mode for the full workflow.`);
        setActionRunning(null);
        return;
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionRunning(null);
    }
  }

  return (
    <Card radius={14} padding={22} style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ color: ds.color.ink, fontWeight: 700, fontSize: 16, marginBottom: 2, fontFamily: ds.font.sans }}>
            Timeline Editor
            <span style={{ color: ds.color.gold, fontSize: 11, marginLeft: 8, fontWeight: 500, fontFamily: ds.font.mono }}>Phase 1</span>
          </h2>
          <p style={{ color: ds.color.mute, fontSize: 12 }}>Import a video to see scenes as segments you can edit individually.</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          <ButtonPrimary onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : videoSrc ? "Replace Video" : "Import Video"}
          </ButtonPrimary>
        </div>
      </div>

      {!videoSrc && (
        <div style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 10, padding: "48px 20px", textAlign: "center", color: ds.color.mute, fontSize: 13 }}>
          No video imported yet. Click <span style={{ color: ds.color.gold, fontWeight: 600 }}>Import Video</span> above to begin.
        </div>
      )}

      {videoSrc && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ background: "#000", borderRadius: 10, overflow: "hidden", border: `1px solid ${ds.color.line}` }}>
              <video ref={videoRef} src={videoSrc} controls onLoadedMetadata={handleVideoMetadata}
                style={{ width: "100%", height: 300, objectFit: "contain", background: "#000", display: "block" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, color: ds.color.mute, fontSize: 11, fontFamily: ds.font.mono }}>
              <span style={{ color: ds.color.gold }}>●</span>
              <span>{fileName || "untitled"}</span>
              {duration > 0 && <span>· {duration.toFixed(1)}s · {segments.length} scenes</span>}
            </div>

            <div>
              <div style={{ color: ds.color.mute, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6, fontFamily: ds.font.mono }}>
                Timeline
              </div>
              <div style={{ display: "flex", width: "100%", height: 62, background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: 8, overflow: "hidden" }}>
                {segments.map((seg, i) => {
                  const widthPct = duration > 0 ? ((seg.end - seg.start) / duration) * 100 : 100 / segments.length;
                  const isSel = seg.id === selectedSegId;
                  return (
                    <button key={seg.id} onClick={() => selectSegment(seg)} title={formatRange(seg.start, seg.end)}
                      style={{
                        flex: `0 0 ${widthPct}%`, position: "relative",
                        background: isSel ? `linear-gradient(135deg, ${ds.color.lilac}, ${ds.color.magenta})` : i % 2 === 0 ? "#1a1a26" : "#20202e",
                        border: "none", borderRight: i < segments.length - 1 ? `1px solid ${ds.color.line2}` : "none",
                        color: isSel ? "#fff" : ds.color.mute,
                        cursor: "pointer", fontSize: 11, fontWeight: isSel ? 700 : 500, padding: "6px 8px", textAlign: "left",
                        overflow: "hidden", transition: "background 0.15s", fontFamily: ds.font.mono,
                      }}>
                      <div style={{ fontSize: 10, opacity: 0.85 }}>Scene {i + 1}</div>
                      <div style={{ fontSize: 10, marginTop: 2 }}>{formatRange(seg.start, seg.end)}</div>
                    </button>
                  );
                })}
                {segments.length === 0 && (
                  <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: ds.color.mute, fontSize: 12 }}>
                    Waiting for video metadata…
                  </div>
                )}
              </div>
            </div>

            {selectedSeg && (
              <Card radius={10} padding={16}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ color: ds.color.mute, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: ds.font.mono }}>Selected Scene</div>
                    <div style={{ color: ds.color.lilac, fontSize: 15, fontWeight: 700, fontFamily: ds.font.mono, marginTop: 2 }}>
                      {formatRange(selectedSeg.start, selectedSeg.end)}
                    </div>
                  </div>
                  <div style={{ color: ds.color.mute, fontSize: 11 }}>
                    Duration {(selectedSeg.end - selectedSeg.start).toFixed(1)}s
                  </div>
                </div>
                {/* Narration text for "Add Text" action */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase" as const, letterSpacing: "0.12em", display: "block", marginBottom: 4 }}>
                    Narration text (for &ldquo;Add Text&rdquo; action)
                  </label>
                  <input
                    value={narrationText}
                    onChange={e => setNarrationText(e.target.value)}
                    placeholder="Text to speak over this scene…"
                    style={{ background: ds.color.card, color: ds.color.ink2, border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "8px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" as const }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {[
                    { label: "Change Background", action: "bg_video" as const },
                    { label: "Remove Object",     action: "object_remove" as const },
                    { label: "Add Text",          action: "narrate" as const },
                    { label: "Motion Transfer",   action: "motion" as const },
                  ].map(btn => (
                    <button key={btn.action} onClick={() => runAction(btn.action)}
                      style={{
                        background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: 8,
                        padding: "10px 12px", color: ds.color.ink2, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = ds.color.lilac; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = ds.color.line2; e.currentTarget.style.transform = ""; }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {statusMsg && <Card radius={8} padding="10px 14px" style={{ borderColor: "rgba(122,224,195,.2)" }}><p style={{ color: ds.color.mint, fontSize: 12 }}>{statusMsg}</p></Card>}
            {error && <Card radius={8} padding="10px 14px" style={{ borderColor: "rgba(255,122,69,.2)" }}><p style={{ color: ds.color.coral, fontSize: 12 }}>{error}</p></Card>}
            {actionRunning && (
              <Card radius={8} padding="10px 14px" style={{ borderColor: "rgba(245,166,35,.2)" }}>
                <p style={{ color: ds.color.gold, fontSize: 12 }}>Running {actionRunning}…</p>
              </Card>
            )}
            {actionError && (
              <Card radius={8} padding="10px 14px" style={{ borderColor: "rgba(255,122,69,.2)" }}>
                <p style={{ color: ds.color.coral, fontSize: 12 }}>{actionError}</p>
              </Card>
            )}
            {actionResult && (
              <Card radius={8} padding={14}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Check size={14} color={ds.color.mint} />
                  <span style={{ fontSize: 12, color: ds.color.mint, fontWeight: 600 }}>Done</span>
                  {actionResult.provider && (
                    <ModelChip provider={actionResult.provider} size="xs" position="static" />
                  )}
                </div>
                {actionResult.type === "video" ? (
                  <video src={actionResult.url} controls style={{ width: "100%", borderRadius: 6, maxHeight: 220 }} />
                ) : (
                  <img src={actionResult.url} alt="result" style={{ width: "100%", borderRadius: 6, maxHeight: 220, objectFit: "contain" }} />
                )}
                <a href={actionResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: ds.color.lilac, textDecoration: "none" }}>
                  Download result
                </a>
              </Card>
            )}
          </div>

          <Card radius={10} padding={14} style={{ alignSelf: "flex-start" }}>
            <div style={{ color: ds.color.lilac, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10, fontFamily: ds.font.mono }}>
              AI Suggestions
            </div>
            {loadingAiSuggestions && (
              <p style={{ color: ds.color.gold, fontSize: 11, marginBottom: 8 }}>Analyzing video with AI…</p>
            )}
            {!loadingAiSuggestions && suggestions.length === 0 && (
              <p style={{ color: ds.color.mute, fontSize: 11 }}>No suggestions yet — import a video.</p>
            )}
            {suggestions.map(s => (
              <Card key={s.id} radius={8} padding={10} style={{ marginBottom: 8 }}>
                <p style={{ color: ds.color.ink2, fontSize: 12, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{s.text}</p>
                <ButtonPrimary size="sm" onClick={() => applySuggestion(s)}>Apply</ButtonPrimary>
              </Card>
            ))}
          </Card>
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VideoToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>("trim");
  const [viewMode, setViewMode] = useState<ViewMode>("classic");

  const TOOLS: { id: Tool; label: string; icon: React.ReactNode; desc: string; provider?: string; cost?: string }[] = [
    { id: "trim",          label: "Trim Video",         icon: <Film size={13} />,  desc: "Cut a clip to specific start and end times" },
    { id: "narrate",       label: "Add Narration",      icon: <Mic size={13} />,  desc: "Layer a voiceover onto an existing video" },
    { id: "motion",        label: "Motion Transfer",    icon: <Film size={13} />,  desc: "Animate a still image using motion from a video" },
    { id: "bg_image",      label: "Remove BG (Image)",  icon: <Image size={13} />, desc: "Bria RMBG 2.0 — remove image background", provider: "Bria RMBG 2.0", cost: "~$0.01" },
    { id: "bg_video",      label: "Remove BG (Video)",  icon: <Film size={13} />,  desc: "fal.ai VEED pipeline — remove video background", provider: "fal.ai (VEED)", cost: "~$0.10/sec" },
    { id: "object_remove", label: "Remove Object",      icon: <X size={13} />,    desc: "Erase any object from a video using AI", provider: "fal.ai Eraser", cost: "~$0.05" },
  ];

  return (
    <div style={{ maxWidth: viewMode === "timeline" ? 1180 : 720, fontFamily: ds.font.sans }}>
      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <HeroTitle kicker="Studio / Tools" title="Video" italic="Toolkit" sub="Transform and enhance existing videos. Processed clips go to the Review Queue." />
      </div>

      {/* View mode toggle */}
      <div style={{ display: "inline-flex", marginBottom: 22, background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: 10, padding: 4 }}>
        {(["classic", "timeline"] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            style={{
              padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              fontFamily: ds.font.mono,
              background: viewMode === m ? "linear-gradient(120deg,#a78bfa,#d17bff,#ff9a3c,#f5a623,#a78bfa)" : "transparent",
              backgroundSize: viewMode === m ? "300% 100%" : undefined,
              animation: viewMode === m ? "btnSweep 6s linear infinite" : undefined,
              color: viewMode === m ? "#fff" : ds.color.mute,
              transition: "all 0.15s",
            }}>
            {m === "classic" ? "Classic Tools" : "Timeline Mode"}
          </button>
        ))}
      </div>

      {viewMode === "timeline" && <TimelineEditor />}

      {/* Tool tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              gap: 2, padding: "9px 14px", borderRadius: 10,
              border: `1px solid ${activeTool === t.id ? ds.color.lilac : ds.color.line2}`,
              background: activeTool === t.id ? "rgba(167,139,250,0.12)" : ds.color.card,
              color: activeTool === t.id ? ds.color.lilac : ds.color.mute,
              fontSize: 12, fontWeight: activeTool === t.id ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s", fontFamily: ds.font.sans,
            }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {t.icon}
              {t.label}
            </span>
            {t.provider && (
              <span style={{ fontSize: 9, color: activeTool === t.id ? ds.color.mute : ds.color.mute2, fontFamily: ds.font.mono }}>
                {t.provider} · {t.cost}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active tool */}
      {activeTool === "trim" && (
        <SectionCard title="Trim Video">
          <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 20 }}>
            Upload a video and set start and end times in seconds. The trimmed clip is saved and sent to Review.
            Uses stream copy — no quality loss, near-instant for most files.
          </p>
          <TrimTool />
        </SectionCard>
      )}

      {activeTool === "narrate" && (
        <SectionCard title="Add Narration">
          <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 20 }}>
            Upload a video and write narration text. The system generates a voiceover and overlays it
            onto the video. Uses ElevenLabs when configured, or mock voice as fallback.
          </p>
          <NarrateTool />
        </SectionCard>
      )}

      {activeTool === "motion" && (
        <SectionCard title="Motion Transfer">
          <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 20 }}>
            Upload a still image and a motion reference video. The system animates the image
            using the motion from the video — e.g. make a photo of a person dance.
          </p>
          <MotionTransferTool />
        </SectionCard>
      )}

      {activeTool === "bg_image" && (
        <SectionCard title="Remove Background — Image">
          <ProviderBadge name="Bria RMBG 2.0" via="fal.ai" cost="~$0.01 / image" phase="Phase 1 — daily need" />
          <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 20 }}>
            Upload any image. AI removes the background and returns a transparent PNG.
            Best for product shots, portraits, and marketing assets.
          </p>
          <BgImageTool />
        </SectionCard>
      )}

      {activeTool === "bg_video" && (
        <SectionCard title="Remove Background — Video">
          <ProviderBadge name="VEED via fal.ai" via="fal.ai" cost="~$0.10 / sec" phase="Phase 2" />
          <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 20 }}>
            Upload a video. AI removes the background from every frame.
            Optionally set a new background color or description.
          </p>
          <BgVideoTool />
        </SectionCard>
      )}

      {activeTool === "object_remove" && (
        <SectionCard title="Remove Object from Video">
          <ProviderBadge name="fal.ai Object Eraser" via="fal.ai" cost="~$0.05 / clip" phase="Phase 2" />
          <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 20 }}>
            Describe the object you want removed (logo, person, watermark, etc.) and AI
            erases it from every frame using inpainting.
          </p>
          <ObjectRemoveTool />
        </SectionCard>
      )}

      {/* Footer */}
      <Card radius={10} padding="12px 16px" style={{ marginTop: 20 }}>
        <p style={{ color: ds.color.mute2, fontSize: 11, fontWeight: 700, marginBottom: 6, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>Coming next</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Replace Music", "Add SFX", "Replace Voiceover", "Subtitle Burn-in"].map(f => (
            <span key={f} style={{ color: ds.color.mute2, fontSize: 11, background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "3px 9px" }}>{f}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
