// GET /api/sfx/local-search?q=helicopter
//
// Searches the GHS Inbuilt SFX manifest (storage/sfx/manifest.json) by tag.
// Also searches the main SFX_LIBRARY from src/modules/sfx for available files.
// Returns combined results with availability status.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { SFX_LIBRARY } from "@/modules/sfx";

interface ManifestEntry {
  id: string;
  event: string;
  filename: string;
  description: string;
  category: string;
  tags: string[];
  license: string;
  licenseType: string;
  source: string;
  available: boolean;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const sfxDir = path.resolve(env.storagePath, "sfx");
  const results: Array<{
    id: string;
    event: string;
    filename: string;
    description: string;
    category: string;
    tags: string[];
    license: string;
    licenseType: string;
    source: string;
    available: boolean;
    fileUrl: string | null;
  }> = [];

  // ── 1. Search manifest.json (inbuilt library) ─────────────────────────────
  const manifestPath = path.join(sfxDir, "manifest.json");
  let manifestEntries: ManifestEntry[] = [];
  try {
    manifestEntries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as ManifestEntry[];
  } catch { /* manifest not found — skip */ }

  for (const entry of manifestEntries) {
    const matchesQuery =
      entry.event.includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      (entry.tags || []).some((t: string) => t.toLowerCase().includes(q));

    if (matchesQuery) {
      const filePath = path.join(sfxDir, entry.filename);
      const available = fs.existsSync(filePath);
      results.push({
        id: entry.id,
        event: entry.event,
        filename: entry.filename,
        description: entry.description,
        category: entry.category,
        tags: entry.tags || [],
        license: entry.license || "CC0",
        licenseType: entry.licenseType || "CC0",
        source: "ghs_inbuilt",
        available,
        fileUrl: available ? `/api/media/sfx/${entry.filename}` : null,
      });
    }
  }

  // ── 2. Search main SFX_LIBRARY (src/modules/sfx) ─────────────────────────
  for (const sfx of SFX_LIBRARY) {
    const matchesQuery =
      sfx.event.includes(q) ||
      sfx.description.toLowerCase().includes(q) ||
      sfx.category.toLowerCase().includes(q);

    if (matchesQuery) {
      // Skip if already found in manifest
      if (results.some(r => r.filename === sfx.filename)) continue;

      const filePath = path.join(sfxDir, sfx.filename);
      const available = fs.existsSync(filePath);
      results.push({
        id: `lib_${sfx.event}`,
        event: sfx.event,
        filename: sfx.filename,
        description: sfx.description,
        category: sfx.category,
        tags: [sfx.event, sfx.category],
        license: "CC0",
        licenseType: "CC0",
        source: "ghs_library",
        available,
        fileUrl: available ? `/api/media/sfx/${sfx.filename}` : null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    query: q,
    count: results.length,
    source: "local",
    results,
  });
}
