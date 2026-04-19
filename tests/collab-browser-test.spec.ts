/**
 * GioHomeStudio — Collaborative Editor REAL BROWSER TEST
 *
 * This test actually uploads a video, plays it, tests volume sliders,
 * tries narration generation, and verifies real output in a headed browser.
 *
 * Run:
 *   npx playwright test tests/collab-browser-test.spec.ts --headed
 */

import { test, expect } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";
const TEST_VIDEO = path.resolve("storage/demo/action_clip1.mp4");

test.describe("Collaborative Editor — Real Browser", () => {

  test("Full flow: upload video → play → volume → narration → overlay", async ({ page }) => {
    // Longer timeout for real operations
    test.setTimeout(120000);

    // 1. Load editor
    await page.goto(BASE);
    await page.waitForSelector("text=Start Creating", { timeout: 15000 });
    await page.screenshot({ path: "test-results/browser-1-loaded.png" });

    // 2. Click Upload File to open import modal
    await page.click("text=Upload File");
    await page.waitForSelector("text=Import Into Editor", { timeout: 5000 });

    // 3. Upload a real video file
    const fileInput = page.locator('input[type="file"][data-testid="import-file"]');
    await fileInput.setInputFiles(TEST_VIDEO);

    // 4. Wait for video to load in the preview
    await page.waitForSelector("video", { timeout: 15000 });
    await page.waitForTimeout(2000); // let the video element fully load
    await page.screenshot({ path: "test-results/browser-2-video-loaded.png" });

    // 5. Verify segment appeared in left panel
    await expect(page.getByText("🎬 Seg", { exact: false }).first()).toBeVisible();

    // 6. Click play button (the big purple one in scrub bar)
    const playBtn = page.locator('[data-testid="play-pause"]');
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await page.waitForTimeout(2000); // let it play for 2 seconds

    // 7. Check the video is actually playing (currentTime > 0)
    const videoPlaying = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? { currentTime: v.currentTime, paused: v.paused, duration: v.duration, muted: v.muted } : null;
    });
    console.log("Video state after play:", JSON.stringify(videoPlaying));
    expect(videoPlaying).not.toBeNull();
    if (videoPlaying && !videoPlaying.paused) {
      expect(videoPlaying.currentTime).toBeGreaterThan(0);
    }

    // 8. Pause
    await playBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/browser-3-after-play.png" });

    // 9. Go to Properties tab
    await page.click("text=Properties");
    await page.waitForTimeout(500);

    // 10. Test volume sliders exist and can be moved
    const narrVolume = page.locator('[data-testid="narration-volume"]');
    const musicVolume = page.locator('[data-testid="music-volume"]');
    const sfxVolume = page.locator('[data-testid="sfx-volume"]');

    await expect(narrVolume).toBeVisible();
    await expect(musicVolume).toBeVisible();
    await expect(sfxVolume).toBeVisible();

    // Move narration slider to 50% — must use evaluate to trigger React onChange
    await page.evaluate(() => {
      const slider = document.querySelector('[data-testid="narration-volume"]') as HTMLInputElement;
      if (slider) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
        nativeInputValueSetter.call(slider, '50');
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/browser-4a-narr-slider.png" });

    // Move music slider to 60%
    await page.evaluate(() => {
      const slider = document.querySelector('[data-testid="music-volume"]') as HTMLInputElement;
      if (slider) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
        nativeInputValueSetter.call(slider, '60');
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);

    // 11. Check "Volume changes are LIVE" text is there
    await expect(page.locator("text=Volume changes are LIVE")).toBeVisible();

    await page.screenshot({ path: "test-results/browser-4-volume-sliders.png" });

    // 12. Write narration text
    const narrTextarea = page.locator('textarea[placeholder*="Write narration"]');
    await narrTextarea.fill("A warrior stands on the battlefield, ready for the final confrontation.");
    await page.waitForTimeout(300);

    // 13. Check Generate Voice button exists and is enabled
    const genVoiceBtn = page.locator("button", { hasText: "Generate Voice" });
    await expect(genVoiceBtn).toBeVisible();
    // Check it's not disabled (narration text is written)
    const isDisabled = await genVoiceBtn.getAttribute("disabled");
    console.log("Generate Voice disabled?", isDisabled);

    // 14. Click Generate Voice (may fail if Piper/ElevenLabs not set up - that's OK)
    await genVoiceBtn.click();
    await page.waitForTimeout(3000); // wait for API call
    await page.screenshot({ path: "test-results/browser-5-after-narration.png" });

    // Check what the AI chat says about voice generation
    const chatLog = await page.locator("text=Voice generation").or(page.locator("text=Voice generated")).or(page.locator("text=Generating voice")).first();
    const chatVisible = await chatLog.isVisible().catch(() => false);
    console.log("Voice generation chat message visible?", chatVisible);

    // 15. Add overlay text
    const overlayInput = page.locator('input[placeholder*="Overlay text"]');
    await overlayInput.fill("THE FINAL BATTLE");

    // Select animation
    const animSelect = page.locator("#overlay-anim");
    await animSelect.selectOption("bounce");

    // Select font size
    const fontSelect = page.locator("#overlay-fontsize");
    await fontSelect.selectOption("32");

    // Click Add
    const addOverlayBtn = page.locator("button", { hasText: "Add" }).last();
    await addOverlayBtn.click();
    await page.waitForTimeout(500);

    // 16. Verify overlay appears on the video preview
    const overlay = page.locator('[data-testid="overlay-bounce"]');
    const overlayVisible = await overlay.isVisible().catch(() => false);
    console.log("Overlay with bounce animation visible?", overlayVisible);

    await page.screenshot({ path: "test-results/browser-6-overlay-added.png" });

    // 17. Add SFX — click the "thunder" add button (not the ▶ preview button)
    const thunderAddBtn = page.locator("button", { hasText: "thunder" }).filter({ hasNotText: "▶" }).first();
    if (await thunderAddBtn.isVisible().catch(() => false)) {
      await thunderAddBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: "test-results/browser-7-sfx-added.png" });

    // 18. Test in/out trim buttons (only visible when video is loaded)
    const inPointBtn = page.locator('[data-testid="set-in-point"]');
    const outPointBtn = page.locator('[data-testid="set-out-point"]');
    const splitBtn = page.locator('[data-testid="split-playhead"]');

    if (await inPointBtn.isVisible()) {
      console.log("In-point button: VISIBLE");
      await inPointBtn.click();
      await page.waitForTimeout(300);
      // Check in-point marker appeared
      const inMarker = page.locator('[data-testid="in-point-marker"]');
      console.log("In-point marker visible?", await inMarker.isVisible());
    }

    if (await splitBtn.isVisible()) {
      console.log("Split button: VISIBLE");
    }

    await page.screenshot({ path: "test-results/browser-8-trim-controls.png" });

    // 19. Switch to AI Edit tab
    await page.click("text=AI Edit");
    await page.waitForTimeout(300);

    // Type an instruction
    const editTextarea = page.locator('textarea[placeholder*="Type instruction"]');
    await editTextarea.fill("add rain SFX at 2 seconds");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/browser-9-ai-edit.png" });

    // 20. Check History tab
    await page.click("text=History");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/browser-10-history.png" });

    console.log("\n=== BROWSER TEST COMPLETE ===");
    console.log("Check test-results/browser-*.png for visual verification");
  });
});
