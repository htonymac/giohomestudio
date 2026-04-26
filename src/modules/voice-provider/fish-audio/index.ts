// GioHomeStudio — Fish Audio Voice Provider
// 80% cheaper than ElevenLabs for high volume narration.
// API: https://docs.fish.audio
//
// Setup: Set FISH_AUDIO_API_KEY in .env
// Default voice: uses Fish Audio's default model

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import type { IVoiceProvider, VoiceGenerationInput, VoiceGenerationOutput } from "@/types/providers";

const API_BASE = "https://api.fish.audio/v1";

function getKey(): string | null {
  return process.env.FISH_AUDIO_API_KEY ?? null;
}

class FishAudioVoiceProvider implements IVoiceProvider {
  readonly name = "fish_audio";

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput> {
    const apiKey = getKey();
    if (!apiKey) {
      return { status: "failed", error: "Fish Audio API key not configured (FISH_AUDIO_API_KEY)" };
    }

    const outputPath = input.outputPath ?? `/tmp/fish_voice_${Date.now()}.mp3`;
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    try {
      const res = await axios.post(`${API_BASE}/tts`, {
        text: input.text,
        reference_id: input.voiceId ?? undefined,
        format: "mp3",
      }, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 60000,
      });

      fs.writeFileSync(outputPath, Buffer.from(res.data));
      console.log(`[FishAudio] Generated ${Buffer.from(res.data).length} bytes → ${outputPath}`);
      return { status: "completed", localPath: outputPath };
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `Fish Audio ${err.response.status}: ${Buffer.from(err.response.data).toString().slice(0, 200)}`
        : err instanceof Error ? err.message : String(err);
      console.error(`[FishAudio] Failed:`, message);
      return { status: "failed", error: message };
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string }>> {
    const apiKey = getKey();
    if (!apiKey) return [];
    try {
      const res = await axios.get(`${API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      return (res.data?.items ?? []).map((v: { _id: string; title: string }) => ({
        id: v._id,
        name: v.title,
      }));
    } catch { return []; }
  }
}

export const fishAudioVoiceProvider: IVoiceProvider = new FishAudioVoiceProvider();
