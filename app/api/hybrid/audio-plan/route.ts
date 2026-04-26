// POST /api/hybrid/audio-plan — Step 12: Audio Planning Layer
//
// Takes: { projectId, sceneId? }
// If sceneId is omitted, plans audio for ALL scenes in the project.
// Creates/updates AudioPlan records in DB (one per scene).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm";
import { getNarrationStrategy } from "@/lib/narration-engine";

// ── Types for LLM-generated suggestions ─────────────────────
interface AmbienceSuggestion {
  description: string;
  volume: number;
  loop: boolean;
}

interface SfxSuggestion {
  event: string;
  timing: number;
  volume: number;
}

interface MusicSuggestion {
  mood: string;
  intensity: "low" | "medium" | "high";
  instrument?: string;
  fadeIn?: number;
  fadeOut?: number;
}

interface AudioSuggestions {
  ambience: AmbienceSuggestion[];
  sfx: SfxSuggestion[];
  music: MusicSuggestion;
  transitionLogic: string;
}

// ── Build the LLM prompt for ambience / SFX / music ─────────
function buildAudioPrompt(scene: {
  title: string;
  location?: string | null;
  weather?: string | null;
  mood?: string | null;
  sceneType: string;
  tags: string[];
  dialogueLines: { lineText: string; characterId: string }[];
}): string {
  return [
    "You are an audio director for a hybrid video production.",
    "Given the following scene information, produce a JSON object with these keys:",
    '  "ambience": array of { description: string, volume: 0-1, loop: boolean }',
    '  "sfx": array of { event: string, timing: number (seconds from scene start), volume: 0-1 }',
    '  "music": { mood: string, intensity: "low"|"medium"|"high", instrument?: string, fadeIn?: number, fadeOut?: number }',
    '  "transitionLogic": string describing how audio should transition to the next scene',
    "",
    "Scene details:",
    `  Title: ${scene.title}`,
    `  Location: ${scene.location ?? "unspecified"}`,
    `  Weather: ${scene.weather ?? "unspecified"}`,
    `  Mood: ${scene.mood ?? "neutral"}`,
    `  Scene type: ${scene.sceneType}`,
    `  Tags: ${scene.tags.join(", ") || "none"}`,
    `  Dialogue count: ${scene.dialogueLines.length}`,
    "",
    "Respond ONLY with valid JSON, no markdown fences.",
  ].join("\n");
}

// ── Parse LLM response safely ───────────────────────────────
function parseAudioSuggestions(raw: string): AudioSuggestions {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      ambience: Array.isArray(parsed.ambience) ? parsed.ambience : [],
      sfx: Array.isArray(parsed.sfx) ? parsed.sfx : [],
      music: parsed.music ?? { mood: "neutral", intensity: "low" },
      transitionLogic: parsed.transitionLogic ?? "crossfade",
    };
  } catch {
    // Fallback if LLM returns unparseable output
    return {
      ambience: [{ description: "room tone", volume: 0.3, loop: true }],
      sfx: [],
      music: { mood: "neutral", intensity: "low" },
      transitionLogic: "crossfade to next scene",
    };
  }
}

