// GET  /api/free-mode/history        — list (newest first, limit 60)
// POST /api/free-mode/history        — create new history item

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.freeModeHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = await prisma.freeModeHistory.create({
      data: {
        rawPrompt:      String(body.rawPrompt ?? ""),
        enhancedPrompt: body.enhancedPrompt ? String(body.enhancedPrompt) : null,
        mode:           String(body.mode ?? "text_to_video"),
        motionSub:      body.motionSub ? String(body.motionSub) : null,
        aspect:         String(body.aspect ?? "9:16"),
        duration:       Number(body.duration ?? 10),
        language:       String(body.language ?? "en"),
        style:          body.style ? String(body.style) : null,
        audioMode:      String(body.audioMode ?? "voice_music"),
        aiModel:        String(body.aiModel ?? "haiku"),
        status:         "generating",
        resultType:     String(body.resultType ?? "job"),
        uploadedPaths:  Array.isArray(body.uploadedPaths) ? body.uploadedPaths : [],
        refImagePaths:  Array.isArray(body.refImagePaths) ? body.refImagePaths : [],
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
