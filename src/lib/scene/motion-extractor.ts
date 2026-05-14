// src/lib/scene/motion-extractor.ts
// Central home for extractMotionAction. Previously inline in:
//   app/api/hybrid/scene-video/route.ts
//
// Extracted in Phase B of SEGREGATION_PLAN.md (2026-05-08).
//
// WHY THIS EXISTS: Video models read raw sceneText as a still description and default
// to slow zoom / panning. They need an explicit motion verb directive so the clip
// actually animates the action.
//
// Categories match extractSceneAction (scene/action-extractor.ts) so a confrontation
// image and confrontation video are directed by the same vocabulary.

/**
 * extractMotionAction — mirrors scene-image's extractSceneAction but phrased for motion.
 *
 * Returns a directive string describing the movement expected in the video clip.
 * This is appended to the video model's prompt so the clip animates the correct action
 * rather than defaulting to a slow pan/zoom over a static scene.
 */
export function extractMotionAction(text: string): string {
  const t = text.toLowerCase();

  if (/confront|bully|bullies|block.*path|stand.*way|threaten|intimidat|face.*off|gang.*up/.test(t))
    return "characters confronting each other with tense aggressive movement, hostile body shifts, motion of intimidation";

  if (/fight|attack|punch|kick|battle|struggle|brawl|shove|push|hit/.test(t))
    return "characters fighting in motion, punching kicking grappling, dynamic combat movement, dramatic action choreography";

  if (/chase|chasing|run.*away|escape|flee|pursuit|catch.*him|catch.*her|catch.*them|sprint/.test(t))
    return "fast chase motion, characters running at speed, pursuer behind, urgent forward movement, motion blur";

  if (/fear|terrif|horrif|scream|panic|trembl|shak|cower|hide|creeped/.test(t))
    return "character trembling and backing away in fear, panicked movement, shaking, retreating motion";

  if (/rescue|save|help|grab.*hand|pull.*out|lift|carry|protect/.test(t))
    return "rescue motion, one character pulling or lifting another to safety, urgent rescue movement";

  if (/argue|argument|shout|yell|scream.*at|disagree|furious|rage|anger/.test(t))
    return "heated argument with animated gesturing, pointing, sharp head turns, intense verbal confrontation movement";

  if (/discover|realiz|shock|reveal|surprise|stunned|gasp|uncover|find/.test(t))
    return "moment of discovery, head turning sharply, eyes widening, shocked physical reaction";

  if (/cry|crying|sob|griev|mourn|tears|heartbroken|despair|loss/.test(t))
    return "slow grief motion, slumping shoulders, head lowering, subtle emotional movement";

  if (/celebrat|cheer|victory|win|triumph|joy|hug|embrace|relief/.test(t))
    return "celebration motion, arms raising, embracing, jumping with joy, energetic happy movement";

  if (/sneak|hide|hiding|crouch|lurk|spy|shadow|stalk|creep/.test(t))
    return "stealth motion, slow crouched movement, careful steps, tense sneaking";

  if (/talk|discuss|meet|conversat|explain|listen|whisper|greet/.test(t))
    return "natural conversation movement, head turns, expressive gestures, engaged speaking";

  return "natural cinematic motion matching the scene action, purposeful character movement";
}
