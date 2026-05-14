// src/lib/scene/action-beats.ts
// Central home for splitIntoActionBeats. Previously duplicated in 2 planner pages:
//   app/dashboard/hybrid-planner/page.tsx
//   app/dashboard/children-planner/page.tsx
//
// Extracted in Phase B of SEGREGATION_PLAN.md (2026-05-08).
// Canonical version = hybrid-planner/page.tsx (identical to children-planner copy).

/**
 * splitIntoActionBeats — walks a scene description and splits it on sentence
 * boundaries and action connectors (then/suddenly/before/while/after).
 * Returns up to 10 discrete beats.
 *
 * WHY THIS EXISTS: Gen Max generates one image per beat. A scene like
 * "Bryan ran down the hall. Suddenly he tripped. Then he saw the monster."
 * should produce 3 images, not 1.
 */
export function splitIntoActionBeats(text: string): string[] {
  if (!text || text.length < 15) return [text || ""];
  const parts = text
    .replace(/([.!?])\s+/g, "$1|B|")
    .replace(/,\s*(then|before|while|after|but|suddenly|finally|next|as)\s+/gi, "|B|$1 ")
    .replace(/\s+(then|suddenly|finally|after that|meanwhile|before|while)\s+/gi, "|B|$1 ")
    .split("|B|")
    .map(s => s.trim().replace(/^[,.\s]+/, ""))
    .filter(s => s.length > 8);
  return parts.length > 1 ? parts.slice(0, 10) : [text];
}
