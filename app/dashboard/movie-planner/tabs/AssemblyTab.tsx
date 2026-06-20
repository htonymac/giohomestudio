"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AssemblyTab — final movie assembly + export.
//
// SECTIONS (top → bottom):
//   1. Saved Cuts panel — load / delete previously saved cut configurations
//   2. Cut name + Save Cut input
//   3. Pre-Flight AI Audio & Audit — checks media readiness before assembly
//   4. Assembly Readiness gauge + validation runner
//   5. Cost summary
//   6. Scene-selection checklist with image/video preference toggle per scene
//   7. Assembly progress lines (per scene status)
//   8. Assembled video preview + Watch / Download
//   9. Audio preview (background music)
//  10. AI Supervisor card
//  11. SubtitleStyler
//  12. AI Intro / Outro generator
//  13. Movie credits + narration↔subtitle match check
//  14. Assemble button OR Open in Editor (when assembly complete)
//
// All async actions live in the parent (assembleMovie, runPreflight, runValidation,
// runAiSupervisor, patchProjectSettings). Inline intro/outro generators + the
// narration-match check are kept as closures because they touch many local pieces
// of parent state at once — moving them out adds prop noise without behavior win.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";
import SubtitleStyler, { type SubtitleConfig } from "../../../components/SubtitleStyler";
import { buildOutputName } from "@/lib/projectNaming";

// Structural types — only this tab consumes them. Kept inline so the contract
// is visible end-to-end.
export interface AssemblyTabSavedCut { name: string; sceneIds: string[]; videoUrl?: string; savedAt: string }
export interface AssemblyTabPreflightCheck { id: string; label: string; status: "ok" | "warn" | "fail"; detail?: string }
export interface AssemblyTabPreflightResult { canAssemble: boolean; blockingErrors: number; warnings: number; checks: AssemblyTabPreflightCheck[] }
export interface AssemblyTabValidation { valid: boolean; errors: string[]; warnings: string[] }
export interface AssemblyTabMoviePlan { estimatedCredits?: number }
export interface AssemblyTabScene { scene: number; title: string; duration: string; generationMethod: string }
export interface AssemblyTabSupervisorReport { ok: boolean; summary: string; issues: string[] }

export interface AssemblyTabProps {
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  btnPrimary: React.CSSProperties;
  s2: string;
  surface: string;
  border: string;
  muted: string;
  accent: string;
  green: string;
  gold: string;
  red: string;
  purple: string;
  /** Inline ProgressBar component from parent. */
  ProgressBar: React.ComponentType<{ label: string; value: number; color: string }>;

  // ── Saved Cuts ──
  savedCuts: AssemblyTabSavedCut[];
  setSavedCuts: React.Dispatch<React.SetStateAction<AssemblyTabSavedCut[]>>;
  showCutsPanel: boolean;
  setShowCutsPanel: React.Dispatch<React.SetStateAction<boolean>>;

  // ── Cut name + selection ──
  assemblyName: string;
  setAssemblyName: (v: string) => void;
  assemblySelectedIds: string[];
  setAssemblySelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  assembledUrl: string | null;
  setAssembledUrl: (v: string | null) => void;
  setLastAction: (msg: string) => void;

  // ── Pre-Flight ──
  preflightResult: AssemblyTabPreflightResult | null;
  preflightRunning: boolean;
  runPreflight: () => void | Promise<void>;

  // ── Readiness gate ──
  assemblyReadiness: number;
  validation: AssemblyTabValidation | null;
  validating: boolean;
  runValidation: () => void | Promise<void>;

  // ── Cost / scene counts ──
  moviePlan: AssemblyTabMoviePlan | null;
  totalScenes: number;
  generatedScenes: number;

  // ── Scene selection checklist ──
  scenes: AssemblyTabScene[];
  sceneVideos: Record<string, string>;
  sceneImages: Record<string, string>;
  assemblyMediaPrefs: Record<string, "image" | "video">;
  setAssemblyMediaPrefs: React.Dispatch<React.SetStateAction<Record<string, "image" | "video">>>;

  // ── Assembly progress ──
  assembling: boolean;
  assemblyComplete: boolean;
  assemblyProgress: Record<number, string>;

  // ── Audio preview ──
  selectedMusicUrl: string | null;

  // ── AI Supervisor ──
  aiSupervisorReport: AssemblyTabSupervisorReport | null;
  aiSupervisorRunning: boolean;
  runAiSupervisor: () => void | Promise<void>;

