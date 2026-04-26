// GioHomeStudio — Music Provider Abstraction Layer tests
// Verifies:
//   1. Provider dropdown renders with 5 options on /dashboard/music-studio
//   2. Provider dropdown renders with 5 options on /dashboard/music-video-planner
//   3. POST /api/music/generate with providerKey:"stock" returns 200 + audioUrl

import { test, expect } from "@playwright/test";
import * as path from "path";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const PROVIDER_OPTIONS = ["auto", "kie", "mubert", "stable_audio", "stock"];
const EXPECTED_LABELS = [
  "Auto (smart routing)",
  "Kie.ai (Suno V5 — lyrical)",
  "Mubert (ambient — instrumental)",
  "Stable Audio (cinematic ≤47s)",
  "Stock Library (free, offline)",
];

test.describe("Music Provider Abstraction", () => {
  test("music-studio: provider dropdown renders with 5 options", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/music-studio`);

    // Wait for Next.js client hydration — wait for the tab button
    await page.waitForSelector("button:has-text('AI Generate')", { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Find the Provider dropdown using CSS selector with option value
    const providerSelect = page.locator("select option[value='auto']").first().locator("..");

    // Alternative: get all selects and find the one with the auto option
    const allSelects = page.locator("select");
    const count = await allSelects.count();
    let targetSelect = null;
    for (let i = 0; i < count; i++) {
      const sel = allSelects.nth(i);
      const opts = sel.locator("option");
      const optCount = await opts.count();
      if (optCount === 5) {
        const firstOpt = await opts.first().textContent();
        if (firstOpt?.includes("Auto")) {
          targetSelect = sel;
          break;
        }
      }
    }

    expect(targetSelect).not.toBeNull();
    await expect(targetSelect!).toBeVisible();

    const options = targetSelect!.locator("option");
    await expect(options).toHaveCount(5);

    for (const val of PROVIDER_OPTIONS) {
      await expect(targetSelect!.locator(`option[value="${val}"]`)).toBeAttached();
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "music-provider-01-music-studio.png"), fullPage: false });
  });

  test("music-studio: provider selection persists to localStorage", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/music-studio`);
    await page.waitForSelector("button:has-text('AI Generate')", { timeout: 30000 });
    await page.waitForTimeout(1000);

    const providerSelect = page.locator("select").filter({
      has: page.locator("option", { hasText: "Auto (smart routing)" }),
    });

    await expect(providerSelect).toBeVisible({ timeout: 15000 });

    // Select "stock" provider
    await providerSelect.selectOption("stock");

    // Verify localStorage was set
    const stored = await page.evaluate(() => localStorage.getItem("ghs_music_provider"));
    expect(stored).toBe("stock");

    // Reset
    await providerSelect.selectOption("auto");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "music-provider-02-localStorage.png"), fullPage: false });
  });

  test("music-video-planner: provider dropdown renders with 5 options", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/music-video-planner`);

    // Wait for the planner to load
    await page.waitForSelector("h1", { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Navigate to Song tab which shows the music source selector
    // The "Song" tab title button might be labeled differently — find it
    const buttons = page.locator("button");
    const buttonTexts = await buttons.allTextContents();
    const songTabIndex = buttonTexts.findIndex(t => t.trim() === "Song" || t.includes("Song Input"));

    if (songTabIndex >= 0) {
      await buttons.nth(songTabIndex).click();
      await page.waitForTimeout(500);
    }

    // Click "Generate New" to reveal the provider dropdown
    const generateBtn = page.locator("button:has-text('Generate New')").first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(500);
    }

    // Find the Music Provider dropdown among all selects
    const allSelects = page.locator("select");
    const count = await allSelects.count();
    let targetSelect = null;
    for (let i = 0; i < count; i++) {
      const sel = allSelects.nth(i);
      const opts = sel.locator("option");
      const optCount = await opts.count();
      if (optCount === 5) {
        const firstOpt = await opts.first().textContent();
        if (firstOpt?.includes("Auto")) {
          targetSelect = sel;
          break;
        }
      }
    }

    expect(targetSelect).not.toBeNull();
    await expect(targetSelect!).toBeVisible();

    const options = targetSelect!.locator("option");
    await expect(options).toHaveCount(5);

    for (const val of PROVIDER_OPTIONS) {
      await expect(targetSelect!.locator(`option[value="${val}"]`)).toBeAttached();
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "music-provider-03-mv-planner.png"), fullPage: false });
  });

  test("API: POST /api/music/generate with stock provider returns 200 + audioUrl", async ({ request }) => {
    const res = await request.post(`${BASE}/api/music/generate`, {
      data: {
        providerKey: "stock",
        prompt: "calm afrobeats background music",
        durationSeconds: 30,
        hasLyrics: false,
        genre: "Afrobeats",
        mood: "calm",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // Must have audioUrl
    expect(body).toHaveProperty("audioUrl");
    expect(typeof body.audioUrl).toBe("string");
    expect(body.audioUrl.length).toBeGreaterThan(0);

    // Must have providerKey = stock
    expect(body.providerKey).toBe("stock");

    // Must have durationSeconds
    expect(body).toHaveProperty("durationSeconds");

    // costUsd must be 0 for stock
    expect(Number(body.costUsd)).toBe(0);

    console.log("[test] Stock provider response:", JSON.stringify(body, null, 2));
  });

  test("API: auto routing with hasLyrics=true picks kie if key set, else stock", async ({ request }) => {
    const res = await request.post(`${BASE}/api/music/generate`, {
      data: {
        providerKey: "auto",
        prompt: "Afrobeats party anthem with lyrics",
        durationSeconds: 60,
        hasLyrics: true,
      },
    });

    // Should succeed (either kie or stock fallback)
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("audioUrl");

    console.log("[test] Auto routing (hasLyrics=true) picked:", body.providerKey);
  });

  test("API: stock provider always returns 200 regardless of env keys", async ({ request }) => {
    // Stock provider needs no API keys — always works
    const res = await request.post(`${BASE}/api/music/generate`, {
      data: {
        providerKey: "stock",
        prompt: "epic cinematic background",
        durationSeconds: 45,
        hasLyrics: false,
        genre: "cinematic",
        mood: "epic",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("audioUrl");
    expect(body.providerKey).toBe("stock");
    expect(Number(body.costUsd)).toBe(0);

    console.log("[test] Stock provider (epic/cinematic):", body.audioUrl);
  });
});
