// fix-ghost-videos.spec.ts
// Connects to user's real Chrome via CDP, finds BEAR RECUE DOG project,
// clears ghost sceneVideos/sceneVideoVersions, reloads the scene board.

import { chromium } from "@playwright/test";
import { test, expect } from "@playwright/test";

test("Clear ghost videos from BEAR RECUE DOG project", async () => {
  const browser = await chromium.connectOverCDP("http://localhost:9222");

  // List all contexts and pages to find the right tab
  let targetPage = null;
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      const url = p.url();
      console.log("Tab:", url);
      if (url.includes("localhost:3200")) {
        targetPage = p;
      }
    }
  }

  if (!targetPage) {
    // Create new page and navigate
    const ctx = browser.contexts()[0] || await browser.newContext();
    targetPage = await ctx.newPage();
    await targetPage.goto("http://localhost:3200/dashboard/hybrid-planner", { waitUntil: "domcontentloaded", timeout: 30000 });
    await targetPage.waitForTimeout(3000);
  }

  const page = targetPage;
  await page.bringToFront();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "playwright-screenshots/ghost-fix-before.png" });

  // Dump all localStorage keys to diagnose
  const lsData = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      const val = localStorage.getItem(key) || "";
      result[key] = val.length > 200 ? val.slice(0, 200) + "..." : val;
    }
    return result;
  });

  console.log("localStorage keys found:", Object.keys(lsData));
  for (const [k, v] of Object.entries(lsData)) {
    if (k.includes("ghs_hybrid")) {
      console.log(`  ${k}:`, v.slice(0, 150));
    }
  }

  // Fix: clear sceneVideos from ALL ghs_hybrid_proj_ entries that have videos
  const fixResult = await page.evaluate(() => {
    const PREFIX = "ghs_hybrid_proj_";
    const activeKey = localStorage.getItem("ghs_hybrid_active_proj");
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    const report: string[] = [];
    let fixed = 0;

    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        const title = data.projectTitle || "Untitled";
        const videoCount = Object.keys(data.sceneVideos || {}).length;
        report.push(`${title}: ${videoCount} videos (active: ${key === activeKey ? "YES" : "no"})`);

        // Clear if this is the active project OR if it has BEAR/RESCUE in title
        const isBear = title.toUpperCase().includes("BEAR") || title.toUpperCase().includes("RESCUE") || title.toUpperCase().includes("RECUE");
        const isActive = key === activeKey;

        if ((isBear || isActive) && videoCount > 0) {
          data.sceneVideos = {};
          data.sceneVideoVersions = {};
          localStorage.setItem(key, JSON.stringify(data));
          fixed++;
          report.push(`  → CLEARED`);
        }
      } catch (e) { report.push(`  ERROR on ${key}: ${e}`); }
    }

    return { report, fixed, activeKey };
  });

  console.log("Fix result:", fixResult);

  if (fixResult.fixed === 0) {
    console.log("⚠ No videos found to clear. Checking STORAGE_KEY fallback...");
    // Try legacy STORAGE_KEY
    const legacyFix = await page.evaluate(() => {
      const raw = localStorage.getItem("ghs_hybrid_planner");
      if (!raw) return "no legacy key";
      const data = JSON.parse(raw);
      const count = Object.keys(data.sceneVideos || {}).length;
      if (count > 0) {
        data.sceneVideos = {};
        data.sceneVideoVersions = {};
        localStorage.setItem("ghs_hybrid_planner", JSON.stringify(data));
        return `cleared ${count} videos from legacy key`;
      }
      return `legacy key has no videos`;
    });
    console.log("Legacy fix:", legacyFix);
  }

  // Reload page to apply changes
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  // Navigate to Scene Board tab
  try {
    await page.locator("text=Scene Board").first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  } catch { console.log("Could not click Scene Board tab"); }

  await page.screenshot({ path: "playwright-screenshots/ghost-fix-after.png" });

  const videoReadyCount = await page.locator("text=Video ready").count();
  console.log(`"Video ready" labels after fix: ${videoReadyCount}`);

  await browser.close();
  expect(videoReadyCount).toBe(0);
});
