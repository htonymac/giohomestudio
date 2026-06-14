"use client";
// Shared narration play button WITH a synced subtitle strip (Henry 2026-06-13).
// Extracted from hybrid-planner so movie / children / commercial / free-mode all
// use ONE source. When Edge word-timings are present the current word highlights
// in time with the voice; with no timings (Piper) it shows the line statically.
//
// subtitleMode (optional): when set, renders each word styled to match the chosen
// SubtitleStyler mode so Henry sees the real subtitle look on HIS narration text.
import { useEffect, useRef, useState } from "react";

export interface NarrationWordTiming { word: string; startMs: number; endMs: number }

// Rainbow palette — cycles by word index.
const RAINBOW_PALETTE = ["#f87171","#fb923c","#fbbf24","#4ade80","#38bdf8","#a78bfa","#f472b6"];

// Per-mode word styler. Returns CSSProperties for each word span.
function wordStyle(
  mode: string,
  i: number,
  isActive: boolean,
  highlightColor: string,
): React.CSSProperties {
  // Base: always visible
  const base: React.CSSProperties = {
    display: "inline-block",
    transition: "all 80ms ease",
    borderRadius: 3,
    padding: "1px 2px",
  };

  switch (mode) {
    case "rainbow":
      return {
        ...base,
        color: RAINBOW_PALETTE[i % RAINBOW_PALETTE.length],
        fontWeight: isActive ? 800 : 500,
        transform: isActive ? "scale(1.2)" : "scale(1)",
        textShadow: isActive ? `0 0 8px ${RAINBOW_PALETTE[i % RAINBOW_PALETTE.length]}` : "none",
      };

    case "glow_pop":
    case "dramatic":
      return {
        ...base,
        color: isActive ? "#ffffff" : "rgba(255,255,255,0.6)",
        fontWeight: isActive ? 800 : 400,
        textShadow: isActive
          ? "0 0 12px #22d3ee, 0 0 24px #22d3ee80"
          : "none",
        transform: isActive ? "scale(1.15)" : "scale(1)",
      };

    case "dance_word":
    case "social":
      return {
        ...base,
        color: isActive ? highlightColor : "#cbd5e1",
        fontWeight: isActive ? 800 : 500,
        transform: isActive ? "scale(1.3) translateY(-2px)" : "scale(1)",
        textShadow: isActive ? `0 2px 8px ${highlightColor}80` : "none",
      };

    case "mrbeast_single":
      // Only show the active word (large). Hidden = invisible but takes no space via fontSize.
      return {
        ...base,
        color: isActive ? "#ffffff" : "transparent",
        fontWeight: 900,
        fontSize: isActive ? "1.6em" : "0",
        letterSpacing: isActive ? "0.05em" : 0,
        textShadow: isActive ? "0 0 0 2px #000, 2px 2px 0 #000" : "none",
        WebkitTextStroke: isActive ? "1px #000" : "none",
        margin: "0 1px",
      };

    case "kids":
    case "bubble_pop":
      return {
        ...base,
        color: isActive
          ? "#ffffff"
          : RAINBOW_PALETTE[i % RAINBOW_PALETTE.length],
        fontWeight: 700,
        background: isActive ? "#7c3aed" : "transparent",
        transform: isActive ? "scale(1.25)" : "scale(1)",
        padding: isActive ? "1px 5px" : "1px 2px",
      };

    case "yellow_sweep":
    case "highlight":
      return {
        ...base,
        color: isActive ? "#000" : "#cbd5e1",
        background: isActive ? highlightColor : "transparent",
        padding: isActive ? "1px 4px" : "1px 2px",
      };

    case "big_friendly":
      return {
        ...base,
        color: "#ffffff",
        fontWeight: 800,
        fontSize: "1.15em",
        WebkitTextStroke: isActive ? `2px ${highlightColor}` : "1px #00000060",
        textShadow: isActive ? `0 0 10px ${highlightColor}60` : "none",
        transform: isActive ? "scale(1.1)" : "scale(1)",
      };

    case "typewriter":
      return {
        ...base,
        color: isActive ? "#fef3c7" : "rgba(254,243,199,0.4)",
        fontFamily: "'Courier New', Courier, monospace",
        fontWeight: isActive ? 700 : 400,
      };

    // "dialogue" | "none" | default — slightly brighter on active word
    default:
      return {
        ...base,
        color: isActive ? "#ffffff" : "#94a3b8",
        fontWeight: isActive ? 600 : 400,
      };
  }
}

export function NarrationPreview({ audioUrl, wordTimings, text, height = 36, subtitleMode, highlightColor = "#fbbf24" }: {
  audioUrl: string;
  wordTimings: NarrationWordTiming[] | null;
  text: string;
  height?: number;
  /** When set, words are styled to preview the chosen subtitle mode live. */
  subtitleMode?: string;
  /** The highlightColor from SubtitleConfig — defaults to amber. */
  highlightColor?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const hasTimings = Array.isArray(wordTimings) && wordTimings.length > 0;

  // Reset the highlight when narration is regenerated (new audio or timings).
  useEffect(() => { setActiveIdx(-1); }, [audioUrl, wordTimings]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasTimings) return;
    const onTime = () => {
      const ms = el.currentTime * 1000;
      let idx = -1;
      for (let i = 0; i < wordTimings!.length; i++) {
        if (ms >= wordTimings![i].startMs && ms < wordTimings![i].endMs) { idx = i; break; }
        if (ms >= wordTimings![i].startMs) idx = i;
      }
      setActiveIdx(idx);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    return () => { el.removeEventListener("timeupdate", onTime); el.removeEventListener("seeked", onTime); };
  }, [hasTimings, wordTimings]);

  // Decide which word renderer to use.
  const useStyledMode = !!subtitleMode && subtitleMode !== "none";

  return (
    <div>
      <audio ref={audioRef} controls src={audioUrl} style={{ width: "100%", height }} />
      {(hasTimings || text) && (
        <div style={{
          marginTop: 6, padding: "8px 12px", borderRadius: 8,
          background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)",
          fontSize: 13, lineHeight: 1.7, color: "#cbd5e1", maxHeight: 120, overflowY: "auto",
        }}>
          {hasTimings ? (
            <span>
              {wordTimings!.map((w, i) => {
                const isActive = i === activeIdx;
                if (useStyledMode) {
                  return (
                    <span key={i} style={wordStyle(subtitleMode!, i, isActive, highlightColor!)}>
                      {w.word}{" "}
                    </span>
                  );
                }
                // Legacy default highlight (yellow background)
                return (
                  <span key={i} style={{
                    color: isActive ? "#000" : "#cbd5e1",
                    background: isActive ? "#fbbf24" : "transparent",
                    borderRadius: 3, padding: isActive ? "1px 3px" : 0, transition: "background 80ms",
                  }}>{w.word}{" "}</span>
                );
              })}
            </span>
          ) : (
            <span style={{ fontStyle: "italic" }}>
              {text}
              <span style={{ display: "block", marginTop: 4, fontSize: 9, color: "#94a3b8" }}>
                (static preview — Edge voice gives word-by-word highlight; this voice has no word timing)
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default NarrationPreview;
