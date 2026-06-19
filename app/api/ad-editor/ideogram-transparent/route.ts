// POST /api/ad-editor/ideogram-transparent
// Generates a transparent-background PNG using Ideogram V3 via the FAL gateway.
// Returns { ok: true, outputUrl, transparent: true } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";
import { generateTransparent } from "@/lib/generation/gateways/fal";

interface IdeogramTransparentRequest {
  prompt: string;
  image_size?: string;
  rendering_speed?: "BALANCED" | "QUALITY" | "SPEED";
  projectId?: string;
}

export async function POST(req: NextRequest) {
  let body: IdeogramTransparentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, image_size, rendering_speed } = body;
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const result = await generateTransparent(prompt, {
      image_size: image_size || "square_hd",
      rendering_speed: rendering_speed || "BALANCED",
      magic_prompt: "AUTO",
    });

    // Download PNG and save locally — never convert to JPEG (alpha channel would be lost)
    const imgRes = await fetch(result.imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "Failed to download generated image" }, { status: 500 });
    }

    const outDir = path.join(env.storagePath, "images", "generated");
    fs.mkdirSync(outDir, { recursive: true });

    const filename = `${uuidv4()}.png`;
    const outPath = path.join(outDir, filename);
    await writeMedia(outPath, Buffer.from(await imgRes.arrayBuffer()));

    const outputUrl = `/api/media/images/generated/${filename}`;
    return NextResponse.json({ ok: true, outputUrl, transparent: true });
  } catch (e) {
    console.error("[ideogram-transparent] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
