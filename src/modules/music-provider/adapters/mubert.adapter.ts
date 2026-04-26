// GioHomeStudio — Mubert Music Adapter
// Mubert B2B API — best for instrumental ambient / background tracks.
// Requires: MUBERT_PAT env var (Personal Access Token from mubert.com).
// Endpoint: https://api-b2b.mubert.com/v2/RecordTrackTTM  (POST)
// Auth:     pat field in request body (Mubert B2B pattern)
// Sync job — returns audio URL directly.

import type { MusicGenerateInput, MusicGenerateOutput, MusicProviderCapabilities, MusicProviderAdapter } from "../types";

const ENDPOINT = "https://api-b2b.mubert.com/v2/RecordTrackTTM";

// Mubert tag list (subset relevant to GHS)
const GENRE_TAG_MAP: Record<string, string> = {
  ambient: "ambient",
  cinematic: "cinematic",
  electronic: "electronic",
  pop: "pop",
  hiphop: "hip-hop",
  jazz: "jazz",
  classical: "classical",
  acoustic: "acoustic",
  afrobeats: "afrobeats",
  reggae: "reggae",
};

function toMubertTags(genre?: string, mood?: string): string[] {
  const tags: string[] = [];
  if (genre) {
    const key = genre.toLowerCase().replace(/[^a-z]/g, "");
    const mapped = GENRE_TAG_MAP[key];
    if (mapped) tags.push(mapped);
  }
  if (mood) tags.push(mood.toLowerCase());
  if (tags.length === 0) tags.push("ambient");
  return tags;
}

class MubertAdapter implements MusicProviderAdapter {
  readonly name = "mubert";

  getCapabilities(): MusicProviderCapabilities {
    return {
      maxDurationSeconds: 600,
      supportsLyrics: false,
      supportsGenre: true,
      costPerTrack: 0.05,
      quality: "standard",
    };
  }

  async generate(input: MusicGenerateInput): Promise<MusicGenerateOutput> {
    const pat = process.env.MUBERT_PAT;
    if (!pat) {
      throw new Error("MUBERT_PAT not set — get your Personal Access Token at mubert.com/b2b");
    }

    const tags = toMubertTags(input.genre, input.mood);
    const duration = Math.min(input.durationSeconds, 600);

    const body = {
      method: "RecordTrackTTM",
      params: {
        pat,
        text: input.prompt.slice(0, 500),
        tags,
        duration,
        format: "mp3",
        intensity: "medium",
        mode: "track",
      },
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mubert HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    // Mubert wraps results in { data: { tasks: [{ download_link }] } }
    const downloadLink: string | undefined =
      data?.data?.tasks?.[0]?.download_link ??
      data?.data?.url;

    if (!downloadLink) {
      throw new Error(`Mubert did not return a download_link — response: ${JSON.stringify(data)}`);
    }

    return {
      audioUrl: downloadLink,
      durationSeconds: duration,
      costUsd: 0.05,
      providerKey: "mubert",
      modelName: "mubert/ttm-v2",
    };
  }
}

export const mubertAdapter: MusicProviderAdapter = new MubertAdapter();
