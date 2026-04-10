"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS AI Children Video — Dedicated child-safe content creation
//
// Two branches: Children Video (animated/active) + Children Hybrid (storybook/read-along)
// Strictly supervised: 2 review checkpoints, child-safe planner
// Features: multi-language pairs, age-auto-config, curriculum templates,
//   learning progress, repetition engine, interactive pauses
// ═══════════════════════════════════════════════════════════════════════════

const AGE_GROUPS = [
  { id: "toddler", label: "Toddlers", age: "2-3 years", config: { wordLevel: "single", pacing: "very slow", fontSize: "extra large", musicEnergy: "very soft" } },
  { id: "preschool", label: "Pre-school", age: "3-5 years", config: { wordLevel: "simple", pacing: "slow", fontSize: "large", musicEnergy: "soft" } },
  { id: "early", label: "Early School", age: "5-8 years", config: { wordLevel: "basic sentences", pacing: "moderate", fontSize: "large", musicEnergy: "playful" } },
  { id: "older", label: "Older Kids", age: "8-12 years", config: { wordLevel: "paragraphs", pacing: "normal", fontSize: "medium", musicEnergy: "active" } },
];

const CONTENT_TYPES = [
  { id: "abc", label: "ABC / Alphabet", icon: "🔤", desc: "Learn letters and their sounds" },
  { id: "phonics", label: "Phonics", icon: "🗣", desc: "Letter sounds and blending" },
  { id: "words", label: "Word Learning", icon: "📝", desc: "Simple words with images" },
  { id: "3letter", label: "3-Letter Words", icon: "🧩", desc: "CVC words: cat, sat, ram" },
  { id: "word-family", label: "Word Families", icon: "👨‍👩‍👧", desc: "cat/bat/hat, ram/jam/ham" },
  { id: "counting", label: "Counting", icon: "🔢", desc: "Numbers and counting" },
  { id: "shapes", label: "Shapes & Colors", icon: "🌈", desc: "Learn shapes and colors" },
  { id: "storybook", label: "Storybook", icon: "📖", desc: "Read-along illustrated story" },
  { id: "poem", label: "Poem / Rhyme", icon: "🎵", desc: "Children poems and rhymes" },
  { id: "nursery", label: "Nursery Rhyme", icon: "🌙", desc: "Classic nursery songs" },
  { id: "movie", label: "Children Movie", icon: "🎬", desc: "Mini animated story" },
  { id: "lesson", label: "Educational Lesson", icon: "🎓", desc: "Any topic, any subject" },
];

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "pt", label: "Portuguese", flag: "🇧🇷" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "zh", label: "Mandarin", flag: "🇨🇳" },
  { code: "yo", label: "Yoruba", flag: "🇳🇬" },
  { code: "ig", label: "Igbo", flag: "🇳🇬" },
  { code: "ha", label: "Hausa", flag: "🇳🇬" },
  { code: "tw", label: "Twi", flag: "🇬🇭" },
  { code: "sw", label: "Swahili", flag: "🇰🇪" },
  { code: "zu", label: "Zulu", flag: "🇿🇦" },
  { code: "am", label: "Amharic", flag: "🇪🇹" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
];

const CURRICULUM_TEMPLATES = [
  { id: "read30", label: "Learn to Read in 30 Days", episodes: 30, desc: "Progressive reading: letters → words → sentences" },
  { id: "abc5", label: "Alphabet in 5 Songs", episodes: 5, desc: "Sing and learn A-Z with music" },
  { id: "numbers10", label: "Numbers 1-100 in 10 Episodes", episodes: 10, desc: "Counting mastery step by step" },
  { id: "phonics20", label: "Phonics in 20 Lessons", episodes: 20, desc: "Complete phonics foundation" },
  { id: "bilingual15", label: "Bilingual Words in 15 Episodes", episodes: 15, desc: "Learn 150 words in two languages" },
];

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const childAccent = "#a855f7";
const childSafe = "#22c55e";

