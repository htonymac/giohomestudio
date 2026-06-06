"use client";

// Scene Board tab — establishing shots panel, continuous motion config, generate
// scenes from story CTA, per-scene cards (image + style override + Gen/Gen 4/Gen
// Max + variation thumbs + beat thumbs + editable title/description + SFX/music/
// continuous-motion controls + narration duration + AI Polish + Make Video +
// character chip picker), archived scenes panel.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 3.1, 2026-06-06).

import * as React from "react";
import * as Icon from "../../../components/icons";
import { splitIntoActionBeats } from "@/lib/scene/action-beats";

export interface SceneBoardScene {
  scene: number;
  title: string;
  visualDescription?: string;
  imageUrl?: string;
  characters?: string[];
  variantUrls?: string[];
}
export interface SceneBoardEstablishingShot {
  type: string;
  prompt: string;
  imageUrl?: string;
}
export interface SceneBoardSavedChar { id: string; name: string }
export interface SceneBoardCharacterIdentity { characterId: string; displayName: string }

type EstablishingMode = "off" | "minimal" | "auto" | "cinematic" | "epic";
type CmProvider = "wan" | "kling_std";
type SceneDuration = "short" | "medium" | "long";
type PreviewSceneItem = { url: string; type: "image" | "video"; title: string } | null;

export interface SceneBoardTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  childAccent: string;
  childSafe: string;
  // Header
  childScenes: SceneBoardScene[];
  setChildScenes: React.Dispatch<React.SetStateAction<SceneBoardScene[]>>;
  storyEra: string;
  storyCulture: string;
  // Establishing
  runChildrenEstablishAll: () => void | Promise<void>;
  establishingAllChild: boolean;
  establishingShotsChild: Record<string, SceneBoardEstablishingShot>;
  establishingModeChild: EstablishingMode;
  setEstablishingModeChild: (m: EstablishingMode) => void;
  genChildEstablishingShotImage: (sceneId: string) => void | Promise<void>;
  // Continuous motion
  continuousMotionEnabled: boolean;
  setContinuousMotionEnabled: (v: boolean) => void;
  cmError: string | null;
  setCmError: (s: string | null) => void;
  cmStatus: string | null;
  setCmStatus: (s: string | null) => void;
  cmFinalVideoUrl: string | null;
  setCmFinalVideoUrl: (s: string | null) => void;
  cmTotalDuration: number;
  setCmTotalDuration: (n: number) => void;
  cmSegmentDuration: number;
  setCmSegmentDuration: (n: number) => void;
  cmProvider: CmProvider;
  setCmProvider: (p: CmProvider) => void;
  cmRunning: boolean;
  startContinuousMotion: () => void | Promise<void>;
  // Generate scenes
  generateScenesFromStory: () => void | Promise<void>;
  generatingScenesFromStory: boolean;
  textContent: string;
  readAlongText: string;
  // Per-scene state
  sceneImages: Record<string, string>;
  setSceneImages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  generatingSceneImage: string | null;
  generatingVariations: Set<string>;
  sceneCharAssignments: Record<string, string[]>;
  setSceneCharAssignments: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setLightboxImage: (url: string | null) => void;
  importFileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  sceneStyles: Record<string, string>;
  setSceneStyles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  effectiveProjectStyle: string;
  generateSceneBoardImageVariations: (scene: SceneBoardScene) => void | Promise<void>;
  generateSceneBoardImage: (scene: SceneBoardScene) => void | Promise<void>;
  // Gen Max + beats
  sceneBeatImages: Record<string, string[]>;
  selectedBeatImages: Record<string, boolean[]>;
  setSelectedBeatImages: React.Dispatch<React.SetStateAction<Record<string, boolean[]>>>;
  generatingMaxBeats: Set<string>;
  maxBeatsProgress: Record<string, string>;
  makeChildSceneBeatImages: (scene: SceneBoardScene) => void | Promise<void>;
  setPreviewScene: (p: PreviewSceneItem) => void;
  // Video
  sceneVideos: Record<string, string>;
  generatingSceneVideos: Set<string>;
  makeSceneVideo: (scene: SceneBoardScene) => void | Promise<void>;
  // SFX + Music per scene
  generateSceneSfx: (sceneId: string, desc: string) => void | Promise<void>;
  generatingSceneSfx: Set<string>;
  generateSceneMusic: (sceneId: string, desc: string, title: string) => void | Promise<void>;
  generatingSceneMusic: Set<string>;
  sceneMusicUrls: Record<string, string>;
  // Continuous motion per scene
  sceneContinuousMotion: Record<string, { enabled: boolean; targetSec: number }>;
  setSceneContinuousMotion: React.Dispatch<React.SetStateAction<Record<string, { enabled: boolean; targetSec: number }>>>;
  // Title save debounce
  sceneTitleTimers: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>;
  // Narr duration + OK Save
  sceneDurations: Record<string, SceneDuration>;
  setSceneDurations: React.Dispatch<React.SetStateAction<Record<string, SceneDuration>>>;
  contentParam: string;
  topicParam: string;
  setLastAction: (s: string) => void;
  // Polish
  handlePolishScene: (sceneId: string, text: string, action: "polish") => void | Promise<void>;
  polishingScene: string | null;
  // Archive
  archiveScene: (n: number) => void | Promise<void>;
  archivedScenes: SceneBoardScene[];
  showArchived: boolean;
  setShowArchived: React.Dispatch<React.SetStateAction<boolean>>;
  restoreScene: (n: number) => void | Promise<void>;
  // Character picker source
  savedChars: SceneBoardSavedChar[];
  characters: SceneBoardCharacterIdentity[];
}

