// POST /api/upload/logo — upload logo/image for overlay use
import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
  if (!allowed.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPEG, WebP, SVG allowed" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? ".png" : file.type === "image/svg+xml" ? ".svg" : file.type === "image/webp" ? ".webp" : ".jpg";
  const dir = path.join(env.storagePath, "uploads");
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `logo_${Date.now()}${ext}`;
  const filePath = path.join(dir, fileName);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeMedia(filePath, buf);

  return NextResponse.json({ filePath, fileName, size: buf.length });
}
