// Shared output-video naming (Henry 2026-06-20) — used by ALL planners (children, commercial,
// hybrid, movie, music) so every rendered video downloads with a meaningful, look-up-able name.
//
//   • projNumber(seed)  — a stable 10-digit tracking NUMBER from the project id/seed
//     (same seed → same number forever; no DB column). For lookup/categorization by Henry or any AI.
//   • buildOutputName({ parts, seed }) — friendly filename: ordered descriptive parts + the number,
//     joined by "_", sanitised, e.g. "whoLoveMe_afro_username_8838333939.mp4".
//
// Per-planner part schemes (Henry's conventions):
//   music    : ["<songTitle>", "<genre>", "<username>"]      → whoLoveMe_afro_username_<num>.mp4
//   children : ["<age>", "<title>"]   (age optional)          → 7yrs_ABC_to_Z_<num>.mp4
//   movie    : ["<title>"]                                    → MyMovie_<num>.mp4
//   hybrid   : ["<title>"]
//   commercial: ["<productOrProjectName>"]                    → 2BedApartment_<num>.mp4

export function projNumber(seed: string): string {
  const s = seed || "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(1_000_000_000 + (h % 9_000_000_000));
}

function sanitise(part: string, max = 40): string {
  return (part || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, max);
}

export function buildOutputName(opts: {
  parts: Array<string | null | undefined>;  // ordered descriptive segments; empties are dropped
  seed: string;                              // project id (or any stable id) → the tracking number
  ext?: string;                              // default "mp4"
}): string {
  const ext = opts.ext || "mp4";
  const num = projNumber(opts.seed);
  const stem = opts.parts.map(p => sanitise(p ?? "")).filter(Boolean).join("_") || "video";
  return `${stem}_${num}.${ext}`;
}
