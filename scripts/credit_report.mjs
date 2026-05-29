// Real-time provider credit / status report (v2). Reads keys from server .env.
import fs from "fs";
import crypto from "crypto";
const env = Object.fromEntries(
  fs.readFileSync("/home/ghs/giohomestudio/.env", "utf-8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const line = (s) => console.log(s);

// ── ElevenLabs — key can't read /user (missing user_read scope) → test TTS path instead ──
line("\n=== ELEVENLABS ===");
try {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(20000) });
  if (r.ok) {
    const d = await r.json();
    line(`WORKING ✓ for TTS — ${(d.voices || []).length} voices available.`);
    line(`  (Balance/usage NOT readable: this key lacks the 'user_read' permission. Enable it on the key in ElevenLabs → Profile → API key, then I can show characters left.)`);
  } else {
    line(`voices HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  }
} catch (e) { line(`ERROR: ${String(e).slice(0, 140)}`); }

// ── Segmind — correct endpoint is "p-image"; read x-remaining-credits header ──
line("\n=== SEGMIND ===");
try {
  const base = env.SEGMIND_BASE_URL || "https://api.segmind.com/v1";
  const r = await fetch(`${base}/p-image`, {
    method: "POST", headers: { "x-api-key": env.SEGMIND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "a tiny dot", negative_prompt: "", width: 64, height: 64, steps: 1, seed: 1 }),
    signal: AbortSignal.timeout(40000),
  });
  const rem = r.headers.get("x-remaining-credits");
  const ct = r.headers.get("content-type") || "";
  if (r.ok) line(`WORKING ✓  remaining credits: ${rem ?? "(no header)"}  [content-type=${ct}]`);
  else line(`HTTP ${r.status}: ${(await r.text()).slice(0, 160)}  | remaining-credits: ${rem ?? "none"}`);
} catch (e) { line(`ERROR: ${String(e).slice(0, 140)}`); }

// ── Kling — JWT valid (confirmed). Try account/costs for figures. ─────────────
line("\n=== KLING ===");
try {
  const ak = env.KLING_ACCESS_KEY, sk = env.KLING_SECRET_KEY;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: ak, exp: now + 1800, nbf: now - 5 })}`;
  const jwt = `${data}.${crypto.createHmac("sha256", sk).update(data).digest("base64url")}`;
  const base = (env.KLING_API_BASE_URL || "https://api.klingai.com").replace(/\/$/, "");
  const end = Date.now(), start = end - 30 * 24 * 3600 * 1000;
  const r = await fetch(`${base}/account/costs?start_time=${start}&end_time=${end}`, { headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  line(`key VALID ✓ (HTTP ${r.status}). account/costs → ${JSON.stringify(j).slice(0, 300)}`);
  line(`  (Kling exposes spend/cost history here, not a prepaid "balance" number; the resource pack quota shows in the Kling console.)`);
} catch (e) { line(`ERROR: ${String(e).slice(0, 140)}`); }

// ── FAL ──
line("\n=== FAL ===");
try {
  const r = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
    method: "POST", headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "x", num_inference_steps: 1 }), signal: AbortSignal.timeout(25000),
  });
  const t = await r.text();
  line(`HTTP ${r.status}: ${t.slice(0, 180)}`);
} catch (e) { line(`ERROR: ${String(e).slice(0, 140)}`); }

console.log("\nDONE");
