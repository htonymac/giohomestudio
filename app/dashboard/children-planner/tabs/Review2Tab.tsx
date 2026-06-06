"use client";

// Second Review tab — final mandatory safety check before final render.
// Holds: saved-cuts list, assembly status, version name save, Pre-Flight
// audit, the 6-card visual check grid, approval checkbox, and the Render
// Final Video button + export panel.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 1.4, 2026-06-05).

import * as React from "react";
import * as Icon from "../../../components/icons";

export interface SavedCut { name: string; sceneIds?: string[]; videoUrl?: string; savedAt: string }
export interface PreflightCheck { id: string; label: string; status: "ok" | "warn" | "error"; detail?: string }
export interface PreflightResult {
  checks: PreflightCheck[];
  blockingErrors: number;
  warnings: number;
  canAssemble: boolean;
}

export interface Review2TabProps {
  // ── State READ ──
  savedCuts: SavedCut[];
  showCutsPanel: boolean;
  assemblyName: string;
  assemblySelectedIds: string[];
  assembledUrl: string | null;
  generatedVideoUrl: string;
  finalVideoUrl: string | null;
  review2Done: boolean;
  saving: boolean;
  saveError: string | null;
  preflightResult: PreflightResult | null;
  preflightRunning: boolean;
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  childSafe: string;
  childAccent: string;
  muted: string;
  s2: string;
  border: string;
  surface: string;
  // ── State WRITE / nav ──
  setActiveTab: (t: "review1" | "preview" | "assembly") => void;
  setShowCutsPanel: (fn: (prev: boolean) => boolean) => void;
  setAssemblyName: (s: string) => void;
  setSavedCuts: React.Dispatch<React.SetStateAction<SavedCut[]>>;
  setGeneratedVideoUrl: (s: string) => void;
  setReview2Done: (v: boolean) => void;
  setLastAction: (s: string) => void;
  // ── Actions ──
  runPreflight: () => void | Promise<void>;
  handleFinalRender: () => void | Promise<void>;
}

