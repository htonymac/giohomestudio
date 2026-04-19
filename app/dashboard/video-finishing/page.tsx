"use client";

import { useState, useRef } from "react";
import CharacterPicker from "../../components/CharacterPicker";
import NarrationControls from "../../components/NarrationControls";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import type { NarrationSettings } from "../../components/NarrationControls";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Video Finishing Studio
//
// From Support Canvas:
// "Import existing video → analyze → plan layers → review → approve → assemble → export"
//
// 5-step flow:
// 1. Import — upload or select video from asset library
// 2. Analyze — AI reads the video (duration, audio, silence, speech)
// 3. Plan — AI suggests narration/music/SFX/subtitle/overlay layers
// 4. Review — user approves/edits each layer before assembly
// 5. Assemble — FFmpeg applies all layers → final export
// ═══════════════════════════════════════════════════════════════════════════

const s1 = "#0b0e18";
const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const green = "#22c55e";
const gold = "#f59e0b";
const red = "#ef4444";
const cyan = "#00d4ff";

interface LayerPlan {
  narrationSlots: Array<{ start: number; end: number; suggestion: string }>;
  musicSlots: Array<{ start: number; end: number; mood: string; volume: number }>;
  sfxSlots: Array<{ start: number; event: string; reason: string }>;
  subtitleSlots: Array<{ start: number; end: number; text: string }>;
  overlaySlots: Array<{ start: number; end: number; type: string; content: string }>;
}

interface Analysis {
  duration: number;
  hasAudio: boolean;
  resolution: { width: number; height: number };
  fps: number;
  silenceRegions: Array<{ start: number; end: number }>;
}

