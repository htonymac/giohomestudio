// POST /api/music/generate — AI music generation
// Two tiers:
//   Standard: fal.ai MiniMax Music 2.0 ($0.03/song) — always available if FAL_API_KEY set
//   Premium:  Kie.ai Suno V5 (credit-based) — higher quality, needs KIE_AI_API_KEY
// Fallback: stock library matching (free, always works)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const schema = z.object({
  prompt: z.string().min(1).max(500),           // "Afrobeats party song, upbeat, 30 seconds"
  lyrics: z.string().max(3000).optional(),       // optional lyrics text
  genre: z.string().max(50).optional(),
  mood: z.string().max(50).optional(),
  durationSeconds: z.number().min(5).max(300).optional(),
  instrumental: z.boolean().optional(),          // true = no vocals
  tier: z.enum(["standard", "premium"]).optional(), // default: standard
  title: z.string().max(80).optional(),          // song title (used by Kie.ai)
});

// ── Stock library mood matching (fallback) ──────────────────────────────────

const MOOD_MAP: Record<string, string[]> = {
  epic:       ["epic.mp3", "epic_cinematic.mp3", "epic_orchestral.mp3"],
  calm:       ["calm.mp3", "calm_ambient.mp3"],
  emotional:  ["emotional.mp3", "emotional_piano.mp3"],
  dramatic:   ["dramatic.mp3", "dramatic_orchestral.mp3"],
  upbeat:     ["upbeat.mp3", "upbeat_pop.mp3", "dance.mp3"],
  action:     ["action.mp3", "war.mp3"],
  suspense:   ["suspense.mp3"],
  nature:     ["nature.mp3", "rain.mp3", "heavy_rain.mp3"],
};

