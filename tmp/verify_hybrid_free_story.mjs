// Browser e2e — build a real hybrid story on GHS Sound (free) tier.
// Drives AUT debug Chrome :9222. NO API shortcuts — only clicks + typing.
//
// Flow:
//   1. Open hybrid-planner with a fresh test project
//   2. Click Story tab, enter an idea
//   3. Set Sound tier to GHS Sound (free)
//   4. Click Expand Story → wait
//   5. Look for scenes generated
//   6. Click Scene Board tab → check scenes appear
//   7. Click Make Image on first scene → wait
//   8. Click Assembly tab → verify Use Max Image / + Gen Max button visible
//   9. Click + Gen Max → wait → verify pool fills

import { chromium } from "playwright";
import * as fs from "fs";

const SCREENSHOTS = "C:/tmp";
const PROJECT_ID = `verify_free_${Date.now()}`;
const STORY_IDEA = "A small turtle learns to swim with help from a friendly fish in a sunny lagoon.";

const log = (...a) => { const s = `[free-test] ${a.map(String).join(" ")}`; console.log(s); };

const shot = async (page, name) => {
  const path = `${SCREENSHOTS}/free_${name}.png`;
  try {
    await page.screenshot({ path, fullPage: false });
    log("📸", name);
  } catch (e) {
    log("📸 fail", name, e.message);
  }
};

async function clickByText(page, text, timeoutMs = 5000) {
  const re = typeof text === "string" ? new RegExp(text, "i") : text;
  const locs = [
    page.getByRole("button", { name: re }).first(),
    page.getByRole("tab", { name: re }).first(),
    page.locator(`button, a, [role="tab"]`).filter({ hasText: re }).first(),
  ];
  for (const loc of locs) {
    try {
      if (await loc.isVisible({ timeout: timeoutMs / 3 })) {
        await loc.click();
        return true;
      }
    } catch { /* try next */ }
  }
  return false;
}

async function main() {
  log("connecting to debug Chrome :9222 …");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  // ── 1. open hybrid-planner ──
  const url = `http://localhost:3200/dashboard/hybrid-planner?projectId=${PROJECT_ID}`;
  log("opening", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await shot(page, "01_loaded");

  // ── 2. click Story tab if not active ──
  log("clicking Story tab");
  await clickByText(page, /^story$/i);
  await page.waitForTimeout(800);
  await shot(page, "02_story_tab");

  // ── 3. find idea textarea + type ──
  log("typing story idea");
  // Try several selectors for the idea input
  const ideaInput = page.locator('textarea').filter({ hasText: "" }).first();
  const candidates = [
    page.getByPlaceholder(/idea|story|describe/i).first(),
    page.locator('textarea[placeholder*="story" i]').first(),
    page.locator('textarea[placeholder*="idea" i]').first(),
    page.locator('textarea').first(),
  ];
  let typed = false;
  for (const inp of candidates) {
    try {
      if (await inp.isVisible({ timeout: 2000 })) {
        await inp.click();
        await inp.fill("");
        await inp.type(STORY_IDEA, { delay: 8 });
        typed = true;
        log("✅ typed into textarea");
        break;
      }
    } catch { /* try next */ }
  }
  if (!typed) {
    log("⚠️ couldn't find idea textarea");
  }
  await shot(page, "03_typed");

  // ── 4. find + click GHS Sound tier (free) if there's a tier selector visible ──
  log("setting Sound tier to GHS Sound (free)");
  const tierBtn = page.getByRole("button", { name: /GHS Sound/i }).first();
  if (await tierBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tierBtn.click();
    log("✅ GHS Sound clicked");
  } else {
    log("ℹ️ GHS Sound tier button not on this view (may live in Sound tab)");
  }
  await page.waitForTimeout(400);

  // ── 5. click Expand Story ──
  log("clicking Expand Story / Expand with AI");
  const expanded = await clickByText(page, /Expand.*(Story|AI|Intelligence)/i);
  if (!expanded) {
    log("⚠️ Expand button not found");
    await shot(page, "04_no_expand_btn");
  } else {
    log("✅ Expand triggered — waiting for response (max 90s)");
    // Wait for some sign of expansion: a "Story Expanded" badge OR scenes appearing
    const expandSuccess = await Promise.race([
      page.getByText(/Story Expanded|Scene Breakdown|Detected Actors/i).first().waitFor({ timeout: 90000 }).then(() => "expanded").catch(() => null),
      page.waitForTimeout(90000).then(() => "timeout"),
    ]);
    log("expand result:", expandSuccess);
    await shot(page, "05_expanded");
  }

  // ── 6. click Scene Board tab ──
  log("clicking Scene Board tab");
  await clickByText(page, /Scene Board|Scenes/i);
  await page.waitForTimeout(1200);
  await shot(page, "06_scene_board");

  // Count visible scene cards
  const sceneTitles = await page.locator('text=/^SC0[0-9]/').count();
  log(`scene cards visible: ${sceneTitles}`);

  // ── 7. click Make Image on first scene ──
  log("looking for Make Image / Gen Image / Regen button");
  const makeImg = page.getByRole("button", { name: /Make Image|Gen Image|Regen Image/i }).first();
  if (await makeImg.isVisible({ timeout: 3000 }).catch(() => false)) {
    log("clicking Make Image");
    await makeImg.click();
    log("⏳ waiting for first image to land (max 60s)");
    await page.waitForTimeout(60000);
  } else {
    log("⚠️ Make Image button not found");
  }
  await shot(page, "07_after_image");

  // ── 8. open Assembly tab ──
  log("clicking Assembly tab");
  await clickByText(page, /^assembly$/i);
  await page.waitForTimeout(1500);
  await shot(page, "08_assembly_tab");

  // Look for Max-related buttons
  const maxBtns = page.getByRole("button", { name: /Use Max Image|Max ON|\+ Gen Max/i });
  const maxCount = await maxBtns.count();
  log(`Max-related buttons in Assembly: ${maxCount}`);
  if (maxCount > 0) {
    for (let i = 0; i < Math.min(maxCount, 6); i++) {
      const t = await maxBtns.nth(i).textContent();
      log(`  [${i}] "${t?.trim()}"`);
    }
  }

  // ── 9. click first + Gen Max ──
  const firstGenMax = page.getByRole("button", { name: /\+ Gen Max/i }).first();
  if (await firstGenMax.isVisible({ timeout: 3000 }).catch(() => false)) {
    log("clicking + Gen Max on first scene");
    await firstGenMax.click();
    log("⏳ waiting for beats to land (max 90s)");
    await page.waitForTimeout(90000);
    await shot(page, "09_after_gen_max");
    // Check if Max ON appeared
    const maxOn = page.getByRole("button", { name: /Max ON/i }).first();
    log(`Max ON visible after: ${await maxOn.isVisible({ timeout: 2000 }).catch(() => false)}`);
  } else {
    log("ℹ️ + Gen Max button not found in Assembly (scene may have no description yet)");
  }

  log("DONE — screenshots in C:/tmp/free_*.png");
  await page.close();
}

main().catch(e => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
