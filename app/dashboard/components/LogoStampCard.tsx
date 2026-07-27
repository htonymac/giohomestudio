"use client";

// LogoStampCard — burn the user's OWN brand logo onto a video, small and in a
// corner (default bottom-right, Kling-style — never blocks the shot). Reused on
// /dashboard/video-editor (inside EditorTimeline) and /dashboard/commercial.
// Self-contained: uploads the logo (/api/upload/logo), then POSTs the stamp
// (/api/editor/stamp-logo) and hands the stamped video URL back via onStamped().

import { useState } from "react";
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

export default function LogoStampCard({ videoUrl, onStamped, contentItemId }: LogoStampCardProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [corner, setCorner] = useState<Corner>("br"); // Kling-style default
  const [scale, setScale] = useState(0.12);           // 12% of video width
  const [opacity, setOpacity] = useState(0.9);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
        setMsg("Logo ready — pick a spot and apply.");
      } else setMsg(data.error || "Logo upload failed");
    } catch (err) { setMsg("Logo upload failed: " + String(err)); }
    setUploading(false);
  }

  async function handleApply() {
    if (!videoUrl || !logoUrl) return;
    setWorking(true); setMsg(null);
    try {
      // Persist onto the content item when we have its id; else a one-off stamp.
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
        Burn your own logo onto this video — small and in a corner, like an AI generator&apos;s badge. Doesn&apos;t block the shot.
      </p>

      {/* Upload / preview */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.5 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
          {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo (PNG)"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); e.currentTarget.value = ""; }} />
        </label>
        {logoUrl && (
          // Checkerboard so a transparent PNG is visible.
          <span style={{
            display: "inline-block", padding: 4, borderRadius: 6, border: `1px solid ${ds.color.line2}`,
            backgroundImage: "linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)",
            backgroundSize: "10px 10px", backgroundPosition: "0 0,0 5px,5px -5px,-5px 0px",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="logo" style={{ height: 34, display: "block", objectFit: "contain" }} />
          </span>
        )}
      </div>

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

      {/* Size + opacity */}
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
        {working ? "Stamping…" : !logoUrl ? "Upload a logo first" : "Add my logo to this video"}
      </button>
    </Card>
  );
}
