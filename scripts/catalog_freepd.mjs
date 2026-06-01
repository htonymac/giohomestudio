// scripts/catalog_freepd.mjs — One-time-ish catalog pass over storage/music/stock/freepd/
// Adds explicit manifest entries for every .mp3 file with mood/genre inferred from
// filename heuristics. Idempotent — skips entries already present in the manifest by id.
// Henry 2026-05-31: explicit catalog per safe-music policy.
//
// Usage:
//   node scripts/catalog_freepd.mjs           # write to manifest
//   node scripts/catalog_freepd.mjs --dry     # preview only, no write

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const STOCK_DIR = path.resolve(here, "..", "storage", "music", "stock");
const FREEPD_DIR = path.join(STOCK_DIR, "freepd");
const MANIFEST_PATH = path.join(STOCK_DIR, "manifest.json");

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/**
 * Infer mood from filename (lowercased, extension stripped).
 * First match wins.
 * @param {string} base — lowercase filename without extension
 * @returns {string} mood token
 */
function inferMood(base) {
  if (/epic|heroic|battle|war/.test(base)) return "epic";
  if (/sad|emotional|requiem|reflection/.test(base)) return "emotional";
  if (/happy|joyful|merry|sunny|play/.test(base)) return "playful";
  if (/calm|dream|ambient|soft|gentle/.test(base)) return "calm";
  if (/dark|mystery|hidden|suspense|shadow/.test(base)) return "mysterious";
  if (/dramatic|serious/.test(base)) return "dramatic";
  if (/adventure|discovery|journey/.test(base)) return "adventure";
  return "neutral";
}

/**
 * Infer genre from filename (lowercased, extension stripped).
 * First match wins.
 * @param {string} base — lowercase filename without extension
 * @returns {string} genre token
 */
function inferGenre(base) {
  if (/disco/.test(base)) return "disco";
  if (/waltz|overture|classical|sonata/.test(base)) return "classical";
  if (/bossa|jazz|sax/.test(base)) return "jazz";
  if (/rock|metal/.test(base)) return "rock";
  if (/folk|irish|celtic|galway/.test(base)) return "folk";
  if (/march|industrial/.test(base)) return "industrial";
  return "cinematic";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const isDry = process.argv.includes("--dry");
const today = new Date().toISOString().split("T")[0];

// 1. Read manifest
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`ERROR: Manifest not found at ${MANIFEST_PATH}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
} catch (err) {
  console.error(`ERROR: Could not parse manifest — ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(manifest)) {
  console.error("ERROR: Manifest root must be a JSON array.");
  process.exit(1);
}

// 2. Read freepd dir
if (!fs.existsSync(FREEPD_DIR)) {
  console.error(
    "ERROR: No freepd dir — run on server or copy library to storage/music/stock/freepd/"
  );
  process.exit(1);
}

const allFiles = fs.readdirSync(FREEPD_DIR);
const mp3Files = allFiles
  .filter((f) => f.toLowerCase().endsWith(".mp3"))
  .sort();

if (mp3Files.length === 0) {
  console.log("No .mp3 files found in freepd/. Nothing to catalog.");
  process.exit(0);
}

// Build a Set of existing ids for fast O(1) lookup
const existingIds = new Set(manifest.map((entry) => entry.id));

// 3. Build new entries
const newEntries = [];

for (const f of mp3Files) {
  const slug = f
    .toLowerCase()
    .replace(/\.mp3$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores

  const id = `stock_freepd_${slug}`;

  if (existingIds.has(id)) {
    // Already cataloged — skip silently
    continue;
  }

  const base = f.toLowerCase().replace(/\.mp3$/, "");
  const mood = inferMood(base);
  const genre = inferGenre(base);

  newEntries.push({
    id,
    filename: `freepd/${f}`,
    mood,
    genre,
    description: `${mood} ${genre} — FreePD CC0 public domain catalog`,
    durationSec: null,
    license: "PUBLIC_DOMAIN",
    licenseType: "PD",
    source: "freepd",
    attribution: null,
    attributionRequired: false,
    commercialUseAllowed: true,
    safeForFreeUser: true,
    blocked: false,
    verificationStatus: "verified",
    verificationNote: `FreePD.com CC0 catalog entry (auto-cataloged ${today})`,
  });
}

// 4 & 5. Preview (--dry) or merge + sort + write
if (isDry) {
  console.log(`\n--- DRY RUN (no changes written) ---`);
  console.log(`FreePD mp3 files found : ${mp3Files.length}`);
  console.log(`Already in manifest    : ${mp3Files.length - newEntries.length}`);
  console.log(`Would add              : ${newEntries.length}\n`);

  if (newEntries.length > 0) {
    console.log("Entries that WOULD be added:");
    for (const e of newEntries) {
      console.log(`  ${e.id}  |  mood=${e.mood}  genre=${e.genre}  file=${e.filename}`);
    }
  } else {
    console.log("Nothing to add — manifest already up to date.");
  }
  process.exit(0);
}

// Merge
const merged = [...manifest, ...newEntries];

// Sort by id for stable diffs
merged.sort((a, b) => a.id.localeCompare(b.id));

// 6. Write back
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");

// 7. Report
console.log(
  `Cataloged ${newEntries.length} new freepd entries. Manifest now has ${merged.length} total. Sorted.`
);
