// GioHomeStudio — Hybrid Pipeline Step 9: Shot Planning Layer
//
// Takes: projectId (and optionally sceneId for single scene)
// Uses cloud LLM to break each scene into shots.
// Creates HybridShot records in DB.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────

interface ShotPlanRequest {
  projectId: string;
  sceneId?: string; // optional — plan shots for a single scene
}

interface LLMShot {
  shotId: string;                 // SH01, SH02...
  orderIndex: number;
  visibleCharacterIds: string[];
  speakingCharacterId: string | null;
  listeningCharacterIds: string[];
  cameraAngle: string;            // close-up, medium, wide, OTS, bird-eye, low-angle
  cameraMovement: string;         // static, pan, tilt, dolly, crane, handheld
  framingType: string;            // single, two-shot, group, establishing, insert
  lightingStyle: string;          // natural, dramatic, soft, high-key, low-key, silhouette
  mediaType: string;              // image, video, image-to-video
  plannedDuration: number;        // seconds
  environmentSfx: string | null;  // ambient sound suggestion
  regenEligible: boolean;
}

interface LLMShotPlan {
  sceneId: string;
  shots: LLMShot[];
}

// ── JSON extraction helper ───────────────────────────────────────

function extractJSON(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    // ignore
  }

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // ignore
    }
  }

  const braceStart = raw.indexOf("{");
  const braceEnd = raw.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.slice(braceStart, braceEnd + 1));
    } catch {
      // ignore
    }
  }

  // Try array
  const arrStart = raw.indexOf("[");
  const arrEnd = raw.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(raw.slice(arrStart, arrEnd + 1));
    } catch {
      // ignore
    }
  }

  return null;
}

// ── Validation ───────────────────────────────────────────────────

function isValidShotPlan(obj: unknown): obj is LLMShotPlan[] {
  if (!Array.isArray(obj)) return false;
  return obj.every(
    (sp) =>
      typeof sp === "object" &&
      sp !== null &&
      typeof (sp as Record<string, unknown>).sceneId === "string" &&
      Array.isArray((sp as Record<string, unknown>).shots)
  );
}

// ── Fallback shot plan for a scene ───────────────────────────────

function buildFallbackShots(
  sceneId: string,
  characterIds: string[],
  primarySpeaker: string | null
): LLMShotPlan {
  const mainChar = primarySpeaker || characterIds[0] || "CH01";
  return {
    sceneId,
    shots: [
      {
        shotId: "SH01",
        orderIndex: 0,
        visibleCharacterIds: characterIds.length > 0 ? characterIds : [mainChar],
        speakingCharacterId: null,
        listeningCharacterIds: [],
        cameraAngle: "wide",
        cameraMovement: "static",
        framingType: "establishing",
        lightingStyle: "natural",
        mediaType: "image",
        plannedDuration: 3,
        environmentSfx: "ambient",
        regenEligible: true,
      },
      {
        shotId: "SH02",
        orderIndex: 1,
        visibleCharacterIds: [mainChar],
        speakingCharacterId: mainChar,
        listeningCharacterIds: characterIds.filter((c) => c !== mainChar),
        cameraAngle: "medium",
        cameraMovement: "static",
        framingType: "single",
        lightingStyle: "natural",
        mediaType: "image-to-video",
        plannedDuration: 5,
        environmentSfx: null,
        regenEligible: true,
      },
      {
        shotId: "SH03",
        orderIndex: 2,
        visibleCharacterIds: characterIds.length > 0 ? characterIds : [mainChar],
        speakingCharacterId: null,
        listeningCharacterIds: [],
        cameraAngle: "close-up",
        cameraMovement: "dolly",
        framingType: characterIds.length > 1 ? "two-shot" : "single",
        lightingStyle: "dramatic",
        mediaType: "video",
        plannedDuration: 4,
        environmentSfx: null,
        regenEligible: true,
      },
    ],
  };
}

