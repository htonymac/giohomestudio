// GioHomeStudio — ElevenLabs Voice Provider Adapter

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import type { IVoiceProvider, VoiceGenerationInput, VoiceGenerationOutput, SpeechStyle } from "@/types/providers";
import { getElevenLabsKey } from "./api-key";

// Speech style → ElevenLabs voice_settings presets (Pass B)
// stability: lower = more expressive/variable; higher = more consistent/flat
// style: 0 = no style exaggeration; 1 = max style (use sparingly)
// speedMod: multiplied against the request's speed param (or 1.0 if none set)
const SPEECH_STYLE_PRESETS: Record<SpeechStyle, { stability: number; style: number; speedMod: number }> = {
  normal:     { stability: 0.50, style: 0.00, speedMod: 1.00 },
  whisper:    { stability: 0.30, style: 0.80, speedMod: 0.85 },
  emotional:  { stability: 0.40, style: 0.70, speedMod: 1.00 },
  commanding: { stability: 0.85, style: 0.10, speedMod: 1.00 },
  trembling:  { stability: 0.20, style: 0.90, speedMod: 0.85 },
};

// Default ElevenLabs voice — "Sarah" (premade, available on free tier)
// "Rachel" (21m00Tcm4TlvDq8ikWAM) requires a paid plan — do not use as default
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

class ElevenLabsVoiceProvider implements IVoiceProvider {
  readonly name = "elevenlabs";

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput> {
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
      return { status: "failed", error: "ElevenLabs API key not configured." };
    }

    const voiceId = input.voiceId ?? DEFAULT_VOICE_ID;
    const outputPath = input.outputPath ?? `/tmp/voice_${Date.now()}.mp3`;

    try {
      // Model selection priority:
      //   1. Explicit voiceModel from input (user override in Studio)
      //   2. Auto: turbo_v2_5 + language_code when non-English language is set
      //   3. Default: eleven_multilingual_v2 (highest quality)
      const hasExplicitLanguage = input.language && input.language !== "en";
      const modelId = input.voiceModel ?? (hasExplicitLanguage ? "eleven_turbo_v2_5" : "eleven_multilingual_v2");

      // Resolve speech style preset (Pass B)
      const preset = input.speechStyle ? SPEECH_STYLE_PRESETS[input.speechStyle] : null;

      // stability: explicit input wins → preset → default 0.5
      const stability = input.stability ?? preset?.stability ?? 0.5;
      // style: explicit styleIntensity wins → preset → 0 (no exaggeration)
      const style = input.styleIntensity ?? preset?.style ?? 0;
      // speed: apply speedMod from preset on top of any explicit speed
      const baseSpeed = input.speed ?? 1.0;
      const effectiveSpeed = preset ? baseSpeed * preset.speedMod : baseSpeed;

      const body: Record<string, unknown> = {
        text: input.text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: input.similarityBoost ?? 0.75,
          style,
          use_speaker_boost: true,
        },
      };

      // language_code only supported on turbo_v2_5
      if (hasExplicitLanguage) {
        body.language_code = input.language;
      }

      // speed is only supported on turbo models — sending it to multilingual_v2 causes 400
      const isTurboModel = modelId.includes("turbo");
      if (isTurboModel && effectiveSpeed !== 1.0) {
        body.speed = Math.min(1.2, Math.max(0.7, effectiveSpeed));
      }

      const response = await axios.post(
        `${env.elevenlabs.baseUrl}/text-to-speech/${voiceId}`,
        body,
        {
          headers: {
            "xi-api-key": apiKey,
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
      if (axios.isAxiosError(err) && err.response) {
        // Decode arraybuffer error body — ElevenLabs sends JSON even on 400/401
        let detail = "";
        try {
          const buf = Buffer.from(err.response.data as ArrayBuffer);
          const parsed = JSON.parse(buf.toString()) as { detail?: { message?: string } | string; message?: string };
          const d = parsed.detail;
          detail = (typeof d === "object" ? d?.message : d) ?? (parsed.message ?? buf.toString().slice(0, 300));
        } catch { /* undecodable body — use raw message */ }
        const msg = `ElevenLabs ${err.response.status}: ${detail || err.message}`;
        console.error(`[ElevenLabs] ${msg}`);
        return { status: "failed", error: msg };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { status: "failed", error: message };
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string }>> {
    const apiKey = getElevenLabsKey();
    if (!apiKey) return [];

    try {
      const response = await axios.get(`${env.elevenlabs.baseUrl}/voices`, {
        headers: { "xi-api-key": apiKey },
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

export { voiceDesignPreview, voiceDesignGenerate, searchVoiceLibrary } from "./voice-design";
