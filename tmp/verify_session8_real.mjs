// Verify against existing children project with real scenes (Maya Meets Pip, etc.)
import { chromium } from "playwright";

const log = (...a) => console.log(`[verify-real]`, ...a);

async function main() {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();

  // Real children project that has scenes
  log("loading ghs_children_default ...");
  await page.goto("http://localhost:3200/dashboard/children-planner?projectId=ghs_children_default", {
    waitUntil: "domcontentloaded", timeout: 30000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  // Click Assembly tab
  log("clicking Assembly tab ...");
  const tab = page.locator('button, a, [role="tab"]').filter({ hasText: /^assembly$/i }).first();
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: "C:/tmp/v8r_child_assembly.png", fullPage: true });
  log("screenshot v8r_child_assembly.png (full page)");

  // Look for any of the 3 button states — broad selector for orange button
  // States: "Use Max Image (N)", "Max ON (M/N)", "+ Gen Max (~N)"
  const allBtns = page.getByRole("button").filter({ hasText: /Use Max Image|Max ON|Gen Max|\+ Gen Max/ });
  const count = await allBtns.count();
  log(`Max-related buttons found in Assembly: ${count}`);

  if (count > 0) {
    for (let i = 0; i < Math.min(count, 8); i++) {
      const t = await allBtns.nth(i).textContent();
      log(`  [${i}] "${t?.trim()}"`);
    }
  }

  // ── HYBRID ──
  log("loading hybrid-planner default ...");
  await page.goto("http://localhost:3200/dashboard/hybrid-planner?projectId=ghs_hybrid_default", {
    waitUntil: "domcontentloaded", timeout: 30000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  // Click Assembly tab
  const hybridTab = page.locator('button, a, [role="tab"]').filter({ hasText: /^assembly$/i }).first();
  if (await hybridTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await hybridTab.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: "C:/tmp/v8r_hybrid_assembly.png", fullPage: true });
  log("screenshot v8r_hybrid_assembly.png (full page)");

  const hbtns = page.getByRole("button").filter({ hasText: /Use Max Image|Max ON|Gen Max|\+ Gen Max/ });
  const hcount = await hbtns.count();
  log(`Max-related buttons in hybrid Assembly: ${hcount}`);
  if (hcount > 0) {
    for (let i = 0; i < Math.min(hcount, 8); i++) {
      const t = await hbtns.nth(i).textContent();
      log(`  [${i}] "${t?.trim()}"`);
    }
  }

  // ── MOVIE — Voice tab ──
  log("loading movie-planner ...");
  await page.goto("http://localhost:3200/dashboard/movie-planner?projectId=ghs_movie_default", {
    waitUntil: "domcontentloaded", timeout: 30000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  const voice = page.locator('button, a, [role="tab"]').filter({ hasText: /^(voice|sound)$/i }).first();
  if (await voice.isVisible({ timeout: 5000 }).catch(() => false)) {
    await voice.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: "C:/tmp/v8r_movie_voice.png", fullPage: true });
  log("screenshot v8r_movie_voice.png (full page)");

  // ⓘ glyph or "info" buttons next to tier selectors
  const infoCandidates = page.locator('button').filter({ hasText: /^[ⓘi]$|^info$/ });
  const infoCount = await infoCandidates.count();
  log(`ⓘ tier-info buttons found: ${infoCount}`);

  // 🎭 Generate Dialogue button
  const mcd = page.getByRole("button", { name: /🎭|Multi-Cast|Generate Dialogue|MCD/i }).first();
  const mcdLabel = await mcd.textContent({ timeout: 3000 }).catch(() => null);
  log(`MCD button label: ${mcdLabel?.trim() ?? "(not found)"}`);

  log("DONE.");
  await page.close();
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
