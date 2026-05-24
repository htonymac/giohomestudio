// Token-bucket rate limiter — Wave 3 Phase 4 (2026-05-23).
// In-memory per-process; acceptable for single-instance dev.
// For multi-instance/cluster: replace with Postgres-backed counter (later phase).
//
// Usage:
//   import { rateLimit, RateLimitError } from "@/lib/rate-limit";
//   await rateLimit("sign-get", `${userId}:${ip}`, { perMinute: 100 });

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(public readonly bucket: string, public readonly retryAfterSec: number) {
    super(`Rate limit exceeded for ${bucket}. Retry in ${retryAfterSec}s.`);
    this.name = "RateLimitError";
  }
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();
const REFILL_INTERVAL_MS = 60_000;

// Periodically prune old buckets so map doesn't grow unbounded.
let pruneTimer: NodeJS.Timeout | null = null;
function ensurePrune() {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => {
    const cutoff = Date.now() - 10 * 60_000; // 10 min idle
    for (const [k, v] of buckets) {
      if (v.lastRefillMs < cutoff) buckets.delete(k);
    }
  }, 60_000);
  // Unref so it doesn't keep the process alive
  if (pruneTimer.unref) pruneTimer.unref();
}

export interface RateLimitOpts {
  perMinute: number;
  /** Override the bucket key (default: `${bucketName}:${identity}`). */
  bucketKey?: string;
}

/**
 * Token-bucket: each identity has `perMinute` tokens, refills proportionally over 60s.
 * Throws RateLimitError if no token available.
 */
export function rateLimit(bucketName: string, identity: string, opts: RateLimitOpts): void {
  ensurePrune();
  const key = opts.bucketKey ?? `${bucketName}:${identity}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.perMinute, lastRefillMs: now };
    buckets.set(key, b);
  }
  // Refill: tokens recharge at perMinute/60s rate
  const elapsedMs = now - b.lastRefillMs;
  const refilled = (elapsedMs / REFILL_INTERVAL_MS) * opts.perMinute;
  b.tokens = Math.min(opts.perMinute, b.tokens + refilled);
  b.lastRefillMs = now;

  if (b.tokens < 1) {
    // Time until 1 token refills
    const msPerToken = REFILL_INTERVAL_MS / opts.perMinute;
    const retryAfterSec = Math.ceil(msPerToken / 1000);
    throw new RateLimitError(bucketName, retryAfterSec);
  }
  b.tokens -= 1;
}

/** For tests + admin debug. Returns current state without consuming a token. */
export function _peekBucket(bucketName: string, identity: string): { tokens: number; lastRefillMs: number } | null {
  const key = `${bucketName}:${identity}`;
  const b = buckets.get(key);
  return b ? { ...b } : null;
}

/** Default identity = userId if present, else IP. Falls back to "anonymous". */
export function identityFromRequest(req: { headers: Headers }, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "anonymous";
  return `ip:${ip}`;
}
