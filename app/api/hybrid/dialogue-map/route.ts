// GioHomeStudio — Hybrid Pipeline Step 10: Dialogue Ownership Mapping
//
// Takes: projectId
// Uses cloud LLM to map dialogue lines to character IDs.
// Creates DialogueLine records in DB.
// CRITICAL: Every dialogue line MUST have a characterId. No unowned text.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────

interface DialogueMapRequest {
  projectId: string;
}

interface LLMDialogueLine {
  sceneId: string;
  shotId: string | null;
  characterId: string;       // CH01, CH02... — NEVER empty or unowned
  lineText: string;
  timingType: string;        // sync, pre-lap, post-lap, overlap
  orderIndex: number;
}

interface LLMDialogueMap {
  sceneId: string;
  lines: LLMDialogueLine[];
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

function isValidDialogueMap(obj: unknown): obj is LLMDialogueMap[] {
  if (!Array.isArray(obj)) return false;
  return obj.every((dm) => {
    if (typeof dm !== "object" || dm === null) return false;
    const d = dm as Record<string, unknown>;
    if (typeof d.sceneId !== "string" || !Array.isArray(d.lines)) return false;
    // Every line MUST have a characterId
    return (d.lines as unknown[]).every((line) => {
      if (typeof line !== "object" || line === null) return false;
      const l = line as Record<string, unknown>;
      return (
        typeof l.characterId === "string" &&
        l.characterId.length > 0 &&
        typeof l.lineText === "string" &&
        l.lineText.length > 0
      );
    });
  });
}

// ── Fallback dialogue for a scene ────────────────────────────────

function buildFallbackDialogue(
  sceneId: string,
  primarySpeaker: string | null,
  characterIds: string[]
): LLMDialogueMap {
  const mainChar = primarySpeaker || characterIds[0] || "CH01";
  return {
    sceneId,
    lines: [
      {
        sceneId,
        shotId: null,
        characterId: mainChar,
        lineText: `[Dialogue placeholder for ${mainChar} in scene ${sceneId}]`,
        timingType: "sync",
        orderIndex: 0,
      },
    ],
  };
}

// ── POST handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DialogueMapRequest;

    if (!body.projectId || typeof body.projectId !== "string") {
      return NextResponse.json(
        { ok: false, error: "projectId is required" },
        { status: 400 }
      );
    }

    // 1. Verify project exists
    const project = await prisma.hybridProject.findUnique({
      where: { id: body.projectId },
    });
    if (!project) {
      return NextResponse.json(
        { ok: false, error: `Project not found: ${body.projectId}` },
        { status: 404 }
      );
    }

    // 2. Load all scenes for the project
    const scenes = await prisma.hybridScene.findMany({
      where: { projectId: body.projectId },
      orderBy: { orderIndex: "asc" },
    });

