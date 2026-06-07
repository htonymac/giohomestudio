"use client";

// Assembly tab — the largest and most-interactive surface. Step-by-step readiness
// checklist, scene-selection grid with per-scene Make Video / multi-image picker,
// audio panel (narration + music with inline generators), AI Supervisor, subtitle
// styler + match check, intro/outro card generators, credits row, subtitle font
// size picker, image flip rate picker, Pacing Engine (build/narrate/assemble
// + karaoke preview), and the big Assemble button with progress bar + result.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 3.2, 2026-06-06).

import * as React from "react";
import * as Icon from "../../../components/icons";
import { ds } from "../../../../lib/designSystem";
import SubtitleStyler, { type SubtitleConfig } from "../../../components/SubtitleStyler";
import ChildrenKaraokeSubtitle from "../../../components/ChildrenKaraokeSubtitle";
import { splitIntoActionBeats } from "@/lib/scene/action-beats";
import type { ChildrenPacingPlan } from "@/types/children";

export interface AssemblyScene { scene: number; title: string; visualDescription?: string; imageUrl?: string; variantUrls?: string[] }
export interface AssemblyCharacter { displayName: string; voiceId: string }
export interface AssemblySoundTier { id: string; providerKey: string }
export interface AssemblySupervisorReport { ok: boolean; summary: string; issues: string[]; fixed: string[] }

type NarrationProvider = "piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "edge-tts" | "gtts" | "gemini" | "fal-f5" | "fal-xtts" | "fal-bark";
type MediaPref = "image" | "video";

export interface AssemblyTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  childAccent: string;
  childSafe: string;
  // Story state
  expandedContent: string;
  textContent: string;
  // Scenes
  childScenes: AssemblyScene[];
  sceneImages: Record<string, string>;
  sceneVideos: Record<string, string>;
  sceneBeatImages: Record<string, string[]>;
  selectedBeatImages: Record<string, boolean[]>;
  setSelectedBeatImages: React.Dispatch<React.SetStateAction<Record<string, boolean[]>>>;
  makeChildSceneBeatImages: (scene: AssemblyScene) => void | Promise<void>;
  generatingMaxBeats: Set<string>;
  maxBeatsProgress: Record<string, string>;
  useMaxImageScenes: Set<string>;
  setUseMaxImageScenes: React.Dispatch<React.SetStateAction<Set<string>>>;
  sceneMaxTarget: Record<string, number>;
  setSceneMaxTarget: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  sceneGenProgress: Record<string, { percent: number; message: string }>;
  generatingSceneVideos: Set<string>;
  makeSceneVideo: (scene: AssemblyScene) => void | Promise<void>;
  setPreviewScene: (p: { url: string; type: "image" | "video"; title: string } | null) => void;
  // Assembly selection
  assemblySelectedIds: string[];
  setAssemblySelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  assemblyMediaPrefs: Record<string, MediaPref>;
  setAssemblyMediaPrefs: React.Dispatch<React.SetStateAction<Record<string, MediaPref>>>;
  // Audio
  resolveNarrationText: () => Promise<{ text: string }>;
  effectiveNarrationProvider: NarrationProvider;
  narratorAudioUrl: string | null;
  setNarratorAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setLastAction: (s: string) => void;
  setUiError: React.Dispatch<React.SetStateAction<string | null>>;
  tone: string;
  SOUND_TIERS: ReadonlyArray<AssemblySoundTier>;
  effectiveSoundTier: string;
  selectedMusicUrl: string | null;
  setSelectedMusicUrl: React.Dispatch<React.SetStateAction<string | null>>;
  generatedMusicUrl: string;
  setGeneratedMusicUrl: React.Dispatch<React.SetStateAction<string>>;
  // AI supervisor
  aiSupervisorReport: AssemblySupervisorReport | null;
  setAiSupervisorReport: React.Dispatch<React.SetStateAction<AssemblySupervisorReport | null>>;
  aiSupervisorRunning: boolean;
  runAiSupervisor: () => void | Promise<void>;
  // Subtitle
  effectiveSubtitleConfig: SubtitleConfig;
  subtitleConfig: SubtitleConfig;
  setSubtitleConfig: React.Dispatch<React.SetStateAction<SubtitleConfig>>;
  patchProjectSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  subtitleMatchResult: { status: "ok" | "warn" | "checking"; note: string } | null;
  setSubtitleMatchResult: React.Dispatch<React.SetStateAction<{ status: "ok" | "warn" | "checking"; note: string } | null>>;
  // Intro / Outro
  introUrl: string | null;
  setIntroUrl: React.Dispatch<React.SetStateAction<string | null>>;
  outroUrl: string | null;
  setOutroUrl: React.Dispatch<React.SetStateAction<string | null>>;
  generatingIntro: boolean;
  setGeneratingIntro: React.Dispatch<React.SetStateAction<boolean>>;
  generatingOutro: boolean;
  setGeneratingOutro: React.Dispatch<React.SetStateAction<boolean>>;
  projectTitle: string;
  topicParam: string;
  contentParam: string;
  studioName: string;
  setStudioName: React.Dispatch<React.SetStateAction<string>>;
  characters: AssemblyCharacter[];
  // Credits
  writtenBy: string;
  setWrittenBy: (s: string) => void;
  madeBy: string;
  setMadeBy: (s: string) => void;
  ideaFrom: string;
  setIdeaFrom: (s: string) => void;
  // Flip rate
  imageFlipRate: number;
  setImageFlipRate: React.Dispatch<React.SetStateAction<number>>;
  // Pacing
  pacingPlan: ChildrenPacingPlan | null;
  buildingPacingPlan: boolean;
  buildPacingPlan: () => void | Promise<void>;
  buildingPacingNarration: boolean;
  generatePacingNarration: () => void | Promise<void>;
  pacingAudioUrl: string;
  pacingVideoUrl: string;
  assemblingPacingVideo: boolean;
  assemblePacingVideo: () => void | Promise<void>;
  pacingActiveEntryIdx: number;
  setPacingActiveEntryIdx: React.Dispatch<React.SetStateAction<number>>;
  // Assemble main
  assembleMovie: () => void | Promise<void>;
  assembling: boolean;
  assembledUrl: string | null;
  assemblyElapsedSec: number;
  assemblePercent: number;
  assemblyError: string | null;
  setAssemblyError: React.Dispatch<React.SetStateAction<string | null>>;
  // Nav
  setActiveTab: (t: "content" | "sceneBoard" | "sound" | "review2") => void;
}

