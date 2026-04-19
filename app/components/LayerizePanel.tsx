"use client";

// LayerizePanel — inline text editor for Ideogram V3 Layerize results.
// Shows the background image + live overlay preview on the left.
// Editable text fields for each extracted layer on the right.
// Preview is free (browser-only). Save persists edits to DB.

import { useState, useRef, useCallback } from "react";

export interface LayerizeSpan {
  text: string;
  style: string;   // "h1" | "h2" | "body" | "small"
  font_size: number;
  color: string;
}

export interface LayerizeContainer {
  container: { x: number; y: number; width: number; height: number };
  items: Array<{ spans: LayerizeSpan[] }>;
}

export interface LayerizeResult {
  designId?: string;
  backgroundUrl: string;
  textContainers: LayerizeContainer[];
  overlayHtml: string;
  sourceImageUrl: string;
}

interface Props {
  result: LayerizeResult;
  onClose: () => void;
  onSaved?: (designId: string) => void;
}

const STYLE_LABELS: Record<string, string> = {
  h1: "H1 — Main Heading",
  h2: "H2 — Sub Heading",
  body: "Body — Regular Text",
  small: "Small — Fine Print",
};

export default function LayerizePanel({ result, onClose, onSaved }: Props) {
  // Flatten all spans into an editable list: [{containerIdx, itemIdx, spanIdx, span}]
  type EditableSpan = { cIdx: number; iIdx: number; sIdx: number; span: LayerizeSpan };
  const allSpans: EditableSpan[] = [];
  result.textContainers.forEach((c, cIdx) => {
    c.items.forEach((item, iIdx) => {
      item.spans.forEach((span, sIdx) => {
        allSpans.push({ cIdx, iIdx, sIdx, span });
      });
    });
  });

  const [edits, setEdits] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    allSpans.forEach(({ cIdx, iIdx, sIdx, span }) => {
      init[`${cIdx}_${iIdx}_${sIdx}`] = span.text;
    });
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liveHtml, setLiveHtml] = useState(result.overlayHtml);
  const overlayRef = useRef<HTMLDivElement>(null);

  function buildUpdatedHtml(currentEdits: Record<string, string>): string {
    // Replace each span's text in the overlay HTML using the original text as a search key.
    // This is approximate — a robust implementation would parse the HTML properly.
    let html = result.overlayHtml;
    allSpans.forEach(({ cIdx, iIdx, sIdx, span }) => {
      const newText = currentEdits[`${cIdx}_${iIdx}_${sIdx}`];
      if (newText !== undefined && newText !== span.text) {
        // Replace exact text content in the HTML (global replace handles duplicates)
        html = html.split(`>${span.text}<`).join(`>${newText}<`);
      }
    });
    return html;
  }

  const handleEdit = useCallback((key: string, value: string) => {
    setEdits(prev => {
      const next = { ...prev, [key]: value };
      setLiveHtml(buildUpdatedHtml(next));
      return next;
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const textEdits = Object.entries(edits).map(([key, text]) => {
        const [cIdx, iIdx, sIdx] = key.split("_").map(Number);
        const original = result.textContainers[cIdx]?.items[iIdx]?.spans[sIdx];
        return { key, original: original?.text, edited: text, style: original?.style };
      });

      let designId = result.designId;

      if (!designId) {
        // First save — create a new layerized design
        const res = await fetch("/api/layerize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: result.sourceImageUrl,
          }),
        });
        const data = await res.json();
        designId = data.designId;
      }

      if (designId) {
        await fetch("/api/layerize", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designId, textEdits }),
        });
        setSaved(true);
        onSaved?.(designId);
      }
    } catch (e) {
      console.error("[LayerizePanel] save error:", e);
    }
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-end",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
    }}>
      <div style={{
        width: "100%", maxHeight: "85vh", background: "#0e1220",
        border: "1px solid #1e2a3a", borderRadius: "20px 20px 0 0",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "slideUpPanel 0.25s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid #1e2a3a",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>🔤</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#ededf5" }}>Edit Text Layers</p>
              <p style={{ fontSize: 10, color: "#6b6b8a" }}>
                {allSpans.length} text element{allSpans.length !== 1 ? "s" : ""} extracted — edits are free, no API call
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: "50%", border: "1px solid #1e2a3a",
            background: "transparent", color: "#6b6b8a", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

          {/* LEFT — preview */}
          <div style={{
            width: "45%", flexShrink: 0, borderRight: "1px solid #1e2a3a",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: 24, background: "#090c14",
            overflow: "hidden",
          }}>
            <p style={{ fontSize: 9, color: "#3a3a58", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Live Preview</p>
            <div style={{ position: "relative", maxWidth: "100%", maxHeight: "55vh" }}>
              {/* Background image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.backgroundUrl}
                alt="background"
                style={{ display: "block", maxWidth: "100%", maxHeight: "55vh", borderRadius: 8 }}
              />
              {/* Text overlay */}
              <div
                ref={overlayRef}
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
                dangerouslySetInnerHTML={{ __html: liveHtml }}
              />
            </div>
            <p style={{ fontSize: 9, color: "#3a3a58", marginTop: 10 }}>
              Updates instantly as you type →
            </p>
          </div>

          {/* RIGHT — text fields */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {allSpans.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#3a3a58" }}>
                <p style={{ fontSize: 24, marginBottom: 12 }}>🔍</p>
                <p style={{ fontSize: 13 }}>No text layers found in this image.</p>
                <p style={{ fontSize: 11, marginTop: 6 }}>The image may not contain extractable text.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 10, color: "#3a3a58", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  Edit text content — font size and color are preserved automatically
                </p>
                {allSpans.map(({ cIdx, iIdx, sIdx, span }) => {
                  const key = `${cIdx}_${iIdx}_${sIdx}`;
                  return (
                    <div key={key} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8,
                          padding: "2px 6px", borderRadius: 4,
                          background: span.style === "h1" ? "rgba(139,92,246,0.2)" :
                                      span.style === "h2" ? "rgba(59,130,246,0.2)" :
                                      span.style === "body" ? "rgba(34,197,94,0.15)" : "rgba(107,107,138,0.2)",
                          color: span.style === "h1" ? "#a855f7" :
                                 span.style === "h2" ? "#3b82f6" :
                                 span.style === "body" ? "#22c55e" : "#6b6b8a",
                        }}>
                          {span.style.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: "#3a3a58" }}>
                          {STYLE_LABELS[span.style] ?? span.style} · {span.font_size}px
                        </span>
                        <span style={{
                          width: 14, height: 14, borderRadius: 3, border: "1px solid #1e2a3a",
                          background: span.color, flexShrink: 0,
                        }} />
                      </div>
                      <input
                        value={edits[key] ?? span.text}
                        onChange={e => handleEdit(key, e.target.value)}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: "#131828", border: "1.5px solid #1e2a3a",
                          borderRadius: 9, color: "#ededf5", fontSize: 14,
                          padding: "10px 14px", outline: "none",
                          fontWeight: span.style === "h1" ? 900 : span.style === "h2" ? 700 : 400,
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = "#3b82f680"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "#1e2a3a"; }}
                        placeholder={span.text}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #1e2a3a",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 10, flexShrink: 0,
        }}>
          <p style={{ fontSize: 10, color: "#3a3a58", flex: 1 }}>
            ✦ Preview is live in the left panel. Saving stores edits to your design history.
          </p>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 9, border: "1px solid #1e2a3a",
            background: "transparent", color: "#6b6b8a", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || allSpans.length === 0}
            style={{
              padding: "9px 24px", borderRadius: 9, border: "none",
              background: saved ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: saved ? "#22c55e" : "#fff",
              fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saved ? "none" : "0 4px 20px rgba(59,130,246,0.35)",
              transition: "all 0.2s",
            }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Version"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUpPanel {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
