"use client";

import { useState, useRef } from "react";
import OverlayPanel from "../../components/OverlayPanel";
import SFXPicker from "../../components/SFXPicker";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";

export default function VideoEditorPage() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-shimmer">🎬 Video Editor</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Import any video → add text overlays, logos, captions, animations → export</p>
      </div>

      {/* Video import */}
      {!videoPath ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: "2px dashed var(--border2)",
            borderRadius: 16,
            padding: "60px 40px",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--surface2)",
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border2)")}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            {uploading ? "Uploading..." : "Drop a video here or click to upload"}
          </p>
          <p style={{ fontSize: 11, color: "var(--text3)" }}>MP4, MOV, WebM — or paste a URL to an existing video</p>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
        </div>
      ) : (
        <div>
          {/* Video preview + overlay editor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Video preview */}
            <div style={{ background: "var(--surface2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              <video
                src={videoUrl ?? undefined}
                controls
                style={{ width: "100%", maxHeight: 400, background: "black" }}
              />
              <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text2)" }}>
                  {videoPath?.split(/[\\/]/).pop()}
                </span>
                <button
                  onClick={() => { setVideoPath(null); setVideoUrl(null); setOverlayLayers([]); }}
                  style={{ fontSize: 10, color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Remove video
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="card" style={{ flex: 1 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Quick Add</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setOverlayLayers(prev => [...prev, {
                      type: "text", id: `text_${Date.now()}`, text: "Your Text Here",
                      position: { zone: "bottom" },
                      style: { fontSize: 48, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 },
                      animation: { entrance: "fade_in", startSec: 0, durationSec: 5 },
                    }]);
                  }}>+ Add Text Overlay</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setOverlayLayers(prev => [...prev, {
                      type: "text", id: `headline_${Date.now()}`, text: "HEADLINE",
                      position: { zone: "top" },
                      style: { fontSize: 56, fontWeight: "bold", color: "#FF0000", outline: true, outlineColor: "#FFFFFF", outlineWidth: 3, shadow: true, uppercase: true },
                      animation: { entrance: "fade_in", startSec: 0.5, durationSec: 99 },
                    }]);
                  }}>+ Property Headline (Red + White Stroke)</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setOverlayLayers(prev => [...prev, {
                      type: "text", id: `price_${Date.now()}`, text: "₦60,000/night",
                      position: { zone: "bottom" },
                      style: { fontSize: 36, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e@0.9", bgPadding: 14, shadow: false, outline: false },
                      animation: { entrance: "pop_in", startSec: 2, durationSec: 5 },
                    }]);
                  }}>+ Price Tag (Green CTA)</button>
                  <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                    + Upload Logo / Image
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
                      if (res.ok) {
                        const data = await res.json();
                        setOverlayLayers(prev => [...prev, {
                          type: "image", id: `img_${Date.now()}`,
                          imagePath: data.filePath,
                          position: { zone: "bottom-right" },
                          size: { width: 150, height: 60 },
                          animation: { entrance: "none", startSec: 0, durationSec: 999 },
                        }]);
                      }
                    }} />
                  </label>
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Keyboard Shortcuts</h3>
                <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.8 }}>
                  Ctrl+K — Search everything<br/>
                  Ctrl+P — Command palette<br/>
                </div>
              </div>
            </div>
          </div>

          {/* Full overlay panel */}
          <OverlayPanel
            videoPath={videoPath}
            layers={overlayLayers}
            onChange={setOverlayLayers}
            onApplied={() => {}}
          />

          {/* SFX Library */}
          <div style={{ border: "1px solid #333", borderRadius: 8, background: "#0f0f0f", padding: "12px 14px", marginTop: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5", marginBottom: 8 }}>Sound Effects Library</h3>
            <p style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>Browse and preview SFX. Click "Use" to add to your project.</p>
            <SFXPicker onSelect={(event, path) => { console.log(`[SFX] Selected: ${event} → ${path}`); }} />
          </div>
        </div>
      )}
    </div>
  );
}
