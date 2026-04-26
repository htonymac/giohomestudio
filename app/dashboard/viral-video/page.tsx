"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CharacterPicker from "../../components/CharacterPicker";
import AITierSelector, { type AITier, getModelForTier } from "../../components/AITierSelector";
import ModelPicker from "../../components/ModelPicker";
import DurationPicker from "../../components/DurationPicker";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

// Viral Video Creator — content type → model selection → music → generate

const CONTENT_TYPES = [
  { id: "human",     label: "Human / Real",      desc: "Real-looking human scenes",  color: ds.color.sky     },
  { id: "animation", label: "Animation",          desc: "Animated cartoon style",     color: ds.color.lilac   },
  { id: "3d",        label: "3D Render",          desc: "3D rendered visuals",        color: ds.color.gold    },
  { id: "cinematic", label: "Cinematic",          desc: "Movie-quality footage",      color: ds.color.coral   },
  { id: "dance",     label: "Dance / Motion",     desc: "Dance and performance",      color: ds.color.pink    },
  { id: "product",   label: "Product Showcase",   desc: "Product-focused visuals",    color: ds.color.mint    },
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
  { id: "generate", label: "Generate AI Music" },
  { id: "upload",   label: "Upload My Music"   },
  { id: "none",     label: "No Music"           },
];

