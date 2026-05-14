// E2E v2 — drives debug Chrome :9222 with stronger selectors.
// Targets bottom-pinned tab bar + the visible "Write Story" CTA button.

import { chromium } from "playwright";

const log = (...a) => console.log(`[e2e]`, ...a);
const SHOTS = "C:/tmp";
const PROJECT = `verify_v2_${Date.now()}`;
const STORY = "A small turtle learns to swim with help from a friendly fish in a sunny lagoon.";

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${SHOTS}/v2_${name}.png`, fullPage: false });
    log("📸", name);
  } catch (e) { log("📸 fail", name, e.message); }
}

async function main() {
  log("connect :9222");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  log("opening hybrid-planner");
  await page.goto(`http://localhost:3200/dashboard/hybrid-planner?projectId=${PROJECT}`, {
    waitUntil: "domcontentloaded", timeout: 30000,
  });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await shot(page, "01_load");

  // 1. Click "Write Story" CTA at top
  log("click Write Story CTA");
  const writeStory = page.getByRole("button", { name: /^Write Story$/ }).first();
  if (await writeStory.isVisible({ timeout: 5000 }).catch(() => false)) {
    await writeStory.click();
    log("✅ Write Story clicked");
  } else {
    log("⚠️ Write Story button not visible — try bottom Story tab");
    // Fallback: bottom tab. They use checkmark/warning icons + label.
    // Use last() to grab the bottom-pinned one (top tab is also "Story" sometimes).
    const bottomStory = page.locator('button').filter({ hasText: /^[✓⚠]\s*Story$/ }).first();
    if (await bottomStory.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bottomStory.click();
      log("✅ bottom Story clicked");
    } else {
      log("❌ no Story navigation found");
    }
  }
  await page.waitForTimeout(1500);
  await shot(page, "02_after_story");

  // 2. Find idea textarea
  log("find idea textarea");
  // Hybrid uses placeholder text like "Tell us your story idea" or has a specific label.
  // Try multiple candidates.
  const textareas = await page.locator('textarea').all();
  log(`found ${textareas.length} textareas`);
  let typed = false;
  for (const t of textareas) {
    try {
      const ph = await t.getAttribute("placeholder").catch(() => "");
      const visible = await t.isVisible().catch(() => false);
      log(`  textarea visible=${visible} placeholder="${ph?.slice(0, 40)}"`);
      if (visible) {
        await t.click();
        await t.fill(STORY);
        typed = true;
        log("✅ typed via fill()");
        break;
      }
    } catch { /* try next */ }
  }
  await shot(page, "03_typed");
  if (!typed) { log("❌ aborting — no textarea"); await page.close(); return; }

  // 3. Click Expand button
  log("click Expand with AI Intelligence");
  const expand = page.getByRole("button", { name: /Expand.*AI|Expand.*Intelligence|Expand.*Story/i }).first();
  if (!(await expand.isVisible({ timeout: 3000 }).catch(() => false))) {
    log("❌ Expand button not visible");
    await shot(page, "04_no_expand");
    await page.close(); return;
  }
  await expand.click();
  log("✅ Expand clicked — waiting for result (max 120s)");

  // Wait for "Story Expanded" header or "Scene Breakdown" section
  const expanded = await Promise.race([
    page.getByText(/Story Expanded/i).first().waitFor({ timeout: 120000 }).then(() => "ok").catch(() => null),
    page.getByText(/Scene Breakdown/i).first().waitFor({ timeout: 120000 }).then(() => "scenes").catch(() => null),
  ]);
  log("expand result:", expanded);
  await shot(page, "05_expanded");

  // 4. Navigate to Scenes tab via bottom nav
  log("click bottom Scenes tab");
  const scenesTab = page.locator('button').filter({ hasText: /^[✓⚠✗]?\s*Scenes$/ }).first();
  if (await scenesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scenesTab.click();
  } else {
    // Try header-style "Scene Board" tab
    const sb = page.locator('button, [role="tab"]').filter({ hasText: /Scene Board/i }).first();
    if (await sb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sb.click();
    }
  }
  await page.waitForTimeout(2000);
  await shot(page, "06_scenes");

  // 5. Try Make Image on first scene
  log("click first Make Image");
  const makeImg = page.getByRole("button", { name: /Make Image/i }).first();
  if (await makeImg.isVisible({ timeout: 3000 }).catch(() => false)) {
    await makeImg.click();
    log("⏳ waiting for image (max 90s)");
    await page.waitForTimeout(90000);
    await shot(page, "07_after_make_image");
  } else {
    log("⚠️ Make Image not found — possibly Gen Image button");
    const gi = page.getByRole("button", { name: /Gen Image|^Generate$/ }).first();
    if (await gi.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gi.click();
      log("⏳ waiting (max 90s)");
      await page.waitForTimeout(90000);
      await shot(page, "07_after_gen_image");
    }
  }

  // 6. Go to Assembly
  log("click Assembly tab");
  const asmTab = page.locator('button').filter({ hasText: /^[✓⚠✗]?\s*Assembly$/ }).first();
  if (await asmTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await asmTab.click();
  }
  await page.waitForTimeout(1500);
  await shot(page, "08_assembly");

  // 7. Count Max buttons + click first + Gen Max
  const maxBtns = page.getByRole("button", { name: /\+ Gen Max|Use Max Image|Max ON/i });
  const cnt = await maxBtns.count();
  log(`Max buttons in Assembly: ${cnt}`);
  for (let i = 0; i < Math.min(cnt, 5); i++) {
    const t = await maxBtns.nth(i).textContent();
    log(`  [${i}]`, t?.trim());
  }
  if (cnt > 0) {
    await maxBtns.first().click();
    log("⏳ + Gen Max clicked, waiting 90s");
    await page.waitForTimeout(90000);
    await shot(page, "09_after_genmax");
    const after = await page.getByRole("button", { name: /Max ON/i }).count();
    log(`Max ON buttons after: ${after}`);
  }

  log("DONE");
  await page.close();
}

main().catch(e => { console.error("FAIL:", e.message, e.stack); process.exit(1); });
