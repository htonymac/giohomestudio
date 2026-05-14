"use client";

// Scene Forge — AI Content Creator
// Talking Avatar: Upload photo → script → voice → lip-sync → final video

import { useState, useRef, useEffect, useCallback } from "react";
import { useGate } from "../../components/PreGenerationGate";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import { useProjectSettings } from "@/hooks/useProjectSettings";
import ModelPicker from "../../components/ModelPicker";
import { ds } from "../../../lib/designSystem";
import { HeroTitle } from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { User, Music, Film, Settings, Check, X, Mic } from "../../components/icons";
import { safeJson } from "../../../lib/api-utils";
import CharacterPicker from "../../components/CharacterPicker";

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

const STYLES: { id: Style; label: string; desc: string }[] = [
  { id: "commercial", label: "Commercial", desc: "Sell with energy" },
  { id: "interview",  label: "Interview",  desc: "Calm & credible" },
  { id: "story",      label: "Story",      desc: "Emotional pull" },
  { id: "explainer",  label: "Explainer",  desc: "Clear & helpful" },
];

const RATIOS: { id: AspectRatio; label: string; icon: string }[] = [
  { id: "9:16",  label: "Vertical",   icon: "▯" },
  { id: "16:9",  label: "Landscape",  icon: "▭" },
  { id: "1:1",   label: "Square",     icon: "□" },
];

const DURATIONS = [15, 30, 60, 90, 120];

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  display: "block", marginBottom: 8, fontSize: 10, fontWeight: 700,
  letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, fontFamily: ds.font.mono,
};

const inputSt = (): React.CSSProperties => ({
  width: "100%", boxSizing: "border-box", padding: "10px 14px",
  background: ds.color.card, border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm, color: ds.color.ink, fontSize: 13, outline: "none", fontFamily: ds.font.sans,
});

// ── Component ─────────────────────────────────────────────────────────────────

const SCENE_FORGE_DB_KEY = "ghs_sceneforge_session";

