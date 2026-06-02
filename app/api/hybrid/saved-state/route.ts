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
  // List projects (optional prefix filter: ?list=true&prefix=ghs_children)
  if (req.nextUrl.searchParams.get("list") === "true") {
    const prefix = req.nextUrl.searchParams.get("prefix") || "";
    try {
      const rows = prefix
        ? await prisma.$queryRaw<Array<{ localId: string; data: Record<string, unknown>; updatedAt: Date }>>`
            SELECT "localId", data, "updatedAt" FROM hybrid_saved_states
            WHERE "localId" LIKE ${prefix + "%"} ORDER BY "updatedAt" DESC
          `
        : await prisma.$queryRaw<Array<{ localId: string; data: Record<string, unknown>; updatedAt: Date }>>`
            SELECT "localId", data, "updatedAt" FROM hybrid_saved_states ORDER BY "updatedAt" DESC
          `;
      const projects = rows.map(row => {
        const d = row.data as Record<string, unknown>;
        const scenes = (d.scenes as unknown[] | undefined) || (d.childScenes as unknown[] | undefined) || [];
        const chars  = (d.characters as unknown[] | undefined) || (d.savedChars as unknown[] | undefined) || [];
        const imgs   = (d.sceneImages as Record<string, string> | undefined) || {};
        const thumb  = Object.values(imgs)[0] || null;
        return {
          id: row.localId,
          title: (d.projectTitle as string) || "Untitled",
          style: (d.projectStyle as string) || (d.visualStyle as string) || "",
          lastModified: new Date(row.updatedAt).getTime(),
          sceneCount: scenes.length,
          characterCount: chars.length,
          thumbnail: thumb,
        };
      });
      return NextResponse.json({ projects });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "DB error" }, { status: 500 });
    }
  }

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

// Henry 2026-06-02: DELETE /api/hybrid/saved-state?localId=xxx — remove a
// saved project from the DB. Used by the My Projects panel's per-card trash
// button. Storage assets under storage/scenes/, storage/video/, etc. are
// NOT touched here — they live by sceneId not projectId, and the same scene
// IDs can be reused across projects. Garbage collection is a separate concern.
export async function DELETE(req: NextRequest) {
  try {
    const localId = req.nextUrl.searchParams.get("localId");
    if (!localId) return NextResponse.json({ error: "localId required" }, { status: 400 });
    await prisma.$executeRaw`DELETE FROM hybrid_saved_states WHERE "localId" = ${localId}`;
    return NextResponse.json({ ok: true, localId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB delete error" }, { status: 500 });
  }
}
