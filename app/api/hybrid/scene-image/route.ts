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
import { resolveCharacterTokens } from "@/lib/character-resolver";
import { generateImage } from "@/lib/generation/selectors/image-provider";
import { getStylePreset } from "@/lib/style-presets";
import { sanitizeStyleCollisions, getStyleCollisionNegative, getAntiFantasyNegative } from "@/lib/style/sanitizer";
import { getLateAnchor } from "@/lib/style/late-anchor";
import { extractSceneAction, stripPoseLanguage } from "@/lib/scene/action-extractor";
import { markBroken, pickHealthyAlternative } from "@/lib/provider-health";
import { getModelById } from "@/lib/generation/model-registry";
import { buildFullLock, toStaticFrame } from "@/lib/era-culture-lock";
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
      storyEra,        // "2024", "1819", "899 AD", "300 BC", etc. — era/year lock
      storyCulture,    // "Contemporary Lagos", "Victorian England", "Yoruba Kingdom", etc.
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
      for (const ov of characterOverrides as Array<{ characterId?: string; name?: string; visualDescription?: string; wardrobe?: string; hairstyle?: string; imageUrl?: string | null; isPhotoImport?: boolean; age?: string | null }>) {
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
          // Age override — client is source of truth (Character tab). Without this the
          // AGE LOCK block was empty, letting the model default to name-driven stereotypes
          // (e.g. "Mama Iyabo" → old market woman) regardless of the portrait's actual age.
          if (ov.age) match.age = ov.age;
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
            age: ov.age || null,
            lastSeenWardrobe: null,
          });
        }
      }
    }

    // sanitizeStyleCollisions imported from @/lib/style/sanitizer (Phase B extraction)

    // extractSceneAction imported from @/lib/scene/action-extractor (Phase B extraction)
    // PROTECTED: preserve the extractSceneAction() call and promptParts.push(sceneActionDirective) below exactly as written.

    // Strip screenplay/narrative jargon FIRST — terms like "inciting incident", "narrative arc",
    // "protagonist establishes" confuse image models and produce inaccurate scene renders.
    function sanitizeNarrativeJargon(text: string): string {
      return text
        .replace(/\b(inciting\s+incident|story\s+beat|narrative\s+(arc|tension|structure|progression)|character\s+(arc|development|motivation)|plot\s+(twist|point|progression|development)|back\s*story|scene\s+setup|transition\s+moment|rising\s+action|falling\s+action|denouement|dramatic\s+irony|third\s+act|second\s+act|first\s+act|act\s+[123]|story\s+structure|turning\s+point|story\s+world|foreshadow\w*|exposition|subtext)\b/gi, "")
        .replace(/\b(establishing\s+the\s+(\w+\s+)?conflict|introduces?\s+the\s+(main|central)|central\s+conflict\s+of\s+the\s+story|(this\s+scene\s+)?(sets\s+up|establishes|introduces|demonstrates)\s+the)\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    // Sanitize the scene text for the chosen style BEFORE it touches the prompt or
    // the action extractor. This way "her voice was animated" never reaches the model
    // when style=realistic.
    const styleId = (projectStyle || "3d-cinematic") as string;
    // ── TOKEN RESOLUTION (Henry 2026-05-30, task #16) ─────────────────────────
    // Phase 3 root cause: typed character tokens like [CH01] in story-expanded text
    // were being passed LITERALLY to the image model when not in characterIds[]. The
    // model rendered the bracket text or made a generic placeholder character. Fix:
    // call resolveCharacterTokens BEFORE any sanitization. It walks bare and bracketed
    // tokens, swaps in the character's visualDescription, and surfaces extra reference
    // images we may have missed. Soft-fails to raw sceneText so this never blocks gen.
    let preResolvedSceneText: string = sceneText || "";
    let extraReferenceImages: string[] = [];
    try {
      const resolved = await resolveCharacterTokens(sceneText || "", characterIds);
      if (resolved?.enrichedPrompt) preResolvedSceneText = resolved.enrichedPrompt;
      if (Array.isArray(resolved?.referenceImages)) extraReferenceImages = resolved.referenceImages.filter(Boolean);
    } catch (tokenErr) {
      console.warn("[scene-image] token resolution soft-failed:", tokenErr instanceof Error ? tokenErr.message : tokenErr);
    }
    // FIX 9 (2026-05-22): strip pose language ("stands with a smile", "next to") BEFORE
    // sanitization. These were forcing the model into character-lineup compositions
    // even though the environment description was correct.
    const cleanSceneText = sanitizeStyleCollisions(sanitizeNarrativeJargon(stripPoseLanguage(preResolvedSceneText)), styleId);
    const sceneActionDirective = extractSceneAction(cleanSceneText);

    // ── ERA + CULTURE LOCK — computed once, used in prompt AND negative ──
    const eraLock = buildFullLock(storyEra || "", storyCulture || "", styleId);

    // Convert scene text to a static cinematic frame (removes action verbs that cause chaos imagery)
    const staticSceneText = toStaticFrame(cleanSceneText.slice(0, 300));

    // 2. Build structured image prompt
    // F2 (2026-05-21): location/action moved EARLY so FLUX commits to scene composition
    // BEFORE identity lock applies. Earlier order put character first → portrait pose
    // dominated → every scene looked like a character reference sheet.
    //
    // New order: [Era lock] → [Style] → [LOCATION + TIME + MOOD] → [SCENE TEXT + ACTION]
    //         → [Character identity (LATE)] → [Late style anchor] → [Quality]
    //
    // Era stays at position 0 — absolute world rule. Character moved to late position so
    // it acts as a refinement layer over an already-composed scene.
    const promptParts: string[] = [];

    // ── ERA + CULTURE LOCK (absolute first position) ──
    if (eraLock.positive) promptParts.push(eraLock.positive);

    // ── STYLE LOCK ──
    promptParts.push(stylePreset.prefix);

    // ── F2: SCENE SETTINGS pushed EARLY so composition forms before character lock ──
    if (location) promptParts.push(`Location: ${location}`);
    if (timeOfDay) promptParts.push(timeOfDay);
    if (mood) promptParts.push(`${mood} mood`);
    if (cameraFraming) promptParts.push(cameraFraming);

    // ── F3: Anti-portrait directive (only for realistic-family styles) ──
    const isRealisticFamily = styleId === "realistic" || styleId === "nollywood" || styleId === "3d-cinematic";
    if (isRealisticFamily) {
      promptParts.push(
        "cinematic scene shot, environmental composition, background fully visible, characters integrated into location, action moment with the environment, NOT a portrait, NOT a character reference sheet, NOT a character lineup",
      );
    }

    // ── ANIMAL DETECTION — explicit species from characterOverrides ONLY ──
    // NEVER scan scene text for "bear" — causes false positives when "bear" is used as a verb
    // ("cannot bear", "bearing gifts", "unbearable") which disables all bear protection.
    // Animal mode only activates when a character's species field is explicitly set.
    const sceneTextLower = (sceneText || "").toLowerCase();

    // Check characterOverrides species field — client sends this from CharacterIdentity
    const overrideSpecies: string[] = [];
    if (characterOverrides && Array.isArray(characterOverrides)) {
      for (const ov of characterOverrides as Array<{ species?: string; visualDescription?: string }>) {
        if (ov.species) overrideSpecies.push(ov.species.toLowerCase());
      }
    }
    const ANIMAL_SPECIES = new Set(["bear", "wolf", "lion", "fox", "rabbit", "dog", "cat", "tiger", "elephant", "monkey"]);
    const charSpeciesIsAnimal = overrideSpecies.some(s => ANIMAL_SPECIES.has(s));
    const explicitAnimal = charSpeciesIsAnimal; // scene text removed — too many verb false-positives

    // ── CHARACTER IDENTITY BLOCK ──
    // FAL/flux supports prompts up to ~2000 chars — allow full character descriptions.
    // Each field is run through the style sanitizer so a description like "his
    // animated face" doesn't sabotage realistic gen.
    // Per-character anti-stereotype negatives — built from actual description to counter
    // name-driven model bias (e.g. "Mama Iyabo" → model defaults to old market-woman stereotype)
    const charNegatives: string[] = [];

    const CHAR_DESC_LIMIT = 400;
    if (resolvedCharacters.length > 0) {
      const identityBlock = resolvedCharacters.map(c => {
        const desc = sanitizeStyleCollisions((c.visualDescription || "").slice(0, CHAR_DESC_LIMIT), styleId);
        // 3-C: Use lastSeenWardrobe for continuity when available; fall back to wardrobe default
        const wardrobeSource = c.lastSeenWardrobe ?? c.wardrobe;
        const wardrobePrefix = c.lastSeenWardrobe
          ? `same outfit as before: `
          : "wearing: ";
        // If no wardrobe was specified anywhere, force a fully-clothed default. PuLID
        // locked to a shirtless portrait will otherwise carry the shirtless state into
        // every scene. The scene-appropriate clothing direction overrides the body lock.
        const wardrobe = wardrobeSource
          ? `, ${wardrobePrefix}${sanitizeStyleCollisions(wardrobeSource.slice(0, 140), styleId)}`
          : `, fully clothed in scene-appropriate everyday clothing — shirt, top, or jacket covering the torso`;
        const hairstyle = c.hairstyle ? `, hair: ${sanitizeStyleCollisions(c.hairstyle.slice(0, 60), styleId)}` : "";
        const AGE_VISUAL: Record<string, string> = {
          child:       "6-10 year old child — small body, young face, child height and proportions. NOT a teen or adult.",
          teen:        "13-17 year old teenager — adolescent face, teenage build. NOT a young child or adult.",
          young_adult: "early-to-mid 20s young adult — smooth youthful skin, full dark hair, clean-shaven or light stubble at most, NO grey or white hair, NO deep wrinkles. NOT middle-aged, NOT 40s, NOT 50s.",
          adult:       "35-50 year old adult — fully mature face, adult proportions.",
          elder:       "65+ year old elder — white or grey hair, wrinkled face, aged posture. NOT young.",
        };
        const ageLock = c.age
          ? `, AGE LOCK: ${AGE_VISUAL[c.age] ?? c.age}. Render with accurate age-appropriate anatomy.`
          : "";
        const identityAnchor = c.imageUrl
          ? ` EXACT SAME FACE AND APPEARANCE as reference portrait — do NOT change this character's age, build, or face.`
          : "";

        // Build anti-stereotype negative for this character based on what they actually look like
        if (c.imageUrl || desc) {
          const antiAge = c.age === "young_adult"
            ? `old ${c.name}, elderly ${c.name}, middle-aged ${c.name}, 40 year old ${c.name}, 50 year old ${c.name}, grey-haired ${c.name}, grey-bearded ${c.name}, wrinkled ${c.name}, aging ${c.name}`
            : c.age === "adult"
            ? `old ${c.name}, elderly ${c.name}, aged ${c.name}`
            : c.age === "child" ? `adult ${c.name}, tall ${c.name}` : "";
          const descLower = desc.toLowerCase();
          const antiHeadwrap = (!descLower.includes("headwrap") && !descLower.includes("gele") && !descLower.includes("head wrap"))
            ? `headwrap on ${c.name}, gele on ${c.name}, head covering on ${c.name}`
            : "";
          const antiHeavy = (descLower.includes("slim") || descLower.includes("thin") || descLower.includes("slender"))
            ? `heavy ${c.name}, obese ${c.name}, overweight ${c.name}, heavy-set ${c.name}`
            : "";
          const antiYoung = (c.age === "elder") ? `young ${c.name}, youthful ${c.name}` : "";
          [antiAge, antiHeadwrap, antiHeavy, antiYoung].filter(Boolean).forEach(n => charNegatives.push(n));
        }

        // Appearance-first ordering: description BEFORE name to fight name-stereotype bias
        // (model sees physical description first, then "this person is named X" — not the reverse)
        if (desc) {
          return `${desc}${wardrobe}${hairstyle}${ageLock}${identityAnchor} (this character is named ${c.name})`;
        }
        return `${c.name}: ${wardrobe.replace(", ", "")}${hairstyle}${ageLock}${identityAnchor}`;
      }).join(" | ");
      promptParts.push(identityBlock);

      // ── CHARACTER ANATOMY SEPARATION (2026-05-09) ──
      // ONLY uses explicit species from characterOverrides — never infers species from visual
      // description text (that caused false-positive bear heads when desc had "bear" anywhere).
      if (resolvedCharacters.length >= 2) {
        const speciesByName: string[] = [];
        for (const c of resolvedCharacters) {
          const ovs = (characterOverrides as Array<{ name?: string; species?: string }> | undefined)
            ?.find(o => o.name === c.name)?.species?.toLowerCase() ?? "";
          // Only treat as animal if the species field EXPLICITLY names an animal
          const isAnimal = ANIMAL_SPECIES.has(ovs);
          if (isAnimal) {
            speciesByName.push(`${c.name} is a ${ovs} (${ovs} face, ${ovs} body, ${ovs} anatomy — NOT human)`);
          } else {
            // GENESIS BEAR FIX (Henry 2026-05-30): positive prompt MUST NOT mention "bear"
            // or "animal" — diffusion models prime on positive-side concept mentions even
            // when negated. Stick to affirming "human" only.
            speciesByName.push(`${c.name} is a fully human person (human face, human body, realistic human anatomy)`);
          }
        }
        promptParts.push(
          `${resolvedCharacters.length} separate human characters, each with their own face and body. ` +
          speciesByName.join(". ") + ". " +
          "Each character has a fully human face and head with realistic human features."
        );
      }
    }

    // ── PERSON-COUNT LOCK (2026-05-28) — stop phantom extra / duplicate people ──
    // The model frequently adds people not in the scene (a 2-character scene rendering 3
    // people). When we have a known small cast AND the scene isn't a crowd scene, pin the
    // exact count + add an extra-people negative below. Skipped for crowd/market/party/class
    // scenes where background people are intended, and for animal scenes.
    const sceneHasCrowd = /\b(crowd|crowded|market|marketplace|party|audience|gathering|stadium|festival|wedding|concert|protest|rally|classroom|class|team|villagers|townspeople|guests|spectators|congregation|queue|busy street|group of|many people|onlookers|mob)\b/i.test(sceneText || "");
    let personCountActive = false;
    let personCountDirective = "";
    if (resolvedCharacters.length >= 1 && resolvedCharacters.length <= 4 && !sceneHasCrowd && !explicitAnimal) {
      personCountActive = true;
      const n = resolvedCharacters.length;
      const names = resolvedCharacters.map(c => c.name).join(", ");
      personCountDirective = n === 1
        ? `EXACTLY ONE person in the entire frame: ${names}. A solo shot — no other people anywhere, no second person, no bystanders, no background figures.`
        : `EXACTLY ${n} people total in the entire frame and no more: ${names}. Each of these ${n} is a visually DISTINCT individual — do NOT duplicate, repeat, mirror or clone any of them, do NOT add a similar-looking extra person, no additional people, no bystanders, no background crowd.`;
      // Push it here (mid-prompt) AND repeat near the end (late anchor) — image models weight
      // both early and late tokens, and a single mid-prompt mention was being ignored when two
      // characters looked similar (model duplicated the archetype → phantom 3rd person).
      promptParts.push(personCountDirective);
    }

    // ── SCENE DESCRIPTION + ACTION DIRECTIVE ──
    // staticSceneText = cleanSceneText converted to a still-frame description (action verbs removed)
    // PROTECTED: action directive must stay — it prevents "calm standing" images for tense scenes.
    promptParts.push(staticSceneText);
    promptParts.push(sceneActionDirective);

    // ── HUMAN CHARACTER GUARD — INJECTED LATE (after character block) for maximum override force ──
    // Applied whenever NO explicit animal signal from scene or character species AND there
    // IS at least one human character assigned. Without the character-presence check the
    // guard fires on object-only scenes (e.g. "I is for Ice Cream", "P-I-G = PIG") and
    // forces the model to render a group of kids in place of the actual object, producing
    // generic "children illustration" outputs that ignore the letter/word being taught.
    if (!explicitAnimal && resolvedCharacters.length > 0) {
      // GENESIS BEAR FIX (Henry 2026-05-30): purge "bear/animal/fur/snout/paws" from
      // POSITIVE prompt — diffusion models prime on what's mentioned regardless of NO/NOT.
      // Use affirmative-only phrasing here; negatives go in the negative prompt only.
      promptParts.push(
        "Every character is a fully human person with realistic human face, human anatomy, " +
        "human skin, human hands, and human proportions."
      );
    }

    // (Settings moved EARLY by F2 — no late-position duplicate needed.)

    // ── LATE-POSITION PERSON-COUNT REPEAT — strong final reminder of exact headcount ──
    if (personCountActive && personCountDirective) {
      promptParts.push(personCountDirective);
    }

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

    // bear-guard: hard negative — always block bear/animal features on human characters.
    // GENESIS BEAR FIX (Henry 2026-05-30): trimmed from 12+ bear-words to a tighter phrase.
    // Heavy negative repetition was paradoxically priming the model (a known diffusion
    // anti-pattern). Combined with positive-side bear/animal mention removal above, this
    // should kill the recurring bear-head defaults on human characters.
    const bearNegative = explicitAnimal
      ? ""
      : ", animal head on human body, furry creature, snout, paws, animal face, anthropomorphic creature, non-human face, creature head";
    // Hybrid-feature guard — always block species merging
    const hybridNegative = ", human face on animal, animal face on human, hybrid creature, fused characters, character merging, blended anatomy, chimera, anthropomorphic merge, mixed species body, animal head replacing human head";

    // Phone negative — unless scene description explicitly mentions phones/smartphones
    const sceneHasPhone = /\b(phone|smartphone|mobile|cellphone|call|text|WhatsApp|screen)\b/i.test(sceneText || "");
    const phoneNegative = sceneHasPhone ? "" : ", holding smartphones, holding phones, staring at phones, mobile phone in hand, cellphone, people on phones";

    // F3: Anti-portrait negative — fires only for realistic-family styles where the
    // model otherwise defaults to character-reference-sheet compositions (3 people
    // standing in a row, plain backdrop). Skip for cartoon/storybook where simpler
    // compositions are sometimes correct.
    const antiPortraitNegative = isRealisticFamily
      ? ", portrait style, character reference sheet, character lineup, characters standing in a row, plain studio background, blank backdrop, photo studio lighting, neutral pose, posed standing, character sheet, side by side portraits, mugshot style, headshot row, models posing for camera, fashion shoot composition, all characters facing camera, group photo composition, static standing still, hands at sides motionless"
      : "";

    // Nudity / shirtless negative — fires unless the scene explicitly calls for it (beach,
    // shower, swim, etc.). Stops the model defaulting to shirtless fitness-style portraits,
    // which is a strong bias for Black male characters when PuLID locks a shirtless portrait.
    const sceneIsNudeContext = /\b(shirtless|bare\s*chest|topless|swim|swimming|beach|pool|shower|bathing|bath|sauna|gym|workout|fitness|sex|nude|naked|nudity)\b/i.test(sceneText || "");
    const nudityNegative = sceneIsNudeContext ? "" : ", shirtless, bare chested, topless, no shirt, half nude, half naked, naked torso, fitness pose, athletic poster pose, swimwear, underwear, briefs, fully nude";

    // Style-collision negatives — extra muscle behind the negative when live-action is selected.
    // getStyleCollisionNegative imported from @/lib/style/sanitizer (Phase B extraction)
    const eraNegative = eraLock.negative ? `, ${eraLock.negative}` : "";
    const charNegativeStr = charNegatives.length > 0 ? `, ${charNegatives.join(", ")}` : "";
    // Extra-people negative — pairs with the PERSON-COUNT LOCK above. Only when we pinned a
    // known small cast (skipped for crowd scenes), so intended background crowds aren't removed.
    const extraPeopleNegative = personCountActive
      ? ", extra person, extra people, additional people, more people than described, duplicate character, cloned face, identical twins, repeated person, background crowd, bystanders, photobomber, extra figures in background, group of strangers"
      : "";

    // Film-crew negative — the prompt's "cinematic / camera framing / scene shot / still
    // frame" language was making the model render a LITERAL film camera + cameraman in the
    // scene (Henry's workshop render had a camera operator between the two characters).
    // Suppress film-set equipment unless the scene is actually about filming. (2026-05-28)
    const sceneIsFilmmaking = /\b(film(ing|maker)?|movie set|on set|film set|camera crew|cinematographer|director(ing)?|shoot(ing)? a (movie|film|video|scene)|recording a video|video shoot|photo ?shoot|behind the scenes)\b/i.test(sceneText || "");
    const filmCrewNegative = sceneIsFilmmaking
      ? ""
      : ", film camera, movie camera, cinema camera, video camera, camcorder, cameraman, camera operator, film crew, boom microphone, boom mic, camera on tripod, film set equipment, clapperboard, studio camera rig, person holding a camera, person operating a camera, photographer in frame";

    // Anti-fantasy guard — block angel/fairy wings, halos, divine glow, mythical beings in
    // non-fantasy stories so ambiguous words ("plane wings", "soar", "masterpiece glows")
    // don't drift into literal fantasy imagery. Context = scene + character descs + culture.
    const fantasyContext = `${sceneText || ""} ${storyCulture || ""} ${resolvedCharacters.map(c => c.visualDescription || "").join(" ")}`;
    const antiFantasyNegative = getAntiFantasyNegative(fantasyContext);
    const negativePrompt = stylePreset.negative + bearNegative + hybridNegative + phoneNegative + nudityNegative + antiPortraitNegative + charNegativeStr + extraPeopleNegative + filmCrewNegative + antiFantasyNegative + getStyleCollisionNegative(styleId) + eraNegative;

    // 3. Collect reference images from characters — normalize paths to /api/media/ URLs
    function normalizeRef(url: string): string {
      if (!url) return url;
      if (url.startsWith("http") || url.startsWith("/api/")) return url;
      const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
      return `/api/media/${cleaned}`;
    }
    // FACE-LOCK PUBLIC URL (2026-05-28): FAL PuLID FETCHES the reference portrait over HTTP,
    // so it needs an ABSOLUTE public URL — a relative /api/media/... path is unreachable from
    // FAL's servers. NEXT_PUBLIC_APP_URL = https://andiostudio.com (public via CF tunnel, already
    // serves /api/media/ with HTTP 200). This is why R2 is NOT required for face-lock.
    function toPublicUrl(u: string): string {
      if (!u) return u;
      if (u.startsWith("http://") || u.startsWith("https://")) return u;
      const base = (env.appUrl || "").replace(/\/$/, "");
      return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
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
    // Append references surfaced by resolveCharacterTokens for tokens that weren't
    // already in characterIds[] (Henry 2026-05-30 task #16 — token resolution).
    for (const refUrl of extraReferenceImages) {
      if (refUrl && !referenceImageUrls.includes(refUrl)) {
        referenceImageUrls.push(normalizeRef(refUrl));
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
    // F4 (2026-05-22): drop PuLID for multi-character scenes. PuLID only locks ONE
    // face, but it ALSO carries the portrait's composition (standing pose, plain bg)
    // into every scene. For 2+ characters, the trade-off doesn't make sense:
    //   - PuLID locks one face, fakes the others anyway
    //   - The portrait composition dominates → scenes look like character lineups
    // For multi-char scenes, drop PuLID entirely. Use text-only character descriptions
    // (rich identity block already in prompt). Accept face drift on group shots in
    // exchange for proper scene composition.
    //
    // FIX 7 (2026-05-23): ALSO drop PuLID for SINGLE-char scenes when location text
    // is rich enough to compose without face anchor. PuLID drags portrait composition
    // (standing pose, neutral background) into scenes that have detailed location.
    // Closeup/portrait framings still keep PuLID — those WANT the face anchor.
    const isMultiChar = resolvedCharacters.length > 1;
    const isCloseup = /\b(close\s*up|portrait\s+shot|headshot|head\s+shot|face\s+shot|tight\s+shot)\b/i.test(cameraFraming || "");
    const richLocation = !isCloseup && (
      (!!location && location.length > 20 && cleanSceneText.length > 80)
      || (!!location && !!mood && !!timeOfDay)
    );
    const willFaceLock = (hasPhotoImportChar || referenceImageUrls.length > 0)
      && !isMultiChar
      && !richLocation;
    const dropReason = isMultiChar
      ? " (PuLID dropped — multi-char scene)"
      : richLocation
      ? " (PuLID dropped — single char + rich location; FIX 7)"
      : "";
    // ── FREE cross-scene character consistency — NO paid face-lock API (2026-05-28) ──
    // Henry: don't rely on paid APIs. Instead of PuLID/InstantID, derive a STABLE per-character
    // seed from the primary character's id/name. Same character → same seed every scene, which
    // (with the already-locked canonical visualDescription + style) keeps appearance consistent
    // across scenes using ONLY the base image model — no extra API, no spend. FAL PuLID stays
    // available as the PREMIUM exact-face-lock upgrade for when FAL is funded (willFaceLock path).
    function stableSeedFrom(s: string): number {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return Math.abs(h | 0) % 2147483647;
    }
    const primaryChar = resolvedCharacters[0];
    const effectiveSeed: number | undefined =
      (seed !== undefined && seed !== null)
        ? Number(seed)
        : (primaryChar ? stableSeedFrom(primaryChar.characterId || primaryChar.id || primaryChar.name) : undefined);

    console.log(`[scene-image] sceneId=${sceneId} chars=${resolvedCharacters.length} ages=[${resolvedCharacters.map(c => c.age || "?").join(",")}] portraits=${referenceImageUrls.length} faceLock=${willFaceLock}${dropReason} closeup=${isCloseup} locLen=${(location || "").length} sceneLen=${cleanSceneText.length} seed=${effectiveSeed ?? "random"} firstPortrait=${referenceImageUrls[0]?.slice(0, 80) || "none"}`);
    let result = await generateImage({
      modelId: modelId || undefined,
      prompt: structuredPrompt,
      negativePrompt: negativePrompt,
      width: 1280,
      height: 720,
      seed: effectiveSeed,
      outputPath,
      referenceImageUrl: willFaceLock ? toPublicUrl(referenceImageUrls[0]) : undefined,
      // F4: skip identity lock for multi-character scenes — composition wins over face precision
      useIdentityLock: willFaceLock,
    });

    if (!result.success && result.model) {
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
            seed: effectiveSeed,
            outputPath,
            referenceImageUrl: willFaceLock ? toPublicUrl(referenceImageUrls[0]) : undefined,
            useIdentityLock: willFaceLock,
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

    // ── CDN→LOCAL DOWNLOAD GUARANTEE (Henry 2026-05-30 "images not displaying" bug) ──
    // Some image providers return a CDN URL (e.g. FAL fal.media) without saving locally.
    // FAL CDN URLs expire in ~3h → broken thumbnails on every reload. Without this guard
    // the response can return a CDN URL or even the raw server path (Windows or Linux
    // local) that the browser can't fetch. After this download, result.imagePath is
    // always set → line 734 always returns the /api/media/... localImageUrl.
    if (!result.imagePath && result.imageUrl) {
      try {
        const dl = await fetch(result.imageUrl);
        if (dl.ok) {
          const buf = Buffer.from(await dl.arrayBuffer());
          fs.writeFileSync(outputPath, buf);
          result.imagePath = outputPath;
        } else {
          console.warn(`[scene-image] CDN download failed (HTTP ${dl.status}) — leaving result.imageUrl as-is; thumbnail may break when CDN expires`);
        }
      } catch (dlErr) {
        console.warn("[scene-image] CDN download exception — leaving result.imageUrl as-is:", dlErr instanceof Error ? dlErr.message : dlErr);
      }
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
    // Build a clear face-lock diagnostic so the UI can show what happened.
    // faceLockRequested: caller asked for identity lock (portrait present)
    // faceLockUsed: PuLID model actually ran (model.id === fal_flux_pulid AND result succeeded)
    const faceLockUsed = result.success && result.model?.id === "fal_flux_pulid";
    const faceLockDiagnostic = {
      requested: willFaceLock,
      used: faceLockUsed,
      modelUsed: result.model?.id || null,
      portraitCount: referenceImageUrls.length,
      reason: willFaceLock
        ? (faceLockUsed
            ? "PuLID face-lock applied"
            : `model fell back to ${result.model?.id} — portrait may have failed to upload to FAL CDN`)
        : "no portrait provided",
    };
    return NextResponse.json({
      success: true,
      imageUrl: result.imagePath ? localImageUrl : result.imageUrl,
      imagePath: result.imagePath || outputPath,
      prompt: structuredPrompt,
      model: result.model?.id,
      provider: result.model?.provider_name,
      characters: resolvedCharacters.map(c => ({ id: c.id, characterId: c.characterId, name: c.name, age: c.age })),
      referenceImages: referenceImageUrls,          // 4-A: all collected reference URLs (array)
      referenceImagesUsed: referenceImageUrls.length, // 4-A: count for diagnostics
      faceLock: faceLockDiagnostic,                  // NEW: visible PuLID status for client UI
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