// ── Plan audio for a single scene ───────────────────────────
async function planSceneAudio(scene: {
  id: string;
  sceneId: string;
  title: string;
  location: string | null;
  weather: string | null;
  mood: string | null;
  sceneType: string;
  tags: string[];
  dialogueLines: { lineText: string; characterId: string; voiceId: string | null }[];
}) {
  // 1. Narration strategy from engine
  const strategy = getNarrationStrategy(scene.sceneType);

  // 2. Build narration track based on strategy
  const narrationTrack = strategy.intensity !== "none"
    ? {
        text: "", // narration text generated in a later step
        voiceId: null,
        intensity: strategy.intensity,
        style: strategy.mode,
      }
    : null;

  // 3. Dialogue tracks from existing DialogueLine records
  const dialogueByCharacter = new Map<string, { voiceId: string | null; lines: string[] }>();
  for (const dl of scene.dialogueLines) {
    const existing = dialogueByCharacter.get(dl.characterId);
    if (existing) {
      existing.lines.push(dl.lineText);
    } else {
      dialogueByCharacter.set(dl.characterId, {
        voiceId: dl.voiceId,
        lines: [dl.lineText],
      });
    }
  }
  const dialogueTracks = Array.from(dialogueByCharacter.entries()).map(
    ([characterId, data]) => ({
      characterId,
      voiceId: data.voiceId,
      lines: data.lines,
    })
  );

  // 4. Call LLM for ambience, SFX, music, transition suggestions
  const prompt = buildAudioPrompt({
    title: scene.title,
    location: scene.location,
    weather: scene.weather,
    mood: scene.mood,
    sceneType: scene.sceneType,
    tags: scene.tags,
    dialogueLines: scene.dialogueLines,
  });

  const llmResult = await callLLM(prompt, "You are an audio planning assistant for film production.", {
    role: "planning" as any,
    maxTokens: 800,
    temperature: 0.5,
  });

  const suggestions = llmResult.ok
    ? parseAudioSuggestions(llmResult.text)
    : parseAudioSuggestions(""); // use fallback

  // 5. Upsert AudioPlan into DB
  const audioPlan = await prisma.audioPlan.upsert({
    where: { sceneId: scene.id },
    update: {
      narrationTrack: narrationTrack as any,
      dialogueTracks: dialogueTracks as any,
      ambienceTracks: suggestions.ambience as any,
      sfxTracks: suggestions.sfx as any,
      musicTrack: suggestions.music as any,
      transitionAudioLogic: suggestions.transitionLogic,
    },
    create: {
      sceneId: scene.id,
      narrationTrack: narrationTrack as any,
      dialogueTracks: dialogueTracks as any,
      ambienceTracks: suggestions.ambience as any,
      sfxTracks: suggestions.sfx as any,
      musicTrack: suggestions.music as any,
      transitionAudioLogic: suggestions.transitionLogic,
    },
  });

  return {
    sceneId: scene.sceneId,
    audioPlanId: audioPlan.id,
    narrationStrategy: strategy,
    dialogueTrackCount: dialogueTracks.length,
    ambienceTrackCount: suggestions.ambience.length,
    sfxTrackCount: suggestions.sfx.length,
    musicMood: suggestions.music.mood,
    llmProvider: llmResult.ok ? (llmResult as any).provider : "fallback",
  };
}

// ── Inline audio plan — takes scenes[] directly, returns audioPlans[] in frontend format ──
// Used by the hybrid planner frontend (no projectId needed).
async function planScenesInline(
  scenes: Array<{ sceneId: string; title: string; description: string; location?: string; mood?: string; sceneType?: string }>,
  storyContext?: string,
  generateNarration?: boolean,
): Promise<{ audioPlans: AudioPlan[]; narrationScripts: string[] }> {
  const audioPlans: AudioPlan[] = [];
  const narrationScripts: string[] = [];

  for (const scene of scenes) {
    const sfxHint = (scene as any).existingSfxHint as string | undefined;
    const ambienceHint = (scene as any).existingAmbienceHint as string | undefined;
    const prompt = buildAudioPrompt({
      title: scene.title,
      location: scene.location ?? null,
      weather: null,
      mood: scene.mood ?? null,
      sceneType: scene.sceneType ?? "image-led",
      tags: [
        ...(sfxHint ? [`detected SFX: ${sfxHint}`] : []),
        ...(ambienceHint ? [`detected ambience: ${ambienceHint}`] : []),
      ],
      dialogueLines: [],
    });

    const llmResult = await callLLM(prompt, "You are an audio planning assistant for film production.", {
      role: "planning" as any,
      maxTokens: 600,
      temperature: 0.5,
    });

    const suggestions = llmResult.ok ? parseAudioSuggestions(llmResult.text) : parseAudioSuggestions("");

    // Build narration if requested
    let narration = "";
    if (generateNarration) {
      const narrationPrompt = [
        "Write a short cinematic narrator line (1-2 sentences) for this scene.",
        `Story context: ${(storyContext || "").slice(0, 400)}`,
        `Scene: ${scene.title}. ${scene.description}`,
        "Respond with ONLY the narration text, no quotes, no labels.",
      ].join("\n");
      const nr = await callLLM(narrationPrompt, "You are a film narrator.", { role: "narration" as any, maxTokens: 120, temperature: 0.7 });
      narration = nr.ok ? nr.text.trim() : "";
    }

    // Map DB-style suggestions → frontend AudioPlan format
    const audioPlan: AudioPlan = {
      narrationIntensity: suggestions.music.intensity ?? "medium",
      musicMood: suggestions.music.mood ?? "cinematic",
      musicIntensity: suggestions.music.intensity ?? "medium",
      sfxList: suggestions.sfx.map((s: SfxSuggestion) => s.event).filter(Boolean),
      ambienceList: suggestions.ambience.map((a: AmbienceSuggestion) => a.description).filter(Boolean),
      transitionAudio: suggestions.transitionLogic ?? "crossfade",
    };

    audioPlans.push(audioPlan);
    narrationScripts.push(narration);
  }

  return { audioPlans, narrationScripts };
}

