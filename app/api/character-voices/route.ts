// GET  /api/character-voices  — list all character voice registrations
// POST /api/character-voices  — create a new character voice

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCharacterId } from "@/lib/character-id";

export async function GET() {
  const voices = await prisma.characterVoice.findMany({
    orderBy: [{ isNarrator: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ voices });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    name, gender, toneClass, accent, language, voiceId, voiceName, isNarrator, notes,
    imageUrl, visualDescription, role, defaultSpeechStyle,
    age, height, culture, country, dialect, personality, wardrobe, hairstyle,
    expressions, posePack, motionReference, keepSameToggle, voiceProvider, projectAssociation,
    characterId: providedCharId, skinTone, attribute,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Auto-generate character ID if not provided
  const characterId = providedCharId || generateCharacterId({
    country: country || undefined,
    name,
    age: age || undefined,
    skinTone: skinTone || undefined,
    attribute: attribute || undefined,
  });

  try {
    const voice = await prisma.characterVoice.create({
      data: {
        name: name.toUpperCase().trim(),
        characterId,
        gender: gender ?? null,
        toneClass: toneClass ?? null,
        accent: accent ?? null,
        language: language ?? null,
        voiceId: voiceId ?? null,
        voiceName: voiceName ?? null,
        isNarrator: isNarrator ?? false,
        notes: notes ?? null,
        imageUrl: imageUrl ?? null,
        visualDescription: visualDescription ?? null,
        role: role ?? null,
        defaultSpeechStyle: defaultSpeechStyle ?? null,
        age: age ?? null,
        height: height ?? null,
        culture: culture ?? null,
        country: country ?? null,
        dialect: dialect ?? null,
        personality: personality ?? null,
        wardrobe: wardrobe ?? null,
        hairstyle: hairstyle ?? null,
        expressions: expressions ?? undefined,
        posePack: posePack ?? undefined,
        motionReference: motionReference ?? null,
        keepSameToggle: keepSameToggle ?? true,
        voiceProvider: voiceProvider ?? null,
        projectAssociation: projectAssociation ?? null,
      },
    });
    return NextResponse.json({ voice }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: `Character "${name}" already registered` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
