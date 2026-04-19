/**
 * GioHomeStudio — InvText AI Story Builder — REAL BROWSER TEST
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";

test("InvText: sad lion story → AI builds slides with moods", async ({ page }) => {
  test.setTimeout(60000);

  await page.goto(BASE);
  await page.waitForSelector("text=Start Creating", { timeout: 15000 });

  // Switch to InvText
  await page.locator('[data-testid="creation-mode"]').selectOption("ghs_invtext");
  await page.waitForTimeout(500);

  // Verify AI build button exists
  const aiBuildBtn = page.locator('[data-testid="invtext-ai-build"]');
  await expect(aiBuildBtn).toBeVisible();
  await expect(aiBuildBtn).toContainText("Build Story");

  // Switch to Standard tier (deterministic, no LLM key needed)
  await page.locator("select").filter({ hasText: "GHS Standard (Free)" }).selectOption("standard");

  // Type Henry's story prompt
  const prompt = page.locator('[data-testid="invtext-prompt"]');
  await prompt.fill("A sad lion walks alone in the savannah. He misses his family. Then he discovers his 8 cubs hiding in the tall grass. Joy fills his heart.");

  await page.screenshot({ path: "test-results/invtext-1-prompt.png" });

  // Click AI Build and wait for it to finish
  await aiBuildBtn.click();
  // Wait until button no longer says "Building..."
  await expect(aiBuildBtn).not.toContainText("Building", { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "test-results/invtext-2-result.png" });

  // Verify scenes were created
  const sceneHeader = page.locator("text=/Scenes \\(\\d+\\)/");
  await expect(sceneHeader).toBeVisible();
  const headerText = await sceneHeader.textContent();
  console.log("Scenes created:", headerText);

  // Should have 4+ scenes (one per sentence)
  const count = parseInt(headerText?.match(/\d+/)?.[0] || "0");
  expect(count).toBeGreaterThanOrEqual(4);

  // Verify the chat shows slide breakdown
  const chatContent = await page.locator(".ovl-anim-fade, [style*='background: rgba']").first().isVisible().catch(() => false);

  // Expand first scene to see the story text
  const expandBtn = page.locator("button", { hasText: "▶" }).first();
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: "test-results/invtext-3-expanded.png" });

  // Check that narration was created
  const narrText = page.locator("text=/narr/i");
  const hasNarr = await narrText.first().isVisible().catch(() => false);
  console.log("Narration entry created:", hasNarr);

  // Switch to Properties and check narration text
  await page.click("text=Properties");
  await page.waitForTimeout(300);
  const narrArea = page.locator('textarea[placeholder*="Write narration"]');
  const narrValue = await narrArea.inputValue().catch(() => "");
  console.log("Narration text:", narrValue.slice(0, 80));
  expect(narrValue.length).toBeGreaterThan(10);

  await page.screenshot({ path: "test-results/invtext-4-narration.png" });

  // Check AI Edit tab for story summary
  await page.click("text=AI Edit");
  await page.waitForTimeout(300);

  // Should show the story title and slide breakdown
  const storyInfo = page.locator("text=/sad|lion|savannah/i").first();
  const storyVisible = await storyInfo.isVisible().catch(() => false);
  console.log("Story info in chat:", storyVisible);

  await page.screenshot({ path: "test-results/invtext-5-chat.png" });

  // Verify the API directly
  const apiRes = await page.request.post(`${BASE.replace("/dashboard/collaborative-editor", "")}/api/video/invtext-story`, {
    data: { prompt: "A brave little turtle crosses the ocean to find a new home", tier: "standard" },
  });
  expect(apiRes.ok()).toBeTruthy();
  const apiData = await apiRes.json();
  console.log("API story:", apiData.story?.title, "-", apiData.story?.slides?.length, "slides");
  console.log("Music mood:", apiData.story?.music_mood);
  console.log("Slide moods:", apiData.story?.slides?.map((s: { mood: string }) => s.mood).join(", "));
  expect(apiData.story.slides.length).toBeGreaterThanOrEqual(3);
  expect(apiData.story.narration_text.length).toBeGreaterThan(20);

  console.log("\n=== INVTEXT STORY TEST COMPLETE ===");
});