    if (scenes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No scenes found. Run scene-breakdown first." },
        { status: 400 }
      );
    }

    // 3. Load all characters linked to this project
    const characters = await prisma.characterVoice.findMany({
      where: {
        id: { in: project.characterIds },
      },
    });

    // Build character lookup: characterId field -> DB record
    const charById: Record<string, { id: string; voiceId: string | null; name: string }> = {};
    for (const ch of characters) {
      if (ch.characterId) {
        charById[ch.characterId] = { id: ch.id, voiceId: ch.voiceId, name: ch.name };
      }
      // Also index by name for fallback matching
      charById[ch.name.toUpperCase()] = { id: ch.id, voiceId: ch.voiceId, name: ch.name };
    }

    // Build scene data for LLM
    const sceneDescriptions = scenes.map((sc) => ({
      sceneId: sc.sceneId,
      title: sc.title,
      sceneType: sc.sceneType,
      mood: sc.mood,
      characterIds: sc.characterIds,
      primarySpeaker: sc.primarySpeaker,
      secondarySpeakers: sc.secondarySpeakers,
      dialogueDensity: sc.dialogueDensity,
    }));

    // Build character reference for LLM
    const characterRef = characters.map((ch) => ({
      characterId: ch.characterId || ch.id,
      name: ch.name,
      role: ch.role,
      gender: ch.gender,
      defaultSpeechStyle: ch.defaultSpeechStyle,
    }));

    const userPrompt = `Generate dialogue lines for each scene in this hybrid video project.

Scenes:
${JSON.stringify(sceneDescriptions, null, 2)}

Available characters:
${JSON.stringify(characterRef, null, 2)}

For each scene, create dialogue lines that fit the scene type, mood, and characters present.

CRITICAL RULES:
1. Every single dialogue line MUST have a characterId from the available characters list.
2. NEVER leave a line without a characterId. No unowned text.
3. Use the characterId field (e.g. CH01, CH02) to identify characters — NOT the name.
4. Only assign dialogue to characters listed in the scene's characterIds array.
5. If a scene has a primarySpeaker, they should have the most lines.
6. Match dialogue style to the character's role and the scene mood.

Each line MUST include:
- sceneId: the scene this line belongs to
- shotId: null (will be mapped later)
- characterId: the character ID who speaks this line (REQUIRED — NEVER empty)
- lineText: the actual dialogue text
- timingType: one of "sync", "pre-lap", "post-lap", "overlap"
- orderIndex: 0-based position within the scene

Return ONLY valid JSON (no markdown, no explanation) as an array:
[
  {
    "sceneId": "SC01",
    "lines": [
      {
        "sceneId": "SC01",
        "shotId": null,
        "characterId": "CH01",
        "lineText": "The dialogue text here",
        "timingType": "sync",
        "orderIndex": 0
      }
    ]
  }
]`;

    const systemPrompt =
      "You are GHS Dialogue Mapper. Generate dialogue for video scenes and map every line to a specific character. " +
      "NEVER create unowned dialogue — every line must have a valid characterId. " +
      "Always respond with valid JSON only. No markdown fences, no explanation text.";

    // Use quality role for planning tasks
    const llmResult = await callLLM(userPrompt, systemPrompt, {
      role: "quality",
      temperature: 0.6,
      maxTokens: 8000,
    });

    let dialogueMaps: LLMDialogueMap[];

    if (llmResult.ok) {
      const parsed = extractJSON(llmResult.text);
      if (parsed && isValidDialogueMap(parsed)) {
        dialogueMaps = parsed;
      } else {
        console.warn("[dialogue-map] LLM response failed validation, using fallback");
        dialogueMaps = scenes.map((sc) =>
          buildFallbackDialogue(sc.sceneId, sc.primarySpeaker, sc.characterIds)
        );
      }
    } else {
      console.warn(`[dialogue-map] LLM failed: ${llmResult.error}, using fallback`);
      dialogueMaps = scenes.map((sc) =>
        buildFallbackDialogue(sc.sceneId, sc.primarySpeaker, sc.characterIds)
      );
    }

    // Enforce ownership: reject any line without a valid characterId
    for (const dm of dialogueMaps) {
      dm.lines = dm.lines.filter((line) => {
        if (!line.characterId || line.characterId.trim() === "") {
          console.warn(`[dialogue-map] Dropping unowned line in ${dm.sceneId}: "${line.lineText?.slice(0, 40)}..."`);
          return false;
        }
        return true;
      });
    }

    // Map scene sceneId -> DB id for relation
    const sceneIdToDbId: Record<string, string> = {};
    for (const sc of scenes) {
      sceneIdToDbId[sc.sceneId] = sc.id;
    }

    // Delete existing dialogue lines for these scenes
    const dbSceneIds = scenes.map((sc) => sc.id);
    await prisma.dialogueLine.deleteMany({
      where: { sceneId: { in: dbSceneIds } },
    });

    // 4-6. Map each line to a characterId, look up voiceId, save records
    let totalCreated = 0;
    let droppedLines = 0;
    const createdLines: Array<{ sceneId: string; characterId: string; id: string }> = [];

    for (const dm of dialogueMaps) {
      const dbSceneId = sceneIdToDbId[dm.sceneId];
      if (!dbSceneId) {
        console.warn(`[dialogue-map] Unknown sceneId in LLM response: ${dm.sceneId}, skipping`);
        continue;
      }

      for (const line of dm.lines) {
        // Look up the character's voiceId from CharacterVoice table
        const charLookup =
          charById[line.characterId] ||
          charById[line.characterId.toUpperCase()] ||
          null;

        if (!charLookup) {
          // Character not found — still save with the characterId but no voiceId
          // This preserves ownership even if voice mapping happens later
          console.warn(
            `[dialogue-map] Character ${line.characterId} not found in CharacterVoice table, saving without voiceId`
          );
        }

        const voiceId = charLookup?.voiceId ?? null;

        const record = await prisma.dialogueLine.create({
          data: {
            sceneId: dbSceneId,
            shotId: line.shotId ?? null,
            characterId: line.characterId,
            voiceId,
            lineText: line.lineText,
            timingType: line.timingType ?? "sync",
            orderIndex: line.orderIndex ?? totalCreated,
          },
        });

        createdLines.push({
          sceneId: dm.sceneId,
          characterId: line.characterId,
          id: record.id,
        });
        totalCreated++;
      }
    }

    return NextResponse.json({
      ok: true,
      projectId: body.projectId,
      scenesProcessed: dialogueMaps.length,
      linesCreated: totalCreated,
      linesDropped: droppedLines,
      lines: createdLines,
      provider: llmResult.ok ? (llmResult as { provider: string }).provider : "fallback",
    });
  } catch (err) {
    console.error("[dialogue-map] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
