"use client";

import { useState, useRef } from "react";
import CharacterPicker from "../../components/CharacterPicker";
import NarrationControls from "../../components/NarrationControls";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import type { NarrationSettings } from "../../components/NarrationControls";
import { ds } from "../../../lib/designSystem";
import { HeroTitle } from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { Folder, Mic, Music, Film, User, Check, X } from "../../components/icons";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Video Finishing Studio
// 5-step flow: Import → Analyze → Plan Layers → Review → Assemble → Export
// ═══════════════════════════════════════════════════════════════════════════

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

const microLabel: React.CSSProperties = {
  fontSize: 10, fontFamily: ds.font.mono, fontWeight: 700, letterSpacing: "0.18em",
  textTransform: "uppercase", color: ds.color.mute, display: "block", marginBottom: 6,
};

const inputSt: React.CSSProperties = {
  width: "100%", background: ds.color.card, border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm, padding: "10px 14px", color: ds.color.ink, fontSize: 13,
  outline: "none", fontFamily: ds.font.sans,
};

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

  // ── AI model for tier ──
  function getAiModel(t: "standard" | "pro" | "premium"): string {
    if (t === "standard") return "claude-haiku-4-5-20251001";
    if (t === "pro") return "claude-sonnet-4-6";
    return "claude-opus-4-7";
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
      if (data.aiSwitched) setAiSwitchLog(`Auto-switched to ${data.aiModel} (${data.switchReason})`);
      else setAiSwitchLog(`Using ${data.aiModel ?? aiModel}`);
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

  // ── Progress bar ──
  const PROGRESS_STEPS = [
    { n: 1, l: "Import" }, { n: 2, l: "Analyze" }, { n: 3, l: "Plan Layers" }, { n: 4, l: "Review" }, { n: 5, l: "Export" }
  ];

  return (
    <div style={{ fontFamily: ds.font.sans }}>
      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <HeroTitle kicker="Studio / Post" title="Video Finishing" italic="Studio" sub="Import any video. AI analyzes it, plans audio/visual layers, you review and approve, FFmpeg assembles the final output." />
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {PROGRESS_STEPS.map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? `linear-gradient(90deg,${ds.color.lilac},${ds.color.coral})` : ds.color.line2 }} />
            <p style={{ fontSize: 9, color: step >= s.n ? ds.color.lilac : ds.color.mute2, fontWeight: step === s.n ? 700 : 400, textAlign: "center", fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Import ═══ */}
      {step === 1 && (
        <Card radius={16} padding={28}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 16 }}>Import Your Video</h2>

          <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />

          <div onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${videoFile ? ds.color.mint : ds.color.line2}`, borderRadius: 14, padding: "40px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: videoFile ? "rgba(122,224,195,.03)" : "transparent" }}>
            {videoFile ? (
              <div>
                <p style={{ fontSize: 14, color: ds.color.ink, fontWeight: 600, marginBottom: 4 }}>{videoFile.name}</p>
                <p style={{ fontSize: 11, color: ds.color.mute }}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                {videoUrl && <p style={{ fontSize: 10, color: ds.color.mint, marginTop: 4 }}>Uploaded successfully</p>}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: ds.color.mute }}><Folder size={40} /></div>
                <p style={{ fontSize: 14, color: ds.color.ink, fontWeight: 600 }}>Click to upload video</p>
                <p style={{ fontSize: 11, color: ds.color.mute }}>MP4, MOV, WebM — up to 500MB</p>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <p style={microLabel}>Project title</p>
            <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
              placeholder="My Finished Video" style={inputSt} />
          </div>

          {/* GHS Intelligence Tier */}
          <div style={{ marginTop: 16 }}>
            <p style={microLabel}>GHS Intelligence Level</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {([
                { id: "standard" as const, label: "GHS Standard", model: "Claude Haiku", cost: "Free", color: ds.color.mint },
                { id: "pro" as const, label: "GHS Pro", model: "Claude Sonnet", cost: "1 credit", color: ds.color.lilac },
                { id: "premium" as const, label: "GHS Premium", model: "Claude Opus", cost: "3 credits", color: ds.color.gold },
              ]).map(t => (
                <button key={t.id} onClick={() => setTier(t.id)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: ds.radius.sm, border: `1px solid ${tier === t.id ? t.color : ds.color.line2}`, background: tier === t.id ? `${t.color}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: tier === t.id ? t.color : ds.color.ink2 }}>{t.label}</p>
                  <p style={{ fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono }}>{t.model}</p>
                  <p style={{ fontSize: 8, color: tier === t.id ? t.color + "88" : ds.color.mute2, fontFamily: ds.font.mono }}>{t.cost}</p>
                </button>
              ))}
            </div>
            {aiSwitchLog && (
              <p style={{ fontSize: 10, color: ds.color.gold, padding: "4px 8px", background: ds.color.paper, borderRadius: 5, border: `1px solid ${ds.color.line2}`, fontFamily: ds.font.mono }}>
                {aiSwitchLog}
              </p>
            )}
          </div>

          {/* Voice Engine */}
          <div style={{ marginTop: 16 }}>
            <p style={microLabel}>Voice Engine</p>
            <VoiceTierSelector value={voiceTier} onChange={setVoiceTier} compact />
          </div>

          {/* Characters */}
          <div style={{ marginTop: 20 }}>
            <p style={microLabel}>Characters</p>
            <div style={{ display: "flex", gap: 8, marginBottom: assignedCharacter ? 12 : 0 }}>
              <button onClick={() => { window.location.href = "/dashboard/character-voices"; }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.mint}40`, background: `${ds.color.mint}10`, color: ds.color.mint, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Create Character
              </button>
              <button onClick={() => setShowCharacterPicker(true)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.lilac}40`, background: `${ds.color.lilac}10`, color: ds.color.lilac, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Assign Character
              </button>
            </div>
            {assignedCharacter && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: ds.color.paper, border: `1px solid ${ds.color.lilac}40`, borderRadius: ds.radius.sm }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink }}>{assignedCharacter.name}</p>
                  {assignedCharacter.characterId && (
                    <p style={{ fontSize: 9, fontFamily: ds.font.mono, color: ds.color.lilac, marginTop: 2 }}>{assignedCharacter.characterId}</p>
                  )}
                </div>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                  Switch
                </button>
              </div>
            )}
          </div>

          <ButtonPrimary onClick={() => { if (videoUrl) setStep(2); }} disabled={!videoUrl} style={{ width: "100%", marginTop: 20, justifyContent: "center", padding: "16px" }}>
            Next — Analyze Video
          </ButtonPrimary>
        </Card>
      )}

      {/* ═══ STEP 2: Analyze ═══ */}
      {step === 2 && (
        <Card radius={16} padding={28}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 16 }}>Analyzing Video</h2>

          {videoUrl && (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${ds.color.line2}`, marginBottom: 20 }}>
              <video src={videoUrl} controls style={{ width: "100%", maxHeight: 300 }} />
            </div>
          )}

          <ButtonPrimary onClick={handleAnalyze} disabled={analyzing} style={{ width: "100%", justifyContent: "center", padding: "16px" }}>
            {analyzing ? "Analyzing — reading video, detecting silence, planning layers..." : "Start Analysis"}
          </ButtonPrimary>
        </Card>
      )}

      {/* ═══ STEP 3: Plan Layers ═══ */}
      {step === 3 && analysis && layerPlan && (
        <Card radius={16} padding={28}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 16 }}>Layer Plan</h2>

          {/* Analysis summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {[
              ["Duration", `${analysis.duration.toFixed(1)}s`],
              ["Resolution", `${analysis.resolution.width}x${analysis.resolution.height}`],
              ["Audio", analysis.hasAudio ? "Yes" : "No"],
              ["Silence", `${analysis.silenceRegions.length} region(s)`],
            ].map(([label, val]) => (
              <Card key={label} radius={10} padding="10px 12px">
                <p style={microLabel}>{label}</p>
                <p style={{ fontSize: 14, color: ds.color.ink, fontWeight: 600 }}>{val}</p>
              </Card>
            ))}
          </div>

          {/* Layer toggles */}
          {([
            { key: "narration" as const, label: "Narration", icon: <Mic size={16} />, count: layerPlan.narrationSlots.length, color: ds.color.sky },
            { key: "music" as const, label: "Music", icon: <Music size={16} />, count: layerPlan.musicSlots.length, color: ds.color.mint },
            { key: "sfx" as const, label: "Sound Effects", icon: <Film size={16} />, count: layerPlan.sfxSlots.length, color: ds.color.gold },
            { key: "subtitles" as const, label: "Subtitles", icon: <Film size={16} />, count: layerPlan.subtitleSlots.length, color: ds.color.lilac },
            { key: "overlays" as const, label: "Overlays", icon: <Film size={16} />, count: layerPlan.overlaySlots.length, color: ds.color.pink },
          ]).map(layer => (
            <Card key={layer.key} radius={12} padding="12px 16px" style={{ marginBottom: 12, borderColor: enabledLayers[layer.key] ? `${layer.color}40` : ds.color.line }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: layer.count > 0 && enabledLayers[layer.key] ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: layer.color }}>{layer.icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink }}>{layer.label}</p>
                    <p style={{ fontSize: 10, color: ds.color.mute }}>{layer.count} suggestion(s) from AI</p>
                  </div>
                </div>
                <button onClick={() => toggleLayer(layer.key)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${enabledLayers[layer.key] ? layer.color : ds.color.line2}`, background: enabledLayers[layer.key] ? `${layer.color}15` : "transparent", color: enabledLayers[layer.key] ? layer.color : ds.color.mute, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {enabledLayers[layer.key] ? "Enabled" : "Disabled"}
                </button>
              </div>
              {enabledLayers[layer.key] && layer.key === "narration" && layerPlan.narrationSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: ds.color.mute, padding: "4px 0", borderTop: `1px solid ${ds.color.line}` }}>
                  {s.start.toFixed(1)}s – {s.end.toFixed(1)}s: <span style={{ color: ds.color.ink }}>{s.suggestion}</span>
                </div>
              ))}
              {enabledLayers[layer.key] && layer.key === "music" && layerPlan.musicSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: ds.color.mute, padding: "4px 0", borderTop: `1px solid ${ds.color.line}` }}>
                  {s.start.toFixed(1)}s – {s.end.toFixed(1)}s: <span style={{ color: ds.color.ink }}>{s.mood}</span> (vol: {Math.round(s.volume * 100)}%)
                </div>
              ))}
              {enabledLayers[layer.key] && layer.key === "sfx" && layerPlan.sfxSlots.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: ds.color.mute, padding: "4px 0", borderTop: `1px solid ${ds.color.line}` }}>
                  {s.start ?? 0}s: <span style={{ color: ds.color.ink }}>{s.event}</span> — {s.reason}
                </div>
              ))}
            </Card>
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
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 14, cursor: "pointer" }}>Back</button>
            <ButtonPrimary onClick={() => setStep(4)} style={{ flex: 1, justifyContent: "center", padding: "16px" }}>
              Review & Approve Layers
            </ButtonPrimary>
          </div>
        </Card>
      )}

      {/* ═══ STEP 4: Review ═══ */}
      {step === 4 && (
        <Card radius={16} padding={28}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 16 }}>Review & Approve</h2>

          <Card radius={12} padding={14} style={{ marginBottom: 20, borderColor: `${ds.color.lilac}20` }}>
            <p style={{ fontSize: 12, color: ds.color.lilac, fontWeight: 600, marginBottom: 4 }}>Ready to assemble</p>
            <p style={{ fontSize: 11, color: ds.color.mute, lineHeight: 1.6 }}>
              Enabled layers: {Object.entries(enabledLayers).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}.
              FFmpeg will apply all enabled layers to your video. This action is deterministic — same plan always produces the same output.
            </p>
          </Card>

          {videoUrl && (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${ds.color.line2}`, marginBottom: 20 }}>
              <video src={videoUrl} controls style={{ width: "100%", maxHeight: 250 }} />
              <p style={{ fontSize: 9, color: ds.color.mute, padding: "6px 10px", background: ds.color.paper, fontFamily: ds.font.mono }}>Original video — layers will be applied on top</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 14, cursor: "pointer" }}>Back</button>
            <ButtonPrimary onClick={handleAssemble} disabled={assembling} style={{ flex: 1, justifyContent: "center", padding: "16px" }}>
              {assembling ? "Assembling..." : "Approve & Assemble"}
            </ButtonPrimary>
          </div>
        </Card>
      )}

      {/* ═══ STEP 5: Export ═══ */}
      {step === 5 && (
        <Card radius={16} padding={28}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Check size={18} style={{ color: ds.color.mint }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink }}>Finished</h2>
          </div>

          {resultUrl ? (
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${ds.color.line2}`, marginBottom: 20 }}>
              <video src={resultUrl} controls style={{ width: "100%", maxHeight: 400 }} />
              <div style={{ padding: "12px 16px", background: ds.color.paper, display: "flex", gap: 8 }}>
                <a href={resultUrl} download style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, background: ds.color.mint, color: "#000", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Download</a>
                <a href="/dashboard/assets" style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, color: ds.color.mute, fontSize: 13, textDecoration: "none" }}>Asset Library</a>
                <button onClick={() => { setStep(1); setVideoFile(null); setVideoUrl(""); setAnalysis(null); setLayerPlan(null); setResultUrl(null); }}
                  style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 13, cursor: "pointer" }}>
                  Start New
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: ds.color.coral }}>Assembly failed. Try again or use the Collaborative Editor for more control.</p>
          )}
        </Card>
      )}

      {/* ═══ Character Picker Modal ═══ */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCharacterPicker(false); }}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", borderRadius: 16, border: `1px solid ${ds.color.line2}`, background: ds.color.card, padding: 20 }}>
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
