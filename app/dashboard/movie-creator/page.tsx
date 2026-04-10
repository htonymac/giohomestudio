"use client";

import { useState } from "react";

// Movie & Series Creator — Two clear paths: Full Video vs Hybrid (the GHS advantage)

export default function MovieCreatorPage() {
  const [showHybridInfo, setShowHybridInfo] = useState(false);

  return (
    <div>

      {/* Hero with background video */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 32, minHeight: 220 }}>
        <video autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }}
          src="/api/media/intro/hero-brave.mp4" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(8,11,16,0.92), rgba(124,92,252,0.12))" }} />
        <div style={{ position: "relative", padding: "48px 40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,92,252,0.12)", border: "1px solid rgba(124,92,252,0.25)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: "#7c5cfc", letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
            Multi-AI Cinematic Studio
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 10 }}>
            Create Movie & Series
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", maxWidth: 500, lineHeight: 1.6 }}>
            Write a simple idea — AI expands it into a full cinematic blueprint with characters, scenes, sound design, and visual generation.
          </p>
        </div>
      </div>

      {/* ═══ TWO MAIN PATHS — Full Video vs Hybrid ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

        {/* ── Full Video Movie ── */}
        <a href="/dashboard/movie-planner" style={{ textDecoration: "none" }}>
          <div style={{ background: "#0e1318", border: "1px solid #1e2a35", borderRadius: 20, overflow: "hidden", cursor: "pointer", transition: "all 0.3s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,92,252,0.4)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a35"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}>

            {/* Sample video */}
            <div style={{ position: "relative", height: 160 }}>
              <video muted loop playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                src="/api/media/intro/hero-brave.mp4"
                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0e1318, transparent 60%)" }} />
              <span style={{ position: "absolute", top: 12, left: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(124,92,252,0.85)", color: "#fff", fontWeight: 700 }}>
                Full Video
              </span>
              <span style={{ position: "absolute", top: 12, right: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 600, border: "1px solid rgba(239,68,68,0.3)" }}>
                4 credits/scene
              </span>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Text to Video Movie</h3>
              <p style={{ fontSize: 13, color: "#5a7080", lineHeight: 1.6, marginBottom: 16 }}>
                Every scene is generated as full video. Best quality, highest motion. For cinematic productions, action films, and premium content.
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#7c5cfc", fontWeight: 600 }}>Open Movie Planner →</span>
                <span style={{ fontSize: 10, color: "#ef4444" }}>Higher credits</span>
              </div>
            </div>
          </div>
        </a>

        {/* ── Hybrid Movie (THE GHS ADVANTAGE) ── */}
        <a href="/dashboard/hybrid-planner" style={{ textDecoration: "none" }}>
          <div style={{ background: "#0e1318", border: "2px solid rgba(34,197,94,0.3)", borderRadius: 20, overflow: "hidden", cursor: "pointer", transition: "all 0.3s", position: "relative" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.5)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.3)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}>

            {/* Recommended badge */}
            <div style={{ position: "absolute", top: -1, right: 20, background: "#22c55e", color: "#000", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: "0 0 10px 10px", zIndex: 10, letterSpacing: 0.5 }}>
              RECOMMENDED — SAVE 50-75%
            </div>

            {/* Sample video */}
            <div style={{ position: "relative", height: 160 }}>
              <video muted loop playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                src="/api/media/demo/movie_hybrid_ai_demo.mp4"
                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #0e1318, transparent 60%)" }} />
              <span style={{ position: "absolute", top: 12, left: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(34,197,94,0.85)", color: "#fff", fontWeight: 700 }}>
                Hybrid — Images + Video
              </span>
              <span style={{ position: "absolute", top: 12, right: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 600, border: "1px solid rgba(34,197,94,0.3)" }}>
                1-2 credits/scene
              </span>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                Hybrid Movie <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>(GHS Smart Format)</span>
              </h3>
              <p style={{ fontSize: 13, color: "#5a7080", lineHeight: 1.6, marginBottom: 12 }}>
                Images for calm scenes (setup, dialogue, emotion) + Video only for action scenes (5-10 sec). Audio ties everything together. Same story, <strong style={{ color: "#22c55e" }}>75% less credits</strong>.
              </p>

              {/* How it works mini */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
                <div style={{ background: "rgba(34,197,94,0.06)", borderRadius: 8, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(34,197,94,0.1)" }}>
                  <p style={{ fontSize: 16, marginBottom: 2 }}>🖼</p>
                  <p style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>Images</p>
                  <p style={{ fontSize: 8, color: "#5a7080" }}>Setup & Emotion</p>
                </div>
                <div style={{ background: "rgba(124,92,252,0.06)", borderRadius: 8, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(124,92,252,0.1)" }}>
                  <p style={{ fontSize: 16, marginBottom: 2 }}>🎬</p>
                  <p style={{ fontSize: 9, color: "#7c5cfc", fontWeight: 600 }}>Video</p>
                  <p style={{ fontSize: 8, color: "#5a7080" }}>Action Only</p>
                </div>
                <div style={{ background: "rgba(0,212,255,0.06)", borderRadius: 8, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(0,212,255,0.1)" }}>
                  <p style={{ fontSize: 16, marginBottom: 2 }}>🔊</p>
                  <p style={{ fontSize: 9, color: "#00d4ff", fontWeight: 600 }}>Audio</p>
                  <p style={{ fontSize: 8, color: "#5a7080" }}>The Glue</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Start Hybrid Movie →</span>
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowHybridInfo(true); }}
                  style={{ fontSize: 10, color: "#00d4ff", background: "none", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                  Learn more
                </button>
              </div>
            </div>
          </div>
        </a>
      </div>

      {/* ═══ Learn More — Hybrid Explanation ═══ */}
      {showHybridInfo && (
        <div style={{ background: "#0e1318", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>How Hybrid Movie Works</h3>
            <button onClick={() => setShowHybridInfo(false)} style={{ fontSize: 14, color: "#5a7080", background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: "#e0e0f0", lineHeight: 1.8, marginBottom: 12 }}>
                In traditional AI movie making, every scene is generated as full video — even scenes where characters are just talking or standing still. That wastes credits on scenes that don&apos;t need motion.
              </p>
              <p style={{ fontSize: 13, color: "#e0e0f0", lineHeight: 1.8 }}>
                <strong style={{ color: "#22c55e" }}>GHS Hybrid Format</strong> uses AI to decide which scenes truly need video (action, movement, impact) and which scenes work better as images with rich narration and sound design.
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Cost Comparison (10-scene movie)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <span style={{ fontSize: 12, color: "#ef4444" }}>Full Video (10 scenes × 4)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>40 credits</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <span style={{ fontSize: 12, color: "#22c55e" }}>Hybrid (6 images + 4 videos)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>12 credits</span>
                </div>
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#22c55e" }}>Save 28 credits (70%)</span>
                </div>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: "#5a7080", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>How AI decides per scene</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {[
              { type: "Image", when: "Setup, dialogue, emotion, flashback", credit: "1 credit", color: "#22c55e" },
              { type: "Video", when: "Action, fight, chase, jump, impact", credit: "4 credits", color: "#7c5cfc" },
              { type: "Image→Video", when: "Intro, outro, subtle motion", credit: "2 credits", color: "#f59e0b" },
              { type: "Audio Bridge", when: "Transitions, suspense, darkness", credit: "0 credits", color: "#00d4ff" },
              { type: "Hybrid", when: "Calm → action, still → alive", credit: "2 credits", color: "#ec4899" },
            ].map(s => (
              <div key={s.type} style={{ background: "#080b10", borderRadius: 10, padding: "10px 12px", border: `1px solid ${s.color}20` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.type}</p>
                <p style={{ fontSize: 9, color: "#5a7080", lineHeight: 1.4, marginBottom: 6 }}>{s.when}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{s.credit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Other options ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
        <a href="/dashboard/movie-planner?continue=true" style={{ textDecoration: "none" }}>
          <div style={{ background: "#0e1318", border: "1px solid #1e2a35", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.3s", height: "100%" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,197,94,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a35"; }}>
            <span style={{ fontSize: 28, display: "block", marginBottom: 10 }}>📂</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Continue Existing</h3>
            <p style={{ fontSize: 11, color: "#5a7080", lineHeight: 1.5 }}>Load saved project, resume where you left off</p>
          </div>
        </a>
        <a href="/dashboard/series-wizard" style={{ textDecoration: "none" }}>
          <div style={{ background: "#0e1318", border: "1px solid #1e2a35", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.3s", height: "100%" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(245,158,11,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a35"; }}>
            <span style={{ fontSize: 28, display: "block", marginBottom: 10 }}>📺</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Create Series</h3>
            <p style={{ fontSize: 11, color: "#5a7080", lineHeight: 1.5 }}>Episodic content with recurring characters</p>
          </div>
        </a>
        <a href="/dashboard/character-voices" style={{ textDecoration: "none" }}>
          <div style={{ background: "#0e1318", border: "1px solid #1e2a35", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.3s", height: "100%" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(236,72,153,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a35"; }}>
            <span style={{ fontSize: 28, display: "block", marginBottom: 10 }}>🎭</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Manage Characters</h3>
            <p style={{ fontSize: 11, color: "#5a7080", lineHeight: 1.5 }}>Create your cast — used across all projects</p>
          </div>
        </a>
      </div>

      {/* ═══ Sample Videos ═══ */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#3d5060", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          Sample productions — hover to preview
          <span style={{ flex: 1, height: 1, background: "#1e2a35" }} />
        </p>

        {/* AI-generated movie images */}
        <p style={{ fontSize: 11, color: "#7c5cfc", fontWeight: 600, marginBottom: 8 }}>AI-Generated Scene Images</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto" }}>
          {[
            { src: "/api/media/demo/hero_warrior.png", label: "Warrior on Cliff" },
            { src: "/api/media/demo/movie_kingdom.png", label: "Ancient Kingdom" },
            { src: "/api/media/demo/movie_warrior_face.png", label: "Warrior Close-Up" },
            { src: "/api/media/demo/movie_landscape.png", label: "Epic Landscape" },
          ].map(img => (
            <div key={img.label} style={{ flexShrink: 0, width: 200, borderRadius: 12, overflow: "hidden", border: "1px solid #1e2a35", background: "#0e1318" }}>
              <img src={img.src} alt={img.label} style={{ width: "100%", height: 110, objectFit: "cover" }} />
              <div style={{ padding: "8px 10px" }}>
                <p style={{ fontSize: 10, color: "#fff", fontWeight: 500 }}>{img.label}</p>
                <p style={{ fontSize: 8, color: "#3d5060" }}>AI Generated (fal.ai)</p>
              </div>
            </div>
          ))}
        </div>

        {/* Hybrid samples */}
        <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 600, marginBottom: 8 }}>Hybrid Format (Images + Video)</p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {[
            { src: "/api/media/demo/movie_complete_demo.mp4", title: "Warrior Epic", desc: "AI images + video + narration + music" },
            { src: "/api/media/demo/image_story_demo.mp4", title: "Image Story", desc: "Pure AI images with zoom" },
            { src: "/api/media/intro/demo-property.mp4", title: "Property Tour", desc: "Full video walkthrough" },
          ].map(v => (
            <div key={v.title} style={{ flexShrink: 0, width: 200, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(34,197,94,0.2)", background: "#0e1318", cursor: "pointer" }}>
              <div style={{ position: "relative", height: 120 }}>
                <video src={v.src} muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <span style={{ color: "#fff", fontSize: 14, marginLeft: 2 }}>▶</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{v.title}</p>
                <p style={{ fontSize: 9, color: "#5a7080" }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Full video samples */}
        <p style={{ fontSize: 11, color: "#7c5cfc", fontWeight: 600, marginBottom: 8 }}>Full Video Format</p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { src: "/api/media/intro/hero-brave.mp4", title: "Cinematic Action", desc: "Full motion, every frame" },
            { src: "/api/media/intro/demo-story-mode.mp4", title: "Story Mode", desc: "Narrative-driven video" },
            { src: "/api/media/intro/hero-maintain.mp4", title: "Epic Scene", desc: "Premium cinematic" },
            { src: "/api/media/intro/demo-short-reel.mp4", title: "Short Film", desc: "Quick story video" },
          ].map(v => (
            <div key={v.title} style={{ flexShrink: 0, width: 200, borderRadius: 14, overflow: "hidden", border: "1px solid #1e2a35", background: "#0e1318", cursor: "pointer" }}>
              <div style={{ position: "relative", height: 120 }}>
                <video src={v.src} muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <span style={{ color: "#fff", fontSize: 14, marginLeft: 2 }}>▶</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{v.title}</p>
                <p style={{ fontSize: 9, color: "#5a7080" }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
