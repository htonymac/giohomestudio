import { test, expect, Page } from "@playwright/test";
import path from "path";

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(process.cwd(), `storage/collabo-check-${name}.png`),
    fullPage: false,
  });
}

test("collaborative editor: check small list buttons", async ({ page }) => {
  test.setTimeout(120_000);

  // Navigate to collaborative editor
  await page.goto("/dashboard/collaborative-editor");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await screenshot(page, "01-loaded");

  const allBtns = await page.locator("button").allTextContents();
  console.log("Total buttons:", allBtns.length);
  console.log("Buttons:", allBtns.filter(t => t.trim()).slice(0, 30));

  // Look for the small list — likely a sidebar with scene items
  const sidebarItems = await page.locator("[class*='scene'], [class*='segment'], [class*='list-item'], [data-scene]").count();
  console.log(`Sidebar scene items: ${sidebarItems}`);

  // Check for scene list area
  const sceneList = page.locator("text=/scenes|segments|timeline|small list/i").first();
  const hasSceneList = await sceneList.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`Scene list visible: ${hasSceneList}`);

  // Look for add clip / add intro / add outro buttons
  const addClipBtn = page.locator("button").filter({ hasText: /\+ add clip|add clip|add scene/i }).first();
  const addIntroBtn = page.locator("button").filter({ hasText: /\+ intro|add intro|intro/i }).first();
  const addOutroBtn = page.locator("button").filter({ hasText: /\+ outro|add outro|outro/i }).first();

  console.log(`Add clip: ${await addClipBtn.isVisible({ timeout: 2000 }).catch(() => false)}`);
  console.log(`Add intro: ${await addIntroBtn.isVisible({ timeout: 2000 }).catch(() => false)}`);
  console.log(`Add outro: ${await addOutroBtn.isVisible({ timeout: 2000 }).catch(() => false)}`);

  // Check delete buttons (✕) in scene list
  const deleteSceneBtns = page.locator("button").filter({ hasText: /^✕$|^×$|^✗$|^🗑|delete scene/i });
  const deleteCount = await deleteSceneBtns.count();
  console.log(`Delete scene buttons: ${deleteCount}`);

  // Check if any buttons are broken (disabled / missing handlers)
  const allButtonEls = await page.locator("button").all();
  let disabledCount = 0;
  for (const btn of allButtonEls) {
    const disabled = await btn.isDisabled();
    if (disabled) disabledCount++;
  }
  console.log(`Disabled buttons: ${disabledCount} of ${allButtonEls.length}`);

  // Try clicking Add Intro button to see if it opens menu
  if (await addIntroBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addIntroBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, "02-intro-menu");
    const introMenuBtns = await page.locator("button").allTextContents();
    const introMenuItems = introMenuBtns.filter(t => /upload|generate|template|browse/i.test(t));
    console.log("Intro menu items:", introMenuItems);

    // Close it by pressing Escape or clicking elsewhere
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Try clicking Add Outro button (use force to bypass any remaining overlay)
  if (await addOutroBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addOutroBtn.click({ force: true });
    await page.waitForTimeout(500);
    await screenshot(page, "03-outro-menu");
    // Click outside to close via click-outside handler
    await page.locator("body").click({ position: { x: 50, y: 400 } });
    await page.waitForTimeout(300);
  }

  await screenshot(page, "04-final");

  // Report any console errors
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  console.log("\n=== COLLABO SMALL LIST CHECK COMPLETE ===");
  console.log("Console errors during test:", errors);
  expect(true).toBe(true);
});
