// GET  /api/free-mode/sessions?sessionId=... — restore session messages
// GET  /api/free-mode/sessions?sessionId=...&userKey=... — same
// POST /api/free-mode/sessions — update session (intro/outro/characters)
//
// 2026-06-08: switched from IP-hash userKey to cookie-based identity. See
// `lib/free-mode-user-key.ts` for the why + how. Old IP-hash sessions remain
// in the DB; new sessions are tagged with the cookie userKey.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserKey } from "@/lib/free-mode-user-key";

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

    const { userKey, setCookieOnResponse } = resolveUserKey(req);

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

    const res = NextResponse.json(updated);
    setCookieOnResponse(res);
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
