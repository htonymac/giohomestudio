import { test, expect } from "@playwright/test";

test("ad-editor loads with new save/download buttons", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dashboard/ad-editor");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const btns = await page.locator("button").allTextContents();
  const filtered = btns.filter(t => t.trim()).slice(0, 60);
  console.log("Buttons:", filtered);

  const hasSaveProj = filtered.some(t => /Save Project/i.test(t));
  const hasDownload = filtered.some(t => /Download PNG/i.test(t));
  const hasBgRemove = filtered.some(t => /Remove Background.*Birefnet/i.test(t));

  console.log("Save Project btn:", hasSaveProj);
  console.log("Download PNG btn:", hasDownload);
  console.log("Remove BG (Birefnet) btn:", hasBgRemove);

  await page.screenshot({ path: "storage/ad-editor-check.png", fullPage: false });

  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  console.log("Errors:", errors);

  expect(hasSaveProj && hasDownload && hasBgRemove).toBe(true);
});
