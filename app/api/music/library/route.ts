// GET  /api/music/library          — list stock music files
// POST /api/music/library          — set a stock track as a project's music

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const STOCK_DIR = () => path.resolve(env.storagePath, "music", "stock");

// Derive a human-readable label + mood from filename (e.g. "epic_cinematic.mp3" → "Epic Cinematic")
function parseMusicFile(filename: string): { label: string; mood: string; filename: string } {
  const base = filename.replace(/\.(mp3|wav|aac)$/i, "");
  const parts = base.split("_");
  const mood  = parts[0] ?? "general";
  const label = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  return { filename, label, mood };
}

export async function GET() {
  const dir = STOCK_DIR();
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ tracks: [] });
  }

  const files = fs.readdirSync(dir)
    .filter(f => /\.(mp3|wav|aac)$/i.test(f) && f !== ".gitkeep")
    .sort()
    .map(parseMusicFile);

  return NextResponse.json({ tracks: files });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { projectId?: string; filename?: string };

  if (!body.projectId || !body.filename) {
    return NextResponse.json({ error: "projectId and filename are required" }, { status: 400 });
  }

  // Validate filename is safe (no path traversal)
  if (body.filename.includes("..") || body.filename.includes("/") || body.filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const trackPath = path.join(STOCK_DIR(), body.filename);
  if (!fs.existsSync(trackPath)) {
    return NextResponse.json({ error: `Track not found: ${body.filename}` }, { status: 404 });
  }

  const project = await prisma.commercialProject.findUnique({
    where: { id: body.projectId },
    select: { id: true, musicPath: true, musicSource: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Delete previously uploaded music (not stock files) when switching to library track
  if (project.musicPath && project.musicSource === "uploaded") {
    try { fs.unlinkSync(project.musicPath); } catch { /* already gone */ }
  }

  await prisma.commercialProject.update({
    where: { id: body.projectId },
    data: { musicPath: trackPath, musicSource: "stock" },
  });

  return NextResponse.json({ musicPath: trackPath, musicSource: "stock", filename: body.filename });
}
