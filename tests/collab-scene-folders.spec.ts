/**
 * GioHomeStudio — Scene Folders Test — REAL BROWSER
 */
import { test, expect } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";
const TEST_VIDEO = path.resolve("storage/demo/action_clip1.mp4");
const TEST_VIDEO2 = path.resolve("storage/demo/action_clip2.mp4");

test("Scene folders: upload 2 videos, expand folder, verify layers", async ({ page }) => {
  test.setTimeout(90000);

  // 1. Load + upload first video
  await page.goto(BASE);
  await page.waitForSelector("text=Start Creating", { timeout: 15000 });
  await page.click("text=Upload File");
  await page.waitForSelector("text=Import Into Editor");
  await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(TEST_VIDEO);
  await page.waitForSelector("video", { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 2. Upload second video
  await page.click("text=📂 Open");
  await page.waitForSelector("text=Import Into Editor", { timeout: 5000 });
  await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(TEST_VIDEO2);
  await page.waitForTimeout(2000);

  // 3. Check "Scenes (2)" header
  await expect(page.locator("text=Scenes (2)")).toBeVisible();
  await page.screenshot({ path: "test-results/folders-1-two-scenes.png" });

  // 4. Verify scene folder structure — should show layer badges
  const scene1 = page.locator("text=Scene 1").first();
  await expect(scene1).toBeVisible();
  const scene2 = page.locator("text=Scene 2").first();
  await expect(scene2).toBeVisible();

  // 5. Check layer status badges visible (video/narr/music/sfx/text)
  // Each scene should have status badges like "video", "—" (no narr), etc.
  const videoBadge = page.locator("text=video").first();
  await expect(videoBadge).toBeVisible();
  console.log("Video badge visible:", true);

  // 6. Click expand arrow on Scene 1 to open folder
  const expandBtn = page.locator("button", { hasText: "▶" }).first();
  await expandBtn.click();
  await page.waitForTimeout(300);

  // 7. Verify expanded content shows layer details
  await expect(page.locator("text=No narration").first()).toBeVisible();
  await expect(page.locator("text=No music").first()).toBeVisible();
  await expect(page.locator("text=No SFX").first()).toBeVisible();
  await expect(page.locator("text=No overlays").first()).toBeVisible();
  console.log("Expanded folder shows all layer statuses");

  // 8. Verify "Delete scene" button in expanded folder
  await expect(page.locator("text=Delete scene").first()).toBeVisible();

  await page.screenshot({ path: "test-results/folders-2-expanded.png" });

  // 9. Add narration text to scene 1
  await page.click("text=Properties");
  const narrTextarea = page.locator('textarea[placeholder*="Write narration"]');
  await narrTextarea.fill("Hero walks across the battlefield.");
  await page.waitForTimeout(300);

  // 10. Go back and check — narration badge should now show "narr" instead of "—"
  // The scene folder badges update reactively
  await page.screenshot({ path: "test-results/folders-3-with-narration.png" });

  // 11. Drag handle still works
  const dragHandles = page.locator("text=⠿");
  const handleCount = await dragHandles.count();
  console.log("Drag handles in scene folders:", handleCount);
  expect(handleCount).toBeGreaterThanOrEqual(2);

  console.log("\n=== SCENE FOLDER TEST COMPLETE ===");
});
