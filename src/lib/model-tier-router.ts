// GHS Model Tier Router
//
// Routes AI planning calls to the correct provider based on tier:
// - Standard: Ollama (local, free)
// - Pro: GPT-4o-mini / Claude Haiku (hosted, small, 1 credit)
// - Premium: GPT-4o / Claude Sonnet (hosted, strong, 3 credits)
// - Premium Best: GPT-5.4 / Claude Opus (top reasoning, 5 credits)
//
// IMPORTANT: Local LLM must NOT be the hidden default for all intelligence.
// Pro/Premium/Premium Best MUST route to hosted providers.
// FFmpeg execution stays deterministic regardless of tier.

import { callLLM, type LLMOptions } from "@/lib/llm";

export type ModelTier = "standard" | "pro" | "premium" | "premium_best";

interface TierConfig {
  plannerRole: "fast" | "quality" | "creative" | "supervisor";
  supervisorRole: "fast" | "quality" | "supervisor";
  maxTokens: number;
  temperature: number;
  credits: number;
  description: string;
}

const TIER_CONFIG: Record<ModelTier, TierConfig> = {
  standard: {
    plannerRole: "fast",
    supervisorRole: "fast",
    maxTokens: 800,
    temperature: 0.5,
    credits: 0,
    description: "GHS Standard — quick drafts, basic planning",
  },
  pro: {
    plannerRole: "quality",
    supervisorRole: "fast",
    maxTokens: 1200,
    temperature: 0.5,
    credits: 1,
    description: "GHS Pro — structured planning, sound placement",
  },
  premium: {
    plannerRole: "creative",
    supervisorRole: "quality",
    maxTokens: 2000,
    temperature: 0.5,
    credits: 3,
    description: "GHS Premium — strong creative planning, continuity, timing",
  },
  premium_best: {
    plannerRole: "supervisor",
    supervisorRole: "supervisor",
    maxTokens: 3000,
    temperature: 0.4,
    credits: 5,
    description: "GHS Best — strongest planning, full supervision",
  },
};

export function getTierConfig(tier: ModelTier): TierConfig {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.standard;
}

export function getTierCredits(tier: ModelTier): number {
  return TIER_CONFIG[tier]?.credits ?? 0;
}

// Call the planner AI at the specified tier
export async function callPlanner(
  prompt: string,
  system: string,
  tier: ModelTier,
) {
  const config = getTierConfig(tier);
  const opts: LLMOptions = {
    role: config.plannerRole,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  };

  return callLLM(prompt, system, opts);
}

// Call the supervisor AI at the specified tier
export async function callSupervisor(
  prompt: string,
  system: string,
  tier: ModelTier,
) {
  const config = getTierConfig(tier);
  const opts: LLMOptions = {
    role: config.supervisorRole,
    maxTokens: Math.min(config.maxTokens, 1000),
    temperature: 0.3, // supervisor should be more deterministic
  };

  return callLLM(prompt, system, opts);
}

// Get tier display info for UI
export function getTierDisplayInfo() {
  return [
    { id: "standard" as ModelTier, label: "Standard", cost: "Free", badge: "FREE", badgeColor: "#22c55e", desc: TIER_CONFIG.standard.description },
    { id: "pro" as ModelTier, label: "Pro", cost: "1 credit", badge: "RECOMMENDED", badgeColor: "#7c5cfc", desc: TIER_CONFIG.pro.description },
    { id: "premium" as ModelTier, label: "Premium", cost: "3 credits", badge: "PREMIUM", badgeColor: "#f59e0b", desc: TIER_CONFIG.premium.description },
    { id: "premium_best" as ModelTier, label: "Premium Best", cost: "5 credits", badge: "BEST", badgeColor: "#ef4444", desc: TIER_CONFIG.premium_best.description },
  ];
}
