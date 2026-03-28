// GioHomeStudio — Mock Music Provider
// Generates a real low-volume sine tone using FFmpeg.
// Used when no stock library files are present and no real API is configured.

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";

// Different frequencies per mood so they sound distinct
const MOOD_FREQ: Record<string, string> = {
  epic:      "220",
  calm:      "174",
  emotional: "196",
  upbeat:    "262",
  dramatic:  "147",
  default:   "196",
};

class MockMusicProvider implements IMusicProvider {
  readonly name = "mock_music";
  readonly isAsync = false;

  async generate(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    const mood = input.mood?.toLowerCase() ?? "default";
    const freq = MOOD_FREQ[mood] ?? MOOD_FREQ.default;
    const duration = String(input.durationSeconds ?? 30);

    const outputDir = path.join(env.storagePath, "music", "mock");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `mock_music_${mood}_${Date.now()}.mp3`;
    const outputPath = path.join(outputDir, fileName);

    console.log(`[MockMusic] Generating ${duration}s sine tone (${freq}Hz, mood: ${mood}) → ${outputPath}`);

    try {
      await execFileAsync(FFMPEG_PATH, [
        "-f", "lavfi",
        "-i", `sine=frequency=${freq}:duration=${duration}`,
        "-c:a", "libmp3lame",
        "-q:a", "9",
        "-af", "volume=0.15",
        "-y",
        outputPath,
      ]);
      console.log(`[MockMusic] Done → ${outputPath}`);
      return {
        status: "completed",
        localPath: outputPath,
        providerName: this.name,
        track: { title: `mock ${mood} tone`, license: "generated" },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MockMusic] FFmpeg failed: ${message}`);
      return { status: "failed", error: `Mock music generation failed: ${message}`, providerName: this.name };
    }
  }
}

export const mockMusicProvider: IMusicProvider = new MockMusicProvider();
