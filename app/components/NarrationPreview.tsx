"use client";
// Shared narration play button WITH a synced subtitle strip (Henry 2026-06-13).
// Extracted from hybrid-planner so movie / children / commercial / free-mode all
// use ONE source. When Edge word-timings are present the current word highlights
// in time with the voice; with no timings (Piper) it shows the line statically.
import { useEffect, useRef, useState } from "react";

export interface NarrationWordTiming { word: string; startMs: number; endMs: number }

export function NarrationPreview({ audioUrl, wordTimings, text, height = 36 }: {
  audioUrl: string;
  wordTimings: NarrationWordTiming[] | null;
  text: string;
  height?: number;
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

  return (
    <div>
      <audio ref={audioRef} controls src={audioUrl} style={{ width: "100%", height }} />
      {(hasTimings || text) && (
        <div style={{
          marginTop: 6, padding: "8px 12px", borderRadius: 8,
          background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)",
          fontSize: 13, lineHeight: 1.5, color: "#cbd5e1", maxHeight: 90, overflowY: "auto",
        }}>
          {hasTimings ? (
            <span>
              {wordTimings!.map((w, i) => (
                <span key={i} style={{
                  color: i === activeIdx ? "#000" : "#cbd5e1",
                  background: i === activeIdx ? "#fbbf24" : "transparent",
                  borderRadius: 3, padding: i === activeIdx ? "1px 3px" : 0, transition: "background 80ms",
                }}>{w.word}{" "}</span>
              ))}
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
