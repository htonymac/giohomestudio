// POST /api/free-mode/messages — create a new chat message (saves standalone
// videos / images / hybrid output into the chat history, even if user never sent
// a text prompt for it).
// Body: { sessionId, role, content, scenes? }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

function getUserKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip        = forwarded?.split(",")[0].trim() ?? "unknown";
  return createHash("sha256").update(ip + "-free-mode").digest("hex").slice(0, 32);
}

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

    const userKey = getUserKey(req);

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

    return NextResponse.json({ id: saved.id, ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
