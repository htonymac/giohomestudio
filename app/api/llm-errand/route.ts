// POST /api/llm-errand
// Delegates miscellaneous errand tasks to the local Ollama LLM.
// Use for: download planning, file naming, research, content lookup.
// RULE: Local LLM should NOT touch code. Only errand / miscellaneous work.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";

const schema = z.object({
  task: z.string().min(5, "Task description required"),
  context: z.string().max(1000).optional(),
  errandType: z.enum([
    "download_plan",      // Which free SFX/music files to download and from where
    "file_naming",        // Suggest exact filenames for downloaded files
    "source_research",    // Find best free source for a specific sound
    "content_lookup",     // Look up info about a topic
    "schedule_note",      // Write a reminder or note
    "general",            // General errand
  ]).optional(),
});

const SYSTEM = `You are an efficient studio assistant helping GioHomeStudio.
Your job is to help with practical errands and research only.
You do NOT write code. You do NOT change files. You plan, research, and advise.
Be brief, practical, and direct. Format lists clearly.`;

function buildPrompt(task: string, context: string | undefined, errandType: string | undefined): string {
  const ctx = context ? `CONTEXT: ${context}\n` : "";
  switch (errandType) {
    case "download_plan":
      return `TASK: ${task}\n${ctx}Plan exactly which files to download, from which free sources, and what to rename each file to so it matches the GioHomeStudio expected filenames. Be specific and actionable.`;
    case "file_naming":
      return `TASK: ${task}\n${ctx}Suggest the exact filenames needed. Output a clear list: downloaded name → rename to (GioHomeStudio format).`;
    case "source_research":
      return `TASK: ${task}\n${ctx}Research the best free, royalty-free source for this sound. Consider: Freesound.org, Pixabay, Mixkit, Sonniss GameAudioGDC. Prioritise commercial-safe options.`;
    default:
      return `TASK: ${task}\n${ctx}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { task, context, errandType } = parsed.data;
    const prompt = buildPrompt(task, context, errandType);

    const result = await callLLM(prompt, SYSTEM, { role: "assistant", maxTokens: 600, timeoutMs: 45000 });

    if (!result.ok) {
      return NextResponse.json({ error: `LLM unavailable: ${result.error}. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama locally.` }, { status: 503 });
    }

    return NextResponse.json({ result: result.text, errandType: errandType ?? "general", task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
