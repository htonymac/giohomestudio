// POST /api/video/blueprint — GHS Video Motion System Stage 1
//
// Converts user prompt into a structured Video Blueprint
// Do NOT send raw user text to Kling/Hailuo — convert to blueprint first
//
// Blueprint is visible to user for review before generation starts

import { NextRequest, NextResponse } from "next/server";
import { callPlanner, type ModelTier } from "@/lib/model-tier-router";
import { MOTION_PRESETS } from "@/lib/motion-presets";

export interface SceneBlueprint {
  scene_id: string;
  purpose: string;
  duration_sec: number;
  visual_type: "generated_video" | "generated_image_then_animate" | "screen_recording" | "talking_head" | "stock_or_broll" | "background_with_text";
  shot_type: "closeup" | "medium" | "wide" | "macro" | "topdown" | "screen_zoom" | "hero";
  motion_preset: string;  // ID from motion preset library
  entry_transition: string;
  exit_transition: string;
  speed_behavior: "normal" | "slow_motion" | "fast_forward" | "speed_ramp";
  caption_lines: string[];
  voiceover_line: string;
  ai_prompt: string;        // specific prompt for the AI model
  fallback_prompt: string;
  assembly_notes: string;
}

export interface VideoBlueprint {
  video_goal: string;
  format_type: "product_ad" | "realtor_ad" | "tutorial" | "promo" | "social_short" | "narrative" | "music_video" | "children" | "motivational";
  aspect_ratio: "9:16" | "16:9" | "1:1";
  target_duration: number;  // seconds
  hook_text: string;
  scene_list: SceneBlueprint[];
  product_or_subject_identity: string;
  caption_plan: {
    style: "bold_bottom" | "subtitle" | "karaoke" | "minimal" | "none";
    language: string;
  };
  audio_plan: {
    music_mood: string;
    narration: boolean;
    sfx_suggestions: string[];
  };
  cta: {
    text: string;
    position: "end" | "overlay" | "none";
  };
}

const BLUEPRINT_SYSTEM = `You are the GHS Video Blueprint Planner. Your job is to convert a user's video idea into a structured Video Blueprint.

RULES:
1. Every scene must have a specific, detailed ai_prompt — never vague like "make a nice video"
2. ai_prompt must include: subject, environment, camera framing, camera motion, speed feel, lighting, duration
3. Default: 1 scene = 1 generated shot. Multi-shot only when explicitly requested.
4. For product ads: start with product identity, then generate scenes from approved identity
5. Keep total duration reasonable (15-60s for social, 60-180s for promos)
6. Choose motion presets from this list: ${MOTION_PRESETS.map(p => p.id).join(", ")}

Return ONLY valid JSON matching the VideoBlueprint interface. No markdown, no explanation.

Example scene ai_prompt:
"Premium sealed pack of Plantain Flakes standing upright on a clean studio table, hero close-up, soft commercial lighting, slow push-in camera, gentle right-to-left parallax, crisp packaging text preserved, realistic shadows, premium food advertisement look, 4 seconds, no label distortion, no extra objects."`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, format_type, aspect_ratio, duration, tier = "pro" } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const userPrompt = `Create a Video Blueprint for this idea:

"${prompt}"

${format_type ? `Format type: ${format_type}` : ""}
${aspect_ratio ? `Aspect ratio: ${aspect_ratio}` : "Aspect ratio: 16:9"}
${duration ? `Target duration: ${duration} seconds` : "Target duration: 30 seconds"}

Return a complete VideoBlueprint JSON with:
- video_goal
- format_type (one of: product_ad, realtor_ad, tutorial, promo, social_short, narrative, music_video, children, motivational)
- aspect_ratio
- target_duration
- hook_text (attention-grabbing opening)
- scene_list (array of scenes, each with: scene_id, purpose, duration_sec, visual_type, shot_type, motion_preset, entry_transition, exit_transition, speed_behavior, caption_lines, voiceover_line, ai_prompt, fallback_prompt, assembly_notes)
- product_or_subject_identity
- caption_plan (style + language)
- audio_plan (music_mood, narration boolean, sfx_suggestions)
- cta (text + position)`;

    // Use AI to generate blueprint (Pro+ tier) or build deterministic one (Standard)
    if (tier === "standard") {
      // Standard tier: deterministic blueprint from prompt keywords
      const blueprint = buildDeterministicBlueprint(prompt, format_type, aspect_ratio, duration);
      return NextResponse.json({ blueprint, tier: "standard", method: "deterministic" });
    }

    // Pro+ tier: AI-generated blueprint
    const result = await callPlanner(userPrompt, BLUEPRINT_SYSTEM, tier as ModelTier);
    const text = typeof result === "string" ? result : (result as { text?: string })?.text || JSON.stringify(result);

    // Extract JSON from response
    let blueprint: VideoBlueprint;
    try {
      // Try direct parse
      blueprint = JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        blueprint = JSON.parse(jsonMatch[1]);
      } else {
        // Try finding JSON object in text
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          blueprint = JSON.parse(objMatch[0]);
        } else {
          return NextResponse.json({
            error: "Failed to parse blueprint from AI response",
            raw: text.slice(0, 500),
          }, { status: 500 });
        }
      }
    }

    // Validate required fields
    if (!blueprint.scene_list || !Array.isArray(blueprint.scene_list)) {
      return NextResponse.json({ error: "Blueprint missing scene_list" }, { status: 500 });
    }

    return NextResponse.json({
      blueprint,
      tier,
      method: "ai_planned",
      scene_count: blueprint.scene_list.length,
      estimated_duration: blueprint.target_duration,
    });

  } catch (error) {
    console.error("[Blueprint API]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Blueprint generation failed" },
      { status: 500 },
    );
  }
}

