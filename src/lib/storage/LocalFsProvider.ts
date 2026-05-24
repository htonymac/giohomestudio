// Local filesystem implementation of StorageProvider.
// Default — preserves existing behavior (writes under env.storagePath).
// signGet/signPut return /api/media/ URLs (handled by app/api/media route).

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import type { StorageProvider, PutOptions, SignOptions } from "./StorageProvider";

export class LocalFsProvider implements StorageProvider {
  readonly name = "local" as const;

  private resolve(key: string): string {
    // Block path traversal at the boundary
    const normalized = path.normalize(key).replace(/^[\\/]+/, "");
    if (normalized.startsWith("..") || normalized.includes("/../")) {
      throw new Error(`Invalid storage key (path traversal): ${key}`);
    }
    return path.join(env.storagePath, normalized);
  }

  async put(key: string, body: Buffer, _opts: PutOptions): Promise<void> {
    const abs = this.resolve(key);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFileSync(this.resolve(key));
  }

  async delete(key: string): Promise<boolean> {
    const abs = this.resolve(key);
    if (!fs.existsSync(abs)) return false;
    fs.unlinkSync(abs);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolve(key));
  }

  async signGet(key: string, _opts?: SignOptions): Promise<string> {
    // Browser fetches via app/api/media/<key>. The media route enforces owner check
    // when an Asset row exists for this key (see asset-permission.ts in Phase 4).
    return `/api/media/${key}`;
  }

  async signPut(key: string, _opts: SignOptions): Promise<string> {
    // Browser PUTs via app/api/media/upload/<key>. Phase 4 adds rate-limit + owner check.
    return `/api/media/upload/${key}`;
  }

  async size(key: string): Promise<number | null> {
    try {
      const stat = fs.statSync(this.resolve(key));
      return stat.size;
    } catch {
      return null;
    }
  }
}
