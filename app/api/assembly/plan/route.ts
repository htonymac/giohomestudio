// POST /api/assembly/plan — AI Assembly Planner
//
// Takes project data (scenes, narration, music, SFX) and produces
// a complete Assembly JSON using model-tier routing.
//
// Architecture (from Support Canvas):
// "Planner AI produces Assembly JSON → Supervisor AI checks → FFmpeg builder executes"
// "Same JSON contract across all tiers — only planning quality changes"
//
// Flow:
// 1. Planner AI structures timeline (segments, narration timing, music, SFX placement)
// 2. Supervisor AI validates (continuity, ducking, timing conflicts)
// 3. Returns finalized Assembly JSON ready for preview/render

import { NextRequest, NextResponse } from "next/server";
import { createEmptyAssembly, type AssemblyJSON, type AssemblySegment, type NarrationEntry, type MusicEntry, type SFXEntry, type AmbienceEntry, type SubtitleEntry } from "@/lib/assembly-schema";
import { callPlanner, callSupervisor, getTierConfig, type ModelTier } from "@/lib/model-tier-router";
import { SFX_LIBRARY } from "@/modules/sfx";
import { audit } from "@/lib/audit";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

interface SceneInput {
  scene: number;
  title: string;
  type: "image" | "video" | "audio_bridge" | "hybrid";
  duration: number;
  visualDescription?: string;
  cameraDirection?: string;
  dialogue?: string;
  narrationText?: string;
  narrationStyle?: string;
  musicCue?: string;
  musicVolume?: number;
  soundEffects?: string[];
  ambience?: string;
  imageTreatment?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
}

interface PlanRequest {
  projectId: string;
  projectType: string;
  title: string;
  scenes: SceneInput[];
  tier: ModelTier;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  globalMusicUrl?: string;
  globalMusicVolume?: number;
  language?: string;
  includeSubtitles?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: PlanRequest = await req.json();

    if (!body.scenes?.length) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const tier = body.tier || "standard";
    const tierConfig = getTierConfig(tier);