// ── POST handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ShotPlanRequest;

    if (!body.projectId || typeof body.projectId !== "string") {
      return NextResponse.json(
        { ok: false, error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.hybridProject.findUnique({
      where: { id: body.projectId },
    });
    if (!project) {
      return NextResponse.json(
        { ok: false, error: `Project not found: ${body.projectId}` },
        { status: 404 }
      );
    }

    // Load scenes — either a single scene or all scenes for the project
    const whereClause = body.sceneId
      ? { projectId: body.projectId, sceneId: body.sceneId }
      : { projectId: body.projectId };

    const scenes = await prisma.hybridScene.findMany({
      where: whereClause,
      orderBy: { orderIndex: "asc" },
    });

    if (scenes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No scenes found. Run scene-breakdown first." },
        { status: 400 }
      );
    }

    // Build scene data for LLM prompt
    const sceneDescriptions = scenes.map((sc) => ({
      sceneId: sc.sceneId,
      title: sc.title,
      sceneType: sc.sceneType,
      mood: sc.mood,
      location: sc.location,
      timeOfDay: sc.timeOfDay,
      characterIds: sc.characterIds,
      primarySpeaker: sc.primarySpeaker,
      secondarySpeakers: sc.secondarySpeakers,
      motionNeed: sc.motionNeed,
      dialogueDensity: sc.dialogueDensity,
      emotionalWeight: sc.emotionalWeight,
      durationEstimate: sc.durationEstimate,
      cameraSuggestion: sc.cameraSuggestion,
      lightingPlan: sc.lightingPlan,
    }));

    const userPrompt = `Break each scene into individual shots for hybrid video production.

Scenes:
${JSON.stringify(sceneDescriptions, null, 2)}

For each scene, generate a list of shots. Each shot MUST include:
- shotId: sequential ID within the scene (SH01, SH02, SH03...)
- orderIndex: 0-based position within the scene
- visibleCharacterIds: array of character IDs visible in frame
- speakingCharacterId: character ID who speaks in this shot (null if no dialogue)
- listeningCharacterIds: array of character IDs reacting/listening
- cameraAngle: one of "close-up", "medium", "wide", "OTS", "bird-eye", "low-angle", "dutch-angle"
- cameraMovement: one of "static", "pan", "tilt", "dolly", "crane", "handheld", "tracking"
- framingType: one of "single", "two-shot", "group", "establishing", "insert", "reaction"
- lightingStyle: one of "natural", "dramatic", "soft", "high-key", "low-key", "silhouette", "neon"
- mediaType: one of "image", "video", "image-to-video"
- plannedDuration: duration in seconds (typically 2-8)
- environmentSfx: ambient/environmental sound effect for this shot (null if none)
- regenEligible: boolean (true unless the shot is critical and must stay fixed)

Rules:
- Action-heavy scenes need more video shots and camera movement.
- Dialogue scenes need close-ups and medium shots with static or minimal movement.
- Establishing shots should use wide framing and be images or image-to-video.
- Each scene should have 2-6 shots depending on complexity.
- Use image for static moments, video for action, image-to-video for transitions.
- Ensure character IDs match exactly what is given in the scene data.

Return ONLY valid JSON (no markdown, no explanation) as an array:
[
  {
    "sceneId": "SC01",
    "shots": [
      {
        "shotId": "SH01",
        "orderIndex": 0,
        "visibleCharacterIds": ["CH01"],
        "speakingCharacterId": null,
        "listeningCharacterIds": [],
        "cameraAngle": "wide",
        "cameraMovement": "static",
        "framingType": "establishing",
        "lightingStyle": "natural",
        "mediaType": "image",
        "plannedDuration": 3,
        "environmentSfx": "wind rustling",
        "regenEligible": true
      }
    ]
  }
]`;

    const systemPrompt =
      "You are GHS Shot Planner. Break scenes into cinematic shots for hybrid video production. " +
      "Always respond with valid JSON only. No markdown fences, no explanation text. " +
      "Match character IDs exactly to the scene data provided.";

    // Use quality role for planning tasks (closest to "planning" in the router)
    const llmResult = await callLLM(userPrompt, systemPrompt, {
      role: "quality",
      temperature: 0.5,
      maxTokens: 8000,
    });

    let shotPlans: LLMShotPlan[];

    if (llmResult.ok) {
      const parsed = extractJSON(llmResult.text);
      if (parsed && isValidShotPlan(parsed)) {
        shotPlans = parsed;
      } else {
        console.warn("[shot-plan] LLM response failed validation, using fallback");
        shotPlans = scenes.map((sc) =>
          buildFallbackShots(sc.sceneId, sc.characterIds, sc.primarySpeaker)
        );
      }
    } else {
      console.warn(`[shot-plan] LLM failed: ${llmResult.error}, using fallback`);
      shotPlans = scenes.map((sc) =>
        buildFallbackShots(sc.sceneId, sc.characterIds, sc.primarySpeaker)
      );
    }

    // Map scene sceneId -> DB id for relation
    const sceneIdToDbId: Record<string, string> = {};
    for (const sc of scenes) {
      sceneIdToDbId[sc.sceneId] = sc.id;
    }

    // Delete existing shots for these scenes before inserting new ones
    const dbSceneIds = scenes.map((sc) => sc.id);
    await prisma.hybridShot.deleteMany({
      where: { sceneId: { in: dbSceneIds } },
    });

    // Create HybridShot records
    let totalCreated = 0;
    const createdShots: Array<{ sceneId: string; shotId: string; id: string }> = [];

    for (const plan of shotPlans) {
      const dbSceneId = sceneIdToDbId[plan.sceneId];
      if (!dbSceneId) {
        console.warn(`[shot-plan] Unknown sceneId in LLM response: ${plan.sceneId}, skipping`);
        continue;
      }

      for (const shot of plan.shots) {
        const record = await prisma.hybridShot.create({
          data: {
            sceneId: dbSceneId,
            shotId: shot.shotId,
            orderIndex: shot.orderIndex,
            visibleCharacterIds: shot.visibleCharacterIds,
            speakingCharacterId: shot.speakingCharacterId ?? null,
            listeningCharacterIds: shot.listeningCharacterIds ?? [],
            cameraAngle: shot.cameraAngle ?? null,
            cameraMovement: shot.cameraMovement ?? null,
            framingType: shot.framingType ?? null,
            lightingStyle: shot.lightingStyle ?? null,
            mediaType: shot.mediaType ?? null,
            plannedDuration: shot.plannedDuration ?? null,
            environmentSfx: shot.environmentSfx ?? null,
            regenEligible: shot.regenEligible ?? true,
            status: "planned",
          },
        });
        createdShots.push({ sceneId: plan.sceneId, shotId: shot.shotId, id: record.id });
        totalCreated++;
      }
    }

    return NextResponse.json({
      ok: true,
      projectId: body.projectId,
      scenesProcessed: shotPlans.length,
      shotsCreated: totalCreated,
      shots: createdShots,
      provider: llmResult.ok ? (llmResult as { provider: string }).provider : "fallback",
    });
  } catch (err) {
    console.error("[shot-plan] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
