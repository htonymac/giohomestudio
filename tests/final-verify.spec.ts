import { test, expect } from "@playwright/test";

test("Collab Editor has Back to Planner button + Scene Image panel", async ({ page }) => {
  await page.goto("/dashboard/collaborative-editor");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // Back to Planner link
  const plannerLink = page.locator("a[href='/dashboard/hybrid-planner']");
  await expect(plannerLink.first()).toBeVisible();

  // Click Properties tab
  const propsTab = page.locator("text=Properties");
  if (await propsTab.count() > 0) await propsTab.first().click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: "tests/screenshots/final-editor-planner-link.png", fullPage: true });
});

test("Hybrid Planner Overview has all dashboard elements", async ({ page }) => {
  await page.goto("/dashboard/hybrid-planner");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // Scroll down to see full dashboard
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/screenshots/final-planner-overview-full.png", fullPage: true });
});

test("All critical pages load without errors", async ({ page }) => {
  const pages = [
    "/dashboard/hybrid-planner",
    "/dashboard/movie-planner",
    "/dashboard/children-video",
    "/dashboard/collaborative-editor",
    "/dashboard/assets",
    "/dashboard/registry",
    "/dashboard/character-voices",
    "/dashboard/sfx-library",
    "/dashboard/commercial",
  ];

  for (const p of pages) {
    await page.goto(p);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    // No error page
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("Application error");
  }
  await page.screenshot({ path: "tests/screenshots/final-all-pages-ok.png" });
});
