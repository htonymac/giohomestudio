// POST /api/sfx/upload
// Upload a custom MP3/WAV file to the SFX library.
// FormData: { file: File, name?: string, tags?: string }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const MAX_MB = 20;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["mp3", "wav", "ogg", "flac"].includes(ext || "")) {
    return NextResponse.json({ error: "Only MP3, WAV, OGG, FLAC files allowed" }, { status: 400 });
  }

  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File too large — max ${MAX_MB}MB` }, { status: 400 });
  }

  const customName = (form.get("name") as string | null)?.trim() || file.name.replace(/\.[^.]+$/, "");
  const tagsRaw = (form.get("tags") as string | null)?.trim() || "";
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

  const sfxDir = path.resolve(env.storagePath, "sfx");
  fs.mkdirSync(sfxDir, { recursive: true });

  const safeName = customName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase().slice(0, 40);
  const fileName = `custom_${Date.now()}_${safeName}.${ext}`;
  const filePath = path.join(sfxDir, fileName);

  await fs.promises.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
  const fileUrl = `/api/media/sfx/${fileName}`;

  // Register in asset library
  try {
    const assetFile = path.join(env.storagePath, "config", "asset-library.json");
    let assets: Array<Record<string, unknown>> = [];
    try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
    assets.unshift({
      id: `sfx_custom_${Date.now()}`,
      type: "sfx",
      name: customName,
      description: `Custom upload: ${file.name}`,
      filePath,
      fileUrl,
      tags: ["sfx", "custom-upload", ...tags],
      source: "uploaded",
      license: "owned",
      createdAt: new Date().toISOString(),
    });
    fs.mkdirSync(path.join(env.storagePath, "config"), { recursive: true });
    fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
  } catch { /* best effort */ }

  return NextResponse.json({ ok: true, fileUrl, fileName, name: customName });
}
