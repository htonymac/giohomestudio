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

const STORAGE = path.resolve(__dirname, "..", "storage");
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

  // Retry-with-backoff. The worker can race with `systemctl restart ghs.service`
  // — if it spawns while next-server is restarting (~1-3 seconds), the first
  // fetch hits ECONNREFUSED. Up to 5 attempts with 2/4/8/16/30 second waits
  // covers ~60 seconds of next-server boot time.
  const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000];
  let lastErr = null;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    if (attempt > 0) {
      writeStatus({ status: "running", note: `retry ${attempt}/${RETRY_DELAYS_MS.length} (last: ${lastErr})` });
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      const res = await fetch(`${base}/api/video/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(900000), // 15 min cap
      });
      const tookMs = Date.now() - tStart;
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
