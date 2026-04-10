"use client";

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Music Video Planner — Dedicated deep planning for music videos
// 2 AI layers: Planner (concept + storyboard) + Reviewer (pacing + quality)
// Non-LLM engines: Song Structure, Caption/Lyric Timing, Generation Strategy
//
// Flow: Import song → AI analyzes → Choose video mode → Storyboard → Preview → Render
// ═══════════════════════════════════════════════════════════════════════════

const VIDEO_MODES = [
  { id: "official", label: "Official Music Video", icon: "🎬", desc: "Full cinematic music video with AI scenes" },
  { id: "lyric", label: "Lyric Video", icon: "📝", desc: "Timed lyrics with mood visuals" },
  { id: "visualizer", label: "Visualizer", icon: "🌊", desc: "Waveform/motion background with branding" },
  { id: "image-mv", label: "Image Music Video", icon: "📸", desc: "Your photos animated to music" },
  { id: "performance", label: "AI Artist Performance", icon: "🕺", desc: "AI avatar performing your song" },
  { id: "commercial", label: "Commercial Music Promo", icon: "📣", desc: "Product/brand music promo" },
  { id: "dance", label: "Dance Mode", icon: "💃", desc: "Energetic rhythm-driven visuals" },
  { id: "children", label: "Children Music Video", icon: "🧒", desc: "Safe, bright, educational" },
];

const VISUAL_STYLES = [
  "Cinematic", "Street", "Luxury", "Abstract", "Nature", "Urban Lagos",
  "Fantasy", "Neon", "Worship Glow", "Dark Moody", "Afrobeat Energy", "Minimalist",
];

