#!/usr/bin/env node
// scripts/sweep_temp.mjs — daily sweeper for orphaned render temp folders (TODO #3).
//
// The video assembler writes scratch files to storage/video/temp/assembly_<ts>/ and
// cleans them on success + (now) on caught errors. But a render killed mid-flight by
// a server restart / OOM / SIGKILL can NEVER clean up after itself in-process, so the
// folder is orphaned and temp slowly bloats (storage-temp-bloat). This sweeper mops up
// every such orphan regardless of why it leaked.
//
// Safe by construction:
//   - only touches directories named `assembly_*` directly under video/temp
//   - only deletes folders whose mtime is older than the cutoff (default 3h, well past
//     the worker's 15-min render cap) — an in-flight render is never harmed
//
// Run manually:   node scripts/sweep_temp.mjs
// Run daily (server crontab, ghs user):
//   17 4 * * *  cd /home/ghs/giohomestudio && /usr/bin/node scripts/sweep_temp.mjs >> storage/logs/sweep_temp.log 2>&1
//
// Env:
//   STORAGE_PATH               override storage root (same convention as the worker)
//   TEMP_SWEEP_MAX_AGE_HOURS   cutoff in hours (default 3)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE = process.env.STORAGE_PATH || path.resolve(__dirname, "..", "storage");
// Clamp to a safe floor of 1h. A misconfigured 0/negative/NaN value must NEVER
// push the cutoff into the future (which would delete active renders) — reject
// anything below the 1h floor and fall back to the 3h default.
const parsedAge = Number(process.env.TEMP_SWEEP_MAX_AGE_HOURS);
const MAX_AGE_HOURS = Number.isFinite(parsedAge) && parsedAge >= 1 ? parsedAge : 3;
const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
const tempDir = path.join(STORAGE, "video", "temp");

function dirBytes(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else { try { total += fs.statSync(full).size; } catch { /* skip */ } }
    }
  }
  return total;
}

function main() {
  const stamp = new Date(Date.now()).toISOString();
  let entries;
  try {
    entries = fs.readdirSync(tempDir, { withFileTypes: true });
  } catch {
    console.log(`[sweep_temp ${stamp}] no temp dir at ${tempDir} — nothing to do`);
    return;
  }

  let deleted = 0, kept = 0, freed = 0;
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith("assembly_")) continue;
    const p = path.join(tempDir, e.name);
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.mtimeMs >= cutoff) { kept++; continue; } // recent/active render — leave it
    const sz = dirBytes(p);
    try { fs.rmSync(p, { recursive: true, force: true }); deleted++; freed += sz; }
    catch (err) { console.error(`[sweep_temp ${stamp}] failed to remove ${e.name}: ${err?.message || err}`); }
  }

  console.log(
    `[sweep_temp ${stamp}] removed ${deleted} orphan folder(s), freed ${Math.round(freed / 1e6)} MB, ` +
    `kept ${kept} recent (<${MAX_AGE_HOURS}h)`
  );
}

main();
