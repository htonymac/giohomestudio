// POST /api/generation/image — generate an image using the provider source layer
// Character token auto-resolution: if prompt contains character IDs (e.g. JON_RABBIT848),
// they are auto-resolved to full identity descriptions + reference images attached.
// Fix B (BUG-02): explicit characterIds[] field — calls attachCharacterReferences()
// so callers that know the characters but don't embed tokens still get visual descriptions.
import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { z } from "zod";
import { env } from "@/config/env";
import { generateImage } from "@/lib/generation/selectors/image-provider";
import { resolveCharacterTokens, attachCharacterReferences } from "@/lib/character-resolver";
import { sanitizeStyleCollisions, getStyleCollisionNegative } from "@/lib/style/sanitizer";

const schema = z.object({
  modelId: z.string().optional(),
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  seed: z.number().int().optional(),
  // BUG-02 Fix B: explicit character IDs to attach — no prompt token embedding needed
  characterIds: z.array(z.string()).optional(),
  // STYLE-01: optional style cue. When set to a live-action style we run the
  // sanitizer on the incoming prompt (strip "animated"/"cartoonish"/etc) and
  // strengthen the negative prompt. Backward-compat: omit to keep old behavior.
  projectStyle: z.string().optional(),
});

// sanitizeStyleCollisions, getStyleCollisionNegative imported from @/lib/style/sanitizer (Phase B extraction)

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-resolve character tokens in prompt (e.g. JON_RABBIT848 → full description)
  let finalPrompt = parsed.data.prompt;
  let resolvedCharacters: Array<{ characterId: string; displayName: string }> = [];
  let referenceImages: string[] = [];

  try {
    const resolved = await resolveCharacterTokens(parsed.data.prompt);
    finalPrompt = resolved.enrichedPrompt;
    resolvedCharacters = resolved.characters.map(c => ({ characterId: c.characterId, displayName: c.displayName }));
    referenceImages = resolved.referenceImages;
  } catch { /* character resolution is best-effort */ }

  // BUG-02 Fix B: if caller passes explicit characterIds, attach those too
  // This covers all callers that know the characters but don't embed tokens in the prompt.
  if (parsed.data.characterIds && parsed.data.characterIds.length > 0) {
    try {
      const attached = await attachCharacterReferences(finalPrompt, parsed.data.characterIds);
      finalPrompt = attached.enhancedPrompt;
      // Merge reference images (token-resolved + explicit IDs), deduplicate
      const allRefImages = [...new Set([...referenceImages, ...attached.referenceImages])];
      referenceImages = allRefImages;
      // Merge resolved characters, avoid duplicates
      const existingIds = new Set(resolvedCharacters.map(c => c.characterId));
      for (const c of attached.resolvedCharacters) {
        if (!existingIds.has(c.characterId)) {
          resolvedCharacters.push({ characterId: c.characterId, displayName: c.displayName });
          existingIds.add(c.characterId);
        }
      }
    } catch { /* best-effort */ }
  }

  // STYLE-01: if caller passed projectStyle, sanitize prompt + boost negative.
  // No-op when projectStyle is omitted, so existing callers keep their current behavior.
  // getStyleCollisionNegative imported from @/lib/style/sanitizer (Phase B extraction)
  let finalNegative = parsed.data.negativePrompt || "";
  if (parsed.data.projectStyle) {
    finalPrompt = sanitizeStyleCollisions(finalPrompt, parsed.data.projectStyle);
    finalNegative += getStyleCollisionNegative(parsed.data.projectStyle);
  }

  const outputPath = path.join(env.storagePath, "images", `gen_${Date.now()}.png`);

  const result = await generateImage({
    ...parsed.data,
    prompt: finalPrompt,
    negativePrompt: finalNegative || parsed.data.negativePrompt,
    outputPath,
  });

  if (!result.success) {
    return NextResponse.json({
      error: result.error,
      model: result.model.id,
      provider: result.model.provider_name,
    }, { status: 502 });
  }

  // Auto-save to asset library for reuse across modes
  if (result.imagePath) {
    try {
      const assetRes = await fetch(new URL("/api/assets", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          name: parsed.data.prompt.slice(0, 60),
          description: parsed.data.prompt,
          filePath: result.imagePath,
          tags: ["generated", result.model.provider_name],
          source: "generated",
          provider: result.model.provider_name,
        }),
      });
    } catch { /* asset save is best-effort */ }
  }

  return NextResponse.json({
    imagePath: result.imagePath,
    imageUrl: result.imageUrl,
    model: result.model.id,
    provider: result.model.provider_name,
    displayName: result.model.display_name,
    resolvedCharacters,
    referenceImages,
  });
}
