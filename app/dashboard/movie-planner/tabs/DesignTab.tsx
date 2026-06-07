"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DesignTab — the FIRST step the user takes in the movie planner.
//
// WHAT THIS TAB DOES:
//   Collects the high-level "design" inputs that tell the AI how to plan your
//   production: genre, storytelling style, production format, production mode,
//   character visual style, tone, setting/world, AI intelligence tier (planning
//   depth), story-expansion LLM, and video art style.
//
//   Ends with a CTA that either:
//     - bounces the user to the Story tab (if no story yet), OR
//     - triggers generateMoviePlan() directly (if a story is already written).
//
// HOW IT FITS:
//   - 100% form. No async actions inside the tab — everything goes through
//     setters / handlers passed in from the parent.
//   - All constant lists (GENRES, FORMATS, etc.) live as module-level constants
//     in page.tsx; we pass them in as props so a future content edit on those
//     lists only needs to touch page.tsx and not this file.
//
// PROPS = ONE OBJECT, ONE CONTRACT:
//   Every prop documented in one line so a junior dev can read the interface
//   top-down and know exactly what the tab needs.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";

// Format card shape: matches the parent's FORMATS const. Optional fields are
// rendered conditionally so the prop type stays permissive.
export interface DesignFormatOption {
  id: string;
  label: string;
  desc: string;
  cost: string;
  badge?: string;
  badgeColor: string;
  detail?: string;
}

// Planning-depth shape: same idea as DesignFormatOption but for the AI tier card.
export interface DesignPlanningDepthOption {
  id: string;
  label: string;
  desc: string;
  cost: string;
  badge?: string;
  badgeColor: string;
  detail?: string;
}

// Production mode shape: id + label + short description.
export interface DesignProductionModeOption {
  id: string;
  label: string;
  desc: string;
}

// Character-style shape: matches the parent's CHARACTER_STYLES const.
export interface DesignCharacterStyleOption {
  id: string;
  label: string;
}

export interface DesignTabProps {
  // ── Style tokens (from parent's design system) ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  accent: string;
  blue: string;
  green: string;
  gold: string;
  purple: string;
  /**
   * Pill-button style factory. Identical signature to parent's local helper:
   *   pillStyle(isSelected, optionalColor) → React.CSSProperties.
   */
  pillStyle: (selected: boolean, color?: string) => React.CSSProperties;

  // ── Constants (passed in so design changes stay in page.tsx) ──
  /** Genre tags (e.g., "Drama", "Comedy"). */
  GENRES: ReadonlyArray<string>;
  /** Storytelling style tags (e.g., "Action", "Slow Burn"). */
  STYLES: ReadonlyArray<string>;
  /** Production format radio options (4-6 cards). */
  FORMATS: ReadonlyArray<DesignFormatOption>;
  /** Production mode pills (full/quick/etc). */
  PRODUCTION_MODES: ReadonlyArray<DesignProductionModeOption>;
  /** Character visual style pills (realistic / 3D / 2D / etc). */
  CHARACTER_STYLES: ReadonlyArray<DesignCharacterStyleOption>;
  /** Tone tags (mood adjectives). */
  TONES: ReadonlyArray<string>;
  /** Setting/world tags. */
  SETTINGS: ReadonlyArray<string>;
  /** AI intelligence tier cards. */
  PLANNING_DEPTHS: ReadonlyArray<DesignPlanningDepthOption>;

  // ── State READ ──
  genre: string;
  style: string;
  format: string;
  productionMode: string;
  movieCharacterStyle: string;
  tone: string;
  setting: string;
  planningDepth: string;
  storyAiProvider: string;
  /** Project visual style (effective: respects projectSettings override). */
  effectiveProjectStyle: string;
  /** Current story idea — controls whether the CTA bounces to story or fires the planner. */
  idea: string;
  /** True while generateMoviePlan() is in flight. */
  planning: boolean;

