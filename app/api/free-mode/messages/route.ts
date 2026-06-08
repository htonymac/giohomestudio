// POST /api/free-mode/messages — create a new chat message (saves standalone
// videos / images / hybrid output into the chat history, even if user never sent
// a text prompt for it).
// Body: { sessionId, role, content, scenes? }
//
// Henry 2026-06-08: switched from IP-hash userKey to cookie-based identity.
// Must match /sessions + /sessions/list + /chat so created sessions are
// findable by the sidebar list (prior PR #49 missed this route).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserKey } from "@/lib/free-mode-user-key";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, role, content, scenes } = body as {
      sessionId: string;
      role:      string;
      content:   string;
      scenes?:   unknown;
    };

    if (!sessionId || !role || typeof content !== "string") {
      return NextResponse.json({ error: "sessionId, role, content required" }, { status: 400 });
    }

    const { userKey, setCookieOnResponse } = resolveUserKey(req);

    // Ensure session exists (so standalone video gens land in history even if
    // user never sent a chat message in this session yet).
    await prisma.freeModeSession.upsert({
      where:  { id: sessionId },
      update: { updatedAt: new Date() },
      create: { id: sessionId, userKey },
    });

    const saved = await prisma.freeModeMessage.create({
      data: {
        sessionId,
        role,
        content,
        scenes: Array.isArray(scenes) ? (scenes as object[]) : undefined,
      },
    });

    const res = NextResponse.json({ id: saved.id, ok: true });
    setCookieOnResponse(res);
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
