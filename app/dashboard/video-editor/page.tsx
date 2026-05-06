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
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);

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
  const [voiceTier, setVoiceTier] = useState<VoiceTierConfig>({ tier: "standard" });
  const [captionText, setCaptionText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ outputUrl: string; contentItemId: string } | null>(null);
  const [exportError, setExportError] = useState("");
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
      const res = await fetch("/api/llm/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptInput }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.polishedPrompt) setPolishedPrompt(data.polishedPrompt);
      }
    } catch { /* ignore */ } finally { setPolishing(false); }
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
