import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import type { ChildrenPacingEntry, ChildrenPacingPlan } from "@/types/children";

type AgeGroup = "2-4" | "5-7" | "8-10";
type Mode = "story" | "learning";

interface BuildPacingPlanRequest {
  storyText: string;
  mode: Mode;
  wordList?: string[];
  targetAgeGroup: AgeGroup;
}

// Older children read and process faster — reduce pause padding at higher age groups.
function ageGroupPaceMultiplier(age: AgeGroup): number {
  if (age === "2-4") return 1.4;
  if (age === "5-7") return 1.1;
  return 0.9;
}

function buildStoryPrompt(storyText: string, ageGroup: AgeGroup): string {
  return `Break the following children's story into sentences for a ${ageGroup}-year-old audience.

For each sentence return a JSON object with these exact fields:
- entryId: string (format "s_0", "s_1", etc.)
- type: "story_sentence"
- text: the sentence text
- durationMs: integer — word count × 120 + 700 (in milliseconds)
- imageConceptKey: a short snake_case phrase describing what visual should appear during this sentence (e.g. "rabbit_runs_through_forest")
- subtitleHighlightMode: "word_by_word"
- ssmlPause: 700

Return ONLY a valid JSON array. No markdown. No explanation.

Story:
${storyText}`;
}

function buildLearningPrompt(wordList: string[], storyText: string, ageGroup: AgeGroup): string {
  return `Create a learning pacing plan for ${ageGroup}-year-old children for the following word list: ${wordList.join(", ")}.

For each word, produce this exact sequence of entries:
1. word_intro entry: type="word_intro", text=the word, durationMs=2000, subtitleHighlightMode="word_by_word", ssmlPause=800
2. One letter_spell entry per letter: type="letter_spell", text=the single letter (uppercase), durationMs=2500, subtitleHighlightMode="letter_by_letter", ssmlPause=1500
3. word_repeat entry: type="word_repeat", text=the word, durationMs=1500, subtitleHighlightMode="word_by_word", ssmlPause=800
4. sentence_read entry: type="sentence_read", text=a short example sentence using the word (appropriate for ${ageGroup}-year-olds), durationMs=word count of sentence × 120 + 700, subtitleHighlightMode="word_by_word", ssmlPause=1200

For every entry also include:
- entryId: string (format "w0_intro", "w0_l0", "w0_l1", "w0_repeat", "w0_sent", then "w1_intro", etc.)
- imageConceptKey: snake_case visual concept appropriate for the word or sentence

Return ONLY a valid JSON array. No markdown. No explanation.`;
}

export async function POST(req: NextRequest) {
  let body: BuildPacingPlanRequest;
  try {
    body = await req.json() as BuildPacingPlanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { storyText, mode, wordList, targetAgeGroup } = body;

  if (!storyText?.trim()) {
    return NextResponse.json({ error: "storyText is required" }, { status: 400 });
  }
  if (mode !== "story" && mode !== "learning") {
    return NextResponse.json({ error: "mode must be 'story' or 'learning'" }, { status: 400 });
  }
  if (mode === "learning" && (!wordList || wordList.length === 0)) {
    return NextResponse.json({ error: "wordList required for learning mode" }, { status: 400 });
  }

  const prompt = mode === "story"
    ? buildStoryPrompt(storyText, targetAgeGroup)
    : buildLearningPrompt(wordList!, storyText, targetAgeGroup);

  const llmResult = await callLLM(prompt, undefined, { speed: "fast", maxTokens: 4000 });

  if (!llmResult.ok) {
    return NextResponse.json({ error: `LLM failed: ${llmResult.error}` }, { status: 502 });
  }

  let rawEntries: ChildrenPacingEntry[];
  try {
    // Strip markdown code fences if the LLM wrapped the output
    const cleaned = llmResult.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    rawEntries = JSON.parse(cleaned) as ChildrenPacingEntry[];
    if (!Array.isArray(rawEntries)) throw new Error("Expected array");
  } catch (err) {
    console.error("children/build-pacing-plan: JSON parse failed", err, llmResult.text.slice(0, 300));
    return NextResponse.json({ error: "LLM returned unparseable JSON" }, { status: 502 });
  }

  const multiplier = ageGroupPaceMultiplier(targetAgeGroup);
  const entries: ChildrenPacingEntry[] = rawEntries.map((e) => ({
    ...e,
    durationMs: Math.round((e.durationMs ?? 1000) * multiplier),
  }));

  const totalDurationMs = entries.reduce((sum, e) => sum + e.durationMs, 0);

  const plan: ChildrenPacingPlan = {
    storyId: `plan_${Date.now()}`,
    mode,
    entries,
    totalDurationMs,
    ...(mode === "learning" ? { wordList } : {}),
  };

  return NextResponse.json({ ok: true, plan });
}
