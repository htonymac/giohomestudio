// src/lib/style/late-anchor.ts
// Central home for the per-style late-position anchor string.
// Previously duplicated across 3 routes:
//   app/api/hybrid/scene-image/route.ts
//   app/api/character-voices/[id]/generate-portrait/route.ts
//   app/api/hybrid/scene-video/route.ts  (was an inline conditional chain)
//
// Extracted in Phase B of SEGREGATION_PLAN.md (2026-05-08).
// Canonical version = scene-image/route.ts (full 7-key map).
//
// WHY THIS EXISTS:
// Image models weight late-position tokens heavily — repeating a tight style cue at
// the very END of the prompt fights drift caused by collision words that couldn't be
// fully removed (e.g. character names that happen to be style words).

export const LATE_ANCHOR_MAP: Record<string, string> = {
  "realistic":    "Final output: a real photograph, NOT a 3D render, NOT animation, NOT illustration",
  "nollywood":    "Final output: real Nollywood film photography, NOT animation, NOT illustration",
  "3d-cinematic": "Final output: 3D animated film frame, Pixar/DreamWorks rendering",
  "2d-cartoon":   "Final output: flat 2D cartoon illustration, NOT 3D, NOT photo",
  "anime":        "Final output: anime illustration, NOT 3D render, NOT photo",
  "storybook":    "Final output: storybook illustration, NOT photo, NOT 3D render",
  "comic":        "Final output: comic book panel, NOT photo, NOT 3D render",
};

/**
 * getLateAnchor — returns the late-position style reinforcement string for the given styleId.
 * Falls back to 3d-cinematic if the styleId is unknown.
 */
export function getLateAnchor(styleId: string): string {
  return LATE_ANCHOR_MAP[styleId] ?? LATE_ANCHOR_MAP["3d-cinematic"];
}
