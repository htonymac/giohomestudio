// GioHomeStudio — Runway Direct Gateway
// Connects to your Runway.com account using RUNWAY_API_KEY.
// This spends your Runway credits directly — NOT FAL credits.
// Uses Runway's async task API: create → poll → download.

import axios from "axios";

const BASE_URL = "https://api.runwayml.com/v1";
const API_VERSION = "2024-11-06";

function getKey(): string {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) throw new Error("RUNWAY_API_KEY not set");
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getKey()}`,
    "Content-Type": "application/json",
    "X-Runway-Version": API_VERSION,
  };
}

export interface RunwayVideoRequest {
  model?: "gen4_turbo" | "gen4";
  promptText: string;
  promptImage: string;    // public URL (must be accessible from internet)
  duration?: 5 | 10;
  ratio?: "1280:720" | "720:1280" | "1104:832" | "832:1104" | "960:960" | "1584:672";
  seed?: number;
  watermark?: boolean;
}

export interface RunwayResponse {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  error?: string;
}

export type RunwayProgressCallback = (event: { percent: number; message: string }) => void;

export async function runwayGenerateVideo(
  req: RunwayVideoRequest,
  onProgress?: RunwayProgressCallback,
): Promise<RunwayResponse> {
  const timeout = parseInt(process.env.GENERATION_TIMEOUT_SECONDS ?? "600") * 1000;
  const deadline = Date.now() + timeout;

  try {
    onProgress?.({ percent: 8, message: "Submitting to Runway..." });

    // Step 1: Create task
    const createRes = await axios.post(
      `${BASE_URL}/image_to_video`,
      {
        model: req.model ?? "gen4_turbo",
        promptImage: req.promptImage,
        promptText: req.promptText,
        duration: req.duration ?? 5,
        ratio: req.ratio ?? "1280:720",
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        watermark: req.watermark ?? false,
      },
      { headers: authHeaders(), timeout: 30000 },
    );

    const taskId = createRes.data?.id;
    if (!taskId) {
      return { success: false, error: `Runway did not return a task ID: ${JSON.stringify(createRes.data).slice(0, 200)}` };
    }

    console.log(`[runway] Task created: ${taskId}`);
    onProgress?.({ percent: 15, message: "Task queued — waiting for Runway..." });

    // Step 2: Poll until done
    const pollUrl = `${BASE_URL}/tasks/${taskId}`;
    let pollCount = 0;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      pollCount++;

      try {
        const statusRes = await axios.get(pollUrl, { headers: authHeaders(), timeout: 15000 });
        const task = statusRes.data;
        const status: string = task.status ?? "PENDING";

        console.log(`[runway] ${taskId} status=${status} poll=${pollCount}`);

        if (status === "SUCCEEDED") {
          const output = task.output;
          const videoUrl = Array.isArray(output) ? output[0] : output?.url ?? output;
          if (!videoUrl) {
            return { success: false, taskId, error: "Runway task succeeded but no output URL found" };
          }
          onProgress?.({ percent: 95, message: "Runway generation complete — downloading..." });
          return { success: true, videoUrl: String(videoUrl), taskId };
        }

        if (status === "FAILED") {
          const reason = task.failure ?? task.failureCode ?? "unknown";
          return { success: false, taskId, error: `Runway task failed: ${reason}` };
        }

        // PENDING or RUNNING — estimate progress
        const pct = status === "RUNNING"
          ? Math.min(88, 20 + pollCount * 5)
          : Math.min(30, 15 + pollCount * 2);
        const msg = status === "RUNNING"
          ? `Runway generating... (${pollCount * 5}s)`
          : `Runway queue — waiting for worker...`;
        onProgress?.({ percent: pct, message: msg });

      } catch {
        // transient poll error — keep retrying
      }
    }

    return { success: false, taskId, error: "Runway generation timed out — task may still be running in your Runway account" };

  } catch (err) {
    const msg = axios.isAxiosError(err) && err.response
      ? `Runway ${err.response.status}: ${JSON.stringify(err.response.data?.message ?? err.response.data).slice(0, 200)}`
      : err instanceof Error ? err.message : String(err);
    console.error("[runway] generation failed:", msg);
    return { success: false, error: msg };
  }
}

export async function downloadRunwayVideo(url: string): Promise<Buffer> {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 120000 });
  return Buffer.from(res.data);
}

export async function isRunwayConfigured(): Promise<boolean> {
  return !!process.env.RUNWAY_API_KEY;
}