function findBestTrack(description: string, mood?: string, genre?: string): string | null {
  const stockDir = path.resolve(env.storagePath, "music", "stock");
  if (!fs.existsSync(stockDir)) return null;
  const text = `${description} ${mood ?? ""} ${genre ?? ""}`.toLowerCase();
  for (const [key, files] of Object.entries(MOOD_MAP)) {
    if (text.includes(key)) {
      for (const f of files) {
        const p = path.join(stockDir, f);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  const all = fs.readdirSync(stockDir).filter(f => f.endsWith(".mp3"));
  if (all.length > 0) return path.join(stockDir, all[Math.floor(Math.random() * all.length)]);
  return null;
}

// ── Save generated music to storage ─────────────────────────────────────────

async function downloadAndSave(audioUrl: string, prefix: string): Promise<string> {
  const outDir = path.join(env.storagePath, "music", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const res = await fetch(audioUrl);
  const outPath = path.join(outDir, `${prefix}_${Date.now()}.mp3`);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));

  // Auto-save to asset library
  try {
    const assetFile = path.join(env.storagePath, "config", "asset-library.json");
    let assets: Array<Record<string, unknown>> = [];
    try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
    assets.unshift({
      id: `music_ai_${Date.now()}`,
      type: "music",
      name: `AI Music — ${prefix}`,
      filePath: outPath,
      tags: ["music", "ai-generated", prefix],
      source: prefix,
      createdAt: new Date().toISOString(),
    });
    fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
  } catch { /* best effort */ }

  return outPath;
}

// ── Provider: fal.ai MiniMax Music 2.0 (Standard tier) ──────────────────────

async function generateFalMinimax(
  prompt: string,
  lyrics?: string,
  instrumental?: boolean,
): Promise<{ musicPath: string; provider: string } | null> {
  const FAL_KEY = process.env.FAL_API_KEY;
  if (!FAL_KEY) return null;

  try {
    // Build lyrics prompt
    let lyricsPrompt = lyrics ?? "";
    if (!lyricsPrompt && !instrumental) {
      // Auto-generate simple lyrics structure from prompt
      lyricsPrompt = `[verse]\n${prompt}\n[chorus]\nFeel the vibe, feel the energy`;
    }
    if (instrumental) {
      lyricsPrompt = "[instrumental]";
    }

    const res = await fetch("https://queue.fal.run/fal-ai/minimax-music/v2", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.slice(0, 300),
        lyrics_prompt: lyricsPrompt.slice(0, 3000),
        audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" },
      }),
    });

    if (!res.ok) {
      console.warn(`[music] fal.ai MiniMax returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const audioUrl = data.audio?.url;
    if (!audioUrl) return null;

    const musicPath = await downloadAndSave(audioUrl, "minimax");
    return { musicPath, provider: "fal_ai/minimax-music-v2" };
  } catch (e) {
    console.warn("[music] fal.ai MiniMax failed:", e);
    return null;
  }
}

// ── Provider: Kie.ai Suno V5 (Premium tier) ─────────────────────────────────

async function generateKieAiSuno(
  prompt: string,
  lyrics?: string,
  instrumental?: boolean,
  genre?: string,
  title?: string,
): Promise<{ musicPath: string; provider: string } | null> {
  const KIE_KEY = env.music.kieAiApiKey;
  if (!KIE_KEY) return null;

  try {
    const isCustom = !!(lyrics || genre || title);

    const body: Record<string, unknown> = {
      prompt: isCustom ? (lyrics ?? prompt) : prompt.slice(0, 500),
      customMode: isCustom,
      instrumental: instrumental ?? false,
      model: "V5",
    };

    if (isCustom) {
      body.style = genre ?? "Pop";
      body.title = title ?? "Untitled";
    }

    // Submit generation job
    const res = await fetch("https://api.kie.ai/api/v1/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[music] Kie.ai returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const taskId = data.data?.taskId;
    if (!taskId) return null;

    // Poll for completion (max 2 minutes)
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const pollRes = await fetch(`https://api.kie.ai/api/v1/task/${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_KEY}` },
      });

      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();

      if (pollData.data?.status === "complete" || pollData.data?.callbackType === "complete") {
        const tracks = pollData.data?.data ?? pollData.data?.tracks ?? [];
        const audioUrl = tracks[0]?.audio_url;
        if (audioUrl) {
          const musicPath = await downloadAndSave(audioUrl, "suno_v5");
          return { musicPath, provider: "kie_ai/suno-v5" };
        }
      }

      if (pollData.data?.status === "failed") {
        console.warn("[music] Kie.ai task failed:", pollData);
        return null;
      }
    }

    console.warn("[music] Kie.ai task timed out after 2 minutes");
    return null;
  } catch (e) {
    console.warn("[music] Kie.ai failed:", e);
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { prompt, lyrics, mood, genre, durationSeconds, instrumental, tier, title } = parsed.data;
  const fullPrompt = [prompt, mood && `mood: ${mood}`, genre && `genre: ${genre}`, durationSeconds && `${durationSeconds} seconds`].filter(Boolean).join(", ");

  // ── Premium tier: Kie.ai Suno V5 ──
  if (tier === "premium") {
    const result = await generateKieAiSuno(fullPrompt, lyrics, instrumental, genre, title);
    if (result) {
      return NextResponse.json({
        musicPath: result.musicPath,
        source: "ai_premium",
        provider: result.provider,
        tier: "premium",
        description: `Premium AI music (Suno V5): ${prompt}`,
      });
    }
    // Fall through to standard if premium fails
    console.warn("[music] Premium tier failed, falling back to standard");
  }

  // ── Standard tier: fal.ai MiniMax Music ──
  const falResult = await generateFalMinimax(fullPrompt, lyrics, instrumental);
  if (falResult) {
    return NextResponse.json({
      musicPath: falResult.musicPath,
      source: "ai_standard",
      provider: falResult.provider,
      tier: "standard",
      description: `AI music (MiniMax): ${prompt}`,
    });
  }

  // ── Fallback: stock library ──
  const trackPath = findBestTrack(fullPrompt, mood, genre);
  if (trackPath) {
    return NextResponse.json({
      musicPath: trackPath,
      source: "stock_match",
      provider: "stock_library",
      tier: "free",
      description: `Stock library match: ${prompt}`,
    });
  }

  return NextResponse.json({
    error: "No music provider available. Set FAL_API_KEY (standard) or KIE_AI_API_KEY (premium) in .env, or add stock tracks to storage/music/stock/",
  }, { status: 503 });
}