  // ── Subtitle ──
  effectiveSubtitleConfig: SubtitleConfig;
  subtitleConfig: SubtitleConfig;
  setSubtitleConfig: React.Dispatch<React.SetStateAction<SubtitleConfig>>;
  patchProjectSettings: (patch: Record<string, unknown>) => Promise<unknown>;

  // ── Intro / Outro ──
  introUrl: string | null;
  setIntroUrl: (v: string | null) => void;
  outroUrl: string | null;
  setOutroUrl: (v: string | null) => void;
  generatingIntro: boolean;
  setGeneratingIntro: React.Dispatch<React.SetStateAction<boolean>>;
  generatingOutro: boolean;
  setGeneratingOutro: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;

  // ── Credits ──
  screenplayAuthor: string;
  setScreenplayAuthor: (v: string) => void;
  movieMadeBy: string;
  setMovieMadeBy: (v: string) => void;
  movieIdeaFrom: string;
  setMovieIdeaFrom: (v: string) => void;

  // ── Subtitle ↔ Narration check ──
  subtitleMatchResult: { status: "ok" | "warn" | "checking"; note: string } | null;
  setSubtitleMatchResult: (v: { status: "ok" | "warn" | "checking"; note: string } | null) => void;
  expandedStory: string;
  idea: string;

  // ── Actions ──
  assembleMovie: () => void | Promise<void>;
  setActiveTab: (t: "sound" | "scenes" | "characters") => void;
}

