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
  // Henry 2026-06-15: the route used to SILENTLY fall back to a stock track on any
  // provider error and return it as if AI generation succeeded. That hid a real
  // problem (FAL "Exhausted balance" 403 → every AI request quietly served stock).
  // Now we capture WHY the AI provider failed and surface it, classifying common
  // billing/auth failures so the UI can tell the user the truth ("top up"), not "done".
  let aiFailReason: string | undefined;
  let aiFailKind: "billing" | "auth" | "unavailable" | "error" | undefined;
  try {
    result = await provider.generate(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[music/generate] Provider "${provider.name}" threw:`, message);

    // Hard fallback to stock on any provider error
    if (provider.name !== "stock") {
      aiFailReason = message;
      aiFailKind = /exhausted balance|locked|top up|billing|insufficient|quota|payment/i.test(message)
        ? "billing"
        : /401|403|unauthor|forbidden|invalid.*key|api key/i.test(message)
          ? "auth"
          : /404|not found|unavailable|no longer|deprecat/i.test(message)
            ? "unavailable"
            : "error";
      console.warn(`[music/generate] AI provider "${provider.name}" failed (${aiFailKind}) — falling back to stock library`);
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

  // Whether the returned track is genuinely AI-generated (vs a stock fallback).
  const aiGenerated = result.providerKey !== "stock";

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

  // Henry 2026-06-15: AI-generated music must carry a licence record so it shows in the
  // Music Library with a downloadable certificate. The track's licence = the provider's
  // commercial-use terms (AI_GENERATED). Stock fallbacks already have manifest records.
  if (aiGenerated) {
    try {
      const { appendLicenseRecord } = await import("@/lib/music-license-registry");
      const ts = Date.now();
      appendLicenseRecord({
        id: `ai_${ts}`,
        title: prompt.slice(0, 60),
        source: `AI-generated (${result.providerKey})`,
        sourceUrl: null,
        license: "AI-generated — provider commercial licence",
        licenseType: "AI_GENERATED",
        licenseUrl: result.providerKey === "stable_audio" ? "https://fal.ai/terms" : null,
        commercialUseAllowed: true,
        attributionRequired: false,
        provider: result.providerKey,
        model: result.modelName,
        acquiredAt: new Date(ts).toISOString().slice(0, 10),
        verificationStatus: "provider-licensed",
        note: "Uniquely AI-generated for this account. Commercial use per the provider's current terms — verify your provider plan before monetised publication.",
      });
    } catch (e) {
      console.warn("[music/generate] licence record write failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    audioUrl: result.audioUrl,
    durationSeconds: result.durationSeconds,
    costUsd: result.costUsd,
    providerKey: result.providerKey,
    modelName: result.modelName,
    // Honest signal to the UI: was this actually AI-generated, or a stock fallback?
    aiGenerated,
    ...(aiFailKind ? { aiFailKind } : {}),
    ...(aiFailReason ? { aiFailReason } : {}),
    ...(aiFailKind === "billing"
      ? { userMessage: "AI music is temporarily unavailable (generation provider balance is exhausted). A royalty-free library track was used instead. Top up FAL at fal.ai/dashboard/billing to enable AI music." }
      : aiFailKind === "auth"
        ? { userMessage: "AI music provider key is missing or invalid — a royalty-free library track was used instead." }
        : aiFailKind
          ? { userMessage: "AI music generation failed — a royalty-free library track was used instead." }
          : {}),
    ...(autoFallbackReason ? { fallbackReason: autoFallbackReason } : {}),
  });
}
