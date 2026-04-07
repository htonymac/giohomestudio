// GET  /api/assets — list saved assets (images, music, videos, actors)
// POST /api/assets — save a new asset to the library

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const ASSETS_FILE = () => path.resolve(env.storagePath, "config", "asset-library.json");

export interface AssetEntry {
  id: string;
  type: "image" | "video" | "music" | "sfx" | "actor";
  name: string;
  description: string;
  filePath: string;
  thumbnailPath?: string;
  tags: string[];
  source: string;      // "generated", "uploaded", "trimmed", "stock"
  provider?: string;    // "segmind", "fal", "piper", etc.
  createdAt: string;
}

function loadAssets(): AssetEntry[] {
  try { return JSON.parse(fs.readFileSync(ASSETS_FILE(), "utf-8")); } catch { return []; }
}

function saveAssets(assets: AssetEntry[]) {
  const dir = path.dirname(ASSETS_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ASSETS_FILE(), JSON.stringify(assets, null, 2));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const search = searchParams.get("search");

  let assets = loadAssets();

  // Auto-seed stock music into library on first request
  const hasStockMusic = assets.some(a => a.source === "stock_music");
  if (!hasStockMusic) {
    const stockDir = path.resolve(env.storagePath, "music", "stock");
    if (fs.existsSync(stockDir)) {
      const files = fs.readdirSync(stockDir).filter(f => f.endsWith(".mp3") && f !== ".gitkeep");
      for (const f of files) {
        const name = f.replace(/\.mp3$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        assets.push({
          id: `stock_${f}`,
          type: "music",
          name,
          description: `Stock music track — ${name}`,
          filePath: path.join(stockDir, f),
          tags: ["stock", "music", name.split(" ")[0].toLowerCase()],
          source: "stock_music",
          createdAt: new Date().toISOString(),
        });
      }
      saveAssets(assets);
    }
  }

  // Auto-seed SFX files
  const hasSfx = assets.some(a => a.source === "stock_sfx");
  if (!hasSfx) {
    const sfxDir = path.resolve(env.storagePath, "sfx");
    if (fs.existsSync(sfxDir)) {
      const files = fs.readdirSync(sfxDir).filter(f => f.endsWith(".mp3") || f.endsWith(".wav"));
      for (const f of files) {
        const name = f.replace(/\.(mp3|wav)$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        assets.push({
          id: `sfx_${f}`,
          type: "sfx",
          name,
          description: `Sound effect — ${name}`,
          filePath: path.join(sfxDir, f),
          tags: ["sfx", "stock"],
          source: "stock_sfx",
          createdAt: new Date().toISOString(),
        });
      }
      saveAssets(assets);
    }
  }

  if (type) assets = assets.filter(a => a.type === type);
  if (search) assets = assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return NextResponse.json({ assets });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !body.type || !body.filePath) {
    return NextResponse.json({ error: "name, type, and filePath are required" }, { status: 400 });
  }

  const asset: AssetEntry = {
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: body.type,
    name: body.name,
    description: body.description ?? "",
    filePath: body.filePath,
    thumbnailPath: body.thumbnailPath,
    tags: body.tags ?? [],
    source: body.source ?? "generated",
    provider: body.provider,
    createdAt: new Date().toISOString(),
  };

  const assets = loadAssets();
  assets.unshift(asset);
  saveAssets(assets);

  return NextResponse.json(asset, { status: 201 });
}
