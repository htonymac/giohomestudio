// Friendly + unique project naming for children videos.
// Pure helpers (caller passes the seed so this stays testable) — keeps the
// naming logic out of the giant planner component.

/** "word-family" / "word family" -> "Word Family". */
export function titleCaseName(raw: string): string {
  return (raw || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * A 4-digit suffix so the SAME selection (e.g. "Word Family") chosen 100+ times
 * yields distinct project-list rows ("Word Family 7373"). Derived from a seed
 * (pass Date.now()) so two users / two runs of the same selection differ.
 */
export function uniqueTitleSuffix(seed: number): string {
  return String(1000 + (Math.abs(Math.round(seed)) % 9000));
}

/** "word family" + seed -> "Word Family 7373". */
export function makeChildProjectTitle(selection: string, seed: number): string {
  const base = titleCaseName(selection) || "Children Project";
  return `${base} ${uniqueTitleSuffix(seed)}`;
}

/** Strip a trailing numeric suffix for clean presentation: "Word Family 7373" -> "Word Family". */
export function cleanDisplayTitle(title: string): string {
  return (title || "").replace(/\s+\d{3,}$/, "").trim();
}
