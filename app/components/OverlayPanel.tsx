"use client";

import { useState, useRef } from "react";
import type {
  OverlayLayer,
  TextLayer,
  ImageLayer,
  AnimationEntrance,
} from "@/modules/ffmpeg/overlay";

interface OverlayPanelProps {
  videoPath: string | null;
  contentItemId?: string;
  layers: OverlayLayer[];
  onChange: (layers: OverlayLayer[]) => void;
  onApplied?: (outputPath: string) => void;
}

let layerCounter = 0;

const ANIMATION_OPTIONS: { value: AnimationEntrance; label: string }[] = [
  { value: "none",         label: "None"          },
  { value: "slide_left",   label: "Slide Left"    },
  { value: "slide_right",  label: "Slide Right"   },
  { value: "slide_top",    label: "Slide Top"     },
  { value: "slide_bottom", label: "Slide Bottom"  },
  { value: "fade_in",      label: "Fade In"       },
  { value: "pop_in",       label: "Pop In"        },
  { value: "typewriter",   label: "Typewriter"    },
];

function makeTextLayer(): TextLayer {
  return {
    type: "text",
    id: `text_${Date.now()}_${++layerCounter}`,
    text: "Your text here",
    position: { zone: "bottom" },
    style: { fontSize: 48, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: false },
    animation: { entrance: "none", startSec: 0, durationSec: 5 },
  };
}

function makeImageLayer(): ImageLayer {
  return {
    type: "image",
    id: `img_${Date.now()}_${++layerCounter}`,
    imagePath: "",
    position: { zone: "bottom-right" },
    size: { width: 200, height: 80 },
    animation: { entrance: "none", startSec: 0, durationSec: 999 },
  };
}

