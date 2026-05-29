// src/lib/style/sanitizer.ts
// Central home for style-collision helpers. Previously duplicated across 4 routes:
//   app/api/hybrid/scene-image/route.ts
//   app/api/hybrid/scene-video/route.ts
//   app/api/character-voices/[id]/generate-portrait/route.ts
//   app/api/generation/image/route.ts
//
// Extracted in Phase B of SEGREGATION_PLAN.md (2026-05-08).
// Canonical version = scene-image/route.ts (most complete replacement map).

// ════════════════════════════════════════════════════════════════════════════════
// ── STYLE COLLISION SANITIZER ── PROTECTED — DO NOT REMOVE OR SIMPLIFY ──────────
//
// WHY THIS EXISTS:
// Image models read every word in the prompt as a style cue. Words like "animated",
// "cartoonish", "sketched", "painted" are STRONG training signals — when they appear
// anywhere in the prompt the model leans toward animation/illustration output, even
// when the style prefix says "Live-action photo".
//
// EXAMPLE OF THE BUG: User writes "her voice was animated and confident". Realistic
// is selected. The image still comes back as a 3D-rendered character because
// "animated" overpowered the realistic anchor.
//
// FIX: For LIVE-ACTION styles (realistic, nollywood) we replace these collision
// words with neutral synonyms BEFORE the text is injected into the prompt. The user's
// intent (expressive voice) is preserved; the style cue (animated) is removed.
//
// For ANIMATION styles (3d-cinematic, 2d-cartoon, anime, comic, storybook) we leave
// the words alone — they don't collide with the chosen style.
//
// SCOPE: Applies to sceneText AND character visualDescription/wardrobe/hairstyle
// because all three are concatenated into the final prompt.
// ════════════════════════════════════════════════════════════════════════════════
export function sanitizeStyleCollisions(text: string, styleId: string | null | undefined): string {
  if (!text) return text;
  const isLiveAction = styleId === "realistic" || styleId === "nollywood";
  if (!isLiveAction) return text;
  // Order matters — replace longer phrases before single words.
  const replacements: Array<[RegExp, string]> = [
    [/\banimated voice\b/gi, "expressive voice"],
    [/\banimated and\b/gi, "expressive and"],
    [/\banimated\b/gi, "expressive"],
    [/\bcartoonish\b/gi, "exaggerated"],
    [/\bcartoon-like\b/gi, "stylized"],
    [/\bcomic relief\b/gi, "humorous moment"],
    [/\bcomic timing\b/gi, "perfect timing"],
    [/\bsketched\b/gi, "rough"],
    [/\bdrawn out\b/gi, "extended"],
    [/\bdrawn into\b/gi, "pulled into"],
    [/\bpainted on\b/gi, "fixed on"],
    [/\brendered\b/gi, "shown"],
    [/\billustrated\b/gi, "shown"],
  ];
  let result = text;
  for (const [re, sub] of replacements) result = result.replace(re, sub);
  return result;
}

/**
 * getStyleCollisionNegative — extra negative-prompt tokens for live-action styles.
 *
 * WHY THIS EXISTS: Some collision words survive the sanitizer (e.g. they're part of a
 * character name or a quoted phrase). The negative prompt provides a second defence: the
 * model is explicitly told NOT to produce animation/render output.
 *
 * Returns an empty string for animation styles — they don't need the extra block.
 */
export function getStyleCollisionNegative(styleId: string): string {
  return (styleId === "realistic" || styleId === "nollywood")
    ? ", animated, animation, cartoon, 3D rendered, CGI, illustrated, drawn, sketch, painted, anime, stylized, plastic skin, doll-like, video game graphics"
    : "";
}

/**
 * getAntiFantasyNegative — stop the image model rendering ambiguous / metaphorical words as
 * literal FANTASY imagery in NON-fantasy stories.
 *
 * WHY THIS EXISTS (2026-05-28): a realistic story about building a model "plane" (which has
 * wings) rendered an ANGEL with wings — words like "wings", "flight", "soar", "masterpiece",
 * "glows with light" carry a strong divine/fantasy prior in diffusion models. For any story
 * that is NOT fantasy/mythical/supernatural, we negate angels, halos, fairy/feathered wings
 * on people, divine/ethereal glow, mythical creatures, and surreal/dreamlike output.
 *
 * Aircraft / vehicle wings are NOT affected — the positive prompt names the object ("airplane",
 * "model plane"); this only blocks wings-on-a-person and fantasy beings. Returns "" when the
 * context IS fantasy/supernatural so genuine fantasy or ghost stories still render correctly.
 *
 * @param contextText scene text + character descriptions + culture/genre — anything that would
 *                     legitimately signal a fantasy setting.
 */
export function getAntiFantasyNegative(contextText: string): string {
  const isFantasy = /\b(angel|angelic|halo|fairy|fairies|dragon|magic|magical|wizard|witch|sorcer|mythical|myth|mytholog|fantasy|fairytale|fairy ?tale|goddess|deity|demon|devil|spirit|ghost|phantom|haunt|supernatural|enchant|fae|elf|elves|elven|dwarf|orc|unicorn|phoenix|griffin|mermaid|winged (being|man|woman|girl|boy|figure|creature|warrior|guardian)|heaven|divine|celestial|afterlife|valkyrie|seraph)\b/i.test(contextText || "");
  if (isFantasy) return "";
  return ", angel, angel wings, angelic figure, halo, feathered wings, bird wings on a person, fairy wings, butterfly wings on a person, winged human, winged person, winged figure, fairy, dragon, mythical creature, fantasy creature, magical glow, ethereal glow, divine light beams, heavenly light, celestial being, glowing magical aura, supernatural, surreal, dreamlike, floating person, levitating figure";
}
