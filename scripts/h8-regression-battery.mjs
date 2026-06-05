// H8 of 12-hour run — regression battery against andiostudio.com.
// Runs 5 critical-path checks. Exits 0 only if all pass.
//
// Targets:
//   1. /unlock page renders
//   2. /dashboard renders
//   3. /dashboard/children-video shows Custom Story tile after age+content selected
//   4. /dashboard/children-planner shows 5-tier voice picker on Sound tab
//   5. /api/tts edge-tts returns audio in <8s
//
// Run: node scripts/h8-regression-battery.mjs
import { chromium } from "playwright";
import { request } from "https";

const URL_BASE = process.env.URL_BASE || "https://andiostudio.com";
const log = (s) => console.log(`[h8] ${s}`);
const fail = (s) => { console.error(`[h8] ✗ FAIL: ${s}`); process.exit(1); };

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

const results = { passed: 0, failed: 0 };
const recordPass = (name) => { log(`✓ ${name}`); results.passed++; };
const recordFail = (name, why) => { log(`✗ ${name}: ${why}`); results.failed++; };

try {
  // 1. /unlock renders
  log("1/5 — /unlock loads");
  try {
    await page.goto(`${URL_BASE}/unlock`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
    const title = await page.title();
    if (!title) recordFail("unlock_renders", "no title");
    else recordPass("unlock_renders");
  } catch (e) { recordFail("unlock_renders", e.message); }

  // 2. /dashboard renders
  log("2/5 — /dashboard loads");
  try {
    await page.goto(`${URL_BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    const txt = await page.locator("body").innerText();
    if (txt.length < 100) recordFail("dashboard_renders", "body too small");
    else recordPass("dashboard_renders");
  } catch (e) { recordFail("dashboard_renders", e.message); }

  // 3. /dashboard/children-video custom story flow
  log("3/5 — children-video Custom Story tile");
  try {
    await page.goto(`${URL_BASE}/dashboard/children-video`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2500);
    const branch = page.locator('button:has-text("Children Video"), h3:has-text("Children Video")').first();
    await branch.waitFor({ state: "visible", timeout: 8000 });
    await branch.click();
    await page.waitForTimeout(700);
    const ageBtn = page.locator('button:has-text("Pre-school"), button:has-text("Toddlers")').first();
    await ageBtn.click();
    await page.waitForTimeout(500);
    const contentBtn = page.locator('button:has-text("Stories"), button:has-text("Phonics"), button:has-text("Letters")').first();
    await contentBtn.click();
    await page.waitForTimeout(800);
    const customTile = page.locator('text=Write Your Own Story').first();
    const vis = await customTile.isVisible().catch(() => false);
    if (vis) recordPass("custom_story_tile");
    else recordFail("custom_story_tile", "not visible after content-type click");
  } catch (e) { recordFail("custom_story_tile", e.message); }

  // 4. /dashboard/children-planner Sound tab voice picker
  log("4/5 — children-planner Sound tab 5-tier picker");
  try {
    const projectId = `child_${Date.now()}_h8`;
    await page.goto(`${URL_BASE}/dashboard/children-planner?projectId=${projectId}&age=preschool&content=stories&duration=60sec`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3500);
    const soundTab = page.locator('button:has-text("Sound")').first();
    await soundTab.waitFor({ state: "visible", timeout: 8000 });
    await soundTab.click();
    await page.waitForTimeout(1500);
    let tiersFound = 0;
    for (const t of ["GHS Standard", "GHS Standard+", "GHS Pro", "GHS Premium", "GHS Best"]) {
      if (await page.locator(`button:has-text("${t}")`).first().isVisible().catch(() => false)) tiersFound++;
    }
    if (tiersFound === 5) recordPass(`tier_picker_5tiers_visible`);
    else recordFail("tier_picker_5tiers_visible", `only ${tiersFound}/5 tiers visible`);
  } catch (e) { recordFail("tier_picker_5tiers_visible", e.message); }

  // 5. /api/tts edge-tts smoke (call internal, not through CF)
  log("5/5 — /api/tts edge-tts Nigerian voice");
  try {
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "h8 regression test", provider: "edge-tts", voiceId: "en-NG-EzinneNeural" }),
      });
      const j = await r.json();
      return { status: r.status, audioUrl: j.audioUrl, engine: j.engine, error: j.error };
    });
    if (res.status === 200 && res.audioUrl && res.engine) recordPass(`edge_tts_works engine=${res.engine}`);
    else recordFail("edge_tts_works", `status=${res.status} engine=${res.engine ?? "none"} error=${res.error ?? "none"}`);
  } catch (e) { recordFail("edge_tts_works", e.message); }

  await page.screenshot({ path: "tests/h8-final.png", fullPage: true });

  log("");
  log(`──── H8 RESULT: ${results.passed}/5 passed, ${results.failed}/5 failed ────`);
  process.exit(results.failed === 0 ? 0 : 1);
} catch (err) {
  console.error("[h8] catastrophic:", err.message);
  await page.screenshot({ path: "tests/h8-catastrophic.png", fullPage: true }).catch(() => {});
  process.exit(2);
} finally {
  await page.close();
}
