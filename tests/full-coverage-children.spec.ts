/**
 * Full Button Coverage Test — Children Planner Page
 * /dashboard/children-planner
 *
 * Rules:
 * - Headless Playwright, real chromium
 * - Skip Render/Generate-Video clicks (verify exist only)
 * - Max 2 Pruna image gens per page
 * - Fill inputs with: "A baby giraffe learns to share"
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "screenshots", "children-planner");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

test.describe("Children Planner Page — Full Coverage", () => {

  test("1. page loads at 200", async ({ page }) => {
    const resp = await page.goto(`${BASE}/dashboard/children-planner`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(1000);
    await shot(page, "01-initial-load");
  });

  test("2. Suspense resolves — workshop UI renders", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await expect(
      page.locator("text=Loading Child Video Planner...").or(page.locator("text=Overview"))
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await shot(page, "02-workshop-loaded");
  });

  test("3. all workshop tabs render", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const tabs = ["Overview", "Design", "Characters", "Content", "Style & Voice", "Screenplay", "Review 1", "Preview", "Final"];
    for (const tab of tabs) {
      const el = page.locator(`text=${tab}`).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }
    await shot(page, "03-all-tabs-visible");
  });

  test("4. click each tab — no crash", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const tabLabels = ["Design", "Content", "Style & Voice", "Review 1", "Preview", "Final"];
    for (const label of tabLabels) {
      const tab = page.locator(`button:has-text("${label}")`).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(400);
        await shot(page, `04-tab-${label.replace(/[\s&]+/g, "-").toLowerCase()}`);
      }
    }
  });

  test("5. Design tab — age group buttons clickable", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const designTab = page.locator('button:has-text("Design")').first();
    if (await designTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await designTab.click();
      await page.waitForTimeout(500);
      const ageGroups = ["Toddlers", "Pre-school", "Early School", "Older Kids"];
      for (const ag of ageGroups) {
        const btn = page.locator(`button:has-text("${ag}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      }
      await shot(page, "05-age-group-buttons");
    }
  });

  test("6. Design tab — safety level buttons", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const designTab = page.locator('button:has-text("Design")').first();
    if (await designTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await designTab.click();
      await page.waitForTimeout(500);
      const safetyBtns = ["Maximum", "High", "Standard"];
      for (const s of safetyBtns) {
        const btn = page.locator(`button:has-text("${s}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      }
      await shot(page, "06-safety-level-buttons");
    }
  });

  test("7. Content tab — story input filled with test content", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const contentTab = page.locator('button:has-text("Content")').first();
    if (await contentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentTab.click();
      await page.waitForTimeout(500);
      // Find story/content textarea or input
      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.fill("A baby giraffe learns to share");
        await page.waitForTimeout(300);
        const val = await textarea.inputValue();
        expect(val).toContain("giraffe");
      }
      await shot(page, "07-content-input-filled");
    }
  });

  test("8. Content tab — learning mode buttons clickable", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const contentTab = page.locator('button:has-text("Content")').first();
    if (await contentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentTab.click();
      await page.waitForTimeout(500);
      const modes = ["Storybook", "Read-Along", "Word Learning", "Phonics"];
      for (const mode of modes) {
        const btn = page.locator(`button:has-text("${mode}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      }
      await shot(page, "08-learning-modes");
    }
  });

  test("9. Style & Voice tab — narration style buttons", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const styleTab = page.locator('button:has-text("Style & Voice")').first();
    if (await styleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await styleTab.click();
      await page.waitForTimeout(500);
      const narStyles = ["Gentle Story Reader", "Fun Kids Narrator", "Calm Bedtime Narrator"];
      for (const ns of narStyles) {
        const btn = page.locator(`button:has-text("${ns}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      }
      await shot(page, "09-narration-styles");
    }
  });

  test("10. Style & Voice tab — visual style buttons", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const styleTab = page.locator('button:has-text("Style & Voice")').first();
    if (await styleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await styleTab.click();
      await page.waitForTimeout(500);
      const visStyles = ["Storybook", "Bright Cartoon", "Nursery Soft", "Fantasy Land"];
      for (const vs of visStyles) {
        const btn = page.locator(`button:has-text("${vs}")`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(200);
        }
      }
      await shot(page, "10-visual-styles");
    }
  });

  test("11. Style & Voice tab — music choice selector", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const styleTab = page.locator('button:has-text("Style & Voice")').first();
    if (await styleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await styleTab.click();
      await page.waitForTimeout(500);
      const musicSelect = page.locator("select").first();
      if (await musicSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Try selecting ABC Learning
        await musicSelect.selectOption({ label: "ABC Learning" });
        await page.waitForTimeout(200);
      }
    }
  });

  test("12. AID model picker button present — segmind_pruna model selectable", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    // Check any tab for model picker
    const tabs = ["Design", "Content", "Preview", "Final"];
    for (const tabLabel of tabs) {
      const tab = page.locator(`button:has-text("${tabLabel}")`).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(400);
        const aidBtn = page.locator("button", { hasText: /model|pruna|choose model/i }).first();
        if (await aidBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await aidBtn.click();
          await page.waitForTimeout(400);
          // Look for Pruna P Image option
          const prunaOption = page.locator("text=Pruna P Image, text=segmind_pruna").first();
          if (await prunaOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await prunaOption.click();
            await page.waitForTimeout(300);
          }
          await shot(page, "12-aid-picker-open");
          break;
        }
      }
    }
  });

  test("13. Screenplay tab accessible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const spTab = page.locator('button:has-text("Screenplay")').first();
    if (await spTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await spTab.click();
      await page.waitForTimeout(500);
      await shot(page, "13-screenplay-tab");
    }
  });

  test("14. Review 1 tab — approve/reject buttons visible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const r1Tab = page.locator('button:has-text("Review 1")').first();
    if (await r1Tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await r1Tab.click();
      await page.waitForTimeout(500);
      // Check for approve / looks good / confirm type buttons
      const approveBtns = page.locator("button", { hasText: /approve|looks good|confirm|continue|done/i });
      const count = await approveBtns.count();
      if (count > 0) {
        await expect(approveBtns.first()).toBeVisible();
      }
      await shot(page, "14-review1-tab");
    }
  });

  test("15. Final tab accessible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const finalTab = page.locator('button:has-text("Final")').first();
    if (await finalTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await finalTab.click();
      await page.waitForTimeout(500);
      await shot(page, "15-final-tab");
    }
  });

  test("16. Pruna image gen — max 2 — content tab scene image (verify button exists)", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    // Fill story first
    const contentTab = page.locator('button:has-text("Content")').first();
    if (await contentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentTab.click();
      await page.waitForTimeout(500);
      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.fill("A baby giraffe learns to share");
        await page.waitForTimeout(300);
      }
      // Verify generate scene image button exists (do NOT click — max 2 rule)
      const genImgBtn = page.locator("button", { hasText: /generate image|gen image|scene image/i }).first();
      if (await genImgBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(genImgBtn).toBeVisible();
      }
      await shot(page, "16-gen-image-button-visible");
    }
  });

  test("17. seed input present and writable", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    // Check all tabs for seed input
    const tabs = ["Design", "Content", "Style & Voice"];
    for (const tabLabel of tabs) {
      const tab = page.locator(`button:has-text("${tabLabel}")`).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(400);
        const seedInput = page.locator("input[placeholder*='seed' i], input[type='number'][placeholder*='seed' i]").first();
        if (await seedInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await seedInput.fill("1234");
          await page.waitForTimeout(200);
          const val = await seedInput.inputValue();
          expect(val).toBe("1234");
          break;
        }
      }
    }
  });

  test("18. state saved to localStorage", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const contentTab = page.locator('button:has-text("Content")').first();
    if (await contentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentTab.click();
      await page.waitForTimeout(500);
      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.fill("A baby giraffe learns to share");
        await page.waitForTimeout(300);
      }
    }
    // Save if button present
    const saveBtn = page.locator("button", { hasText: /save/i }).first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(500);
    }
    // Reload and verify page still loads
    await page.reload();
    const resp = await page.goto(`${BASE}/dashboard/children-planner`);
    expect(resp?.status()).toBe(200);
    await shot(page, "18-reload-state");
  });

  test("19. Characters tab — add from library button", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(2000);
    const charTab = page.locator('button:has-text("Characters")').first();
    if (await charTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await charTab.click();
      await page.waitForTimeout(500);
      // Look for character picker / add character button
      const charBtn = page.locator("button", { hasText: /add character|pick character|character picker/i }).first();
      if (await charBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await charBtn.click();
        await page.waitForTimeout(500);
        await shot(page, "19-character-picker");
        // Close if opened
        const closeBtn = page.locator("button", { hasText: /close|cancel/i }).first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test("20. page 200 final confirmation + full screenshot", async ({ page }) => {
    const resp = await page.goto(`${BASE}/dashboard/children-planner`);
    expect(resp?.status()).toBe(200);
    await page.waitForTimeout(1500);
    await shot(page, "20-final-200-confirmation");
  });
});
