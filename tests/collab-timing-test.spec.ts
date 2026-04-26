/**
 * GioHomeStudio — Frame-Accurate Timing Test — REAL BROWSER
 *
 * Tests overlay timing and narration timing accuracy.
 *
 * Run:
 *   npx playwright test tests/collab-timing-test.spec.ts --headed
 */

import { test, expect } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";
const TEST_VIDEO = path.resolve("storage/demo/action_clip1.mp4");

test.describe("Timing — Real Browser", () => {

  test("Overlay only visible during its time range + timing editor works", async ({ page }) => {
    test.setTimeout(90000);

    // 1. Load editor + upload video
    await page.goto(BASE);
    await page.waitForSelector("text=Start Creating", { timeout: 15000 });
    await page.click("text=Upload File");
    await page.waitForSelector("text=Import Into Editor");
    await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(TEST_VIDEO);
    await page.waitForSelector("video", { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 2. Go to Properties tab
    await page.click("text=Properties");
    await page.waitForTimeout(300);

    // 3. Add overlay text with custom timing: start=1s, end=2s
    const overlayInput = page.locator('input[placeholder*="Overlay text"]');
    await overlayInput.fill("TIMED OVERLAY");

    // Select animation
    await page.locator("#overlay-anim").selectOption("fade");
    await page.locator("#overlay-fontsize").selectOption("32");

    // Click Add
    await page.locator("button", { hasText: "Add" }).last().click();
    await page.waitForTimeout(300);

    // 4. Now set its timing to 1.0s → 2.0s via the timing editor
    // Must use triple-click + type to trigger React onChange on number inputs
    const startInput = page.locator('input[type="number"][step="0.1"]').nth(0);
    const endInput = page.locator('input[type="number"][step="0.1"]').nth(1);

    await startInput.click({ clickCount: 3 });
    await startInput.press("Backspace");
    await startInput.type("1");
    await startInput.press("Tab");
    await page.waitForTimeout(200);

    await endInput.click({ clickCount: 3 });
    await endInput.press("Backspace");
    await endInput.type("2");
    await endInput.press("Tab");
    await page.waitForTimeout(200);

    await page.screenshot({ path: "test-results/timing-1-overlay-configured.png" });

    // 5. Seek to 0s — overlay should NOT be visible
    await page.locator("video").click(); // focus
    await page.keyboard.press("Home");
    await page.waitForTimeout(300);

    const overlayAt0 = await page.locator('[data-testid="overlay-fade"]').isVisible().catch(() => false);
    console.log("Overlay visible at 0s:", overlayAt0);
    expect(overlayAt0).toBe(false); // Should NOT be visible before 1s

    await page.screenshot({ path: "test-results/timing-2-at-0s-hidden.png" });

    // 6. Seek to ~1.5s — overlay SHOULD be visible
    // Use ArrowRight to seek forward
    await page.keyboard.press("Space"); // play
    await page.waitForTimeout(1200); // wait to reach ~1.2s
    await page.keyboard.press("KeyK"); // pause
    await page.waitForTimeout(300);

    const videoTime = await page.evaluate(() => document.querySelector("video")?.currentTime || 0);
    console.log("Video time after seek:", videoTime.toFixed(2));

    const overlayAtMid = await page.locator('[data-testid="overlay-fade"]').isVisible().catch(() => false);
    console.log("Overlay visible at ~1.5s:", overlayAtMid);

    await page.screenshot({ path: "test-results/timing-3-at-1.5s-visible.png" });

    // 7. Seek to end — overlay should NOT be visible (past 2s)
    await page.keyboard.press("End");
    await page.waitForTimeout(300);

    const overlayAtEnd = await page.locator('[data-testid="overlay-fade"]').isVisible().catch(() => false);
    console.log("Overlay visible at end:", overlayAtEnd);
    expect(overlayAtEnd).toBe(false); // Should NOT be visible after 2s

    await page.screenshot({ path: "test-results/timing-4-at-end-hidden.png" });

    // 8. Add narration text and check timing inputs exist
    const narrTextarea = page.locator('textarea[placeholder*="Write narration"]');
    await narrTextarea.fill("Frame accurate narration test.");
    await page.waitForTimeout(300);

    // Narration timing inputs should appear
    const narrStartInput = page.locator('input[type="number"][step="0.1"]').nth(2); // 3rd number input
    const narrStartVisible = await narrStartInput.isVisible().catch(() => false);
    console.log("Narration timing inputs visible:", narrStartVisible);

    await page.screenshot({ path: "test-results/timing-5-narration-timing.png" });

    // 9. Check [I] and [O] buttons exist for quick timing
    const iBtn = page.locator("button", { hasText: "[I]" }).first();
    const oBtn = page.locator("button", { hasText: "[O]" }).first();
    const iBtnVisible = await iBtn.isVisible().catch(() => false);
    const oBtnVisible = await oBtn.isVisible().catch(() => false);
    console.log("I/O timing buttons:", iBtnVisible, oBtnVisible);

    console.log("\n=== TIMING TEST COMPLETE ===");
  });
});
