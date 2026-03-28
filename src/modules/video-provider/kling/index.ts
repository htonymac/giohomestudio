// GioHomeStudio — Kling AI Video Provider Adapter
// Docs: https://docs.klingai.com
// Uses JWT-signed requests per Kling API spec.

import axios from "axios";
import * as jwt from "jsonwebtoken";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import type { IVideoProvider, VideoGenerationInput, VideoGenerationOutput } from "@/types/providers";

function buildKlingJWT(): string {
  // Kling requires a signed JWT using access key + secret key
  const payload = {
    iss: env.kling.accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800, // 30 min expiry
    nbf: Math.floor(Date.now() / 1000) - 5,
  };
  return jwt.sign(payload, env.kling.secretKey, { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } });
}

function klingHeaders() {
  return {
    Authorization: `Bearer ${buildKlingJWT()}`,
    "Content-Type": "application/json",
  };
}

class KlingVideoProvider implements IVideoProvider {
  readonly name = "kling";

  async generate(input: VideoGenerationInput): Promise<VideoGenerationOutput> {
    if (!env.kling.accessKey || !env.kling.secretKey) {
      return { jobId: "", status: "failed", error: "Kling credentials not configured." };
    }

    try {
      const response = await axios.post(
        `${env.kling.baseUrl}/v1/videos/text2video`,
        {
          model_name: "kling-v1",
          prompt: input.prompt,
          duration: input.durationSeconds?.toString() ?? "5",
          aspect_ratio: input.aspectRatio ?? "9:16",
          cfg_scale: 0.5,
          mode: "std",
        },
        { headers: klingHeaders() }
      );

      const taskId: string = response.data?.data?.task_id ?? "";
      return { jobId: taskId, status: "queued" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { jobId: "", status: "failed", error: message };
    }
  }

  async checkStatus(jobId: string): Promise<VideoGenerationOutput> {
    if (!jobId) return { jobId: "", status: "failed", error: "No job ID" };

    try {
      const response = await axios.get(
        `${env.kling.baseUrl}/v1/videos/text2video/${jobId}`,
        { headers: klingHeaders() }
      );

      const task = response.data?.data;
      if (!task) return { jobId, status: "failed", error: "No task data" };

      const statusMap: Record<string, VideoGenerationOutput["status"]> = {
        submitted: "queued",
        processing: "processing",
        succeed: "completed",
        failed: "failed",
      };

      const status = statusMap[task.task_status] ?? "processing";
      const videoUrl = task.task_result?.videos?.[0]?.url;

      return { jobId, status, videoUrl };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { jobId, status: "failed", error: message };
    }
  }

  async download(jobId: string, outputPath: string): Promise<string> {
    const statusResult = await this.checkStatus(jobId);
    if (statusResult.status !== "completed" || !statusResult.videoUrl) {
      throw new Error(`Cannot download — job ${jobId} status: ${statusResult.status}`);
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

export const klingVideoProvider: IVideoProvider = new KlingVideoProvider();