export default function ChildrenVideoPage() {
  const [branch, setBranch] = useState<"" | "video" | "hybrid">("");
  const [contentType, setContentType] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [primaryLang, setPrimaryLang] = useState("en");
  const [secondLang, setSecondLang] = useState("");
  const [showCurriculum, setShowCurriculum] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  return (
    <div>
      {/* Hero with child-safe branding */}
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", marginBottom: 28, minHeight: 200 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.06), rgba(8,11,16,0.95))" }} />
        <div style={{ position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)", fontSize: 80, opacity: 0.1 }}>🎠</div>
        <div style={{ position: "relative", padding: "44px 40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: childAccent, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, background: childSafe, borderRadius: "50%" }} />
            Child-Safe Mode
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 8 }}>AI Children Video</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", maxWidth: 500, lineHeight: 1.6 }}>
            Create safe, educational content for children. ABC songs, storybooks, phonics, counting, poems — in any language pair. AI ensures every frame is child-appropriate.
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 8, background: "rgba(34,197,94,0.1)", color: childSafe, border: "1px solid rgba(34,197,94,0.2)" }}>2-Stage Review</span>
            <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 8, background: "rgba(168,85,247,0.1)", color: childAccent, border: "1px solid rgba(168,85,247,0.2)" }}>Multi-Language</span>
            <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 8, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>Curriculum Templates</span>
          </div>
        </div>
      </div>

      {/* ═══ STEP 1: Choose Branch — Video or Hybrid ═══ */}
      {!branch && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            {/* Children Video */}
            <button onClick={() => setBranch("video")}
              style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: 28, cursor: "pointer", textAlign: "left", transition: "all 0.3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.4)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = border; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(168,85,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 14 }}>🎬</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Children Video</h3>
              <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginBottom: 12 }}>
                Animated, active content with motion. ABC videos, phonics with movement, counting animations, mini children movies, nursery content with characters.
              </p>
              <span style={{ fontSize: 11, color: childAccent, fontWeight: 600 }}>Active + Animated →</span>
            </button>

            {/* Children Hybrid */}
            <button onClick={() => setBranch("hybrid")}
              style={{ background: surface, border: `2px solid rgba(34,197,94,0.25)`, borderRadius: 20, padding: 28, cursor: "pointer", textAlign: "left", transition: "all 0.3s", position: "relative" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,197,94,0.5)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,197,94,0.25)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}>
              <span style={{ position: "absolute", top: -1, right: 20, background: childSafe, color: "#000", fontSize: 9, fontWeight: 800, padding: "3px 12px", borderRadius: "0 0 8px 8px" }}>RECOMMENDED</span>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 14 }}>📖</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Children Hybrid</h3>
              <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginBottom: 12 }}>
                Storybook-style with read-along. Image + narration + text highlighting. Best for reading, poems, 3-letter words, bedtime stories. Lower cost, high educational value.
              </p>
              <span style={{ fontSize: 11, color: childSafe, fontWeight: 600 }}>Read-Along + Storybook →</span>
            </button>
          </div>

          {/* AI-generated sample images */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#3d5060", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              AI-generated children illustrations
              <span style={{ flex: 1, height: 1, background: border }} />
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {[
                { src: "/api/media/demo/child_abc.png", label: "ABC Letters" },
                { src: "/api/media/demo/child_counting.png", label: "Counting" },
                { src: "/api/media/demo/child_colors.png", label: "Colors" },
                { src: "/api/media/demo/child_story.png", label: "Storybook" },
                { src: "/api/media/demo/child_nursery.png", label: "Nursery" },
              ].map(img => (
                <div key={img.label} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${border}`, background: surface }}>
                  <img src={img.src} alt={img.label} style={{ width: "100%", height: 90, objectFit: "cover" }} />
                  <p style={{ fontSize: 9, color: "#fff", fontWeight: 500, padding: "6px 8px", textAlign: "center" }}>{img.label}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 8, color: "#3d5060", marginTop: 6 }}>Generated by AI (fal.ai Flux) — these are the images used in the demo videos below</p>
          </div>

          {/* Sample videos */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", color: "#3d5060", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              Sample children content — click to play with sound
              <span style={{ flex: 1, height: 1, background: border }} />
            </p>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {[
                { src: "/api/media/demo/children_final_demo.mp4", title: "ABC + Counting + Colors", type: "Full Demo", badge: "Text + Voice + Music" },
                { src: "/api/media/demo/children_hybrid_demo.mp4", title: "Storybook Style", type: "Read-Along", badge: "Hybrid" },
                { src: "/api/media/demo/image_story_demo.mp4", title: "Image Story", type: "Budget", badge: "Hybrid" },
              ].map(v => (
                <div key={v.title} style={{ flexShrink: 0, width: 220, borderRadius: 14, overflow: "hidden", border: `1px solid ${playingVideo === v.src ? childAccent : border}`, background: surface, cursor: "pointer", position: "relative" }}>
                  {/* Click to play with sound */}
                  {playingVideo === v.src ? (
                    <div>
                      <video src={v.src} controls autoPlay style={{ width: "100%", maxHeight: 200 }}
                        onEnded={() => setPlayingVideo(null)} />
                      <button onClick={() => setPlayingVideo(null)}
                        style={{ position: "absolute", top: 6, right: 6, fontSize: 9, padding: "3px 8px", borderRadius: 6, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", zIndex: 10 }}>
                        Close
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => setPlayingVideo(v.src)}>
                      <div style={{ position: "relative", height: 120 }}>
                        <video src={v.src} muted style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(168,85,247,0.8)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(168,85,247,0.4)" }}>
                            <span style={{ color: "#fff", fontSize: 16, marginLeft: 2 }}>▶</span>
                          </div>
                        </div>
                      </div>
                      <span style={{ position: "absolute", top: 6, left: 6, fontSize: 7, padding: "2px 6px", borderRadius: 6, background: v.badge === "Hybrid" ? "rgba(34,197,94,0.85)" : "rgba(168,85,247,0.85)", color: "#fff", fontWeight: 700 }}>{v.badge}</span>
                      <div style={{ padding: "10px 12px" }}>
                        <p style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{v.title}</p>
                        <p style={{ fontSize: 9, color: muted }}>{v.type}</p>
                        <p style={{ fontSize: 8, color: childAccent, marginTop: 4 }}>Click to play with sound</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Curriculum templates */}
          <button onClick={() => setShowCurriculum(!showCurriculum)}
            style={{ fontSize: 11, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", marginBottom: showCurriculum ? 12 : 0, textDecoration: "underline" }}>
            {showCurriculum ? "Hide curriculum templates" : "View Curriculum Templates (pre-built learning paths)"}
          </button>
          {showCurriculum && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
              {CURRICULUM_TEMPLATES.map(c => (
                <div key={c.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{c.label}</p>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>{c.desc}</p>
                  <span style={{ fontSize: 9, color: "#f59e0b" }}>{c.episodes} episodes</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ STEP 2: Content Setup ═══ */}
      {branch && (
        <div>
          <button onClick={() => setBranch("")} style={{ fontSize: 11, color: muted, background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>
            ← Back to branch selection
          </button>

          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>{branch === "video" ? "🎬" : "📖"}</span>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Children {branch === "video" ? "Video" : "Hybrid"}</h2>
                <p style={{ fontSize: 11, color: muted }}>{branch === "video" ? "Animated, active learning content" : "Read-along storybook with text highlighting"}</p>
              </div>
            </div>

            {/* Age group — auto-configures everything */}
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>
              Age Group (auto-configures difficulty, pacing, visuals)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
              {AGE_GROUPS.map(a => (
                <button key={a.id} onClick={() => setAgeGroup(a.id)}
                  style={{ padding: "14px 10px", borderRadius: 12, border: `1px solid ${ageGroup === a.id ? childAccent : border}`, background: ageGroup === a.id ? `${childAccent}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: ageGroup === a.id ? childAccent : "#fff" }}>{a.label}</p>
                  <p style={{ fontSize: 10, color: muted }}>{a.age}</p>
                </button>
              ))}
            </div>

            {/* Content type */}
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>What to create</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
              {CONTENT_TYPES.map(c => (
                <button key={c.id} onClick={() => setContentType(c.id)}
                  style={{ padding: "12px 10px", borderRadius: 12, border: `1px solid ${contentType === c.id ? childAccent : border}`, background: contentType === c.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <span style={{ fontSize: 20, display: "block", marginBottom: 4 }}>{c.icon}</span>
                  <p style={{ fontSize: 11, fontWeight: 600, color: contentType === c.id ? childAccent : "#fff" }}>{c.label}</p>
                  <p style={{ fontSize: 8, color: muted }}>{c.desc}</p>
                </button>
              ))}
            </div>

            {/* Language selection — multi-language pairs */}
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10 }}>
              Language (add second language for bilingual learning)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>Primary Language</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {LANGUAGES.slice(0, 12).map(l => (
                    <button key={l.code} onClick={() => setPrimaryLang(l.code)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${primaryLang === l.code ? childAccent : border}`, background: primaryLang === l.code ? `${childAccent}10` : "transparent", cursor: "pointer", fontSize: 10, color: primaryLang === l.code ? childAccent : muted, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#f59e0b", marginBottom: 6 }}>Second Language (bilingual — optional)</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <button onClick={() => setSecondLang("")}
                    style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${!secondLang ? childSafe : border}`, background: !secondLang ? `${childSafe}10` : "transparent", cursor: "pointer", fontSize: 10, color: !secondLang ? childSafe : muted }}>
                    None
                  </button>
                  {LANGUAGES.filter(l => l.code !== primaryLang).slice(0, 11).map(l => (
                    <button key={l.code} onClick={() => setSecondLang(l.code)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${secondLang === l.code ? "#f59e0b" : border}`, background: secondLang === l.code ? "rgba(245,158,11,0.1)" : "transparent", cursor: "pointer", fontSize: 10, color: secondLang === l.code ? "#f59e0b" : muted, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
                {secondLang && (
                  <p style={{ fontSize: 9, color: "#f59e0b", marginTop: 6 }}>
                    Bilingual mode: &quot;Cat&quot; ({LANGUAGES.find(l => l.code === primaryLang)?.label}) → &quot;{secondLang === "es" ? "Gato" : secondLang === "fr" ? "Chat" : secondLang === "yo" ? "Ologbo" : "..."}&quot; ({LANGUAGES.find(l => l.code === secondLang)?.label})
                  </p>
                )}
              </div>
            </div>

            {/* Safety notice */}
            <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>🛡</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: childSafe }}>Child Safety Active</p>
              </div>
              <p style={{ fontSize: 10, color: muted, lineHeight: 1.6 }}>
                All content passes through the Child-Safe Planner. AI blocks inappropriate visuals, sounds, and text. Two mandatory reviews before any content can be published — first review checks the plan, second review checks the final output.
              </p>
            </div>

            {/* Next button */}
            <a href={`/dashboard/children-planner?branch=${branch}&content=${contentType}&age=${ageGroup}&lang=${primaryLang}&lang2=${secondLang}`}
              style={{ textDecoration: "none" }}>
              <button disabled={!contentType || !ageGroup}
                style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (contentType && ageGroup) ? childAccent : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (contentType && ageGroup) ? "pointer" : "not-allowed" }}>
                Open Child Video Planner
              </button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
