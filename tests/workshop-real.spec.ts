// REAL Workshop Test — Verify the Hybrid Planner is a WORKSHOP not a wizard
// Must have: Overview tab, Scene Board, Characters, Story, Audio, Assembly
// Must show: progress bars, warnings, resume panel, scene cards as grid
// Must connect: Scene Board → Editor link, Character → Registry link

import { test, expect } from "@playwright/test";

test.describe("Workshop Structure Verification", () => {
  test("Workshop has all 6 tabs visible", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // All 6 workshop tabs must exist (buttons containing these texts)
    await expect(page.locator("button", { hasText: "Overview" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Scene Board" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Characters" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Story" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Audio" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Assembly" }).first()).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/workshop-tabs-all6.png", fullPage: true });
  });

  test("Overview tab shows dashboard with progress and resume", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Should be on Overview by default
    await expect(page.locator("text=Production Progress")).toBeVisible();
    await expect(page.locator("text=Resume")).toBeVisible();
    await expect(page.locator("text=Last Action").first()).toBeVisible();
    await expect(page.locator("text=Next Step").first()).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/workshop-overview.png", fullPage: true });
  });

  test("Tabs are clickable — switch to Scene Board", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Click Scene Board tab
    await page.locator("button", { hasText: "Scene Board" }).first().click();
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.locator("text=No scenes yet")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/workshop-scene-board-empty.png", fullPage: true });
  });

  test("Switch to Characters tab", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.locator("button:has-text('Characters')").click();
    await page.waitForTimeout(500);

    await expect(page.getByText("No characters yet")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/workshop-characters-empty.png", fullPage: true });
  });

  test("Switch to Story & Draft tab — shows story input", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.locator("button:has-text('Story & Draft')").click();
    await page.waitForTimeout(500);

    await expect(page.getByText("Your Story")).toBeVisible();
    await expect(page.getByText("Expand with AI Intelligence")).toBeVisible();

    // Type story
    const textarea = page.locator("textarea").first();
    await textarea.fill("A brave warrior named Tunde walks through a dangerous forest.");

    await page.screenshot({ path: "tests/screenshots/workshop-story-tab.png", fullPage: true });
  });

  test("Switch to Assembly tab — shows readiness gate", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.locator("button", { hasText: "Assembly" }).first().click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Assembly Readiness")).toBeVisible();
    await expect(page.locator("text=Assemble My Scenes")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/workshop-assembly-tab.png", fullPage: true });
  });

  test("Hero banner shows Production Workshop label", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.locator("text=Production Workshop")).toBeVisible();
    await expect(page.locator("text=Hybrid Planner").first()).toBeVisible();

    // Project title input should be visible
    const titleInput = page.locator("input[placeholder='Project Title']");
    await expect(titleInput).toBeVisible();

    // Save button should exist
    await expect(page.locator("button", { hasText: "Save" }).first()).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/workshop-hero-banner.png", fullPage: true });
  });
});

test.describe("Pipeline Connections", () => {
  test("Overview has link to Editor", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const editorLink = page.locator("a[href='/dashboard/collaborative-editor']");
    await expect(editorLink.first()).toBeVisible();
    console.log("Editor link found on Overview");

    await page.screenshot({ path: "tests/screenshots/workshop-editor-link.png", fullPage: true });
  });

  test("Overview has link to Character Registry", async ({ page }) => {
    await page.goto("/dashboard/hybrid-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const charLink = page.locator("a[href='/dashboard/character-voices']");
    await expect(charLink.first()).toBeVisible();
    console.log("Character Registry link found on Overview");
  });
});
