"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ScenesTab — the Scene Board surface of the movie planner.
//
// SECTIONS (top → bottom):
//   1. Continuous Motion toggle + config (chain scenes into one action sequence)
//   2. Header row: "Scene Board (N scenes)" + Era/Culture chip + Grid/List view
//      toggle + Scene Intelligence button + Gen All Images bulk action
//   3. Scene Intelligence status line
//   4. AI Model Picker row (video / image model + Render All Videos)
//   5. Empty state OR scenes grid:
//        Per scene card: thumbnail, status badge, characters, scene-intel card,
//        style override picker, Make Image / Make Video / Approve / Edit,
//        Editor / Up / Down / Dup / Del actions, expanded edit panel with
//        SceneImagePanel.
//
// All async actions live on the parent. The tab is pure JSX + thin event wiring.
// State + setters are passed in as named props with one-line JSDoc each.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import * as Icon from "../../../components/icons";
import SceneImagePanel from "../../../components/SceneImagePanel";

// ── Structural types (kept inline — only this tab consumes them) ──
export interface ScenesTabSceneIntel { environmentType: string; timeOfDay: string; energyLevel: string; ambienceSounds: string[]; sfxEvents: string[] }
export interface ScenesTabSceneProgress { percent: number; message: string }
export interface ScenesTabSavedChar { id: string; name: string; characterId?: string; imageUrl?: string }
export interface ScenesTabScene {
  scene: number;
  title: string;
  goal: string;
  visualDescription: string;
  cameraDirection: string;
  dialogue: string;
  duration: string;
  status: string;
  costLabel: string;
  generationMethod: string;
  characters: string[];
}
export interface ScenesTabMoviePlan { scenes: ScenesTabScene[] }

export interface ScenesTabProps {
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  btnPrimary: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  accent: string;
  blue: string;
  green: string;
  gold: string;
  red: string;
  purple: string;
  /** Pill / badge style factory used by status + method + cost tags. */
  badgeStyle: (color: string) => React.CSSProperties;
  /** Per-generation-method color lookup (e.g., audio-only / image-led / video-led). */
  methodColors: Record<string, string>;
  /** Cost-label → color (free / cheap / mid / premium). */
  costColors: Record<string, string>;
  /** Energy level → color (low / mid / high). */
  SCENE_ENERGY_COLOR: Record<string, string>;

  // ── Continuous Motion section ──
  continuousMotionEnabled: boolean;
  setContinuousMotionEnabled: (v: boolean) => void;
  cmError: string | null;
  setCmError: (v: string | null) => void;
  cmStatus: string | null;
  setCmStatus: (v: string | null) => void;
  cmFinalVideoUrl: string | null;
  setCmFinalVideoUrl: (v: string | null) => void;
  cmTotalDuration: number;
  setCmTotalDuration: (v: number) => void;
  cmSegmentDuration: number;
  setCmSegmentDuration: (v: number) => void;
  cmProvider: "wan" | "kling_std";
  setCmProvider: (v: "wan" | "kling_std") => void;
  cmRunning: boolean;
  startContinuousMotion: () => void | Promise<void>;

  // ── Header / list controls ──
  totalScenes: number;
  scenes: ScenesTabScene[];
  savedCharacters: ScenesTabSavedChar[];
  sceneImages: Record<string, string>;
  storyEra: string;
  storyCulture: string;
  sceneViewMode: "grid" | "list";
  setSceneViewMode: (m: "grid" | "list") => void;
  runningIntelligence: boolean;
  runSceneIntelligence: () => void | Promise<void>;
  sceneIntelligence: Record<string, ScenesTabSceneIntel>;
  generatingAllImages: boolean;
  generatingSceneImage: string | null;
  generateAllSceneImages: () => void | Promise<void>;
  autoSfx: boolean;
  /** Tab nav — narrowed to the one destination this tab can request. */
  setActiveTab: (t: "design") => void;

  // ── AI Model Picker row ──
  effectiveVideoModelId: string;
  effectiveImageModelId: string;
  setAidMode: (m: "video" | "image") => void;
  setShowAidPicker: (v: boolean) => void;
  /** Used by "Render All Videos" — walks moviePlan.scenes + calls renderScene. */
  moviePlan: ScenesTabMoviePlan | null;
  renderScene: (sceneNum: number) => void | Promise<void>;
  saveProject: () => void | Promise<void>;
  renderingScene: number | null;

