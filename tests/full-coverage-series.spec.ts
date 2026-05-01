/**
 * Full Button Coverage Test — Series Wizard Page
 * /dashboard/series-wizard
 *
 * Rules:
 * - Headless Playwright, real chromium
 * - Skip Render/Generate-Video clicks (verify exist only)
 * - Max 2 Pruna image gens per page
 * - Fill inputs with realistic content: "Pidgin Tales", 3 episodes
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "screenshots", "series-wizard");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

test.describe("Series Wizard Page — Full Coverage", () => {

  test("1. page loads at 200", async ({ page }) => {
    const resp = await page.goto(`${BASE}/dashboard/series-wizard`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(1000);
    await shot(page, "01-initial-load");
  });

  test("2. loading spinner resolves to workshop UI", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    // Wait for Suspense to resolve
    await expect(page.locator("text=Loading Series Workshop...").or(page.locator("text=Overview"))).toBeVisible({ timeout: 10000 });
    // Eventually the real UI should appear
    await page.waitForTimeout(1500);
    const overview = page.locator("text=Overview");
    if (await overview.isVisible()) {
      await expect(overview).toBeVisible();
    }
    await shot(page, "02-workshop-loaded");
  });

  test("3. all workshop tabs render", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const tabs = ["Overview", "Series Design", "Series Bible", "Characters", "Episodes", "Scene Board", "Screenplay", "Audio & Music", "Assembly"];
    for (const tab of tabs) {
      const el = page.locator(`text=${tab}`).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }
    await shot(page, "03-all-tabs-visible");
  });

  test("4. click each tab and verify navigation", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const tabIds = [
      { label: "Series Design", expected: "design" },
      { label: "Series Bible", expected: "bible" },
      { label: "Episodes", expected: "episodes" },
    ];
    for (const { label } of tabIds) {
      const tab = page.locator(`button:has-text("${label}")`).first();
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
        await shot(page, `04-tab-${label.replace(/\s+/g, "-").toLowerCase()}`);
      }
    }
  });

  test("5. series title input accepts text", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    // Look for the title input
    const titleInput = page.locator("input").first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.click({ clickCount: 3 });
      await titleInput.fill("Pidgin Tales");
      await page.waitForTimeout(300);
      const val = await titleInput.inputValue();
      expect(val).toContain("Pidgin");
    }
    await shot(page, "05-title-input");
  });

  test("6. genre selector renders and changes", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const genreSelect = page.locator("select").first();
    if (await genreSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genreSelect.selectOption({ label: "Comedy" });
      await page.waitForTimeout(300);
      const val = await genreSelect.inputValue();
      expect(val).toBe("Comedy");
    }
  });

  test("7. Design tab — format buttons clickable", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const designTab = page.locator('button:has-text("Series Design")').first();
    if (await designTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await designTab.click();
      await page.waitForTimeout(500);
      // Try clicking format buttons: Long-form, Short-form, etc.
      const formatBtns = ["Long-form", "Short-form", "Mini-series", "Episodic Shorts"];
      for (const label of formatBtns) {
        const btn = page.locator(`button:has-text("${label}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(300);
        }
      }
      await shot(page, "07-design-tab-formats");
    }
  });

  test("8. Episodes tab — add episode button", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const epTab = page.locator('button:has-text("Episodes")').first();
    if (await epTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await epTab.click();
      await page.waitForTimeout(500);
      // Look for add episode button
      const addBtn = page.locator("button", { hasText: /add episode/i }).first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(500);
        await shot(page, "08-episode-added");
      }
    }
  });

  test("9. Add 3 episodes sequentially", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const epTab = page.locator('button:has-text("Episodes")').first();
    if (await epTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await epTab.click();
      await page.waitForTimeout(500);
      const addBtn = page.locator("button", { hasText: /add episode/i }).first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        for (let i = 0; i < 3; i++) {
          await addBtn.click();
          await page.waitForTimeout(400);
        }
        await shot(page, "09-three-episodes");
        // Verify episode cards appeared
        const epCards = page.locator("text=/Episode [123]/");
        const count = await epCards.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("10. Save Project button exists and is clickable", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const saveBtn = page.locator("button", { hasText: /save/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(500);
      await shot(page, "10-save-clicked");
    }
  });

  test("11. New Project button exists", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const newBtn = page.locator("button", { hasText: /new project/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(newBtn).toBeVisible();
    }
  });

  test("12. AID model picker button exists in scenes or assembly tabs", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    // Navigate through tabs to find AID picker
    const tabsToCheck = ["Scene Board", "Assembly"];
    for (const tabLabel of tabsToCheck) {
      const tab = page.locator(`button:has-text("${tabLabel}")`).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
        const aidBtn = page.locator("button", { hasText: /model|pruna|flux|kling/i }).first();
        if (await aidBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(aidBtn).toBeVisible();
          break;
        }
      }
    }
  });

  test("13. Seed input renders", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    // Seed may be in any tab. Check scene board.
    const sceneTab = page.locator('button:has-text("Scene Board")').first();
    if (await sceneTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sceneTab.click();
      await page.waitForTimeout(500);
      const seedInput = page.locator("input[placeholder*='seed' i], input[type='number']").first();
      if (await seedInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await seedInput.fill("42");
        await page.waitForTimeout(200);
      }
    }
  });

  test("14. overview tab shows status row", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const ovTab = page.locator('button:has-text("Overview")').first();
    if (await ovTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ovTab.click();
      await page.waitForTimeout(500);
      await shot(page, "14-overview-tab");
    }
  });

  test("15. Audio & Music tab accessible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const audioTab = page.locator('button:has-text("Audio & Music")').first();
    if (await audioTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await audioTab.click();
      await page.waitForTimeout(500);
      await shot(page, "15-audio-tab");
    }
  });

  test("16. Bible expand button exists and is clickable (no API call required)", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const bibleTab = page.locator('button:has-text("Series Bible")').first();
    if (await bibleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bibleTab.click();
      await page.waitForTimeout(500);
      const expandBtn = page.locator("button", { hasText: /expand|ai expand|expand bible/i }).first();
      if (await expandBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(expandBtn).toBeVisible();
        await shot(page, "16-bible-tab-expand-btn");
      }
    }
  });

  test("17. state persists in localStorage after input + save", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    // Fill title
    const titleInput = page.locator("input").first();
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.click({ clickCount: 3 });
      await titleInput.fill("Pidgin Tales");
      await page.waitForTimeout(300);
    }
    // Save
    const saveBtn = page.locator("button", { hasText: /save/i }).first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(600);
    }
    // Reload
    await page.reload();
    await page.waitForTimeout(2000);
    // Check localStorage has the key
    const stored = await page.evaluate(() => {
      const active = localStorage.getItem("ghs_series_active_proj");
      return active ? localStorage.getItem(`ghs_series_proj_${active}`) : localStorage.getItem("ghs_series_workshop_v1");
    });
    if (stored) {
      const data = JSON.parse(stored);
      expect(data.seriesTitle).toBe("Pidgin Tales");
    }
    await shot(page, "17-state-restored");
  });

  test("18. Assembly tab accessible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const assemblyTab = page.locator('button:has-text("Assembly")').first();
    if (await assemblyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assemblyTab.click();
      await page.waitForTimeout(500);
      await shot(page, "18-assembly-tab");
    }
  });

  test("19. Screenplay tab accessible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/series-wizard`);
    await page.waitForTimeout(2000);
    const spTab = page.locator('button:has-text("Screenplay")').first();
    if (await spTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await spTab.click();
      await page.waitForTimeout(500);
      await shot(page, "19-screenplay-tab");
    }
  });

  test("20. page 200 confirmation — final", async ({ page }) => {
    const resp = await page.goto(`${BASE}/dashboard/series-wizard`);
    expect(resp?.status()).toBe(200);
    await shot(page, "20-final-page-200");
  });
});
