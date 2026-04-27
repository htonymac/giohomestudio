// POST /api/karaoke/production-brief
// Body: { recordingId: string, selectedBeatFamily?: string }
// Calls Claude with all prior analysis to generate a structured production brief.
// Returns { genre, tempo, key, mood, structure, duration, energyCurve, instructions }
// Saves to KaraokeRecording.productionBrief

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ProductionBrief {
  genre: string;
  tempo: number;
  key: string;
  mood: string;
  structure: string;            // e.g. "Intro → Verse → Chorus → Bridge → Outro"
  duration: number;             // seconds
  energyCurve: string;          // e.g. "Low → Medium → High → Medium"
  selectedBeatFamily: string;
  instructions: string;         // full text instruction the user can edit
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId, selectedBeatFamily } = body;

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
    const transcript = recording.transcript || "";
    const karaokeMode = recording.mode || "A";

    if (!analysis) {
      return NextResponse.json(
        { error: "Complete Audio Analysis (Step 3) before Production Brief" },
        { status: 400 }
      );
    }

    if (!flowProfile) {
      return NextResponse.json(
        { error: "Complete Flow Profiling (Step 7) before Production Brief" },
        { status: 400 }
      );
    }

    const tempo = typeof analysis.tempo_bpm === "number" ? analysis.tempo_bpm : 90;
    const key = analysis.detected_key ?? "C major";
    const mood = analysis.mood ?? "neutral";
    const genre = analysis.suggested_genre ?? "Afrobeats";
    const energy = analysis.energy_level ?? 0;
    const durationSec = recording.durationSec ?? 60;
    const beatFamily = selectedBeatFamily || "Afro Light Groove";

    const modeDescriptions: Record<string, string> = {
      A: "Voice → Music: build full backing track around the vocal",
      B: "Voice → Karaoke: lyric-timed export with instrumental",
      C: "Voice → Polished Demo: polish the vocal and produce demo",
      D: "Voice → Lyrics + Music: lyrics are primary, music follows",
      E: "Voice → Beat Match: rhythmic alignment only",
    };
    const modeDesc = modeDescriptions[karaokeMode] || modeDescriptions.A;

    const systemPrompt = `You are a professional music producer at GHS Karaoke Studio.
You generate structured production briefs that music providers use to build backing tracks.

Canvas rule (§11): Brief must follow the user's voice — NOT random music generation.
Canvas rule (§29): Voice is truth. Flow is authority.

Return ONLY valid JSON — no markdown.`;

    const userPrompt = `Generate a production brief for this voice recording:

Mode: ${karaokeMode} — ${modeDesc}
Beat family selected: ${beatFamily}
Tempo: ${Math.round(tempo)} BPM
Key: ${key}
Mood: ${mood}
Genre suggestion: ${genre}
Energy level: ${energy}
Voice type: ${flowProfile.voiceType}
Cadence: ${flowProfile.cadenceLabel}
Duration: ${Math.round(durationSec)}s
Transcript: "${transcript.slice(0, 300)}"

Return JSON:
{
  "genre": "specific genre name",
  "tempo": ${Math.round(tempo)},
  "key": "${key}",
  "mood": "${mood}",
  "structure": "Song structure e.g. Intro → Verse → Chorus → Bridge → Outro",
  "duration": ${Math.round(Math.max(durationSec, 30))},
  "energyCurve": "Energy progression e.g. Low → Medium → High → Medium",
  "selectedBeatFamily": "${beatFamily}",
  "instructions": "Full paragraph production instructions for the music provider. Describe arrangement, instrumentation, style, how to complement the vocal flow, dynamics. 3-4 sentences."
}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Claude returned no JSON", raw }, { status: 500 });
    }

    let brief: ProductionBrief;
    try {
      brief = JSON.parse(jsonMatch[0]) as ProductionBrief;
    } catch {
      return NextResponse.json({ error: "Failed to parse production brief", raw }, { status: 500 });
    }

    // Ensure numeric tempo
    if (typeof brief.tempo !== "number") {
      brief.tempo = Math.round(tempo);
    }

    // Save to DB
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { productionBrief: brief as object },
    });

    return NextResponse.json({ recordingId, productionBrief: brief });
  } catch (err) {
    console.error("[karaoke/production-brief] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Production brief failed" },
      { status: 500 }
    );
  }
}
