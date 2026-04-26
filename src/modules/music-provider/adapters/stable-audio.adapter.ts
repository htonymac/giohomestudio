// GioHomeStudio — Stable Audio Adapter (via fal.ai gateway)
// fal-ai/stable-audio — cinematic/ambient short tracks.
// Requires: FAL_KEY env var (existing GHS gateway key).
// Max duration: 47 seconds (Stable Audio hard limit).
// Uses fal queue endpoint for async generation.

import type { MusicGenerateInput, MusicGenerateOutput, MusicProviderCapabilities, MusicProviderAdapter } from "../types";

const FAL_QUEUE_URL = "https://queue.fal.run/fal-ai/stable-audio";
const POLL_BASE_URL = "https://queue.fal.run/fal-ai/stable-audio/requests";
const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 40; // ~2 minutes

class StableAudioAdapter implements MusicProviderAdapter {
  readonly name = "stable_audio";

  getCapabilities(): MusicProviderCapabilities {
    return {
      maxDurationSeconds: 47,
      supportsLyrics: false,
      supportsGenre: true,
      costPerTrack: 0.03,
      quality: "standard",
    };
  }

  async generate(input: MusicGenerateInput): Promise<MusicGenerateOutput> {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      throw new Error("FAL_KEY not set — required for Stable Audio via fal.ai");
    }

    const duration = Math.min(input.durationSeconds, 47);

    const promptParts = [input.prompt];
    if (input.genre) promptParts.push(input.genre);
    if (input.mood) promptParts.push(input.mood);
    const fullPrompt = promptParts.join(", ").slice(0, 500);

    // Submit to fal queue
    const submitRes = await fetch(FAL_QUEUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        seconds_total: duration,
      }),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`Stable Audio (fal) submit failed HTTP ${submitRes.status}: ${text}`);
    }

    const submitData = await submitRes.json();
    const requestId: string | undefined = submitData.request_id;
    if (!requestId) {
      throw new Error(`Stable Audio fal did not return request_id — response: ${JSON.stringify(submitData)}`);
    }

    // Poll for result
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(`${POLL_BASE_URL}/${requestId}`, {
        headers: { Authorization: `Key ${falKey}` },
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      const status: string = statusData.status ?? "";

      if (status === "COMPLETED") {
        const audioUrl: string | undefined =
          statusData.output?.audio_file?.url ??
          statusData.output?.audio?.url;

        if (!audioUrl) {
          throw new Error(`Stable Audio complete but no audio URL — response: ${JSON.stringify(statusData)}`);
        }

        return {
          audioUrl,
          durationSeconds: duration,
          costUsd: 0.03,
          providerKey: "stable_audio",
          modelName: "fal-ai/stable-audio",
        };
      }

      if (status === "FAILED") {
        throw new Error(`Stable Audio fal request ${requestId} failed`);
      }
    }

    throw new Error(`Stable Audio request ${requestId} timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`);
  }
}

export const stableAudioAdapter: MusicProviderAdapter = new StableAudioAdapter();
