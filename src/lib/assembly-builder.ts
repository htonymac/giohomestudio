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

// ── Shared narrator/actor coordination (audio duck + subtitle clip) ─────────────
// Both the audio mix path (this file) and the subtitle emission path
// (app/api/assembly/execute/route.ts) need to know which entry is the narrator
// and which time windows the actors occupy. Single source of truth lives here.
export interface NarratorWindows {
  narratorIdx: number;                      // -1 if not identifiable
  actorWindows: Array<[number, number]>;    // global [start, end] in seconds, padded
}

export function computeNarratorWindows<
  T extends { startTime?: number; endTime?: number; isNarrator?: boolean }
>(entries: T[], opts?: { padding?: number; fallbackDuration?: number }): NarratorWindows {
  const pad = opts?.padding ?? 0.25;
  const fbDur = opts?.fallbackDuration ?? 8;

  // Preferred: explicit isNarrator flag set by the planner
  let narratorIdx = entries.findIndex(n => n.isNarrator === true);
  // Fallback A: longest entry that starts at ~0 (single full-length narrator track)
  if (narratorIdx < 0) {
    let bestDur = 0;
    entries.forEach((n, i) => {
      const dur = (n.endTime || 0) - (n.startTime || 0);
      if ((n.startTime || 0) <= 0.5 && dur > bestDur) { bestDur = dur; narratorIdx = i; }
    });
  }
  // Fallback B: longest entry overall — covers split-per-scene narrator where no chunk
  // starts at <=0.5s. Without this, narratorIdx stays -1 → no duck filter emitted.
  if (narratorIdx < 0) {
    let bestDur = 0;
    entries.forEach((n, i) => {
      const dur = (n.endTime || 0) - (n.startTime || 0);
      if (dur > bestDur) { bestDur = dur; narratorIdx = i; }
    });
  }

  const actorWindows: Array<[number, number]> = [];
  entries.forEach((n, i) => {
    if (i === narratorIdx || narratorIdx < 0) return;
    const start = Math.max(0, (n.startTime || 0) - pad);
    const dur = (n.endTime || 0) > (n.startTime || 0) ? (n.endTime || 0) - (n.startTime || 0) : fbDur;
    actorWindows.push([start, (n.startTime || 0) + dur + pad]);
  });

  return { narratorIdx, actorWindows };
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

    // Strict manifest: deduplicate by URL, sort by startTime, skip entries with no audio
    const seenUrls = new Set<string>();
    const entries = assembly.narration
      .filter(n => n.audioUrl && !seenUrls.has(n.audioUrl) && seenUrls.add(n.audioUrl))
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    // ── NARRATOR DUCKING under actor dialogue (Henry 2026-05-28, hardened 2026-05-29) ──
    // The narrator is one full-length track at t=0; actor/character voice clips are short
    // and placed at scene times. While an actor speaks, the narrator ducks to near-silence
    // (effectively "stops"), then returns. Timing is UNCHANGED — we only modulate the
    // narrator's volume over its existing timeline. Helper is exported so the subtitle path
    // can clip narrator captions against the same actor windows.
    const { narratorIdx, actorWindows } = computeNarratorWindows(entries);
    console.log(`[duck] narratorIdx=${narratorIdx} actorWindows=${actorWindows.length} entries=${entries.length}`,
      entries.slice(0, 8).map(n => ({ s: (n.startTime || 0).toFixed(2), e: (n.endTime || 0).toFixed(2), isN: (n as { isNarrator?: boolean }).isNarrator === true })));
    const NARRATOR_DUCK_VOL = 0.06; // near-silent while an actor speaks (effectively "stops")

    entries.forEach((n, i) => {
      narrationInputs.push("-i", n.audioUrl!);
      const delayMs = Math.round((n.startTime || 0) * 1000);
      const clipDuration = n.endTime > (n.startTime || 0) ? n.endTime - (n.startTime || 0) : 0;
      const trimFilter = clipDuration > 0 ? `,atrim=duration=${clipDuration.toFixed(3)}` : "";
      const delayFilter = delayMs > 0 ? `,adelay=${delayMs}:all=1` : "";
      // Narrator-only: duck to near-silence during every actor window (narrator has no
      // adelay so its local time == global timeline, so `between(t,...)` aligns with actors).
      let duckFilter = "";
      if (i === narratorIdx && actorWindows.length > 0) {
        const expr = actorWindows.map(([s, e]) => `between(t,${s.toFixed(2)},${e.toFixed(2)})`).join("+");
        duckFilter = `,volume=${NARRATOR_DUCK_VOL}:enable='${expr}'`;
      }
      filterParts.push(`[${i}:a]aresample=44100${trimFilter}${delayFilter},volume=${n.volume}${duckFilter}[n${i}]`);
    });

    if (narrationInputs.length > 0) {
      // normalize=0: don't attenuate for number of inputs — each track plays at its assigned volume.
      const mixFilter = filterParts.join(";") + ";" +
        filterParts.map((_, i) => `[n${i}]`).join("") +
        `amix=inputs=${filterParts.length}:duration=longest:normalize=0[narr_out]`;

      steps.push({
        id: "mix_narration",
        description: `Mix ${entries.length} narration tracks`,
        command: [ffmpeg, ...narrationInputs, "-filter_complex", mixFilter, "-map", "[narr_out]", "-c:a", "pcm_s16le", "-ar", "44100", "-y", narrationMixPath],
        outputPath: narrationMixPath,
      });
    }
  }

  // ── Step 3: Mix music — loop to fill totalDuration so it never stops short ──
  if (assembly.music.length > 0) {
    const musicMixPath = path.join(outputDir, "music_mix.wav");
    const musicEntry = assembly.music[0];

    if (musicEntry.sourceUrl) {
      const vol = musicEntry.volume;
      const targetDur = assembly.totalDuration > 0 ? assembly.totalDuration : 300;
      steps.push({
        id: "prepare_music",
        description: `Prepare music (loop to ${targetDur}s, volume ${vol})`,
        command: [ffmpeg, "-stream_loop", "-1", "-i", musicEntry.sourceUrl, "-map", "0:a", "-af", `aresample=44100,volume=1.0,atrim=duration=${targetDur}`, "-c:a", "pcm_s16le", "-ar", "44100", "-y", musicMixPath],
        outputPath: musicMixPath,
      });
    }
  }

  // ── Step 4: Mix SFX ──
  if (assembly.sfx.length > 0) {
    const sfxMixPath = path.join(outputDir, "sfx_mix.wav");
    const sfxInputs: string[] = [];
    const sfxFilters: string[] = [];

    const sfxEntries = assembly.sfx.filter(s => s.sourceUrl);
    sfxEntries.forEach((s, i) => {
      sfxInputs.push("-i", s.sourceUrl);
      const delayMs = Math.round((s.startTime || 0) * 1000);
      const clipDur = s.duration > 0 ? s.duration : 3;
      const loopFilter = s.loop ? `,aloop=loop=-1:size=0,atrim=duration=${clipDur}` : `,atrim=duration=${clipDur}`;
      const delayFilter = delayMs > 0 ? `,adelay=${delayMs}:all=1` : "";
      sfxFilters.push(`[${i}:a]aresample=44100${loopFilter}${delayFilter},volume=${s.volume}[sfx${i}]`);
    });

    if (sfxInputs.length > 0) {
      const sfxMixFilter = sfxFilters.join(";") + ";" +
        sfxFilters.map((_, i) => `[sfx${i}]`).join("") +
        `amix=inputs=${sfxFilters.length}:duration=longest:normalize=0[sfx_out]`;
      steps.push({
        id: "mix_sfx",
        description: `Mix ${sfxEntries.length} SFX tracks`,
        command: [ffmpeg, ...sfxInputs, "-filter_complex", sfxMixFilter, "-map", "[sfx_out]", "-c:a", "pcm_s16le", "-ar", "44100", "-y", sfxMixPath],
        outputPath: sfxMixPath,
      });
    }
  }

  // ── Step 5: Final merge — video (looped) + narration + music + SFX ──
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
  const sfxStepBuilt = steps.some(s => s.id === "mix_sfx");
  const totalDur = assembly.totalDuration > 0 ? assembly.totalDuration : 60;

  const audioFilters: string[] = [];
  let audioIdx = 1;

  const narrationMix = path.join(outputDir, "narration_mix.wav");
  if (narrationStepBuilt) {
    finalInputs.push("-i", narrationMix);
    audioFilters.push(`[${audioIdx}:a]volume=1.0[narr]`);
    audioIdx++;
  }

  const musicMix = path.join(outputDir, "music_mix.wav");
  if (musicStepBuilt) {
    finalInputs.push("-i", musicMix);
    // Use user's chosen volume from assembly JSON (set via music volume slider in page.tsx).
    // duckingRules.musicDuckLevel (0.08) was being used here — that's speech-ducking level,
    // not background music level. Bug: music was stuck at 8% regardless of user slider.
    const musicVol = assembly.music[0]?.volume ?? 0.3;
    audioFilters.push(`[${audioIdx}:a]volume=${musicVol}[mus]`);
    audioIdx++;
  }

  const sfxMix = path.join(outputDir, "sfx_mix.wav");
  if (sfxStepBuilt) {
    finalInputs.push("-i", sfxMix);
    audioFilters.push(`[${audioIdx}:a]volume=0.6[sfx]`);
    audioIdx++;
  }

  // Build final audio mix
  if (audioFilters.length > 0) {
    const audioSources = [];
    if (narrationStepBuilt) audioSources.push("[narr]");
    if (musicStepBuilt) audioSources.push("[mus]");
    if (sfxStepBuilt) audioSources.push("[sfx]");

    const mixFilter = audioFilters.join(";") + ";" +
      audioSources.join("") + `amix=inputs=${audioSources.length}:duration=longest:normalize=0[final_audio]`;

    steps.push({
      id: "final_merge",
      description: "Final merge — video (looped) + audio layers",
      command: [
        ffmpeg,
        "-stream_loop", "-1", "-i", concatOutput,
        ...finalInputs.slice(2), // skip the original "-i concatOutput" since we rebuilt it with stream_loop
        "-t", String(totalDur),
        "-filter_complex", mixFilter,
        "-map", "0:v",
        "-map", "[final_audio]",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "-y", finalOutputPath,
      ],
      outputPath: finalOutputPath,
      dependsOn: ["concat_segments", "mix_narration", "prepare_music", "mix_sfx"].filter(id =>
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