export default function Review2Tab(props: Review2TabProps) {
  const {
    savedCuts, showCutsPanel, assemblyName, assemblySelectedIds, assembledUrl,
    generatedVideoUrl, finalVideoUrl, review2Done, saving, saveError,
    preflightResult, preflightRunning,
    cardStyle, labelStyle, childSafe, childAccent, muted, s2, border, surface,
    setActiveTab, setShowCutsPanel, setAssemblyName, setSavedCuts, setGeneratedVideoUrl,
    setReview2Done, setLastAction, runPreflight, handleFinalRender,
  } = props;

  return (
    <div style={{ ...cardStyle, padding: 28, border: `2px solid ${childSafe}40` }}>
      {/* Saved Story Cuts */}
      {savedCuts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowCutsPanel(p => !p)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${childSafe}30`, background: showCutsPanel ? `${childSafe}10` : `${childSafe}06`, color: childSafe, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            <Icon.Folder style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>Saved Story Versions ({savedCuts.length})</span>
            <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap", flex: 1 }}>
              {savedCuts.map(c => <span key={c.name} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${childSafe}20`, color: childSafe }}>{c.name}</span>)}
            </div>
            <span style={{ fontSize: 10, color: muted }}>{showCutsPanel ? "▲ Close" : "▼ Open"}</span>
          </button>
          {showCutsPanel && (
            <div style={{ background: surface, border: `1px solid ${childSafe}25`, borderRadius: 12, padding: 12, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {savedCuts.map((c, ci) => (
                <div
                  key={c.name}
                  onClick={() => { setAssemblyName(c.name); if (c.videoUrl) setGeneratedVideoUrl(c.videoUrl); setShowCutsPanel(() => false); setLastAction(`Loaded version: "${c.name}"`); }}
                  style={{ background: s2, borderRadius: 10, border: `2px solid ${assemblyName === c.name ? childSafe : border}`, padding: 10, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {c.videoUrl ? <Icon.Film style={{ width: 13, height: 13, flexShrink: 0 }} /> : <Icon.Grid style={{ width: 13, height: 13, flexShrink: 0 }} />}
                    <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? childSafe : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                    <button
                      onClick={e => { e.stopPropagation(); setSavedCuts(prev => prev.filter((_, i) => i !== ci)); }}
                      style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: "#ef4444", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center" }}
                    >
                      <Icon.X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                  <p style={{ fontSize: 9, color: muted }}>{new Date(c.savedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assembly status */}
      {assembledUrl && (
        <div style={{ ...cardStyle, marginBottom: 12, borderColor: `${childSafe}30`, padding: "14px 16px" }}>
          <p style={{ fontSize: 12, color: childSafe, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Icon.Check style={{ width: 14, height: 14 }} /> Video assembled ({assemblySelectedIds.length} scene{assemblySelectedIds.length !== 1 ? "s" : ""})
          </p>
          <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 180, borderRadius: 8 }} />
        </div>
      )}
      {!assembledUrl && (
        <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: `${childAccent}06`, border: `1px solid ${border}` }}>
          <p style={{ fontSize: 12, color: muted }}>No video assembled yet. Go to the <strong style={{ color: "#fff" }}>Assembly</strong> tab first to build your video, then come back here for the final check.</p>
          <button onClick={() => setActiveTab("assembly")} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Go to Assembly
          </button>
        </div>
      )}

      {/* Story Version Name + Save */}
      <div style={{ ...cardStyle, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Story Version Name</label>
            <input
              type="text"
              value={assemblyName}
              onChange={e => setAssemblyName(e.target.value)}
              placeholder="Main Story, Bilingual Edit, Short Version..."
              style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", fontWeight: 600 }}
            />
          </div>
          <button
            onClick={() => {
              if (!assemblyName.trim()) return;
              setSavedCuts(prev => {
                const existing = prev.findIndex(c => c.name === assemblyName);
                const cut: SavedCut = { name: assemblyName, sceneIds: [], videoUrl: generatedVideoUrl || undefined, savedAt: new Date().toISOString() };
                return existing >= 0 ? prev.map((c, i) => i === existing ? cut : c) : [...prev, cut];
              });
              setLastAction(`Version "${assemblyName}" saved`);
            }}
            style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 22, flexShrink: 0 }}
          >
            Save Version
          </button>
        </div>
      </div>

      {/* Pre-Flight AI Review */}
      <div style={{ ...cardStyle, marginBottom: 12, borderColor: preflightResult ? (preflightResult.blockingErrors > 0 ? "#ef444440" : preflightResult.warnings > 0 ? "#f59e0b40" : `${childSafe}40`) : `${childAccent}30` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon.Star style={{ width: 15, height: 15, color: childAccent, flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI Audio & Audit</p>
          </div>
          {preflightResult && (
            <div style={{ display: "flex", gap: 6 }}>
              {preflightResult.blockingErrors > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "#ef444420", color: "#ef4444", fontWeight: 700 }}>{preflightResult.blockingErrors} error{preflightResult.blockingErrors !== 1 ? "s" : ""}</span>}
              {preflightResult.warnings > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "#f59e0b20", color: "#f59e0b", fontWeight: 700 }}>{preflightResult.warnings} warning{preflightResult.warnings !== 1 ? "s" : ""}</span>}
              {preflightResult.canAssemble && preflightResult.warnings === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${childSafe}20`, color: childSafe, fontWeight: 700 }}>Ready</span>}
            </div>
          )}
        </div>
        <button
          onClick={runPreflight}
          disabled={preflightRunning}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${childAccent}30`, background: preflightRunning ? "#2a2040" : `${childAccent}10`, color: childAccent, fontSize: 11, fontWeight: 600, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0 }}
        >
          {preflightRunning ? "AI Audio & Audit running..." : "AI Audio & Audit"}
        </button>
        {preflightResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {preflightResult.checks.map(check => (
              <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: check.status === "ok" ? `${childSafe}08` : check.status === "warn" ? "#f59e0b08" : "#ef444408", border: `1px solid ${check.status === "ok" ? childSafe : check.status === "warn" ? "#f59e0b" : "#ef4444"}20` }}>
                <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}</span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: check.status === "ok" ? childSafe : check.status === "warn" ? "#f59e0b" : "#ef4444" }}>{check.label}</p>
                  {check.detail && <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{check.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning if preview not generated */}
      {!generatedVideoUrl && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Preview not yet generated</p>
          <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>You need to generate a preview before completing the final review.</p>
          <button onClick={() => setActiveTab("review1")} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Go to Review 1
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Icon.Check style={{ width: 22, height: 22, color: childSafe, flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: childSafe }}>Second Review — Final Safety Check</h2>
          <p style={{ fontSize: 11, color: muted }}>This is the FINAL check before content can be exported or published. Both reviews are mandatory for children content.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Visuals are child-safe", check: "No inappropriate imagery, characters look child-friendly" },
          { label: "Narration is clear", check: "Pronunciation is clear, pace is appropriate for children" },
          { label: "Text highlighting syncs", check: "Highlighted words match spoken words exactly" },
          { label: "Music is appropriate", check: "Music supports learning, doesn't overpower voice" },
          { label: "No unsafe AI mistakes", check: "No strange objects, no adult styling, no confusing elements" },
          { label: "Background is clean", check: "Simple, uncluttered, child-appropriate scenes" },
        ].map(item => (
          <div key={item.label} style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}` }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{item.label}</p>
            <p style={{ fontSize: 10, color: muted }}>{item.check}</p>
          </div>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", borderRadius: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={review2Done}
          onChange={e => { setReview2Done(e.target.checked); if (e.target.checked) setLastAction("Review 2 approved"); }}
          style={{ marginTop: 3, accentColor: childSafe }}
        />
        <span style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6 }}>
          I have watched the preview in full. I confirm that the visuals, narration, text, and music are all appropriate for children. I approve this content for final rendering and export.
        </span>
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setActiveTab("preview")} style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Back to Preview</button>
        <button
          disabled={!review2Done || saving || !!finalVideoUrl}
          onClick={handleFinalRender}
          style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: (!review2Done || saving || !!finalVideoUrl) ? "#2a2a40" : childSafe, color: "#000", fontSize: 16, fontWeight: 700, cursor: (!review2Done || saving || !!finalVideoUrl) ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving to Library..." : finalVideoUrl ? "Saved to Asset Library" : "Both Reviews Passed — Render Final Video"}
        </button>
      </div>
      {saveError && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8 }}>{saveError}</p>}

      {/* Export options — shown after save */}
      {finalVideoUrl && (
        <div style={{ marginTop: 16, padding: 20, borderRadius: 14, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: childSafe, marginBottom: 12 }}>Content saved to Asset Library</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={finalVideoUrl} download style={{ textDecoration: "none" }}>
              <button style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Download Video
              </button>
            </a>
            <a href="/dashboard/asset-library" style={{ textDecoration: "none" }}>
              <button style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${childSafe}`, background: "transparent", color: childSafe, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                View in Asset Library
              </button>
            </a>
            <a href={`/dashboard/collaborative-editor?videoUrl=${encodeURIComponent(finalVideoUrl)}&from=children-planner`} style={{ textDecoration: "none" }}>
              <button style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Open in Editor
              </button>
            </a>
            <a href="/dashboard/all-content" style={{ textDecoration: "none" }}>
              <button style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                All Content
              </button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
