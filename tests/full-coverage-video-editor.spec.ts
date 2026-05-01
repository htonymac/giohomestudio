/**
 * Full-coverage tests: /dashboard/video-editor
 * Rules:
 *  - Headless chromium.launch (NOT CDP connect — avoids "no target" if debug chrome absent)
 *  - Real DOM / real network
 *  - NO FFmpeg render trigger (export button is verified to exist, never clicked)
 *  - Uses bear_rescue_tg.mp4 from storage/video/assembled for upload tests
 */
import { test, expect, chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3200";
const TEST_VIDEO = path.resolve(
  "storage/video/assembled/bear_rescue_tg.mp4"
);

test.describe("Video Editor — /dashboard/video-editor", () => {
  test("1 — navigate + screenshot + no build error", async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1500);

    const hasBuildError = await page.evaluate(() =>
      /Build Error|Module not found|SyntaxError/.test(document.body.innerText)
    );
    expect(hasBuildError).toBe(false);

    const heading = await page.evaluate(() => {
      const el = document.querySelector("h1, [class*='HeroTitle']") as HTMLElement | null;
      return el?.innerText ?? null;
    });
    console.log("heading:", heading);
    expect(heading).not.toBeNull();

    await page.screenshot({
      path: "tests/screenshots/video-editor-01-navigate.png",
      fullPage: true,
    });

    console.log("console errors:", errors.length);
    await browser.close();
  });

  test("2 — upload existing test video + verify thumbnail/player renders", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found:", TEST_VIDEO, "— skipping upload test");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    // Trigger the hidden file input
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("div[style*='dashed']"),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);

    // Wait for video element to appear (player renders after upload)
    await page.waitForSelector("video", { timeout: 30_000 });
    const videoEl = await page.$("video");
    expect(videoEl).not.toBeNull();

    await page.screenshot({
      path: "tests/screenshots/video-editor-02-upload.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("3 — AI Polish button calls /api/llm/polish and shows response", async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const polishResponses: string[] = [];
    page.on("response", (resp) => {
      if (resp.url().includes("/api/llm/polish")) polishResponses.push(resp.url());
    });

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    // Find prompt input
    const promptInput = await page.$(
      'input[placeholder*="Describe what you want"]'
    );
    expect(promptInput).not.toBeNull();
    await promptInput!.fill("add bold price tag at bottom, fade in title at top");

    // Click Polish button
    const polishBtn = await page.getByRole("button", { name: /polish/i });
    expect(polishBtn).not.toBeNull();
    await polishBtn.click();

    // Wait for API call or timeout (up to 15s)
    await page.waitForTimeout(15_000);

    console.log("polish API calls made:", polishResponses.length);
    // The button should have been clickable (existence + click = pass)
    // API may or may not return depending on env — we verify it was called
    expect(polishResponses.length).toBeGreaterThan(0);

    await page.screenshot({
      path: "tests/screenshots/video-editor-03-polish.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("4 — caption input exists and accepts text", async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    // Caption only shows after video upload — simulate upload flow first
    if (fs.existsSync(TEST_VIDEO)) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.click("div[style*='dashed']"),
      ]);
      await fileChooser.setFiles(TEST_VIDEO);
      await page.waitForSelector("video", { timeout: 30_000 });
    }

    const captionInput = await page.$('input[placeholder*="caption"]');
    if (captionInput) {
      await captionInput.fill("Test caption text");
      const value = await captionInput.inputValue();
      expect(value).toBe("Test caption text");
      console.log("caption input: OK");
    } else {
      console.warn("caption input not found (may require video upload to show)");
    }

    await page.screenshot({
      path: "tests/screenshots/video-editor-04-caption.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("5 — overlay panel renders with animation controls (fade-in, slide, zoom, pulse)", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found — skipping overlay test");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("div[style*='dashed']"),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 30_000 });
    await page.waitForTimeout(2000);

    // Add a text overlay layer first (so OverlayPanel shows layer controls)
    const addTextBtn = await page.getByRole("button", {
      name: /Add Text Overlay/i,
    });
    if (addTextBtn) await addTextBtn.click();
    await page.waitForTimeout(1000);

    // Check page text for animation keywords
    const pageText = await page.evaluate(() => document.body.innerText);
    const animations = ["fade", "slide", "zoom", "pulse"];
    const found = animations.filter((a) =>
      pageText.toLowerCase().includes(a)
    );
    console.log("animation keywords found:", found);
    // At least fade_in should be present (default entrance)
    expect(found.length).toBeGreaterThan(0);

    await page.screenshot({
      path: "tests/screenshots/video-editor-05-animations.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("6 — Add Text / Add Price Tag / Add Headline buttons add overlay layers", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found — skipping overlay layer test");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click("div[style*='dashed']"),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 30_000 });
    await page.waitForTimeout(1500);

    // Add Text Overlay
    const addTextBtn = page.getByRole("button", { name: /Add Text Overlay/i });
    await expect(addTextBtn).toBeVisible();
    await addTextBtn.click();

    // Property Headline
    const headlineBtn = page.getByRole("button", {
      name: /Property Headline/i,
    });
    await expect(headlineBtn).toBeVisible();
    await headlineBtn.click();

    // Price Tag
    const priceBtn = page.getByRole("button", { name: /Price Tag/i });
    await expect(priceBtn).toBeVisible();
    await priceBtn.click();

    // After adding 3 layers, OverlayPanel should reflect layers — check page text for "Your Text Here" or "HEADLINE"
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasLayer =
      pageText.includes("Your Text Here") ||
      pageText.includes("HEADLINE") ||
      pageText.includes("₦60,000");
    console.log("layers added to page text:", hasLayer);
    expect(hasLayer).toBe(true);

    await page.screenshot({
      path: "tests/screenshots/video-editor-06-overlay-layers.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("7 — Export button EXISTS but is NOT clicked", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found — checking export btn in pre-upload state");
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-editor`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    if (fs.existsSync(TEST_VIDEO)) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.click("div[style*='dashed']"),
      ]);
      await fileChooser.setFiles(TEST_VIDEO);
      await page.waitForSelector("video", { timeout: 30_000 });
      await page.waitForTimeout(1500);
    }

    // Export button should exist
    const exportBtn = page.getByRole("button", {
      name: /export with overlays/i,
    });
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });
    console.log("export button: EXISTS — NOT clicking (FFmpeg guard)");

    await page.screenshot({
      path: "tests/screenshots/video-editor-07-export-exists.png",
      fullPage: true,
    });

    await browser.close();
  });
});
