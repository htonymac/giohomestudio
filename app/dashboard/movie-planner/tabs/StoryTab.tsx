"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StoryTab — where the user writes the actual story content.
//
// SECTIONS (top → bottom):
//   1. Design-first nudge / "design set" confirmation banner
//   2. Story card  — Title, Idea (required), Expanded Story, Duration / Language
//      / Cost / Audience pickers, AITierSelector, Era + Culture lock, primary
//      CTAs (Expand with AI Intelligence + Generate Movie Plan), De-vocabularize
//   3. AI Production Plan  — empty-state generate button OR card with results
//   4. Expanded summary card (when expandedStory is non-empty)
//   5. Draft Zone — list of unfinished scenes with "Open" deep-link
//
// All async actions (expand, plan, devocarize, productionPlan) are owned by the
// parent. This tab is pure JSX + thin event wiring.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";
import DurationPicker from "../../../components/DurationPicker";
import AITierSelector, { type AITier } from "../../../components/AITierSelector";

// Format option — needed only for the "Design set" pill that resolves the
// format id back to a label.
export interface StoryFormatOption { id: string; label: string }

// AI plan shape — matches parent's interface.
export interface StoryAiProductionPlan {
  scenes: Array<{ id: string; title: string; description: string; duration: string }>;
  musicMood: string;
  visualStyle: string;
  narratorTone: string;
  sceneCount: number;
  pacing: string;
  generatedAt: string;
}

// Scene row shape — only the fields rendered in the Draft Zone.
export interface StoryDraftScene {
  scene: number;
  title: string;
  status: string;
}

export interface StoryTabProps {
  // ── Design summary state ──
  genre: string;
  tone: string;
  setting: string;
  format: string;
  FORMATS: ReadonlyArray<StoryFormatOption>;

  // ── Story state ──
  title: string;
  setTitle: (v: string) => void;
  idea: string;
  setIdea: (v: string) => void;
  expandedStory: string;
  setExpandedStory: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  /** Project-settings-respecting language (use this for the SELECT's current value). */
  effectiveLanguage: string;
  /** Plain language setter — wraps patchProjectSettings({ language }) in the bundled handler. */
  onChangeLanguage: (v: string) => void;
  aiTier: AITier;
  setAiTier: (v: AITier) => void;
  storyEra: string;
  setStoryEra: (v: string) => void;
  storyCulture: string;
  setStoryCulture: (v: string) => void;

  // ── In-flight flags ──
  expanding: boolean;
  planning: boolean;
  devocarizing: boolean;
  generatingProductionPlan: boolean;

  // ── AI Plan card ──
  aiProductionPlan: StoryAiProductionPlan | null;
  showProductionPlan: boolean;
  setShowProductionPlan: React.Dispatch<React.SetStateAction<boolean>>;
  generateProductionPlan: () => void | Promise<void>;

  // ── Draft Zone ──
  scenes: ReadonlyArray<StoryDraftScene>;
  sceneImages: Record<string, string | undefined>;
  draftScenes: number;
  totalScenes: number;
  setSelectedScene: (sceneNum: number) => void;

  // ── Actions ──
  expandStory: () => void | Promise<void>;
  generateMoviePlan: () => void | Promise<void>;
  devocarize: (age: number) => void | Promise<void>;

  // ── Nav + lastAction ──
  setActiveTab: (tab: "design" | "scenes") => void;
  setLastAction: (msg: string) => void;

  // ── Style tokens + helpers ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  btnPrimary: React.CSSProperties;
  s2: string;
  surface: string;
  border: string;
  muted: string;
  accent: string;
  blue: string;
  gold: string;
  green: string;
  /** Identical signature to parent: `badgeStyle(color) → CSSProperties`. */
  badgeStyle: (color: string) => React.CSSProperties;
}

