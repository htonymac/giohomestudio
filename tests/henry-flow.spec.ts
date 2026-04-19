import { test, expect } from "@playwright/test";

test("Henry's flow: Movie Planner → Characters → back", async ({ page }) => {
  // 1. Open Movie Planner
  await page.goto("/dashboard/movie-planner");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/screenshots/henry-1-movie-planner.png", fullPage: true });

  // 2. Click Story tab
  await page.locator("button", { hasText: "Story" }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "tests/screenshots/henry-2-movie-story.png", fullPage: true });

  // 3. Scroll down to see full page
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/screenshots/henry-3-movie-scroll.png", fullPage: true });

  // 4. Click Cast tab
  await page.locator("button", { hasText: "Cast" }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/screenshots/henry-4-movie-cast.png", fullPage: true });

  // 5. Look for character links
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/screenshots/henry-5-movie-cast-top.png", fullPage: true });

  // 6. Go to character-voices page
  await page.goto("/dashboard/character-voices");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/screenshots/henry-6-characters-page.png", fullPage: true });

  // 7. Scroll to see character cards
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/screenshots/henry-7-characters-scroll.png", fullPage: true });

  // 8. Look for Export/Send buttons
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/screenshots/henry-8-characters-export.png", fullPage: true });
});
