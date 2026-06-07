"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { ds } from "../../../lib/designSystem";
import { useProjectSettings } from "@/hooks/useProjectSettings";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Scene {
  id:       string;
  title:    string;
  text:     string;
  mood:     string;
  imageUrl?: string;
  videoUrl?: string;
}

interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  scenes?:   Scene[];
  timestamp: number;
}

interface Character {
  id:   string;
  name: string;
  imageUrl?: string | null;
  role?: string | null;
}

interface DailyLimits {
  imageCount:     number;
  videoCount:     number;
  imageLimit:     number;
  videoLimit:     number;
  imageRemaining: number;
  videoRemaining: number;
}

interface IntroOutroData {
  text:  string;
  phone: string;
  type:  "whatsapp" | "call" | "contact";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function genSessionId(): string {
  return "fms_" + genId();
}

// ── Visual style map ───────────────────────────────────────────────────────────
const VISUAL_STYLES: Record<string, { label: string; icon: string; prefix: string }> = {
  realistic:    { label: "Realistic",     icon: "📷", prefix: "photorealistic, real photograph, 8K, professional photography, natural lighting," },
  cinematic:    { label: "Cinematic",     icon: "🎬", prefix: "cinematic film still, professional cinematography, dramatic lighting, movie quality, anamorphic lens," },
  dark_real:    { label: "Dark Cinematic",icon: "🌑", prefix: "dark noir cinematic, dramatic shadows, moody atmosphere, high contrast, film photography," },
  "3d_anim":    { label: "3D Animation",  icon: "🎮", prefix: "high quality 3D animation, Pixar CGI style, smooth rendering, vibrant colors, detailed 3D render," },
  "2d_cartoon": { label: "2D Cartoon",    icon: "🎨", prefix: "2D cartoon animation, colorful flat illustration, animated series style, clean line art," },
  anime:        { label: "Anime",         icon: "⛩️", prefix: "anime style, Japanese animation, detailed anime illustration, vibrant colors, expressive characters," },
  comic:        { label: "Comic Book",    icon: "💥", prefix: "comic book illustration, bold ink lines, graphic novel style, cel shaded, dynamic poses," },
  documentary:  { label: "Documentary",   icon: "🌿", prefix: "documentary photography, natural candid lighting, realistic, journalistic photography style," },
  watercolor:   { label: "Watercolor Art",icon: "🖌️", prefix: "beautiful watercolor painting, soft brush strokes, artistic illustration, painterly style," },
};

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:     ds.color.paper,
  card:   ds.color.card,
  alert:  ds.color.alert,
  line:   ds.color.line,
  ink:    ds.color.ink,
  mute:   ds.color.mute,
  mute2:  ds.color.mute2,
  sky:    ds.color.sky,
  lilac:  ds.color.lilac,
  mint:   ds.color.mint,
  gold:   ds.color.gold,
  pink:   ds.color.pink,
  coral:  ds.color.coral,
};

// ── Scene Card ─────────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  index,
  onEdit,
  onPolish,
  onGenSceneImage,
  onGenSceneVideo,
  generatingImage,
  generatingVideo,
  defaultImageModel,
  defaultImageStyle,
  defaultVideoModel,
  imageRemaining,
  videoRemaining,
}: {
  scene: Scene;
  index: number;
  onEdit: (id: string, field: "title" | "text", value: string) => void;
  onPolish?: (id: string, text: string) => void;
  onGenSceneImage?: (id: string, imgModel: string, imgStyle: string) => void;
  onGenSceneVideo?: (id: string, vidModel: string, duration: number) => void;
  generatingImage?: boolean;
  generatingVideo?: boolean;
  defaultImageModel?: string;
  defaultImageStyle?: string;
  defaultVideoModel?: string;
  imageRemaining?: number;
  videoRemaining?: number;
}) {
  const [polishing,     setPolishing]     = useState(false);
  const [showImgPicker, setShowImgPicker] = useState(false);
  const [showVidPicker, setShowVidPicker] = useState(false);
  const [previewOpen,   setPreviewOpen]   = useState(false);
  const [localImgModel, setLocalImgModel] = useState(defaultImageModel ?? "segmind_flux");
  const [localImgStyle, setLocalImgStyle] = useState(defaultImageStyle ?? "realistic");
  const [localVidModel, setLocalVidModel] = useState(defaultVideoModel ?? "wan_2_5_lite");
  const [localVidDur,   setLocalVidDur]   = useState(5);

  const moodColor: Record<string, string> = {
    tense: C.coral, dramatic: C.pink, calm: C.mint, joyful: C.gold,
    mysterious: C.lilac, romantic: C.pink, neutral: C.mute,
    hopeful: C.sky, sad: C.sky, angry: C.coral, funny: C.gold,
  };
  const mc = moodColor[scene.mood.toLowerCase()] ?? C.sky;

  async function handlePolish() {
    if (!onPolish || polishing) return;
    setPolishing(true);
    try {
      const res = await fetch("/api/hybrid/scene-polish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, currentText: scene.text, action: "polish" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.polishedText) onPolish(scene.id, data.polishedText);
      }
    } catch { /* silent */ }
    setPolishing(false);
  }

  const selStyle: React.CSSProperties = {
    padding: "3px 5px", borderRadius: 6, fontSize: 9, fontWeight: 700,
    border: `1px solid ${C.line}`, background: C.card, color: C.mute2,
    outline: "none", fontFamily: "inherit", cursor: "pointer", width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      borderRadius: 12, background: C.alert, border: `1px solid ${C.line}`,
      overflow: "hidden", marginBottom: 8, animation: "fadeSlideUp 0.3s ease",
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px", borderBottom: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: `${mc}08`, gap: 6, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.mute2, letterSpacing: 1, textTransform: "uppercase" }}>
            Scene {index + 1}
          </span>
          <span style={{
            padding: "1px 6px", borderRadius: 20, fontSize: 9, fontWeight: 700,
            background: `${mc}18`, color: mc, border: `1px solid ${mc}35`, textTransform: "capitalize",
          }}>{scene.mood}</span>
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          {/* Gen Image button */}
          {onGenSceneImage && (
            <button
              onClick={() => { setShowVidPicker(false); setShowImgPicker(v => !v); }}
              style={{
                padding: "3px 9px", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${showImgPicker ? C.gold + "80" : C.gold + "40"}`,
                background: showImgPicker ? `${C.gold}20` : scene.imageUrl ? `${C.gold}12` : "transparent",
                color: (imageRemaining ?? 1) <= 0 ? C.mute2 : C.gold,
                opacity: (imageRemaining ?? 1) <= 0 ? 0.45 : 1,
              }}
              title={(imageRemaining ?? 1) <= 0 ? "Daily image limit reached" : scene.imageUrl ? "Regenerate scene image" : "Generate image for this scene"}
            >
              🖼 {scene.imageUrl ? "Regen" : "Image"} {showImgPicker ? "▲" : "▼"}
            </button>
          )}
          {/* Gen Video button */}
          {onGenSceneVideo && (
            <button
              onClick={() => { setShowImgPicker(false); setShowVidPicker(v => !v); }}
              style={{
                padding: "3px 9px", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${showVidPicker ? C.sky + "80" : C.sky + "40"}`,
                background: showVidPicker ? `${C.sky}20` : "transparent",
                color: (videoRemaining ?? 1) <= 0 ? C.mute2 : C.sky,
                opacity: (videoRemaining ?? 1) <= 0 ? 0.45 : 1,
              }}
              title={(videoRemaining ?? 1) <= 0 ? "Daily video limit reached" : "Generate video for this scene"}
            >
              🎬 Video {showVidPicker ? "▲" : "▼"}
            </button>
          )}
          {/* Polish */}
          {onPolish && (
            <button onClick={handlePolish} disabled={polishing} style={{
              padding: "3px 8px", borderRadius: 6, fontSize: 9, fontWeight: 700,
              border: `1px solid ${C.lilac}40`, background: polishing ? `${C.lilac}10` : "transparent",
              color: C.lilac, cursor: polishing ? "not-allowed" : "pointer",
            }}>
              {polishing ? "…" : "✨"}
            </button>
          )}
        </div>
      </div>

      {/* ── Image picker (inline, expands below header) ── */}
      {showImgPicker && onGenSceneImage && (
        <div style={{
          padding: "10px 12px", borderBottom: `1px solid ${C.line}`,
          background: `${C.gold}06`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.mute2, marginBottom: 3 }}>IMAGE MODEL</div>
            <select value={localImgModel} onChange={e => setLocalImgModel(e.target.value)} style={selStyle}>
              <optgroup label="GHS Standard">
                <option value="segmind_flux">Segmind Flux (Free)</option>
                <option value="fal_flux_schnell">FLUX Schnell</option>
              </optgroup>
              <optgroup label="GHS Pro">
                <option value="fal_flux_dev">FLUX Dev</option>
                <option value="ideogram_free">Ideogram</option>
              </optgroup>
              <optgroup label="GHS Premium">
                <option value="stable_diffusion_xl">SD XL</option>
                <option value="ideogram_v2">Ideogram V2</option>
              </optgroup>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.mute2, marginBottom: 3 }}>VISUAL STYLE</div>
            <select value={localImgStyle} onChange={e => setLocalImgStyle(e.target.value)} style={selStyle}>
              {Object.entries(VISUAL_STYLES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                if ((imageRemaining ?? 0) <= 0) return;
                onGenSceneImage(scene.id, localImgModel, localImgStyle);
                setShowImgPicker(false);
              }}
              disabled={generatingImage || (imageRemaining ?? 0) <= 0}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: "pointer",
                border: "none",
                background: generatingImage || (imageRemaining ?? 0) <= 0
                  ? C.mute + "40"
                  : `linear-gradient(135deg, ${C.gold}, ${C.coral})`,
                color: generatingImage || (imageRemaining ?? 0) <= 0 ? C.mute2 : "#fff",
              }}
            >
              {generatingImage ? "Generating…" : (imageRemaining ?? 0) <= 0 ? "Limit reached" : "Generate Image"}
            </button>
            <button onClick={() => setShowImgPicker(false)} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 10, cursor: "pointer",
              border: `1px solid ${C.line}`, background: "transparent", color: C.mute2,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Video picker (inline) ── */}
      {showVidPicker && onGenSceneVideo && (
        <div style={{
          padding: "10px 12px", borderBottom: `1px solid ${C.line}`,
          background: `${C.sky}06`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.mute2, marginBottom: 3 }}>VIDEO MODEL</div>
            <select value={localVidModel} onChange={e => setLocalVidModel(e.target.value)} style={selStyle}>
              <optgroup label="GHS Standard">
                <option value="wan_2_5_lite">Wan Lite (Free)</option>
              </optgroup>
              <optgroup label="GHS Pro">
                <option value="muapi_wan_v2_1_720p">Wan Pro 720p</option>
                <option value="kling_v2_5_standard">Kling Standard</option>
                <option value="hailuo_fast">Hailuo Fast</option>
              </optgroup>
              <optgroup label="GHS Premium">
                <option value="kling_v2_5_pro">Kling Pro</option>
                <option value="runway_gen4">Runway Gen-4</option>
              </optgroup>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: C.mute2, marginBottom: 3 }}>DURATION</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[5, 8, 10, 15].map(v => (
                <button key={v} onClick={() => setLocalVidDur(v)} style={{
                  flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${localVidDur === v ? C.sky + "70" : C.line}`,
                  background: localVidDur === v ? `${C.sky}18` : "transparent",
                  color: localVidDur === v ? C.sky : C.mute2,
                }}>{v}s</button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                if ((videoRemaining ?? 0) <= 0) return;
                onGenSceneVideo(scene.id, localVidModel, localVidDur);
                setShowVidPicker(false);
              }}
              disabled={generatingVideo || (videoRemaining ?? 0) <= 0}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: "pointer",
                border: "none",
                background: generatingVideo || (videoRemaining ?? 0) <= 0
                  ? C.mute + "40"
                  : `linear-gradient(135deg, ${C.sky}, ${C.mint})`,
                color: generatingVideo || (videoRemaining ?? 0) <= 0 ? C.mute2 : "#fff",
              }}
            >
              {generatingVideo ? "Generating…" : (videoRemaining ?? 0) <= 0 ? "Limit reached" : "Generate Video"}
            </button>
            <button onClick={() => setShowVidPicker(false)} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 10, cursor: "pointer",
              border: `1px solid ${C.line}`, background: "transparent", color: C.mute2,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Scene image preview — click to open lightbox */}
      {scene.imageUrl && (
        <div style={{ position: "relative", background: "#000" }}>
          <img
            src={scene.imageUrl}
            alt={`Scene ${index + 1}`}
            onClick={() => setPreviewOpen(true)}
            title="Click to preview full size"
            style={{
              width: "100%", maxHeight: 320, objectFit: "contain",
              display: "block", cursor: "zoom-in", background: "#000",
            }}
          />
          <span style={{
            position: "absolute", bottom: 6, left: 8, fontSize: 9, fontWeight: 800,
            color: "#fff", background: "rgba(0,0,0,0.55)", padding: "2px 6px", borderRadius: 4,
          }}>S{index + 1}</span>
          <button
            onClick={() => setPreviewOpen(true)}
            title="Open full preview"
            style={{
              position: "absolute", top: 6, right: 6, width: 26, height: 26,
              borderRadius: 6, border: "none", cursor: "pointer",
              background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >⤢</button>
        </div>
      )}

      {/* Lightbox preview */}
      {previewOpen && scene.imageUrl && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)", display: "flex",
            alignItems: "center", justifyContent: "center",
            padding: 24, cursor: "zoom-out",
            animation: "fadeSlideUp 0.15s ease-out",
          }}
        >
          <img
            src={scene.imageUrl}
            alt={`Scene ${index + 1} full preview`}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
              borderRadius: 8, boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              cursor: "default",
            }}
          />
          <button
            onClick={e => { e.stopPropagation(); setPreviewOpen(false); }}
            style={{
              position: "absolute", top: 18, right: 18, width: 36, height: 36,
              borderRadius: 8, border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Close (Esc)"
          >×</button>
          <div style={{
            position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center",
            color: "#fff", fontSize: 12, fontWeight: 600, opacity: 0.85,
          }}>
            Scene {index + 1} · {scene.title} · click anywhere to close
          </div>
        </div>
      )}

      {/* Scene video preview */}
      {scene.videoUrl && (
        <div style={{ padding: "6px 12px 0" }}>
          <video
            src={scene.videoUrl}
            controls
            style={{ width: "100%", borderRadius: 8, maxHeight: 180 }}
          />
        </div>
      )}

      {/* Generating placeholders */}
      {generatingImage && !scene.imageUrl && (
        <div style={{
          height: 70, background: `${C.gold}08`, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 11, color: C.gold,
        }}>⟳ Generating image…</div>
      )}
      {generatingVideo && (
        <div style={{
          height: 70, background: `${C.sky}08`, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 11, color: C.sky,
        }}>⟳ Generating video…</div>
      )}

      {/* Text body */}
      <div style={{ padding: "10px 14px" }}>
        <input
          value={scene.title}
          onChange={e => onEdit(scene.id, "title", e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box", background: "transparent", border: "none",
            color: C.ink, fontSize: 12, fontWeight: 700, outline: "none", marginBottom: 6,
            padding: 0, fontFamily: "inherit",
          }}
          placeholder="Scene title…"
        />
        <textarea
          value={scene.text}
          onChange={e => onEdit(scene.id, "text", e.target.value)}
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box", background: "transparent", border: "none",
            color: C.ink, fontSize: 13, lineHeight: 1.65, outline: "none", resize: "none",
            padding: 0, fontFamily: "inherit",
          }}
          placeholder="Scene description…"
        />
      </div>
    </div>
  );
}

// ── Action Buttons (4 buttons) ─────────────────────────────────────────────────

function ActionButtons({
  scenes,
  onGenImage,
  onGenVideo,
  onGenHybrid,
  onEditMode,
  editMode,
  limits,
}: {
  scenes: Scene[];
  onGenImage: () => void;
  onGenVideo: () => void;
  onGenHybrid: () => void;
  onEditMode: () => void;
  editMode: boolean;
  limits: DailyLimits;
}) {
  return (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12,
      padding: "10px 14px",
      borderTop: `1px solid ${C.line}`,
    }}>
      <button onClick={onEditMode} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
        border: `1px solid ${editMode ? C.sky + "60" : C.line}`,
        background: editMode ? `${C.sky}15` : "transparent",
        color: editMode ? C.sky : C.mute, cursor: "pointer",
        transition: "all 0.15s",
      }}>
        ✏️ {editMode ? "Re-send to AI" : "Edit Scene/Movie"}
      </button>
      <button
        onClick={onGenImage}
        disabled={limits.imageRemaining <= 0}
        title={limits.imageRemaining <= 0 ? `Daily image limit reached (${limits.imageLimit}/day)` : `${limits.imageRemaining} images left today`}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          border: `1px solid ${limits.imageRemaining <= 0 ? C.mute2 + "40" : C.lilac + "60"}`,
          background: limits.imageRemaining <= 0 ? "transparent" : `${C.lilac}15`,
          color: limits.imageRemaining <= 0 ? C.mute2 : C.lilac,
          cursor: limits.imageRemaining <= 0 ? "not-allowed" : "pointer",
          opacity: limits.imageRemaining <= 0 ? 0.5 : 1,
          transition: "all 0.15s",
        }}>
        🖼️ Gen Image
      </button>
      <button
        onClick={onGenVideo}
        disabled={limits.videoRemaining <= 0}
        title={limits.videoRemaining <= 0 ? `Daily video limit reached (${limits.videoLimit}/day)` : `${limits.videoRemaining} videos left today`}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          border: `1px solid ${limits.videoRemaining <= 0 ? C.mute2 + "40" : C.gold + "60"}`,
          background: limits.videoRemaining <= 0 ? "transparent" : `${C.gold}15`,
          color: limits.videoRemaining <= 0 ? C.mute2 : C.gold,
          cursor: limits.videoRemaining <= 0 ? "not-allowed" : "pointer",
          opacity: limits.videoRemaining <= 0 ? 0.5 : 1,
          transition: "all 0.15s",
        }}>
        🎬 Generate Movie
      </button>
      <button onClick={onGenHybrid} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
        border: `1px solid ${C.mint + "60"}`,
        background: `${C.mint}15`, color: C.mint, cursor: "pointer",
        transition: "all 0.15s",
      }}>
        🔀 Generate Hybrid
      </button>
    </div>
  );
}

// ── Video Confirm Modal ────────────────────────────────────────────────────────

function VideoConfirmModal({
  onConfirm,
  onCancel,
  generating,
}: {
  onConfirm: (duration: number) => void;
  onCancel: () => void;
  generating: boolean;
}) {
  const [duration, setDuration] = useState(5);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, borderRadius: 18,
        background: C.card, border: `1px solid ${C.line}`,
        padding: 24,
        animation: "fadeSlideUp 0.2s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 6 }}>
          Generate Movie Clip
        </div>
        <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.6, marginBottom: 20, margin: "0 0 16px" }}>
          AI will generate a short video clip for each scene.
          Set the total duration below.
        </p>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.mute2, display: "block", marginBottom: 6 }}>
          Duration per scene (seconds)
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[3, 5, 8, 10].map(v => (
            <button key={v} onClick={() => setDuration(v)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: `1px solid ${duration === v ? C.gold + "60" : C.line}`,
              background: duration === v ? `${C.gold}18` : "transparent",
              color: duration === v ? C.gold : C.mute, cursor: "pointer",
            }}>{v}s</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: `1px solid ${C.line}`, background: "transparent",
            color: C.mute, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => onConfirm(duration)} disabled={generating} style={{
            flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
            background: generating ? C.alert
              : `linear-gradient(135deg, ${C.gold}, ${C.coral})`,
            color: generating ? C.mute : "#fff",
            fontSize: 13, fontWeight: 800, cursor: generating ? "not-allowed" : "pointer",
          }}>
            {generating ? "Generating…" : `Confirm: generate ${duration}s video`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hybrid Progress Modal ──────────────────────────────────────────────────────

type SubtitleStyleKey = "classic" | "cinema" | "neon" | "minimal" | "bold" | "none";

// ─────────────────────────────────────────────────────────────────────────────
// Movie-mode auto-classifier — picks the best generation "vibe" from the user's
// scenes + cast so Free Mode produces output that fits the content WITHOUT a
// manual mode-picker step (Henry 2026-06-07: "FREE MODE MUST SLECT BEST MODE
// FIT FOR THE MOVIE").
//
// Strategy: simple keyword tally. We score each candidate mode by how many of
// its trigger words appear in the combined scene + character text, then pick
// the highest score. Ties + zero-score both fall back to "cinematic" — the
// safest default for an unknown prompt.
//
// Returned mode drives:
//   - narration speed   (children = slower / clearer)
//   - music prompt      (children = playful, action = upbeat, etc.)
//   - shot variations   (children = friendlier framings)
//
// Adding a new mode = one entry in MODE_RULES. No other call site changes.
// ─────────────────────────────────────────────────────────────────────────────
type FreeModeKind = "children" | "music_video" | "commercial" | "action" | "documentary" | "cinematic";

interface FreeModeProfile {
  /** Narration playback speed sent to /api/tts. 1.0 = normal. */
  narrationSpeed: number;
  /** Music prompt template — string-replaces the generic Hybrid prompt. */
  musicPromptTemplate: (sceneMoods: string) => string;
  /** Per-shot-variation strings used when generating the 4 images per scene. */
  shotVariations: string[];
  /** Human-readable label shown in the UI banner. */
  label: string;
}

const MODE_RULES: Record<FreeModeKind, { triggers: string[]; profile: FreeModeProfile }> = {
  children: {
    triggers: ["kid", "kids", "child", "children", "baby", "toddler", "preschool", "abc", "alphabet", "counting", "lullaby", "bedtime", "nursery", "rhyme", "playful", "cartoon"],
    profile: {
      narrationSpeed: 0.9, // slower so young listeners can follow
      musicPromptTemplate: (moods) => `Gentle children's storybook background music. Soft solo piano with delicate music box and warm light strings. Cheerful instrumental, no vocals, no heavy drums. Mood cues: ${moods}.`,
      shotVariations: [
        "wide friendly establishing shot, soft lighting, warm colours",
        "medium shot at child eye level, inviting expressions",
        "close-up of expressive faces, gentle smiles",
        "playful low angle, dynamic but safe composition",
      ],
      label: "Children",
    },
  },
  music_video: {
    triggers: ["song", "music", "dance", "beat", "rhythm", "sing", "singer", "lyrics", "hip-hop", "rap", "pop", "rock", "concert", "stage", "performance"],
    profile: {
      narrationSpeed: 1.0,
      musicPromptTemplate: (moods) => `Driving music-video instrumental backing track. Modern beat, strong rhythm section, dynamic energy. Mood cues: ${moods}.`,
      shotVariations: [
        "wide stage shot, dramatic lighting, audience silhouettes",
        "medium tracking shot following motion, shallow depth of field",
        "tight close-up syncing to the beat",
        "low angle hero shot, cinematic colour grade",
      ],
      label: "Music Video",
    },
  },
  commercial: {
    triggers: ["brand", "product", "buy", "sale", "deal", "advertise", "promo", "promotion", "launch", "campaign", "discount", "offer", "store", "shop"],
    profile: {
      narrationSpeed: 1.0,
      musicPromptTemplate: (moods) => `Upbeat commercial background music. Bright energetic instrumental, hooks listener fast, broadcast-ready. Mood cues: ${moods}.`,
      shotVariations: [
        "clean product hero shot, white-light backdrop",
        "medium lifestyle shot of the product in use",
        "close-up of product detail, premium feel",
        "wide aspirational scene, cinematic colour",
      ],
      label: "Commercial",
    },
  },
  action: {
    triggers: ["fight", "chase", "battle", "war", "explosion", "attack", "weapon", "soldier", "warrior", "hero", "villain", "escape", "pursuit", "stunt"],
    profile: {
      narrationSpeed: 1.0,
      musicPromptTemplate: (moods) => `Tense action movie score. Hybrid orchestral + electronic percussion, builds intensity, cinematic. Mood cues: ${moods}.`,
      shotVariations: [
        "wide establishing shot, high contrast lighting",
        "medium tracking shot of the action, shallow DOF",
        "tight close-up of intense expressions",
        "low angle dramatic hero shot, dynamic composition",
      ],
      label: "Action",
    },
  },
  documentary: {
    triggers: ["real", "true", "history", "historical", "documentary", "news", "report", "interview", "fact", "evidence", "investigation", "journalist"],
    profile: {
      narrationSpeed: 0.95,
      musicPromptTemplate: (moods) => `Subtle documentary background score. Restrained orchestral pads with light percussion, supports narration without overpowering. Mood cues: ${moods}.`,
      shotVariations: [
        "wide establishing shot, natural lighting, documentary realism",
        "medium interview-style framing, neutral background",
        "close-up of meaningful detail, archive feel",
        "observational handheld angle, intimate perspective",
      ],
      label: "Documentary",
    },
  },
  cinematic: {
    triggers: [], // safe default — no triggers needed
    profile: {
      narrationSpeed: 1.0,
      musicPromptTemplate: (moods) => `Cinematic instrumental background music for scenes: ${moods}. Rich, dynamic, supports the story.`,
      shotVariations: [
        "wide establishing shot, cinematic framing",
        "medium shot, eye-level perspective",
        "close-up detail, soft depth of field",
        "low angle dramatic shot, dynamic composition",
      ],
      label: "Cinematic",
    },
  },
};

/**
 * Decide which mode the prompt belongs to by counting keyword hits in the
 * combined scene + character text. Highest scorer wins; ties + zero-score
 * → "cinematic" (the safest default for unknown content).
 */
function classifyFreeModeKind(scenes: Scene[], characters?: Character[]): { kind: FreeModeKind; profile: FreeModeProfile } {
  const haystack = (
    scenes.map(s => `${s.title} ${s.text} ${s.mood ?? ""}`).join(" ") + " " +
    (characters?.map(c => c.name).join(" ") ?? "")
  ).toLowerCase();

  let bestKind: FreeModeKind = "cinematic";
  let bestScore = 0;
  (Object.keys(MODE_RULES) as FreeModeKind[]).forEach(kind => {
    const score = MODE_RULES[kind].triggers.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestKind = kind; }
  });

  return { kind: bestKind, profile: MODE_RULES[bestKind].profile };
}