export default function SceneForgePage() {
  const { requireGate, GateModal } = useGate();
  // Inputs
  const [imageUrl, setImageUrl]         = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [topic, setTopic]               = useState<string>("");
  const [style, setStyle]               = useState<Style>("commercial");
  const [aspect, setAspect]             = useState<AspectRatio>("9:16");
  const [duration, setDuration]         = useState<number>(30);
  const [voice, setVoice]               = useState<string>("default");
  const [addMusic, setAddMusic]         = useState<boolean>(true);
  const [musicTier, setMusicTier]       = useState<"standard" | "ghs_karaoke" | "pro" | "classic" | "premium">("standard");
  const [addBroll, setAddBroll]         = useState<boolean>(false);
  const [tier, setTier]                 = useState<AITier>("pro");
  const [videoModel, setVideoModel]     = useState<string>("muapi_seedance_v2");
  const [imageModel, setImageModel]     = useState<string>("fal_flux_dev");

  // ── Phase C.6 — ProjectSettings hook (keyed to session DB key so settings persist) ──
  const { settings: projectSettings, patch: patchProjectSettings } =
    useProjectSettings(SCENE_FORGE_DB_KEY);

  // effective* shims: hook value wins, local state is fallback
  const effectiveProjectStyle      = projectSettings.visualStyle ?? style;
  const effectiveAspectRatio       = projectSettings.aspectRatio ?? aspect;
  const effectiveNarrationProvider = projectSettings.narrationProvider ?? voice;
  const effectiveSoundTier         = projectSettings.soundTier ?? musicTier;
  const effectiveVideoModelId      = (projectSettings.videoModelVersion !== "auto" ? projectSettings.videoModelVersion : null) ?? videoModel;
  const effectiveImageModelId      = (projectSettings.imageModelVersion !== "auto" ? projectSettings.imageModelVersion : null) ?? imageModel;
  // tier (AITier) has no equivalent hook field — skip per C.6 spec

  // Job
  const [job, setJob]     = useState<JobState>({ status: "idle", step: "", steps: [] });
  const [jobId, setJobId] = useState<string>("");
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  // History
  const [history, setHistory] = useState<{ videoUrl: string; topic: string; ts: number }[]>([]);

  const [polishing, setPolishing] = useState(false);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [autoGenPortrait, setAutoGenPortrait] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  // ── Restore state on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/hybrid/saved-state?localId=${SCENE_FORGE_DB_KEY}`)
      .then(r => r.json())
      .then(d => {
        if (!d.found || !d.data) return;
        const s = d.data as Record<string, unknown>;
        if (s.topic)    setTopic(s.topic as string);
        if (s.style)    setStyle(s.style as Style);
        if (s.aspect)   setAspect(s.aspect as AspectRatio);
        if (s.duration) setDuration(s.duration as number);
        if (s.voice)    setVoice(s.voice as string);
        if (typeof s.addMusic === "boolean") setAddMusic(s.addMusic);
        if (s.musicTier) setMusicTier(s.musicTier as "standard" | "ghs_karaoke" | "pro" | "classic" | "premium");
        if (typeof s.addBroll === "boolean") setAddBroll(s.addBroll);
        if (s.tier)       setTier(s.tier as AITier);
        if (s.videoModel) setVideoModel(s.videoModel as string);
        if (s.imageModel) setImageModel(s.imageModel as string);
        if (Array.isArray(s.history)) setHistory(s.history as { videoUrl: string; topic: string; ts: number }[]);
      })
      .catch(() => {})
      .finally(() => { restoredRef.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save state on changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!restoredRef.current) return;
    const draft = { topic, style, aspect, duration, voice, addMusic, musicTier, addBroll, tier, videoModel, imageModel, history: history.slice(0, 20) };
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: SCENE_FORGE_DB_KEY, data: draft }),
    }).catch(() => {});
  }, [topic, style, aspect, duration, voice, addMusic, addBroll, tier, videoModel, imageModel, history]);

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
        const data = await safeJson<{ status: JobState["status"]; step?: string; steps?: Step[]; result?: { videoUrl: string; script: string; audioUrl: string }; error?: string }>(res, "avatar/create poll");

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
            const resultRef = data.result;
            setHistory(h => [{ videoUrl: resultRef.videoUrl, topic, ts: Date.now() }, ...h.slice(0, 9)]);
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

      const formData = new FormData();
      formData.append("file", file);
      fetch("/api/upload", { method: "POST", body: formData })
        .then(r => r.json())
        .then(d => setImageUrl(d.url || dataUrl))
        .catch(() => setImageUrl(dataUrl));
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
    try { await requireGate(); } catch { return; }
    if (!imageUrl) return;
    if (!topic.trim()) return;

    setJob({ status: "queued", step: "Starting", steps: [] });

    try {
      const res = await fetch("/api/avatar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, topic, style: effectiveProjectStyle, aspectRatio: effectiveAspectRatio, duration, voice: effectiveNarrationProvider, addBroll, addMusic, musicTier: effectiveSoundTier, tier, videoModel: effectiveVideoModelId, imageModel: effectiveImageModelId }),
      });
      const data = await safeJson<{ jobId?: string; error?: string }>(res, "avatar/create");
      if (data.error) throw new Error(data.error);
      setJobId(data.jobId ?? "");
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
    <div style={{ minHeight: "100vh", background: ds.color.paper, color: ds.color.ink, fontFamily: ds.font.sans, padding: "0 0 80px" }}>
      <GateModal />

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${ds.color.line}`, padding: "20px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${ds.color.lilac}, ${ds.color.magenta})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <User size={18} style={{ color: "#fff" }} />
        </div>
        <div>
          <HeroTitle kicker="Studio" title="Scene" italic="Forge" />
          <p style={{ margin: 0, fontSize: 12, color: ds.color.mute }}>AI Talking Avatar · Upload a face, get a video</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono }}>AI Model</span>
          <AITierSelector value={tier} onChange={setTier} compact />
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "340px 1fr", gap: 28, alignItems: "start" }}>

        {/* ── Left: Input panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Photo upload */}
          <div>
            <label style={labelSt}>Character Photo</label>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${imagePreview ? ds.color.lilac : ds.color.line2}`,
                borderRadius: 14,
                aspectRatio: "3/4",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
                background: imagePreview ? "transparent" : ds.color.card,
                transition: "border-color 0.2s",
              }}
            >
              {autoGenPortrait ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, border: `3px solid ${ds.color.lilac}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ margin: 0, fontSize: 11, color: ds.color.lilac, textAlign: "center" }}>Generating portrait...</p>
                </div>
              ) : imagePreview ? (
                <img src={imagePreview} alt="Character" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <>
                  <div style={{ opacity: 0.4, marginBottom: 10 }}><User size={40} /></div>
                  <p style={{ margin: 0, fontSize: 13, color: ds.color.mute, textAlign: "center", lineHeight: 1.5 }}>
                    Drop a photo here<br />
                    <span style={{ fontSize: 11, color: ds.color.mute2 }}>or click to browse</span>
                  </p>
                </>
              )}
              {imagePreview && (
                <button
                  onClick={e => { e.stopPropagation(); setImagePreview(""); setImageUrl(""); }}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "none", color: ds.color.ink, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {/* OR: image URL */}
          <div>
            <label style={labelSt}>Or paste image URL</label>
            <input
              value={imageUrl.startsWith("data:") ? "" : imageUrl}
              onChange={e => { setImageUrl(e.target.value); setImagePreview(e.target.value); }}
              placeholder="https://..."
              style={inputSt()}
            />
          </div>

          {/* OR: pick from Characters library */}
          <div>
            <button
              onClick={() => setShowCharPicker(v => !v)}
              style={{ width: "100%", padding: "9px 14px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.line2}`, background: showCharPicker ? `${ds.color.lilac}12` : ds.color.card, color: showCharPicker ? ds.color.lilac : ds.color.mute, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}
            >
              {showCharPicker ? "▲ Close Characters" : "▼ Pick from Characters Library"}
            </button>
            {showCharPicker && (
              <div style={{ marginTop: 8 }}>
                <CharacterPicker
                  compact
                  onSelect={async char => {
                    setShowCharPicker(false);
                    const url = char.imageUrl ?? "";
                    const normalized = url.startsWith("http") || url.startsWith("/api/") || url.startsWith("blob:") || url.startsWith("data:")
                      ? url
                      : url ? `/api/media/${url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}` : "";
                    if (normalized) {
                      setImageUrl(normalized);
                      setImagePreview(normalized);
                    } else if (char.id) {
                      // No image — auto-generate portrait using visualDescription
                      setAutoGenPortrait(true);
                      try {
                        const res = await fetch(`/api/character-voices/${char.id}/generate-portrait`, { method: "POST" });
                        const d = await res.json() as { imageUrl?: string; error?: string };
                        if (d.imageUrl) { setImageUrl(d.imageUrl); setImagePreview(d.imageUrl); }
                      } catch { /* ignore */ } finally { setAutoGenPortrait(false); }
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Style */}
          <div>
            <label style={labelSt}>Video Style</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {STYLES.map(s => (
                <button key={s.id} onClick={() => { setStyle(s.id); patchProjectSettings({ visualStyle: s.id }).catch(() => {}); }} style={{
                  display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                  background: effectiveProjectStyle === s.id ? "rgba(167,139,250,0.12)" : ds.color.card,
                  border: `1px solid ${effectiveProjectStyle === s.id ? ds.color.lilac : ds.color.line2}`,
                  borderRadius: ds.radius.sm, cursor: "pointer", color: ds.color.ink, textAlign: "left",
                  transition: "all 0.15s",
                }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: effectiveProjectStyle === s.id ? ds.color.lilac : ds.color.ink2 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: ds.color.mute }}>{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration + Aspect */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Duration</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{
                    padding: "5px 10px", borderRadius: 8, border: `1px solid ${duration === d ? ds.color.lilac : ds.color.line2}`,
                    background: duration === d ? "rgba(167,139,250,0.12)" : ds.color.card,
                    color: duration === d ? ds.color.lilac : ds.color.mute,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: ds.font.mono,
                  }}>
                    {d < 60 ? `${d}s` : `${d / 60}m`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelSt}>Format</label>
              <div style={{ display: "flex", gap: 6 }}>
                {RATIOS.map(r => (
                  <button key={r.id} onClick={() => { setAspect(r.id); patchProjectSettings({ aspectRatio: r.id }).catch(() => {}); }} title={r.label} style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8,
                    border: `1px solid ${effectiveAspectRatio === r.id ? ds.color.lilac : ds.color.line2}`,
                    background: effectiveAspectRatio === r.id ? "rgba(167,139,250,0.12)" : ds.color.card,
                    color: effectiveAspectRatio === r.id ? ds.color.lilac : ds.color.mute,
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
            <ToggleChip label="Music" icon={<Music size={12} />} active={addMusic} onChange={setAddMusic} />
            <ToggleChip label="B-roll" icon={<Film size={12} />} active={addBroll} onChange={setAddBroll} />
          </div>

          {/* Music tier selector */}
          {addMusic && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: ds.color.mute2, fontFamily: ds.font.sans, letterSpacing: "0.05em", textTransform: "uppercase" }}>Music Source</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {([
                  { id: "standard",    label: "GHS Standard", desc: "Piper TTS — free, always available",      badge: "FREE",    color: ds.color.lilac },
                  { id: "ghs_karaoke", label: "GHS Pro",      desc: "GHS Karaoke built-in",                   badge: "LOW",     color: "#22c55e" },
                  { id: "pro",         label: "GHS Karaoke",  desc: "FAL Stable Audio — up to 47s",           badge: "MID",     color: "#7cc4ff" },
                  { id: "classic",     label: "GHS Classic",  desc: "Suno via Kie.ai — full songs",           badge: "PREMIUM", color: "#ff9a3c" },
                  { id: "premium",     label: "GHS Premium",  desc: "Suno via Kie.ai — premium quality",      badge: "HIGHEST", color: "#a855f7" },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => { setMusicTier(opt.id); patchProjectSettings({ soundTier: opt.id }).catch(() => {}); }}
                    style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${effectiveSoundTier === opt.id ? opt.color : ds.color.line2}`, background: effectiveSoundTier === opt.id ? `${opt.color}14` : ds.color.card, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: effectiveSoundTier === opt.id ? opt.color : ds.color.mute, fontFamily: ds.font.sans }}>{opt.label}</p>
                      <p style={{ margin: 0, fontSize: 11, color: ds.color.mute2, fontFamily: ds.font.sans }}>{opt.desc}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: opt.color, border: `1px solid ${opt.color}44`, borderRadius: 4, padding: "2px 6px", fontFamily: ds.font.mono }}>{opt.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video + Image models */}
          {addBroll && (
            <div>
              <label style={labelSt}>B-roll Models</label>
              <ModelPicker videoModel={effectiveVideoModelId} imageModel={effectiveImageModelId}
                onVideoChange={v => { setVideoModel(v); patchProjectSettings({ videoModelVersion: v }).catch(() => {}); }}
                onImageChange={v => { setImageModel(v); patchProjectSettings({ imageModelVersion: v }).catch(() => {}); }}
                accentColor={ds.color.lilac} compact />
            </div>
          )}

        </div>

        {/* ── Right: Topic + Output ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Topic input */}
          <div>
            <label style={labelSt}>What should the avatar talk about?</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Our new app that saves 2 hours of your workday by automating follow-up emails..."
              rows={4}
              style={{ ...inputSt(), resize: "vertical", minHeight: 100, lineHeight: 1.6 }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <p style={{ margin: 0, fontSize: 11, color: ds.color.mute2 }}>
                GHS AI writes the script from your description. The avatar lip-syncs to it.
              </p>
              <button
                onClick={async () => {
                  if (!topic.trim() || polishing) return;
                  setPolishing(true);
                  try {
                    const res = await fetch("/api/free-mode/enhance", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ rawPrompt: `Rewrite this as a clear, punchy, engaging description for a ${effectiveProjectStyle} style talking avatar video. Keep it concise and compelling. Original: ${topic}`, mode: "text_to_video" }),
                    });
                    if (res.ok) {
                      const d = await res.json() as { enhanced?: string; result?: string };
                      const polished = d.enhanced || d.result;
                      if (polished) setTopic(polished);
                    }
                  } catch { /* ignore */ } finally { setPolishing(false); }
                }}
                disabled={!topic.trim() || polishing}
                style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${ds.color.lilac}`, background: "rgba(160,100,220,0.1)", color: ds.color.lilac, fontSize: 11, fontWeight: 700, cursor: (!topic.trim() || polishing) ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 10 }}>
                {polishing ? "Polishing…" : "✨ AI Polish"}
              </button>
            </div>
          </div>

          {/* Generate button */}
          {!isRunning && !isDone && (
            <ButtonPrimary onClick={generate} disabled={!canGenerate} size="lg">
              Create Talking Avatar
            </ButtonPrimary>
          )}

          {/* Progress */}
          {(isRunning || isDone || isError) && (
            <Card radius={14} padding={24}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: ds.color.ink }}>
                    {isRunning ? `${job.step}...` : isDone ? "Avatar Ready" : "Generation Failed"}
                  </p>
                  {isRunning && <p style={{ margin: "4px 0 0", fontSize: 11, color: ds.color.mute }}>This takes 2–4 minutes. You can close this tab.</p>}
                </div>
                <button onClick={reset} style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, color: ds.color.mute, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
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
                        background: s.status === "done" ? ds.color.mint : s.status === "error" ? ds.color.coral : ds.color.card,
                        border: `2px solid ${s.status === "done" ? ds.color.mint : s.status === "error" ? ds.color.coral : ds.color.line2}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                      }}>
                        {s.status === "done" ? <Check size={10} /> : s.status === "error" ? <X size={10} /> : <Spinner />}
                      </div>
                      <span style={{ fontSize: 13, color: s.status === "pending" ? ds.color.mute2 : ds.color.ink }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {isError && (
                <div data-testid="scene-forge-error" style={{ padding: "12px 16px", background: "rgba(255,122,69,.08)", borderRadius: 8, border: `1px solid rgba(255,122,69,.25)`, fontSize: 12, color: ds.color.coral }}>
                  {job.error}
                </div>
              )}

              {/* Result */}
              {isDone && job.result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <video src={job.result.videoUrl} controls autoPlay loop
                    style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 400, objectFit: "contain" }} />
                  <details>
                    <summary style={{ fontSize: 12, color: ds.color.mute, cursor: "pointer" }}>View generated script</summary>
                    <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.7, color: ds.color.ink, padding: "12px 16px", background: ds.color.card, borderRadius: 8 }}>
                      {job.result.script}
                    </p>
                  </details>
                  <div style={{ display: "flex", gap: 10 }}>
                    <a href={job.result.videoUrl} download="avatar-video.mp4"
                      style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 10, background: ds.color.lilac, color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                      Download Video
                    </a>
                    <button onClick={reset}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.ink, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      New Avatar
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* How it works */}
          {job.status === "idle" && (
            <Card radius={14} padding={20}>
              <p style={{ margin: "0 0 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, fontFamily: ds.font.mono }}>How Scene Forge Works</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  [<Settings size={16} />, "Writes the script",    "GHS AI reads your topic and writes a punchy, well-paced spoken script tailored to your chosen style."],
                  [<Mic size={16} />,    "Generates the voice",   "The script is converted to realistic speech using ElevenLabs or your system TTS."],
                  [<User size={16} />,   "Lip-sync animation",    "Your character photo is animated to match the voice — realistic mouth movement, not a cartoon."],
                  [<Film size={16} />,   "B-roll + music",        "Optional cinematic B-roll cutaways and background music are added to make the video feel produced."],
                  [<Check size={16} />,  "Final assembly",         "Everything is assembled into a single polished video file, ready to download or publish."],
                ].map(([icon, title, desc], idx) => (
                  <div key={String(title)} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, marginTop: 1, color: ds.color.lilac }}>{icon as React.ReactNode}</span>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: ds.color.ink }}>{title as string}</p>
                      <p style={{ margin: 0, fontSize: 12, color: ds.color.mute, lineHeight: 1.5 }}>{desc as string}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, fontFamily: ds.font.mono }}>Recent</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {history.map((h, i) => (
                  <Card key={i} radius={10} padding={0} style={{ overflow: "hidden" }}>
                    <video src={h.videoUrl} style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }} muted />
                    <p style={{ margin: 0, padding: "8px 10px", fontSize: 11, color: ds.color.mute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.topic}</p>
                  </Card>
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

function ToggleChip({ label, icon, active, onChange }: {
  label: string; icon: React.ReactNode; active: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      style={{
        flex: 1, padding: "9px 12px", borderRadius: ds.radius.sm, cursor: "pointer",
        border: `1px solid ${active ? ds.color.lilac : ds.color.line2}`,
        background: active ? "rgba(167,139,250,0.12)" : ds.color.card,
        color: active ? ds.color.lilac : ds.color.mute,
        fontSize: 12, fontWeight: 600, transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
      }}
    >
      {icon} {label}
    </button>
  );
}

function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, border: `1.5px solid ${ds.color.mute2}`, borderTopColor: ds.color.ink2, borderRadius: "50%", animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

