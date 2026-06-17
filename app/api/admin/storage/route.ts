// GET  /api/admin/storage           — disk + temp usage, counts, and recent finished videos
// POST /api/admin/storage {action:"clean-temp"}  — delete stale render temp folders (safe: skips
//      anything touched in the last 60 min, so active renders are never harmed)
//
// Henry 2026-06-17: front-end storage monitor. Lets Henry SEE finished videos (the planner only
// shows a video if you were watching when it finished) and reclaim temp space without SSH.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

function dirBytes(dir: string): number {
  let total = 0;
  let stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else { try { total += fs.statSync(full).size; } catch { /* skip */ } }
    }
  }
  return total;
}

export async function GET() {
  const base = env.storagePath;
  const videoDir = path.join(base, "video");
  const assembledDir = path.join(videoDir, "assembled");
  const tempDir = path.join(videoDir, "temp");
  const thumbDir = path.join(base, "thumbnails");

  // Disk free (whole filesystem)
  let diskTotalGB = 0, diskFreeGB = 0;
  try {
    const s = fs.statfsSync(base);
    diskTotalGB = (s.blocks * s.bsize) / 1e9;
    diskFreeGB = (s.bavail * s.bsize) / 1e9;
  } catch { /* statfs unavailable */ }

  // Counts + sizes
  const list = (d: string) => { try { return fs.readdirSync(d); } catch { return []; } };
  const assembledFiles = list(assembledDir).filter(f => /\.(mp4|webm|mov)$/i.test(f));
  const tempDirs = (() => { try { return fs.readdirSync(tempDir, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return []; } })();

  // Recent finished videos (newest 60) with size + matching thumbnail if present
  const thumbs = new Set(list(thumbDir));
  const recent = assembledFiles
    .map(f => { const p = path.join(assembledDir, f); let st: fs.Stats | null = null; try { st = fs.statSync(p); } catch { /* */ } return { f, mtime: st?.mtimeMs ?? 0, size: st?.size ?? 0 }; })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 60)
    .map(({ f, mtime, size }) => {
      // thumbnails are named loosely; best-effort match by timestamp substring, else none
      const tsMatch = f.match(/_(\d{10,})\./);
      const thumb = tsMatch ? [...thumbs].find(t => t.includes(tsMatch[1].slice(0, 8))) : undefined;
      return {
        name: f,
        url: `/api/media/video/assembled/${encodeURIComponent(f)}`,
        thumbnailUrl: thumb ? `/api/media/thumbnails/${encodeURIComponent(thumb)}` : null,
        sizeMB: Math.round(size / 1e6),
        mtime,
      };
    });

  return NextResponse.json({
    disk: { totalGB: Math.round(diskTotalGB), freeGB: Math.round(diskFreeGB), usedPct: diskTotalGB ? Math.round((1 - diskFreeGB / diskTotalGB) * 100) : null },
    video: {
      finishedCount: assembledFiles.length,
      assembledBytes: dirBytes(assembledDir),
      tempBytes: dirBytes(tempDir),
      tempFolders: tempDirs.length,
    },
    recentVideos: recent,
  });
}

export async function POST(req: NextRequest) {
  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  if (body.action !== "clean-temp") {
    return NextResponse.json({ error: "Unknown action. Use {action:'clean-temp'}." }, { status: 400 });
  }
  const tempDir = path.join(env.storagePath, "video", "temp");
  const cutoff = Date.now() - 60 * 60 * 1000; // 60 min — never touch active renders
  let deleted = 0, freed = 0, skipped = 0;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(tempDir, { withFileTypes: true }); } catch { return NextResponse.json({ ok: true, deleted: 0, freedMB: 0, note: "no temp dir" }); }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(tempDir, e.name);
    let st: fs.Stats | null = null;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.mtimeMs >= cutoff) { skipped++; continue; } // active / recent render — keep
    const sz = dirBytes(p);
    try { fs.rmSync(p, { recursive: true, force: true }); deleted++; freed += sz; } catch { /* */ }
  }
  return NextResponse.json({ ok: true, deleted, freedMB: Math.round(freed / 1e6), keptActive: skipped });
}
