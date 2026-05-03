// POST /api/character-voices/[id]/generate-portrait
// Auto-generate character portrait using FAL Flux and save to imageUrl field.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const FAL_KEY = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!FAL_KEY) return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });

  const character = await prisma.characterVoice.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const desc = character.visualDescription?.trim();
  if (!desc) return NextResponse.json({ error: "No visualDescription set on this character" }, { status: 422 });

  const genderHint = character.gender === "female" || character.gender === "girl"
    ? "female character, "
    : character.gender === "male" || character.gender === "boy"
    ? "male character, "
    : "";

  const prompt = `character portrait, ${genderHint}${desc}, looking at camera, clean neutral background, photorealistic, high quality, sharp focus`;

  try {
    const falRes = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_size: { width: 512, height: 768 },
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text().catch(() => "");
      // Fallback to schnell if dev fails
      const schnellRes = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_size: { width: 512, height: 768 }, num_inference_steps: 4 }),
      });
      if (!schnellRes.ok) {
        return NextResponse.json({ error: `FAL Flux ${falRes.status}: ${errText.slice(0, 200)}` }, { status: 502 });
      }
      const schnellData = await schnellRes.json() as { images?: { url: string }[] };
      const imgUrl = schnellData.images?.[0]?.url;
      if (!imgUrl) return NextResponse.json({ error: "No image returned by Flux Schnell" }, { status: 502 });
      return await saveAndUpdate(id, imgUrl, FAL_KEY);
    }

    const falData = await falRes.json() as { images?: { url: string }[] };
    const imgUrl = falData.images?.[0]?.url;
    if (!imgUrl) return NextResponse.json({ error: "No image returned by Flux Dev" }, { status: 502 });
    return await saveAndUpdate(id, imgUrl, FAL_KEY);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function saveAndUpdate(characterId: string, cdnUrl: string, _falKey: string): Promise<NextResponse> {
  const outDir = path.join(env.storagePath, "characters", characterId);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `portrait_${Date.now()}.jpg`);

  const imgRes = await fetch(cdnUrl);
  if (!imgRes.ok) return NextResponse.json({ error: "Failed to download image from FAL CDN" }, { status: 502 });
  fs.writeFileSync(outFile, Buffer.from(await imgRes.arrayBuffer()));

  const relPath = outFile.replace(/\\/g, "/").replace(/^.*?storage\//, "");
  const localUrl = `/api/media/${relPath}`;

  const updated = await prisma.characterVoice.update({
    where: { id: characterId },
    data: { imageUrl: localUrl },
  });

  return NextResponse.json({ imageUrl: localUrl, character: { id: updated.id, name: updated.name } });
}
