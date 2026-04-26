// POST /api/assembly/change — AI Change Planner
//
// From Semi-AI Collaboration Mode Master Canvas:
// "parse the user instruction, detect what part of the project is affected,
//  decide the scope, update the project plan, request only necessary tools"
//
// Flow: User Instruction → Intent Parser → Change Planner → Project State Update
// NOT: User Instruction → Full Project Rebuild From Scratch
//
// Edit Scope Classification:
// - Low: text, subtitle, volume, trim, timing, logo (FFmpeg only, 0 credits)
// - Medium: replace image, restyle, add/remove SFX, change voice, reorder (may cost credits)
// - High: object removal, scene regeneration, visual transformation (external provider, credit approval)

import { NextRequest, NextResponse } from "next/server";
import { callPlanner, getTierConfig, type ModelTier } from "@/lib/model-tier-router";
import type { AssemblyJSON } from "@/lib/assembly-schema";

interface ChangeRequest {
  instruction: string;
  projectId: string;
  sceneId?: number;
  scope?: "this-scene" | "all-scenes" | "audio-only";
  tier?: ModelTier;
  assembly?: AssemblyJSON;
}

interface ChangeResult {
  type: string;
  engine: string;
  scope: "low" | "medium" | "high";
  affectedLayers: string[];
  affectedScenes: number[];
  description: string;
  icon: string;
  creditCost: number;
  requiresApproval: boolean;
  ffmpegOnly: boolean;
  changes: Array<{
    field: string;
    from: string;
    to: string;
  }>;
}

// ── Edit routing rules (deterministic, no AI needed) ──
const ROUTE_RULES: Array<{
  keywords: string[];
  type: string;
  engine: string;
  scope: "low" | "medium" | "high";
  layers: string[];
  icon: string;
  credits: number;
  ffmpegOnly: boolean;
}> = [
  // Low-scope — FFmpeg only, 0 credits
  { keywords: ["darker", "lighter", "brightness", "contrast", "warm", "cool", "colour", "color", "grade", "golden hour", "sepia"], type: "Visual / Grade", engine: "FFmpeg", scope: "low", layers: ["video"], icon: "🎨", credits: 0, ffmpegOnly: true },
  { keywords: ["trim", "cut", "shorten", "remove end", "remove start", "remove last"], type: "Trim", engine: "FFmpeg", scope: "low", layers: ["video", "audio"], icon: "✂️", credits: 0, ffmpegOnly: true },
  { keywords: ["volume", "louder", "softer", "quieter", "mute", "unmute"], type: "Audio / Volume", engine: "FFmpeg", scope: "low", layers: ["audio"], icon: "🔊", credits: 0, ffmpegOnly: true },
  { keywords: ["subtitle", "caption", "text overlay", "add text"], type: "Text / Overlay", engine: "FFmpeg", scope: "low", layers: ["text"], icon: "📝", credits: 0, ffmpegOnly: true },
  { keywords: ["logo", "watermark", "brand"], type: "Overlay / Logo", engine: "FFmpeg", scope: "low", layers: ["overlay"], icon: "🏷", credits: 0, ffmpegOnly: true },
  { keywords: ["fade", "transition", "dissolve", "crossfade"], type: "Transition", engine: "FFmpeg", scope: "low", layers: ["video"], icon: "🔄", credits: 0, ffmpegOnly: true },
  { keywords: ["speed", "slow motion", "faster", "slower", "2x", "0.5x"], type: "Speed", engine: "FFmpeg", scope: "low", layers: ["video", "audio"], icon: "⏱", credits: 0, ffmpegOnly: true },
  { keywords: ["lock", "approve", "finalize"], type: "Scene Lock", engine: "Registry", scope: "low", layers: [], icon: "🔒", credits: 0, ffmpegOnly: false },

  // Low-scope audio — FFmpeg, 0 credits
  { keywords: ["rain sound", "thunder", "wind sound", "sfx", "sound effect", "ambience", "add sound", "add sfx"], type: "Audio / SFX", engine: "FFmpeg", scope: "low", layers: ["sfx"], icon: "🔊", credits: 0, ffmpegOnly: true },
  { keywords: ["music volume", "lower music", "raise music", "duck", "music louder", "music softer", "background music"], type: "Audio / Music", engine: "FFmpeg", scope: "low", layers: ["music"], icon: "🎵", credits: 0, ffmpegOnly: true },

  // Medium-scope — may cost credits
  { keywords: ["replace image", "swap image", "change image", "new image"], type: "Visual / Replace", engine: "Generation", scope: "medium", layers: ["video"], icon: "🖼", credits: 1, ffmpegOnly: false },
  { keywords: ["change voice", "different voice", "female voice", "male voice", "narration voice"], type: "Audio / Voice", engine: "Voice Gen", scope: "medium", layers: ["narration"], icon: "🎙", credits: 1, ffmpegOnly: false },
  { keywords: ["reorder", "move scene", "swap scene", "rearrange"], type: "Scene / Reorder", engine: "Assembly", scope: "medium", layers: ["video"], icon: "📋", credits: 0, ffmpegOnly: false },
  { keywords: ["change music", "replace music", "new music", "generate music", "different song"], type: "Audio / Music Gen", engine: "Music Gen", scope: "medium", layers: ["music"], icon: "🎵", credits: 1, ffmpegOnly: false },
  { keywords: ["restyle", "style", "anime", "cinematic", "cartoon"], type: "Visual / Restyle", engine: "Generation", scope: "medium", layers: ["video"], icon: "🎨", credits: 2, ffmpegOnly: false },

  // High-scope — external provider, credit approval required
  { keywords: ["regenerate", "redo scene", "make new", "create new scene"], type: "Visual / Regen", engine: "Generation", scope: "high", layers: ["video"], icon: "🎬", credits: 3, ffmpegOnly: false },
  { keywords: ["remove object", "remove person", "remove tree", "remove car", "erase"], type: "Visual / Edit", engine: "Generation", scope: "high", layers: ["video"], icon: "🎬", credits: 3, ffmpegOnly: false },
  { keywords: ["add object", "add person", "add tree", "add building"], type: "Visual / Edit", engine: "Generation", scope: "high", layers: ["video"], icon: "🎬", credits: 3, ffmpegOnly: false },
  { keywords: ["change background", "replace background", "new background"], type: "Visual / BG", engine: "Generation", scope: "high", layers: ["video"], icon: "🌄", credits: 2, ffmpegOnly: false },
];

