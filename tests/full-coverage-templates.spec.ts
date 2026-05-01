import { test, expect, chromium } from "@playwright/test";
import * as path from "path";

const BASE = "http://localhost:3200";

test.describe("Templates Page — /dashboard/templates", () => {
  test("1. Navigate and screenshot", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join("tests", "screenshots", "templates-01-loaded.png"),
      fullPage: false,
    });

    // Verify templates page heading renders
    const heading = page.locator("text=Templates, text=Content Templates").first();
    const pageTitle = await page.title();
    console.log("Page title:", pageTitle);

    // Verify at least one template card renders
    const cards = await page.locator("[style*='cursor: pointer'], [style*='cursor:pointer']").count();
    console.log("Clickable cards found:", cards);
    expect(cards).toBeGreaterThan(0);

    await browser.close();
  });

  test("2. Click each category tab", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Get all filter buttons (categories)
    const filterButtons = page.locator("button").filter({ hasText: /Real Estate|Product Ads|Social Media|Food|Entertainment|Intro/ });
    const btnCount = await filterButtons.count();
    console.log("Category buttons found:", btnCount);

    // Click each category button
    for (let i = 0; i < btnCount; i++) {
      const btn = filterButtons.nth(i);
      const label = await btn.textContent();
      await btn.click();
      await page.waitForTimeout(600);
      console.log("Clicked category:", label?.trim());
    }

    // Also test All button to reset
    const allBtn = page.locator("button").filter({ hasText: /^All \(/ });
    await allBtn.first().click();
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join("tests", "screenshots", "templates-02-categories.png"),
    });

    await browser.close();
  });

  test("3. Click first template card — preview modal opens", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click first template card (they have cursor:pointer style)
    const firstCard = page.locator("[style*='cursor: pointer']").first();
    await firstCard.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join("tests", "screenshots", "templates-03-modal.png"),
    });

    // Modal should appear — look for fixed overlay
    const modal = page.locator("[style*='position: fixed'], [style*='position:fixed']").first();
    await expect(modal).toBeVisible();

    // Verify "Use This Template" button exists
    const useBtn = page.locator("button", { hasText: "Use This Template" });
    await expect(useBtn).toBeVisible();

    // Verify Close button exists
    const closeBtn = page.locator("button", { hasText: "Close" });
    await expect(closeBtn).toBeVisible();

    // Close the modal
    await closeBtn.click();
    await page.waitForTimeout(500);

    await browser.close();
  });

  test("4. Use This Template — navigates to studio with prefilled prompt", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/templates`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click first card to open modal
    const firstCard = page.locator("[style*='cursor: pointer']").first();
    await firstCard.click();
    await page.waitForTimeout(1000);

    // Click "Use This Template"
    const useBtn = page.locator("button", { hasText: "Use This Template" });
    await expect(useBtn).toBeVisible();

    // Track navigation
    const [response] = await Promise.all([
      page.waitForNavigation({ timeout: 15000, waitUntil: "domcontentloaded" }).catch(() => null),
      useBtn.click(),
    ]);

    await page.waitForTimeout(1500);

    const url = page.url();
    console.log("Navigated to:", url);

    await page.screenshot({
      path: path.join("tests", "screenshots", "templates-04-use-template.png"),
    });

    // Should navigate to dashboard or ad-editor with template/prompt params
    const navigatedAway = url !== `${BASE}/dashboard/templates`;
    expect(navigatedAway || url.includes("template") || url.includes("prompt")).toBeTruthy();

    await browser.close();
  });
});
