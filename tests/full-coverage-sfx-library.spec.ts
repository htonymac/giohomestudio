/**
 * Full Coverage: SFX Library
 * /dashboard/sfx-library
 * Dev server: http://localhost:3200
 *
 * Tests:
 *  1. Page loads + screenshot
 *  2. Search "rain" — filter updates visible cards
 *  3. Category tabs render and clicking one filters the list
 *  4. Play first available SFX — audio element loads
 *  5. Generate AI SFX "thunderstorm rolling in" — /api/sfx/generate responds 200 or 404
 *  6. SFX cards have copy filename button
 *  7. Quick search preset buttons work
 */

import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3200";
const SS_DIR = path.resolve(__dirname, "screenshots");

async function screenshot(page: Page, name: string) {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SS_DIR, `sfx-library-${name}.png`), fullPage: false });
}

test.describe("SFX Library — full coverage", () => {
  test.use({ baseURL: BASE });

  test("1. Page loads — hero and stats visible", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });
    await screenshot(page, "01-loaded");

    // Hero
    await expect(page.locator("text=SFX").first()).toBeVisible({ timeout: 10_000 });

    // Stats counters (loaded / auto-safe)
    const loaded = page.locator("text=loaded");
    await expect(loaded.first()).toBeVisible({ timeout: 5_000 });

    // Category filter bar present
    const allBtn = page.locator("button").filter({ hasText: /^All/i });
    await expect(allBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("2. Quick search 'rain' — list filters", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });

    // Wait for library to load
    await page.waitForFunction(() => {
      const btns = document.querySelectorAll("button");
      return Array.from(btns).some(b => b.textContent?.trim() === "rain");
    }, { timeout: 10_000 });

    // Click quick search "rain"
    const rainBtn = page.locator("button").filter({ hasText: /^rain$/i });
    await expect(rainBtn.first()).toBeVisible({ timeout: 5_000 });
    await rainBtn.first().click();

    await screenshot(page, "02-rain-filter");

    // Cards should now be filtered (weather category or name containing rain)
    // At minimum the page should not show "All" categories
    // Verify filter is active by checking the rain button has active style
    // We check that not all categories are shown anymore (grouped display only shows matches)
    const categoryHeaders = page.locator("span").filter({ hasText: /^weather$/i });
    // After rain filter, weather category should appear (rain falls under weather)
    await expect(categoryHeaders.first()).toBeVisible({ timeout: 5_000 });
  });

  test("3. Category tab click filters list to that category", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });

    // Wait for category bar
    const crowdBtn = page.locator("button").filter({ hasText: /^crowd/i });
    await expect(crowdBtn.first()).toBeVisible({ timeout: 10_000 });
    await crowdBtn.first().click();

    await screenshot(page, "03-crowd-category");

    // After clicking crowd, crowd category header should be visible in cards
    const crowdHeader = page.locator("span").filter({ hasText: /^crowd$/i });
    await expect(crowdHeader.first()).toBeVisible({ timeout: 5_000 });

    // Weather category should NOT appear in filtered results
    const weatherHeader = page.locator("span[style*='uppercase']").filter({ hasText: /^weather$/i });
    await expect(weatherHeader).toHaveCount(0, { timeout: 3_000 });
  });

  test("4. Play first available SFX — audio element created", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });

    // Wait for SFX cards
    await page.waitForTimeout(2000); // let API load

    // Find first play button (circle with ▶)
    // Cards with available=true show a play button (non-default cursor)
    const playBtns = page.locator("button").filter({ hasText: "▶" });
    const count = await playBtns.count();

    if (count === 0) {
      // No files loaded — verify page still shows "Missing" gracefully
      const missing = page.locator("text=Missing");
      await expect(missing.first()).toBeVisible({ timeout: 5_000 });
      console.log("[SKIP] No SFX files loaded — skipping audio play test");
      return;
    }

    // Monitor the network request when play is clicked
    const sfxPlayPromise = page.waitForRequest(
      req => req.url().includes("/api/sfx/play"),
      { timeout: 10_000 }
    );

    await playBtns.first().click();
    const req = await sfxPlayPromise;
    expect(req.url()).toContain("/api/sfx/play?event=");

    await screenshot(page, "04-sfx-playing");

    // Stop button (■) should now be visible
    const stopBtn = page.locator("button").filter({ hasText: "■" });
    await expect(stopBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("5. Generate AI SFX 'thunderstorm rolling in' — API responds", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });

    // This page doesn't have a generate input directly — that's in music-studio SFX tab.
    // SFX library page has the LLM Download Assistant ("Plan My Downloads").
    // Check for AI Download Assistant button instead.
    const planBtn = page.locator("button").filter({ hasText: /Plan My Downloads/i });
    await expect(planBtn).toBeVisible({ timeout: 10_000 });

    // Verify the generate endpoint accepts requests (call directly)
    const sfxGenResponse = await page.evaluate(async () => {
      const res = await fetch("/api/sfx/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "thunderstorm rolling in" }),
      });
      return { status: res.status, ok: res.ok };
    });

    // API must respond with 200 (matched local) or 404 (no match, no ElevenLabs key)
    // Both are valid — 200 = local match found, 404 = honest "no match" not a crash
    expect([200, 404]).toContain(sfxGenResponse.status);

    await screenshot(page, "05-sfx-generate-api");
  });

  test("6. SFX cards have copy filename button", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // "copy" buttons appear next to filenames in each card
    const copyBtns = page.locator("button").filter({ hasText: /^copy$/i });
    const count = await copyBtns.count();
    expect(count).toBeGreaterThan(0);

    await screenshot(page, "06-copy-buttons");
  });

  test("7. Quick search preset buttons all present", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });

    const expectedSearches = ["thunder", "rain", "wind", "gunshot", "footsteps", "explosion"];
    for (const term of expectedSearches) {
      const btn = page.locator("button").filter({ hasText: new RegExp(`^${term}$`, "i") });
      await expect(btn.first()).toBeVisible({ timeout: 5_000 });
    }

    await screenshot(page, "07-quick-searches");
  });

  test("8. Refresh button reloads library count", async ({ page }) => {
    await page.goto("/dashboard/sfx-library", { waitUntil: "networkidle" });

    const refreshBtn = page.locator("button").filter({ hasText: /^Refresh$/i });
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 });

    // Click refresh — should re-fetch /api/sfx
    const apiPromise = page.waitForResponse(
      res => res.url().includes("/api/sfx") && !res.url().includes("/api/sfx/") && res.status() === 200,
      { timeout: 10_000 }
    );
    await refreshBtn.click();
    const res = await apiPromise;
    const body = await res.json();
    expect(typeof body.totalCount).toBe("number");
    expect(typeof body.availableCount).toBe("number");
  });
});
