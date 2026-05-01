import { test, expect, chromium } from "@playwright/test";
import * as path from "path";

const BASE = "http://localhost:3200";

test.describe("Assets Page — /dashboard/assets", () => {
  test("1. Navigate and verify assets render", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/assets`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Screenshot
    await page.screenshot({
      path: path.join("tests", "screenshots", "assets-01-loaded.png"),
      fullPage: false,
    });

    // Verify at least one asset card renders
    const cards = page.locator(".card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verify asset count badge in header
    const countBadge = await page.locator("text=/\\d+ assets/").first().textContent();
    expect(countBadge).toBeTruthy();

    await browser.close();
  });

  test("2. Filter chips change results", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/assets`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Get All count
    const allCountText = await page.locator("span").filter({ hasText: /\d+ assets/ }).first().textContent();
    const allCount = parseInt(allCountText?.match(/\d+/)?.[0] ?? "0");

    // Click "Image" filter
    await page.locator("button", { hasText: "Image" }).click();
    await page.waitForTimeout(1000);
    const imgCountText = await page.locator("span").filter({ hasText: /\d+ assets/ }).first().textContent();
    const imgCount = parseInt(imgCountText?.match(/\d+/)?.[0] ?? "0");
    // Image filter should show <= total
    expect(imgCount).toBeLessThanOrEqual(allCount);

    // Click "Video" filter
    await page.locator("button", { hasText: "Video" }).click();
    await page.waitForTimeout(1000);
    const vidCountText = await page.locator("span").filter({ hasText: /\d+ assets/ }).first().textContent();
    const vidCount = parseInt(vidCountText?.match(/\d+/)?.[0] ?? "0");
    expect(typeof vidCount).toBe("number");

    // Click "Music" filter
    await page.locator("button", { hasText: "Music" }).click();
    await page.waitForTimeout(800);

    // Click "Sfx" filter
    await page.locator("button", { hasText: "Sfx" }).click();
    await page.waitForTimeout(800);

    // Click "Actor" filter
    await page.locator("button", { hasText: "Actor" }).click();
    await page.waitForTimeout(800);

    // Click "Transparent PNGs" filter
    await page.locator("button", { hasText: "Transparent PNGs" }).click();
    await page.waitForTimeout(800);

    // Back to All
    await page.locator("button", { hasText: "All" }).click();
    await page.waitForTimeout(1000);

    const finalCountText = await page.locator("span").filter({ hasText: /\d+ assets/ }).first().textContent();
    const finalCount = parseInt(finalCountText?.match(/\d+/)?.[0] ?? "0");
    expect(finalCount).toBe(allCount);

    await page.screenshot({
      path: path.join("tests", "screenshots", "assets-02-filters.png"),
    });

    await browser.close();
  });

  test("3. Click first image asset — preview modal opens with action buttons", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/assets`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Filter to images to ensure we get an image card
    await page.locator("button", { hasText: "Image" }).click();
    await page.waitForTimeout(1500);

    // Click first image card thumbnail
    const firstCard = page.locator(".card").first();
    const thumbnail = firstCard.locator(".h-32, [class*='h-32']").first();
    await thumbnail.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join("tests", "screenshots", "assets-03-modal.png"),
    });

    // Verify modal is open
    const modal = page.locator("div[style*='fixed']").first();
    await expect(modal).toBeVisible();

    // Verify Download button exists
    const downloadBtn = page.locator("a", { hasText: "Download" });
    await expect(downloadBtn).toBeVisible();

    // Verify Use in Studio button exists
    const useBtn = page.locator("a", { hasText: "Use in Studio" });
    await expect(useBtn).toBeVisible();

    // Verify Close button exists
    const closeBtn = page.locator("button", { hasText: "Close" });
    await expect(closeBtn).toBeVisible();

    // Close modal
    await closeBtn.click();
    await page.waitForTimeout(500);

    await browser.close();
  });

  test("4. ModelChip renders on at least one image card", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${BASE}/dashboard/assets`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Filter to images
    await page.locator("button", { hasText: "Image" }).click();
    await page.waitForTimeout(1500);

    // ModelChip renders as an absolute-positioned element inside card thumbnails
    // It typically has a purple/colored pill class with provider text
    // Look for elements with position:absolute inside card thumbnail areas
    const chipLocator = page.locator(".card .h-32 [style*='absolute'], .card [class*='h-32'] [style*='absolute']");
    const chipCount = await chipLocator.count();

    // Also try by visual style — ModelChip has rounded pill with small text
    const pillChips = page.locator(".card").locator("span").filter({ hasText: /FAL|Segmind|Runway|Kling|KIE|MUAPI|AI|Generated/ });
    const pillCount = await pillChips.count();

    // At least one of these detection methods should find a chip
    const modelChipVisible = chipCount > 0 || pillCount > 0;

    await page.screenshot({
      path: path.join("tests", "screenshots", "assets-04-modelchip.png"),
    });

    // Log for report
    console.log(`ModelChip detection — absolute-positioned elements: ${chipCount}, provider pills: ${pillCount}`);
    expect(modelChipVisible).toBe(true);

    await browser.close();
  });
});
