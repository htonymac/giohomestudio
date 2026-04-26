// Playwright test — Auto Time Stamp (SPEC 1)
// Connects to debug Chrome on :9222, drives hybrid-planner, clicks Auto Time Stamp,
// screenshots results. Also tests the API endpoint directly.

import { test, expect, chromium } from "@playwright/test";
import path from "path";

const BASE_URL = "http://localhost:3200";
const SS_DIR = path.join(__dirname, "screenshots");

test.describe("SPEC 1 — Auto Time Stamp", () => {
  test("API /api/timeline/plan returns timed plan", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/timeline/plan`, {
      data: {
        script:
          "The city woke before sunrise. Rain fell softly on the empty streets. A lone figure emerged from the shadows, carrying a worn leather bag. The clock tower chimed five times.",
        mode: "narration",
        targetDuration: 30,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.plan).toBeDefined();
    expect(body.plan.segments.length).toBeGreaterThan(0);
    expect(body.plan.totalDuration).toBeGreaterThan(0);
    // Segments should have required fields
    const seg = body.plan.segments[0];
    expect(seg).toHaveProperty("id");
    expect(seg).toHaveProperty("startTime");
    expect(seg).toHaveProperty("endTime");
    expect(seg).toHaveProperty("duration");
    expect(seg).toHaveProperty("narrationText");
    expect(seg.startTime).toBe(0);
    // All segments durations should sum ≈ totalDuration (within 3s)
    const sumDur = body.plan.segments.reduce((a: number, s: { duration: number }) => a + s.duration, 0);
    expect(Math.abs(sumDur - body.plan.totalDuration)).toBeLessThan(3);
    console.log("[pass] API test — segments:", body.plan.segments.length, "total:", body.plan.totalDuration.toFixed(1) + "s");
  });

  test("API /api/timeline/plan — scene mode", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/timeline/plan`, {
      data: {
        script: "",
        scenes: [
          "Opening: A quiet village at dawn",
          "Rising action: The hero discovers the letter",
          "Climax: The confrontation at the bridge",
          "Resolution: Peace returns to the valley",
        ],
        mode: "scene",
        targetDuration: 40,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.plan.segments.length).toBe(4);
    expect(body.plan.totalDuration).toBeGreaterThan(0);
    console.log("[pass] Scene mode — 4 segments created");
  });

  test("Browser — hybrid-planner Audio tab shows Auto Time Stamp button", async () => {
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    const ctx = contexts[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());

    // Navigate to hybrid-planner
    await page.goto(`${BASE_URL}/dashboard/hybrid-planner`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.screenshot({ path: `${SS_DIR}/auto-timestamp-hybrid-01-loaded.png`, fullPage: false });

    // Click Audio & Shots tab (use role=button to avoid strict mode violation)
    const audioTab = page.getByRole("button", { name: /Audio & Shots/i }).first();
    await expect(audioTab).toBeVisible({ timeout: 10000 });
    await audioTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS_DIR}/auto-timestamp-hybrid-02-audio-tab.png`, fullPage: false });

    // Verify Auto Time Stamp button is present
    const btn = page.getByText("Auto Time Stamp");
    await expect(btn).toBeVisible({ timeout: 5000 });
    console.log("[pass] Auto Time Stamp button visible in Audio & Shots tab");

    // Click it — should work even with empty project (returns warnings, not error)
    await btn.click();
    // Wait for loading state to resolve
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SS_DIR}/auto-timestamp-hybrid-03-after-click.png`, fullPage: false });
    console.log("[pass] Auto Time Stamp button clicked, screenshot saved");

    await browser.close();
  });

  test("Browser — music-video-planner Storyboard tab shows Auto Time Stamp button", async () => {
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    const ctx = contexts[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());

    // Navigate to music-video-planner
    await page.goto(`${BASE_URL}/dashboard/music-video-planner`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.screenshot({ path: `${SS_DIR}/auto-timestamp-mvp-01-loaded.png`, fullPage: false });

    // Navigate to storyboard tab (match the tab button specifically)
    const storyTab = page.getByRole("button", { name: /^Storyboard/ }).first();
    await expect(storyTab).toBeVisible({ timeout: 10000 });
    await storyTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS_DIR}/auto-timestamp-mvp-02-storyboard-tab.png`, fullPage: false });

    // Button should be in the DOM (may be disabled if no storyboard yet)
    const btn = page.locator("button", { hasText: "Auto Time Stamp" });
    await expect(btn).toBeVisible({ timeout: 5000 });
    console.log("[pass] Auto Time Stamp button visible in Storyboard tab");

    await page.screenshot({ path: `${SS_DIR}/auto-timestamp-mvp-03-button.png`, fullPage: false });
    await browser.close();
  });
});
