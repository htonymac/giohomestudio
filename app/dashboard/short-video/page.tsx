"use client";

import { useState } from "react";

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
const MUSIC_MOODS = ["Upbeat", "Calm", "Dramatic", "Funny", "Afrobeats", "Gospel", "No Music"];

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const accent = "#f59e0b";

export default function ShortVideoPage() {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("");
  const [duration, setDuration] = useState("30 sec");
  const [format, setFormat] = useState("9:16 Vertical");
  const [musicMood, setMusicMood] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResultUrl(null);
    try {
      // Generate music if mood selected (not "No Music")
      let musicUrl: string | undefined;
      if (musicMood && musicMood !== "No Music") {
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: `${musicMood} background music, ${duration}`, mood: musicMood, tier: "standard", durationSeconds: parseInt(duration) || 30 }),
        });
        const musicData = await musicRes.json();
        if (musicData.musicPath) musicUrl = `/api/media/${musicData.musicPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
      }

      const ar = format.includes("9:16") ? "9:16" : format.includes("1:1") ? "1:1" : "16:9";
      const videoRes = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${prompt}. Style: ${contentType}. Duration: ${duration}.`, model: "hailuo-fast", aspectRatio: ar }),
      });
      const videoData = await videoRes.json();

      if (videoData.outputUrl) {
        if (musicUrl) {
          const assembleRes = await fetch("/api/video/assemble", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: `Short: ${prompt.slice(0, 30)}`, scenes: [{ scene: 1, videoUrl: videoData.outputUrl }], musicUrl }),
          });
          const assembleData = await assembleRes.json();
          setResultUrl(assembleData.outputUrl ?? videoData.outputUrl);
        } else {
          setResultUrl(videoData.outputUrl);
        }
      }
    } catch { /* ignore */ }
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
          placeholder="e.g. 'A 30-second reel showing Lagos street food, vibrant colours, afrobeats music, text overlay with prices'"
          style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 20 }} />

        {/* Duration + Format row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Duration</p>
            <div style={{ display: "flex", gap: 6 }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  style={{ flex: 1, padding: "8px 8px", borderRadius: 8, border: `1px solid ${duration === d ? accent : border}`, background: duration === d ? `${accent}10` : "transparent", color: duration === d ? accent : muted, fontSize: 11, cursor: "pointer", fontWeight: duration === d ? 600 : 400 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Format</p>
            <div style={{ display: "flex", gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${format === f ? accent : border}`, background: format === f ? `${accent}10` : "transparent", color: format === f ? accent : muted, fontSize: 10, cursor: "pointer", fontWeight: format === f ? 600 : 400 }}>
                  {f}
                </button>
              ))}
            </div>
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

        {/* Generate */}
        <button onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (!prompt.trim() || generating) ? "#2a2a40" : accent, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!prompt.trim() || generating) ? "not-allowed" : "pointer" }}>
          {generating ? "Generating..." : "⚡ Generate Short Video"}
        </button>

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
    </div>
  );
}
