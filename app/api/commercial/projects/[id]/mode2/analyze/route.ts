// POST /api/commercial/projects/[id]/mode2/analyze
// Accepts uploaded product images/videos (multipart), uses LLM to infer
// the product type and pre-fill the Mode 2 ad details form.
// Returns { savedFiles, analysis: { productType, productName, features, adTone } | null }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { callLLM } from "@/lib/llm";
import { extractJSONFromLLM } from "@/lib/media-utils";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.commercialProject.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Upload at least one image or video" }, { status: 400 });
  }

  // Save uploaded files to storage
  const uploadDir = path.join(env.storagePath, "commercial", id, "mode2");
  fs.mkdirSync(uploadDir, { recursive: true });

  const savedFiles: { name: string; type: "image" | "video"; path: string }[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) continue;
    const ext  = file.name.split(".").pop() ?? "bin";
    const dest = path.join(uploadDir, `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    const buf  = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buf);
    savedFiles.push({
      name: file.name,
      type: file.type.startsWith("video") ? "video" : "image",
      path: dest,
    });
  }

  if (savedFiles.length === 0) {
    return NextResponse.json({ error: "No valid files uploaded" }, { status: 400 });
  }

  // Build description context for Ollama
  const fileList = savedFiles.map((f, i) => `File ${i + 1}: ${f.name} (${f.type})`).join("\n");
  const brand    = project.brandName ? `Company: ${project.brandName}.` : "";

  const result = await callLLM(
    `A business has uploaded these files to create a video ad:\n${fileList}\n\nBased on the file names and context, intelligently infer the product/service being advertised. Return ONLY valid JSON:\n{\n  "productType": "Software|Food|Real Estate|Fashion|Tech|Health|Service|Other",\n  "productName": "specific product or service name if detectable",\n  "features": ["key", "benefit", "or", "feature"],\n  "adTone": "Luxury|Professional|Energetic|Friendly|Urgent",\n  "analysisNotes": "Brief explanation of what was detected"\n}`,
    `You are a marketing analyst. ${brand} Analyse uploaded file descriptions and infer what product or service is being promoted. Output only valid JSON.`,
    { role: "quality", temperature: 0.3, maxTokens: 400, timeoutMs: 20000 }
  );

  if (!result.ok) {
    return NextResponse.json({
      savedFiles,
      analysis: null,
      warning: "AI analysis unavailable. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, or run Ollama. Fill the form manually.",
    });
  }

  let analysis = null;
  try { analysis = JSON.parse(extractJSONFromLLM(result.text)); } catch { /* ignore */ }

  return NextResponse.json({ savedFiles, analysis });
}
