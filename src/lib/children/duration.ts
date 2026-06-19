// The single duration parser for children videos.
// Replaces the buggy `parseInt(str.replace(/[^0-9]/g,""))` in children-planner
// (which turned "5 min" into 5 seconds). Every place that reads a duration must
// go through this so all the controls agree on ONE number of seconds.

/**
 * Parse a duration into whole seconds.
 *  - number        -> that many seconds (rounded, must be > 0)
 *  - "300"         -> 300 seconds (unit-less = seconds)
 *  - "60 sec"      -> 60
 *  - "5 min"       -> 300
 *  - "1 hour"/"1 hr" -> 3600
 * Anything unparseable returns `fallback` (default 60).
 */
export function parseDurationToSeconds(input: string | number, fallback = 60): number {
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? Math.round(input) : fallback;
  }
  const s = String(input ?? "").trim().toLowerCase();
  const m = s.match(/[0-9]*\.?[0-9]+/);
  if (!m) return fallback;
  const num = parseFloat(m[0]);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (/hour|hr/.test(s)) return Math.round(num * 3600);
  if (/min/.test(s)) return Math.round(num * 60);
  // "sec", "s", or a bare number all mean seconds
  return Math.round(num);
}
