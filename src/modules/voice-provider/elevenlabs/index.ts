// GioHomeStudio — ElevenLabs Voice Provider Adapter

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import type { IVoiceProvider, VoiceGenerationInput, VoiceGenerationOutput } from "@/types/providers";

// Default ElevenLabs voice — "Sarah" (premade, available on free tier)
// "Rachel" (21m00Tcm4TlvDq8ikWAM) requires a paid plan — do not use as default
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

class ElevenLabsVoiceProvider implements IVoiceProvider {
  readonly name = "elevenlabs";

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput> {
    if (!env.elevenlabs.apiKey) {
      return { status: "failed", error: "ElevenLabs API key not configured." };
    }

    const voiceId = input.voiceId ?? DEFAULT_VOICE_ID;
    const outputPath = input.outputPath ?? `/tmp/voice_${Date.now()}.mp3`;

    try {
      const response = await axios.post(
        `${env.elevenlabs.baseUrl}/text-to-speech/${voiceId}`,
        {
          text: input.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: input.stability ?? 0.5,
            similarity_boost: input.similarityBoost ?? 0.75,
          },
        },
        {
          headers: {
            "xi-api-key": env.elevenlabs.apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          responseType: "arraybuffer",
        }
      );

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(outputPath, Buffer.from(response.data));

      return { status: "completed", localPath: outputPath };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "failed", error: message };
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string }>> {
    if (!env.elevenlabs.apiKey) return [];

    try {
      const response = await axios.get(`${env.elevenlabs.baseUrl}/voices`, {
        headers: { "xi-api-key": env.elevenlabs.apiKey },
      });

      return (response.data?.voices ?? []).map((v: { voice_id: string; name: string }) => ({
        id: v.voice_id,
        name: v.name,
      }));
    } catch {
      return [];
    }
  }
}

export const elevenLabsVoiceProvider: IVoiceProvider = new ElevenLabsVoiceProvider();
