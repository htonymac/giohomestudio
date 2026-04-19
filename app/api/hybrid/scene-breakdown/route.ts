// POST /api/hybrid/scene-breakdown
// Steps 6-8 of GHS Hybrid Pipeline — Scene Breakdown + Classification + Intelligence Scoring
//
// Takes projectId, expandedStory, characters (from steps 2-3)
// Uses cloud LLM to break the story into structured scene objects
// Each scene gets: type classification (image-led/video-led/image-to-video/audio-bridge/hybrid)
// Each scene gets intelligence scoring (motionNeed, narrationIntensity, etc.)
// Creates HybridScene records in the database
// Returns the created scenes

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────────────

interface CharacterInput {
  characterId: string;
  displayName: string;
  role: string;
}

interface SceneFromLLM {
  sceneId: string;
  title: string;
  location: string;
  timeOfDay: string;
  weather: string;
  mood: string;
  characterIds: string[];
  primarySpeaker: string | null;
  secondarySpeakers: string[];
  sceneType: "image-led" | "video-led" | "image-to-video" | "audio-bridge" | "hybrid";
  motionNeed: "low" | "medium" | "high";
  narrationIntensity: "low" | "medium" | "high";
  dialogueDensity: "low" | "medium" | "high";
  emotionalWeight: "low" | "medium" | "high";
  costPriority: "efficient" | "balanced" | "premium";
  durationEstimate: number;
  lightingPlan: string;
  cameraSuggestion: string;
  soundSuggestion: string;
  musicSuggestion: string;
  tags: string[];
}

// ── LLM Prompt Builder ─────────────────────────────────────────

function buildSceneBreakdownPrompt(
  expandedStory: string,
  characters: CharacterInput[],
  costPreference: string,
): string {
  const characterList = characters
    .map((c) => `- ${c.characterId}: ${c.displayName} (${c.role})`)
    .join("\n");

  return `You are a professional film director and scene planner for the GioHomeStudio Hybrid Pipeline.

Break the following story into individual scenes. Each scene is a distinct moment in the story with its own location, mood, and purpose.

## STORY
${expandedStory}

## CHARACTERS
${characterList}

## SCENE TYPE CLASSIFICATION RULES

Assign each scene one of these types based on its content:

- **image-led**: Setup, emotion, atmosphere scenes. Cheaper to produce. Narration carries the story. Use for establishing shots, emotional pauses, reflections, dialogue-heavy moments where motion adds nothing.
- **video-led**: Action, movement, reaction scenes. Needs real motion. Use for chases, fights, physical interactions, dramatic reveals that require movement to land.
- **image-to-video**: Starts still, then motion takes over. Transitional scenes. Use for moments that begin calm and escalate, or where a slow reveal leads to action.
- **audio-bridge**: Minimal or no visuals. Narration and/or music carry the story between scenes. Use for time jumps, internal monologue, transitions, or mood shifts.
- **hybrid**: Mix within the scene — some shots are still images, some are motion. Use when a scene has both quiet and active beats.

## INTELLIGENCE SCORING RULES

For each scene, assign these scores:

- **motionNeed** (low/medium/high): Based on how much physical action and movement is in the scene. Standing and talking = low. Walking = medium. Running/fighting = high.
- **narrationIntensity** (low/medium/high): image-led and audio-bridge scenes = high narration. video-led scenes = low narration. hybrid = medium.
- **dialogueDensity** (low/medium/high): How many characters speak in this scene. 0 speakers = low. 1 speaker = medium. 2+ speakers = high.
- **emotionalWeight** (low/medium/high): How important is this scene to the story's emotional arc. Climax/turning point = high. Setup = low. Development = medium.
- **costPriority**: The user's overall preference is "${costPreference || "balanced"}". Apply it: "efficient" scenes use images/audio. "premium" scenes use video. "balanced" mixes based on need.

## OUTPUT FORMAT

Return a JSON array of scene objects. Return ONLY the JSON array, no markdown, no explanation.

[{
  "sceneId": "SC01",
  "title": "Scene title — short and descriptive",
  "location": "Where this scene takes place",
  "timeOfDay": "morning/afternoon/evening/night/dawn/dusk",
  "weather": "clear/cloudy/rainy/stormy/foggy/snowy/hot/cold",
  "mood": "tense/calm/joyful/sad/mysterious/dramatic/romantic/comedic/dark/hopeful",
  "characterIds": ["CH01", "CH02"],
  "primarySpeaker": "CH01",
  "secondarySpeakers": ["CH02"],
  "sceneType": "image-led",
  "motionNeed": "low",
  "narrationIntensity": "high",
  "dialogueDensity": "medium",
  "emotionalWeight": "high",
  "costPriority": "efficient",
  "durationEstimate": 8,
  "lightingPlan": "Warm golden hour light from the left, soft shadows",
  "cameraSuggestion": "Close-up on face, slow pan to reveal environment",
  "soundSuggestion": "Quiet ambient room tone, distant traffic, breathing",
  "musicSuggestion": "Soft piano, building emotional swell",
  "tags": ["narration-heavy", "emotion-heavy"]
}]

IMPORTANT:
- Use character IDs from the list above, not names
- sceneId format: SC01, SC02, SC03, etc.
- durationEstimate is in seconds (typically 5-15 per scene)
- Tags should describe the scene's dominant features (e.g., "narration-heavy", "action-heavy", "emotion-heavy", "dialogue-heavy", "transition", "establishing", "climax")
- Aim for 5-12 scenes depending on story length
- Every scene must have a sceneType and all intelligence scores`;
}

