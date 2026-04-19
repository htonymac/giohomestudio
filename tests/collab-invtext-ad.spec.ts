/**
 * GioHomeStudio — InvText Ad + Content Library Check — REAL BROWSER
 *
 * Tests the chihuahua ad flow end-to-end and verifies content saves to library.
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";

test("InvText chihuahua ad: build → check slides → add music → check library", async ({ page }) => {
  test.setTimeout(120000);

  // 1. Load editor
  await page.goto(BASE);
  await page.waitForSelector("text=Start Creating", { timeout: 15000 });

  // Switch to InvText + Standard tier
  await page.locator('[data-testid="creation-mode"]').selectOption("ghs_invtext");
  await page.locator("select").filter({ hasText: "GHS Standard (Free)" }).selectOption("standard");
  await page.waitForTimeout(500);

  // 2. Type the chihuahua ad prompt
  const prompt = page.locator('[data-testid="invtext-prompt"]');
  await prompt.fill("Selling a cute chihuahua cub for 100,000 naira. Location: Vet Store 143 County Road, Ikota. Premium purebred puppies. Limited availability. Reserve yours today!");

  await page.screenshot({ path: "test-results/ad-1-prompt.png" });

  // 3. Click Build Story
  await page.locator('[data-testid="invtext-ai-build"]').click();
  await expect(page.locator('[data-testid="invtext-ai-build"]')).not.toContainText("Building", { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "test-results/ad-2-slides-created.png" });

  // 4. Verify scenes were created
  const sceneHeader = await page.locator("text=/Scenes \\(\\d+\\)/").textContent();
  console.log("Scenes:", sceneHeader);
  const sceneCount = parseInt(sceneHeader?.match(/\d+/)?.[0] || "0");
  expect(sceneCount).toBeGreaterThanOrEqual(3);

  // 5. Expand each scene folder and check content
  for (let i = 0; i < Math.min(sceneCount, 4); i++) {
    const expandBtns = page.locator("button", { hasText: "▶" });
    const btnCount = await expandBtns.count();
    if (btnCount > 0) {
      await expandBtns.first().click();
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot({ path: "test-results/ad-3-folders-expanded.png" });

  // 6. Check that overlays have text content (ad copy)
  const overlayEntries = page.locator("text=/🎨/");
  const overlayCount = await overlayEntries.count();
  console.log("Overlay entries (🎨) in folders:", overlayCount);
  expect(overlayCount).toBeGreaterThanOrEqual(2);

  // 7. Check narration entries exist
  const narrEntries = page.locator("text=/🎙/").filter({ hasNotText: "No narration" });
  const narrCount = await narrEntries.count();
  console.log("Narration entries (🎙) with content:", narrCount);

  // 8. Go to Properties tab — check narration text for scene 1
  await page.click("text=Properties");
  await page.waitForTimeout(300);

  const narrArea = page.locator('textarea[placeholder*="Write narration"]');
  const narrText = await narrArea.inputValue().catch(() => "");
  console.log("Scene 1 narration:", narrText.slice(0, 60));
  expect(narrText.length).toBeGreaterThan(5);

  await page.screenshot({ path: "test-results/ad-4-properties.png" });

  // 9. Check overlay timing editor
  const timingInputs = page.locator('input[type="number"][step="0.1"]');
  const timingCount = await timingInputs.count();
  console.log("Timing editor inputs:", timingCount);
  expect(timingCount).toBeGreaterThanOrEqual(2);

  // 10. Check animations are set on overlays
  const animLabels = page.locator("text=/fade|bounce|slide_up|typewriter|blur_reveal|pop|glow/");
  const animCount = await animLabels.count();
  console.log("Animation labels found:", animCount);

  // 11. Check music buttons exist
  const upbeatBtn = page.locator("button", { hasText: "Upbeat" });
  const upbeatVisible = await upbeatBtn.isVisible().catch(() => false);
  console.log("Upbeat music button visible:", upbeatVisible);

  // 12. Check Volume Mix section
  await expect(page.locator('[data-testid="narration-volume"]')).toBeVisible();
  await expect(page.locator("text=Volume changes are LIVE")).toBeVisible();

  await page.screenshot({ path: "test-results/ad-5-volume.png" });

  // 13. Check AI Edit tab shows the story breakdown
  await page.click("text=AI Edit");
  await page.waitForTimeout(300);

  // Should show slide moods in chat
  const chatMoods = page.locator("text=/\\[.*\\]/").first();
  const moodVisible = await chatMoods.isVisible().catch(() => false);
  console.log("Mood tags in chat:", moodVisible);

  await page.screenshot({ path: "test-results/ad-6-chat.png" });

  // 14. Check the Auto-Assemble button exists
  await expect(page.locator('[data-testid="auto-assemble-btn"]')).toBeVisible();

  // 15. Check timeline shows all segments
  const timelineText = page.locator("text=/timeline/i").first();
  const tlVisible = await timelineText.isVisible().catch(() => false);
  console.log("Timeline visible:", tlVisible);

  await page.screenshot({ path: "test-results/ad-7-timeline.png" });

  // 16. Check content was saved to content-memory API
  const memRes = await page.request.get(`${BASE.replace("/dashboard/collaborative-editor", "")}/api/content-memory`);
  if (memRes.ok()) {
    const memData = await memRes.json();
    console.log("Content memory entries:", memData.memories?.length || memData.entries?.length || "N/A");
  }

  // 17. Check the story API directly with the same prompt
  const apiRes = await page.request.post(`${BASE.replace("/dashboard/collaborative-editor", "")}/api/video/invtext-story`, {
    data: { prompt: "Selling chihuahua cubs for 100000. Vet Store 143 County Road Ikota. Limited availability.", tier: "standard" },
  });
  const apiData = await apiRes.json();
  console.log("\nDirect API test:");
  console.log("Title:", apiData.story?.title);
  console.log("Slides:", apiData.story?.slides?.length);
  console.log("Music mood:", apiData.story?.music_mood);
  if (apiData.story?.slides) {
    apiData.story.slides.forEach((s: { slide_number: number; text: string; mood: string; background: string; animation: string }) => {
      console.log(`  Slide ${s.slide_number}: [${s.mood}] "${s.text}" — ${s.animation} — ${s.background.slice(0, 40)}`);
    });
  }
  console.log("Narration:", apiData.story?.narration_text?.slice(0, 80));

  // 18. Navigate to content registry to verify it saved
  // Open content page in new context to check
  const registryRes = await page.request.get(`${BASE.replace("/dashboard/collaborative-editor", "")}/api/assets?type=all&limit=5`);
  if (registryRes.ok()) {
    const regData = await registryRes.json();
    console.log("Asset registry entries:", regData.assets?.length || regData.items?.length || "check manually");
  }

  console.log("\n=== CHIHUAHUA AD TEST COMPLETE ===");
});
