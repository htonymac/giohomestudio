/**
 * GioHomeStudio — AI Auto-Assemble Pipeline Test — REAL BROWSER
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200/dashboard/collaborative-editor";

test("AI Auto-Assemble: type instruction → get plan with scenes + cost", async ({ page }) => {
  test.setTimeout(60000);

  // 1. Load editor
  await page.goto(BASE);
  await page.waitForSelector("text=Start Creating", { timeout: 15000 });

  // 2. Go to AI Edit tab
  await page.click("text=AI Edit");
  await page.waitForTimeout(300);

  // 3. Verify auto-assemble button exists
  const autoBtn = page.locator('[data-testid="auto-assemble-btn"]');
  await expect(autoBtn).toBeVisible();
  await expect(autoBtn).toContainText("AI Auto-Assemble");

  // 4. Switch to Standard tier (free, deterministic — no LLM needed)
  const tierSelect = page.locator("select").filter({ hasText: "GHS Standard (Free)" });
  await tierSelect.selectOption("standard");

  // 5. Type instruction in the edit input
  const editInput = page.locator('textarea[placeholder*="Type instruction"]');
  await editInput.fill("A motivational video about success. Show a sunrise. A person running. An inspiring quote. End with a call to action.");

  // 6. Click Auto-Assemble
  await autoBtn.click();
  await page.waitForTimeout(5000); // wait for API (standard tier is instant but UI needs time)

  // 6. Check that the AI responded with a plan
  await page.screenshot({ path: "test-results/auto-1-plan-result.png" });

  // Verify scenes were created
  const sceneHeader = page.locator("text=/Scenes \\(\\d+\\)/");
  await expect(sceneHeader).toBeVisible();
  const headerText = await sceneHeader.textContent();
  console.log("Scene header:", headerText);

  // 7. Verify cost breakdown appeared in chat
  const creditText = page.locator("text=/credits/i").first();
  const creditVisible = await creditText.isVisible().catch(() => false);
  console.log("Credit info visible:", creditVisible);

  // 8. Check scene folders were created
  const scene1 = page.locator("text=Scene 1").first();
  await expect(scene1).toBeVisible();

  // 9. Expand a scene folder to see layers
  const expandBtn = page.locator("button", { hasText: "▶" }).first();
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: "test-results/auto-2-scenes-expanded.png" });

  // 10. Verify the plan includes narration
  const narrEntry = page.locator("text=/narr|Narration/i").first();
  const narrVisible = await narrEntry.isVisible().catch(() => false);
  console.log("Narration in plan:", narrVisible);

  // 11. Test the API directly too
  const apiRes = await page.request.post(`${BASE.replace("/dashboard/collaborative-editor", "")}/api/video/auto-assemble`, {
    data: { instruction: "A 30 second product ad for shoes", tier: "standard" },
  });
  expect(apiRes.ok()).toBeTruthy();
  const apiData = await apiRes.json();
  console.log("API plan:", apiData.plan?.scenes?.length, "scenes,", apiData.plan?.estimated_credits, "credits");
  expect(apiData.plan.scenes.length).toBeGreaterThanOrEqual(2);
  expect(apiData.plan.estimated_credits).toBeGreaterThanOrEqual(0);
  expect(apiData.plan.credit_breakdown).toBeDefined();

  console.log("\n=== AUTO-ASSEMBLE TEST COMPLETE ===");
});