  // ── State WRITE ──
  setGenre: (value: string) => void;
  setStyle: (value: string) => void;
  setFormat: (value: string) => void;
  setProductionMode: (value: string) => void;
  /** Movie character style picker — parent state is narrow union; cast at prop-pass. */
  setMovieCharacterStyle: (value: string) => void;
  setTone: (value: string) => void;
  setSetting: (value: string) => void;
  setPlanningDepth: (value: string) => void;
  setStoryAiProvider: (value: string) => void;
  /**
   * Picks the video art style. Parent does:
   *   setProjectStyle(id);
   *   patchProjectSettings({ visualStyle: id }).catch(noop);
   *   setLastAction(`Art style: ${nameLabel}`);
   * Bundled here so the tab doesn't need to know about persistence.
   */
  onPickArtStyle: (id: string, nameLabel: string) => void;

  // ── Actions ──
  /** Fires the AI planner. Only called when an idea exists. */
  generateMoviePlan: () => void | Promise<void>;
  /** Tab nav — narrowed to "story" (the only destination from this tab). */
  setActiveTab: (tab: "story") => void;
  /** Latest-action banner setter (used when user moves on without firing the planner). */
  setLastAction: (msg: string) => void;
}

export default function DesignTab(props: DesignTabProps) {
  const {
    cardStyle, labelStyle, s2, border, muted, accent, blue, green, gold, purple, pillStyle,
    GENRES, STYLES, FORMATS, PRODUCTION_MODES, CHARACTER_STYLES, TONES, SETTINGS, PLANNING_DEPTHS,
    genre, style, format, productionMode, movieCharacterStyle, tone, setting, planningDepth, storyAiProvider,
    effectiveProjectStyle, idea, planning,
    setGenre, setStyle, setFormat, setProductionMode, setMovieCharacterStyle,
    setTone, setSetting, setPlanningDepth, setStoryAiProvider, onPickArtStyle,
    generateMoviePlan, setActiveTab, setLastAction,
  } = props;

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Design Your Movie</h2>
        <p style={{ fontSize: 12, color: muted, marginBottom: 24 }}>These layers tell AI how to plan your production.</p>

        {/* Genre — simple pill row */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Story Genre</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GENRES.map(g => <button key={g} onClick={() => setGenre(g)} style={pillStyle(genre === g)}>{g}</button>)}
          </div>
        </div>

        {/* Storytelling Style */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Storytelling Style</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STYLES.map(s => <button key={s} onClick={() => setStyle(s)} style={pillStyle(style === s, blue)}>{s}</button>)}
          </div>
        </div>

        {/* Production Format — big radio cards with optional badge + detail panel */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Production Format</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FORMATS.map(f => {
              const isSelected = format === f.id;
              const color = f.badgeColor;
              return (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 18px", borderRadius: 14, border: `2px solid ${isSelected ? color : border}`, background: isSelected ? `${color}08` : "transparent", cursor: "pointer", textAlign: "left", transition: "all 0.2s", position: "relative" }}>
                  {f.badge && (
                    <span style={{ position: "absolute", top: -1, right: 16, fontSize: 8, fontWeight: 800, padding: "3px 10px", borderRadius: "0 0 8px 8px", background: color, color: f.badge === "BUDGET" || f.badge === "FREE" ? "#000" : "#fff", letterSpacing: 0.5 }}>
                      {f.badge}
                    </span>
                  )}
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isSelected ? color : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{f.label}</p>
                      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{f.cost}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#8090a0", lineHeight: 1.5 }}>{f.desc}</p>
                    {isSelected && f.detail && (
                      <p style={{ fontSize: 11, color: "#5a7080", lineHeight: 1.6, marginTop: 8, padding: "10px 12px", borderRadius: 8, background: s2, border: `1px solid ${border}` }}>
                        {f.detail}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Production Mode */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Production Mode</label>
          <div style={{ display: "flex", gap: 8 }}>
            {PRODUCTION_MODES.map(m => (
              <button key={m.id} onClick={() => setProductionMode(m.id)}
                style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `1px solid ${productionMode === m.id ? green : border}`, background: productionMode === m.id ? "rgba(34,197,94,0.06)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{m.label}</p>
                <p style={{ fontSize: 10, color: muted }}>{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Character Visual Style */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Character Visual Style</label>
          <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>This style is applied to all character portrait generation prompts.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {CHARACTER_STYLES.map(cs => (
              <button key={cs.id} onClick={() => setMovieCharacterStyle(cs.id)}
                style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${movieCharacterStyle === cs.id ? purple : border}`, background: movieCharacterStyle === cs.id ? `${purple}15` : "transparent", color: movieCharacterStyle === cs.id ? "#fff" : muted, fontSize: 12, fontWeight: movieCharacterStyle === cs.id ? 700 : 400, cursor: "pointer" }}>
                {cs.label}
              </button>
            ))}
          </div>
          {movieCharacterStyle !== "realistic" && (
            <p style={{ fontSize: 10, color: muted, marginTop: 8 }}>
              Portrait prompt suffix: &quot;{movieCharacterStyle.replace(/_/g, " ")} style character portrait, high quality rendering&quot;
            </p>
          )}
        </div>

        {/* Tone + Setting side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>Tone / Mood</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TONES.map(t => <button key={t} onClick={() => setTone(t)} style={{ ...pillStyle(tone === t, "#ec4899"), fontSize: 11, padding: "6px 12px" }}>{t}</button>)}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Setting / World</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SETTINGS.map(s => <button key={s} onClick={() => setSetting(s)} style={{ ...pillStyle(setting === s, blue), fontSize: 11, padding: "6px 12px" }}>{s}</button>)}
            </div>
          </div>
        </div>

        {/* AI Intelligence Tier */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>AI Intelligence Tier</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PLANNING_DEPTHS.map(p => {
              const isSelected = planningDepth === p.id;
              const color = p.badgeColor;
              return (
                <button key={p.id} onClick={() => setPlanningDepth(p.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, border: `1px solid ${isSelected ? color : border}`, background: isSelected ? `${color}08` : "transparent", cursor: "pointer", textAlign: "left", position: "relative" }}>
                  {p.badge && (
                    <span style={{ position: "absolute", top: -1, right: 14, fontSize: 8, fontWeight: 800, padding: "2px 8px", borderRadius: "0 0 6px 6px", background: color, color: p.badge === "PREMIUM" ? "#000" : "#fff" }}>
                      {p.badge}
                    </span>
                  )}
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? color : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.label}</p>
                      <span style={{ fontSize: 10, color }}>{p.cost}</span>
                    </div>
                    <p style={{ fontSize: 11, color: muted }}>{p.desc}</p>
                    {isSelected && p.detail && (
                      <p style={{ fontSize: 10, color: "#5a7080", marginTop: 6, padding: "8px 10px", borderRadius: 6, background: s2, border: `1px solid ${border}` }}>
                        {p.detail}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Story Expansion LLM picker */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Story Expansion Intelligence</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { value: "ollama",                           label: "Local LLM",   sub: "Ollama · Free · No cloud cost",                     color: green,     badge: "FREE"  },
              { value: "claude:claude-haiku-4-5-20251001", label: "Standard",    sub: "Claude Haiku 4.5 · Fast · Low cost",                color: blue,      badge: "FAST"  },
              { value: "claude:claude-sonnet-4-6",         label: "Pro",         sub: "Claude Sonnet 4.6 · Best balance · Recommended",    color: accent,    badge: "REC"   },
              { value: "claude:claude-opus-4-7",           label: "Premium",     sub: "Claude Opus 4.7 · Highest quality · Most powerful", color: gold,      badge: "TOP"   },
              { value: "openai:gpt-4o-mini",               label: "GPT-4o Mini", sub: "OpenAI · Fast · Requires OPENAI_API_KEY",           color: "#fb923c", badge: "GPT"   },
              { value: "openai:gpt-4o",                    label: "GPT-4o",      sub: "OpenAI · Best quality · Requires OPENAI_API_KEY",   color: "#f87171", badge: "GPT+"  },
              { value: "openai:o1-mini",                   label: "o1-mini",     sub: "OpenAI reasoning model · Deep analysis",            color: "#f97316", badge: "THINK" },
            ].map(tier => {
              const sel = storyAiProvider === tier.value;
              return (
                <button key={tier.value} onClick={() => setStoryAiProvider(tier.value)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: `1px solid ${sel ? tier.color : border}`, background: sel ? `${tier.color}10` : "transparent", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${sel ? tier.color : "#3d5060"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {sel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: tier.color }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{tier.label}</span>
                      <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 20, background: `${tier.color}20`, color: tier.color, fontWeight: 700 }}>{tier.badge}</span>
                    </div>
                    <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{tier.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Video Art Style — drives scene image generation */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Video Art Style</label>
          <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>Controls how scene images look. Applied to every generated image.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { id: "realistic",    icon: "RL", name: "Realistic",    color: "#ec4899", example: "Like: a real film or Netflix drama",          desc: "Photorealistic — looks like an actual photograph." },
              { id: "3d-cinematic", icon: "3D", name: "3D Cinematic", color: "#00d4ff", example: "Like: Toy Story, Moana, Kung Fu Panda",        desc: "3D animated movie quality. Rich lighting and depth." },
              { id: "2d-cartoon",   icon: "2D", name: "2D Cartoon",   color: "#f59e0b", example: "Like: SpongeBob, old Disney, cartoon shows",    desc: "Flat bold colors with thick outlines. Fun and simple." },
              { id: "anime",        icon: "AN", name: "Anime",        color: "#a855f7", example: "Like: Naruto, Dragon Ball, My Hero Academia",   desc: "Japanese animation style. Big expressive eyes." },
              { id: "storybook",    icon: "SB", name: "Storybook",    color: "#22c55e", example: "Like: children's picture books, Peppa Pig",    desc: "Soft, warm and painterly. Gentle and cozy." },
            ].map(s => {
              const isSel = effectiveProjectStyle === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => onPickArtStyle(s.id, s.name)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${isSel ? s.color : border}`, background: isSel ? `${s.color}10` : "transparent" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: s.color, minWidth: 26, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isSel ? s.color : "#fff" }}>{s.name}</span>
                      {isSel && <span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 6, background: s.color, color: "#000", fontWeight: 800 }}>ACTIVE</span>}
                      <span style={{ fontSize: 9, color: s.color, marginLeft: 2 }}>{s.example}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA: confirm design → story, OR generate directly if story already written */}
        <div style={{ display: "flex", gap: 10 }}>
          {!idea.trim() ? (
            <button
              onClick={() => { setActiveTab("story"); setLastAction("Design set — write your story"); }}
              disabled={!genre}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: genre ? gold : "#2a2a40", color: "#000", fontSize: 14, fontWeight: 700, cursor: genre ? "pointer" : "not-allowed" }}>
              {genre ? "Design Set — Write Story" : "Select a genre above first"}
            </button>
          ) : (
            <button
              onClick={() => generateMoviePlan()}
              disabled={!idea.trim() || planning}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (idea.trim() && !planning) ? accent : "#2a2a40", color: "#fff", fontSize: 16, fontWeight: 700, cursor: (idea.trim() && !planning) ? "pointer" : "not-allowed" }}>
              {planning ? "Generating Movie Plan..." : "Generate Movie Plan"}
            </button>
          )}
          {idea.trim() && !planning && (
            <button
              onClick={() => setActiveTab("story")}
              style={{ padding: "16px 20px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
              Edit Story
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
