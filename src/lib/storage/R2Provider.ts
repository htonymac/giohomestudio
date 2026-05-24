// Cloudflare R2 implementation of StorageProvider.
// Uses @aws-sdk/client-s3 (R2 is S3-compatible).
//
// Env vars required (set in /home/ghs/giohomestudio/.env on Linux server):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_S3_ENDPOINT
//
// Activation: set STORAGE_PROVIDER=r2 in .env (Phase 10 cutover).
// Until then, getStorage() returns LocalFsProvider — this class is unused.
//
// SDK install required before this file can compile in production:
//   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
// To keep TSC clean until install, the imports are deferred via require() and
// the class methods throw if creds are missing.

import type { StorageProvider, PutOptions, SignOptions } from "./StorageProvider";

interface S3ClientLike {
  send(cmd: unknown): Promise<unknown>;
}

let _client: S3ClientLike | null = null;
let _GetObjectCommand: new (input: unknown) => unknown;
let _PutObjectCommand: new (input: unknown) => unknown;
let _DeleteObjectCommand: new (input: unknown) => unknown;
let _HeadObjectCommand: new (input: unknown) => unknown;
let _getSignedUrl: (client: unknown, cmd: unknown, opts?: unknown) => Promise<string>;

function ensureClient(): S3ClientLike {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_S3_ENDPOINT;

  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "R2Provider: missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_S3_ENDPOINT in env"
    );
  }

  // Lazy-load AWS SDK (Phase 3 will `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const s3mod = require("@aws-sdk/client-s3") as {
    S3Client: new (cfg: unknown) => S3ClientLike;
    GetObjectCommand: new (i: unknown) => unknown;
    PutObjectCommand: new (i: unknown) => unknown;
    DeleteObjectCommand: new (i: unknown) => unknown;
    HeadObjectCommand: new (i: unknown) => unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const presigner = require("@aws-sdk/s3-request-presigner") as {
    getSignedUrl: (c: unknown, cmd: unknown, o?: unknown) => Promise<string>;
  };

  _client = new s3mod.S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
  _GetObjectCommand = s3mod.GetObjectCommand;
  _PutObjectCommand = s3mod.PutObjectCommand;
  _DeleteObjectCommand = s3mod.DeleteObjectCommand;
  _HeadObjectCommand = s3mod.HeadObjectCommand;
  _getSignedUrl = presigner.getSignedUrl;
  return _client;
}

function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2Provider: R2_BUCKET not set");
  return b;
}

function clampTtl(min?: number): number {
  // Henry's spec §"Signed URLs, 5–30 min expiry"
  const m = min ?? 15;
  return Math.max(5, Math.min(30, m));
}

export class R2Provider implements StorageProvider {
  readonly name = "r2" as const;

  async put(key: string, body: Buffer, opts: PutOptions): Promise<void> {
    const c = ensureClient();
    await c.send(new _PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      Metadata: opts.metadata,
    }));
  }

  async get(key: string): Promise<Buffer> {
    const c = ensureClient();
    const resp = await c.send(new _GetObjectCommand({ Bucket: bucket(), Key: key })) as {
      Body?: { transformToByteArray(): Promise<Uint8Array> };
    };
    if (!resp.Body) throw new Error(`R2 get: empty body for ${key}`);
    const bytes = await resp.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<boolean> {
    const c = ensureClient();
    try {
      await c.send(new _DeleteObjectCommand({ Bucket: bucket(), Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const c = ensureClient();
    try {
      await c.send(new _HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async signGet(key: string, opts?: SignOptions): Promise<string> {
    const c = ensureClient();
    const cmd = new _GetObjectCommand({ Bucket: bucket(), Key: key });
    return _getSignedUrl(c, cmd, { expiresIn: clampTtl(opts?.ttlMinutes) * 60 });
  }

  async signPut(key: string, opts: SignOptions): Promise<string> {
    const c = ensureClient();
    const cmd = new _PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: opts.contentType,
    });
    return _getSignedUrl(c, cmd, { expiresIn: clampTtl(opts.ttlMinutes) * 60 });
  }

  async size(key: string): Promise<number | null> {
    const c = ensureClient();
    try {
      const resp = await c.send(new _HeadObjectCommand({ Bucket: bucket(), Key: key })) as {
        ContentLength?: number;
      };
      return typeof resp.ContentLength === "number" ? resp.ContentLength : null;
    } catch {
      return null;
    }
  }
}
