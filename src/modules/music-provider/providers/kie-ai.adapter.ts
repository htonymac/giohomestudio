// GioHomeStudio — Kie.AI Music Provider Adapter (stub)
// Kie.AI supports song-style and instrumental music generation.
// Implement when API key is available.

import type { IMusicProvider, MusicGenerationInput, MusicGenerationOutput } from "@/types/providers";
import { env } from "@/config/env";

class KieAiMusicProvider implements IMusicProvider {
  readonly name = "kie_ai";
  readonly isAsync = true; // Kie.AI is async — generates a job, poll for result

  async generate(input: MusicGenerationInput): Promise<MusicGenerationOutput> {
    if (!env.music.kieAiApiKey) {
      return {
        status: "failed",
        error: "KIE_AI_API_KEY is not set. Add it to .env to activate this provider.",
        providerName: this.name,
      };
    }

    // TODO: Implement Kie.AI API call when key is available
    // Expected flow:
    // 1. POST /v1/generate with { prompt, duration, style }
    // 2. Receive { job_id }
    // 3. Poll GET /v1/jobs/{job_id} until status = "completed"
    // 4. Download result audio to local storage

    return {
      status: "queued",
      jobId: "kie_ai_placeholder",
      providerName: this.name,
      error: "Kie.AI adapter not yet fully implemented — add API key and complete POST logic.",
    };
  }

  async checkStatus(jobId: string): Promise<MusicGenerationOutput> {
    // TODO: implement polling
    return {
      status: "failed",
      jobId,
      providerName: this.name,
      error: "checkStatus not implemented yet for Kie.AI.",
    };
  }
}

export const kieAiMusicProvider: IMusicProvider = new KieAiMusicProvider();
