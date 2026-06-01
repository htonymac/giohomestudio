// Karaoke beat-mixer — mixes user's recorded voice on top of a picked beat track.
// Uses ffmpeg's amix filter with vocal ducking so the voice sits clearly above the beat.
// Henry 2026-05-31 (T1-B): pick-a-beat-first Free Mode pipeline.

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";

const execFileAsync = promisify(execFile);

export interface MixResult {
  ok: boolean;
  mixedPath?: string;
  durationSec?: number;
  error?: string;
}

/**
 * Mix a user vocal WAV with a chosen beat MP3.
 * @param vocalDiskPath  absolute path to user's voice recording WAV
 * @param beatDiskPath   absolute path to the picked beat MP3
 * @param outDir         where to write the mixed MP3
 * @param vocalVolume    0..1 (default 1.0)
 * @param beatVolume     0..1 (default 0.5)
 * @returns { ok, mixedPath, durationSec } on success
 */
export async function mixVocalOverBeat(
  vocalDiskPath: string,
  beatDiskPath: string,
  outDir: string,
  vocalVolume = 1.0,
  beatVolume = 0.5,
): Promise<MixResult> {
  if (!fs.existsSync(vocalDiskPath)) return { ok: false, error: `Vocal file missing: ${vocalDiskPath}` };
  if (!fs.existsSync(beatDiskPath)) return { ok: false, error: `Beat file missing: ${beatDiskPath}` };
  fs.mkdirSync(outDir, { recursive: true });

  const outName = `mix_${Date.now()}.mp3`;
  const outPath = path.join(outDir, outName);
  const ffmpeg = env.ffmpegPath;

  // amix with weights: vocal sits on top with gentle compression.
  // Vocal first → it sets the duration; beat is trimmed to match.
  const filter = [
    `[0:a]volume=${vocalVolume.toFixed(2)},acompressor=threshold=-12dB:ratio=4:attack=5:release=50[v]`,
    `[1:a]volume=${beatVolume.toFixed(2)}[b]`,
    `[v][b]amix=inputs=2:duration=first:dropout_transition=2[mix]`,
  ].join(";");

  try {
    await execFileAsync(ffmpeg, [
      "-i", vocalDiskPath,
      "-i", beatDiskPath,
      "-filter_complex", filter,
      "-map", "[mix]",
      "-c:a", "libmp3lame", "-b:a", "192k",
      "-y", outPath,
    ], { timeout: 120000 });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "ffmpeg failed" };
  }

  // Best-effort duration probe (not blocking on failure).
  let durationSec: number | undefined;
  try {
    const ffprobe = env.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
    const { stdout } = await execFileAsync(ffprobe, [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", outPath,
    ], { timeout: 5000 });
    const d = parseFloat(String(stdout).trim());
    if (!isNaN(d)) durationSec = d;
  } catch { /* duration is optional */ }

  return { ok: true, mixedPath: outPath, durationSec };
}
