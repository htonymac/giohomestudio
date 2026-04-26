// POST /api/music-video/analyze
// Music Video Intelligence Layer — 7 engines between audio and generation
//
// Engine 1: Music Analysis — BPM, energy, mood, genre, danceability (AI)
// Engine 2: Beat Mapping — beat points, drops, peaks, silence (code logic)
// Engine 3: Section Planner — intro/verse/chorus/bridge/outro (AI)
// Engine 4: Dance & Motion Intelligence — dance family, intensity, camera (AI)
// Engine 5: Recommendation Layer — best video mode, dance type, style (code logic)
// Engine 6: Motionboard — energy curve over time (code logic)
// Engine 7: Review data package — everything for user approval
//
// Input: song info (title, genre, lyrics, duration), optional audio metadata
// Output: full music video intelligence profile

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { makeCacheKey, getCached, setCache } from "@/lib/intelligence-cache";

// ── Engine 1: Music Analysis (AI-powered) ───────────────────────────────────

const ANALYSIS_SYSTEM = `You are a professional music analyst and music video director. Analyze the song description and return a structured music profile.

Return ONLY valid JSON:
{
  "bpm": 120,
  "energy": "high",
  "mood": "energetic",
  "genre": "Afrobeats",
  "danceability": 0.85,
  "commercialPotential": 0.7,
  "artisticDepth": 0.6,
  "sections": [
    { "name": "intro", "startPercent": 0, "endPercent": 8, "energy": "low", "description": "Soft opening" },
    { "name": "verse1", "startPercent": 8, "endPercent": 25, "energy": "medium", "description": "..." },
    { "name": "chorus", "startPercent": 25, "endPercent": 40, "energy": "high", "description": "..." },
    { "name": "verse2", "startPercent": 40, "endPercent": 55, "energy": "medium", "description": "..." },
    { "name": "chorus2", "startPercent": 55, "endPercent": 70, "energy": "high", "description": "..." },
    { "name": "bridge", "startPercent": 70, "endPercent": 82, "energy": "medium-low", "description": "..." },
    { "name": "finalChorus", "startPercent": 82, "endPercent": 95, "energy": "very-high", "description": "..." },
    { "name": "outro", "startPercent": 95, "endPercent": 100, "energy": "low", "description": "..." }
  ],
  "hookMoments": [25, 55, 82],
  "dropPoints": [40],
  "silenceGaps": [],
  "emotionalSpikes": [55, 85],
  "performanceStyle": "confident and stylish",
  "bestVideoMode": "dance + performance hybrid"
}`;

// ── Engine 4: Dance & Motion Intelligence (AI-powered) ──────────────────────

const DANCE_SYSTEM = `You are a dance choreographer and music video motion director. Given a music profile, recommend the best dance and motion approach.

Return ONLY valid JSON:
{
  "bestDanceFamily": "Afrobeat groove",
  "movementIntensity": "medium-high",
  "cameraStyle": "dynamic tracking with beat-synced cuts",
  "chorusEnergy": "fast rhythm cuts, full-body dance",
  "verseEnergy": "medium groove, upper-body focus",
  "bridgeEnergy": "slow, emotional, minimal movement",
  "bodyFocus": "full body for chorus, upper body for verse",
  "soloVsCrowd": "solo with crowd cuts in chorus",
  "danceFamilies": ["Afrobeat groove", "Hype performance"],
  "movementSuggestions": [
    { "section": "chorus", "movement": "Strong bounce rhythm, confident arm gestures", "camera": "Medium shot, slight orbit" },
    { "section": "verse", "movement": "Casual groove, head nods, shoulder movement", "camera": "Close-up, slow glide" },
    { "section": "bridge", "movement": "Slow expressive sway, emotional gestures", "camera": "Wide, static hold" }
  ],
  "signatureMove": "Recurring bounce-step pattern during hook"
}`;

// ── Engine 2: Beat Mapping (non-AI, code logic) ─────────────────────────────

interface Section { name: string; startPercent: number; endPercent: number; energy: string; description: string }

function generateBeatMap(bpm: number, durationSec: number, sections: Section[]) {
  const beatInterval = 60 / bpm; // seconds per beat
  const totalBeats = Math.floor(durationSec / beatInterval);
  const beats: Array<{ time: number; strength: string; section: string }> = [];

  for (let i = 0; i < totalBeats; i++) {
    const time = i * beatInterval;
    const percent = (time / durationSec) * 100;
    const section = sections.find(s => percent >= s.startPercent && percent < s.endPercent);
    const isDownbeat = i % 4 === 0;
    const isHalfBar = i % 8 === 0;

    beats.push({
      time: Math.round(time * 100) / 100,
      strength: isHalfBar ? "strong" : isDownbeat ? "medium" : "weak",
      section: section?.name ?? "unknown",
    });
  }

  // Cut points (every 4 bars or section change)
  const cutPoints: number[] = [];
  for (let i = 0; i < totalBeats; i += 16) {
    cutPoints.push(Math.round(i * beatInterval * 100) / 100);
  }
  sections.forEach(s => cutPoints.push(Math.round(s.startPercent * durationSec / 100)));

  return { beats: beats.length, beatInterval, cutPoints: [...new Set(cutPoints)].sort((a, b) => a - b) };
}

