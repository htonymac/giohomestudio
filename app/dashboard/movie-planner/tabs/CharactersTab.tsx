"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharactersTab — cast management for the movie planner.
//
// SECTIONS:
//   1. Header — "Cast (N selected)" + "+ Create New" link + "Show Library" toggle
//   2. "Build Story Characters with AI" card — portrait-model picker + CTA
//   3. Inline CharacterPicker (hidden by default)
//   4. Saved-characters grid — image, name, Add/Remove, per-character portrait-
//      model picker, "Generate Portrait (3 shots)" button, 3-shot strip
//   5. "Assign Roles" card — role picker per selected cast member
//
// The portrait-generation handler is OWNED BY THE PARENT and passed in as
// `generatePortrait(char)`. It fans out to 4-5 setters + a PATCH to
// /api/character-voices/<id>. Keeping it in the parent means this tab stays free
// of API knowledge.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";
import CharacterPicker from "../../../components/CharacterPicker";

export interface CharactersTabSavedChar {
  id: string;
  name: string;
  role?: string;
  description?: string;
  imageUrl?: string;
  characterId?: string;
  voiceName?: string;
}
export interface CharactersTabCastMember { characterId: string; role: string }
export interface CharactersTabShot { url: string; angle: string; label?: string }

export interface CharactersTabProps {
  // ── Header ──
  selectedCast: CharactersTabCastMember[];
  showCharacterPicker: boolean;
  setShowCharacterPicker: React.Dispatch<React.SetStateAction<boolean>>;

  // ── "Build Cast" card ──
  castGenError: string | null;
  generatedCast: ReadonlyArray<unknown>;
  /** Default portrait model for new "Build Cast" runs. */
  castPortraitModel: string;
  setCastPortraitModel: (v: string) => void;
  generateCastFromStory: () => void | Promise<void>;
  castGenerating: boolean;
  expandedStory: string;
  idea: string;

  // ── CharacterPicker import ──
  savedCharacters: CharactersTabSavedChar[];
  setSavedCharacters: React.Dispatch<React.SetStateAction<CharactersTabSavedChar[]>>;
  addToCast: (charId: string) => void;
  setLastAction: (msg: string) => void;

  // ── Cards grid ──
  loadingChars: boolean;
  removeCast: (charId: string) => void;
  /** Per-character portrait model overrides (empty key = falls back to castPortraitModel). */
  charPortraitModel: Record<string, string>;
  setCharPortraitModel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Cached portrait shots per character. */
  charRefImages: Record<string, CharactersTabShot[]>;
  /**
   * Runs the 3-shot portrait pipeline for a single character. Parent owns
   * all side-effects (state updates + PATCH /api/character-voices/<id>).
   */
  generatePortrait: (char: CharactersTabSavedChar) => void | Promise<void>;

  // ── Assign Roles card ──
  ROLES: ReadonlyArray<string>;
  setCastRole: (charId: string, role: string) => void;

  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  s2: string;
  surface: string;
  border: string;
  muted: string;
  accent: string;
  green: string;
  red: string;
  purple: string;
}

