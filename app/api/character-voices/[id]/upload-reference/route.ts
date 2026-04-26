// POST /api/character-voices/[id]/upload-reference
// Uploads one reference image for a specific angle slot and updates the
// character's referenceImages JSON array in the database.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { VALID_ANGLES, ANGLE_LABELS } from "@/config/character-angles";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
  "image/gif":  ".gif",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = await prisma.characterVoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const angle = formData.get("angle") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!angle || !VALID_ANGLES.has(angle)) {
    return NextResponse.json({ error: `angle must be one of: ${[...VALID_ANGLES].join(", ")}` }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP or GIF allowed" }, { status: 400 });
  }

  const ext = EXT_MAP[file.type] ?? ".jpg";
  const filename = `${angle}${ext}`;
  const dir = path.join(env.storagePath, "characters", id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  const url = `/api/media/characters/${id}/${filename}`;

  // Merge into referenceImages array — replace same angle if exists
  const current = Array.isArray(existing.referenceImages) ? (existing.referenceImages as {url:string,angle:string,label:string}[]) : [];
  const updated = current.filter(r => r.angle !== angle);
  updated.push({ url, angle, label: ANGLE_LABELS[angle] ?? angle });

  const voice = await prisma.characterVoice.update({
    where: { id },
    data: { referenceImages: updated },
  });

  return NextResponse.json({ voice, url });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { angle } = await req.json().catch(() => ({}));

  const existing = await prisma.characterVoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = Array.isArray(existing.referenceImages) ? (existing.referenceImages as {url:string,angle:string,label:string}[]) : [];
  const updated = current.filter(r => r.angle !== angle);

  const voice = await prisma.characterVoice.update({
    where: { id },
    data: { referenceImages: updated },
  });

  return NextResponse.json({ voice });
}
