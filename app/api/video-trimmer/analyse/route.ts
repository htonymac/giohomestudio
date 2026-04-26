// GioHomeStudio — POST /api/video-trimmer/analyse
// Sends video metadata + user instruction to LLM, returns a structured TrimPlan.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { extractJSONFromLLM } from "@/lib/media-utils";
import type { TrimPlan, TrimRules } from "@/modules/ffmpeg/trim-plan";

const SYSTEM = `You are an intelligent video editor helping create commercials and marketing cuts.
Your task is to analyse a video and produce a TrimPlan as a JSON object.
Return ONLY the JSON. No explanation before or after. No markdown fences.`;

function buildPrompt(
  durationSec: number,
  width: number,
  height: number,
  userInstruction: string,
  rules: TrimRules
): string {
  const maxScene = rules.maxSceneDurationSec ? `${rules.maxSceneDurationSec} seconds` : "no limit";
  const target   = rules.targetDurationSec   ? `${rules.targetDurationSec} seconds`   : "no limit";

  return `You are an intelligent video editor helping create a commercial from an uploaded video.

Video metadata:
- Duration: ${durationSec} seconds
- Resolution: ${width}x${height}

User instruction: "${userInstruction}"

Trim rules:
- Max scene duration: ${maxScene}
- Allow scene repeat: ${rules.allowRepeat}
- Commercial goal: ${rules.commercialGoal}
- Target output duration: ${target}

Your task:
Analyze this video and produce a TrimPlan as a JSON object.
Return ONLY the JSON. No explanation before or after.

The JSON must match this schema exactly:
{
  "planId": "plan_<timestamp>",
  "segments": [
    {
      "segmentId": "seg_1",
      "label": "Hook",
      "startSec": 0,
      "endSec": 4,
      "durationSec": 4,
      "repeat": 1,
      "note": "Strong opening shot, grabs attention"
    }
  ],
  "structure": "hook → main → CTA",
  "outputDuration": <total seconds including repeats>
}

Rules:
- Segments must not overlap
- startSec and endSec must be within 0 to ${durationSec}
- If repeat > 1, count that segment duration multiple times in outputDuration
- Prefer hook-first, CTA-last commercial structure
- Do not create segments shorter than 1 second
- Create between 3 and 8 segments`;
}

export async function POST(req: NextRequest) {
  let body: {
    videoPath?: string;
    userInstruction?: string;
    trimRules?: TrimRules;
    metadata?: { durationSec: number; width: number; height: number };
    aiProvider?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { videoPath, userInstruction, trimRules, metadata } = body;
  if (!videoPath || !userInstruction || !trimRules || !metadata) {
    return NextResponse.json({ error: "Missing required fields: videoPath, userInstruction, trimRules, metadata" }, { status: 400 });
  }

  const promptUsed = buildPrompt(
    metadata.durationSec,
    metadata.width,
    metadata.height,
    userInstruction,
    trimRules
  );

  const result = await callLLM(promptUsed, SYSTEM, {
    role: "quality",
    maxTokens: 1200,
    temperature: 0.3,
  });

  if (!result.ok) {
    return NextResponse.json({ error: `LLM unavailable: ${result.error}` }, { status: 503 });
  }

  const rawText = extractJSONFromLLM(result.text);
  let plan: TrimPlan;
  try {
    const parsed = JSON.parse(rawText);
    // Attach fields the LLM doesn't produce
    plan = {
      ...parsed,
      planId: parsed.planId ?? `plan_${Date.now()}`,
      originalDuration: metadata.durationSec,
      outputDuration: parsed.outputDuration ?? parsed.segments?.reduce(
        (acc: number, s: { durationSec: number; repeat?: number }) => acc + s.durationSec * (s.repeat ?? 1), 0
      ) ?? 0,
      aiModel: result.provider,
      userInstruction,
      trimRules,
    };
  } catch {
    return NextResponse.json(
      { error: "LLM returned invalid JSON. Try again or switch provider.", raw: result.text.slice(0, 500) },
      { status: 422 }
    );
  }

  return NextResponse.json({ plan, promptUsed, aiProvider: result.provider });
}
