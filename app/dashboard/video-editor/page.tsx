"use client";

import { useState, useRef } from "react";
import OverlayPanel from "../../components/OverlayPanel";
import SFXPicker from "../../components/SFXPicker";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import Card from "../../components/ui/Card";
import ButtonPrimary from "../../components/ui/ButtonPrimary";
import { Folder, Wand, Film, Music, X } from "../../components/icons";

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

  const microLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: ds.color.mute,
    display: "block",
    marginBottom: 6,
    fontFamily: ds.font.mono,
  };

  const inputSt: React.CSSProperties = {
    background: ds.color.card,
    color: ds.color.ink2,
    border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.xs,
    padding: "8px 12px",
    fontSize: 12,
    width: "100%",
  };

  const ghostBtn: React.CSSProperties = {
    background: "none",
    color: ds.color.mute,
    border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.xs,
    padding: "7px 12px",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <HeroTitle
        kicker="Studio / Edit"
        title="Video"
        italic="Editor"
        sub="Import any video — add text overlays, captions, logos, animations — export"
      />

      {/* Badge row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.xs, background: `${ds.color.lilac}18`, color: ds.color.lilac, fontFamily: ds.font.mono }}>AI: Claude Haiku</span>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: ds.radius.xs, background: `${ds.color.mint}10`, color: ds.color.mint, fontFamily: ds.font.mono }}>OverlayPanel</span>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: ds.radius.xs, background: `${ds.color.gold}10`, color: ds.color.gold, fontFamily: ds.font.mono }}>FFmpeg export</span>
      </div>

      {/* AI Prompt Bar — always visible */}
      <Card style={{ marginBottom: 16 }}>
        <label style={microLabel}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Wand size={11} color={ds.color.lilac} />
            AI Prompt Assistant
          </span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={promptInput}
            onChange={e => { setPromptInput(e.target.value); setPolishedPrompt(""); }}
            placeholder='Describe what you want to do: "add bold price tag at bottom, fade in title at top..."'
            style={{ ...inputSt, flex: 1 }}
          />
          <ButtonPrimary
            onClick={handlePolish}
            disabled={polishing || !promptInput.trim()}
            style={{ whiteSpace: "nowrap", fontSize: 11, padding: "8px 16px" }}
          >
            {polishing ? "Polishing…" : "Polish"}
          </ButtonPrimary>
        </div>
        {polishedPrompt && (
          <div style={{ marginTop: 8, background: ds.color.paper, borderRadius: ds.radius.xs, padding: "8px 12px", border: `1px solid ${ds.color.line2}` }}>
            <p style={{ fontSize: 9, color: ds.color.lilac, fontWeight: 700, marginBottom: 4, fontFamily: ds.font.mono, letterSpacing: 1 }}>AI IMPROVED</p>
            <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.5 }}>{polishedPrompt}</p>
            <button onClick={() => { setPromptInput(polishedPrompt); setPolishedPrompt(""); }}
              style={{ marginTop: 5, fontSize: 10, color: ds.color.mint, background: "none", border: "none", cursor: "pointer" }}>
              Use this
            </button>
          </div>
        )}
      </Card>

      {/* Video import */}
      {!videoPath ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${ds.color.line2}`,
            borderRadius: ds.radius.lg,
            padding: "60px 40px",
            textAlign: "center",
            cursor: "pointer",
            background: ds.color.paper,
            transition: "border-color 0.2s",
            marginTop: 16,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = ds.color.lilac)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = ds.color.line2)}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Folder size={40} color={ds.color.mute} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: ds.color.ink2, marginBottom: 4 }}>
            {uploading ? "Uploading..." : "Drop a video here or click to upload"}
          </p>
          <p style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono }}>MP4, MOV, WebM</p>
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Video preview + quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Preview */}
            <Card padding={0} style={{ overflow: "hidden" }}>
              <video src={videoUrl ?? undefined} controls style={{ width: "100%", maxHeight: 380, background: "black" }} />
              <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>{videoPath?.split(/[\\/]/).pop()}</span>
                <button
                  onClick={() => { setVideoPath(null); setVideoUrl(null); setOverlayLayers([]); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={11} color={ds.color.coral} /> Remove
                </button>
              </div>
            </Card>

            {/* Quick actions + Voice */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Card>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink2, marginBottom: 10 }}>Quick Add</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <ButtonPrimary
                    style={{ width: "100%", textAlign: "left", fontSize: 11, padding: "7px 12px" }}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `text_${Date.now()}`, text: "Your Text Here", position: { zone: "bottom" }, style: { fontSize: 48, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 }, animation: { entrance: "fade_in", startSec: 0, durationSec: 5 } }])}
                  >
                    + Add Text Overlay
                  </ButtonPrimary>
                  <button
                    style={ghostBtn}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `headline_${Date.now()}`, text: "HEADLINE", position: { zone: "top" }, style: { fontSize: 56, fontWeight: "bold", color: "#FF0000", outline: true, outlineColor: "#FFFFFF", outlineWidth: 3, shadow: true, uppercase: true }, animation: { entrance: "fade_in", startSec: 0.5, durationSec: 99 } }])}
                  >
                    + Property Headline (Red)
                  </button>
                  <button
                    style={ghostBtn}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `price_${Date.now()}`, text: "₦60,000/night", position: { zone: "bottom" }, style: { fontSize: 36, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e@0.9", bgPadding: 14, shadow: false, outline: false }, animation: { entrance: "pop_in", startSec: 2, durationSec: 5 } }])}
                  >
                    + Price Tag
                  </button>
                  <label style={{ ...ghostBtn, display: "block" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Film size={11} color={ds.color.mute} />
                      + Upload Logo / Image
                    </span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append("file", file);
                      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
                      if (res.ok) { const data = await res.json(); setOverlayLayers(prev => [...prev, { type: "image", id: `img_${Date.now()}`, imagePath: data.filePath, position: { zone: "bottom-right" }, size: { width: 150, height: 60 }, animation: { entrance: "none", startSec: 0, durationSec: 999 } }]); }
                    }} />
                  </label>
                </div>
              </Card>

              {/* Caption */}
              <Card>
                <label style={microLabel}>Caption Text</label>
                <input value={captionText} onChange={e => setCaptionText(e.target.value)} placeholder="Bottom caption to burn into video…" style={inputSt} />
              </Card>

              {/* Voice */}
              <Card>
                <label style={microLabel}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Music size={11} color={ds.color.lilac} />
                    Voice Engine
                  </span>
                </label>
                <VoiceTierSelector value={voiceTier} onChange={setVoiceTier} compact />
              </Card>
            </div>
          </div>

          {/* Full overlay panel */}
          <OverlayPanel videoPath={videoPath} layers={overlayLayers} onChange={setOverlayLayers} onApplied={() => {}} />

          {/* SFX Library */}
          <Card style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink2, marginBottom: 6 }}>Sound Effects Library</h3>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 10 }}>Browse and preview SFX. Click "Use" to add to your project.</p>
            <SFXPicker onSelect={(event, path) => { console.log(`[SFX] ${event} → ${path}`); }} />
          </Card>
        </div>
      )}
    </div>
  );
}
