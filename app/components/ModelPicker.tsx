"use client";

// ModelPicker — compact video + image model selector
// Used across: ai-motion-video, viral-video, auto-creator, scene-forge, children-video, children-planner

import { useState } from "react";

export interface VideoModel { id: string; name: string; cost: string; badge: string; badgeColor: string; desc: string }
export interface ImageModel { id: string; name: string; cost: string; badge: string; badgeColor: string; desc: string }

export const VIDEO_MODELS: VideoModel[] = [
  { id: "fal_wan_lite",            name: "Wan Lite",          cost: "$0.025/5s", badge: "BUDGET",   badgeColor: "#22c55e", desc: "Fast draft, animated style" },
  { id: "muapi_wan_v2_1_720p",     name: "Wan 2.1",           cost: "$0.05/5s",  badge: "STANDARD", badgeColor: "#3b82f6", desc: "Balanced quality, 720p" },
  { id: "muapi_seedance_v2",       name: "Seedance 2.0",      cost: "$0.08/5s",  badge: "POPULAR",  badgeColor: "#06b6d4", desc: "Best 2D + cartoon quality" },
  { id: "fal_kling_2_5_standard",  name: "Kling 2.5",         cost: "$0.10/5s",  badge: "QUALITY",  badgeColor: "#a855f7", desc: "Solid 3D and realism, 10s" },
  { id: "fal_kling_2_5_turbo_pro", name: "Kling 2.5 Turbo",   cost: "$0.20/5s",  badge: "PREMIUM",  badgeColor: "#f59e0b", desc: "Premium 3D, fast output" },
  { id: "fal_kling_3_pro",         name: "Kling 3.0 Pro",     cost: "$0.30/5s",  badge: "BEST",     badgeColor: "#ef4444", desc: "Top cinematic quality" },
];

export const IMAGE_MODELS: ImageModel[] = [
  { id: "segmind_flux",            name: "Segmind Flux (Free)", cost: "$0.0003–0.0005/img", badge: "FREE",    badgeColor: "#22c55e", desc: "Free-tier Segmind Flux — fast quality at minimal cost" },
  { id: "ideogram_free",           name: "Ideogram Free",     cost: "$0",        badge: "FREE",     badgeColor: "#06b6d4", desc: "Ideogram free tier — best text rendering at $0" },
  { id: "fal_flux_schnell",        name: "Flux Schnell",      cost: "$0.003",    badge: "FASTEST",  badgeColor: "#22c55e", desc: "Ultra-fast draft images" },
  { id: "fal_flux_dev",            name: "Flux Dev",          cost: "$0.025",    badge: "STANDARD", badgeColor: "#3b82f6", desc: "Good detail, balanced" },
  { id: "fal_ideogram_v3_turbo",   name: "Ideogram v3",       cost: "$0.020",    badge: "TEXT",     badgeColor: "#06b6d4", desc: "Best text rendering" },
  { id: "fal_seedream",            name: "Seedream",          cost: "$0.020",    badge: "POLISHED", badgeColor: "#a855f7", desc: "Polished commercial stills" },
  { id: "fal_flux_pro",            name: "Flux Pro",          cost: "$0.050",    badge: "PREMIUM",  badgeColor: "#f59e0b", desc: "Top photorealism" },
];

// ── Compact single-line selector ──────────────────────────────────────────────

interface ModelPickerProps {
  videoModel: string;
  imageModel: string;
  onVideoChange: (id: string) => void;
  onImageChange: (id: string) => void;
  accentColor?: string;
  compact?: boolean;
}

