// Push the latest pg_dump backup to R2 for offsite safety.
// Run after pg_backup.sh writes its daily dump. Designed to be appended to
// the existing cron (or chained inside pg_backup.sh after the dump succeeds).
//
// Reads R2_* env vars from /home/ghs/giohomestudio/.env, uploads the newest
// .dump under /home/ghs/backups/ to s3://<R2_BUCKET>/db-backups/.
// Optional: keeps only the last N R2 objects per a `MAX_R2_DUMPS=14` env override.

import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const ROOT = "/home/ghs/giohomestudio";
const BACKUP_DIR = "/home/ghs/backups";

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const txt = fs.readFileSync(file, "utf-8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = readEnv(path.join(ROOT, ".env"));
const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
const missing = REQUIRED.filter(k => !env[k]);
if (missing.length > 0) {
  console.error("Missing R2 env vars:", missing.join(", "));
  process.exit(1);
}

// Find newest .dump file
const dumps = fs.readdirSync(BACKUP_DIR)
  .filter(f => /^giohomestudio_.*\.dump$/.test(f))
  .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (dumps.length === 0) { console.error("No pg_dump files found in", BACKUP_DIR); process.exit(1); }
const latest = dumps[0];
const localPath = path.join(BACKUP_DIR, latest.name);
const sizeBytes = fs.statSync(localPath).size;
console.log(`Latest dump: ${latest.name} (${(sizeBytes / 1024).toFixed(1)} KB)`);

const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_S3_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const key = `db-backups/${latest.name}`;
const body = fs.readFileSync(localPath);
const t0 = Date.now();
await s3.send(new PutObjectCommand({
  Bucket: env.R2_BUCKET,
  Key: key,
  Body: body,
  ContentType: "application/octet-stream",
}));
console.log(`Uploaded ${key} → r2://${env.R2_BUCKET} in ${Date.now() - t0} ms`);

// Optional retention: keep last MAX_R2_DUMPS objects under db-backups/
const MAX = parseInt(process.env.MAX_R2_DUMPS || env.MAX_R2_DUMPS || "14", 10);
if (Number.isFinite(MAX) && MAX > 0) {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix: "db-backups/giohomestudio_" }));
  const objs = (list.Contents || []).filter(o => o.Key && /\.dump$/.test(o.Key))
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));
  const toDelete = objs.slice(MAX).map(o => ({ Key: o.Key }));
  if (toDelete.length > 0) {
    await s3.send(new DeleteObjectsCommand({ Bucket: env.R2_BUCKET, Delete: { Objects: toDelete } }));
    console.log(`Pruned ${toDelete.length} old R2 dump(s) — keeping last ${MAX}`);
  }
}

console.log("DONE");
