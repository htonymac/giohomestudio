// POST /api/commercial/projects/[id]/music  — upload a music file for the project
// DELETE /api/commercial/projects/[id]/music — remove music (resets to auto-generate)

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac"]);
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({ where: { id }, select: { id: true, musicPath: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("music") as File | null;
  if (!file) return NextResponse.json({ error: "No music file provided" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}. Use MP3, WAV, or AAC.` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 30 MB.` }, { status: 413 });
  }

  const musicDir = path.join(env.storagePath, "music", "commercial");
  fs.mkdirSync(musicDir, { recursive: true });

  // Delete previous uploaded music for this project if it exists
  if (project.musicPath) {
    try { fs.unlinkSync(project.musicPath); } catch { /* already gone */ }
  }

  const ext = file.name.endsWith(".wav") ? ".wav" : file.name.endsWith(".aac") ? ".aac" : ".mp3";
  const fileName = `project_${id}_${Date.now()}${ext}`;
  const destPath = path.join(musicDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  await prisma.commercialProject.update({
    where: { id },
    data: { musicPath: destPath, musicSource: "uploaded" },
  });

  return NextResponse.json({ musicPath: destPath, musicFileName: file.name, musicSource: "uploaded" });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({ where: { id }, select: { musicPath: true, musicSource: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Only delete uploaded files — never delete stock library files
  if (project.musicPath && project.musicSource === "uploaded") {
    try { fs.unlinkSync(project.musicPath); } catch { /* already gone */ }
  }

  await prisma.commercialProject.update({
    where: { id },
    data: { musicPath: null, musicSource: null },
  });

  return NextResponse.json({ ok: true });
}
