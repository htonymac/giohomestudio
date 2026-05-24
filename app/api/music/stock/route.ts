// GET /api/music/stock
//
// Returns the catalog of stock library music available to the current user.
// Catalog is built by scanning storage/music/stock/ + storage/music/stock/freepd/
// and merging with manifest.json license metadata.
//
// Wave 0 (2026-05-24) — replaces the old "trust the filename" approach with
// metadata-driven catalog so frontend can show license/attribution per track.
//
// License rules per `update/LEGAL/SOUND_LICENSING.md`:
//   - CC0 / Public Domain → free commercial use, no attribution
//   - CC BY 4.0           → free commercial use, attribution REQUIRED (we expose `.attribution`)
//   - Pixabay Content     → free commercial use, no attribution
//   - UNVERIFIED          → SAFE for personal/free-tier video; BLOCKED for commercial publication

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

interface CatalogTrack {
  id: string;
  filename: string;
  url: string;
  mood: string;
  genre?: string;
  description?: string;
  durationSec?: number | null;
  sizeBytes?: number;
  license: string;
  licenseType: string;
  source: string;
  attribution: string | null;
  commercialUseAllowed: boolean;
  blocked: boolean;
  verificationStatus: string;
}

function loadManifest(file: string): Map<string, Partial<CatalogTrack>> {
  if (!fs.existsSync(file)) return new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Array<Record<string, unknown>>;
    return new Map(raw.map(e => [String(e.filename), e as Partial<CatalogTrack>]));
  } catch {
    return new Map();
  }
}

function scanDir(dir: string, urlPrefix: string, manifest: Map<string, Partial<CatalogTrack>>, defaults: Partial<CatalogTrack>): CatalogTrack[] {
  if (!fs.existsSync(dir)) return [];
  const tracks: CatalogTrack[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!/\.(mp3|wav|m4a|ogg)$/i.test(entry)) continue;
    const meta = manifest.get(entry) ?? {};
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(path.join(dir, entry)).size; } catch { /* best effort */ }
    tracks.push({
      id: String(meta.id ?? `${defaults.source ?? "stock"}_${entry.replace(/\.[^.]+$/, "")}`),
      filename: entry,
      url: `${urlPrefix}/${entry}`,
      mood: String(meta.mood ?? entry.split("_")[0].replace(/\.[^.]+$/, "")),
      genre: meta.genre ? String(meta.genre) : undefined,
      description: meta.description ? String(meta.description) : undefined,
      durationSec: (typeof meta.durationSec === "number" ? meta.durationSec : null),
      sizeBytes,
      license: String(meta.license ?? defaults.license ?? "UNVERIFIED"),
      licenseType: String(meta.licenseType ?? defaults.licenseType ?? "UNKNOWN"),
      source: String(meta.source ?? defaults.source ?? "ghs-bundled"),
      attribution: (meta.attribution as string | null) ?? defaults.attribution ?? null,
      commercialUseAllowed: meta.commercialUseAllowed === true || defaults.commercialUseAllowed === true,
      blocked: meta.blocked === true || defaults.blocked === true,
      verificationStatus: String(meta.verificationStatus ?? defaults.verificationStatus ?? "pending"),
    });
  }
  return tracks;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const commercialOnly = searchParams.get("commercial") === "true";
    const mood = searchParams.get("mood")?.toLowerCase();

    const stockDir = path.join(env.storagePath, "music", "stock");
    const freepdDir = path.join(stockDir, "freepd");

    const stockManifest = loadManifest(path.join(stockDir, "manifest.json"));
    const freepdManifest = loadManifest(path.join(freepdDir, "manifest.json"));

    // Bundled (pre-2026-05) tracks — UNVERIFIED license, blocked from commercial flows
    const bundled = scanDir(stockDir, "/api/media/music/stock", stockManifest, {
      license: "UNVERIFIED",
      licenseType: "UNKNOWN",
      source: "ghs-bundled-pre-2026-05",
      attribution: null,
      commercialUseAllowed: false,
      blocked: false,
      verificationStatus: "pending",
    });

    // FreePD / incompetech tracks — CC BY 4.0 by Kevin MacLeod / Public Domain
    const freepd = scanDir(freepdDir, "/api/media/music/stock/freepd", freepdManifest, {
      license: "CC BY 4.0",
      licenseType: "CC_BY",
      source: "incompetech.com (Kevin MacLeod)",
      attribution: 'Music by Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 License (creativecommons.org/licenses/by/4.0/)',
      commercialUseAllowed: true,
      blocked: false,
      verificationStatus: "verified",
    });

    let catalog = [...freepd, ...bundled];

    // Filters
    if (commercialOnly) {
      catalog = catalog.filter(t => t.commercialUseAllowed && !t.blocked);
    }
    if (mood) {
      catalog = catalog.filter(t =>
        t.mood.toLowerCase().includes(mood)
        || (t.genre && t.genre.toLowerCase().includes(mood))
        || (t.description && t.description.toLowerCase().includes(mood))
      );
    }

    return NextResponse.json({
      count: catalog.length,
      commercialCount: catalog.filter(t => t.commercialUseAllowed && !t.blocked).length,
      filters: { commercialOnly, mood: mood ?? null },
      tracks: catalog,
      legal: {
        policy: "/legal/sound-licensing",
        commercialUseRule: "Tracks marked commercialUseAllowed=false are SAFE for personal/free-tier video but require verification before monetised use. Attribution required for CC BY tracks (auto-text in track.attribution).",
        ccByAttributionRule: "When using any CC BY track in published content, include the track.attribution string verbatim in your credits.",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
