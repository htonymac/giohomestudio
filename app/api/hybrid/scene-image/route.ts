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
import { sanitizeStyleCollisions, getStyleCollisionNegative } from "@/lib/style/sanitizer";
import { getLateAnchor } from "@/lib/style/late-anchor";
import { extractSceneAction } from "@/lib/scene/action-extractor";
import { markBroken, pickHealthyAlternative } from "@/lib/provider-health";
import { getModelById } from "@/lib/generation/model-registry";
import { env } from "@/config/env";
import * as path from "path";
import * as fs from "fs";

export async function POST(req: NextRequest) {
  // Closure-scoped collector for unresolved character IDs (soft-skip).
  // Surfaced in the response's `warning` field so caller can show a non-blocking toast.
  const droppedCharacterIds: string[] = [];
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
      lastSeenWardrobe: string | null; // 3-C: continuity tracker
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
        select: {
          id: true,
          characterId: true,
          name: true,
          visualDescription: true,
          imageUrl: true,
          referenceImages: true,
          wardrobe: true,
          hairstyle: true,
          culture: true,
          age: true,
          lastSeenWardrobe: true,
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
          lastSeenWardrobe: c.lastSeenWardrobe,
        });
      }

      // Check for unresolved characters
      const resolvedIds = new Set([
        ...chars.map(c => c.id),
        ...chars.map(c => c.characterId).filter(Boolean),
        ...chars.map(c => c.name),
      ]);
      // 2026-05-09 SOFT-SKIP unresolved IDs.
      // Old: hard 400 ("characters not in registry"). New: log + drop + proceed.
      // Why: AI-generated character placeholders (e.g. "CH01") shouldn't block image gen.
      // Generation still works because session-only chars are also handled via characterOverrides.
      const unresolvedIds = characterIds.filter((id: string) => !resolvedIds.has(id));
      if (unresolvedIds.length > 0) {
        console.warn(`[scene-image] dropping unresolved characterIds: ${unresolvedIds.join(", ")} (continuing generation without them)`);
        droppedCharacterIds.push(...unresolvedIds);
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
            lastSeenWardrobe: null,
          });
        }
      }
    }

    // sanitizeStyleCollisions imported from @/lib/style/sanitizer (Phase B extraction)

    // extractSceneAction imported from @/lib/scene/action-extractor (Phase B extraction)
    // PROTECTED: preserve the extractSceneAction() call and promptParts.push(sceneActionDirective) below exactly as written.

    // Sanitize the scene text for the chosen style BEFORE it touches the prompt or
    // the action extractor. This way "her voice was animated" never reaches the model
    // when style=realistic.
    const styleId = (projectStyle || "3d-cinematic") as string;
    const cleanSceneText = sanitizeStyleCollisions(sceneText || "", styleId);
    const sceneActionDirective = extractSceneAction(cleanSceneText);

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
    // Each field is run through the style sanitizer so a description like "his
    // animated face" doesn't sabotage realistic gen.
    const CHAR_DESC_LIMIT = 400;
    if (resolvedCharacters.length > 0) {
      const identityBlock = resolvedCharacters.map(c => {
        const desc = sanitizeStyleCollisions((c.visualDescription || "").slice(0, CHAR_DESC_LIMIT), styleId);
        // 3-C: Use lastSeenWardrobe for continuity when available; fall back to wardrobe default
        const wardrobeSource = c.lastSeenWardrobe ?? c.wardrobe;
        const wardrobePrefix = c.lastSeenWardrobe
          ? `CONTINUITY: ${c.name} last seen wearing: `
          : "wearing: ";
        const wardrobe = wardrobeSource
          ? `, ${wardrobePrefix}${sanitizeStyleCollisions(wardrobeSource.slice(0, 140), styleId)}`
          : "";
        const hairstyle = c.hairstyle ? `, hair: ${sanitizeStyleCollisions(c.hairstyle.slice(0, 60), styleId)}` : "";
        // 2026-05-10 AGE LOCK — when age is set, repeat it loudly so models don't default to adult.
        // "Bryan is 11 but image shows 30" was the bug. Plain age mention is too soft for the model.
        const ageLock = c.age
          ? `, AGE: ${c.age} — body proportions, face, height, voice all match age ${c.age}, do NOT render as adult unless ${c.age} is "adult"`
          : "";
        return `${c.name}: ${desc}${wardrobe}${hairstyle}${ageLock}`;
      }).join(" | ");
      promptParts.push(identityBlock);

      // ── CHARACTER ANATOMY SEPARATION (2026-05-09) ──
      // When a scene has 2+ characters AND a mix of human + animal species, image models
      // tend to fuse features (e.g. "bear with boy's face"). Inject explicit separation
      // directive listing each character's species + anatomy, so the model treats them
      // as DISTINCT bodies, not a hybrid creature.
      if (resolvedCharacters.length >= 2) {
        const speciesByName: string[] = [];
        for (const c of resolvedCharacters) {
          // Pick species hint from override or from visualDescription; default human.
          const ovs = (characterOverrides as Array<{ name?: string; species?: string }> | undefined)
            ?.find(o => o.name === c.name)?.species;
          const desc = (c.visualDescription || "").toLowerCase();
          const isAnimal = ovs && ANIMAL_SPECIES.has(ovs.toLowerCase())
            ? true
            : ANIMAL_PATTERN.test(desc);
          if (isAnimal) {
            const animalKind = (ovs && ANIMAL_SPECIES.has(ovs.toLowerCase()))
              ? ovs
              : (desc.match(ANIMAL_PATTERN)?.[1] ?? "animal");
            speciesByName.push(`${c.name} is a ${animalKind} (${animalKind} face, ${animalKind} body, ${animalKind} anatomy — NOT human)`);
          } else {
            speciesByName.push(`${c.name} is a human (human face, human body, human skin — NOT an animal)`);
          }
        }
        promptParts.push(
          `STRICT CHARACTER SEPARATION — ${resolvedCharacters.length} different characters with DIFFERENT bodies. ` +
          speciesByName.join(". ") + ". " +
          "Do NOT merge their features. Do NOT put a human face on an animal body. Do NOT put an animal face on a human body. " +
          "Each character is a SEPARATE individual with their OWN anatomy."
        );
      }
    }

    // ── SCENE DESCRIPTION + ACTION DIRECTIVE ──
    // cleanSceneText is the sanitized version (style collision words swapped for live-action styles).
    // PROTECTED: action directive must stay — it prevents "calm standing" images for tense scenes.
    promptParts.push(cleanSceneText.slice(0, 300));
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

    // ── LATE-POSITION STYLE ANCHOR ──
    // Repeat a tight style cue at the very END of the prompt. Image models weight
    // late-position tokens heavily — this fights any drift caused by collision words
    // we couldn't fully remove (e.g., character names that happen to be style words).
    // getLateAnchor imported from @/lib/style/late-anchor (Phase B extraction)
    promptParts.push(getLateAnchor(styleId));

    const rawPrompt = promptParts.join(". ");
    const structuredPrompt = rawPrompt.slice(0, 2000);
    // bear-guard: hard negative appended whenever characters are human (not explicit animal scene)
    const bearNegative = explicitAnimal ? "" : ", bear, bear face, bear body, bear anatomy, furry creature, animal face, snout, paws, animal head, anthropomorphic animal, non-human character";
    // Hybrid-feature guard (2026-05-09) — when scene mixes humans + animals, models tend to merge.
    // Always block hybrid features regardless of style. Cheap insurance.
    const hybridNegative = ", human face on animal, animal face on human, hybrid creature, fused characters, character merging, blended anatomy, chimera, anthropomorphic merge, mixed species body";
    // Style-collision negatives — extra muscle behind the negative when live-action is selected.
    // getStyleCollisionNegative imported from @/lib/style/sanitizer (Phase B extraction)
    const negativePrompt = stylePreset.negative + bearNegative + hybridNegative + getStyleCollisionNegative(styleId);

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

    // 3-D: Quick keyword supervisor — non-blocking check that key scene words appear in prompt.
    // Fires BEFORE generation. Returns a warning in the response if coverage is low.
    // No API cost — pure string matching.
    const sceneKeywords = (sceneText || "").toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const promptLower = structuredPrompt.toLowerCase();
    const missingKeywords = sceneKeywords.filter((k: string) => !promptLower.includes(k)).slice(0, 3);
    const supervisorWarning = missingKeywords.length > 2
      ? `Prompt may not fully capture: ${missingKeywords.join(", ")}`
      : undefined;

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
    // ── SCOPED IMAGE STORAGE (P1-A 2026-05-14) ──
    // Save to /storage/scenes/{projectId}/{sceneId}/ so:
    // - images never bleed between projects or scenes
    // - local path returned as imageUrl (no CDN expiry)
    // - execute route resolves directly, no re-download needed
    const imgTs = Date.now();
    const scopedDir = path.join(env.storagePath, "scenes", projectId || "unlinked", sceneId || "unknown");
    fs.mkdirSync(scopedDir, { recursive: true });
    const outputPath = path.join(scopedDir, `img_${imgTs}.png`);
    const localImageUrl = `/api/media/scenes/${projectId || "unlinked"}/${sceneId || "unknown"}/img_${imgTs}.png`;

    // 4-A: Multi-reference support note.
    // generateImage() currently accepts a single referenceImageUrl (FAL PuLID only uses one).
    // All collected referenceImageUrls are included in the response so callers can see what was
    // available. When the provider supports multiple refs, pass the array here instead.
    // For now we pass referenceImageUrls[0] (primary character ref) — same as before.
    // Phase E.1: provider-health auto-fallback for image generation.
    // If the chosen model returns a 404/422/"model not found" error, we mark it broken,
    // pick the best healthy model in the same family, and retry once.
    // Routes that call generateImage() without this wrapper still work unchanged (backward compat).
    let result = await generateImage({
      modelId: modelId || undefined,
      prompt: structuredPrompt,
      negativePrompt: negativePrompt,
      width: 1280,
      height: 720,
      seed: seed !== undefined && seed !== null ? Number(seed) : undefined,
      outputPath,
      referenceImageUrl: referenceImageUrls[0],  // 4-A: primary ref; array not yet supported by provider
      useIdentityLock: hasPhotoImportChar && !modelId,
    });

    if (!result.success && result.model) {
      // Check if this looks like a provider-side failure (not a local validation error)
      const errStr = result.error ?? "";
      const isProviderErr = /404|422|not found|unavailable|model.*error|endpoint.*error/i.test(errStr);
      if (isProviderErr) {
        markBroken(result.model.id, errStr);
        console.warn(`[provider-health] scene-image: ${result.model.id} marked broken — ${errStr}`);

        const alt = pickHealthyAlternative(result.model.family ?? "unknown", result.model.id);
        if (alt) {
          console.log(`[provider-health] scene-image fallback: ${result.model.id} → ${alt.id}`);
          result = await generateImage({
            modelId: alt.id,
            prompt: structuredPrompt,
            negativePrompt: negativePrompt,
            width: 1280,
            height: 720,
            seed: seed !== undefined && seed !== null ? Number(seed) : undefined,
            outputPath,
            referenceImageUrl: referenceImageUrls[0],  // 4-A: primary ref
            useIdentityLock: hasPhotoImportChar && !modelId,
          });
          if (!result.success && result.model) {
            markBroken(result.model.id, result.error ?? "fallback also failed");
          }
        }
      }
    }

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        prompt: structuredPrompt,
        model: result.model?.id,
      }, { status: 502 });
    }

    // Also look up full model entry to pass family info downstream (non-blocking)
    const usedModel = result.model ? getModelById(result.model.id) : null;
    void usedModel; // referenced for future use (E.2 UI badge)

    // 3-C: Update lastSeenWardrobe for all DB-backed resolved characters after successful generation.
    // This maintains wardrobe continuity across scenes — next gen for the same character
    // will inject "CONTINUITY: [Name] last seen wearing: ..." into the prompt.
    for (const c of resolvedCharacters) {
      // Only update DB characters (have a real cuid id, not a session-only name/override)
      if (c.wardrobe && c.id && c.id.length === 25 /* cuid length */) {
        try {
          await prisma.characterVoice.update({
            where: { id: c.id },
            data: { lastSeenWardrobe: c.wardrobe },
          });
        } catch { /* best effort — wardrobe continuity is non-blocking */ }
      }
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
            generatedAssetUrl: result.imagePath ? localImageUrl : (result.imageUrl || outputPath),
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

    // Return local /storage/ URL as imageUrl — CDN URLs (FAL) expire within hours.
    // page.tsx stores this as scene.imageUrl → flows into assembly segment sourceUrl.
    // execute/route.ts resolveMediaPath() handles /storage/ prefix correctly.
    return NextResponse.json({
      success: true,
      imageUrl: result.imagePath ? localImageUrl : result.imageUrl,
      imagePath: result.imagePath || outputPath,
      prompt: structuredPrompt,
      model: result.model?.id,
      provider: result.model?.provider_name,
      characters: resolvedCharacters.map(c => ({ id: c.id, characterId: c.characterId, name: c.name })),
      referenceImages: referenceImageUrls,          // 4-A: all collected reference URLs (array)
      referenceImagesUsed: referenceImageUrls.length, // 4-A: count for diagnostics
      ...(supervisorWarning ? { supervisorWarning } : {}), // 3-D: keyword coverage warning
      ...(droppedCharacterIds.length > 0 ? { warning: `Generated without characters not in registry: ${droppedCharacterIds.join(", ")}` } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scene image generation failed" },
      { status: 500 }
    );
  }
}
