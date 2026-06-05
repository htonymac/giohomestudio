// POST /api/free-mode/chat
// Takes a session message, runs LLM with conversation history,
// returns structured scene-based response.
// Persists user + assistant messages to DB.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm";
import { headers } from "next/headers";
import { createHash } from "crypto";

const SCENE_SYSTEM = `You are a creative AI storyteller and script writer for GioHomeStudio Free Mode.

When the user sends ANY message (story idea, movie concept, music request, short film, ad concept — anything creative), you:
1. Write a polished story/script divided into clear SCENES
2. Each scene must have a title, body text, and mood (one word: tense, calm, joyful, dramatic, mysterious, romantic, etc.)
3. Keep scenes SHORT and punchy — 2-5 sentences each
4. 3-8 scenes depending on complexity

ALWAYS return valid JSON in this exact format — no markdown, no extra text, no explanation outside JSON:
{
  "summary": "One-sentence summary of what you created",
  "scenes": [
    { "id": "S1", "title": "Scene title", "text": "Scene description and content here.", "mood": "dramatic" },
    { "id": "S2", "title": "Another scene", "text": "What happens here.", "mood": "tense" }
  ]
}

Rules:
- Scene text should be vivid, cinematic, and production-ready
- Include dialogue hints, camera suggestions, or emotional cues naturally in the text
- Keep each scene distinct and story-advancing
- Mood must be exactly one word
- IDs are S1, S2, S3... always

If the user edits a scene and asks you to refine the whole story, re-generate all scenes with the edits incorporated.`;

function getUserKey(req: NextRequest): string {
  const headersList = req.headers;
  const forwarded  = headersList.get("x-forwarded-for");
  const ip         = forwarded?.split(",")[0].trim() ?? "unknown";
  return createHash("sha256").update(ip + "-free-mode").digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    // H4 kill switch: emergency disable for Free Mode.
    const { isFlagEnabled, flagDisabledResponse } = await import("@/lib/feature-flags");
    if (!(await isFlagEnabled("FLAG_FREEMODE"))) {
      return flagDisabledResponse("Free Mode");
    }

    const body = await req.json();
    const { sessionId, message, history = [] } = body as {
      sessionId: string;
      message: string;
      history: { role: string; content: string }[];
    };

    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "sessionId and message required" }, { status: 400 });
    }

    const userKey = getUserKey(req);

    // Ensure session exists
    await prisma.freeModeSession.upsert({
      where: { id: sessionId },
      update: { updatedAt: new Date() },
      create: { id: sessionId, userKey },
    });

    // Persist user message
    await prisma.freeModeMessage.create({
      data: {
        sessionId,
        role:    "user",
        content: message.trim(),
      },
    });

    // Build LLM conversation context from history
    // history = [{role, content}] from client (last N messages for context)
    const conversationContext = history
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const userMsg = conversationContext
      ? `${conversationContext}\nUser: ${message.trim()}`
      : message.trim();

    const result = await callLLM(userMsg, SCENE_SYSTEM, { role: "fast", maxTokens: 2000 });

    let scenes: { id: string; title: string; text: string; mood: string }[] = [];
    let summary = "";

    if (result.ok) {
      try {
        const clean = result.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
        const parsed = JSON.parse(clean);
        scenes  = Array.isArray(parsed.scenes) ? parsed.scenes : [];
        summary = String(parsed.summary ?? "");
      } catch {
        // LLM didn't return JSON — wrap raw text as single scene
        scenes  = [{ id: "S1", title: "Your Story", text: result.text, mood: "neutral" }];
        summary = "AI created your story.";
      }
    } else {
      scenes  = [{ id: "S1", title: "Story Preview", text: message.trim(), mood: "neutral" }];
      summary = "Here is your story (AI enhancement unavailable).";
    }

    const assistantContent = JSON.stringify({ summary, scenes });

    // Persist assistant message
    const savedMessage = await prisma.freeModeMessage.create({
      data: {
        sessionId,
        role:    "assistant",
        content: summary,
        scenes:  scenes,
      },
    });

    // Update session title from first exchange if not set
    const session = await prisma.freeModeSession.findUnique({ where: { id: sessionId } });
    if (session && !session.title) {
      const autoTitle = message.trim().slice(0, 60) + (message.trim().length > 60 ? "…" : "");
      await prisma.freeModeSession.update({
        where: { id: sessionId },
        data: { title: autoTitle },
      });
    }

    return NextResponse.json({
      messageId: savedMessage.id,
      summary,
      scenes,
      assistantContent,
    });
  } catch (err) {
    console.error("[free-mode/chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
