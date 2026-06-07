"use client";

// ─────────────────────────────────────────────────────────────────────────────
// OverviewTab — production dashboard for the movie planner.
//
// WHAT THIS TAB SHOWS:
//   1. 5 stat bubbles  (total / draft / approved / blocked scenes + character count)
//   2. Two side-by-side cards:
//        a. Production Progress  (6 progress bars: Story / Characters / Planning /
//           Scenes Generated / Scene Images / Assembly Readiness)
//        b. Resume & Next Steps  (last action, current phase, dynamic "Next Step"
//           card with a "Go" button that deep-links to the right tab)
//   3. Warnings card  (only when warnings.length > 0; first 8 with "Fix" buttons)
//   4. Quick Links  (4 large nav buttons → Scenes, Character Registry, Editor, Assembly)
//   5. Cost summary  (estimated credits — only when moviePlan exists)
//   6. Assembled video card  (only after assembly succeeds — watch + download)
//   7. Movie Blueprint snippet  (only when moviePlan exists)
//   8. Model Settings panel  (collapsible — 4 model pickers: Story LLM, Character
//      Image, Scene Video, Sound/SFX)
//
// HOW IT FITS:
//   - 100% read-state UI. The only mutations are tab switches + model picks +
//     sound-tier pick (which fan out to setSoundTier + patchProjectSettings in
//     parent — passed in as one onPickSoundTier handler to keep this tab dumb).
//   - ProgressBar is inlined here because it is a small presentational helper
//     used nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";

export interface SoundTierEntry { id: string; label: string; cost: string }

export interface OverviewModelSettings {
  storyLLM: string;
  charImageModel: string;
  sceneVideoModel: string;
  soundModel: string;
}

export interface OverviewMoviePlan {
  estimatedCredits: number | string;
  summary: string;
}

export interface OverviewTabProps {
  // ── Stats (counts) ─────────────────────────────────────────────────────
  /** Total scene count across the whole movie. */
  totalScenes: number;
  /** Scenes still in "planned" or "needs_edit" state. */
  draftScenes: number;
  /** Scenes the user has approved. */
  approvedScenes: number;
  /** Scenes blocked from generation (missing assets etc). */
  blockedScenes: number;
  /** Length of the user's saved-characters list. */
  savedCharactersCount: number;

  // ── Progress (0-100) ───────────────────────────────────────────────────
  /** Story tab completion (0 / 50 / 100). */
  storyProgress: number;
  /** Character tab completion (0 / 50 / 100). */
  characterProgress: number;
  /** AI planning completion (0 / 100). */
  planningProgress: number;
  /** Scene-render completion (0-100). */
  sceneProgress: number;
  /** Per-scene image completion (0-100). */
  imageProgress: number;
  /** Average of the above — drives the "Ready for Assembly" gauge. */
  assemblyReadiness: number;

  // ── Resume + next-step context ─────────────────────────────────────────
  /** Last action text shown to the user (e.g., "Generated Story Draft"). */
  lastAction: string;
  /** Current production phase (snake_case → spaced when rendered). */
  projectPhase: string;
  /** Has the user picked a genre yet — gates the next-step copy. */
  hasGenre: boolean;
  /** Has the user written an idea — gates the next-step copy. */
  hasIdea: boolean;
  /** Cast-selection count — used to gate next-step copy. */
  selectedCastCount: number;
  /** Does a movie plan exist — controls cost summary + blueprint visibility. */
  hasMoviePlan: boolean;
  /** Number of scene images generated so far. */
  generatedImages: number;
  /** Number of scenes fully rendered to video. */
  generatedScenes: number;

  // ── Warnings ───────────────────────────────────────────────────────────
  /** Plain-text warnings shown in the warnings card (first 8 rendered). */
  warnings: string[];

  // ── Cost summary / blueprint ───────────────────────────────────────────
  /** Movie plan summary — `null` hides the cost + blueprint cards. */
  moviePlan: OverviewMoviePlan | null;
  /** Format string ("hybrid" / "movie" / etc) — shown next to credits. */
  format: string;
  /** Plain title (used as MP4 download file name). */
  title: string;

  // ── Assembled video (after final render) ───────────────────────────────
  /** Final video URL — `null` hides the video card. */
  assembledUrl: string | null;

