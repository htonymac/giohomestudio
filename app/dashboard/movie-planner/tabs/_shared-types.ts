// ─────────────────────────────────────────────────────────────────────────────
// Shared types for movie-planner tab components.
//
// WHAT THIS FILE IS:
//   When we split the giant movie-planner page.tsx into per-tab files, the parent
//   still owns every piece of state. Each tab is a "dumb" UI that takes state in
//   as props. Some types (like ScriptSegment) appear in multiple tabs — putting
//   them here means parent + child see the SAME type, avoiding silent drift.
//
// WHEN TO ADD A TYPE HERE:
//   - Type is used by 2+ tabs.
//   - Type is part of the parent ↔ child prop contract.
//
// WHEN NOT TO ADD A TYPE HERE:
//   - Tab uses it only internally → keep inline in the tab file.
// ─────────────────────────────────────────────────────────────────────────────

// One line of parsed screenplay. Either a narrator beat or a character dialogue.
// `speaker` is only set when type = "dialogue" (e.g., "JANE", "DETECTIVE SMITH").
export interface ScriptSegment {
  type: "narration" | "dialogue";
  speaker?: string;
  text: string;
}
