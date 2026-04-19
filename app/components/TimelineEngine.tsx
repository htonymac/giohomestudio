"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Timeline Engine — Shared across all modes
//
// From Multi-Mode Architecture doc:
// "One shared AI media assembly engine powering all modes"
// "Timeline engine: places narration, dialogue, images, clips, music, SFX
//  in correct sequence"
//
// Used by: Collaborative Editor, Video Finishing, Movie Planner, Music Video
// ═══════════════════════════════════════════════════════════════════════════

export interface TimelineClip {
  id: string;
  track: "video" | "narration" | "dialogue" | "music" | "sfx" | "ambience" | "subtitle";
  label: string;
  startTime: number; // seconds
  endTime: number;
  color?: string;
  active?: boolean;
  pending?: boolean;
  locked?: boolean;
}

interface TimelineEngineProps {
  clips: TimelineClip[];
  totalDuration: number;
  playheadPosition: number; // 0-100 percentage
  onPlayheadChange?: (position: number) => void;
  onClipClick?: (clipId: string) => void;
  onClipMove?: (clipId: string, newStart: number) => void;
  compact?: boolean;
  snapToGrid?: boolean;    // snap clips to nearest 0.5s grid
  gridInterval?: number;   // grid interval in seconds (default 0.5)
}

// Snap value to nearest grid position
function snapValue(value: number, interval: number): number {
  return Math.round(value / interval) * interval;
}

const TRACK_ORDER: TimelineClip["track"][] = ["video", "narration", "dialogue", "music", "sfx", "ambience", "subtitle"];

const TRACK_COLORS: Record<string, { bg: string; text: string }> = {
  video:     { bg: "rgba(168,85,247,0.25)", text: "rgba(168,85,247,0.9)" },
  narration: { bg: "rgba(0,212,255,0.2)",   text: "rgba(0,212,255,0.8)" },
  dialogue:  { bg: "rgba(236,72,153,0.2)",  text: "rgba(236,72,153,0.8)" },
  music:     { bg: "rgba(34,197,94,0.2)",   text: "rgba(34,197,94,0.8)" },
  sfx:       { bg: "rgba(245,158,11,0.2)",  text: "rgba(245,158,11,0.8)" },
  ambience:  { bg: "rgba(59,130,246,0.15)", text: "rgba(59,130,246,0.7)" },
  subtitle:  { bg: "rgba(255,255,255,0.1)", text: "rgba(255,255,255,0.6)" },
};

const TRACK_LABELS: Record<string, string> = {
  video: "VIDEO", narration: "VOICE", dialogue: "DIALOG", music: "MUSIC", sfx: "SFX", ambience: "AMB", subtitle: "TEXT",
};

const border = "#1e2a35";
const muted = "#5a7080";
const muted2 = "#344860";
const purple = "#a855f7";
const bg = "#060810";
const s1 = "#0b0e18";
const s3 = "#161b28";

