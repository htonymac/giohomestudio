// GET  /api/free-mode/sessions?sessionId=... — restore session messages
// GET  /api/free-mode/sessions?sessionId=...&userKey=... — same
// POST /api/free-mode/sessions — update session (intro/outro/characters)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

function getUserKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip        = forwarded?.split(",")[0].trim() ?? "unknown";
  return createHash("sha256").update(ip + "-free-mode").digest("hex").slice(0, 32);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await prisma.freeModeSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json({ messages: [], session: null });
    }

    return NextResponse.json({ session, messages: session.messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, characters, introText, introPhone, outroText, outroPhone } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const userKey = getUserKey(req);

    const updated = await prisma.freeModeSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userKey,
        characters: characters ?? [],
        introText:  introText  ?? null,
        introPhone: introPhone ?? null,
        outroText:  outroText  ?? null,
        outroPhone: outroPhone ?? null,
      },
      update: {
        ...(characters  !== undefined && { characters }),
        ...(introText   !== undefined && { introText }),
        ...(introPhone  !== undefined && { introPhone }),
        ...(outroText   !== undefined && { outroText }),
        ...(outroPhone  !== undefined && { outroPhone }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
