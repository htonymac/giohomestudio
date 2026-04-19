// GHS AI Tier branding — never expose real model names in UI.
// Only show GHS tier labels. Real providers shown in "More info" modal only.

export type GhsTier = "free" | "standard" | "pro";

export interface GhsTierDef {
  id: GhsTier;
  label: string;         // shown in UI
  badge: string;         // short badge text
  color: string;
  description: string;   // shown in picker
  // Internal — shown only when user clicks "More info"
  internalNote: string;
}

export const GHS_TIERS: GhsTierDef[] = [
  {
    id: "free",
    label: "GHS Free",
    badge: "FREE",
    color: "#22c55e",
    description: "Fast, no cost. Great for drafts and brainstorming.",
    internalNote: "Powered by local LLM (Ollama/Mistral). No API cost.",
  },
  {
    id: "standard",
    label: "GHS Standard",
    badge: "STD",
    color: "#3b82f6",
    description: "Balanced quality and speed. Best for most tasks.",
    internalNote: "Powered by Claude Haiku / GPT-4o mini. Low cost per call.",
  },
  {
    id: "pro",
    label: "GHS Pro",
    badge: "PRO",
    color: "#a855f7",
    description: "Highest quality output. Best for final scripts and complex stories.",
    internalNote: "Powered by Claude Sonnet / Claude Opus. Billed to your account.",
  },
];

export const GHS_TIER_MAP: Record<GhsTier, GhsTierDef> = Object.fromEntries(
  GHS_TIERS.map(t => [t.id, t])
) as Record<GhsTier, GhsTierDef>;

// Maps GHS tier → internal provider string used by callLLM
export function ghsTierToProvider(tier: GhsTier): string {
  switch (tier) {
    case "free":     return "ollama";
    case "standard": return "claude:claude-haiku-4-5-20251001";
    case "pro":      return "claude:claude-sonnet-4-6";
  }
}

// Maps internal provider string → GHS tier (for display)
export function providerToGhsTier(provider: string): GhsTier {
  if (provider.includes("opus") || provider.includes("sonnet")) return "pro";
  if (provider.includes("haiku") || provider.includes("gpt")) return "standard";
  return "free";
}