    // ── Step 1: Build base Assembly JSON from scene data ──
    const assembly = createEmptyAssembly(body.projectId, body.projectType, body.title);
    assembly.aspectRatio = body.aspectRatio || "16:9";
    assembly.plannerTier = tier;
    assembly.resolution = body.aspectRatio === "9:16"
      ? { width: 1080, height: 1920 }
      : body.aspectRatio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 };

    // ── Step 2: Structure segments on timeline ──
    let currentTime = 0;

    for (const scene of body.scenes.sort((a, b) => a.scene - b.scene)) {
      const duration = scene.duration || 5;

      // Video/Image segment
      const segmentType = scene.type === "hybrid" ? "video" : scene.type === "audio_bridge" ? "audio_bridge" : scene.type;
      const sourceUrl = scene.videoUrl || scene.imageUrl || "";

      if (sourceUrl || segmentType === "audio_bridge") {
        const segment: AssemblySegment = {
          id: `seg_${scene.scene}`,
          type: segmentType as AssemblySegment["type"],
          sourceUrl,
          startTime: currentTime,
          endTime: currentTime + duration,
          duration,
          imageTreatment: scene.type === "image"
            ? (scene.imageTreatment as AssemblySegment["imageTreatment"]) || "zoom_in"
            : undefined,
          transitionIn: scene.scene === 1 ? "fade" : "cut",
          transitionOut: "cut",
          transitionDuration: scene.scene === 1 ? 0.5 : 0,
        };
        assembly.segments.push(segment);
      }

      // Narration
      if (scene.narrationText) {
        const narration: NarrationEntry = {
          id: `narr_${scene.scene}`,
          text: scene.narrationText,
          startTime: currentTime + 0.3, // slight delay after scene starts
          endTime: currentTime + duration - 0.3,
          volume: 1.0,
          speed: 1.0,
          style: (scene.narrationStyle as NarrationEntry["style"]) || "normal",
          audioUrl: scene.audioUrl,
        };
        assembly.narration.push(narration);
      }

      // SFX from scene
      if (scene.soundEffects?.length) {
        for (const sfxName of scene.soundEffects) {
          const sfxEntry = SFX_LIBRARY.find(s => s.event === sfxName);
          if (sfxEntry) {
            const sfx: SFXEntry = {
              id: `sfx_${scene.scene}_${sfxName}`,
              event: sfxName,
              sourceUrl: `/storage/sfx/${sfxEntry.filename}`,
              startTime: currentTime + 0.5, // slight offset
              duration: 2,
              volume: 0.7,
              loop: false,
              category: sfxEntry.category,
            };
            assembly.sfx.push(sfx);
          }
        }
      }

      // Ambience
      if (scene.ambience) {
        const amb: AmbienceEntry = {
          id: `amb_${scene.scene}`,
          sourceUrl: "", // will be resolved or generated
          startTime: currentTime,
          endTime: currentTime + duration,
          volume: 0.15,
          loop: true,
          fadeIn: 1.0,
          fadeOut: 1.0,
          description: scene.ambience,
        };
        assembly.ambience.push(amb);
      }

      // Subtitles from dialogue
      if (scene.dialogue && body.includeSubtitles) {
        const sub: SubtitleEntry = {
          id: `sub_${scene.scene}`,
          text: scene.dialogue,
          startTime: currentTime + 0.5,
          endTime: currentTime + duration - 0.5,
          position: "bottom",
          fontSize: 24,
          fontColor: "#ffffff",
          backgroundColor: "rgba(0,0,0,0.6)",
          style: "normal",
        };
        assembly.subtitles.push(sub);
      }

      currentTime += duration;
    }

    assembly.totalDuration = currentTime;

    // Global music track
    if (body.globalMusicUrl) {
      const music: MusicEntry = {
        id: "music_global",
        sourceUrl: body.globalMusicUrl,
        startTime: 0,
        endTime: currentTime,
        volume: body.globalMusicVolume ?? 0.25,
        fadeIn: 2.0,
        fadeOut: 3.0,
        duckUnderSpeech: true,
        duckLevel: assembly.duckingRules.musicDuckLevel,
      };
      assembly.music.push(music);
    }

    // Per-scene music cues (from scene musicCue field)
    for (const scene of body.scenes) {
      if (scene.musicCue && !body.globalMusicUrl) {
        const sceneStart = body.scenes
          .filter(s => s.scene < scene.scene)
          .reduce((t, s) => t + (s.duration || 5), 0);
        const music: MusicEntry = {
          id: `music_scene_${scene.scene}`,
          sourceUrl: "", // to be generated or resolved
          startTime: sceneStart,
          endTime: sceneStart + (scene.duration || 5),
          volume: scene.musicVolume ?? 0.25,
          fadeIn: 0.5,
          fadeOut: 1.0,
          duckUnderSpeech: true,
          duckLevel: assembly.duckingRules.musicDuckLevel,
        };
        assembly.music.push(music);
      }
    }

    // ── Step 3: AI Enhancement (Pro tier and above) ──
    let plannerProvider = "rule-based";
    let supervisorResult: { approved: boolean; notes: string[] } = { approved: true, notes: [] };

    if (tier !== "standard") {
      // Planner AI: optimize timing, suggest volume curves, improve SFX placement
      const plannerPrompt = buildPlannerPrompt(assembly, body.scenes);
      const plannerSystem = `You are a professional video assembly planner for GioHomeStudio.
Your job is to optimize the assembly timeline.
Return ONLY valid JSON with these fields:
- volumeAdjustments: array of { segmentId, narrationVolume, musicVolume, sfxVolume }
- timingFixes: array of { segmentId, adjustedStart, adjustedEnd, reason }
- missingSFX: array of { scene, suggestedSFX, reason }
- duckingNotes: array of strings
Keep it concise. No markdown, just JSON.`;

      const plannerResult = await callPlanner(plannerPrompt, plannerSystem, tier);
      if (plannerResult.ok) {
        plannerProvider = plannerResult.provider;
        try {
          const parsed = JSON.parse(cleanJsonResponse(plannerResult.text));
          applyPlannerSuggestions(assembly, parsed);
        } catch {
          // AI returned non-JSON, skip enhancements
        }
      }
    }

    // ── Step 4: Supervisor Validation (Premium tier and above) ──
    if (tier === "premium" || tier === "premium_best") {
      const supervisorPrompt = buildSupervisorPrompt(assembly);
      const supervisorSystem = `You are a quality supervisor for GioHomeStudio video assembly.
Check the assembly plan for:
1. Timing conflicts (overlapping segments, gaps)
2. Volume issues (too loud, too quiet, ducking problems)
3. Missing elements (scenes without audio, dead silence)
4. License issues (missing attribution for CC BY sounds)
Return ONLY valid JSON: { "approved": boolean, "issues": [{ "type": string, "description": string, "fix": string }] }
No markdown, just JSON.`;

      const supResult = await callSupervisor(supervisorPrompt, supervisorSystem, tier);
      if (supResult.ok) {
        assembly.supervisorTier = tier;
        try {
          const parsed = JSON.parse(cleanJsonResponse(supResult.text));
          supervisorResult = {
            approved: parsed.approved !== false,
            notes: (parsed.issues || []).map((i: { type: string; description: string; fix: string }) =>
              `[${i.type}] ${i.description} → Fix: ${i.fix}`
            ),
          };
          // Auto-fix simple issues
          if (parsed.issues) {
            for (const issue of parsed.issues) {
              if (issue.type === "timing_gap" && issue.fix) {
                // Supervisor identified a timing gap — log but don't auto-fix
              }
            }
          }
        } catch {
          // Supervisor returned non-JSON
        }
      }
    }

    // ── Step 5: Set export settings ──
    assembly.exportSettings.includeSubtitles = body.includeSubtitles ?? false;
    assembly.exportSettings.includeCredits = assembly.soundLicenses.some(l => l.attribution);

    // Generate credits text if needed
    if (assembly.exportSettings.includeCredits) {
      assembly.exportSettings.creditsText = assembly.soundLicenses
        .filter(l => l.attribution)
        .map(l => l.attribution)
        .join("\n");
    }

    // ── Save Assembly Record to DB (if prisma available) ──
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.assemblyRecord.create({
        data: {
          projectId: body.projectId,
          projectType: body.projectType || "movie",
          assemblyJsonVersion: assembly.version,
          plannerModelTier: tier,
          supervisorModelTier: assembly.supervisorTier || null,
          previewStatus: "pending",
          renderStatus: "pending",
          assemblyJson: JSON.parse(JSON.stringify(assembly)),
        },
      });
    } catch {
      // DB save failed — assembly still usable
    }

    // Audit log
    audit.tierSelected(body.projectId, tier);

    return NextResponse.json({
      assembly,
      meta: {
        tier,
        credits: tierConfig.credits,
        plannerProvider,
        supervisorApproved: supervisorResult.approved,
        supervisorNotes: supervisorResult.notes,
        segmentCount: assembly.segments.length,
        narrationCount: assembly.narration.length,
        musicCount: assembly.music.length,
        sfxCount: assembly.sfx.length,
        totalDuration: assembly.totalDuration,
      },
    });
  } catch (err) {
    console.error("Assembly plan error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assembly planning failed" },
      { status: 500 }
    );
  }
}