// Deterministic blueprint for Standard tier (no AI credits)
function buildDeterministicBlueprint(
  prompt: string,
  format_type?: string,
  aspect_ratio?: string,
  duration?: number,
): VideoBlueprint {
  const targetDur = duration || 30;
  const lower = prompt.toLowerCase();

  // Detect format from keywords
  let detectedFormat: VideoBlueprint["format_type"] = "social_short";
  if (format_type) detectedFormat = format_type as VideoBlueprint["format_type"];
  else if (lower.includes("product") || lower.includes("ad") || lower.includes("commercial")) detectedFormat = "product_ad";
  else if (lower.includes("tutorial") || lower.includes("how to") || lower.includes("guide")) detectedFormat = "tutorial";
  else if (lower.includes("promo") || lower.includes("announcement")) detectedFormat = "promo";
  else if (lower.includes("story") || lower.includes("narrative") || lower.includes("episode")) detectedFormat = "narrative";
  else if (lower.includes("children") || lower.includes("kids") || lower.includes("learning")) detectedFormat = "children";
  else if (lower.includes("motivat") || lower.includes("inspir") || lower.includes("quote")) detectedFormat = "motivational";

  // Detect mood for music
  let musicMood = "cinematic";
  if (lower.includes("happy") || lower.includes("fun") || lower.includes("upbeat")) musicMood = "upbeat";
  else if (lower.includes("sad") || lower.includes("emotion")) musicMood = "emotional";
  else if (lower.includes("action") || lower.includes("energy") || lower.includes("fast")) musicMood = "energetic";
  else if (lower.includes("calm") || lower.includes("peaceful") || lower.includes("relax")) musicMood = "calm";

  // Build scenes — split prompt into logical chunks
  const sentences = prompt.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
  const sceneCount = Math.max(2, Math.min(6, sentences.length));
  const sceneDur = Math.round(targetDur / sceneCount);

  const scenes: SceneBlueprint[] = [];
  for (let i = 0; i < sceneCount; i++) {
    const sceneText = sentences[i] || prompt;
    const isFirst = i === 0;
    const isLast = i === sceneCount - 1;

    scenes.push({
      scene_id: `scene_${i + 1}`,
      purpose: isFirst ? "hook" : isLast ? "cta_or_conclusion" : "main_content",
      duration_sec: sceneDur,
      visual_type: "generated_video",
      shot_type: isFirst ? "wide" : i === 1 ? "medium" : "closeup",
      motion_preset: isFirst ? "zoom_in_soft" : isLast ? "fade_out" : "parallax_float",
      entry_transition: isFirst ? "fade" : "dissolve",
      exit_transition: isLast ? "fade" : "dissolve",
      speed_behavior: "normal",
      caption_lines: [sceneText.trim()],
      voiceover_line: sceneText.trim(),
      ai_prompt: `${sceneText.trim()}, cinematic quality, professional lighting, ${isFirst ? "wide establishing shot" : "medium shot"}, smooth camera motion, high quality, 4K, ${sceneDur} seconds`,
      fallback_prompt: `${sceneText.trim()}, high quality video, ${sceneDur} seconds`,
      assembly_notes: isFirst ? "Hook scene — grab attention immediately" : isLast ? "Closing scene — end with impact" : "Continue narrative flow",
    });
  }

  return {
    video_goal: prompt.slice(0, 200),
    format_type: detectedFormat,
    aspect_ratio: (aspect_ratio as VideoBlueprint["aspect_ratio"]) || "16:9",
    target_duration: targetDur,
    hook_text: sentences[0]?.trim() || prompt.slice(0, 50),
    scene_list: scenes,
    product_or_subject_identity: prompt.slice(0, 100),
    caption_plan: { style: "bold_bottom", language: "en" },
    audio_plan: { music_mood: musicMood, narration: true, sfx_suggestions: ["whoosh", "impact"] },
    cta: { text: "Follow for more", position: "end" },
  };
}
