"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Hybrid Movie Planner — The Core Format
//
// Audio + Image + Video Hybrid is the SIGNATURE production format of GHS.
// Images for setup/emotion, Video for action/movement, Audio ties it together.
//
// This planner helps users:
// 1. Write their story idea
// 2. AI breaks it into scenes
// 3. For EACH scene, AI decides: image / video / image-to-video / audio bridge / hybrid
// 4. User sees cost comparison vs full video
// 5. User adjusts per-scene decisions
// 6. Narration auto-adapts (rich for images, minimal for video, strongest for bridges)
// 7. Music planned per scene based on action/emotion
// ═══════════════════════════════════════════════════════════════════════════

interface HybridScene {
  scene: number;
  title: string;
  description: string;
  sceneType: "image-led" | "video-led" | "image-to-video" | "audio-bridge" | "hybrid";
  narrationMode: string;
  narrationStrength: string;
  narrationScript: string;
  musicStyle: string;
  musicIntensity: string;
  sfx: string;
  ambience: string;
  motionDuration: number;
  imageTreatment: string;
  credits: number;
  reason: string;
}

const SCENE_TYPES = [
  { id: "image-led", label: "Image", icon: "🖼", color: "#22c55e", desc: "Still with narration", credits: 1 },
  { id: "video-led", label: "Video", icon: "🎬", color: "#7c5cfc", desc: "Full motion", credits: 4 },
  { id: "image-to-video", label: "Image→Video", icon: "✨", color: "#f59e0b", desc: "Subtle motion", credits: 2 },
  { id: "audio-bridge", label: "Audio Bridge", icon: "🔊", color: "#00d4ff", desc: "Sound only", credits: 0 },
  { id: "hybrid", label: "Hybrid", icon: "🔀", color: "#ec4899", desc: "Still→Motion burst", credits: 2 },
];

const IMAGE_TREATMENTS = ["Static", "Slow Zoom In", "Slow Zoom Out", "Pan Left", "Pan Right", "Parallax", "Light Overlay"];

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const accent = "#22c55e";

