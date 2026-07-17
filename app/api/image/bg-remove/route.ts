// POST /api/image/bg-remove — remove background from an uploaded image.
// Provider ladder (free-first, silent fallback): local rembg → fal.ai (Bria/BiRefNet)
// → Segmind → remove.bg. User never sees a "no credit" error while ANY provider works.
// Returns { outputUrl, provider } or { error }.
// (Mirrors app/api/ad-editor/bg-remove ladder — Henry 2026-07-16: FAL balance exhausted,
//  free image path must not depend on FAL.)

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    const base64 = buf.toString("base64");
    const ext = mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";

    const outDir = path.join(env.storagePath, "processed", "bg-removed");
    fs.mkdirSync(outDir, { recursive: true });

    // ── Provider 1: LOCAL rembg — free, no API cost, no vendor balance. Try FIRST. ──
    {
      const inputPath = path.join(outDir, `input_${Date.now()}${ext}`);
      const rembgOut = path.join(outDir, `nobg_local_${Date.now()}.png`);
      try {
        fs.writeFileSync(inputPath, buf);
        const { execFile } = await import("child_process");
        const { promisify } = await import("util");
        const PY = "import sys; from rembg import remove; from PIL import Image; res = remove(Image.open(sys.argv[1])); res.save(sys.argv[2])";
        await promisify(execFile)("python3", ["-c", PY, inputPath, rembgOut], { timeout: 180000 });
        if (fs.existsSync(rembgOut) && fs.statSync(rembgOut).size > 100) {
          const outPath = path.join(outDir, `rembg_nobg_${Date.now()}.png`);
          await writeMedia(outPath, fs.readFileSync(rembgOut));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "rembg (local, free)" });
        }
      } catch (e) {
        console.error("[bg-remove] local rembg failed:", e);
      } finally {
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch { /* temp */ }
        try { if (fs.existsSync(rembgOut)) fs.unlinkSync(rembgOut); } catch { /* temp */ }
      }
    }

    // ── Provider 2: fal.ai Bria RMBG 2.0 → BiRefNet (skipped silently when FAL balance is out) ──
    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;  // server uses FAL_KEY
    if (FAL_KEY) {
      const { falBgRemove } = await import("@/lib/providers/fal");
      for (const model of ["bria-rmbg", "birefnet"] as const) {
        try {
          const r = await falBgRemove(model, { image_url: `data:${mime};base64,${base64}` });
          if (r.ok) {
            const data = r.data as { image?: { url?: string }; output_url?: string; url?: string };
            const imgUrl = data.image?.url ?? data.output_url ?? data.url;
            if (imgUrl) {
              const imgRes = await fetch(imgUrl);
              const outPath = path.join(outDir, `fal_nobg_${Date.now()}.png`);
              await writeMedia(outPath, Buffer.from(await imgRes.arrayBuffer()));
              const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
              const label = model === "bria-rmbg" ? "Bria RMBG 2.0 (fal.ai)" : "BiRefNet (fal.ai)";
              return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: label });
            }
          }
        } catch (e) {
          console.error(`[bg-remove] fal ${model} failed:`, e);
        }
      }
    }

    // ── Provider 3: Segmind (free key present on server) ──
    const SEG_KEY = process.env.SEGMIND_API_KEY;
    if (SEG_KEY) {
      try {
        const res = await fetch("https://api.segmind.com/v1/bg-removal", {
          method: "POST",
          headers: { "x-api-key": SEG_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        if (res.ok) {
          const outPath = path.join(outDir, `segmind_nobg_${Date.now()}.png`);
          await writeMedia(outPath, Buffer.from(await res.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "Segmind" });
        }
        console.error("[bg-remove] Segmind non-ok:", res.status);
      } catch (e) {
        console.error("[bg-remove] Segmind failed:", e);
      }
    }

    // ── Provider 4: remove.bg (free tier, if keyed) ──
    const RMBG_KEY = process.env.REMOVE_BG_API_KEY;
    if (RMBG_KEY) {
      try {
        const fd = new FormData();
        fd.append("image_file", new Blob([buf], { type: mime }), `image${ext}`);
        fd.append("size", "auto");
        const res = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: { "X-Api-Key": RMBG_KEY },
          body: fd,
        });
        if (res.ok) {
          const outPath = path.join(outDir, `removebg_nobg_${Date.now()}.png`);
          await writeMedia(outPath, Buffer.from(await res.arrayBuffer()));
          const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
          return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "remove.bg" });
        }
        console.error("[bg-remove] remove.bg non-ok:", res.status);
      } catch (e) {
        console.error("[bg-remove] remove.bg failed:", e);
      }
    }

    return NextResponse.json({ error: "Background removal unavailable — no working provider (local rembg, FAL balance, Segmind, remove.bg all failed)." }, { status: 503 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Background removal failed" }, { status: 500 });
  }
}