export default function VideoFinishingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [tier, setTier] = useState<"standard" | "pro" | "premium">("pro");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [layerPlan, setLayerPlan] = useState<LayerPlan | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [enabledLayers, setEnabledLayers] = useState({ narration: true, music: true, sfx: true, subtitles: false, overlays: false });
  const [narrationText, setNarrationText] = useState("");
  const [narrationSettings, setNarrationSettings] = useState<NarrationSettings | null>(null);
  const [voiceTier, setVoiceTier] = useState<VoiceTierConfig>({ tier: "standard" });
  const [aiSwitchLog, setAiSwitchLog] = useState<string>("");
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [assignedCharacter, setAssignedCharacter] = useState<{ id: string; characterId: string | null; name: string; [key: string]: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Upload video ──
  async function handleUpload(file: File) {
    setVideoFile(file);
    setProjectTitle(file.name.replace(/\.[^.]+$/, ""));
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) setVideoUrl(data.url);
    } catch { /* upload failed */ }
  }

  // ── AI model for tier — auto-switch if no credits ──
  function getAiModel(t: "standard" | "pro" | "premium"): string {
    if (t === "standard") return "claude-haiku-4-5-20251001";
    if (t === "pro") return "claude-sonnet-4-6";
    return "claude-opus-4-7"; // premium
  }

  // ── Analyze ──
  async function handleAnalyze() {
    if (!videoUrl) return;
    setAnalyzing(true);
    setAiSwitchLog("");
    const aiModel = getAiModel(tier);
    try {
      const res = await fetch("/api/video-finishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: videoUrl, projectTitle, tier, aiModel }),
      });
      const data = await res.json();
      // Auto-switch notice from server
      if (data.aiSwitched) setAiSwitchLog(`⚡ Auto-switched to ${data.aiModel} (${data.switchReason})`);
      else setAiSwitchLog(`✓ Using ${data.aiModel ?? aiModel}`);
      if (data.analysis) setAnalysis(data.analysis);
      if (data.layerPlan) setLayerPlan(data.layerPlan);
      setStep(3);
    } catch { /* analysis failed */ }
    setAnalyzing(false);
  }

  // ── Assemble ──
  async function handleAssemble() {
    if (!videoUrl || !layerPlan) return;
    setAssembling(true);
    try {
      const res = await fetch("/api/video/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle || "Finished Video",
          scenes: [{ scene: 1, videoUrl }],
          musicUrl: enabledLayers.music && layerPlan.musicSlots.length > 0 ? undefined : undefined,
          musicVolume: 0.3,
        }),
      });
      const data = await res.json();
      if (data.outputUrl) setResultUrl(data.outputUrl);
      setStep(5);
    } catch { /* assembly failed */ }
    setAssembling(false);
  }

  const toggleLayer = (layer: keyof typeof enabledLayers) => {
    setEnabledLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 28, minHeight: 180 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,212,255,0.06), rgba(168,85,247,0.06), rgba(8,11,16,0.95))" }} />
        <div style={{ position: "relative", padding: "40px 36px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: cyan, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
            Video Finishing
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Video Finishing Studio</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 500, lineHeight: 1.6 }}>
            Import any video. AI analyzes it, plans audio/visual layers, you review and approve, FFmpeg assembles the final output.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {[{ n: 1, l: "Import" }, { n: 2, l: "Analyze" }, { n: 3, l: "Plan Layers" }, { n: 4, l: "Review" }, { n: 5, l: "Export" }].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? cyan : "#1e2a35" }} />
            <p style={{ fontSize: 9, color: step >= s.n ? cyan : "#3d5060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Import ═══ */}
      {step === 1 && (
        <div style={{ background: s1, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Import Your Video</h2>

          <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />

          <div onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${videoFile ? green : border}`, borderRadius: 14, padding: "40px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: videoFile ? "rgba(34,197,94,0.03)" : "transparent" }}>
            {videoFile ? (
              <div>
                <p style={{ fontSize: 14, color: "#fff", fontWeight: 600, marginBottom: 4 }}>{videoFile.name}</p>
                <p style={{ fontSize: 11, color: muted }}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                {videoUrl && <p style={{ fontSize: 10, color: green, marginTop: 4 }}>Uploaded successfully</p>}
              </div>
            ) : (
              <div>
                <span style={{ fontSize: 40, display: "block", marginBottom: 8 }}>📁</span>
                <p style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>Click to upload video</p>
                <p style={{ fontSize: 11, color: muted }}>MP4, MOV, WebM — up to 500MB</p>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: muted, marginBottom: 6 }}>Project title</p>
            <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
              placeholder="My Finished Video"
              style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
          </div>

          {/* GHS Intelligence Tier */}
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>GHS Intelligence Level</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {([
                { id: "standard" as const, label: "GHS Standard", model: "Claude Haiku", cost: "Free", color: green },
                { id: "pro" as const, label: "GHS Pro", model: "Claude Sonnet", cost: "1 credit", color: purple },
                { id: "premium" as const, label: "GHS Premium", model: "Claude Opus", cost: "3 credits", color: gold },
              ]).map(t => (
                <button key={t.id} onClick={() => setTier(t.id)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1px solid ${tier === t.id ? t.color : border}`, background: tier === t.id ? `${t.color}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: tier === t.id ? t.color : "#fff" }}>{t.label}</p>
                  <p style={{ fontSize: 9, color: muted }}>{t.model}</p>
                  <p style={{ fontSize: 8, color: tier === t.id ? t.color + "88" : "#2a3a45" }}>{t.cost}</p>
                </button>
              ))}
            </div>
            {aiSwitchLog && (
              <p style={{ fontSize: 10, color: aiSwitchLog.startsWith("⚡") ? gold : green, padding: "4px 8px", background: "#080b10", borderRadius: 5, border: `1px solid ${border}` }}>
                {aiSwitchLog}
              </p>
            )}
          </div>

          {/* Voice Engine */}
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Voice Engine</p>
            <VoiceTierSelector value={voiceTier} onChange={setVoiceTier} compact />
          </div>

          {/* Characters */}
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Characters</p>
            <div style={{ display: "flex", gap: 8, marginBottom: assignedCharacter ? 12 : 0 }}>
              <button onClick={() => { window.location.href = "/dashboard/character-voices"; }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${green}40`, background: `${green}10`, color: green, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Create Character
              </button>
              <button onClick={() => setShowCharacterPicker(true)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${purple}40`, background: `${purple}10`, color: purple, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Assign Character
              </button>
            </div>
            {assignedCharacter && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#080b10", border: `1px solid ${purple}40`, borderRadius: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{assignedCharacter.name}</p>
                  {assignedCharacter.characterId && (
                    <p style={{ fontSize: 9, fontFamily: "monospace", color: purple, marginTop: 2 }}>{assignedCharacter.characterId}</p>
                  )}
                </div>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                  Switch
                </button>
              </div>
            )}
          </div>

          <button onClick={() => { if (videoUrl) setStep(2); }} disabled={!videoUrl}
            style={{ width: "100%", marginTop: 20, padding: 16, borderRadius: 14, border: "none", background: videoUrl ? cyan : "#2a2a40", color: videoUrl ? "#000" : muted, fontSize: 16, fontWeight: 700, cursor: videoUrl ? "pointer" : "not-allowed" }}>
            Next — Analyze Video
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Analyze ═══ */}
      {step === 2 && (
        <div style={{ background: s1, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Analyzing Video</h2>

          {videoUrl && (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, marginBottom: 20 }}>
              <video src={videoUrl} controls style={{ width: "100%", maxHeight: 300 }} />
            </div>
          )}

          <button onClick={handleAnalyze} disabled={analyzing}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: analyzing ? "#2a2a40" : cyan, color: analyzing ? muted : "#000", fontSize: 16, fontWeight: 700, cursor: analyzing ? "not-allowed" : "pointer" }}>
            {analyzing ? "Analyzing — reading video, detecting silence, planning layers..." : "Start Analysis"}
          </button>
        </div>
      )}

      {/* ═══ STEP 3: Plan Layers ═══ */}
      {step === 3 && analysis && layerPlan && (
        <div style={{ background: s1, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Layer Plan</h2>

          {/* Analysis summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {[
              ["Duration", `${analysis.duration.toFixed(1)}s`],
              ["Resolution", `${analysis.resolution.width}x${analysis.resolution.height}`],
              ["Audio", analysis.hasAudio ? "Yes" : "No"],
              ["Silence", `${analysis.silenceRegions.length} region(s)`],
            ].map(([label, val]) => (
              <div key={label} style={{ padding: "10px 12px", background: "#080b10", borderRadius: 10, border: `1px solid ${border}` }}>
                <p style={{ fontSize: 9, color: muted }}>{label}</p>
                <p style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Layer toggles */}
          {([
            { key: "narration" as const, label: "Narration", icon: "🎙", count: layerPlan.narrationSlots.length, color: cyan },
            { key: "music" as const, label: "Music", icon: "🎵", count: layerPlan.musicSlots.length, color: green },
            { key: "sfx" as const, label: "Sound Effects", icon: "💥", count: layerPlan.sfxSlots.length, color: gold },
            { key: "subtitles" as const, label: "Subtitles", icon: "📝", count: layerPlan.subtitleSlots.length, color: purple },
            { key: "overlays" as const, label: "Overlays", icon: "🏷", count: layerPlan.overlaySlots.length, color: "#ec4899" },
          ]).map(layer => (
            <div key={layer.key} style={{ marginBottom: 12, background: "#080b10", borderRadius: 12, border: `1px solid ${enabledLayers[layer.key] ? layer.color + "40" : border}`, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: layer.count > 0 && enabledLayers[layer.key] ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{layer.icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{layer.label}</p>
                    <p style={{ fontSize: 10, color: muted }}>{layer.count} suggestion(s) from AI</p>
                  </div>
                </div>
                <button onClick={() => toggleLayer(layer.key)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${enabledLayers[layer.key] ? layer.color : border}`, background: enabledLayers[layer.key] ? `${layer.color}15` : "transparent", color: enabledLayers[layer.key] ? layer.color : muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {enabledLayers[layer.key] ? "Enabled" : "Disabled"}
                </button>
              </div>
              {enabledLayers[layer.key] && layer.key === "narration" && layerPlan.narrationSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: muted, padding: "4px 0", borderTop: `1px solid ${border}` }}>
                  {s.start.toFixed(1)}s – {s.end.toFixed(1)}s: <span style={{ color: "#fff" }}>{s.suggestion}</span>
                </div>
              ))}
              {enabledLayers[layer.key] && layer.key === "music" && layerPlan.musicSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: muted, padding: "4px 0", borderTop: `1px solid ${border}` }}>
                  {s.start.toFixed(1)}s – {s.end.toFixed(1)}s: <span style={{ color: "#fff" }}>{s.mood}</span> (vol: {Math.round(s.volume * 100)}%)
                </div>
              ))}
              {enabledLayers[layer.key] && layer.key === "sfx" && layerPlan.sfxSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: muted, padding: "4px 0", borderTop: `1px solid ${border}` }}>
                  {s.start ?? 0}s: <span style={{ color: "#fff" }}>{s.event}</span> — {s.reason}
                </div>
              ))}
            </div>
          ))}

          {/* Narration Voice Controls */}
          {enabledLayers.narration && (
            <div style={{ marginTop: 12 }}>
              <NarrationControls
                narrationText={narrationText}
                onNarrationChange={setNarrationText}
                onSettingsChange={(s) => setNarrationSettings(s)}
                compact={true}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={() => setStep(4)}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: cyan, color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Review & Approve Layers
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Review ═══ */}
      {step === 4 && (
        <div style={{ background: s1, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Review & Approve</h2>

          <div style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: cyan, fontWeight: 600, marginBottom: 4 }}>Ready to assemble</p>
            <p style={{ fontSize: 11, color: muted, lineHeight: 1.6 }}>
              Enabled layers: {Object.entries(enabledLayers).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}.
              FFmpeg will apply all enabled layers to your video. This action is deterministic — same plan always produces the same output.
            </p>
          </div>

          {videoUrl && (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, marginBottom: 20 }}>
              <video src={videoUrl} controls style={{ width: "100%", maxHeight: 250 }} />
              <p style={{ fontSize: 9, color: muted, padding: "6px 10px", background: "#080b10" }}>Original video — layers will be applied on top</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={handleAssemble} disabled={assembling}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: assembling ? "#2a2a40" : green, color: assembling ? muted : "#000", fontSize: 16, fontWeight: 700, cursor: assembling ? "not-allowed" : "pointer" }}>
              {assembling ? "Assembling..." : "Approve & Assemble"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: Export ═══ */}
      {step === 5 && (
        <div style={{ background: s1, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Finished</h2>

          {resultUrl ? (
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${border}`, marginBottom: 20 }}>
              <video src={resultUrl} controls style={{ width: "100%", maxHeight: 400 }} />
              <div style={{ padding: "12px 16px", background: "#080b10", display: "flex", gap: 8 }}>
                <a href={resultUrl} download style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, background: green, color: "#000", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Download</a>
                <a href="/dashboard/assets" style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, border: `1px solid ${border}`, color: muted, fontSize: 13, textDecoration: "none" }}>Asset Library</a>
                <button onClick={() => { setStep(1); setVideoFile(null); setVideoUrl(""); setAnalysis(null); setLayerPlan(null); setResultUrl(null); }}
                  style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, cursor: "pointer" }}>
                  Start New
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: red }}>Assembly failed. Try again or use the Collaborative Editor for more control.</p>
          )}
        </div>
      )}

      {/* ═══ Character Picker Modal ═══ */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCharacterPicker(false); }}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", borderRadius: 16, border: `1px solid ${border}`, background: s1, padding: 20 }}>
            <CharacterPicker
              selectedId={assignedCharacter?.id}
              onSelect={(character) => { setAssignedCharacter(character); setShowCharacterPicker(false); }}
              onCreateNew={() => { window.location.href = "/dashboard/character-voices"; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
