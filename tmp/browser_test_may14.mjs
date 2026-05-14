import { chromium } from "playwright";

(async () => {
  const browser = await chromium.connectOverCDP("http://localhost:9222").catch(() => null);
  const ctx = browser 
    ? browser.contexts()[0] 
    : (await chromium.launch({ headless: false })).newContext();
  
  const page = browser 
    ? (await browser.contexts()[0].pages())[0] || await browser.contexts()[0].newPage()
    : await ctx.newPage();

  // Go to hybrid planner with a fresh project
  await page.goto("http://localhost:3200/dashboard/hybrid-planner?projectId=browser_test_may14", { waitUntil: "networkidle", timeout: 30000 });
  await page.screenshot({ path: "tmp/test01_loaded.png" });
  
  // Check what's visible
  const title = await page.title();
  const storyInput = await page.locator("textarea").first().isVisible().catch(() => false);
  const sceneCards = await page.locator("[data-scene-id], .scene-card").count().catch(() => 0);
  
  console.log(JSON.stringify({ title, storyInputVisible: storyInput, sceneCards }));
  await page.screenshot({ path: "tmp/test02_state.png" });
  
  await browser?.close?.();
  process.exit(0);
})();
