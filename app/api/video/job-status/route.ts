// GET /api/video/job-status?jobId=<id> — return current background-job status
// Used by clients polling for an /api/video/assemble-async job.
//
// Henry 2026-06-01: pairs with assemble-async to bypass the Cloudflare Tunnel
// 100-second edge timeout for long-running ffmpeg assemblies.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { DEAD_WORKER_THRESHOLD_MS } from "@/config/assemble-jobs";
import * as path from "path";
import * as fs from "fs";

export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
    // Defensive: reject anything that's not a plain UUID-ish token.
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(jobId)) {
      return NextResponse.json({ error: "invalid jobId" }, { status: 400 });
    }

    const p = path.join(env.storagePath, "jobs", "assemble", `${jobId}.json`);
    if (!fs.existsSync(p)) {
      return NextResponse.json({ status: "unknown", jobId }, { status: 404 });
    }
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(raw);
      // Henry 2026-06-01: dead-worker detector. If status is "running" but the
      // file hasn't been touched in >3 min, the worker is silently dead (most
      // commonly because systemd killed it during a Next.js auto-restart). Tell
      // the client clearly instead of letting the UI sit at 95% forever.
      // The worker writes a status update at least every ~12s (retry loop), so
      // 3 min stale = certainly dead.
      if (data?.status === "running" && typeof data.updatedAt === "number") {
        const ageMs = Date.now() - data.updatedAt;
        if (ageMs > DEAD_WORKER_THRESHOLD_MS) {
          return NextResponse.json({
            ...data,
            status: "error",
            error: `Worker silently died ${Math.round(ageMs / 1000)}s ago — server likely restarted mid-assemble. Click Assemble again.`,
            staleDetected: true,
          });
        }
      }
      return NextResponse.json(data);
    } catch (readErr) {
      return NextResponse.json(
        { error: `Status read failed: ${readErr instanceof Error ? readErr.message : "unknown"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[job-status] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "status failed" },
      { status: 500 }
    );
  }
}
