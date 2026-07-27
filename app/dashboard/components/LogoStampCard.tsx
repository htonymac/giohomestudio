"use client";

// LogoStampCard — burn the user's OWN brand logo onto a video, small and in a
// corner (default bottom-right, Kling-style — never blocks the shot). Reused on
// /dashboard/video-editor (inside EditorTimeline) and the content review page.
//
// LIVE PREVIEW: the logo is shown ON the video and updates instantly as you
// change corner / size / opacity — nothing is burned until you hit Apply. The
// preview geometry mirrors the server ffmpeg overlay (3% margin, size = fraction
// of video width, per-corner anchor) so what you see is what you get.
//
// Self-contained: uploads the logo (/api/upload/logo), then POSTs the stamp
// (/api/editor/stamp-logo, or /api/content/[id]/stamp-logo when persisting).

import { useState, useRef, useEffect } from "react";
import { ds } from "../../../lib/designSystem";
import Card from "../../components/ui/Card";

export interface LogoStampCardProps {
  videoUrl: string | null;
  onStamped?: (outputUrl: string) => void;
  // When set, the stamp is PERSISTED onto this content item (its mergedOutputPath
  // is replaced with the stamped video) via /api/content/[id]/stamp-logo, instead
  // of just returning a one-off stamped file from /api/editor/stamp-logo.
  contentItemId?: string;
}

type Corner = "tl" | "tr" | "bl" | "br" | "center";
type Rect = { left: number; top: number; width: number; height: number };

