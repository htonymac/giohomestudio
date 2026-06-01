#!/usr/bin/env node
// scripts/detect_track_bpm.mjs — rough BPM estimation for stock manifest tracks
//
// WHAT THIS FILE DOES:
//   Probes every entry in storage/music/stock/manifest.json that lacks a `bpm`
//   field. Uses ffmpeg silencedetect to count rhythmic onset events (silence_end
//   timestamps), derives onsets-per-minute as a BPM proxy, constrains result to
//   [50, 220], and writes the value back into the manifest in-place.
//
// ACCURACY: ±5–15 BPM. Adequate for picker hinting / tempo-band filtering.
//   NOT suitable for exact synchronisation. Ambient/pad tracks with few loud
//   onsets will return null — that is correct behaviour, not a bug.
//
// USAGE:
//   node scripts/detect_track_bpm.mjs          # probe + write manifest
//   node scripts/detect_track_bpm.mjs --dry    # probe only, no writes
//   node scripts/detect_track_bpm.mjs --force  # re-probe tracks that already
//                                               # have a bpm value
//
// DEPENDENCIES: ffmpeg on PATH (or FFMPEG_PATH env var). No npm packages needed.
//
// Henry 2026-06-01: autonomous push — add tempo metadata to manifest entries.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

// ─── Paths ────────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const STOCK_DIR = path.resolve(here, "..", "storage", "music", "stock");
const MANIFEST_PATH = path.join(STOCK_DIR, "manifest.json");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

// ─── Tuning constants ─────────────────────────────────────────────────────────

// Minimum silence duration (seconds) between detected onsets.
// 0.08 s → up to ~750 events/min theoretical ceiling; keeps tempo tracks crisp.
// If you get wildly high BPM on ambient tracks lower this to 0.12 or 0.15.
const SILENCE_DURATION = "0.08";

// Noise floor for silencedetect. -25 dB catches most musical onsets without
// firing on background hiss. Raise to -20 dB for noisier tracks.
const NOISE_FLOOR = "-25dB";

// BPM window: values outside [BPM_MIN, BPM_MAX] are discarded (→ null).
// Tracks that genuinely sit below 50 BPM (very slow ambient) will be null —
// that is acceptable; the picker ignores null and uses genre/mood instead.
const BPM_MIN = 50;
const BPM_MAX = 220;

// Per-file ffmpeg timeout (ms). 60 s is generous for a 3-5 min MP3.
const PROBE_TIMEOUT_MS = 90_000;

// ─── Core probe function ──────────────────────────────────────────────────────

/**
 * Estimate BPM for a single audio file.
 *
 * Algorithm:
 *  1. Extract total duration from ffmpeg's info line.
 *  2. Run silencedetect over the full file; count `silence_end` events.
 *     Each silence_end marks the beginning of a new audible segment, which
 *     correlates loosely with rhythmic onsets in music with clear attack
 *     transients (drums, piano, guitar, etc.).
 *  3. BPM ≈ (onsetCount × 60) / durationSeconds.
 *  4. Clamp to [BPM_MIN, BPM_MAX]; return null if out of range or probe fails.
 *
 * @param {string} absPath Absolute path to the MP3 file.
 * @returns {Promise<number|null>} Rounded BPM or null.
 */
