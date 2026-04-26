// Quick diagnostic: find Teddy & Dog project in localStorage
import { test, chromium } from "@playwright/test";

test("Find Teddy project in localStorage", async () => {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes("localhost:3200")) || context.pages()[0];

  await page.goto("http://localhost:3200/dashboard/hybrid-planner");
  await page.waitForLoadState("networkidle");

  // Dump all relevant localStorage keys
  const lsData = await page.evaluate(() => {
    const result: Record<string, { size: number; preview: string; scenes?: number }> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || "";
      if (key.includes("ghs") || key.includes("hybrid") || key.includes("proj")) {
        try {
          const parsed = JSON.parse(val);
          result[key] = {
            size: val.length,
            preview: val.slice(0, 200),
            scenes: Array.isArray(parsed.scenes) ? parsed.scenes.length : undefined,
          };
        } catch {
          result[key] = { size: val.length, preview: val.slice(0, 200) };
        }
      }
    }
    return result;
  });

  console.log("localStorage keys with 'ghs/hybrid/proj':");
  for (const [key, info] of Object.entries(lsData)) {
    console.log(`  ${key}: ${info.size} bytes, scenes=${info.scenes ?? "N/A"}`);
    if (info.scenes && info.scenes > 0) {
      console.log(`    PREVIEW: ${info.preview}`);
    }
  }
});
