// src/lib/scene/action-extractor.ts
// Central home for extractSceneAction. Previously inline in:
//   app/api/hybrid/scene-image/route.ts (PROTECTED block)
//
// Extracted in Phase B of SEGREGATION_PLAN.md (2026-05-08).
// PROTECTED comment preserved below — do not remove or simplify.

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
// promptParts.push(actionDirective) line in scene-image/route.ts exactly as written.
// ════════════════════════════════════════════════════════════════════════════════

export function extractSceneAction(text: string): string {
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
  // FIX 9 (2026-05-22): default fallback now explicitly blocks portrait/lineup composition.
  // Henry's complaint: scenes were showing actors POSING for a photo (3-in-a-row, facing camera)
  // instead of ACTING. This default is what fires when no specific action keyword matches.
  return "characters MID-ACTION, captured in motion or mid-gesture, candid documentary-style framing, NOT standing still, NOT posing for camera, NOT facing camera in a row, NOT a character lineup, NOT a photo shoot, NOT a fashion pose, each character actively doing something different, dynamic asymmetric composition with depth";
}

// FIX 9 (2026-05-22): strip pose verbs from raw scene text BEFORE prompt build.
// Story-expand and scene-plan often produce "Malik stands with a warm smile next to Andre" —
// literal "stands" + "next to" = lineup composition. Replace with action verbs.
export function stripPoseLanguage(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bstands?\s+with\s+a?\s*(\w+)\s+smile/gi, "is mid-action with a $1 expression")
    .replace(/\bstands?\s+next\s+to\b/gi, "is working alongside")
    .replace(/\bstands?\s+beside\b/gi, "works beside")
    .replace(/\bstanding\s+next\s+to\b/gi, "working alongside")
    .replace(/\bstanding\s+beside\b/gi, "working beside")
    .replace(/\bstands?\s+confidently\b/gi, "moves confidently")
    .replace(/\bposes?\s+for\b/gi, "is engaged with")
    .replace(/\bposing\b/gi, "actively gesturing")
    .replace(/\bsits?\s+quietly\b/gi, "is seated, working on")
    .replace(/\bstands?\s+together\b/gi, "are mid-action together")
    .replace(/\bsmiling\s+at\s+the\s+camera\b/gi, "smiling at each other")
    .replace(/\blooking\s+at\s+the\s+camera\b/gi, "looking at the scene action");
}
