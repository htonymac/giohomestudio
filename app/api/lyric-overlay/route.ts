// POST /api/lyric-overlay — Generate timed lyric overlay for video
// Takes lyrics text + duration, returns timed subtitle entries
// Uses LLM to intelligently time lyrics to music structure
// Output: SRT-style entries or JSON timing array for FFmpeg drawtext

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

interface LyricLine {
  index: number;
  startTime: string;  // "00:00:05.000"
  endTime: string;    // "00:00:08.500"
  text: string;
  emphasis: boolean;  // true for chorus/hook lines
  style: "normal" | "bold" | "glow" | "large";
}

const SYSTEM = `You are a lyric timing specialist. Given lyrics and a song duration, create precise timing for each line.

Rules:
- Space lines evenly across the duration
- Chorus lines should be marked as emphasis: true, style: "bold"
- Leave small gaps between lines (0.3-0.5s)
- Hook/repeated lines should use style: "glow" or "large"
- Verse lines use style: "normal"
- If lyrics have [verse], [chorus], [bridge] markers, use them for timing

Return ONLY a JSON array of objects:
[{ "index": 1, "startTime": "00:00:02.000", "endTime": "00:00:05.500", "text": "First line here", "emphasis": false, "style": "normal" }]`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lyrics, durationSeconds, style } = body;

    if (!lyrics) return NextResponse.json({ error: "Lyrics required" }, { status: 400 });

    const duration = durationSeconds ?? 180;
    const lines = lyrics.split("\n").filter((l: string) => l.trim());

    // Try AI timing
    const result = await callLLM(
      `Time these lyrics for a ${duration}-second song. Style preference: ${style ?? "clean"}.\n\nLyrics:\n${lyrics}`,
      SYSTEM,
      { role: "fast", maxTokens: 1500, temperature: 0.3 },
    );

    if (result.ok) {
      const match = result.text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const timedLyrics: LyricLine[] = JSON.parse(match[0]);
          // Generate SRT format
          const srt = timedLyrics.map(l =>
            `${l.index}\n${l.startTime.replace(".", ",")} --> ${l.endTime.replace(".", ",")}\n${l.text}\n`
          ).join("\n");

          return NextResponse.json({ timedLyrics, srt, lineCount: timedLyrics.length });
        } catch { /* parse fail, use fallback */ }
      }
    }

    // Fallback: evenly distribute lines
    const timePerLine = duration / lines.length;
    const fallbackLyrics: LyricLine[] = lines.map((text: string, i: number) => {
      const start = i * timePerLine;
      const end = start + timePerLine - 0.3;
      const isChorus = text.toLowerCase().includes("[chorus]") || text.toLowerCase().includes("[hook]");
      return {
        index: i + 1,
        startTime: formatTime(start),
        endTime: formatTime(end),
        text: text.replace(/\[.*?\]/g, "").trim(),
        emphasis: isChorus,
        style: isChorus ? "bold" as const : "normal" as const,
      };
    }).filter((l: LyricLine) => l.text);

    const srt = fallbackLyrics.map(l =>
      `${l.index}\n${l.startTime.replace(".", ",")} --> ${l.endTime.replace(".", ",")}\n${l.text}\n`
    ).join("\n");

    return NextResponse.json({ timedLyrics: fallbackLyrics, srt, lineCount: fallbackLyrics.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
