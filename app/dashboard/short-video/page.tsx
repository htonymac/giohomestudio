"use client";

import { useState, useEffect, useCallback } from "react";
import CharacterPicker from "../../components/CharacterPicker";
import AITierSelector, { type AITier, getModelForTier } from "../../components/AITierSelector";
import DurationPicker from "../../components/DurationPicker";

// Short Video Creator — Quick social content with proper flow

const CONTENT_TYPES = [
  { id: "talking", label: "Talking Head", icon: "🗣", desc: "Person speaking to camera" },
  { id: "broll", label: "B-Roll Montage", icon: "🎞", desc: "Cinematic clips with music" },
  { id: "product", label: "Product Showcase", icon: "🛍", desc: "Show off a product" },
  { id: "tutorial", label: "Quick Tutorial", icon: "📋", desc: "How-to or tip video" },
  { id: "story", label: "Mini Story", icon: "📖", desc: "Short narrative clip" },
  { id: "promo", label: "Promo / Ad", icon: "📣", desc: "Sales or promotion" },
];

const DURATIONS = ["15 sec", "30 sec", "45 sec", "60 sec"];
const FORMATS = ["9:16 Vertical", "1:1 Square", "16:9 Horizontal"];
const MUSIC_MOODS = ["Upbeat", "Calm", "Dramatic", "Romantic", "Hip Hop", "Electronic", "Cinematic", "No Music"];

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const accent = "#f59e0b";

const SESSION_KEY = "ghs_short_session";
const SESSION_TTL = 24 * 60 * 60 * 1000;

