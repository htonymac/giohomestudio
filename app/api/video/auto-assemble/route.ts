// POST /api/video/auto-assemble — GHS Intelligent AI Auto-Assemble Pipeline
//
// Full pipeline: User instruction → AI Blueprint → AI calls all necessary APIs
// (music gen, SFX, narration TTS, image gen) → AI calls video APIs →
// FFmpeg assembles ALL layers → Returns preview + cost breakdown
//
// This is the "intelligent AI" that plans and executes the full video.

import { NextRequest, NextResponse } from "next/server";
import { callPlanner, type ModelTier } from "@/lib/model-tier-router";
import { MOTION_PRESETS } from "@/lib/motion-presets";

interface AutoAssemblePlan {
  scenes: Array<{
    scene_id: string;
    description: string;
    duration: number;
    needs_video_gen: boolean;
    needs_image_gen: boolean;
    needs_narration: boolean;
    needs_music: boolean;
    needs_sfx: string[];
    overlay_text: string;
    overlay_animation: string;
    transition: string;
    motion_preset: string;
    ai_prompt: string;
  }>;
  global_music_mood: string;
  global_narration: boolean;
  intro: { text: string; duration: number } | null;
  outro: { text: string; duration: number } | null;
  total_duration: number;
  estimated_credits: number;
  credit_breakdown: Array<{ item: string; credits: number }>;
}

const PLANNER_SYSTEM = `You are the GHS Intelligent Video Planner. Given a user instruction, plan a COMPLETE video production.

You must decide intelligently:
- How many scenes the video needs
- Which scenes need AI video generation vs AI image generation vs text-on-background
- Whether narration is needed (and what text)
- What music mood fits
- Which SFX to add and where
- What text overlays to include
- Whether an intro/outro is needed
- What transitions between scenes

Available motion presets: ${MOTION_PRESETS.map(p => p.id).join(", ")}
Available SFX: thunder, rain_light, wind, footsteps_concrete, door_slam, car_engine, crowd_cheer, dog_bark, ocean_waves, explosion, forest_birds, heartbeat, whoosh, siren, fire_crackling, storm

Credit costs:
- AI video generation: 2 credits per scene
- AI image generation: 1 credit per image
- Music generation: 0 credits (built-in)
- Narration TTS: 0 credits (Piper) or 1 credit (ElevenLabs)
- SFX: 0 credits (from library)
- FFmpeg assembly: 0 credits

Return ONLY valid JSON matching this structure:
{
  "scenes": [{ "scene_id", "description", "duration", "needs_video_gen", "needs_image_gen", "needs_narration", "needs_music", "needs_sfx": [], "overlay_text", "overlay_animation", "transition", "motion_preset", "ai_prompt" }],
  "global_music_mood": "cinematic|upbeat|calm|suspense|afrobeats|emotional",
  "global_narration": true/false,
  "intro": { "text": "...", "duration": 3 } or null,
  "outro": { "text": "...", "duration": 3 } or null,
  "total_duration": number,
  "estimated_credits": number,
  "credit_breakdown": [{ "item": "...", "credits": number }]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      instruction,
      tier = "pro",
      existingScenes,
      aspect_ratio = "16:9",
    } = body;

    if (!instruction) {
      return NextResponse.json({ error: "Instruction required" }, { status: 400 });
    }

    const existingContext = existingScenes?.length
      ? `\n\nExisting project has ${existingScenes.length} scenes already. The user wants to enhance/extend it.`
      : "";

    const userPrompt = `Plan a complete video production for this instruction:

"${instruction}"

Aspect ratio: ${aspect_ratio}
${existingContext}

