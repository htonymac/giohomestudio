// GET  /api/character-voices  — list all character voice registrations
// POST /api/character-voices  — create a new character voice

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const voice = await prisma.characterVoice.create({
      data: {
        name: name.toUpperCase().trim(),
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
