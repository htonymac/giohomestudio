"use client";

// Script & Story Plan tab — parses story into narrator/dialogue segments + lets user
// refine each scene with quick-tone presets (polish / funny / playful / adventure / etc).
// Extracted from app/dashboard/children-planner/page.tsx (Wave 1.3, 2026-06-05).

import * as React from "react";
import { ds } from "../../../../lib/designSystem";
import type { ChildScene, ScriptSegment, SceneRefineAction, SceneOp } from "./_shared-types";

export type { ChildScene, ScriptSegment };

export interface ScriptTabProps {
  // ── State READ ──
  textContent: string;
  childScenes: ChildScene[];
  scriptSegments: ScriptSegment[];
  polishingScene: string | null;
  parsingScript: boolean;
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  muted: string;
  border: string;
  childAccent: string;
  C2: string;
  // ── State WRITE / nav ──
  setActiveTab: (t: "content" | "sound") => void;
  setChildScenes: React.Dispatch<React.SetStateAction<ChildScene[]>>;
  setScriptSegments: React.Dispatch<React.SetStateAction<ScriptSegment[]>>;
  // ── Actions ──
  handlePolishScene: (sceneId: string, text: string, action: SceneRefineAction) => void | Promise<void>;
  handleChildSceneOp: (sceneId: string, text: string, op: SceneOp) => void | Promise<void>;
  handleAdultWordCheck: (sceneId: string, text: string) => void | Promise<void>;
  parseScript: () => void | Promise<void>;
}

const SCENE_PRESETS: Array<{ op: SceneOp; label: string; color: string }> = [
  { op: "funny",      label: "😄 Funny",      color: "#fbbf24" },
  { op: "playful",    label: "🎈 Playful",    color: "#f472b6" },
  { op: "adventure",  label: "🗡 Adventure",  color: "#06b6d4" },
  { op: "emotional",  label: "💗 Emotion",    color: "#ec4899" },
  { op: "add_action", label: "➕ Action",     color: "#fb923c" },
  { op: "establish",  label: "🌅 Establish",  color: "#fbbf24" },
];

