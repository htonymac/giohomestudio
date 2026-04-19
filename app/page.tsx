"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// ── Design: "Deep Studio" ─────────────────────────────────────────────────────
// Dark charcoal base, animated gradient orbs, indigo/violet accent.
// CSS entrance animations. No gold. No flat Claude purple.

const DEMO_VIDEOS = [
  { src: "/api/media/demo/movie_complete_demo.mp4",  label: "Hybrid Movie",     desc: "AI images + video + narration + music",    mode: "hybrid" },
  { src: "/api/media/intro/hero-brave.mp4",          label: "Full Video Movie",  desc: "Cinematic scenes from a text prompt",      mode: "text_to_video" },
  { src: "/api/media/demo/children_final_demo.mp4",  label: "Children Story",    desc: "Story + narration + text overlay + music", mode: "text_to_video" },
  { src: "/api/media/intro/demo-commercial-oj.mp4",  label: "Commercial",        desc: "Product promo with AI narration & music",  mode: "text_to_video" },
  { src: "/api/media/demo/image_story_demo.mp4",     label: "Image Slideshow",   desc: "Photos + Ken Burns motion + voice",        mode: "images_audio" },
  { src: "/api/media/intro/demo-property.mp4",       label: "Property Showcase", desc: "Real estate promo with overlays & voice",  mode: "text_to_video" },
];

const MODES = [
  { icon: "✦", label: "Text → Video",  desc: "Describe it, AI films it",      href: "/dashboard/free-mode?mode=text_to_video" },
  { icon: "◈", label: "Text → Image",  desc: "Instant AI images from words",   href: "/dashboard/free-mode?mode=text_to_image" },
  { icon: "▷", label: "Image → Video", desc: "Bring any photo to life",        href: "/dashboard/free-mode?mode=image_to_video" },
  { icon: "⬡", label: "AI Motion",     desc: "Character-driven motion video",  href: "/dashboard/free-mode?mode=ai_motion" },
  { icon: "⚡", label: "Hybrid",        desc: "AI picks scenes vs images",      href: "/dashboard/hybrid-planner" },
  { icon: "◉", label: "Audio",         desc: "Voiceover + music, no video",    href: "/dashboard/free-mode?mode=text_to_audio" },
];

const FEATURES = [
  { icon: "✦", title: "8 Creation Modes",        desc: "Free, Hybrid, Movie, Series, Commercial, Children, AI Motion, Audio" },
  { icon: "◉", title: "AI Voices",               desc: "ElevenLabs, Cartesia, Piper — 100+ voices in 30+ languages" },
  { icon: "♪", title: "Music Studio",            desc: "AI music, stock library, SFX, beat mixing — all built in" },
  { icon: "◧", title: "Analytics & A/B Testing", desc: "Track what works. Test title, thumbnail, and caption variants" },
  { icon: "▤", title: "Content Calendar",         desc: "Plan and schedule content across every platform at once" },
  { icon: "↑", title: "Multi-Platform Publish",   desc: "YouTube, Instagram, TikTok, Facebook, Telegram" },
  { icon: "⬡", title: "Story AI Planners",        desc: "Hybrid, Movie, Series, Commercial, Children — deep control" },
  { icon: "↺", title: "Full Pipeline",            desc: "Generate → Review → Approve → Publish → Track → Learn" },
];

// Brand gradient — matches "G" icon: purple → pink → orange
const GRAD = "linear-gradient(135deg, #8b5cf6 0%, #ec4899 48%, #f97316 100%)";
const GRAD_GLOW = "rgba(236,72,153,0.45)";

const D = {
  bg:       "#0d1117",
  bgLight:  "#111520",
  surfSolid:"#141921",
  border:   "#1c2333",
  borderHi: "#263347",
  violet:   "#8b5cf6",
  violet2:  "#c084fc",
  indigo:   "#6366f1",
  white:    "#e6eaf2",
  sub:      "#7c8fa8",
  muted:    "#394860",
};

