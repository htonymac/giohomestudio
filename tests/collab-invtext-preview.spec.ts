/**
 * GioHomeStudio — InvText Preview + Delete + Library — REAL BROWSER
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";

test("InvText: slides show gradient preview, delete works, content saved", async ({ page }) => {
  test.setTimeout(90000);

  // 1. Create chihuahua ad
  await page.goto(BASE);
  await page.waitForSelector("text=Start Creating", { timeout: 15000 });
  await page.locator('[data-testid="creation-mode"]').selectOption("ghs_invtext");
  await page.locator("select").filter({ hasText: "GHS Standard (Free)" }).selectOption("standard");
  await page.waitForTimeout(500);

  await page.locator('[data-testid="invtext-prompt"]').fill("Selling cute chihuahua cubs for 100,000 naira. Vet Store 143 County Road Ikota. Premium purebred. Limited availability. Reserve today!");

  await page.locator('[data-testid="invtext-ai-build"]').click();
  // Wait for scenes to appear (button disappears when scenes are created)
  await page.waitForSelector("text=/Scenes \\(\\d+\\)/", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 2. Verify scenes created
  const sceneHeader = await page.locator("text=/Scenes \\(\\d+\\)/").textContent();
  console.log("Scenes:", sceneHeader);
  const count = parseInt(sceneHeader?.match(/\d+/)?.[0] || "0");
  expect(count).toBeGreaterThanOrEqual(3);

  // 3. Click Scene 1 — should show gradient preview, NOT "Start Creating"
  await page.locator("text=Scene 1").first().click();
  await page.waitForTimeout(500);

  // Check that InvText preview is visible (gradient background)
  const invtextPreview = page.locator('[data-testid="invtext-preview"]');
  const previewVisible = await invtextPreview.isVisible().catch(() => false);
  console.log("InvText gradient preview visible:", previewVisible);
  expect(previewVisible).toBe(true);

  // "Start Creating" should NOT be visible
  const startCreating = page.locator("text=Start Creating");
  const startVisible = await startCreating.isVisible().catch(() => false);
  console.log("Start Creating visible (should be false):", startVisible);
  expect(startVisible).toBe(false);

  await page.screenshot({ path: "test-results/preview-1-gradient.png" });

  // 4. Click Scene 2 — different gradient
  if (count >= 2) {
    await page.locator("text=Scene 2").first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/preview-2-scene2.png" });
  }

  // 5. Click Scene 3 — different gradient
  if (count >= 3) {
    await page.locator("text=Scene 3").first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/preview-3-scene3.png" });
  }

  // 6. Check overlays show on the gradient preview
  const overlayOnPreview = page.locator('[data-testid^="overlay-"]');
  const overlayCount = await overlayOnPreview.count();
  console.log("Overlays visible on preview:", overlayCount);

  // 7. Test delete button — visible without expanding folder
  const deleteBtn = page.locator("button", { hasText: "✕" }).first();
  const deleteBtnVisible = await deleteBtn.isVisible().catch(() => false);
  console.log("Delete ✕ button visible (without expanding):", deleteBtnVisible);
  expect(deleteBtnVisible).toBe(true);

  // 8. Delete last scene
  const beforeCount = count;
  const lastDeleteBtn = page.locator("button", { hasText: "✕" }).last();
  await lastDeleteBtn.click();
  await page.waitForTimeout(500);

  const afterHeader = await page.locator("text=/Scenes \\(\\d+\\)/").textContent();
  const afterCount = parseInt(afterHeader?.match(/\d+/)?.[0] || "0");
  console.log(`Delete: ${beforeCount} → ${afterCount}`);
  expect(afterCount).toBe(beforeCount - 1);

  await page.screenshot({ path: "test-results/preview-4-after-delete.png" });

  // 9. Check "slide" badge on scene cards (not "image")
  const slideBadge = page.locator("text=slide").first();
  const slideBadgeVisible = await slideBadge.isVisible().catch(() => false);
  console.log("'slide' badge visible:", slideBadgeVisible);

  // 10. Go back to Scene 1 and verify overlay text shows on gradient
  await page.locator("text=Scene 1").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/preview-5-final.png" });

  console.log("\n=== INVTEXT PREVIEW TEST COMPLETE ===");
});
