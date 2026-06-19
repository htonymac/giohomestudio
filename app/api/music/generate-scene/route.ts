// POST /api/music/generate-scene — Generate music segment for a specific scene
// Uses the scene's mood, action level, and duration to create matching music
// Shorter and cheaper than full song generation — 5-15 seconds per scene

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";

// Scene mood → music style mapping
const MOOD_MUSIC_MAP: Record<string, { style: string; lyrics: string }> = {
  "suspense":    { style: "Dark suspenseful orchestral, tension building, minor key, slow tempo", lyrics: "[instrumental]" },
  "heroic":      { style: "Epic heroic orchestral, brass fanfare, powerful drums, major key", lyrics: "[instrumental]" },
  "emotional":   { style: "Emotional piano, gentle strings, melancholic, reflective", lyrics: "[instrumental]" },
  "action":      { style: "Intense action percussion, fast tempo, driving rhythm, adrenaline", lyrics: "[instrumental]" },
  "calm":        { style: "Calm ambient, soft pads, gentle melody, peaceful atmosphere", lyrics: "[instrumental]" },
  "dark":        { style: "Dark brooding, low drone, ominous atmosphere, tension", lyrics: "[instrumental]" },
  "joyful":      { style: "Bright happy melody, playful rhythm, cheerful, uplifting", lyrics: "[instrumental]" },
  "romantic":    { style: "Romantic strings, soft piano, warm harmony, love theme", lyrics: "[instrumental]" },
  "mystery":     { style: "Mysterious atmospheric, ethereal pads, curious melody", lyrics: "[instrumental]" },
  "children":    { style: "Fun children melody, bright bouncy, safe playful rhythm, nursery style", lyrics: "[instrumental]" },
  "african":     { style: "African percussion, talking drums, afrobeat rhythm, warm energy", lyrics: "[instrumental]" },
  "cinematic":   { style: "Cinematic orchestral, sweeping strings, epic atmosphere", lyrics: "[instrumental]" },
  "transition":  { style: "Subtle transition ambience, soft pad swell, gentle movement", lyrics: "[instrumental]" },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sceneId, sceneNumber, mood, musicStyle, intensity, durationSeconds, sceneType, genre, tone } = body;
    // UI sends sceneId (hybrid planner) — route also accepts legacy sceneNumber for compat

    const dur = durationSeconds ?? 10;
    const moodKey = (mood ?? "cinematic").toLowerCase();
    const mapping = MOOD_MUSIC_MAP[moodKey] ?? MOOD_MUSIC_MAP["cinematic"];

    // Adjust prompt based on scene type (hybrid doctrine)
    let prompt = musicStyle ?? mapping.style;
    if (genre) prompt += `, ${genre}`;
    if (tone) prompt += `, ${tone} tone`;
    if (sceneType === "image-led") prompt += ", background music bed, subtle, supportive";
    if (sceneType === "video-led") prompt += ", dynamic, drives the action, energetic";
    if (sceneType === "audio-bridge") prompt += ", atmospheric transition, ambient, flowing";
    if (intensity === "low") prompt += ", very quiet, minimal, barely there";
    if (intensity === "high") prompt += ", powerful, intense, full orchestra";

    const FAL_KEY = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
    if (!FAL_KEY) {
      return NextResponse.json({ error: "FAL_API_KEY not set" }, { status: 503 });
    }

    // Migrated to providers/fal adapter (Henry 2026-05-30 task #28).
    const { falMinimaxMusic } = await import("@/lib/providers/fal");
    const r = await falMinimaxMusic({ prompt, lyricsPrompt: mapping.lyrics });
    if (!r.ok) {
      return NextResponse.json({ error: `MiniMax returned ${r.status}` }, { status: 502 });
    }

    const audioUrl = r.data.audio?.url;
    if (!audioUrl) {
      return NextResponse.json({ error: "No audio returned" }, { status: 502 });
    }

    // Download and trim to scene duration
    const audioRes = await fetch(audioUrl);
    const outDir = path.join(env.storagePath, "music", "scene");
    fs.mkdirSync(outDir, { recursive: true });
    const fileKey = sceneId ? sceneId.replace(/[^a-zA-Z0-9_-]/g, "") : `n${sceneNumber ?? "x"}`;
    const outPath = path.join(outDir, `scene_${fileKey}_${Date.now()}.mp3`);
    await writeMedia(outPath, Buffer.from(await audioRes.arrayBuffer()));

    const relPath = outPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
    return NextResponse.json({
      outputUrl: `/api/media/${relPath}`,
      sceneId: sceneId ?? null,
      sceneNumber: sceneNumber ?? null,
      mood: moodKey,
      duration: dur,
      credits: 1,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
