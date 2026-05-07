// GHS Assembly Builder — Converts Assembly JSON → FFmpeg Commands
//
// Core architecture from Support Canvas:
// "AI plans → Assembly JSON → FFmpeg command builder executes deterministically"
//
// This builder reads the structured Assembly JSON and produces:
// 1. Video segment concat commands
// 2. Audio mixing commands (narration + music + SFX + ambience)
// 3. Subtitle overlay commands
// 4. Volume automation / ducking commands
// 5. Final merge command
//
// The builder is DETERMINISTIC — same JSON always produces same FFmpeg commands.
// Only the AI planning quality changes between tiers, not execution.

import type { AssemblyJSON } from "./assembly-schema";
import { env } from "@/config/env";
import * as path from "path";

export interface FFmpegStep {
  id: string;
  description: string;
  command: string[];  // FFmpeg args
  outputPath: string;
  dependsOn?: string[];
}

// Build the full FFmpeg execution plan from Assembly JSON
export function buildAssemblyPlan(assembly: AssemblyJSON, outputDir: string): FFmpegStep[] {
  const steps: FFmpegStep[] = [];
  const ffmpeg = env.ffmpegPath;

  // ── Step 1: Concat video/image segments ──
  if (assembly.segments.length > 0) {
    const concatListPath = path.join(outputDir, "concat_list.txt");
    const concatOutputPath = path.join(outputDir, "concat_raw.mp4");

    // Generate concat list content
    const concatContent = assembly.segments
      .sort((a, b) => a.startTime - b.startTime)
      .map(s => `file '${s.sourceUrl.replace(/\\/g, "/")}'`)
      .join("\n");

    steps.push({
      id: "concat_segments",
      description: `Concatenate ${assembly.segments.length} segments`,
      command: [ffmpeg, "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", "-movflags", "+faststart", "-y", concatOutputPath],
      outputPath: concatOutputPath,
    });
  }

  // ── Step 2: Mix narration audio — use WAV to avoid container/codec mismatch ──
  if (assembly.narration.length > 0) {
    const narrationMixPath = path.join(outputDir, "narration_mix.wav");
    const narrationInputs: string[] = [];
    const filterParts: string[] = [];

    assembly.narration.forEach((n, i) => {
      if (n.audioUrl) {
        narrationInputs.push("-i", n.audioUrl);
        const delayMs = Math.round((n.startTime || 0) * 1000);
        const delayFilter = delayMs > 0 ? `,adelay=${delayMs}:all=1` : "";
        filterParts.push(`[${i}:a]aresample=44100${delayFilter},volume=${n.volume}[n${i}]`);
      }
    });

    if (narrationInputs.length > 0) {
      // normalize=0: don't attenuate for number of inputs — each track plays at its assigned volume.
      // Without this, amix halves each track's volume per additional input (6 tracks = very quiet).
      const mixFilter = filterParts.join(";") + ";" +
        filterParts.map((_, i) => `[n${i}]`).join("") +
        `amix=inputs=${filterParts.length}:duration=longest:normalize=0[narr_out]`;

      steps.push({
        id: "mix_narration",
        description: `Mix ${assembly.narration.length} narration tracks`,
        command: [ffmpeg, ...narrationInputs, "-filter_complex", mixFilter, "-map", "[narr_out]", "-c:a", "pcm_s16le", "-ar", "44100", "-y", narrationMixPath],
        outputPath: narrationMixPath,
      });
    }
  }

  // ── Step 3: Mix music — use WAV to avoid container/codec mismatch ──
  if (assembly.music.length > 0) {
    const musicMixPath = path.join(outputDir, "music_mix.wav");
    const musicEntry = assembly.music[0];

    if (musicEntry.sourceUrl) {
      const vol = musicEntry.volume;
      steps.push({
        id: "prepare_music",
        description: `Prepare music track at volume ${vol}`,
        command: [ffmpeg, "-i", musicEntry.sourceUrl, "-map", "0:a", "-af", `aresample=44100,volume=${vol}`, "-c:a", "pcm_s16le", "-ar", "44100", "-y", musicMixPath],
        outputPath: musicMixPath,
      });
    }
  }

  // ── Step 4: Final merge — video + narration + music ──
  const finalOutputPath = path.join(outputDir, `final_${assembly.projectId}_v${assembly.version}.mp4`);
  const finalInputs: string[] = [];
  const finalMaps: string[] = [];

  // Video from concat
  const concatOutput = path.join(outputDir, "concat_raw.mp4");
  finalInputs.push("-i", concatOutput);
  finalMaps.push("-map", "0:v");

  // Audio mixing — use step existence, not array length, to guard file references
  const narrationStepBuilt = steps.some(s => s.id === "mix_narration");
  const musicStepBuilt = steps.some(s => s.id === "prepare_music");

  const audioFilters: string[] = [];
  let audioIdx = 1;

  // Narration — only if mix_narration step was actually built (has real audioUrls)
  const narrationMix = path.join(outputDir, "narration_mix.wav");
  if (narrationStepBuilt) {
    finalInputs.push("-i", narrationMix);
    audioFilters.push(`[${audioIdx}:a]volume=1.0[narr]`);
    audioIdx++;
  }

  // Music — only if prepare_music step was actually built
  const musicMix = path.join(outputDir, "music_mix.wav");
  if (musicStepBuilt) {
    finalInputs.push("-i", musicMix);
    const duckLevel = assembly.duckingRules.musicDuckLevel;
    audioFilters.push(`[${audioIdx}:a]volume=${duckLevel}[mus]`);
    audioIdx++;
  }

  // Build final audio mix
  if (audioFilters.length > 0) {
    const audioSources = [];
    if (narrationStepBuilt) audioSources.push("[narr]");
    if (musicStepBuilt) audioSources.push("[mus]");

    const mixFilter = audioFilters.join(";") + ";" +
      audioSources.join("") + `amix=inputs=${audioSources.length}:duration=first[final_audio]`;

    steps.push({
      id: "final_merge",
      description: "Final merge — video + audio layers",
      command: [
        ffmpeg,
        ...finalInputs,
        "-filter_complex", mixFilter,
        "-map", "0:v",
        "-map", "[final_audio]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        "-y", finalOutputPath,
      ],
      outputPath: finalOutputPath,
      dependsOn: ["concat_segments", "mix_narration", "prepare_music"].filter(id =>
        steps.some(s => s.id === id)
      ),
    });
  } else {
    // No audio — just copy video
    steps.push({
      id: "final_merge",
      description: "Final output — video only (no audio layers)",
      command: [ffmpeg, "-i", concatOutput, "-c", "copy", "-movflags", "+faststart", "-y", finalOutputPath],
      outputPath: finalOutputPath,
      dependsOn: ["concat_segments"],
    });
  }

  return steps;
}

// Get the total estimated credit cost for an assembly
export function estimateAssemblyCost(assembly: AssemblyJSON): {
  planningCredits: number;
  renderCredits: number;
  musicCredits: number;
  totalCredits: number;
} {
  const tierCredits: Record<string, number> = { standard: 0, pro: 1, premium: 3, premium_best: 5 };
  const planningCredits = tierCredits[assembly.plannerTier] ?? 0;
  const renderCredits = assembly.segments.filter(s => s.type === "video").length * 2;
  const musicCredits = assembly.music.length;

  return {
    planningCredits,
    renderCredits,
    musicCredits,
    totalCredits: planningCredits + renderCredits + musicCredits,
  };
}
