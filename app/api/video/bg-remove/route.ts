// POST /api/video/bg-remove — Video background removal via fal.ai (~$0.10/sec)
// Phase 2. Uses fal.ai video background removal (VEED-powered pipeline).
// Returns { outputUrl, provider, durationSec } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const newBg = (form.get("newBackground") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "No video file provided" }, { status: 400 });

    const FAL_KEY = process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: "FAL_API_KEY not configured. Set it in .env to enable video background removal." }, { status: 503 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "video/mp4";
    const base64 = buf.toString("base64");

    const outDir = path.join(env.storagePath, "processed", "video-bg-removed");
    fs.mkdirSync(outDir, { recursive: true });

    // ── fal.ai video background removal (BiRefNet video / VEED pipeline) ──
    // Migrated to providers/fal adapter (Henry 2026-05-30 task #27).
    const { falBgRemove } = await import("@/lib/providers/fal");
    const primary = await falBgRemove("birefnet-video", {
      video_url: `data:${mime};base64,${base64}`,
      ...(newBg ? { background_color: newBg } as unknown as Record<string, unknown> : {}),
    } as { video_url: string });

    if (!primary.ok) {
      const fall = await falBgRemove("video-bg-remove", { video_url: `data:${mime};base64,${base64}` });
      if (!fall.ok) {
        return NextResponse.json({ error: `fal.ai video bg removal failed: ${primary.error.slice(0, 200)}` }, { status: 502 });
      }
      const data = fall.data as { video?: { url?: string }; output_url?: string };
      const videoUrl = data.video?.url ?? data.output_url;
      if (!videoUrl) return NextResponse.json({ error: "No output URL from fal.ai" }, { status: 502 });
      const vidRes = await fetch(videoUrl);
      const outPath = path.join(outDir, `vid_nobg_${Date.now()}.mp4`);
      fs.writeFileSync(outPath, Buffer.from(await vidRes.arrayBuffer()));
      const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
      return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "fal.ai video bg removal" });
    }

    const data = primary.data as { video?: { url?: string }; output_url?: string; url?: string };
    const videoUrl = data.video?.url ?? data.output_url ?? data.url;
    if (!videoUrl) return NextResponse.json({ error: "No output URL from fal.ai BiRefNet video" }, { status: 502 });

    const vidRes = await fetch(videoUrl);
    const outPath = path.join(outDir, `vid_nobg_${Date.now()}.mp4`);
    fs.writeFileSync(outPath, Buffer.from(await vidRes.arrayBuffer()));
    const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
    return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "BiRefNet Video (fal.ai / VEED pipeline)" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Video background removal failed" }, { status: 500 });
  }
}
