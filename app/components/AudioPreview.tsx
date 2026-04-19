"use client";

import { useState, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Audio Preview — TTS preview before full generation
//
// Lets user hear narration/dialogue voice preview before committing credits.
// Uses Piper TTS (free, local) for preview, ElevenLabs for final render.
// ═══════════════════════════════════════════════════════════════════════════

interface AudioPreviewProps {
  text: string;
  voiceId?: string;
  speakerName?: string;
  style?: string; // normal, whisper, commanding, etc.
  speed?: number; // 0.5-2.0
  onApprove?: () => void;
  onReject?: () => void;
  compact?: boolean;
}

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const cyan = "#00d4ff";
const green = "#22c55e";

export default function AudioPreview({ text, voiceId, speakerName, style, speed, onApprove, onReject, compact }: AudioPreviewProps) {
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const generatePreview = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setError("");

    try {
      // Try Piper TTS first (free, local) for preview
      const res = await fetch("/api/voice-design/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 200), // Preview only first 200 chars
          voiceId,
          speed: speed || 1.0,
          style: style || "normal",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          setPreviewUrl(data.audioUrl);
        } else {
          setError("Preview generation returned no audio");
        }
      } else {
        // Fallback: try browser speech synthesis
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text.slice(0, 200));
          utterance.rate = speed || 1.0;
          window.speechSynthesis.speak(utterance);
          setPreviewUrl("browser"); // flag as browser preview
        } else {
          setError("Preview unavailable — will use full voice generation");
        }
      }
    } catch {
      // Use browser fallback
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 200));
        utterance.rate = speed || 1.0;
        window.speechSynthesis.speak(utterance);
        setPreviewUrl("browser");
      } else {
        setError("Preview service unavailable");
      }
    }
    setGenerating(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: compact ? 8 : 12, padding: compact ? 10 : 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 14 }}>🎧</span>
      <div style={{ flex: 1, minWidth: 120 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
          {speakerName || "Voice"} Preview
        </p>
        <p style={{ fontSize: 9, color: muted }}>
          {text.slice(0, 40)}{text.length > 40 ? "..." : ""}
          {style && style !== "normal" ? ` · ${style}` : ""}
          {speed && speed !== 1.0 ? ` · ${speed}x` : ""}
        </p>
      </div>

      {/* Preview audio player */}
      {previewUrl && previewUrl !== "browser" && (
        <audio ref={audioRef} src={previewUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)} />
      )}

      <div style={{ display: "flex", gap: 4 }}>
        {!previewUrl ? (
          <button onClick={generatePreview} disabled={generating || !text.trim()}
            style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${cyan}30`, background: `${cyan}10`, color: cyan, fontSize: 10, cursor: generating ? "not-allowed" : "pointer", fontWeight: 600 }}>
            {generating ? "Generating..." : "Preview Voice"}
          </button>
        ) : (
          <>
            {previewUrl !== "browser" && (
              <button onClick={togglePlay}
                style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${purple}`, background: `${purple}20`, color: purple, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {playing ? "⏸" : "▶"}
              </button>
            )}
            <button onClick={() => { setPreviewUrl(null); setPlaying(false); }}
              style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
              Re-preview
            </button>
          </>
        )}

        {onApprove && previewUrl && (
          <button onClick={onApprove}
            style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${green}30`, background: `${green}10`, color: green, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
            Approve
          </button>
        )}
        {onReject && previewUrl && (
          <button onClick={onReject}
            style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid rgba(239,68,68,0.3)`, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 10, cursor: "pointer" }}>
            Reject
          </button>
        )}
      </div>

      {error && <p style={{ fontSize: 9, color: "#f59e0b", width: "100%" }}>{error}</p>}
      {previewUrl === "browser" && <p style={{ fontSize: 8, color: "#3d5060", width: "100%" }}>Browser voice preview (final will use GHS voice engine)</p>}
    </div>
  );
}
