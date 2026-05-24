// Storage abstraction layer — Phase 1 of `update/onboarding_ghs_linux_05232026.md`
// All writes/reads should go through this interface.
// Default impl: LocalFsProvider (current behavior preserved).
// Future impl: R2Provider (Phase 3 — wired when STORAGE_PROVIDER=r2).
//
// Design rules (Henry's spec):
// - Asset row in Postgres BEFORE file write (the route does this, not the provider)
// - Signed URLs with 5-30 min TTL for private bucket access
// - Owner check before signing
// - Never expose direct R2 credentials in browser

export interface PutOptions {
  /** MIME type (e.g. "image/png", "video/mp4") */
  contentType: string;
  /** Optional metadata (cache-control, content-disposition, etc.) */
  metadata?: Record<string, string>;
}

export interface SignOptions {
  /** Time-to-live in minutes. Default 15. Max 30 (Henry's spec). */
  ttlMinutes?: number;
  /** For signPut only: required ContentType the upload must declare */
  contentType?: string;
}

export interface StorageProvider {
  /** Name for logs/debugging. Either "local" or "r2". */
  readonly name: "local" | "r2";

  /** Upload bytes. Key is the canonical object key (e.g. "generated/video/abc.mp4"). */
  put(key: string, body: Buffer, opts: PutOptions): Promise<void>;

  /** Read bytes. Throws if not found. */
  get(key: string): Promise<Buffer>;

  /** Best-effort delete. Returns true if deleted, false if absent. */
  delete(key: string): Promise<boolean>;

  /** Object exists? Cheap HEAD. */
  exists(key: string): Promise<boolean>;

  /**
   * Issue a signed URL the browser can GET directly.
   * Local: returns `/api/media/<key>` (server-proxied — no actual signing).
   * R2: returns S3 presigned URL.
   */
  signGet(key: string, opts?: SignOptions): Promise<string>;

  /**
   * Issue a signed URL the browser can PUT to directly.
   * Local: returns `/api/media/upload/<key>` (server-proxied write).
   * R2: returns S3 presigned PUT URL.
   * Caller is expected to create the Asset row in Postgres FIRST (status=PENDING_UPLOAD).
   */
  signPut(key: string, opts: SignOptions): Promise<string>;

  /** Best-effort byte size lookup (for asset.sizeBytes population). Returns null on failure. */
  size(key: string): Promise<number | null>;
}

/**
 * Canonical key prefixes — Henry's spec §"R2 bucket prefix layout".
 * Routes building keys MUST use these prefixes for consistency between local + R2.
 */
export const STORAGE_PREFIXES = {
  uploads: "uploads",
  characters: "characters",
  stories: "stories",
  generatedImages: "generated/images",
  generatedVideo: "generated/video",
  approved: "approved",
  archive: "archive",
} as const;

export type StoragePrefix = (typeof STORAGE_PREFIXES)[keyof typeof STORAGE_PREFIXES];

/** Build a canonical key under a known prefix. Use this — don't hand-concat. */
export function buildKey(prefix: StoragePrefix, ...parts: string[]): string {
  return [prefix, ...parts.filter(Boolean).map(p => p.replace(/^\/+|\/+$/g, ""))].join("/");
}