export default function ScriptTab(props: ScriptTabProps) {
  const {
    textContent, childScenes, scriptSegments, polishingScene, parsingScript,
    cardStyle, muted, border, childAccent, C2,
    setActiveTab, setChildScenes, setScriptSegments,
    handlePolishScene, handleChildSceneOp, handleAdultWordCheck, parseScript,
  } = props;

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Script & Story Plan</h2>
        <p style={{ fontSize: 11, color: muted, marginBottom: 18 }}>
          Parse your story into narrator lines and character parts. Edit the segments, then move on to Voices & Sounds.
        </p>

        {!textContent && (
          <div style={{ padding: "20px 24px", borderRadius: 12, background: `${childAccent}08`, border: `1px solid ${childAccent}30`, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: childAccent, fontWeight: 600, marginBottom: 8 }}>Write your content first</p>
            <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Go to the Content tab and write your story before building the script.</p>
            <button
              onClick={() => setActiveTab("content")}
              style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Go to Content
            </button>
          </div>
        )}

        {textContent && (
          <div>
            {/* FIX 1 (2026-05-22): scene-edit toolbar lives HERE in Script tab, NOT Scene Board */}
            {childScenes.length > 0 && (
              <div style={{ marginBottom: 18, padding: 14, borderRadius: 10, background: `${childAccent}06`, border: `1px solid ${childAccent}25` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Refine Scenes</p>
                <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Edit each scene&apos;s visual description and apply child-safe AI rewrites. Image prompts read this — changes here flow to Scene Board on next regen.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
                  {childScenes.map(s => {
                    const sceneId = `child_sc${s.scene}`;
                    return (
                      <div key={sceneId} style={{ padding: 10, borderRadius: 8, background: "#0d0817", border: `1px solid ${border}` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: childAccent, marginBottom: 4 }}>SC{String(s.scene).padStart(2, "0")} — {s.title || "Untitled"}</p>
                        <textarea
                          value={s.visualDescription || ""}
                          onChange={e => setChildScenes(prev => prev.map(sc => sc.scene === s.scene ? { ...sc, visualDescription: e.target.value } : sc))}
                          rows={3}
                          style={{ width: "100%", background: "transparent", border: `1px solid ${border}`, borderRadius: 6, color: "#ccc", fontSize: 10, padding: 6, lineHeight: 1.4, resize: "vertical", outline: "none", marginBottom: 6 }}
                        />
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button
                            onClick={() => handlePolishScene(sceneId, s.visualDescription ?? "", "polish")}
                            disabled={polishingScene === sceneId}
                            style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #a855f770", background: "transparent", color: "#c084fc", fontSize: 9, fontWeight: 700, cursor: polishingScene === sceneId ? "not-allowed" : "pointer" }}
                          >
                            ✨ Polish
                          </button>
                          {SCENE_PRESETS.map(p => (
                            <button
                              key={p.op}
                              onClick={() => handleChildSceneOp(sceneId, s.visualDescription ?? "", p.op)}
                              disabled={polishingScene === sceneId}
                              style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${p.color}70`, background: `${p.color}10`, color: p.color, fontSize: 9, fontWeight: 700, cursor: polishingScene === sceneId ? "not-allowed" : "pointer" }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Script-level batch ops — apply to whole script, NOT per-scene */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${border}` }}>
                  <button
                    onClick={() => {
                      const allText = scriptSegments.map(s => s.text).join(" ");
                      handleAdultWordCheck("script-global", allText);
                    }}
                    disabled={polishingScene === "script-global"}
                    title="Scan full script for adult/scary words"
                    style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #ef444470", background: "#ef444410", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                  >
                    🛡 Scan Script for Adult Words
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, color: muted }}>
                {scriptSegments.length > 0
                  ? `${scriptSegments.filter(s => s.type === "narration").length} narrator + ${scriptSegments.filter(s => s.type === "dialogue").length} character lines`
                  : "Ready to parse your story into script segments"}
              </p>
              <button
                onClick={parseScript}
                disabled={parsingScript}
                style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: parsingScript ? "#2a2040" : childAccent, color: parsingScript ? muted : "#000", fontSize: 12, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}
              >
                {parsingScript ? "Parsing..." : scriptSegments.length > 0 ? "Re-Parse Script" : "Parse Story into Script"}
              </button>
            </div>

            {scriptSegments.length > 0 && (
              <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                {scriptSegments.map((seg, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: seg.type === "narration" ? `${ds.color.sky}09` : `${C2}09`, border: `1px solid ${seg.type === "narration" ? ds.color.sky : C2}20`, display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: seg.type === "narration" ? ds.color.sky : C2, minWidth: 56, alignSelf: "flex-start", paddingTop: 4 }}>
                      {seg.type === "narration" ? "NARRATOR" : seg.speaker?.toUpperCase() || "CHARACTER"}
                    </span>
                    <textarea
                      value={seg.text}
                      onChange={e => setScriptSegments(prev => prev.map((s, j) => j === i ? { ...s, text: e.target.value } : s))}
                      rows={2}
                      style={{ flex: 1, background: "transparent", border: "none", color: "#ccc", fontSize: 10, lineHeight: 1.4, resize: "vertical", outline: "none" }}
                    />
                    <button
                      onClick={() => setScriptSegments(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "transparent", border: "none", color: muted, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {scriptSegments.length > 0 && (
              <div style={{ display: "flex", gap: 10, paddingTop: 10, borderTop: `1px solid ${ds.color.line}` }}>
                <button
                  onClick={() => setActiveTab("sound")}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Go to Voices & Sounds
                </button>
              </div>
            )}

            {scriptSegments.length === 0 && (
              <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: "20px 0" }}>
                Click &quot;Parse Story into Script&quot; to begin.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