export default function TimelineEngine({ clips, totalDuration, playheadPosition, onPlayheadChange, onClipClick, onClipMove, compact, snapToGrid = true, gridInterval = 0.5 }: TimelineEngineProps) {
  const [zoom, setZoom] = useState(1);

  // Group clips by track
  const trackGroups = TRACK_ORDER.filter(track => clips.some(c => c.track === track));

  // Time markers
  const markerCount = Math.max(4, Math.min(10, Math.ceil(totalDuration / 30)));
  const markers = Array.from({ length: markerCount + 1 }, (_, i) => {
    const time = (totalDuration / markerCount) * i;
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return { time, label: `${mins}:${String(secs).padStart(2, "0")}`, left: (time / totalDuration) * 100 };
  });

  const trackHeight = compact ? 22 : 28;

  return (
    <div style={{ background: s1, borderRadius: compact ? 0 : 10, border: compact ? "none" : `1px solid ${border}`, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: compact ? "4px 12px" : "6px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" as const, color: muted2 }}>Timeline</span>
        <div style={{ width: 1, height: 14, background: border }} />
        <span style={{ fontFamily: "monospace", fontSize: 10, color: muted }}>
          {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, "0")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.25))} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
      </div>

      {/* Tracks area */}
      <div style={{ overflowX: "auto", overflowY: "hidden", padding: compact ? "4px 12px" : "8px 16px" }}>
        <div style={{ minWidth: `${100 * zoom}%` }}>
          {/* Time ruler */}
          <div style={{ position: "relative", height: 16, background: bg, borderBottom: `1px solid ${border}`, marginBottom: 4 }}>
            {markers.map(m => (
              <span key={m.label} style={{ position: "absolute", bottom: 0, left: `${m.left}%`, fontFamily: "monospace", fontSize: 8, color: muted2 }}>
                {m.label}
              </span>
            ))}
          </div>

          {/* Track rows */}
          {trackGroups.map(track => {
            const trackClips = clips.filter(c => c.track === track);
            const colors = TRACK_COLORS[track] || TRACK_COLORS.video;

            return (
              <div key={track} style={{ display: "flex", alignItems: "center", gap: 8, height: trackHeight, marginBottom: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" as const, color: muted2, width: 44, flexShrink: 0, textAlign: "right" }}>
                  {TRACK_LABELS[track]}
                </span>
                <div onClick={e => { if (onPlayheadChange) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onPlayheadChange(Math.round(((e.clientX - r.left) / r.width) * 100)); } }}
                  style={{ flex: 1, position: "relative", height: "100%", background: s3, borderRadius: 3, overflow: "hidden", cursor: "pointer" }}>
                  {/* Playhead */}
                  <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "rgba(168,85,247,0.8)", left: `${playheadPosition}%`, zIndex: 10 }}>
                    <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 6, height: 6, background: purple, borderRadius: "50%" }} />
                  </div>

                  {/* Clips */}
                  {trackClips.map(clip => {
                    const left = (clip.startTime / totalDuration) * 100;
                    const width = ((clip.endTime - clip.startTime) / totalDuration) * 100;

                    return (
                      <div key={clip.id} onClick={() => onClipClick?.(clip.id)}
                        title={`${clip.label} (${(clip.endTime - clip.startTime).toFixed(1)}s)`}
                        style={{
                          position: "absolute", top: 2, bottom: 2, borderRadius: 3,
                          display: "flex", alignItems: "center", padding: "0 6px", overflow: "hidden",
                          cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)",
                          left: `${left}%`, width: `${Math.max(width, 1)}%`,
                          background: clip.color || colors.bg,
                          opacity: clip.locked ? 0.6 : 1,
                          transition: "outline 0.15s",
                          ...(clip.active ? { outline: "2px solid rgba(255,255,255,0.4)" } : {}),
                          ...(clip.pending ? { outline: `1px solid rgba(245,158,11,0.6)` } : {}),
                        }}>
                        {/* Left trim handle */}
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", background: "rgba(255,255,255,0.15)", borderRadius: "3px 0 0 3px" }} />
                        <span style={{ fontSize: 8, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: colors.text, flex: 1 }}>
                          {clip.label}
                        </span>
                        {clip.locked && <span style={{ fontSize: 7, marginLeft: 2 }}>🔒</span>}
                        {/* Right trim handle */}
                        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", background: "rgba(255,255,255,0.15)", borderRadius: "0 3px 3px 0" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrub bar */}
      {onPlayheadChange && (
        <div style={{ padding: "6px 16px", borderTop: `1px solid ${border}` }}>
          <div style={{ position: "relative", height: 4, background: s3, borderRadius: 2, cursor: "pointer" }}
            onClick={e => { const rect = (e.target as HTMLElement).getBoundingClientRect(); onPlayheadChange(Math.round(((e.clientX - rect.left) / rect.width) * 100)); }}>
            <div style={{ height: "100%", background: purple, borderRadius: 2, width: `${playheadPosition}%` }} />
            <div style={{ position: "absolute", top: "50%", left: `${playheadPosition}%`, transform: "translate(-50%,-50%)", width: 10, height: 10, background: purple, borderRadius: "50%", border: `2px solid ${bg}`, boxShadow: `0 0 0 2px ${purple}`, cursor: "grab" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: Convert Assembly JSON to TimelineClips ──
export function assemblyToTimelineClips(assembly: {
  segments: Array<{ id: string; type: string; startTime: number; endTime: number }>;
  narration: Array<{ id: string; text: string; startTime: number; endTime: number }>;
  music: Array<{ id: string; startTime: number; endTime: number; volume: number }>;
  sfx: Array<{ id: string; event: string; startTime: number; duration: number }>;
  ambience: Array<{ id: string; description: string; startTime: number; endTime: number }>;
  subtitles: Array<{ id: string; text: string; startTime: number; endTime: number }>;
}): TimelineClip[] {
  const clips: TimelineClip[] = [];

  for (const s of assembly.segments) {
    clips.push({ id: s.id, track: "video", label: `${s.type} ${s.id}`, startTime: s.startTime, endTime: s.endTime });
  }
  for (const n of assembly.narration) {
    clips.push({ id: n.id, track: "narration", label: n.text.slice(0, 20), startTime: n.startTime, endTime: n.endTime });
  }
  for (const m of assembly.music) {
    clips.push({ id: m.id, track: "music", label: `Music (${Math.round(m.volume * 100)}%)`, startTime: m.startTime, endTime: m.endTime });
  }
  for (const s of assembly.sfx) {
    clips.push({ id: s.id, track: "sfx", label: s.event, startTime: s.startTime, endTime: s.startTime + s.duration });
  }
  for (const a of assembly.ambience) {
    clips.push({ id: a.id, track: "ambience", label: a.description.slice(0, 15), startTime: a.startTime, endTime: a.endTime });
  }
  for (const s of assembly.subtitles) {
    clips.push({ id: s.id, track: "subtitle", label: s.text.slice(0, 15), startTime: s.startTime, endTime: s.endTime });
  }

  return clips;
}