export default function SceneBoardTab(props: SceneBoardTabProps) {
  const {
    cardStyle, labelStyle, s2, border, muted, childAccent, childSafe,
    childScenes, setChildScenes, storyEra, storyCulture,
    runChildrenEstablishAll, establishingAllChild, establishingShotsChild, establishingModeChild, setEstablishingModeChild, genChildEstablishingShotImage,
    continuousMotionEnabled, setContinuousMotionEnabled, cmError, setCmError, cmStatus, setCmStatus, cmFinalVideoUrl, setCmFinalVideoUrl,
    cmTotalDuration, setCmTotalDuration, cmSegmentDuration, setCmSegmentDuration, cmProvider, setCmProvider, cmRunning, startContinuousMotion,
    generateScenesFromStory, generatingScenesFromStory, textContent, readAlongText,
    sceneImages, setSceneImages, generatingSceneImage, generatingVariations, sceneCharAssignments, setSceneCharAssignments,
    setLightboxImage, importFileRefs, sceneStyles, setSceneStyles, effectiveProjectStyle,
    generateSceneBoardImageVariations, generateSceneBoardImage,
    sceneBeatImages, selectedBeatImages, setSelectedBeatImages, generatingMaxBeats, maxBeatsProgress, makeChildSceneBeatImages, setPreviewScene,
    sceneVideos, generatingSceneVideos, makeSceneVideo,
    generateSceneSfx, generatingSceneSfx, generateSceneMusic, generatingSceneMusic, sceneMusicUrls,
    sceneContinuousMotion, setSceneContinuousMotion,
    sceneTitleTimers, sceneDurations, setSceneDurations, contentParam, topicParam, setLastAction,
    handlePolishScene, polishingScene,
    archiveScene, archivedScenes, showArchived, setShowArchived, restoreScene,
    savedChars, characters,
  } = props;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Scene Board</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 9, color: muted }}>{childScenes.length} scene{childScenes.length !== 1 ? "s" : ""}</span>
            {(storyEra || storyCulture) && (
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#fb923c18", color: "#fb923c", fontWeight: 600 }}>
                {[storyEra, storyCulture].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ESTABLISHING SHOTS PANEL */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: "#fbbf2440" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", margin: 0 }}>📷 Establishing Shots</p>
            <p style={{ fontSize: 10, color: muted, margin: "3px 0 0" }}>AI inserts a cinematic wide shot before scenes that need cinematic breathing space.</p>
          </div>
          <button onClick={runChildrenEstablishAll} disabled={establishingAllChild || childScenes.length === 0}
            style={{ padding: "6px 12px", borderRadius: 8, border: "none",
              background: (establishingAllChild || childScenes.length === 0) ? "#2a2040" : "linear-gradient(135deg, #fbbf24, #d97706)",
              color: "#000", fontSize: 10, fontWeight: 700, cursor: (establishingAllChild || childScenes.length === 0) ? "not-allowed" : "pointer" }}>
            {establishingAllChild ? "Planning…" : Object.keys(establishingShotsChild).length > 0 ? "Re-plan" : "Establish All"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: muted, fontWeight: 700, marginRight: 4 }}>Mode:</span>
          {(["off", "minimal", "auto", "cinematic", "epic"] as const).map(m => (
            <button key={m} onClick={() => setEstablishingModeChild(m)}
              title={
                m === "off" ? "No establishing shots at all" :
                m === "minimal" ? "Opening + location/time changes only" :
                m === "auto" ? "AI decides — full ruleset" :
                m === "cinematic" ? "Aggressive: opening, location, mood, pre-action, beauty" :
                "Every major scene gets a long dramatic opener"
              }
              style={{ padding: "3px 9px", borderRadius: 6,
                border: `1px solid ${establishingModeChild === m ? "#fbbf24" : "#3d5060"}`,
                background: establishingModeChild === m ? "#fbbf2415" : "transparent",
                color: establishingModeChild === m ? "#fbbf24" : muted,
                fontSize: 8, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const }}>
              {m}
            </button>
          ))}
        </div>
        {Object.keys(establishingShotsChild).length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {Object.entries(establishingShotsChild).map(([sceneId, shot]) => (
              <div key={sceneId} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700 }}>{sceneId.toUpperCase()} · {shot.type}</span>
                  <button onClick={() => genChildEstablishingShotImage(sceneId)}
                    style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #fbbf2470", background: "transparent", color: "#fbbf24", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                    {shot.imageUrl ? "Regen" : "Render"}
                  </button>
                </div>
                <p style={{ fontSize: 9, color: muted, margin: 0 }}>{shot.prompt.slice(0, 140)}{shot.prompt.length > 140 ? "…" : ""}</p>
                {shot.imageUrl && <img src={shot.imageUrl} alt={sceneId} style={{ marginTop: 6, width: "100%", maxHeight: 80, objectFit: "cover" as const, borderRadius: 5 }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONTINUOUS MOTION TOGGLE */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: continuousMotionEnabled ? `${childAccent}50` : border, background: continuousMotionEnabled ? `${childAccent}06` : undefined }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={continuousMotionEnabled}
            onChange={e => { setContinuousMotionEnabled(e.target.checked); setCmError(null); setCmStatus(null); setCmFinalVideoUrl(null); }}
            style={{ width: 16, height: 16, accentColor: childAccent }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: continuousMotionEnabled ? childAccent : "#fff" }}>
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
                <label style={{ ...labelStyle, fontSize: 9 }}>Total Duration (seconds)</label>
                <input type="number" min={5} max={120} value={cmTotalDuration}
                  onChange={e => setCmTotalDuration(Math.max(5, Number(e.target.value)))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, outline: "none" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Segment Duration (sec, max 10)</label>
                <input type="number" min={3} max={10} value={cmSegmentDuration}
                  onChange={e => setCmSegmentDuration(Math.min(10, Math.max(3, Number(e.target.value))))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, outline: "none" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Video Provider</label>
                <select value={cmProvider} onChange={e => setCmProvider(e.target.value as CmProvider)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, outline: "none" }}>
                  <option value="wan">Wan 2.5</option>
                  <option value="kling_std">Kling Standard</option>
                </select>
              </div>
            </div>
            {cmError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{cmError}</p>}
            {cmStatus && cmStatus !== "DONE" && (
              <p style={{ fontSize: 11, color: childAccent, marginBottom: 10 }}>Status: {cmStatus}{cmRunning && " — polling every 3s..."}</p>
            )}
            {cmFinalVideoUrl && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>Continuous Motion ready</p>
                <video src={cmFinalVideoUrl} controls style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000", marginBottom: 8 }} />
              </div>
            )}
            <button onClick={startContinuousMotion} disabled={cmRunning}
              style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: cmRunning ? "#2a2040" : childAccent, color: "#000", fontSize: 13, fontWeight: 700, cursor: cmRunning ? "not-allowed" : "pointer" }}>
              {cmRunning ? `Generating… (${cmStatus ?? "starting"})` : "Generate Continuous Motion"}
            </button>
          </div>
        )}
      </div>

      {/* Primary action: Generate from story */}
      <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${childAccent}40`, background: `${childAccent}06` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 6 }}>Generate Scenes from Story</p>
        <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>AI reads your story and plans per-scene cards with descriptions. Each scene gets its own image.</p>
        <button onClick={generateScenesFromStory} disabled={generatingScenesFromStory || (!textContent.trim() && !readAlongText.trim())}
          title={(!textContent.trim() && !readAlongText.trim()) ? "Add story content first" : ""}
          style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: generatingScenesFromStory ? "#2a2040" : (!textContent.trim() && !readAlongText.trim()) ? "#1a1a2a" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: (!textContent.trim() && !readAlongText.trim()) ? muted : "#fff", fontSize: 13, fontWeight: 700, cursor: (generatingScenesFromStory || (!textContent.trim() && !readAlongText.trim())) ? "not-allowed" : "pointer" }}>
          {generatingScenesFromStory ? "Planning scenes..." : childScenes.length > 0 ? "Regenerate Scenes from Story" : "Generate Scenes from Story"}
        </button>
        {!textContent.trim() && !readAlongText.trim() && (
          <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 6 }}>Add your story in the Content tab first.</p>
        )}
      </div>

      {/* Scene cards */}
      {childScenes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <Icon.Grid style={{ width: 32, height: 32, color: muted, margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontSize: 13, color: muted }}>No scenes yet. Click Generate Scenes from Story above.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {childScenes.map(scene => {
            const sceneId = `child_sc${String(scene.scene).padStart(2, "0")}`;
            const sceneImg = sceneImages[sceneId] || scene.imageUrl;
            const isGenImg = generatingSceneImage === sceneId;
            const isGenVar = generatingVariations.has(sceneId);
            const assignedChars = sceneCharAssignments[sceneId] || scene.characters || [];
            return (
              <div key={scene.scene} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <input type="file" accept="image/*"
                  ref={el => { importFileRefs.current[sceneId] = el; }}
                  style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const url = ev.target?.result as string;
                      if (url) {
                        setSceneImages(prev => ({ ...prev, [sceneId]: url }));
                        setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, imageUrl: url } : s));
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }} />
                {/* Image area */}
                <div style={{ height: 150, background: s2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", cursor: sceneImg ? "pointer" : "default" }}
                  onClick={() => sceneImg && setLightboxImage(sceneImg)}>
                  {sceneImg ? (
                    <img src={sceneImg} alt={scene.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Icon.Image style={{ width: 32, height: 32, color: muted, opacity: 0.3 }} />
                  )}
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "3px 8px" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: childAccent }}>{sceneId.toUpperCase()}</span>
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                    {sceneImg && (
                      <button onClick={e => { e.stopPropagation(); setLightboxImage(sceneImg); }}
                        title="Preview full-size"
                        style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                        Preview
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); importFileRefs.current[sceneId]?.click(); }}
                      title="Import image from file"
                      style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "rgba(0,0,0,0.7)", color: "#a78bfa", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                      Import
                    </button>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4, alignItems: "center" }}>
                    <select value={sceneStyles[sceneId] || effectiveProjectStyle || "storybook"}
                      onChange={e => { e.stopPropagation(); setSceneStyles(prev => ({ ...prev, [sceneId]: e.target.value })); }}
                      onClick={e => e.stopPropagation()}
                      title="Override style for this scene"
                      style={{ padding: "0 4px", height: 26, borderRadius: 7, border: "1px solid #7c3aed40", background: "rgba(15,23,42,0.9)", color: "#c084fc", fontSize: 8, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                      <option value="3d-cinematic">3D Cin</option>
                      <option value="realistic">Real</option>
                      <option value="nollywood">Nollywood</option>
                      <option value="2d-cartoon">2D Cart</option>
                      <option value="anime">Anime</option>
                      <option value="storybook">Story</option>
                      <option value="comic">Comic</option>
                    </select>
                    <button onClick={e => { e.stopPropagation(); generateSceneBoardImageVariations(scene); }} disabled={isGenImg || isGenVar}
                      title="Generate 4 variations"
                      style={{ padding: "5px 9px", borderRadius: 7, border: "none", background: isGenVar ? "#2a2040" : "#7c3aed30", color: isGenVar ? muted : "#a78bfa", fontSize: 9, fontWeight: 700, cursor: isGenImg || isGenVar ? "not-allowed" : "pointer" }}>
                      {isGenVar ? "Gen…" : "Gen 4"}
                    </button>
                    {(() => {
                      const beats = splitIntoActionBeats(`${scene.title}. ${scene.visualDescription}`);
                      const isMaxing = generatingMaxBeats.has(sceneId);
                      if (beats.length <= 1 && !sceneBeatImages[sceneId]?.length) return null;
                      return (
                        <button onClick={e => { e.stopPropagation(); makeChildSceneBeatImages(scene); }}
                          disabled={isGenImg || isGenVar || isMaxing}
                          title={`Generate one image per action beat (${beats.length} beats)`}
                          style={{ padding: "5px 9px", borderRadius: 7, border: "none",
                            background: isMaxing ? "#2a2040" : "linear-gradient(135deg,#ff6b00,#ff9500)",
                            color: "#fff", fontSize: 9, fontWeight: 700,
                            cursor: (isGenImg || isGenVar || isMaxing) ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap" as const }}>
                          {isMaxing ? (maxBeatsProgress[sceneId] || "…") : `Gen Max (${beats.length})`}
                        </button>
                      );
                    })()}
                    <button onClick={e => { e.stopPropagation(); generateSceneBoardImage(scene); }} disabled={isGenImg || isGenVar}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: isGenImg ? "#2a2040" : sceneImg ? `${childAccent}20` : childAccent, color: isGenImg ? muted : sceneImg ? childAccent : "#000", fontSize: 9, fontWeight: 700, cursor: isGenImg || isGenVar ? "not-allowed" : "pointer" }}>
                      {isGenImg ? "Generating..." : sceneImg ? "Regen" : "Generate"}
                    </button>
                  </div>
                </div>
                {/* Variation thumbnails */}
                {scene.variantUrls && scene.variantUrls.length > 1 && (
                  <div style={{ display: "flex", gap: 4, padding: "6px 8px", background: s2, borderTop: `1px solid ${border}` }}>
                    {scene.variantUrls.map((url, vi) => (
                      <button key={vi}
                        onClick={() => {
                          setSceneImages(prev => ({ ...prev, [sceneId]: url }));
                          setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, imageUrl: url } : s));
                        }}
                        title={`Use variation ${vi + 1}`}
                        style={{ padding: 0, border: `2px solid ${url === sceneImg ? childAccent : "transparent"}`, borderRadius: 5, overflow: "hidden", cursor: "pointer", background: "none", flexShrink: 0 }}>
                        <img src={url} alt={`Var ${vi + 1}`} style={{ width: 44, height: 44, objectFit: "cover", display: "block" }} />
                      </button>
                    ))}
                  </div>
                )}
                {/* Beat thumbnails */}
                {sceneBeatImages[sceneId]?.length > 0 && (
                  <div style={{ padding: "6px 8px", background: s2, borderTop: `1px solid ${border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 8, color: muted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                        Beats — tick to include in assembly
                      </span>
                      <span style={{ fontSize: 8, color: childAccent }}>
                        {(selectedBeatImages[sceneId] || []).filter(Boolean).length}/{sceneBeatImages[sceneId].length} on
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 4, overflowX: "auto" as const, paddingBottom: 2 }}>
                      {sceneBeatImages[sceneId].map((url, bi) => {
                        const checked = selectedBeatImages[sceneId]?.[bi] !== false;
                        return (
                          <div key={bi} style={{ flexShrink: 0, textAlign: "center" }}>
                            <img src={url} alt={`Beat ${bi + 1}`}
                              style={{ width: 56, height: 42, borderRadius: 4, objectFit: "cover" as const, display: "block", border: `2px solid ${checked ? childAccent : "#33334a"}`, opacity: checked ? 1 : 0.4, cursor: "zoom-in" }}
                              onClick={e => { e.stopPropagation(); setPreviewScene({ url, type: "image", title: `${scene.title} — Beat ${bi + 1}` }); }} />
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 2, cursor: "pointer", userSelect: "none" as const }}>
                              <input type="checkbox" checked={checked}
                                onChange={e => setSelectedBeatImages(prev => {
                                  const arr = [...(prev[sceneId] || sceneBeatImages[sceneId].map(() => true))];
                                  arr[bi] = e.target.checked;
                                  return { ...prev, [sceneId]: arr };
                                })}
                                style={{ width: 11, height: 11, cursor: "pointer" }} />
                              <span style={{ fontSize: 7, color: checked ? "#fff" : muted }}>B{bi + 1}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Content area */}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 7, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0, marginTop: 2,
                      background: sceneVideos[sceneId] ? `${childSafe}20` : `${childAccent}15`,
                      color: sceneVideos[sceneId] ? childSafe : childAccent,
                      border: `1px solid ${sceneVideos[sceneId] ? childSafe : childAccent}40`,
                      textTransform: "uppercase" as const, letterSpacing: "0.08em",
                    }}>
                      {sceneVideos[sceneId] ? "Video-led" : "Image-led"}
                    </span>
                    <textarea value={scene.title} rows={1}
                      onChange={e => {
                        const val = e.target.value;
                        setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, title: val } : s));
                        clearTimeout(sceneTitleTimers.current[sceneId]);
                        sceneTitleTimers.current[sceneId] = setTimeout(() => { /* auto-saved */ }, 500);
                      }}
                      style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${border}`, borderRadius: 0, padding: "2px 0", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.3 }}
                      placeholder="Scene title..." />
                    <button onClick={() => archiveScene(scene.scene)}
                      title="Move to archive (not permanently deleted)"
                      style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid #ef444440", background: "#ef444410", color: "#ef4444", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0, marginTop: 1 }}>
                      Archive
                    </button>
                  </div>

                  <textarea value={scene.visualDescription}
                    onChange={e => setChildScenes(prev => prev.map(s => s.scene === scene.scene ? { ...s, visualDescription: e.target.value } : s))}
                    style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#ccc", fontSize: 10, outline: "none", resize: "vertical", minHeight: 56, marginBottom: 6 }}
                    placeholder="Scene description (editable)..." />

                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const, marginTop: 8, marginBottom: 8 }}>
                    <button onClick={() => generateSceneSfx(sceneId, scene.visualDescription ?? "")}
                      disabled={generatingSceneSfx.has(sceneId)}
                      title="Auto-extract SFX cues from scene text"
                      style={{ padding: "4px 9px", fontSize: 10, borderRadius: 6, border: "1px solid #7c3aed",
                        background: generatingSceneSfx.has(sceneId) ? "#3b2a6e" : "#1a0a3a",
                        color: "#c4b5fd", cursor: generatingSceneSfx.has(sceneId) ? "wait" : "pointer" }}>
                      {generatingSceneSfx.has(sceneId) ? "SFX..." : "AI SFX"}
                    </button>
                    <button onClick={() => generateSceneMusic(sceneId, scene.visualDescription ?? "", scene.title)}
                      disabled={generatingSceneMusic.has(sceneId)}
                      title="Generate music mood for this scene"
                      style={{ padding: "4px 9px", fontSize: 10, borderRadius: 6,
                        border: `1px solid ${sceneMusicUrls[sceneId] ? childSafe : "#4a5568"}`,
                        background: generatingSceneMusic.has(sceneId) ? "#1a2a1a" : sceneMusicUrls[sceneId] ? `${childSafe}15` : "transparent",
                        color: generatingSceneMusic.has(sceneId) ? muted : sceneMusicUrls[sceneId] ? childSafe : muted,
                        cursor: generatingSceneMusic.has(sceneId) ? "wait" : "pointer" }}>
                      {generatingSceneMusic.has(sceneId) ? "Music..." : sceneMusicUrls[sceneId] ? "Music ✓" : "Scene Music"}
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#a78bfa", cursor: "pointer" }}>
                      <input type="checkbox" checked={sceneContinuousMotion[sceneId]?.enabled ?? false}
                        onChange={e => setSceneContinuousMotion(prev => ({
                          ...prev,
                          [sceneId]: { enabled: e.target.checked, targetSec: prev[sceneId]?.targetSec ?? 10 },
                        }))} />
                      Motion
                    </label>
                    {sceneContinuousMotion[sceneId]?.enabled && (
                      <select value={sceneContinuousMotion[sceneId]?.targetSec ?? 10}
                        onChange={e => setSceneContinuousMotion(prev => ({
                          ...prev,
                          [sceneId]: { ...prev[sceneId], targetSec: Number(e.target.value) },
                        }))}
                        style={{ padding: "2px 5px", fontSize: 10, borderRadius: 4, border: "1px solid #4c1d95", background: "#1a0a3a", color: "#c4b5fd" }}>
                        {[5, 10, 15, 20, 30].map(s => <option key={s} value={s}>{s}s</option>)}
                      </select>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 9, color: muted, fontWeight: 600, whiteSpace: "nowrap" as const }}>Narr:</span>
                    {(["short", "medium", "long"] as const).map(d => (
                      <button key={d} onClick={() => setSceneDurations(prev => ({ ...prev, [sceneId]: d }))}
                        style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${(sceneDurations[sceneId] || "medium") === d ? childAccent : border}`, background: (sceneDurations[sceneId] || "medium") === d ? `${childAccent}20` : "transparent", color: (sceneDurations[sceneId] || "medium") === d ? childAccent : muted, fontSize: 8, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const }}>
                        {d}
                      </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        fetch("/api/hybrid/scene-plan", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            projectId: `children_${contentParam || "story"}_${topicParam || "default"}`,
                            title: `Children Story — ${contentParam || "story"}`,
                            scenes: childScenes.map(cs => ({
                              sceneId: cs.scene, description: cs.visualDescription, title: cs.title,
                            })),
                          }),
                        }).catch(() => null);
                        setLastAction(`Scene ${scene.scene} saved`);
                      }}
                      style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${childSafe}40`, background: `${childSafe}10`, color: childSafe, fontSize: 8, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                      OK Save
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" as const }}>
                    {sceneImg && (
                      <button onClick={() => setLightboxImage(sceneImg)}
                        title="Preview full-size (lightbox)"
                        style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #38bdf840", background: "#38bdf810", color: "#38bdf8", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                        Preview
                      </button>
                    )}
                    <button onClick={() => handlePolishScene(sceneId, scene.visualDescription ?? "", "polish")}
                      disabled={polishingScene === sceneId}
                      data-testid={`polish-btn-${sceneId}`}
                      style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #a855f770", background: polishingScene === sceneId ? "#a855f715" : "transparent", color: polishingScene === sceneId ? muted : "#c084fc", fontSize: 9, fontWeight: 700, cursor: polishingScene === sceneId ? "not-allowed" : "pointer" }}>
                      {polishingScene === sceneId ? "Editing..." : "✨ Polish"}
                    </button>
                    <button onClick={() => makeSceneVideo(scene)}
                      disabled={generatingSceneVideos.has(sceneId)}
                      title="Generate video clip — POST /api/hybrid/scene-video"
                      style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${childSafe}50`, background: generatingSceneVideos.has(sceneId) ? `${childSafe}08` : `${childSafe}12`, color: generatingSceneVideos.has(sceneId) ? muted : childSafe, fontSize: 9, fontWeight: 700, cursor: generatingSceneVideos.has(sceneId) ? "not-allowed" : "pointer" }}>
                      {generatingSceneVideos.has(sceneId) ? "Making..." : sceneVideos[sceneId] ? "Vid ✓" : "Make Video"}
                    </button>
                  </div>

                  {sceneVideos[sceneId] && (
                    <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", border: `1px solid ${childSafe}30` }}>
                      <video src={sceneVideos[sceneId]} controls loop style={{ width: "100%", maxHeight: 120, display: "block" }} />
                    </div>
                  )}

                  {sceneMusicUrls[sceneId] && (
                    <div style={{ marginBottom: 8, padding: "6px 8px", borderRadius: 7, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
                      <p style={{ fontSize: 8, color: childSafe, marginBottom: 4, fontWeight: 700 }}>Scene Music</p>
                      <audio src={sceneMusicUrls[sceneId]} controls style={{ width: "100%", height: 28 }} />
                    </div>
                  )}

                  <div>
                    <p style={{ fontSize: 9, color: muted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 1 }}>Characters in scene</p>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, alignItems: "center" }}>
                      {assignedChars.length === 0 && (
                        <span style={{ fontSize: 9, color: muted, fontStyle: "italic" }}>None assigned</span>
                      )}
                      {assignedChars.map(charId => {
                        const charSimple = savedChars.find(c => c.id === charId);
                        const charFull = characters.find(c => c.characterId === charId);
                        const charName = charSimple?.name || charFull?.displayName || charId;
                        return (
                          <span key={charId} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, background: `${childAccent}15`, border: `1px solid ${childAccent}50`, color: childAccent, fontSize: 9, fontWeight: 700 }}>
                            {charName}
                            <button onClick={() => setSceneCharAssignments(prev => ({ ...prev, [sceneId]: (prev[sceneId] || []).filter(id => id !== charId) }))}
                              style={{ background: "none", border: "none", color: childAccent, cursor: "pointer", padding: 0, fontSize: 11, lineHeight: 1, opacity: 0.7 }}>×</button>
                          </span>
                        );
                      })}
                      {(() => {
                        const allPickable: Array<{ id: string; name: string }> = [];
                        for (const c of savedChars) {
                          if (!assignedChars.includes(c.id)) allPickable.push({ id: c.id, name: c.name });
                        }
                        for (const c of characters) {
                          if (!assignedChars.includes(c.characterId) && !allPickable.some(p => p.name.toLowerCase() === c.displayName.toLowerCase())) {
                            allPickable.push({ id: c.characterId, name: c.displayName });
                          }
                        }
                        if (allPickable.length === 0) return null;
                        return (
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                setSceneCharAssignments(prev => ({ ...prev, [sceneId]: [...(prev[sceneId] || []), e.target.value] }));
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                            style={{ padding: "2px 6px", borderRadius: 6, background: s2, border: `1px solid ${border}`, color: muted, fontSize: 9, cursor: "pointer" }}>
                            <option value="">+ Assign</option>
                            {allPickable.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived Scenes panel */}
      {archivedScenes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowArchived(v => !v)}
            style={{ fontSize: 11, color: muted, background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", marginBottom: 10 }}>
            {showArchived ? "Hide" : "Show"} Archived Scenes ({archivedScenes.length})
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {archivedScenes.map(s => (
                <div key={s.scene} style={{ background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 10, color: muted, fontWeight: 700 }}>Scene {s.scene}</span>
                  <span style={{ fontSize: 11, color: "#ccc", flex: 1 }}>{s.title}</span>
                  <button onClick={() => restoreScene(s.scene)}
                    style={{ fontSize: 10, color: childSafe, background: `${childSafe}10`, border: `1px solid ${childSafe}40`, borderRadius: 7, padding: "4px 12px", cursor: "pointer", fontWeight: 700 }}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