  // ── Model Settings panel ───────────────────────────────────────────────
  /** Toggles the model-settings panel open/closed. */
  showModelSettings: boolean;
  setShowModelSettings: React.Dispatch<React.SetStateAction<boolean>>;
  /** Current model picks (all 4 model categories). */
  modelSettings: OverviewModelSettings;
  /** Update one or more model picks (merge semantics — parent does ...prev). */
  setModelSettings: React.Dispatch<React.SetStateAction<OverviewModelSettings>>;
  /** Sound-tier registry from parent — drives the Sound/SFX picker. */
  SOUND_TIERS_MOVIE: ReadonlyArray<SoundTierEntry>;
  /**
   * Called when the user picks a sound tier. Parent does:
   *   setModelSettings(p => ({ ...p, soundModel: id }));
   *   setSoundTier(id);
   *   patchProjectSettings({ soundTier: id }).catch(noop);
   * (Bundled into one handler so this tab stays free of patch-call wiring.)
   */
  onPickSoundTier: (tierId: string) => void;

  // ── Style tokens ──────────────────────────────────────────────────────
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  accent: string;
  purple: string;
  gold: string;
  red: string;
  blue: string;
  green: string;

  // ── Nav ────────────────────────────────────────────────────────────────
  /**
   * Switch active workshop tab. Narrowed to the exact destinations this tab
   * can request (so junior devs see the full nav surface from the prop type).
   */
  setActiveTab: (tab: "design" | "story" | "characters" | "scenes" | "assembly" | "overview") => void;
}

