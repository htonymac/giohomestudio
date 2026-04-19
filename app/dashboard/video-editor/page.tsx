"use client";

import { useState, useRef } from "react";
import OverlayPanel from "../../components/OverlayPanel";
import SFXPicker from "../../components/SFXPicker";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";

export default function VideoEditorPage() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);
  const [promptInput, setPromptInput] = useState("");
  const [polishedPrompt, setPolishedPrompt] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [voiceTier, setVoiceTier] = useState<VoiceTierConfig>({ tier: "standard" });
  const [captionText, setCaptionText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/v2v/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setVideoPath(data.path);
        setVideoUrl(`/api/media/${data.path.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`);
      }
    } catch { /* ignore */ }
    setUploading(false);
  }

  async function handlePolish() {
    if (!promptInput.trim()) return;
    setPolishing(true);
    try {
      const res = await fetch("/api/assembly/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: `You are a professional video editor assistant. Polish and improve this video editing prompt for better output: "${promptInput}". Return ONLY the improved prompt text, nothing else.`,
          assembly: { segments: [], narration: [], music: [], sfx: [], subtitles: [], ambience: [] },
        }),
      });
      const data = await res.json();
      if (data.suggestion || data.instruction) setPolishedPrompt(data.suggestion || data.instruction);
    } catch { /* ignore */ } finally { setPolishing(false); }
  }

  const sectionStyle: React.CSSProperties = { border: "1px solid #1e2a35", borderRadius: 10, background: "#0a0a12", padding: "14px 16px", marginTop: 10 };
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#5a7080", display: "block", marginBottom: 6 };
  const inputStyle: React.CSSProperties = { background: "#111520", color: "#e0e8f0", border: "1px solid #1e2a35", borderRadius: 6, padding: "8px 12px", fontSize: 12, width: "100%" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>🎬 Video Editor</h1>
        <p style={{ fontSize: 11, color: "#5a7080", marginTop: 3 }}>
          Import any video → add text overlays, captions, logos, animations → export
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#7c5cfc20", color: "#a080ff" }}>AI: Claude Haiku</span>
          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "#22c55e10", color: "#22c55e" }}>OverlayPanel</span>
          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "#f59e0b10", color: "#f59e0b" }}>FFmpeg export</span>
        </div>
      </div>

      {/* AI Prompt Bar — always visible */}
      <div style={sectionStyle}>
        <label style={labelStyle}>✨ AI Prompt Assistant</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={promptInput}
            onChange={e => { setPromptInput(e.target.value); setPolishedPrompt(""); }}
            placeholder='Describe what you want to do: "add bold price tag at bottom, fade in title at top..."'
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handlePolish} disabled={polishing || !promptInput.trim()}
            style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #00d4ff30", background: "#00d4ff08", color: polishing ? "#3a5060" : "#00d4ff", fontSize: 11, fontWeight: 600, cursor: polishing || !promptInput.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {polishing ? "Polishing…" : "✨ Polish"}
          </button>
        </div>
        {polishedPrompt && (
          <div style={{ marginTop: 8, background: "#080b10", borderRadius: 6, padding: "8px 12px", border: "1px solid #00d4ff20" }}>
            <p style={{ fontSize: 9, color: "#00d4ff", fontWeight: 700, marginBottom: 4 }}>AI IMPROVED</p>
            <p style={{ fontSize: 12, color: "#c0d8e8", lineHeight: 1.5 }}>{polishedPrompt}</p>
            <button onClick={() => { setPromptInput(polishedPrompt); setPolishedPrompt(""); }}
              style={{ marginTop: 5, fontSize: 10, color: "#22c55e", background: "none", border: "none", cursor: "pointer" }}>
              ← Use this
            </button>
          </div>
        )}
      </div>

      {/* Video import */}
      {!videoPath ? (
        <div onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #1e2a35", borderRadius: 16, padding: "60px 40px", textAlign: "center", cursor: "pointer", background: "#080b10", transition: "border-color 0.2s", marginTop: 16 }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#7c5cfc")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2a35")}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#e0e8f0", marginBottom: 4 }}>
            {uploading ? "Uploading..." : "Drop a video here or click to upload"}
          </p>
          <p style={{ fontSize: 11, color: "#3a5060" }}>MP4, MOV, WebM</p>
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Video preview + quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Preview */}
            <div style={{ background: "#080b10", borderRadius: 10, overflow: "hidden", border: "1px solid #1e2a35" }}>
              <video src={videoUrl ?? undefined} controls style={{ width: "100%", maxHeight: 380, background: "black" }} />
              <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#5a7080" }}>{videoPath?.split(/[\\/]/).pop()}</span>
                <button onClick={() => { setVideoPath(null); setVideoUrl(null); setOverlayLayers([]); }}
                  style={{ fontSize: 10, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            </div>

            {/* Quick actions + Voice */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={sectionStyle}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "#c0d0e0", marginBottom: 10 }}>Quick Add</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button style={{ background: "#7c5cfc", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `text_${Date.now()}`, text: "Your Text Here", position: { zone: "bottom" }, style: { fontSize: 48, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 }, animation: { entrance: "fade_in", startSec: 0, durationSec: 5 } }])}>
                    + Add Text Overlay
                  </button>
                  <button style={{ background: "none", color: "#8090a0", border: "1px solid #1e2a35", borderRadius: 6, padding: "7px 12px", fontSize: 11, cursor: "pointer", textAlign: "left" }}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `headline_${Date.now()}`, text: "HEADLINE", position: { zone: "top" }, style: { fontSize: 56, fontWeight: "bold", color: "#FF0000", outline: true, outlineColor: "#FFFFFF", outlineWidth: 3, shadow: true, uppercase: true }, animation: { entrance: "fade_in", startSec: 0.5, durationSec: 99 } }])}>
                    + Property Headline (Red)
                  </button>
                  <button style={{ background: "none", color: "#8090a0", border: "1px solid #1e2a35", borderRadius: 6, padding: "7px 12px", fontSize: 11, cursor: "pointer", textAlign: "left" }}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `price_${Date.now()}`, text: "₦60,000/night", position: { zone: "bottom" }, style: { fontSize: 36, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e@0.9", bgPadding: 14, shadow: false, outline: false }, animation: { entrance: "pop_in", startSec: 2, durationSec: 5 } }])}>
                    + Price Tag (Green)
                  </button>
                  <label style={{ background: "none", color: "#8090a0", border: "1px solid #1e2a35", borderRadius: 6, padding: "7px 12px", fontSize: 11, cursor: "pointer" }}>
                    + Upload Logo / Image
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append("file", file);
                      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
                      if (res.ok) { const data = await res.json(); setOverlayLayers(prev => [...prev, { type: "image", id: `img_${Date.now()}`, imagePath: data.filePath, position: { zone: "bottom-right" }, size: { width: 150, height: 60 }, animation: { entrance: "none", startSec: 0, durationSec: 999 } }]); }
                    }} />
                  </label>
                </div>
              </div>

              {/* Caption */}
              <div style={sectionStyle}>
                <label style={labelStyle}>Caption Text</label>
                <input value={captionText} onChange={e => setCaptionText(e.target.value)} placeholder="Bottom caption to burn into video…" style={inputStyle} />
              </div>

              {/* Voice */}
              <div style={sectionStyle}>
                <label style={labelStyle}>Voice Engine</label>
                <VoiceTierSelector value={voiceTier} onChange={setVoiceTier} compact />
              </div>
            </div>
          </div>

          {/* Full overlay panel */}
          <OverlayPanel videoPath={videoPath} layers={overlayLayers} onChange={setOverlayLayers} onApplied={() => {}} />

          {/* SFX Library */}
          <div style={{ ...sectionStyle, marginTop: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#c0d0e0", marginBottom: 6 }}>Sound Effects Library</h3>
            <p style={{ fontSize: 11, color: "#3a5060", marginBottom: 10 }}>Browse and preview SFX. Click "Use" to add to your project.</p>
            <SFXPicker onSelect={(event, path) => { console.log(`[SFX] ${event} → ${path}`); }} />
          </div>
        </div>
      )}
    </div>
  );
}