export default function AssemblyTab(props: AssemblyTabProps) {
  const {
    cardStyle, labelStyle, inputStyle, btnPrimary,
    s2, surface, border, muted, accent, green, gold, red, purple, ProgressBar,
    savedCuts, setSavedCuts, showCutsPanel, setShowCutsPanel,
    assemblyName, setAssemblyName, assemblySelectedIds, setAssemblySelectedIds,
    assembledUrl, setAssembledUrl, setLastAction,
    preflightResult, preflightRunning, runPreflight,
    assemblyReadiness, validation, validating, runValidation,
    moviePlan, totalScenes, generatedScenes,
    scenes, sceneVideos, sceneImages, assemblyMediaPrefs, setAssemblyMediaPrefs,
    assembling, assemblyComplete, assemblyProgress,
    selectedMusicUrl,
    aiSupervisorReport, aiSupervisorRunning, runAiSupervisor,
    effectiveSubtitleConfig, setSubtitleConfig, patchProjectSettings,
    introUrl, setIntroUrl, outroUrl, setOutroUrl,
    generatingIntro, setGeneratingIntro, generatingOutro, setGeneratingOutro,
    title,
    screenplayAuthor, setScreenplayAuthor, movieMadeBy, setMovieMadeBy, movieIdeaFrom, setMovieIdeaFrom,
    subtitleMatchResult, setSubtitleMatchResult, expandedStory, idea,
    assembleMovie, setActiveTab,
  } = props;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Assembly & Export</h2>

      {/* Saved Cuts panel */}
      {savedCuts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowCutsPanel(p => !p)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${gold}30`, background: showCutsPanel ? `${gold}10` : `${gold}06`, color: gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Icon.Folder style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>Saved Cuts ({savedCuts.length})</span>
            <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap", flex: 1 }}>
              {savedCuts.map(c => <span key={c.name} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${gold}20`, color: gold }}>{c.name}</span>)}
            </div>
            <span style={{ fontSize: 10, color: muted }}>{showCutsPanel ? "▲ Close" : "▼ Open"}</span>
          </button>
          {showCutsPanel && (
            <div style={{ background: surface, border: `1px solid ${gold}25`, borderRadius: 12, padding: 12, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {savedCuts.map((c, ci) => (
                <div key={c.name}
                  onClick={() => { setAssemblyName(c.name); setAssemblySelectedIds(c.sceneIds); if (c.videoUrl) setAssembledUrl(c.videoUrl); setShowCutsPanel(false); setLastAction(`Loaded cut: "${c.name}"`); }}
                  style={{ background: s2, borderRadius: 10, border: `2px solid ${assemblyName === c.name ? gold : border}`, padding: 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {c.videoUrl ? <Icon.Film style={{ width: 13, height: 13, flexShrink: 0 }} /> : <Icon.Grid style={{ width: 13, height: 13, flexShrink: 0 }} />}
                    <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? gold : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                    <button onClick={e => { e.stopPropagation(); setSavedCuts(prev => prev.filter((_, i) => i !== ci)); }}
                      style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: red, cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Icon.X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                  <p style={{ fontSize: 9, color: muted }}>{c.sceneIds.length} scene{c.sceneIds.length !== 1 ? "s" : ""} · {new Date(c.savedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cut name + Save */}
      <div style={{ ...cardStyle, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Movie / Cut Name</label>
            <input type="text" value={assemblyName} onChange={e => setAssemblyName(e.target.value)} placeholder="Main Cut, Director's Cut, Trailer..."
              style={{ ...inputStyle, fontSize: 13, fontWeight: 600 }} />
          </div>
          <button
            onClick={() => {
              if (!assemblyName.trim() || assemblySelectedIds.length === 0) return;
              setSavedCuts(prev => {
                const existing = prev.findIndex(c => c.name === assemblyName);
                const cut: AssemblyTabSavedCut = { name: assemblyName, sceneIds: assemblySelectedIds, videoUrl: assembledUrl ?? undefined, savedAt: new Date().toISOString() };
                const next = existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
                return next;
              });
              setLastAction(`Cut "${assemblyName}" saved`);
            }}
            style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}>
            Save Cut
          </button>
        </div>
      </div>

      {/* Pre-Flight AI Audio & Audit */}
      <div style={{ ...cardStyle, marginBottom: 12, borderColor: preflightResult ? (preflightResult.blockingErrors > 0 ? `${red}40` : preflightResult.warnings > 0 ? `${gold}40` : `${green}40`) : `${purple}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon.Star style={{ width: 15, height: 15, color: purple, flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI Audio & Audit</p>
          </div>
          {preflightResult && (
            <div style={{ display: "flex", gap: 6 }}>
              {preflightResult.blockingErrors > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${red}20`, color: red, fontWeight: 700 }}>{preflightResult.blockingErrors} error{preflightResult.blockingErrors !== 1 ? "s" : ""}</span>}
              {preflightResult.warnings > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${gold}20`, color: gold, fontWeight: 700 }}>{preflightResult.warnings} warning{preflightResult.warnings !== 1 ? "s" : ""}</span>}
              {preflightResult.canAssemble && preflightResult.warnings === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${green}20`, color: green, fontWeight: 700 }}>Ready</span>}
            </div>
          )}
        </div>
        <button onClick={runPreflight} disabled={preflightRunning}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${purple}30`, background: preflightRunning ? "#2a2040" : `${purple}10`, color: purple, fontSize: 11, fontWeight: 600, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0 }}>
          {preflightRunning ? "AI Audio & Audit running..." : "AI Audio & Audit"}
        </button>
        {preflightResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {preflightResult.checks.map(check => (
              <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: check.status === "ok" ? `${green}08` : check.status === "warn" ? `${gold}08` : `${red}08`, border: `1px solid ${check.status === "ok" ? green : check.status === "warn" ? gold : red}20` }}>
                <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}</span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: check.status === "ok" ? green : check.status === "warn" ? gold : red }}>{check.label}</p>
                  {check.detail && <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{check.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Readiness gate */}
      <div style={{ ...cardStyle, borderColor: assemblyReadiness > 70 ? `${green}30` : `${gold}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Assembly Readiness</p>
          <span style={{ fontSize: 22, fontWeight: 800, color: assemblyReadiness > 70 ? green : gold }}>{assemblyReadiness}%</span>
        </div>
        <ProgressBar label="Overall" value={assemblyReadiness} color={assemblyReadiness > 70 ? green : gold} />
        <button onClick={runValidation} disabled={validating}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${border}`, background: s2, color: muted, fontSize: 11, cursor: validating ? "not-allowed" : "pointer", marginBottom: 10 }}>
          {validating ? "Validating..." : "Run Validation Check"}
        </button>
        {validation && (
          <div style={{ marginBottom: 10 }}>
            {validation.valid && <p style={{ fontSize: 11, color: green, fontWeight: 600 }}>All checks passed!</p>}
            {validation.errors.map((e, i) => <p key={i} style={{ fontSize: 10, color: red, marginBottom: 2 }}>Error: {e}</p>)}
            {validation.warnings.map((w, i) => <p key={i} style={{ fontSize: 10, color: gold, marginBottom: 2 }}>Warning: {w}</p>)}
          </div>
        )}
      </div>

      {/* Cost summary */}
      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, color: "#fff" }}>Estimated Credits: <strong style={{ color: accent }}>{moviePlan?.estimatedCredits || 0}</strong></span>
        <span style={{ fontSize: 12, color: muted }}>{assemblySelectedIds.length}/{totalScenes} scenes selected &middot; {generatedScenes} rendered</span>
      </div>

      {/* Scene selection checklist */}
      {totalScenes > 0 && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Select Scenes for Assembly</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setAssemblySelectedIds(scenes.map(s => `SC${String(s.scene).padStart(2, "0")}`))}
                style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${green}30`, background: "transparent", color: green, cursor: "pointer" }}>All</button>
              <button onClick={() => setAssemblySelectedIds([])}
                style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, cursor: "pointer" }}>None</button>
            </div>
          </div>
          {scenes.map(scene => {
            const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
            const isSelected = assemblySelectedIds.includes(sceneId);
            const hasVid = !!sceneVideos[sceneId];
            const hasImg = !!sceneImages[sceneId];
            return (
              <div key={scene.scene}
                onClick={() => setAssemblySelectedIds(prev => isSelected ? prev.filter(id => id !== sceneId) : [...prev, sceneId])}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: isSelected ? `${green}06` : s2, marginBottom: 4, border: `1px solid ${isSelected ? `${green}25` : border}`, cursor: "pointer" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? green : muted}`, background: isSelected ? `${green}20` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isSelected && <Icon.Check style={{ width: 10, height: 10, color: green }} />}
                </div>
                {(hasImg || hasVid) && (
                  <div style={{ width: 36, height: 24, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                    {hasImg ? <img src={sceneImages[sceneId]} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : null}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sceneId}: {scene.title}</p>
                  <p style={{ fontSize: 9, color: muted }}>{scene.duration} · {scene.generationMethod}</p>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {(() => {
                    const pref = assemblyMediaPrefs[sceneId];
                    const eff: "image" | "video" = pref ?? (hasVid ? "video" : "image");
                    return (
                      <>
                        <button onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "image" }))}
                          disabled={!hasImg}
                          style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, border: `1px solid ${eff === "image" ? green : border}`, background: eff === "image" && hasImg ? `${green}15` : "transparent", color: hasImg ? (eff === "image" ? green : muted) : "#333", cursor: hasImg ? "pointer" : "not-allowed", fontWeight: eff === "image" ? 700 : 400 }}>
                          Image {eff === "image" ? "✓" : ""}
                        </button>
                        <button onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "video" }))}
                          disabled={!hasVid}
                          style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, border: `1px solid ${eff === "video" ? accent : border}`, background: eff === "video" && hasVid ? `${accent}15` : "transparent", color: hasVid ? (eff === "video" ? accent : muted) : "#333", cursor: hasVid ? "pointer" : "not-allowed", fontWeight: eff === "video" ? 700 : 400 }}>
                          Video {eff === "video" ? "✓" : hasVid ? "" : "(none)"}
                        </button>
                      </>
                    );
                  })()}
                  {!hasImg && !hasVid && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: `${red}10`, color: red }}>no media</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assembly progress */}
      {(assembling || assemblyComplete) && assemblySelectedIds.map(sceneId => {
        const scene = scenes.find(s => `SC${String(s.scene).padStart(2, "0")}` === sceneId);
        if (!scene) return null;
        const status = assemblyProgress[scene.scene] || "queued";
        return (
          <div key={sceneId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, marginBottom: 4, border: `1px solid ${border}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: status === "done" ? green : status === "processing" ? gold : muted }}>{status === "done" ? <Icon.Check style={{ width: 10, height: 10 }} /> : status === "processing" ? "..." : "○"}</span>
            <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>{sceneId}: {scene.title}</p>
            <span style={{ fontSize: 10, color: muted }}>{status}</span>
          </div>
        );
      })}

      {/* Assembled video preview */}
      {assembledUrl && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 320 }} />
          <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: green }}>Assembly Complete</span>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={assembledUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, background: `${green}15`, color: green, textDecoration: "none", fontWeight: 600 }}>
                Watch Final Movie
              </a>
              <a href={assembledUrl} download={buildOutputName({ parts: [title], seed: title || "movie" })}
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 8, background: `${accent}15`, color: accent, textDecoration: "none", fontWeight: 600 }}
                title={buildOutputName({ parts: [title], seed: title || "movie" })}>
                Download MP4
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Audio preview */}
      {selectedMusicUrl && (
        <div style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 8 }}>Audio Preview</p>
          <p style={{ fontSize: 9, color: muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 1 }}>Background Music</p>
          <audio src={selectedMusicUrl} controls style={{ width: "100%", height: 32 }} />
        </div>
      )}

      {/* AI Supervisor */}
      <div style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSupervisorReport ? 10 : 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: purple }}>AI Supervisor</p>
          <button onClick={runAiSupervisor} disabled={aiSupervisorRunning}
            style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: aiSupervisorRunning ? "#2a2040" : `${purple}20`, color: aiSupervisorRunning ? muted : purple, fontSize: 10, fontWeight: 700, cursor: aiSupervisorRunning ? "not-allowed" : "pointer" }}>
            {aiSupervisorRunning ? "Checking..." : "Run Check"}
          </button>
        </div>
        {aiSupervisorReport && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: aiSupervisorReport.ok ? `${green}08` : `${gold}06`, border: `1px solid ${aiSupervisorReport.ok ? green : gold}30` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: aiSupervisorReport.ok ? green : gold, marginBottom: 4 }}>
              {aiSupervisorReport.ok ? "✓ Ready" : "⚠ Issues Found"} — {aiSupervisorReport.summary}
            </p>
            {aiSupervisorReport.issues.map((issue, i) => {
              const lower = issue.toLowerCase();
              const fixLabel = lower.includes("sfx") || lower.includes("sound effect") ? "→ Sound tab" :
                lower.includes("music") ? "→ Sound tab" :
                lower.includes("narration") || lower.includes("voice") ? "→ Generate Narration" :
                lower.includes("subtitle") ? "→ Subtitle Style" :
                lower.includes("scene") || lower.includes("image") ? "→ Scene Board" :
                lower.includes("cast") || lower.includes("character") ? "→ Cast" : null;
              const fixAction = lower.includes("sfx") || lower.includes("sound effect") || lower.includes("music") ? () => setActiveTab("sound") :
                lower.includes("narration") || lower.includes("voice") ? () => runAiSupervisor() :
                lower.includes("scene") || lower.includes("image") ? () => setActiveTab("scenes") :
                lower.includes("cast") || lower.includes("character") ? () => setActiveTab("characters") : null;
              return (
                <div key={`iss-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: gold, margin: 0, flex: 1 }}>⚠ {issue}</p>
                  {fixLabel && fixAction && (
                    <button onClick={fixAction} style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${gold}40`, background: `${gold}15`, color: gold, fontSize: 8, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      {fixLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!aiSupervisorReport && !aiSupervisorRunning && (
          <p style={{ fontSize: 9, color: muted, marginTop: 6 }}>Run before assembly — checks scenes, audio, and media readiness.</p>
        )}
      </div>

      {/* Subtitle Style */}
      <div style={{ marginBottom: 12 }}>
        <SubtitleStyler value={effectiveSubtitleConfig}
          onChange={(newCfg) => {
            setSubtitleConfig(newCfg);
            patchProjectSettings({ subtitleMode: newCfg.mode, subtitleHighlight: newCfg.highlightColor, subtitleEnabled: newCfg.mode !== "none" }).catch(() => {});
          }}
          accentColor={accent} />
      </div>

      {/* AI Intro / Outro */}
      <div style={{ ...cardStyle, marginBottom: 12, padding: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>AI Intro / Outro</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          <div>
            {introUrl
              ? <div style={{ position: "relative" }}>
                  <video src={introUrl} style={{ width: "100%", borderRadius: 8, maxHeight: 80 }} muted />
                  <button onClick={() => setIntroUrl(null)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", padding: "2px 6px" }}>✕</button>
                </div>
              : <button
                  onClick={async () => {
                    setGeneratingIntro(true);
                    try {
                      const res = await fetch("/api/video/title-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "intro", studioName: "GIO HOME AI STUDIO", title: title || "My Movie", director: screenplayAuthor || undefined, producer: movieMadeBy || undefined, username: movieIdeaFrom || undefined, duration: 4 }) });
                      const d = await res.json();
                      if (d.videoUrl) setIntroUrl(d.videoUrl);
                    } catch { /* ignore */ } finally { setGeneratingIntro(false); }
                  }}
                  disabled={generatingIntro}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: generatingIntro ? "not-allowed" : "pointer" }}>
                  {generatingIntro ? "Generating…" : "Generate AI Intro"}
                </button>}
          </div>
          <div>
            {outroUrl
              ? <div style={{ position: "relative" }}>
                  <video src={outroUrl} style={{ width: "100%", borderRadius: 8, maxHeight: 80 }} muted />
                  <button onClick={() => setOutroUrl(null)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, color: "#fff", fontSize: 10, cursor: "pointer", padding: "2px 6px" }}>✕</button>
                </div>
              : <button
                  onClick={async () => {
                    setGeneratingOutro(true);
                    try {
                      const res = await fetch("/api/video/title-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "outro", studioName: "GIO HOME AI STUDIO", title: title || "My Movie", director: screenplayAuthor || undefined, producer: movieMadeBy || undefined, username: movieIdeaFrom || undefined, duration: 5 }) });
                      const d = await res.json();
                      if (d.videoUrl) setOutroUrl(d.videoUrl);
                    } catch { /* ignore */ } finally { setGeneratingOutro(false); }
                  }}
                  disabled={generatingOutro}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: generatingOutro ? "not-allowed" : "pointer" }}>
                  {generatingOutro ? "Generating…" : "Generate AI Outro"}
                </button>}
          </div>
        </div>
      </div>

      {/* Credits + Narration↔Subtitle match */}
      <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Movie Credits</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Written by</label>
            <input value={screenplayAuthor} onChange={e => setScreenplayAuthor(e.target.value)} placeholder="Screenplay author"
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Made by</label>
            <input value={movieMadeBy} onChange={e => setMovieMadeBy(e.target.value)} placeholder="Studio / creator"
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>Idea from</label>
            <input value={movieIdeaFrom} onChange={e => setMovieIdeaFrom(e.target.value)} placeholder="Original idea by..."
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
          </div>
        </div>
        <button onClick={() => setLastAction(`Credits saved: ${screenplayAuthor} · ${movieMadeBy}`)}
          style={{ marginTop: 10, padding: "8px 18px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Save Credits
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button
            onClick={async () => {
              setSubtitleMatchResult({ status: "checking", note: "Checking..." });
              try {
                const script = expandedStory || idea || "";
                if (!script.trim()) { setSubtitleMatchResult({ status: "warn", note: "No story text to check against." }); return; }
                const res = await fetch("/api/free-mode/enhance", { method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rawPrompt: `Check if subtitle mode "${effectiveSubtitleConfig.mode}" matches this story tone: "${script.slice(0,300)}". Reply MATCH or MISMATCH in one line.`, mode: "text_to_video" }) });
                const d = await res.json() as { enhanced?: string };
                const result = (d.enhanced || "").toLowerCase();
                setSubtitleMatchResult({ status: result.includes("match") && !result.includes("mismatch") ? "ok" : "warn", note: d.enhanced || "Unable to check" });
              } catch { setSubtitleMatchResult({ status: "warn", note: "Check failed" }); }
            }}
            style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${accent}40`, background: `${accent}10`, color: accent, fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            Check Narration ↔ Subtitle Match
          </button>
          {subtitleMatchResult && (
            <p style={{ fontSize: 9, color: subtitleMatchResult.status === "ok" ? green : subtitleMatchResult.status === "checking" ? muted : "#f59e0b", flex: 1 }}>
              {subtitleMatchResult.status === "ok" ? "✓" : subtitleMatchResult.status === "checking" ? "…" : "⚠"} {subtitleMatchResult.note.slice(0,120)}
            </p>
          )}
        </div>
      </div>

      {/* Assemble / Editor buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {!assemblyComplete ? (
          <button data-testid="assemble-movie-btn" onClick={assembleMovie}
            disabled={assembling || assemblySelectedIds.length === 0}
            style={{ ...btnPrimary, flex: 1, background: (assembling || assemblySelectedIds.length === 0) ? "#2a2a40" : green, color: "#000" }}>
            {assembling ? "Assembling..." : `Assemble "${assemblyName}" (${assemblySelectedIds.length} scenes)`}
          </button>
        ) : (
          <a href="/dashboard/collaborative-editor?from=movie-planner" style={{ flex: 1, textDecoration: "none" }}>
            <button style={{ ...btnPrimary, width: "100%", background: purple, color: "#fff" }}>Open in Editor</button>
          </a>
        )}
      </div>
      <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>
        FFmpeg merges selected scenes + audio into one video. Auto-saved to Asset Library.
      </p>
    </div>
  );
}
