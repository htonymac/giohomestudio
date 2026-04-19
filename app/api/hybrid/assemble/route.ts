// POST /api/hybrid/assemble — Step 18: "Assemble My Scenes"
// User-triggered ONLY. Converts structured hybrid data into AssemblyJSON.
// Creates an EditorProject record for the timeline editor.
// Source of truth: update/GHS_HYBRID_MASTER_WORKFLOW.md
//
// RULE: Assembly begins ONLY when the user triggers "Assemble My Scenes"
// All scenes must pass validation first.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEmptyAssembly } from "@/lib/assembly-schema";
import type { AssemblyJSON } from "@/lib/assembly-schema";

export async function POST(req: NextRequest) {
  try {
    const { projectId, skipValidation } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Load full project
    const project = await prisma.hybridProject.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          include: {
            shots: { orderBy: { orderIndex: "asc" } },
            dialogueLines: { orderBy: { orderIndex: "asc" } },
            audioPlan: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check validation status (skip only if explicitly requested)
    if (!skipValidation && project.status !== "VALIDATED" && project.status !== "ASSEMBLED") {
      return NextResponse.json(
        { error: "Project must be validated before assembly. Run /api/hybrid/validate first." },
        { status: 400 }
      );
    }

    // Load characters for the registry
    const characters = project.characterIds.length > 0
      ? await prisma.characterVoice.findMany({
          where: { id: { in: project.characterIds } },
        })
      : [];

    // Build AssemblyJSON from structured hybrid data
    const assembly: AssemblyJSON = createEmptyAssembly(
      projectId,
      "hybrid",
      project.title
    );

    // Character registry in assembly
    (assembly as AssemblyJSON & { characterRegistry?: unknown[] }).characterRegistry = characters.map(c => ({
      characterId: c.characterId || c.id,
      displayName: c.name,
      voiceId: c.voiceId,
    }));

    (assembly as AssemblyJSON & { hybridProjectId?: string }).hybridProjectId = projectId;

    let timeOffset = 0;

    for (const scene of project.scenes) {
      const sceneDuration = scene.durationEstimate || 5;

      // Each scene becomes one or more segments based on shots
      if (scene.shots.length > 0) {
        // Use shot-level granularity
        for (const shot of scene.shots) {
          const shotDuration = shot.plannedDuration || (sceneDuration / scene.shots.length);
          assembly.segments.push({
            id: `seg_${scene.sceneId}_${shot.shotId}`,
            type: shot.mediaType === "video" ? "video" : shot.mediaType === "image-to-video" ? "video" : "image",
            sourceUrl: shot.generatedAssetUrl || scene.generatedAssetUrl || "",
            startTime: timeOffset,
            endTime: timeOffset + shotDuration,
            duration: shotDuration,
            transitionIn: "cut",
            transitionOut: "fade",
            characterId: shot.speakingCharacterId || undefined,
            sceneId: scene.sceneId,
            shotId: shot.shotId,
            sceneType: scene.sceneType,
            imageTreatment: scene.sceneType === "image-led" ? "zoom_in" : undefined,
          });
          timeOffset += shotDuration;
        }
      } else {
        // Scene-level segment (no shots planned)
        assembly.segments.push({
          id: `seg_${scene.sceneId}`,
          type: scene.sceneType === "video-led" ? "video" : scene.sceneType === "audio-bridge" ? "audio_bridge" : "image",
          sourceUrl: scene.generatedAssetUrl || "",
          startTime: timeOffset,
          endTime: timeOffset + sceneDuration,
          duration: sceneDuration,
          transitionIn: "cut",
          transitionOut: "fade",
          characterId: scene.primarySpeaker || undefined,
          sceneId: scene.sceneId,
          sceneType: scene.sceneType,
          imageTreatment: scene.sceneType === "image-led" ? "zoom_in" : undefined,
        });
        timeOffset += sceneDuration;
      }

      // Narration from audio plan
      if (scene.audioPlan?.narrationTrack) {
        const narrTrack = scene.audioPlan.narrationTrack as { text?: string; voiceId?: string; intensity?: string };
        if (narrTrack.text) {
          assembly.narration.push({
            id: `narr_${scene.sceneId}`,
            text: narrTrack.text,
            voiceId: narrTrack.voiceId,
            speakerId: scene.primarySpeaker || "narrator",
            startTime: timeOffset - sceneDuration,
            endTime: timeOffset,
            volume: narrTrack.intensity === "high" ? 1.0 : narrTrack.intensity === "medium" ? 0.8 : 0.6,
            speed: 1.0,
            style: "normal",
          });
        }
      }

      // Dialogue lines as narration entries
      for (const line of scene.dialogueLines) {
        const char = characters.find(c => c.characterId === line.characterId || c.id === line.characterId);
        assembly.narration.push({
          id: `dial_${line.id}`,
          text: line.lineText,
          voiceId: line.voiceId || char?.voiceId || undefined,
          speakerId: char?.name || line.characterId,
          startTime: timeOffset - sceneDuration, // Will need proper timing
          endTime: timeOffset,
          volume: 1.0,
          speed: 1.0,
          style: "normal",
        });
      }

      // Music from audio plan
      if (scene.audioPlan?.musicTrack) {
        const music = scene.audioPlan.musicTrack as { mood?: string; intensity?: string };
        assembly.music.push({
          id: `music_${scene.sceneId}`,
          sourceUrl: "", // Will be generated
          startTime: timeOffset - sceneDuration,
          endTime: timeOffset,
          volume: music.intensity === "high" ? 0.4 : music.intensity === "medium" ? 0.25 : 0.15,
          duckUnderSpeech: true,
          duckLevel: 0.08,
        });
      }

      // SFX from audio plan
      if (scene.audioPlan?.sfxTracks) {
        const sfxList = scene.audioPlan.sfxTracks as Array<{ event: string; timing: number; volume: number }>;
        for (const sfx of sfxList) {
          assembly.sfx.push({
            id: `sfx_${scene.sceneId}_${sfx.event}`,
            event: sfx.event,
            sourceUrl: `/api/media/sfx/${sfx.event}.mp3`,
            startTime: (timeOffset - sceneDuration) + sfx.timing,
            duration: 2,
            volume: sfx.volume,
            loop: false,
            category: "scene",
          });
        }
      }

      // Lock scene after assembly
      await prisma.hybridScene.update({
        where: { id: scene.id },
        data: { draftState: "locked" },
      });
    }

    assembly.totalDuration = timeOffset;

    // Save as EditorProject for the timeline editor
    const editorProject = await prisma.editorProject.create({
      data: {
        title: project.title,
        type: "hybrid",
        status: "draft",
        assembly: JSON.parse(JSON.stringify(assembly)),
        segmentCount: assembly.segments.length,
        totalDuration: assembly.totalDuration,
        creationMode: "hybrid",
      },
    });

    // Update hybrid project status
    await prisma.hybridProject.update({
      where: { id: projectId },
      data: {
        status: "ASSEMBLED",
        editorProjectId: editorProject.id,
      },
    });

    return NextResponse.json({
      assemblyJson: assembly,
      editorProjectId: editorProject.id,
      segmentCount: assembly.segments.length,
      totalDuration: assembly.totalDuration,
      sceneCount: project.scenes.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assembly failed" },
      { status: 500 }
    );
  }
}
