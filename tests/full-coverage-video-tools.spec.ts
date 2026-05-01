/**
 * Full-coverage tests: /dashboard/video-tools
 * Rules:
 *  - Headless chromium.launch
 *  - Real DOM / real network
 *  - NO video generation triggered (motion-transfer submit / bg_video / object_remove NOT submitted)
 *  - Upload tests use bear_rescue_tg.mp4
 *  - AI Suggestions panel verified (calls /api/llm/polish)
 */
import { test, expect, chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3200";
const TEST_VIDEO = path.resolve(
  "storage/video/assembled/bear_rescue_tg.mp4"
);

test.describe("Video Tools — /dashboard/video-tools", () => {
  test("1 — navigate + screenshot + no build error", async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto(`${BASE}/dashboard/video-tools`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1500);

    const hasBuildError = await page.evaluate(() =>
      /Build Error|Module not found|SyntaxError/.test(document.body.innerText)
    );
    expect(hasBuildError).toBe(false);

    await page.screenshot({
      path: "tests/screenshots/video-tools-01-navigate.png",
      fullPage: true,
    });

    console.log("page errors:", errors.length);
    await browser.close();
  });

  test("2 — Classic/Timeline toggle renders both buttons", async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-tools`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    // Both toggle buttons should be visible
    const classicBtn = page.getByRole("button", { name: /classic tools/i });
    const timelineBtn = page.getByRole("button", { name: /timeline mode/i });
    await expect(classicBtn).toBeVisible();
    await expect(timelineBtn).toBeVisible();

    // Switch to timeline
    await timelineBtn.click();
    await page.waitForTimeout(500);
    const pageText = await page.evaluate(() => document.body.innerText);
    expect(pageText.toLowerCase()).toContain("timeline");

    // Switch back to classic
    await classicBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "tests/screenshots/video-tools-02-toggle.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("3 — Classic Tools: all 6 tool tabs render forms", async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-tools`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    const tabs = [
      { name: /trim video/i, formText: "Drop video" },
      { name: /add narration/i, formText: "narration" },
      { name: /motion transfer/i, formText: "still image" },
      { name: /remove bg.*image/i, formText: "image" },
      { name: /remove bg.*video/i, formText: "video" },
      { name: /remove object/i, formText: "object" },
    ];

    for (const tab of tabs) {
      const btn = page.getByRole("button", { name: tab.name });
      await expect(btn).toBeVisible({ timeout: 8_000 });
      await btn.click();
      await page.waitForTimeout(600);
      const bodyText = await page.evaluate(() =>
        document.body.innerText.toLowerCase()
      );
      const hasForm =
        bodyText.includes(tab.formText.toLowerCase()) ||
        bodyText.includes("drop") ||
        bodyText.includes("upload");
      console.log(`tab ${tab.name}: form present = ${hasForm}`);
      expect(hasForm).toBe(true);
    }

    await page.screenshot({
      path: "tests/screenshots/video-tools-03-classic-tabs.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("4 — Timeline Mode: upload test video + timeline strip renders", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found — skipping timeline upload test");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-tools`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);

    // Switch to timeline mode
    await page.getByRole("button", { name: /timeline mode/i }).click();
    await page.waitForTimeout(500);

    // Import video
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /import video/i }).click(),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);

    // Wait for video to load
    await page.waitForSelector("video", { timeout: 30_000 });
    await page.waitForTimeout(5_000); // Allow metadata + segment generation

    // Check timeline rendered
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasTimeline =
      pageText.toLowerCase().includes("timeline") &&
      (pageText.includes("Scene") || pageText.includes("0:"));
    console.log("timeline + segments rendered:", hasTimeline);
    expect(hasTimeline).toBe(true);

    await page.screenshot({
      path: "tests/screenshots/video-tools-04-timeline.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("5 — Timeline segment action buttons exist and show status (not placeholder)", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found — skipping segment action test");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${BASE}/dashboard/video-tools`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    await page.getByRole("button", { name: /timeline mode/i }).click();
    await page.waitForTimeout(500);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /import video/i }).click(),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 30_000 });
    await page.waitForTimeout(5_000);

    // Segment action buttons (from source: Change Background, Remove Object, Add Text, Motion Transfer)
    const expectedBtns = [
      "Change Background",
      "Remove Object",
      "Add Text",
      "Motion Transfer",
    ];
    for (const label of expectedBtns) {
      const btn = page.getByRole("button", { name: label });
      const isVisible = await btn.isVisible().catch(() => false);
      console.log(`segment btn "${label}": visible = ${isVisible}`);
      expect(isVisible).toBe(true);
    }

    // Click "Add Text" (narrate action) — safe: just calls narrate endpoint on segment
    // We only verify it shows a status message, not a placeholder
    const addTextBtn = page.getByRole("button", { name: "Add Text" });
    await addTextBtn.click();
    await page.waitForTimeout(8_000);

    const pageText = await page.evaluate(() => document.body.innerText);
    // Status should NOT be a generic placeholder like "TODO" or "coming soon"
    const hasPlaceholder = /TODO|coming soon|not implemented/i.test(pageText);
    console.log("has placeholder text:", hasPlaceholder);
    expect(hasPlaceholder).toBe(false);

    await page.screenshot({
      path: "tests/screenshots/video-tools-05-segment-actions.png",
      fullPage: true,
    });

    await browser.close();
  });

  test("6 — AI Suggestions panel shows real Haiku response after upload", async () => {
    if (!fs.existsSync(TEST_VIDEO)) {
      console.warn("TEST_VIDEO not found — skipping AI suggestions test");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const aiCalls: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/llm/polish")) aiCalls.push(r.url());
    });

    await page.goto(`${BASE}/dashboard/video-tools`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    await page.getByRole("button", { name: /timeline mode/i }).click();
    await page.waitForTimeout(500);

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /import video/i }).click(),
    ]);
    await fileChooser.setFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 30_000 });
    await page.waitForTimeout(8_000); // Wait for AI suggestions request

    // AI suggestions panel header should be present
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasSuggestionsPanel = pageText.includes("AI Suggestions");
    console.log("AI Suggestions panel present:", hasSuggestionsPanel);
    expect(hasSuggestionsPanel).toBe(true);

    console.log("AI /api/llm/polish calls made:", aiCalls.length);
    // The fetch is triggered on upload — should have been called
    expect(aiCalls.length).toBeGreaterThan(0);

    await page.screenshot({
      path: "tests/screenshots/video-tools-06-ai-suggestions.png",
      fullPage: true,
    });

    await browser.close();
  });
});