export default function LogoStampCard({ videoUrl, onStamped, contentItemId }: LogoStampCardProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [corner, setCorner] = useState<Corner>("br"); // Kling-style default
  const [scale, setScale] = useState(0.12);           // 12% of video width
  const [opacity, setOpacity] = useState(0.9);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Content rect = where the actual picture sits inside the letterboxed <video>
  // element. The logo overlay is positioned within THIS, so the preview matches
  // the burned result on portrait or landscape clips.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [contentRect, setContentRect] = useState<Rect | null>(null);

  function measureContent() {
    const v = videoRef.current;
    if (!v) return;
    const rect = v.getBoundingClientRect();
    const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
    const s = Math.min(rect.width / vw, rect.height / vh);
    const dispW = vw * s, dispH = vh * s;
    setContentRect({ left: (rect.width - dispW) / 2, top: (rect.height - dispH) / 2, width: dispW, height: dispH });
  }
  useEffect(() => {
    const onResize = () => measureContent();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const busy = uploading || working;

  async function handleUploadLogo(file: File) {
    setUploading(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.filePath) {
        const url = `/api/media/${String(data.filePath).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
        setLogoUrl(url);
        setMsg("Logo ready — drag the sliders and watch the preview, then apply.");
      } else setMsg(data.error || "Logo upload failed");
    } catch (err) { setMsg("Logo upload failed: " + String(err)); }
    setUploading(false);
  }

  async function handleApply() {
    if (!videoUrl || !logoUrl) return;
    setWorking(true); setMsg(null);
    try {
      const endpoint = contentItemId ? `/api/content/${contentItemId}/stamp-logo` : "/api/editor/stamp-logo";
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, logoUrl, corner, scale, opacity }),
      });
      const data = await res.json();
      if (data.outputUrl) { setMsg("Logo added ✓"); onStamped?.(data.outputUrl); }
      else setMsg(data.error || "Could not add logo");
    } catch (err) { setMsg("Could not add logo: " + String(err)); }
    setWorking(false);
  }

  // Per-corner CSS inside the content-rect box. Margin 3% matches the ffmpeg
  // overlay (W*0.03 / H*0.03); width % = fraction of video width (matches scale).
  function logoPos(): React.CSSProperties {
    const M = "3%";
    const base: React.CSSProperties = { position: "absolute", width: `${scale * 100}%`, opacity, pointerEvents: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" };
    switch (corner) {
      case "tl": return { ...base, top: M, left: M };
      case "tr": return { ...base, top: M, right: M };
      case "bl": return { ...base, bottom: M, left: M };
      case "br": return { ...base, bottom: M, right: M };
      case "center": return { ...base, top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    }
  }

  const microLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase",
    color: ds.color.mute, display: "block", marginBottom: 6, fontFamily: ds.font.mono,
  };
  const ghostBtn: React.CSSProperties = {
    background: "none", color: ds.color.mute, border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.xs, padding: "6px 12px", fontSize: 11, cursor: "pointer",
  };
  const solid = (disabled: boolean): React.CSSProperties => ({
    width: "100%", padding: "9px 14px", borderRadius: 8, border: "none",
    background: disabled ? ds.color.card : ds.color.mint, color: "#000", fontSize: 12, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <Card style={{ marginTop: 10 }}>
      <label style={microLabel}>Add My Logo (Stamp)</label>
      <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 10 }}>
        Burn your own logo onto this video — small, in a corner, like an AI generator&apos;s badge. Adjust below and watch the live preview; nothing changes until you hit Apply.
      </p>

      {/* Upload */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.5 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
          {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo (PNG)"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); e.currentTarget.value = ""; }} />
        </label>
        {logoUrl && (
          <>
            <span style={{ fontSize: 10, color: ds.color.mint }}>logo loaded ✓</span>
            <button onClick={() => { setLogoUrl(null); setMsg(null); }} disabled={busy}
              title="Clear the loaded logo (does not touch a logo already applied to the video)"
              style={{ ...ghostBtn, padding: "5px 10px", fontSize: 10, color: ds.color.coral, borderColor: `${ds.color.coral}55`, cursor: busy ? "not-allowed" : "pointer" }}>
              Remove
            </button>
          </>
        )}
      </div>

      {/* LIVE PREVIEW — logo shown on the video, updates as you adjust */}
      {videoUrl && (
        <div style={{ position: "relative", marginBottom: 12, borderRadius: 8, overflow: "hidden", background: "#000" }}>
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            controls
            onLoadedMetadata={measureContent}
            style={{ width: "100%", maxHeight: "min(55vh, 380px)", display: "block", objectFit: "contain" }}
          />
          {logoUrl && contentRect && (
            <div style={{ position: "absolute", left: contentRect.left, top: contentRect.top, width: contentRect.width, height: contentRect.height, pointerEvents: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="logo preview" style={logoPos()} />
            </div>
          )}
          {!logoUrl && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 11, color: "#fff9", background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 999 }}>Upload a logo to preview it here</span>
            </div>
          )}
        </div>
      )}

      {/* Position */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {([["br", "Bottom-Right"], ["bl", "Bottom-Left"], ["tr", "Top-Right"], ["tl", "Top-Left"], ["center", "Center"]] as const).map(([c, name]) => (
          <button key={c} onClick={() => setCorner(c)} disabled={busy} title={name}
            style={{
              ...ghostBtn, padding: "5px 10px", fontSize: 10,
              borderColor: corner === c ? ds.color.mint : ds.color.line2,
              color: corner === c ? ds.color.mint : ds.color.mute,
              cursor: busy ? "not-allowed" : "pointer",
            }}>
            {c === "center" ? "Center" : c.toUpperCase()}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 9, color: ds.color.mute, marginBottom: 10, fontFamily: ds.font.mono }}>
        BR = Bottom-Right (recommended) · BL · TR · TL · Center
      </p>

      {/* Size + opacity — live */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ ...microLabel, marginBottom: 4 }}>Size ({Math.round(scale * 100)}%)</label>
          <input type="range" min={0.05} max={0.4} step={0.01} value={scale} disabled={busy}
            onChange={e => setScale(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ ...microLabel, marginBottom: 4 }}>Opacity ({Math.round(opacity * 100)}%)</label>
          <input type="range" min={0.2} max={1} step={0.05} value={opacity} disabled={busy}
            onChange={e => setOpacity(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
      </div>

      {msg && (
        <div style={{ padding: "7px 11px", borderRadius: 8, marginBottom: 10, fontSize: 11,
          background: `${ds.color.mint}10`, border: `1px solid ${ds.color.mint}30`, color: ds.color.mint }}>
          {msg}
        </div>
      )}

      <button onClick={handleApply} disabled={busy || !videoUrl || !logoUrl} style={solid(busy || !videoUrl || !logoUrl)}>
        {working ? "Stamping…" : !logoUrl ? "Upload a logo first" : "Apply logo to this video"}
      </button>
    </Card>
  );
}
