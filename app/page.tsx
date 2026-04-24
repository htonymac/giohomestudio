"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ds } from "../lib/designSystem";

// Brand gradient — matches the hero GTA purple→orange
const GRAD      = ds.grad.hero;
const GRAD_SIZE = ds.grad.heroSize;
const GRAD_GLOW = "rgba(209,123,255,0.45)";

const DEMO_VIDEOS = [
  { src: "/api/media/demo/movie_complete_demo.mp4",  label: "Hybrid Movie",     desc: "AI images + video + narration + music",    mode: "hybrid"        },
  { src: "/api/media/intro/hero-brave.mp4",          label: "Full Video Movie",  desc: "Cinematic scenes from a text prompt",      mode: "text_to_video" },
  { src: "/api/media/demo/children_final_demo.mp4",  label: "Children Story",    desc: "Story + narration + text overlay + music", mode: "text_to_video" },
  { src: "/api/media/intro/demo-commercial-oj.mp4",  label: "Commercial",        desc: "Product promo with AI narration & music",  mode: "text_to_video" },
  { src: "/api/media/demo/image_story_demo.mp4",     label: "Image Slideshow",   desc: "Photos + Ken Burns motion + voice",        mode: "images_audio"  },
  { src: "/api/media/intro/demo-property.mp4",       label: "Property Showcase", desc: "Real estate promo with overlays & voice",  mode: "text_to_video" },
];

const MODES = [
  { icon: "->", label: "Text to Video",  desc: "Describe it, AI films it",      href: "/dashboard/free-mode?mode=text_to_video" },
  { icon: "->", label: "Text to Image",  desc: "Instant AI images from words",   href: "/dashboard/free-mode?mode=text_to_image" },
  { icon: "->", label: "Image to Video", desc: "Bring any photo to life",        href: "/dashboard/free-mode?mode=image_to_video" },
  { icon: "->", label: "AI Motion",      desc: "Character-driven motion video",  href: "/dashboard/free-mode?mode=ai_motion" },
  { icon: "->", label: "Hybrid",         desc: "AI picks scenes vs images",      href: "/dashboard/hybrid-planner" },
  { icon: "->", label: "Audio",          desc: "Voiceover + music, no video",    href: "/dashboard/free-mode?mode=text_to_audio" },
];

const FEATURES = [
  { label: "8 Creation Modes",        desc: "Free, Hybrid, Movie, Series, Commercial, Children, AI Motion, Audio" },
  { label: "AI Voices",               desc: "ElevenLabs, Cartesia, Piper — 100+ voices in 30+ languages" },
  { label: "Music Studio",            desc: "AI music, stock library, SFX, beat mixing — all built in" },
  { label: "Analytics & A/B Testing", desc: "Track what works. Test title, thumbnail, and caption variants" },
  { label: "Content Calendar",        desc: "Plan and schedule content across every platform at once" },
  { label: "Multi-Platform Publish",  desc: "YouTube, Instagram, TikTok, Facebook, Telegram" },
  { label: "Story AI Planners",       desc: "Hybrid, Movie, Series, Commercial, Children — deep control" },
  { label: "Full Pipeline",           desc: "Generate → Review → Approve → Publish → Track → Learn" },
];

