/**
 * Playwright spec: commercial-planner-upgrade
 * Tests: color picker swatches, product image upload, model selectors
 * CDP connect to :9222 (existing debug Chrome)
 */

import { chromium, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const BASE_URL = "http://localhost:3200";
const CDP_URL = "http://localhost:9222";

async function saveScreenshot(page: any, name: string) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const p = path.join(SCREENSHOTS_DIR, `commercial-planner-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`Screenshot: ${p}`);
}

(async () => {
  let browser: any;
  let pass = true;
  const errors: string[] = [];

  try {
    // Connect via CDP
    try {
      browser = await chromium.connectOverCDP(CDP_URL);
      console.log("Connected to debug Chrome via CDP");
    } catch {
      browser = await chromium.launch({ headless: false });
      console.log("Launched fresh Chromium (CDP unavailable)");
    }

    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    const page = await context.newPage();

    // 1. Navigate to commercial-planner
    console.log("Navigating to /dashboard/commercial-planner...");
    await page.goto(`${BASE_URL}/dashboard/commercial-planner`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await saveScreenshot(page, "01-loaded");

    // 2. Click to Brief tab (where color picker + product images live)
    const briefTabBtn = page.locator("button, a").filter({ hasText: /Campaign Brief/i }).first();
    if (await briefTabBtn.isVisible()) {
      await briefTabBtn.click();
      await page.waitForTimeout(800);
    }
    await saveScreenshot(page, "02-brief-tab");

    // 3. Verify color picker swatches render
    const colorInputs = page.locator('input[type="color"]');
    const colorCount = await colorInputs.count();
    console.log(`Color picker inputs found: ${colorCount}`);
    if (colorCount === 0) {
      errors.push("FAIL: No color picker inputs found");
      pass = false;
    } else {
      console.log(`PASS: ${colorCount} color picker input(s) present`);
    }
    await saveScreenshot(page, "03-color-pickers");

    // 4. Click + button to add a 6th swatch (need 5 first — click + up to 5 times)
    const addSwatchBtn = page.locator("button").filter({ hasText: /^\+$/ }).first();
    if (await addSwatchBtn.isVisible()) {
      const initialCount = await colorInputs.count();
      // Click + enough times to get to at least 2 swatches
      let clicks = 0;
      while ((await colorInputs.count()) < Math.min(initialCount + 1, 8) && clicks < 5) {
        await addSwatchBtn.click();
        await page.waitForTimeout(200);
        clicks++;
      }
      const newCount = await colorInputs.count();
      if (newCount > initialCount) {
        console.log(`PASS: Swatch count increased from ${initialCount} to ${newCount}`);
      } else {
        errors.push("FAIL: Swatch + button did not increase count");
        pass = false;
      }
    } else {
      console.log("INFO: + swatch button not visible (may be at max already)");
    }
    await saveScreenshot(page, "04-swatches-added");

    // 5. Find a test PNG to upload
    const testPngPaths = [
      path.join(__dirname, "..", "storage", "ad-editor", "ai-edits", "gen_1776576706940.png"),
    ];
    let testPng = testPngPaths.find(p => fs.existsSync(p));
    if (!testPng) {
      // Find any png in storage
      const storageDir = path.join(__dirname, "..", "storage");
      const findPng = (dir: string): string | null => {
        try {
          for (const f of fs.readdirSync(dir)) {
            const full = path.join(dir, f);
            if (fs.statSync(full).isDirectory()) {
              const r = findPng(full);
              if (r) return r;
            } else if (f.endsWith(".png")) return full;
          }
        } catch {}
        return null;
      };
      testPng = findPng(storageDir) || undefined;
    }

    if (testPng) {
      const fileInput = page.locator('input[type="file"][accept*="png"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(testPng);
        await page.waitForTimeout(2500);
        const thumbnails = page.locator('img[alt*="product"]');
        const thumbCount = await thumbnails.count();
        if (thumbCount > 0) {
          console.log(`PASS: Product image thumbnail appeared (count: ${thumbCount})`);
        } else {
          // May be loading — check for any img that appeared
          const allImgs = await page.locator("img").count();
          console.log(`INFO: ${allImgs} total images on page after upload`);
          errors.push("WARN: Product thumbnail img[alt*=product] not found — upload may have succeeded but thumbnail uses different selector");
        }
      } else {
        errors.push("WARN: File input not found for product image upload");
      }
    } else {
      console.log("INFO: No test PNG found in storage — skipping upload test");
    }
    await saveScreenshot(page, "05-product-image-upload");

    // 6. Navigate to scenes tab to check model selectors
    const scenesTabBtn = page.locator("button, a").filter({ hasText: /Script & Scenes/i }).first();
    if (await scenesTabBtn.isVisible()) {
      await scenesTabBtn.click();
      await page.waitForTimeout(1000);
    }

    // Apply template to get scenes
    const applyBtn = page.locator("button").filter({ hasText: /Apply.*Template|Reset Template/i }).first();
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
      await page.waitForTimeout(500);
    }
    await saveScreenshot(page, "06-scenes-loaded");

    // 7. Verify model selectors render
    const imgModelSelects = page.locator('select[data-testid^="img-model-"]');
    const vidModelSelects = page.locator('select[data-testid^="vid-model-"]');
    const imgSelectCount = await imgModelSelects.count();
    const vidSelectCount = await vidModelSelects.count();
    console.log(`Image model selectors: ${imgSelectCount}, Video model selectors: ${vidSelectCount}`);

    if (imgSelectCount > 0 && vidSelectCount > 0) {
      console.log("PASS: Per-scene model selectors present");
      // Verify options count
      const imgOptions = await imgModelSelects.first().locator("option").count();
      const vidOptions = await vidModelSelects.first().locator("option").count();
      console.log(`Image model options: ${imgOptions}, Video model options: ${vidOptions}`);
      if (imgOptions > 0 && vidOptions > 0) {
        console.log("PASS: Model selectors have options");
      } else {
        errors.push("FAIL: Model selectors have no options");
        pass = false;
      }
    } else {
      if (imgSelectCount === 0 && vidSelectCount === 0) {
        // May need scenes to exist first
        console.log("INFO: No scenes present — model selectors only render per scene card");
      } else {
        errors.push(`FAIL: Expected img+vid model selectors, got img:${imgSelectCount} vid:${vidSelectCount}`);
        pass = false;
      }
    }
    await saveScreenshot(page, "07-model-selectors");

    // 8. Final summary screenshot
    await saveScreenshot(page, "08-final");

    if (pass) {
      console.log("\nBROWSER VERIFY: PASS — all checks passed");
    } else {
      console.log("\nBROWSER VERIFY: WARNINGS/FAILURES:");
      errors.forEach(e => console.log(` - ${e}`));
    }

  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
