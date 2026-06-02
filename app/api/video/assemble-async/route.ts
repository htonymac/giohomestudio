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
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

function jobStatusPath(jobId: string): string {
  return path.join(env.storagePath, "jobs", "assemble", `${jobId}.json`);
}

function writeStatus(jobId: string, data: Record<string, unknown>): void {
  const p = jobStatusPath(jobId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ jobId, ...data, updatedAt: Date.now() }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.scenes?.length) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const jobId = randomUUID();
    writeStatus(jobId, { status: "running", startedAt: Date.now() });

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
