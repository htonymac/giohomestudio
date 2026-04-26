// GioHomeStudio — Kie.ai Music Adapter
// Kie.ai wraps Suno V5 — best for lyrical / vocal-style tracks.
// Requires: KIE_AI_API_KEY env var.
// Endpoint: https://api.kie.ai/api/v1/generate  (POST)
// Auth:     Authorization: Bearer <key>
// Async job — polls until complete or 3 minutes elapsed.

import type { MusicGenerateInput, MusicGenerateOutput, MusicProviderCapabilities, MusicProviderAdapter } from "../types";

const BASE_URL = "https://api.kie.ai";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 36; // 3 minutes

class KieAdapter implements MusicProviderAdapter {
  readonly name = "kie";

  getCapabilities(): MusicProviderCapabilities {
    return {
      maxDurationSeconds: 240,
      supportsLyrics: true,
      supportsGenre: true,
      costPerTrack: 0.10,
      quality: "high",
    };
  }

  async generate(input: MusicGenerateInput): Promise<MusicGenerateOutput> {
    const apiKey = process.env.KIE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("KIE_AI_API_KEY not set — sign up at kie.ai to get a key");
    }

    const isCustom = !!(input.genre);
    const body: Record<string, unknown> = {
      prompt: input.prompt.slice(0, 500),
      customMode: isCustom,
      instrumental: !input.hasLyrics,
      model: "V5",
    };

    if (isCustom) {
      body.style = input.genre ?? "Pop";
      body.title = input.prompt.slice(0, 60);
    }

    // Submit generation job
    const submitRes = await fetch(`${BASE_URL}/api/v1/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`Kie.ai submit failed HTTP ${submitRes.status}: ${text}`);
    }

    const submitData = await submitRes.json();
    const taskId: string | undefined = submitData.data?.taskId;
    if (!taskId) {
      throw new Error(`Kie.ai did not return a taskId — response: ${JSON.stringify(submitData)}`);
    }

    // Poll for completion
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await fetch(`${BASE_URL}/api/v1/task/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const status = pollData.data?.status;
      const isComplete = status === "complete" || pollData.data?.callbackType === "complete";

      if (isComplete) {
        const tracks: Array<{ audio_url?: string; duration?: number }> = pollData.data?.data ?? pollData.data?.tracks ?? [];
        const audioUrl = tracks[0]?.audio_url;
        if (!audioUrl) throw new Error("Kie.ai task complete but no audio_url in response");

        return {
          audioUrl,
          durationSeconds: tracks[0]?.duration ?? input.durationSeconds,
          costUsd: 0.10,
          providerKey: "kie",
          modelName: "kie_ai/suno-v5",
        };
      }

      if (status === "failed") {
        throw new Error(`Kie.ai task ${taskId} failed`);
      }
    }

    throw new Error(`Kie.ai task ${taskId} timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`);
  }
}

export const kieAdapter: MusicProviderAdapter = new KieAdapter();
