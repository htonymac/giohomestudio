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

    // CRITICAL: this MUST be a localhost call, not the public URL. Using
    // NEXT_PUBLIC_APP_URL routes the request back through Cloudflare → CF Tunnel →
    // localhost:3200, which hits CF's 100-second edge timeout (the very thing we
    // are trying to escape). The first cut of this route used the env var and
    // produced jobs stuck "running" forever. Force localhost.
    const base = process.env.INTERNAL_LOCALHOST_URL || "http://localhost:3200";

    // Fire-and-forget background work. Node keeps the process alive while
    // the promise is pending, so the fetch completes even after this handler
    // returns. We catch ALL errors and persist them to the status file.
    (async () => {
      const tStart = Date.now();
      try {
        const upstream = await fetch(`${base}/api/video/assemble`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          // Generous timeout — 10 minutes covers very large assemblies.
          signal: AbortSignal.timeout(600000),
        });
        const tookMs = Date.now() - tStart;
        if (!upstream.ok) {
          const text = await upstream.text();
          writeStatus(jobId, {
            status: "error",
            error: `HTTP ${upstream.status}: ${text.slice(0, 200)}`,
            tookMs,
          });
          return;
        }
        const data = await upstream.json() as { outputUrl?: string; error?: string; thumbnailUrl?: string };
        if (data.error) {
          writeStatus(jobId, { status: "error", error: data.error, tookMs });
          return;
        }
        writeStatus(jobId, {
          status: "done",
          outputUrl: data.outputUrl,
          thumbnailUrl: data.thumbnailUrl,
          tookMs,
        });
      } catch (err) {
        writeStatus(jobId, {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          tookMs: Date.now() - tStart,
        });
      }
    })();

    return NextResponse.json({ jobId, status: "running" });
  } catch (err) {
    console.error("[assemble-async] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start job" },
      { status: 500 }
    );
  }
}
