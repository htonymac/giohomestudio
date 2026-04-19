"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CharacterPicker from "../../components/CharacterPicker";
import AITierSelector, { type AITier, getModelForTier } from "../../components/AITierSelector";
import ModelPicker from "../../components/ModelPicker";
import DurationPicker from "../../components/DurationPicker";

// Viral Video Creator — with content type → model selection → music → generate

const CONTENT_TYPES = [
  { id: "human", label: "Human / Real", icon: "🧑", desc: "Real-looking human scenes", color: "#00d4ff" },
  { id: "animation", label: "Animation", icon: "🎨", desc: "Animated cartoon style", color: "#a855f7" },
  { id: "3d", label: "3D Render", icon: "🧊", desc: "3D rendered visuals", color: "#f59e0b" },
  { id: "cinematic", label: "Cinematic", icon: "🎬", desc: "Movie-quality footage", color: "#ef4444" },
  { id: "dance", label: "Dance / Motion", icon: "💃", desc: "Dance and performance", color: "#ec4899" },
  { id: "product", label: "Product Showcase", icon: "🛍", desc: "Product-focused visuals", color: "#22c55e" },
];

const MODEL_MAP: Record<string, Array<{ id: string; name: string; provider: string; best: string }>> = {
  human:     [{ id: "kling3-pro", name: "Kling 3.0 Pro", provider: "Kling", best: "Most realistic humans" }, { id: "seedance", name: "SeeDance 2.0", provider: "ByteDance", best: "Natural movement" }],
  animation: [{ id: "hailuo-pro", name: "Hailuo 2.3 Pro", provider: "MiniMax", best: "Creative animation" }, { id: "hailuo-fast", name: "Hailuo 2.3 Fast", provider: "MiniMax", best: "Quick drafts" }],
  "3d":      [{ id: "kling3-pro", name: "Kling 3.0 Pro", provider: "Kling", best: "Cinematic 3D" }, { id: "runway", name: "Runway Gen-3", provider: "Runway", best: "Smooth 3D motion" }],
  cinematic: [{ id: "kling3-pro", name: "Kling 3.0 Pro", provider: "Kling", best: "Top cinematic quality" }, { id: "seedance", name: "SeeDance 2.0", provider: "ByteDance", best: "Native audio + video" }],
  dance:     [{ id: "seedance", name: "SeeDance 2.0", provider: "ByteDance", best: "Dance & choreography" }, { id: "kling2", name: "Kling 2.0", provider: "Kling", best: "Good motion" }],
  product:   [{ id: "hailuo-pro", name: "Hailuo 2.3 Pro", provider: "MiniMax", best: "Product shots" }, { id: "kling2", name: "Kling 2.0", provider: "Kling", best: "Clean visuals" }],
};

const MUSIC_OPTIONS = [
  { id: "generate", label: "Generate AI Music", icon: "🎵" },
  { id: "upload", label: "Upload My Music", icon: "📁" },
  { id: "none", label: "No Music", icon: "🔇" },
];

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";

const SESSION_KEY = "ghs_viral_session";
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

