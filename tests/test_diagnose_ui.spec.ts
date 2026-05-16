/**
 * Diagnostic: print all button texts on each tab so we use correct selectors
 */
import { test, Page } from "@playwright/test";

const BASE = "http://localhost:3200";

async function printButtons(page: Page, label: string) {
  const btns = await page.locator("button").allInnerTexts();
  const cleaned = btns.map(b => b.trim()).filter(b => b.length > 0 && b.length < 60);
  console.log(`\n[${label}] buttons (${cleaned.length}):`);
  cleaned.forEach(b => console.log(`  → "${b}"`));
}

test("Diagnose Hybrid Planner tab buttons", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${BASE}/dashboard/hybrid-planner`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Create new project first
  const newBtn = page.locator("button").filter({ hasText: /new project/i }).first();
  if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Fill a story
  const textarea = page.locator("textarea").first();
  if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textarea.fill("Emeka works in Lagos market. He earns money and feeds his family.");
  }

  // Click each tab and print buttons
  const tabs = ["Story", "Script", "Sound", "Characters", "Scenes", "Assembly", "Overview"];
  for (const tab of tabs) {
    const tabBtn = page.locator("button").filter({ hasText: new RegExp(tab, "i") }).first();
    if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tabBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await printButtons(page, tab);
    }
  }
});
