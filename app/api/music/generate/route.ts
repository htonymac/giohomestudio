// POST /api/music/generate — Music Provider Layer
//
// Accepts:
//   { prompt, durationSeconds, genre?, mood?, hasLyrics?, providerKey? }
//
// providerKey: "kie" | "mubert" | "stable_audio" | "stock" | "auto"
// Default: "auto" — uses pickAutomaticProvider() routing logic.
//
// Required env vars (depending on provider):
//   KIE_AI_API_KEY  — Kie.ai / Suno V5   (lyrical tracks)
//   MUBERT_PAT      — Mubert B2B          (long instrumental)
//   FAL_KEY         — fal.ai gateway      (Stable Audio ≤47s)
//   stock adapter always works with no keys.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMusicProvider, pickAutomaticProvider } from "@/modules/music-provider";
import type { MusicProviderKey } from "@/modules/music-provider";

const schema = z.object({
  prompt: z.string().min(1).max(500),
  durationSeconds: z.number().min(5).max(600).default(60),
  genre: z.string().max(60).optional(),
  mood: z.string().max(60).optional(),
  hasLyrics: z.boolean().default(false),
  providerKey: z.enum(["kie", "mubert", "stable_audio", "stock", "auto"]).default("auto"),
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

  const { prompt, durationSeconds, genre, mood, hasLyrics, providerKey } = parsed.data;

  const input = { prompt, durationSeconds, genre, mood, hasLyrics };

  // Resolve provider
  const provider =
    providerKey === "auto"
      ? pickAutomaticProvider(input)
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
  });
}