// ── AudioPlan type matching frontend interface ────────────────
interface AudioPlan {
  narrationIntensity: string;
  musicMood: string;
  musicIntensity: string;
  sfxList: string[];
  ambienceList: string[];
  transitionAudio: string;
}

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { projectId, sceneId, scenes: inlineScenes, storyContext, generateNarration } = body as {
      projectId?: string;
      sceneId?: string;
      scenes?: Array<{ sceneId: string; title: string; description: string; location?: string; mood?: string; sceneType?: string }>;
      storyContext?: string;
      generateNarration?: boolean;
    };

    // ── INLINE MODE: scenes[] passed directly (from hybrid planner UI) ──
    if (inlineScenes?.length && !projectId) {
      const result = await planScenesInline(inlineScenes, storyContext, generateNarration);
      return NextResponse.json({ ok: true, ...result });
    }

    // ── DB MODE: projectId required ──
    if (!projectId) {
      return NextResponse.json({ error: "Provide either projectId or scenes[]" }, { status: 400 });
    }

    const project = await prisma.hybridProject.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const whereClause: any = { projectId };
    if (sceneId) whereClause.sceneId = sceneId;

    const dbScenes = await prisma.hybridScene.findMany({
      where: whereClause,
      orderBy: { orderIndex: "asc" },
      include: {
        dialogueLines: {
          orderBy: { orderIndex: "asc" },
          select: { lineText: true, characterId: true, voiceId: true },
        },
      },
    });

    if (dbScenes.length === 0) {
      return NextResponse.json(
        { error: sceneId ? "Scene not found" : "No scenes found for this project" },
        { status: 404 }
      );
    }

    // Plan each scene and save to DB
    const results = [];
    const audioPlans: AudioPlan[] = [];
    for (const scene of dbScenes) {
      const result = await planSceneAudio(scene);
      results.push(result);
      // Also fetch the saved AudioPlan and return in frontend format
      const saved = await prisma.audioPlan.findUnique({ where: { sceneId: scene.id } });
      const sfxTracks = (saved?.sfxTracks ?? []) as Array<{ event: string }>;
      const ambienceTracks = (saved?.ambienceTracks ?? []) as Array<{ description: string }>;
      const musicTrack = (saved?.musicTrack ?? {}) as { mood?: string; intensity?: string };
      audioPlans.push({
        narrationIntensity: musicTrack.intensity ?? "medium",
        musicMood: musicTrack.mood ?? result.musicMood,
        musicIntensity: musicTrack.intensity ?? "medium",
        sfxList: sfxTracks.map(s => s.event).filter(Boolean),
        ambienceList: ambienceTracks.map(a => a.description).filter(Boolean),
        transitionAudio: saved?.transitionAudioLogic ?? "crossfade",
      });
    }

    if (!sceneId) {
      await prisma.hybridProject.update({ where: { id: projectId }, data: { status: "AUDIO_PLANNED" } });
    }

    return NextResponse.json({ ok: true, projectId, planned: results.length, results, audioPlans });
  } catch (err) {
    console.error("[audio-plan] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
