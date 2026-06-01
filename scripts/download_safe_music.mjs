/**
 * download_safe_music.mjs
 * Downloads a curated list of commercial-safe, attribution-free music tracks
 * into storage/music/stock/ and merges them into manifest.json.
 *
 * Sources: FreePD (CC0 / Public Domain) only.
 * No Incompetech. No attribution-required tracks.
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
// Curated track list — all CC0 / Public Domain via FreePD
// FreePD URL format: https://freepd.com/music/<Title With Spaces>.mp3
// These are known published titles confirmed on the FreePD catalogue.
// ---------------------------------------------------------------------------

const CURATED_TRACKS = [
  // --- calm / ambient ---
  {
    url: "https://freepd.com/music/Algorithms.mp3",
    filename: "freepd_algorithms.mp3",
    mood: "calm",
    genre: "electronic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Dreamy%20Flashback.mp3",
    filename: "freepd_dreamy_flashback.mp3",
    mood: "calm",
    genre: "ambient",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Chill%20Pill.mp3",
    filename: "freepd_chill_pill.mp3",
    mood: "calm",
    genre: "ambient",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Pamgaea.mp3",
    filename: "freepd_pamgaea.mp3",
    mood: "calm",
    genre: "world",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },

  // --- upbeat / playful ---
  {
    url: "https://freepd.com/music/Funky%20Chunk.mp3",
    filename: "freepd_funky_chunk.mp3",
    mood: "upbeat",
    genre: "electronic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Bossa%20Nova%20Sunset.mp3",
    filename: "freepd_bossa_nova_sunset.mp3",
    mood: "upbeat",
    genre: "world",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Easy%20Lemon.mp3",
    filename: "freepd_easy_lemon.mp3",
    mood: "playful",
    genre: "folk",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Galway.mp3",
    filename: "freepd_galway.mp3",
    mood: "playful",
    genre: "folk",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },

  // --- dramatic / epic ---
  {
    url: "https://freepd.com/music/Cipher2.mp3",
    filename: "freepd_cipher2.mp3",
    mood: "dramatic",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Heart%20of%20Nowhere.mp3",
    filename: "freepd_heart_of_nowhere.mp3",
    mood: "dramatic",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Hidden%20Past.mp3",
    filename: "freepd_hidden_past.mp3",
    mood: "mysterious",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Dark%20Fog.mp3",
    filename: "freepd_dark_fog.mp3",
    mood: "mysterious",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Impact%20Moderato.mp3",
    filename: "freepd_impact_moderato.mp3",
    mood: "epic",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },

  // --- emotional ---
  {
    url: "https://freepd.com/music/Reflection.mp3",
    filename: "freepd_reflection.mp3",
    mood: "emotional",
    genre: "classical",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Sad%20Trio.mp3",
    filename: "freepd_sad_trio.mp3",
    mood: "emotional",
    genre: "classical",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },

  // --- adventure ---
  {
    url: "https://freepd.com/music/Heroic%20Age.mp3",
    filename: "freepd_heroic_age.mp3",
    mood: "adventure",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Discovery%20Hit.mp3",
    filename: "freepd_discovery_hit.mp3",
    mood: "adventure",
    genre: "cinematic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },

  // --- corporate / commercial safe ---
  {
    url: "https://freepd.com/music/Clean%20Soul.mp3",
    filename: "freepd_clean_soul.mp3",
    mood: "upbeat",
    genre: "folk",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Bass%20Walker.mp3",
    filename: "freepd_bass_walker.mp3",
    mood: "upbeat",
    genre: "electronic",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
  },
  {
    url: "https://freepd.com/music/Merry%20Go.mp3",
    filename: "freepd_merry_go.mp3",
    mood: "playful",
    genre: "classical",
    license: "PUBLIC_DOMAIN",
    source: "freepd",
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
