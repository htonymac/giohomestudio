// C4 — Children Assembly Route
// Depends on C1: import types once src/types/children.ts is committed by sister agent
import type {
  ChildrenPacingEntry,
  ChildrenPacingPlan,
  ChildrenNarrationTimingEntry,
} from "@/types/children";

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";

interface AssembleRequestBody {
  projectId: string;
  plan: ChildrenPacingPlan;
  timingMap: ChildrenNarrationTimingEntry[];
  audioUrl: string;
  scenes: Array<{
    sceneId: string;
    imageUrl: string;
    imageConceptKey: string;
  }>;
  outputFormat?: "mp4" | "webm";
}

function execPromise(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        reject(Object.assign(err, { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function resolveSceneForEntry(
  imageConceptKey: string,
  entryIndex: number,
  scenes: AssembleRequestBody["scenes"]
): string | null {
  const exact = scenes.find((s) => s.imageConceptKey === imageConceptKey);
  if (exact) return exact.imageUrl;
  // Nearest by index when no key match — scene list may be shorter than entry list
  const fallback = scenes[entryIndex % scenes.length];
  return fallback?.imageUrl ?? null;
}

export async function POST(req: NextRequest) {
  const body: AssembleRequestBody = await req.json();
  const { plan, audioUrl, scenes, outputFormat = "mp4" } = body;

  if (!scenes || scenes.length === 0) {
    return NextResponse.json({ error: "No scenes with images" }, { status: 422 });
  }

  const projectRoot = process.cwd();
  const storageDir = path.join(projectRoot, "storage", "children");
  await fs.mkdir(storageDir, { recursive: true });

  const outputFilename = `assembled_${Date.now()}.${outputFormat}`;
  const outputPath = path.join(storageDir, outputFilename);

  // Build per-entry input arguments and collect resolved image paths
  const inputArgs: string[] = [];
  const entryDurations: number[] = [];

  for (let i = 0; i < plan.entries.length; i++) {
    const entry = plan.entries[i];
    const imageUrl = resolveSceneForEntry(entry.imageConceptKey, i, scenes);

    // imageUrl may be a relative path from project root or an absolute path
    const imagePath = imageUrl
      ? path.isAbsolute(imageUrl)
        ? imageUrl
        : path.join(projectRoot, imageUrl.replace(/^\//, ""))
      : null;

    const durationSec = entry.durationMs / 1000;
    entryDurations.push(durationSec);

    if (imagePath) {
      // Escape path for shell; wrap in quotes handled at join time
      inputArgs.push(`-loop 1 -t ${durationSec} -i "${imagePath}"`);
    } else {
      // No image available: use a 1x1 black pixel source so FFmpeg concat doesn't break
      inputArgs.push(`-loop 1 -t ${durationSec} -f lavfi -i color=black:s=1280x720`);
    }
  }

  const audioInputIndex = plan.entries.length;
  const audioPath = path.isAbsolute(audioUrl)
    ? audioUrl
    : path.join(projectRoot, audioUrl.replace(/^\//, ""));

  const concatInputRefs = plan.entries.map((_entry: ChildrenPacingEntry, i: number) => `[${i}:v]`).join("");
  const filterComplex = `${concatInputRefs}concat=n=${plan.entries.length}:v=1:a=0[v]`;

  const codec = outputFormat === "webm" ? "-c:v libvpx-vp9 -c:a libopus" : "-c:v libx264 -c:a aac";

  const ffmpegCmd = [
    "ffmpeg -y",
    inputArgs.join(" "),
    `-i "${audioPath}"`,
    `-filter_complex "${filterComplex}"`,
    `-map "[v]" -map ${audioInputIndex}:a`,
    codec,
    "-shortest",
    `"${outputPath}"`,
  ].join(" ");

  await execPromise(ffmpegCmd);

  const videoUrl = `/api/media/children/${outputFilename}`;
  return NextResponse.json({
    ok: true,
    videoUrl,
    durationMs: plan.totalDurationMs,
  });
}
