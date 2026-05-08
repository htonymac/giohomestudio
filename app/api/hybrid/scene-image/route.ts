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
import { getStylePreset } from "@/lib/style-presets";
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
      productImages,   // optional: string[] of product image URLs to use as visual references
    } = body;

    // ── VISUAL STYLE DIRECTIVE — shared from src/lib/style-presets.ts ──
    const stylePreset = getStylePreset(projectStyle);

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
    // Track which characterIds are photo-import so hasPhotoImportChar detection works
    // even for session-only characters that have no DB referenceImages field.
    const photoImportCharIds = new Set<string>();

    if (characterOverrides && Array.isArray(characterOverrides)) {
      for (const ov of characterOverrides as Array<{ characterId?: string; name?: string; visualDescription?: string; wardrobe?: string; hairstyle?: string; imageUrl?: string | null; isPhotoImport?: boolean }>) {
        if (ov.isPhotoImport) {
          if (ov.characterId) photoImportCharIds.add(ov.characterId);
          if (ov.name) photoImportCharIds.add(ov.name);
        }
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

    // ════════════════════════════════════════════════════════════════════════════════
    // ── SCENE ACTION EXTRACTOR ── PROTECTED — DO NOT REMOVE, SIMPLIFY, OR OVERRIDE ──
    //
    // WHY THIS EXISTS: Without this block the image prompt only contains the raw scene
    // text ("Bryan confronted some bullies"). Image models read that as casual presence
    // and generate characters standing calmly side by side.
    //
    // This block extracts the ACTION TYPE from the scene description and injects precise
    // body-language and spatial-relationship directives that force the image model to
    // render the correct drama: posture, eye-lines, tension, camera angle.
    //
    // HISTORY: This was lost in a previous refactor pass. Re-added 2026-05-07.
    // IF YOU ARE REFACTORING SCENE-IMAGE: preserve the extractSceneAction() call and the
    // promptParts.push(actionDirective) line below exactly as written.
    // ════════════════════════════════════════════════════════════════════════════════
    function extractSceneAction(text: string): string {
      const t = text.toLowerCase();

      // ── Confrontation / bullying ──
      if (/confront|bully|bullies|block.*path|stand.*way|threaten|intimidat|face.*off|gang.*up/.test(t))
        return "characters in tense confrontation, one side blocking the other's path, aggressive body language, clenched fists or crossed arms, faces close and hostile, low-angle dramatic framing";

      // ── Physical fight / attack ──
      if (/fight|attack|punch|kick|battle|struggle|brawl|shove|push|hit/.test(t))
        return "mid-fight action, dynamic poses, one character striking or lunging, the other reacting or bracing, dramatic motion, intense expressions, action frame";

      // ── Chase / escape ──
      if (/chase|chasing|run.*away|escape|flee|pursuit|catch.*him|catch.*her|catch.*them|sprint/.test(t))
        return "chase scene, one character fleeing in the foreground, pursuer visible behind, sense of speed and urgency, wide tracking shot";

      // ── Fear / terror ──
      if (/fear|terrif|horrif|scream|panic|trembl|shak|cower|hide|creeped/.test(t))
        return "character showing extreme fear, wide eyes, mouth open, backing away or cowering, tense atmosphere, dramatic shadows";

      // ── Rescue / save ──
      if (/rescue|save|help|grab.*hand|pull.*out|lift|carry|protect/.test(t))
        return "rescue moment, one character reaching or pulling the other to safety, urgent poses, emotional connection, dramatic lighting";

      // ── Argument / conflict (non-physical) ──
      if (/argue|argument|shout|yell|scream.*at|disagree|furious|rage|anger/.test(t))
        return "heated argument, characters facing each other with raised voices implied, pointing fingers or gesturing firmly, high emotional intensity, medium shot";

      // ── Discovery / revelation ──
      if (/discover|realiz|shock|reveal|surprise|stunned|gasp|uncover|find/.test(t))
        return "moment of revelation, character with wide eyes and open mouth in shock, dramatic close-up on expression, high contrast lighting";

      // ── Sadness / grief ──
      if (/cry|crying|sob|griev|mourn|tears|heartbroken|despair|loss/.test(t))
        return "emotional grief scene, character visibly crying or head down, slumped posture, soft muted lighting, intimate close-up";

      // ── Celebration / triumph ──
      if (/celebrat|cheer|victory|win|triumph|joy|hug|embrace|relief/.test(t))
        return "celebration moment, characters joyful and energetic, arms raised or embracing, bright uplifting atmosphere, wide smiling expressions";

      // ── Stealth / hiding ──
      if (/sneak|hide|hiding|crouch|lurk|spy|shadow|stalk|creep/.test(t))
        return "stealth scene, character crouched low or pressed against wall, dark environment, tense atmosphere, partial concealment";

      // ── Dialogue / meeting ──
      if (/talk|discuss|meet|conversat|explain|listen|whisper|greet/.test(t))
        return "two or more characters in conversation, facing each other, engaged expressions, natural body language, neutral medium shot";

      // ── Default: preserve scene drama ──
      return "characters in active scene moment, purposeful body language expressing scene mood, dynamic composition";
    }

    const sceneActionDirective = extractSceneAction(sceneText || "");

    // 2. Build structured image prompt — STYLE LOCK FIRST, then CHARACTER IDENTITY
    // Order: [Style directive] → [Character identity] → [Scene] → [Action directive] → [Reinforcement] → [Settings] → [Quality]
    // Style is FIRST so the model commits to the render style before processing anything else.
    // This prevents random style drift between 3D cinematic and flat cartoon.
    const promptParts: string[] = [];

    // ── STYLE LOCK (absolute first position) ──
    promptParts.push(stylePreset.prefix);

    // ── ANIMAL DETECTION — check scene text AND character species/descriptions ──
    // "explicit animal" = sceneText OR character visualDescription OR override species contains known animal words
    const sceneTextLower = (sceneText || "").toLowerCase();
    const ANIMAL_PATTERN = /\b(bear|wolf|lion|fox|rabbit|dog|cat|animal|creature|beast|paws|snout)\b/;
    const sceneHasAnimal = ANIMAL_PATTERN.test(sceneTextLower);

    // Check characterOverrides species field — client sends this from CharacterIdentity
    const overrideSpecies: string[] = [];
    if (characterOverrides && Array.isArray(characterOverrides)) {
      for (const ov of characterOverrides as Array<{ species?: string; visualDescription?: string }>) {
        if (ov.species) overrideSpecies.push(ov.species.toLowerCase());
      }
    }
    const ANIMAL_SPECIES = new Set(["bear", "wolf", "lion", "fox", "rabbit", "dog", "cat", "tiger", "elephant", "monkey"]);
    const charSpeciesIsAnimal = overrideSpecies.some(s => ANIMAL_SPECIES.has(s));
    const explicitAnimal = sceneHasAnimal || charSpeciesIsAnimal;

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

    // ── SCENE DESCRIPTION + ACTION DIRECTIVE ──
    // Raw text first (context), then action directive (precise body-language instruction).
    // PROTECTED: action directive must stay — it prevents "calm standing" images for tense scenes.
    promptParts.push((sceneText || "").slice(0, 300));
    promptParts.push(sceneActionDirective);

    // ── HUMAN CHARACTER GUARD — INJECTED LATE (after character block) for maximum override force ──
    // Applied whenever NO explicit animal signal from scene or character species.
    // Late-position injection overrides early style-prefix bias from the model.
    if (!explicitAnimal) {
      promptParts.push(
        "IMPORTANT: Every character in this scene is a HUMAN BEING. Human faces, human skin, human bodies, human anatomy. " +
        "Do NOT generate bears, wolves, animals, anthropomorphic creatures, fur-covered characters, snouts, or paws. " +
        "All cast members are human children or human adults."
      );
    }

    // ── SCENE SETTINGS ──
    if (location) promptParts.push(`${location}`);
    if (mood) promptParts.push(`${mood} mood`);
    if (cameraFraming) promptParts.push(cameraFraming);
    if (timeOfDay) promptParts.push(timeOfDay);

    // ── STYLE QUALITY SUFFIX ──
    promptParts.push(stylePreset.suffix);

    const rawPrompt = promptParts.join(". ");
    const structuredPrompt = rawPrompt.slice(0, 2000);
    // bear-guard: hard negative appended whenever characters are human (not explicit animal scene)
    const bearNegative = explicitAnimal ? "" : ", bear, bear face, bear body, bear anatomy, furry creature, animal face, snout, paws, animal head, anthropomorphic animal, non-human character";
    const negativePrompt = stylePreset.negative + bearNegative;

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

    // Append product images as additional visual references (before generation)
    if (productImages && Array.isArray(productImages)) {
      for (const pUrl of productImages as string[]) {
        if (pUrl) referenceImageUrls.push(normalizeRef(pUrl));
      }
    }

    // 4. Generate image
    // Detect photo-import characters — route to face-lock model (PuLID) when present.
    // Checks both DB referenceImages tags AND client-supplied isPhotoImport flag
    // (session-only characters have no DB referenceImages, so the flag is the fallback).
    const hasPhotoImportChar = resolvedCharacters.some(c => {
      // Check client-supplied flag (session characters not yet in DB)
      if (photoImportCharIds.has(c.characterId || "") || photoImportCharIds.has(c.id) || photoImportCharIds.has(c.name)) return true;
      // Check DB referenceImages tags
      if (!c.referenceImages) return false;
      const refs = c.referenceImages as Array<{ url?: string; label?: string; tags?: string[] }>;
      return Array.isArray(refs) && refs.some(r => r?.label === "photo-import" || (r?.tags && Array.isArray(r.tags) && r.tags.includes("photo-import")));
    });
    const outputPath = path.join(env.storagePath, "images", `scene_${sceneId || Date.now()}_${Date.now()}.png`);

    const result = await generateImage({
      modelId: modelId || undefined,
      prompt: structuredPrompt,
      negativePrompt: negativePrompt,
      width: 1280,
      height: 720,
      seed: seed !== undefined && seed !== null ? Number(seed) : undefined,
      outputPath,
      referenceImageUrl: referenceImageUrls[0],
      useIdentityLock: hasPhotoImportChar && !modelId, // auto-route to PuLID for photo-import chars
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
