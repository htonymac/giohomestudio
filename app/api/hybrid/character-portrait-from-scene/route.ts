// POST /api/hybrid/character-portrait-from-scene
// Crops a face region from a scene image and saves it as the character's portrait.
//
// WHY this exists: the hybrid planner uses img2img (FLUX) + stable seed to keep
// character appearance consistent across scenes, but diffusion still drifts on
// multi-character frames because there is no hard per-character face anchor. This
// endpoint lets the user click a face in SC1, crop it, and store it as the DB
// imageUrl for that character. Subsequent scene generation then uses that real
// SC1 face crop as the PuLID / identity-lock reference → actual face consistency.
//
// Body: {
//   characterId: string,       — CharacterVoice DB id (not the characterId field)
//   sceneImageUrl: string,     — local /api/media/... URL for the scene image
//   cropBox: { x, y, width, height }  — pixel coordinates in ORIGINAL image
// }
// Response: { imageUrl: string } on success | { error: string } on failure

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { env } from "@/config/env";

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RequestBody {
  characterId: string;
  sceneImageUrl: string;
  cropBox: CropBox;
}

// Convert /api/media/<relpath> → absolute local path inside storage root.
// The media route serves files from STORAGE_ROOT at that URL prefix, so
// stripping the prefix and joining with STORAGE_ROOT gives the real path.
function mediaUrlToLocalPath(mediaUrl: string): string | null {
  const prefix = "/api/media/";
  if (!mediaUrl.startsWith(prefix)) return null;
  const rel = mediaUrl.slice(prefix.length);
  const storageRoot = path.resolve(env.storagePath);
  const abs = path.resolve(storageRoot, rel);
  // Prevent path traversal — resolved path must stay inside storage root
  if (!abs.startsWith(storageRoot)) return null;
  return abs;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { characterId, sceneImageUrl, cropBox } = body;

  // ── Input validation ──
  if (!characterId || typeof characterId !== "string") {
    return NextResponse.json({ error: "characterId is required" }, { status: 400 });
  }
  if (!sceneImageUrl || typeof sceneImageUrl !== "string") {
    return NextResponse.json({ error: "sceneImageUrl is required" }, { status: 400 });
  }
  if (!cropBox || typeof cropBox.x !== "number" || typeof cropBox.y !== "number"
      || typeof cropBox.width !== "number" || typeof cropBox.height !== "number") {
    return NextResponse.json({ error: "cropBox with x/y/width/height numbers is required" }, { status: 400 });
  }
  if (cropBox.width <= 0 || cropBox.height <= 0) {
    return NextResponse.json({ error: "cropBox width and height must be positive" }, { status: 400 });
  }

  // ── Resolve source path ──
  const sourcePath = mediaUrlToLocalPath(sceneImageUrl);
  if (!sourcePath) {
    return NextResponse.json({ error: "sceneImageUrl must be a local /api/media/... path" }, { status: 400 });
  }
  if (!fs.existsSync(sourcePath)) {
    return NextResponse.json({ error: `Scene image not found on disk: ${sceneImageUrl}` }, { status: 404 });
  }

  // ── Verify character exists ──
  const char = await prisma.characterVoice.findFirst({
    where: {
      OR: [
        { id: characterId },
        { characterId: characterId },
      ],
    },
    select: { id: true, name: true },
  });
  if (!char) {
    return NextResponse.json({ error: `Character not found: ${characterId}` }, { status: 404 });
  }

  // ── Crop and save ──
  try {
    // sharp is a peer dep already used by auto-portraits — import dynamically to
    // keep build chunks clean and avoid loading native bindings at module parse time.
    const sharp = (await import("sharp")).default;

    // Read metadata so we can clamp crop box to image bounds — negative left/top
    // or out-of-bounds right/bottom would crash sharp.extract().
    const meta = await sharp(sourcePath).metadata();
    const imgW = meta.width ?? 0;
    const imgH = meta.height ?? 0;

    const left   = Math.max(0, Math.round(cropBox.x));
    const top    = Math.max(0, Math.round(cropBox.y));
    const right  = Math.min(imgW, Math.round(cropBox.x + cropBox.width));
    const bottom = Math.min(imgH, Math.round(cropBox.y + cropBox.height));
    const width  = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) {
      return NextResponse.json({ error: "cropBox falls outside image bounds" }, { status: 400 });
    }

    // Build output path: characters/<dbId>/portrait_sc1_<ts>_<4hex>.png
    // Timestamp + crypto suffix ensures no filename collision even under rapid
    // repeated saves (see P-2026-06-08 filename-collision entry in PROBLEM_AND_FIX.md).
    const outDir = path.join(path.resolve(env.storagePath), "characters", char.id);
    fs.mkdirSync(outDir, { recursive: true });
    const suffix = crypto.randomBytes(4).toString("hex");
    const ts = Date.now();
    const filename = `portrait_sc1_${ts}_${suffix}.png`;
    const outPath = path.join(outDir, filename);

    await sharp(sourcePath)
      .extract({ left, top, width, height })
      // Resize to 512×512 square — standard portrait size matching auto-portraits route.
      // keepAspectRatio: false because PuLID works best on a centered square crop.
      .resize(512, 512, { fit: "cover", position: "centre" })
      .png()
      .toFile(outPath);

    // /api/media/characters/<dbId>/<filename> → served by the [...path] media route
    const localUrl = `/api/media/characters/${char.id}/${filename}`;

    // Persist to DB so subsequent scene-image calls include this portrait in PuLID refs
    await prisma.characterVoice.update({
      where: { id: char.id },
      data: { imageUrl: localUrl },
    });

    console.log(`[character-portrait-from-scene] saved SC1 face crop for "${char.name}" → ${localUrl}`);
    return NextResponse.json({ imageUrl: localUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[character-portrait-from-scene] crop/save failed:", msg);
    return NextResponse.json({ error: `Crop failed: ${msg}` }, { status: 500 });
  }
}