export default function CharactersTab(props: CharactersTabProps) {
  const {
    selectedCast, showCharacterPicker, setShowCharacterPicker,
    castGenError, generatedCast, castPortraitModel, setCastPortraitModel,
    generateCastFromStory, castGenerating, expandedStory, idea,
    savedCharacters, setSavedCharacters, addToCast, setLastAction,
    loadingChars, removeCast,
    charPortraitModel, setCharPortraitModel, charRefImages, generatePortrait,
    ROLES, setCastRole,
    cardStyle, labelStyle, inputStyle, s2, surface, border, muted, accent, green, red, purple,
  } = props;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Cast ({selectedCast.length} selected)</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard/character-voices?returnTo=movie-planner" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${accent}30`, background: "transparent", color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              + Create New
            </button>
          </a>
          <button onClick={() => setShowCharacterPicker(prev => !prev)}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
            {showCharacterPicker ? "Hide Library" : "or import saved →"}
          </button>
        </div>
      </div>

      {/* Build Story Characters with AI */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${purple}40`, background: `${purple}08` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Icon.Star style={{ width: 18, height: 18, color: purple, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Build Story Characters with AI</p>
            <p style={{ fontSize: 11, color: muted }}>AI reads your story and builds the full cast — names, roles, voices, ready to use.</p>
          </div>
        </div>
        {castGenError && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: `${red}10`, border: `1px solid ${red}30`, marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: red }}>{castGenError}</p>
          </div>
        )}
        {generatedCast.length > 0 && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: `${green}08`, border: `1px solid ${green}25`, marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: green, fontWeight: 600 }}>{generatedCast.length} cast members generated and added below.</p>
          </div>
        )}
        <PortraitModelPicker value={castPortraitModel} onChange={setCastPortraitModel} />
        <button onClick={generateCastFromStory}
          disabled={castGenerating || (!expandedStory && !idea.trim())}
          title={(!expandedStory && !idea.trim()) ? "Write your story first" : ""}
          style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: castGenerating ? "#2a2040" : (!expandedStory && !idea.trim()) ? "#1a1a2a" : `linear-gradient(135deg, ${purple}, #7c3aed)`, color: (!expandedStory && !idea.trim()) ? muted : "#fff", fontSize: 13, fontWeight: 700, cursor: castGenerating || (!expandedStory && !idea.trim()) ? "not-allowed" : "pointer" }}>
          {castGenerating ? "Building characters from story..." : generatedCast.length > 0 ? "Rebuild Story Characters with AI" : "Build Story Characters with AI"}
        </button>
        {!expandedStory && !idea.trim() && (
          <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Write your story first in the Story tab, then come back here.</p>
        )}
      </div>

      {/* Optional CharacterPicker import */}
      {showCharacterPicker && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Import from Character Library</p>
            <button onClick={() => setShowCharacterPicker(false)}
              style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
              Close
            </button>
          </div>
          <CharacterPicker
            onSelect={(char) => {
              setSavedCharacters(prev => {
                if (prev.some(c => c.id === char.id)) return prev;
                return [...prev, { id: char.id, name: char.name, role: char.role || "supporting", description: char.visualDescription || "", imageUrl: char.imageUrl || "", characterId: char.characterId || "", voiceName: char.voiceName || "" }];
              });
              addToCast(char.id);
              setLastAction(`Imported character "${char.name}"`);
            }}
            onCreateNew={() => { window.open(`/dashboard/character-voices?returnTo=movie-planner`, "_blank"); }}
            compact
          />
        </div>
      )}

      {/* Cards grid */}
      {loadingChars ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading characters...</p>
      ) : savedCharacters.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No saved characters yet.</p>
          <a href="/dashboard/character-voices?returnTo=movie-planner" style={{ fontSize: 12, color: accent, textDecoration: "none" }}>Create characters first</a>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
          {savedCharacters.map(char => {
            const inCast = selectedCast.some(c => c.characterId === char.id);
            return (
              <div key={char.id} style={{ ...cardStyle, padding: 0, overflow: "hidden", borderColor: inCast ? `${green}40` : border }}>
                {/* Image (click toggles cast) */}
                <div style={{ height: 80, background: s2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" }}
                  onClick={() => inCast ? removeCast(char.id) : addToCast(char.id)}>
                  {char.imageUrl ? (
                    <img src={char.imageUrl.startsWith("http") || char.imageUrl.startsWith("/api/") ? char.imageUrl : `/api/media/${char.imageUrl.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Icon.User style={{ width: 32, height: 32, color: muted, opacity: 0.3 }} />
                  )}
                  {inCast && <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: green, display: "flex", alignItems: "center", justifyContent: "center", color: "#000" }}><Icon.Check style={{ width: 12, height: 12 }} /></div>}
                  {char.characterId && <span style={{ position: "absolute", bottom: 4, left: 6, fontSize: 8, fontFamily: "monospace", color: purple, background: "rgba(0,0,0,0.7)", padding: "1px 5px", borderRadius: 4 }}>{char.characterId}</span>}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{char.name}</p>
                  <p style={{ fontSize: 10, color: muted }}>{char.role || "supporting"}{char.voiceName ? ` · ${char.voiceName}` : ""}</p>
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <button onClick={() => inCast ? removeCast(char.id) : addToCast(char.id)}
                      style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${inCast ? red : green}30`, background: `${inCast ? red : green}06`, color: inCast ? red : green, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                      {inCast ? "Remove" : "Add to Cast"}
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <PortraitModelPicker
                        value={charPortraitModel[char.id] || castPortraitModel}
                        onChange={(v) => setCharPortraitModel(prev => ({ ...prev, [char.id]: v }))}
                        marginTop={8}
                      />
                      <button onClick={() => generatePortrait(char)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${purple}30`, background: `${purple}06`, color: purple, fontSize: 9, cursor: "pointer" }}>
                        {charRefImages[char.id]?.length > 0 ? "Regenerate (3 shots)" : "Generate Portrait (3 shots)"}
                      </button>
                      {charRefImages[char.id]?.length > 0 && (
                        <div style={{ flexBasis: "100%", marginTop: 8, padding: "8px 10px", background: "#0f172a", borderRadius: 6, border: `1px solid ${purple}20` }}>
                          <p style={{ fontSize: 8, color: muted, marginBottom: 5, fontWeight: 600 }}>Full body shots — click to set as main</p>
                          <div style={{ display: "flex", gap: 4 }}>
                            {charRefImages[char.id].map((shot, i) => {
                              const isMain = savedCharacters.find(c => c.id === char.id)?.imageUrl === shot.url;
                              const ANGLE_NAME: Record<string, string> = { front: "Front", "three-quarter": "3/4", side: "Side" };
                              return (
                                <div key={i}
                                  onClick={() => setSavedCharacters(prev => prev.map(c => c.id === char.id ? { ...c, imageUrl: shot.url } : c))}
                                  style={{ cursor: "pointer", textAlign: "center" }}>
                                  <img src={shot.url} alt={shot.angle} style={{ width: 48, height: 72, objectFit: "cover", borderRadius: 5, border: isMain ? `2px solid ${purple}` : `1px solid ${border}`, display: "block" }} />
                                  <span style={{ fontSize: 7, color: isMain ? purple : muted, fontWeight: isMain ? 700 : 400 }}>{isMain ? "MAIN" : ANGLE_NAME[shot.angle] || shot.angle}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assigned roles */}
      {selectedCast.length > 0 && (
        <div style={cardStyle}>
          <label style={labelStyle}>Assign Roles</label>
          {selectedCast.map(c => {
            const char = savedCharacters.find(ch => ch.id === c.characterId);
            return (
              <div key={c.characterId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", minWidth: 100 }}>{char?.name}</span>
                <select value={c.role} onChange={e => setCastRole(c.characterId, e.target.value)} style={{ ...inputStyle, width: 160, padding: "8px 12px", fontSize: 12 }}>
                  {ROLES.map(r => <option key={r} value={r} style={{ background: surface }}>{r}</option>)}
                </select>
                <button onClick={() => removeCast(c.characterId)} style={{ fontSize: 11, color: red, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shared portrait-model picker — used both for the cast-default and per-character
// rows. Kept in the same file so junior devs don't have to track a one-off
// component to a separate location.
function PortraitModelPicker(p: { value: string; onChange: (v: string) => void; marginTop?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: p.marginTop ?? 8, marginBottom: 10 }}>
      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>Model</span>
      <select
        value={p.value}
        onChange={e => p.onChange(e.target.value)}
        style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid #ffffff20", background: "#0f172a", color: "#e2e8f0", outline: "none", flex: 1 }}>
        <option value="segmind_flux">Flux Free ($0.0004) — drafts</option>
        <option value="fal_flux_schnell">Flux Schnell ($0.003) — fast+good</option>
        <option value="segmind_pruna">Pruna ($0.005) — fast</option>
        <option value="fal_ideogram_v3_turbo">Ideogram v3 ($0.02) — text/ads</option>
        <option value="fal_flux_dev">Flux Dev ($0.025) — quality</option>
        <option value="fal_flux_pro">Flux Pro ($0.05) — best</option>
        <option value="fal_flux_pulid">Face Lock / PuLID — real photo only</option>
      </select>
    </div>
  );
}
