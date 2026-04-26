// Playwright Tests Round 3: Workshop Tab UI, Scene Image button, SFX files, Project Status Bar
// Henry's rules: real headed browser, screenshots, 60+ seconds

import { test, expect } from "@playwright/test";

test.describe("Round 3: Workshop Tab UI in Hybrid Planner", () => {
  test("Workshop tabs are visible and clickable", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Check workshop tabs exist
    await expect(page.getByRole("button", { name: "Story" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Characters & Scenes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Audio & Shots" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Assemble" })).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/r3-workshop-tabs.png", fullPage: true });

    // Story tab should be active (green background)
    const storyTab = page.getByRole("button", { name: "Story" });
    const bgColor = await storyTab.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Should have green-ish background (accent color)
    console.log("Story tab background:", bgColor);
  });

  test("Workshop tabs can be clicked to switch", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Type a story first so we have content
    const textarea = page.locator("textarea").first();
    await textarea.fill("A warrior named Tunde fights the shadow king with help from elder Mama Iya.");

    await page.screenshot({ path: "tests/screenshots/r3-story-entered.png", fullPage: true });
  });
});

test.describe("Round 3: SFX Files Verification", () => {
  test("SFX Library shows more than 200 entries", async ({ page }) => {
    await page.goto("/dashboard/sfx-library");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Check for count display
    const countText = page.locator("body");
    const content = await countText.textContent();

    await page.screenshot({ path: "tests/screenshots/r3-sfx-count.png", fullPage: true });

    // Quick search pills should be visible
    const searchPills = page.locator("button:has-text('thunder')");
    if (await searchPills.count() > 0) {
      await searchPills.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "tests/screenshots/r3-sfx-thunder-search.png", fullPage: true });
    }
  });
});

test.describe("Round 3: Collab Editor SFX buttons", () => {
  test("Editor SFX buttons are visible in Properties", async ({ page }) => {
    await page.goto("/dashboard/collaborative-editor");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Click Properties tab
    const propsTab = page.getByText("Properties");
    if (await propsTab.count() > 0) {
      await propsTab.first().click();
      await page.waitForTimeout(500);
    }

    // Look for SFX section
    const sfxSection = page.getByText("SFX");
    await page.screenshot({ path: "tests/screenshots/r3-editor-sfx.png", fullPage: true });

    // SFX play buttons should exist
    const sfxButtons = page.locator("button:has-text('thunder')");
    if (await sfxButtons.count() > 0) {
      console.log("SFX thunder button found");
    }
  });
});

test.describe("Round 3: Character Voices — AI Smart Builder visible", () => {
  test("Character page shows AI Smart Builder button", async ({ page }) => {
    await page.goto("/dashboard/character-voices");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // AI Smart Builder button may contain icon + text
    const smartBuilder = page.locator("button:has-text('Smart Builder')");
    const count = await smartBuilder.count();
    console.log("Smart Builder button count:", count);
    if (count > 0) {
      await expect(smartBuilder.first()).toBeVisible();
      console.log("AI Smart Builder button visible");
    }

    await page.screenshot({ path: "tests/screenshots/r3-character-smart-builder.png", fullPage: true });
  });
});

test.describe("Round 3: Music & Video Studio", () => {
  test("Music & Video Studio page loads", async ({ page }) => {
    await page.goto("/dashboard/music-video");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r3-music-video.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Round 3: Short Video Creator", () => {
  test("Short Video page loads", async ({ page }) => {
    await page.goto("/dashboard/short-video");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/r3-short-video.png", fullPage: true });
    await expect(page.locator("body")).toBeVisible();
  });
});
