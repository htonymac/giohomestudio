// src/lib/sfx/auto-fetcher.ts
// Auto-fetch missing SFX from Freesound / FAL when the local library lacks a cue.
//
// Fetch chain:
//   1. Check sources.json — if cue already local + safeForAutoMode, return immediately.
//   2. Try Freesound via /api/sfx/freesound GET (internal). Filter safeForCommercial.
//      On match: download preview MP3 → storage/sfx/auto/, record in sources.json.
//   3. Try FAL stable audio via /api/sfx/generate (internal).
//      On success: save result, record in sources.json.
//   4. All fail → return null.
//
// License policy: CC0 and CC-BY = allowed, CC-BY-NC = blocked (enforced by the
// freesound route — we trust that filter and don't re-implement here).

import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────
export interface FetchedSfx {
  cue: string;
  localPath: string;
  sourceUrl: string;
  license: string;
  attribution?: string;
  safeForAutoMode: boolean;
}

interface SourceEntry {
  cue: string;
  path: string;
  safeForAutoMode: boolean;
  license: string;
  source: string;
  attribution?: string;
  fetchedAt?: string;
}

// ── sources.json helpers ─────────────────────────────────────
function sourcesPath(): string {
  // Resolve relative to project root (cwd at runtime is project root in Next.js)
  return path.resolve(process.cwd(), "storage", "sfx", "sources.json");
}

function loadSources(): Record<string, SourceEntry> {
  const p = sourcesPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, SourceEntry>;
  } catch {
    return {};
  }
}

function saveSources(data: Record<string, SourceEntry>): void {
  const p = sourcesPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function appendSource(entry: SourceEntry): void {
  const data = loadSources();
  data[entry.cue] = entry;
  saveSources(data);
}

// ── Freesound internal fetch ─────────────────────────────────
interface FreesoundResult {
  id: number;
  name: string;
  duration: number;
  license: string;
  licenseType: string;
  licenseUrl: string;
  safeForCommercial: boolean;
  username: string;
  description: string;
  tags: string[];
  previewUrl: string;
}

async function tryFreesound(
  cue: string,
  baseUrl: string,
): Promise<FetchedSfx | null> {
  const searchQuery = cue.replace(/_/g, " ");
  const url = `${baseUrl}/api/sfx/freesound?q=${encodeURIComponent(searchQuery)}&page=1`;

  let searchData: { ok: boolean; results?: FreesoundResult[]; noKey?: boolean };
  try {
    const res = await fetch(url, { headers: { "x-internal": "1" } });
    if (!res.ok) return null;
    searchData = await res.json();
  } catch {
    return null;
  }

  if (!searchData.ok || searchData.noKey) return null;

  const results = searchData.results ?? [];
  // Take first result that is safe for commercial use
  const match = results.find(r => r.safeForCommercial && r.previewUrl);
  if (!match) return null;

  // Download preview MP3
  let buf: Buffer;
  try {
    const dlRes = await fetch(match.previewUrl, { headers: { "User-Agent": "GioHomeStudio/1.0" } });
    if (!dlRes.ok) return null;
    buf = Buffer.from(await dlRes.arrayBuffer());
  } catch {
    return null;
  }

  // Save to storage/sfx/auto/
  const autoDir = path.resolve(process.cwd(), "storage", "sfx", "auto");
  fs.mkdirSync(autoDir, { recursive: true });
  const timestamp = Date.now();
  const filename = `${cue}_${timestamp}.mp3`;
  const localPath = path.join(autoDir, filename);
  fs.writeFileSync(localPath, buf);

  const entry: SourceEntry = {
    cue,
    path: localPath,
    safeForAutoMode: true,
    license: match.license,
    source: "freesound",
    attribution: `"${match.name}" by ${match.username} on Freesound.org`,
    fetchedAt: new Date().toISOString(),
  };
  appendSource(entry);

  return {
    cue,
    localPath,
    sourceUrl: match.previewUrl,
    license: match.license,
    attribution: entry.attribution,
    safeForAutoMode: true,
  };
}

// ── FAL generate internal fetch ──────────────────────────────
interface FalGenerateResponse {
  ok: boolean;
  provider?: string;
  url?: string;
  localPath?: string;
  filePath?: string;
}

async function tryFalGenerate(
  cue: string,
  baseUrl: string,
): Promise<FetchedSfx | null> {
  const description = cue.replace(/_/g, " ");
  const url = `${baseUrl}/api/sfx/generate`;

  let data: FalGenerateResponse;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal": "1" },
      body: JSON.stringify({ description, autoSfx: true }),
    });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }

  if (!data.ok) return null;

  const localPath = data.localPath ?? data.filePath ?? "";
  const sourceUrl = data.url ?? "";

  if (!localPath && !sourceUrl) return null;

  if (localPath) {
    const entry: SourceEntry = {
      cue,
      path: localPath,
      safeForAutoMode: true,
      license: "ai-generated",
      source: "fal",
      fetchedAt: new Date().toISOString(),
    };
    appendSource(entry);

    return {
      cue,
      localPath,
      sourceUrl,
      license: "ai-generated",
      safeForAutoMode: true,
    };
  }

  // FAL returned URL but no local path — download it
  try {
    const dlRes = await fetch(sourceUrl);
    if (!dlRes.ok) return null;
    const buf = Buffer.from(await dlRes.arrayBuffer());
    const autoDir = path.resolve(process.cwd(), "storage", "sfx", "auto");
    fs.mkdirSync(autoDir, { recursive: true });
    const filename = `${cue}_fal_${Date.now()}.mp3`;
    const downloadedPath = path.join(autoDir, filename);
    fs.writeFileSync(downloadedPath, buf);

    const entry: SourceEntry = {
      cue,
      path: downloadedPath,
      safeForAutoMode: true,
      license: "ai-generated",
      source: "fal",
      fetchedAt: new Date().toISOString(),
    };
    appendSource(entry);

    return {
      cue,
      localPath: downloadedPath,
      sourceUrl,
      license: "ai-generated",
      safeForAutoMode: true,
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────
export async function fetchMissingSfx(
  cue: string,
  baseUrl: string,
): Promise<FetchedSfx | null> {
  // 1. Check sources.json — return immediately if already cached and safe
  const sources = loadSources();
  const existing = sources[cue];
  if (existing?.safeForAutoMode && existing.path && fs.existsSync(existing.path)) {
    return {
      cue,
      localPath: existing.path,
      sourceUrl: "",
      license: existing.license,
      attribution: existing.attribution,
      safeForAutoMode: true,
    };
  }

  // 2. Try Freesound
  const freesoundResult = await tryFreesound(cue, baseUrl);
  if (freesoundResult) return freesoundResult;

  // 3. Try FAL stable audio
  const falResult = await tryFalGenerate(cue, baseUrl);
  if (falResult) return falResult;

  // 4. All failed
  return null;
}
