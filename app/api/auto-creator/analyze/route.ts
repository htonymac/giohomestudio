// POST /api/auto-creator/analyze
// Accepts uploaded images, sends to vision AI for content detection
// Returns detected activities: product, food, outfit, event, property, selfie, etc.

import { NextRequest, NextResponse } from "next/server";
import { loadLLMSettings } from "@/lib/llm-settings";

const ANALYSIS_PROMPT = `Analyze these images and detect what activities or content types are shown.

For each image, identify:
- Content type: product, food, outfit/fashion, event, property/real-estate, selfie/portrait, market/shopping, travel, office/work, lifestyle, family, pet, landscape
- Mood: professional, casual, celebratory, energetic, calm, luxury
- Quality: good, average, poor
- Key objects or subjects visible

Return a JSON object with:
- "activities": array of { "label": string, "confidence": "high"|"medium", "icon": emoji }
- "image_analysis": array of { "filename": string, "content_type": string, "mood": string, "quality": string, "description": string }

Return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files: File[] = [];
    for (const [key, value] of form.entries()) {
      if (key === "file" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const settings = loadLLMSettings();
    const platform = form.get("platform") as string ?? "";
    const format = form.get("format") as string ?? "";

    // Try vision-capable providers in order

    // 1. OpenAI GPT-4o (vision capable)
    if (settings.OPENAI_API_KEY) {
      try {
        const imageContents = [];
        for (const file of files.slice(0, 4)) { // limit to 4 images
          const buf = await file.arrayBuffer();
          const base64 = Buffer.from(buf).toString("base64");
          const mime = file.type || "image/jpeg";
          imageContents.push({
            type: "image_url" as const,
            image_url: { url: `data:${mime};base64,${base64}`, detail: "low" as const },
          });
        }

        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: settings.OPENAI_API_KEY });
        const res = await client.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 800,
          messages: [
            { role: "system", content: ANALYSIS_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze ${files.length} image(s) for ${format} content on ${platform}. Filenames: ${files.map(f => f.name).join(", ")}` },
                ...imageContents,
              ],
            },
          ],
        });

        const text = res.choices[0]?.message?.content?.trim() ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({
            activities: parsed.activities ?? [],
            image_analysis: parsed.image_analysis ?? [],
            provider: "openai/gpt-4o-mini-vision",
          });
        }
      } catch (e) { console.warn("[analyze] OpenAI vision failed:", e); }
    }

    // 2. Anthropic Claude (vision capable)
    if (settings.ANTHROPIC_API_KEY) {
      try {
        const imageBlocks = [];
        for (const file of files.slice(0, 4)) {
          const buf = await file.arrayBuffer();
          const base64 = Buffer.from(buf).toString("base64");
          const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          imageBlocks.push({
            type: "image" as const,
            source: { type: "base64" as const, media_type: mediaType, data: base64 },
          });
        }

        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: settings.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: ANALYSIS_PROMPT,
          messages: [{
            role: "user",
            content: [
              ...imageBlocks,
              { type: "text" as const, text: `Analyze these ${files.length} image(s) for ${format} content on ${platform}.` },
            ],
          }],
        });

        const text = (msg.content[0] as { type: string; text: string })?.text?.trim() ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({
            activities: parsed.activities ?? [],
            image_analysis: parsed.image_analysis ?? [],
            provider: "claude/haiku-vision",
          });
        }
      } catch (e) { console.warn("[analyze] Claude vision failed:", e); }
    }

    // 3. Fallback — filename-based detection
    const activities = detectFromFilenames(files.map(f => f.name));
    return NextResponse.json({
      activities,
      image_analysis: files.map(f => ({
        filename: f.name,
        content_type: "unknown",
        mood: "unknown",
        quality: "unknown",
        description: "Vision AI not available — upload analyzed by filename only",
      })),
      provider: "filename_fallback",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function detectFromFilenames(names: string[]): Array<{ label: string; confidence: string; icon: string }> {
  const activities = [];
  const lower = names.map(n => n.toLowerCase()).join(" ");

  if (lower.match(/product|item|shoe|bag|cloth|dress|shirt/)) activities.push({ label: "Product photos detected", confidence: "medium", icon: "🛍" });
  if (lower.match(/food|meal|dish|cook|restaurant|jollof/)) activities.push({ label: "Food content detected", confidence: "medium", icon: "🍽" });
  if (lower.match(/selfie|portrait|face|me|self/)) activities.push({ label: "Portrait/selfie detected", confidence: "medium", icon: "🤳" });
  if (lower.match(/event|party|wedding|birthday|celebration/)) activities.push({ label: "Event photos detected", confidence: "medium", icon: "🎉" });
  if (lower.match(/house|property|apartment|building|room|estate/)) activities.push({ label: "Property content detected", confidence: "medium", icon: "🏠" });
  if (lower.match(/market|shop|store|buy|source/)) activities.push({ label: "Market/shopping activity", confidence: "medium", icon: "🏪" });
  if (lower.match(/travel|trip|flight|hotel|beach/)) activities.push({ label: "Travel content detected", confidence: "medium", icon: "✈️" });

  if (activities.length === 0) {
    activities.push({ label: `${names.length} media files uploaded`, confidence: "high", icon: "📸" });
    activities.push({ label: "Content opportunity found", confidence: "high", icon: "✨" });
  }

  return activities;
}
