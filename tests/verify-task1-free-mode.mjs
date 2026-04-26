// Playwright CDP verify — Task 1: free-mode model selectors
import { chromium } from "playwright";

const BASE = "http://localhost:3200";

(async () => {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  // Screenshot before opening Adv panel
  await page.screenshot({ path: "tests/screenshots/task1-free-mode-before-adv.png", fullPage: false });

  // Click Adv button to reveal model picker
  const advBtn = page.locator("button", { hasText: "Adv" });
  if (await advBtn.count() > 0) {
    await advBtn.click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({ path: "tests/screenshots/task1-free-mode-adv-open.png", fullPage: false });

  // Verify "Generation Models" label exists
  const modelLabel = page.locator("label", { hasText: "Generation Models" });
  const labelVisible = await modelLabel.isVisible().catch(() => false);

  // Verify video model button visible
  const videoModelBtn = page.locator("button").filter({ hasText: /Seedance|Wan|Kling/i }).first();
  const videoModelVisible = await videoModelBtn.isVisible().catch(() => false);

  console.log("Generation Models label visible:", labelVisible);
  console.log("Video model button visible:", videoModelVisible);

  if (labelVisible && videoModelVisible) {
    console.log("TASK 1 PASS: ModelPicker renders in free-mode Adv panel");
  } else {
    console.log("TASK 1 FAIL: ModelPicker not visible");
    process.exit(1);
  }

  await browser.close();
})();
