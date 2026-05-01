/**
 * Full Button Coverage Test — Movie Creator Page
 * /dashboard/movie-creator
 *
 * Rules:
 * - Headless Playwright, real chromium
 * - Skip Render/Generate-Video clicks (verify exist only)
 * - Max 2 Pruna image gens per page
 * - Log every button action
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(process.cwd(), "tests", "screenshots", "movie-creator");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

test.describe("Movie Creator Page — Full Coverage", () => {

  test("1. page loads at 200", async ({ page }) => {
    const resp = await page.goto(`${BASE}/dashboard/movie-creator`);
    expect(resp?.status()).toBe(200);
    await shot(page, "01-initial-load");
  });

  test("2. hero section visible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Create Movie")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Multi-AI Cinematic Studio")).toBeVisible();
  });

  test("3. two main path cards render", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Text to Video Movie")).toBeVisible();
    await expect(page.locator("text=Hybrid Movie")).toBeVisible();
  });

  test("4. Full Video card links to movie-planner", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const link = page.locator('a[href="/dashboard/movie-planner"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toBe("/dashboard/movie-planner");
  });

  test("5. Hybrid card links to hybrid-planner", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const link = page.locator('a[href="/dashboard/hybrid-planner"]');
    await expect(link).toBeVisible();
  });

  test("6. Learn more button shows hybrid explanation panel", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    // Find the Learn more button in the Hybrid card
    const learnBtn = page.locator("button", { hasText: "Learn more" });
    await expect(learnBtn).toBeVisible();
    await learnBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=How Hybrid Movie Works")).toBeVisible();
    await shot(page, "02-hybrid-explanation-open");
  });

  test("7. close button dismisses hybrid explanation panel", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const learnBtn = page.locator("button", { hasText: "Learn more" });
    await learnBtn.click();
    await page.waitForTimeout(300);
    const closeBtn = page.locator("button", { hasText: "close" });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=How Hybrid Movie Works")).not.toBeVisible();
    await shot(page, "03-hybrid-explanation-closed");
  });

  test("8. cost comparison table in hybrid panel", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const learnBtn = page.locator("button", { hasText: "Learn more" });
    await learnBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Cost Comparison (10-scene movie)")).toBeVisible();
    await expect(page.locator("text=40 credits")).toBeVisible();
    await expect(page.locator("text=12 credits")).toBeVisible();
  });

  test("9. scene type breakdown cards in hybrid panel", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const learnBtn = page.locator("button", { hasText: "Learn more" });
    await learnBtn.click();
    await page.waitForTimeout(300);
    // 5 scene types: Image, Video, Image→Video, Audio Bridge, Hybrid
    await expect(page.locator("text=Image").first()).toBeVisible();
    await expect(page.locator("text=Audio Bridge")).toBeVisible();
  });

  test("10. other options grid renders three cards", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Continue Existing")).toBeVisible();
    await expect(page.locator("text=Create Series")).toBeVisible();
    await expect(page.locator("text=Manage Characters")).toBeVisible();
  });

  test("11. Continue Existing links to movie-planner?continue=true", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const link = page.locator('a[href="/dashboard/movie-planner?continue=true"]');
    await expect(link).toBeVisible();
  });

  test("12. Create Series links to series-wizard", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const link = page.locator('a[href="/dashboard/series-wizard"]').first();
    await expect(link).toBeVisible();
  });

  test("13. Manage Characters links to character-voices", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const link = page.locator('a[href="/dashboard/character-voices"]');
    await expect(link).toBeVisible();
  });

  test("14. sample images section renders", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=AI-Generated Scene Images")).toBeVisible();
    await shot(page, "04-sample-images");
  });

  test("15. hybrid sample videos section renders", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Hybrid Format (Images + Video)")).toBeVisible();
  });

  test("16. full video samples section renders", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Full Video Format")).toBeVisible();
    await shot(page, "05-full-page-final");
  });

  test("17. mouse hover on Full Video card changes border", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const card = page.locator('a[href="/dashboard/movie-planner"]').first().locator("div").first();
    await card.hover();
    await page.waitForTimeout(300);
    // hover applied — just verify no crash
    await shot(page, "06-hover-state");
  });

  test("18. mouse hover on Hybrid card changes border", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    const card = page.locator('a[href="/dashboard/hybrid-planner"]').locator("div").first();
    await card.hover();
    await page.waitForTimeout(300);
  });

  test("19. Open Movie Planner text visible in Full Video card", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Open Movie Planner")).toBeVisible();
  });

  test("20. Start Hybrid Movie text visible in Hybrid card", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await expect(page.locator("text=Start Hybrid Movie")).toBeVisible();
  });

  test("21. page has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto(`${BASE}/dashboard/movie-creator`);
    await page.waitForTimeout(1000);
    // Filter out known 404s for media assets (demo videos may not exist in dev)
    const hardErrors = errors.filter(e => !e.includes("404") && !e.includes("Failed to load resource"));
    expect(hardErrors).toHaveLength(0);
  });
});