export default function AssemblyTab(props: AssemblyTabProps) {
  const {
    cardStyle, s2, border, muted, childAccent, childSafe,
    expandedContent, textContent,
    childScenes, sceneImages, sceneVideos, sceneBeatImages, selectedBeatImages, setSelectedBeatImages,
    makeChildSceneBeatImages, generatingMaxBeats, maxBeatsProgress, useMaxImageScenes, setUseMaxImageScenes,
    sceneMaxTarget, setSceneMaxTarget, sceneGenProgress, generatingSceneVideos, makeSceneVideo, setPreviewScene,
    assemblySelectedIds, setAssemblySelectedIds, assemblyMediaPrefs, setAssemblyMediaPrefs,
    resolveNarrationText, effectiveNarrationProvider, narratorAudioUrl, setNarratorAudioUrl,
    setLastAction, setUiError,
    tone, SOUND_TIERS, effectiveSoundTier, selectedMusicUrl, setSelectedMusicUrl, generatedMusicUrl, setGeneratedMusicUrl,
    aiSupervisorReport, setAiSupervisorReport, aiSupervisorRunning, runAiSupervisor,
    effectiveSubtitleConfig, subtitleConfig, setSubtitleConfig, patchProjectSettings,
    subtitleMatchResult, setSubtitleMatchResult,
    introUrl, setIntroUrl, outroUrl, setOutroUrl, generatingIntro, setGeneratingIntro, generatingOutro, setGeneratingOutro,
    projectTitle, topicParam, contentParam, studioName, setStudioName, characters,
    writtenBy, setWrittenBy, madeBy, setMadeBy, ideaFrom, setIdeaFrom,
    imageFlipRate, setImageFlipRate,
    pacingPlan, buildingPacingPlan, buildPacingPlan, buildingPacingNarration, generatePacingNarration,
    pacingAudioUrl, pacingVideoUrl, assemblingPacingVideo, assemblePacingVideo,
    pacingActiveEntryIdx, setPacingActiveEntryIdx,
    assembleMovie, assembling, assembledUrl, assemblyElapsedSec, assemblePercent, assemblyError, setAssemblyError,
    setActiveTab,
  } = props;

  return (
    <div style={{ ...cardStyle, padding: 28 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Icon.Film style={{ width: 22, height: 22, color: childAccent, flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Assemble Your Video</h2>
          <p style={{ fontSize: 11, color: muted }}>Follow these steps to build your children&apos;s story video.</p>
        </div>
      </div>

      {/* Step-by-step readiness checklist */}
      <div style={{ ...cardStyle, marginBottom: 20, borderColor: `${childAccent}30`, padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 14 }}>Where are you right now?</p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {/* Step 1 — story */}
          {(() => {
            const done = !!(expandedContent || textContent);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 1 — Create your story</p>
                  {done ? <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>Story is written and ready.</p>
                    : <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>You have not written a story yet. Go to the Story tab and type or generate your children&apos;s story first.</p>}
                </div>
                {!done && (
                  <button onClick={() => setActiveTab("content")}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Go to Story
                  </button>
                )}
              </div>
            );
          })()}
          {/* Step 2 — scenes */}
          {(() => {
            const done = childScenes.length > 0;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 2 — Generate scenes</p>
                  {done ? <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{childScenes.length} scene{childScenes.length !== 1 ? "s" : ""} generated.</p>
                    : <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>No scenes yet. Go to Scene Board and press &quot;Generate Scenes&quot; to turn your story into individual video scenes.</p>}
                </div>
                {!done && (
                  <button onClick={() => setActiveTab("sceneBoard")}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Go to Scene Board
                  </button>
                )}
              </div>
            );
          })()}
          {/* Step 3 — select scenes */}
          {(() => {
            const scenesExist = childScenes.length > 0;
            const done = assemblySelectedIds.length > 0;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 3 — Pick scenes to include</p>
                  {done ? <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{assemblySelectedIds.length} scene{assemblySelectedIds.length !== 1 ? "s" : ""} selected.</p>
                    : scenesExist
                      ? <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>Check the boxes below next to the scenes you want in your video. You can include all of them or just some.</p>
                      : <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>Complete Step 2 first.</p>}
                </div>
                {!done && scenesExist && (
                  <button onClick={() => setAssemblySelectedIds(childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}`))}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Select All
                  </button>
                )}
              </div>
            );
          })()}
          {/* Step 4 — assemble */}
          {(() => {
            const done = !!assembledUrl;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: done ? `${childSafe}08` : `${childAccent}06`, border: `1px solid ${done ? childSafe : border}30` }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: done ? childSafe : "#fff" }}>Step 4 — Press Assemble</p>
                  {done ? <p style={{ fontSize: 10, color: childSafe, fontWeight: 600, marginTop: 2 }}>Video is ready! Scroll down to watch it.</p>
                    : <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>When the scenes above are checked, scroll down and click the big Assemble button.</p>}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Scene selection + assemble */}
      {childScenes.length > 0 ? (
        <div style={{ ...cardStyle, marginBottom: 20, borderColor: `${childAccent}30` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.Film style={{ width: 14, height: 14 }} /> Choose Your Scenes
          </p>
          <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Tick the scenes you want in the final video, then press Assemble. You can also make a video for each scene individually.</p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 10 }}>
            <button onClick={() => setAssemblySelectedIds(childScenes.map(s => `child_sc${String(s.scene).padStart(2, "0")}`))}
              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${childSafe}`, background: "transparent", color: childSafe, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Select All</button>
            <button onClick={() => setAssemblySelectedIds([])}
              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>Deselect All</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
            {childScenes.map(s => {
              const sceneId = `child_sc${String(s.scene).padStart(2, "0")}`;
              const isSelected = assemblySelectedIds.includes(sceneId);
              const videoUrl = sceneVideos[sceneId];
              const imageUrl = sceneImages[sceneId] || s.imageUrl;
              const isGenerating = generatingSceneVideos.has(sceneId);
              const progress = sceneGenProgress[sceneId];
              const mediaPref = assemblyMediaPrefs[sceneId];
              const effectivePref: MediaPref = mediaPref ?? (videoUrl ? "video" : "image");
              return (
                <div key={s.scene} style={{ background: s2, borderRadius: 10, border: `1px solid ${isSelected ? childAccent : border}`, padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected}
                      onChange={e => setAssemblySelectedIds(prev => e.target.checked ? [...prev, sceneId] : prev.filter(id => id !== sceneId))}
                      style={{ marginTop: 4, accentColor: childAccent, flexShrink: 0 }} />
                    {imageUrl && (
                      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                        <img src={imageUrl} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 6, flexWrap: "wrap" as const }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: childAccent }}>SC{String(s.scene).padStart(2, "0")}</span>
                          <p style={{ fontSize: 11, color: "#fff", margin: "2px 0" }}>{s.title}</p>
                        </div>
                        <button onClick={() => makeSceneVideo(s)} disabled={isGenerating}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: isGenerating ? "#2a2a40" : videoUrl ? `${childSafe}20` : childAccent, color: isGenerating ? muted : videoUrl ? childSafe : "#000", fontSize: 9, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer", flexShrink: 0 }}>
                          {isGenerating ? "..." : videoUrl ? "Regen Vid" : "+ Make Video"}
                        </button>
                      </div>
                      {/* Media toggle + Gen Max */}
                      {(() => {
                        const genMaxBeats = sceneBeatImages[sceneId] || [];
                        const variants = (s.variantUrls && s.variantUrls.length > 1) ? s.variantUrls : [];
                        const beats = genMaxBeats.length > 1 ? genMaxBeats : variants;
                        const totalBeats = beats.length;
                        const onCount = (selectedBeatImages[sceneId] || []).filter(Boolean).length;
                        return (
                          <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                            <span style={{ fontSize: 9, color: muted, alignSelf: "center" }}>USE IN ASSEMBLY:</span>
                            <button onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "image" }))}
                              disabled={!imageUrl && totalBeats === 0}
                              style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${effectivePref === "image" ? childSafe : border}`, background: effectivePref === "image" && (imageUrl || totalBeats > 0) ? `${childSafe}15` : "transparent", color: (imageUrl || totalBeats > 0) ? (effectivePref === "image" ? childSafe : muted) : "#444", fontSize: 9, fontWeight: effectivePref === "image" ? 700 : 400, cursor: (imageUrl || totalBeats > 0) ? "pointer" : "not-allowed" }}>
                              Image {effectivePref === "image" ? "SELECTED" : (imageUrl || totalBeats > 0) ? "" : "(none)"}
                            </button>
                            <button onClick={() => setAssemblyMediaPrefs(prev => ({ ...prev, [sceneId]: "video" }))}
                              disabled={!videoUrl}
                              style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${effectivePref === "video" ? "#f59e0b" : border}`, background: effectivePref === "video" && videoUrl ? "#f59e0b15" : "transparent", color: videoUrl ? (effectivePref === "video" ? "#f59e0b" : muted) : "#444", fontSize: 9, fontWeight: effectivePref === "video" ? 700 : 400, cursor: videoUrl ? "pointer" : "not-allowed" }}>
                              Video {effectivePref === "video" ? "SELECTED" : videoUrl ? "" : "(none)"}
                            </button>
                            {(() => {
                              const isMaxOn = useMaxImageScenes.has(sceneId);
                              const isGen = generatingMaxBeats.has(sceneId);
                              const split = splitIntoActionBeats(`${s.title}. ${s.visualDescription}`).length;
                              const predictedBeats = totalBeats > 0 ? totalBeats : Math.max(split, 2);
                              const includedCount = isMaxOn ? onCount : 1;
                              if (totalBeats === 0) {
                                const target = sceneMaxTarget[sceneId] ?? 4;
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 0, borderRadius: 6, border: `1px dashed #ff9500`, overflow: "hidden" as const }}>
                                    <input type="number" min={1} max={30} value={target}
                                      onChange={e => {
                                        const v = Math.max(1, Math.min(30, parseInt(e.target.value) || 4));
                                        setSceneMaxTarget(prev => ({ ...prev, [sceneId]: v }));
                                      }}
                                      title="How many images to generate (1-30)"
                                      style={{ width: 36, padding: "3px 4px", border: "none", background: "transparent", color: "#ff9500", fontSize: 9, fontWeight: 700, textAlign: "center" as const }} />
                                    <button
                                      onClick={async () => {
                                        if (isGen) return;
                                        await makeChildSceneBeatImages(s);
                                        setUseMaxImageScenes(prev => new Set(prev).add(sceneId));
                                      }}
                                      disabled={isGen}
                                      title={`Generate ${target} images and append to scene pool`}
                                      style={{
                                        padding: "3px 9px", border: "none", borderLeft: `1px dashed #ff9500`,
                                        background: isGen ? "#2a2040" : "transparent",
                                        color: isGen ? muted : "#ff9500",
                                        fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" as const,
                                        cursor: isGen ? "not-allowed" : "pointer",
                                      }}>
                                      {isGen ? (maxBeatsProgress[sceneId] || "Generating…") : `+ Gen Max`}
                                    </button>
                                  </span>
                                );
                              }
                              return (
                                <button
                                  onClick={() => setUseMaxImageScenes(prev => {
                                    const n = new Set(prev);
                                    if (n.has(sceneId)) n.delete(sceneId);
                                    else {
                                      n.add(sceneId);
                                      if (!selectedBeatImages[sceneId]) {
                                        setSelectedBeatImages(p => ({ ...p, [sceneId]: beats.map(() => true) }));
                                      }
                                    }
                                    return n;
                                  })}
                                  title={isMaxOn
                                    ? `Using ${includedCount} of ${totalBeats} max images — click to revert to single image`
                                    : `Click to use multiple beat images (${totalBeats} available) instead of one`}
                                  style={{
                                    padding: "3px 9px", borderRadius: 6,
                                    border: `1px solid ${isMaxOn ? "#ff9500" : "#ff950060"}`,
                                    background: isMaxOn ? "#ff9500" : "#ff950012",
                                    color: isMaxOn ? "#000" : "#ff9500",
                                    fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" as const,
                                    cursor: "pointer",
                                  }}>
                                  {isMaxOn ? `Max ON (${includedCount}/${totalBeats})` : `Use Max Image (${totalBeats})`}
                                </button>
                              );
                            })()}
                            {imageUrl && (
                              <button onClick={() => setPreviewScene({ url: imageUrl, type: "image", title: s.title })}
                                style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>
                                Preview
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      {/* Multi-image picker */}
                      {(() => {
                        const genMaxBeats = sceneBeatImages[sceneId] || [];
                        const variants = (s.variantUrls && s.variantUrls.length > 1) ? s.variantUrls : [];
                        const beats = genMaxBeats.length > 1 ? genMaxBeats : variants;
                        if (beats.length <= 1) return null;
                        return (
                          <div style={{ marginTop: 4, marginBottom: 6, padding: "8px 10px", background: "#ff95000a", border: "1px solid #ff950025", borderRadius: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 9, color: "#ff9500", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                                Pick which images to include
                              </span>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sceneId]: beats.map(() => true) }))}
                                  style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ff950060", background: "transparent", color: "#ff9500", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                  Select All
                                </button>
                                <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sceneId]: beats.map(() => false) }))}
                                  style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                                  Deselect All
                                </button>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                              {beats.map((url, bi) => {
                                const checked = selectedBeatImages[sceneId]?.[bi] !== false;
                                return (
                                  <label key={bi} title={`Image ${bi + 1} — ${checked ? "included" : "skipped"} in assembly`}
                                    style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: 3, borderRadius: 5, border: `2px solid ${checked ? "#ff9500" : "#33334a"}`, background: checked ? "#ff950018" : "transparent", cursor: "pointer", userSelect: "none" as const }}>
                                    <img src={url} alt={`B${bi + 1}`}
                                      style={{ width: 60, height: 44, objectFit: "cover" as const, borderRadius: 3, opacity: checked ? 1 : 0.4 }}
                                      onClick={e => { e.preventDefault(); setPreviewScene({ url, type: "image", title: `${s.title} — Image ${bi + 1}` }); }} />
                                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                      <input type="checkbox" checked={checked}
                                        onChange={e => setSelectedBeatImages(prev => {
                                          const arr = [...(prev[sceneId] || beats.map(() => true))];
                                          arr[bi] = e.target.checked;
                                          return { ...prev, [sceneId]: arr };
                                        })}
                                        style={{ width: 11, height: 11 }} />
                                      <span style={{ fontSize: 8, color: checked ? "#ff9500" : muted, fontWeight: 700 }}>#{bi + 1}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      {progress && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ height: 3, borderRadius: 2, background: border }}>
                            <div style={{ width: `${progress.percent}%`, height: "100%", borderRadius: 2, background: childAccent, transition: "width 0.3s" }} />
                          </div>
                          <p style={{ fontSize: 9, color: childAccent, marginTop: 2 }}>{progress.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audio panel */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: `${childAccent}30`, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: childAccent, marginBottom: 10 }}>Audio for Video</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, marginBottom: 12 }}>
              {/* Narration */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <p style={{ fontSize: 9, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, flex: 1 }}>Narration</p>
                  <button
                    onClick={async () => {
                      const { text } = await resolveNarrationText();
                      if (text.replace(/\s+/g, "").length < 80) { setUiError("Story is too short — write more content or click ✨ Re-suggest first."); return; }
                      setLastAction("Generating narration...");
                      try {
                        const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 30000), provider: effectiveNarrationProvider || "piper", speed: 0.9 }) });
                        const d = await r.json() as { audioUrl?: string; engine?: string };
                        if (d.engine === "placeholder") setLastAction("Narration unavailable — TTS placeholder. Check server logs.");
                        else if (d.audioUrl) { setNarratorAudioUrl(d.audioUrl); setLastAction("Narration ready"); }
                        else setLastAction("Narration generation failed");
                      } catch { setLastAction("Narration error"); }
                    }}
                    style={{ padding: "2px 8px", borderRadius: 6, border: "none", background: `${childAccent}20`, color: childAccent, fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                    {narratorAudioUrl ? "Regen" : "Generate"}
                  </button>
                </div>
                {narratorAudioUrl
                  ? <audio src={narratorAudioUrl} controls style={{ width: "100%", height: 28 }} />
                  : <p style={{ fontSize: 9, color: "#555", fontStyle: "italic" }}>Not generated yet</p>}
              </div>
              {/* Music */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <p style={{ fontSize: 9, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, flex: 1 }}>Background Music</p>
                  <button
                    onClick={async () => {
                      setLastAction("Generating music...");
                      try {
                        const isSoft = (tone || "soft") === "soft";
                        const richPrompt = isSoft
                          ? "Gentle children's lullaby, soft solo piano with delicate music box and warm light strings, slow peaceful tempo around 70 BPM, calm comforting atmosphere, fairy tale storybook mood, fully instrumental, NO vocals, NO heavy drums, NO percussion, NO synths, dreamy bedtime story background"
                          : "Playful children's adventure music, light cheerful ukulele with bright glockenspiel and gentle flute, moderate uplifting tempo around 100 BPM, joyful curious atmosphere, fairy tale wonder, fully instrumental, NO vocals, soft brushed percussion only, NO electric guitar, NO heavy drums, storybook adventure background";
                        const moodTag = isSoft ? "calm" : "playful";
                        let dur = 90;
                        if (narratorAudioUrl) {
                          try {
                            const probed = await new Promise<number>((resolve) => {
                              const a = new Audio(narratorAudioUrl);
                              a.addEventListener("loadedmetadata", () => resolve(isFinite(a.duration) ? a.duration : 0));
                              a.addEventListener("error", () => resolve(0));
                              setTimeout(() => resolve(0), 4000);
                            });
                            if (probed > 10) dur = Math.min(Math.max(Math.ceil(probed), 30), 300);
                          } catch { /* keep default */ }
                        }
                        const assemblyTier = SOUND_TIERS.find(t => t.id === effectiveSoundTier);
                        const assemblyProviderKey = assemblyTier?.providerKey ?? "stock";
                        const r = await fetch("/api/music/generate", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt: richPrompt, durationSeconds: dur, genre: "children", mood: moodTag, hasLyrics: false, providerKey: assemblyProviderKey }),
                        });
                        const d = await r.json() as { url?: string; audioUrl?: string };
                        const url = d.url ?? d.audioUrl ?? "";
                        if (url) { setGeneratedMusicUrl(url); setSelectedMusicUrl(url); setLastAction(`Music ready (${moodTag}, ${dur}s)`); }
                        else setLastAction("Music generation failed");
                      } catch { setLastAction("Music error"); }
                    }}
                    style={{ padding: "2px 8px", borderRadius: 6, border: "none", background: "#a855f720", color: "#a855f7", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                    {selectedMusicUrl || generatedMusicUrl ? "Regen" : "Generate"}
                  </button>
                </div>
                {(selectedMusicUrl || generatedMusicUrl)
                  ? <audio src={selectedMusicUrl || generatedMusicUrl || ""} controls style={{ width: "100%", height: 28 }} />
                  : <p style={{ fontSize: 9, color: "#555", fontStyle: "italic" }}>Not generated yet</p>}
              </div>
            </div>
          </div>

          {/* AI Supervisor */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: aiSupervisorReport?.ok ? `${childSafe}40` : "#7c3aed50", padding: 14, background: aiSupervisorRunning ? "#0a0010" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 2 }}>AI Supervisor</p>
                <p style={{ fontSize: 9, color: muted }}>Checks scenes, audio, music, SFX — auto-generates narration. Run anytime.</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {aiSupervisorReport && !aiSupervisorRunning && (
                  <button onClick={() => { setAiSupervisorReport(null); runAiSupervisor(); }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid #7c3aed50`, background: "transparent", color: "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Run Again
                  </button>
                )}
                <button onClick={runAiSupervisor} disabled={aiSupervisorRunning}
                  style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: aiSupervisorRunning ? "#2a2040" : "linear-gradient(135deg, #7c3aed, #a855f7)", color: aiSupervisorRunning ? muted : "#fff", fontSize: 11, fontWeight: 700, cursor: aiSupervisorRunning ? "not-allowed" : "pointer" }}>
                  {aiSupervisorRunning ? "Checking + Fixing..." : aiSupervisorReport ? "Run AI Check Again" : "Run AI Check & Fix"}
                </button>
              </div>
            </div>
            {aiSupervisorReport && (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: aiSupervisorReport.ok ? childSafe : "#f59e0b" }}>
                  {aiSupervisorReport.ok ? "✓" : "⚠"} {aiSupervisorReport.summary}
                </p>
                {aiSupervisorReport.fixed.map((f, i) => (
                  <p key={`fix-${i}`} style={{ fontSize: 10, color: childSafe, marginTop: 1 }}>✓ {f}</p>
                ))}
                {aiSupervisorReport.issues.map((issue, i) => {
                  const lower = issue.toLowerCase();
                  const fixLabel = lower.includes("sfx") || lower.includes("sound effect") ? "→ Sound tab" :
                    lower.includes("music") ? "→ Sound tab" :
                    lower.includes("narration") ? "→ Generate Narration" :
                    lower.includes("subtitle") ? "→ Subtitle Style" :
                    lower.includes("scene") || lower.includes("image") ? "→ Scene Board" : null;
                  const fixAction = lower.includes("sfx") || lower.includes("music") ? () => setActiveTab("sound") :
                    lower.includes("narration") ? () => runAiSupervisor() :
                    lower.includes("scene") || lower.includes("image") ? () => setActiveTab("sceneBoard") : null;
                  return (
                    <div key={`iss-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 1, flex: 1 }}>⚠ {issue}</p>
                      {fixLabel && fixAction && (
                        <button onClick={fixAction} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #f59e0b40", background: "#f59e0b15", color: "#f59e0b", fontSize: 8, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {fixLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Subtitle style */}
          <div style={{ marginBottom: 6 }}>
            <SubtitleStyler value={effectiveSubtitleConfig}
              onChange={(newCfg) => { setSubtitleConfig(newCfg); patchProjectSettings({ subtitleMode: newCfg.mode, subtitleHighlight: newCfg.highlightColor, subtitleEnabled: newCfg.mode !== "none" }).catch(() => {}); }}
              accentColor={childAccent} />
          </div>

          {/* Subtitle match check */}
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={async () => {
                setSubtitleMatchResult({ status: "checking", note: "Checking..." });
                try {
                  const script = expandedContent || textContent || "";
                  if (!script.trim()) { setSubtitleMatchResult({ status: "warn", note: "No story text to check against." }); return; }
                  const res = await fetch("/api/free-mode/enhance", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rawPrompt: `Check if these subtitle settings match the narration content. Subtitle mode: "${effectiveSubtitleConfig.mode}", position: "${effectiveSubtitleConfig.position}". Story: "${script.slice(0,300)}". Reply in one line: does the subtitle style match? Say MATCH or MISMATCH and why.`, mode: "text_to_video" }) });
                  const d = await res.json() as { enhanced?: string };
                  const result = (d.enhanced || "").toLowerCase();
                  setSubtitleMatchResult({ status: result.includes("match") && !result.includes("mismatch") ? "ok" : "warn", note: d.enhanced || "Unable to check" });
                } catch { setSubtitleMatchResult({ status: "warn", note: "Check failed" }); }
              }}
              style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              Check Narration ↔ Subtitle Match
            </button>
            {subtitleMatchResult && (
              <p style={{ fontSize: 9, color: subtitleMatchResult.status === "ok" ? childSafe : subtitleMatchResult.status === "checking" ? muted : "#f59e0b", flex: 1 }}>
                {subtitleMatchResult.status === "ok" ? "✓" : subtitleMatchResult.status === "checking" ? "…" : "⚠"} {subtitleMatchResult.note.slice(0,120)}
              </p>
            )}
          </div>

          {/* Intro / Outro */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Intro & Outro</p>
            <p style={{ fontSize: 9, color: muted, marginBottom: 10 }}>AI generates a cinematic title card. Prepended/appended to your video.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              {/* Intro */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Intro</span>
                  {introUrl && <button onClick={() => setIntroUrl(null)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>Remove</button>}
                </div>
                {introUrl ? <video src={introUrl} controls style={{ width: "100%", maxHeight: 80, borderRadius: 6 }} />
                  : <div style={{ height: 60, background: s2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${border}` }}>
                      <span style={{ fontSize: 9, color: muted }}>No intro</span>
                    </div>}
                <button disabled={generatingIntro}
                  onClick={async () => {
                    setGeneratingIntro(true);
                    try {
                      const effectiveTitle = (projectTitle && projectTitle !== "Untitled Children Project" ? projectTitle : "")
                        || topicParam || contentParam || "My Story";
                      const res = await fetch("/api/video/title-card", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "intro", studioName: studioName || "GIO HOME AI STUDIO", title: effectiveTitle, duration: 4 }),
                      });
                      const data = await res.json();
                      if (data.videoUrl) setIntroUrl(data.videoUrl);
                      else setLastAction(`Intro failed: ${data.error ?? "unknown"}`);
                    } catch (err) {
                      setLastAction(`Intro error: ${err instanceof Error ? err.message : "unknown"}`);
                    } finally { setGeneratingIntro(false); }
                  }}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${childAccent}50`, background: generatingIntro ? "#0a0020" : `${childAccent}15`, color: generatingIntro ? muted : childAccent, fontSize: 9, fontWeight: 700, cursor: generatingIntro ? "not-allowed" : "pointer" }}>
                  {generatingIntro ? "Generating Intro..." : introUrl ? "Regen Intro" : "Generate AI Intro"}
                </button>
              </div>
              {/* Outro */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Outro</span>
                  {outroUrl && <button onClick={() => setOutroUrl(null)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>Remove</button>}
                </div>
                {outroUrl ? <video src={outroUrl} controls style={{ width: "100%", maxHeight: 80, borderRadius: 6 }} />
                  : <div style={{ height: 60, background: s2, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${border}` }}>
                      <span style={{ fontSize: 9, color: muted }}>No outro</span>
                    </div>}
                <button disabled={generatingOutro}
                  onClick={async () => {
                    setGeneratingOutro(true);
                    try {
                      const castList = characters.slice(0, 8).map(c => {
                        const voiceTag = c.voiceId ? c.voiceId.toUpperCase() : "PIPER";
                        return { characterName: c.displayName || "Character", actorName: `AI ${c.displayName || "Voice"} · ${voiceTag}` };
                      });
                      const effectiveTitle = (projectTitle && projectTitle !== "Untitled Children Project" ? projectTitle : "")
                        || topicParam || contentParam || "My Story";
                      const res = await fetch("/api/video/title-card", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type: "outro", studioName: studioName || "GIO HOME AI STUDIO",
                          title: effectiveTitle, cast: castList,
                          director: writtenBy || undefined, producer: madeBy || undefined,
                          username: ideaFrom || undefined, duration: 5,
                        }),
                      });
                      const data = await res.json();
                      if (data.videoUrl) setOutroUrl(data.videoUrl);
                      else setLastAction(`Outro failed: ${data.error ?? "unknown"}`);
                    } catch (err) {
                      setLastAction(`Outro error: ${err instanceof Error ? err.message : "unknown"}`);
                    } finally { setGeneratingOutro(false); }
                  }}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid #34d39950`, background: generatingOutro ? "#0a0020" : "#34d39915", color: generatingOutro ? muted : "#34d399", fontSize: 9, fontWeight: 700, cursor: generatingOutro ? "not-allowed" : "pointer" }}>
                  {generatingOutro ? "Generating Outro..." : outroUrl ? "Regen Outro" : "Generate AI Outro"}
                </button>
              </div>
            </div>
          </div>

          {/* Credits */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>Story Credits</p>
              <span style={{ fontSize: 9, color: "#7b7b80" }}>Saved on this device — survives refresh</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Studio Name {studioName && studioName !== "GIO HOME AI STUDIO" && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
                </label>
                <input value={studioName} onChange={e => setStudioName(e.target.value)} placeholder="Your studio name"
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${studioName && studioName !== "GIO HOME AI STUDIO" ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Written by {writtenBy && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
                </label>
                <input value={writtenBy} onChange={e => setWrittenBy(e.target.value)} placeholder="Your name"
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${writtenBy ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Made by {madeBy && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
                </label>
                <input value={madeBy} onChange={e => setMadeBy(e.target.value)} placeholder="Studio / creator"
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${madeBy ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Idea from {ideaFrom && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
                </label>
                <input value={ideaFrom} onChange={e => setIdeaFrom(e.target.value)} placeholder="Original idea by..."
                  style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${ideaFrom ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
              </div>
            </div>
          </div>

          {/* Status banner */}
          {assemblySelectedIds.length === 0 ? (
            <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>⚠ No scenes selected yet.</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Check the boxes next to the scenes above to choose which ones go into your video. You can select all of them or just a few.</p>
            </div>
          ) : (
            <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: `${childSafe}08`, border: `1px solid ${childSafe}30` }}>
              <p style={{ fontSize: 12, color: childSafe, fontWeight: 700 }}>Ready to assemble {assemblySelectedIds.length} scene{assemblySelectedIds.length !== 1 ? "s" : ""} into your video!</p>
              <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Press the button below when you are ready. This may take a minute.</p>
            </div>
          )}

          {/* Subtitle font size picker */}
          <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: ds.color.card, border: `1px solid ${childAccent}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: childAccent, marginBottom: 2 }}>Subtitle Font Size</p>
                <p style={{ fontSize: 10, color: muted }}>Choose preset OR type custom px (18-200). Overrides mode default.</p>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" as const }}>
                {[{ label: "Small", px: 36 }, { label: "Medium", px: 54 }, { label: "Large", px: 72 }, { label: "XL", px: 96 }, { label: "XXL", px: 128 }, { label: "JUMBO", px: 160 }].map(({ label, px }) => {
                  const active = (subtitleConfig.fontSize ?? 54) === px;
                  return (
                    <button key={px} onClick={() => setSubtitleConfig(c => ({ ...c, fontSize: px }))}
                      style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${active ? childAccent : border}`, background: active ? `${childAccent}25` : "transparent", color: active ? childAccent : muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {label} {px}
                    </button>
                  );
                })}
                <input type="number" min={18} max={200} value={subtitleConfig.fontSize ?? 54}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n) && n >= 18 && n <= 200) setSubtitleConfig(c => ({ ...c, fontSize: n }));
                  }}
                  style={{ width: 64, padding: "6px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" as const }} />
                <span style={{ fontSize: 10, color: muted }}>px</span>
              </div>
            </div>
          </div>

          {/* Image flip rate */}
          <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: ds.color.card, border: `1px solid ${childAccent}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: childAccent, marginBottom: 2 }}>Image Flip Rate</p>
                <p style={{ fontSize: 10, color: muted }}>How long each image shows when a scene has multiple beats (Max mode on)</p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[0.5, 1, 2, 3, 5].map(rate => (
                  <button key={rate} onClick={() => setImageFlipRate(rate)}
                    style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${imageFlipRate === rate ? childAccent : border}`, background: imageFlipRate === rate ? `${childAccent}25` : "transparent", color: imageFlipRate === rate ? childAccent : muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {rate}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pacing Engine */}
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: `${childAccent}30`, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 6 }}>Pacing Engine (Advanced)</p>
            <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
              Build a word-timed narration plan — slower speed, breathing room between sentences, karaoke-style subtitles.
              For toddler/preschool stories and learning mode.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              <button onClick={buildPacingPlan} disabled={buildingPacingPlan || !(expandedContent || textContent)}
                style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childAccent}`, background: buildingPacingPlan ? `${childAccent}10` : `${childAccent}20`, color: buildingPacingPlan || !(expandedContent || textContent) ? muted : childAccent, fontSize: 12, fontWeight: 600, cursor: buildingPacingPlan || !(expandedContent || textContent) ? "not-allowed" : "pointer" }}>
                {buildingPacingPlan ? "Building plan..." : pacingPlan ? "Rebuild Plan" : "Build Pacing Plan"}
              </button>
              {pacingPlan && (
                <button onClick={generatePacingNarration} disabled={buildingPacingNarration}
                  style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: buildingPacingNarration ? `${childSafe}10` : `${childSafe}20`, color: buildingPacingNarration ? muted : childSafe, fontSize: 12, fontWeight: 600, cursor: buildingPacingNarration ? "not-allowed" : "pointer" }}>
                  {buildingPacingNarration ? "Generating narration..." : pacingAudioUrl ? "Regenerate Narration" : "Generate Pacing Narration"}
                </button>
              )}
              {pacingPlan && pacingAudioUrl && (
                <button onClick={assemblePacingVideo} disabled={assemblingPacingVideo}
                  style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: assemblingPacingVideo ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, ${childSafe})`, color: "#000", fontSize: 12, fontWeight: 700, cursor: assemblingPacingVideo ? "not-allowed" : "pointer" }}>
                  {assemblingPacingVideo ? "Assembling..." : "Assemble Pacing Video"}
                </button>
              )}
            </div>
            {pacingPlan && (
              <p style={{ fontSize: 10, color: childSafe, marginTop: 8 }}>
                Plan ready — {pacingPlan.entries.length} entries, {Math.round(pacingPlan.totalDurationMs / 1000)}s total, mode: {pacingPlan.mode}
              </p>
            )}
            {pacingAudioUrl && <p style={{ fontSize: 10, color: "#7dd3fc", marginTop: 4 }}>Narration audio ready</p>}
            {pacingVideoUrl && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 10, color: childSafe, marginBottom: 6 }}>Pacing video assembled</p>
                <video src={pacingVideoUrl} controls style={{ width: "100%", borderRadius: 8, maxHeight: 280 }} />
              </div>
            )}
            {pacingPlan && pacingPlan.entries.length > 0 && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#0d0621", border: `1px solid ${childAccent}20`, position: "relative" as const, minHeight: 60 }}>
                <p style={{ fontSize: 9, color: muted, marginBottom: 6 }}>Subtitle preview — entry {pacingActiveEntryIdx + 1}/{pacingPlan.entries.length}</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <button onClick={() => setPacingActiveEntryIdx(i => Math.max(0, i - 1))} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 10, cursor: "pointer" }}>&#8592;</button>
                  <button onClick={() => setPacingActiveEntryIdx(i => Math.min(pacingPlan.entries.length - 1, i + 1))} style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 10, cursor: "pointer" }}>&#8594;</button>
                </div>
                <ChildrenKaraokeSubtitle entry={pacingPlan.entries[pacingActiveEntryIdx]} elapsedMs={0} mode={pacingPlan.mode} />
              </div>
            )}
          </div>

          {/* Big assemble button */}
          <button onClick={assembleMovie} disabled={assembling || assemblySelectedIds.length === 0}
            style={{ width: "100%", padding: "16px 20px", borderRadius: 14, border: "none", background: (assembling || assemblySelectedIds.length === 0) ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: assemblySelectedIds.length === 0 ? muted : "#fff", fontSize: 16, fontWeight: 800, cursor: (assembling || assemblySelectedIds.length === 0) ? "not-allowed" : "pointer", marginBottom: 12, letterSpacing: 0.3 }}>
            {assembling
              ? `Assembling… ${assemblyElapsedSec}s elapsed (${Math.round(assemblePercent)}%)`
              : assembledUrl ? "Assemble Again (overwrite)"
              : assemblySelectedIds.length === 0 ? "Select scenes above to assemble"
              : `Assemble ${assemblySelectedIds.length} Scene${assemblySelectedIds.length !== 1 ? "s" : ""} into Story Video`}
          </button>

          {assembling && (
            <div style={{ marginTop: -4, marginBottom: 12 }}>
              <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.min(100, Math.max(0, assemblePercent))}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${childAccent}, #7c3aed)`,
                  transition: "width 0.6s ease",
                  boxShadow: assemblePercent < 100 ? `0 0 6px ${childAccent}80` : "none",
                }} />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 10, color: muted, textAlign: "center" as const }}>
                {assemblePercent < 95 ? "ffmpeg is rendering scenes + narration + subtitles…" : assemblePercent < 100 ? "Finalising bumpers + caption overlay (last step — typically 30-60s)…" : "Done"}
              </p>
            </div>
          )}
          {assemblyError && !assembling && (
            <div style={{ marginTop: -4, marginBottom: 12, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, color: "#ef4444", fontSize: 12 }}>
              <p style={{ margin: "0 0 4px", fontWeight: 700 }}>❌ Assembly error</p>
              <p style={{ margin: 0, fontFamily: "monospace" as const, fontSize: 11, color: "#fca5a5", whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const }}>{assemblyError}</p>
              <button onClick={() => { setAssemblyError(null); setLastAction(""); }}
                style={{ marginTop: 8, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#fca5a5", fontSize: 10, cursor: "pointer" }}>
                Dismiss
              </button>
            </div>
          )}
          {!narratorAudioUrl && !assembling && !assemblyError && assemblySelectedIds.length > 0 && (
            <div style={{ marginTop: -4, marginBottom: 12, padding: "10px 14px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 10, fontSize: 11, color: "#fbbf24" }}>
              <p style={{ margin: "0 0 4px", fontWeight: 700 }}>⚡ Speed tip — generate narration first</p>
              <p style={{ margin: 0, color: "#fde68a" }}>
                Without pre-generated narration, Assemble takes ~3-4 minutes (story-expand + TTS run inline).
                Click <strong>Generate Narration</strong> in the Sound tab now — once it&apos;s ready, Assemble runs in ~30-50 seconds.
              </p>
              <button onClick={() => setActiveTab("sound")}
                style={{ marginTop: 8, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.4)", background: "transparent", color: "#fde68a", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                Go to Sound tab →
              </button>
            </div>
          )}

          {assembledUrl && (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: `${childSafe}08`, border: `1px solid ${childSafe}30`, marginTop: 4 }}>
              <p style={{ fontSize: 12, color: childSafe, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.Check style={{ width: 14, height: 14 }} /> Your story video is ready!
              </p>
              <video src={assembledUrl} controls style={{ width: "100%", maxHeight: 240, borderRadius: 10 }} />
              <p style={{ fontSize: 10, color: muted, marginTop: 8 }}>Happy with the result? Go to <strong style={{ color: "#fff" }}>Final Check</strong> tab to review and approve it before exporting.</p>
              <button onClick={() => setActiveTab("review2")}
                style={{ marginTop: 8, padding: "8px 18px", borderRadius: 10, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Go to Final Check
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "24px 20px", borderRadius: 14, background: `${childAccent}06`, border: `1px dashed ${border}`, textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No scenes yet. You need scenes before you can assemble a video.</p>
          <button onClick={() => setActiveTab("sceneBoard")}
            style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Go to Scene Board
          </button>
        </div>
      )}
    </div>
  );
}
