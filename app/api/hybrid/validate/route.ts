// POST /api/hybrid/validate — Step 17: Continuity Validation
// Loads full project from DB, runs validation, returns errors/warnings
// Must pass before "Assemble My Scenes" is allowed

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateHybridProject, type HybridProjectFull } from "@/lib/continuity-validator";

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Load full project with all relations
    const project = await prisma.hybridProject.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          include: {
            shots: true,
            dialogueLines: true,
            audioPlan: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Load characters
    const characters = project.characterIds.length > 0
      ? await prisma.characterVoice.findMany({
          where: { id: { in: project.characterIds } },
        })
      : [];

    // Build the full project shape for validation
    const fullProject: HybridProjectFull = {
      project: { id: project.id, characterIds: project.characterIds },
      scenes: project.scenes.map(s => ({
        id: s.id,
        sceneId: s.sceneId,
        sceneType: s.sceneType,
        characterIds: s.characterIds,
        primarySpeaker: s.primarySpeaker ?? undefined,
        shots: s.shots.map(sh => ({
          shotId: sh.shotId,
          visibleCharacterIds: sh.visibleCharacterIds,
          speakingCharacterId: sh.speakingCharacterId ?? undefined,
        })),
        dialogueLines: s.dialogueLines.map(d => ({
          characterId: d.characterId,
          voiceId: d.voiceId ?? undefined,
          lineText: d.lineText,
        })),
        audioPlan: s.audioPlan ? { narrationTrack: s.audioPlan.narrationTrack } : null,
      })),
      characters: characters.map(c => ({
        id: c.id,
        characterId: c.characterId ?? undefined,
        name: c.name,
        voiceId: c.voiceId ?? undefined,
      })),
    };

    const result = validateHybridProject(fullProject);

    // Update project status
    if (result.valid) {
      await prisma.hybridProject.update({
        where: { id: projectId },
        data: { status: "VALIDATED" },
      });
    }

    return NextResponse.json({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      sceneCount: project.scenes.length,
      characterCount: characters.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 500 }
    );
  }
}
