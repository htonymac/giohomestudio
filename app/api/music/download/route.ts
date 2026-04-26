// POST /api/music/download
//
// Downloads a royalty-free music track to storage/music/stock/.
// Supports two modes:
//   1. Direct URL download: { url, filename? }
//   2. Pixabay search:      { query, mood?, category? }  — requires PIXABAY_API_KEY in env
//
// All downloaded tracks are stored in the stock library folder so they
// immediately appear in /api/music/library without a server restart.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import https from "https";
import http from "http";
import { env } from "@/config/env";
import { sanitizeFilename } from "@/lib/media-utils";

const STOCK_DIR = path.resolve(env.storagePath, "music", "stock");
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB hard cap for direct URL downloads

const PIXABAY_CATEGORIES = [
  "business", "classical", "comedy", "corporate", "happy", "holiday",
  "inspirational", "jazz", "kids", "pop", "reggae", "rock", "soul",
  "sports", "travel", "urban", "world",
];

type PixabayMusicHit = {
  id: number;
  title: string;
  duration: number;
  audio?: string;
  preview_url?: string;
  tags: string;
};

type PixabayMusicResponse = {
  total: number;
  totalHits: number;
  hits: PixabayMusicHit[];
};

// Music filenames are always lowercased for case-insensitive stock library lookups.
function sanitizeMusicName(name: string): string {
  return sanitizeFilename(name.toLowerCase().replace(/\./g, "_"));
}

function downloadFile(url: string, destPath: string, redirectsLeft = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) { reject(new Error("Too many redirects")); return; }

    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    let bytesReceived = 0;

    const req = proto.get(url, { headers: { "User-Agent": "GioHomeStudio/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        const redirect = res.headers.location;
        if (!redirect) { reject(new Error("Redirect with no Location")); return; }
        downloadFile(redirect, destPath, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.on("data", (chunk: Buffer) => {
        bytesReceived += chunk.length;
        if (bytesReceived > MAX_DOWNLOAD_BYTES) {
          req.destroy(new Error(`File exceeds ${MAX_DOWNLOAD_BYTES / 1024 / 1024} MB limit`));
        }
      });

      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    });

    req.on("error", (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });

    req.setTimeout(300000, () => { req.destroy(new Error("Download timeout")); });
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    url?: string;
    filename?: string;
    query?: string;
    mood?: string;
    category?: string;
  };

  fs.mkdirSync(STOCK_DIR, { recursive: true });

  // ── Mode 1: Direct URL download ───────────────────────────────────────────
  if (body.url) {
    const url = body.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const rawName = body.filename?.trim() || `custom_${Date.now()}.mp3`;
    const safeBase = sanitizeMusicName(rawName.replace(/\.(mp3|wav|aac)$/i, ""));
    const ext  = rawName.match(/\.(mp3|wav|aac)$/i)?.[0] ?? ".mp3";
    const filename = `${safeBase}${ext}`;
    const dest = path.join(STOCK_DIR, filename);

    try {
      await downloadFile(url, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 1000) {
        fs.unlinkSync(dest);
        return NextResponse.json({ error: "Downloaded file is too small — likely not audio" }, { status: 422 });
      }
      return NextResponse.json({ filename, path: dest, source: "direct_url" });
    } catch (err) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      return NextResponse.json({ error: `Download failed: ${err instanceof Error ? err.message : err}` }, { status: 502 });
    }
  }

  // ── Mode 2: Pixabay search ────────────────────────────────────────────────
  if (body.query) {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PIXABAY_API_KEY not configured. Add it in Settings or use direct URL download." },
        { status: 503 }
      );
    }

    const params = new URLSearchParams({ key: apiKey, q: body.query, per_page: "5" });
    if (body.category && PIXABAY_CATEGORIES.includes(body.category)) {
      params.set("category", body.category);
    }

    let searchData: PixabayMusicResponse;
    try {
      const apiRes = await fetch(`https://pixabay.com/api/music/?${params.toString()}`);
      if (!apiRes.ok) {
        return NextResponse.json({ error: `Pixabay API error: ${apiRes.status}` }, { status: 502 });
      }
      searchData = await apiRes.json() as PixabayMusicResponse;
    } catch (err) {
      return NextResponse.json({ error: `Pixabay search failed: ${err instanceof Error ? err.message : err}` }, { status: 502 });
    }

    if (!searchData.hits?.length) {
      return NextResponse.json({ error: "No tracks found for that query", results: 0 }, { status: 404 });
    }

    const track = searchData.hits[0];
    const audioUrl = track.audio ?? track.preview_url;
    if (!audioUrl) {
      return NextResponse.json({ error: "Track has no downloadable audio URL" }, { status: 422 });
    }

    const mood  = body.mood ? sanitizeMusicName(body.mood) : "general";
    const title = sanitizeMusicName(track.title || `pixabay_${track.id}`);
    const filename = `${mood}_${title}.mp3`;
    const dest = path.join(STOCK_DIR, filename);

    try {
      await downloadFile(audioUrl, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 1000) {
        fs.unlinkSync(dest);
        return NextResponse.json({ error: "Downloaded file too small" }, { status: 422 });
      }
      return NextResponse.json({ filename, path: dest, source: "pixabay", title: track.title, duration: track.duration, tags: track.tags });
    } catch (err) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      return NextResponse.json({ error: `Download failed: ${err instanceof Error ? err.message : err}` }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Provide either url (direct download) or query (Pixabay search)" }, { status: 400 });
}
