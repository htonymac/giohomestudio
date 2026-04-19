import { test, expect } from "@playwright/test";

test.describe("Hybrid Planner Workshop", () => {
  test("All 7 tabs visible + Overview dashboard", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await expect(page.locator("button", { hasText: "Overview" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Scene Board" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Characters" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Story" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Audio" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Assembly" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Trends" }).first()).toBeVisible();
    await expect(page.locator("text=Production Progress")).toBeVisible();
    await expect(page.locator("text=Resume")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-hybrid-overview.png", fullPage: true });
  });

  test("Trends tab shows intelligence panel", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.locator("button", { hasText: "Trends" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Online Intelligence")).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Viral Angles").first()).toBeVisible();
    await expect(page.locator("text=Audience Attention").first()).toBeVisible();
    await expect(page.locator("text=Trending Topics").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-hybrid-trends.png", fullPage: true });
  });

  test("Scene Board shows empty state with Write Story button", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.locator("button", { hasText: "Scene Board" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=No scenes yet")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-hybrid-sceneboard.png", fullPage: true });
  });

  test("Story tab has textarea + Expand button", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.locator("button", { hasText: "Story" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Your Story")).toBeVisible();
    await expect(page.locator("text=Expand with AI Intelligence")).toBeVisible();
    const ta = page.locator("textarea").first();
    await ta.fill("A warrior fights the shadow king in a dark forest");
    await page.screenshot({ path: "tests/screenshots/final-hybrid-story.png", fullPage: true });
  });

  test("Assembly tab shows readiness gate", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.locator("button", { hasText: "Assembly" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=Assembly Readiness")).toBeVisible();
    await expect(page.locator("text=Assemble My Scenes")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-hybrid-assembly.png", fullPage: true });
  });
});

test.describe("Movie Planner Workshop", () => {
  test("Overview tab with dashboard + progress", async ({ page }) => {
    await page.goto("/dashboard/movie-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await expect(page.locator("button", { hasText: "Overview" }).first()).toBeVisible();
    await expect(page.locator("text=Production Progress")).toBeVisible();
    await expect(page.locator("text=Resume")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-movie-overview.png", fullPage: true });
  });

  test("Can switch to Story tab", async ({ page }) => {
    await page.goto("/dashboard/movie-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.locator("button", { hasText: "Story" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=your movie about")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-movie-story.png", fullPage: true });
  });
});

test.describe("Children Planner Workshop", () => {
  test("Overview tab with progress", async ({ page }) => {
    await page.goto("/dashboard/children-planner?branch=hybrid&content=Letters&age=2-3&lang=en");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await expect(page.locator("button", { hasText: "Overview" }).first()).toBeVisible();
    await expect(page.locator("text=Children Content Progress")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-children-overview.png", fullPage: true });
  });
});

test.describe("Collab Editor Features", () => {
  test("Back to Planner + Scene Info + Lock + Send to Video", async ({ page }) => {
    await page.goto("/dashboard/collaborative-editor");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    // Back to Planner
    await expect(page.locator("a[href='/dashboard/hybrid-planner']").first()).toBeVisible();
    // Click Properties tab
    const props = page.locator("text=Properties");
    if (await props.count() > 0) await props.first().click();
    await page.waitForTimeout(500);
    // Scene Info section
    await expect(page.locator("text=Scene Info")).toBeVisible();
    await expect(page.locator("text=Lock Scene")).toBeVisible();
    await expect(page.locator("text=Send to Video")).toBeVisible();
    // Scene Image section
    await expect(page.locator("text=Scene Image").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/final-editor-features.png", fullPage: true });
  });
});

test.describe("All Pages Load", () => {
  test("Every critical page loads without error", async ({ page }) => {
    const pages = [
      "/dashboard/hybrid-planner",
      "/dashboard/movie-planner",
      "/dashboard/children-video",
      "/dashboard/children-planner?branch=hybrid&content=Letters&age=2-3&lang=en",
      "/dashboard/collaborative-editor",
      "/dashboard/assets",
      "/dashboard/registry",
      "/dashboard/character-voices",
      "/dashboard/sfx-library",
      "/dashboard/commercial",
      "/dashboard/short-video",
      "/dashboard/viral-video",
      "/dashboard/video-finishing",
      "/dashboard/auto-creator",
      "/dashboard/music-video",
      "/dashboard/review",
    ];
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      const body = await page.locator("body").textContent();
      expect(body).not.toContain("Application error");
      expect(body).not.toContain("Internal Server Error");
    }
    await page.screenshot({ path: "tests/screenshots/final-all-pages.png" });
  });
});