export default function StoryTab(props: StoryTabProps) {
  const {
    genre, tone, setting, format, FORMATS,
    title, setTitle, idea, setIdea, expandedStory, setExpandedStory,
    duration, setDuration, effectiveLanguage, onChangeLanguage,
    aiTier, setAiTier, storyEra, setStoryEra, storyCulture, setStoryCulture,
    expanding, planning, devocarizing, generatingProductionPlan,
    aiProductionPlan, showProductionPlan, setShowProductionPlan, generateProductionPlan,
    scenes, sceneImages, draftScenes, totalScenes, setSelectedScene,
    expandStory, generateMoviePlan, devocarize,
    setActiveTab, setLastAction,
    cardStyle, labelStyle, inputStyle, btnPrimary,
    s2, surface, border, muted, accent, blue, gold, green, badgeStyle,
  } = props;

  return (
    <div>
      {/* Design-first nudge OR "Design set" confirmation */}
      {!genre && (
        <div onClick={() => setActiveTab("design")}
          style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 12, cursor: "pointer", background: `${gold}08`, border: `1px solid ${gold}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: gold }}>Set Design First</p>
            <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>Genre, tone, format, and style feed the AI — without them the AI plans a generic movie, not your movie.</p>
          </div>
          <span style={{ fontSize: 11, color: gold, whiteSpace: "nowrap", marginLeft: 16 }}>Go to Design</span>
        </div>
      )}
      {genre && (
        <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 12, background: `${green}08`, border: `1px solid ${green}20`, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: green, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon.Check style={{ width: 12, height: 12 }} /> Design set:
          </span>
          <span style={{ fontSize: 11, color: muted }}>
            {genre}{tone ? ` · ${tone}` : ""}{setting ? ` · ${setting}` : ""}{format ? ` · ${FORMATS.find(f => f.id === format)?.label || format}` : ""}
          </span>
          <button onClick={() => setActiveTab("design")}
            style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: `1px solid ${green}30`, background: "transparent", color: green, fontSize: 10, cursor: "pointer" }}>
            Edit Design
          </button>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Story & Draft</h2>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Movie Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The Last Guardian" style={inputStyle} />
        </div>

        {/* Idea (required) */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Movie Idea *</label>
          <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={5}
            placeholder="e.g. 'The man walked slowly toward the giant snake. The beast glared at him like prey. Beside him was a fallen log. He grabbed it and prepared to fight.'"
            style={{ ...inputStyle, resize: "vertical" }} />
          <p style={{ fontSize: 10, color: "#3d5060", marginTop: 6 }}>Write short — AI will expand this into full cinematic detail.</p>
        </div>

        {/* Expanded Story (optional) */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Expanded Story (optional)</label>
          <textarea value={expandedStory} onChange={e => setExpandedStory(e.target.value)} rows={4}
            placeholder="Add more story detail if you have it — backstory, character motivations, key plot points..."
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {/* Duration / Language / Cost / Audience row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ ...labelStyle, fontSize: 9 }}>Duration</label>
            <DurationPicker preset="episode" value={duration} onChange={(label: string) => setDuration(label)} label="" accentColor="#7c5cfc" />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: 9 }}>Language</label>
            <select value={effectiveLanguage} onChange={e => onChangeLanguage(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
              {["English (US)", "English (UK)", "English (AU)", "French", "Spanish", "Portuguese", "Arabic", "Hindi", "Mandarin", "Swahili", "German", "Italian", "Japanese", "Korean", "Russian", "Turkish", "Dutch", "Mixed"].map(l => (
                <option key={l} value={l} style={{ background: surface }}>{l}</option>
              ))}
            </select>
          </div>
          {/* Cost preference — read-only-by-design dropdown (parent never wires onChange here). */}
          <div>
            <label style={{ ...labelStyle, fontSize: 9 }}>Cost Preference</label>
            <select value={format === "audio_only" ? "free" : "balanced"} onChange={() => { /* intentionally noop — driven by format */ }} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
              {["efficient", "balanced", "premium"].map(c => <option key={c} value={c} style={{ background: surface }}>{c}</option>)}
            </select>
          </div>
          {/* Audience — uncontrolled default per original behavior. */}
          <div>
            <label style={{ ...labelStyle, fontSize: 9 }}>Audience</label>
            <select defaultValue="general" style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
              {["general", "children", "teens", "adults", "business", "family"].map(a => <option key={a} value={a} style={{ background: surface }}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* AI tier picker */}
        <AITierSelector value={aiTier} onChange={setAiTier} compact />

        {/* Era + Culture lock */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: "#fb923c", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>Story Era / Year</label>
            <input value={storyEra} onChange={e => setStoryEra(e.target.value)}
              placeholder="e.g. 2024, 1819, 899 AD, 300 BC, Today"
              style={{ ...inputStyle, fontSize: 10, padding: "7px 10px" }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#fb923c", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>Story Culture / Setting</label>
            <input value={storyCulture} onChange={e => setStoryCulture(e.target.value)}
              placeholder="e.g. Contemporary Lagos, Victorian England, Yoruba Kingdom"
              style={{ ...inputStyle, fontSize: 10, padding: "7px 10px" }} />
          </div>
        </div>
        {(storyEra || storyCulture) && (
          <p style={{ fontSize: 8, color: "#fb923c", marginTop: 4, fontWeight: 600 }}>
            Era lock active — all scene images: {[storyEra, storyCulture].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Primary CTAs */}
        <div style={{ display: "flex", gap: 10, marginBottom: 0, marginTop: 10 }}>
          <button onClick={() => expandStory()} disabled={!idea.trim() || expanding}
            style={{ ...btnPrimary, flex: 1, background: !idea.trim() || expanding ? "#2a2a40" : "linear-gradient(135deg, #22c55e, #16a34a)", cursor: !idea.trim() || expanding ? "not-allowed" : "pointer" }}>
            {expanding ? "Expanding Story..." : "Expand with AI Intelligence"}
          </button>
          <button
            onClick={() => {
              if (!idea.trim()) return;
              // If design isn't set yet, bounce to design tab first.
              if (!genre) { setLastAction("Set Design before running AI planning"); setActiveTab("design"); return; }
              generateMoviePlan();
            }}
            disabled={!idea.trim() || planning}
            style={{ ...btnPrimary, flex: 1, background: !idea.trim() || planning ? "#2a2a40" : !genre ? gold : "#7c5cfc", cursor: !idea.trim() || planning ? "not-allowed" : "pointer" }}>
            {planning ? "Planning..." : !genre ? "Set Design First" : "Generate Movie Plan"}
          </button>
        </div>
        {expanding && <p style={{ fontSize: 10, color: accent, marginTop: 8, textAlign: "center" }}>Running 3-step pipeline: story expand → character extract → scene plan...</p>}

        {/* De-vocabularize button */}
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <button
            onClick={() => {
              if (!idea.trim()) { setLastAction("Add movie idea first"); return; }
              const raw = window.prompt("Simplify story idea for which age? (5-18)", "12");
              if (raw === null) return;
              const age = parseInt(raw.trim(), 10);
              if (!Number.isFinite(age) || age < 5 || age > 18) {
                setLastAction("Age must be a number between 5 and 18");
                return;
              }
              void devocarize(age);
            }}
            disabled={devocarizing || !idea.trim()}
            title="Rewrite the movie idea using simpler words for a target age"
            style={{
              padding: "5px 9px", borderRadius: 6,
              border: `1px solid ${accent}55`,
              background: devocarizing ? `${accent}25` : `${accent}12`,
              color: (devocarizing || !idea.trim()) ? muted : accent,
              fontSize: 9, fontWeight: 700,
              cursor: (devocarizing || !idea.trim()) ? "not-allowed" : "pointer",
              opacity: (devocarizing || !idea.trim()) ? 0.55 : 1,
            }}>
            {devocarizing ? "Simplifying…" : "De-vocabularize"}
          </button>
        </div>
      </div>

      {/* AI Production Plan — empty state */}
      {idea.trim() && !aiProductionPlan && (
        <div style={{ ...cardStyle, borderColor: `${gold}20`, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: gold, marginBottom: 4 }}>AI Production Plan</p>
              <p style={{ fontSize: 11, color: muted }}>Let AI read your genre, tone, and story — then suggest scene count, pacing, music mood, and visual style.</p>
            </div>
            <button onClick={generateProductionPlan} disabled={generatingProductionPlan}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: generatingProductionPlan ? "#2a2a40" : `linear-gradient(135deg, ${gold}, #d97706)`, color: "#000", fontSize: 12, fontWeight: 700, cursor: generatingProductionPlan ? "not-allowed" : "pointer", flexShrink: 0, marginLeft: 16 }}>
              {generatingProductionPlan ? "Planning..." : "Get AI Plan"}
            </button>
          </div>
        </div>
      )}

      {/* AI Production Plan — populated card (collapsible) */}
      {aiProductionPlan && (
        <div style={{ ...cardStyle, borderColor: `${gold}30`, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showProductionPlan ? 14 : 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: gold }}>
              AI Production Plan — {aiProductionPlan.sceneCount > 0 ? `${aiProductionPlan.sceneCount} scenes` : "Ready"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={generateProductionPlan} disabled={generatingProductionPlan}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${gold}40`, background: "transparent", color: gold, fontSize: 10, cursor: "pointer" }}>
                Regenerate
              </button>
              <button onClick={() => setShowProductionPlan(p => !p)}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                {showProductionPlan ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>
          {showProductionPlan && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <PlanFact label="Music Mood"    value={aiProductionPlan.musicMood}    labelStyle={labelStyle} s2={s2} border={border} />
              <PlanFact label="Visual Style"  value={aiProductionPlan.visualStyle}  labelStyle={labelStyle} s2={s2} border={border} />
              <PlanFact label="Narrator Tone" value={aiProductionPlan.narratorTone} labelStyle={labelStyle} s2={s2} border={border} />
              <PlanFact label="Pacing"        value={aiProductionPlan.pacing}       labelStyle={labelStyle} s2={s2} border={border} />
              {aiProductionPlan.scenes.length > 0 && (
                <div style={{ gridColumn: "1 / -1", maxHeight: 200, overflowY: "auto" }}>
                  <p style={labelStyle}>Suggested Scenes</p>
                  {aiProductionPlan.scenes.map((sc, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "6px 10px", borderRadius: 6, background: `${accent}08`, marginBottom: 4, border: `1px solid ${border}` }}>
                      <span style={{ fontSize: 10, color: accent, fontWeight: 700, minWidth: 60 }}>Scene {i + 1}</span>
                      <span style={{ fontSize: 11, color: "#fff", flex: 1 }}>{sc.title}</span>
                      <span style={{ fontSize: 10, color: muted }}>{sc.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded summary card */}
      {expandedStory && (
        <div style={{ ...cardStyle, borderColor: `${accent}20` }}>
          <p style={labelStyle}>Expanded Story</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{expandedStory}</p>
        </div>
      )}

      {/* Draft Zone */}
      <div style={cardStyle}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Draft Zone — Unfinished Scenes</p>
        {scenes.filter(s => s.status === "planned" || s.status === "needs_edit").length > 0 ? (
          <div>
            <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>{draftScenes} scenes in draft</p>
            {scenes.filter(s => s.status === "planned" || s.status === "needs_edit").map(s => (
              <div key={s.scene} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, marginBottom: 4, border: `1px solid ${border}` }}>
                <span style={badgeStyle(gold)}>SC{String(s.scene).padStart(2, "0")}</span>
                <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>{s.title}</p>
                <span style={{ fontSize: 9, color: muted }}>{sceneImages[`SC${String(s.scene).padStart(2, "0")}`] ? "has image" : "no image"}</span>
                <button onClick={() => { setActiveTab("scenes"); setSelectedScene(s.scene); }}
                  style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: blue, fontSize: 9, cursor: "pointer" }}>Open</button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: muted }}>{totalScenes === 0 ? "No scenes created yet. Run AI Planning from the Design tab." : "All scenes reviewed or approved!"}</p>
        )}
      </div>
    </div>
  );
}

// Small helper — the "fact" cells inside the AI Plan card. Co-located here so
// the file stays self-contained and junior devs don't have to chase a one-off
// component to another folder.
function PlanFact(p: { label: string; value: string; labelStyle: React.CSSProperties; s2: string; border: string }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 10, background: p.s2, border: `1px solid ${p.border}` }}>
      <p style={{ ...p.labelStyle, marginBottom: 4 }}>{p.label}</p>
      <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{p.value}</p>
    </div>
  );
}