interface Scene {
  scene: number;
  section: string;
  duration: string;
  prompt: string;
  style: string;
  movement: string;
  caption: string;
  genMethod: string;
  status: string;
  outputUrl?: string;
}

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const accent = "#7c5cfc";
const cardStyle: React.CSSProperties = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10, display: "block" };
const inputStyle: React.CSSProperties = { width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" };

interface MvProject { id: string; title: string; videoMode: string | null; status: string; updatedAt: string }

export default function MusicVideoPlannerPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<MvProject[]>([]);
  const [saving, setSaving] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  // Load project list
  useEffect(() => {
    fetch("/api/music-video/project").then(r => r.json()).then(d => {
      if (d.projects) setProjectList(d.projects);
    }).catch(() => {});
  }, []);

  // Step 1: Song input
  const [songSource, setSongSource] = useState<"upload" | "generate" | "library">("upload");
  const [songTitle, setSongTitle] = useState("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");

  // Step 2: Mode + style
  const [videoMode, setVideoMode] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [artistName, setArtistName] = useState("");

  // Step 3: AI analysis result
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{ energy: string; mood: string; genre: string; sections: string; suggestions: string[] } | null>(null);

  // Step 4: Storyboard
  const [storyboard, setStoryboard] = useState<Scene[]>([]);
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  // Step 5: Render
  const [videoModel, setVideoModel] = useState("hailuo-fast");
  const [renderingScene, setRenderingScene] = useState<number | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);

  // ── Analyze song ──
  async function analyzeSong() {
    setAnalyzing(true);
    try {
      // Call the Music Video Intelligence API (7 engines)
      const res = await fetch("/api/music-video/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songTitle, genre: visualStyle, mood: videoMode, lyrics, durationSeconds: 180, videoMode,
        }),
      });
      const data = await res.json();

      const profile = data.musicProfile ?? {};
      const recs = data.recommendations ?? {};
      const dance = data.danceIntelligence ?? {};
      const sections = (data.sections ?? []) as Array<{ name: string }>;

      setAnalysis({
        energy: (profile.energy as string) ?? "Medium",
        mood: (profile.mood as string) ?? "Neutral",
        genre: (profile.genre as string) ?? "Unknown",
        sections: sections.map((s: { name: string }) => s.name).join(" → "),
        suggestions: [
          `BPM: ${profile.bpm ?? "~120"} · Danceability: ${Math.round(((profile.danceability as number) ?? 0.5) * 100)}%`,
          `Best mode: ${recs.bestVideoMode ?? videoMode}`,
          `Dance style: ${(dance.bestDanceFamily as string) ?? recs.bestDanceType ?? "Performance"}`,
          `Suggested model: ${recs.suggestedModel ?? "kling2"} · ${recs.bestPacing ?? "medium"} pacing`,
          `Camera: ${(dance.cameraStyle as string) ?? "smooth tracking"}`,
          ...(recs.suggestedOutputs ?? []).map((o: string) => `Output: ${o}`),
        ],
      });

      // Auto-set recommended model
      if (recs.suggestedModel) setVideoModel(recs.suggestedModel);

      setStep(3);
    } catch {
      setAnalysis({ energy: "Medium", mood: "Neutral", genre: "Unknown", sections: "Intro → Body → Outro", suggestions: ["Analysis failed — try again or proceed manually"] });
      setStep(3);
    }
    setAnalyzing(false);
  }

  // ── Generate storyboard ──
  // ── Save project to DB ──
  const saveProject = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/music-video/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId ?? undefined,
          title: songTitle || "Untitled Music Video",
          songTitle, lyrics, videoMode, visualStyle, artistName,
          status: storyboard.length > 0 ? "planned" : "draft",
          musicProfile: analysis,
          storyboard,
        }),
      });
      const data = await res.json();
      if (data.project) {
        if (!projectId) setProjectId(data.project.id);
        fetch("/api/music-video/project").then(r => r.json()).then(d => {
          if (d.projects) setProjectList(d.projects);
        }).catch(() => {});
      }
    } catch { /* ignore */ }
    setSaving(false);
  }, [projectId, songTitle, lyrics, videoMode, visualStyle, artistName, analysis, storyboard]);

  // ── Load project ──
  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/music-video/project/${id}`);
      const data = await res.json();
      if (data.project) {
        const p = data.project;
        setProjectId(p.id);
        setSongTitle(p.songTitle ?? "");
        setLyrics(p.lyrics ?? "");
        setVideoMode(p.videoMode ?? "");
        setVisualStyle(p.visualStyle ?? "");
        setArtistName(p.artistName ?? "");
        if (p.storyboard) setStoryboard(p.storyboard as Scene[]);
        if (p.musicProfile) setAnalysis(p.musicProfile as typeof analysis);
        setStep(p.storyboard ? 4 : p.videoMode ? 2 : 1);
        setShowProjects(false);
      }
    } catch { /* ignore */ }
  }

  async function generateStoryboard() {
    setStoryboardLoading(true);
    try {
      const res = await fetch("/api/auto-creator/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion: { title: songTitle, type: videoMode, style: visualStyle, description: `${videoMode} music video`, caption_preview: lyrics.slice(0, 100), cta: "", music_mood: analysis?.mood ?? "energetic" },
          context: `Create a ${videoMode} music video storyboard. Song: ${songTitle}. Style: ${visualStyle}. Artist: ${artistName}. Energy: ${analysis?.energy}. Genre: ${analysis?.genre}. Sections: ${analysis?.sections}. ${lyrics ? `Lyrics available for timing.` : "No lyrics."}`,
        }),
      });
      const data = await res.json();

      const scenes: Scene[] = [
        { scene: 1, section: "Intro", duration: "8s", prompt: `Opening: ${visualStyle} mood establishing shot`, style: visualStyle, movement: "Slow zoom in", caption: "", genMethod: "image-to-video", status: "planned" },
        { scene: 2, section: "Verse 1", duration: "20s", prompt: `${data.draft?.voice_script?.split(".")[0] || `${videoMode} verse visual — ${analysis?.mood}`}`, style: visualStyle, movement: "Lateral pan", caption: lyrics ? lyrics.split("\n")[0] ?? "" : "", genMethod: "video", status: "planned" },
        { scene: 3, section: "Chorus", duration: "15s", prompt: `High energy chorus — ${analysis?.genre} ${visualStyle}, dynamic`, style: visualStyle, movement: "Beat punch cuts", caption: lyrics ? lyrics.split("\n").slice(2, 4).join(" ") : "", genMethod: "video", status: "planned" },
        { scene: 4, section: "Verse 2", duration: "20s", prompt: `Continuation — deeper storytelling, ${analysis?.mood}`, style: visualStyle, movement: "Smooth glide", caption: "", genMethod: "image-to-video", status: "planned" },
        { scene: 5, section: "Chorus 2", duration: "15s", prompt: `Chorus repeat — even stronger energy, ${visualStyle}`, style: visualStyle, movement: "Fast cuts", caption: "", genMethod: "video", status: "planned" },
        { scene: 6, section: "Outro", duration: "10s", prompt: `Closing: fade, ${artistName || "artist"} title card`, style: visualStyle, movement: "Slow zoom out", caption: artistName || songTitle, genMethod: "image", status: "planned" },
      ];
      setStoryboard(scenes);
      setStep(4);
      // Auto-save after storyboard
      setTimeout(() => saveProject(), 500);
    } catch { /* ignore */ }
    setStoryboardLoading(false);
  }

  // ── Render scene ──
  async function renderSingleScene(sceneNum: number) {
    const scene = storyboard.find(s => s.scene === sceneNum);
    if (!scene) return;
    setRenderingScene(sceneNum);
    setStoryboard(prev => prev.map(s => s.scene === sceneNum ? { ...s, status: "generating" } : s));
    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${scene.prompt}. Camera: ${scene.movement}. Style: ${scene.style}.`, model: videoModel }),
      });
      const data = await res.json();
      setStoryboard(prev => prev.map(s => s.scene === sceneNum ? { ...s, status: data.outputUrl ? "generated" : "needs_edit", outputUrl: data.outputUrl } : s));
    } catch {
      setStoryboard(prev => prev.map(s => s.scene === sceneNum ? { ...s, status: "needs_edit" } : s));
    }
    setRenderingScene(null);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: "#00d4ff", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
          Music Video Planning
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>
          Music Video Planner
        </h1>
        <p style={{ fontSize: 14, color: muted, lineHeight: 1.6 }}>
          Import or create a song → AI analyzes it → choose visual mode → storyboard → preview → render.
        </p>
      </div>

      {/* Project bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", background: surface, border: `1px solid ${border}`, borderRadius: 10 }}>
        <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{songTitle || "New Project"}</span>
        <button onClick={() => saveProject()} disabled={saving}
          style={{ marginLeft: "auto", fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontWeight: 600 }}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setShowProjects(!showProjects)}
          style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
          Projects ({projectList.length})
        </button>
      </div>

      {/* Recent projects */}
      {showProjects && (
        <div style={{ ...cardStyle, marginBottom: 16, maxHeight: 200, overflowY: "auto" }}>
          {projectList.length === 0 && <p style={{ fontSize: 12, color: muted }}>No saved projects yet</p>}
          {projectList.map(p => (
            <div key={p.id} onClick={() => loadProject(p.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, marginBottom: 3, background: projectId === p.id ? "rgba(0,212,255,0.06)" : "transparent", cursor: "pointer", border: `1px solid ${projectId === p.id ? "rgba(0,212,255,0.2)" : "transparent"}` }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{p.title}</span>
                <span style={{ fontSize: 9, color: muted, marginLeft: 8 }}>{p.videoMode ?? ""} &middot; {p.status}</span>
              </div>
              <span style={{ fontSize: 9, color: "#3d5060" }}>{new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
        {[{ n: 1, l: "Song" }, { n: 2, l: "Mode" }, { n: 3, l: "Analysis" }, { n: 4, l: "Storyboard" }, { n: 5, l: "Render" }].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? "#00d4ff" : "#1e2a35" }} />
            <p style={{ fontSize: 9, color: step >= s.n ? "#00d4ff" : "#3d5060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Song Input ═══ */}
      {step === 1 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Your Song</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["upload", "generate", "library"] as const).map(s => (
              <button key={s} onClick={() => setSongSource(s)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${songSource === s ? "#00d4ff" : border}`, background: songSource === s ? "rgba(0,212,255,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>{s === "library" ? "From Library" : s === "generate" ? "Generate New" : "Upload Song"}</p>
              </button>
            ))}
          </div>

          {songSource === "upload" && (
            <div style={{ border: `2px dashed ${border}`, borderRadius: 16, padding: 40, textAlign: "center", cursor: "pointer", marginBottom: 20 }}
              onClick={() => document.getElementById("songUpload")?.click()}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🎵</p>
              <p style={{ fontSize: 14, color: muted }}>Upload MP3, WAV, or AAC</p>
              <input id="songUpload" type="file" accept="audio/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setSongFile(f); setSongUrl(URL.createObjectURL(f)); setSongTitle(f.name.replace(/\.[^.]+$/, "")); } }} />
              {songFile && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>Selected: {songFile.name}</p>}
            </div>
          )}

          {songSource === "generate" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Create your song first in the <a href="/dashboard/music-video" style={{ color: "#00d4ff", textDecoration: "none" }}>Music Studio</a>, then come back here to plan the video.</p>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Song Title</label>
            <input value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="e.g. Lagos Love" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Lyrics (optional — helps with lyric timing)</label>
            <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={4}
              placeholder="Paste your lyrics here..." style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {songUrl && (
            <div style={{ marginBottom: 16 }}>
              <audio src={songUrl} controls style={{ width: "100%" }} />
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!songTitle.trim()}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: songTitle.trim() ? "#00d4ff" : "#2a2a40", color: "#000", fontSize: 16, fontWeight: 700, cursor: songTitle.trim() ? "pointer" : "not-allowed" }}>
            Next — Choose Video Mode
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Mode + Style ═══ */}
      {step === 2 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>What kind of music video?</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 24 }}>
            {VIDEO_MODES.map(m => (
              <button key={m.id} onClick={() => setVideoMode(m.id)}
                style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${videoMode === m.id ? "#00d4ff" : border}`, background: videoMode === m.id ? "rgba(0,212,255,0.06)" : "transparent", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                  <p style={{ fontSize: 10, color: muted }}>{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <label style={labelStyle}>Visual Style</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {VISUAL_STYLES.map(s => (
              <button key={s} onClick={() => setVisualStyle(s)}
                style={{ padding: "7px 14px", borderRadius: 100, border: `1px solid ${visualStyle === s ? "#00d4ff" : border}`, background: visualStyle === s ? "rgba(0,212,255,0.1)" : "transparent", color: visualStyle === s ? "#00d4ff" : muted, fontSize: 12, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Artist / Brand Name (optional)</label>
            <input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="For title cards and branding" style={inputStyle} />
          </div>

          {/* Narration intro/outro */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Narration Intro / Outro (optional)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Intro voiceover</p>
                <input placeholder="e.g. 'Presenting the official video for...'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
              </div>
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Outro voiceover</p>
                <input placeholder="e.g. 'Stream now on all platforms'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["No Narration", "AI Voice", "My Voice"].map(v => (
                <button key={v} style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>{v}</button>
              ))}
            </div>
          </div>

          {/* Commercial promo controls — only show when commercial mode selected */}
          {videoMode === "commercial" && (
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 14, background: "rgba(255,107,53,0.04)", border: "1px solid rgba(255,107,53,0.15)" }}>
              <p style={{ ...labelStyle, color: "#ff6b35" }}>Commercial Promo Controls</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>CTA Text</p>
                  <input placeholder="e.g. 'Order Now', 'Visit Us'" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>WhatsApp / Contact</p>
                  <input placeholder="+234 800 000 0000" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Website (optional)</p>
                  <input placeholder="www.yourbrand.com" style={{ ...inputStyle, fontSize: 12, padding: "10px 12px" }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 4 }}>Logo</p>
                  <div style={{ border: `1px dashed ${border}`, borderRadius: 8, padding: "8px 12px", textAlign: "center", cursor: "pointer", fontSize: 10, color: muted }}>
                    Upload logo
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Show CTA Card", "Show WhatsApp", "Show Logo", "Show Website"].map(opt => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: muted, cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: "#ff6b35" }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={analyzeSong} disabled={!videoMode || analyzing}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (!videoMode || analyzing) ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              {analyzing ? "AI Analyzing Song..." : "Analyze Song & Plan Video"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Analysis Results ═══ */}
      {step === 3 && analysis && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Song Analysis</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {[
              { label: "Energy", value: analysis.energy },
              { label: "Mood", value: analysis.mood },
              { label: "Genre", value: analysis.genre },
              { label: "Structure", value: analysis.sections.split("→").length + " sections" },
            ].map(a => (
              <div key={a.label} style={{ background: "#080b10", borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 9, color: "#00d4ff", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{a.label}</p>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{a.value}</p>
              </div>
            ))}
          </div>

          <p style={{ ...labelStyle }}>AI Suggestions</p>
          {analysis.suggestions.map((s, i) => (
            <p key={i} style={{ fontSize: 12, color: "#e0e0f0", marginBottom: 6 }}>• {s}</p>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={generateStoryboard} disabled={storyboardLoading}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: storyboardLoading ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              {storyboardLoading ? "Building Storyboard..." : "Generate Storyboard"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Storyboard ═══ */}
      {step === 4 && storyboard.length > 0 && (
        <div>
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Storyboard — {storyboard.length} scenes</h2>
              <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>{videoMode}</span>
            </div>

            {storyboard.map(s => (
              <div key={s.scene} onClick={() => setSelectedScene(selectedScene === s.scene ? null : s.scene)}
                style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${border}`, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#080b10", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: muted, flexShrink: 0 }}>{s.scene}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.section}</p>
                    <span style={{ fontSize: 10, color: muted }}>{s.duration}</span>
                  </div>
                  {selectedScene === s.scene ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea value={s.prompt} onChange={e => setStoryboard(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, prompt: e.target.value } : sc))}
                        rows={2} style={{ ...inputStyle, fontSize: 11, padding: "6px 8px", marginBottom: 6 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={s.movement} onChange={e => setStoryboard(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, movement: e.target.value } : sc))}
                          style={{ ...inputStyle, fontSize: 10, padding: "4px 8px", flex: 1 }} placeholder="Movement" />
                        {s.caption && <input value={s.caption} onChange={e => setStoryboard(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, caption: e.target.value } : sc))}
                          style={{ ...inputStyle, fontSize: 10, padding: "4px 8px", flex: 1 }} placeholder="Caption/Lyric" />}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>{s.prompt.slice(0, 80)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Back</button>
            <button onClick={() => setStep(5)}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: "#22c55e", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Approve Storyboard — Go to Render
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: Render Queue ═══ */}
      {step === 5 && storyboard.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Render Queue</h2>

          {/* Model selector */}
          <div style={{ marginBottom: 20 }}>
            <p style={labelStyle}>Video AI Model</p>
            <p style={{ fontSize: 10, color: "#3d5060", marginBottom: 8 }}>Music Video & Dance</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
              {[
                { id: "seedance", label: "SeeDance 2.0", cost: "2 credits/scene", badge: "Dance" },
                { id: "kling25-turbo", label: "Kling 2.5 Turbo", cost: "3 credits/scene" },
                { id: "hailuo-pro", label: "Hailuo Pro", cost: "4 credits/scene" },
              ].map(m => (
                <button key={m.id} onClick={() => setVideoModel(m.id)}
                  style={{ padding: "10px 10px", borderRadius: 10, border: `1px solid ${videoModel === m.id ? "#00d4ff" : border}`, background: videoModel === m.id ? "rgba(0,212,255,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                  <p style={{ fontSize: 9, color: muted }}>{m.cost}</p>
                  {m.badge && <span style={{ fontSize: 8, color: "#00d4ff" }}>{m.badge}</span>}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: "#3d5060", marginBottom: 6 }}>Budget & Animation</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { id: "wan25", label: "Wan 2.5", cost: "1 credit/scene", badge: "Cheapest" },
                { id: "kling2", label: "Kling 2.1", cost: "1 credit/scene", badge: "Best price" },
                { id: "hailuo-fast", label: "Hailuo Fast", cost: "2 credits/scene", badge: "Fastest" },
              ].map(m => (
                <button key={m.id} onClick={() => setVideoModel(m.id)}
                  style={{ padding: "10px 10px", borderRadius: 10, border: `1px solid ${videoModel === m.id ? "#22c55e" : border}`, background: videoModel === m.id ? "rgba(34,197,94,0.06)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                  <p style={{ fontSize: 9, color: muted }}>{m.cost}</p>
                  {m.badge && <span style={{ fontSize: 8, color: "#22c55e" }}>{m.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Scenes */}
          {storyboard.map(s => (
            <div key={s.scene} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, marginBottom: 4, background: "#080b10", border: `1px solid ${s.status === "generated" ? "rgba(34,197,94,0.3)" : border}` }}>
              <span style={{ fontSize: 12, color: "#fff" }}>Scene {s.scene}: {s.section}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {s.status === "generated" && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>Done</span>}
                {s.status === "generating" && <span style={{ fontSize: 9, color: accent, fontWeight: 600 }}>Rendering...</span>}
                {s.status === "planned" && (
                  <button onClick={() => renderSingleScene(s.scene)} disabled={renderingScene !== null}
                    style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: `${accent}15`, color: accent, border: "none", cursor: "pointer" }}>Render</button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={async () => { for (const s of storyboard) { if (s.status === "planned") await renderSingleScene(s.scene); } }}
            disabled={renderingScene !== null}
            style={{ width: "100%", marginTop: 16, padding: 16, borderRadius: 14, border: "none", background: renderingScene !== null ? "#2a2a40" : accent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: renderingScene !== null ? "not-allowed" : "pointer" }}>
            {renderingScene !== null ? `Rendering Scene ${renderingScene}...` : "Render All Scenes"}
          </button>
          <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 8 }}>Credits charged per scene</p>

          {/* Assemble final music video */}
          {storyboard.some(s => s.status === "generated") && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)" }}>
              {assembledUrl && (
                <div style={{ borderRadius: 8, overflow: "hidden", marginBottom: 12, border: `1px solid ${border}` }}>
                  <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 280 }} />
                </div>
              )}
              <button
                onClick={async () => {
                  setAssembling(true);
                  try {
                    const rendered = storyboard.filter(s => s.status === "generated" && s.outputUrl).map(s => ({ scene: s.scene, videoUrl: s.outputUrl! }));
                    const res = await fetch("/api/video/assemble", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: songTitle, scenes: rendered, musicUrl: songUrl }),
                    });
                    const data = await res.json();
                    if (data.outputUrl) setAssembledUrl(data.outputUrl);
                  } catch { /* ignore */ }
                  setAssembling(false);
                }}
                disabled={assembling}
                style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: assembling ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 15, fontWeight: 700, cursor: assembling ? "not-allowed" : "pointer" }}>
                {assembling ? "Assembling..." : assembledUrl ? "Re-assemble Music Video" : `Assemble ${storyboard.filter(s => s.status === "generated").length} Scenes + Music`}
              </button>
              <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Merges video scenes with your music track. Auto-saved to Asset Library.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
