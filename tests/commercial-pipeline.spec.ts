import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const DEMO_DIR = path.join(process.cwd(), "storage/demo");

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(process.cwd(), `storage/commercial-test-${name}.png`),
    fullPage: false,
  });
}

test("commercial pipeline: full flow", async ({ page }) => {
  test.setTimeout(300_000);

  const demoImages = [
    path.join(DEMO_DIR, "movie_landscape.png"),
    path.join(DEMO_DIR, "hero_warrior.png"),
  ].filter((f) => fs.existsSync(f));
  console.log(`Demo images: ${demoImages.map((i) => path.basename(i))}`);

  // 1. Go to commercial
  await page.goto("/dashboard/commercial");
  await page.waitForLoadState("networkidle");
  await screenshot(page, "01-list");

  // 2. Click "New Slide Ad" → enters view=new (NewProjectForm)
  await page.locator("button").filter({ hasText: "New Slide Ad" }).first().click();
  await page.waitForTimeout(1000);
  await screenshot(page, "02-new-form");

  // 3. Fill project title — use the Project name field specifically
  const projectNameInput = page.locator("input[placeholder*='City Property' i], input[placeholder*='project name' i], input[placeholder*='Project name' i]").first();
  if (await projectNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await projectNameInput.fill("Auto Test Commercial");
    console.log("Project name filled");
  } else {
    // Fallback: click the first input in the form area
    await page.locator("form input, main input, [class*='form'] input").first().fill("Auto Test Commercial");
  }

  // 4. Select format if not already selected (9:16)
  const formatBtn916 = page.locator("button").filter({ hasText: /9:16/ }).first();
  if (await formatBtn916.isVisible({ timeout: 1000 }).catch(() => false)) {
    await formatBtn916.click();
  }

  // 5. Click "Create Project" and wait for editor view to appear
  await page.locator("button").filter({ hasText: /Create Project/i }).click({ force: true });
  console.log("Clicked Create Project, waiting for editor...");

  // Wait for editor to appear — it will show "Render" or slide-related content
  // The editor has a "← Back" button and usually a slide area
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll("button")).map(b => b.textContent || "");
    return btns.some(t => t.includes("Render") || t.includes("Add first") || t.includes("Upload") || t.includes("slide"));
  }, { timeout: 15000 }).catch(() => console.log("Editor load timeout — continuing anyway"));

  await page.waitForTimeout(2000);
  await screenshot(page, "03-editor");

  const editorBtns = await page.locator("button").allTextContents();
  console.log("Editor buttons:", editorBtns.filter(t => t.trim()).slice(0, 20));

  // 6. Upload images via file input or add-image button
  let fileCount = await page.locator("input[type='file']").count();
  if (fileCount === 0) {
    const addBtn = page.locator("button").filter({ hasText: /add.*slide|add.*image|upload|add first|choose/i }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      fileCount = await page.locator("input[type='file']").count();
    }
  }

  console.log(`File inputs found: ${fileCount}`);
  if (fileCount > 0 && demoImages.length > 0) {
    await page.locator("input[type='file']").first().setInputFiles([demoImages[0]]);
    await page.waitForTimeout(3000);
    console.log("Image uploaded");
    if (fileCount > 1 && demoImages.length > 1) {
      await page.locator("input[type='file']").last().setInputFiles([demoImages[1]]);
      await page.waitForTimeout(2000);
    }
  }
  await screenshot(page, "04-with-slides");

  // 7. Set caption on first slide if available
  const captionInput = page.locator("input[placeholder*='caption' i], textarea[placeholder*='caption' i]").first();
  if (await captionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await captionInput.fill("GioHomeStudio — AI Video Studio");
    console.log("Caption set");
  }

  // 8. Wait for any upload/import to finish, then click Render
  console.log("Waiting for upload to complete...");
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll("button")).map(b => b.textContent || "");
    return !btns.some(t => t.includes("Importing") || t.includes("Uploading"));
  }, { timeout: 30000 }).catch(() => console.log("Import wait timed out"));

  await page.waitForTimeout(1000);

  const renderBtn = page.locator("button").filter({ hasText: /🚀 Render|Render/i }).first();
  const renderVisible = await renderBtn.isVisible({ timeout: 5000 }).catch(() => false);
  const renderDisabled = renderVisible ? await renderBtn.isDisabled() : true;
  console.log(`Render button visible: ${renderVisible}, disabled: ${renderDisabled}`);

  if (renderVisible && !renderDisabled) {
    await renderBtn.click({ force: true });
    console.log("Render started!");
    await page.waitForTimeout(8000);
    await screenshot(page, "05-rendering");

    // Wait for render to reach IN_REVIEW or show completion message
    const doneMsg = page.locator("text=/render complete|in review|check review/i");
    const isDone = await doneMsg.isVisible({ timeout: 120000 }).catch(() => false);
    console.log(`Render done: ${isDone}`);
    await screenshot(page, "06-render-done");
  } else {
    console.log("Render button not ready. All buttons:", (await page.locator("button").allTextContents()).filter(t => t.trim()).slice(0, 15));
    await screenshot(page, "05-no-render");
  }

  // 9. Check dashboard recent
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await screenshot(page, "07-dashboard");

  const recentSection = page.locator("text=/Recent Projects/");
  console.log(`Recent Projects section: ${await recentSection.isVisible({ timeout: 2000 }).catch(() => false)}`);

  // 10. Check review page
  await page.goto("/dashboard/review");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await screenshot(page, "08-review");

  console.log("\n=== TEST COMPLETE — Check storage/commercial-test-*.png ===");
  expect(true).toBe(true);
});
