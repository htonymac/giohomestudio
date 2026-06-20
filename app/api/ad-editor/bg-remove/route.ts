// POST /api/ad-editor/bg-remove — remove background from uploaded image
// Provider ladder (default): fal.ai Birefnet → Segmind (Pruna) → remove.bg
// User never sees a "no credit" error — silent fallback.
// Returns { outputUrl, outputPath, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";
import { prisma } from "@/lib/prisma";

async function trackBgRemoveAsset(projectId: string, provider: string, outputUrl: string) {
  try {
    await prisma.adAsset.create({
      data: { projectId, sourceType: "bg_remove", currentUrl: outputUrl, metadata: { provider } },
    });
  } catch (e) { console.warn("[bg-remove] DB tracking failed:", e); }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const projectId = form.get("projectId") as string | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
  const outDir = path.join(env.storagePath, "ad-editor", "bg-removed");
  fs.mkdirSync(outDir, { recursive: true });

  const inputPath = path.join(outDir, `input_${Date.now()}${ext}`);
  fs.writeFileSync(inputPath, buf);

  const base64 = buf.toString("base64");
  const mime = file.type || "image/jpeg";

  // Try LOCAL rembg FIRST — free, no API cost (Henry 2026-06-20). Falls through to paid providers on failure.
  try {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const rembgOut = path.join(outDir, `nobg_local_${Date.now()}.png`);
    const PY = "import sys; from rembg import remove; from PIL import Image; res = remove(Image.open(sys.argv[1])); res.save(sys.argv[2])";
    await promisify(execFile)("python3", ["-c", PY, inputPath, rembgOut], { timeout: 180000 });
    if (fs.existsSync(rembgOut) && fs.statSync(rembgOut).size > 100) {
      const outBuf = fs.readFileSync(rembgOut);
      const outPath = path.join(outDir, `nobg_${Date.now()}.png`);
      await writeMedia(outPath, outBuf);
      const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
      const outputUrl = `/api/media/${relPath}`;
      if (projectId) trackBgRemoveAsset(projectId, "rembg_local", outputUrl);
      try { fs.unlinkSync(rembgOut); } catch { /* temp */ }
      return NextResponse.json({ outputUrl, outputPath: outPath, provider: "rembg_local" });
    }
  } catch (e) { console.warn("[bg-remove] local rembg failed:", e); }

  // Try fal.ai — migrated to providers/fal adapter (Henry 2026-05-30 task #27)
  const FAL_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY;
  if (FAL_KEY) {
    try {
      const { falBgRemove } = await import("@/lib/providers/fal");
      const r = await falBgRemove("birefnet", { image_url: `data:${mime};base64,${base64}` });
      if (r.ok) {
        const imgUrl = r.data.image?.url;
        if (imgUrl) {
          const imgRes = await fetch(imgUrl);
          const outPath = path.join(outDir, `nobg_${Date.now()}.png`);
          await writeMedia(outPath, Buffer.from(await imgRes.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          const outputUrl = `/api/media/${relPath}`;
          if (projectId) trackBgRemoveAsset(projectId, "fal_ai", outputUrl);
          return NextResponse.json({ outputUrl, outputPath: outPath, provider: "fal_ai" });
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
        await writeMedia(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        const segOutputUrl = `/api/media/${relPath}`;
        if (projectId) trackBgRemoveAsset(projectId, "segmind", segOutputUrl);
        return NextResponse.json({ outputUrl: segOutputUrl, outputPath: outPath, provider: "segmind" });
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
        await writeMedia(outPath, Buffer.from(await res.arrayBuffer()));
        const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        const rmbgOutputUrl = `/api/media/${relPath}`;
        if (projectId) trackBgRemoveAsset(projectId, "remove_bg", rmbgOutputUrl);
        return NextResponse.json({ outputUrl: rmbgOutputUrl, outputPath: outPath, provider: "remove_bg" });
      }
    } catch (e) { console.warn("[bg-remove] remove.bg failed:", e); }
  }

  return NextResponse.json({ error: "No background removal provider available. Set FAL_API_KEY, SEGMIND_API_KEY, or REMOVE_BG_API_KEY in .env" }, { status: 503 });
}
