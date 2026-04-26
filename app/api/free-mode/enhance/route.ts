// POST /api/free-mode/enhance
// Takes a raw user prompt + mode, returns enhanced prompt + confidence assessment.

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const SYSTEM = `You are a professional AI video/image prompt engineer for GioHomeStudio.

Your job:
1. Enhance the user's raw prompt into a detailed, cinematic prompt optimized for AI generation.
2. Assess how clearly you understood the user's intent.

Rules:
- Keep the user's core idea — do NOT change what they want to create
- Add: camera angle, lighting, mood, color palette, motion style, platform-relevant details
- Mode-specific additions:
  - text_to_video / hybrid: add scene flow, transitions, audio atmosphere
  - text_to_image: add art style, composition, depth of field
  - image_to_video / ai_motion: add motion description, physics, camera movement
  - text_to_audio: add voice tone, pacing, background ambience
  - images_audio / slideshow: add narration tone, slide pacing, emotion
  - video_to_video: describe the transformation style (color grade, style transfer)

Return ONLY valid JSON — no explanation, no markdown, no extra text:
{
  "enhanced": "your detailed enhanced prompt here",
  "understood": true,
  "confidence": "high",
  "note": null
}

confidence: "high" (clear intent) | "medium" (mostly clear, some assumptions made) | "low" (vague/contradictory/too short)
understood: false only if the prompt is completely meaningless, nonsensical, or offensive
note: null unless confidence is medium/low — brief explanation of what was unclear or assumed`;

export async function POST(req: NextRequest) {
  try {
    const { rawPrompt, mode } = await req.json();

    if (!rawPrompt || typeof rawPrompt !== "string") {
      return NextResponse.json({ error: "rawPrompt required" }, { status: 400 });
    }

    const userMsg = `Mode: ${mode || "text_to_video"}\nRaw prompt: "${rawPrompt}"`;

    const result = await callLLM(userMsg, SYSTEM, { role: "fast", maxTokens: 600 });

    if (!result.ok) {
      // Fallback: return prompt unchanged with medium confidence
      return NextResponse.json({
        enhanced:    rawPrompt,
        understood:  true,
        confidence:  "medium",
        note:        "AI enhancement unavailable — using your prompt as-is",
      });
    }

    try {
      const clean = result.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
      const parsed = JSON.parse(clean);
      return NextResponse.json({
        enhanced:   String(parsed.enhanced || rawPrompt),
        understood: parsed.understood !== false,
        confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
        note:       parsed.note || null,
      });
    } catch {
      return NextResponse.json({ enhanced: rawPrompt, understood: true, confidence: "medium", note: null });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
