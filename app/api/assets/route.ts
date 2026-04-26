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

  // Auto-seed trimmed/mixed music
  const hasTrimmed = assets.some(a => a.source === "auto_trimmed");
  if (!hasTrimmed) {
    for (const subdir of ["trimmed", "mixed", "generated"]) {
      const dir = path.resolve(env.storagePath, "music", subdir);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3") || f.endsWith(".wav"));
        for (const f of files) {
          const name = f.replace(/\.(mp3|wav)$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          assets.push({
            id: `${subdir}_${f}`,
            type: "music",
            name: `${subdir === "trimmed" ? "Trimmed" : subdir === "mixed" ? "Mixed" : "AI"}: ${name}`,
            description: `${subdir} music track`,
            filePath: path.join(dir, f),
            tags: ["music", subdir],
            source: `auto_${subdir}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    if (assets.some(a => a.source?.startsWith("auto_"))) saveAssets(assets);
  }

  // Auto-seed generated images
  const hasGenImages = assets.some(a => a.source === "auto_gen_images");
  if (!hasGenImages) {
    const imgDir = path.resolve(env.storagePath, "images");
    if (fs.existsSync(imgDir)) {
      const files = fs.readdirSync(imgDir).filter(f => (f.endsWith(".png") || f.endsWith(".jpg")) && f.startsWith("gen_"));
      for (const f of files) {
        assets.push({
          id: `genimg_${f}`,
          type: "image",
          name: f.replace(/\.(png|jpg)$/, "").replace(/gen_/, "Generated "),
          description: "AI-generated image",
          filePath: path.join(imgDir, f),
          tags: ["image", "generated"],
          source: "auto_gen_images",
          createdAt: new Date().toISOString(),
        });
      }
      if (files.length > 0) saveAssets(assets);
    }
  }

  // Auto-seed scene videos (storage/videos/) — sync on every request so new clips appear immediately
  {
    const videosDir = path.resolve(env.storagePath, "videos");
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir)
        .filter(f => f.endsWith(".mp4"))
        .sort((a, b) => {
          // Sort by timestamp embedded in filename (scene_SC01_1234567890.mp4)
          const ta = parseInt(a.match(/(\d{10,})/)?.[1] ?? "0");
          const tb = parseInt(b.match(/(\d{10,})/)?.[1] ?? "0");
          return tb - ta; // newest first
        });
      let changed = false;
      for (const f of files) {
        const id = `scene_vid_${f}`;
        if (assets.some(a => a.id === id)) continue; // already in library
        // Build a clean display name from the filename
        // scene_SC01_1776292452097.mp4 → "Scene SC01 · Setting Out" (sceneId only)
        const sceneIdMatch = f.match(/scene_(SC\d+[^_]*)/i);
        const sceneId = sceneIdMatch ? sceneIdMatch[1].replace(/_/g, " ") : f.replace(/\.mp4$/, "");
        const ts = parseInt(f.match(/(\d{10,})/)?.[1] ?? "0");
        const dateStr = ts ? new Date(ts).toLocaleDateString() : "";
        assets.push({
          id,
          type: "video",
          name: `Scene ${sceneId}${dateStr ? " · " + dateStr : ""}`,
          description: `Generated scene clip — ${f}`,
          filePath: path.join(videosDir, f),
          tags: ["video", "scene", sceneId.toLowerCase().replace(/\s+/g, "-")],
          source: "scene_generated",
          createdAt: ts ? new Date(ts).toISOString() : new Date().toISOString(),
        });
        changed = true;
      }
      if (changed) saveAssets(assets);
    }
  }

  // Auto-seed merged videos
  const hasMerged = assets.some(a => a.source === "auto_merged");
  if (!hasMerged) {
    const mergedDir = path.resolve(env.storagePath, "merged");
    if (fs.existsSync(mergedDir)) {
      const files = fs.readdirSync(mergedDir).filter(f => f.endsWith(".mp4")).slice(0, 20); // limit to 20 most recent
      for (const f of files) {
        assets.push({
          id: `merged_${f}`,
          type: "video",
          name: f.replace(/\.mp4$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          description: "Rendered video",
          filePath: path.join(mergedDir, f),
          tags: ["video", "rendered"],
          source: "auto_merged",
          createdAt: new Date().toISOString(),
        });
      }
      if (files.length > 0) saveAssets(assets);
    }
  }

  // Sort by newest first
  assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const assets = loadAssets();
  const filtered = assets.filter(a => a.id !== id);
  if (filtered.length === assets.length) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  saveAssets(filtered);
  return NextResponse.json({ ok: true });
}