// ── JSON Parser ─────────────────────────────────────────────────

function parseScenesFromLLM(text: string): SceneFromLLM[] | null {
  // Try to extract JSON array from LLM response
  // Handle cases where LLM wraps in markdown code blocks
  let cleaned = text.trim();

  // Remove markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.scenes && Array.isArray(parsed.scenes)) return parsed.scenes;
  } catch {
    // Try to find array in text
  }

  // Find first [ ... ] block
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      return null;
    }
  }

  return null;
}

// ── Validation & Defaults ───────────────────────────────────────

const VALID_SCENE_TYPES = ["image-led", "video-led", "image-to-video", "audio-bridge", "hybrid"];
const VALID_LEVELS = ["low", "medium", "high"];
const VALID_COST = ["efficient", "balanced", "premium"];

function validateAndNormalize(scene: SceneFromLLM, index: number): SceneFromLLM {
  return {
    sceneId: scene.sceneId || `SC${String(index + 1).padStart(2, "0")}`,
    title: scene.title || `Scene ${index + 1}`,
    location: scene.location || "Unknown",
    timeOfDay: scene.timeOfDay || "day",
    weather: scene.weather || "clear",
    mood: scene.mood || "neutral",
    characterIds: Array.isArray(scene.characterIds) ? scene.characterIds : [],
    primarySpeaker: scene.primarySpeaker || null,
    secondarySpeakers: Array.isArray(scene.secondarySpeakers) ? scene.secondarySpeakers : [],
    sceneType: VALID_SCENE_TYPES.includes(scene.sceneType) ? scene.sceneType : "hybrid",
    motionNeed: VALID_LEVELS.includes(scene.motionNeed) ? scene.motionNeed : "medium",
    narrationIntensity: VALID_LEVELS.includes(scene.narrationIntensity) ? scene.narrationIntensity : "medium",
    dialogueDensity: VALID_LEVELS.includes(scene.dialogueDensity) ? scene.dialogueDensity : "low",
    emotionalWeight: VALID_LEVELS.includes(scene.emotionalWeight) ? scene.emotionalWeight : "medium",
    costPriority: VALID_COST.includes(scene.costPriority) ? scene.costPriority : "balanced",
    durationEstimate: typeof scene.durationEstimate === "number" && scene.durationEstimate > 0 ? scene.durationEstimate : 8,
    lightingPlan: scene.lightingPlan || "",
    cameraSuggestion: scene.cameraSuggestion || "",
    soundSuggestion: scene.soundSuggestion || "",
    musicSuggestion: scene.musicSuggestion || "",
    tags: Array.isArray(scene.tags) ? scene.tags : [],
  };
}

