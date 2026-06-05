// GHS LLM Semantic Cache — H3 of 12-hour run (2026-06-05).
//
// Goal: cut LLM spend by 40-60% on repeated patterns (per the production
// doctrine in MUST_READ_BEFORE_APP.txt).
//
// Strategy: deterministic hash cache keyed on (prompt + system + role + model).
// Same exact input within TTL window = cached return. NOT semantic similarity
// (that needs embeddings + Upstash Vector; deferred to Phase 2 of this work).
//
// Hit pattern this catches:
//   - Children-planner asks the same story-expand for the same story title twice
//   - Scene-plan retried after a UI error
//   - Character-extract on a paragraph the user clicked twice
//   - Identical /api/free-mode/chat history → identical LLM output (LLM is
//     deterministic at temperature 0; we treat all roles as cache-eligible)
//
// What it does NOT do:
//   - No fuzzy matching (Q1: "tell me a snake story" ≠ Q2: "tell me a story about a snake")
//   - No embedding-based similarity (Phase 2)
//   - No invalidation by content age (TTL only)
//
// Public API:
//   getCachedLLM(input) → Promise<{hit: boolean, text?: string, provider?: string}>
//   storeLLMResponse(input, result) → Promise<void>

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export interface CacheInput {
  prompt: string;
  system?: string;
  role?: string;
  model?: string;          // optional — varies cache key when set
}

export interface CacheResult {
  hit: boolean;
  text?: string;
  provider?: string;
  model?: string;
}

// Default TTL: 14 days. LLM outputs for the same input rarely need refreshing
// inside two weeks (story-expand for "ABC alphabet song" doesn't change).
const DEFAULT_TTL_DAYS = 14;

function makeHashKey(input: CacheInput): string {
  const parts = [
    input.prompt.trim(),
    input.system?.trim() ?? "",
    input.role ?? "",
    input.model ?? "",
  ];
  return createHash("sha256").update(parts.join("\n--\n")).digest("hex");
}

export async function getCachedLLM(input: CacheInput, ttlDays = DEFAULT_TTL_DAYS): Promise<CacheResult> {
  try {
    const hashKey = makeHashKey(input);
    const row = await prisma.llmCache.findUnique({ where: { hashKey } });
    if (!row) return { hit: false };

    const ageMs = Date.now() - row.createdAt.getTime();
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) {
      // Expired — best-effort delete in background, don't block on it
      prisma.llmCache.delete({ where: { hashKey } }).catch(() => {});
      return { hit: false };
    }

    // Bump hit counter (fire-and-forget) — we don't await so cache hit is fast
    prisma.llmCache.update({
      where: { hashKey },
      data: { hits: { increment: 1 }, lastHitAt: new Date() },
    }).catch(() => {});

    return { hit: true, text: row.responseText, provider: row.provider, model: row.model ?? undefined };
  } catch (err) {
    // Cache miss on any error — don't fail the caller
    console.error("[llm-cache] read error:", err instanceof Error ? err.message : String(err));
    return { hit: false };
  }
}

export async function storeLLMResponse(
  input: CacheInput,
  result: { text: string; provider: string; model?: string }
): Promise<void> {
  try {
    if (!result.text?.trim()) return; // don't cache empty responses
    const hashKey = makeHashKey(input);
    await prisma.llmCache.upsert({
      where: { hashKey },
      update: { responseText: result.text, provider: result.provider, model: result.model ?? null, lastHitAt: new Date() },
      create: {
        hashKey,
        prompt: input.prompt.slice(0, 8000),
        systemPrompt: input.system?.slice(0, 4000) ?? null,
        role: input.role ?? null,
        responseText: result.text,
        provider: result.provider,
        model: result.model ?? null,
      },
    });
  } catch (err) {
    console.error("[llm-cache] write error:", err instanceof Error ? err.message : String(err));
  }
}

// Diagnostics: get cache stats for /admin
export async function getCacheStats(): Promise<{ total: number; totalHits: number; topHits: Array<{ hashKey: string; hits: number; prompt: string; createdAt: Date }> }> {
  try {
    const [total, hits, top] = await Promise.all([
      prisma.llmCache.count(),
      prisma.llmCache.aggregate({ _sum: { hits: true } }),
      prisma.llmCache.findMany({
        orderBy: { hits: "desc" },
        take: 10,
        select: { hashKey: true, hits: true, prompt: true, createdAt: true },
      }),
    ]);
    return {
      total,
      totalHits: hits._sum.hits ?? 0,
      topHits: top.map(r => ({ ...r, prompt: r.prompt.slice(0, 120) })),
    };
  } catch (err) {
    console.error("[llm-cache] stats error:", err instanceof Error ? err.message : String(err));
    return { total: 0, totalHits: 0, topHits: [] };
  }
}