const SESSION_KEY = "ghs_viral_session";
const SESSION_TTL = 24 * 60 * 60 * 1000;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: ds.color.paper,
  border: `1px solid ${ds.color.line}`,
  borderRadius: ds.radius.sm,
  padding: "10px 12px",
  color: ds.color.ink,
  fontSize: 14,
  outline: "none",
  fontFamily: ds.font.sans,
};

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
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const models = MODEL_MAP[contentType] ?? [];
  const noMusic = musicChoice === "none";

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

  const cardStyle: React.CSSProperties = {
    background: ds.color.card,
    border: `1px solid ${ds.color.line}`,
    borderRadius: ds.radius.lg,
    padding: 24,
  };

  return (
    <div style={{ fontFamily: ds.font.sans }}>

      <HeroTitle
        kicker="Go Viral"
        title="Viral Video"
        italic="Creator"
        sub="Create attention-grabbing content designed to go viral. Pick a style, choose your AI model, add music."
      />

      {/* Sample videos strip */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, marginBottom: 28 }}>
        {[
          { title: "Wolf Running", src: "/api/media/intro/hero-brave.mp4", badge: "Cinematic" },
          { title: "Commercial OJ", src: "/api/media/intro/demo-commercial-oj.mp4", badge: "Product" },
          { title: "Property Tour", src: "/api/media/intro/demo-property.mp4", badge: "Real Estate" },
          { title: "Short Reel", src: "/api/media/intro/demo-short-reel.mp4", badge: "Viral" },
        ].map(v => (
          <div key={v.title} style={{ flexShrink: 0, width: 160, borderRadius: ds.radius.md, overflow: "hidden", border: `1px solid ${ds.color.line}`, background: ds.color.card, cursor: "pointer", position: "relative" }}>
            <video src={v.src} muted loop style={{ width: "100%", height: 100, objectFit: "cover" }}
              onMouseEnter={e => (e.target as HTMLVideoElement).play()}
              onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
            <span style={{ position: "absolute", top: 6, left: 6, fontSize: 8, padding: "2px 6px", borderRadius: 10, background: `rgba(255,122,69,0.8)`, color: "#fff", fontWeight: 600 }}>{v.badge}</span>
            <div style={{ padding: "8px 10px" }}>
              <p style={{ fontSize: 11, color: ds.color.ink, fontWeight: 600 }}>{v.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Session recovery */}
      {showResume && (
        <div style={{ background: "rgba(167,139,250,0.06)", border: `1px solid rgba(167,139,250,0.2)`, borderRadius: ds.radius.md, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: ds.color.lilac }}>You have an unfinished viral video</p>
            <p style={{ fontSize: 10, color: ds.color.mute }}>Resume where you left off or start fresh.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resumeSession} style={{ padding: "8px 18px", borderRadius: ds.radius.sm, background: ds.color.lilac, color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Resume</button>
            <button onClick={startFresh} style={{ padding: "8px 18px", borderRadius: ds.radius.sm, background: "transparent", color: ds.color.mute, fontSize: 12, border: `1px solid ${ds.color.line}`, cursor: "pointer" }}>Start Fresh</button>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[{ n: 1, l: "Content & Prompt" }, { n: 2, l: "AI Model" }, { n: 3, l: "Music & Generate" }].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? ds.color.coral : ds.color.line }} />
            <p style={{ fontSize: 9, color: step >= s.n ? ds.color.coral : ds.color.mute2, fontWeight: step === s.n ? 700 : 400, textAlign: "center", fontFamily: ds.font.mono }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* STEP 1: Content Type + Prompt */}
      {step === 1 && (
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 12, fontFamily: ds.font.mono }}>
            What type of content?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
            {CONTENT_TYPES.map(t => (
              <button key={t.id} onClick={() => setContentType(t.id)}
                style={{ padding: "16px 14px", borderRadius: ds.radius.md, border: `1px solid ${contentType === t.id ? t.color : ds.color.line}`, background: contentType === t.id ? `${t.color}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: ds.color.ink }}>{t.label}</p>
                <p style={{ fontSize: 10, color: ds.color.mute }}>{t.desc}</p>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 10, fontFamily: ds.font.mono }}>Your idea</p>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            placeholder="e.g. 'POV: You just discovered the best street food spot at 2am — cinematic, funny, relatable'"
            style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }} />

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 10, fontFamily: ds.font.mono }}>Viral Style</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {["POV Story", "Before/After", "Did You Know?", "Reaction", "Tutorial", "Challenge", "Trend Ride", "Funny Skit", "Motivational", "Behind The Scenes"].map(s => (
              <button key={s} onClick={() => setViralStyle(s)}
                style={{ padding: "8px 16px", borderRadius: 100, border: `1px solid ${viralStyle === s ? ds.color.coral : ds.color.line}`, background: viralStyle === s ? "rgba(255,122,69,0.1)" : "transparent", color: viralStyle === s ? ds.color.coral : ds.color.mute, fontSize: 12, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 10, fontFamily: ds.font.mono }}>Platform</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {["TikTok", "Instagram Reels", "YouTube Shorts", "All Platforms"].map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                style={{ padding: "8px 16px", borderRadius: 100, border: `1px solid ${platform === p ? ds.color.coral : ds.color.line}`, background: platform === p ? "rgba(255,122,69,0.1)" : "transparent", color: platform === p ? ds.color.coral : ds.color.mute, fontSize: 12, cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>

          <button onClick={() => setStep(2)} disabled={!contentType || !prompt.trim()}
            style={{ width: "100%", padding: 16, borderRadius: ds.radius.md, border: "none",
              background: (contentType && prompt.trim())
                ? `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`
                : ds.color.card,
              color: (contentType && prompt.trim()) ? "#fff" : ds.color.mute,
              fontSize: 16, fontWeight: 700, cursor: (contentType && prompt.trim()) ? "pointer" : "not-allowed" }}>
            Next — Choose AI Model
          </button>
        </div>
      )}

      {/* STEP 2: AI Model Selection */}
      {step === 2 && (
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 6, fontFamily: ds.font.mono }}>
            Best AI Models for {CONTENT_TYPES.find(t => t.id === contentType)?.label}
          </p>
          <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 20 }}>AI pre-selected the best models for your content type. Pick one.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {models.map((m, i) => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: ds.radius.md, border: `1px solid ${selectedModel === m.id ? ds.color.coral : ds.color.line}`, background: selectedModel === m.id ? "rgba(255,122,69,0.06)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selectedModel === m.id ? ds.color.coral : ds.color.mute2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {selectedModel === m.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: ds.color.coral }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>{m.provider} / {m.name}</p>
                    <p style={{ fontSize: 11, color: ds.color.mute }}>{m.best}</p>
                  </div>
                </div>
                {i === 0 && <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 10, background: "rgba(122,224,195,0.12)", color: ds.color.mint, fontWeight: 600 }}>Recommended</span>}
              </button>
            ))}
          </div>

          {/* Character Section */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 10, fontFamily: ds.font.mono }}>Character</p>
            {!assignedCharacter ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => router.push("/dashboard/character-voices")}
                  style={{ padding: "10px 18px", borderRadius: ds.radius.sm, border: "none", background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Create Character
                </button>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "10px 18px", borderRadius: ds.radius.sm, border: `1px solid rgba(167,139,250,0.3)`, background: "rgba(167,139,250,0.08)", color: ds.color.lilac, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Assign Character
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.md, border: `1px solid rgba(167,139,250,0.2)`, background: "rgba(167,139,250,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", background: "rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {assignedCharacter.imageUrl ? (
                      <img src={assignedCharacter.imageUrl} alt={assignedCharacter.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 14, color: ds.color.lilac }}>C</span>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: ds.color.ink }}>{assignedCharacter.name}</p>
                    {assignedCharacter.characterId && <p style={{ fontSize: 9, fontFamily: ds.font.mono, color: ds.color.lilac }}>{assignedCharacter.characterId}</p>}
                  </div>
                </div>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${ds.color.line}`, background: "transparent", color: ds.color.mute, fontSize: 11, cursor: "pointer" }}>
                  Switch
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: "14px 24px", borderRadius: ds.radius.md, border: `1px solid ${ds.color.line}`, background: "transparent", color: ds.color.mute, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={() => setStep(3)} disabled={!selectedModel}
              style={{ flex: 1, padding: 16, borderRadius: ds.radius.md, border: "none",
                background: selectedModel
                  ? `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`
                  : ds.color.card,
                color: selectedModel ? "#fff" : ds.color.mute, fontSize: 16, fontWeight: 700, cursor: selectedModel ? "pointer" : "not-allowed" }}>
              Next — Music &amp; Generate
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Music + Generate */}
      {step === 3 && (
        <div style={cardStyle}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, marginBottom: 12, fontFamily: ds.font.mono }}>
            Music for your video
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
            {MUSIC_OPTIONS.map(m => (
              <button key={m.id} onClick={() => setMusicChoice(m.id)}
                style={{ padding: "16px 14px", borderRadius: ds.radius.md, border: `1px solid ${musicChoice === m.id ? ds.color.gold : ds.color.line}`, background: musicChoice === m.id ? "rgba(255,179,71,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: ds.color.ink }}>{m.label}</p>
              </button>
            ))}
          </div>

          {musicChoice === "generate" && (
            <div style={{ marginBottom: 20 }}>
              <input value={musicPrompt} onChange={e => setMusicPrompt(e.target.value)}
                placeholder="Describe the music: e.g. 'upbeat afrobeats, 30 seconds, energetic'"
                style={{ width: "100%", background: ds.color.paper, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.sm, padding: "10px 12px", color: ds.color.ink, fontSize: 13, outline: "none", fontFamily: ds.font.sans }} />
            </div>
          )}

          {noMusic && (
            <div style={{ padding: "10px 14px", borderRadius: ds.radius.sm, background: "rgba(255,179,71,0.06)", border: `1px solid rgba(255,179,71,0.15)`, marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: ds.color.gold }}>No music will be added to this video. You can add music later in the Video Editor.</p>
            </div>
          )}

          {/* Summary + AI tier */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 20, alignItems: "start" }}>
            <div style={{ background: ds.color.paper, borderRadius: ds.radius.md, padding: 16 }}>
              <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: ds.font.mono }}>Summary</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <p style={{ fontSize: 11, color: ds.color.mute }}>Type: <span style={{ color: ds.color.ink }}>{CONTENT_TYPES.find(t => t.id === contentType)?.label}</span></p>
                <p style={{ fontSize: 11, color: ds.color.mute }}>Model: <span style={{ color: ds.color.ink }}>{models.find(m => m.id === selectedModel)?.name}</span></p>
                <p style={{ fontSize: 11, color: ds.color.mute }}>Style: <span style={{ color: ds.color.ink }}>{viralStyle || "—"}</span></p>
                <p style={{ fontSize: 11, color: ds.color.mute }}>Music: <span style={{ color: ds.color.ink }}>{musicChoice === "none" ? "None" : musicChoice === "generate" ? "AI Generated" : "Upload"}</span></p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: ds.font.mono }}>AI Model</p>
                <AITierSelector value={aiTier} onChange={setAiTier} compact />
              </div>
              <div>
                <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: ds.font.mono }}>Duration</p>
                <DurationPicker preset="video" value={duration} onChange={(label: string) => setDuration(label)} label="" accentColor={ds.color.coral} compact />
              </div>
              <div>
                <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: ds.font.mono }}>Image Model</p>
                <ModelPicker videoModel={selectedModel || "muapi_seedance_v2"} imageModel={imageModel}
                  onVideoChange={() => {}} onImageChange={setImageModel}
                  accentColor={ds.color.coral} compact />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: ds.radius.md, border: `1px solid ${ds.color.line}`, background: "transparent", color: ds.color.mute, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={handleGenerate} disabled={generating || !musicChoice}
              style={{ flex: 1, padding: 16, borderRadius: ds.radius.md, border: "none",
                background: (generating || !musicChoice)
                  ? ds.color.card
                  : `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
                color: (generating || !musicChoice) ? ds.color.mute : "#fff", fontSize: 16, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer" }}>
              {generating ? "Generating..." : "Generate Viral Video"}
            </button>
          </div>

          {errorMsg && (
            <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: ds.radius.sm, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 13 }}>
              {errorMsg}
            </div>
          )}

          {resultUrl && (
            <div style={{ marginTop: 20, borderRadius: ds.radius.md, overflow: "hidden", border: `1px solid ${ds.color.line}` }}>
              <video src={resultUrl} controls style={{ width: "100%", maxHeight: 400 }} />
              <div style={{ padding: "12px 16px", background: ds.color.paper, display: "flex", gap: 8 }}>
                <a href={resultUrl} download style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: ds.radius.sm, background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  Download
                </a>
                <a href="/dashboard/assets" style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.line}`, color: ds.color.mute, fontSize: 13, textDecoration: "none" }}>
                  Asset Library
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Character Picker Modal */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCharacterPicker(false); }}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto", borderRadius: ds.radius.lg, border: `1px solid ${ds.color.line}`, background: ds.color.card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink }}>Pick a Character</p>
              <button onClick={() => setShowCharacterPicker(false)}
                style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${ds.color.line}`, background: "transparent", color: ds.color.mute, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
