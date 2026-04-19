"use client";

import { useEffect, useState } from "react";

// GHS AI Tier Selector — follows ghs-ai-tiers.ts doctrine:
// NEVER show real model names in UI. Use GHS tier labels only.
// Standard = Local LLM (free, no API cost)
// Pro 1    = Fast hosted AI, option A (Haiku)
// Pro 2    = Fast hosted AI, option B (GPT-mini)
// Premium  = Quality hosted AI (Sonnet)
// Best     = Strongest AI (Opus) — shown only when showBest=true

export type AITier = "standard" | "pro" | "pro_gpt" | "premium" | "best";

interface AITierSelectorProps {
  value?: AITier;
  onChange?: (tier: AITier) => void;
  compact?: boolean;
  showBest?: boolean;
}

export const TIER_CONFIG: {
  id: AITier; label: string; tagline: string; color: string;
  credits: string; badge: string; internalModel: string; internalProvider: string; llmValue: string;
}[] = [
  {
    id:              "standard",
    label:           "GHS Free",
    tagline:         "Local AI · No cost",
    color:           "#22c55e",
    badge:           "FREE",
    credits:         "Free",
    internalProvider: "ollama",
    internalModel:   "phi3",
    llmValue:        "ollama",
  },
  {
    id:              "pro",
    label:           "GHS Pro",
    tagline:         "Fast AI · Option 1",
    color:           "#3b82f6",
    badge:           "PRO 1",
    credits:         "1 credit",
    internalProvider: "anthropic",
    internalModel:   "claude-haiku-4-5-20251001",
    llmValue:        "claude:claude-haiku-4-5-20251001",
  },
  {
    id:              "pro_gpt",
    label:           "GHS Pro",
    tagline:         "Fast AI · Option 2",
    color:           "#06b6d4",
    badge:           "PRO 2",
    credits:         "1 credit",
    internalProvider: "openai",
    internalModel:   "gpt-4o-mini",
    llmValue:        "openai:gpt-4o-mini",
  },
  {
    id:              "premium",
    label:           "GHS Premium",
    tagline:         "Quality AI · Strong",
    color:           "#a855f7",
    badge:           "PREMIUM",
    credits:         "3 credits",
    internalProvider: "anthropic",
    internalModel:   "claude-sonnet-4-6",
    llmValue:        "claude:claude-sonnet-4-6",
  },
  {
    id:              "best",
    label:           "GHS Best",
    tagline:         "Top AI · Strongest",
    color:           "#f59e0b",
    badge:           "BEST",
    credits:         "5 credits",
    internalProvider: "anthropic",
    internalModel:   "claude-opus-4-7",
    llmValue:        "claude:claude-opus-4-7",
  },
];

export function getModelForTier(tier: AITier): { provider: string; model: string; llmValue: string } {
  const cfg = TIER_CONFIG.find(t => t.id === tier);
  if (!cfg) return { provider: "anthropic", model: "claude-haiku-4-5-20251001", llmValue: "claude:claude-haiku-4-5-20251001" };
  return { provider: cfg.internalProvider, model: cfg.internalModel, llmValue: cfg.llmValue };
}

const LS_KEY = "ghs_ai_tier_v3";
const VALID_TIERS: AITier[] = ["standard", "pro", "pro_gpt", "premium", "best"];

export default function AITierSelector({ value, onChange, compact = false, showBest = false }: AITierSelectorProps) {
  const [selected, setSelected] = useState<AITier>("pro");

  useEffect(() => {
    if (value) { setSelected(value); return; }
    try {
      const saved = localStorage.getItem(LS_KEY) as AITier | null;
      if (saved && VALID_TIERS.includes(saved)) setSelected(saved);
    } catch {}
  }, [value]);

  function select(tier: AITier) {
    setSelected(tier);
    try { localStorage.setItem(LS_KEY, tier); } catch {}
    onChange?.(tier);
  }

  const visibleTiers = TIER_CONFIG.filter(t => {
    if (t.id === "best" && !showBest) return false;
    return true;
  });

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#5a5a7a", textTransform: "uppercase", letterSpacing: 0.8, marginRight: 2 }}>AI</span>
        {visibleTiers.map(t => (
          <button key={t.id} onClick={() => select(t.id)}
            title={`${t.label} — ${t.tagline} · ${t.credits}`}
            style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              cursor: "pointer",
              border: `1px solid ${selected === t.id ? t.color : "#2a2a40"}`,
              background: selected === t.id ? `${t.color}20` : "transparent",
              color: selected === t.id ? t.color : "#555",
              transition: "all 0.12s",
              whiteSpace: "nowrap",
            }}>
            {selected === t.id ? `${t.badge} ✓` : t.badge}
          </button>
        ))}
      </div>
    );
  }

  const selected_cfg = TIER_CONFIG.find(t => t.id === selected);

  return (
    <div style={{ background: "#0e1018", border: "1px solid #1e1e30", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#5a5a7a", textTransform: "uppercase", letterSpacing: 1.2 }}>
          AI Intelligence Engine
        </span>
        <span style={{ fontSize: 9, color: "#3a3a55" }}>
          {selected_cfg?.label ?? "GHS Pro"} · {selected_cfg?.credits ?? "1 credit"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${visibleTiers.length}, 1fr)`, gap: 6 }}>
        {visibleTiers.map(t => {
          const sel = selected === t.id;
          return (
            <button key={t.id} onClick={() => select(t.id)}
              title={`${t.label} — ${t.tagline} · ${t.credits}`}
              style={{
                padding: "9px 6px", borderRadius: 10,
                border: `1px solid ${sel ? t.color : "#1e1e30"}`,
                background: sel ? `${t.color}15` : "#0a0a14",
                cursor: "pointer", textAlign: "center", transition: "all 0.15s",
              }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                color: sel ? t.color : "#3a3a55", marginBottom: 2, textTransform: "uppercase",
              }}>{t.badge}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: sel ? "#e0dcff" : "#555", marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 9, color: sel ? `${t.color}aa` : "#333" }}>{t.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* Status bar — GHS branding only, no real model names */}
      <div style={{ marginTop: 10, padding: "7px 10px", background: "#06060f", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#4a4a6a" }}>Selected</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: selected_cfg?.color ?? "#888" }}>
          {selected_cfg?.label ?? "GHS Pro"} — {selected_cfg?.tagline}
        </span>
        <span style={{ fontSize: 9, color: "#4a4a6a" }}>{selected_cfg?.credits}</span>
      </div>
    </div>
  );
}
