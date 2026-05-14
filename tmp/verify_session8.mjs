// Browser verification of session 8 work — Playwright via debug Chrome :9222
import { chromium } from "playwright";

const PROJECT_ID = "verify_session8_hybrid";

const log = (...a) => console.log(`[verify]`, ...a);

async function main() {
  log("connecting to debug Chrome :9222 ...");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  // ── 1. Hybrid planner — load + ProjectSettings round-trip ──
  log("navigating hybrid-planner ...");
  await page.goto(`http://localhost:3200/dashboard/hybrid-planner?projectId=${PROJECT_ID}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => log("networkidle timeout (ok)"));
  log("hybrid-planner loaded.  title:", await page.title());

  await page.screenshot({ path: "C:/tmp/v8_hybrid_load.png", fullPage: false });
  log("screenshot v8_hybrid_load.png");

  // ── 2. Find Assembly tab + click it ──
  log("looking for Assembly tab ...");
  const assemblyTab = page.locator('button, a, [role="tab"]').filter({ hasText: /^assembly$/i }).first();
  if (await assemblyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await assemblyTab.click();
    await page.waitForTimeout(1500);
    log("Assembly tab clicked.");
    await page.screenshot({ path: "C:/tmp/v8_hybrid_assembly.png", fullPage: false });
    log("screenshot v8_hybrid_assembly.png");
  } else {
    log("Assembly tab not visible. Skipping.");
  }

  // ── 3. Look for Use Max Image button on any scene ──
  log("looking for 'Use Max Image' button ...");
  const maxBtn = page.getByRole("button", { name: /Use Max Image|Max ON/i }).first();
  const maxBtnVisible = await maxBtn.isVisible({ timeout: 3000 }).catch(() => false);
  log(`Use Max Image button visible: ${maxBtnVisible}`);
  if (!maxBtnVisible) {
    // Diagnose — count beat-image scenes
    const scenesCount = await page.locator('[data-testid^="scene-card"], .scene-card').count();
    log(`  hybrid scene cards visible: ${scenesCount}`);
    log(`  → likely no scenes generated yet for verify project, OR no Gen Max run on any scene`);
  }

  // ── 4. Movie planner Voice tab — verify ⓘ popover + 🎭 button label ──
  log("navigating movie-planner ...");
  await page.goto(`http://localhost:3200/dashboard/movie-planner?projectId=${PROJECT_ID}_movie`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => log("networkidle timeout (ok)"));

  log("looking for Voice / Sound tab ...");
  const voiceTab = page.locator('button, a, [role="tab"]').filter({ hasText: /^(voice|sound)$/i }).first();
  if (await voiceTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await voiceTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "C:/tmp/v8_movie_voice.png", fullPage: false });
    log("screenshot v8_movie_voice.png");
  }

  log("looking for ⓘ popover trigger ...");
  // Common icon glyphs: ⓘ, i, info
  const infoBtn = page.locator('button, span').filter({ hasText: /^[ⓘi]$|info/i }).first();
  if (await infoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await infoBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "C:/tmp/v8_movie_tier_popover.png", fullPage: false });
    log("screenshot v8_movie_tier_popover.png");
  } else {
    log("ⓘ popover trigger not found by simple selector.");
  }

  log("looking for 🎭 Generate Dialogue button ...");
  const mcdBtn = page.getByRole("button", { name: /🎭|Generate Dialogue|Multi-Cast/i }).first();
  const mcdLabel = await mcdBtn.textContent({ timeout: 3000 }).catch(() => null);
  log(`MCD button label: ${mcdLabel ?? "(not found)"}`);

  // ── 5. Children planner Assembly — same Use Max Image check ──
  log("navigating children-planner ...");
  await page.goto(`http://localhost:3200/dashboard/children-planner?projectId=${PROJECT_ID}_children`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => log("networkidle timeout (ok)"));

  const childAssembly = page.locator('button, a, [role="tab"]').filter({ hasText: /^assembly$/i }).first();
  if (await childAssembly.isVisible({ timeout: 5000 }).catch(() => false)) {
    await childAssembly.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "C:/tmp/v8_child_assembly.png", fullPage: false });
    log("screenshot v8_child_assembly.png");
  }

  const childMaxBtn = page.getByRole("button", { name: /Use Max Image/i }).first();
  log(`children Use Max Image button visible: ${await childMaxBtn.isVisible({ timeout: 3000 }).catch(() => false)}`);

  log("DONE. screenshots in C:/tmp/v8_*.png");
  await page.close();
}

main().catch(e => { console.error("FAIL:", e); process.exit(1); });
