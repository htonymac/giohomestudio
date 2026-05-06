// POST /api/character-voices/[id]/generate-portrait
// Generate character portrait. Routes to PuLID (fal_flux_pulid) if the character
// has a photo-import reference image — preserving the uploaded face identity.
// Accepts: { style?, usePhotoFacelock? } in request body.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStylePreset } from "@/lib/style-presets";

interface ReferenceImage { url: string; angle?: string; label?: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as {
    style?: string;
    usePhotoFacelock?: boolean;
  };

  const character = await prisma.characterVoice.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const desc = character.visualDescription?.trim();
  if (!desc) return NextResponse.json({ error: "No visualDescription set on this character" }, { status: 422 });

  // Detect photo-import reference image
  const refImages = Array.isArray(character.referenceImages) ? character.referenceImages as unknown as ReferenceImage[] : [];
  const photoRef = refImages.find(r => r.label === "photo-import" || r.label === "main");
  const photoUrl = photoRef?.url ?? (character.imageUrl?.includes("/upload/") ? character.imageUrl : undefined);
  const isPhotoImport = body.usePhotoFacelock === true || !!photoRef;

  const style = body.style || "3d-cinematic";
  const preset = getStylePreset(style);

  const genderHint = character.gender === "female" || character.gender === "girl"
    ? "female character, "
    : character.gender === "male" || character.gender === "boy"
    ? "male character, "
    : "";

  const prompt = [
    preset.prefix,
    `CHARACTER ${character.name.toUpperCase()} — EXACT FIXED APPEARANCE:`,
    `${genderHint}${desc}`,
    "Front-facing portrait, neutral pose, clean background.",
    "High quality, sharp focus, consistent character design.",
  ].filter(Boolean).join(". ");

  // Route through /api/generation/image — handles PuLID routing internally
  const origin = req.nextUrl.origin;
  const genRes = await fetch(`${origin}/api/generation/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negativePrompt: preset.negative || "",
      width: 512,
      height: 768,
      referenceImageUrl: isPhotoImport ? (photoUrl ?? undefined) : undefined,
      useIdentityLock: isPhotoImport,
    }),
  });

  if (!genRes.ok) {
    const errText = await genRes.text().catch(() => "");
    return NextResponse.json({ error: `Image generation failed: ${errText.slice(0, 300)}` }, { status: 502 });
  }

  const genData = await genRes.json() as { imageUrl?: string; imagePath?: string; error?: string };
  if (genData.error) return NextResponse.json({ error: genData.error }, { status: 502 });

  const imageUrl = genData.imageUrl || (genData.imagePath
    ? `/api/media/${genData.imagePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`
    : null);

  if (!imageUrl) return NextResponse.json({ error: "No image URL returned" }, { status: 502 });

  const updated = await prisma.characterVoice.update({
    where: { id },
    data: { imageUrl },
  });

  return NextResponse.json({
    imageUrl,
    character: { id: updated.id, name: updated.name },
    faceLocked: isPhotoImport,
  });
}
