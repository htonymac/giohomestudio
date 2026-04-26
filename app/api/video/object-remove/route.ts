// POST /api/video/object-remove — Object removal from video via fal.ai
// User describes the object to remove; fal.ai inpaints/erases it.
// Returns { outputUrl, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const prompt = (form.get("prompt") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    if (!prompt.trim()) return NextResponse.json({ error: "Describe what to remove" }, { status: 400 });

    const FAL_KEY = process.env.FAL_API_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: "FAL_API_KEY not configured." }, { status: 503 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "video/mp4";
    const base64 = buf.toString("base64");

    const outDir = path.join(env.storagePath, "processed", "object-removed");
    fs.mkdirSync(outDir, { recursive: true });

    // ── fal.ai object removal / inpainting ──
    const falRes = await fetch("https://queue.fal.run/fal-ai/object-eraser", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: `data:${mime};base64,${base64}`,
        prompt: prompt.trim(),
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      // Try alternative removal model
      const alt = await fetch("https://queue.fal.run/fal-ai/removal-anything", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: `data:${mime};base64,${base64}`, prompt }),
      });
      if (!alt.ok) {
        return NextResponse.json({ error: `Object removal failed: ${errText.slice(0, 200)}` }, { status: 502 });
      }
      const altData = await alt.json();
      const vidUrl = altData.video?.url ?? altData.output_url;
      if (!vidUrl) return NextResponse.json({ error: "No output from object eraser" }, { status: 502 });
      const vidRes = await fetch(vidUrl);
      const outPath = path.join(outDir, `removed_${Date.now()}.mp4`);
      fs.writeFileSync(outPath, Buffer.from(await vidRes.arrayBuffer()));
      const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
      return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "fal.ai removal-anything" });
    }

    const data = await falRes.json();
    const vidUrl = data.video?.url ?? data.output_url ?? data.url;
    if (!vidUrl) return NextResponse.json({ error: "No output URL from object eraser" }, { status: 502 });

    const vidRes = await fetch(vidUrl);
    const outPath = path.join(outDir, `removed_${Date.now()}.mp4`);
    fs.writeFileSync(outPath, Buffer.from(await vidRes.arrayBuffer()));
    const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
    return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "fal.ai object-eraser" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Object removal failed" }, { status: 500 });
  }
}
