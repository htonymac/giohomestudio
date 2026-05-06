// POST /api/music/generate — Music Provider Layer
//
// Accepts:
//   { prompt, durationSeconds, genre?, mood?, hasLyrics?, providerKey?, soundTier? }
//
// providerKey: "kie" | "mubert" | "stable_audio" | "stock" | "auto"
// soundTier:   "ghs-sound" | "ghs-plus" | "ghs-pro" | "ghs-premium"
//   When soundTier is provided it overrides providerKey with the correct adapter.
//   soundTier mapping:
//     ghs-sound    → stock
//     ghs-plus     → stock
//     ghs-pro      → stable_audio  (FAL_KEY required; falls back to stock)
//     ghs-premium  → kie           (KIE_AI_API_KEY required; falls back to stock)
//
// Default: "auto" — uses pickAutomaticProvider() routing logic.
//
// Required env vars (depending on provider):
//   KIE_AI_API_KEY  — Kie.ai / Suno V5   (lyrical tracks, ghs-premium)
//   MUBERT_PAT      — Mubert B2B          (long instrumental)
//   FAL_KEY         — fal.ai gateway      (Stable Audio ≤47s, ghs-pro)
//   stock adapter always works with no keys.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMusicProvider, pickAutomaticProvider, pickAutomaticProviderWithReason, getMusicProviderForSoundTier } from "@/modules/music-provider";
import type { MusicProviderKey } from "@/modules/music-provider";
import type { GhsSoundTierId } from "@/lib/ghs-sound-tiers";

const schema = z.object({
  prompt: z.string().min(1).max(500),
  durationSeconds: z.number().min(5).max(600).default(60),
  genre: z.string().max(60).optional(),
  mood: z.string().max(60).optional(),
  hasLyrics: z.boolean().default(false),
  providerKey: z.enum(["kie", "mubert", "stable_audio", "stock", "auto"]).default("auto"),
  soundTier: z.enum(["ghs-sound", "ghs-plus", "ghs-pro", "ghs-premium"]).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { prompt, durationSeconds, genre, mood, hasLyrics, providerKey, soundTier } = parsed.data;

  const input = { prompt, durationSeconds, genre, mood, hasLyrics };

  // Resolve provider — soundTier takes precedence over providerKey when provided
  let autoFallbackReason: string | undefined;
  const provider = soundTier
    ? (() => {
        const { adapter, fallbackReason } = getMusicProviderForSoundTier(soundTier as GhsSoundTierId);
        autoFallbackReason = fallbackReason;
        return adapter;
      })()
    : providerKey === "auto"
      ? (() => {
          const { adapter, fallbackReason } = pickAutomaticProviderWithReason(input);
          autoFallbackReason = fallbackReason;
          return adapter;
        })()
      : getMusicProvider(providerKey as MusicProviderKey);

  let result;
  try {
    result = await provider.generate(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[music/generate] Provider "${provider.name}" threw:`, message);

    // Hard fallback to stock on any provider error
    if (provider.name !== "stock") {
      console.warn("[music/generate] Falling back to stock adapter");
      const { stockAdapter } = await import("@/modules/music-provider/adapters/stock.adapter");
      try {
        result = await stockAdapter.generate(input);
      } catch {
        return NextResponse.json(
          { error: `All providers failed. Last error: ${message}` },
          { status: 503 },
        );
      }
    } else {
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  // Persist to DB (non-fatal)
  try {
    await prisma.musicGeneration.create({
      data: {
        prompt,
        providerKey: result.providerKey,
        modelName: result.modelName,
        audioUrl: result.audioUrl,
        durationSeconds: result.durationSeconds,
        costUsd: result.costUsd,
        hasLyrics,
        genre: genre ?? null,
        mood: mood ?? null,
      },
    });
  } catch (dbErr) {
    console.warn("[music/generate] DB persist failed:", dbErr);
  }

  return NextResponse.json({
    audioUrl: result.audioUrl,
    durationSeconds: result.durationSeconds,
    costUsd: result.costUsd,
    providerKey: result.providerKey,
    modelName: result.modelName,
    ...(autoFallbackReason ? { fallbackReason: autoFallbackReason } : {}),
  });
}