// Inline ProgressBar — only used here, so keeping it co-located is junior-friendly
// (less file-hopping). Takes muted + border as props instead of reaching into
// parent scope.
function ProgressBar(p: { label: string; value: number; color: string; muted: string; border: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: p.muted }}>{p.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: p.color }}>{p.value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: p.border }}>
        <div style={{ width: `${p.value}%`, height: "100%", borderRadius: 3, background: p.color, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function OverviewTab(props: OverviewTabProps) {
  const {
    totalScenes, draftScenes, approvedScenes, blockedScenes, savedCharactersCount,
    storyProgress, characterProgress, planningProgress, sceneProgress, imageProgress, assemblyReadiness,
    lastAction, projectPhase, hasGenre, hasIdea, selectedCastCount, hasMoviePlan,
    generatedImages, generatedScenes,
    warnings,
    moviePlan, format, title,
    assembledUrl,
    showModelSettings, setShowModelSettings, modelSettings, setModelSettings,
    SOUND_TIERS_MOVIE, onPickSoundTier,
    cardStyle, labelStyle, s2, border, muted, accent, purple, gold, red, blue, green,
    setActiveTab,
  } = props;

  return (
    <div>
      {/* 5 stat bubbles */}
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Stat value={totalScenes} label="Total Scenes" color={accent} muted={muted} />
        <Stat value={draftScenes} label="Draft" color={gold} muted={muted} />
        <Stat value={approvedScenes} label="Approved" color={green} muted={muted} />
        <Stat value={blockedScenes} label="Blocked" color={red} muted={muted} />
        <Stat value={savedCharactersCount} label="Characters" color={purple} muted={muted} />
      </div>

      {/* Progress + Resume side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Production Progress</p>
          <ProgressBar label="Story" value={storyProgress} color={accent} muted={muted} border={border} />
          <ProgressBar label="Characters" value={characterProgress} color={purple} muted={muted} border={border} />
          <ProgressBar label="AI Planning" value={planningProgress} color={gold} muted={muted} border={border} />
          <ProgressBar label="Scenes Generated" value={sceneProgress} color={blue} muted={muted} border={border} />
          <ProgressBar label="Scene Images" value={imageProgress} color={green} muted={muted} border={border} />
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginTop: 6 }}>
            <ProgressBar
              label="Assembly Readiness"
              value={assemblyReadiness}
              color={assemblyReadiness > 70 ? green : assemblyReadiness > 40 ? gold : red}
              muted={muted}
              border={border}
            />
          </div>
        </div>

        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Resume & Next Steps</p>
          <KvCard label="Last Action" labelColor={accent} value={lastAction} s2={s2} border={border} />
          <KvCard label="Phase" labelColor={gold} value={projectPhase.replace(/_/g, " ")} s2={s2} border={border} />
          <div style={{ background: `${accent}08`, borderRadius: 10, padding: 12, border: `1px solid ${accent}20` }}>
            <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Next Step</p>
            <p style={{ fontSize: 12, color: "#fff" }}>
              {!hasGenre ? "Set movie design first (genre, tone, format)" :
               !hasIdea ? "Write your story idea" :
               selectedCastCount === 0 ? "Select your cast" :
               !hasMoviePlan ? "Run AI Planning" :
               generatedImages < totalScenes ? `Generate images for ${totalScenes - generatedImages} scenes` :
               generatedScenes < totalScenes ? "Render remaining scenes" :
               "Ready for assembly!"}
            </p>
            <button
              onClick={() => {
                // Same nav decision tree as the next-step copy above.
                if (!hasGenre) setActiveTab("design");
                else if (!hasIdea) setActiveTab("story");
                else if (selectedCastCount === 0) setActiveTab("characters");
                else if (!hasMoviePlan) setActiveTab("story");
                else if (generatedImages < totalScenes) setActiveTab("scenes");
                else setActiveTab("assembly");
              }}
              style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              Go
            </button>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ ...cardStyle, borderColor: `${gold}30`, background: `${gold}04` }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: gold, marginBottom: 10 }}>Warnings & Blockers ({warnings.length})</p>
          {warnings.slice(0, 8).map((w, i) => {
            // Decide which tab the "Fix" button should jump to, based on what the
            // warning text mentions. Default to overview if unsure.
            const fixTab: "characters" | "scenes" | "overview" =
              w.includes("voice") || w.includes("portrait") ? "characters" :
              w.includes("Scene") || w.includes("image") ? "scenes" :
              w.includes("character") || w.includes("cast") ? "characters" :
              "overview";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: `${gold}06`, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: gold }}>!</span>
                <p style={{ fontSize: 11, color: gold, flex: 1 }}>{w}</p>
                <button onClick={() => setActiveTab(fixTab)} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${gold}30`, background: "transparent", color: gold, fontSize: 8, cursor: "pointer", flexShrink: 0 }}>Fix</button>
              </div>
            );
          })}
          {warnings.length > 8 && <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>+{warnings.length - 8} more</p>}
        </div>
      )}

      {/* Quick Links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <button onClick={() => setActiveTab("scenes")} style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${blue}20` }}>
          <Icon.Film style={{ width: 24, height: 24, color: blue, marginBottom: 6 }} />
          <p style={{ fontSize: 11, color: blue, fontWeight: 600, marginTop: 6 }}>Scene Board</p>
        </button>
        <a href="/dashboard/character-voices" style={{ textDecoration: "none" }}>
          <div style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${purple}20` }}>
            <Icon.User style={{ width: 24, height: 24, color: purple, marginBottom: 6 }} />
            <p style={{ fontSize: 11, color: purple, fontWeight: 600, marginTop: 6 }}>Character Registry</p>
          </div>
        </a>
        <a href="/dashboard/collaborative-editor?from=movie-planner" style={{ textDecoration: "none" }}>
          <div style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${accent}20` }}>
            <Icon.Wand style={{ width: 24, height: 24, color: accent, marginBottom: 6 }} />
            <p style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 6 }}>Open Editor</p>
          </div>
        </a>
        <button onClick={() => setActiveTab("assembly")} style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${gold}20` }}>
          <Icon.Bolt style={{ width: 24, height: 24, color: gold, marginBottom: 6 }} />
          <p style={{ fontSize: 11, color: gold, fontWeight: 600, marginTop: 6 }}>Assembly</p>
        </button>
      </div>

      {/* Cost summary */}
      {moviePlan && (
        <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#fff" }}>Estimated Credits: <strong style={{ color: accent }}>{moviePlan.estimatedCredits}</strong></span>
          <span style={{ fontSize: 12, color: muted }}>{totalScenes} scenes &middot; {format || "hybrid"} format</span>
        </div>
      )}

      {/* Assembled video */}
      {assembledUrl && (
        <div style={{ ...cardStyle, borderColor: `${green}40`, background: `${green}04` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: green, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.Check style={{ width: 14, height: 14 }} /> Movie Assembled
          </p>
          <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 280, borderRadius: 10, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <a href={assembledUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
              <button style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: `1px solid ${green}30`, background: `${green}08`, color: green, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Watch Full Movie
              </button>
            </a>
            <a href={assembledUrl} download={`${title || "movie"}.mp4`} style={{ flex: 1, textDecoration: "none" }}>
              <button style={{ width: "100%", padding: "8px 14px", borderRadius: 8, border: `1px solid ${accent}30`, background: `${accent}08`, color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Download MP4
              </button>
            </a>
          </div>
        </div>
      )}

      {/* Movie Blueprint snippet */}
      {moviePlan && (
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Movie Blueprint</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{moviePlan.summary}</p>
        </div>
      )}

      {/* Model Settings (collapsible) */}
      <div style={{ ...cardStyle, marginTop: 12 }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: showModelSettings ? 14 : 0 }}
          onClick={() => setShowModelSettings(p => !p)}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Model Settings</p>
          <span style={{ fontSize: 11, color: muted }}>{showModelSettings ? "Hide" : "Show"}</span>
        </div>
        {showModelSettings && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {/* 1. Story LLM */}
            <ModelPicker
              title="Story LLM"
              currentValue={modelSettings.storyLLM}
              options={[
                { id: "claude-haiku-4-5", label: "Haiku 4.5 — Fast (draft)" },
                { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — Balanced" },
                { id: "claude-opus-4-7", label: "Opus 4.7 — Premium (final)" },
                { id: "gpt-4o-mini", label: "GPT Fast" },
                { id: "gpt-4o", label: "GPT Premium" },
              ]}
              activeColor={accent}
              border={border}
              labelStyle={labelStyle}
              onPick={id => setModelSettings(p => ({ ...p, storyLLM: id }))}
            />
            {/* 2. Character image */}
            <ModelPicker
              title="Character Image"
              currentValue={modelSettings.charImageModel}
              options={[
                { id: "fal_flux_schnell", label: "Flux Schnell (default, fast)" },
                { id: "fal_flux_dev", label: "Flux Dev (quality)" },
                { id: "pruna_flux", label: "Pruna (optimized)" },
              ]}
              activeColor={purple}
              border={border}
              labelStyle={labelStyle}
              onPick={id => setModelSettings(p => ({ ...p, charImageModel: id }))}
            />
            {/* 3. Scene video */}
            <ModelPicker
              title="Scene Video"
              currentValue={modelSettings.sceneVideoModel}
              options={[
                { id: "kling_1_6_standard", label: "Kling 1.6 Standard" },
                { id: "kling_2_5_pro", label: "Kling 2.5 Pro" },
                { id: "runway_gen4", label: "Runway Gen-4" },
                { id: "veo2", label: "Veo 2" },
                { id: "fal_wan_lite", label: "Wan 2.5" },
              ]}
              activeColor={gold}
              border={border}
              labelStyle={labelStyle}
              onPick={id => setModelSettings(p => ({ ...p, sceneVideoModel: id }))}
            />
            {/* 4. Sound / SFX — fan-out to parent so it can sync setSoundTier + patchProjectSettings */}
            <div>
              <p style={{ ...labelStyle }}>Sound/SFX</p>
              {SOUND_TIERS_MOVIE.map(tier => (
                <button
                  key={tier.id}
                  onClick={() => onPickSoundTier(tier.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", width: "100%",
                    padding: "6px 10px", marginBottom: 4, borderRadius: 8,
                    border: `1px solid ${modelSettings.soundModel === tier.id ? green : border}`,
                    background: modelSettings.soundModel === tier.id ? `${green}12` : "transparent",
                    color: modelSettings.soundModel === tier.id ? green : "#fff",
                    fontSize: 10, cursor: "pointer",
                  }}>
                  <span>{tier.label}</span><span style={{ opacity: 0.6 }}>{tier.cost}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Local helper — single stat bubble (label + big number).
function Stat(p: { value: number; label: string; color: string; muted: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontSize: 28, fontWeight: 800, color: p.color }}>{p.value}</p>
      <p style={{ fontSize: 9, color: p.muted, textTransform: "uppercase", letterSpacing: 1 }}>{p.label}</p>
    </div>
  );
}

// Local helper — single Resume-card key/value row.
function KvCard(p: { label: string; labelColor: string; value: string; s2: string; border: string }) {
  return (
    <div style={{ background: p.s2, borderRadius: 10, padding: 12, border: `1px solid ${p.border}`, marginBottom: 8 }}>
      <p style={{ fontSize: 9, color: p.labelColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{p.label}</p>
      <p style={{ fontSize: 12, color: "#fff" }}>{p.value}</p>
    </div>
  );
}

// Local helper — reusable model-picker column (3 of the 4 model settings use this shape).
function ModelPicker(p: {
  title: string;
  currentValue: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  activeColor: string;
  border: string;
  labelStyle: React.CSSProperties;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p style={{ ...p.labelStyle }}>{p.title}</p>
      {p.options.map(m => (
        <button
          key={m.id}
          onClick={() => p.onPick(m.id)}
          style={{
            display: "block", width: "100%",
            padding: "6px 10px", marginBottom: 4, borderRadius: 8,
            border: `1px solid ${p.currentValue === m.id ? p.activeColor : p.border}`,
            background: p.currentValue === m.id ? `${p.activeColor}12` : "transparent",
            color: p.currentValue === m.id ? p.activeColor : "#fff",
            fontSize: 10, cursor: "pointer", textAlign: "left" as const,
          }}>
          {m.label}
        </button>
      ))}
    </div>
  );
}
