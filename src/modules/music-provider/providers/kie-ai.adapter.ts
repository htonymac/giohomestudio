// GioHomeStudio — Kie.AI Music Provider Adapter
// Kie.AI wraps Suno V5 API — premium tier music generation
// Supports: vocals + lyrics, instrumental, custom mode, style control
// Pricing: credit-based, 5000 free credits on signup at kie.ai

import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";
import { env } from "@/config/env";

class KieAiMusicProvider implements IMusicProvider {
  readonly name = "kie_ai";
  readonly isAsync = true;

  async generate(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    if (!env.music.kieAiApiKey) {
      return {
        status: "failed",
        error: "KIE_AI_API_KEY not set. Sign up free at kie.ai (5000 free credits).",
        providerName: this.name,
      };
    }

    try {
      const isCustom = !!(input.style || input.genre);
      const body: Record<string, unknown> = {
        prompt: input.prompt ?? input.description ?? "upbeat background music",
        customMode: isCustom,
        instrumental: !input.prompt?.toLowerCase().includes("lyrics") && !input.prompt?.toLowerCase().includes("vocal"),
        model: "V5",
      };

      if (isCustom) {
        body.style = input.genre ?? input.style ?? "Pop";
        body.title = input.title ?? "GHS Track";
      }

      const res = await fetch("https://api.kie.ai/api/v1/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.music.kieAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return { status: "failed", error: `Kie.ai HTTP ${res.status}`, providerName: this.name };
      }

      const data = await res.json();
      const taskId = data.data?.taskId;
      if (!taskId) {
        return { status: "failed", error: "No taskId returned", providerName: this.name };
      }

      return {
        status: "queued",
        jobId: taskId,
        providerName: this.name,
      };
    } catch (e) {
      return {
        status: "failed",
        error: `Kie.ai error: ${e instanceof Error ? e.message : String(e)}`,
        providerName: this.name,
      };
    }
  }

  async checkStatus(jobId: string): Promise<MusicGenerationOutput> {
    if (!env.music.kieAiApiKey) {
      return { status: "failed", jobId, error: "KIE_AI_API_KEY not set", providerName: this.name };
    }

    try {
      const res = await fetch(`https://api.kie.ai/api/v1/task/${jobId}`, {
        headers: { Authorization: `Bearer ${env.music.kieAiApiKey}` },
      });

      if (!res.ok) {
        return { status: "failed", jobId, error: `Poll HTTP ${res.status}`, providerName: this.name };
      }

      const data = await res.json();
      const status = data.data?.status;

      if (status === "complete" || data.data?.callbackType === "complete") {
        const tracks = data.data?.data ?? [];
        const audioUrl = tracks[0]?.audio_url;
        return {
          status: "completed",
          jobId,
          providerName: this.name,
          outputUrl: audioUrl,
          metadata: { tracks: tracks.length, duration: tracks[0]?.duration },
        };
      }

      if (status === "failed") {
        return { status: "failed", jobId, error: "Generation failed", providerName: this.name };
      }

      return { status: "processing", jobId, providerName: this.name };
    } catch (e) {
      return { status: "failed", jobId, error: `Poll error: ${e instanceof Error ? e.message : String(e)}`, providerName: this.name };
    }
  }
}

export const kieAiMusicProvider: IMusicProvider = new KieAiMusicProvider();