function classifyInstruction(instruction: string): ChangeResult {
  const low = instruction.toLowerCase();

  for (const rule of ROUTE_RULES) {
    if (rule.keywords.some(kw => low.includes(kw))) {
      return {
        type: rule.type,
        engine: rule.engine,
        scope: rule.scope,
        affectedLayers: rule.layers,
        affectedScenes: [],
        description: instruction,
        icon: rule.icon,
        creditCost: rule.credits,
        requiresApproval: rule.scope === "high" || rule.credits > 0,
        ffmpegOnly: rule.ffmpegOnly,
        changes: [],
      };
    }
  }

  // Default: high-scope visual edit
  return {
    type: "Visual / Custom",
    engine: "Generation",
    scope: "high",
    affectedLayers: ["video"],
    affectedScenes: [],
    description: instruction,
    icon: "🎬",
    creditCost: 3,
    requiresApproval: true,
    ffmpegOnly: false,
    changes: [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ChangeRequest = await req.json();

    if (!body.instruction?.trim()) {
      return NextResponse.json({ error: "No instruction provided" }, { status: 400 });
    }

    const tier = body.tier || "pro";
    const tierConfig = getTierConfig(tier);

    // ── Step 1: Classify the instruction (deterministic first) ──
    const classification = classifyInstruction(body.instruction);
    classification.affectedScenes = body.sceneId ? [body.sceneId] : [];

    // ── Step 2: For Pro+ tiers, use AI to refine the change plan ──
    let aiRefinement: string | null = null;
    if (tier !== "standard" && !classification.ffmpegOnly) {
      const plannerPrompt = `User wants to edit a video project. Their instruction: "${body.instruction}"

Current classification:
- Type: ${classification.type}
- Scope: ${classification.scope}
- Engine: ${classification.engine}
- Affected layers: ${classification.affectedLayers.join(", ")}
${body.sceneId ? `- Target scene: ${body.sceneId}` : `- Target: ${body.scope || "current scene"}`}

Refine this change plan. Return ONLY valid JSON:
{
  "refinedDescription": "what exactly will change in plain language",
  "specificChanges": [{"field": "what changes", "from": "current value", "to": "new value"}],
  "warnings": ["any risks or notes"],
  "alternativeSuggestion": "optional simpler approach if this is expensive"
}`;

      const system = "You are the GHS Change Planner. Classify and refine edit instructions for a video production project. Be precise and concise. Return ONLY JSON.";

      const result = await callPlanner(plannerPrompt, system, tier);
      if (result.ok) {
        try {
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            aiRefinement = parsed.refinedDescription || null;
            if (parsed.specificChanges) {
              classification.changes = parsed.specificChanges;
            }
          }
        } catch { /* AI returned non-JSON, use classification as-is */ }
      }
    }

    // ── Step 3: Return the change plan for user review ──
    return NextResponse.json({
      plan: {
        ...classification,
        description: aiRefinement || classification.description,
        originalInstruction: body.instruction,
      },
      meta: {
        tier,
        tierCredits: tierConfig.credits,
        planningCost: tier === "standard" ? 0 : tierConfig.credits,
        executionCost: classification.creditCost,
        totalCost: (tier === "standard" ? 0 : tierConfig.credits) + classification.creditCost,
        requiresApproval: classification.requiresApproval,
        ffmpegOnly: classification.ffmpegOnly,
        scope: classification.scope,
      },
    });
  } catch (err) {
    console.error("Change planner error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Change planning failed" },
      { status: 500 }
    );
  }
}
