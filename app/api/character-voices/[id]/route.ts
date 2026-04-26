// GET    /api/character-voices/[id]  — fetch a single character voice
// PATCH  /api/character-voices/[id]  — update a character voice
// DELETE /api/character-voices/[id]  — remove a character voice

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const voice = await prisma.characterVoice.findUnique({ where: { id } });
  if (!voice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ voice });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.characterVoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const voice = await prisma.characterVoice.update({
    where: { id },
    data: {
      gender:             body.gender             !== undefined ? body.gender             : existing.gender,
      toneClass:          body.toneClass          !== undefined ? body.toneClass          : existing.toneClass,
      accent:             body.accent             !== undefined ? body.accent             : existing.accent,
      language:           body.language           !== undefined ? body.language           : existing.language,
      voiceId:            body.voiceId            !== undefined ? body.voiceId            : existing.voiceId,
      voiceName:          body.voiceName          !== undefined ? body.voiceName          : existing.voiceName,
      isNarrator:         body.isNarrator         !== undefined ? body.isNarrator         : existing.isNarrator,
      notes:              body.notes              !== undefined ? body.notes              : existing.notes,
      imageUrl:           body.imageUrl           !== undefined ? body.imageUrl           : existing.imageUrl,
      visualDescription:  body.visualDescription  !== undefined ? body.visualDescription  : existing.visualDescription,
      role:               body.role               !== undefined ? body.role               : existing.role,
      defaultSpeechStyle: body.defaultSpeechStyle !== undefined ? body.defaultSpeechStyle : existing.defaultSpeechStyle,
      referenceImages:    body.referenceImages    !== undefined ? body.referenceImages    : existing.referenceImages,
    },
  });

  return NextResponse.json({ voice });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.characterVoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.characterVoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
