// POST /api/hybrid/scene-image — Generate a scene image using structured scene + character data
// This is NOT a random prompt box. It builds a structured prompt from:
// - Scene text/title/description
// - Selected character IDs → resolved to full descriptions + reference images
// - Scene settings (location, mood, lighting, timeOfDay, weather)
// - Camera framing notes
//
// Source of truth: Henry's unified character→scene→image pipeline doctrine (2026-04-12)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/generation/selectors/image-provider";
import { env } from "@/config/env";
import * as path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sceneId,         // HybridScene ID or SC01 format
      projectId,       // HybridProject ID
      sceneText,       // scene description/title
      characterIds,    // array of CharacterVoice IDs or characterId strings
      location,
      mood,
      timeOfDay,
      weather,
      lighting,
      cameraFraming,   // e.g. "wide establishing shot", "close-up"
      modelId,         // optional: image model to use
      seed,            // optional: integer seed for reproducibility
      projectStyle,    // "3d-cinematic" | "2d-cartoon" | "anime" | "realistic" | "storybook"
      characterOverrides, // array of {characterId, name, visualDescription, imageUrl, wardrobe, hairstyle}
                          // passed from client with computed visual descriptions — more precise than DB
    } = body;

    // ── VISUAL STYLE DIRECTIVE — injected into every generation to lock rendering style ──
    // Without this, the model randomly switches between 3D cinematic and flat cartoon.
    const STYLE_PRESETS: Record<string, { prefix: string; suffix: string; negative: string }> = {
      "3d-cinematic": {
        prefix: "3D animated film, Pixar/DreamWorks quality, volumetric lighting, photorealistic fur textures, subsurface scattering, cinematic depth of field, rich color grading, 3D render, CGI animation",
        suffix: "Highly detailed 3D render, professional VFX, cinematic lighting, consistent character design",
        negative: "2D flat illustration, cartoon drawing, anime, sketch, watercolor, flat colors, clipart, sticker, cel-shaded, painted",
      },
      "2d-cartoon": {
        prefix: "2D cartoon illustration, clean bold outlines, flat cel-shaded colors, Disney storybook art style, vibrant colors",
        suffix: "Clean illustration, consistent character design, professional cartoon art",
        negative: "3D render, photorealistic, CGI, bokeh, subsurface scattering, depth of field blur",
      },
      "anime": {
        prefix: "Anime style, Japanese animation, detailed anime art, studio-quality anime illustration, clean linework",
        suffix: "Consistent anime character design, professional anime production art",
        negative: "3D render, photorealistic, CGI, Western cartoon, flat illustration",
      },
      "storybook": {
        prefix: "Children's storybook illustration, warm painterly style, soft watercolor textures, whimsical and charming, storybook art",
        suffix: "Consistent storybook illustration style, warm colors, professional children's book art",
        negative: "3D render, photorealistic, dark, scary, anime",
      },
      "realistic": {
        prefix: "Photorealistic, hyper-detailed, cinematic photography, professional lighting, 8K render",
        suffix: "Photorealistic quality, consistent character appearance, cinematic composition",
        negative: "cartoon, anime, 2D illustration, flat colors, sketch, painterly",
      },
    };
    const stylePreset = STYLE_PRESETS[projectStyle] || STYLE_PRESETS["3d-cinematic"];

    if (!sceneText) {
      return NextResponse.json({ error: "sceneText is required" }, { status: 400 });
    }

    // 1. Resolve characters from DB
    const resolvedCharacters: Array<{
      id: string;
      characterId: string | null;
      name: string;
      visualDescription: string | null;
      imageUrl: string | null;
      referenceImages: unknown;
      wardrobe: string | null;
      hairstyle: string | null;
      culture: string | null;
      age: string | null;
    }> = [];

    if (characterIds && characterIds.length > 0) {
      const chars = await prisma.characterVoice.findMany({
        where: {
          OR: [
            { id: { in: characterIds } },
            { characterId: { in: characterIds } },
            { name: { in: characterIds } },
          ],
        },
      });

      for (const c of chars) {
        resolvedCharacters.push({
          id: c.id,
          characterId: c.characterId,
          name: c.name,
          visualDescription: c.visualDescription,
          imageUrl: c.imageUrl,
          referenceImages: c.referenceImages,
          wardrobe: c.wardrobe,
          hairstyle: c.hairstyle,
          culture: c.culture,
          age: c.age,
        });
      }

      // Check for unresolved characters
      const resolvedIds = new Set([
        ...chars.map(c => c.id),
        ...chars.map(c => c.characterId).filter(Boolean),
        ...chars.map(c => c.name),
      ]);
      const unresolvedIds = characterIds.filter((id: string) => !resolvedIds.has(id));
      if (unresolvedIds.length > 0) {
        return NextResponse.json({
          error: "unresolved_characters",
          message: `These characters are not in the registry: ${unresolvedIds.join(", ")}. Create or import them first.`,
          unresolvedIds,
        }, { status: 400 });
      }
    }

    // Apply characterOverrides — client sends computed visual descriptions that may be richer
    // than DB values (especially for characters defined only in the hybrid project session).
    // Override: visualDescription, wardrobe, hairstyle, imageUrl (only if locked reference)
    if (characterOverrides && Array.isArray(characterOverrides)) {
      for (const ov of characterOverrides as Array<{ characterId?: string; name?: string; visualDescription?: string; wardrobe?: string; hairstyle?: string; imageUrl?: string | null }>) {
        const match = resolvedCharacters.find(c =>
          (ov.characterId && (c.characterId === ov.characterId || c.id === ov.characterId)) ||
          (ov.name && c.name === ov.name)
        );
        if (match) {
          if (ov.visualDescription) match.visualDescription = ov.visualDescription;
          if (ov.wardrobe) match.wardrobe = ov.wardrobe;
          if (ov.hairstyle) match.hairstyle = ov.hairstyle;
          // Only override imageUrl if the client explicitly passes a locked reference
          if (ov.imageUrl) match.imageUrl = ov.imageUrl;
        } else if (ov.name && ov.visualDescription) {
          // Character exists only in session (not in DB yet) — add directly from override
          resolvedCharacters.push({
            id: ov.characterId || ov.name,
            characterId: ov.characterId || null,
            name: ov.name,
            visualDescription: ov.visualDescription,
            imageUrl: ov.imageUrl || null,
            referenceImages: null,
            wardrobe: ov.wardrobe || null,
            hairstyle: ov.hairstyle || null,
            culture: null,
            age: null,
          });
        }
      }
    }

    // 2. Build structured image prompt — STYLE LOCK FIRST, then CHARACTER IDENTITY
    // Order: [Style directive] → [Character identity] → [Scene] → [Settings] → [Reinforcement] → [Quality]
    // Style is FIRST so the model commits to the render style before processing anything else.
    // This prevents random style drift between 3D cinematic and flat cartoon.
    const promptParts: string[] = [];

    // ── STYLE LOCK (absolute first position) ──
    promptParts.push(stylePreset.prefix);

    // ── CHARACTER IDENTITY BLOCK ──
    // FAL/flux supports prompts up to ~2000 chars — allow full character descriptions.
    const CHAR_DESC_LIMIT = 400;
    if (resolvedCharacters.length > 0) {
      const identityBlock = resolvedCharacters.map(c => {
        const desc = (c.visualDescription || "").slice(0, CHAR_DESC_LIMIT);
        const wardrobe = c.wardrobe ? `, wearing: ${c.wardrobe.slice(0, 120)}` : "";
        const hairstyle = c.hairstyle ? `, hair: ${c.hairstyle.slice(0, 60)}` : "";
        return `${c.name}: ${desc}${wardrobe}${hairstyle}`;
      }).join(" | ");
      promptParts.push(identityBlock);
    }

    // ── SCENE DESCRIPTION ──
    promptParts.push((sceneText || "").slice(0, 300));

    // ── SCENE SETTINGS ──
    if (location) promptParts.push(`${location}`);
    if (mood) promptParts.push(`${mood} mood`);
    if (timeOfDay) promptParts.push(timeOfDay);

    // ── STYLE QUALITY SUFFIX ──
    promptParts.push(stylePreset.suffix);

    const rawPrompt = promptParts.join(". ");
    const structuredPrompt = rawPrompt.slice(0, 2000);
    const negativePrompt = stylePreset.negative;

    // 3. Collect reference images from characters — normalize paths to /api/media/ URLs
    function normalizeRef(url: string): string {
      if (!url) return url;
      if (url.startsWith("http") || url.startsWith("/api/")) return url;
      const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
      return `/api/media/${cleaned}`;
    }
    const referenceImageUrls: string[] = [];
    for (const c of resolvedCharacters) {
      if (c.imageUrl) referenceImageUrls.push(normalizeRef(c.imageUrl));
      if (c.referenceImages && Array.isArray(c.referenceImages)) {
        for (const ref of c.referenceImages as Array<{ url?: string }>) {
          const url = (ref && typeof ref === "object" ? ref.url : ref) as string;
          if (url) referenceImageUrls.push(normalizeRef(url));
        }
      }
    }

    // 4. Generate image
    const outputPath = path.join(env.storagePath, "images", `scene_${sceneId || Date.now()}_${Date.now()}.png`);

    const result = await generateImage({
      modelId: modelId || undefined,
      prompt: structuredPrompt,
      negativePrompt: negativePrompt,
      width: 1280,
      height: 720,
      seed: seed !== undefined && seed !== null ? Number(seed) : undefined,
      outputPath,
      referenceImageUrl: referenceImageUrls[0], // pass primary character reference image for style consistency
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        prompt: structuredPrompt,
        model: result.model?.id,
      }, { status: 502 });
    }

    // 5. Update HybridScene in DB if projectId + sceneId provided
    if (projectId && sceneId) {
      try {
        await prisma.hybridScene.updateMany({
          where: {
            projectId,
            OR: [
              { id: sceneId },
              { sceneId: sceneId },
            ],
          },
          data: {
            generatedAssetUrl: result.imageUrl || result.imagePath || outputPath,
            draftState: "generated",
            status: "completed",
          },
        });
      } catch { /* best effort DB update */ }
    }

    // 6. Auto-save to asset library
    try {
      await fetch(new URL("/api/assets", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "image",
          name: `Scene: ${(sceneText || "").slice(0, 50)}`,
          description: structuredPrompt.slice(0, 200),
          filePath: result.imagePath || outputPath,
          tags: ["scene-image", "hybrid", ...(resolvedCharacters.map(c => c.name))],
          source: "scene-generation",
          provider: result.model?.provider_name || "ghs",
        }),
      });
    } catch { /* best effort */ }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      imagePath: result.imagePath || outputPath,
      prompt: structuredPrompt,
      model: result.model?.id,
      provider: result.model?.provider_name,
      characters: resolvedCharacters.map(c => ({ id: c.id, characterId: c.characterId, name: c.name })),
      referenceImages: referenceImageUrls,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scene image generation failed" },
      { status: 500 }
    );
  }
}
