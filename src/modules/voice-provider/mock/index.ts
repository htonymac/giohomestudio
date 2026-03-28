// GioHomeStudio — Mock Voice Provider
// Used when ElevenLabs is unavailable (API key absent or returns error).
// Generates real silent audio using FFmpeg directly.
// Phase 1 only — remove once ElevenLabs is confirmed stable.

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import type { IVoiceProvider, VoiceGenerationInput, VoiceGenerationOutput } from "@/types/providers";

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";

class MockVoiceProvider implements IVoiceProvider {
  readonly name = "mock_voice";

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput> {
    const outputPath =
      input.outputPath ??
      path.join(process.cwd(), "storage", "voice", `mock_voice_${Date.now()}.mp3`);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`[MockVoice] Generating silent audio → ${outputPath}`);

    try {
      await execFileAsync(FFMPEG_PATH, [
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo",
        "-c:a", "libmp3lame",
        "-t", "5",
        "-q:a", "9",
        "-y",
        outputPath,
      ]);
      console.log(`[MockVoice] Done → ${outputPath}`);
      return { status: "completed", localPath: outputPath };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MockVoice] FFmpeg failed: ${message}`);
      return { status: "failed", error: `Mock voice generation failed: ${message}` };
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string }>> {
    return [{ id: "mock_voice_01", name: "Mock Voice (Development Only)" }];
  }
}

export const mockVoiceProvider: IVoiceProvider = new MockVoiceProvider();
