// POST /api/commercial/projects/[id]/enhance-narration
//
// Reads ALL slides (captions, narration lines, image descriptions) plus the
// project title and brand name, then generates a cohesive voiceover narration
// for the entire commercial.  The LLM sees the full context so it can write
// a single flowing script instead of disconnected per-slide sentences.

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
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Gather all slide content for context
  const slideDescriptions = project.slides.map((s, i) => {
    const parts: string[] = [`Slide ${i + 1}:`];
    if (s.captionOriginal)  parts.push(`Caption: "${s.captionOriginal}"`);
    if (s.captionPolished)  parts.push(`Polished: "${s.captionPolished}"`);
    if (s.narrationLine)    parts.push(`Current narration: "${s.narrationLine}"`);
    if (parts.length === 1) parts.push("(no caption or narration yet)");
    return parts.join(" ");
  });

  const slideCount = project.slides.length;
  const totalDuration = project.targetDurationSec
    ? `${project.targetDurationSec} seconds`
    : `${(project.slides.reduce((a, s) => a + s.durationMs, 0) / 1000).toFixed(0)} seconds`;

  const brand = project.brandName ? `Brand: ${project.brandName}. ` : "";
  const title = project.projectName ? `Ad title: "${project.projectName}". ` : "";

  const prompt = `You are writing a voiceover narration for a commercial video ad.

${brand}${title}
Total duration: ${totalDuration} (${slideCount} slides).

Here is what each slide shows:
${slideDescriptions.join("\n")}

Write a single, cohesive voiceover script that flows naturally across all ${slideCount} slides. The narration should:
- Sound warm, professional, and conversational when spoken aloud
- Reference what each slide shows in order (bedroom → kitchen → living room, etc.)
- Build from introduction to a compelling close
- Match the total duration (roughly ${Math.round(150 * parseInt(totalDuration) / 60)} words for ${totalDuration})
- NOT use bullet points, headers, or slide numbers
- NOT use generic marketing filler ("experience excellence", "discover quality")
- Be specific to what's actually shown in the slides

Output ONLY the spoken narration text. Nothing else.`;

  const systemPrompt = `You are an expert commercial voiceover scriptwriter. ${brand}Write narration that sounds natural when spoken aloud — like a premium property tour or product showcase. Be specific, warm, and persuasive. No filler.`;

  const result = await callLLM(
    prompt,
    systemPrompt,
    { role: "creative", forceModel: "claude-haiku-4-5-20251001", temperature: 0.6, maxTokens: 500, timeoutMs: 20000 }
  );

  if (!result.ok) {
    // Rule-based fallback: join all captions into a simple narration
    const fallback = project.slides
      .map(s => s.captionPolished ?? s.captionOriginal ?? "")
      .filter(Boolean)
      .join(". ");
    return NextResponse.json({
      narration: fallback || "No slide content available to generate narration.",
      provider: "fallback",
    });
  }

  // Clean up any quotes or markdown the LLM may have added
  const narration = result.text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();

  return NextResponse.json({ narration, provider: result.provider });
}
