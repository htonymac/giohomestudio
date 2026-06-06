"use client";

// First Review tab — mandatory safety check before AI generates visuals.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 1 of segregation, 2026-06-05).
//
// Lifts ~54 lines out of the parent god-file. Reads parent state via explicit
// props (no context, no bag-of-everything). Per the children-planner
// segregation plan, this is a LOW-risk tab: pure presentation + 1 mutating
// callback (toggle review1Done) + 1 action (generateChildrenContent).

import * as React from "react";
import * as Icon from "../../../components/icons";

interface NarrationStyle { id: string; label: string }
interface VisualStyle { id: string; label: string }
interface MusicChoice { id: string; label: string }

export interface Review1TabProps {
  // ── State READ ──
  textContent: string;
  styleProgress: number;
  ageParam: string;
  narrationStyle: string;
  effectiveProjectStyle: string;
  musicChoice: string;
  review1Done: boolean;
  generating: boolean;
  generationProgress: string;
  generationError: string | null;
  // ── Constants ──
  NARRATION_STYLES: ReadonlyArray<NarrationStyle>;
  VISUAL_STYLES: ReadonlyArray<VisualStyle>;
  MUSIC_CHOICES: ReadonlyArray<MusicChoice>;
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  childSafe: string;
  muted: string;
  s2: string;
  border: string;
  // ── State WRITE ──
  setReview1Done: (v: boolean) => void;
  setLastAction: (s: string) => void;
  // ── Action ──
  generateChildrenContent: () => Promise<void> | void;
}

export default function Review1Tab(props: Review1TabProps) {
  const {
    textContent, styleProgress, ageParam, narrationStyle, effectiveProjectStyle,
    musicChoice, review1Done, generating, generationProgress, generationError,
    NARRATION_STYLES, VISUAL_STYLES, MUSIC_CHOICES,
    cardStyle, childSafe, muted, s2, border,
    setReview1Done, setLastAction, generateChildrenContent,
  } = props;

  return (
    <div style={{ ...cardStyle, padding: 28, border: `2px solid ${childSafe}40` }}>
      {/* Warning if not ready */}
      {(!textContent || styleProgress < 100) && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Content or style not yet configured</p>
          <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>
            {!textContent ? "Go to Content Input to enter your text. " : ""}
            {styleProgress < 100 ? "Go to Style & Voice to configure all settings." : ""}
          </p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Icon.Check style={{ width: 22, height: 22, color: childSafe, flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>First Review — Safety Check</h2>
          <p style={{ fontSize: 11, color: muted }}>Review the plan before AI generates visuals. This is mandatory for children content.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Content Interpretation", check: "Text matches intended learning goal" },
          { label: "Age Appropriateness", check: `Content suitable for ${ageParam || "target"} age group` },
          { label: "Narration Style", check: `${NARRATION_STYLES.find(n => n.id === narrationStyle)?.label} selected` },
          { label: "Visual Plan", check: `${VISUAL_STYLES.find(v => v.id === effectiveProjectStyle)?.label} — child-safe colors` },
          { label: "Word Difficulty", check: "Words match selected age level" },
          { label: "Music Suitability", check: `${MUSIC_CHOICES.find(m => m.id === musicChoice)?.label} — narration priority` },
        ].map(item => (
          <div key={item.label} style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{item.label}</p>
            </div>
            <p style={{ fontSize: 10, color: childSafe }}>{item.check}</p>
          </div>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={review1Done}
          onChange={e => { setReview1Done(e.target.checked); if (e.target.checked) setLastAction("Review 1 approved"); }}
          style={{ marginTop: 3, accentColor: childSafe }}
        />
        <span style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6 }}>
          I have reviewed the plan above. The content type, age group, narration style, visual style, and music choice are appropriate for children. I approve generating the preview.
        </span>
      </label>

      <button
        onClick={generateChildrenContent}
        disabled={!review1Done || generating}
        style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (!review1Done || generating) ? "#2a2a40" : childSafe, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!review1Done || generating) ? "not-allowed" : "pointer" }}
      >
        {generating ? (generationProgress || "Generating child-safe preview...") : "Approved — Generate Preview"}
      </button>
      {generationError && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{generationError}</p>}
    </div>
  );
}
