/**
 * GioHomeStudio — Provider Health Module
 * Phase E.1 of the Segregation Plan (2026-05-08)
 *
 * Tracks model health at runtime. Cache is in-memory (restart-volatile).
 * DB persistence is deferred to a later phase.
 *
 * Usage pattern in gateway routes:
 *   import { markBroken, markHealthy, getModelStatus, pickHealthyAlternative } from "@/lib/provider-health";
 *
 *   try {
 *     const result = await generateVideo(model.endpoint_id, ...);
 *   } catch (err) {
 *     markBroken(model.id, err.message);
 *     const alt = pickHealthyAlternative(model.family ?? "unknown", model.id);
 *     if (alt) { ... retry with alt ... }
 *   }
 */

import { ModelEntry, getAllModels } from "@/lib/generation/model-registry";

// ── Internal cache types ─────────────────────────────────────────────────────

interface HealthCacheEntry {
  /** "active" = no known failures. "broken" = recent 404/422/failure. */
  status: "active" | "broken";
  /** ISO timestamp of the last status change. */
  lastChecked: string;
  /** Human-readable reason the model was marked broken, for ops grepping logs. */
  reason?: string;
}

/**
 * In-memory map: modelId → HealthCacheEntry.
 * Restart-volatile. A model not in this map is assumed healthy ("active").
 */
const healthCache = new Map<string, HealthCacheEntry>();

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Mark a model as broken due to a provider error (404, 422, timeout, "model not found", etc.).
 *
 * Call this inside a catch block after a generation gateway throws.
 * The status is cached in memory and returned by getModelStatus() and
 * pickHealthyAlternative() so subsequent requests avoid the broken model.
 *
 * @param modelId - The ModelEntry.id (e.g. "fal_wan_lite")
 * @param reason  - The error message or error body from the provider, for log grepping.
 */
export function markBroken(modelId: string, reason: string): void {
  const entry: HealthCacheEntry = {
    status: "broken",
    lastChecked: new Date().toISOString(),
    reason,
  };
  healthCache.set(modelId, entry);
  console.warn(`[provider-health] BROKEN: ${modelId} — ${reason}`);
}

/**
 * Clear a broken mark for a model, restoring it to "active".
 *
 * Call this when a health probe succeeds (Phase E.2 background cron will do this),
 * or when an operator manually clears a false-positive via admin UI.
 *
 * @param modelId - The ModelEntry.id to restore.
 */
export function markHealthy(modelId: string): void {
  const existing = healthCache.get(modelId);
  if (existing?.status === "broken") {
    console.log(`[provider-health] RECOVERED: ${modelId}`);
  }
  healthCache.set(modelId, {
    status: "active",
    lastChecked: new Date().toISOString(),
  });
}

/**
 * Get the current health status for a model.
 *
 * Priority order:
 * 1. In-memory cache (runtime failures override registry)
 * 2. Registry `status` field (static metadata set at build time)
 * 3. Default: "active" (assume healthy if no data)
 *
 * @param modelId - The ModelEntry.id to query.
 * @returns "active" | "degraded" | "broken"
 *          "degraded" = registry says deprecated/sunset, but no active runtime failure.
 */
export function getModelStatus(modelId: string): "active" | "degraded" | "broken" {
  // 1. Runtime cache wins
  const cached = healthCache.get(modelId);
  if (cached) {
    return cached.status === "broken" ? "broken" : "active";
  }

  // 2. Registry static status
  const model = getAllModels(false).find((m) => m.id === modelId);
  if (model) {
    if (model.status === "broken") return "broken";
    if (model.status === "deprecated" || model.status === "sunset") return "degraded";
  }

  // 3. Default: assume healthy
  return "active";
}

/**
 * Find the best healthy alternative model in the same family, excluding a specific model.
 *
 * Picks the highest-quality active model in the family that:
 * - Is not the excluded model (usually the one that just failed)
 * - Is not marked broken in the runtime cache
 * - Has `is_active: true` in the registry
 * - Does not have status "deprecated" or "sunset" in the registry (unless nothing else exists)
 *
 * Ranking: prefers models with higher `sort_quality_rank`. Falls back to any active member
 * if no ranked choice is available.
 *
 * @param family    - The family string from ModelEntry.family (e.g. "wan", "kling", "flux")
 * @param excludeId - Optional: the model ID to skip (usually the broken model)
 * @returns The best healthy ModelEntry, or null if no healthy alternative exists.
 */
export function pickHealthyAlternative(
  family: string,
  excludeId?: string
): ModelEntry | null {
  if (!family || family === "unknown") {
    // Can't search by family if unknown — no fallback possible
    return null;
  }

  const candidates = getAllModels(false).filter((m) => {
    // Must be in the same family
    if (m.family !== family) return false;
    // Skip the broken/excluded model itself
    if (excludeId && m.id === excludeId) return false;
    // Must be flagged active in registry
    if (!m.is_active) return false;
    // Skip registry-deprecated/sunset entries
    if (m.status === "deprecated" || m.status === "sunset") return false;
    // Skip runtime-broken models
    if (getModelStatus(m.id) === "broken") return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Sort by quality rank descending, pick the best
  candidates.sort((a, b) => (b.sort_quality_rank ?? 0) - (a.sort_quality_rank ?? 0));
  const chosen = candidates[0];
  console.log(
    `[provider-health] FALLBACK: ${excludeId ?? "?"} → ${chosen.id} (family=${family})`
  );
  return chosen;
}

/**
 * Read the current health cache snapshot (all entries).
 * Intended for admin UI / debug endpoints in Phase E.2.
 *
 * @returns Array of { modelId, status, lastChecked, reason } objects.
 */
export function getHealthSnapshot(): Array<{
  modelId: string;
  status: "active" | "broken";
  lastChecked: string;
  reason?: string;
}> {
  return Array.from(healthCache.entries()).map(([modelId, entry]) => ({
    modelId,
    status: entry.status,
    lastChecked: entry.lastChecked,
    reason: entry.reason,
  }));
}
