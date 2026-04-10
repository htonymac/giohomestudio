"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Child Video Planner — Strictly supervised child-safe planning
//
// 8 engines: Child-Safe Planner, Text Understanding, Narration Timing,
//   Highlight Sync, Children Music, Visual Planning, Review Engine (2-stage),
//   Export Identity
//
// Non-negotiable: text must rhythm with narration, 2 review checkpoints
// ═══════════════════════════════════════════════════════════════════════════

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const childAccent = "#a855f7";
const childSafe = "#22c55e";

const NARRATION_STYLES = [
  { id: "gentle", label: "Gentle Story Reader", desc: "Warm, soft, bedtime-friendly" },
  { id: "teacher", label: "Early Learning Teacher", desc: "Clear, educational, classroom-like" },
  { id: "fun", label: "Fun Kids Narrator", desc: "Playful, energetic, engaging" },
  { id: "calm", label: "Calm Bedtime Narrator", desc: "Very soft, soothing, sleepy" },
  { id: "classroom", label: "Classroom Guide", desc: "Structured, patient, step-by-step" },
];

const MUSIC_CHOICES = [
  { id: "none", label: "No Music", icon: "🔇" },
  { id: "soft_story", label: "Soft Storybook", icon: "📖" },
  { id: "abc_learning", label: "ABC Learning", icon: "🔤" },
  { id: "counting", label: "Counting Rhythm", icon: "🔢" },
  { id: "nursery", label: "Nursery Rhyme", icon: "🌙" },
  { id: "playful", label: "Playful Learning", icon: "🎈" },
  { id: "bedtime", label: "Calm Bedtime", icon: "💤" },
  { id: "classroom", label: "Bright Classroom", icon: "🎓" },
];

const VISUAL_STYLES = [
  { id: "storybook", label: "Soft Storybook", desc: "Warm illustrations" },
  { id: "cartoon", label: "Bright Cartoon", desc: "Colorful and fun" },
  { id: "classroom", label: "Simple Classroom", desc: "Clean educational" },
  { id: "nursery", label: "Nursery Illustration", desc: "Classic children art" },
];

export default function ChildrenPlannerPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: muted }}>Loading Child Video Planner...</div>}><ChildrenPlannerInner /></Suspense>;
}