// ── POST Handler ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, expandedStory, characters } = body as {
      projectId: string;
      expandedStory: string;
      characters: CharacterInput[];
    };

    // ── Validate inputs ──
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    if (!expandedStory || typeof expandedStory !== "string") {
      return NextResponse.json({ error: "expandedStory is required" }, { status: 400 });
    }
    if (!Array.isArray(characters)) {
      return NextResponse.json({ error: "characters must be an array" }, { status: 400 });
    }

    // ── Verify project exists ──
    const project = await prisma.hybridProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Build prompt and call LLM ──
    const prompt = buildSceneBreakdownPrompt(
      expandedStory,
      characters,
      project.costPreference ?? "balanced",
    );

    const llmResult = await callLLM(prompt, undefined, {
      role: "quality" as const,
      temperature: 0.6,
      maxTokens: 6000,
      timeoutMs: 60000,
    });

    if (!llmResult.ok) {
      return NextResponse.json(
        { error: `LLM call failed: ${llmResult.error}` },
        { status: 502 },
      );
    }

    // ── Parse LLM response ──
    const rawScenes = parseScenesFromLLM(llmResult.text);
    if (!rawScenes || rawScenes.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to parse scenes from LLM response",
          rawResponse: llmResult.text.slice(0, 500),
        },
        { status: 422 },
      );
    }

    // ── Validate and normalize each scene ──
    const validatedScenes = rawScenes.map((s, i) => validateAndNormalize(s, i));

    // ── Delete existing scenes for this project (re-breakdown) ──
    await prisma.hybridScene.deleteMany({
      where: { projectId },
    });

    // ── Create HybridScene records in DB ──
    const createdScenes = await Promise.all(
      validatedScenes.map((scene, index) =>
        prisma.hybridScene.create({
          data: {
            projectId,
            sceneId: scene.sceneId,
            title: scene.title,
            orderIndex: index,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            weather: scene.weather,
            mood: scene.mood,
            characterIds: scene.characterIds,
            primarySpeaker: scene.primarySpeaker,
            secondarySpeakers: scene.secondarySpeakers,
            sceneType: scene.sceneType,
            motionNeed: scene.motionNeed,
            narrationIntensity: scene.narrationIntensity,
            dialogueDensity: scene.dialogueDensity,
            emotionalWeight: scene.emotionalWeight,
            costPriority: scene.costPriority,
            durationEstimate: scene.durationEstimate,
            lightingPlan: scene.lightingPlan,
            cameraSuggestion: scene.cameraSuggestion,
            soundSuggestion: scene.soundSuggestion,
            musicSuggestion: scene.musicSuggestion,
            tags: scene.tags,
          },
        }),
      ),
    );

    // ── Update project status to SCENES_READY ──
    await prisma.hybridProject.update({
      where: { id: projectId },
      data: { status: "SCENES_READY" },
    });

    // ── Build summary stats ──
    const typeCounts = {
      "image-led": 0,
      "video-led": 0,
      "image-to-video": 0,
      "audio-bridge": 0,
      "hybrid": 0,
    };
    for (const s of validatedScenes) {
      if (s.sceneType in typeCounts) {
        typeCounts[s.sceneType as keyof typeof typeCounts]++;
      }
    }

    const totalDuration = validatedScenes.reduce((sum, s) => sum + s.durationEstimate, 0);

    return NextResponse.json({
      scenes: createdScenes,
      summary: {
        totalScenes: createdScenes.length,
        totalDurationEstimate: totalDuration,
        typeCounts,
        provider: (llmResult as { provider?: string }).provider ?? "unknown",
      },
    });
  } catch (err: unknown) {
    console.error("[hybrid/scene-breakdown] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