// ── Helper: Build planner prompt ──
function buildPlannerPrompt(assembly: AssemblyJSON, scenes: SceneInput[]): string {
  const sceneList = scenes.map(s =>
    `Scene ${s.scene}: type=${s.type}, duration=${s.duration}s, narration=${s.narrationText ? "yes" : "no"}, music=${s.musicCue || "none"}, sfx=${s.soundEffects?.join(",") || "none"}, ambience=${s.ambience || "none"}`
  ).join("\n");

  return `Optimize this video assembly timeline:

Total duration: ${assembly.totalDuration}s
Segments: ${assembly.segments.length}
Narration tracks: ${assembly.narration.length}
Music tracks: ${assembly.music.length}
SFX events: ${assembly.sfx.length}
Ambience layers: ${assembly.ambience.length}

Scene breakdown:
${sceneList}

Current ducking rules:
- Music ducks to ${assembly.duckingRules.musicDuckLevel} under speech
- Ambience ducks to ${assembly.duckingRules.ambienceDuckLevel} under speech

Check for:
1. Volume balance across all layers
2. SFX that should be added but are missing
3. Timing adjustments needed (gaps, overlaps)
4. Ducking that needs fine-tuning`;
}

// ── Helper: Build supervisor prompt ──
function buildSupervisorPrompt(assembly: AssemblyJSON): string {
  return `Validate this video assembly plan:

Project: ${assembly.title}
Duration: ${assembly.totalDuration}s
Segments: ${assembly.segments.length}
Narration: ${assembly.narration.length} tracks
Music: ${assembly.music.length} tracks
SFX: ${assembly.sfx.length} events
Ambience: ${assembly.ambience.length} layers
Subtitles: ${assembly.subtitles.length}

Segment timeline:
${assembly.segments.map(s => `  ${s.id}: ${s.startTime}s-${s.endTime}s (${s.type})`).join("\n")}

Narration timeline:
${assembly.narration.map(n => `  ${n.id}: ${n.startTime}s-${n.endTime}s vol=${n.volume}`).join("\n")}

Music timeline:
${assembly.music.map(m => `  ${m.id}: ${m.startTime}s-${m.endTime}s vol=${m.volume} duck=${m.duckUnderSpeech}`).join("\n")}

SFX events:
${assembly.sfx.map(s => `  ${s.id}: ${s.startTime}s (${s.event}) vol=${s.volume}`).join("\n")}

Sound licenses: ${assembly.soundLicenses.length} tracked
Rights confirmed: ${assembly.rightsConfirmed}

Check for timing conflicts, volume issues, missing audio, and license problems.`;
}

