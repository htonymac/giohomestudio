"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ScriptTab — formatted screenplay editor + parser.
//
// WHAT THIS TAB DOES:
//   1. Shows a "Generate Screenplay" CTA before any script exists.
//   2. Once generated (or pasted), shows a Courier-font editor + a print-style
//      preview (white paper, title-page, INT./EXT. scene heading recognition).
//   3. Lets the user "Parse Script" → splits text into narrator + dialogue
//      segments (so the Sound tab can assign voices per character).
//   4. "Send to Scenes" — pushes the parsed script to the Scenes tab pipeline.
//
// HOW IT FITS IN THE WORKSHOP:
//   - Reads `idea` / `expandedStory` from parent so the empty state can
//     deep-link the user back to the Story tab if no idea exists yet.
//   - Reads `moviePlan` to know whether "Send to Scenes" should be enabled.
//   - All actions (generate / parse / send) are async handlers owned by the
//     parent. This tab is pure JSX that delegates.
//
// PROPS = ONE OBJECT, ONE CONTRACT:
//   Every prop has a one-line comment explaining its role so a junior dev
//   reading just the interface knows the tab's full surface area.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";
import type { ScriptSegment } from "./_shared-types";

// Re-export so siblings (e.g., SoundTab later) can import the same shape from here.
export type { ScriptSegment };

export interface ScriptTabProps {
  // ── State READ ──────────────────────────────────────────────────────────
  /** The raw screenplay text (Courier-formatted). Empty until generated. */
  screenplay: string;
  /** True while the screenplay-generation API call is in flight. */
  generatingScreenplay: boolean;
  /** User's seed idea — used to decide if "Go to Story" CTA should show. */
  idea: string;
  /** AI-expanded story — same role as `idea` (either being non-empty unlocks generate). */
  expandedStory: string;
  /** Free-form text the user types as their author name (shown on the title page). */
  screenplayAuthor: string;
  /** Last error message from generate-screenplay (or empty string for none). */
  screenplayError: string;
  /** True while the parse-script API call is in flight. */
  parsingScript: boolean;
  /** Parsed segments after a successful "Parse Script" run. */
  scriptSegments: ScriptSegment[];
  /** Toggles the "Parsed Script — N segments" preview card. */
  showScriptReview: boolean;
  /** True while the send-to-scenes call is in flight. */
  sendingToScenes: boolean;
  /** Result banner after "Send to Scenes" (empty = no banner). */
  sendToScenesResult: string;
  /** Set when the user has built a movie plan. "Send to Scenes" needs this. */
  hasMoviePlan: boolean;
  /** Project title — used as the file name on `.txt` download + title page. */
  title: string;
  /** Genre + tone — used as a subtitle on the print preview. */
  genre: string;
  tone: string;

  // ── Style tokens (from parent's design system) ──────────────────────────
  /** Reusable card container style (border + padding + bg). */
  cardStyle: React.CSSProperties;
  /** Reusable textarea/input style. */
  inputStyle: React.CSSProperties;
  /** Surface-2 colour (slightly raised background). */
  s2: string;
  /** Border colour. */
  border: string;
  /** Muted text colour. */
  muted: string;
  /** Accent colour (gold). */
  accent: string;
  /** Primary purple accent (used for screenplay actions). */
  purple: string;
  /** Blue accent (used for parse-script button). */
  blue: string;
  /** Gold accent (used for "Send to Scenes" CTA). */
  gold: string;
  /** Red colour (for errors). */
  red: string;

  // ── State WRITE / nav ───────────────────────────────────────────────────
  /**
   * Tab-switch dispatcher. Narrowed to the exact destinations this tab uses:
   *   "story" — empty state CTA → back to Story tab.
   *   "sound" — "Go to Voice & Audio" after a successful send.
   */
  setActiveTab: (tab: "story" | "sound") => void;
  /** Updates the author name input. */
  setScreenplayAuthor: (value: string) => void;
  /** Replaces the full screenplay text (used by paste + editor). */
  setScreenplay: (value: string) => void;
  /** Closes the parsed-script review card. */
  setShowScriptReview: (open: boolean) => void;

