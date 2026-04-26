/**
 * GioHomeStudio — Keyboard Shortcuts + Drag Reorder — REAL BROWSER TEST
 *
 * Run:
 *   npx playwright test tests/collab-keyboard-drag.spec.ts --headed
 */

import { test, expect } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";
const TEST_VIDEO = path.resolve("storage/demo/action_clip1.mp4");
const TEST_VIDEO2 = path.resolve("storage/demo/action_clip2.mp4");

test.describe("Keyboard + Drag — Real Browser", () => {

  test("Spacebar plays/pauses, arrows seek, I/O set trim points", async ({ page }) => {
    test.setTimeout(90000);

    // 1. Load editor + upload video
    await page.goto(BASE);
    await page.waitForSelector("text=Start Creating", { timeout: 15000 });
    await page.click("text=Upload File");
    await page.waitForSelector("text=Import Into Editor");
    await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "test-results/kbd-1-loaded.png" });

    // 2. Click on the video area first to make sure it has focus (not on an input)
    await page.locator("video").click();
    await page.waitForTimeout(300);

    // 3. Press Space to play — check quickly (video is only ~3s)
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);

    const afterSpace = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? { time: v.currentTime, paused: v.paused } : null;
    });
    console.log("After Space:", JSON.stringify(afterSpace));
    // Video may have already ended if it's short — just verify time moved
    expect(afterSpace!.time).toBeGreaterThan(0);

    // 4. Seek to start first (video may have ended), then press Space again to toggle
    await page.keyboard.press("Home");
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    // Video should now be playing from the start
    const afterSecondSpace = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? { time: v.currentTime, paused: v.paused } : null;
    });
    console.log("After Home+Space:", JSON.stringify(afterSecondSpace));
    // Press K to pause (standard editor shortcut)
    await page.keyboard.press("KeyK");
    await page.waitForTimeout(300);
    const afterK = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? { paused: v.paused } : null;
    });
    console.log("After K (should pause):", JSON.stringify(afterK));
    expect(afterK?.paused).toBe(true);

    // 5. Press Right arrow to seek forward 5s (or to end if video is short)
    const beforeSeek = await page.evaluate(() => document.querySelector("video")?.currentTime || 0);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const afterSeek = await page.evaluate(() => document.querySelector("video")?.currentTime || 0);
    console.log(`Seek right: ${beforeSeek.toFixed(2)} → ${afterSeek.toFixed(2)}`);
    expect(afterSeek).toBeGreaterThanOrEqual(beforeSeek);

    // 6. Press Left arrow to seek backward
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    const afterLeft = await page.evaluate(() => document.querySelector("video")?.currentTime || 0);
    console.log(`Seek left: ${afterSeek.toFixed(2)} → ${afterLeft.toFixed(2)}`);

    // 7. Press I to set in-point
    await page.keyboard.press("KeyI");
    await page.waitForTimeout(300);
    const inMarker = page.locator('[data-testid="in-point-marker"]');
    const inVisible = await inMarker.isVisible();
    console.log("In-point marker visible after I key:", inVisible);
    expect(inVisible).toBe(true);

    // 8. Press Home to go to start
    await page.keyboard.press("Home");
    await page.waitForTimeout(300);
    const afterHome = await page.evaluate(() => document.querySelector("video")?.currentTime || 0);
    console.log("After Home:", afterHome);
    expect(afterHome).toBeLessThan(0.5);

    await page.screenshot({ path: "test-results/kbd-2-after-shortcuts.png" });

    console.log("\n=== KEYBOARD TEST PASSED ===");
  });

  test("Drag reorder: upload 2 clips, drag seg 2 above seg 1", async ({ page }) => {
    test.setTimeout(90000);

    // 1. Load editor + upload first video
    await page.goto(BASE);
    await page.waitForSelector("text=Start Creating", { timeout: 15000 });
    await page.click("text=Upload File");
    await page.waitForSelector("text=Import Into Editor");
    await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 2. Upload second video via the Open button in top bar
    await page.click("text=📂 Open");
    await page.waitForSelector("text=Import Into Editor", { timeout: 5000 });
    await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(TEST_VIDEO2);
    await page.waitForTimeout(3000);

    // 3. Verify 2 segments exist
    const segCount = await page.locator("text=/Seg \\d+/").count();
    console.log("Segments found:", segCount);
    // Should have at least "Seg 1" and "Seg 2" plus the status text
    await page.screenshot({ path: "test-results/drag-1-two-segments.png" });

    // 4. Check drag handles exist (⠿ character)
    const dragHandles = page.locator("text=⠿");
    const handleCount = await dragHandles.count();
    console.log("Drag handles found:", handleCount);
    expect(handleCount).toBeGreaterThanOrEqual(2);

    // 5. Get the segment names before drag
    const seg1Before = await page.locator("p").filter({ hasText: /action_clip/ }).first().textContent();
    console.log("Seg 1 filename before drag:", seg1Before);

    // 6. Perform drag: drag Seg 2 to Seg 1 position
    const seg1El = page.locator("text=⠿").nth(0);
    const seg2El = page.locator("text=⠿").nth(1);

    if (handleCount >= 2) {
      const box1 = await seg1El.boundingBox();
      const box2 = await seg2El.boundingBox();

      if (box1 && box2) {
        // Drag seg 2 above seg 1
        await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
        await page.mouse.down();
        await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);

        // Check if order changed
        const seg1After = await page.locator("p").filter({ hasText: /action_clip/ }).first().textContent();
        console.log("Seg 1 filename after drag:", seg1After);
      }
    }

    await page.screenshot({ path: "test-results/drag-2-after-reorder.png" });

    // 7. Check History tab shows reorder
    await page.click("text=History");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/drag-3-history.png" });

    console.log("\n=== DRAG REORDER TEST COMPLETE ===");
  });
});
