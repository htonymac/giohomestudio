// GioHomeStudio — Runway Video Provider Adapter
// API: https://api.dev.runwayml.com
// Auth: Bearer token via RUNWAY_API_KEY
// Model: gen4.5 (portrait 720:1280) — async, poll until SUCCEEDED
//
// Duration mapping (Runway only accepts specific values):
//   requested ≤ 6s  → 5s  (gen4.5 accepts 5 and 10)
//   requested > 6s  → 10s
//
// Aspect ratio: always 720:1280 (portrait 9:16) for social content.

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import type { IVideoProvider, VideoGenerationInput, VideoGenerationOutput } from "@/types/providers";

const BASE_URL = env.runway.baseUrl;
const API_VERSION = "2024-11-06";
const MODEL = "gen4.5";

function runwayHeaders() {
  return {
    Authorization: `Bearer ${env.runway.apiKey}`,
    "X-Runway-Version": API_VERSION,
    "Content-Type": "application/json",
  };
}

// Runway gen4.5 only accepts 5 or 10 seconds
function snapDuration(requested: number): 5 | 10 {
  return requested <= 6 ? 5 : 10;
}

// Runway gen4.5 portrait ratios: "720:1280"
// Landscape available too: "1280:720"
function toRunwayRatio(aspectRatio?: string): "720:1280" | "1280:720" {
  if (aspectRatio === "16:9") return "1280:720";
  return "720:1280"; // default portrait (9:16 and 1:1 both map to portrait)
}

class RunwayVideoProvider implements IVideoProvider {
  readonly name = "runway";

  async generate(input: VideoGenerationInput): Promise<VideoGenerationOutput> {
    if (!env.runway.apiKey) {
      return { jobId: "", status: "failed", error: "RUNWAY_API_KEY is not set." };
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/v1/text_to_video`,
        {
          model: MODEL,
          promptText: input.prompt,
          ratio: toRunwayRatio(input.aspectRatio),
          duration: snapDuration(input.durationSeconds ?? 5),
        },
        { headers: runwayHeaders() }
      );

      const taskId: string = response.data?.id ?? "";
      if (!taskId) {
        return { jobId: "", status: "failed", error: "Runway returned no task ID." };
      }

      return { jobId: taskId, status: "queued" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = (err as { response?: { data?: unknown } }).response?.data;
      return {
        jobId: "",
        status: "failed",
        error: `Runway generate failed: ${message}${detail ? ` — ${JSON.stringify(detail)}` : ""}`,
      };
    }
  }

  async checkStatus(jobId: string): Promise<VideoGenerationOutput> {
    if (!jobId) return { jobId: "", status: "failed", error: "No job ID" };

    try {
      const response = await axios.get(
        `${BASE_URL}/v1/tasks/${jobId}`,
        { headers: runwayHeaders() }
      );

      const task = response.data;
      const statusMap: Record<string, VideoGenerationOutput["status"]> = {
        PENDING:    "queued",
        THROTTLED:  "queued",
        RUNNING:    "processing",
        SUCCEEDED:  "completed",
        FAILED:     "failed",
        CANCELLED:  "failed",
      };

      const status = statusMap[task?.status] ?? "processing";
      const videoUrl = task?.output?.[0];

      return { jobId, status, videoUrl, error: task?.failure ?? undefined };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { jobId, status: "failed", error: message };
    }
  }

  async download(jobId: string, outputPath: string): Promise<string> {
    const statusResult = await this.checkStatus(jobId);
    if (statusResult.status !== "completed" || !statusResult.videoUrl) {
      throw new Error(`Cannot download — Runway job ${jobId} not completed`);
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const writer = fs.createWriteStream(outputPath);
    const response = await axios.get(statusResult.videoUrl, { responseType: "stream" });

    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    return outputPath;
  }
}

export const runwayVideoProvider: IVideoProvider = new RunwayVideoProvider();
