// POST /api/translate/subtitles
// Translates subtitle tracks to multiple languages
// Input: { subtitles: [{text, startTime, endTime}], targetLanguages: ["yo", "fr", "ha"] }
// Output: { tracks: { yo: [{text, startTime, endTime}], fr: [...] } }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "French", es: "Spanish", pt: "Portuguese", de: "German",
  it: "Italian", nl: "Dutch", pl: "Polish", ru: "Russian",
  zh: "Mandarin Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", yo: "Yoruba", ha: "Hausa",
  ig: "Igbo", sw: "Swahili", pcm: "Nigerian Pidgin English",
  en: "English",
};

interface SubtitleEntry {
  text: string;
  startTime: number;
  endTime: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subtitles, targetLanguages } = body as {
      subtitles: SubtitleEntry[];
      targetLanguages: string[];
    };

    if (!subtitles?.length || !targetLanguages?.length) {
      return NextResponse.json({ error: "subtitles and targetLanguages required" }, { status: 400 });
    }

    const tracks: Record<string, SubtitleEntry[]> = {};

    // Translate to each target language
    for (const lang of targetLanguages) {
      const langLabel = LANGUAGE_LABELS[lang] ?? lang;

      // Batch translate all subtitle entries
      const allTexts = subtitles.map((s, i) => `[${i}] ${s.text}`).join("\n");

      const result = await callLLM(
        `Translate each numbered line to ${langLabel}. Keep the [N] prefix on each line. Output ONLY the translations.\n\n${allTexts}`,
        `Professional subtitle translator. Keep translations concise (subtitle-length). Preserve line numbers.`,
        { role: "fast", temperature: 0.3, maxTokens: 4000, timeoutMs: 30000 }
      );

      if (result.ok) {
        const lines = result.text.trim().split("\n");
        const translated: SubtitleEntry[] = subtitles.map((sub, i) => {
          // Find matching translated line
          const match = lines.find(l => l.startsWith(`[${i}]`));
          const translatedText = match
            ? match.replace(/^\[\d+\]\s*/, "").trim()
            : sub.text; // fallback to original

          return {
            text: translatedText,
            startTime: sub.startTime,
            endTime: sub.endTime,
          };
        });

        tracks[lang] = translated;
      } else {
        // Fallback: copy original
        tracks[lang] = subtitles.map(s => ({ ...s }));
      }
    }

    return NextResponse.json({
      originalLanguage: "en",
      tracks,
      languageCount: Object.keys(tracks).length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Subtitle translation failed" }, { status: 500 });
  }
}
