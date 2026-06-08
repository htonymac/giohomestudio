"use client";

// ─────────────────────────────────────────────────────────────────────────────
// OverviewTab — project status dashboard for music-video-planner.
//
// SECTIONS (top → bottom):
//   1. Stat cards row (Song / Mode / Scenes / Generated count)
//   2. Quick Actions panel — jumps to other tabs
//   3. Production Status panel — checklist of pipeline state
//   4. Model Settings collapsible panel (Story LLM / Char Image / Scene Video / Sound)
//
// Pure presentational: no inline async, no fetch calls. All state owned by
// parent. patchProjectSettings is the one parent-provided side-effect helper
// for persisting tier selection.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import type { MusicVideoTab } from "./CaptionsTab";

interface Scene {
  scene: number;
  section: string;
  duration: string;
  prompt: string;
  style: string;
  movement: string;
  caption: string;
  genMethod: string;
  status: string;
  outputUrl?: string;
}

interface SoundTierMv { id: string; label: string; cost: string }
interface ModelSettings {
  storyLLM: string;
  charImageModel: string;
  sceneVideoModel: string;
  soundModel: string;
}

export interface OverviewTabProps {
  // Stats
  songTitle: string;
  videoMode: string;
  storyboard: Scene[];
  /** Analysis result — null when not yet run. Only used as a presence check. */
  analysis: unknown;

  // Nav
  setActiveTab: (tab: MusicVideoTab) => void;

  // Model settings panel
  showModelSettings: boolean;
  setShowModelSettings: React.Dispatch<React.SetStateAction<boolean>>;
  modelSettings: ModelSettings;
  setModelSettings: React.Dispatch<React.SetStateAction<ModelSettings>>;
  /** Static array of 5 sound tier definitions from the parent module. */
  SOUND_TIERS_MV: ReadonlyArray<SoundTierMv>;
  setSoundTier: (id: string) => void;
  /** Persists settings to DB. Fire-and-forget. */
  patchProjectSettings: (patch: Record<string, unknown>) => Promise<unknown>;

  // Style tokens
  surface: string;
  labelStyle: React.CSSProperties;
}

