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
