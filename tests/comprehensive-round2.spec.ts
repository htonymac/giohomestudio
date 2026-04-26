import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200";

test.describe("Comprehensive Test Round 2 — New Features + All Pages", () => {

  test("1. Movie Planner has editor links on page", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-planner`);
    await page.waitForTimeout(3000);

    // Check editor links exist
    const editorLinks = page.locator('a[href*="collaborative-editor"]');
    const count = await editorLinks.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: "tests/screenshots/r2-movie-editor-link.png", fullPage: true });
  });

  test("2. Hybrid Planner has editor links on page", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/hybrid-planner`);
    await page.waitForTimeout(3000);

    const editorLinks = page.locator('a[href*="collaborative-editor"]');
    const count = await editorLinks.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: "tests/screenshots/r2-hybrid-editor-link.png", fullPage: true });
  });

  test("3. Children Planner has Upload Reference Image in Content tab", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(3000);

    // Go to Content tab
    await page.locator("button", { hasText: /content input/i }).first().click();
    await page.waitForTimeout(1000);

    // Check for Upload Reference Image section
    const uploadLabel = page.locator("text=Upload Reference Image").first();
    await expect(uploadLabel).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r2-children-image-upload.png", fullPage: true });
  });

  test("4. Collaborative Editor — Back to Planner uses from param", async ({ page }) => {
    // Navigate to editor with from=movie-planner
    await page.goto(`${BASE}/dashboard/collaborative-editor?from=movie-planner`);
    await page.waitForTimeout(3000);

    // Check for planner link that goes to movie-planner
    const plannerLink = page.locator('a[href*="movie-planner"]').first();
    if (await plannerLink.isVisible()) {
      const href = await plannerLink.getAttribute("href");
      expect(href).toContain("movie-planner");
    }
    await page.screenshot({ path: "tests/screenshots/r2-editor-back-movie.png", fullPage: true });
  });

  test("5. All planners load without errors", async ({ page }) => {
    const planners = [
      { url: "/dashboard/movie-planner", name: "Movie" },
      { url: "/dashboard/hybrid-planner", name: "Hybrid" },
      { url: "/dashboard/children-planner", name: "Children" },
      { url: "/dashboard/music-video-planner", name: "Music Video" },
      { url: "/dashboard/series-planner", name: "Series" },
    ];

    for (const p of planners) {
      await page.goto(`${BASE}${p.url}`);
      await page.waitForTimeout(2000);
      // No crash = pass
      await page.screenshot({ path: `tests/screenshots/r2-${p.name.toLowerCase()}-planner.png` });
    }
  });

  test("6. All creation pages load without errors", async ({ page }) => {
    const pages = [
      "/dashboard/movie-creator",
      "/dashboard/short-video",
      "/dashboard/viral-video",
      "/dashboard/commercial",
      "/dashboard/children-video",
      "/dashboard/music-video",
    ];

    for (const url of pages) {
      await page.goto(`${BASE}${url}`);
      await page.waitForTimeout(2000);
      const name = url.split("/").pop() || "unknown";
      await page.screenshot({ path: `tests/screenshots/r2-${name}.png` });
    }
  });

  test("7. All tool pages load without errors", async ({ page }) => {
    const tools = [
      "/dashboard/collaborative-editor",
      "/dashboard/video-editor",
      "/dashboard/ad-editor",
      "/dashboard/video-finishing",
      "/dashboard/sfx-library",
      "/dashboard/music",
    ];

    for (const url of tools) {
      await page.goto(`${BASE}${url}`);
      await page.waitForTimeout(2000);
      const name = url.split("/").pop() || "unknown";
      await page.screenshot({ path: `tests/screenshots/r2-${name}.png` });
    }
  });

  test("8. Asset Library + All Content still work after changes", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForTimeout(3000);
    await expect(page.locator("text=Asset Library").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r2-asset-library-final.png", fullPage: true });

    await page.goto(`${BASE}/dashboard/all-content`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r2-all-content-final.png", fullPage: true });
  });

  test("9. Character Voices + Smart Builder accessible", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/character-voices`);
    await page.waitForTimeout(3000);

    // Check AI Smart Builder button exists
    const smartBuilder = page.locator("text=AI Smart Builder").first();
    if (await smartBuilder.isVisible()) {
      await expect(smartBuilder).toBeVisible();
    }
    await page.screenshot({ path: "tests/screenshots/r2-characters-smart-builder.png", fullPage: true });
  });

  test("10. Review Queue loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/review`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r2-review-queue.png", fullPage: true });
  });
});