export default function HomePage() {
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Shared surface style
  const surfaceCard: React.CSSProperties = {
    background: ds.color.card, border: `1px solid ${ds.color.line}`,
  };

  return (
    <div style={{ background: ds.color.paper, minHeight: "100vh", fontFamily: ds.font.sans, color: ds.color.ink, overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 40px",
        background: `${ds.color.paper}e8`,
        borderBottom: `1px solid ${ds.color.line}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Brand dot */}
          <div style={{
            width: 32, height: 32, borderRadius: ds.radius.sm,
            background: ds.grad.brandDot,
            boxShadow: `0 4px 16px rgba(167,139,250,0.45)`,
            animation: "spin 9s linear infinite",
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ds.color.ink, letterSpacing: -0.3, lineHeight: 1.2 }}>GioHomeStudio</div>
            <div style={{ fontSize: 11, color: ds.color.mute, fontWeight: 400 }}>Content Studio</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/dashboard" style={{
            padding: "7px 16px", borderRadius: ds.radius.sm,
            border: `1px solid ${ds.color.line2}`, color: ds.color.mute,
            fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}>Sign In</Link>
          <Link href="/dashboard/free-mode" style={{
            padding: "8px 20px", borderRadius: ds.radius.sm,
            background: GRAD, backgroundSize: GRAD_SIZE,
            animation: "btnSweep 6s linear infinite",
            color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none",
            boxShadow: `0 4px 20px ${GRAD_GLOW}`,
          }}>Start Free</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "100vh", paddingTop: 58, zIndex: 1 }}>

        {/* Background video */}
        <div style={{ position: "absolute", inset: 0 }}>
          <video
            src="/api/media/intro/hero-brave.mp4"
            autoPlay muted loop playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, ${ds.color.paper}70 0%, transparent 18%, transparent 52%, ${ds.color.paper}bb 78%, ${ds.color.paper} 100%)`,
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to right, ${ds.color.paper}f5 0%, ${ds.color.paper}85 38%, transparent 68%)`,
          }} />
        </div>

        <div style={{
          position: "relative", zIndex: 10,
          maxWidth: 1200, margin: "0 auto",
          padding: "28px 40px 60px",
          display: "flex", flexDirection: "column", alignItems: "flex-start",
        }}>
          {/* Live badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: `${ds.color.lilac}12`, border: `1px solid ${ds.color.lilac}40`,
            borderRadius: ds.radius.pill, padding: "7px 18px", marginBottom: 36,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ds.color.lilac, display: "block" }} />
              <span style={{
                position: "absolute", width: 8, height: 8, borderRadius: "50%",
                background: ds.color.lilac, opacity: 0.4,
                animation: "pulseRing 2s ease-out infinite",
              }} />
            </span>
            <span style={{ fontSize: 12, color: ds.color.btnB, fontWeight: 700, letterSpacing: 0.4, fontFamily: ds.font.mono }}>
              AI CONTENT STUDIO — LIVE
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 900,
            color: ds.color.ink, margin: "0 0 6px",
            lineHeight: 1.0, letterSpacing: -2.5, maxWidth: 720,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
          }}>
            Make AI Videos
          </h1>
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 900,
            fontFamily: ds.font.serif, fontStyle: "italic",
            background: GRAD, backgroundSize: GRAD_SIZE,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "btnSweep 6s linear infinite",
            margin: "0 0 30px", lineHeight: 1.0, letterSpacing: -2.5,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease 0.22s, transform 0.7s ease 0.22s",
          }}>
            That Actually Work.
          </h1>

          <p style={{
            fontSize: "clamp(15px, 2vw, 18px)", color: ds.color.ink2, maxWidth: 520,
            margin: "0 0 10px", lineHeight: 1.65,
            opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.35s",
          }}>
            Type an idea. GioHomeStudio writes the script, generates video, voice, and music — then routes it to your channels.
          </p>
          <p style={{
            fontSize: 13, color: ds.color.mute, maxWidth: 460, margin: "0 0 48px", lineHeight: 1.6,
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
              padding: "15px 36px", borderRadius: ds.radius.md, fontWeight: 800, fontSize: 15, textDecoration: "none",
              background: GRAD, backgroundSize: GRAD_SIZE,
              animation: "btnSweep 6s linear infinite",
              color: "#fff",
              boxShadow: `0 8px 36px ${GRAD_GLOW}`,
              letterSpacing: -0.3,
              position: "relative", overflow: "hidden",
              display: "inline-block",
            }}>
              Start Creating Free
            </Link>
            <Link href="/dashboard/hybrid-planner" style={{
              padding: "15px 28px", borderRadius: ds.radius.md, fontWeight: 600, fontSize: 14, textDecoration: "none",
              border: `1px solid ${ds.color.line2}`, color: ds.color.mute,
            }}>
              Explore Planners
            </Link>
          </div>

          {/* Mode chips */}
          <div style={{
            display: "flex", gap: 8, marginTop: 48, flexWrap: "wrap",
            opacity: mounted ? 1 : 0, transition: "opacity 0.7s ease 0.65s",
          }}>
            {MODES.map((m) => (
              <Link key={m.label} href={m.href} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 14px", borderRadius: ds.radius.pill,
                background: ds.color.card, border: `1px solid ${ds.color.line}`,
                color: ds.color.mute, fontSize: 12, fontWeight: 600, textDecoration: "none",
                transition: "all 0.2s",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = `${ds.color.lilac}80`;
                  (e.currentTarget as HTMLAnchorElement).style.color = ds.color.btnB;
                  (e.currentTarget as HTMLAnchorElement).style.background = `${ds.color.lilac}12`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = ds.color.line;
                  (e.currentTarget as HTMLAnchorElement).style.color = ds.color.mute;
                  (e.currentTarget as HTMLAnchorElement).style.background = ds.color.card;
                }}>
                {m.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Videos ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 100px", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: ds.color.btnB, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8, fontFamily: ds.font.mono }}>
            Real Outputs
          </p>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 800, color: ds.color.ink, margin: "0 0 8px", letterSpacing: -1 }}>
            See what GioHomeStudio makes
          </h2>
          <p style={{ fontSize: 13, color: ds.color.mute }}>Hover to play — click to make your own version</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {DEMO_VIDEOS.map((v, i) => (
            <Link key={v.label} href={`/dashboard/free-mode?mode=${v.mode}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  position: "relative", borderRadius: ds.radius.md, overflow: "hidden",
                  border: `1px solid ${activeVideo === i ? ds.color.lilac + "70" : ds.color.line}`,
                  transition: "all 0.25s",
                  transform: activeVideo === i ? "translateY(-4px)" : "none",
                  boxShadow: activeVideo === i ? `0 16px 48px ${ds.color.lilac}25, 0 0 0 1px ${ds.color.lilac}20` : "none",
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
                    background: `linear-gradient(135deg, ${ds.color.lilac}cc, ${ds.color.blue}cc)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 4px 20px ${ds.color.lilac}50`,
                  }}>
                    <span style={{ color: "#fff", fontSize: 15, marginLeft: 3, fontWeight: 900 }}>▶</span>
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 14px 12px" }}>
                  <p style={{ color: ds.color.ink, fontSize: 13, fontWeight: 700, margin: "0 0 3px", letterSpacing: -0.2 }}>{v.label}</p>
                  <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 11, margin: 0 }}>{v.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Mode Selector ── */}
      <section style={{
        borderTop: `1px solid ${ds.color.line}`,
        borderBottom: `1px solid ${ds.color.line}`,
        padding: "80px 40px",
        background: ds.color.sidebar,
        position: "relative", zIndex: 1,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${ds.color.lilac}60 50%, transparent 100%)` }} />
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 44 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: ds.color.btnB, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8, fontFamily: ds.font.mono }}>Choose your mode</p>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: ds.color.ink, margin: "0 0 8px", letterSpacing: -1 }}>What will you create today?</h2>
            <p style={{ fontSize: 14, color: ds.color.mute }}>Pick any mode and start instantly — no setup required</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {MODES.map(m => (
              <Link key={m.label} href={m.href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    padding: "20px", borderRadius: ds.radius.md,
                    background: ds.color.card, border: `1px solid ${ds.color.line}`,
                    display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${ds.color.lilac}60`;
                    (e.currentTarget as HTMLDivElement).style.background = `${ds.color.lilac}0c`;
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = ds.shadow.lift;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = ds.color.line;
                    (e.currentTarget as HTMLDivElement).style.background = ds.color.card;
                    (e.currentTarget as HTMLDivElement).style.transform = "none";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: ds.radius.sm, flexShrink: 0,
                    background: `linear-gradient(135deg, ${ds.color.lilac}20, ${ds.color.blue}15)`,
                    border: `1px solid ${ds.color.lilac}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{
                      background: `linear-gradient(135deg, ${ds.color.btnB}, ${ds.color.blue})`,
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      fontWeight: 900, fontSize: 13, fontFamily: ds.font.mono,
                    }}>-&gt;</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: ds.color.ink, fontSize: 14, fontWeight: 700, margin: "0 0 3px", letterSpacing: -0.2 }}>{m.label}</p>
                    <p style={{ color: ds.color.mute, fontSize: 12, margin: 0 }}>{m.desc}</p>
                  </div>
                  <span style={{ color: ds.color.btnB, fontSize: 14, opacity: 0.5 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${ds.color.lilac}60 50%, transparent 100%)` }} />
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 54 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: ds.color.btnB, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8, fontFamily: ds.font.mono }}>Everything Built In</p>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: ds.color.ink, margin: "0 0 10px", letterSpacing: -1 }}>One system. Full pipeline.</h2>
          <p style={{ fontSize: 14, color: ds.color.mute, maxWidth: 480 }}>From idea to published video — every tool is already here, nothing to bolt on.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {FEATURES.map(f => (
            <div key={f.label}
              style={{
                padding: "22px 18px", borderRadius: ds.radius.md,
                background: ds.color.card, border: `1px solid ${ds.color.line}`,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${ds.color.lilac}45`;
                (e.currentTarget as HTMLDivElement).style.background = `${ds.color.lilac}08`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = ds.color.line;
                (e.currentTarget as HTMLDivElement).style.background = ds.color.card;
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: ds.radius.xs, marginBottom: 12,
                background: ds.grad.hero, backgroundSize: ds.grad.heroSize,
                animation: "btnSweep 6s linear infinite",
              }} />
              <p style={{ color: ds.color.ink, fontSize: 13, fontWeight: 700, margin: "0 0 6px", letterSpacing: -0.2 }}>{f.label}</p>
              <p style={{ color: ds.color.mute, fontSize: 11, lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ margin: "0 40px 100px", position: "relative", zIndex: 1 }}>
        <div style={{
          position: "relative", overflow: "hidden",
          background: ds.color.sidebar,
          border: `1px solid ${ds.color.line}`,
          borderRadius: ds.radius.xl, padding: "70px 60px",
          textAlign: "center",
        }}>
          {/* Top + bottom gradient lines */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 5%, ${ds.color.lilac}70 50%, transparent 95%)` }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 5%, ${ds.color.lilac}50 50%, transparent 95%)` }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: ds.color.btnB, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16, fontFamily: ds.font.mono }}>Ready?</p>
            <h2 style={{ fontSize: 40, fontWeight: 900, color: ds.color.ink, margin: "0 0 14px", letterSpacing: -1.5 }}>
              Make your first video today.
            </h2>
            <p style={{ fontSize: 15, color: ds.color.mute, margin: "0 0 40px" }}>
              No credit card. No setup. Start free and upgrade when you need more.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/dashboard/free-mode" style={{
                padding: "16px 40px", borderRadius: ds.radius.md, fontWeight: 800, fontSize: 16, textDecoration: "none",
                background: GRAD, backgroundSize: GRAD_SIZE,
                animation: "btnSweep 6s linear infinite",
                color: "#fff",
                boxShadow: `0 8px 40px ${GRAD_GLOW}`,
                letterSpacing: -0.3,
                position: "relative", overflow: "hidden",
                display: "inline-block",
              }}>
                Start Creating — It{"'"}s Free
              </Link>
              <Link href="/dashboard" style={{
                padding: "16px 28px", borderRadius: ds.radius.md, fontWeight: 600, fontSize: 15, textDecoration: "none",
                border: `1px solid ${ds.color.line2}`, color: ds.color.mute,
              }}>
                Open Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${ds.color.line}`,
        padding: "28px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 1,
      }}>
        <span style={{ fontSize: 12, color: ds.color.mute2 }}>2025 GioHomeStudio. All rights reserved.</span>
        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "Privacy", href: "/privacy" },
            { label: "Terms",   href: "/terms" },
          ].map(l => (
            <Link key={l.label} href={l.href} style={{ fontSize: 12, color: ds.color.mute2, textDecoration: "none" }}>{l.label}</Link>
          ))}
        </div>
      </footer>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes pulseRing {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes btnSweep {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
