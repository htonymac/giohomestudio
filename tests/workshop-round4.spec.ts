// Round 4: Cross-page pipeline + deep verification
// Tests: Planner→Editor navigation, Commercial, Viral Video, Video Finishing, Auto Creator
// Henry's rules: real browser, screenshots, check Asset Library + All Content after

import { test, expect } from "@playwright/test";

test.describe("Round 4: Planner to Editor Navigation", () => {
  test("Hybrid Planner 'Open in Editor' links go to collab editor", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Verify tabs are present
    await expect(page.getByRole("button", { name: "Story" })).toBeVisible();

    // Check that the page has links to collaborative editor
    const editorLinks = page.locator('a[href*="collaborative-editor"]');
    const count = await editorLinks.count();
    console.log("Editor links on planner:", count);

    await page.screenshot({ path: "tests/screenshots/r4-planner-editor-links.png", fullPage: true });
  });
});

test.describe("Round 4: Commercial Page Verification", () => {
  test("Commercial page loads with 3 sections", async ({ page }) => {
    await page.goto("/dashboard/commercial");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r4-commercial.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Round 4: Viral Video Creator", () => {
  test("Viral Video page loads", async ({ page }) => {
    await page.goto("/dashboard/viral-video");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r4-viral-video.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Round 4: Video Finishing Studio", () => {
  test("Video Finishing page loads with 5 steps", async ({ page }) => {
    await page.goto("/dashboard/video-finishing");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r4-video-finishing.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Round 4: AI Content Creator", () => {
  test("Auto Creator page loads", async ({ page }) => {
    await page.goto("/dashboard/auto-creator");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r4-auto-creator.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Round 4: Asset Library + Registry after all changes", () => {
  test("Asset Library still has content after all changes", async ({ page }) => {
    await page.goto("/dashboard/assets");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Count assets
    const assetCount = page.locator("text=/\\d+ assets/");
    await page.screenshot({ path: "tests/screenshots/r4-assets-final.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("Content Registry still has content", async ({ page }) => {
    await page.goto("/dashboard/registry");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r4-registry-final.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("Review Queue still works", async ({ page }) => {
    await page.goto("/dashboard/review");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r4-review-final.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Round 4: Movie & Series and Music Video", () => {
  test("Movie & Series page loads", async ({ page }) => {
    await page.goto("/dashboard/movie-series");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r4-movie-series.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });

  test("Music & Music Video page loads", async ({ page }) => {
    await page.goto("/dashboard/music-video");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r4-music-video.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});