export default function HomePage() {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ background: D.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: D.white, overflowX: "hidden" }}>

      {/* ── Animated background orbs ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-10%", left: "-5%",
          width: 700, height: 700, borderRadius: "50%",
          background: `radial-gradient(circle, ${D.violet}18 0%, transparent 65%)`,
          animation: "floatOrb 18s ease-in-out infinite",
          filter: "blur(1px)",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", right: "-10%",
          width: 600, height: 600, borderRadius: "50%",
          background: `radial-gradient(circle, ${D.indigo}12 0%, transparent 65%)`,
          animation: "floatOrb 22s ease-in-out infinite reverse",
          filter: "blur(1px)",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "40%",
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${D.violet2}08 0%, transparent 70%)`,
          animation: "floatOrb 14s ease-in-out infinite 4s",
        }} />
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.035,
          backgroundImage: `linear-gradient(${D.borderHi} 1px, transparent 1px), linear-gradient(90deg, ${D.borderHi} 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
        }} />
      </div>

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 40px",
        background: `${D.bg}e0`, backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: GRAD,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: "#fff", fontWeight: 900,
            boxShadow: "0 4px 16px rgba(124,58,237,0.45)",
          }}>G</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.white, letterSpacing: -0.3, lineHeight: 1.2 }}>GioHomeStudio</div>
            <div style={{ fontSize: 11, color: D.sub, fontWeight: 400, letterSpacing: 0.1 }}>Content Studio</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/dashboard" style={{
            padding: "7px 16px", borderRadius: 8,
            border: `1px solid ${D.border}`, color: D.sub,
            fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}>Sign In</Link>
          <Link href="/dashboard/free-mode" style={{
            padding: "8px 20px", borderRadius: 8,
            background: GRAD,
            color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none",
            boxShadow: `0 4px 20px ${GRAD_GLOW}`,
          }}>Start Free →</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "100vh", paddingTop: 58, zIndex: 1 }}>

        {/* Background video */}
        <div style={{ position: "absolute", inset: 0 }}>
          <video
            src="/api/media/intro/hero-brave.mp4"
            autoPlay muted loop playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.28 }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom,
              ${D.bg}70 0%, transparent 18%, transparent 52%, ${D.bg}bb 78%, ${D.bg} 100%
            )`,
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to right, ${D.bg}f5 0%, ${D.bg}85 38%, transparent 68%)`,
          }} />
        </div>

        <div style={{
          position: "relative", zIndex: 10,
          maxWidth: 1200, margin: "0 auto",
          padding: "28px 40px 60px",
          display: "flex", flexDirection: "column", alignItems: "flex-start",
        }}>
          {/* Live badge — animated pulse ring */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: `${D.violet}12`, border: `1px solid ${D.violet}40`,
            borderRadius: 100, padding: "7px 18px", marginBottom: 36,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: D.violet, display: "block" }} />
              <span style={{
                position: "absolute", width: 8, height: 8, borderRadius: "50%",
                background: D.violet, opacity: 0.4,
                animation: "pulseRing 2s ease-out infinite",
              }} />
            </span>
            <span style={{ fontSize: 12, color: D.violet2, fontWeight: 700, letterSpacing: 0.4 }}>AI Content Studio — Live</span>
          </div>

          {/* Headline lines with staggered entrance */}
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 900,
            color: D.white, margin: "0 0 6px",
            lineHeight: 1.0, letterSpacing: -2.5, maxWidth: 720,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
          }}>
            Make AI Videos
          </h1>
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 900,
            background: `linear-gradient(100deg, ${D.violet2} 0%, ${D.indigo} 60%, #a5b4fc 100%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            margin: "0 0 30px", lineHeight: 1.0, letterSpacing: -2.5,
            animation: "gradShift 5s ease-in-out infinite alternate",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease 0.22s, transform 0.7s ease 0.22s",
          }}>
            That Actually Work.
          </h1>

          <p style={{
            fontSize: "clamp(15px, 2vw, 18px)", color: D.sub, maxWidth: 520,
            margin: "0 0 10px", lineHeight: 1.65,
            opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.35s",
          }}>
            Type an idea. GioHomeStudio writes the script, generates video, voice, and music — then routes it to your channels.
          </p>
          <p style={{
            fontSize: 13, color: D.muted, maxWidth: 460, margin: "0 0 48px", lineHeight: 1.6,
            opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.45s",
          }}>
            Plan → Generate → Review → Approve → Publish → Track. The full creative pipeline in one system.
          </p>

          {/* CTAs */}
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap",
            opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.55s",
          }}>
            <Link href="/dashboard/free-mode" style={{
              padding: "15px 36px", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none",
              background: GRAD,
              color: "#fff",
              boxShadow: `0 8px 36px ${GRAD_GLOW}`,
              letterSpacing: -0.3,
              position: "relative", overflow: "hidden",
            }}>
              <span style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 55%, transparent 70%)`,
                animation: "shimmer 3s ease-in-out infinite",
              }} />
              Start Creating Free
            </Link>
            <Link href="/dashboard/hybrid-planner" style={{
              padding: "15px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none",
              border: `1px solid ${D.borderHi}`, color: D.sub,
            }}>
              Explore Planners →
            </Link>
          </div>

          {/* Mode chips */}
          <div style={{
            display: "flex", gap: 8, marginTop: 48, flexWrap: "wrap",
            opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.65s",
          }}>
            {MODES.map((m, i) => (
              <Link key={m.label} href={m.href} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 14px", borderRadius: 100,
                background: `${D.border}90`, border: `1px solid ${D.border}`,
                color: D.sub, fontSize: 12, fontWeight: 600, textDecoration: "none",
                transition: "all 0.2s",
                animationDelay: `${i * 60}ms`,
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = `${D.violet}80`;
                  (e.currentTarget as HTMLAnchorElement).style.color = D.violet2;
                  (e.currentTarget as HTMLAnchorElement).style.background = `${D.violet}12`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = D.border;
                  (e.currentTarget as HTMLAnchorElement).style.color = D.sub;
                  (e.currentTarget as HTMLAnchorElement).style.background = `${D.border}90`;
                }}>
                <span style={{ fontSize: 11 }}>{m.icon}</span>
                {m.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Videos ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 100px", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: D.violet2, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
            Real Outputs
          </p>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 800, color: D.white, margin: "0 0 8px", letterSpacing: -1 }}>
            See what GioHomeStudio makes
          </h2>
          <p style={{ fontSize: 13, color: D.muted }}>Hover to play — click to make your own version</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {DEMO_VIDEOS.map((v, i) => (
            <Link key={v.label} href={`/dashboard/free-mode?mode=${v.mode}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  position: "relative", borderRadius: 14, overflow: "hidden",
                  border: `1px solid ${activeVideo === i ? D.violet + "70" : D.border}`,
                  transition: "all 0.25s",
                  transform: activeVideo === i ? "translateY(-4px)" : "none",
                  boxShadow: activeVideo === i ? `0 16px 48px ${D.violet}25, 0 0 0 1px ${D.violet}20` : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setActiveVideo(i)}
                onMouseLeave={() => setActiveVideo(null)}
              >
                <video
                  src={v.src} muted loop playsInline
                  style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", display: "block" }}
                  ref={el => {
                    if (!el) return;
                    activeVideo === i ? el.play().catch(() => {}) : (el.pause(), el.currentTime = 0);
                  }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />
                {activeVideo !== i && (
                  <div style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    width: 44, height: 44, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${D.violet}cc, ${D.indigo}cc)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 4px 20px ${D.violet}50`,
                  }}>
                    <span style={{ color: "#fff", fontSize: 15, marginLeft: 3, fontWeight: 900 }}>▶</span>
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 14px 12px" }}>
                  <p style={{ color: D.white, fontSize: 13, fontWeight: 700, margin: "0 0 3px", letterSpacing: -0.2 }}>{v.label}</p>
                  <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 11, margin: 0 }}>{v.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Mode Selector ── */}
      <section style={{
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
        padding: "80px 40px",
        background: D.bgLight,
        position: "relative", zIndex: 1,
      }}>
        {/* Subtle top gradient line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${D.violet}60 50%, transparent 100%)` }} />
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 44 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: D.violet2, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Choose your mode</p>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: D.white, margin: "0 0 8px", letterSpacing: -1 }}>What will you create today?</h2>
            <p style={{ fontSize: 14, color: D.sub }}>Pick any mode and start instantly — no setup required</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {MODES.map(m => (
              <Link key={m.label} href={m.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    padding: "20px", borderRadius: 12,
                    background: `${D.surfSolid}cc`, border: `1px solid ${D.border}`,
                    display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${D.violet}60`;
                    (e.currentTarget as HTMLDivElement).style.background = `${D.violet}0c`;
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${D.violet}18`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = D.border;
                    (e.currentTarget as HTMLDivElement).style.background = `${D.surfSolid}cc`;
                    (e.currentTarget as HTMLDivElement).style.transform = "none";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${D.violet}20, ${D.indigo}15)`,
                    border: `1px solid ${D.violet}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                    background2: `${D.violet2}`,
                  } as React.CSSProperties}>
                    <span style={{ background: `linear-gradient(135deg, ${D.violet2}, ${D.indigo})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 }}>{m.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: D.white, fontSize: 14, fontWeight: 700, margin: "0 0 3px", letterSpacing: -0.2 }}>{m.label}</p>
                    <p style={{ color: D.sub, fontSize: 12, margin: 0 }}>{m.desc}</p>
                  </div>
                  <span style={{ color: D.violet2, fontSize: 14, opacity: 0.5 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${D.violet}60 50%, transparent 100%)` }} />
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 54 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: D.violet2, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Everything Built In</p>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: D.white, margin: "0 0 10px", letterSpacing: -1 }}>One system. Full pipeline.</h2>
          <p style={{ fontSize: 14, color: D.sub, maxWidth: 480 }}>From idea to published video — every tool is already here, nothing to bolt on.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {FEATURES.map(f => (
            <div key={f.title}
              style={{
                padding: "22px 18px", borderRadius: 12,
                background: `${D.surfSolid}cc`, border: `1px solid ${D.border}`,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${D.violet}45`;
                (e.currentTarget as HTMLDivElement).style.background = `${D.violet}08`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = D.border;
                (e.currentTarget as HTMLDivElement).style.background = `${D.surfSolid}cc`;
              }}
            >
              <div style={{
                fontSize: 20, marginBottom: 10, fontWeight: 800,
                background: `linear-gradient(135deg, ${D.violet2}, ${D.indigo})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>{f.icon}</div>
              <p style={{ color: D.white, fontSize: 13, fontWeight: 700, margin: "0 0 6px", letterSpacing: -0.2 }}>{f.title}</p>
              <p style={{ color: D.sub, fontSize: 11, lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ margin: "0 40px 100px", position: "relative", zIndex: 1 }}>
        <div style={{
          position: "relative", overflow: "hidden",
          background: D.bgLight,
          border: `1px solid ${D.border}`,
          borderRadius: 20, padding: "70px 60px",
          textAlign: "center",
        }}>
          {/* Animated gradient orb inside banner */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 600, height: 300,
            background: `radial-gradient(ellipse, ${D.violet}14 0%, ${D.indigo}08 40%, transparent 70%)`,
            pointerEvents: "none",
            animation: "pulseOrb 6s ease-in-out infinite",
          }} />
          {/* Top + bottom gradient lines */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 5%, ${D.violet}70 50%, transparent 95%)` }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 5%, ${D.violet}50 50%, transparent 95%)` }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: D.violet2, letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>Ready?</p>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: D.white, margin: "0 0 14px", letterSpacing: -1.5 }}>
              Make your first video today.
            </h2>
            <p style={{ fontSize: 15, color: D.sub, margin: "0 0 40px" }}>
              No credit card. No setup. Start free and upgrade when you need more.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/dashboard/free-mode" style={{
                padding: "16px 40px", borderRadius: 10, fontWeight: 800, fontSize: 16, textDecoration: "none",
                background: GRAD,
                color: "#fff",
                boxShadow: `0 8px 40px ${GRAD_GLOW}`,
                letterSpacing: -0.3,
                position: "relative", overflow: "hidden",
              }}>
                <span style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.14) 50%, transparent 65%)`,
                  animation: "shimmer 3s ease-in-out infinite",
                }} />
                Start Creating — It{"'"}s Free
              </Link>
              <Link href="/dashboard" style={{
                padding: "16px 28px", borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: "none",
                border: `1px solid ${D.borderHi}`, color: D.sub,
              }}>
                Open Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${D.border}`,
        padding: "28px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 1,
      }}>
        <span style={{ fontSize: 12, color: D.muted }}>© 2025 GioHomeStudio. All rights reserved.</span>
        <div style={{ display: "flex", gap: 20 }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <span key={l} style={{ fontSize: 12, color: D.muted, cursor: "pointer" }}>{l}</span>
          ))}
        </div>
      </footer>

      {/* ── Animations ── */}
      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -40px) scale(1.05); }
          66%       { transform: translate(-20px, 20px) scale(0.96); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes gradShift {
          0%   { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(20deg); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-120%); }
          60%  { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes pulseOrb {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 1;   transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
