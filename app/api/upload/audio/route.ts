import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const dir = path.join(env.storagePath, "audio", "narration");
  fs.mkdirSync(dir, { recursive: true });

  const name = `narr_${Date.now()}.mp3`;
  const filePath = path.join(dir, name);
  await fs.promises.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/api/media/audio/narration/${name}`, path: filePath });
}
