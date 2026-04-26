// POST /api/image/bg-remove — Bria RMBG 2.0 via fal.ai (~$0.01/image)
// Phase 1 daily need. Removes background from uploaded image.
// Returns { outputUrl, provider } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    const base64 = buf.toString("base64");

    const outDir = path.join(env.storagePath, "processed", "bg-removed");
    fs.mkdirSync(outDir, { recursive: true });

    const FAL_KEY = process.env.FAL_API_KEY;

    // ── Provider 1: Bria RMBG 2.0 via fal.ai (Phase 1) ──
    if (FAL_KEY) {
      try {
        const falRes = await fetch("https://queue.fal.run/fal-ai/bria-rmbg", {
          method: "POST",
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: `data:${mime};base64,${base64}`,
          }),
        });

        if (falRes.ok) {
          const data = await falRes.json();
          const imgUrl = data.image?.url ?? data.output_url ?? data.url;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            const outPath = path.join(outDir, `bria_nobg_${Date.now()}.png`);
            fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
            const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
            return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "Bria RMBG 2.0 (fal.ai)" });
          }
        }
      } catch (e) {
        console.error("[bg-remove] Bria RMBG failed:", e);
      }

      // ── Fallback: BiRefNet via fal.ai ──
      try {
        const falRes = await fetch("https://queue.fal.run/fal-ai/birefnet", {
          method: "POST",
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image_url: `data:${mime};base64,${base64}` }),
        });
        if (falRes.ok) {
          const data = await falRes.json();
          const imgUrl = data.image?.url;
          if (imgUrl) {
            const imgRes = await fetch(imgUrl);
            const outPath = path.join(outDir, `birefnet_nobg_${Date.now()}.png`);
            fs.writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
            const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
            return NextResponse.json({ outputUrl: `/api/media/${relPath}`, provider: "BiRefNet (fal.ai fallback)" });
          }
        }
      } catch { /* fallback also failed */ }
    }

    return NextResponse.json({ error: "No FAL_API_KEY configured. Set FAL_API_KEY in .env to enable background removal." }, { status: 503 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Background removal failed" }, { status: 500 });
  }
}
