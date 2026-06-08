// GET /api/free-mode/sessions/list?q=... — list all sessions for this userKey
//
// 2026-06-08: switched to cookie-based userKey. See lib/free-mode-user-key.ts.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserKey } from "@/lib/free-mode-user-key";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q       = (searchParams.get("q") ?? "").trim().toLowerCase();
    const { userKey, setCookieOnResponse } = resolveUserKey(req);

    const sessions = await prisma.freeModeSession.findMany({
      where: { userKey },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, scenes: true, createdAt: true },
        },
      },
    });

    const items = sessions.map(s => {
      const firstUser = s.messages.find(m => m.role === "user");
      const titleSrc  = s.title ?? firstUser?.content ?? "New chat";
      const title     = titleSrc.length > 70 ? titleSrc.slice(0, 70) + "…" : titleSrc;

      let imageCount = 0;
      let videoCount = 0;
      for (const m of s.messages) {
        const sc = (m.scenes as Array<{ imageUrl?: string; videoUrl?: string }> | null) ?? [];
        for (const scene of sc ?? []) {
          if (scene?.imageUrl) imageCount++;
          if (scene?.videoUrl) videoCount++;
        }
      }

      return {
        id:        s.id,
        title,
        msgCount:  s.messages.length,
        imageCount,
        videoCount,
        updatedAt: s.updatedAt,
      };
    });

    const filtered = q ? items.filter(i => i.title.toLowerCase().includes(q)) : items;
    // Attach the cookie so brand-new visitors get a stable identity from the
    // very first sidebar load — without it the next request would mint a
    // different userKey and they'd see an empty list again.
    const res = NextResponse.json({ sessions: filtered });
    setCookieOnResponse(res);
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
