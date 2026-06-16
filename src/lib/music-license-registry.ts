// Henry 2026-06-15: shared licence registry for music that is NOT in the static stock
// manifest — i.e. AI-generated, karaoke-produced, or user-uploaded tracks. Every such
// track must carry proof of its licence so a user can dispute a YouTube/Content-ID flag.
// The /api/music/license endpoint reads this same file (storage/music/license-registry.json).
//
// HARD RULE (Henry): only CC0 / Pixabay / Mixkit / user-owned / AI-generated licences are
// allowed. NEVER record a CC-BY (attribution-required) track — reject it instead.
//
// This file lives under storage/ (NOT git-tracked) so runtime records persist across the
// deploy's `git reset --hard` and accumulate over time.

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export interface MusicLicenseRecord {
  id: string;
  title: string;
  filename?: string;
  source: string;
  sourceUrl?: string | null;
  license: string;
  licenseType: "CC0" | "PIXABAY" | "MIXKIT" | "AI_GENERATED" | "USER_OWNED" | "PUBLIC_DOMAIN";
  licenseUrl?: string | null;
  commercialUseAllowed: boolean;
  attributionRequired: boolean;
  attribution?: string | null;
  acquiredAt?: string | null;
  provider?: string | null;
  model?: string | null;
  verificationStatus?: string;
  note?: string | null;
}

// Licence types we will store. Anything attribution-required (CC-BY family) is refused.
const ALLOWED_TYPES = new Set(["CC0", "PIXABAY", "MIXKIT", "AI_GENERATED", "USER_OWNED", "PUBLIC_DOMAIN"]);

function registryPath(): string {
  return path.resolve(env.storagePath, "music", "license-registry.json");
}

function readRegistry(): MusicLicenseRecord[] {
  try {
    return JSON.parse(fs.readFileSync(registryPath(), "utf-8")) as MusicLicenseRecord[];
  } catch {
    return [];
  }
}

/**
 * Append (or replace by id) a licence record. Returns the stored record.
 * Throws if the licence is attribution-required / CC-BY — those are banned by policy.
 */
export function appendLicenseRecord(rec: MusicLicenseRecord): MusicLicenseRecord {
  if (rec.attributionRequired || !ALLOWED_TYPES.has(rec.licenseType)) {
    throw new Error(
      `Refused: licence type "${rec.licenseType}" / attribution-required is not allowed. Only CC0, Pixabay, Mixkit, user-owned, AI-generated, or public-domain music may be stored.`,
    );
  }
  const dir = path.dirname(registryPath());
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  const list = readRegistry();
  const idx = list.findIndex(r => r.id === rec.id);
  if (idx >= 0) list[idx] = rec; else list.push(rec);
  fs.writeFileSync(registryPath(), JSON.stringify(list, null, 2));
  return rec;
}

export function getLicenseRecord(idOrFilename: string): MusicLicenseRecord | null {
  const want = idOrFilename.replace(/\.(mp3|wav|m4a|ogg)$/i, "");
  return readRegistry().find(r => r.id === idOrFilename || r.id === want || r.filename === idOrFilename) ?? null;
}
