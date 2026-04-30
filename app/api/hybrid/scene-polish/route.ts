// GioHomeStudio — Scene Polish API
//
// POST /api/hybrid/scene-polish
// Improves individual scene descriptions using LLM while preserving
// all story elements (characters, setting, core event).

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

// ── Types ─────────────────────────────────────────────────────────

interface ScenePolishRequest {
  sceneId: string;
  currentText: string;
  action: "polish" | "upgrade" | "add-detail";
  style?: string;
}

// ── Action instruction map ─────────────────────────────────────────

const ACTION_INSTRUCTIONS: Record<string, string> = {
  polish:
    "Improve language flow and word choice. Keep the same length and ALL the same story elements. Only elevate the prose — no new characters, no new events.",
  upgrade:
    "Enhance cinematic quality by adding sensory detail (sound, texture, light, atmosphere). Output may be slightly longer. Preserve every character, location, and plot beat exactly.",
  "add-detail":
    "Add 1-2 specific visual or audio cues useful for video production (e.g. camera angle, lighting mood, ambient sound). Do not change any existing story element.",
};

// ── POST handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ScenePolishRequest;

    // Validate input
    if (!body.sceneId || typeof body.sceneId !== "string") {
      return NextResponse.json({ error: "sceneId is required" }, { status: 400 });
    }
    if (!body.currentText || typeof body.currentText !== "string" || !body.currentText.trim()) {
      return NextResponse.json({ error: "currentText is required and must be non-empty" }, { status: 400 });
    }
    if (!["polish", "upgrade", "add-detail"].includes(body.action)) {
      return NextResponse.json(
        { error: "action must be one of: polish, upgrade, add-detail" },
        { status: 400 }
      );
    }

    const actionInstruction = ACTION_INSTRUCTIONS[body.action];
    const styleNote = body.style ? `\nTarget style/tone: ${body.style}.` : "";

    const systemPrompt =
      "CRITICAL: You are polishing a scene description. Preserve the EXACT same characters, setting, and core event. Only improve language, clarity, and cinematic quality. Do NOT invent new characters, new locations, or new plot elements. Output ONLY the improved scene text — no preamble, no explanation, no quotes around the output.";

    const userPrompt = `Action: ${body.action}
Instruction: ${actionInstruction}${styleNote}

Original scene:
${body.currentText.trim()}

Polish this scene description while keeping all core story elements intact.`;

    const llmResult = await callLLM(userPrompt, systemPrompt, {
      role: "fast",
      temperature: 0.6,
      maxTokens: 800,
    });

    if (!llmResult.ok) {
      console.warn(`[scene-polish] LLM failed: ${llmResult.error}`);
      return NextResponse.json(
        { error: `AI unavailable: ${llmResult.error}` },
        { status: 503 }
      );
    }

    const polishedText = llmResult.text.trim();

    if (!polishedText) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 422 });
    }

    return NextResponse.json({ polishedText });
  } catch (err) {
    console.error("[scene-polish] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
