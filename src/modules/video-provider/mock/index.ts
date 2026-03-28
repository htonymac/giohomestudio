// GioHomeStudio — Mock Video Provider
// Used when Kling is unavailable (credentials absent or API returns 429/5xx).
// Generates a real minimal test video (black screen) using FFmpeg directly.
// Phase 1 only — remove once Kling is confirmed stable.
//
// NOTE: Uses execFile directly instead of fluent-ffmpeg because fluent-ffmpeg's
// capability checker misparses lavfi in newer FFmpeg builds (the 'd' device-type
// character in " D d lavfi" breaks its regex, making it think lavfi is unavailable).

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import type { IVideoProvider, VideoGenerationInput, VideoGenerationOutput } from "@/types/providers";

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";

class MockVideoProvider implements IVideoProvider {
  readonly name = "mock_video";

  private mockFilePath(jobId: string): string {
    return path.join(env.storagePath, "video", "mock", `${jobId}.mp4`);
  }

  async generate(input: VideoGenerationInput): Promise<VideoGenerationOutput> {
    const jobId = `mock_video_${Date.now()}`;
    const outputPath = this.mockFilePath(jobId);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const duration = String(input.durationSeconds ?? 5);
    console.log(`[MockVideo] Generating ${duration}s test video → ${outputPath}`);

    try {
      // Visible dark-blue frame so the user can confirm video is present
      await execFileAsync(FFMPEG_PATH, [
        "-f", "lavfi",
        "-i", `color=c=0x0d1b4b:s=1080x1920:d=${duration}`,
        "-c:v", "libx264",
        "-t", duration,
        "-pix_fmt", "yuv420p",
        "-y",
        outputPath,
      ]);
      console.log(`[MockVideo] Done — jobId: ${jobId}`);
      return { jobId, status: "completed", videoUrl: `file://${outputPath}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MockVideo] FFmpeg failed: ${message}`);
      return { jobId: "", status: "failed", error: `Mock video generation failed: ${message}` };
    }
  }

  async checkStatus(jobId: string): Promise<VideoGenerationOutput> {
    const filePath = this.mockFilePath(jobId);
    if (fs.existsSync(filePath)) {
      return { jobId, status: "completed", videoUrl: `file://${filePath}` };
    }
    return { jobId, status: "failed", error: "Mock video file not found" };
  }

  async download(jobId: string, outputPath: string): Promise<string> {
    const sourcePath = this.mockFilePath(jobId);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`[MockVideo] Source file not found: ${sourcePath}`);
    }
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(sourcePath, outputPath);
    console.log(`[MockVideo] Copied to: ${outputPath}`);
    return outputPath;
  }
}

export const mockVideoProvider: IVideoProvider = new MockVideoProvider();
