// POST /api/timeline/plan
// Auto Time Stamp — converts script + scenes + target duration into a timed JSON plan.
// Optionally uses Claude Haiku to enrich visual instructions per segment.
//
// Request:
//   {
//     script: string
//     scenes?: string[]
//     mode: "narration" | "scene" | "hybrid"
//     targetDuration: number        // seconds
//     durationHints?: Record<string, number>
//     projectId?: string
//     enrichWithAi?: boolean        // default false — set true for visual instruction enrichment
//   }
//
// Response:
//   { plan: TimingPlan, enriched: boolean }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildTimingPlan,
  mergeAiEnrichment,
  type ScriptInput,
  type TimingMode,
  type TimingPlan,
} from "../../../../src/lib/auto-timestamp";

// ── Validation helpers ─────────────────────────────────────────────────────

function isValidMode(mode: unknown): mode is TimingMode {
  return mode === "narration" || mode === "scene" || mode === "hybrid";
}

function errorResponse(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// ── AI enrichment ──────────────────────────────────────────────────────────

async function enrichSegmentsWithAi(
  plan: TimingPlan,
  fullScript: string
): Promise<TimingPlan> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return plan;

  try {
    const client = new Anthropic({ apiKey: key });

    const segmentsJson = JSON.stringify(
      plan.segments.map(s => ({
        id: s.id,
        title: s.title,
        narrationText: s.narrationText,
        duration: s.duration,
      })),
      null,
      2
    );

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: `You are a visual director for an AI video production system.
Given timed script segments, write a concise visual instruction for each segment (1-2 sentences).
Each instruction should describe: camera angle, subject action, environment mood.
Return ONLY strict JSON array:
[{ "segmentId": "seg_1", "title": "...", "visualInstruction": "..." }]
No markdown, no code fences. One object per segment.`,
      messages: [
        {
          role: "user",
          content: `Full script context:\n"${fullScript.slice(0, 400)}"\n\nSegments:\n${segmentsJson}`,
        },
      ],
    });

    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return plan;

    const enrichments = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(enrichments)) return plan;

    return mergeAiEnrichment(plan, enrichments);
  } catch (err) {
    console.error("[timeline/plan] AI enrichment failed, returning base plan:", err);
    return plan;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.");
  }

  const script = typeof body.script === "string" ? body.script : "";
  const scenes = Array.isArray(body.scenes)
    ? (body.scenes as unknown[]).filter((s): s is string => typeof s === "string")
    : undefined;
  const rawMode = body.mode;
  const mode: TimingMode = isValidMode(rawMode) ? rawMode : "hybrid";
  const targetDuration = typeof body.targetDuration === "number"
    ? Math.max(1, body.targetDuration)
    : 60;
  const durationHints =
    body.durationHints && typeof body.durationHints === "object" && !Array.isArray(body.durationHints)
      ? (body.durationHints as Record<string, number>)
      : undefined;
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const enrichWithAi = body.enrichWithAi === true;

  if (!script.trim() && (!scenes || scenes.length === 0)) {
    return errorResponse("Provide a non-empty script or scenes array.");
  }

  const input: ScriptInput = { script, scenes, mode, targetDuration, durationHints };
  const basePlan = buildTimingPlan(input, projectId);

  let finalPlan = basePlan;
  let enriched = false;

  if (enrichWithAi && basePlan.segments.length > 0) {
    finalPlan = await enrichSegmentsWithAi(basePlan, script);
    enriched = true;
  }

  return NextResponse.json({ plan: finalPlan, enriched });
}