export default function OverviewTab(props: OverviewTabProps) {
  const {
    songTitle, videoMode, storyboard, analysis,
    setActiveTab,
    showModelSettings, setShowModelSettings,
    modelSettings, setModelSettings,
    SOUND_TIERS_MV, setSoundTier, patchProjectSettings,
    surface, labelStyle,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
      {/* Stat cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, gridColumn: "1/-1" }}>
        {[
          { label: "Song",      value: songTitle || "None",                              color: "#00d4ff" },
          { label: "Mode",      value: videoMode || "Not set",                            color: "#ec4899" },
          { label: "Scenes",    value: storyboard.length,                                  color: "#22c55e" },
          { label: "Generated", value: storyboard.filter(s => s.status === "generated").length, color: "#f59e0b" },
        ].map(stat => (
          <div key={stat.label} style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: "#5a7080", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 12 }}>Quick Actions</p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          <button onClick={() => setActiveTab("song")} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" as const }}>{songTitle ? "Edit Song" : "Add Song"}</button>
          <button onClick={() => setActiveTab("analysis")} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" as const }}>{videoMode ? "Edit Mode" : "Choose Video Mode"}</button>
          <button onClick={() => setActiveTab("storyboard")} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left" as const }}>{storyboard.length > 0 ? `Storyboard (${storyboard.length} scenes)` : "Build Storyboard"}</button>
          <button onClick={() => setActiveTab("assembly")} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#ec4899", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Go to Assembly</button>
        </div>
      </div>

      {/* Production Status */}
      <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 12 }}>Production Status</p>
        {[
          { label: "Song ready",              done: !!songTitle },
          { label: "Video mode selected",     done: !!videoMode },
          { label: "Analysis complete",       done: !!analysis },
          { label: "Storyboard built",        done: storyboard.length > 0 },
          { label: "Scenes rendered",         done: storyboard.some(s => s.status === "generated") },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1e2a35" }}>
            <span style={{ color: item.done ? "#22c55e" : "#5a7080" }}>{item.done ? "OK" : "–"}</span>
            <span style={{ fontSize: 12, color: item.done ? "#ddd" : "#5a7080" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Model Settings — collapsible */}
      <div style={{ background: surface, border: "1px solid #1e2a35", borderRadius: 16, padding: 20, gridColumn: "1/-1" }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: showModelSettings ? 14 : 0 }}
          onClick={() => setShowModelSettings(p => !p)}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Model Settings</p>
          <span style={{ fontSize: 11, color: "#5a7080" }}>{showModelSettings ? "Hide" : "Show"}</span>
        </div>
        {showModelSettings && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <p style={{ ...labelStyle }}>Story LLM</p>
              {(["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7", "gpt-4o-mini", "gpt-4o"] as const).map(m => (
                <button key={m} onClick={() => setModelSettings(p => ({ ...p, storyLLM: m }))}
                  style={{ display: "block", width: "100%", padding: "5px 10px", marginBottom: 4, borderRadius: 7, border: `1px solid ${modelSettings.storyLLM === m ? "#7c5cfc" : "#1e2a35"}`, background: modelSettings.storyLLM === m ? "rgba(124,92,252,0.12)" : "transparent", color: modelSettings.storyLLM === m ? "#7c5cfc" : "#fff", fontSize: 10, cursor: "pointer", textAlign: "left" as const }}>
                  {m}
                </button>
              ))}
            </div>
            <div>
              <p style={{ ...labelStyle }}>Character Image</p>
              {(["fal_flux_schnell", "fal_flux_dev", "pruna_flux"] as const).map(m => (
                <button key={m} onClick={() => setModelSettings(p => ({ ...p, charImageModel: m }))}
                  style={{ display: "block", width: "100%", padding: "5px 10px", marginBottom: 4, borderRadius: 7, border: `1px solid ${modelSettings.charImageModel === m ? "#00d4ff" : "#1e2a35"}`, background: modelSettings.charImageModel === m ? "rgba(0,212,255,0.12)" : "transparent", color: modelSettings.charImageModel === m ? "#00d4ff" : "#fff", fontSize: 10, cursor: "pointer", textAlign: "left" as const }}>
                  {m.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div>
              <p style={{ ...labelStyle }}>Scene Video</p>
              {(["kling_1_6_standard", "kling_2_5_pro", "runway_gen4", "veo2", "fal_wan_lite"] as const).map(m => (
                <button key={m} onClick={() => setModelSettings(p => ({ ...p, sceneVideoModel: m }))}
                  style={{ display: "block", width: "100%", padding: "5px 10px", marginBottom: 4, borderRadius: 7, border: `1px solid ${modelSettings.sceneVideoModel === m ? "#ec4899" : "#1e2a35"}`, background: modelSettings.sceneVideoModel === m ? "rgba(236,72,153,0.12)" : "transparent", color: modelSettings.sceneVideoModel === m ? "#ec4899" : "#fff", fontSize: 10, cursor: "pointer", textAlign: "left" as const }}>
                  {m.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div>
              <p style={{ ...labelStyle }}>Sound/SFX</p>
              {SOUND_TIERS_MV.map(tier => (
                <button
                  key={tier.id}
                  onClick={() => {
                    setModelSettings(p => ({ ...p, soundModel: tier.id }));
                    setSoundTier(tier.id);
                    patchProjectSettings({ soundTier: tier.id }).catch(() => {});
                  }}
                  style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "5px 10px", marginBottom: 4, borderRadius: 7, border: `1px solid ${modelSettings.soundModel === tier.id ? "#22c55e" : "#1e2a35"}`, background: modelSettings.soundModel === tier.id ? "rgba(34,197,94,0.12)" : "transparent", color: modelSettings.soundModel === tier.id ? "#22c55e" : "#fff", fontSize: 10, cursor: "pointer" }}
                >
                  <span>{tier.label}</span><span style={{ opacity: 0.6 }}>{tier.cost}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
