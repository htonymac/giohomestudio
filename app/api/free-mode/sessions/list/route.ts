// GET /api/free-mode/sessions/list?q=... — list all sessions for this userKey

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
    const q       = (searchParams.get("q") ?? "").trim().toLowerCase();
    const userKey = getUserKey(req);

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
    return NextResponse.json({ sessions: filtered });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