export default function OverlayPanel({
  videoPath,
  contentItemId,
  layers,
  onChange,
  onApplied,
}: OverlayPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState("");
  const previewAbortRef = useRef<AbortController | null>(null);
  const applyAbortRef = useRef<AbortController | null>(null);

  function addTextLayer() {
    onChange([...layers, makeTextLayer()]);
  }

  function addImageLayer() {
    onChange([...layers, makeImageLayer()]);
  }

  function removeLayer(id: string) {
    onChange(layers.filter(l => l.id !== id));
  }

  function updateLayer(id: string, patch: Partial<OverlayLayer>) {
    onChange(layers.map(l => l.id === id ? { ...l, ...patch } as OverlayLayer : l));
  }

  function updateTextStyle(id: string, patch: Partial<TextLayer["style"]>) {
    const layer = layers.find(l => l.id === id) as TextLayer | undefined;
    if (!layer) return;
    updateLayer(id, { style: { ...layer.style, ...patch } });
  }

  function updateAnimation(id: string, patch: Partial<OverlayLayer["animation"]>) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    updateLayer(id, { animation: { ...layer.animation, ...patch } } as Partial<OverlayLayer>);
  }

  async function handlePreview() {
    if (!videoPath) return;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPreviewLoading(true);
    setPreviewUrl(null);
    setApplyError("");
    try {
      const res = await fetch("/api/overlays/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, layers, startSec: 2, durationSec: 3 }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewUrl(data.previewUrl);
      } else {
        setApplyError(data.error ?? "Preview failed");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setApplyError("Network error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleApply() {
    if (!contentItemId) return;
    applyAbortRef.current?.abort();
    const controller = new AbortController();
    applyAbortRef.current = controller;
    setApplyLoading(true);
    setApplyError("");
    try {
      const res = await fetch("/api/overlays/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId, layers }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok) {
        onApplied?.(data.outputPath);
      } else {
        setApplyError(data.error ?? "Apply failed");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setApplyError("Network error");
    } finally {
      setApplyLoading(false);
    }
  }

  const collapsedSummary = layers.length === 0 ? "No layers" : `${layers.length} layer${layers.length > 1 ? "s" : ""}`;

  return (
    <div style={{ border: "1px solid #333", borderRadius: 8, background: "#0f0f0f", marginBottom: 16 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: "#e5e5e5",
          fontWeight: 600, fontSize: 14,
        }}
      >
        <span>✏️ Text & Image Overlays</span>
        <span style={{ fontSize: 12, color: "#888" }}>{collapsedSummary} {expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Add layer buttons + presets */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={addTextLayer} style={addBtnStyle}>+ Add Text</button>
            <button onClick={addImageLayer} style={addBtnStyle}>+ Add Image</button>
            <button onClick={async () => {
              try {
                const res = await fetch("/api/overlays/presets");
                const data = await res.json();
                const presets = data.presets ?? [];
                if (presets.length === 0) return;
                const names = presets.map((p: { id: string; name: string }, i: number) => `${i + 1}. ${p.name}`).join("\n");
                const choice = prompt(`Choose a preset:\n${names}\n\nEnter number:`);
                if (!choice) return;
                const idx = parseInt(choice) - 1;
                const preset = presets[idx];
                if (!preset?.layers) return;
                const newLayers: OverlayLayer[] = preset.layers.map((l: Record<string, unknown>) => ({
                  ...l,
                  id: `${l.type}_${Date.now()}_${++layerCounter}`,
                })) as OverlayLayer[];
                onChange([...layers, ...newLayers]);
              } catch { /* ignore */ }
            }} style={{ ...addBtnStyle, background: "#7c5cfc", color: "#fff" }}>🎨 Load Preset</button>
          </div>

          {/* Layer editors */}
          {layers.map((layer, i) => (
            <div key={layer.id} style={{ border: "1px solid #2a2a2a", borderRadius: 6, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>
                  Layer {i + 1} — {layer.type === "text" ? "Text" : "Image"}
                </span>
                <button
                  onClick={() => removeLayer(layer.id)}
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13 }}
                >
                  Remove
                </button>
              </div>

              {layer.type === "text" && (
                <TextLayerEditor
                  layer={layer as TextLayer}
                  onTextChange={text => updateLayer(layer.id, { text })}
                  onPositionChange={position => updateLayer(layer.id, { position } as Partial<TextLayer>)}
                  onStyleChange={patch => updateTextStyle(layer.id, patch)}
                  onAnimationChange={patch => updateAnimation(layer.id, patch)}
                />
              )}

              {layer.type === "image" && (
                <ImageLayerEditor
                  layer={layer as ImageLayer}
                  onPathChange={imagePath => updateLayer(layer.id, { imagePath })}
                  onPositionChange={position => updateLayer(layer.id, { position } as Partial<ImageLayer>)}
                  onSizeChange={(width, height) => updateLayer(layer.id, { size: { width, height } })}
                  onAnimationChange={patch => updateAnimation(layer.id, patch)}
                />
              )}
            </div>
          ))}

          {/* Actions */}
          {layers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handlePreview}
                  disabled={!videoPath || previewLoading}
                  style={{ ...actionBtnStyle, background: "#1d4ed8" }}
                >
                  {previewLoading ? "Rendering preview…" : "PREVIEW (3 sec)"}
                </button>
                {contentItemId && (
                  <button
                    onClick={handleApply}
                    disabled={applyLoading}
                    style={{ ...actionBtnStyle, background: "#16a34a" }}
                  >
                    {applyLoading ? "Applying…" : "APPLY TO VIDEO"}
                  </button>
                )}
              </div>

              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  style={{ maxWidth: 320, borderRadius: 6, marginTop: 4 }}
                />
              )}

              {applyError && (
                <span style={{ color: "#f87171", fontSize: 12 }}>{applyError}</span>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Text layer editor sub-component ────────────────────────────────────────

function TextLayerEditor({
  layer,
  onTextChange,
  onPositionChange,
  onStyleChange,
  onAnimationChange,
}: {
  layer: TextLayer;
  onTextChange: (text: string) => void;
  onPositionChange: (position: TextLayer["position"]) => void;
  onStyleChange: (patch: Partial<TextLayer["style"]>) => void;
  onAnimationChange: (patch: Partial<TextLayer["animation"]>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <FieldRow label="Text">
        <textarea
          value={layer.text}
          onChange={e => onTextChange(e.target.value)}
          rows={2}
          style={inputStyle}
          placeholder="Enter text (supports multiple lines)"
        />
      </FieldRow>
      <FieldRow label="Position">
        <select value={layer.position.zone} onChange={e => onPositionChange({ zone: e.target.value as TextLayer["position"]["zone"] })} style={inputStyle}>
          <option value="top">Top</option>
          <option value="center">Center</option>
          <option value="bottom">Bottom</option>
          <option value="free">Drag / Custom</option>
        </select>
      </FieldRow>
      {/* Visual drag position preview */}
      {layer.position.zone === "free" && (
        <div>
          <div
            style={{
              width: "100%", height: 120, background: "#080818", border: "1px solid #2a2a40",
              borderRadius: 6, position: "relative", cursor: "crosshair", overflow: "hidden",
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
              const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
              onPositionChange({ zone: "free", x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
            }}
          >
            {/* Safe zone guides */}
            <div style={{ position: "absolute", inset: "10%", border: "1px dashed #1a1a2e", borderRadius: 2 }} />
            {/* Current position marker */}
            <div style={{
              position: "absolute",
              left: `${layer.position.x ?? 50}%`,
              top: `${layer.position.y ?? 50}%`,
              transform: "translate(-50%, -50%)",
              background: "#7c5cfc",
              color: "white",
              fontSize: 8,
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 0 8px rgba(124,92,252,0.4)",
            }}>
              {layer.text.slice(0, 15)}{layer.text.length > 15 ? "…" : ""}
            </div>
            {/* Grid lines */}
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#1a1a2e" }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#1a1a2e" }} />
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <input type="number" min={0} max={100} value={layer.position.x ?? 50}
              onChange={e => onPositionChange({ ...layer.position, x: Number(e.target.value) })}
              style={{ ...inputStyle, width: 55, fontSize: 10 }} />
            <span style={{ color: "#3a3a5a", fontSize: 10, lineHeight: "28px" }}>x</span>
            <input type="number" min={0} max={100} value={layer.position.y ?? 50}
              onChange={e => onPositionChange({ ...layer.position, y: Number(e.target.value) })}
              style={{ ...inputStyle, width: 55, fontSize: 10 }} />
            <span style={{ color: "#3a3a5a", fontSize: 10, lineHeight: "28px" }}>%</span>
          </div>
        </div>
      )}
      <FieldRow label="Font size">
        <input type="number" min={12} max={200} value={layer.style.fontSize}
          onChange={e => onStyleChange({ fontSize: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />
      </FieldRow>
      <FieldRow label="Color">
        <input type="color" value={layer.style.color}
          onChange={e => onStyleChange({ color: e.target.value })} style={{ height: 30, width: 48, padding: 2, cursor: "pointer" }} />
        <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{layer.style.color}</span>
      </FieldRow>
      <FieldRow label="Font family">
        <select value={layer.style.fontFamily ?? ""} onChange={e => onStyleChange({ fontFamily: e.target.value || undefined })} style={inputStyle}>
          <option value="">Default</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Impact">Impact</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
        </select>
      </FieldRow>
      <FieldRow label="Style">
        <label style={checkboxLabel}>
          <input type="checkbox" checked={layer.style.fontWeight === "bold"} onChange={e => onStyleChange({ fontWeight: e.target.checked ? "bold" : "normal" })} /> Bold
        </label>
        <label style={checkboxLabel}>
          <input type="checkbox" checked={!!layer.style.italic} onChange={e => onStyleChange({ italic: e.target.checked })} /> Italic
        </label>
        <label style={checkboxLabel}>
          <input type="checkbox" checked={!!layer.style.uppercase} onChange={e => onStyleChange({ uppercase: e.target.checked })} /> UPPERCASE
        </label>
        <label style={checkboxLabel}>
          <input type="checkbox" checked={layer.style.shadow} onChange={e => onStyleChange({ shadow: e.target.checked })} /> Shadow
        </label>
        <label style={checkboxLabel}>
          <input type="checkbox" checked={layer.style.outline} onChange={e => onStyleChange({ outline: e.target.checked })} /> Outline
        </label>
      </FieldRow>
      {layer.style.outline && (
        <FieldRow label="Outline">
          <input type="color" value={layer.style.outlineColor ?? "#000000"}
            onChange={e => onStyleChange({ outlineColor: e.target.value })} style={{ height: 28, width: 40, padding: 1, cursor: "pointer" }} />
          <input type="number" min={1} max={5} value={layer.style.outlineWidth ?? 2}
            onChange={e => onStyleChange({ outlineWidth: Number(e.target.value) })} style={{ ...inputStyle, width: 50 }} />
          <span style={{ fontSize: 10, color: "#888" }}>px</span>
        </FieldRow>
      )}
      <FieldRow label="Background">
        <select value={layer.style.bgColor ?? ""} onChange={e => onStyleChange({ bgColor: e.target.value || undefined })} style={inputStyle}>
          <option value="">None</option>
          <option value="black@0.5">Dark box (50%)</option>
          <option value="black@0.8">Dark box (80%)</option>
          <option value="white@0.9">White card</option>
          <option value="white@0.5">Light box (50%)</option>
          <option value="#7c5cfc@0.9">Purple accent</option>
          <option value="#22c55e@0.9">Green accent</option>
          <option value="#ef4444@0.9">Red accent</option>
        </select>
      </FieldRow>
      {layer.style.bgColor && (
        <FieldRow label="Card style">
          <input type="number" min={0} max={30} value={layer.style.bgPadding ?? 0}
            onChange={e => onStyleChange({ bgPadding: Number(e.target.value) })} style={{ ...inputStyle, width: 50 }} placeholder="Pad" />
          <span style={{ fontSize: 10, color: "#888", margin: "0 4px" }}>padding</span>
          <input type="number" min={0} max={30} value={layer.style.bgRadius ?? 0}
            onChange={e => onStyleChange({ bgRadius: Number(e.target.value) })} style={{ ...inputStyle, width: 50 }} placeholder="Radius" />
          <span style={{ fontSize: 10, color: "#888" }}>radius</span>
        </FieldRow>
      )}
      <AnimationRow animation={layer.animation} onChange={onAnimationChange} />
    </div>
  );
}

// ── Image layer editor sub-component ───────────────────────────────────────

function ImageLayerEditor({
  layer,
  onPathChange,
  onPositionChange,
  onSizeChange,
  onAnimationChange,
}: {
  layer: ImageLayer;
  onPathChange: (path: string) => void;
  onPositionChange: (position: ImageLayer["position"]) => void;
  onSizeChange: (w: number, h: number) => void;
  onAnimationChange: (patch: Partial<ImageLayer["animation"]>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <FieldRow label="Image path">
        <input type="text" value={layer.imagePath} onChange={e => onPathChange(e.target.value)}
          placeholder="storage/uploads/logo.png" style={inputStyle} />
      </FieldRow>
      <FieldRow label="Position">
        <select value={layer.position.zone} onChange={e => onPositionChange({ zone: e.target.value as ImageLayer["position"]["zone"] })} style={inputStyle}>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="center">Center</option>
          <option value="free">Free position</option>
        </select>
      </FieldRow>
      {layer.position.zone === "free" && (
        <FieldRow label="X / Y (%)">
          <input type="number" min={0} max={100} value={layer.position.x ?? 50}
            onChange={e => onPositionChange({ ...layer.position, x: Number(e.target.value) })}
            style={{ ...inputStyle, width: 60 }} placeholder="X" />
          <span style={{ color: "#888", margin: "0 4px" }}>/</span>
          <input type="number" min={0} max={100} value={layer.position.y ?? 50}
            onChange={e => onPositionChange({ ...layer.position, y: Number(e.target.value) })}
            style={{ ...inputStyle, width: 60 }} placeholder="Y" />
        </FieldRow>
      )}
      <FieldRow label="Size (px)">
        <input type="number" min={20} max={1920} value={layer.size.width}
          onChange={e => onSizeChange(Number(e.target.value), layer.size.height)}
          style={{ ...inputStyle, width: 70 }} placeholder="W" />
        <span style={{ color: "#888", margin: "0 4px" }}>×</span>
        <input type="number" min={20} max={1920} value={layer.size.height}
          onChange={e => onSizeChange(layer.size.width, Number(e.target.value))}
          style={{ ...inputStyle, width: 70 }} placeholder="H" />
      </FieldRow>
      <AnimationRow animation={layer.animation} onChange={onAnimationChange} />
    </div>
  );
}

// ── Shared animation row ────────────────────────────────────────────────────

function AnimationRow({
  animation,
  onChange,
}: {
  animation: { entrance: AnimationEntrance; startSec: number; durationSec: number };
  onChange: (patch: Partial<typeof animation>) => void;
}) {
  return (
    <>
      <FieldRow label="Animation">
        <select value={animation.entrance} onChange={e => onChange({ entrance: e.target.value as AnimationEntrance })} style={inputStyle}>
          {ANIMATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Timing">
        <span style={{ fontSize: 12, color: "#888" }}>Start</span>
        <input type="number" min={0} step={0.5} value={animation.startSec}
          onChange={e => onChange({ startSec: Number(e.target.value) })}
          style={{ ...inputStyle, width: 60, margin: "0 8px" }} />
        <span style={{ fontSize: 12, color: "#888" }}>s &nbsp; Duration</span>
        <input type="number" min={0.5} step={0.5} value={animation.durationSec}
          onChange={e => onChange({ durationSec: Number(e.target.value) })}
          style={{ ...inputStyle, width: 60, marginLeft: 8 }} />
        <span style={{ fontSize: 12, color: "#888", marginLeft: 4 }}>s</span>
      </FieldRow>
    </>
  );
}

// ── Shared layout helpers ───────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#888", minWidth: 90 }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a", color: "#e5e5e5", border: "1px solid #333",
  borderRadius: 4, padding: "3px 7px", fontSize: 12, width: "100%",
};

const checkboxLabel: React.CSSProperties = {
  fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#ccc",
};

const addBtnStyle: React.CSSProperties = {
  background: "#1a1a2e", color: "#b090ff", border: "1px solid #2a2a40",
  borderRadius: 4, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600,
};

const actionBtnStyle: React.CSSProperties = {
  color: "#fff", border: "none", borderRadius: 4, padding: "6px 14px",
  fontSize: 13, cursor: "pointer", fontWeight: 600,
};
