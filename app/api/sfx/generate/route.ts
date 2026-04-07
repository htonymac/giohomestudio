// POST /api/sfx/generate — AI sound effect generation
// When ElevenLabs SFX API credits are available, generates custom sounds.
// Fallback: matches from local SFX library.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const schema = z.object({
  description: z.string().min(1).max(300), // "crowd cheering in a stadium"
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { description } = parsed.data;
  const sfxDir = path.resolve(env.storagePath, "sfx");

  // Try to match from local SFX files
  if (fs.existsSync(sfxDir)) {
    const files = fs.readdirSync(sfxDir).filter(f => f.endsWith(".mp3") || f.endsWith(".wav"));
    const text = description.toLowerCase();
    const match = files.find(f => {
      const name = f.replace(/\.(mp3|wav)$/, "").replace(/[-_]/g, " ").toLowerCase();
      return text.split(" ").some(w => name.includes(w));
    });
    if (match) {
      return NextResponse.json({
        sfxPath: path.join(sfxDir, match),
        source: "local_library",
        matched: match,
      });
    }
  }

  // TODO: ElevenLabs Sound Effects API (~100 credits per effect)
  // const apiKey = process.env.ELEVENLABS_API_KEY;
  // if (apiKey) { ... generate via API ... }

  return NextResponse.json({
    error: "No matching SFX found locally. Add .mp3/.wav files to storage/sfx/ or configure ElevenLabs for AI generation.",
    suggestion: "Try descriptions like: applause, rain, thunder, car horn, door knock",
  }, { status: 404 });
}
