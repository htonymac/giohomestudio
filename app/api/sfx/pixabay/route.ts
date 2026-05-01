// GET /api/sfx/pixabay?q=thunder&page=1
// POST /api/sfx/pixabay  { action: "save", id, name, previewUrl, license, username }
//
// Pixabay Sound Effects API — royalty-free, commercial-safe sounds.
// Get your key at: https://pixabay.com/api/docs/
// Add to .env:  PIXABAY_API_KEY=your_key_here
//
// All Pixabay sound effects are CC0 — free for commercial use, no attribution.
// Search returns up to 20 results with HQ preview URLs.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const PB_BASE = "https://pixabay.com/api/sounds/";

interface PixabayHit {
  id: number;
  tags: string;
  duration: number;
  downloads: number;
  user: string;
  audio: string;       // direct MP3 URL (requires API key in request)
  previewURL?: string; // some responses include this
}

// ── Search Pixabay sounds ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const page = parseInt(searchParams.get("page") || "1", 10);

  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const apiKey = (env as unknown as Record<string, string>).pixabayApiKey
    || process.env.PIXABAY_API_KEY
    || "";

  if (!apiKey) {
    return NextResponse.json({
      error: "PIXABAY_API_KEY not set",
      hint: "Get a free key at https://pixabay.com/api/docs/ then add PIXABAY_API_KEY=your_key to .env",
      noKey: true,
      results: [],
    }, { status: 200 });
  }

  const params = new URLSearchParams({
    key: apiKey,
    q,
    page: String(page),
    per_page: "20",
  });

  let data: { totalHits?: number; hits?: PixabayHit[] };
  try {
    const res = await fetch(`${PB_BASE}?${params}`, {
      headers: { "User-Agent": "GioHomeStudio/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({ error: `Pixabay error ${res.status}: ${body.slice(0, 200)}` }, { status: 502 });
    }
    data = await res.json();
  } catch (e) {
    return NextResponse.json({ error: `Pixabay fetch failed: ${String(e)}` }, { status: 502 });
  }

  const hits = data.hits || [];

  return NextResponse.json({
    ok: true,
    source: "pixabay",
    query: q,
    page,
    count: data.totalHits || hits.length,
    results: hits.map(h => ({
      id: h.id,
      name: h.tags?.split(",")[0]?.trim() || `Sound ${h.id}`,
      duration: h.duration || 0,
      license: "CC0",
      licenseType: "CC0",
      licenseUrl: "https://pixabay.com/service/license-summary/",
      safeForCommercial: true,
      username: h.user || "pixabay",
      tags: (h.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 5),
      previewUrl: h.audio || h.previewURL || "",
      description: h.tags?.slice(0, 100) || "",
    })),
  });
}

// ── Save a Pixabay sound to local library ────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, name, previewUrl, username, duration, tags } = body as {
    id?: number;
    name?: string;
    previewUrl?: string;
    username?: string;
    duration?: number;
    tags?: string[];
  };

  if (!previewUrl || !name) {
    return NextResponse.json({ error: "previewUrl and name are required" }, { status: 400 });
  }

  const dlRes = await fetch(previewUrl, { headers: { "User-Agent": "GioHomeStudio/1.0" } });
  if (!dlRes.ok) {
    return NextResponse.json({ error: `Could not fetch audio: ${dlRes.status}` }, { status: 502 });
  }

  const buf = Buffer.from(await dlRes.arrayBuffer());
  const safeName = name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase().slice(0, 40);
  const fileName = `pb_${id || Date.now()}_${safeName}.mp3`;

  const sfxDir = path.resolve(env.storagePath, "sfx");
  fs.mkdirSync(sfxDir, { recursive: true });
  const filePath = path.join(sfxDir, fileName);
  fs.writeFileSync(filePath, buf);

  const fileUrl = `/api/media/sfx/${fileName}`;

  // Register in asset library
  try {
    const assetFile = path.join(env.storagePath, "config", "asset-library.json");
    let assets: Array<Record<string, unknown>> = [];
    try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
    if (!assets.some(a => a.name === name && a.source === "pixabay")) {
      assets.unshift({
        id: `sfx_pb_${id || Date.now()}`,
        type: "sfx",
        name,
        description: `Pixabay #${id} by ${username || "unknown"} — CC0`,
        filePath,
        fileUrl,
        tags: ["sfx", "pixabay", "cc0", ...(tags || [])],
        source: "pixabay",
        license: "CC0",
        licenseType: "CC0",
        safeForCommercial: true,
        attribution: "Pixabay License (CC0) — no attribution required",
        duration: duration || 0,
        pixabayId: id,
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
    source: "pixabay",
    license: "CC0",
    attribution: "Pixabay License (CC0) — no attribution required",
  });
}
