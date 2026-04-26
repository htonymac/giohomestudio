// POST /api/image/enhance
// AI image enhancement: better lighting, sharper detail, upscale, background cleanup
// Providers: fal.ai (clarity-upscaler) → Segmind → fallback
// Accepts: FormData with "file" (image) and optional "mode" (enhance|upscale|cleanup)
// Returns: { outputUrl, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const mode = (form.get("mode") as string) ?? "enhance";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const mime = file.type || "image/jpeg";
  const outDir = path.join(env.storagePath, "image", "enhanced");
  fs.mkdirSync(outDir, { recursive: true });

  const FAL_KEY = process.env.FAL_API_KEY;
  const SEGMIND_KEY = process.env.SEGMIND_API_KEY;

  // ── fal.ai clarity upscaler ──
  if (FAL_KEY) {
    try {
      const endpoint = mode === "upscale"
        ? "https://queue.fal.run/fal-ai/clarity-upscaler"
        : "https://queue.fal.run/fal-ai/clarity-upscaler";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: `data:${mime};base64,${base64}`,
          prompt: mode === "cleanup"
            ? "clean, sharp, professional photo, remove noise, fix lighting"
            : "enhance, sharpen, improve lighting, professional quality, high detail",
          scale: mode === "upscale" ? 2 : 1,
          creativity: 0.2,
          resemblance: 0.9,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const imgUrl = data.image?.url;
        if (imgUrl) {
          const imgRes = await fetch(imgUrl);
          const outPath = path.join(outDir, `enhanced_${Date.now()}.png`);
          fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({
            outputUrl: `/api/media/${relPath}`,
            provider: "fal_ai",
            mode,
          });
        }
      }
    } catch (e) { console.warn("[enhance] fal.ai failed:", e); }
  }

  // ── Segmind SDXL img2img with enhance prompt ──
  if (SEGMIND_KEY) {
    try {
      const res = await fetch("https://api.segmind.com/v1/sdxl1.0-img2img", {
        method: "POST",
        headers: { "x-api-key": SEGMIND_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          prompt: "enhance, sharpen, improve lighting, professional quality, high detail, clean",
          negative_prompt: "blurry, noisy, low quality, distorted, watermark",
          strength: 0.25,
          samples: 1,
        }),
      });

      if (res.ok) {
        const outPath = path.join(outDir, `enhanced_${Date.now()}.png`);
        fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        return NextResponse.json({
          outputUrl: `/api/media/${relPath}`,
          provider: "segmind",
          mode,
        });
      }
    } catch (e) { console.warn("[enhance] Segmind failed:", e); }
  }

  return NextResponse.json(
    { error: "No image enhancement provider available. Set FAL_API_KEY or SEGMIND_API_KEY." },
    { status: 503 }
  );
}
