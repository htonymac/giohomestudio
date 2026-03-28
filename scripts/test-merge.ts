// Phase 1 — merge behavior verification
// Tests: video only | video+voice | video+voice+music
// Run: npx tsx --env-file=.env scripts/test-merge.ts

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { mergeMedia } from "../src/modules/ffmpeg";

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";
const STORAGE = process.env.STORAGE_BASE_PATH ?? "./storage";

async function makeTestVideo(name: string): Promise<string> {
  const p = path.join(STORAGE, "video", "mock", `${name}.mp4`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  await execFileAsync(FFMPEG, ["-f","lavfi","-i","color=c=black:s=1080x1920:d=5",
    "-c:v","libx264","-t","5","-pix_fmt","yuv420p","-y",p]);
  return p;
}

async function makeTestAudio(name: string): Promise<string> {
  const p = path.join(STORAGE, "voice", `${name}.mp3`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  await execFileAsync(FFMPEG, ["-f","lavfi","-i","anullsrc=r=44100:cl=stereo",
    "-c:a","libmp3lame","-t","5","-q:a","9","-y",p]);
  return p;
}

async function probe(filePath: string): Promise<string> {
  const ffprobe = process.env.FFPROBE_PATH ?? "C:\\ffmpeg\\bin\\ffprobe.exe";
  try {
    const { stderr } = await execFileAsync(ffprobe, [
      "-v","quiet","-show_streams","-print_format","json", filePath
    ]);
    const data = JSON.parse(stderr || "{}");
    // execFile stdout/stderr may be swapped; try stdout
    return JSON.stringify(data);
  } catch (e: unknown) {
    // ffprobe writes to stderr, stdout is json
    const err = e as { stdout?: string };
    if (err.stdout) {
      const data = JSON.parse(err.stdout);
      const streams = (data.streams ?? []).map((s: { codec_type: string; codec_name: string }) =>
        `${s.codec_type}(${s.codec_name})`
      );
      return streams.join(", ") || "no streams";
    }
    return "probe failed";
  }
}

async function probeFile(filePath: string): Promise<string> {
  const ffprobe = process.env.FFPROBE_PATH ?? "C:\\ffmpeg\\bin\\ffprobe.exe";
  return new Promise((resolve) => {
    execFile(ffprobe, ["-v","quiet","-show_streams","-print_format","json", filePath],
      (_err, stdout) => {
        try {
          const data = JSON.parse(stdout || "{}");
          const streams = (data.streams ?? []).map((s: { codec_type: string; codec_name: string }) =>
            `${s.codec_type}(${s.codec_name})`
          );
          resolve(streams.join(", ") || "no streams");
        } catch {
          resolve("probe parse failed");
        }
      });
  });
}

async function runCase(
  label: string,
  videoPath: string,
  voicePath: string | null,
  musicPath: string | null
) {
  console.log(`\n── ${label} ──────────────────`);
  const result = await mergeMedia({
    videoPath,
    voicePath,
    musicPath,
    outputFileName: `test_merge_${Date.now()}.mp4`,
  });

  if (!result.success) {
    console.log(`  FAILED: ${result.error}`);
    return;
  }

  const streams = await probeFile(result.outputPath!);
  const size = fs.statSync(result.outputPath!).size;
  console.log(`  OUTPUT: ${result.outputPath}`);
  console.log(`  SIZE:   ${(size / 1024).toFixed(1)} KB`);
  console.log(`  STREAMS: ${streams}`);
  console.log(`  RESULT: ✓ OK`);
}

async function main() {
  console.log("=== Merge Behavior Test ===\n");

  const videoPath = await makeTestVideo("merge_test_video");
  const voicePath = await makeTestAudio("merge_test_voice");
  const musicPath = path.join(STORAGE, "music", "stock", "epic_cinematic.mp3");

  // Confirm inputs exist
  console.log("Inputs:");
  console.log(`  video : ${fs.existsSync(videoPath) ? "✓" : "✗"} ${videoPath}`);
  console.log(`  voice : ${fs.existsSync(voicePath) ? "✓" : "✗"} ${voicePath}`);
  console.log(`  music : ${fs.existsSync(musicPath) ? "✓" : "✗"} ${musicPath}`);

  await runCase("Case 1: video only", videoPath, null, null);
  await runCase("Case 2: video + voice", videoPath, voicePath, null);
  await runCase("Case 3: video + voice + music", videoPath, voicePath, musicPath);

  console.log("\n=== Done ===");
}

main().catch((err) => { console.error(err); process.exit(1); });
