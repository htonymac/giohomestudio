// GioHomeStudio — FFmpeg Merge Module
// Merges video + voice + music into a single output file.

import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";

ffmpeg.setFfmpegPath(env.ffmpegPath);
ffmpeg.setFfprobePath(env.ffprobePath);

export interface MergeInput {
  videoPath: string;
  voicePath?: string | null;
  musicPath?: string | null;
  outputFileName: string;
  musicVolume?: number; // 0.0 - 1.0, default 0.85
  voiceVolume?: number; // 0.0 - 1.0, default 1.0
}

export interface MergeOutput {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export async function mergeMedia(input: MergeInput): Promise<MergeOutput> {
  const { videoPath, voicePath, musicPath, outputFileName, musicVolume = 0.85, voiceVolume = 1.0 } = input;

  if (!fs.existsSync(videoPath)) {
    return { success: false, error: `Video file not found: ${videoPath}` };
  }

  const outputDir = path.join(env.storagePath, "merged");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, outputFileName);

  return new Promise((resolve) => {
    const cmd = ffmpeg(videoPath);

    const hasVoice = voicePath && fs.existsSync(voicePath);
    const hasMusic = musicPath && fs.existsSync(musicPath);

    if (hasVoice) cmd.input(voicePath!);
    if (hasMusic) cmd.input(musicPath!);

    // Build filter complex for audio mixing
    if (hasVoice && hasMusic) {
      // normalize=0 prevents amix from halving the volume of each track
      cmd
        .complexFilter([
          `[1:a]volume=${voiceVolume}[voice]`,
          `[2:a]volume=${musicVolume}[music]`,
          `[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
        ])
        .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-shortest"]);
    } else if (hasVoice) {
      cmd.outputOptions(["-map 0:v", "-map 1:a", "-c:v copy", "-c:a aac", "-shortest"]);
    } else if (hasMusic) {
      cmd
        .complexFilter([`[1:a]volume=${musicVolume}[aout]`])
        .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-shortest"]);
    } else {
      // No audio — copy video as-is
      cmd.outputOptions(["-c copy"]);
    }

    cmd
      .output(outputPath)
      .on("end", () => resolve({ success: true, outputPath }))
      .on("error", (err: Error) => resolve({ success: false, error: err.message }))
      .run();
  });
}
