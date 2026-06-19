// R2 round-trip diagnostic (Task #5 Stage 0) — proves creds/bucket before the pipeline cutover.
// Run on the SERVER with the R2_* env loaded:
//   set -a; . /home/ghs/giohomestudio/.env; set +a; node scripts/r2-roundtrip.mjs
// Mirrors R2Provider's client config. Writes a tiny self-deleting test object.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const need = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_S3_ENDPOINT", "R2_BUCKET"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.log(JSON.stringify({ ok: false, stage: "env", missing }));
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  forcePathStyle: false,
});
const Bucket = process.env.R2_BUCKET;
const Key = "_diag/roundtrip-test.txt";
const payload = "r2-roundtrip-ok";

const run = async () => {
  const steps = {};
  try {
    await client.send(new PutObjectCommand({ Bucket, Key, Body: Buffer.from(payload), ContentType: "text/plain" }));
    steps.put = "ok";
    const got = await client.send(new GetObjectCommand({ Bucket, Key }));
    const body = await got.Body.transformToString();
    steps.get = body === payload ? "ok" : `MISMATCH(${body})`;
    const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
    steps.head = `ok(${head.ContentLength}B)`;
    await client.send(new DeleteObjectCommand({ Bucket, Key }));
    steps.delete = "ok";
    const allOk = Object.values(steps).every((v) => v === "ok" || /^ok/.test(v));
    console.log(JSON.stringify({ ok: allOk, bucket: Bucket, steps }));
    process.exit(allOk ? 0 : 2);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, steps, error: e?.message || String(e) }));
    process.exit(3);
  }
};
run();