function ChildrenPlannerInner() {
  const searchParams = useSearchParams();
  const branch = searchParams.get("branch") ?? "hybrid";
  const contentParam = searchParams.get("content") ?? "";
  const ageParam = searchParams.get("age") ?? "";
  const langParam = searchParams.get("lang") ?? "en";
  const lang2Param = searchParams.get("lang2") ?? "";

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [textContent, setTextContent] = useState("");
  const [narrationStyle, setNarrationStyle] = useState("gentle");
  const [musicChoice, setMusicChoice] = useState("soft_story");
  const [visualStyle, setVisualStyle] = useState("storybook");
  const [tone, setTone] = useState<"soft" | "active">("soft");
  const [review1Done, setReview1Done] = useState(false);
  const [review2Done, setReview2Done] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isBilingual = !!lang2Param;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <a href="/dashboard/children-video" style={{ fontSize: 11, color: muted, textDecoration: "none" }}>← Back</a>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{branch === "video" ? "🎬" : "📖"}</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Child Video Planner</h1>
            <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 8, background: `${childSafe}15`, color: childSafe, fontWeight: 600, border: `1px solid ${childSafe}30` }}>
              🛡 Child-Safe Mode
            </span>
          </div>
          <p style={{ fontSize: 11, color: muted }}>{branch === "video" ? "Animated Children Video" : "Children Hybrid (Read-Along)"} · {contentParam} · {ageParam}{isBilingual ? ` · Bilingual (${langParam} + ${lang2Param})` : ""}</p>
        </div>
      </div>

      {/* Progress with review checkpoints */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {[
          { n: 1, l: "Content" },
          { n: 2, l: "Style & Voice" },
          { n: 3, l: "Review 1 ✓" },
          { n: 4, l: "Preview" },
          { n: 5, l: "Review 2 ✓" },
        ].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 5, borderRadius: 3, marginBottom: 6, background: step >= s.n ? (s.n === 3 || s.n === 5 ? childSafe : childAccent) : "#1e2a35" }} />
            <p style={{ fontSize: 9, color: step >= s.n ? (s.n === 3 || s.n === 5 ? childSafe : childAccent) : "#3d5060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Content Input ═══ */}
      {step === 1 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Enter Your Content</h2>

          <textarea value={textContent} onChange={e => setTextContent(e.target.value)} rows={6}
            placeholder={contentParam === "3letter" ? "Enter words (one per line):\ncat\nsat\nram\njam\nran" :
              contentParam === "abc" ? "Enter the letters to cover (or leave empty for full A-Z)" :
              contentParam === "poem" ? "Enter your children's poem:\nTwinkle twinkle little star\nHow I wonder what you are" :
              contentParam === "storybook" ? "Write your children's story:\nOnce upon a time, there was a little cat named Sam. Sam loved to play in the garden..." :
              "Enter your content here..."}
            style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }} />

          {isBilingual && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <p style={{ fontSize: 11, color: "#f59e0b" }}>
                Bilingual mode active — each word/sentence will be shown in {langParam.toUpperCase()} and {lang2Param.toUpperCase()} with dual narration.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>Energy Level</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setTone("soft")}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tone === "soft" ? childSafe : border}`, background: tone === "soft" ? `${childSafe}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: tone === "soft" ? childSafe : "#fff" }}>Soft</p>
                  <p style={{ fontSize: 8, color: muted }}>Calm, bedtime, gentle</p>
                </button>
                <button onClick={() => setTone("active")}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tone === "active" ? "#f59e0b" : border}`, background: tone === "active" ? "rgba(245,158,11,0.1)" : "transparent", cursor: "pointer", textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: tone === "active" ? "#f59e0b" : "#fff" }}>Active</p>
                  <p style={{ fontSize: 8, color: muted }}>Playful, energetic, fun</p>
                </button>
              </div>
            </div>
          </div>

          <button onClick={() => setStep(2)} disabled={!textContent.trim()}
            style={{ width: "100%", marginTop: 16, padding: 16, borderRadius: 14, border: "none", background: textContent.trim() ? childAccent : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: textContent.trim() ? "pointer" : "not-allowed" }}>
            Next — Choose Voice & Style
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Voice, Visual, Music ═══ */}
      {step === 2 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Voice, Visual & Music</h2>

          {/* Narration style */}
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Narration Voice</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6, marginBottom: 20 }}>
            {NARRATION_STYLES.map(n => (
              <button key={n.id} onClick={() => setNarrationStyle(n.id)}
                style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${narrationStyle === n.id ? childAccent : border}`, background: narrationStyle === n.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "left" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: narrationStyle === n.id ? childAccent : "#fff" }}>{n.label}</p>
                <p style={{ fontSize: 9, color: muted }}>{n.desc}</p>
              </button>
            ))}
          </div>

          {/* Visual style */}
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Visual Style</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {VISUAL_STYLES.map(v => (
              <button key={v.id} onClick={() => setVisualStyle(v.id)}
                style={{ flex: 1, padding: "12px 10px", borderRadius: 10, border: `1px solid ${visualStyle === v.id ? childAccent : border}`, background: visualStyle === v.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: visualStyle === v.id ? childAccent : "#fff" }}>{v.label}</p>
                <p style={{ fontSize: 8, color: muted }}>{v.desc}</p>
              </button>
            ))}
          </div>

          {/* Music */}
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Background Music</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
            {MUSIC_CHOICES.map(m => (
              <button key={m.id} onClick={() => setMusicChoice(m.id)}
                style={{ padding: "10px 8px", borderRadius: 10, border: `1px solid ${musicChoice === m.id ? childAccent : border}`, background: musicChoice === m.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 18, display: "block", marginBottom: 4 }}>{m.icon}</span>
                <p style={{ fontSize: 9, fontWeight: 600, color: musicChoice === m.id ? childAccent : "#fff" }}>{m.label}</p>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 9, color: muted, marginBottom: 16 }}>Music is always secondary to narration. Voice stays at 100%, music at 18-35%. Music ducks when narration is active.</p>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Back</button>
            <button onClick={() => { setPlanning(true); setTimeout(() => { setPlanning(false); setStep(3); }, 2000); }}
              disabled={planning}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: planning ? "#2a2a40" : childAccent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              {planning ? "Child-Safe Planner analyzing..." : "Generate Plan → First Review"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: FIRST REVIEW (mandatory) ═══ */}
      {step === 3 && (
        <div style={{ background: surface, border: `2px solid ${childSafe}40`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>🛡</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>First Review — Safety Check</h2>
              <p style={{ fontSize: 11, color: muted }}>Review the plan before AI generates visuals. This is mandatory for children content.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Content Interpretation", check: "Text matches intended learning goal", icon: "📝" },
              { label: "Age Appropriateness", check: `Content suitable for ${ageParam} age group`, icon: "👶" },
              { label: "Narration Style", check: `${NARRATION_STYLES.find(n => n.id === narrationStyle)?.label} selected`, icon: "🗣" },
              { label: "Visual Plan", check: `${VISUAL_STYLES.find(v => v.id === visualStyle)?.label} — child-safe colors`, icon: "🎨" },
              { label: "Word Difficulty", check: "Words match selected age level", icon: "📖" },
              { label: "Music Suitability", check: `${MUSIC_CHOICES.find(m => m.id === musicChoice)?.label} — narration priority`, icon: "🎵" },
            ].map(item => (
              <div key={item.label} style={{ background: "#080b10", borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span>{item.icon}</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{item.label}</p>
                </div>
                <p style={{ fontSize: 10, color: childSafe }}>{item.check}</p>
              </div>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 16 }}>
            <input type="checkbox" checked={review1Done} onChange={e => setReview1Done(e.target.checked)} style={{ marginTop: 3, accentColor: childSafe }} />
            <span style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6 }}>
              I have reviewed the plan above. The content type, age group, narration style, visual style, and music choice are appropriate for children. I approve generating the preview.
            </span>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Back</button>
            <button onClick={() => { setGenerating(true); setTimeout(() => { setGenerating(false); setStep(4); }, 2000); }}
              disabled={!review1Done || generating}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (!review1Done || generating) ? "#2a2a40" : childSafe, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!review1Done || generating) ? "not-allowed" : "pointer" }}>
              {generating ? "Generating child-safe preview..." : "✓ Approved — Generate Preview"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Preview ═══ */}
      {step === 4 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Preview Generated</h2>
          <p style={{ fontSize: 12, color: muted, marginBottom: 16 }}>Review the generated preview carefully. Check visuals, narration, text highlighting, and overall child-safety before final approval.</p>

          {/* Preview placeholder */}
          <div style={{ background: "#080b10", borderRadius: 14, padding: 40, textAlign: "center", marginBottom: 16, border: `1px solid ${border}` }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🎬</p>
            <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Preview will appear here after generation</p>
            <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Video preview with narration, text highlighting, and music</p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Regenerate</button>
            <button onClick={() => setStep(5)}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: childAccent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Proceed to Final Review
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: SECOND REVIEW (mandatory) ═══ */}
      {step === 5 && (
        <div style={{ background: surface, border: `2px solid ${childSafe}40`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>🛡</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>Second Review — Final Safety Check</h2>
              <p style={{ fontSize: 11, color: muted }}>This is the FINAL check before content can be exported or published. Both reviews are mandatory for children content.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Visuals are child-safe", check: "No inappropriate imagery, characters look child-friendly" },
              { label: "Narration is clear", check: "Pronunciation is clear, pace is appropriate for children" },
              { label: "Text highlighting syncs", check: "Highlighted words match spoken words exactly" },
              { label: "Music is appropriate", check: "Music supports learning, doesn't overpower voice" },
              { label: "No unsafe AI mistakes", check: "No strange objects, no adult styling, no confusing elements" },
              { label: "Background is clean", check: "Simple, uncluttered, child-appropriate scenes" },
            ].map(item => (
              <div key={item.label} style={{ background: "#080b10", borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{item.label}</p>
                <p style={{ fontSize: 10, color: muted }}>{item.check}</p>
              </div>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 16 }}>
            <input type="checkbox" checked={review2Done} onChange={e => setReview2Done(e.target.checked)} style={{ marginTop: 3, accentColor: childSafe }} />
            <span style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6 }}>
              I have watched the preview in full. I confirm that the visuals, narration, text, and music are all appropriate for children. I approve this content for final rendering and export.
            </span>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(4)} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Back to Preview</button>
            <button disabled={!review2Done}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: review2Done ? childSafe : "#2a2a40", color: "#000", fontSize: 16, fontWeight: 700, cursor: review2Done ? "pointer" : "not-allowed" }}>
              ✓ Both Reviews Passed — Render Final Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
