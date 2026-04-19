"use client";

// Scene Forge — AI Content Creator
// Talking Avatar: Upload photo → script → voice → lip-sync → final video
// Design: Dark editorial, neon accent, asymmetric layout

import { useState, useRef, useEffect, useCallback } from "react";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import ModelPicker from "../../components/ModelPicker";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:      "#0a0a0f",
  surf1:   "#111118",
  surf2:   "#18181f",
  surf3:   "#22222e",
  border:  "#2a2a3a",
  accent:  "#7c5cfc",
  accentB: "#5b3de8",
  glow:    "rgba(124,92,252,0.18)",
  green:   "#22c55e",
  amber:   "#f59e0b",
  red:     "#ef4444",
  cyan:    "#06b6d4",
  text:    "#f0f0f8",
  muted:   "#8888aa",
  dim:     "#55556a",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type Style = "commercial" | "interview" | "story" | "explainer";
type AspectRatio = "9:16" | "16:9" | "1:1";

interface Step { name: string; status: "pending" | "done" | "error" }
interface JobState {
  status: "idle" | "queued" | "running" | "done" | "error";
  step: string;
  steps: Step[];
  result?: { videoUrl: string; script: string; audioUrl: string };
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLES: { id: Style; label: string; desc: string; emoji: string }[] = [
  { id: "commercial", label: "Commercial", desc: "Sell with energy", emoji: "📣" },
  { id: "interview",  label: "Interview",  desc: "Calm & credible",  emoji: "🎙️" },
  { id: "story",      label: "Story",      desc: "Emotional pull",   emoji: "📖" },
  { id: "explainer",  label: "Explainer",  desc: "Clear & helpful",  emoji: "💡" },
];

const RATIOS: { id: AspectRatio; label: string; icon: string }[] = [
  { id: "9:16",  label: "Vertical",   icon: "▯" },
  { id: "16:9",  label: "Landscape",  icon: "▭" },
  { id: "1:1",   label: "Square",     icon: "□" },
];

const DURATIONS = [15, 30, 60, 90, 120];

// ── Component ─────────────────────────────────────────────────────────────────

export default function SceneForgePage() {
  // Inputs
  const [imageUrl, setImageUrl]       = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [topic, setTopic]             = useState<string>("");
  const [style, setStyle]             = useState<Style>("commercial");
  const [aspect, setAspect]           = useState<AspectRatio>("9:16");
  const [duration, setDuration]       = useState<number>(30);
  const [voice, setVoice]             = useState<string>("default");
  const [addMusic, setAddMusic]       = useState<boolean>(true);
  const [addBroll, setAddBroll]       = useState<boolean>(false);
  const [tier, setTier]               = useState<AITier>("pro");
  const [videoModel, setVideoModel]   = useState<string>("muapi_seedance_v2");
  const [imageModel, setImageModel]   = useState<string>("fal_flux_dev");

  // Job
  const [job, setJob]     = useState<JobState>({ status: "idle", step: "", steps: [] });
  const [jobId, setJobId] = useState<string>("");
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  // History
  const [history, setHistory] = useState<{ videoUrl: string; topic: string; ts: number }[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Polling ────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    if (!jobId || job.status === "idle") return;

    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/avatar/create?jobId=${jobId}`);
        if (!res.ok) return;
        const data = await res.json();

        setJob({
          status: data.status,
          step: data.step || "",
          steps: data.steps || [],
          result: data.result,
          error: data.error,
        });

        if (data.status === "done" || data.status === "error") {
          stopPolling();
          if (data.status === "done" && data.result?.videoUrl) {
            setHistory(h => [{ videoUrl: data.result.videoUrl, topic, ts: Date.now() }, ...h.slice(0, 9)]);
          }
        }
      } catch { /* ignore poll errors */ }
    }, 2500);

    return stopPolling;
  }, [jobId, job.status, stopPolling, topic]);

  // ── File upload ────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);

      // Upload to server
      const formData = new FormData();
      formData.append("file", file);
      fetch("/api/upload", { method: "POST", body: formData })
        .then(r => r.json())
        .then(d => setImageUrl(d.url || dataUrl))
        .catch(() => setImageUrl(dataUrl)); // fallback to data URL
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Generate ───────────────────────────────────────────────────────────────

  const generate = async () => {
    if (!imageUrl) return;
    if (!topic.trim()) return;

    setJob({ status: "queued", step: "Starting", steps: [] });

    try {
      const res = await fetch("/api/avatar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, topic, style, aspectRatio: aspect, duration, voice, addBroll, addMusic, tier, videoModel, imageModel }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobId(data.jobId);
    } catch (e) {
      setJob({ status: "error", step: "Failed", steps: [], error: e instanceof Error ? e.message : "Error" });
    }
  };

  const reset = () => {
    stopPolling();
    setJobId("");
    setJob({ status: "idle", step: "", steps: [] });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isRunning  = job.status === "queued" || job.status === "running";
  const isDone     = job.status === "done";
  const isError    = job.status === "error";
  const canGenerate = !!imageUrl && !!topic.trim() && !isRunning;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: "0 0 80px" }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "20px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, #c026d3)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          🎭
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>Scene Forge</h1>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>AI Talking Avatar · Upload a face, get a video</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted }}>AI Model</span>
          <AITierSelector value={tier} onChange={setTier} compact />
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "340px 1fr", gap: 28, alignItems: "start" }}>

        {/* ── Left: Input panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Photo upload */}
          <div>
            <label style={labelStyle}>Character Photo</label>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${imagePreview ? C.accent : C.border}`,
                borderRadius: 14,
                aspectRatio: "3/4",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                background: imagePreview ? "transparent" : C.surf1,
                transition: "border-color 0.2s",
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Character" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>👤</div>
                  <p style={{ margin: 0, fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 1.5 }}>
                    Drop a photo here<br />
                    <span style={{ fontSize: 11, color: C.dim }}>or click to browse</span>
                  </p>
                </>
              )}
              {imagePreview && (
                <button
                  onClick={e => { e.stopPropagation(); setImagePreview(""); setImageUrl(""); }}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", color: C.text, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}
                >
                  ✕
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {/* OR: image URL */}
          <div>
            <label style={labelStyle}>Or paste image URL</label>
            <input
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={e => { setImageUrl(e.target.value); setImagePreview(e.target.value); }}
              placeholder="https://..."
              style={inputStyle()}
            />
          </div>

          {/* Style */}
          <div>
            <label style={labelStyle}>Video Style</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)} style={chipStyle(style === s.id, C)}>
                  <span style={{ fontSize: 16 }}>{s.emoji}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration + Aspect */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Duration</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{
                    padding: "5px 10px", borderRadius: 8, border: `1px solid ${duration === d ? C.accent : C.border}`,
                    background: duration === d ? C.accent + "20" : C.surf2, color: duration === d ? C.accent : C.muted,
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                    {d < 60 ? `${d}s` : `${d / 60}m`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Format</label>
              <div style={{ display: "flex", gap: 6 }}>
                {RATIOS.map(r => (
                  <button key={r.id} onClick={() => setAspect(r.id)} title={r.label} style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${aspect === r.id ? C.accent : C.border}`,
                    background: aspect === r.id ? C.accent + "20" : C.surf2, color: aspect === r.id ? C.accent : C.muted,
                    fontSize: 14, cursor: "pointer",
                  }}>
                    {r.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Options */}
          <div style={{ display: "flex", gap: 12 }}>
            <ToggleChip label="🎵 Music" active={addMusic} onChange={setAddMusic} accent={C.accent} border={C.border} surf={C.surf2} muted={C.muted} />
            <ToggleChip label="🎬 B-roll" active={addBroll} onChange={setAddBroll} accent={C.accent} border={C.border} surf={C.surf2} muted={C.muted} />
          </div>

          {/* Video + Image models */}
          {addBroll && (
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" as const, color: C.muted }}>B-roll Models</label>
              <ModelPicker videoModel={videoModel} imageModel={imageModel}
                onVideoChange={setVideoModel} onImageChange={setImageModel}
                accentColor={C.accent} compact />
            </div>
          )}

        </div>

        {/* ── Right: Topic + Output ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Topic input */}
          <div>
            <label style={labelStyle}>What should the avatar talk about?</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Our new app that saves 2 hours of your workday by automating follow-up emails..."
              rows={4}
              style={{ ...inputStyle(), resize: "vertical", minHeight: 100, fontFamily: "inherit", lineHeight: 1.6 }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 11, color: C.dim }}>
              GHS AI writes the script from your description. The avatar lip-syncs to it.
            </p>
          </div>

          {/* Generate button */}
          {!isRunning && !isDone && (
            <button
              onClick={generate}
              disabled={!canGenerate}
              style={{
                padding: "16px 32px",
                borderRadius: 12,
                border: "none",
                background: canGenerate ? `linear-gradient(135deg, ${C.accent}, #c026d3)` : C.surf3,
                color: canGenerate ? "#fff" : C.dim,
                fontSize: 15,
                fontWeight: 700,
                cursor: canGenerate ? "pointer" : "not-allowed",
                letterSpacing: 0.5,
                boxShadow: canGenerate ? `0 0 32px ${C.glow}` : "none",
                transition: "all 0.2s",
              }}
            >
              🎭 Create Talking Avatar
            </button>
          )}

          {/* Progress */}
          {(isRunning || isDone || isError) && (
            <div style={{ background: C.surf1, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                    {isRunning ? `⚙️ ${job.step}...` : isDone ? "✅ Avatar Ready" : "❌ Generation Failed"}
                  </p>
                  {isRunning && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>This takes 2–4 minutes. You can close this tab.</p>}
                </div>
                <button onClick={reset} style={{ background: C.surf3, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
                  {isDone || isError ? "Start Over" : "Cancel"}
                </button>
              </div>

              {/* Step tracker */}
              {job.steps.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {job.steps.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        background: s.status === "done" ? C.green : s.status === "error" ? C.red : C.surf3,
                        border: `2px solid ${s.status === "done" ? C.green : s.status === "error" ? C.red : C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                      }}>
                        {s.status === "done" ? "✓" : s.status === "error" ? "✕" : <Spinner />}
                      </div>
                      <span style={{ fontSize: 13, color: s.status === "pending" ? C.dim : C.text }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {isError && (
                <div style={{ padding: "12px 16px", background: C.red + "15", borderRadius: 8, border: `1px solid ${C.red}40`, fontSize: 12, color: C.red }}>
                  {job.error}
                </div>
              )}

              {/* Result */}
              {isDone && job.result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <video
                    src={job.result.videoUrl}
                    controls
                    autoPlay
                    loop
                    style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 400, objectFit: "contain" }}
                  />
                  <details>
                    <summary style={{ fontSize: 12, color: C.muted, cursor: "pointer" }}>View generated script</summary>
                    <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: C.text, padding: "12px 16px", background: C.surf2, borderRadius: 8 }}>
                      {job.result.script}
                    </p>
                  </details>
                  <div style={{ display: "flex", gap: 10 }}>
                    <a
                      href={job.result.videoUrl}
                      download="avatar-video.mp4"
                      style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
                    >
                      ⬇ Download Video
                    </a>
                    <button
                      onClick={reset}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surf2, color: C.text, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                    >
                      + New Avatar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* How it works */}
          {job.status === "idle" && (
            <div style={{ background: C.surf1, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.dim }}>How Scene Forge Works</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  ["✍️", "Writes the script",    "GHS AI reads your topic and writes a punchy, well-paced spoken script tailored to your chosen style."],
                  ["🗣️", "Generates the voice",  "The script is converted to realistic speech using ElevenLabs or your system TTS."],
                  ["🎭", "Lip-sync animation",    "Your character photo is animated to match the voice — realistic mouth movement, not a cartoon."],
                  ["🎬", "B-roll + music",        "Optional cinematic B-roll cutaways and background music are added to make the video feel produced."],
                  ["⚡", "Final assembly",         "Everything is assembled into a single polished video file, ready to download or publish."],
                ].map(([icon, title, desc]) => (
                  <div key={String(title)} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600 }}>{title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.dim }}>Recent</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ background: C.surf1, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <video src={h.videoUrl} style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} muted />
                    <p style={{ margin: 0, padding: "8px 10px", fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.topic}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700,
  letterSpacing: 1.2, textTransform: "uppercase", color: "#8888aa",
};

const inputStyle = (): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: "10px 14px",
  background: "#111118", border: `1px solid #2a2a3a`,
  borderRadius: 10, color: "#f0f0f8", fontSize: 13, outline: "none",
});

const chipStyle = (active: boolean, C: { accent: string; border: string; surf2: string; text: string; muted: string }): React.CSSProperties => ({
  display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
  background: active ? C.accent + "18" : C.surf2,
  border: `1px solid ${active ? C.accent : C.border}`,
  borderRadius: 10, cursor: "pointer", color: C.text, textAlign: "left",
  transition: "all 0.15s",
});

function ToggleChip({ label, active, onChange, accent, border, surf, muted }: {
  label: string; active: boolean; onChange: (v: boolean) => void;
  accent: string; border: string; surf: string; muted: string;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      style={{
        flex: 1, padding: "9px 12px", borderRadius: 10, cursor: "pointer",
        border: `1px solid ${active ? accent : border}`,
        background: active ? accent + "18" : surf,
        color: active ? accent : muted,
        fontSize: 12, fontWeight: 600, transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid #555", borderTopColor: "#aaa", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