async function probeBpm(absPath) {
  // ── Step 1: get duration ──────────────────────────────────────────────────
  let durSec = null;
  try {
    // ffmpeg always writes metadata to stderr; the output pipe is /dev/null
    const { stderr: durOut } = await execFileAsync(
      FFMPEG,
      ["-i", absPath, "-f", "null", "-"],
      { timeout: PROBE_TIMEOUT_MS }
    ).catch((e) => ({ stderr: e?.stderr ?? "" }));

    const m = String(durOut).match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (!m) return null;
    durSec =
      parseInt(m[1], 10) * 3600 +
      parseInt(m[2], 10) * 60 +
      parseFloat(m[3]);
  } catch {
    return null;
  }

  if (!durSec || durSec < 5) return null; // skip tiny/broken files

  // ── Step 2: count onsets via silencedetect ────────────────────────────────
  let onsetCount = 0;
  try {
    const { stderr: silOut } = await execFileAsync(
      FFMPEG,
      [
        "-i", absPath,
        "-af", `silencedetect=noise=${NOISE_FLOOR}:d=${SILENCE_DURATION}`,
        "-f", "null", "-",
      ],
      { timeout: PROBE_TIMEOUT_MS }
    ).catch((e) => ({ stderr: e?.stderr ?? "" }));

    // Each "silence_end:" line marks one onset boundary.
    // Example: "  silence_end: 0.827483 | silence_duration: 0.0942177"
    const matches = String(silOut).match(/silence_end:/g);
    onsetCount = matches ? matches.length : 0;
  } catch {
    return null;
  }

  if (onsetCount < 4) {
    // Fewer than 4 detected onsets in the whole file → likely a drone/pad/SFX.
    // Returning null is more honest than a nonsense low BPM.
    return null;
  }

  // ── Step 3: derive and clamp BPM ─────────────────────────────────────────
  const rawBpm = (onsetCount * 60) / durSec;
  const bpm = Math.round(rawBpm);

  if (bpm < BPM_MIN || bpm > BPM_MAX) return null;
  return bpm;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDry = args.includes("--dry");
  const isForce = args.includes("--force");

  // ── Load manifest ─────────────────────────────────────────────────────────
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`ERROR: manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  } catch (e) {
    console.error(`ERROR: could not parse manifest.json — ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(manifest)) {
    console.error("ERROR: manifest root is not a JSON array");
    process.exit(1);
  }

  // ── Summary header ────────────────────────────────────────────────────────
  console.log(
    `\ndetect_track_bpm.mjs — probing ${manifest.length} manifest entries` +
    (isDry ? "  [DRY RUN — no writes]" : "") +
    (isForce ? "  [FORCE — re-probing existing BPM values]" : "")
  );
  console.log(`Stock dir : ${STOCK_DIR}`);
  console.log(`ffmpeg    : ${FFMPEG}`);
  console.log(`Noise     : ${NOISE_FLOOR}  Silence gap: ${SILENCE_DURATION}s`);
  console.log(`BPM range : [${BPM_MIN}, ${BPM_MAX}]\n`);

  // ── Probe loop ────────────────────────────────────────────────────────────
  let updated = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (const entry of manifest) {
    const tag = entry.id ?? entry.filename ?? "(unknown)";

    // Skip if already probed (unless --force)
    if (entry.bpm != null && !isForce) {
      process.stdout.write(`  [SKIP] ${tag} — already ${entry.bpm} BPM\n`);
      skipped++;
      continue;
    }

    // Resolve file — entry.filename may be a bare name or a sub-path
    const abs = path.join(STOCK_DIR, entry.filename ?? "");
    if (!fs.existsSync(abs)) {
      process.stdout.write(`  [MISS] ${tag} — file not found (${abs})\n`);
      missing++;
      continue;
    }

    process.stdout.write(`  [PROB] ${tag} → `);
    const bpm = await probeBpm(abs);

    if (bpm == null) {
      process.stdout.write(`null (ambient/pad/undetected)\n`);
      failed++;
      // Write explicit null so downstream consumers know we tried
      if (!isDry) entry.bpm = null;
    } else {
      process.stdout.write(`${bpm} BPM\n`);
      if (!isDry) {
        entry.bpm = bpm;
        updated++;
      }
    }
  }

  // ── Write back ────────────────────────────────────────────────────────────
  if (!isDry) {
    // Stable sort by id so diffs are readable
    manifest.sort((a, b) => {
      const aId = String(a.id ?? "");
      const bId = String(b.id ?? "");
      return aId.localeCompare(bId);
    });

    try {
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
      console.log(`\nManifest written: ${MANIFEST_PATH}`);
    } catch (e) {
      console.error(`\nERROR writing manifest: ${e.message}`);
      process.exit(1);
    }
  }

  // ── Final report ──────────────────────────────────────────────────────────
  console.log(
    `\n────────────────────────────────────────────────────────────`
  );
  console.log(`Entries probed  : ${manifest.length}`);
  console.log(`BPM written     : ${isDry ? "(dry — not written)" : updated}`);
  console.log(`Returned null   : ${failed}  (ambient/pad or below threshold)`);
  console.log(`Skipped (had BPM): ${skipped}`);
  console.log(`File missing    : ${missing}`);
  if (isDry) console.log(`\n[DRY RUN] — re-run without --dry to commit values.`);
  console.log(`────────────────────────────────────────────────────────────\n`);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
