// POST /api/karaoke/hints
// Body: { analysis: AnalysisResult, lyrics?: string }
// Returns: { hints: Array<{ id: string; text: string }> }
// §23 — Editable AI hints: 1-3 short contextual suggestions inline above lyrics
// Uses Claude Haiku 4.5 to generate suggestions based on analysis JSON

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface AnalysisInput {
  transcription?: string;
  tempo_bpm?: number;
  detected_key?: string;
  energy_level?: number;
  suggested_genre?: string;
  mood?: string;
  vocal_quality_score?: number;
  beat_times?: number[];
  word_timestamps?: { word: string; start: number; end: number }[];
}

interface HintsRequest {
  analysis: AnalysisInput;
  lyrics?: string;
}

interface Hint {
  id: string;
  text: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body: HintsRequest = await req.json();
    const { analysis, lyrics } = body;

    if (!analysis) {
      return NextResponse.json({ error: "analysis is required" }, { status: 400 });
    }

    const lyricLines = (lyrics || analysis.transcription || "").split(/\n/).filter(Boolean);
    const lineCount = lyricLines.length;

    // Build context summary for Claude
    const ctx = [
      analysis.tempo_bpm ? `Tempo: ${analysis.tempo_bpm} BPM` : null,
      analysis.detected_key ? `Key: ${analysis.detected_key}` : null,
      analysis.mood ? `Mood: ${analysis.mood}` : null,
      analysis.suggested_genre ? `Genre feel: ${analysis.suggested_genre}` : null,
      analysis.energy_level !== undefined ? `Energy: ${analysis.energy_level > 0.1 ? "High" : analysis.energy_level > 0.05 ? "Medium" : "Low"}` : null,
      lineCount > 0 ? `Lyric lines: ${lineCount}` : null,
    ].filter(Boolean).join(", ");

    const lyricsSnippet = lyricLines.slice(0, 8).join("\n");

    const systemPrompt = `You are a helpful Nigerian music production assistant inside GHS. Your job is to offer 1-3 SHORT, clear, actionable suggestions to a user who just recorded their voice. Each suggestion should be one sentence, direct, and practical. Use voice-first language — talk like a helpful music friend, not a robot. Preserve Nigerian/cultural context. Never be condescending. Return ONLY valid JSON, no markdown.`;

    const userPrompt = `Audio analysis summary: ${ctx}

${lyricsSnippet ? `Lyrics transcribed:\n${lyricsSnippet}\n` : ""}
Give 1-3 short suggestions (one sentence each) from this list of types:
- Hook/chorus structure ("Your hook repeats here. Make it the chorus?")
- Words that can be polished ("These words are strong but can be polished.")
- Line length vs melody ("This phrase is too long for the melody. Shorten it?")
- Instrument/beat fit ("Your tone fits soft piano better than a heavy beat.")
- Style alternatives ("Try a gospel version, an afro version, or a soft acoustic version?")

Pick only the ones that make sense given the actual analysis. If lyric count is low, give 1-2 hints max.

Return JSON:
{
  "hints": [
    { "id": "h1", "text": "your suggestion here" },
    { "id": "h2", "text": "second suggestion if applicable" }
  ]
}

Return ONLY the JSON object.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ hints: [] });
    }

    let parsed: { hints: Hint[] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ hints: [] });
    }

    const hints = Array.isArray(parsed.hints)
      ? parsed.hints.slice(0, 3).filter((h) => h && h.text)
      : [];

    return NextResponse.json({ hints });
  } catch (err) {
    console.error("[karaoke/hints] error:", err);
    return NextResponse.json({ hints: [] });
  }
}