// ── Helper: Apply planner suggestions ──
function applyPlannerSuggestions(assembly: AssemblyJSON, suggestions: {
  volumeAdjustments?: Array<{ segmentId: string; narrationVolume?: number; musicVolume?: number; sfxVolume?: number }>;
  timingFixes?: Array<{ segmentId: string; adjustedStart?: number; adjustedEnd?: number }>;
  missingSFX?: Array<{ scene: number; suggestedSFX: string }>;
  duckingNotes?: string[];
}) {
  // Apply volume adjustments
  if (suggestions.volumeAdjustments) {
    for (const adj of suggestions.volumeAdjustments) {
      if (adj.narrationVolume !== undefined) {
        const narr = assembly.narration.find(n => n.id === adj.segmentId);
        if (narr) narr.volume = Math.max(0, Math.min(1, adj.narrationVolume));
      }
      if (adj.musicVolume !== undefined) {
        const music = assembly.music.find(m => m.id === adj.segmentId);
        if (music) music.volume = Math.max(0, Math.min(1, adj.musicVolume));
      }
    }
  }

  // Flag missing SFX (don't auto-add, just note them)
  if (suggestions.missingSFX) {
    for (const missing of suggestions.missingSFX) {
      const sfxEntry = SFX_LIBRARY.find(s => s.event === missing.suggestedSFX);
      if (sfxEntry) {
        // Add to assembly if it exists in library
        const sceneSegment = assembly.segments.find(s => s.id === `seg_${missing.scene}`);
        if (sceneSegment) {
          assembly.sfx.push({
            id: `sfx_ai_${missing.scene}_${missing.suggestedSFX}`,
            event: missing.suggestedSFX,
            sourceUrl: `/storage/sfx/${sfxEntry.filename}`,
            startTime: sceneSegment.startTime + 0.5,
            duration: 2,
            volume: 0.5,
            loop: false,
            category: sfxEntry.category,
          });
        }
      }
    }
  }
}

// ── Helper: Clean JSON from AI response ──
function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned;
}
