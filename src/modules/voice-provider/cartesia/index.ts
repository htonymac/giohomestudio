// GioHomeStudio — Cartesia Voice Provider
// Ultra-low latency, high quality TTS. Good for real-time preview.
// API: https://docs.cartesia.ai
//
// Setup: Set CARTESIA_API_KEY in .env

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import type { IVoiceProvider, VoiceGenerationInput, VoiceGenerationOutput } from "@/types/providers";

const API_BASE = "https://api.cartesia.ai";

function getKey(): string | null {
  return process.env.CARTESIA_API_KEY ?? null;
}

// Cartesia voice IDs — common voices
const CARTESIA_VOICES = [
  { id: "a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbershop Man" },
  { id: "87748186-23bb-4571-8b34-0f25aa0b6688", name: "British Lady" },
  { id: "71a7ad14-091c-4e8e-a314-022ece01c121", name: "Calm Lady" },
  { id: "ee7ea9f8-c0c1-498c-9f43-e0a4e5060cad", name: "Friendly Narrator" },
  { id: "c2ac25f9-ecc4-4f56-9095-651354df60c0", name: "Commercial Male" },
  { id: "2ee87190-8f84-4925-97da-e52547f9462c", name: "Warm Female" },
];

class CartesiaVoiceProvider implements IVoiceProvider {
  readonly name = "cartesia";

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput> {
    const apiKey = getKey();
    if (!apiKey) {
      return { status: "failed", error: "Cartesia API key not configured (CARTESIA_API_KEY)" };
    }

    const outputPath = input.outputPath ?? `/tmp/cartesia_voice_${Date.now()}.mp3`;
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    const voiceId = input.voiceId ?? CARTESIA_VOICES[3].id; // Friendly Narrator default

    try {
      const res = await axios.post(`${API_BASE}/tts/bytes`, {
        model_id: "sonic-2",
        transcript: input.text,
        voice: { mode: "id", id: voiceId },
        output_format: {
          container: "mp3",
          bit_rate: 128000,
          sample_rate: 44100,
        },
        language: input.language ?? "en",
      }, {
        headers: {
          "X-API-Key": apiKey,
          "Cartesia-Version": "2024-06-10",
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      fs.writeFileSync(outputPath, Buffer.from(res.data));
      console.log(`[Cartesia] Generated ${Buffer.from(res.data).length} bytes → ${outputPath}`);
      return { status: "completed", localPath: outputPath };
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `Cartesia ${err.response.status}: ${Buffer.from(err.response.data).toString().slice(0, 200)}`
        : err instanceof Error ? err.message : String(err);
      console.error(`[Cartesia] Failed:`, message);
      return { status: "failed", error: message };
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string }>> {
    return CARTESIA_VOICES;
  }
}

export const cartesiaVoiceProvider: IVoiceProvider = new CartesiaVoiceProvider();
