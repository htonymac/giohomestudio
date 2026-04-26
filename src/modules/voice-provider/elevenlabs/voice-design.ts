// GioHomeStudio — ElevenLabs Voice Design API
// Handles: create-previews, create-voice-from-preview, voice library search

import axios from "axios";
import { env } from "@/config/env";
import { VOICE_PREVIEW_TEXT } from "@/modules/voice-provider/accent-profiles";
import { getElevenLabsKey } from "./api-key";

export interface VoiceDesignPreview {
  previewId: string;
  audioUrl: string;
  label: string;
}

export interface VoiceDesignPreviewResult {
  previews: VoiceDesignPreview[];
  promptUsed: string;
  locale: string;
}

export interface VoiceDesignGenerateResult {
  voiceId: string;
  voiceName: string;
  saved: boolean;
}

export interface VoiceLibraryResult {
  voices: Array<{
    voiceId: string;
    name: string;
    labels: Record<string, string>;
    previewUrl: string;
  }>;
}

// ── Create 3 voice design previews ─────────────────────────────────────────

export async function voiceDesignPreview(
  prompt: string,
  locale: string
): Promise<VoiceDesignPreviewResult> {
  const apiKey = getElevenLabsKey();
  if (!apiKey) throw new Error("ElevenLabs API key not configured.");

  const response = await axios.post(
    `${env.elevenlabs.baseUrl}/text-to-voice/create-previews`,
    {
      voice_description: prompt,
      text: VOICE_PREVIEW_TEXT,
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  const generated: Array<{ generated_voice_id: string; audio_base_64?: string; media_type?: string }> =
    response.data?.previews ?? response.data?.generated_voices ?? [];

  const previews: VoiceDesignPreview[] = generated.map((v, i) => ({
    previewId: v.generated_voice_id,
    // ElevenLabs returns base64 audio — expose as data URI the browser can play
    audioUrl: v.audio_base_64
      ? `data:${v.media_type ?? "audio/mpeg"};base64,${v.audio_base_64}`
      : "",
    label: `Variation ${i + 1}`,
  }));

  return { previews, promptUsed: prompt, locale };
}

// ── Save a chosen preview to the user's voice library ──────────────────────

export async function voiceDesignGenerate(
  previewId: string,
  voiceName: string,
  voiceDescription: string
): Promise<VoiceDesignGenerateResult> {
  const apiKey = getElevenLabsKey();
  if (!apiKey) throw new Error("ElevenLabs API key not configured.");

  const response = await axios.post(
    `${env.elevenlabs.baseUrl}/text-to-voice/create-voice-from-preview`,
    {
      generated_voice_id: previewId,
      voice_name: voiceName,
      voice_description: voiceDescription,
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    }
  );

  const voiceId: string = response.data?.voice_id ?? response.data?.voiceId ?? "";
  return { voiceId, voiceName, saved: Boolean(voiceId) };
}

// ── Search ElevenLabs Voice Library ────────────────────────────────────────

export async function searchVoiceLibrary(query: string): Promise<VoiceLibraryResult> {
  const apiKey = getElevenLabsKey();
  if (!apiKey) throw new Error("ElevenLabs API key not configured.");

  // Search the public shared-voices library — supports search + language filtering
  const response = await axios.get(`${env.elevenlabs.baseUrl}/shared-voices`, {
    headers: { "xi-api-key": apiKey },
    params: { search: query, language: "en", page_size: 20 },
  });

  const raw: Array<{
    voice_id: string;
    name: string;
    accent?: string;
    gender?: string;
    age?: string;
    language?: string;
    description?: string;
    preview_url?: string;
    labels?: Record<string, string>;
  }> = response.data?.voices ?? [];

  return {
    voices: raw.slice(0, 12).map(v => ({
      voiceId: v.voice_id,
      name: v.name,
      labels: {
        ...(v.labels ?? {}),
        ...(v.accent ? { accent: v.accent } : {}),
        ...(v.gender ? { gender: v.gender } : {}),
        ...(v.age    ? { age: v.age }       : {}),
      },
      previewUrl: v.preview_url ?? "",
    })),
  };
}
