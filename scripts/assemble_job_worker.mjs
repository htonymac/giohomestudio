#!/usr/bin/env node
// scripts/assemble_job_worker.mjs — detached worker for assemble-async.
// Runs OUTSIDE the Next.js request lifecycle so the work survives the parent
// response. Invoked with: node scripts/assemble_job_worker.mjs <jobId> <bodyFile>
// where <bodyFile> contains the JSON payload to POST to /api/video/assemble.
//
// Reads JSON body, POSTs to localhost:3200/api/video/assemble, writes outcome
// to storage/jobs/assemble/<jobId>.json.
//
// Henry 2026-06-01: Next.js fire-and-forget promises were being discarded
// after response — job status stayed "running" forever. Detached worker fixes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [, , jobId, bodyFile] = process.argv;
if (!jobId || !bodyFile) {
  console.error("Usage: assemble_job_worker.mjs <jobId> <bodyFile>");
  process.exit(2);
}

// Henry 2026-06-03 (Sonnet A audit Fix #8): worker now respects STORAGE_PATH
// env var (same convention as env.storagePath in src/config/env.ts). Was
// hardcoded to ../storage relative to scripts/ — only worked because the
// route and the worker happened to resolve to the same path on Windows
// and on the current Linux setup. If STORAGE_PATH is set to a different
// mount (e.g. for an external volume), the worker now follows.
const STORAGE = process.env.STORAGE_PATH || path.resolve(__dirname, "..", "storage");
const statusPath = path.join(STORAGE, "jobs", "assemble", `${jobId}.json`);

function writeStatus(data) {
  try {
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({ jobId, ...data, updatedAt: Date.now() }));
  } catch (err) {
    console.error("[worker] writeStatus failed:", err);
  }
}

async function main() {
  const tStart = Date.now();
  let body;
  try {
    body = JSON.parse(fs.readFileSync(bodyFile, "utf-8"));
  } catch (err) {
    writeStatus({ status: "error", error: `Failed to read body: ${err.message}`, tookMs: Date.now() - tStart });
    return;
  }

  // Use 127.0.0.1 explicitly to avoid any DNS resolution edge cases for "localhost".
  const base = process.env.INTERNAL_LOCALHOST_URL || "http://127.0.0.1:3200";

  // Henry 2026-06-01: SMART PROBE instead of blind retry wait.
  // Quick probe-and-retry every 1 second up to 30 seconds, only while server
  // is actually down. Once it's up, we proceed immediately. Old version had
  // fixed 2/4/8/16/30s waits = up to 60s penalty even when server was already
  // back. New version costs ~1s in the common case.
  const PROBE_MAX_MS = 30000;
  const probeStart = Date.now();
  while (Date.now() - probeStart < PROBE_MAX_MS) {
    try {
      const probe = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (probe.ok || probe.status === 404) break; // 404 = route doesn't exist but server is UP
    } catch {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }
    break;
  }

  // Legacy retry array — only used for ACTUAL connection failures during the
  // assemble call itself, not for boot waits (probe handles those now).
  const RETRY_DELAYS_MS = [2000, 4000, 8000];
  let lastErr = null;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    if (attempt > 0) {
      writeStatus({ status: "running", note: `retry ${attempt}/${RETRY_DELAYS_MS.length} (last: ${lastErr})` });
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    // Henry 2026-06-01: heartbeat. Update status file timestamp every 8s while
    // the fetch is in flight. Pairs with the dead-worker detector in
    // /api/video/job-status which flags status as error when updatedAt > 3 min
    // stale. With heartbeat, that detector fires within ~3 min of a TRUE death
    // (server restart, OOM, etc) instead of waiting for the worker to write
    // some other status line.
    const heartbeat = setInterval(() => {
      try {
        const elapsed = Math.round((Date.now() - tStart) / 1000);
        writeStatus({ status: "running", note: `assembling (${elapsed}s elapsed)` });
      } catch { /* ignore */ }
    }, 8000);
    try {
      const res = await fetch(`${base}/api/video/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(900000), // 15 min cap
      });
      const tookMs = Date.now() - tStart;
      clearInterval(heartbeat);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        writeStatus({
          status: "error",
          error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
          tookMs,
        });
        return;
      }
      const data = await res.json();
      if (data.error) {
        writeStatus({ status: "error", error: data.error, tookMs });
        return;
      }
      writeStatus({
        status: "done",
        outputUrl: data.outputUrl,
        thumbnailUrl: data.thumbnailUrl,
        tookMs,
        retries: attempt,
      });
      return;
    } catch (err) {
      clearInterval(heartbeat);
      lastErr = err?.message || String(err);
      // Only retry on connection failures, not on real errors
      const retryable = /fetch failed|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|socket hang up/i.test(lastErr);
      if (!retryable) break;
    }
  }
  // All retries exhausted
  writeStatus({
    status: "error",
    error: `${lastErr || "unknown"} (after ${RETRY_DELAYS_MS.length + 1} attempts over ~60s — server may have been restarting, please retry)`,
    tookMs: Date.now() - tStart,
  });

  // Cleanup
  try {
    fs.unlinkSync(bodyFile);
  } catch { /* ignore */ }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
