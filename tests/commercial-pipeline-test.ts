import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3200";
const DEMO_DIR = path.join(__dirname, "../storage/demo");
const SCREENSHOTS_DIR = path.join(__dirname, "../storage");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function saveScreenshot(page: any, name: string) {
  const p = path.join(SCREENSHOTS_DIR, `commercial-test-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`[screenshot] ${name} → ${p}`);
}

(async () => {
  // Try to connect to existing debug browser first
  let browser: any;
  let page: any;

  try {
    browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    const ctx = contexts[0] || (await browser.newContext());
    const pages = ctx.pages();
    page = pages.find((p: any) => p.url().includes("localhost")) || (await ctx.newPage());
    console.log("[browser] Connected to debug browser on port 9222");
  } catch (e) {
    console.log("[browser] No debug browser found, launching headless...");
    browser = await chromium.launch({ headless: false, slowMo: 100 });
    const ctx = await browser.newContext();
    page = await ctx.newPage();
  }

  page.setDefaultTimeout(30000);

  try {
    // Step 1: Navigate to commercial page
    console.log("[step 1] Navigating to /dashboard/commercial...");
    await page.goto(`${BASE_URL}/dashboard/commercial`);
    await page.waitForLoadState("networkidle");
    await saveScreenshot(page, "01-loaded");

    // Step 2: Click "New Commercial Project" or similar create button
    console.log("[step 2] Creating new commercial project...");
    // Look for "New" or "Create" button
    const newBtn = page.locator("button").filter({ hasText: /new|create/i }).first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await sleep(1000);
    } else {
      console.log("[step 2] No 'New' button found, looking for other entry...");
      // Maybe there's an inline form or the page has a project list
      const anyBtn = page.locator("button").first();
      console.log("[step 2] First button text:", await anyBtn.textContent());
    }
    await saveScreenshot(page, "02-after-new");

    // Step 3: Fill in project title if prompted
    const titleInput = page.locator("input[placeholder*='title' i], input[placeholder*='name' i], input[placeholder*='project' i]").first();
    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleInput.fill("Test Commercial - Claude Auto");
      const confirmBtn = page.locator("button").filter({ hasText: /create|start|ok|confirm/i }).first();
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
        await sleep(1500);
      }
    }
    await saveScreenshot(page, "03-project-created");

    // Step 4: Add slides — look for add slide / upload button
    console.log("[step 4] Adding slides with demo images...");
    const images = [
      path.join(DEMO_DIR, "movie_landscape.png"),
      path.join(DEMO_DIR, "hero_warrior.png"),
      path.join(DEMO_DIR, "movie_kingdom.png"),
    ].filter((f) => fs.existsSync(f));

    if (images.length === 0) {
      console.log("[warn] No demo images found, using child images...");
      images.push(...[
        path.join(DEMO_DIR, "child_abc.png"),
        path.join(DEMO_DIR, "child_colors.png"),
      ].filter((f) => fs.existsSync(f)));
    }

    console.log(`[step 4] Using ${images.length} images: ${images.map((i) => path.basename(i)).join(", ")}`);

    // Try to find file upload input
    const fileInput = page.locator("input[type='file']").first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(images);
      await sleep(2000);
      console.log("[step 4] Images uploaded via file input");
    } else {
      // Look for "Add Slide" button
      const addSlideBtn = page.locator("button").filter({ hasText: /add slide|add image|upload/i }).first();
      if (await addSlideBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        for (const img of images) {
          await addSlideBtn.click();
          await sleep(500);
          const fileInputAfterClick = page.locator("input[type='file']").last();
          if (await fileInputAfterClick.count() > 0) {
            await fileInputAfterClick.setInputFiles([img]);
            await sleep(1500);
          }
        }
      }
    }
    await saveScreenshot(page, "04-slides-added");

    // Step 5: Add caption text to first slide
    console.log("[step 5] Adding captions...");
    const captionInputs = page.locator("input[placeholder*='caption' i], textarea[placeholder*='caption' i], input[placeholder*='text' i]");
    const captionCount = await captionInputs.count();
    console.log(`[step 5] Found ${captionCount} caption inputs`);
    if (captionCount > 0) {
      await captionInputs.first().fill("Welcome to GioHomeStudio");
      if (captionCount > 1) {
        await captionInputs.nth(1).fill("Cinematic Stories, Powered by AI");
      }
    }
    await saveScreenshot(page, "05-captions-added");

    // Step 6: Click Render
    console.log("[step 6] Clicking Render...");
    const renderBtn = page.locator("button").filter({ hasText: /render|generate|create video|export/i }).first();
    if (await renderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await renderBtn.click();
      console.log("[step 6] Render clicked!");
      await sleep(3000);
    } else {
      console.log("[step 6] No Render button found — checking page structure...");
      const allBtns = await page.locator("button").allTextContents();
      console.log("[step 6] All buttons:", allBtns.join(", "));
    }
    await saveScreenshot(page, "06-after-render-click");

    // Step 7: Wait for render to start (look for progress indicator)
    console.log("[step 7] Waiting for render progress...");
    const progressIndicator = page.locator("[class*='progress'], [class*='spinner'], [class*='loading'], text=/rendering|processing|generating/i");
    const renderStarted = await progressIndicator.isVisible({ timeout: 10000 }).catch(() => false);
    if (renderStarted) {
      console.log("[step 7] Render is in progress!");
    } else {
      console.log("[step 7] No progress indicator found — render may have started or failed silently");
    }
    await saveScreenshot(page, "07-render-progress");

    // Step 8: Check review page for the rendered item
    console.log("[step 8] Navigating to review page...");
    await page.goto(`${BASE_URL}/dashboard/review`);
    await page.waitForLoadState("networkidle");
    await sleep(2000);
    await saveScreenshot(page, "08-review-page");

    const reviewItems = await page.locator("[class*='content-item'], [class*='review-item'], article, .card").count();
    console.log(`[step 8] Review page has ${reviewItems} items visible`);

    // Step 9: Check if commercial content appears
    const commercialItems = page.locator("text=/commercial|Test Commercial/i");
    const commercialCount = await commercialItems.count();
    console.log(`[step 9] Found ${commercialCount} commercial items on review page`);
    await saveScreenshot(page, "09-final");

    console.log("\n=== COMMERCIAL PIPELINE TEST COMPLETE ===");
    console.log("Screenshots saved in storage/commercial-test-*.png");
    console.log("Check storage/commercial-test-09-final.png for final state");

  } catch (err) {
    console.error("[ERROR]", err);
    await saveScreenshot(page, "error");
    process.exit(1);
  } finally {
    // Don't close the browser if it was the debug browser
  }
})();