export default function ModelPicker({ videoModel, imageModel, onVideoChange, onImageChange, accentColor = "#7c5cfc", compact = false }: ModelPickerProps) {
  const [open, setOpen] = useState<"video" | "image" | null>(null);

  const selectedVideo = VIDEO_MODELS.find(m => m.id === videoModel) ?? VIDEO_MODELS[2];
  const selectedImage = IMAGE_MODELS.find(m => m.id === imageModel) ?? IMAGE_MODELS[0];

  const surfBg = "#111118";
  const borderCol = "#2a2a3a";
  const textCol = "#f0f0f8";
  const mutedCol = "#8888aa";

  const dropdownStyle: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
    background: "#1a1a26", border: `1px solid ${borderCol}`,
    borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
      {/* Video model */}
      <div style={{ position: "relative", flex: 1, minWidth: compact ? 140 : 180 }}>
        <button onClick={() => setOpen(open === "video" ? null : "video")} style={{
          width: "100%", padding: compact ? "7px 10px" : "9px 12px",
          background: surfBg, border: `1px solid ${open === "video" ? accentColor : borderCol}`,
          borderRadius: 8, color: textCol, cursor: "pointer", textAlign: "left" as const,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 11, color: mutedCol, flexShrink: 0 }}>🎬</span>
          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {selectedVideo.name}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: selectedVideo.badgeColor, flexShrink: 0 }}>{selectedVideo.badge}</span>
          <span style={{ fontSize: 9, color: mutedCol, flexShrink: 0 }}>▾</span>
        </button>

        {open === "video" && (
          <div style={dropdownStyle}>
            {VIDEO_MODELS.map(m => (
              <button key={m.id} onClick={() => { onVideoChange(m.id); setOpen(null); }} style={{
                width: "100%", padding: "10px 12px", background: m.id === videoModel ? `${accentColor}15` : "transparent",
                border: "none", borderBottom: `1px solid ${borderCol}20`, color: textCol, cursor: "pointer",
                textAlign: "left" as const, display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {m.name}
                    <span style={{ fontSize: 9, fontWeight: 700, color: m.badgeColor, background: `${m.badgeColor}18`, padding: "1px 5px", borderRadius: 4 }}>{m.badge}</span>
                  </div>
                  <div style={{ fontSize: 10, color: mutedCol, marginTop: 2 }}>{m.desc} · {m.cost}</div>
                </div>
                {m.id === videoModel && <span style={{ color: accentColor, fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image model */}
      <div style={{ position: "relative", flex: 1, minWidth: compact ? 140 : 180 }}>
        <button onClick={() => setOpen(open === "image" ? null : "image")} style={{
          width: "100%", padding: compact ? "7px 10px" : "9px 12px",
          background: surfBg, border: `1px solid ${open === "image" ? accentColor : borderCol}`,
          borderRadius: 8, color: textCol, cursor: "pointer", textAlign: "left" as const,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 11, color: mutedCol, flexShrink: 0 }}>🖼</span>
          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {selectedImage.name}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: selectedImage.badgeColor, flexShrink: 0 }}>{selectedImage.badge}</span>
          <span style={{ fontSize: 9, color: mutedCol, flexShrink: 0 }}>▾</span>
        </button>

        {open === "image" && (
          <div style={dropdownStyle}>
            {IMAGE_MODELS.map(m => (
              <button key={m.id} onClick={() => { onImageChange(m.id); setOpen(null); }} style={{
                width: "100%", padding: "10px 12px", background: m.id === imageModel ? `${accentColor}15` : "transparent",
                border: "none", borderBottom: `1px solid ${borderCol}20`, color: textCol, cursor: "pointer",
                textAlign: "left" as const, display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {m.name}
                    <span style={{ fontSize: 9, fontWeight: 700, color: m.badgeColor, background: `${m.badgeColor}18`, padding: "1px 5px", borderRadius: 4 }}>{m.badge}</span>
                  </div>
                  <div style={{ fontSize: 10, color: mutedCol, marginTop: 2 }}>{m.desc} · {m.cost}</div>
                </div>
                {m.id === imageModel && <span style={{ color: accentColor, fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close overlay */}
      {open && <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(null)} />}
    </div>
  );
}
