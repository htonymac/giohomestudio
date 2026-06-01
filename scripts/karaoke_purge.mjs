/**
 * karaoke_purge.mjs
 *
 * Daily 30-day retention enforcer for karaoke_recordings rows.
 * Deletes rows whose purgeAt < now(), and legacy rows older than 31 days
 * with no purgeAt set. Removes all on-disk files for each deleted row.
 *
 * Henry 2026-05-31: karaoke spec §19 "Maximum 30 days, auto purge after completion"
 *
 * Usage:
 *   node scripts/karaoke_purge.mjs            # live run
 *   node scripts/karaoke_purge.mjs --dry      # dry-run: prints candidates, no deletes
 *
 * Installed as a daily systemd timer via scripts/install_karaoke_purge_timer.sh
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Minimal .env loader (no external dep required)
// Reads <project-root>/.env and populates process.env for vars not already set.
// ---------------------------------------------------------------------------
function loadDotEnv() {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const DRY = process.argv.includes("--dry");

// ---------------------------------------------------------------------------
// Storage root resolution
// ---------------------------------------------------------------------------
function resolveStorageRoot() {
  const fromEnv = process.env.STORAGE_BASE_PATH;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(ROOT, fromEnv);
  }
  return path.join(ROOT, "storage");
}

// ---------------------------------------------------------------------------
// URL → disk path (mirrors /api/karaoke/delete route logic exactly)
// URL shape served by Next.js: /api/media/<sub-path>
// On disk that lives at: <storageRoot>/<sub-path>
// ---------------------------------------------------------------------------
function urlToDiskPath(url, storageRoot) {
  if (!url) return null;
  const m = url.match(/^\/api\/media\/(.+)$/);
  if (!m) return null;
  return path.join(storageRoot, m[1]);
}

// ---------------------------------------------------------------------------
// Collect every on-disk path belonging to a recording row
// Returns an array of entries: string (file path) | { dir: string } (empty dir)
// ---------------------------------------------------------------------------
function collectPaths(row, storageRoot) {
  const entries = [];

  // 1. Direct URL fields on the row
  for (const field of ["fileUrl", "generatedMusicUrl", "mixedOutputUrl"]) {
    const p = urlToDiskPath(row[field], storageRoot);
    if (p) entries.push(p);
  }

  // 2. Exports dir — any file whose name starts with the row id
  const exportsDir = path.join(storageRoot, "karaoke", "exports");
  if (fs.existsSync(exportsDir)) {
    try {
      for (const f of fs.readdirSync(exportsDir)) {
        if (f.startsWith(row.id)) entries.push(path.join(exportsDir, f));
      }
    } catch { /* dir unreadable — skip */ }
  }

  // 3. Assembled dir — same filename prefix pattern
  const assembledDir = path.join(storageRoot, "karaoke", "assembled");
  if (fs.existsSync(assembledDir)) {
    try {
      for (const f of fs.readdirSync(assembledDir)) {
        if (f.startsWith(row.id)) entries.push(path.join(assembledDir, f));
      }
    } catch { /* skip */ }
  }

  // 4. Demucs working dir: storage/karaoke/demucs/<id>/
  const demucsDir = path.join(storageRoot, "karaoke", "demucs", row.id);
  if (fs.existsSync(demucsDir)) {
    try {
      for (const f of fs.readdirSync(demucsDir)) {
        entries.push(path.join(demucsDir, f));
      }
      entries.push({ dir: demucsDir }); // rmdir after files removed
    } catch { /* skip */ }
  }

  // 5. MIDI dir: storage/karaoke/midi/<id>/
  const midiDir = path.join(storageRoot, "karaoke", "midi", row.id);
  if (fs.existsSync(midiDir)) {
    try {
      for (const f of fs.readdirSync(midiDir)) {
        entries.push(path.join(midiDir, f));
      }
      entries.push({ dir: midiDir });
    } catch { /* skip */ }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Safe file unlink — returns { deleted: boolean, bytes: number }
// ---------------------------------------------------------------------------
function safeUnlink(p) {
  try {
    if (fs.existsSync(p)) {
      let bytes = 0;
      try { bytes = fs.statSync(p).size; } catch { /* ignore */ }
      fs.unlinkSync(p);
      return { deleted: true, bytes };
    }
  } catch (e) {
    console.warn(`[karaoke-purge] WARN unlink failed: ${p} — ${e.message}`);
  }
  return { deleted: false, bytes: 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadDotEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[karaoke-purge] FATAL: DATABASE_URL not set in env or .env file. Aborting.");
    process.exit(1);
  }

  const storageRoot = resolveStorageRoot();
  const now         = new Date();
  const legacy31d   = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

  if (DRY) {
    console.log(`[karaoke-purge] DRY RUN — nothing will be deleted.`);
    console.log(`[karaoke-purge] storage root: ${storageRoot}`);
    console.log(`[karaoke-purge] threshold for legacy rows: ${legacy31d.toISOString()}`);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  let deletedRows  = 0;
  let deletedFiles = 0;
  let freedBytes   = 0;
  const start      = Date.now();

  try {
    // Query 1: rows with purgeAt explicitly set and now past
    const expired = await prisma.karaokeRecording.findMany({
      where: { purgeAt: { not: null, lt: now } },
    });

    // Query 2: legacy rows (no purgeAt) older than 31 days
    const legacy = await prisma.karaokeRecording.findMany({
      where: { purgeAt: null, createdAt: { lt: legacy31d } },
    });

    // Deduplicate by id (defensive — a row won't appear in both sets in practice)
    const seen     = new Set();
    const toDelete = [];
    for (const row of [...expired, ...legacy]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        toDelete.push(row);
      }
    }

    if (toDelete.length === 0) {
      const elapsed = Date.now() - start;
      console.log(
        `[karaoke-purge] ${now.toISOString()}  rows=0  files=0  freed=0.0 MB  duration=${elapsed}ms`
      );
      return;
    }

    // Process each row with per-row isolation
    for (const row of toDelete) {
      try {
        const entries = collectPaths(row, storageRoot);

        for (const entry of entries) {
          if (typeof entry === "object" && "dir" in entry) {
            // Empty directory left after files removed
            if (DRY) {
              console.log(`WOULD RMDIR:  ${entry.dir}`);
            } else {
              try { fs.rmdirSync(entry.dir); } catch { /* non-empty or already gone — skip */ }
            }
          } else {
            const filePath = /** @type {string} */ (entry);
            if (DRY) {
              console.log(`WOULD DELETE: ${filePath}`);
            } else {
              const { deleted, bytes } = safeUnlink(filePath);
              if (deleted) {
                deletedFiles++;
                freedBytes += bytes;
              }
            }
          }
        }

        // Delete DB row AFTER files — if a file unlink fails the row stays
        // and the next daily run will retry.
        if (DRY) {
          console.log(
            `WOULD DELETE ROW: id=${row.id}  createdAt=${row.createdAt.toISOString()}  purgeAt=${row.purgeAt?.toISOString() ?? "null"}`
          );
        } else {
          await prisma.karaokeRecording.delete({ where: { id: row.id } });
          deletedRows++;
        }
      } catch (rowErr) {
        // One bad row must not abort the whole run
        console.error(
          `[karaoke-purge] ERROR row ${row.id}: ${rowErr instanceof Error ? rowErr.message : rowErr}`
        );
      }
    }

    // Dry-run summary
    if (DRY) {
      const elapsed = Date.now() - start;
      console.log(
        `[karaoke-purge] DRY RUN complete ${now.toISOString()}  candidates=${toDelete.length}  duration=${elapsed}ms`
      );
      return;
    }
  } finally {
    await prisma.$disconnect();
  }

  const elapsed = Date.now() - start;
  const freedMB = (freedBytes / (1024 * 1024)).toFixed(1);

  // Canonical output line — searchable in journalctl
  console.log(
    `[karaoke-purge] ${now.toISOString()}  rows=${deletedRows}  files=${deletedFiles}  freed=${freedMB} MB  duration=${elapsed}ms`
  );
}

main().catch((err) => {
  console.error("[karaoke-purge] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
