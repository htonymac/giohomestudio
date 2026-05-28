// POST /api/karaoke/beat-recommend
// Body: { recordingId: string, mode: string }
// Uses analysis + flow profile to recommend top 3 beat families from canvas §10 list.
// Returns { recommendations: [{beatFamily, reasoning, tempoFit, energyFit}] }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

// Canvas §10 — 11 beat families
const BEAT_FAMILIES = [
  "Afro Light Groove",
  "Afro Dance",
  "Trap",
  "Drill",
  "Soft Piano",
  "Worship",
  "Acoustic Guitar",
  "Children Rhythm",
  "Cinematic",
  "Commercial Jingle",
  "Club Energy",
] as const;

export type BeatFamily = typeof BEAT_FAMILIES[number];

export interface BeatRecommendation {
  beatFamily: BeatFamily;
  reasoning: string;
  tempoFit: string;     // "exact" | "close" | "adaptable"
  energyFit: string;    // "perfect" | "good" | "workable"
  rank: 1 | 2 | 3;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId, mode } = body;

    if (!recordingId) {
      return NextResponse.json({ error: "recordingId required" }, { status: 400 });
    }

    const recording = await prisma.karaokeRecording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) {
      return NextResponse.json({ error: `Recording not found: ${recordingId}` }, { status: 404 });
    }

    const analysis = recording.analysis as Record<string, unknown> | null;
    const flowProfile = recording.flowProfile as Record<string, unknown> | null;

    if (!analysis) {
      return NextResponse.json(
        { error: "Run Audio Analysis (Step 3) before Beat Recommendation" },
        { status: 400 }
      );
    }

    if (!flowProfile) {
      return NextResponse.json(
        { error: "Run Flow Profiling (Step 7) before Beat Recommendation" },
        { status: 400 }
      );
    }

    const tempo = analysis.tempo_bpm ?? "unknown";
    const key = analysis.detected_key ?? "unknown";
    const mood = analysis.mood ?? "unknown";
    const genre = analysis.suggested_genre ?? "unknown";
    const energy = analysis.energy_level ?? 0;
    const transcript = recording.transcript || "";
    const voiceType = flowProfile.voiceType ?? "mixed";
    const cadenceLabel = flowProfile.cadenceLabel ?? "";
    const hookCandidates = flowProfile.hookCandidates ?? [];
    const karaokeMode = mode || recording.mode || "A";

    const systemPrompt = `You are a professional music producer inside GHS Karaoke Studio.
You recommend the best beat families for a user's voice recording.

Available beat families (canvas §10): ${BEAT_FAMILIES.join(", ")}

Rules:
- Base recommendations on tempo, energy, voice type, mood — NEVER random
- Consider the Karaoke mode: A=Voice→Music, B=Voice→Karaoke, C=Voice→Demo, D=Voice→Lyrics+Music, E=Voice→Beat Match
- For Mode E (Beat Match), focus entirely on rhythmic alignment
- Return EXACTLY 3 ranked recommendations
- Return ONLY valid JSON`;

    const userPrompt = `Recommend the top 3 beat families for this voice recording:

Tempo: ${tempo} BPM
Key: ${key}
Mood: ${mood}
Suggested genre: ${genre}
Energy level: ${energy}
Voice type: ${voiceType}
Cadence: ${cadenceLabel}
Hook candidates: ${JSON.stringify(hookCandidates)}
Transcript excerpt: "${transcript.slice(0, 200)}"
Karaoke Mode: ${karaokeMode}

Return JSON:
{
  "recommendations": [
    {
      "rank": 1,
      "beatFamily": "<one of the 11 families>",
      "reasoning": "Why this beat fits this voice",
      "tempoFit": "exact|close|adaptable",
      "energyFit": "perfect|good|workable"
    },
    { "rank": 2, ... },
    { "rank": 3, ... }
  ]
}`;

    // Resilient LLM call: auto-fallback Claude → OpenAI → Grok → Ollama (was direct
    // Anthropic, which 500'd when credits ran out). (2026-05-28)
    const llm = await callLLM(userPrompt, systemPrompt, { role: "fast", maxTokens: 768, temperature: 0.4 });
    if (!llm.ok) {
      return NextResponse.json({ error: `Beat-recommend LLM unavailable: ${llm.error}` }, { status: 503 });
    }
    const raw = llm.text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "LLM returned no JSON", raw }, { status: 500 });
    }

    let result: { recommendations: BeatRecommendation[] };
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Failed to parse beat recommendations", raw }, { status: 500 });
    }

    // Validate beat families
    if (result.recommendations) {
      result.recommendations = result.recommendations.map((r) => ({
        ...r,
        beatFamily: (BEAT_FAMILIES.includes(r.beatFamily as BeatFamily)
          ? r.beatFamily
          : "Afro Light Groove") as BeatFamily,
      }));
    }

    return NextResponse.json({
      recordingId,
      recommendations: result.recommendations,
      beatFamilies: BEAT_FAMILIES,
    });
  } catch (err) {
    console.error("[karaoke/beat-recommend] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Beat recommendation failed" },
      { status: 500 }
    );
  }
}
