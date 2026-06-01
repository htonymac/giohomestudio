// POST /api/karaoke/delete
// Hard-delete a karaoke recording: removes the DB row + any on-disk files
// (recording, assembled mix, exports, generated music tagged with this user
// AND timestamp matching the record).
//
// Body: { recordingId: string }
// Returns: { ok: true, deletedFiles: number } | { error: string }
//
// Henry 2026-05-31 (#7): "FIX DELETE BUTTON IN KARAOKE TO DELETE RECORDED
// VOICE AND PROJECT IF NOT NEEDED". This endpoint backs the new delete
// button in the Karaoke Planner.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import * as path from "path";
import * as fs from "fs";

function safeUnlink(p: string | null | undefined): boolean {
  if (!p) return false;
  try {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      return true;
    }
  } catch {
    // ignore - file already gone or permission issue
  }
  return false;
}

// Resolve a /api/media/... URL back to its disk path under storage/.
function urlToDiskPath(url: string | null | undefined): string | null {
  if (!url) return null;
  // URL shape: /api/media/<sub>/<file>...
  const m = url.match(/^\/api\/media\/(.+)$/);
  if (!m) return null;
  return path.join(env.storagePath, m[1]);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const recordingId = String(body.recordingId || "").trim();
    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    // 1. Files known directly on the recording row
    let deletedFiles = 0;
    const directPaths = [
      urlToDiskPath(recording.fileUrl),
      urlToDiskPath(recording.generatedMusicUrl),
      urlToDiskPath(recording.mixedOutputUrl),
    ];
    for (const p of directPaths) {
      if (safeUnlink(p)) deletedFiles++;
    }

    // 2. Exports created from this recording (filenames start with the id)
    const exportsDir = path.join(env.storagePath, "karaoke", "exports");
    if (fs.existsSync(exportsDir)) {
      try {
        for (const f of fs.readdirSync(exportsDir)) {
          if (f.startsWith(recordingId)) {
            if (safeUnlink(path.join(exportsDir, f))) deletedFiles++;
          }
        }
      } catch { /* dir read failed - skip */ }
    }

    // 3. Assembled mixes — same pattern in case multiple were made
    const assembledDir = path.join(env.storagePath, "karaoke", "assembled");
    if (fs.existsSync(assembledDir)) {
      try {
        for (const f of fs.readdirSync(assembledDir)) {
          if (f.startsWith(recordingId)) {
            if (safeUnlink(path.join(assembledDir, f))) deletedFiles++;
          }
        }
      } catch { /* dir read failed - skip */ }
    }

    // 4. Check for dependent music-video planner projects before deleting.
    // Music-video projects created from this karaoke take store state under
    // localIds prefixed `mv_kara_<recordingId>_`. If any exist and the caller
    // did not set force:true, return 409 so the client can confirm.
    const force = body.force === true;
    let linkedMvStates: { localId: string }[] = [];
    try {
      linkedMvStates = await prisma.hybridSavedState.findMany({
        where: { localId: { startsWith: `mv_kara_${recordingId}_` } },
        select: { localId: true },
      });
    } catch {
      // HybridSavedState query failed (should not happen — model exists in schema).
      // Non-fatal: skip dependency guard so deletion can still proceed.
      linkedMvStates = [];
    }

    if (linkedMvStates.length > 0 && !force) {
      return NextResponse.json(
        {
          error: "Take is linked to music-video projects",
          dependencies: linkedMvStates.map((l) => l.localId),
          needsForce: true,
        },
        { status: 409 }
      );
    }

    // 4b. If force-deleting, also remove the dangling saved-state rows.
    if (force && linkedMvStates.length > 0) {
      try {
        await prisma.hybridSavedState.deleteMany({
          where: { localId: { startsWith: `mv_kara_${recordingId}_` } },
        });
      } catch { /* non-fatal — orphaned rows will dangle harmlessly */ }
    }

    // 5. Music generations logged with this recording's userId in the prompt
    // (best-effort cleanup — non-fatal if MusicGeneration log doesn't exist)
    try {
      await prisma.musicGeneration.deleteMany({
        where: { userId: recording.userId, prompt: { contains: recordingId } },
      });
    } catch { /* table may not have all rows for this user - skip */ }

    // 6. Delete the row itself last so a partial failure can be re-run
    await prisma.karaokeRecording.delete({ where: { id: recordingId } });

    return NextResponse.json({ ok: true, deletedFiles, recordingId });
  } catch (err) {
    console.error("[karaoke/delete] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 }
    );
  }
}
