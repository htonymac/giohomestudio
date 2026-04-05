// POST /api/commercial/projects/[id]/suggest-order
// Calls local Ollama (phi3) to suggest the optimal slide order for commercial flow.
// Returns { suggestedOrder: string[], reasoning: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({
    where: { id },
    include: { slides: { orderBy: { slideOrder: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.slides.length < 2) {
    return NextResponse.json({ error: "Need at least 2 slides to suggest order" }, { status: 400 });
  }

  const slideDescriptions = project.slides.map((s, i) =>
    `Slide ${i + 1} [ID:${s.id}]: "${s.captionOriginal ?? s.narrationLine ?? "(no caption)"}"`
  ).join("\n");

  const result = await callLLM(
    `These are the slides in a commercial video for "${project.brandName ?? project.projectName}".\nArrange them in the best order for a compelling commercial: hook → features → CTA.\n\nSlides:\n${slideDescriptions}\n\nRespond with ONLY a JSON object: {"order": ["ID1","ID2",...], "reasoning": "one sentence"}`,
    `You are a commercial video director. Arrange slides for maximum impact. Output only valid JSON.`,
    { role: "fast", temperature: 0.3, maxTokens: 300, timeoutMs: 20000 }
  );

  if (!result.ok) {
    return NextResponse.json({ error: "LLM unavailable. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama.", detail: result.error }, { status: 503 });
  }

  // Extract JSON from the response (model may wrap in markdown code block)
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "LLM returned invalid response" }, { status: 500 });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { order: string[]; reasoning: string };
    const validIds = new Set(project.slides.map(s => s.id));
    const safeOrder = (parsed.order ?? []).filter((sid: string) => validIds.has(sid));

    // If the model didn't return all IDs, fill in any missing ones at the end
    for (const s of project.slides) {
      if (!safeOrder.includes(s.id)) safeOrder.push(s.id);
    }

    return NextResponse.json({ suggestedOrder: safeOrder, reasoning: parsed.reasoning ?? "" });
  } catch {
    return NextResponse.json({ error: "Failed to parse LLM response" }, { status: 500 });
  }
}