  // ── Actions (parent-owned async handlers) ───────────────────────────────
  /** Async: POSTs to /api/movie/screenplay and stores the result. */
  generateScreenplay: () => void | Promise<void>;
  /** Async: parses `screenplay` into `scriptSegments`. */
  parseScript: () => void | Promise<void>;
  /** Async: pushes parsed segments into the Scenes tab pipeline. */
  sendScreenplayToScenes: () => void | Promise<void>;
}

export default function ScriptTab(props: ScriptTabProps) {
  const {
    screenplay, generatingScreenplay, idea, expandedStory,
    screenplayAuthor, screenplayError, parsingScript, scriptSegments,
    showScriptReview, sendingToScenes, sendToScenesResult, hasMoviePlan,
    title, genre, tone,
    cardStyle, inputStyle, s2, border, muted, accent, purple, blue, gold, red,
    setActiveTab, setScreenplayAuthor, setScreenplay, setShowScriptReview,
    generateScreenplay, parseScript, sendScreenplayToScenes,
  } = props;

  return (
    <div>
      {/* ── Empty state: no screenplay, not generating ─────────────────── */}
      {!screenplay && !generatingScreenplay && (
        <div style={{ ...cardStyle, borderColor: `${purple}20`, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Screenplay</p>
          <p style={{ fontSize: 11, color: muted, marginBottom: 16 }}>Generate a full formatted screenplay from your story, or paste your own script below and parse it into narrator/dialogue segments.</p>
          {!idea.trim() && !expandedStory ? (
            // No story seed yet — bounce user to the Story tab.
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Write your story idea first — go to Story & Draft tab.</p>
              <button onClick={() => setActiveTab("story")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Story</button>
            </div>
          ) : (
            // Story exists — show generate + paste options.
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>Written by:</span>
                <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Your name"
                  style={{ flex: 1, background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", maxWidth: 280 }} />
              </div>
              {screenplayError && <p style={{ fontSize: 11, color: red, marginBottom: 8 }}>{screenplayError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={generateScreenplay}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Generate Screenplay
                </button>
                <button onClick={() => setScreenplay("FADE IN:\n\nINT. SCENE ONE - DAY\n\nPaste your screenplay here...\n\nFADE OUT.\n\nTHE END")}
                  style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                  Paste My Own
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────────────── */}
      {generatingScreenplay && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <Icon.Wand style={{ width: 36, height: 36, color: muted, marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Writing your screenplay...</p>
          <p style={{ fontSize: 11, color: muted }}>15–30 seconds</p>
        </div>
      )}

      {/* ── Loaded screenplay: toolbar + editor + paper preview ────────── */}
      {screenplay && !generatingScreenplay && (
        <>
          {/* Toolbar — author input + 4 actions (Regen / Download / Parse / Send) */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
              <span style={{ fontSize: 10, color: muted }}>Written by:</span>
              <input type="text" value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Your name"
                style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", width: 160 }} />
            </div>
            <button onClick={generateScreenplay}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${purple}40`, background: "transparent", color: purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Regenerate
            </button>
            <button onClick={() => {
                // Build a .txt blob in-memory and trigger download. No server round-trip.
                const blob = new Blob([screenplay], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${title || "screenplay"}.txt`;
                a.click();
              }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Download .txt
            </button>
            <button onClick={parseScript} disabled={parsingScript}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : blue, color: "#000", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
              {parsingScript ? "Parsing..." : "Parse Script"}
            </button>
            <button onClick={sendScreenplayToScenes} disabled={sendingToScenes || !hasMoviePlan}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${gold}60` : gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes || !hasMoviePlan ? "default" : "pointer", opacity: !hasMoviePlan ? 0.4 : 1 }}>
              {sendingToScenes ? "Sending..." : "Send to Scenes →"}
            </button>
          </div>

          {/* Send result banner */}
          {sendToScenesResult && (
            <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${accent}10`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
              <Icon.Check style={{ width: 14, height: 14, color: accent, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: accent, flex: 1 }}>{sendToScenesResult}</p>
              <button onClick={() => setActiveTab("sound")} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Go to Voice & Audio</button>
            </div>
          )}

          {/* Parsed segments preview (collapsible) */}
          {showScriptReview && scriptSegments.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Parsed Script — {scriptSegments.length} segments</p>
                <button onClick={() => setShowScriptReview(false)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Hide</button>
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {scriptSegments.map((seg, i) => (
                  <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: seg.type === "dialogue" ? `${blue}10` : `${purple}10`, borderLeft: `3px solid ${seg.type === "dialogue" ? blue : purple}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: seg.type === "dialogue" ? blue : purple, textTransform: "uppercase", marginRight: 8 }}>
                      {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "NARR"}
                    </span>
                    <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor — raw Courier text the user can hand-edit */}
          <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
            style={{ ...inputStyle, minHeight: 400, fontFamily: "'Courier New', Courier, monospace", fontSize: 12, lineHeight: 1.8, resize: "vertical", whiteSpace: "pre-wrap" }} />

          {/* Print-style preview — white paper with title page + scene heading recognition.
              The split-then-classify pattern below mirrors how Final Draft / Celtx style
              screenplays: heading lines, transitions, character names, parentheticals, dialogue. */}
          <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
            <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
              <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>GIO HOME AI STUDIO</p>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(title || "UNTITLED").toUpperCase()}</h1>
              {(genre || tone) && <p style={{ fontSize: 11, color: "#777", marginBottom: 24, fontStyle: "italic" }}>{[genre, tone].filter(Boolean).join(" · ")}</p>}
              <p style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Written by</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 20 }}>{screenplayAuthor || "—"}</p>
              <p style={{ fontSize: 8, color: "#aaa", letterSpacing: 1 }}>AI Assets by GIO HOME AI STUDIO · © {new Date().getFullYear()}</p>
            </div>
            <div style={{ color: "#111", fontSize: 12, lineHeight: 2 }}>
              {screenplay.split("\n").map((line, i) => {
                const t = line.trim();
                if (!t) return <div key={i} style={{ height: 6 }} />;
                // Scene heading (INT./EXT./INT/EXT.)
                if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(t)) return <p key={i} style={{ fontWeight: 700, color: "#000", marginTop: 24, marginBottom: 2 }}>{t}</p>;
                // Transition (FADE IN: / CUT TO: etc.)
                if (/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:)/.test(t)) return <p key={i} style={{ fontStyle: "italic", color: "#555", marginTop: 12 }}>{t}</p>;
                // End marker
                if (t === "THE END") return <p key={i} style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginTop: 40, letterSpacing: 4 }}>THE END</p>;
                // Character name (ALL CAPS, <40 chars, no scene/transition prefix)
                if (/^[A-Z][A-Z\s\-'().]+$/.test(t) && t.length < 40 && !t.startsWith("INT") && !t.startsWith("EXT") && !t.startsWith("FADE") && !t.startsWith("CUT")) return <p key={i} style={{ fontWeight: 700, marginTop: 16, paddingLeft: "38%" }}>{t}</p>;
                // Parenthetical action note
                if (t.startsWith("(") && t.endsWith(")")) return <p key={i} style={{ fontStyle: "italic", color: "#555", paddingLeft: "30%" }}>{t}</p>;
                // Look backwards: if previous non-empty line was a character/parenthetical,
                // treat this as dialogue and centre-indent.
                const prev = screenplay.split("\n").slice(0, i).reverse().find(l => l.trim());
                const isDlg = prev && (/^[A-Z][A-Z\s\-'().]+$/.test(prev.trim()) || (prev.trim().startsWith("(") && prev.trim().endsWith(")")));
                if (isDlg) return <p key={i} style={{ color: "#222", paddingLeft: "20%", paddingRight: "20%" }}>{line}</p>;
                // Default: action block — left margin, default colour.
                return <p key={i} style={{ color: "#333", marginBottom: 2 }}>{line}</p>;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
