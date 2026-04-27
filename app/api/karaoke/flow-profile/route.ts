// POST /api/karaoke/flow-profile
// Body: { recordingId: string }
// Calls Claude Haiku 4.5 with analysis JSON to classify voice flow.
// Returns { voiceType, phraseGaps, hookCandidates, cadenceLabel }
// Saves to KaraokeRecording.flowProfile

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface FlowProfile {
  voiceType: "singing" | "chanting" | "spoken_rhythm" | "humming" | "mixed";
  phraseGaps: number[];          // detected silence gaps in seconds
  hookCandidates: string[];      // repeated phrases that could be a hook
  cadenceLabel: string;          // human-readable cadence description
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recordingId } = body;

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
    if (!analysis) {
      return NextResponse.json(
        { error: "Run Audio Analysis (Step 3) before Flow Profiling" },
        { status: 400 }
      );
    }

    const transcript = recording.transcript || "";
    const tempo = analysis.tempo_bpm ?? "unknown";
    const key = analysis.detected_key ?? "unknown";
    const energy = analysis.energy_level ?? 0;
    const mood = analysis.mood ?? "unknown";
    const genre = analysis.suggested_genre ?? "unknown";
    const beatTimes: number[] = Array.isArray(analysis.beat_times)
      ? (analysis.beat_times as number[])
      : [];

    // Compute phrase gaps from beat_times — look for silences > 0.5s between beats
    const phraseGaps: number[] = [];
    for (let i = 1; i < beatTimes.length; i++) {
      const gap = beatTimes[i] - beatTimes[i - 1];
      if (gap > 0.5) phraseGaps.push(Math.round(gap * 100) / 100);
    }

    const systemPrompt = `You are an expert music flow analyst inside GHS Karaoke Studio.
Your job is to classify the vocal style and rhythm of a user's voice recording.
Return ONLY valid JSON — no markdown, no explanation.

Canvas rule (§29): Voice is truth. Flow is authority. Classify the voice as it IS, not as you wish it were.

Routing logic:
- IF humming → voiceType = "humming"
- IF spoken rhythm → voiceType = "spoken_rhythm"
- IF singing (pitched) → voiceType = "singing"
- IF chant → voiceType = "chanting"
- IF mixed → voiceType = "mixed"`;

    const userPrompt = `Classify the voice flow of this recording:

Transcript: "${transcript.slice(0, 500)}"
Tempo: ${tempo} BPM
Key: ${key}
Energy level: ${energy}
Mood: ${mood}
Suggested genre: ${genre}
Phrase gaps detected (seconds): ${JSON.stringify(phraseGaps.slice(0, 20))}
Beat timing points: ${beatTimes.length} beats detected

Return JSON:
{
  "voiceType": "singing" | "chanting" | "spoken_rhythm" | "humming" | "mixed",
  "phraseGaps": [array of significant gap durations in seconds],
  "hookCandidates": [array of repeated phrases or likely hook lines from transcript],
  "cadenceLabel": "human-readable description e.g. 'Mid-tempo singing with strong hooks' or 'Rhythmic spoken chant with tight cadence'"
}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Claude returned no JSON", raw }, { status: 500 });
    }

    let profile: FlowProfile;
    try {
      profile = JSON.parse(jsonMatch[0]) as FlowProfile;
    } catch {
      return NextResponse.json({ error: "Failed to parse flow profile JSON", raw }, { status: 500 });
    }

    // Ensure phraseGaps uses computed values if Claude didn't return any
    if (!profile.phraseGaps || profile.phraseGaps.length === 0) {
      profile.phraseGaps = phraseGaps.slice(0, 10);
    }

    // Save to DB
    await prisma.karaokeRecording.update({
      where: { id: recordingId },
      data: { flowProfile: profile as object },
    });

    return NextResponse.json({ recordingId, flowProfile: profile });
  } catch (err) {
    console.error("[karaoke/flow-profile] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Flow profile failed" },
      { status: 500 }
    );
  }
}
