// GHS Feature Flags — H4 of 12-hour run (2026-06-05).
//
// Per the production doctrine: ship new code behind a flag, enable for internal
// users first, then beta, then 10%, then everyone. If something breaks, kill
// the flag — code stays deployed, feature disappears. No rollback needed.
//
// Storage: Postgres FeatureFlag table. One row per flag. Defaults to TRUE
// (existing behavior preserved) so a missing row = enabled.
//
// 5-second in-memory cache so we don't hit DB on every API call.
//
// Public API:
//   isFlagEnabled(key) → Promise<boolean>
//   setFlag(key, enabled, by?) → Promise<void>
//   listFlags() → Promise<{key, enabled, description, updatedAt}[]>
//
// Kill switches defined in KNOWN_FLAGS. If a flag is OFF, the matching API
// route should return 503 Service Unavailable with a clean JSON body so
// clients can show a maintenance message.

import { prisma } from "@/lib/prisma";

export const KNOWN_FLAGS = {
  FLAG_FAL_VOICES: {
    description: "Allow FAL paid voice providers (F5-TTS, XTTS, Bark, Gemini). Disable to prevent FAL credit drain.",
    defaultEnabled: true,
  },
  FLAG_ELEVENLABS_VOICES: {
    description: "Allow ElevenLabs voice (GHS Best tier). Disable to prevent EL credit drain.",
    defaultEnabled: true,
  },
  FLAG_VIDEO_ASSEMBLY: {
    description: "Allow /api/video/assemble route. Disable for emergency maintenance.",
    defaultEnabled: true,
  },
  FLAG_FREEMODE: {
    description: "Allow Free Mode (/dashboard/free-mode). Disable to gate access.",
    defaultEnabled: true,
  },
  FLAG_HYBRID: {
    description: "Allow Hybrid planner. Disable if Hybrid breaks pre-launch.",
    defaultEnabled: true,
  },
  FLAG_LLM_CACHE: {
    description: "Use LLM semantic cache. Disable to bypass cache (debug only).",
    defaultEnabled: true,
  },
  FLAG_NEW_USER_SIGNUPS: {
    description: "Allow new user registrations. Disable to pause signups during incident.",
    defaultEnabled: true,
  },
} as const;

export type FlagKey = keyof typeof KNOWN_FLAGS;

// In-memory cache (5-second TTL) — flag changes propagate within 5s
const cache = new Map<string, { value: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5_000;

export async function isFlagEnabled(key: FlagKey | string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const row = await prisma.featureFlag.findUnique({ where: { key } });
    const value = row ? row.enabled : (KNOWN_FLAGS[key as FlagKey]?.defaultEnabled ?? true);
    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch (err) {
    // On DB error, fail open (existing behavior) so a DB blip doesn't take down
    // every feature. Log explicitly so we know.
    console.error("[feature-flags] read error, defaulting to TRUE:", err instanceof Error ? err.message : String(err));
    return KNOWN_FLAGS[key as FlagKey]?.defaultEnabled ?? true;
  }
}

export async function setFlag(key: FlagKey | string, enabled: boolean, by?: string): Promise<void> {
  const description = KNOWN_FLAGS[key as FlagKey]?.description ?? null;
  await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, updatedBy: by ?? null },
    create: { key, enabled, description, updatedBy: by ?? null },
  });
  cache.delete(key);
}

export async function listFlags(): Promise<Array<{ key: string; enabled: boolean; description: string | null; updatedAt: Date; updatedBy: string | null }>> {
  // Merge known flags + DB rows so unknown-in-DB flags still appear with defaults
  const rows = await prisma.featureFlag.findMany();
  const rowMap = new Map(rows.map(r => [r.key, r]));
  const out: Array<{ key: string; enabled: boolean; description: string | null; updatedAt: Date; updatedBy: string | null }> = [];

  for (const key of Object.keys(KNOWN_FLAGS) as FlagKey[]) {
    const row = rowMap.get(key);
    out.push({
      key,
      enabled: row?.enabled ?? KNOWN_FLAGS[key].defaultEnabled,
      description: row?.description ?? KNOWN_FLAGS[key].description,
      updatedAt: row?.updatedAt ?? new Date(0),
      updatedBy: row?.updatedBy ?? null,
    });
  }

  // Append unknown DB flags last
  for (const row of rows) {
    if (!(row.key in KNOWN_FLAGS)) {
      out.push({ key: row.key, enabled: row.enabled, description: row.description, updatedAt: row.updatedAt, updatedBy: row.updatedBy });
    }
  }

  return out;
}

// Convenience: throw a 503-style helper that API routes can use.
// Usage in route handler:
//   if (!(await isFlagEnabled("FLAG_FAL_VOICES"))) return flagDisabledResponse("FAL voices");
export function flagDisabledResponse(featureName: string): Response {
  return new Response(
    JSON.stringify({
      error: "feature_disabled",
      feature: featureName,
      message: `${featureName} is temporarily disabled by maintainer. Try again later.`,
    }),
    { status: 503, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
  );
}
