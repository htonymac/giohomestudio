// Shared constants for the async assemble job system (assemble-async + job-status).
// Centralised here so the "worker is dead" threshold can never drift between the
// route that DETECTS a dead worker (/api/video/job-status) and the route that
// decides a job is still live for idempotency (/api/video/assemble-async).

// A running job whose status file hasn't been touched within this window is
// treated as dead. The worker heartbeats its status file every ~8s, so 3 min
// stale = certainly dead (server restart / OOM / kill).
export const DEAD_WORKER_THRESHOLD_MS = 180_000;

// Idempotency key files (keys/<key>.json) older than this are pruned best-effort
// on write to keep the directory from growing without bound.
export const IDEM_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
