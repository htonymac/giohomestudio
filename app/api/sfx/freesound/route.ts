// GET /api/sfx/freesound?q=rain&page=1
// POST /api/sfx/freesound  { action: "save", id, name, previewUrl, license, username }
//
// Freesound.org API v2 — huge CC-licensed SFX library (free API key).
// Get your key at: https://freesound.org/apiv2/apply/
// Add to .env:  FREESOUND_API_KEY=your_key_here
//
// Search returns 12 results with HQ preview URLs.
// Save fetches the HQ preview MP3 and stores to storage/sfx/ + asset library.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";

const FS_BASE = "https://freesound.org/apiv2";

interface FreesoundResult {
  id: number;
  name: string;
  duration: number;
  license: string;
  username: string;
  description: string;
  tags: string[];
  previews: {
    "preview-hq-mp3": string;
    "preview-lq-mp3": string;
  };
}

// ── Search Freesound ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const page = parseInt(searchParams.get("page") || "1", 10);

  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const apiKey = env.freesound.apiKey;
  if (!apiKey) {
    return NextResponse.json({
      error: "FREESOUND_API_KEY not set",
      hint: "Get a free key at https://freesound.org/apiv2/apply/ then add FREESOUND_API_KEY=your_key to .env",
      noKey: true,
    }, { status: 200 });
  }

  const params = new URLSearchParams({
    query: q,
    token: apiKey,
    fields: "id,name,duration,license,username,description,tags,previews",
    page_size: "12",
    page: String(page),
    format: "json",
  });

  const res = await fetch(`${FS_BASE}/search/text/?${params}`, {
    headers: { "User-Agent": "GioHomeStudio/1.0" },
    next: { revalidate: 300 }, // cache 5 min
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json({ error: `Freesound error ${res.status}: ${body.slice(0, 200)}` }, { status: 502 });
  }

  const data = await res.json() as { count: number; results: FreesoundResult[] };

  const SAFE_AUTO_LICENSES = ["CC0", "CC-BY"];

  function normalizeLicense(raw: string): { label: string; type: "CC0" | "CC-BY" | "CC-BY-NC" | "OTHER" } {
    const u = (raw || "").toLowerCase();
    if (u.includes("/zero/") || u.includes("/publicdomain/") || u.includes("cc0")) {
      return { label: "CC0", type: "CC0" };
    }
    if (u.includes("nc")) {
      return { label: "CC BY-NC", type: "CC-BY-NC" };
    }
    if (u.includes("/by/") || u.includes("/by-sa/") || u.includes("/by-nd/")) {
      return { label: "CC BY", type: "CC-BY" };
    }
    return { label: "CC", type: "OTHER" };
  }

  const mapped = (data.results || []).map(r => {
    const { label, type } = normalizeLicense(r.license || "");
    return {
      id: r.id,
      name: r.name,
      duration: Math.round(r.duration),
      license: label,
      licenseType: type,
      licenseUrl: r.license,
      safeForCommercial: SAFE_AUTO_LICENSES.includes(type),
      username: r.username,
      description: (r.description || "").slice(0, 100),
      tags: (r.tags || []).slice(0, 5),
      previewUrl: r.previews?.["preview-hq-mp3"] || r.previews?.["preview-lq-mp3"] || "",
    };
  });

  return NextResponse.json({
    ok: true,
    query: q,
    page,
    count: data.count,
    results: mapped,
  });
}

// ── Save a Freesound preview to local library ─────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, name, previewUrl, license, username, duration, tags } = body as {
    id?: number;
    name?: string;
    previewUrl?: string;
    license?: string;
    username?: string;
    duration?: number;
    tags?: string[];
  };

  if (!previewUrl || !name) {
    return NextResponse.json({ error: "previewUrl and name are required" }, { status: 400 });
  }

  // Fetch the preview MP3
  const dlRes = await fetch(previewUrl, { headers: { "User-Agent": "GioHomeStudio/1.0" } });
  if (!dlRes.ok) {
    return NextResponse.json({ error: `Could not fetch preview: ${dlRes.status}` }, { status: 502 });
  }

  const buf = Buffer.from(await dlRes.arrayBuffer());
  const safeName = name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase().slice(0, 40);
  const fileName = `fs_${id || Date.now()}_${safeName}.mp3`;

  const sfxDir = path.resolve(env.storagePath, "sfx");
  fs.mkdirSync(sfxDir, { recursive: true });
  const filePath = path.join(sfxDir, fileName);
  await writeMedia(filePath, buf);

  const fileUrl = `/api/media/sfx/${fileName}`;

  // Register in asset library
  try {
    const assetFile = path.join(env.storagePath, "config", "asset-library.json");
    let assets: Array<Record<string, unknown>> = [];
    try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
    // Avoid duplicate saves
    if (!assets.some(a => a.name === name && a.source === "freesound")) {
      assets.unshift({
        id: `sfx_fs_${id || Date.now()}`,
        type: "sfx",
        name,
        description: `Freesound #${id} by ${username || "unknown"} — ${license || "CC"}`,
        filePath,
        fileUrl,
        tags: ["sfx", "freesound", ...(tags || [])],
        source: "freesound",
        license: license || "CC",
        attribution: `"${name}" by ${username || "unknown"} on Freesound.org`,
        duration: duration || 0,
        freesoundId: id,
        createdAt: new Date().toISOString(),
      });
      fs.mkdirSync(path.join(env.storagePath, "config"), { recursive: true });
      fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
    }
  } catch { /* best effort */ }

  return NextResponse.json({
    ok: true,
    fileUrl,
    fileName,
    name,
    source: "freesound",
    attribution: `"${name}" by ${username || "unknown"} on Freesound.org`,
  });
}
