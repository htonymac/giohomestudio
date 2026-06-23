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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { productInfo?: string };
  const productInfo = (body.productInfo || "").trim();

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

  const productBlock = productInfo
    ? `\nIMPORTANT — the ACTUAL product/offer. Use these REAL details (name, type, specs, location) and do NOT guess the type from the images (e.g. do NOT say "duplex" if it is a "2 bed apartment"):\n${productInfo}\n`
    : "";
  const prompt = `You are writing the voiceover for a ${slideCount}-slide commercial video ad.

${brand}${title}${productBlock}
Total duration: ${totalDuration}.

Each slide and what it shows:
${slideDescriptions.join("\n")}

Write EXACTLY ONE short spoken line for EACH slide, IN ORDER. Line K MUST describe what SLIDE K actually shows (use its caption) — never describe a different room/scene than the slide's own image. The lines should still flow together as one smooth, warm voiceover.

Rules:
- Output EXACTLY ${slideCount} lines, each prefixed with its slide number in square brackets: [1] … then [2] … up to [${slideCount}].
- Each line = ONE warm, natural spoken sentence about THAT slide's image. Match the image — do NOT mismatch.
- Be specific to that slide. NO generic filler ("experience excellence", "discover quality").
- Use the real product details above for facts (type/name/location) — never guess.

Output ONLY the ${slideCount} numbered lines, nothing else.`;

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
