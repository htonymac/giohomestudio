// Rate-limit defense — H7 of 12-hour run (2026-06-05).
//
// Per the production doctrine §15 "API rate limit surprise":
//   "AI generated code almost never handles rate limits properly. It doesn't
//    implement backoff. It doesn't queue. It doesn't cache. Production-ready
//    looks like: exponential backoff on failures, request queuing for non-urgent
//    operations, response caching where appropriate."
//
// This module gives FAL (and any future external API gateway) three primitives:
//
//   1. withBackoff(fn, opts) — retries on 429 / 5xx with exponential backoff + jitter.
//                              Returns the eventual success or the last failure.
//
//   2. CircuitBreaker per-endpoint — opens after N consecutive failures, blocks
//                                     calls for cool-down, then half-open probes.
//                                     Prevents 1K users hammering a broken provider.
//
//   3. checkDailyBudget(userKey, costEstimate) — enforces per-user daily $ cap on
//                                                paid API spend (FAL, ElevenLabs).
//                                                Counts cents in Prisma `daily_spend`.
//
// Used together at the gateway entry:
//   if (!await checkDailyBudget(userKey, 0.02)) throw new Error("budget_exceeded");
//   const result = await breaker.exec(() => withBackoff(() => fetch(...)));
//
// FAL gateway wraps its three entry points (falGenerateImage, falGenerateVideo,
// generateSpeechGemini) with this. Other gateways can adopt the same pattern.

import { prisma } from "@/lib/prisma";

// ──────────────────────────────────────────────────────────────────────────
// 1. Exponential backoff with jitter
// ──────────────────────────────────────────────────────────────────────────

export interface BackoffOptions {
  maxRetries?: number;       // default 4
  baseMs?: number;           // default 500
  maxMs?: number;            // default 8000
  retryOn?: (status?: number, error?: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, lastError: unknown) => void;
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: BackoffOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 4;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;
  const retryOn = opts.retryOn ?? ((status, err) => {
    if (status === 429 || (status && status >= 500 && status < 600)) return true;
    const code = (err as { code?: string })?.code;
    if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") return true;
    return false;
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number }; status?: number }).response?.status ?? (err as { status?: number }).status;
      if (attempt === maxRetries || !retryOn(status, err)) throw err;
      const delayMs = Math.min(maxMs, baseMs * Math.pow(2, attempt)) + Math.random() * 200;
      if (opts.onRetry) opts.onRetry(attempt + 1, delayMs, err);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Circuit breaker
// ──────────────────────────────────────────────────────────────────────────

type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt = 0;
  constructor(
    private name: string,
    private failureThreshold = 5,
    private cooldownMs = 30_000,
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt < this.cooldownMs) {
        throw new Error(`circuit_open:${this.name}`);
      }
      this.state = "half-open";
    }
    try {
      const out = await fn();
      // On success in half-open, close. In closed, reset failure count.
      this.failures = 0;
      this.state = "closed";
      return out;
    } catch (err) {
      this.failures++;
      if (this.failures >= this.failureThreshold) {
        this.state = "open";
        this.openedAt = Date.now();
        console.error(`[circuit:${this.name}] OPEN after ${this.failures} failures, cooldown ${this.cooldownMs}ms`);
      }
      throw err;
    }
  }

  getState() { return { state: this.state, failures: this.failures }; }
}

// Singleton breakers per gateway
export const falBreaker = new CircuitBreaker("fal", 5, 30_000);
export const elevenLabsBreaker = new CircuitBreaker("elevenlabs", 5, 30_000);
export const klingBreaker = new CircuitBreaker("kling", 5, 30_000);

// ──────────────────────────────────────────────────────────────────────────
// 3. Per-user daily budget cap
// ──────────────────────────────────────────────────────────────────────────

const DEFAULT_DAILY_CAP_CENTS = parseInt(process.env.DAILY_USER_BUDGET_CENTS ?? "200"); // $2.00 default
const ADMIN_DAILY_CAP_CENTS = parseInt(process.env.ADMIN_DAILY_BUDGET_CENTS ?? "10000"); // $100 admin

export async function checkDailyBudget(
  userKey: string,
  costEstimateUsd: number,
  opts: { isAdmin?: boolean; gateway?: string } = {},
): Promise<{ allowed: boolean; spentCents: number; capCents: number; reason?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const capCents = opts.isAdmin ? ADMIN_DAILY_CAP_CENTS : DEFAULT_DAILY_CAP_CENTS;
  const costCents = Math.ceil(costEstimateUsd * 100);

  try {
    // Use a transaction so two concurrent calls don't both pass when at the edge
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.dailySpend.findUnique({
        where: { userKey_day: { userKey, day: today } },
      });
      const currentSpent = existing?.cents ?? 0;
      if (currentSpent + costCents > capCents) {
        return { allowed: false, spentCents: currentSpent, capCents };
      }
      // Reserve the budget by upserting BEFORE the actual API call.
      await tx.dailySpend.upsert({
        where: { userKey_day: { userKey, day: today } },
        update: { cents: { increment: costCents } },
        create: { userKey, day: today, cents: costCents },
      });
      return { allowed: true, spentCents: currentSpent + costCents, capCents };
    });
    return result;
  } catch (err) {
    // Fail OPEN on DB error so a Postgres blip doesn't take down all paid APIs.
    // The doctrine prefers occasional over-spend to total outage.
    console.error("[rate-limit] daily budget check failed, allowing:", err instanceof Error ? err.message : String(err));
    return { allowed: true, spentCents: 0, capCents, reason: "db_error_fail_open" };
  }
}

export async function refundDailyBudget(userKey: string, costEstimateUsd: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const costCents = Math.ceil(costEstimateUsd * 100);
  try {
    await prisma.dailySpend.update({
      where: { userKey_day: { userKey, day: today } },
      data: { cents: { decrement: costCents } },
    });
  } catch { /* nothing to refund or row gone */ }
}
