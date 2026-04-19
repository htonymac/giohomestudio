// GET  /api/hybrid/saved-state?localId=xxx  — Load project state from DB
// POST /api/hybrid/saved-state               — Upsert project state to DB
//
// Replaces localStorage for project assembly state (narratorAudioUrl, sceneVideos,
// selectedMusicUrl, characterAudioUrls, etc.) so all sessions share the same state.
// NOTE: uses $queryRaw / $executeRaw because Prisma client may need regeneration
// after the schema migration. Run `npx prisma generate` after restarting the dev server.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const localId = req.nextUrl.searchParams.get("localId");
  if (!localId) return NextResponse.json({ error: "localId required" }, { status: 400 });

  try {
    const rows = await prisma.$queryRaw<Array<{ data: unknown; updatedAt: Date }>>`
      SELECT data, "updatedAt" FROM hybrid_saved_states WHERE "localId" = ${localId} LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ found: false, data: null });
    return NextResponse.json({ found: true, data: rows[0].data, updatedAt: rows[0].updatedAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { localId, data } = await req.json();
    if (!localId || !data) return NextResponse.json({ error: "localId and data required" }, { status: 400 });

    const dataJson = JSON.stringify(data);
    await prisma.$executeRaw`
      INSERT INTO hybrid_saved_states ("localId", data, "updatedAt")
      VALUES (${localId}, ${dataJson}::jsonb, NOW())
      ON CONFLICT ("localId")
      DO UPDATE SET data = ${dataJson}::jsonb, "updatedAt" = NOW()
    `;

    return NextResponse.json({ ok: true, localId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB save error" }, { status: 500 });
  }
}
