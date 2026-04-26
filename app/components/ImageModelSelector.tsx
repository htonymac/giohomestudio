"use client";

import { useState } from "react";
import { getImageModels } from "@/lib/generation/model-registry";

export interface ImageModelSelectorProps {
  value: string;           // model id, e.g. "fal_flux_schnell"
  onChange: (id: string) => void;
  compact?: boolean;
}

const TIER_ORDER = ["budget_fast", "budget", "moderate", "moderate_premium", "standard", "premium", "premium_plus"];

export default function ImageModelSelector({ value, onChange, compact }: ImageModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const models = getImageModels(true).filter(m => m.type === "image");
  const current = models.find(m => m.id === value) ?? models.find(m => m.is_recommended_default) ?? models[0];

  const label: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: "#5a7080", display: "block", marginBottom: 4 };
  const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "#111520", border: "1px solid #1e2a35", borderRadius: 6, padding: compact ? "4px 10px" : "6px 12px", cursor: "pointer", fontSize: 11, color: "#c0d8e8" };

  function tierColor(tier: string) {
    if (tier.includes("premium")) return "#a855f7";
    if (tier.includes("moderate")) return "#f59e0b";
    return "#22c55e";
  }

  return (
    <div style={{ position: "relative" }}>
      {!compact && <span style={label}>Image Model</span>}
      <div style={pill} onClick={() => setOpen(o => !o)}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: tierColor(current?.quality_tier ?? "budget"), flexShrink: 0 }} />
        <span>{current?.display_name ?? "Select model"}</span>
        <span style={{ color: "#22c55e", fontSize: 10 }}>${current?.cost_to_henry?.toFixed(3)}</span>
        <span style={{ color: "#3a5060", fontSize: 10 }}>▾</span>
      </div>

      {open && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 999, background: "#0d1117", border: "1px solid #1e2a35", borderRadius: 8, minWidth: 280, maxHeight: 340, overflowY: "auto", boxShadow: "0 8px 32px #00000080" }}>
          {models.sort((a, b) => a.sort_price_rank - b.sort_price_rank).map(m => (
            <div
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
              style={{ padding: "8px 12px", cursor: "pointer", background: m.id === value ? "#1a2030" : "transparent", borderBottom: "1px solid #0f1520", display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => { if (m.id !== value) (e.currentTarget as HTMLDivElement).style.background = "#131825"; }}
              onMouseLeave={e => { if (m.id !== value) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: tierColor(m.quality_tier), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e0e8f0", fontWeight: 600 }}>{m.display_name}</div>
                <div style={{ fontSize: 9, color: "#5a7080", marginTop: 1 }}>{m.best_for.slice(0, 60)}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>${m.cost_to_henry.toFixed(3)}</div>
                <div style={{ fontSize: 9, color: "#3a5060" }}>{m.avg_generation_seconds}s</div>
              </div>
              {m.is_recommended_default && (
                <span style={{ fontSize: 8, background: "#00d4ff20", color: "#00d4ff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>DEFAULT</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
