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

  // ElevenLabs Sound Effects API (~100 credits per effect)
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (apiKey) {
    try {
      const axios = (await import("axios")).default;
      const res = await axios.post("https://api.elevenlabs.io/v1/sound-generation", {
        text: description,
        duration_seconds: 3,
      }, {
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const sfxDir = path.resolve(env.storagePath, "sfx");
      fs.mkdirSync(sfxDir, { recursive: true });
      const outPath = path.join(sfxDir, `ai_${Date.now()}.mp3`);
      fs.writeFileSync(outPath, Buffer.from(res.data));

      // Auto-save to asset library
      try {
        const assetFile = path.join(env.storagePath, "config", "asset-library.json");
        let assets: Array<Record<string, unknown>> = [];
        try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
        assets.unshift({
          id: `sfx_ai_${Date.now()}`,
          type: "sfx",
          name: description.slice(0, 50),
          description: `AI-generated SFX: ${description}`,
          filePath: outPath,
          tags: ["sfx", "ai-generated", "elevenlabs"],
          source: "elevenlabs_sfx",
          createdAt: new Date().toISOString(),
        });
        fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
      } catch { /* best effort */ }

      return NextResponse.json({ sfxPath: outPath, source: "elevenlabs_ai", matched: `AI: ${description}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SFX] ElevenLabs generation failed: ${msg}`);
      // Fall through to not-found
    }
  }

  return NextResponse.json({
    error: "No matching SFX found. Add .mp3/.wav files to storage/sfx/ or configure ElevenLabs API key for AI generation.",
    suggestion: "Try descriptions like: applause, rain, thunder, car horn, door knock",
  }, { status: 404 });
}