export default function ViralVideoPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [assignedCharacter, setAssignedCharacter] = useState<{
    id: string; characterId: string | null; name: string; visualDescription: string | null;
    imageUrl: string | null; voiceId: string | null; voiceName: string | null;
    gender: string | null; age: string | null; country: string | null; culture: string | null;
    voiceProvider: string | null; defaultSpeechStyle: string | null; role: string | null; personality: string | null;
  } | null>(null);
  const [contentType, setContentType] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [imageModel, setImageModel] = useState("fal_flux_dev");
  const [duration, setDuration] = useState("30–60 sec");
  const [viralStyle, setViralStyle] = useState("");
  const [platform, setPlatform] = useState("");
  const [musicChoice, setMusicChoice] = useState("");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiTier, setAiTier] = useState<AITier>("pro");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showResume, setShowResume] = useState(false);

  const models = MODEL_MAP[contentType] ?? [];
  const noMusic = musicChoice === "none";
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Session save: persist to localStorage on every change ──
  const saveSession = useCallback(() => {
    if (!prompt && !contentType) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        prompt, contentType, selectedModel, viralStyle, platform, musicChoice, musicPrompt, step, resultUrl,
        savedAt: Date.now(),
      }));
    } catch { /* quota exceeded */ }
  }, [prompt, contentType, selectedModel, viralStyle, platform, musicChoice, musicPrompt, step, resultUrl]);

  useEffect(() => { saveSession(); }, [saveSession]);

  // ── Session restore: check on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Date.now() - s.savedAt > SESSION_TTL) { localStorage.removeItem(SESSION_KEY); return; }
      if (s.prompt || s.contentType) setShowResume(true);
    } catch { /* corrupted */ }
  }, []);

  function resumeSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      if (s.prompt) setPrompt(s.prompt);
      if (s.contentType) setContentType(s.contentType);
      if (s.selectedModel) setSelectedModel(s.selectedModel);
      if (s.viralStyle) setViralStyle(s.viralStyle);
      if (s.platform) setPlatform(s.platform);
      if (s.musicChoice) setMusicChoice(s.musicChoice);
      if (s.musicPrompt) setMusicPrompt(s.musicPrompt);
      if (s.step) setStep(s.step);
      if (s.resultUrl) setResultUrl(s.resultUrl);
    } catch { /* ignore */ }
    setShowResume(false);
  }

  function startFresh() {
    localStorage.removeItem(SESSION_KEY);
    setShowResume(false);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (!musicChoice) { alert("Please select a music option — or choose 'No Music' to proceed without."); return; }
    setGenerating(true);
    setResultUrl(null);
    setErrorMsg(null);

    try {
      let musicUrl: string | undefined;
      if (musicChoice === "generate") {
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: musicPrompt || `${viralStyle} music for ${contentType} video, 30 seconds`, tier: aiTier, llmModel: getModelForTier(aiTier).llmValue, durationSeconds: 30 }),
        });
        if (!musicRes.ok) {
          const e = await musicRes.json().catch(() => ({}));
          setErrorMsg(`Music generation failed: ${e.error || `HTTP ${musicRes.status}`}`);
          setGenerating(false);
          return;
        }
        const musicData = await musicRes.json();
        if (musicData.musicPath) musicUrl = `/api/media/${musicData.musicPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
      }

      const videoRes = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${prompt}${assignedCharacter?.visualDescription ? `. Character appearance: ${assignedCharacter.visualDescription}` : ""}. Style: ${viralStyle || "viral"}. Content type: ${contentType}. Platform: ${platform || "TikTok"}.`,
          model: selectedModel || "hailuo-fast",
          aspectRatio: (platform === "YouTube Shorts" || platform === "Instagram Reels" || platform === "TikTok") ? "9:16" : "16:9",
        }),
      });
      if (!videoRes.ok) {
        const e = await videoRes.json().catch(() => ({}));
        setErrorMsg(`Video generation failed: ${e.error || `HTTP ${videoRes.status}`}`);
        setGenerating(false);
        return;
      }
      const videoData = await videoRes.json();

      if (videoData.outputUrl) {
        if (musicUrl) {
          const assembleRes = await fetch("/api/video/assemble", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: `Viral: ${prompt.slice(0, 30)}`, scenes: [{ scene: 1, videoUrl: videoData.outputUrl }], musicUrl }),
          });
          if (!assembleRes.ok) {
            setResultUrl(videoData.outputUrl);
          } else {
            const assembleData = await assembleRes.json();
            setResultUrl(assembleData.outputUrl ?? videoData.outputUrl);
          }
        } else {
          setResultUrl(videoData.outputUrl);
        }
      } else {
        setErrorMsg("Video generation returned no output. Please try again.");
      }
    } catch (err) {
      setErrorMsg(`Unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
    }
    setGenerating(false);
  }

  return (
    <div>
      {/* Header with sample strip */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: "#ef4444", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
          Go Viral
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Viral Video Creator</h1>
        <p style={{ fontSize: 14, color: muted, marginBottom: 24 }}>Create attention-grabbing content designed to go viral. Pick a style, choose your AI model, add music.</p>

        {/* Sample videos strip */}
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {[
            { title: "Wolf Running", src: "/api/media/intro/hero-brave.mp4", badge: "Cinematic" },
            { title: "Commercial OJ", src: "/api/media/intro/demo-commercial-oj.mp4", badge: "Product" },
            { title: "Property Tour", src: "/api/media/intro/demo-property.mp4", badge: "Real Estate" },
            { title: "Short Reel", src: "/api/media/intro/demo-short-reel.mp4", badge: "Viral" },
          ].map(v => (
            <div key={v.title} style={{ flexShrink: 0, width: 160, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, background: surface, cursor: "pointer", position: "relative" }}>
              <video src={v.src} muted loop style={{ width: "100%", height: 100, objectFit: "cover" }}
                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
              <span style={{ position: "absolute", top: 6, left: 6, fontSize: 8, padding: "2px 6px", borderRadius: 10, background: "rgba(239,68,68,0.8)", color: "#fff", fontWeight: 600 }}>{v.badge}</span>
              <div style={{ padding: "8px 10px" }}>
                <p style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{v.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session recovery banner */}
      {showResume && (
        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>You have an unfinished viral video</p>
            <p style={{ fontSize: 10, color: muted }}>Resume where you left off or start fresh.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resumeSession} style={{ padding: "8px 18px", borderRadius: 10, background: "#f59e0b", color: "#000", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Resume</button>
            <button onClick={startFresh} style={{ padding: "8px 18px", borderRadius: 10, background: "transparent", color: muted, fontSize: 12, border: `1px solid ${border}`, cursor: "pointer" }}>Start Fresh</button>
          </div>
        </div>
      )}

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[{ n: 1, l: "Content & Prompt" }, { n: 2, l: "AI Model" }, { n: 3, l: "Music & Generate" }].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? "#ef4444" : "#1e2a35" }} />
            <p style={{ fontSize: 9, color: step >= s.n ? "#ef4444" : "#3d5060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Content Type + Prompt ═══ */}
      {step === 1 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 12 }}>
            What type of content?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
            {CONTENT_TYPES.map(t => (
              <button key={t.id} onClick={() => setContentType(t.id)}
                style={{ padding: "16px 14px", borderRadius: 12, border: `1px solid ${contentType === t.id ? t.color : border}`, background: contentType === t.id ? `${t.color}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>{t.icon}</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{t.label}</p>
                <p style={{ fontSize: 10, color: muted }}>{t.desc}</p>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>Your idea</p>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            placeholder="e.g. 'POV: You just discovered the best street food spot at 2am — cinematic, funny, relatable'"
            style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 16 }} />

          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>Viral Style</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {["POV Story", "Before/After", "Did You Know?", "Reaction", "Tutorial", "Challenge", "Trend Ride", "Funny Skit", "Motivational", "Behind The Scenes"].map(s => (
              <button key={s} onClick={() => setViralStyle(s)}
                style={{ padding: "8px 16px", borderRadius: 100, border: `1px solid ${viralStyle === s ? "#ef4444" : border}`, background: viralStyle === s ? "rgba(239,68,68,0.1)" : "transparent", color: viralStyle === s ? "#ef4444" : muted, fontSize: 12, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>Platform</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {["TikTok", "Instagram Reels", "YouTube Shorts", "All Platforms"].map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                style={{ padding: "8px 16px", borderRadius: 100, border: `1px solid ${platform === p ? "#ef4444" : border}`, background: platform === p ? "rgba(239,68,68,0.1)" : "transparent", color: platform === p ? "#ef4444" : muted, fontSize: 12, cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>

          <button onClick={() => setStep(2)} disabled={!contentType || !prompt.trim()}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (contentType && prompt.trim()) ? "#ef4444" : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (contentType && prompt.trim()) ? "pointer" : "not-allowed" }}>
            Next — Choose AI Model
          </button>
        </div>
      )}

      {/* ═══ STEP 2: AI Model Selection (filtered by content type) ═══ */}
      {step === 2 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>
            Best AI Models for {CONTENT_TYPES.find(t => t.id === contentType)?.label}
          </p>
          <p style={{ fontSize: 12, color: muted, marginBottom: 20 }}>AI pre-selected the best models for your content type. Pick one.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {models.map((m, i) => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 12, border: `1px solid ${selectedModel === m.id ? "#ef4444" : border}`, background: selectedModel === m.id ? "rgba(239,68,68,0.06)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selectedModel === m.id ? "#ef4444" : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {selectedModel === m.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{m.provider} / {m.name}</p>
                    <p style={{ fontSize: 11, color: muted }}>{m.best}</p>
                  </div>
                </div>
                {i === 0 && <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 10, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>Recommended</span>}
              </button>
            ))}
          </div>

          {/* ── Character Section ── */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>
              Character
            </p>
            {!assignedCharacter ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => router.push("/dashboard/character-voices")}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#22c55e", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Create Character
                </button>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#a855f7", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Assign Character
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, border: `1px solid #a855f730`, background: "rgba(168,85,247,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", background: "linear-gradient(135deg, #a855f730, #a855f710)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {assignedCharacter.imageUrl ? (
                      <img src={assignedCharacter.imageUrl} alt={assignedCharacter.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 14 }}>{assignedCharacter.gender === "female" || assignedCharacter.gender === "girl" ? "👩" : "👨"}</span>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{assignedCharacter.name}</p>
                    {assignedCharacter.characterId && <p style={{ fontSize: 9, fontFamily: "monospace", color: "#a855f7" }}>{assignedCharacter.characterId}</p>}
                  </div>
                </div>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                  Switch
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={() => setStep(3)} disabled={!selectedModel}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: selectedModel ? "#ef4444" : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: selectedModel ? "pointer" : "not-allowed" }}>
              Next — Music & Generate
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Music + Generate ═══ */}
      {step === 3 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 12 }}>
            Music for your video
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
            {MUSIC_OPTIONS.map(m => (
              <button key={m.id} onClick={() => setMusicChoice(m.id)}
                style={{ padding: "16px 14px", borderRadius: 12, border: `1px solid ${musicChoice === m.id ? "#f59e0b" : border}`, background: musicChoice === m.id ? "rgba(245,158,11,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 22, display: "block", marginBottom: 6 }}>{m.icon}</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{m.label}</p>
              </button>
            ))}
          </div>

          {musicChoice === "generate" && (
            <div style={{ marginBottom: 20 }}>
              <input value={musicPrompt} onChange={e => setMusicPrompt(e.target.value)}
                placeholder="Describe the music: e.g. 'upbeat afrobeats, 30 seconds, energetic'"
                style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
          )}

          {noMusic && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: "#f59e0b" }}>No music will be added to this video. You can add music later in the Video Editor.</p>
            </div>
          )}

          {/* Summary + AI tier side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 20, alignItems: "start" }}>
            <div style={{ background: "#080b10", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Summary</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <p style={{ fontSize: 11, color: muted }}>Type: <span style={{ color: "#fff" }}>{CONTENT_TYPES.find(t => t.id === contentType)?.label}</span></p>
                <p style={{ fontSize: 11, color: muted }}>Model: <span style={{ color: "#fff" }}>{models.find(m => m.id === selectedModel)?.name}</span></p>
                <p style={{ fontSize: 11, color: muted }}>Style: <span style={{ color: "#fff" }}>{viralStyle || "—"}</span></p>
                <p style={{ fontSize: 11, color: muted }}>Music: <span style={{ color: "#fff" }}>{musicChoice === "none" ? "None" : musicChoice === "generate" ? "AI Generated" : "Upload"}</span></p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>AI Model</p>
                <AITierSelector value={aiTier} onChange={setAiTier} compact />
              </div>
              <div>
                <p style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Duration</p>
                <DurationPicker preset="video" value={duration} onChange={(label: string) => setDuration(label)} label="" accentColor="#ef4444" compact />
              </div>
              <div>
                <p style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Image Model</p>
                <ModelPicker videoModel={selectedModel || "muapi_seedance_v2"} imageModel={imageModel}
                  onVideoChange={() => {}} onImageChange={setImageModel}
                  accentColor="#ef4444" compact />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={handleGenerate} disabled={generating || !musicChoice}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: generating ? "#2a2a40" : "#ef4444", color: "#fff", fontSize: 16, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer" }}>
              {generating ? "Generating..." : "🔥 Generate Viral Video"}
            </button>
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 13 }}>
              {errorMsg}
            </div>
          )}

          {/* Result */}
          {resultUrl && (
            <div style={{ marginTop: 20, borderRadius: 14, overflow: "hidden", border: `1px solid ${border}` }}>
              <video src={resultUrl} controls style={{ width: "100%", maxHeight: 400 }} />
              <div style={{ padding: "12px 16px", background: "#080b10", display: "flex", gap: 8 }}>
                <a href={resultUrl} download style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, background: "#22c55e", color: "#000", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  Download
                </a>
                <a href="/dashboard/assets" style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, border: `1px solid ${border}`, color: muted, fontSize: 13, textDecoration: "none" }}>
                  Asset Library
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Character Picker Modal ═══ */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCharacterPicker(false); }}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto", borderRadius: 16, border: `1px solid ${border}`, background: surface, padding: 20, boxShadow: "0 16px 64px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Pick a Character</p>
              <button onClick={() => setShowCharacterPicker(false)}
                style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ✕
              </button>
            </div>
            <CharacterPicker
              onSelect={(character) => { setAssignedCharacter(character); setShowCharacterPicker(false); }}
              onCreateNew={() => { setShowCharacterPicker(false); router.push("/dashboard/character-voices"); }}
              selectedId={assignedCharacter?.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