export default function ShortVideoPage() {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("");
  const [duration, setDuration] = useState("30 sec");
  const [format, setFormat] = useState("9:16 Vertical");
  const [musicMood, setMusicMood] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showResume, setShowResume] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [assignedCharacter, setAssignedCharacter] = useState<{ id: string; characterId: string | null; name: string; visualDescription: string | null } | null>(null);
  const [aiTier, setAiTier] = useState<AITier>("pro");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Session save ──
  const saveSession = useCallback(() => {
    if (!prompt && !contentType) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        prompt, contentType, duration, format, musicMood, resultUrl, savedAt: Date.now(),
      }));
    } catch { /* quota */ }
  }, [prompt, contentType, duration, format, musicMood, resultUrl]);

  useEffect(() => { saveSession(); }, [saveSession]);

  // ── Session restore on mount ──
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
      if (s.duration) setDuration(s.duration);
      if (s.format) setFormat(s.format);
      if (s.musicMood) setMusicMood(s.musicMood);
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
    setGenerating(true);
    setResultUrl(null);
    setErrorMsg(null);
    try {
      let musicUrl: string | undefined;
      if (musicMood && musicMood !== "No Music") {
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `${musicMood} background music, ${duration}`, mood: musicMood, tier: aiTier, durationSeconds: parseInt(duration) || 30 }),
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

      const ar = format.includes("9:16") ? "9:16" : format.includes("1:1") ? "1:1" : "16:9";
      const videoRes = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${prompt}. Style: ${contentType}. Duration: ${duration}.${assignedCharacter?.visualDescription ? ` Character: ${assignedCharacter.visualDescription}.` : ""}`, model: "hailuo-fast", aspectRatio: ar, llmModel: getModelForTier(aiTier).llmValue }),
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
            body: JSON.stringify({ title: `Short: ${prompt.slice(0, 30)}`, scenes: [{ scene: 1, videoUrl: videoData.outputUrl }], musicUrl }),
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

      {/* Hero with background video */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 28, minHeight: 200 }}>
        <video autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }}
          src="/api/media/intro/demo-reel.mp4" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(8,11,16,0.92), rgba(245,158,11,0.1))" }} />
        <div style={{ position: "relative", padding: "40px 36px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: accent, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
            Quick Create
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Short Video Creator</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 480, lineHeight: 1.6 }}>
            Create 15–60 second videos for Reels, TikTok, and Shorts. No deep planning needed — just describe and generate.
          </p>
        </div>
      </div>

      {/* Session recovery banner */}
      {showResume && (
        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: accent }}>You have an unfinished short video</p>
            <p style={{ fontSize: 10, color: muted }}>Resume where you left off or start fresh.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={resumeSession} style={{ padding: "8px 18px", borderRadius: 10, background: accent, color: "#000", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Resume</button>
            <button onClick={startFresh} style={{ padding: "8px 18px", borderRadius: 10, background: "transparent", color: muted, fontSize: 12, border: `1px solid ${border}`, cursor: "pointer" }}>Start Fresh</button>
          </div>
        </div>
      )}

      {/* Sample strip */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", marginBottom: 28, paddingBottom: 4 }}>
        {[
          { src: "/api/media/intro/demo-short-reel.mp4", title: "Short Reel", badge: "60s" },
          { src: "/api/media/intro/demo-commercial-oj.mp4", title: "Product Ad", badge: "30s" },
          { src: "/api/media/intro/demo-reel.mp4", title: "Lifestyle", badge: "45s" },
          { src: "/api/media/intro/demo-story-mode.mp4", title: "Story Clip", badge: "30s" },
        ].map(v => (
          <div key={v.title} style={{ flexShrink: 0, width: 140, borderRadius: 12, overflow: "hidden", border: `1px solid ${border}`, background: surface, cursor: "pointer", position: "relative" }}>
            <video src={v.src} muted loop style={{ width: "100%", height: 90, objectFit: "cover" }}
              onMouseEnter={e => (e.target as HTMLVideoElement).play()}
              onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
            <span style={{ position: "absolute", top: 6, left: 6, fontSize: 8, padding: "2px 6px", borderRadius: 8, background: `${accent}cc`, color: "#000", fontWeight: 700 }}>{v.badge}</span>
            <div style={{ padding: "6px 8px" }}>
              <p style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{v.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main form */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>

        {/* Content type */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 12 }}>
          What kind of short video?
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
          {CONTENT_TYPES.map(t => (
            <button key={t.id} onClick={() => setContentType(t.id)}
              style={{
                padding: "14px 12px", borderRadius: 12,
                border: `1px solid ${contentType === t.id ? accent : border}`,
                background: contentType === t.id ? `${accent}10` : "linear-gradient(135deg, #141424, #1a1a2e)",
                cursor: "pointer", textAlign: "center", transition: "all 0.2s",
              }}>
              <span style={{ fontSize: 22, display: "block", marginBottom: 4 }}>{t.icon}</span>
              <p style={{ fontSize: 12, fontWeight: 600, color: contentType === t.id ? accent : "#fff" }}>{t.label}</p>
              <p style={{ fontSize: 9, color: muted }}>{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Prompt */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>
          Describe your video
        </p>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder="e.g. 'A 30-second reel showing street food, vibrant colours, upbeat music, text overlay with prices'"
          style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 20 }} />

        {/* Duration · Format · AI row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <DurationPicker preset="short" value={duration} onChange={(label: string) => setDuration(label)} accentColor={accent} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Format</p>
            <div style={{ display: "flex", gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${format === f ? accent : border}`, background: format === f ? `${accent}10` : "transparent", color: format === f ? accent : muted, fontSize: 9, cursor: "pointer", fontWeight: format === f ? 600 : 400 }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>AI Model</p>
            <AITierSelector value={aiTier} onChange={setAiTier} compact />
          </div>
        </div>

        {/* Music mood */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Music</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
          {MUSIC_MOODS.map(m => (
            <button key={m} onClick={() => setMusicMood(m)}
              style={{ padding: "7px 14px", borderRadius: 100, border: `1px solid ${musicMood === m ? accent : border}`, background: musicMood === m ? `${accent}10` : "transparent", color: musicMood === m ? accent : muted, fontSize: 12, cursor: "pointer" }}>
              {m}
            </button>
          ))}
        </div>

        {/* Characters */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Characters</p>
        <div style={{ display: "flex", gap: 8, marginBottom: assignedCharacter ? 10 : 24 }}>
          <button onClick={() => { window.location.href = "/dashboard/character-voices"; }}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #22c55e", background: "rgba(34,197,94,0.06)", color: "#22c55e", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Create Character
          </button>
          <button onClick={() => setShowCharacterPicker(!showCharacterPicker)}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #a855f7", background: showCharacterPicker ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.06)", color: "#a855f7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {showCharacterPicker ? "Close Picker" : "Assign Character"}
          </button>
        </div>
        {assignedCharacter && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid #a855f740`, background: "rgba(168,85,247,0.06)", marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{assignedCharacter.name}</p>
              {assignedCharacter.characterId && (
                <p style={{ fontSize: 9, fontFamily: "monospace", color: "#a855f7", marginTop: 2 }}>{assignedCharacter.characterId}</p>
              )}
            </div>
            <button onClick={() => setShowCharacterPicker(true)}
              style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
              Switch
            </button>
          </div>
        )}

        {/* Generate */}
        <button onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (!prompt.trim() || generating) ? "#2a2a40" : accent, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!prompt.trim() || generating) ? "not-allowed" : "pointer" }}>
          {generating ? "Generating..." : "⚡ Generate Short Video"}
        </button>

        {/* Error */}
        {errorMsg && (
          <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 13 }}>
            {errorMsg}
          </div>
        )}

        {/* Result */}
        {resultUrl && (
          <div style={{ marginTop: 20, borderRadius: 14, overflow: "hidden", border: `1px solid ${border}` }}>
            <video src={resultUrl} controls style={{ width: "100%", maxHeight: 360 }} />
            <div style={{ padding: "10px 14px", background: "#080b10", display: "flex", gap: 8 }}>
              <a href={resultUrl} download style={{ flex: 1, textAlign: "center", padding: "10px 14px", borderRadius: 10, background: "#22c55e", color: "#000", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Download</a>
              <a href="/dashboard/assets" style={{ flex: 1, textAlign: "center", padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, color: muted, fontSize: 12, textDecoration: "none" }}>Asset Library</a>
            </div>
          </div>
        )}

        <p style={{ fontSize: 10, color: "#3d5060", textAlign: "center", marginTop: 12 }}>
          For deeper planning, use <a href="/dashboard/movie-planner" style={{ color: "#7c5cfc", textDecoration: "none" }}>Movie Planner</a> or <a href="/dashboard/music-video-planner" style={{ color: "#7c5cfc", textDecoration: "none" }}>Music Video Planner</a>
        </p>
      </div>

      {/* Character Picker Modal */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(6,8,16,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCharacterPicker(false); }}>
          <div style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", overflowY: "auto", margin: 20 }}>
            <CharacterPicker
              onSelect={(character) => {
                setAssignedCharacter({ id: character.id, characterId: character.characterId, name: character.name, visualDescription: character.visualDescription });
                setShowCharacterPicker(false);
              }}
              onCreateNew={() => { window.location.href = "/dashboard/character-voices"; }}
              selectedId={assignedCharacter?.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
