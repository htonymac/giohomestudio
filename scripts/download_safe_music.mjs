/**
 * download_safe_music.mjs
 * Downloads a curated list of commercial-safe, attribution-free music tracks
 * into storage/music/stock/ and merges them into manifest.json.
 *
 * Sources: Internet Archive "cloud-music-4" (CC0 1.0 Universal / Public Domain).
 * No Incompetech. No attribution-required tracks.
 * FreePD.com was the original source but permanently shut down in 2025.
 *
 * Usage: node scripts/download_safe_music.mjs
 * Idempotent: skips files that already exist on disk.
 */

import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STOCK_DIR = path.join(__dirname, "..", "storage", "music", "stock");
const MANIFEST_PATH = path.join(STOCK_DIR, "manifest.json");

// ---------------------------------------------------------------------------
// Curated track list — all CC0 1.0 Universal / Public Domain
//
// SOURCE CHANGE 2026-05-31: FreePD.com permanently shut down (2008–2025).
// All 20 original FreePD URLs returned HTTP 404 — site closure confirmed
// via WebFetch (page reads "The hosting and maintenance of the site have
// ceased").
//
// New source: Internet Archive item "cloud-music-4"
// https://archive.org/details/cloud-music-4
// License: CC0 1.0 Universal — "all public domain - no attribution -
// royalty free music" sourced from Pixabay.com and mixkit.co.
// No attribution required. Commercial use allowed.
//
// URL pattern: https://archive.org/download/cloud-music-4/<filename>
// ---------------------------------------------------------------------------