const cardStyle: React.CSSProperties = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10, display: "block" };
const inputStyle: React.CSSProperties = { width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" };

export default function HybridPlannerPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [detectedGenre, setDetectedGenre] = useState("");
  const [detectedTone, setDetectedTone] = useState("");
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [scenes, setScenes] = useState<HybridScene[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  // ── Analyze story and generate hybrid scene plan ──
  async function analyzeStory() {
    if (!idea.trim()) return;
    setAnalyzing(true);
    setScenes([]);

    try {
      const res = await fetch("/api/movie-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          genre: genre || undefined,  // empty = let AI detect
          tone: tone || undefined,    // empty = let AI detect
          format: "audio_video_image", // Force hybrid format
          style: genre || undefined,   // AI infers if not set
          setting: "",
          language: "English",
        }),
      });
      const data = await res.json();

      // Capture AI-detected genre and tone from the scene analysis
      if (data.scenes?.length > 0) {
        const firstScene = data.scenes[0];
        const detected = (firstScene.mood as string) ?? "";
        setDetectedTone(tone || detected || "Cinematic");
        setDetectedGenre(genre || (firstScene.environment as string)?.split(",")[0] || "Drama");
      }

      if (data.scenes?.length > 0) {
        const hybridScenes: HybridScene[] = data.scenes.map((s: Record<string, unknown>) => ({
          scene: s.scene as number,
          title: (s.title as string) ?? `Scene ${s.scene}`,
          description: (s.summary as string) ?? (s.visualDescription as string) ?? "",
          sceneType: (s.sceneType as string) ?? "hybrid",
          narrationMode: (s.narrationMode as string) ?? "light",
          narrationStrength: (s.narrationStrength as string) ?? "medium",
          narrationScript: (s.narrationScript as string) ?? "",
          musicStyle: (s.music_style as string) ?? (s.music_cue as string) ?? "",
          musicIntensity: (s.music_intensity as string) ?? "medium",
          sfx: ((s.sfx_needed as string[]) ?? []).join(", "),
          ambience: (s.ambience as string) ?? "",
          motionDuration: (s.motionDuration as number) ?? 0,
          imageTreatment: (s.imageTreatment as string) ?? "Static",
          credits: (s.credits as number) ?? 2,
          reason: (s.hybridReason as string) ?? "",
        }));
        setScenes(hybridScenes);
        setStep(2);
      }
    } catch { /* ignore */ }
    setAnalyzing(false);
  }

  function updateScene(sceneNum: number, patch: Partial<HybridScene>) {
    setScenes(prev => prev.map(s => {
      if (s.scene !== sceneNum) return s;
      const updated = { ...s, ...patch };
      // Recalculate credits when scene type changes
      if (patch.sceneType) {
        const typeInfo = SCENE_TYPES.find(t => t.id === patch.sceneType);
        updated.credits = typeInfo?.credits ?? 2;
        // Auto-adjust narration
        if (patch.sceneType === "image-led") { updated.narrationStrength = "strong"; updated.narrationMode = "descriptive"; }
        if (patch.sceneType === "video-led") { updated.narrationStrength = "none"; updated.narrationMode = "none"; }
        if (patch.sceneType === "audio-bridge") { updated.narrationStrength = "strong"; updated.narrationMode = "transitional"; }
        if (patch.sceneType === "hybrid") { updated.narrationStrength = "light"; updated.narrationMode = "light"; }
      }
      return updated;
    }));
  }

  // Cost calculations
  const hybridCredits = scenes.reduce((sum, s) => sum + s.credits, 0);
  const fullVideoCredits = scenes.length * 4;
  const savedCredits = fullVideoCredits - hybridCredits;
  const savingsPercent = fullVideoCredits > 0 ? Math.round((savedCredits / fullVideoCredits) * 100) : 0;
  const imageCount = scenes.filter(s => s.sceneType === "image-led").length;
  const videoCount = scenes.filter(s => s.sceneType === "video-led").length;
  const hybridCount = scenes.filter(s => s.sceneType === "hybrid" || s.sceneType === "image-to-video").length;
  const bridgeCount = scenes.filter(s => s.sceneType === "audio-bridge").length;

  return (
    <div>
      {/* Hero */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 28, minHeight: 180 }}>
        <video autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.15 }}
          src="/api/media/demo/hybrid_movie_demo.mp4" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(8,11,16,0.92), rgba(34,197,94,0.1))" }} />
        <div style={{ position: "relative", padding: "40px 36px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: accent, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
            Core GHS Format
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Hybrid Movie Planner</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 520, lineHeight: 1.6 }}>
            Images for calm scenes + Video for action + Audio ties it together. AI decides per scene — you save 50-75% credits while keeping cinematic quality.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {[{ n: 1, l: "Story" }, { n: 2, l: "Scene Decisions" }, { n: 3, l: "Generate" }].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? accent : "#1e2a35" }} />
            <p style={{ fontSize: 9, color: step >= s.n ? accent : "#3d5060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Story Input ═══ */}
      {step === 1 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>What&apos;s your story?</h2>
          <p style={{ fontSize: 12, color: muted, marginBottom: 20 }}>Write it short. AI will expand it into full cinematic detail and decide which scenes need video and which can be images.</p>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Your Story Idea</label>
            <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={5}
              placeholder={"Write your story idea in simple words. AI will detect the genre, emotion, and tone automatically.\n\ne.g. 'The man walked slowly toward the giant snake. The beast glared at him like prey. Beside him was a fallen log from a tree. He grabbed the log while the snake watched. The situation was intense.'"}
              style={{ ...inputStyle, resize: "vertical" }} />
            <p style={{ fontSize: 10, color: "#3d5060", marginTop: 6 }}>
              AI will detect: genre, emotion, tone, setting, action level — all from your text. No need to select manually.
            </p>
          </div>

          {/* Manual override — hidden by default */}
          <button onClick={() => setShowManualOverride(!showManualOverride)}
            style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer", marginBottom: showManualOverride ? 12 : 20, padding: 0, textDecoration: "underline" }}>
            {showManualOverride ? "Hide manual options" : "Want to set genre/tone manually? (optional)"}
          </button>
          {showManualOverride && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, padding: 14, borderRadius: 10, background: "#080b10", border: `1px solid ${border}` }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Override Genre (optional)</label>
                <select value={genre} onChange={e => setGenre(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "8px 12px" }}>
                  <option value="">Let AI decide</option>
                  {["Action", "Drama", "Children Story", "African Cinema", "Epic Fantasy", "Thriller", "Horror", "Comedy", "Romance", "Sci-Fi", "Inspirational"].map(g => (
                    <option key={g} value={g} style={{ background: surface }}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Override Tone (optional)</label>
                <select value={tone} onChange={e => setTone(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "8px 12px" }}>
                  <option value="">Let AI decide</option>
                  {["Emotional", "Suspenseful", "Heroic", "Dark", "Funny", "Warm", "Adventurous", "Intense"].map(t => (
                    <option key={t} value={t} style={{ background: surface }}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* How it works */}
          <div style={{ background: "#080b10", borderRadius: 12, padding: 16, marginBottom: 20, border: `1px solid ${border}` }}>
            <p style={{ fontSize: 10, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>How Hybrid Planning Works</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {SCENE_TYPES.map(t => (
                <div key={t.id} style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 18, display: "block", marginBottom: 4 }}>{t.icon}</span>
                  <p style={{ fontSize: 9, color: t.color, fontWeight: 600 }}>{t.label}</p>
                  <p style={{ fontSize: 8, color: muted }}>{t.desc}</p>
                  <p style={{ fontSize: 8, color: t.color }}>{t.credits} credit{t.credits !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={analyzeStory} disabled={!idea.trim() || analyzing}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (!idea.trim() || analyzing) ? "#2a2a40" : accent, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!idea.trim() || analyzing) ? "not-allowed" : "pointer" }}>
            {analyzing ? "AI is analyzing your story..." : "Analyze Story — AI Decides Per Scene"}
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Scene-by-Scene Decisions ═══ */}
      {step === 2 && scenes.length > 0 && (
        <div>
          {/* AI-detected info */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(124,92,252,0.06)", border: "1px solid rgba(124,92,252,0.15)" }}>
            <span style={{ fontSize: 14 }}>🧠</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>
                AI detected: <span style={{ color: "#7c5cfc" }}>{detectedGenre}</span> · <span style={{ color: "#f59e0b" }}>{detectedTone}</span> · {scenes.length} scenes
              </p>
              <p style={{ fontSize: 9, color: muted }}>Adjust any scene below if AI got it wrong. Click a scene to expand and edit.</p>
            </div>
            <button onClick={() => setStep(1)} style={{ fontSize: 10, padding: "4px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
              Change story
            </button>
          </div>

          {/* Cost comparison banner */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 14, padding: "16px 18px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Hybrid Cost</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: accent }}>{hybridCredits}</p>
              <p style={{ fontSize: 10, color: muted }}>credits</p>
            </div>
            <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 14, padding: "16px 18px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "#ef4444", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Full Video Cost</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#ef4444", textDecoration: "line-through", opacity: 0.6 }}>{fullVideoCredits}</p>
              <p style={{ fontSize: 10, color: muted }}>credits</p>
            </div>
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, padding: "16px 18px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>You Save</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: accent }}>{savingsPercent}%</p>
              <p style={{ fontSize: 10, color: accent }}>{savedCredits} credits saved</p>
            </div>
          </div>

          {/* Scene breakdown summary */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>🖼 {imageCount} image</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(124,92,252,0.1)", color: "#7c5cfc" }}>🎬 {videoCount} video</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>✨ {hybridCount} hybrid</span>
            <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(0,212,255,0.1)", color: "#00d4ff" }}>🔊 {bridgeCount} bridge</span>
          </div>

          {/* Scene cards — editable */}
          {scenes.map(scene => {
            const typeInfo = SCENE_TYPES.find(t => t.id === scene.sceneType);
            const isExpanded = selectedScene === scene.scene;
            return (
              <div key={scene.scene} style={{ ...cardStyle, marginBottom: 10, cursor: "pointer", borderColor: isExpanded ? (typeInfo?.color ?? accent) : border }}
                onClick={() => setSelectedScene(isExpanded ? null : scene.scene)}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${typeInfo?.color ?? accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {typeInfo?.icon ?? "🔀"}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Scene {scene.scene}: {scene.title}</p>
                      <p style={{ fontSize: 10, color: muted }}>{scene.reason}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${typeInfo?.color ?? accent}15`, color: typeInfo?.color ?? accent, fontWeight: 600 }}>
                      {typeInfo?.label ?? scene.sceneType}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: typeInfo?.color ?? accent }}>{scene.credits} cr</span>
                  </div>
                </div>

                {/* Expanded — edit per scene */}
                {isExpanded && (
                  <div style={{ marginTop: 16 }} onClick={e => e.stopPropagation()}>
                    {/* Scene type selector */}
                    <p style={{ ...labelStyle, fontSize: 9 }}>Change Scene Type (AI recommended: {typeInfo?.label})</p>
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                      {SCENE_TYPES.map(t => (
                        <button key={t.id} onClick={() => updateScene(scene.scene, { sceneType: t.id as HybridScene["sceneType"] })}
                          style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${scene.sceneType === t.id ? t.color : border}`, background: scene.sceneType === t.id ? `${t.color}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                          <span style={{ fontSize: 14, display: "block" }}>{t.icon}</span>
                          <p style={{ fontSize: 9, color: scene.sceneType === t.id ? t.color : muted, fontWeight: 600 }}>{t.label}</p>
                          <p style={{ fontSize: 8, color: muted }}>{t.credits} cr</p>
                        </button>
                      ))}
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ ...labelStyle, fontSize: 9 }}>Scene Description</p>
                      <textarea value={scene.description} onChange={e => updateScene(scene.scene, { description: e.target.value })}
                        rows={2} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                    </div>

                    {/* 3-column: Narration + Music + SFX */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div style={{ background: "#080b10", borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                        <p style={{ fontSize: 8, color: "#f59e0b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Narration</p>
                        <p style={{ fontSize: 11, color: "#fff", fontWeight: 500 }}>{scene.narrationMode}</p>
                        <p style={{ fontSize: 9, color: muted }}>Strength: {scene.narrationStrength}</p>
                        {scene.narrationScript && <p style={{ fontSize: 9, color: "#f59e0b", marginTop: 4, fontStyle: "italic" }}>{scene.narrationScript}</p>}
                      </div>
                      <div style={{ background: "#080b10", borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                        <p style={{ fontSize: 8, color: "#7c5cfc", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Music</p>
                        <input value={scene.musicStyle} onChange={e => updateScene(scene.scene, { musicStyle: e.target.value })}
                          style={{ ...inputStyle, fontSize: 10, padding: "4px 8px", marginBottom: 4 }} placeholder="e.g. suspense build" />
                        <p style={{ fontSize: 9, color: muted }}>Intensity: {scene.musicIntensity}</p>
                      </div>
                      <div style={{ background: "#080b10", borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                        <p style={{ fontSize: 8, color: "#00d4ff", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>SFX + Ambience</p>
                        <input value={scene.sfx} onChange={e => updateScene(scene.scene, { sfx: e.target.value })}
                          style={{ ...inputStyle, fontSize: 10, padding: "4px 8px", marginBottom: 4 }} placeholder="footsteps, wind..." />
                        <p style={{ fontSize: 9, color: muted }}>{scene.ambience || "No ambience set"}</p>
                      </div>
                    </div>

                    {/* Image treatment (for image scenes) */}
                    {(scene.sceneType === "image-led" || scene.sceneType === "image-to-video" || scene.sceneType === "hybrid") && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ ...labelStyle, fontSize: 9 }}>Image Treatment</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {IMAGE_TREATMENTS.map(t => (
                            <button key={t} onClick={() => updateScene(scene.scene, { imageTreatment: t })}
                              style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${scene.imageTreatment === t ? accent : border}`, background: scene.imageTreatment === t ? `${accent}10` : "transparent", color: scene.imageTreatment === t ? accent : muted, fontSize: 9, cursor: "pointer" }}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Motion duration (for video/hybrid scenes) */}
                    {(scene.sceneType === "video-led" || scene.sceneType === "image-to-video" || scene.sceneType === "hybrid") && (
                      <div>
                        <p style={{ ...labelStyle, fontSize: 9 }}>Motion Duration</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[3, 5, 8, 10, 15].map(d => (
                            <button key={d} onClick={() => updateScene(scene.scene, { motionDuration: d })}
                              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${scene.motionDuration === d ? "#7c5cfc" : border}`, background: scene.motionDuration === d ? "rgba(124,92,252,0.1)" : "transparent", color: scene.motionDuration === d ? "#7c5cfc" : muted, fontSize: 10, cursor: "pointer" }}>
                              {d}s
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>
              Back
            </button>
            <button onClick={() => setStep(3)}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: accent, color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Approve Plan — {hybridCredits} credits ({savingsPercent}% saved)
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Generate ═══ */}
      {step === 3 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Ready to Generate</h2>
          <p style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
            {scenes.length} scenes planned. {imageCount} images + {videoCount} videos + {bridgeCount} audio bridges.
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: accent }}>Total cost</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: accent }}>{hybridCredits} credits</span>
              <p style={{ fontSize: 10, color: muted }}>instead of {fullVideoCredits} (saved {savedCredits})</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
              Edit Scenes
            </button>
            <a href={`/dashboard/movie-planner?format=audio_video_image`} style={{ flex: 1, textDecoration: "none" }}>
              <button style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: accent, color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                Open in Movie Planner — Start Rendering
              </button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
