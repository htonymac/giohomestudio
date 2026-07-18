// Storage factory — single entry point for the rest of the app.
// Default = local (preserves existing fs.writeFileSync behavior).
// Provider is runtime-controllable two ways (checked in this priority order):
//   1. <storagePath>/config/storage-settings.json  {"provider":"local"|"r2"} — set live from the
//      Settings UI (app/dashboard/settings/storage) via PUT /api/settings/storage. No redeploy,
//      no restart — see getStorageProviderSetting()/setStorageProviderSetting() below.
//   2. STORAGE_PROVIDER=r2 in .env — fallback when no settings file exists yet.
//
// Usage:
//   import { getStorage } from "@/lib/storage";
//   const storage = getStorage();
//   await storage.put("generated/images/abc.png", buffer, { contentType: "image/png" });

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import type { StorageProvider } from "./StorageProvider";
import { LocalFsProvider } from "./LocalFsProvider";

let _instance: StorageProvider | null = null;
let _instanceKind: "local" | "r2" | null = null;

const SETTINGS_PATH = path.join(env.storagePath, "config", "storage-settings.json");
// Re-check the settings file at most this often — keeps getStorage() cheap on hot paths
// while still making a toggle flip take effect within a few seconds, no restart needed.
const SETTINGS_CACHE_TTL_MS = 3000;

let _cachedOverride: "local" | "r2" | null = null; // null = no file override on disk
let _cacheLoadedAt = -Infinity; // force a read on first call

function readProviderFromDisk(): "local" | "r2" | null {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as { provider?: unknown };
    return raw.provider === "r2" || raw.provider === "local" ? raw.provider : null;
  } catch {
    return null; // corrupt/unreadable file — fall back to env var, never throw from a getter
  }
}

/**
 * Effective provider setting, resolved as:
 *   file override (TTL-cached, <= SETTINGS_CACHE_TTL_MS stale) -> STORAGE_PROVIDER env -> "local"
 */
export function getStorageProviderSetting(): "local" | "r2" {
  if (Date.now() - _cacheLoadedAt >= SETTINGS_CACHE_TTL_MS) {
    _cachedOverride = readProviderFromDisk();
    _cacheLoadedAt = Date.now();
  }
  return _cachedOverride ?? (process.env.STORAGE_PROVIDER === "r2" ? "r2" : "local");
}

/**
 * Writes the runtime override to disk and refreshes the in-memory cache immediately, so the very
 * next getStorage() call (this request or the next) picks up the new provider — no restart.
 */
export function setStorageProviderSetting(provider: "local" | "r2"): void {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ provider }, null, 2), "utf8");
  _cachedOverride = provider;
  _cacheLoadedAt = Date.now();
}

export function getStorage(): StorageProvider {
  const desired = getStorageProviderSetting();
  if (_instance && _instanceKind === desired) return _instance;

  if (desired === "r2") {
    // Lazy import so LocalFsProvider users never pay the cost of loading AWS SDK
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { R2Provider } = require("./R2Provider") as typeof import("./R2Provider");
    _instance = new R2Provider();
  } else {
    _instance = new LocalFsProvider();
  }
  _instanceKind = desired;
  return _instance;
}

/** For tests + diagnostic routes — never use in production code paths. */
export function _resetStorageForTest(): void {
  _instance = null;
  _instanceKind = null;
  _cachedOverride = null;
  _cacheLoadedAt = -Infinity;
}

export { STORAGE_PREFIXES, buildKey } from "./StorageProvider";
export type { StorageProvider, PutOptions, SignOptions, StoragePrefix } from "./StorageProvider";