const CURATED_TRACKS = [
  // --- calm / ambient ---
  {
    url: "https://archive.org/download/cloud-music-4/ambient-light-main-7229.mp3",
    filename: "ia_ambient_light.mp3",
    mood: "calm",
    genre: "ambient",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/ambient-piano-amp-strings-10711.mp3",
    filename: "ia_ambient_piano_strings.mp3",
    mood: "calm",
    genre: "ambient",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/dreamy-piano-soft-sound-ambient-background-4049.mp3",
    filename: "ia_dreamy_piano_ambient.mp3",
    mood: "calm",
    genre: "ambient",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/soft-ambient-10782.mp3",
    filename: "ia_soft_ambient.mp3",
    mood: "calm",
    genre: "ambient",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },

  // --- calm / electronic ---
  {
    url: "https://archive.org/download/cloud-music-4/modular-ambient-01-789.mp3",
    filename: "ia_modular_ambient_01.mp3",
    mood: "calm",
    genre: "electronic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },

  // --- calm / world ---
  {
    url: "https://archive.org/download/cloud-music-4/cinematic-inspiring-irish-pipe-main-9668.mp3",
    filename: "ia_irish_pipe_cinematic.mp3",
    mood: "calm",
    genre: "world",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },

  // --- upbeat / playful ---
  {
    url: "https://archive.org/download/cloud-music-4/cinematic-chillhop-main-6676.mp3",
    filename: "ia_chillhop.mp3",
    mood: "upbeat",
    genre: "electronic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/funky-trap-sax-4864.mp3",
    filename: "ia_funky_trap_sax.mp3",
    mood: "upbeat",
    genre: "electronic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/joy-of-travel-6671.mp3",
    filename: "ia_joy_of_travel.mp3",
    mood: "upbeat",
    genre: "world",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/mixkit-playground-fun-12.mp3",
    filename: "ia_playground_fun.mp3",
    mood: "playful",
    genre: "folk",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/mixkit-just-kidding-11.mp3",
    filename: "ia_just_kidding.mp3",
    mood: "playful",
    genre: "folk",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/mixkit-comical-2.mp3",
    filename: "ia_comical.mp3",
    mood: "playful",
    genre: "classical",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },

  // --- dramatic / epic ---
  {
    url: "https://archive.org/download/cloud-music-4/cinematic-dramatic-11120.mp3",
    filename: "ia_cinematic_dramatic.mp3",
    mood: "dramatic",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/honor-and-sword-main-11222.mp3",
    filename: "ia_honor_and_sword.mp3",
    mood: "dramatic",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/mixkit-silent-descent-614.mp3",
    filename: "ia_silent_descent.mp3",
    mood: "mysterious",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/mixkit-deep-urban-623.mp3",
    filename: "ia_deep_urban.mp3",
    mood: "mysterious",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/epic-heart-main-6677.mp3",
    filename: "ia_epic_heart.mp3",
    mood: "epic",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },

  // --- emotional ---
  {
    url: "https://archive.org/download/cloud-music-4/emotional-inspiring-epic-trailer-11258.mp3",
    filename: "ia_emotional_epic_trailer.mp3",
    mood: "emotional",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
  {
    url: "https://archive.org/download/cloud-music-4/cancion-triste-1502.mp3",
    filename: "ia_cancion_triste.mp3",
    mood: "emotional",
    genre: "classical",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },

  // --- adventure / corporate ---
  {
    url: "https://archive.org/download/cloud-music-4/desert-raid-5760.mp3",
    filename: "ia_desert_raid.mp3",
    mood: "adventure",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "internet-archive",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Download a URL to a local file path following up to maxRedirects redirects.
 * Returns a promise that resolves to { bytes } on success or rejects with an error.
 */
function download(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    function get(currentUrl, redirectsLeft) {
      const parsedUrl = new URL(currentUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          "User-Agent":
            "GioHomeStudio-MusicDownloader/1.0 (node.js built-in https)",
          Accept: "audio/mpeg, audio/*, */*",
        },
      };

      https
        .get(options, (res) => {
          // Follow redirects (301, 302, 303, 307, 308)
          if (
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            res.resume(); // drain
            return get(res.headers.location, redirectsLeft - 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode}`));
          }

          const file = fs.createWriteStream(destPath);
          let bytes = 0;

          res.on("data", (chunk) => {
            bytes += chunk.length;
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close(() => resolve({ bytes }));
          });

          file.on("error", (err) => {
            fs.unlink(destPath, () => {}); // clean up partial file
            reject(err);
          });

          res.on("error", (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        })
        .on("error", (err) => {
          reject(err);
        });
    }

    get(url, maxRedirects);
  });
}

/** Convert a filename (no ext) to a manifest id slug */
function toSlug(filename) {
  return filename
    .replace(/\.mp3$/i, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
}

/** Build a manifest entry from a track descriptor */
function buildManifestEntry(tr) {
  const slug = toSlug(tr.filename);
  const today = new Date().toISOString().split("T")[0];
  const licenseType =
    tr.license === "PUBLIC_DOMAIN"
      ? "PD"
      : tr.license === "PIXABAY"
      ? "PIXABAY"
      : "MIXKIT";

  return {
    id: `stock_${slug}`,
    filename: tr.filename,
    mood: tr.mood,
    genre: tr.genre,
    description: `${tr.mood} ${tr.genre} — auto-imported from ${tr.source}`,
    durationSec: null,
    license: tr.license,
    licenseType,
    source: tr.source,
    attribution: null,
    attributionRequired: false,
    commercialUseAllowed: true,
    safeForFreeUser: true,
    blocked: false,
    verificationStatus: "verified",
    verificationNote: `Auto-imported from ${tr.url} on ${today}.`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure stock directory exists
  if (!fs.existsSync(STOCK_DIR)) {
    fs.mkdirSync(STOCK_DIR, { recursive: true });
  }

  let downloaded = 0;
  let skipped = 0;
  const manifestAdditions = [];

  for (const tr of CURATED_TRACKS) {
    const destPath = path.join(STOCK_DIR, tr.filename);
    const entry = buildManifestEntry(tr);

    if (fs.existsSync(destPath)) {
      console.log(`  skip  ${tr.filename} (already exists)`);
      skipped++;
      // Still queue for manifest merge in case it's missing from manifest
      manifestAdditions.push(entry);
      continue;
    }

    try {
      const { bytes } = await download(tr.url, destPath);
      const kb = (bytes / 1024).toFixed(1);
      console.log(`  ✓  ${tr.filename} (${kb} KB)`);
      downloaded++;
      manifestAdditions.push(entry);
    } catch (err) {
      // Clean up any partial file
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      const msg = err.message || String(err);
      console.log(`  ✗  ${tr.filename}  ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // Merge into manifest.json
  // -------------------------------------------------------------------------

  let manifest = [];

  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
      manifest = JSON.parse(raw);
      if (!Array.isArray(manifest)) {
        console.warn(
          "  warn  manifest.json is not an array — starting fresh array"
        );
        manifest = [];
      }
    } catch (e) {
      console.warn(`  warn  Could not parse manifest.json: ${e.message}`);
      manifest = [];
    }
  }

  // Build set of existing IDs for deduplication
  const existingIds = new Set(manifest.map((e) => e.id));

  let added = 0;
  for (const entry of manifestAdditions) {
    if (!existingIds.has(entry.id)) {
      manifest.push(entry);
      existingIds.add(entry.id);
      added++;
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  console.log(
    `\nDownloaded ${downloaded}, skipped ${skipped}, manifest now has ${manifest.length} entries (+${added} new).`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
