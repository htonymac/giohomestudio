// POST /api/video/assemble-async — fire-and-forget wrapper around /api/video/assemble
// Returns { jobId } immediately. Background runs the real assemble against
// localhost:3200 (NOT through Cloudflare so the 100s edge timeout doesn't apply)
// and writes the final outcome to storage/jobs/assemble/<jobId>.json.
//
// Client polls /api/video/job-status?jobId=<id> for { status, outputUrl?, error? }.
//
// Henry 2026-06-01: CF Tunnel + free-tier edge timeout = 100s. The real assemble
// for 7 scenes + auto-narration + auto-expand takes ~140s. CF kills the connection
// long before ffmpeg finishes. This wrapper sidesteps that.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { DEAD_WORKER_THRESHOLD_MS, IDEM_KEY_TTL_MS } from "@/config/assemble-jobs";
import { randomUUID, createHash } from "crypto";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

function jobStatusPath(jobId: string): string {
  return path.join(env.storagePath, "jobs", "assemble", `${jobId}.json`);
}

function idemKeysDir(): string {
  return path.join(env.storagePath, "jobs", "assemble", "keys");
}

// Maps an idempotency key -> the jobId currently rendering that exact payload.
function idemKeyPath(idemKey: string): string {
  return path.join(idemKeysDir(), `${idemKey}.json`);
}

function writeStatus(jobId: string, data: Record<string, unknown>): void {
  const p = jobStatusPath(jobId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ jobId, ...data, updatedAt: Date.now() }));
}

// Deterministic JSON: recursively sort object keys so two semantically identical
// payloads that differ only in key ORDER still produce the same string (and thus
// the same idempotency key). Arrays keep their order (order is meaningful for
// scenes). Primitives pass through.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// Henry 2026-06-18 (TODO #1): idempotency key for assemble — stops duplicate
// render pile-up. The render output is a pure function of the request body
// (no timestamps/volatile fields in the payload the children planner sends),
// so an identical body = an identical render. We key on projectId + a sha256
// of the canonicalised full body: identical retries collide (deduped), any real
// change to scenes/music/subtitles/etc. produces a different hash (new render).
// Hashing the whole body means the only way two requests dedupe is if they are
// byte-identical after canonicalisation — collision risk is the full sha256
// (cryptographically negligible), never a semantic false-positive.
function computeIdemKey(body: Record<string, unknown>): string {
  const projectId = typeof body?.projectId === "string" ? body.projectId : "noproj";
  const raw = `${projectId}:${stableStringify(body)}`;
  return createHash("sha256").update(raw).digest("hex"); // full 64-char hex, filename-safe
}

// Returns the existing jobId IFF a job for this key is still running and fresh.
// Anything else (no key, done, error, or a stale/dead worker) returns null so
// the caller starts a new render.
function findLiveJobForKey(idemKey: string): string | null {
  try {
    const keyFile = idemKeyPath(idemKey);
    if (!fs.existsSync(keyFile)) return null;
    const { jobId } = JSON.parse(fs.readFileSync(keyFile, "utf-8")) as { jobId?: string };
    if (!jobId) return null;
    const statusFile = jobStatusPath(jobId);
    if (!fs.existsSync(statusFile)) return null;
    const status = JSON.parse(fs.readFileSync(statusFile, "utf-8")) as {
      status?: string;
      updatedAt?: number;
    };
    if (status?.status !== "running") return null;
    if (typeof status.updatedAt !== "number") return null;
    if (Date.now() - status.updatedAt > DEAD_WORKER_THRESHOLD_MS) return null; // worker dead → re-render
    return jobId;
  } catch {
    return null; // any read/parse failure → fail open, start a fresh render
  }
}

// Best-effort prune of key files older than the TTL so keys/ can't grow without
// bound. Stale key files never hurt correctness (findLiveJobForKey ignores
// non-running jobs) — this is purely housekeeping. Cheap at GHS's volume.
function pruneExpiredIdemKeys(): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(idemKeysDir());
  } catch {
    return; // dir may not exist yet — nothing to prune
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const full = path.join(idemKeysDir(), entry);
    try {
      const { createdAt } = JSON.parse(fs.readFileSync(full, "utf-8")) as { createdAt?: number };
      if (typeof createdAt === "number" && now - createdAt > IDEM_KEY_TTL_MS) {
        fs.unlinkSync(full);
      }
    } catch {
      continue; // read/parse/delete failure on one file → skip it, keep going
    }
  }
}

function writeIdemKey(idemKey: string, jobId: string): void {
  try {
    const p = idemKeyPath(idemKey);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ idemKey, jobId, createdAt: Date.now() }));
    pruneExpiredIdemKeys(); // housekeeping after the write that matters
  } catch (err) {
    // Non-fatal: without the key file we just lose dedup for this job, never correctness.
    console.error("[assemble-async] writeIdemKey failed:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.scenes?.length) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    // Henry 2026-06-18 (TODO #1): idempotency gate. If the exact same payload is
    // already rendering (running + fresh worker), return that jobId instead of
    // spawning a second ffmpeg job. Fixes the "Henry retries Assemble while one
    // is still running → load avg 17 / pile-up" problem at the source. A
    // completed/failed/dead prior job does NOT block a fresh re-render.
    const idemKey = computeIdemKey(body);
    const existingJobId = findLiveJobForKey(idemKey);
    if (existingJobId) {
      console.log(`[assemble-async] dedup — payload already rendering as job ${existingJobId}`);
      return NextResponse.json({ jobId: existingJobId, status: "running", deduped: true });
    }

    const jobId = randomUUID();
    writeStatus(jobId, { status: "running", startedAt: Date.now() });
    writeIdemKey(idemKey, jobId);

    // Henry 2026-06-01: prior implementation used fire-and-forget async IIFE.
    // Next.js was discarding the promise after the response returned, so the
    // fetch never completed and jobs stayed "running" forever. Now we spawn
    // a DETACHED child process running scripts/assemble_job_worker.mjs. The
    // worker is fully independent of the request lifecycle and updates the
    // status file when done.
    const bodyDir = path.join(env.storagePath, "jobs", "assemble", "bodies");
    fs.mkdirSync(bodyDir, { recursive: true });
    const bodyFile = path.join(bodyDir, `${jobId}.json`);
    fs.writeFileSync(bodyFile, JSON.stringify(body));

    const workerScript = path.join(process.cwd(), "scripts", "assemble_job_worker.mjs");
    const child = spawn(process.execPath, [workerScript, jobId, bodyFile], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        INTERNAL_LOCALHOST_URL: process.env.INTERNAL_LOCALHOST_URL || "http://localhost:3200",
      },
    });
    child.unref(); // let the parent Node exit independently of the worker

    return NextResponse.json({ jobId, status: "running" });
  } catch (err) {
    console.error("[assemble-async] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start job" },
      { status: 500 }
    );
  }
}
