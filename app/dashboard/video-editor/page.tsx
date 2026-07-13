"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OverlayPanel from "../../components/OverlayPanel";
import SFXPicker from "../../components/SFXPicker";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import Card from "../../components/ui/Card";
import ButtonPrimary from "../../components/ui/ButtonPrimary";
import { Folder, Wand, Film, Music, X, Check } from "../../components/icons";
import ModelChip from "../../components/ModelChip";

function VideoEditorInner() {
  const searchParams = useSearchParams();
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);

  // ── Video-aware timing (text should know how long the video is) ──
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoDims, setVideoDims] = useState({ w: 1920, h: 1080 });
  const [currentTime, setCurrentTime] = useState(0);
  // Default text window = the whole video (rounded to 0.1s); 5s fallback before metadata loads.
  const wholeVideo = videoDuration > 0 ? Math.round(videoDuration * 10) / 10 : 5;

  // The displayed video IMAGE rect inside the <video> element (letterbox/pillarbox aware).
  // Text must be positioned + scaled against THIS rect — not the player box — or a portrait
  // clip renders the preview text over the black side bars at the wrong size.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoRect, setVideoRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  function measureVideoRect() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const cw = v.clientWidth, ch = v.clientHeight;
    const s = Math.min(cw / v.videoWidth, ch / v.videoHeight);
    const w = v.videoWidth * s, h = v.videoHeight * s;
    setVideoRect({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h });
  }
  useEffect(() => {
    window.addEventListener("resize", measureVideoRect);
    return () => window.removeEventListener("resize", measureVideoRect);
  }, []);

  // ── Post-assembly trim / intro / outro (FIX 3) ──
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [introText, setIntroText] = useState("");
  const [introDuration, setIntroDuration] = useState(3);
  const [outroText, setOutroText] = useState("");
  const [outroDuration, setOutroDuration] = useState(3);
  const [trimming, setTrimming] = useState(false);
  const [addingIntro, setAddingIntro] = useState(false);
  const [addingOutro, setAddingOutro] = useState(false);
  const [trimResult, setTrimResult] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [aiEditing, setAiEditing] = useState(false);

  // Load videoUrl from query param (?videoUrl=...)
  useEffect(() => {
    const qv = searchParams.get("videoUrl");
    if (qv) {
      setVideoUrl(decodeURIComponent(qv));
      setVideoPath(decodeURIComponent(qv));
    }
  }, [searchParams]);

  async function handleTrim() {
    if (!videoPath || trimEnd <= trimStart) { setEditMsg("Set valid trim points first"); return; }
    setTrimming(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/trim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, startSec: trimStart, endSec: trimEnd }),
      });
      const data = await res.json();
      if (data.outputUrl) { setTrimResult(data.outputUrl); setVideoUrl(data.outputUrl); setEditMsg("Trim complete"); }
      else setEditMsg(data.error || "Trim failed");
    } catch (err) { setEditMsg("Trim failed: " + String(err)); }
    setTrimming(false);
  }

  async function handleAddIntro() {
    if (!videoPath || !introText.trim()) { setEditMsg("Set video and intro text first"); return; }
    setAddingIntro(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/add-intro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, text: introText, duration: introDuration }),
      });
      const data = await res.json();
      if (data.outputUrl) { setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setEditMsg("Intro added"); }
      else setEditMsg(data.error || "Add intro failed");
    } catch (err) { setEditMsg("Add intro failed: " + String(err)); }
    setAddingIntro(false);
  }

  async function handleAddOutro() {
    if (!videoPath || !outroText.trim()) { setEditMsg("Set video and outro text first"); return; }
    setAddingOutro(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/add-outro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, text: outroText, duration: outroDuration }),
      });
      const data = await res.json();
      if (data.outputUrl) { setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setEditMsg("Outro added"); }
      else setEditMsg(data.error || "Add outro failed");
    } catch (err) { setEditMsg("Add outro failed: " + String(err)); }
    setAddingOutro(false);
  }

  async function handleAiEdit() {
    if (!aiEditPrompt.trim() || !videoPath) return;
    setAiEditing(true); setEditMsg(null);
    // Parse the instruction and call the right API
    const inst = aiEditPrompt.toLowerCase();
    try {
      if (inst.includes("trim") || inst.includes("cut") || inst.includes("shorten")) {
        // Extract time range from instruction
        const matches = inst.match(/(\d+)\s*(?:second|sec|s)\b/g);
        if (matches && matches.length >= 2) {
          const start = parseInt(matches[0]);
          const end = parseInt(matches[1]);
          setTrimStart(start); setTrimEnd(end);
          await handleTrim();
        } else setEditMsg("Specify time range: e.g. 'trim from 5s to 30s'");
      } else if (inst.includes("intro")) {
        const textMatch = aiEditPrompt.match(/["']([^"']+)["']/);
        if (textMatch) { setIntroText(textMatch[1]); await handleAddIntro(); }
        else setEditMsg("Specify intro text in quotes: e.g. 'add intro \"My Film\"'");
      } else if (inst.includes("outro")) {
        const textMatch = aiEditPrompt.match(/["']([^"']+)["']/);
        if (textMatch) { setOutroText(textMatch[1]); await handleAddOutro(); }
        else setEditMsg("Specify outro text in quotes: e.g. 'add outro \"Subscribe now\"'");
      } else {
        setEditMsg("Supported: 'trim from Xs to Ys', 'add intro \"text\"', 'add outro \"text\"'");
      }
    } catch (err) { setEditMsg("AI edit failed: " + String(err)); }
    setAiEditing(false);
  }
  const [promptInput, setPromptInput] = useState("");
  const [polishedPrompt, setPolishedPrompt] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [voiceTier, setVoiceTier] = useState<VoiceTierConfig>({ tier: "standard" });
  const [captionText, setCaptionText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ outputUrl: string; contentItemId: string } | null>(null);
  const [exportError, setExportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/v2v/upload", { method: "POST", body: fd });
      const data = await res.json();
      // API returns { filePath } — NOT { path }. Reading data.path here broke the whole editor silently.
      if (res.ok && data.filePath) {
        setVideoPath(data.filePath);
        setVideoUrl(`/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`);
      } else {
        console.error("[video-editor] upload rejected:", res.status, data.error);
        setUploadError(data.error || `Upload failed (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error("[video-editor] upload failed:", err);
      setUploadError("Upload failed: " + String(err));
    }
    setUploading(false);
  }

  async function handlePolish() {
    if (!promptInput.trim()) return;
    setPolishing(true);
    setPolishError(null);
    try {
      const res = await fetch("/api/llm/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptInput }),
      });
      const data = await res.json();
      if (res.ok && data.polishedPrompt) {
        setPolishedPrompt(data.polishedPrompt);
      } else {
        console.error("[video-editor] polish failed:", res.status, data.error);
        setPolishError(data.error || `Polish failed (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error("[video-editor] polish failed:", err);
      setPolishError("Polish failed: " + String(err));
    } finally { setPolishing(false); }
  }

  async function handleExport() {
    if (!videoPath) return;
    setExporting(true);
    setExportError("");
    setExportResult(null);
    // Build caption layer if provided
    const allLayers: OverlayLayer[] = [...overlayLayers];
    if (captionText.trim()) {
      allLayers.push({
        type: "text",
        id: `caption_${Date.now()}`,
        text: captionText,
        position: { zone: "bottom" },
        style: { fontSize: 32, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 },
        animation: { entrance: "fade_in", startSec: 0, durationSec: 9999 },
      });
    }
    try {
      const res = await fetch("/api/overlays/render-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, layers: allLayers, title: polishedPrompt || promptInput || "Video Editor export" }),
      });
      const data = await res.json();
      if (!res.ok) { setExportError(data.error ?? "Export failed"); return; }
      setExportResult({ outputUrl: data.outputUrl, contentItemId: data.contentItemId });
    } catch { setExportError("Network error during export"); } finally { setExporting(false); }
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
        {polishError && (
          <p style={{ fontSize: 11, color: ds.color.coral, marginTop: 8, fontWeight: 600 }}>{polishError}</p>
        )}
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
          {uploadError && (
            <p style={{ fontSize: 12, color: ds.color.coral, marginTop: 10, fontWeight: 600 }}>{uploadError}</p>
          )}
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Video preview + quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Preview — plays the video with a live approximation of the text overlays,
                so you can SEE where the text sits and when it appears/disappears. */}
            <Card padding={0} style={{ overflow: "hidden" }}>
              <div style={{ position: "relative", background: "black" }}>
                <video
                  ref={videoRef}
                  src={videoUrl ?? undefined}
                  controls
                  onLoadedMetadata={e => {
                    setVideoDuration(e.currentTarget.duration || 0);
                    setVideoDims({ w: e.currentTarget.videoWidth || 1920, h: e.currentTarget.videoHeight || 1080 });
                    requestAnimationFrame(measureVideoRect);
                  }}
                  onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                  style={{ width: "100%", maxHeight: 380, background: "black", display: "block" }}
                />
                {/* Live overlay preview, drawn inside the ACTUAL video image rect using the
                    same geometry FFmpeg burns with (top=6% of height, bottom=text top at 85%,
                    font px scaled from native video width). */}
                {videoRect && (
                  <div style={{ position: "absolute", left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height, pointerEvents: "none", overflow: "hidden" }}>
                    {overlayLayers.filter((l): l is Extract<OverlayLayer, { type: "text" }> => l.type === "text").map(l => {
                      const start = l.animation?.startSec ?? 0;
                      const dur = l.animation?.durationSec ?? 9999;
                      if (currentTime < start || currentTime > start + dur) return null;
                      const scale = videoRect.width / (videoDims.w || 1920);
                      const zone = l.position?.zone ?? "bottom";
                      const pos: React.CSSProperties =
                        zone === "top" ? { top: "6%", left: "50%", transform: "translateX(-50%)" } :
                        zone === "center" ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } :
                        zone === "free" ? { top: `${l.position?.y ?? 50}%`, left: `${l.position?.x ?? 50}%`, transform: "translate(-50%, -50%)" } :
                        { top: "85%", left: "50%", transform: "translateX(-50%)" };
                      const bg = l.style?.bgColor ? l.style.bgColor.split("@") : null;
                      const bgCss = bg ? `color-mix(in srgb, ${bg[0]} ${Math.round(Number(bg[1] ?? 1) * 100)}%, transparent)` : undefined;
                      const pad = (l.style?.bgPadding ?? 0) * scale;
                      return (
                        <span key={l.id} style={{
                          position: "absolute", ...pos, whiteSpace: "pre-wrap", textAlign: "center",
                          maxWidth: "96%", lineHeight: 1.15,
                          fontSize: Math.max(6, (l.style?.fontSize ?? 48) * scale),
                          fontWeight: l.style?.fontWeight === "bold" ? 700 : 400,
                          fontStyle: l.style?.italic ? "italic" : "normal",
                          fontFamily: l.style?.fontFamily || "Arial, Helvetica, sans-serif",
                          textTransform: l.style?.uppercase ? "uppercase" : "none",
                          color: l.style?.color ?? "#FFFFFF",
                          textShadow: l.style?.shadow ? `0 ${2 * scale}px ${6 * scale}px rgba(0,0,0,0.8)` : "none",
                          WebkitTextStroke: l.style?.outline ? `${Math.max(0.5, (l.style?.outlineWidth ?? 2) * scale)}px ${l.style?.outlineColor ?? "#000"}` : undefined,
                          background: bgCss,
                          padding: pad ? `${pad / 2}px ${pad}px` : undefined,
                          borderRadius: l.style?.bgRadius ? l.style.bgRadius * scale : undefined,
                        }}>{l.text}</span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>
                  {videoPath?.split(/[\\/]/).pop()}{videoDuration > 0 ? ` · ${(Math.round(videoDuration * 10) / 10)}s` : ""}
                </span>
                <button
                  onClick={() => { setVideoPath(null); setVideoUrl(null); setOverlayLayers([]); setVideoDuration(0); setCurrentTime(0); }}
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
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `text_${Date.now()}`, text: "Your Text Here", position: { zone: "bottom" }, style: { fontSize: 48, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 }, animation: { entrance: "fade_in", startSec: 0, durationSec: wholeVideo } }])}
                  >
                    + Add Text Overlay
                  </ButtonPrimary>
                  <button
                    style={ghostBtn}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `headline_${Date.now()}`, text: "HEADLINE", position: { zone: "top" }, style: { fontSize: 56, fontWeight: "bold", color: "#FF0000", outline: true, outlineColor: "#FFFFFF", outlineWidth: 3, shadow: true, uppercase: true }, animation: { entrance: "fade_in", startSec: 0.5, durationSec: Math.max(1, wholeVideo - 0.5) } }])}
                  >
                    + Property Headline (Red)
                  </button>
                  <button
                    style={ghostBtn}
                    onClick={() => { const pStart = Math.min(2, Math.max(0, wholeVideo - 1)); setOverlayLayers(prev => [...prev, { type: "text", id: `price_${Date.now()}`, text: "₦60,000/night", position: { zone: "bottom" }, style: { fontSize: 36, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e@0.9", bgPadding: 14, shadow: false, outline: false }, animation: { entrance: "pop_in", startSec: pStart, durationSec: Math.max(1, wholeVideo - pStart) } }]); }}
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
                {captionText.trim() && (
                  <p style={{ fontSize: 10, color: ds.color.mute, marginTop: 4 }}>Shows at the bottom for the whole video{videoDuration > 0 ? ` (${Math.round(videoDuration * 10) / 10}s)` : ""}.</p>
                )}
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
          <OverlayPanel videoPath={videoPath} layers={overlayLayers} onChange={setOverlayLayers} onApplied={() => {}} videoDurationSec={videoDuration} />

          {/* SFX Library */}
          <Card style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink2, marginBottom: 6 }}>Sound Effects Library</h3>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 10 }}>Browse and preview SFX. Click "Use" to add to your project.</p>
            <SFXPicker onSelect={(event, path) => { console.log(`[SFX] ${event} → ${path}`); }} />
          </Card>

          {/* ── Post-Assembly Tools: Trim / Intro / Outro / AI Edit (FIX 3) ── */}
          <Card style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2, marginBottom: 12 }}>Post-Assembly Tools</h3>

            {editMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: trimResult ? `${ds.color.mint}10` : `${ds.color.coral}10`, border: `1px solid ${trimResult ? ds.color.mint : ds.color.coral}30`, fontSize: 11, color: trimResult ? ds.color.mint : ds.color.coral }}>
                {editMsg}
              </div>
            )}

            {/* AI Edit */}
            <label style={microLabel}>AI Edit (natural language)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)}
                placeholder={"e.g. 'trim from 5s to 30s' or 'add intro \"My Film\"'"}
                style={{ ...inputSt, flex: 1 }}
                onKeyDown={e => e.key === "Enter" && handleAiEdit()} />
              <button onClick={handleAiEdit} disabled={aiEditing || !videoPath}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: aiEditing ? ds.color.card : ds.color.lilac, color: "#000", fontSize: 12, fontWeight: 700, cursor: aiEditing ? "not-allowed" : "pointer", flexShrink: 0 }}>
                {aiEditing ? "Working..." : "Apply"}
              </button>
            </div>

            {/* Trim */}
            <label style={microLabel}>Trim</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Start (seconds)</span>
                <input type="number" min={0} value={trimStart} onChange={e => setTrimStart(Number(e.target.value))} style={inputSt} />
              </div>
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>End (seconds)</span>
                <input type="number" min={0} value={trimEnd} onChange={e => setTrimEnd(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleTrim} disabled={trimming || !videoPath}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: trimming ? ds.color.card : ds.color.sky, color: "#000", fontSize: 12, fontWeight: 700, cursor: trimming ? "not-allowed" : "pointer" }}>
                {trimming ? "..." : "Trim"}
              </button>
            </div>

            {/* Intro */}
            <label style={microLabel}>Add Intro Card</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
              <input value={introText} onChange={e => setIntroText(e.target.value)} placeholder="Intro text (e.g. A GioHomeStudio Film)" style={inputSt} />
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Seconds</span>
                <input type="number" min={1} max={10} value={introDuration} onChange={e => setIntroDuration(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleAddIntro} disabled={addingIntro || !videoPath}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: addingIntro ? ds.color.card : ds.color.gold, color: "#000", fontSize: 12, fontWeight: 700, cursor: addingIntro ? "not-allowed" : "pointer" }}>
                {addingIntro ? "..." : "Add"}
              </button>
            </div>

            {/* Outro */}
            <label style={microLabel}>Add Outro Card</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, alignItems: "end" }}>
              <input value={outroText} onChange={e => setOutroText(e.target.value)} placeholder="Outro text (e.g. Subscribe now)" style={inputSt} />
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Seconds</span>
                <input type="number" min={1} max={10} value={outroDuration} onChange={e => setOutroDuration(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleAddOutro} disabled={addingOutro || !videoPath}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: addingOutro ? ds.color.card : ds.color.mint, color: "#000", fontSize: 12, fontWeight: 700, cursor: addingOutro ? "not-allowed" : "pointer" }}>
                {addingOutro ? "..." : "Add"}
              </button>
            </div>
          </Card>

          {/* Export / Assembly */}
          <Card style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2 }}>Export Video</h3>
              <ModelChip modelId="ffmpeg" provider="FFmpeg" size="xs" position="static" />
            </div>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12 }}>Burn all overlays, captions, and animations into the final video.</p>
            <ButtonPrimary onClick={handleExport} disabled={exporting || !videoPath} style={{ width: "100%" }}>
              {exporting ? "Exporting…" : "Export with Overlays"}
            </ButtonPrimary>
            {exportError && <p style={{ fontSize: 11, color: ds.color.coral, marginTop: 8 }}>{exportError}</p>}
            {exportResult && (
              <div style={{ marginTop: 12, background: ds.color.paper, borderRadius: ds.radius.sm, padding: 12, border: `1px solid ${ds.color.line2}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Check size={14} color={ds.color.mint} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: ds.color.mint }}>Export complete</span>
                </div>
                <video src={exportResult.outputUrl} controls style={{ width: "100%", borderRadius: ds.radius.xs, background: "black" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <a href={exportResult.outputUrl} download style={{ fontSize: 11, color: ds.color.lilac, textDecoration: "underline" }}>Download MP4</a>
                  <a href={`/dashboard/content/${exportResult.contentItemId}`} style={{ fontSize: 11, color: ds.color.mute, textDecoration: "underline" }}>View in registry</a>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function VideoEditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading editor…</div>}>
      <VideoEditorInner />
    </Suspense>
  );
}
