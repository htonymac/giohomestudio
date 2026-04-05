// POST /api/character-voices/[id]/generate-images
// Generates a character reference image for one angle using ComfyUI + Flux.1,
// saves the result to storage, and updates the referenceImages DB field.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { generateCharacterImage, isComfyUIOnline } from "@/modules/comfyui";
import { VALID_ANGLES, ANGLE_LABELS } from "@/config/character-angles";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as {
    angle?: string;
    prompt?: string;
    seed?: number;
  };

  if (!body.angle || !VALID_ANGLES.has(body.angle)) {
    return NextResponse.json(
      { error: `angle must be one of: ${[...VALID_ANGLES].join(", ")}` },
      { status: 400 }
    );
  }

  const character = await prisma.characterVoice.findUnique({ where: { id } });
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const description = body.prompt?.trim() || character.visualDescription;
  if (!description) {
    return NextResponse.json(
      { error: "No visual description. Add one to the character profile before generating." },
      { status: 422 }
    );
  }

  if (!(await isComfyUIOnline())) {
    return NextResponse.json(
      {
        error: "ComfyUI is offline. Start it with: python main.py --listen 127.0.0.1 --port 8188 --cpu",
        hint: "Run from C:\\Users\\USER\\ComfyUI\\",
      },
      { status: 503 }
    );
  }

  try {
    const result = await generateCharacterImage({
      characterDescription: description,
      angle: body.angle,
      seed:  body.seed,
    });

    // Save PNG to storage/characters/[id]/[angle].png
    const dir      = path.join(env.storagePath, "characters", id);
    const filename = `${body.angle}.png`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), result.imageBuffer);

    const url = `/api/media/characters/${id}/${filename}`;

    // Merge into referenceImages — replace same angle if already present
    const current = Array.isArray(character.referenceImages)
      ? (character.referenceImages as { url: string; angle: string; label: string }[])
      : [];
    const updated = current.filter(r => r.angle !== body.angle);
    updated.push({ url, angle: body.angle, label: ANGLE_LABELS[body.angle] ?? body.angle });

    const voice = await prisma.characterVoice.update({
      where: { id },
      data:  { referenceImages: updated },
    });

    return NextResponse.json({ voice, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