// ── Engine 5: Recommendation Layer (non-AI, code logic) ─────────────────────

function generateRecommendations(analysis: Record<string, unknown>) {
  const danceability = (analysis.danceability as number) ?? 0.5;
  const energy = (analysis.energy as string) ?? "medium";
  const mood = (analysis.mood as string) ?? "neutral";
  const genre = (analysis.genre as string) ?? "";

  let bestMode = "official";
  let bestDance = "performance";
  let bestPacing = "medium";

  if (danceability > 0.7) { bestMode = "dance + performance hybrid"; bestDance = "Afrobeat groove"; bestPacing = "medium-fast"; }
  else if (danceability > 0.4) { bestMode = "performance"; bestDance = "light groove"; bestPacing = "medium"; }
  else { bestMode = "lyric + story"; bestDance = "minimal movement"; bestPacing = "slow"; }

  if (mood.includes("worship") || mood.includes("spiritual")) { bestMode = "lyric + emotional performance"; bestDance = "worship expressive"; bestPacing = "slow-medium"; }
  if (genre.toLowerCase().includes("children") || genre.toLowerCase().includes("kids")) { bestMode = "children learning"; bestDance = "simple repeatable gestures"; bestPacing = "clear and controlled"; }
  if ((analysis.commercialPotential as number) > 0.7) { bestMode += " + commercial cut"; }

  // Best AI model suggestion based on content type
  let suggestedModel = "kling2";
  if (bestMode.includes("dance")) suggestedModel = "seedance";
  else if (bestMode.includes("cinematic") || bestMode.includes("story")) suggestedModel = "kling3-pro";
  else if (bestMode.includes("children")) suggestedModel = "wan25";
  else if (bestMode.includes("commercial")) suggestedModel = "kling2";

  return {
    bestVideoMode: bestMode,
    bestDanceType: bestDance,
    bestPacing,
    suggestedModel,
    suggestedOutputs: [
      "Full music video",
      danceability > 0.6 ? "30-second dance teaser" : "30-second highlight reel",
      "Vertical social cut (9:16)",
    ],
    sceneCount: energy === "high" ? "6-8 scenes" : energy === "low" ? "3-5 scenes" : "5-7 scenes",
  };
}

// ── Engine 6: Motionboard (non-AI, code logic) ──────────────────────────────

