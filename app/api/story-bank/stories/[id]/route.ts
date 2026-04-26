// GET/PUT/DELETE /api/story-bank/stories/[id]

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s.id, s.title, s.genre, s.tone, s.logline, s."targetDurationSeconds", s.status,
             s."createdAt", s."updatedAt",
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', c.id, 'title', c.title, 'summary', c.summary, 'orderIndex', c."orderIndex",
                   'scenes', (
                     SELECT COALESCE(json_agg(
                       json_build_object('id', sc.id, 'title', sc.title, 'description', sc.description,
                                         'durationSeconds', sc."durationSeconds", 'orderIndex', sc."orderIndex",
                                         'notes', sc.notes)
                       ORDER BY sc."orderIndex"
                     ), '[]')
                     FROM story_scenes sc WHERE sc."chapterId" = c.id
                   )
                 ) ORDER BY c."orderIndex"
               ) FILTER (WHERE c.id IS NOT NULL),
               '[]'
             ) as chapters
      FROM stories s
      LEFT JOIN chapters c ON c."storyId" = s.id
      WHERE s.id = ${id}
      GROUP BY s.id
    `;
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ story: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { title, genre, tone, logline, targetDurationSeconds, status } = await req.json();
    await prisma.$executeRaw`
      UPDATE stories SET
        title = COALESCE(${title || null}, title),
        genre = COALESCE(${genre || null}, genre),
        tone  = COALESCE(${tone  || null}, tone),
        logline = COALESCE(${logline || null}, logline),
        "targetDurationSeconds" = COALESCE(${targetDurationSeconds ?? null}::int, "targetDurationSeconds"),
        status = COALESCE(${status || null}, status),
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.$executeRaw`DELETE FROM stories WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}
