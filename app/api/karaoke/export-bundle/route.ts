// POST /api/karaoke/export-bundle — bundle all completed export formats + license.txt into ZIP
// Body: { recordingId }
// Returns: { ok, bundleUrl, includedFormats, sizeBytes }
//
// Henry 2026-06-01 autonomous push: power-user one-click "give me everything".

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execFileAsync = promisify(execFile);

function urlToDiskPath(url: string | null | undefined): string | null {
  if (!url) return null;
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

    // Collect all the files for this take that exist on disk.
    const filesToInclude: string[] = [];
    const includedFormats: string[] = [];

    // Original recording
    const origPath = urlToDiskPath(recording.fileUrl);
    if (origPath && fs.existsSync(origPath)) {
      filesToInclude.push(origPath);
      includedFormats.push("original_recording");
    }

    // Mixed output
    const mixedPath = urlToDiskPath(recording.mixedOutputUrl);
    if (mixedPath && fs.existsSync(mixedPath)) {
      filesToInclude.push(mixedPath);
      includedFormats.push("mixed_output");
    }

    // All exports under storage/karaoke/exports/<id>*
    const exportsDir = path.join(env.storagePath, "karaoke", "exports");
    if (fs.existsSync(exportsDir)) {
      for (const f of fs.readdirSync(exportsDir)) {
        if (f.startsWith(recordingId)) {
          const abs = path.join(exportsDir, f);
          filesToInclude.push(abs);
          includedFormats.push(f.replace(`${recordingId}_`, "").replace(/\.[^.]+$/, ""));
        }
      }
    }

    if (filesToInclude.length === 0) {
      return NextResponse.json({ error: "No files to bundle yet — run an export first." }, { status: 400 });
    }

    // Write the bundle
    const bundleDir = path.join(env.storagePath, "karaoke", "bundles", recordingId);
    fs.mkdirSync(bundleDir, { recursive: true });
    const bundleName = `karaoke_${recordingId.slice(0, 8)}_${Date.now()}.zip`;
    const bundlePath = path.join(bundleDir, bundleName);

    try {
      await execFileAsync("zip", ["-j", bundlePath, ...filesToInclude], { timeout: 120000 });
    } catch (zipErr) {
      console.error("[karaoke/export-bundle] zip failed:", zipErr);
      return NextResponse.json(
        { error: `Bundle failed: ${zipErr instanceof Error ? zipErr.message.slice(0, 160) : "zip not available"}` },
        { status: 500 }
      );
    }

    const stats = fs.statSync(bundlePath);
    const bundleUrl = `/api/media/karaoke/bundles/${recordingId}/${bundleName}`;

    return NextResponse.json({
      ok: true,
      bundleUrl,
      includedFormats,
      sizeBytes: stats.size,
    });
  } catch (err) {
    console.error("[karaoke/export-bundle] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bundle failed" },
      { status: 500 }
    );
  }
}