Plan every scene, decide what needs AI generation vs simple assembly, estimate costs, and include intro/outro if appropriate.`;

    // Standard tier: deterministic planning
    if (tier === "standard") {
      const plan = buildDeterministicPlan(instruction);
      return NextResponse.json({
        plan,
        tier: "standard",
        method: "deterministic",
        ready_for_approval: true,
      });
    }

    // Pro+ tier: AI-planned
    const result = await callPlanner(userPrompt, PLANNER_SYSTEM, tier as ModelTier);
    const text = typeof result === "string" ? result : (result as { text?: string })?.text || JSON.stringify(result);

    let plan: AutoAssemblePlan;
    try {
      plan = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        return NextResponse.json({ error: "Failed to parse AI plan", raw: text.slice(0, 500) }, { status: 500 });
      }
    }

    if (!plan.scenes || !Array.isArray(plan.scenes)) {
      return NextResponse.json({ error: "Plan missing scenes" }, { status: 500 });
    }

    return NextResponse.json({
      plan,
      tier,
      method: "ai_planned",
      ready_for_approval: true,
    });

  } catch (error) {
    console.error("[Auto-Assemble API]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-assemble planning failed" },
      { status: 500 },
    );
  }
}

function buildDeterministicPlan(instruction: string): AutoAssemblePlan {
  const lower = instruction.toLowerCase();
  const sentences = instruction.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
  const sceneCount = Math.max(2, Math.min(6, sentences.length || 3));

  // Detect intent
  const needsNarration = lower.includes("narrat") || lower.includes("voice") || lower.includes("speak") || lower.includes("tell") || lower.includes("explain");
  const needsIntro = lower.includes("intro") || lower.includes("opening") || sceneCount > 2;
  const needsOutro = lower.includes("outro") || lower.includes("ending") || lower.includes("cta") || sceneCount > 2;

  let musicMood = "cinematic";
  if (lower.includes("happy") || lower.includes("fun") || lower.includes("upbeat")) musicMood = "upbeat";
  else if (lower.includes("calm") || lower.includes("peaceful")) musicMood = "calm";
  else if (lower.includes("suspense") || lower.includes("thriller") || lower.includes("dark")) musicMood = "suspense";
  else if (lower.includes("afro") || lower.includes("nigerian") || lower.includes("african")) musicMood = "afrobeats";

  const scenes = [];
  let totalCredits = 0;
  const creditBreakdown: Array<{ item: string; credits: number }> = [];

  for (let i = 0; i < sceneCount; i++) {
    const sceneText = sentences[i] || instruction;
    const isFirst = i === 0;
    const isLast = i === sceneCount - 1;
    const needsVideo = !lower.includes("text only") && !lower.includes("invtext");
    const sfxList: string[] = [];

    // Auto-detect SFX from content
    if (lower.includes("rain")) sfxList.push("rain_light");
    if (lower.includes("thunder") || lower.includes("storm")) sfxList.push("thunder");
    if (lower.includes("explosion") || lower.includes("blast")) sfxList.push("explosion");
    if (isFirst) sfxList.push("whoosh");

    scenes.push({
      scene_id: `scene_${i + 1}`,
      description: sceneText.trim(),
      duration: 5,
      needs_video_gen: needsVideo,
      needs_image_gen: false,
      needs_narration: needsNarration,
      needs_music: i === 0,
      needs_sfx: i === 0 ? sfxList : [],
      overlay_text: "",
      overlay_animation: "fade",
      transition: isFirst ? "fade" : "dissolve",
      motion_preset: isFirst ? "zoom_in_soft" : isLast ? "fade_out" : "parallax_float",
      ai_prompt: `${sceneText.trim()}, cinematic quality, professional lighting, smooth camera motion, high quality`,
    });

    if (needsVideo) {
      totalCredits += 2;
      creditBreakdown.push({ item: `Scene ${i + 1} video generation`, credits: 2 });
    }
  }

  if (needsNarration) {
    creditBreakdown.push({ item: "Narration TTS (Piper — free)", credits: 0 });
  }
  creditBreakdown.push({ item: "Music generation (built-in)", credits: 0 });
  creditBreakdown.push({ item: "FFmpeg assembly", credits: 0 });

  return {
    scenes,
    global_music_mood: musicMood,
    global_narration: needsNarration,
    intro: needsIntro ? { text: sentences[0]?.trim().slice(0, 40) || "GioHomeStudio", duration: 3 } : null,
    outro: needsOutro ? { text: "Follow for more", duration: 3 } : null,
    total_duration: sceneCount * 5 + (needsIntro ? 3 : 0) + (needsOutro ? 3 : 0),
    estimated_credits: totalCredits,
    credit_breakdown: creditBreakdown,
  };
}
