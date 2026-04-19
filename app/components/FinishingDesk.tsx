"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Finishing Desk — Review area for fixing/replacing without restart
//
// From Multi-Mode Architecture doc:
// "Finishing desk: review area where user fixes/replaces/regenerates
//  without restarting everything"
//
// Per-layer editable controls: narration, dialogue, voice, music,
// ambience, SFX, volumes — all adjustable without full rebuild.
// ═══════════════════════════════════════════════════════════════════════════

interface FinishingLayer {
  id: string;
  type: "narration" | "dialogue" | "music" | "ambience" | "sfx" | "video" | "subtitle";
  label: string;
  status: "approved" | "needs_edit" | "regenerating" | "missing";
  volume: number;
  sourceUrl?: string;
  description?: string;
}

interface FinishingDeskProps {
  projectTitle: string;
  layers: FinishingLayer[];
  onLayerAction: (layerId: string, action: "replace" | "regenerate" | "remove" | "approve" | "volume_change", value?: number) => void;
  onApproveAll: () => void;
  onExport: () => void;
}

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const green = "#22c55e";
const gold = "#f59e0b";
const red = "#ef4444";
const cyan = "#00d4ff";

const TYPE_ICONS: Record<string, string> = {
  narration: "🎙", dialogue: "💬", music: "🎵", ambience: "🌳", sfx: "💥", video: "🎬", subtitle: "📝",
};

const STATUS_COLORS: Record<string, string> = {
  approved: green, needs_edit: gold, regenerating: purple, missing: red,
};

export default function FinishingDesk({ projectTitle, layers, onLayerAction, onApproveAll, onExport }: FinishingDeskProps) {
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);

  const approvedCount = layers.filter(l => l.status === "approved").length;
  const allApproved = approvedCount === layers.length;
  const hasMissing = layers.some(l => l.status === "missing");

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 14, padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🎛</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Finishing Desk</p>
            <p style={{ fontSize: 10, color: muted }}>{projectTitle} — {approvedCount}/{layers.length} layers approved</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onApproveAll} disabled={hasMissing}
            style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${green}30`, background: `${green}10`, color: green, fontSize: 11, fontWeight: 600, cursor: hasMissing ? "not-allowed" : "pointer" }}>
            Approve All
          </button>
          <button onClick={onExport} disabled={!allApproved}
            style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: allApproved ? green : "#2a2a40", color: allApproved ? "#000" : muted, fontSize: 11, fontWeight: 700, cursor: allApproved ? "pointer" : "not-allowed" }}>
            Export Final →
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#1a1a2e", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(approvedCount / layers.length) * 100}%`, background: green, borderRadius: 2, transition: "width 0.3s" }} />
      </div>

      {/* Layer list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {layers.map(layer => (
          <div key={layer.id} style={{ background: "#080b10", border: `1px solid ${expandedLayer === layer.id ? purple : STATUS_COLORS[layer.status] + "30"}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Layer header */}
            <div onClick={() => setExpandedLayer(expandedLayer === layer.id ? null : layer.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{TYPE_ICONS[layer.type] || "📄"}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{layer.label}</p>
                {layer.description && <p style={{ fontSize: 9, color: muted }}>{layer.description.slice(0, 60)}</p>}
              </div>
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, background: `${STATUS_COLORS[layer.status]}15`, color: STATUS_COLORS[layer.status], fontWeight: 600, textTransform: "uppercase" as const }}>
                {layer.status.replace("_", " ")}
              </span>
              <span style={{ fontSize: 10, color: muted }}>{expandedLayer === layer.id ? "▲" : "▼"}</span>
            </div>

            {/* Expanded controls */}
            {expandedLayer === layer.id && (
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, background: "#060810" }}>
                {/* Volume control */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, color: muted, width: 50 }}>Volume</span>
                  <input type="range" min="0" max="100" value={layer.volume * 100}
                    onChange={e => onLayerAction(layer.id, "volume_change", parseInt(e.target.value) / 100)}
                    style={{ flex: 1, accentColor: purple }} />
                  <span style={{ fontSize: 10, color: "#fff", fontFamily: "monospace", width: 35 }}>{Math.round(layer.volume * 100)}%</span>
                </div>

                {/* Source file */}
                {layer.sourceUrl && (
                  <div style={{ fontSize: 10, color: muted, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Source: <span style={{ color: cyan }}>{layer.sourceUrl.split("/").pop()}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => onLayerAction(layer.id, "approve")}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${green}30`, background: `${green}10`, color: green, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                    Approve
                  </button>
                  <button onClick={() => onLayerAction(layer.id, "replace")}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${gold}30`, background: `${gold}10`, color: gold, fontSize: 10, cursor: "pointer" }}>
                    Replace
                  </button>
                  <button onClick={() => onLayerAction(layer.id, "regenerate")}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${purple}30`, background: `${purple}10`, color: purple, fontSize: 10, cursor: "pointer" }}>
                    Regenerate
                  </button>
                  <button onClick={() => onLayerAction(layer.id, "remove")}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${red}30`, background: `${red}10`, color: red, fontSize: 10, cursor: "pointer" }}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help text */}
      <p style={{ fontSize: 9, color: "#3d5060", marginTop: 12, lineHeight: 1.6 }}>
        Fix, replace, or regenerate any layer without restarting the project. Approve each layer individually or all at once. Export only when all layers are approved.
      </p>
    </div>
  );
}
