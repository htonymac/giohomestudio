// POST /api/asset-library — save a finished content piece to the asset library
// Used by children-planner, hybrid-planner, and other planners after both reviews pass.
// Payload: { title, type, videoUrl, status, metadata }
// Returns: { id, success, asset }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

interface StoredAsset {
  id: string;
  type: string;
  name: string;
  description: string;
  filePath: string;
  thumbnailPath?: string;
  tags: string[];
  source: string;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ASSETS_FILE = () => path.resolve(env.storagePath, "config", "asset-library.json");

function loadAssets(): StoredAsset[] {
  try { return JSON.parse(fs.readFileSync(ASSETS_FILE(), "utf-8")); } catch { return []; }
}

function saveAssets(assets: StoredAsset[]) {
  const dir = path.dirname(ASSETS_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ASSETS_FILE(), JSON.stringify(assets, null, 2));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body.title as string) || "";
  const type = (body.type as string) || "video";
  const videoUrl = (body.videoUrl as string) || "";
  const status = (body.status as string) || "saved";
  const metadata = (body.metadata as Record<string, unknown>) || {};

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const asset: StoredAsset = {
    id,
    type,
    name: title,
    description: `${type} — ${status}`,
    filePath: videoUrl,
    tags: [type, status, ...(metadata.contentType ? [String(metadata.contentType)] : [])],
    source: "planner_output",
    status,
    metadata,
    createdAt: new Date().toISOString(),
  };

  const assets = loadAssets();
  assets.unshift(asset);
  saveAssets(assets);

  return NextResponse.json({ id, success: true, asset }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  let assets = loadAssets();
  if (type) assets = assets.filter(a => a.type === type);
  assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ assets });
}