  // ── Per-scene state ──
  sceneGenProgress: Record<string, ScenesTabSceneProgress>;
  sceneVideos: Record<string, string>;
  sceneVideoVersions: Record<string, unknown[]>;
  sceneStyles: Record<string, string>;
  setSceneStyles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  effectiveProjectStyle: string;
  makeSceneImage: (scene: ScenesTabScene) => void | Promise<void>;
  makeSceneVideo: (scene: ScenesTabScene) => void | Promise<void>;
  generatingSceneVideos: Set<string>;
  updateScene: (sceneNum: number, patch: Partial<ScenesTabScene>) => void;
  expandedSceneId: string | null;
  setExpandedSceneId: (id: string | null) => void;

  // ── Drag / reorder / per-scene actions ──
  handleDragStart: (sceneNum: number) => void;
  handleDrop: (sceneNum: number) => void;
  dragSource: number | null;
  moveScene: (sceneNum: number, dir: "up" | "down") => void;
  duplicateScene: (sceneNum: number) => void;
  deleteScene: (sceneNum: number) => void;

  // ── Expanded panel ──
  projectId: string | null;
  setLastAction: (msg: string) => void;
  setSceneImages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function ScenesTab(props: ScenesTabProps) {
  const {
    cardStyle, labelStyle, inputStyle, btnPrimary,
    s2, border, muted, accent, blue, green, gold, red, purple,
    badgeStyle, methodColors, costColors, SCENE_ENERGY_COLOR,
    continuousMotionEnabled, setContinuousMotionEnabled, cmError, setCmError, cmStatus, setCmStatus,
    cmFinalVideoUrl, setCmFinalVideoUrl, cmTotalDuration, setCmTotalDuration, cmSegmentDuration, setCmSegmentDuration,
    cmProvider, setCmProvider, cmRunning, startContinuousMotion,
    totalScenes, scenes, savedCharacters, sceneImages, storyEra, storyCulture,
    sceneViewMode, setSceneViewMode, runningIntelligence, runSceneIntelligence, sceneIntelligence,
    generatingAllImages, generatingSceneImage, generateAllSceneImages, autoSfx, setActiveTab,
    effectiveVideoModelId, effectiveImageModelId, setAidMode, setShowAidPicker,
    moviePlan, renderScene, saveProject, renderingScene,
    sceneGenProgress, sceneVideos, sceneVideoVersions,
    sceneStyles, setSceneStyles, effectiveProjectStyle,
    makeSceneImage, makeSceneVideo, generatingSceneVideos,
    updateScene, expandedSceneId, setExpandedSceneId,
    handleDragStart, handleDrop, dragSource,
    moveScene, duplicateScene, deleteScene,
    projectId, setLastAction, setSceneImages,
  } = props;

  return (
    <div>
      {/* Continuous Motion */}
      <div style={{ ...cardStyle, marginBottom: 12, borderColor: continuousMotionEnabled ? `${accent}50` : border, background: continuousMotionEnabled ? `${accent}06` : undefined }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={continuousMotionEnabled}
            onChange={e => { setContinuousMotionEnabled(e.target.checked); setCmError(null); setCmStatus(null); setCmFinalVideoUrl(null); }}
            style={{ width: 16, height: 16, accentColor: accent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: continuousMotionEnabled ? accent : "#fff" }}>
            Continuous Motion — chain scenes into one seamless action sequence
          </span>
        </label>
        {continuousMotionEnabled && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
              AI will treat your scenes as one continuous action. Enable this when your story has unbroken physical action (chase, fall, fight, explosion chain).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Total Duration (seconds)</label>
                <input type="number" min={5} max={120} value={cmTotalDuration}
                  onChange={e => setCmTotalDuration(Math.max(5, Number(e.target.value)))}
                  style={{ ...inputStyle, fontSize: 12 }} />
              </div>
              <div>
                <label style={labelStyle}>Segment Duration (sec, max 10)</label>
                <input type="number" min={3} max={10} value={cmSegmentDuration}
                  onChange={e => setCmSegmentDuration(Math.min(10, Math.max(3, Number(e.target.value))))}
                  style={{ ...inputStyle, fontSize: 12 }} />
              </div>
              <div>
                <label style={labelStyle}>Video Provider</label>
                <select value={cmProvider} onChange={e => setCmProvider(e.target.value as "wan" | "kling_std")}
                  style={{ ...inputStyle, fontSize: 12 }}>
                  <option value="wan">Wan 2.5</option>
                  <option value="kling_std">Kling Standard</option>
                </select>
              </div>
            </div>
            {cmError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{cmError}</p>}
            {cmStatus && cmStatus !== "DONE" && (
              <p style={{ fontSize: 11, color: accent, marginBottom: 10 }}>Status: {cmStatus}{cmRunning && " — polling every 3s..."}</p>
            )}
            {cmFinalVideoUrl && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>Continuous Motion ready</p>
                <video src={cmFinalVideoUrl} controls style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000", marginBottom: 8 }} />
              </div>
            )}
            <button onClick={startContinuousMotion} disabled={cmRunning}
              style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: cmRunning ? "#2a2040" : accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: cmRunning ? "not-allowed" : "pointer" }}>
              {cmRunning ? `Generating… (${cmStatus ?? "starting"})` : "Generate Continuous Motion"}
            </button>
          </div>
        )}
      </div>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Scene Board ({totalScenes} scenes)</h2>
          {(storyEra || storyCulture) && (
            <div style={{ marginTop: 3 }}>
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#fb923c18", color: "#fb923c", fontWeight: 600 }}>
                {[storyEra, storyCulture].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setSceneViewMode("grid")}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sceneViewMode === "grid" ? accent : border}`, background: sceneViewMode === "grid" ? `${accent}10` : "transparent", color: sceneViewMode === "grid" ? accent : muted, fontSize: 10, cursor: "pointer" }}>
            Grid
          </button>
          <button onClick={() => setSceneViewMode("list")}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sceneViewMode === "list" ? accent : border}`, background: sceneViewMode === "list" ? `${accent}10` : "transparent", color: sceneViewMode === "list" ? accent : muted, fontSize: 10, cursor: "pointer" }}>
            List
          </button>
          <button disabled={runningIntelligence || scenes.length === 0} onClick={runSceneIntelligence}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4ade8030", background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}>
            {runningIntelligence ? "Detecting..." : "Scene Intelligence"}
          </button>
          {(() => {
            const pendingCount = scenes.filter(s => {
              const sid = `SC${String(s.scene).padStart(2, "0")}`;
              return !sceneImages[sid] && s.generationMethod !== "audio-only";
            }).length;
            return pendingCount > 0 ? (
              <button onClick={generateAllSceneImages} disabled={generatingAllImages || !!generatingSceneImage}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${green}40`, background: `${green}10`, color: green, fontSize: 10, fontWeight: 600, cursor: generatingAllImages ? "not-allowed" : "pointer" }}>
                {generatingAllImages ? "Generating..." : `Gen All Images (${pendingCount})`}
              </button>
            ) : null;
          })()}
        </div>
      </div>
      {runningIntelligence && (
        <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0" }}>Scene Intelligence running — detecting environments and ambient sounds...</p>
      )}
      {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
        <p style={{ fontSize: 10, color: "#666", margin: "4px 0" }}>
          {Object.keys(sceneIntelligence).length} scenes have sound environment data
        </p>
      )}

      {/* AI Model Picker row */}
      <div style={{ ...cardStyle, padding: "12px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${accent}40`, background: `${accent}10`, color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Video Model: <span style={{ color: "#fff" }}>{effectiveVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
              <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
                style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Image Model: <span style={{ color: "#fff" }}>{effectiveImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
              </button>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!moviePlan) return;
              for (const scene of moviePlan.scenes) {
                if (scene.status !== "generated" && scene.generationMethod !== "audio-only") {
                  await renderScene(scene.scene);
                }
              }
              saveProject();
            }}
            disabled={renderingScene !== null || totalScenes === 0}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: renderingScene !== null ? "#2a2a40" : purple, color: "#fff", fontSize: 10, fontWeight: 700, cursor: renderingScene !== null ? "not-allowed" : "pointer" }}>
            {renderingScene !== null ? `Rendering SC${String(renderingScene).padStart(2, "0")}...` : "Render All Videos"}
          </button>
        </div>
      </div>

      {totalScenes === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No scenes yet. Run AI Planning from the Design tab.</p>
          <button onClick={() => setActiveTab("design")} style={btnPrimary}>Go to Design</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: sceneViewMode === "grid" ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr", gap: 12 }}>
          {scenes.map(scene => {
            const sceneId = `SC${String(scene.scene).padStart(2, "0")}`;
            const hasImage = !!sceneImages[sceneId];
            const statusColor = scene.status === "approved" ? green : scene.status === "blocked" ? red : scene.status === "generated" ? blue : scene.status === "generating" ? accent : gold;
            const sceneChars = scene.characters.map(c => {
              const char = savedCharacters.find(ch => ch.id === c || ch.name === c || ch.characterId === c);
              return char?.name || c;
            });
            return (
              <div key={scene.scene} draggable onDragStart={() => handleDragStart(scene.scene)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(scene.scene)}
                style={{ ...cardStyle, padding: 0, overflow: "hidden", opacity: dragSource === scene.scene ? 0.5 : 1, cursor: "grab" }}>
                <div style={{ height: 140, background: s2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {hasImage ? (
                    <img src={sceneImages[sceneId]} alt={scene.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <Icon.Image style={{ width: 36, height: 36, color: muted, opacity: 0.2 }} />
                      <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>No image yet</p>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                    {sceneId}
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 8 }}>
                    <span style={badgeStyle(methodColors[scene.generationMethod] ?? accent)}>{scene.generationMethod}</span>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, right: 8 }}>
                    <span style={badgeStyle(statusColor)}>{scene.status}</span>
                  </div>
                </div>

                <div style={{ padding: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{scene.title}</p>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 8, lineHeight: 1.4 }}>
                    {(scene.goal || scene.visualDescription).substring(0, 80)}{(scene.goal || scene.visualDescription).length > 80 ? "..." : ""}
                  </p>

                  {sceneChars.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                      {sceneChars.map(name => (
                        <span key={name} style={{ fontSize: 8, padding: "2px 8px", borderRadius: 20, background: `${purple}15`, color: purple }}>{name}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, color: muted }}>{scene.duration}</span>
                    <span style={badgeStyle(costColors[scene.costLabel] || gold)}>{scene.costLabel}</span>
                  </div>

                  {sceneGenProgress[sceneId] && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: accent }}>{sceneGenProgress[sceneId].message}</span>
                        <span style={{ fontSize: 9, color: accent }}>{sceneGenProgress[sceneId].percent}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: border }}>
                        <div style={{ width: `${sceneGenProgress[sceneId].percent}%`, height: "100%", borderRadius: 2, background: accent, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  )}

                  {sceneVideos[sceneId] && !sceneGenProgress[sceneId] && (
                    <div style={{ marginBottom: 8 }}>
                      <video src={sceneVideos[sceneId]} controls loop muted style={{ width: "100%", borderRadius: 8, maxHeight: 120 }} />
                      {(sceneVideoVersions[sceneId]?.length ?? 0) > 1 && (
                        <p style={{ fontSize: 8, color: muted, marginTop: 2 }}>{sceneVideoVersions[sceneId].length} versions</p>
                      )}
                    </div>
                  )}

                  {(() => {
                    const intel = sceneIntelligence[sceneId];
                    if (!intel) return null;
                    const energyColor = SCENE_ENERGY_COLOR[intel.energyLevel] || "#888";
                    return (
                      <div style={{ margin: "8px 0", padding: "6px 8px", borderRadius: 8, background: "#ffffff05", border: "1px solid #ffffff0a" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{intel.environmentType.replace(/-/g, " ")}</span>
                          <span style={{ fontSize: 8, color: "#666" }}>•</span>
                          <span style={{ fontSize: 8, color: "#666", textTransform: "capitalize" }}>{intel.timeOfDay}</span>
                          <span style={{ marginLeft: "auto", fontSize: 7, padding: "1px 5px", borderRadius: 4, background: `${energyColor}20`, color: energyColor, fontWeight: 700, textTransform: "uppercase" }}>{intel.energyLevel}</span>
                        </div>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {intel.ambienceSounds.slice(0, 4).map((sound, i) => (
                            <span key={i} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#1a2a1a", color: "#4ade80", border: "1px solid #4ade8030" }}>{sound}</span>
                          ))}
                          {intel.sfxEvents.length > 0 && (
                            <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#2a1a1a", color: "#eab308", border: "1px solid #eab30830" }}>{intel.sfxEvents[0]}</span>
                          )}
                          {autoSfx && intel.sfxEvents.length > 0 && (
                            <span style={{ fontSize: 6, padding: "2px 5px", borderRadius: 20, background: "#1a1a2a", color: "#818cf8", border: "1px solid #818cf830" }}>Auto SFX</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action row 1 — style picker + Make Image / Make Video / Approve / Edit */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <select value={sceneStyles[sceneId] || effectiveProjectStyle || "realistic"}
                      onChange={e => setSceneStyles(prev => ({ ...prev, [sceneId]: e.target.value }))}
                      title="Override style for this scene"
                      style={{ padding: "0 6px", height: 28, borderRadius: 8, border: "1px solid #7c3aed40", background: "#0f172a", color: "#c084fc", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      <option value="3d-cinematic">3D Cinematic</option>
                      <option value="realistic">Realistic</option>
                      <option value="nollywood">Nollywood</option>
                      <option value="2d-cartoon">2D Cartoon</option>
                      <option value="anime">Anime</option>
                      <option value="storybook">Storybook</option>
                      <option value="comic">Comic</option>
                    </select>
                    <button onClick={() => makeSceneImage(scene)} disabled={generatingSceneImage === sceneId}
                      style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "none", background: generatingSceneImage === sceneId ? "#2a2a40" : "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneImage === sceneId ? "not-allowed" : "pointer" }}>
                      {generatingSceneImage === sceneId ? "..." : hasImage ? "Regen" : "Make Image"}
                    </button>
                    <button onClick={() => makeSceneVideo(scene)} disabled={!hasImage || generatingSceneVideos.has(sceneId)}
                      style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "none", background: !hasImage ? "#1a1a2a" : generatingSceneVideos.has(sceneId) ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c5cfc)`, color: !hasImage ? muted : "#fff", fontSize: 9, fontWeight: 700, cursor: !hasImage || generatingSceneVideos.has(sceneId) ? "not-allowed" : "pointer" }}>
                      {generatingSceneVideos.has(sceneId) ? "..." : sceneVideos[sceneId] ? "New Video" : "Make Video"}
                    </button>
                    <button onClick={() => updateScene(scene.scene, { status: scene.status === "approved" ? "planned" : "approved" })}
                      style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${green}30`, background: scene.status === "approved" ? `${green}15` : "transparent", color: green, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                      {scene.status === "approved" ? <Icon.Check style={{ width: 10, height: 10 }} /> : "OK"}
                    </button>
                    <button onClick={() => setExpandedSceneId(expandedSceneId === sceneId ? null : sceneId)}
                      style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`, background: expandedSceneId === sceneId ? `${blue}10` : "transparent", color: expandedSceneId === sceneId ? blue : muted, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                      {expandedSceneId === sceneId ? "Close" : "Edit"}
                    </button>
                  </div>

                  {/* Editor link */}
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <a href={`/dashboard/collaborative-editor?mode=ghs_hybrid&sceneId=${sceneId}&from=movie-planner`} style={{ flex: 1, textDecoration: "none" }}>
                      <button style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: `1px solid ${purple}30`, background: `${purple}06`, color: purple, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                        Editor
                      </button>
                    </a>
                  </div>

                  {/* Move / dup / del */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    <button onClick={() => moveScene(scene.scene, "up")} disabled={scene.scene === 1}
                      style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Up</button>
                    <button onClick={() => moveScene(scene.scene, "down")} disabled={scene.scene === totalScenes}
                      style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>Down</button>
                    <button onClick={() => duplicateScene(scene.scene)}
                      style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: blue, cursor: "pointer" }}>Dup</button>
                    <button onClick={() => deleteScene(scene.scene)}
                      style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, cursor: "pointer", marginLeft: "auto" }}>Del</button>
                  </div>

                  {/* Expanded edit panel */}
                  {expandedSceneId === sceneId && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, marginBottom: 10 }}>
                        <div>
                          <p style={{ ...labelStyle, fontSize: 9 }}>Visual Description</p>
                          <textarea value={scene.visualDescription}
                            onChange={e => updateScene(scene.scene, { visualDescription: e.target.value })}
                            onBlur={() => saveProject()}
                            rows={2} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                        </div>
                        <div>
                          <p style={{ ...labelStyle, fontSize: 9 }}>Camera Direction</p>
                          <input value={scene.cameraDirection}
                            onChange={e => updateScene(scene.scene, { cameraDirection: e.target.value })}
                            style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                        </div>
                        <div>
                          <p style={{ ...labelStyle, fontSize: 9 }}>Dialogue / Narration</p>
                          <textarea value={scene.dialogue}
                            onChange={e => updateScene(scene.scene, { dialogue: e.target.value })}
                            onBlur={() => saveProject()}
                            rows={2} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                        </div>
                        <div>
                          <p style={{ ...labelStyle, fontSize: 9 }}>Duration</p>
                          <input value={scene.duration}
                            onChange={e => updateScene(scene.scene, { duration: e.target.value })}
                            style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                        </div>
                      </div>
                      <SceneImagePanel
                        sceneId={sceneId}
                        sceneTitle={scene.title}
                        sceneText={scene.visualDescription || scene.goal}
                        projectId={projectId || undefined}
                        characters={savedCharacters.map(c => ({ id: c.id, characterId: c.characterId || c.id, name: c.name, imageUrl: c.imageUrl }))}
                        selectedCharacterIds={scene.characters}
                        onImageGenerated={(url) => {
                          setSceneImages(prev => ({ ...prev, [sceneId]: url }));
                          updateScene(scene.scene, { status: "generated" as const });
                          setLastAction(`Scene ${scene.scene} image generated`);
                        }}
                        onCharacterSelect={(ids) => updateScene(scene.scene, { characters: ids })}
                        onTextChange={(t) => updateScene(scene.scene, { visualDescription: t })}
                        compact
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
