"use client";

import { useState } from "react";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { Film, Image, Folder } from "../../components/icons";

export default function MovieCreatorPage() {
  const [showHybridInfo, setShowHybridInfo] = useState(false);

  return (
    <div style={{ fontFamily: ds.font.sans }}>

      {/* ── Hero ── */}
      <div style={{ marginBottom: 32 }}>
        <HeroTitle
          kicker="Multi-AI Cinematic Studio"
          title="Create Movie"
          italic="& Series"
          sub="Write a simple idea — AI expands it into a full cinematic blueprint with characters, scenes, sound design, and visual generation."
        />
      </div>

      {/* ── TWO MAIN PATHS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

        {/* Full Video Movie */}
        <a href="/dashboard/movie-planner" style={{ textDecoration: "none" }}>
          <Card
            style={{ overflow: "hidden", padding: 0, cursor: "pointer", transition: "border-color 0.2s, transform 0.2s" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = `${ds.color.lilac}66`;
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = ds.color.line;
              (e.currentTarget as HTMLDivElement).style.transform = "none";
            }}
          >
            {/* Preview area */}
            <div style={{ position: "relative", height: 160 }}>
              <video muted loop playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                src="/api/media/intro/hero-brave.mp4"
                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${ds.color.card}, transparent 60%)` }} />
              <span style={{ position: "absolute", top: 12, left: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: `${ds.color.lilac}cc`, color: ds.color.ink, fontWeight: 700, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Full Video
              </span>
              <span style={{ position: "absolute", top: 12, right: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 600, border: "1px solid rgba(239,68,68,0.3)", fontFamily: ds.font.mono }}>
                4 credits/scene
              </span>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: ds.color.ink, marginBottom: 8 }}>Text to Video Movie</h3>
              <p style={{ fontSize: 13, color: ds.color.mute, lineHeight: 1.6, marginBottom: 16 }}>
                Every scene generated as full video. Best quality, highest motion. For cinematic productions, action films, and premium content.
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: ds.color.lilac, fontWeight: 600 }}>Open Movie Planner</span>
                <span style={{ fontSize: 10, color: "#ef4444", fontFamily: ds.font.mono }}>Higher credits</span>
              </div>
            </div>
          </Card>
        </a>

        {/* Hybrid Movie */}
        <a href="/dashboard/hybrid-planner" style={{ textDecoration: "none" }}>
          <Card
            style={{ overflow: "hidden", padding: 0, cursor: "pointer", transition: "border-color 0.2s, transform 0.2s", border: `2px solid ${ds.color.mint}44`, position: "relative" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = `${ds.color.mint}88`;
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = `${ds.color.mint}44`;
              (e.currentTarget as HTMLDivElement).style.transform = "none";
            }}
          >
            {/* Recommended badge */}
            <div style={{ position: "absolute", top: -1, right: 20, background: ds.color.mint, color: "#000", fontSize: 10, fontWeight: 800, padding: "4px 14px", borderRadius: "0 0 10px 10px", zIndex: 10, letterSpacing: 0.5, fontFamily: ds.font.mono }}>
              RECOMMENDED — SAVE 50-75%
            </div>

            {/* Preview area */}
            <div style={{ position: "relative", height: 160 }}>
              <video muted loop playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                src="/api/media/demo/movie_hybrid_ai_demo.mp4"
                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${ds.color.card}, transparent 60%)` }} />
              <span style={{ position: "absolute", top: 12, left: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: `${ds.color.mint}cc`, color: "#000", fontWeight: 700, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Hybrid — Images + Video
              </span>
              <span style={{ position: "absolute", top: 12, right: 12, fontSize: 9, padding: "3px 10px", borderRadius: 10, background: `${ds.color.mint}18`, color: ds.color.mint, fontWeight: 600, border: `1px solid ${ds.color.mint}33`, fontFamily: ds.font.mono }}>
                1-2 credits/scene
              </span>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: ds.color.ink, marginBottom: 8 }}>
                Hybrid Movie <span style={{ fontSize: 12, color: ds.color.mint, fontWeight: 600 }}>(GHS Smart Format)</span>
              </h3>
              <p style={{ fontSize: 13, color: ds.color.mute, lineHeight: 1.6, marginBottom: 12 }}>
                Images for calm scenes + Video only for action scenes. Audio ties everything together. Same story, <strong style={{ color: ds.color.mint }}>75% less credits</strong>.
              </p>

              {/* How it works mini */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
                {[
                  { Icon: Image, label: "Images", sub: "Setup & Emotion", color: ds.color.mint },
                  { Icon: Film, label: "Video", sub: "Action Only", color: ds.color.lilac },
                  { Icon: null, label: "Audio", sub: "The Glue", color: ds.color.sky },
                ].map(({ Icon, label, sub, color }) => (
                  <div key={label} style={{ background: `${color}0a`, borderRadius: ds.radius.sm, padding: "8px 10px", textAlign: "center", border: `1px solid ${color}18` }}>
                    {Icon && <Icon size={16} style={{ color, marginBottom: 4 }} />}
                    {!Icon && <span style={{ fontSize: 16, marginBottom: 4, display: "block" }}>♪</span>}
                    <p style={{ fontSize: 9, color, fontWeight: 600, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</p>
                    <p style={{ fontSize: 8, color: ds.color.mute }}>{sub}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: ds.color.mint, fontWeight: 600 }}>Start Hybrid Movie</span>
                <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowHybridInfo(true); }}
                  style={{ fontSize: 10, color: ds.color.sky, background: "none", border: `1px solid ${ds.color.sky}44`, borderRadius: ds.radius.xs, padding: "3px 10px", cursor: "pointer", fontFamily: ds.font.sans }}>
                  Learn more
                </button>
              </div>
            </div>
          </Card>
        </a>
      </div>

      {/* ── Hybrid Explanation ── */}
      {showHybridInfo && (
        <Card style={{ marginBottom: 24, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: ds.color.ink }}>How Hybrid Movie Works</h3>
            <button onClick={() => setShowHybridInfo(false)} style={{ fontSize: 14, color: ds.color.mute, background: "none", border: "none", cursor: "pointer" }}>close</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 13, color: ds.color.ink2, lineHeight: 1.8, marginBottom: 12 }}>
                In traditional AI movie making, every scene is full video — even scenes where characters just talk. That wastes credits on scenes that don&apos;t need motion.
              </p>
              <p style={{ fontSize: 13, color: ds.color.ink2, lineHeight: 1.8 }}>
                <strong style={{ color: ds.color.mint }}>GHS Hybrid Format</strong> uses AI to decide which scenes truly need video (action, movement, impact) and which work better as images with rich narration and sound design.
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: ds.color.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: ds.font.mono }}>Cost Comparison (10-scene movie)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: ds.radius.sm, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <span style={{ fontSize: 12, color: "#ef4444" }}>Full Video (10 scenes × 4)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", fontFamily: ds.font.mono }}>40 credits</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: ds.radius.sm, background: `${ds.color.mint}0a`, border: `1px solid ${ds.color.mint}22` }}>
                  <span style={{ fontSize: 12, color: ds.color.mint }}>Hybrid (6 images + 4 videos)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: ds.color.mint, fontFamily: ds.font.mono }}>12 credits</span>
                </div>
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: ds.color.mint }}>Save 28 credits (70%)</span>
                </div>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: ds.font.mono }}>How AI decides per scene</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {[
              { type: "Image", when: "Setup, dialogue, emotion, flashback", credit: "1 credit", color: ds.color.mint },
              { type: "Video", when: "Action, fight, chase, jump, impact", credit: "4 credits", color: ds.color.lilac },
              { type: "Image→Video", when: "Intro, outro, subtle motion", credit: "2 credits", color: ds.color.gold },
              { type: "Audio Bridge", when: "Transitions, suspense, darkness", credit: "0 credits", color: ds.color.sky },
              { type: "Hybrid", when: "Calm → action, still → alive", credit: "2 credits", color: ds.color.pink },
            ].map(s => (
              <div key={s.type} style={{ background: ds.color.paper, borderRadius: ds.radius.sm, padding: "10px 12px", border: `1px solid ${s.color}20` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4, fontFamily: ds.font.mono }}>{s.type}</p>
                <p style={{ fontSize: 9, color: ds.color.mute, lineHeight: 1.4, marginBottom: 6 }}>{s.when}</p>
                <p style={{ fontSize: 10, fontWeight: 600, color: s.color, fontFamily: ds.font.mono }}>{s.credit}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Other options ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
        {[
          { href: "/dashboard/movie-planner?continue=true", Icon: Folder, label: "Continue Existing", sub: "Load saved project, resume where you left off", color: ds.color.mint },
          { href: "/dashboard/series-wizard", Icon: Film, label: "Create Series", sub: "Episodic content with recurring characters", color: ds.color.gold },
          { href: "/dashboard/character-voices", Icon: null, label: "Manage Characters", sub: "Create your cast — used across all projects", color: ds.color.pink },
        ].map(({ href, Icon, label, sub, color }) => (
          <a key={href} href={href} style={{ textDecoration: "none" }}>
            <Card style={{ cursor: "pointer", transition: "border-color 0.2s", height: "100%", padding: 24 }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color + "44"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ds.color.line; }}>
              {Icon && <Icon size={24} style={{ color, marginBottom: 10 }} />}
              {!Icon && <span style={{ fontSize: 24, display: "block", marginBottom: 10, color }}>◈</span>}
              <h3 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 6 }}>{label}</h3>
              <p style={{ fontSize: 11, color: ds.color.mute, lineHeight: 1.5 }}>{sub}</p>
            </Card>
          </a>
        ))}
      </div>

      {/* ── Sample Videos ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ds.color.mute, fontFamily: ds.font.mono }}>
            Sample productions — hover to preview
          </p>
          <span style={{ flex: 1, height: 1, background: ds.color.line }} />
        </div>

        {/* AI-generated movie images */}
        <p style={{ fontSize: 11, color: ds.color.lilac, fontWeight: 600, marginBottom: 8, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>AI-Generated Scene Images</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto" }}>
          {[
            { src: "/api/media/demo/hero_warrior.png", label: "Warrior on Cliff" },
            { src: "/api/media/demo/movie_kingdom.png", label: "Ancient Kingdom" },
            { src: "/api/media/demo/movie_warrior_face.png", label: "Warrior Close-Up" },
            { src: "/api/media/demo/movie_landscape.png", label: "Epic Landscape" },
          ].map(img => (
            <div key={img.label} style={{ flexShrink: 0, width: 200, borderRadius: ds.radius.md, overflow: "hidden", border: `1px solid ${ds.color.line}`, background: ds.color.card }}>
              <img src={img.src} alt={img.label} style={{ width: "100%", height: 110, objectFit: "cover" }} />
              <div style={{ padding: "8px 10px" }}>
                <p style={{ fontSize: 10, color: ds.color.ink, fontWeight: 500 }}>{img.label}</p>
                <p style={{ fontSize: 8, color: ds.color.mute, fontFamily: ds.font.mono }}>AI Generated (fal.ai)</p>
              </div>
            </div>
          ))}
        </div>

        {/* Hybrid samples */}
        <p style={{ fontSize: 11, color: ds.color.mint, fontWeight: 600, marginBottom: 8, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>Hybrid Format (Images + Video)</p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {[
            { src: "/api/media/demo/movie_complete_demo.mp4", title: "Warrior Epic", desc: "AI images + video + narration + music" },
            { src: "/api/media/demo/image_story_demo.mp4", title: "Image Story", desc: "Pure AI images with zoom" },
            { src: "/api/media/intro/demo-property.mp4", title: "Property Tour", desc: "Full video walkthrough" },
          ].map(v => (
            <div key={v.title} style={{ flexShrink: 0, width: 200, borderRadius: ds.radius.md, overflow: "hidden", border: `1px solid ${ds.color.mint}22`, background: ds.color.card, cursor: "pointer" }}>
              <div style={{ position: "relative", height: 120 }}>
                <video src={v.src} muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <span style={{ color: ds.color.ink, fontSize: 14, marginLeft: 2 }}>▶</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 12, color: ds.color.ink, fontWeight: 600 }}>{v.title}</p>
                <p style={{ fontSize: 9, color: ds.color.mute }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Full video samples */}
        <p style={{ fontSize: 11, color: ds.color.lilac, fontWeight: 600, marginBottom: 8, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>Full Video Format</p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { src: "/api/media/intro/hero-brave.mp4", title: "Cinematic Action", desc: "Full motion, every frame" },
            { src: "/api/media/intro/demo-story-mode.mp4", title: "Story Mode", desc: "Narrative-driven video" },
            { src: "/api/media/intro/hero-maintain.mp4", title: "Epic Scene", desc: "Premium cinematic" },
            { src: "/api/media/intro/demo-short-reel.mp4", title: "Short Film", desc: "Quick story video" },
          ].map(v => (
            <div key={v.title} style={{ flexShrink: 0, width: 200, borderRadius: ds.radius.md, overflow: "hidden", border: `1px solid ${ds.color.line}`, background: ds.color.card, cursor: "pointer" }}>
              <div style={{ position: "relative", height: 120 }}>
                <video src={v.src} muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <span style={{ color: ds.color.ink, fontSize: 14, marginLeft: 2 }}>▶</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 12, color: ds.color.ink, fontWeight: 600 }}>{v.title}</p>
                <p style={{ fontSize: 9, color: ds.color.mute }}>{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
