// Per-scene AI assistant — helps users improve image prompts and scene descriptions using Ollama (free, local).

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

interface SceneChatRequest {
  sceneId: string;
  sceneTitle: string;
  sceneDescription: string;
  sceneLocation?: string;
  sceneMood?: string;
  characters?: string[];
  currentImagePrompt?: string;
  userMessage: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

function buildSystemPrompt(req: SceneChatRequest): string {
  const lines: string[] = [
    "You are a scene assistant for a video story production tool.",
    "Your job is to help the user improve their scene image prompts and scene descriptions.",
    "",
    "Current scene context:",
    `- Title: ${req.sceneTitle}`,
    `- Description: ${req.sceneDescription}`,
  ];

  if (req.sceneLocation) lines.push(`- Location: ${req.sceneLocation}`);
  if (req.sceneMood) lines.push(`- Mood: ${req.sceneMood}`);
  if (req.characters && req.characters.length > 0) {
    lines.push(`- Characters in scene: ${req.characters.join(", ")}`);
  }
  if (req.currentImagePrompt) {
    lines.push(`- Current image prompt: ${req.currentImagePrompt}`);
  }

  lines.push(
    "",
    "Common scene problems you help fix:",
    "- Wrong body language or pose for the emotion",
    "- Missing action or movement cues",
    "- Wrong emotional expression on characters",
    "- Vague or weak visual direction",
    "- Characters not positioned correctly in the scene",
    "",
    "How to respond:",
    "1. Understand what the user wants to fix or improve.",
    "2. Provide a corrected image generation prompt on its own line, starting exactly with: IMAGE PROMPT:",
    "3. Optionally suggest updated wording for the scene description.",
    "Keep your response focused and practical.",
  );

  return lines.join("\n");
}

function buildUserPrompt(req: SceneChatRequest): string {
  if (!req.history || req.history.length === 0) {
    return req.userMessage;
  }
  const turns = req.history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  return `${turns}\nUser: ${req.userMessage}`;
}

function extractImagePrompt(reply: string): string | undefined {
  const lines = reply.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("IMAGE PROMPT:")) {
      return trimmed.slice("IMAGE PROMPT:".length).trim() || undefined;
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body: SceneChatRequest = await req.json();

    const system = buildSystemPrompt(body);
    const prompt = buildUserPrompt(body);

    const result = await callLLM(prompt, system, {
      forceProvider: "ollama",
      role: "assistant",
      maxTokens: 800,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    const imagePromptSuggestion = extractImagePrompt(result.text);

    return NextResponse.json({
      ok: true,
      reply: result.text,
      ...(imagePromptSuggestion !== undefined && { imagePromptSuggestion }),
      provider: result.provider,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
