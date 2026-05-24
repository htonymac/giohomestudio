// Storage factory — single entry point for the rest of the app.
// Default = local (preserves existing fs.writeFileSync behavior).
// Flip via STORAGE_PROVIDER=r2 in .env (Phase 10 cutover).
//
// Usage:
//   import { getStorage } from "@/lib/storage";
//   const storage = getStorage();
//   await storage.put("generated/images/abc.png", buffer, { contentType: "image/png" });

import type { StorageProvider } from "./StorageProvider";
import { LocalFsProvider } from "./LocalFsProvider";

let _instance: StorageProvider | null = null;
let _instanceKind: "local" | "r2" | null = null;

export function getStorage(): StorageProvider {
  const desired = (process.env.STORAGE_PROVIDER === "r2" ? "r2" : "local") as "local" | "r2";
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
}

export { STORAGE_PREFIXES, buildKey } from "./StorageProvider";
export type { StorageProvider, PutOptions, SignOptions } from "./StorageProvider";
