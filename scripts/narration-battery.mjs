// Phase 6 of voice unification — verifies the /api/tts route returns valid
// audio for EVERY voice tier across the 9 providers. Run against live prod
// or staging. Catches per-provider regressions in one shot.
//
// Run: node scripts/narration-battery.mjs
// Env: URL_BASE (default https://andiostudio.com)

import { chromium } from "playwright";

const URL_BASE = process.env.URL_BASE || "https://andiostudio.com";
const log = (s) => console.log(`[narration] ${s}`);

// Tests one provider+voice combo per row.
// We DON'T test paid providers (FAL F5/XTTS/Bark/Gemini, ElevenLabs) by default
// because every call burns credits. Set INCLUDE_PAID=1 to run them.
const FREE_TIER_TESTS = [
  // GHS Standard (Piper local)
  { provider: "piper",    voiceId: undefined,                  label: "Piper Lessac (free local)" },
  // GHS Standard+ (Edge-TTS) — sample 4 of the 18 voices to keep run time short
  { provider: "edge-tts", voiceId: "en-NG-EzinneNeural",       label: "Edge Ezinne (NG female)" },
  { provider: "edge-tts", voiceId: "en-US-ChristopherNeural",  label: "Edge Christopher (US bass)" },
  { provider: "edge-tts", voiceId: "en-US-AnaNeural",          label: "Edge Ana (US child)" },
  { provider: "edge-tts", voiceId: "en-GB-SoniaNeural",        label: "Edge Sonia (GB female)" },
];

const PAID_TIER_TESTS = [
  { provider: "fal-narrator",   voiceId: undefined, label: "FAL Kokoro (paid)" },
  { provider: "gemini",         voiceId: "Charon",  label: "FAL Gemini Charon (paid premium)" },
];

const TESTS = process.env.INCLUDE_PAID === "1"
  ? [...FREE_TIER_TESTS, ...PAID_TIER_TESTS]
  : FREE_TIER_TESTS;

const SAMPLE_TEXT = "Battery sample: the quick brown fox jumps over the lazy dog.";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

let pass = 0;
let fail = 0;
try {
  log(`Opening ${URL_BASE} for site-lock cookie`);
  await page.goto(`${URL_BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);

  for (const t of TESTS) {
    process.stdout.write(`[narration] ${t.label} ... `);
    const t0 = Date.now();
    const result = await page.evaluate(async ({ provider, voiceId, text }) => {
      try {
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, provider, voiceId }),
        });
        const j = await r.json();
        return { status: r.status, engine: j.engine, audioUrl: j.audioUrl, durationMs: j.durationMs, error: j.error, pacingEntriesCount: Array.isArray(j.pacingEntries) ? j.pacingEntries.length : null };
      } catch (e) {
        return { status: 0, error: e.message };
      }
    }, { provider: t.provider, voiceId: t.voiceId, text: SAMPLE_TEXT });

    const elapsedMs = Date.now() - t0;
    const ok = result.status === 200 && result.audioUrl && result.engine;
    if (ok) {
      console.log(`✓ ${result.engine} ${(result.durationMs/1000).toFixed(1)}s audio in ${elapsedMs}ms${result.pacingEntriesCount ? ` (+${result.pacingEntriesCount} word timings)` : ""}`);
      pass++;
    } else {
      console.log(`✗ status=${result.status} engine=${result.engine ?? "n/a"} error=${result.error ?? "no audioUrl"}`);
      fail++;
    }
  }

  console.log(`\n──── Narration battery: ${pass} pass / ${fail} fail (out of ${TESTS.length}) ────`);
  await page.screenshot({ path: "tests/narration-battery.png", fullPage: true }).catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
} catch (err) {
  console.error("[narration] catastrophic:", err.message);
  process.exit(2);
} finally {
  await page.close();
}
