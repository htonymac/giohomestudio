// POST /api/character-voices/[id]/generate-portrait
// Generates 3 portrait shots of the character in parallel:
//   shot 1 — front-facing portrait (becomes the main imageUrl)
//   shot 2 — three-quarter angle view
//   shot 3 — close-up face / expression detail
// All 3 are saved to referenceImages so the scene board has multiple references.
// Accepts: { style?, usePhotoFacelock? }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStylePreset } from "@/lib/style-presets";
import { sanitizeStyleCollisions, getStyleCollisionNegative } from "@/lib/style/sanitizer";
import { getLateAnchor } from "@/lib/style/late-anchor";

interface ReferenceImage { url: string; angle?: string; label?: string }

// The three framing directives that make each shot distinct.
const SHOT_FRAMES = [
  {
    angle: "front",
    label: "main",
    framing: "Front-facing portrait, neutral expression, full upper body, clean background.",
  },
  {
    angle: "three-quarter",
    label: "variation_1",
    framing: "Three-quarter angle view, slight left turn, upper body, showing side of face, clean background.",
  },
  {
    angle: "closeup",
    label: "variation_2",
    framing: "Close-up portrait, face and shoulders only, showing facial details, expression, clean background.",
  },
];

async function generateOneShot(
  origin: string,
  prompt: string,
  framing: string,
  negative: string,
  referenceImageUrl: string | undefined,
  useIdentityLock: boolean,
): Promise<string | null> {
  const fullPrompt = `${prompt} ${framing}`;
  const res = await fetch(`${origin}/api/generation/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: fullPrompt,
      negativePrompt: negative,
      width: 512,
      height: 768,
      referenceImageUrl: useIdentityLock ? referenceImageUrl : undefined,
      useIdentityLock,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { imageUrl?: string; imagePath?: string };
  if (data.imageUrl) return data.imageUrl;
  if (data.imagePath) {
    return `/api/media/${data.imagePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
  }
  return null;
}

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

  // Detect photo-import reference for face-lock
  const existingRefs = Array.isArray(character.referenceImages)
    ? character.referenceImages as unknown as ReferenceImage[]
    : [];
  const photoRef = existingRefs.find(r => r.label === "photo-import" || r.label === "main");
  const photoUrl = photoRef?.url ?? (character.imageUrl?.includes("/upload/") ? character.imageUrl : undefined);
  const useIdentityLock = body.usePhotoFacelock === true || !!photoRef;

  const style = body.style || "3d-cinematic";
  const preset = getStylePreset(style);

  const genderHint = character.gender === "female" || character.gender === "girl"
    ? "female character, "
    : character.gender === "male" || character.gender === "boy"
    ? "male character, "
    : "";

  const cleanDesc = sanitizeStyleCollisions(desc, style);
  const negative = (preset.negative || "") + getStyleCollisionNegative(style);

  // Shared base prompt — each shot appends its own framing directive
  const basePrompt = [
    preset.prefix,
    `CHARACTER ${character.name.toUpperCase()} — EXACT FIXED APPEARANCE:`,
    `${genderHint}${cleanDesc}`,
    "High quality, sharp focus, consistent character design.",
    getLateAnchor(style),
  ].filter(Boolean).join(". ");

  const origin = req.nextUrl.origin;

  // Generate all 3 shots in parallel
  const [url1, url2, url3] = await Promise.all(
    SHOT_FRAMES.map(shot =>
      generateOneShot(origin, basePrompt, shot.framing, negative, photoUrl, useIdentityLock)
    )
  );

  if (!url1) {
    return NextResponse.json({ error: "Primary portrait generation failed" }, { status: 502 });
  }

  // Build referenceImages: keep any existing photo-import entry, then add the 3 new shots
  const photoImports = existingRefs.filter(r => r.label === "photo-import");
  const newRefs: ReferenceImage[] = [
    ...photoImports,
    { url: url1, angle: "front",         label: "main" },
    ...(url2 ? [{ url: url2, angle: "three-quarter", label: "variation_1" }] : []),
    ...(url3 ? [{ url: url3, angle: "closeup",       label: "variation_2" }] : []),
  ];

  const updated = await prisma.characterVoice.update({
    where: { id },
    data: {
      imageUrl: url1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      referenceImages: newRefs as any,
    },
  });

  return NextResponse.json({
    imageUrl: url1,
    referenceImages: newRefs,
    shotsGenerated: newRefs.filter(r => r.label !== "photo-import").length,
    character: { id: updated.id, name: updated.name },
    faceLocked: useIdentityLock,
  });
}
