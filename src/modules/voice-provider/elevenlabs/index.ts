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
      // Model selection:
      //   eleven_multilingual_v2  — highest quality, all languages, no language_code param
      //   eleven_turbo_v2_5       — faster, multilingual, accepts language_code for explicit routing
      //
      // Rule: if a non-English language is explicitly set, use turbo_v2_5 + language_code.
      // Otherwise keep the high-quality multilingual_v2 default.
      const hasExplicitLanguage = input.language && input.language !== "en";
      const modelId = hasExplicitLanguage ? "eleven_turbo_v2_5" : "eleven_multilingual_v2";

      const body: Record<string, unknown> = {
        text: input.text,
        model_id: modelId,
        voice_settings: {
          stability: input.stability ?? 0.5,
          similarity_boost: input.similarityBoost ?? 0.75,
        },
      };

      // language_code only supported on turbo_v2_5
      if (hasExplicitLanguage) {
        body.language_code = input.language;
      }

      // speed is a top-level API parameter (0.7-1.2); omit if default to avoid API errors on older models
      if (input.speed != null && input.speed !== 1.0) {
        body.speed = Math.min(1.2, Math.max(0.7, input.speed));
      }

      const response = await axios.post(
        `${env.elevenlabs.baseUrl}/text-to-speech/${voiceId}`,
        body,
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