function HybridModal({
  scenes,
  onClose,
  onComplete,
  characters,
  imageModel,
  imageStyle,
  initMusicTier,
  initSfxSource,
  initVoiceProvider,
  initSubtitleStyle,
}: {
  scenes: Scene[];
  onClose: () => void;
  onComplete?: (resultUrl: string, scenes: Scene[]) => void;
  characters?: Character[];
  imageModel?: string;
  imageStyle?: string;
  initMusicTier?: string;
  initSfxSource?: string;
  initVoiceProvider?: string;
  initSubtitleStyle?: SubtitleStyleKey;
}) {
  const [totalDuration,  setTotalDuration]  = useState(30);
  const [customDur,      setCustomDur]      = useState("");
  const [musicTier,      setMusicTier]      = useState(initMusicTier ?? "stock");
  const [sfxSource,      setSfxSource]      = useState(initSfxSource ?? "auto");
  const [voiceProvider,  setVoiceProvider]  = useState(initVoiceProvider ?? "piper");
  const [subtitleStyle,  setSubtitleStyle]  = useState<SubtitleStyleKey>(initSubtitleStyle ?? "classic");
  const [steps, setSteps] = useState<{ label: string; status: "pending" | "running" | "done" | "error" }[]>([]);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  // Henry 2026-06-07: auto-mode-select banner. Populated by classifyFreeModeKind()
  // at the start of runHybrid() so the user sees which "vibe" Free Mode picked
  // (Children / Action / Music Video / Commercial / Documentary / Cinematic).
  const [selectedModeLabel, setSelectedModeLabel] = useState<string | null>(null);
  // Henry 2026-06-07 (Free Mode 360s test): a long video (1 scene × 360s) showed
  // only ONE image + no subtitle because we hard-capped MAX_IMAGES_PER_SCENE = 4.
  // Now the user picks "seconds per image" (1s or 2s) and we generate
  // sceneDuration / secondsPerImage images per scene. The free image model
  // (Segmind Flux at $0.0004) makes 30+ images per scene affordable —
  // Henry: "ALL FREE MONEY MUST GENERTTAE A LOT OFR IMAGES BY SHORT SCENE".
  const [secondsPerImage, setSecondsPerImage] = useState<1 | 2>(2);

  const effectiveDuration = customDur
    ? Math.max(5, Math.min(600, parseInt(customDur) || totalDuration))
    : totalDuration;

  const selStyle: React.CSSProperties = {
    width: "100%", padding: "5px 7px", borderRadius: 7, fontSize: 11, fontWeight: 600,
    border: `1px solid ${C.line}`, background: C.alert, color: C.ink,
    outline: "none", fontFamily: "inherit", cursor: "pointer",
  };

  async function runHybrid() {
    setRunning(true);
    setError(null);
    // Henry 2026-06-07 fix: Free Mode Hybrid was shipping silent video (no TTS
    // call) AND only 1 image per scene. New pipeline:
    //   - Generate up to MAX_IMAGES_PER_SCENE per scene (4), in-built, no user
    //     toggle (so output looks rich without a config click).
    //   - Generate narration via Piper (FORCED — Henry: "JUST PIPER" in Free Mode).
    //   - Pass narrationUrl + musicUrl in the assembly payload so the final mp4
    //     has both narrator voice and background music.
    const pipeline = [
      "Calculate scene timings",
      `Generate scene images (~${secondsPerImage}s each)`,
      "Generate narration (Piper)",
      "Generate background music",
      "Assemble final video",
    ];
    setSteps(pipeline.map(label => ({ label, status: "pending" })));

    // Henry 2026-06-07 update: image-count is no longer fixed at 4. User picks
    // 1s or 2s per image and we generate ceil(sceneDuration / secondsPerImage)
    // images per scene. A 60s scene at 2s/image = 30 images; at 1s/image = 60.
    //
    // Cap at 60 images per scene as a safety rail so a runaway 600s scene at
    // 1s/image doesn't kick off 600 parallel calls. 60 is enough for any
    // reasonable scene length and keeps the worst-case cost predictable.
    const sceneDuration = effectiveDuration / scenes.length;
    const IMAGES_PER_SCENE_CAP = 60;
    const imagesPerScene = Math.max(1, Math.min(IMAGES_PER_SCENE_CAP, Math.ceil(sceneDuration / secondsPerImage)));
    const charContext = characters?.map(c => `${c.name}${c.imageUrl ? " [has portrait]" : ""}`).join(", ") ?? "";
    const stylePrefix = imageStyle ? (VISUAL_STYLES[imageStyle]?.prefix ?? "") : VISUAL_STYLES["realistic"].prefix;

    // Henry 2026-06-07: pick the best mode for this prompt up-front so narration
    // / music / shot framing all align to one consistent vibe instead of being
    // generic. setSelectedModeLabel() drives the UI banner so the user sees
    // which mode was chosen and can override later if needed.
    const { kind: selectedKind, profile: modeProfile } = classifyFreeModeKind(scenes, characters);
    setSelectedModeLabel(modeProfile.label);
    console.info(`[hybrid] auto-selected mode: ${selectedKind} (${modeProfile.label})`);

    try {
      // Step 1: timings
      setSteps(s => s.map((x, i) => i === 0 ? { ...x, status: "running" } : x));
      await new Promise(r => setTimeout(r, 400));
      setSteps(s => s.map((x, i) => i === 0 ? { ...x, status: "done" } : x));

      // Step 2: generate fresh images for ALL scenes
      setSteps(s => s.map((x, i) => i === 1 ? { ...x, status: "running" } : x));
      // assemblyScenes uses "img:<url>" prefix so the assemble route renders them as Ken Burns image slides
      const assemblyScenes: Array<{ scene: number; videoUrl: string; duration: number; text: string; animation: string }> = [];

      const sceneFailures: string[] = [];
      // Henry 2026-06-07: per-mode shot variations so a "children" project gets
      // friendlier framing and an "action" project gets dramatic angles. Comes
      // from the mode classifier above instead of being a single hard-coded
      // list — keeps the four images per scene visually distinct AND tonally
      // matched to the content.
      const SHOT_VARIATIONS = modeProfile.shotVariations;

      for (let idx = 0; idx < scenes.length; idx++) {
        const sc = scenes[idx];
        const basePrompt = charContext
          ? `${stylePrefix} ${charContext}. ${sc.text}`
          : `${stylePrefix} ${sc.text}`;

        // Generate imagesPerScene images in parallel. Each one becomes its own
        // slide so the final video shows many visual beats per scene. We cycle
        // through the 4 SHOT_VARIATIONS (variation index = i % 4) so the
        // imagery stays visually diverse even on a 30-image / 60-second scene.
        // Henry 2026-06-07: long videos at 1-2s/image now produce a real
        // photo gallery instead of a single still.
        const imageRequests = Array.from({ length: imagesPerScene }, (_, vIdx) => SHOT_VARIATIONS[vIdx % SHOT_VARIATIONS.length]).map(async (variation, vIdx) => {
          const prompt = `${basePrompt} (${variation})`;
          try {
            const imgRes = await fetch("/api/generation/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                modelId: imageModel || "segmind_flux",
                width: 832, height: 1472,
              }),
            });
            if (!imgRes.ok) {
              const errBody = await imgRes.json().catch(() => ({}));
              const reason = errBody?.error ?? `HTTP ${imgRes.status}`;
              console.error(`[hybrid] scene ${idx + 1} image ${vIdx + 1} gen failed:`, reason);
              return null;
            }
            const imgData = await imgRes.json();
            // For assembly we want a path the SERVER can read directly:
            //   - if imagePath (absolute) → pass it raw, assemble's resolveMediaPath
            //     accepts absolute paths via fs.existsSync.
            //   - else if imageUrl (remote http/https) → assemble downloads it.
            const assembleUrl: string = imgData.imagePath ?? imgData.imageUrl ?? "";
            return assembleUrl || null;
          } catch (e) {
            console.error(`[hybrid] scene ${idx + 1} image ${vIdx + 1} exception:`, e);
            return null;
          }
        });

        const imageResults = (await Promise.all(imageRequests)).filter((u): u is string => !!u);

        if (imageResults.length === 0) {
          // Every image attempt failed — fall back to gradient slide so the
          // pipeline never silently drops a scene.
          sceneFailures.push(`S${idx + 1}: all ${imagesPerScene} images failed`);
          assemblyScenes.push({
            scene: idx,
            videoUrl: "bg:#1a1a2e",
            duration: sceneDuration,
            text: sc.title,
            animation: "fade_in",
          });
        } else {
          // Split the scene's airtime evenly across the images we got.
          const perImageDuration = sceneDuration / imageResults.length;
          imageResults.forEach((url, slideIdx) => {
            assemblyScenes.push({
              // Use a unique scene index per slide so assemble's parallel
              // processing doesn't collide on the temp filename
              // `scene_img_${scene}.ext` (one slide per scene number). We
              // multiply by IMAGES_PER_SCENE_CAP (not imagesPerScene) so the
              // index space is stable across scenes of different lengths.
              scene: idx * IMAGES_PER_SCENE_CAP + slideIdx,
              videoUrl: `img:${url}`,
              duration: perImageDuration,
              // Henry 2026-06-07 fix: scene title now shows on EVERY slide so
              // the subtitle persists for the whole scene, not just the first
              // ~2 seconds. Previously the long video showed a title for the
              // first image then went visually silent for the rest of the
              // scene.
              text: sc.title,
              animation: "fade_in",
            });
          });
        }
      }

      if (assemblyScenes.length === 0) throw new Error("No scenes to assemble");
      if (sceneFailures.length > 0 && sceneFailures.length === scenes.length) {
        throw new Error(`All scene images failed — ${sceneFailures[0]}`);
      }
      setSteps(s => s.map((x, i) => i === 1 ? { ...x, status: "done" } : x));

      // ── Step 3: narration (Piper) ────────────────────────────────────────
      // Henry 2026-06-07: Free Mode's Hybrid path was shipping silent video
      // because this step was missing entirely (the pipeline jumped from images
      // → music → assemble). New behavior:
      //   - Stitch every scene's title + text into one narration script.
      //   - Hit /api/tts with provider: "piper" (FORCED — Henry's spec
      //     "HYBRID IN FREE MODE DONT OF EDGE TTS JUST PIPER"). The UI selector
      //     is intentionally bypassed for the Free Mode → Hybrid route so the
      //     output is consistent.
      //   - Best-effort. If TTS fails, we still ship a silent assembly rather
      //     than throwing, because music + visuals are usable on their own.
      setSteps(s => s.map((x, i) => i === 2 ? { ...x, status: "running" } : x));
      let narrationUrl: string | null = null;
      try {
        const narrationText = scenes
          .map(s => `${s.title}. ${s.text}`)
          .filter(t => t.replace(/\s+/g, "").length > 0)
          .join(" ");
        if (narrationText.trim().length > 0) {
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: narrationText.slice(0, 30000),
              provider: "piper",                // FORCED per Henry — never Edge-TTS in Free Mode Hybrid.
              // Per-mode narration speed: children = slower so young listeners
              // can follow; documentary = slightly slower for clarity; others
              // = 1.0. Drives whatever pacing the Piper engine respects.
              speed: modeProfile.narrationSpeed,
            }),
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json() as { audioUrl?: string; engine?: string };
            if (ttsData.engine === "placeholder") {
              console.warn("[hybrid] TTS returned placeholder — server has no usable Piper. Video will ship silent.");
            } else if (ttsData.audioUrl) {
              narrationUrl = ttsData.audioUrl;
            }
          } else {
            const errBody = await ttsRes.json().catch(() => ({}));
            console.warn("[hybrid] narration TTS failed:", errBody?.error ?? `HTTP ${ttsRes.status}`);
          }
        }
      } catch (e) {
        console.warn("[hybrid] narration TTS exception:", e);
      }
      setSteps(s => s.map((x, i) => i === 2 ? { ...x, status: "done" } : x));

      // Step 4: generate background music
      setSteps(s => s.map((x, i) => i === 3 ? { ...x, status: "running" } : x));
      let musicUrl: string | null = null;
      try {
        const sceneMoodSummary = scenes.map(s => s.mood).join(", ");
        // Henry 2026-06-07: per-mode music prompt — children get gentle piano,
        // action gets hybrid orchestral, etc. Picked up-front by the classifier
        // so the bed track fits the content instead of being a generic
        // "Cinematic, instrumental" string for every project.
        const musicPrompt = modeProfile.musicPromptTemplate(sceneMoodSummary);
        const providerKey: "stable_audio" | "kie" | "stock" | "auto" =
          musicTier === "fal_stable_audio" ? "stable_audio"
          : musicTier === "kie_classic" || musicTier === "kie_premium" ? "kie"
          : musicTier === "stock" ? "stock"
          : "auto";
        const musicRes = await fetch("/api/music/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: musicPrompt,
            durationSeconds: Math.min(Math.max(effectiveDuration, 5), 600),
            providerKey,
          }),
        });
        if (musicRes.ok) {
          const musicData = await musicRes.json();
          musicUrl = musicData.audioUrl ?? musicData.url ?? musicData.outputUrl ?? null;
        } else {
          const errBody = await musicRes.json().catch(() => ({}));
          console.warn("[hybrid] music gen failed:", errBody?.error ?? `HTTP ${musicRes.status}`);
        }
      } catch (e) {
        console.warn("[hybrid] music gen exception:", e);
      }
      setSteps(s => s.map((x, i) => i === 3 ? { ...x, status: "done" } : x));

      // Step 5: assemble — img: prefixed scenes + narrationUrl + musicUrl.
      // Henry 2026-06-07 fix: narrationUrl was never being passed (Free Mode
      // skipped TTS entirely), so the output mp4 had no spoken track. Now both
      // narration (foreground voice) and music (background bed) ride along.
      setSteps(s => s.map((x, i) => i === 4 ? { ...x, status: "running" } : x));
      const payload: Record<string, unknown> = {
        scenes:        assemblyScenes,
        projectId:     `free_${Date.now()}`,
        aspectRatio:   "9:16",
        subtitleStyle,
      };
      if (narrationUrl) payload.narrationUrl = narrationUrl;
      if (musicUrl) payload.musicUrl = musicUrl;

      const res = await fetch("/api/video/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        console.error("[hybrid] assemble failed:", res.status, d);
        throw new Error(d.error ?? `Assembly failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      setSteps(s => s.map((x, i) => i === 4 ? { ...x, status: "done" } : x));
      const finalUrl: string | null = data.outputUrl ?? data.videoUrl ?? null;
      if (!finalUrl) {
        console.error("[hybrid] assemble returned no outputUrl:", data);
        throw new Error("Assembly succeeded but no output URL was returned");
      }
      setResultUrl(finalUrl);
      setDone(true);
      if (onComplete) onComplete(finalUrl, scenes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly failed");
      setSteps(s => s.map(x => x.status === "running" ? { ...x, status: "error" } : x));
    }

    setRunning(false);
  }

  const statusColor = { pending: C.mute2, running: C.sky, done: C.mint, error: C.coral };
  const statusIcon  = { pending: "○", running: "⟳", done: "✓", error: "✕" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 500, borderRadius: 18,
        background: C.card, border: `1px solid ${C.line}`,
        padding: 24, maxHeight: "90vh", overflowY: "auto",
        animation: "fadeSlideUp 0.2s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 4 }}>
          🔀 Generate Hybrid Video
        </div>
        <p style={{ fontSize: 12, color: C.mute, margin: "0 0 16px", lineHeight: 1.6 }}>
          Generates fresh images for all {scenes.length} scene{scenes.length !== 1 ? "s" : ""}, adds sound, assembles one video.
          {characters && characters.length > 0 && (
            <span style={{ color: C.lilac }}> {characters.length} character{characters.length > 1 ? "s" : ""} included.</span>
          )}
        </p>

        {!running && !done && (
          <>
            {/* ── Duration ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute2, marginBottom: 6 }}>TOTAL VIDEO LENGTH</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[15, 30, 60, 90].map(v => (
                  <button key={v} onClick={() => { setTotalDuration(v); setCustomDur(""); }} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${effectiveDuration === v && !customDur ? C.mint + "60" : C.line}`,
                    background: effectiveDuration === v && !customDur ? `${C.mint}18` : "transparent",
                    color: effectiveDuration === v && !customDur ? C.mint : C.mute, cursor: "pointer",
                  }}>{v}s</button>
                ))}
                <input
                  value={customDur}
                  onChange={e => setCustomDur(e.target.value.replace(/\D/g, ""))}
                  placeholder="sec"
                  style={{
                    width: 48, padding: "6px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${customDur ? C.mint + "60" : C.line}`,
                    background: customDur ? `${C.mint}18` : "transparent",
                    color: customDur ? C.mint : C.mute, outline: "none",
                    fontFamily: "inherit", textAlign: "center",
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: C.mute2, marginTop: 4 }}>
                {scenes.length} scenes × ~{Math.round(effectiveDuration / scenes.length)}s each
              </div>
            </div>

            {/* ── Images-per-second picker — Henry 2026-06-07.
                  Drives how many images are generated per scene:
                    imagesPerScene = ceil(sceneDuration / secondsPerImage), capped at 60.
                  1s/image = denser photo gallery, slower gen, more API calls.
                  2s/image = balanced default, half as many images.
                  Free model (Segmind Flux $0.0004) keeps even 60-image scenes cheap. ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute2, marginBottom: 6 }}>SECONDS PER IMAGE</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {([1, 2] as const).map(v => (
                  <button key={v} onClick={() => setSecondsPerImage(v)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${secondsPerImage === v ? C.lilac + "60" : C.line}`,
                    background: secondsPerImage === v ? `${C.lilac}18` : "transparent",
                    color: secondsPerImage === v ? C.lilac : C.mute, cursor: "pointer",
                  }}>{v}s / image</button>
                ))}
                <span style={{ fontSize: 10, color: C.mute2, marginLeft: 10 }}>
                  ≈ {Math.max(1, Math.min(60, Math.ceil((effectiveDuration / Math.max(1, scenes.length)) / secondsPerImage)))} images per scene
                </span>
              </div>
            </div>

            {/* ── Audio / SFX / Music controls ── */}
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: C.alert, border: `1px solid ${C.line}`,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.mute2, marginBottom: 10, letterSpacing: 0.6 }}>
                AUDIO &amp; SUBTITLE SETTINGS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>🎵 MUSIC</div>
                  <select value={musicTier} onChange={e => setMusicTier(e.target.value)} style={selStyle}>
                    <optgroup label="GHS Standard">
                      <option value="stock">Stock (Free)</option>
                    </optgroup>
                    <optgroup label="GHS Pro">
                      <option value="fal_stable_audio">FAL Stable Audio</option>
                    </optgroup>
                    <optgroup label="GHS Karaoke">
                      <option value="ghs_karaoke">GHS Karaoke</option>
                    </optgroup>
                    <optgroup label="GHS Classic">
                      <option value="kie_classic">Kie.ai / Suno</option>
                    </optgroup>
                    <optgroup label="GHS Premium">
                      <option value="kie_premium">Kie Premium</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>🔊 SFX</div>
                  <select value={sfxSource} onChange={e => setSfxSource(e.target.value)} style={selStyle}>
                    <optgroup label="GHS Standard">
                      <option value="auto">Auto Match</option>
                      <option value="local">Local Library</option>
                    </optgroup>
                    <optgroup label="GHS Pro">
                      <option value="elevenlabs">ElevenLabs SFX</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>🎙 VOICE</div>
                  {/* Henry 2026-06-05: scene-card voice picker was 3-option (Piper / FAL /
                      EL) — didn't show the new GHS Standard+ (Edge-TTS Nigerian Neural),
                      GHS Premium (Gemini Flash), or sub-models. Mirroring the toolbar
                      list so per-scene picks have the full tier range. */}
                  <select value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)} style={selStyle}>
                    <optgroup label="GHS Standard">
                      <option value="piper">Piper (Free local)</option>
                    </optgroup>
                    <optgroup label="GHS Standard+ (Free Cloud)">
                      <option value="edge-tts">Edge-TTS Nigerian Neural</option>
                    </optgroup>
                    <optgroup label="GHS Pro">
                      <option value="fal_narrator">FAL Narrator</option>
                      <option value="fal-f5">FAL F5-TTS</option>
                      <option value="fal-xtts">FAL XTTS (voice clone)</option>
                      <option value="fal-bark">FAL Bark</option>
                    </optgroup>
                    <optgroup label="GHS Premium">
                      <option value="gemini">Gemini Flash</option>
                    </optgroup>
                    <optgroup label="GHS Best">
                      <option value="elevenlabs">ElevenLabs</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>💬 SUBTITLE</div>
                  <select
                    value={subtitleStyle}
                    onChange={e => setSubtitleStyle(e.target.value as SubtitleStyleKey)}
                    style={selStyle}
                  >
                    <option value="classic">Classic</option>
                    <option value="cinema">Cinema</option>
                    <option value="neon">Neon</option>
                    <option value="minimal">Minimal</option>
                    <option value="bold">Bold</option>
                    <option value="none">None (off)</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Auto-selected mode banner — visible during AND after generation.
              Lets the user see which "vibe" Free Mode picked for the prompt
              (Children / Action / Music Video / etc) so it's not a hidden
              decision. Henry 2026-06-07. ── */}
        {selectedModeLabel && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, marginBottom: 12,
            background: `${C.lilac}10`, border: `1px solid ${C.lilac}30`,
            fontSize: 11, color: C.lilac, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>✨</span>
            <span>AI selected mode: <strong>{selectedModeLabel}</strong> — narration speed, music style, and shot framing tuned for this content.</span>
          </div>
        )}

        {/* ── Pipeline progress ── */}
        {steps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: i < steps.length - 1 ? `1px solid ${C.line}` : "none",
              }}>
                <span style={{
                  fontSize: 14, color: statusColor[step.status],
                  animation: step.status === "running" ? "spin 1s linear infinite" : "none",
                  display: "inline-block",
                }}>{statusIcon[step.status]}</span>
                <span style={{ fontSize: 12, color: step.status === "pending" ? C.mute2 : C.ink }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: `${C.coral}0a`, border: `1px solid ${C.coral}30`,
            fontSize: 12, color: C.coral,
          }}>{error}</div>
        )}

        {done && resultUrl && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: `${C.mint}0a`, border: `1px solid ${C.mint}30`,
            fontSize: 12, color: C.mint,
          }}>
            Video ready!{" "}
            <a href={resultUrl} target="_blank" rel="noreferrer" style={{ color: C.sky, textDecoration: "underline" }}>
              Download
            </a>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: `1px solid ${C.line}`, background: "transparent",
            color: C.mute, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>{done ? "Close" : "Cancel"}</button>
          {!running && !done && (
            <button onClick={runHybrid} style={{
              flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg, ${C.mint}, ${ds.color.sky})`,
              color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>
              Start ({scenes.length} scenes)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Character Drawer ───────────────────────────────────────────────────────────

function CharacterDrawer({
  selectedIds,
  onSelect,
  onClose,
}: {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [saving, setSaving]         = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/character-voices")
      .then(r => r.ok ? r.json() : { voices: [] })
      .then(d => setCharacters((d.voices ?? []).map((v: Character & { visualDescription?: string }) => ({
        id: v.id, name: v.name, imageUrl: v.imageUrl, role: v.role,
      })))
      )
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter(x => x !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  }

  async function createCharacter() {
    if (!newName.trim()) return;
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/character-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), visualDescription: newDesc.trim(), role: "supporting", isNarrator: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create character");
      } else {
        const created = data.voice ?? data;
        setCharacters(prev => [{ id: created.id, name: created.name, imageUrl: created.imageUrl, role: created.role }, ...prev]);
        onSelect([...selectedIds, created.id]);
        setCreating(false);
        setNewName(""); setNewDesc("");
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Network error");
    }
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      display: "flex", alignItems: "stretch",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />

      {/* Drawer */}
      <div style={{
        width: 340, background: C.card,
        borderLeft: `1px solid ${C.line}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>Add Character</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: C.mute, fontSize: 18, cursor: "pointer",
          }}>×</button>
        </div>

        {/* Search / list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: C.mute, fontSize: 12, padding: 24 }}>Loading characters…</div>
          ) : (
            <>
              {characters.length === 0 && !creating && (
                <div style={{ textAlign: "center", color: C.mute2, fontSize: 12, padding: 24 }}>
                  No characters yet. Create one below.
                </div>
              )}
              {characters.map(ch => {
                const active = selectedIds.includes(ch.id);
                return (
                  <div key={ch.id} onClick={() => toggle(ch.id)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                    border: `1px solid ${active ? C.sky + "60" : C.line}`,
                    background: active ? `${C.sky}10` : C.alert,
                    transition: "all 0.15s",
                  }}>
                    {ch.imageUrl ? (
                      <img src={ch.imageUrl} alt={ch.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: `${C.lilac}20`, border: `1px solid ${C.lilac}35`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: C.lilac, fontWeight: 700,
                      }}>{ch.name.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{ch.name}</div>
                      {ch.role && <div style={{ fontSize: 10, color: C.mute }}>{ch.role}</div>}
                    </div>
                    {active && <span style={{ fontSize: 14, color: C.sky }}>✓</span>}
                  </div>
                );
              })}

              {creating && (
                <div style={{
                  padding: "14px 12px", borderRadius: 12,
                  background: C.alert, border: `1px solid ${C.line}`,
                  marginTop: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.mute2, marginBottom: 8 }}>
                    NEW CHARACTER
                  </div>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Character name…"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: C.card, border: `1px solid ${C.line}`,
                      color: C.ink, borderRadius: 8, padding: "8px 10px",
                      fontSize: 12, marginBottom: 8, outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Brief description (appearance, role…)"
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: C.card, border: `1px solid ${C.line}`,
                      color: C.ink, borderRadius: 8, padding: "8px 10px",
                      fontSize: 12, resize: "none", outline: "none", marginBottom: 10,
                      fontFamily: "inherit",
                    }}
                  />
                  {createError && (
                    <div style={{ fontSize: 11, color: C.coral, marginBottom: 8, padding: "6px 8px", background: `${C.coral}10`, borderRadius: 6 }}>
                      {createError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setCreating(false); setCreateError(null); }} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8,
                      border: `1px solid ${C.line}`, background: "transparent",
                      color: C.mute, fontSize: 11, cursor: "pointer",
                    }}>Cancel</button>
                    <button onClick={createCharacter} disabled={saving || !newName.trim()} style={{
                      flex: 2, padding: "8px 0", borderRadius: 8, border: "none",
                      background: saving ? C.alert : `linear-gradient(135deg, ${C.lilac}, ${C.sky})`,
                      color: saving ? C.mute : "#fff",
                      fontSize: 11, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    }}>{saving ? "Saving…" : "Create"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!creating && (
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setCreating(true)} style={{
              width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg, ${C.lilac}40, ${C.sky}40)`,
              color: C.ink, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>+ Create New Character</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Intro/Outro Form ───────────────────────────────────────────────────────────

function IntroOutroPanel({
  type,
  data,
  onChange,
  onClose,
}: {
  type: "intro" | "outro";
  data: IntroOutroData;
  onChange: (d: IntroOutroData) => void;
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const accent = type === "intro" ? C.mint : C.gold;
  const icon   = type === "intro" ? "▶" : "⏹";

  // ── Collapsed: thin bar showing saved info ──
  if (collapsed) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 12px", borderRadius: 10, marginBottom: 6,
        background: `${accent}0c`, border: `1px solid ${accent}40`,
        animation: "fadeSlideUp 0.15s ease",
      }}>
        <span style={{ fontSize: 12, color: accent }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {type}
        </span>
        <span style={{
          flex: 1, fontSize: 11, color: C.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: 260,
        }}>
          {data.text || <span style={{ color: C.mute2 }}>No text set</span>}
        </span>
        {data.phone && (
          <span style={{ fontSize: 10, color: C.mute2, whiteSpace: "nowrap" }}>
            {data.type === "whatsapp" ? "WA" : data.type === "call" ? "📞" : "📧"} {data.phone}
          </span>
        )}
        <button
          onClick={() => setCollapsed(false)}
          style={{
            padding: "3px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${accent}50`, background: `${accent}14`, color: accent,
          }}
        >Edit</button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: C.mute2, fontSize: 14, cursor: "pointer", padding: "0 2px" }}
          title="Remove"
        >×</button>
      </div>
    );
  }

  // ── Expanded: full form ──
  return (
    <div style={{
      padding: "12px 14px",
      background: C.alert,
      border: `1px solid ${accent}40`,
      borderRadius: 12, marginBottom: 8,
      animation: "fadeSlideUp 0.2s ease",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 1 }}>
          {icon} {type === "intro" ? "Intro" : "Outro"}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {data.text.trim() && (
            <button
              onClick={() => setCollapsed(true)}
              style={{
                padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${C.line}`, background: "transparent", color: C.mute2,
              }}
            >Collapse ↑</button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.mute, fontSize: 16, cursor: "pointer" }}>×</button>
        </div>
      </div>

      <input
        value={data.text}
        onChange={e => onChange({ ...data, text: e.target.value })}
        placeholder={type === "intro" ? "Intro text (e.g. GioHomeStudio presents…)" : "Outro text (e.g. Thank you for watching!)"}
        style={{
          width: "100%", boxSizing: "border-box",
          background: C.card, border: `1px solid ${C.line}`,
          color: C.ink, borderRadius: 8, padding: "8px 10px", fontSize: 12,
          outline: "none", marginBottom: 8, fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={data.phone}
          onChange={e => onChange({ ...data, phone: e.target.value })}
          placeholder="Phone / WhatsApp (optional)"
          style={{
            flex: 1, boxSizing: "border-box",
            background: C.card, border: `1px solid ${C.line}`,
            color: C.ink, borderRadius: 8, padding: "8px 10px", fontSize: 12,
            outline: "none", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {(["contact", "whatsapp", "call"] as const).map(t => (
            <button key={t} onClick={() => onChange({ ...data, type: t })} style={{
              padding: "6px 8px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${data.type === t ? accent + "60" : C.line}`,
              background: data.type === t ? `${accent}18` : "transparent",
              color: data.type === t ? accent : C.mute2,
            }}>{t === "contact" ? "CONTACT" : t === "whatsapp" ? "WA" : "CALL"}</button>
          ))}
        </div>
      </div>

      {/* Submit / Save button — collapses the panel */}
      <button
        onClick={() => { if (data.text.trim()) setCollapsed(true); }}
        disabled={!data.text.trim()}
        style={{
          width: "100%", padding: "8px 0", borderRadius: 9, border: "none",
          background: data.text.trim()
            ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
            : C.alert,
          color: data.text.trim() ? "#fff" : C.mute2,
          fontSize: 12, fontWeight: 800,
          cursor: data.text.trim() ? "pointer" : "not-allowed",
          transition: "all 0.15s",
        }}
      >
        ✓ Save {type === "intro" ? "Intro" : "Outro"} — collapse
      </button>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onEditScene,
  onReSendToAI,
  onGenImage,
  onGenVideo,
  onGenHybrid,
  onPolishScene,
  onGenSceneImage,
  onGenSceneVideo,
  generatingSceneId,
  generatingVideoSceneId,
  defaultImageModel,
  defaultImageStyle,
  defaultVideoModel,
  limits,
  editMode,
  onToggleEdit,
}: {
  msg: ChatMessage;
  onEditScene: (msgId: string, sceneId: string, field: "title" | "text", value: string) => void;
  onReSendToAI: (msgId: string) => void;
  onGenImage: (msgId: string) => void;
  onGenVideo: (msgId: string) => void;
  onGenHybrid: (msgId: string) => void;
  onPolishScene: (msgId: string, sceneId: string, text: string) => void;
  onGenSceneImage: (msgId: string, sceneId: string, imgModel: string, imgStyle: string) => void;
  onGenSceneVideo: (msgId: string, sceneId: string, vidModel: string, duration: number) => void;
  generatingSceneId: string | null;
  generatingVideoSceneId: string | null;
  defaultImageModel: string;
  defaultImageStyle: string;
  defaultVideoModel: string;
  limits: DailyLimits;
  editMode: Set<string>;
  onToggleEdit: (msgId: string) => void;
}) {
  const isUser = msg.role === "user";
  const isEdit = editMode.has(msg.id);

  if (isUser) {
    return (
      <div style={{
        display: "flex", justifyContent: "flex-end", marginBottom: 12,
        animation: "fadeSlideUp 0.25s ease",
      }}>
        <div style={{
          maxWidth: "72%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px",
          background: `linear-gradient(135deg, ${C.lilac}30, ${C.sky}20)`,
          border: `1px solid ${C.lilac}35`,
          color: C.ink, fontSize: 13, lineHeight: 1.6,
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div style={{ marginBottom: 16, animation: "fadeSlideUp 0.25s ease" }}>
      {/* Summary */}
      {msg.content && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${C.lilac}, ${C.sky})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: "#fff",
          }}>G</div>
          <div style={{
            flex: 1, padding: "10px 14px", borderRadius: "4px 16px 16px 16px",
            background: C.card, border: `1px solid ${C.line}`,
            color: C.ink, fontSize: 13, lineHeight: 1.6,
          }}>
            {msg.content}
          </div>
        </div>
      )}

      {/* Scene cards */}
      {msg.scenes && msg.scenes.length > 0 && (
        <div style={{ paddingLeft: 38 }}>
          {msg.scenes.map((scene, i) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={i}
              onEdit={(sceneId, field, value) => onEditScene(msg.id, sceneId, field, value)}
              onPolish={(sceneId, text) => onPolishScene(msg.id, sceneId, text)}
              onGenSceneImage={(sceneId, imgModel, imgStyle) => onGenSceneImage(msg.id, sceneId, imgModel, imgStyle)}
              onGenSceneVideo={(sceneId, vidModel, duration) => onGenSceneVideo(msg.id, sceneId, vidModel, duration)}
              generatingImage={generatingSceneId === scene.id}
              generatingVideo={generatingVideoSceneId === scene.id}
              defaultImageModel={defaultImageModel}
              defaultImageStyle={defaultImageStyle}
              defaultVideoModel={defaultVideoModel}
              imageRemaining={limits.imageRemaining}
              videoRemaining={limits.videoRemaining}
            />
          ))}

          {/* 4 action buttons */}
          <div style={{
            background: C.card, borderRadius: 12,
            border: `1px solid ${C.line}`,
            overflow: "hidden",
            marginTop: 4,
          }}>
            <ActionButtons
              scenes={msg.scenes}
              onEditMode={() => {
                onToggleEdit(msg.id);
                if (isEdit) onReSendToAI(msg.id);
              }}
              editMode={isEdit}
              onGenImage={() => onGenImage(msg.id)}
              onGenVideo={() => onGenVideo(msg.id)}
              onGenHybrid={() => onGenHybrid(msg.id)}
              limits={limits}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const FREE_MODE_SESSION_LS_KEY = "ghs_free_mode_sessionId";

function getOrCreateSessionId(): string {
  try {
    const stored = localStorage.getItem(FREE_MODE_SESSION_LS_KEY);
    if (stored) return stored;
  } catch { /* ssr guard */ }
  const fresh = genSessionId();
  try { localStorage.setItem(FREE_MODE_SESSION_LS_KEY, fresh); } catch { /* ignore */ }
  return fresh;
}

function FreeModeChat() {
  // Persist sessionId across page reloads so DB restore works.
  // State (not ref) so switching sessions from the sidebar triggers a re-fetch.
  const [sessionId, setSessionIdState] = useState<string>(
    typeof window !== "undefined" ? getOrCreateSessionId() : genSessionId()
  );

  // ── ProjectSettings hook — keyed to sessionId so settings persist per-session ──
  const { settings: projectSettings, patch: patchProjectSettings } =
    useProjectSettings(sessionId || "free-mode-default");

  function switchSession(newId: string) {
    try { localStorage.setItem(FREE_MODE_SESSION_LS_KEY, newId); } catch { /* ssr */ }
    setMessages([]);
    setSelectedCharIds([]);
    setIntro(null);
    setOutro(null);
    setLoaded(false);
    setSessionIdState(newId);
  }

  function newSession() {
    const fresh = genSessionId();
    switchSession(fresh);
  }
  const feedRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [input,          setInput]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [loaded,         setLoaded]         = useState(false);
  const [characters,     setCharacters]     = useState<Character[]>([]);
  const [charDrawer,     setCharDrawer]     = useState(false);
  const [selectedCharIds,setSelectedCharIds]= useState<string[]>([]);
  const [plusMenuOpen,   setPlusMenuOpen]   = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const [limits,         setLimits]         = useState<DailyLimits>({
    imageCount: 0, videoCount: 0, imageLimit: 4, videoLimit: 2,
    imageRemaining: 4, videoRemaining: 2,
  });
  const [intro,          setIntro]          = useState<IntroOutroData | null>(null);
  const [outro,          setOutro]          = useState<IntroOutroData | null>(null);
  const [videoConfirm,   setVideoConfirm]   = useState<string | null>(null); // msgId
  const [genVideoState,  setGenVideoState]  = useState(false);
  const [hybridMsg,      setHybridMsg]      = useState<string | null>(null); // msgId
  const [editModeSet,      setEditModeSet]      = useState<Set<string>>(new Set());
  const [genImageFor,      setGenImageFor]      = useState<string | null>(null);
  const [generatingSceneId,     setGeneratingSceneId]     = useState<string | null>(null);
  const [generatingVideoSceneId,setGeneratingVideoSceneId] = useState<string | null>(null);
  const [stylePromptOpen,  setStylePromptOpen]  = useState(false);

  // ── Visual style ──
  const [imageStyle, setImageStyle] = useState("realistic");

  // ── Model + audio preferences ──
  const [showCustomize,  setShowCustomize]  = useState(false);
  const [imageModel,     setImageModel]     = useState("segmind_flux");
  const [videoModel,     setVideoModel]     = useState("wan_2_5_lite");
  const [llmModel,       setLlmModel]       = useState("claude:claude-haiku-4-5-20251001");
  const [musicTier,      setMusicTier]      = useState("stock");
  const [sfxSource,      setSfxSource]      = useState("auto");
  const [voiceProvider,  setVoiceProvider]  = useState("piper");
  const [subtitleStyle,  setSubtitleStyle]  = useState<"classic" | "cinema" | "neon" | "minimal" | "bold" | "none">("classic");

  // ── effective* shims: hook value wins, local state is fallback ──
  const effectiveProjectStyle    = projectSettings.visualStyle    ?? imageStyle;
  const effectiveImageModelId    = (projectSettings.imageModelVersion !== "auto" ? projectSettings.imageModelVersion : null) ?? imageModel;
  const effectiveVideoModelId    = (projectSettings.videoModelVersion !== "auto" ? projectSettings.videoModelVersion : null) ?? videoModel;
  const effectiveSoundTier       = projectSettings.soundTier       ?? musicTier;
  const effectiveNarrationProvider = projectSettings.narrationProvider ?? voiceProvider;
  const effectiveLlmProvider     = projectSettings.llmProvider     ?? llmModel;
  const effectiveSubtitleMode    = projectSettings.subtitleMode    ?? subtitleStyle;

  // ── Inline video generation picker ──
  const [videoGenPicker, setVideoGenPicker] = useState<"text2vid" | "img2vid" | "motion" | null>(null);
  const [videoGenImageUrl, setVideoGenImageUrl] = useState("");
  const [videoGenModel, setVideoGenModel]   = useState("wan_2_5_lite");
  const [videoGenPrompt, setVideoGenPrompt] = useState("");
  const [videoGenRunning, setVideoGenRunning] = useState(false);
  const [videoGenDuration, setVideoGenDuration] = useState(5);
  const [videoGenCustomDur, setVideoGenCustomDur] = useState("");

  // ── All available characters (for compact picker) ──
  const [allAvailableChars, setAllAvailableChars] = useState<Character[]>([]);
  const imageUploadRef = useRef<HTMLInputElement>(null);

  // ── History sidebar ──
  type SessionListItem = {
    id: string; title: string; msgCount: number;
    imageCount: number; videoCount: number; updatedAt: string;
  };
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [sessionList,    setSessionList]    = useState<SessionListItem[]>([]);
  const [sessionSearch,  setSessionSearch]  = useState("");
  const [sessionListBump, setSessionListBump] = useState(0);

  function refreshSessionList() {
    fetch(`/api/free-mode/sessions/list${sessionSearch ? `?q=${encodeURIComponent(sessionSearch)}` : ""}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.sessions) setSessionList(d.sessions); })
      .catch(() => null);
  }

  // Load from DB on mount
  useEffect(() => {
    const sid = sessionId;
    fetch(`/api/free-mode/sessions?sessionId=${sid}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.messages && data.messages.length > 0) {
          const restored: ChatMessage[] = data.messages.map((m: {
            id: string; role: string; content: string;
            scenes?: Scene[]; createdAt: string;
          }) => ({
            id:        m.id,
            role:      m.role as "user" | "assistant",
            content:   m.content,
            scenes:    m.scenes ? (m.scenes as Scene[]) : undefined,
            timestamp: new Date(m.createdAt).getTime(),
          }));
          setMessages(restored);
        }
        if (data?.session?.characters?.length > 0) {
          setSelectedCharIds(data.session.characters);
        }
        if (data?.session?.introText) {
          setIntro({ text: data.session.introText, phone: data.session.introPhone ?? "", type: "contact" });
        }
        if (data?.session?.outroText) {
          setOutro({ text: data.session.outroText, phone: data.session.outroPhone ?? "", type: "contact" });
        }
      })
      .catch(() => null)
      .finally(() => setLoaded(true));

    // Load daily limits
    fetch("/api/free-mode/daily-limits")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLimits(d); })
      .catch(() => null);
  }, [sessionId]);

  // Refresh session list (history sidebar) when sessionId, search, or bump changes
  useEffect(() => {
    refreshSessionList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionSearch, sessionListBump]);

  // Load all available characters (for compact picker)
  useEffect(() => {
    fetch("/api/character-voices")
      .then(r => r.ok ? r.json() : { voices: [] })
      .then(d => setAllAvailableChars((d.voices ?? []).map((v: Character) => ({
        id: v.id, name: v.name, imageUrl: v.imageUrl, role: v.role,
      }))))
      .catch(() => null);
  }, []);

  // Load selected characters detail
  useEffect(() => {
    if (selectedCharIds.length === 0) { setCharacters([]); return; }
    fetch("/api/character")
      .then(r => r.ok ? r.json() : { characters: [] })
      .then(d => {
        const all: Character[] = d.characters ?? d.items ?? [];
        setCharacters(all.filter((c: Character) => selectedCharIds.includes(c.id)));
      })
      .catch(() => null);
  }, [selectedCharIds]);

  // Handle local image upload → set as videoGenImageUrl and open img2vid picker
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setVideoGenImageUrl(dataUrl);
      setVideoGenPicker("img2vid");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Auto-scroll
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages.length, sending]);

  // Close plus menu on outside click
  useEffect(() => {
    if (!plusMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [plusMenuOpen]);

  // ── Auto-restore from localStorage on mount (per-session key) ─────────────
  // Per-session key prevents one session's draft contaminating another.
  // Acts as a fallback if the DB read returns no scenes (e.g. PATCH not applied yet).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `ghs_freemode_draft_${sessionId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.messages) && d.messages.length > 0) {
        // Merge: if DB load already populated messages, fill any missing
        // imageUrl/videoUrl from localStorage so refresh never strips them.
        setMessages(prev => {
          if (prev.length === 0) return d.messages;
          const byId = new Map<string, ChatMessage>(d.messages.map((m: ChatMessage) => [m.id, m]));
          return prev.map(m => {
            const cached = byId.get(m.id);
            if (!cached?.scenes) return m;
            return {
              ...m,
              scenes: m.scenes?.map(s => {
                const cs = cached.scenes?.find(x => x.id === s.id);
                if (!cs) return s;
                return {
                  ...s,
                  imageUrl: s.imageUrl ?? cs.imageUrl,
                  videoUrl: s.videoUrl ?? cs.videoUrl,
                };
              }) ?? cached.scenes,
            };
          });
        });
      }
      if (Array.isArray(d.selectedCharIds) && d.selectedCharIds.length > 0) {
        setSelectedCharIds(prev => prev.length === 0 ? d.selectedCharIds : prev);
      }
      if (d.intro !== undefined && d.intro !== null) setIntro(d.intro as IntroOutroData);
      if (d.outro !== undefined && d.outro !== null) setOutro(d.outro as IntroOutroData);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-save to localStorage (per-session key) ───────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft = {
      messages: messages.slice(-50),
      selectedCharIds,
      intro,
      outro,
    };
    try {
      localStorage.setItem(`ghs_freemode_draft_${sessionId}`, JSON.stringify(draft));
    } catch { /* quota exceeded — ignore */ }
  }, [sessionId, messages, selectedCharIds, intro, outro]);

  // Persist session characters/intro/outro on change (debounced)
  const persistSession = useCallback(async (
    chars: string[],
    introData: IntroOutroData | null,
    outroData: IntroOutroData | null
  ) => {
    await fetch("/api/free-mode/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId:  sessionId,
        characters: chars,
        introText:  introData?.text  ?? null,
        introPhone: introData?.phone ?? null,
        outroText:  outroData?.text  ?? null,
        outroPhone: outroData?.phone ?? null,
      }),
    }).catch(() => null);
  }, []);

  // Handle send
  async function handleSend(overrideInput?: string) {
    const text = (overrideInput ?? input).trim();
    if (!text || sending) return;
    setInput("");

    const userMsg: ChatMessage = {
      id:        "u-" + genId(),
      role:      "user",
      content:   text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    // Build history for LLM context (last 10 messages).
    // Henry 2026-06-04 Free Mode fix: previously only scene TITLES were sent. Result:
    // when user said "make scene 3 more intense", LLM had only "Scene 3: Snake Attack"
    // with no body text or mood — couldn't preserve story details. Now: include scene
    // body + mood per scene so LLM has full context to refine.
    const historyContext = messages.slice(-10).map(m => ({
      role:    m.role,
      content: m.scenes
        ? m.content + "\n[Story scenes:\n" + m.scenes.map(s => `${s.id} (${s.mood}): ${s.title} — ${s.text}`).join("\n") + "]"
        : m.content,
    }));

    try {
      const res = await fetch("/api/free-mode/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          message:   text,
          history:   historyContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg: ChatMessage = {
          id:        "a-" + genId(),
          role:      "assistant",
          content:   data.error ?? "Something went wrong. Please try again.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
        return;
      }

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id:        data.messageId ?? "a-" + genId(),
        role:      "assistant",
        content:   data.summary ?? "",
        scenes:    data.scenes ?? [],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      // Prompt user to pick a style if scenes were generated
      if (aiMsg.scenes && aiMsg.scenes.length > 0) {
        setStylePromptOpen(true);
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id:        "a-" + genId(),
        role:      "assistant",
        content:   err instanceof Error ? err.message : "Unexpected error",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
      setSessionListBump(b => b + 1);
    }
  }

  function editScene(msgId: string, sceneId: string, field: "title" | "text", value: string) {
    setMessages(prev => {
      const next = prev.map(m => {
        if (m.id !== msgId || !m.scenes) return m;
        return {
          ...m,
          scenes: m.scenes.map(s => s.id === sceneId ? { ...s, [field]: value } : s),
        };
      });
      const updated = next.find(m => m.id === msgId);
      if (updated?.scenes) persistMessageScenes(msgId, updated.scenes);
      return next;
    });
  }

  function toggleEdit(msgId: string) {
    setEditModeSet(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }

  function reSendToAI(msgId: string) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes) return;
    const sceneSummary = msg.scenes
      .map(s => `${s.title}: ${s.text}`)
      .join("\n\n");
    const reSendText = `Please refine the following story scenes I edited:\n\n${sceneSummary}`;
    handleSend(reSendText);
    setEditModeSet(prev => { const next = new Set(prev); next.delete(msgId); return next; });
  }

  // PATCH the message's scenes JSON in DB so imageUrl/videoUrl survive refresh.
  // Fire-and-forget — UI already updated optimistically.
  function persistMessageScenes(msgId: string, scenes: Scene[]) {
    // Only persist if this message has a real DB id (chat route returns the saved id).
    // Locally-generated ids start with "a-"/"u-" and have no DB row yet — skip those.
    if (!msgId || msgId.startsWith("a-") || msgId.startsWith("u-")) return;
    fetch(`/api/free-mode/messages/${msgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenes }),
    }).catch(() => { /* non-blocking */ });
  }

  // Save a standalone asset (video / image / hybrid output) into the chat
  // history so it survives refresh — appends as an assistant message.
  async function saveAssetToHistory(content: string, scenes?: Scene[]): Promise<string | null> {
    try {
      const res = await fetch("/api/free-mode/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          role: "assistant",
          content,
          scenes: scenes ?? undefined,
        }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      setSessionListBump(b => b + 1);
      return d.id ?? null;
    } catch {
      return null;
    }
  }

  // Henry 2026-06-05: auto-mode feel for Free Mode. After AI returns scenes
  // AND user has picked a visual style, batch-generate all scene images in
  // sequence (1.5s gap between calls so FAL rate limit + breaker stay happy).
  // Each gen carries the rich prompt (title + mood + scene.text) per fix b1bd7fc.
  // No-op if a scene already has an image. Stops if daily image limit hits 0.
  async function genAllImagesForMsg(msgId: string) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes) return;
    for (const sc of msg.scenes) {
      if (sc.imageUrl) continue;               // already generated, skip
      if (limits.imageRemaining <= 0) break;   // out of daily budget, stop
      await genSceneImage(msgId, sc.id);
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Generate image for one scene — stores imageUrl IN the scene (survives refresh)
  async function genSceneImage(msgId: string, sceneId: string, imgModel?: string, imgStyle?: string) {
    const msg = messages.find(m => m.id === msgId);
    const scene = msg?.scenes?.find(s => s.id === sceneId);
    if (!scene || limits.imageRemaining <= 0) return;

    setGeneratingSceneId(sceneId);
    try {
      const limitRes = await fetch("/api/free-mode/daily-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image" }),
      });
      if (!limitRes.ok) return;
      setLimits(await limitRes.json());

      const usedStyle = imgStyle ?? effectiveProjectStyle;
      const usedModel = imgModel ?? effectiveImageModelId;
      const stylePrefix = VISUAL_STYLES[usedStyle]?.prefix ?? VISUAL_STYLES["realistic"].prefix;
      const charPrefix = characters.length > 0 ? characters.map(c => c.name).join(", ") + ". " : "";
      // Henry 2026-06-04 Free Mode fix: previously prompt = style + names + scene.text.
      // Image gen would focus on the subject name and miss the scene drama (Henry's
      // complaint: "FREE MODE DOES NOT GENERATE SCENE CONTENT, JUST SUBJECT").
      // Now: include scene title + mood for context + emphasize the action verbs.
      const sceneTitle = scene.title || "";
      const sceneMood  = scene.mood ? `, ${scene.mood} mood, cinematic atmosphere` : "";
      const richPrompt = `${stylePrefix} ${charPrefix}${sceneTitle ? sceneTitle + ". " : ""}${scene.text} ${sceneMood}. Composition shows the full scene action, not just the subject.`;
      const imgRes = await fetch("/api/generation/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:  richPrompt,
          modelId: usedModel,
          width:   832, height: 1472,
        }),
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const url = imgData.imagePath
          ? `/api/media/file?path=${encodeURIComponent(imgData.imagePath)}`
          : (imgData.imageUrl ?? null);
        if (url) {
          // Store imageUrl IN the scene object → auto-saved to localStorage with messages
          setMessages(prev => {
            const next = prev.map(m =>
              m.id !== msgId ? m : {
                ...m,
                scenes: m.scenes?.map(s =>
                  s.id !== sceneId ? s : { ...s, imageUrl: url }
                ),
              }
            );
            const updated = next.find(m => m.id === msgId);
            if (updated?.scenes) persistMessageScenes(msgId, updated.scenes);
            return next;
          });
        }
      }
    } catch { /* silent */ }
    setGeneratingSceneId(null);
  }

  // Generate video for one scene — stores videoUrl IN the scene (survives refresh)
  async function genSceneVideo(msgId: string, sceneId: string, vidModel: string, duration: number) {
    const msg = messages.find(m => m.id === msgId);
    const scene = msg?.scenes?.find(s => s.id === sceneId);
    if (!scene || limits.videoRemaining <= 0) return;

    setGeneratingVideoSceneId(sceneId);
    try {
      const limitRes = await fetch("/api/free-mode/daily-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "video" }),
      });
      if (!limitRes.ok) return;
      setLimits(await limitRes.json());

      const stylePrefix = VISUAL_STYLES[effectiveProjectStyle]?.prefix ?? VISUAL_STYLES["realistic"].prefix;
      const charPrefix = characters.length > 0 ? characters.map(c => c.name).join(", ") + ". " : "";
      // Henry 2026-06-04 Free Mode fix: same enrichment as image gen — include scene
      // title + mood so video prompt captures the scene drama, not just the subject.
      const sceneTitle = scene.title || "";
      const sceneMood  = scene.mood ? `, ${scene.mood} mood, cinematic motion` : "";
      const prompt = `${stylePrefix} ${charPrefix}${sceneTitle ? sceneTitle + ". " : ""}${scene.text} ${sceneMood}.`;

      const vidRes = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          imageUrl: scene.imageUrl ?? undefined,
          model: vidModel,
          mode: scene.imageUrl ? "image_to_video" : "text_to_video",
          duration,
          aspectRatio: "9:16",
        }),
      });
      if (vidRes.ok) {
        const vidData = await vidRes.json();
        const url = vidData.outputUrl ?? vidData.videoUrl ?? null;
        if (url) {
          setMessages(prev => {
            const next = prev.map(m =>
              m.id !== msgId ? m : {
                ...m,
                scenes: m.scenes?.map(s =>
                  s.id !== sceneId ? s : { ...s, videoUrl: url }
                ),
              }
            );
            const updated = next.find(m => m.id === msgId);
            if (updated?.scenes) persistMessageScenes(msgId, updated.scenes);
            return next;
          });
        }
      }
    } catch { /* silent */ }
    setGeneratingVideoSceneId(null);
  }

  // Batch: generate images for all scenes in a message (shows style picker first if unset)
  async function genImageForMsg(msgId: string) {
    // If still on default style and no images yet, prompt user to pick a style first
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes) return;
    const hasAnyImage = msg.scenes.some(s => s.imageUrl);
    if (!hasAnyImage && effectiveProjectStyle === "realistic") {
      // Style already set to Realistic — fine, continue. If it ever was unset we'd open picker.
    }

    setGenImageFor(msgId);
    for (const scene of msg.scenes) {
      if (limits.imageRemaining <= 0) break;
      await genSceneImage(msgId, scene.id);
    }
    setGenImageFor(null);
  }

  function polishScene(msgId: string, sceneId: string, polishedText: string) {
    setMessages(prev => {
      const next = prev.map(m => {
        if (m.id !== msgId || !m.scenes) return m;
        return { ...m, scenes: m.scenes.map(s => s.id === sceneId ? { ...s, text: polishedText } : s) };
      });
      const updated = next.find(m => m.id === msgId);
      if (updated?.scenes) persistMessageScenes(msgId, updated.scenes);
      return next;
    });
  }

  function handleCharSelect(ids: string[]) {
    setSelectedCharIds(ids);
    persistSession(ids, intro, outro);
  }

  function updateIntro(d: IntroOutroData) {
    setIntro(d);
    persistSession(selectedCharIds, d, outro);
  }

  function updateOutro(d: IntroOutroData) {
    setOutro(d);
    persistSession(selectedCharIds, intro, d);
  }

  function handleVideoConfirm(msgId: string, duration: number) {
    // Video generation uses pipeline API
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes) return;

    setGenVideoState(true);
    fetch("/api/free-mode/daily-limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "video" }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLimits(d); })
      .catch(() => null)
      .finally(() => {
        // Fire and forget pipeline call
        const sceneParts = msg.scenes!.map(s => s.text).join(". ");
        fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawInput:        sceneParts,
            outputMode:      "text_to_video",
            llmModel:        effectiveLlmProvider,
            videoModelId:    effectiveVideoModelId,
            durationSeconds: duration,
            aspectRatio:     "9:16",
            aiAutoMode:      true,
            audioMode:       effectiveSoundTier === "piper" ? "voice_music" : "music_only",
            musicProvider:   effectiveSoundTier,
          }),
        }).catch(() => null);

        setVideoConfirm(null);
        setGenVideoState(false);
      });
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: C.bg, color: C.ink, fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* ── Modals ── */}
      {videoConfirm && (
        <VideoConfirmModal
          onConfirm={(dur) => handleVideoConfirm(videoConfirm, dur)}
          onCancel={() => setVideoConfirm(null)}
          generating={genVideoState}
        />
      )}
      {hybridMsg && (
        <HybridModal
          scenes={messages.find(m => m.id === hybridMsg)?.scenes ?? []}
          onClose={() => setHybridMsg(null)}
          characters={characters}
          imageModel={effectiveImageModelId}
          imageStyle={effectiveProjectStyle}
          initMusicTier={effectiveSoundTier}
          initSfxSource={sfxSource}
          initVoiceProvider={effectiveNarrationProvider}
          initSubtitleStyle={effectiveSubtitleMode as "classic" | "cinema" | "neon" | "minimal" | "bold" | "none"}
          onComplete={async (resultUrl, hybridScenes) => {
            // Save final hybrid video to chat history so it survives refresh.
            const sceneObj: Scene = {
              id: "hybrid-" + genId(),
              title: "Hybrid Video",
              text:  hybridScenes.map(s => s.title).join(" · "),
              mood:  "neutral",
              videoUrl: resultUrl,
            };
            const dbId = await saveAssetToHistory("🔀 Hybrid video assembled", [sceneObj]);
            setMessages(prev => [...prev, {
              id: dbId ?? ("a-" + genId()),
              role: "assistant" as const,
              content: "🔀 Hybrid video assembled",
              scenes: [sceneObj],
              timestamp: Date.now(),
            }]);
          }}
        />
      )}
      {charDrawer && (
        <CharacterDrawer
          selectedIds={selectedCharIds}
          onSelect={handleCharSelect}
          onClose={() => setCharDrawer(false)}
        />
      )}

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, borderBottom: `1px solid ${C.line}`,
        padding: "11px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.card, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff", fontWeight: 900,
          }}>G</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, letterSpacing: -0.3 }}>Free Mode</div>
            <div style={{ fontSize: 10, color: C.mute2 }}>Chat • Tell AI anything → get scenes</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/dashboard/hybrid-planner" style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            textDecoration: "none", border: `1px solid ${C.line}`, color: C.mute,
          }}>Hybrid</a>
          <a href="/dashboard/review" style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            textDecoration: "none", background: `${C.sky}15`,
            border: `1px solid ${C.sky}40`, color: C.sky,
          }}>Review Queue</a>
        </div>
      </div>

      {/* ── Body: history sidebar + chat column ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>

        {/* History sidebar */}
        {sidebarOpen ? (
          <aside style={{
            width: 260, flexShrink: 0, borderRight: `1px solid ${C.line}`,
            background: C.card, display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.ink, letterSpacing: -0.2, flex: 1 }}>History</span>
              <button
                onClick={newSession}
                title="Start new chat"
                style={{
                  padding: "4px 9px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${C.sky}50`, background: `${C.sky}15`, color: C.sky,
                  cursor: "pointer",
                }}
              >+ New</button>
              <button
                onClick={() => setSidebarOpen(false)}
                title="Hide history"
                style={{
                  padding: "4px 7px", borderRadius: 7, fontSize: 11,
                  border: `1px solid ${C.line}`, background: "transparent", color: C.mute2,
                  cursor: "pointer",
                }}
              >‹</button>
            </div>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}` }}>
              <input
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                placeholder="Search sessions, movies, assets…"
                style={{
                  width: "100%", padding: "6px 9px", borderRadius: 7,
                  fontSize: 11, fontWeight: 600, border: `1px solid ${C.line}`,
                  background: C.alert, color: C.ink, outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <a
                  href="/dashboard/assets?type=image"
                  title="See every image you generated"
                  style={{
                    flex: 1, padding: "4px 6px", borderRadius: 6, textAlign: "center",
                    fontSize: 9, fontWeight: 700, textDecoration: "none",
                    border: `1px solid ${C.lilac}40`, background: `${C.lilac}10`, color: C.lilac,
                  }}
                >🖼 Images</a>
                <a
                  href="/dashboard/assets?type=video"
                  title="See every video you made"
                  style={{
                    flex: 1, padding: "4px 6px", borderRadius: 6, textAlign: "center",
                    fontSize: 9, fontWeight: 700, textDecoration: "none",
                    border: `1px solid ${C.gold}40`, background: `${C.gold}10`, color: C.gold,
                  }}
                >🎬 Videos</a>
                <a
                  href="/dashboard/character-voices"
                  title="Saved characters"
                  style={{
                    flex: 1, padding: "4px 6px", borderRadius: 6, textAlign: "center",
                    fontSize: 9, fontWeight: 700, textDecoration: "none",
                    border: `1px solid ${C.sky}40`, background: `${C.sky}10`, color: C.sky,
                  }}
                >👤 Cast</a>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px 12px" }}>
              {sessionList.length === 0 ? (
                <div style={{ fontSize: 11, color: C.mute, padding: "20px 12px", textAlign: "center" }}>
                  No sessions yet — your chats will appear here.
                </div>
              ) : sessionList.map(s => {
                const active = s.id === sessionId;
                const ts = new Date(s.updatedAt);
                const dateLabel = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                  " · " + ts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                return (
                  <button
                    key={s.id}
                    onClick={() => switchSession(s.id)}
                    style={{
                      width: "100%", textAlign: "left", marginBottom: 3,
                      padding: "8px 9px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${active ? C.sky + "70" : "transparent"}`,
                      background: active ? `${C.sky}14` : "transparent",
                      color: C.ink, fontFamily: "inherit",
                      display: "flex", flexDirection: "column", gap: 3,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = C.alert; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: active ? C.sky : C.ink,
                      lineHeight: 1.35, overflow: "hidden",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>{s.title}</span>
                    <span style={{ fontSize: 9, color: C.mute2, display: "flex", gap: 6, alignItems: "center" }}>
                      <span>{dateLabel}</span>
                      {s.msgCount > 0 && <span>· 💬 {s.msgCount}</span>}
                      {s.imageCount > 0 && <span style={{ color: C.lilac }}>· 🖼 {s.imageCount}</span>}
                      {s.videoCount > 0 && <span style={{ color: C.gold }}>· 🎬 {s.videoCount}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Show history"
            style={{
              width: 28, flexShrink: 0, borderRight: `1px solid ${C.line}`,
              background: C.card, color: C.mute2, fontSize: 14, cursor: "pointer",
              border: "none", borderTop: 0, borderBottom: 0, borderLeft: 0,
            }}
          >›</button>
        )}

        {/* Chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

      {/* ── Chat feed ── */}
      <div ref={feedRef} style={{
        flex: 1, overflowY: "auto", padding: "20px 20px 8px",
        maxWidth: 860, width: "100%", margin: "0 auto",
        boxSizing: "border-box",
      }}>
        {!loaded ? (
          <div style={{ textAlign: "center", color: C.mute, fontSize: 12, padding: 40 }}>
            Loading session…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px 32px", maxWidth: 520, margin: "0 auto" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✨</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: C.ink, marginBottom: 8, letterSpacing: -0.5 }}>
              What story do you want to create?
            </h2>
            <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, marginBottom: 28 }}>
              Type any idea — movie concept, short film, ad script, drama, comedy.<br />
              AI reads it, writes the story, and divides it into editable scenes.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                "A Nigerian mother searching for her missing son in Lagos",
                "A product promo for a luxury hair cream",
                "Comedy: office worker discovers his boss is a robot",
                "Romantic short film: two strangers meet on a rainy night",
              ].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  padding: "8px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${C.line}`, background: C.card,
                  color: C.mute, cursor: "pointer", lineHeight: 1.4,
                }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onEditScene={editScene}
                onReSendToAI={reSendToAI}
                onGenImage={genImageForMsg}
                onGenVideo={(msgId) => setVideoConfirm(msgId)}
                onGenHybrid={(msgId) => setHybridMsg(msgId)}
                onPolishScene={(msgId, sceneId, text) => polishScene(msgId, sceneId, text)}
                onGenSceneImage={(msgId, sceneId, imgModel, imgStyle) => genSceneImage(msgId, sceneId, imgModel, imgStyle)}
                onGenSceneVideo={genSceneVideo}
                generatingSceneId={generatingSceneId}
                generatingVideoSceneId={generatingVideoSceneId}
                defaultImageModel={effectiveImageModelId}
                defaultImageStyle={effectiveProjectStyle}
                defaultVideoModel={effectiveVideoModelId}
                limits={limits}
                editMode={editModeSet}
                onToggleEdit={toggleEdit}
              />
            ))}
            {(sending || genImageFor) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 38, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.lilac}, ${C.sky})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "#fff", fontWeight: 900,
                }}>G</div>
                <div style={{
                  padding: "10px 14px", borderRadius: "4px 16px 16px 16px",
                  background: C.card, border: `1px solid ${C.line}`,
                  fontSize: 12, color: C.mute,
                }}>
                  {genImageFor ? "Generating images…" : "Writing scenes…"}
                  <span style={{ display: "inline-block", animation: "blink 1s infinite", marginLeft: 4 }}>▊</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Input area ── */}
      <div style={{
        flexShrink: 0, borderTop: `1px solid ${C.line}`,
        background: C.card, padding: "12px 20px 16px", zIndex: 10,
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Intro/outro panels */}
          {intro && (
            <IntroOutroPanel type="intro" data={intro} onChange={updateIntro} onClose={() => { setIntro(null); persistSession(selectedCharIds, null, outro); }} />
          )}
          {outro && (
            <IntroOutroPanel type="outro" data={outro} onChange={updateOutro} onClose={() => { setOutro(null); persistSession(selectedCharIds, intro, null); }} />
          )}

          {/* ── Hidden file input for image upload ── */}
          <input
            ref={imageUploadRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />

          {/* ── Toolbar Row 1: actions ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>

            {/* + menu: Intro / Outro only */}
            <div ref={plusMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setPlusMenuOpen(o => !o)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: `1px solid ${plusMenuOpen ? C.sky + "80" : C.line}`,
                  background: plusMenuOpen ? `${C.sky}18` : "transparent",
                  color: plusMenuOpen ? C.sky : C.mute,
                  fontSize: 18, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >+</button>
              {plusMenuOpen && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 50,
                  background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
                  overflow: "hidden", minWidth: 170,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                }}>
                  {([
                    { label: "Add Intro",  icon: "▶", action: () => { setIntro({ text: "", phone: "", type: "contact" }); setPlusMenuOpen(false); } },
                    { label: "Add Outro",  icon: "⏹", action: () => { setOutro({ text: "", phone: "", type: "contact" }); setPlusMenuOpen(false); } },
                  ] as { label: string; icon: string; action: () => void }[]).map(item => (
                    <button key={item.label} onClick={item.action} style={{
                      width: "100%", padding: "9px 14px", background: "transparent",
                      border: "none", color: C.ink, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.sky}10`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                      <span>{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Character compact dropdown */}
            <select
              value=""
              onChange={e => {
                if (e.target.value === "__new__") { setCharDrawer(true); }
                else if (e.target.value && !selectedCharIds.includes(e.target.value)) {
                  handleCharSelect([...selectedCharIds, e.target.value]);
                }
                e.target.value = "";
              }}
              style={{
                padding: "4px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                border: `1px solid ${C.line}`, background: C.alert,
                color: C.mute2, cursor: "pointer", outline: "none", fontFamily: "inherit",
                maxWidth: 130,
              }}
            >
              <option value="">👤 Cast ▾</option>
              <option value="__new__">+ Create new…</option>
              {allAvailableChars.filter(c => !selectedCharIds.includes(c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Selected character chips (compact) */}
            {characters.map(ch => (
              <div key={ch.id} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px 3px 4px", borderRadius: 20,
                background: `${C.lilac}18`, border: `1px solid ${C.lilac}35`,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%",
                  background: C.lilac, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 8, color: "#fff", fontWeight: 800, flexShrink: 0,
                }}>{ch.name.slice(0, 1)}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.lilac, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</span>
                <button onClick={() => handleCharSelect(selectedCharIds.filter(id => id !== ch.id))} style={{
                  background: "none", border: "none", color: C.mute2, fontSize: 10, cursor: "pointer", padding: 0, lineHeight: 1,
                }}>×</button>
              </div>
            ))}

            {/* Intro / Outro chips */}
            {intro && (
              <div style={{ padding: "3px 7px", borderRadius: 20, background: `${C.mint}12`, border: `1px solid ${C.mint}40`, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 9, color: C.mint, fontWeight: 700 }}>▶ Intro</span>
                <button onClick={() => { setIntro(null); persistSession(selectedCharIds, null, outro); }} style={{ background: "none", border: "none", color: C.mute2, fontSize: 10, cursor: "pointer", padding: 0 }}>×</button>
              </div>
            )}
            {outro && (
              <div style={{ padding: "3px 7px", borderRadius: 20, background: `${C.gold}12`, border: `1px solid ${C.gold}40`, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 9, color: C.gold, fontWeight: 700 }}>⏹ Outro</span>
                <button onClick={() => { setOutro(null); persistSession(selectedCharIds, intro, null); }} style={{ background: "none", border: "none", color: C.mute2, fontSize: 10, cursor: "pointer", padding: 0 }}>×</button>
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Upload image button */}
            <button
              onClick={() => imageUploadRef.current?.click()}
              title="Upload image from computer"
              style={{
                padding: "4px 9px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                border: `1px solid ${C.line}`, background: "transparent",
                color: C.mute2, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}
            >📁 Upload</button>

            {/* Limits */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6,
              background: limits.imageRemaining <= 0 ? `${C.coral}12` : `${C.lilac}12`,
              color: limits.imageRemaining <= 0 ? C.coral : C.lilac,
              border: `1px solid ${limits.imageRemaining <= 0 ? C.coral + "40" : C.lilac + "30"}`,
            }}>🖼 {limits.imageCount}/{limits.imageLimit}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6,
              background: limits.videoRemaining <= 0 ? `${C.coral}12` : `${C.gold}12`,
              color: limits.videoRemaining <= 0 ? C.coral : C.gold,
              border: `1px solid ${limits.videoRemaining <= 0 ? C.coral + "40" : C.gold + "30"}`,
            }}>🎬 {limits.videoCount}/{limits.videoLimit}</span>
          </div>

          {/* ── Toolbar Row 2: compact model selectors ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>

            {/* Image model */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700, whiteSpace: "nowrap" }}>🖼</span>
              <select value={effectiveImageModelId} onChange={e => { setImageModel(e.target.value); patchProjectSettings({ imageModelVersion: e.target.value }).catch(() => {}); }} style={{
                padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                border: `1px solid ${C.line}`, background: C.alert, color: C.mute2,
                outline: "none", fontFamily: "inherit", cursor: "pointer",
              }}>
                <optgroup label="GHS Standard">
                  <option value="segmind_flux">Segmind (Free)</option>
                  <option value="fal_flux_schnell">FLUX Schnell</option>
                </optgroup>
                <optgroup label="GHS Pro">
                  <option value="fal_flux_dev">FLUX Dev</option>
                  <option value="ideogram_free">Ideogram</option>
                </optgroup>
                <optgroup label="GHS Premium">
                  <option value="stable_diffusion_xl">SD XL</option>
                  <option value="ideogram_v2">Ideogram V2</option>
                </optgroup>
              </select>
            </div>

            <div style={{ width: 1, height: 16, background: C.line }} />

            {/* Voice — Henry 2026-06-04 voice unification: kept inline select for
                Free Mode's compact toolbar (don't change UI). Just extended the
                option list to expose the new providers wired in /api/tts. The
                canonical VoiceTierSelector is used on the bigger planners. */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700 }}>🎙</span>
              <select value={effectiveNarrationProvider} onChange={e => { setVoiceProvider(e.target.value); patchProjectSettings({ narrationProvider: e.target.value }).catch(() => {}); }} style={{
                padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                border: `1px solid ${C.line}`, background: C.alert, color: C.mute2,
                outline: "none", fontFamily: "inherit", cursor: "pointer",
              }}>
                <optgroup label="GHS Standard">
                  <option value="piper">Piper (Free)</option>
                </optgroup>
                <optgroup label="GHS Standard+">
                  <option value="edge-tts">Edge-TTS Nigerian (Free)</option>
                </optgroup>
                <optgroup label="GHS Pro">
                  <option value="fal_narrator">FAL Narrator</option>
                  <option value="ghs_karaoke">GHS Karaoke</option>
                </optgroup>
                <optgroup label="GHS Premium">
                  <option value="gemini">Gemini Flash</option>
                </optgroup>
                <optgroup label="GHS Best">
                  <option value="elevenlabs">ElevenLabs</option>
                </optgroup>
              </select>
            </div>

            <div style={{ width: 1, height: 16, background: C.line }} />

            {/* Music */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700 }}>🎵</span>
              <select value={effectiveSoundTier} onChange={e => { setMusicTier(e.target.value); patchProjectSettings({ soundTier: e.target.value }).catch(() => {}); }} style={{
                padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                border: `1px solid ${C.line}`, background: C.alert, color: C.mute2,
                outline: "none", fontFamily: "inherit", cursor: "pointer",
              }}>
                <optgroup label="GHS Standard">
                  <option value="stock">Stock (Free)</option>
                </optgroup>
                <optgroup label="GHS Pro">
                  <option value="fal_stable_audio">FAL Stable Audio</option>
                </optgroup>
                <optgroup label="GHS Karaoke">
                  <option value="ghs_karaoke">GHS Karaoke</option>
                  <option value="fal_karaoke">FAL Karaoke</option>
                </optgroup>
                <optgroup label="GHS Classic">
                  <option value="kie_classic">Kie.ai / Suno</option>
                </optgroup>
                <optgroup label="GHS Premium">
                  <option value="kie_premium">Kie Premium</option>
                </optgroup>
              </select>
            </div>

            <div style={{ width: 1, height: 16, background: C.line }} />

            {/* AI Brain (compact) */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700 }}>🧠</span>
              <select value={effectiveLlmProvider} onChange={e => { setLlmModel(e.target.value); patchProjectSettings({ llmProvider: e.target.value }).catch(() => {}); }} style={{
                padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                border: `1px solid ${C.line}`, background: C.alert, color: C.mute2,
                outline: "none", fontFamily: "inherit", cursor: "pointer",
              }}>
                <optgroup label="GHS Standard">
                  <option value="claude:claude-haiku-4-5-20251001">Haiku (Fast)</option>
                </optgroup>
                <optgroup label="GHS Pro">
                  <option value="claude:claude-sonnet-4-6">Sonnet</option>
                  <option value="openai:gpt-4o-mini">GPT-4o Mini</option>
                </optgroup>
                <optgroup label="GHS Local">
                  <option value="ollama:mistral">Ollama Mistral</option>
                  <option value="ollama:llama3">Ollama Llama 3</option>
                </optgroup>
              </select>
            </div>

            <div style={{ width: 1, height: 16, background: C.line }} />

            {/* Visual style (compact dropdown) */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700 }}>🎨</span>
              <select
                value={effectiveProjectStyle}
                onChange={e => {
                  const style = e.target.value;
                  setImageStyle(style);
                  setStylePromptOpen(false);
                  patchProjectSettings({ visualStyle: style }).catch(() => {});
                  // Henry 2026-06-05: auto-mode feel. Once a style is picked, fire
                  // image gen for the LATEST scene set so user doesn't have to click
                  // every scene's gen button. ~1.5s gap per call (see genAllImagesForMsg).
                  const lastMsg = [...messages].reverse().find(m => m.scenes && m.scenes.length > 0);
                  if (lastMsg) {
                    setTimeout(() => genAllImagesForMsg(lastMsg.id), 800);
                  }
                }}
                style={{
                  padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${stylePromptOpen ? C.gold + "80" : C.line}`,
                  background: stylePromptOpen ? `${C.gold}12` : C.alert,
                  color: stylePromptOpen ? C.gold : C.mute2,
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                }}
              >
                {Object.entries(VISUAL_STYLES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            <div style={{ width: 1, height: 16, background: C.line }} />

            {/* Subtitle style (compact dropdown) */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700 }}>💬</span>
              <select
                value={effectiveSubtitleMode}
                onChange={e => { setSubtitleStyle(e.target.value as "classic" | "cinema" | "neon" | "minimal" | "bold" | "none"); patchProjectSettings({ subtitleMode: e.target.value }).catch(() => {}); }}
                title="Subtitle style"
                style={{
                  padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${C.line}`, background: C.alert, color: C.mute2,
                  outline: "none", fontFamily: "inherit", cursor: "pointer",
                }}
              >
                <option value="classic">Classic</option>
                <option value="cinema">Cinema</option>
                <option value="neon">Neon</option>
                <option value="minimal">Minimal</option>
                <option value="bold">Bold</option>
                <option value="none">No Subs</option>
              </select>
            </div>

            <div style={{ flex: 1 }} />

            {/* ⚙ Customize toggle (optional expanded view) */}
            <button onClick={() => setShowCustomize(v => !v)} style={{
              padding: "3px 8px", borderRadius: 7, fontSize: 9, fontWeight: 700,
              border: `1px solid ${showCustomize ? C.sky + "60" : C.line}`,
              background: showCustomize ? `${C.sky}12` : "transparent",
              color: showCustomize ? C.sky : C.mute2, cursor: "pointer",
            }}>⚙ {showCustomize ? "Less" : "More"}</button>
          </div>

          {/* ── Optional expanded customize panel (SFX + video model defaults) ── */}
          {showCustomize && (
            <div style={{
              marginBottom: 8, padding: "10px 12px", borderRadius: 10,
              background: C.alert, border: `1px solid ${C.line}`,
              display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
            }}>
              {/* Video model default */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 3 }}>DEFAULT VIDEO</div>
                <select value={effectiveVideoModelId} onChange={e => { setVideoModel(e.target.value); patchProjectSettings({ videoModelVersion: e.target.value }).catch(() => {}); }} style={{
                  padding: "4px 6px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${C.line}`, background: C.card, color: C.mute2,
                  outline: "none", fontFamily: "inherit",
                }}>
                  <optgroup label="GHS Standard">
                    <option value="wan_2_5_lite">Wan Lite</option>
                  </optgroup>
                  <optgroup label="GHS Pro">
                    <option value="muapi_wan_v2_1_720p">Wan Pro 720p</option>
                    <option value="kling_v2_5_standard">Kling Standard</option>
                    <option value="hailuo_fast">Hailuo Fast</option>
                  </optgroup>
                  <optgroup label="GHS Premium">
                    <option value="kling_v2_5_pro">Kling Pro</option>
                    <option value="runway_gen4">Runway Gen-4</option>
                  </optgroup>
                </select>
              </div>
              {/* SFX */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 3 }}>SFX</div>
                <select value={sfxSource} onChange={e => setSfxSource(e.target.value)} style={{
                  padding: "4px 6px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                  border: `1px solid ${C.line}`, background: C.card, color: C.mute2,
                  outline: "none", fontFamily: "inherit",
                }}>
                  <optgroup label="GHS Standard">
                    <option value="auto">Auto Match</option>
                    <option value="local">Local Library</option>
                  </optgroup>
                  <optgroup label="GHS Pro">
                    <option value="elevenlabs">ElevenLabs SFX</option>
                  </optgroup>
                </select>
              </div>
              <div style={{ fontSize: 9, color: C.mute2, alignSelf: "center" }}>
                All settings apply to this session only
              </div>
            </div>
          )}

          {/* ── Style prompt banner (shown once if user hasn't picked a style) ── */}
          {stylePromptOpen && (
            <div style={{
              marginBottom: 8, padding: "8px 12px", borderRadius: 10,
              background: `${C.gold}10`, border: `1px solid ${C.gold}50`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>
                👇 Pick a visual style before generating images — it affects every scene below
              </span>
              <button onClick={() => setStylePromptOpen(false)} style={{
                marginLeft: "auto", background: "none", border: "none", color: C.mute2, cursor: "pointer", fontSize: 14,
              }}>×</button>
            </div>
          )}

          {/* ── Video generation (compact dropdown) ── */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 9, color: C.mute2, fontWeight: 700 }}>🎬</span>
            <select
              value={videoGenPicker ?? ""}
              onChange={e => {
                const v = e.target.value;
                setVideoGenPicker(v === "" ? null : (v as "text2vid" | "img2vid" | "motion"));
              }}
              style={{
                padding: "3px 5px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                border: `1px solid ${videoGenPicker ? C.sky + "80" : C.line}`,
                background: videoGenPicker ? `${C.sky}12` : C.alert,
                color: videoGenPicker ? C.sky : C.mute2,
                outline: "none", fontFamily: "inherit", cursor: "pointer",
              }}
            >
              <option value="">Generate Video…</option>
              <option value="text2vid">🎬 Text → Video</option>
              <option value="img2vid">🖼️→🎬 Image → Video</option>
              <option value="motion">🌀 Motion Video</option>
            </select>
          </div>

          {/* ── Inline video gen picker ── */}
          {videoGenPicker && (
            <div style={{
              marginBottom: 10, padding: "12px 14px", borderRadius: 10,
              background: C.alert, border: `1px solid ${C.sky}40`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.sky }}>
                  {videoGenPicker === "text2vid" ? "🎬 Text → Video" : videoGenPicker === "img2vid" ? "🖼️→🎬 Image → Video" : "🌀 Motion Video"}
                </span>
                <button onClick={() => setVideoGenPicker(null)} style={{ background: "none", border: "none", color: C.mute2, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
              </div>

              {/* Model + input grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>VIDEO MODEL</div>
                  <select value={videoGenModel} onChange={e => setVideoGenModel(e.target.value)} style={{
                    width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 7,
                    color: C.ink, fontSize: 10, padding: "5px 6px", outline: "none", fontFamily: "inherit",
                  }}>
                    <optgroup label="GHS Standard">
                      <option value="wan_2_5_lite">Wan Lite (up to 21s)</option>
                    </optgroup>
                    <optgroup label="GHS Pro">
                      <option value="muapi_wan_v2_1_720p">Wan Pro 720p</option>
                      <option value="kling_v2_5_standard">Kling Standard</option>
                      <option value="hailuo_fast">Hailuo Fast</option>
                    </optgroup>
                    <optgroup label="GHS Premium">
                      <option value="kling_v2_5_pro">Kling Pro</option>
                      <option value="runway_gen4">Runway Gen-4</option>
                    </optgroup>
                  </select>
                </div>
                {videoGenPicker === "text2vid" ? (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>PROMPT / IDEA</div>
                    <input
                      value={videoGenPrompt}
                      onChange={e => setVideoGenPrompt(e.target.value)}
                      placeholder="Describe the video you want…"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: C.card, border: `1px solid ${C.line}`, borderRadius: 7,
                        color: C.ink, fontSize: 10, padding: "5px 6px", outline: "none", fontFamily: "inherit",
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.mute2, marginBottom: 4 }}>IMAGE — URL or upload</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        value={videoGenImageUrl}
                        onChange={e => setVideoGenImageUrl(e.target.value)}
                        placeholder="Paste URL or upload ↑"
                        style={{
                          flex: 1, boxSizing: "border-box",
                          background: C.card, border: `1px solid ${C.line}`, borderRadius: 7,
                          color: C.ink, fontSize: 10, padding: "5px 6px", outline: "none", fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={() => imageUploadRef.current?.click()}
                        title="Upload from computer"
                        style={{
                          padding: "5px 8px", borderRadius: 7, fontSize: 10, cursor: "pointer",
                          border: `1px solid ${C.line}`, background: C.card, color: C.mute2,
                        }}
                      >📁</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Duration row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.mute2 }}>DURATION:</span>
                {(videoGenPicker === "motion" ? [5, 10, 16, 21] : [5, 10, 15, 30]).map(v => (
                  <button key={v} onClick={() => { setVideoGenDuration(v); setVideoGenCustomDur(""); }} style={{
                    padding: "4px 8px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${videoGenDuration === v && !videoGenCustomDur ? C.sky + "60" : C.line}`,
                    background: videoGenDuration === v && !videoGenCustomDur ? `${C.sky}15` : "transparent",
                    color: videoGenDuration === v && !videoGenCustomDur ? C.sky : C.mute2,
                  }}>{v}s</button>
                ))}
                <input
                  value={videoGenCustomDur}
                  onChange={e => setVideoGenCustomDur(e.target.value.replace(/\D/g, ""))}
                  placeholder="sec"
                  style={{
                    width: 44, padding: "4px 6px", borderRadius: 7, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${videoGenCustomDur ? C.sky + "60" : C.line}`,
                    background: videoGenCustomDur ? `${C.sky}15` : "transparent",
                    color: videoGenCustomDur ? C.sky : C.mute2, outline: "none",
                    fontFamily: "inherit", textAlign: "center",
                  }}
                />
                {videoGenPicker === "motion" && (
                  <span style={{ fontSize: 9, color: C.mute2 }}>Wan supports up to 21s</span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={async () => {
                    if (videoGenRunning) return;
                    const isText = videoGenPicker === "text2vid";
                    const isMotion = videoGenPicker === "motion";
                    const promptVal = isText ? videoGenPrompt : videoGenImageUrl;
                    if (!promptVal.trim()) return;
                    const dur = videoGenCustomDur ? Math.min(Math.max(parseInt(videoGenCustomDur, 10), 1), isMotion ? 21 : 300) : videoGenDuration;
                    setVideoGenRunning(true);
                    try {
                      const body = isText
                        ? { prompt: promptVal, model: videoGenModel, duration: dur, aspectRatio: "9:16" }
                        : { imageUrl: promptVal, model: videoGenModel, mode: "image_to_video", duration: dur, aspectRatio: "9:16" };
                      const res = await fetch("/api/video/generate", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      const d = res.ok ? await res.json() : null;
                      if (d?.outputUrl) {
                        const icon = isText ? "🎬" : isMotion ? "🌀" : "🖼️→🎬";
                        const label = isText ? "Text → Video" : isMotion ? "Motion Video" : "Image → Video";
                        const sceneObj: Scene = {
                          id: "vg-" + genId(),
                          title: label,
                          text:  promptVal,
                          mood:  "neutral",
                          videoUrl: d.outputUrl,
                          imageUrl: !isText ? promptVal : undefined,
                        };
                        const dbId = await saveAssetToHistory(`${icon} ${label} ready`, [sceneObj]);
                        setMessages(prev => [...prev, {
                          id: dbId ?? ("a-" + genId()),
                          role: "assistant" as const,
                          content: `${icon} ${label} ready`,
                          scenes: [sceneObj],
                          timestamp: Date.now(),
                        }]);
                        setVideoGenPicker(null);
                        setVideoGenPrompt("");
                        setVideoGenImageUrl("");
                      } else {
                        setMessages(prev => [...prev, {
                          id: "a-" + genId(), role: "assistant" as const,
                          content: "Video generation failed — check model settings or try again.", timestamp: Date.now(),
                        }]);
                      }
                    } catch { /* silent */ }
                    setVideoGenRunning(false);
                  }}
                  disabled={videoGenRunning}
                  style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer",
                    border: "none",
                    background: videoGenRunning ? C.mute : "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                    color: "#fff",
                  }}
                >{videoGenRunning ? "Generating…" : "Generate Now"}</button>
                <button
                  onClick={async () => {
                    if (videoGenRunning) return;
                    const isText = videoGenPicker === "text2vid";
                    const isMotion = videoGenPicker === "motion";
                    const defaultPrompt = isText ? (input.trim() || "A cinematic short scene") : videoGenImageUrl;
                    if (!defaultPrompt) return;
                    setVideoGenRunning(true);
                    try {
                      const body = isText
                        ? { prompt: defaultPrompt, model: "wan_2_5_lite", duration: 5, aspectRatio: "9:16" }
                        : { imageUrl: defaultPrompt, model: "wan_2_5_lite", mode: "image_to_video", duration: isMotion ? 10 : 5, aspectRatio: "9:16" };
                      const res = await fetch("/api/video/generate", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      const d = res.ok ? await res.json() : null;
                      if (d?.outputUrl) {
                        const sceneObj: Scene = {
                          id: "vg-" + genId(),
                          title: isText ? "Text → Video" : isMotion ? "Motion Video" : "Image → Video",
                          text:  defaultPrompt,
                          mood:  "neutral",
                          videoUrl: d.outputUrl,
                          imageUrl: !isText ? defaultPrompt : undefined,
                        };
                        const dbId = await saveAssetToHistory("🎬 Video ready", [sceneObj]);
                        setMessages(prev => [...prev, {
                          id: dbId ?? ("a-" + genId()),
                          role: "assistant" as const,
                          content: "🎬 Video ready",
                          scenes: [sceneObj],
                          timestamp: Date.now(),
                        }]);
                        setVideoGenPicker(null);
                      }
                    } catch { /* silent */ }
                    setVideoGenRunning(false);
                  }}
                  disabled={videoGenRunning}
                  style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${C.line}`, background: "transparent", color: C.mute2,
                  }}
                >Use Default (Wan Lite)</button>
              </div>
            </div>
          )}

          {/* Text input */}
          <div style={{ position: "relative" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your story, movie idea, ad concept, or anything creative…"
              rows={2}
              disabled={sending}
              style={{
                width: "100%", boxSizing: "border-box",
                background: C.alert, border: `1.5px solid ${C.line}`,
                borderRadius: 12, color: C.ink, fontSize: 13,
                padding: "11px 96px 11px 14px",
                resize: "none", outline: "none", lineHeight: 1.65,
                fontFamily: "inherit", transition: "border-color 0.2s",
                opacity: sending ? 0.6 : 1,
              }}
              onFocus={e => (e.target.style.borderColor = C.sky + "80")}
              onBlur={e => (e.target.style.borderColor = C.line)}
            />
            {/* Polish prompt button */}
            <button
              onClick={async () => {
                if (!input.trim()) return;
                const res = await fetch("/api/hybrid/scene-polish", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sceneId: "prompt", currentText: input.trim(), action: "polish" }),
                });
                if (res.ok) {
                  const d = await res.json();
                  if (d.polishedText) setInput(d.polishedText);
                }
              }}
              disabled={!input.trim() || sending}
              title="Polish this prompt"
              style={{
                position: "absolute", bottom: 8, right: 50,
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: input.trim() ? `${C.lilac}20` : "transparent",
                color: input.trim() ? C.lilac : C.mute2,
                fontSize: 14, cursor: input.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >✨</button>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || sending}
              style={{
                position: "absolute", bottom: 8, right: 8,
                width: 36, height: 36, borderRadius: 9, border: "none",
                background: (!input.trim() || sending)
                  ? C.alert
                  : "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%)",
                color: (!input.trim() || sending) ? C.mute : "#fff",
                fontSize: 16, cursor: (!input.trim() || sending) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: (!input.trim() || sending) ? "none" : "0 3px 16px rgba(236,72,153,0.45)",
                transition: "all 0.15s",
              }}
            >{sending ? "⟳" : "↑"}</button>
          </div>
          <div style={{ fontSize: 10, color: C.mute2, marginTop: 4 }}>
            ⌘↵ to send
          </div>
        </div>
      </div>

        </div>{/* /chat column */}
      </div>{/* /body row */}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function FreeModePageWrapper() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#0e0e10",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700 }}>Loading Free Mode…</div>
      </div>
    }>
      <FreeModeChat />
    </Suspense>
  );
}
