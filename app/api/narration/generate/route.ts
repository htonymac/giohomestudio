// POST /api/narration/generate — Auto-generate narration text for scenes
// Uses LLM to write narration that matches scene type:
//   Image scenes: rich, descriptive narration
//   Video scenes: minimal or none
//   Audio bridges: strongest, transitional narration
//
// Input: { sceneDescription, sceneType, mood, characters }
// Output: { narrationText, narrationStyle, estimatedDuration }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const SYSTEM = `You are a professional narrator writing voiceover scripts for movie scenes.

Rules based on scene type:
- IMAGE-LED scenes: Write RICH narration. Describe the setting, emotion, atmosphere. The viewer sees a still image, so narration must paint the full picture. 3-5 sentences.
- VIDEO-LED scenes: Write MINIMAL narration or NONE. The motion tells the story. At most one short emotional line. Often just "[No narration — motion and sound lead]".
- AUDIO-BRIDGE scenes: Write STRONG transitional narration. Guide the viewer between scenes. Set up what comes next. 2-3 sentences.
- HYBRID scenes: Write LIGHT narration. Support the visual without overexplaining. 1-2 sentences.

Return ONLY a JSON object:
{
  "narrationText": "The narration script...",
  "narrationStyle": "descriptive|minimal|transitional|emotional|none",
  "estimatedDurationSeconds": 5,
  "speakingPace": "slow|normal|fast"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sceneDescription, sceneType, mood, characters, sceneNumber } = body;

    if (!sceneDescription) {
      return NextResponse.json({ error: "Scene description required" }, { status: 400 });
    }

    const prompt = `Write narration for this ${sceneType ?? "hybrid"} scene:

Scene ${sceneNumber ?? ""}: ${sceneDescription}
Mood: ${mood ?? "cinematic"}
Characters: ${characters?.join(", ") ?? "none specified"}
Scene type: ${sceneType ?? "hybrid"}

Remember: ${sceneType === "image-led" ? "This is an IMAGE scene — narration should be RICH and descriptive." : sceneType === "video-led" ? "This is a VIDEO scene — narration should be MINIMAL or NONE." : sceneType === "audio-bridge" ? "This is an AUDIO BRIDGE — narration should be STRONG and transitional." : "This is a HYBRID scene — narration should be LIGHT."}`;

    const result = await callLLM(prompt, SYSTEM, { role: "creative", maxTokens: 400, temperature: 0.6 });

    if (result.ok) {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return NextResponse.json(parsed);
        } catch { /* parse fail */ }
      }
      // Fallback: return raw text as narration
      return NextResponse.json({
        narrationText: result.text.replace(/[{}"\n]/g, "").trim().slice(0, 300),
        narrationStyle: sceneType === "image-led" ? "descriptive" : sceneType === "video-led" ? "none" : "light",
        estimatedDurationSeconds: sceneType === "video-led" ? 0 : 5,
        speakingPace: "slow",
      });
    }

    // Fallback if LLM fails
    const fallbackNarration: Record<string, string> = {
      "image-led": `The scene unfolds before us. ${sceneDescription.slice(0, 100)}`,
      "video-led": "",
      "audio-bridge": `And then, everything changed. ${sceneDescription.slice(0, 80)}`,
      "hybrid": sceneDescription.slice(0, 60),
    };

    return NextResponse.json({
      narrationText: fallbackNarration[sceneType ?? "hybrid"] ?? sceneDescription.slice(0, 100),
      narrationStyle: sceneType === "video-led" ? "none" : "descriptive",
      estimatedDurationSeconds: sceneType === "video-led" ? 0 : 5,
      speakingPace: "slow",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