function generateMotionboard(sections: Section[]) {
  return sections.map(s => {
    const energyLevel = s.energy === "very-high" ? 5 : s.energy === "high" ? 4 : s.energy === "medium-high" ? 3.5 : s.energy === "medium" ? 3 : s.energy === "medium-low" ? 2 : s.energy === "low" ? 1 : 2.5;

    return {
      section: s.name,
      startPercent: s.startPercent,
      endPercent: s.endPercent,
      energyLevel,
      visualIntensity: energyLevel > 3.5 ? "high — fast cuts, dynamic camera" : energyLevel > 2 ? "medium — balanced pacing" : "low — slow, steady shots",
      dancePresence: energyLevel > 3 ? "active dance" : energyLevel > 2 ? "light movement" : "minimal/none",
      cameraMotion: energyLevel > 4 ? "aggressive tracking, beat punches" : energyLevel > 2.5 ? "smooth glide, medium movement" : "static or slow pan",
      captionBehavior: s.name.includes("chorus") ? "key lines emphasis" : s.name.includes("verse") ? "full lyrics if available" : "minimal or none",
      transitionStyle: s.name.includes("chorus") ? "hard cut on beat" : s.name.includes("bridge") ? "slow dissolve" : "smooth cut",
    };
  });
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { songTitle, genre, mood, lyrics, durationSeconds, videoMode } = body;

    if (!songTitle && !genre && !mood) {
      return NextResponse.json({ error: "Provide at least a song title, genre, or mood" }, { status: 400 });
    }

    const dur = durationSeconds ?? 180; // default 3 min

    // ═══ Check intelligence cache ═══
    const cacheKey = makeCacheKey({ type: "music-video", genre, mood, energy: mood, style: videoMode });
    const cached = getCached(cacheKey) as Record<string, unknown> | null;
    // If cached skeleton exists, use it for recommendations + motionboard (skip AI calls for those)
    // But ALWAYS run music analysis fresh since each song is different
    const songDesc = [
      songTitle && `Title: ${songTitle}`,
      genre && `Genre: ${genre}`,
      mood && `Mood: ${mood}`,
      lyrics && `Lyrics excerpt: ${lyrics.slice(0, 300)}`,
      `Duration: ${dur} seconds`,
      videoMode && `Intended video mode: ${videoMode}`,
    ].filter(Boolean).join("\n");

    // ═══ ENGINE 1: Music Analysis (AI) ═══
    const analysisResult = await callLLM(
      `Analyze this song for music video planning:\n\n${songDesc}`,
      ANALYSIS_SYSTEM,
      { role: "creative", maxTokens: 1200, temperature: 0.5 },
    );

    let analysis: Record<string, unknown> = { bpm: 120, energy: "medium", mood: mood ?? "neutral", genre: genre ?? "unknown", danceability: 0.5, sections: [], hookMoments: [], dropPoints: [] };
    if (analysisResult.ok) {
      const match = analysisResult.text.match(/\{[\s\S]*\}/);
      if (match) try { analysis = JSON.parse(match[0]); } catch { /* use defaults */ }
    }

    const sections = (analysis.sections as Section[]) ?? [
      { name: "intro", startPercent: 0, endPercent: 10, energy: "low", description: "Opening" },
      { name: "verse1", startPercent: 10, endPercent: 30, energy: "medium", description: "First verse" },
      { name: "chorus", startPercent: 30, endPercent: 45, energy: "high", description: "Main chorus" },
      { name: "verse2", startPercent: 45, endPercent: 60, energy: "medium", description: "Second verse" },
      { name: "chorus2", startPercent: 60, endPercent: 75, energy: "high", description: "Chorus repeat" },
      { name: "bridge", startPercent: 75, endPercent: 87, energy: "medium-low", description: "Bridge" },
      { name: "outro", startPercent: 87, endPercent: 100, energy: "low", description: "Closing" },
    ];

    // ═══ ENGINE 2: Beat Mapping (non-AI) ═══
    const bpm = (analysis.bpm as number) ?? 120;
    const beatMap = generateBeatMap(bpm, dur, sections);

    // ═══ ENGINE 3: Section Planner (from analysis) ═══
    // Already done by Engine 1 — sections are in the analysis

    // ═══ ENGINE 4: Dance & Motion Intelligence (AI) ═══
    const danceResult = await callLLM(
      `Given this music profile, recommend dance and motion for a music video:\n\n${JSON.stringify({ bpm, energy: analysis.energy, mood: analysis.mood, genre: analysis.genre, danceability: analysis.danceability, sections: sections.map(s => s.name) })}`,
      DANCE_SYSTEM,
      { role: "creative", maxTokens: 800, temperature: 0.5 },
    );

    let danceIntel: Record<string, unknown> = { bestDanceFamily: "Performance", movementIntensity: "medium", cameraStyle: "smooth" };
    if (danceResult.ok) {
      const match = danceResult.text.match(/\{[\s\S]*\}/);
      if (match) try { danceIntel = JSON.parse(match[0]); } catch { /* use defaults */ }
    }

    // ═══ ENGINE 5: Recommendation Layer (non-AI) ═══
    const recommendations = generateRecommendations(analysis);

    // ═══ ENGINE 6: Motionboard (non-AI) ═══
    const motionboard = generateMotionboard(sections);

    // ═══ Cache reusable skeleton (dance grammar, recommendations, motionboard template) ═══
    if (!cached) {
      setCache(cacheKey, {
        danceIntelligence: danceIntel,
        recommendations,
        motionboardTemplate: motionboard,
      });
    }

    // ═══ ENGINE 7: Review data package ═══
    return NextResponse.json({
      cached: !!cached,
      // Music profile
      musicProfile: {
        bpm,
        energy: analysis.energy,
        mood: analysis.mood,
        genre: analysis.genre,
        danceability: analysis.danceability,
        commercialPotential: analysis.commercialPotential,
        hookMoments: analysis.hookMoments,
        dropPoints: analysis.dropPoints,
        emotionalSpikes: analysis.emotionalSpikes,
        performanceStyle: analysis.performanceStyle,
      },
      // Section map
      sections,
      // Beat map
      beatMap,
      // Dance intelligence
      danceIntelligence: danceIntel,
      // Recommendations
      recommendations,
      // Motionboard
      motionboard,
      // Providers used
      providers: {
        analysis: analysisResult.ok ? (analysisResult as { provider: string }).provider : "fallback",
        dance: danceResult.ok ? (danceResult as { provider: string }).provider : "fallback",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
