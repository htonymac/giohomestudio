// POST /api/ad-editor/bg-remove — remove background from uploaded image
// Provider-agnostic: tries fal.ai, then Segmind, then returns error
// Returns { outputPath, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
  const outDir = path.join(env.storagePath, "ad-editor", "bg-removed");
  fs.mkdirSync(outDir, { recursive: true });

  const inputPath = path.join(outDir, `input_${Date.now()}${ext}`);
  fs.writeFileSync(inputPath, buf);

  const base64 = buf.toString("base64");
  const mime = file.type || "image/jpeg";

  // Try fal.ai
  const FAL_KEY = process.env.FAL_API_KEY;
  if (FAL_KEY) {
    try {
      const res = await fetch("https://queue.fal.run/fal-ai/birefnet", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: `data:${mime};base64,${base64}` }),
      });
      if (res.ok) {
        const data = await res.json();
        const imgUrl = data.image?.url;
        if (imgUrl) {
          const imgRes = await fetch(imgUrl);
          const outPath = path.join(outDir, `nobg_${Date.now()}.png`);
          fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({ outputUrl: `/api/media/${relPath}`, outputPath: outPath, provider: "fal_ai" });
        }
      }
    } catch (e) { console.warn("[bg-remove] fal.ai failed:", e); }
  }

  // Try Segmind
  const SEG_KEY = process.env.SEGMIND_API_KEY;
  if (SEG_KEY) {
    try {
      const res = await fetch("https://api.segmind.com/v1/bg-removal", {
        method: "POST",
        headers: { "x-api-key": SEG_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (res.ok) {
        const outPath = path.join(outDir, `nobg_${Date.now()}.png`);
        fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        return NextResponse.json({ outputUrl: `/api/media/${relPath}`, outputPath: outPath, provider: "segmind" });
      }
    } catch (e) { console.warn("[bg-remove] Segmind failed:", e); }
  }

  // Try remove.bg (free tier)
  const RMBG_KEY = process.env.REMOVE_BG_API_KEY;
  if (RMBG_KEY) {
    try {
      const formData = new FormData();
      formData.append("image_file", new Blob([buf], { type: mime }), `image${ext}`);
      formData.append("size", "auto");
      const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": RMBG_KEY },
        body: formData,
      });
      if (res.ok) {
        const outPath = path.join(outDir, `nobg_${Date.now()}.png`);
        fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        return NextResponse.json({ outputUrl: `/api/media/${relPath}`, outputPath: outPath, provider: "remove_bg" });
      }
    } catch (e) { console.warn("[bg-remove] remove.bg failed:", e); }
  }

  return NextResponse.json({ error: "No background removal provider available. Set FAL_API_KEY, SEGMIND_API_KEY, or REMOVE_BG_API_KEY in .env" }, { status: 503 });
}
