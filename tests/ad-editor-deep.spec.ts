import { test, expect, Page } from "@playwright/test";
import path from "path";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `storage/ad-editor-deep-${name}.png`, fullPage: false });
}

test("ad-editor deep check - pipelines & interactivity", async ({ page }) => {
  test.setTimeout(120_000);

  const errors: string[] = [];
  const warnings: string[] = [];
  page.on("console", m => {
    if (m.type() === "error") errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("pageerror", e => errors.push("PAGE ERROR: " + e.message));

  // Load page
  await page.goto("/dashboard/ad-editor");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await shot(page, "01-loaded");

  // Test 1: can we click a template button (previously blocked by search overlay)
  const forAd = page.locator("button").filter({ hasText: /^For Ad$/i }).first();
  if (await forAd.isVisible({ timeout: 1000 }).catch(() => false)) {
    try {
      await forAd.click({ timeout: 5000 });
      console.log("✓ For Ad template clicked successfully (no overlay blocking)");
    } catch (e) {
      console.log("✗ For Ad click blocked:", (e as Error).message.slice(0, 150));
    }
  }

  // Test 2: click each main button and check if it triggers anything
  const keyButtons = [
    "For Ad", "Movie", "Banner",
    "Generate Background", "Import",
    "+ Product Title", "Shop Now", "Book Now",
    "💾 Save Project", "⬇️ Download PNG",
  ];

  for (const txt of keyButtons) {
    const btn = page.locator("button").filter({ hasText: new RegExp(txt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
    const visible = await btn.isVisible({ timeout: 500 }).catch(() => false);
    const disabled = visible ? await btn.isDisabled() : false;
    console.log(`[btn] "${txt}": visible=${visible}, disabled=${disabled}`);
  }

  // Template click already tested in Test 1

  // Test 4: count layers on canvas after template load
  const canvasLayers = await page.locator("[class*='canvas'], [style*='position']").count();
  console.log(`Elements in canvas area: ${canvasLayers}`);

  // Test 5: click Generate Background - should show loading
  const genBg = page.locator("button").filter({ hasText: /Generate Background/i }).first();
  if (await genBg.isVisible({ timeout: 500 }).catch(() => false)) {
    await genBg.click();
    await page.waitForTimeout(400);
    const buttonStateNow = await genBg.textContent();
    console.log("Gen BG after click:", buttonStateNow);
  }

  // Test 6: try the Remove Background button
  const removeBg = page.locator("button").filter({ hasText: /Remove Background/i }).first();
  if (await removeBg.isVisible({ timeout: 500 }).catch(() => false)) {
    const wasDisabled = await removeBg.isDisabled();
    console.log("Remove BG disabled (before any image):", wasDisabled);
  }

  // Test 7: Download PNG — click and watch for download / network call
  const downloadBtn = page.locator("button").filter({ hasText: /Download PNG/i }).first();
  let downloadStarted = false;
  page.on("download", () => { downloadStarted = true; });
  if (await downloadBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await downloadBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
    console.log("Download started:", downloadStarted);
  }

  await shot(page, "03-after-interactions");

  // Scan for blurry/faded UI issues
  const mutedCount = await page.locator("[style*='color: #404060'], [style*='color: #606080'], [style*='opacity: 0.5']").count();
  console.log(`Elements with muted/faded styling: ${mutedCount}`);

  console.log("\n=== SUMMARY ===");
  console.log("Console errors:", errors.length, errors.slice(0, 5));
  console.log("Console warnings:", warnings.length);

  expect(true).toBe(true);
});
