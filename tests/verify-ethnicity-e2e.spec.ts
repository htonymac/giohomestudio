// End-to-end browser test: open hybrid planner, start a new project, paste the
// Black-inventor story, click Expand with AI, then check what the Characters tab
// actually shows.

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const TEST_STORY = `Two inventors named Alex and Ben work together. Both are Black men in their late 20s with dark brown skin and short curly hair. They build flying machines in a small workshop. One day their newest invention takes flight for the first time.`;

test.setTimeout(240_000);

test("ethnicity-e2e", async ({ page }) => {
  const logs: string[] = [];
  const reqs: Array<{ method: string; url: string; body?: unknown; status?: number; respPreview?: string }> = [];

  page.on("request", req => {
    const u = req.url();
    if (/character-extract|story-expand|saved-state/.test(u)) {
      let body;
      try { body = JSON.parse(req.postData() || "{}"); } catch { body = req.postData()?.slice(0, 200); }
      reqs.push({ method: req.method(), url: u.replace("http://localhost:3200", ""), body });
    }
  });
  page.on("response", async res => {
    const u = res.url();
    if (/character-extract|story-expand/.test(u) && res.status() === 200) {
      const last = reqs[reqs.length - 1];
      if (last && last.url === u.replace("http://localhost:3200", "")) {
        last.status = res.status();
        try {
          const j = await res.json();
          last.respPreview = JSON.stringify(j).slice(0, 1500);
        } catch { /* ignore */ }
      }
    }
  });

  // 1. Open hybrid planner
  await page.goto("http://localhost:3200/dashboard/hybrid-planner");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  logs.push(`[1] landed at ${page.url()}`);

  // 2. Click New Project
  await page.getByRole("button", { name: /^New Project$/i }).first().click();
  await page.waitForTimeout(2000);
  logs.push("[2] clicked New Project");

  // 3. Dismiss style picker modal — pick Realistic
  const realisticBtn = page.locator('text=/^Realistic$/i').first();
  if (await realisticBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await realisticBtn.click();
    await page.waitForTimeout(800);
    logs.push("[3] picked Realistic style");
  }
  // Dismiss anything else
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  // 4. Click STORY tab
  const storyTab = page.locator('button, a').filter({ hasText: /^STORY$|^Story$/ }).filter({ hasNotText: /Bank/i }).first();
  await storyTab.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  logs.push("[4] switched to Story tab");

  await page.screenshot({ path: path.join(process.cwd(), "tests", "e2e-1-story-tab.png"), fullPage: true });

  // 5. Find the largest visible textarea (the story idea field) and fill it
  const textareas = await page.locator("textarea").all();
  let storyFilled = false;
  for (const ta of textareas) {
    if (!(await ta.isVisible())) continue;
    const box = await ta.boundingBox();
    if (box && box.height > 60) {
      await ta.click({ force: true });
      await ta.fill(TEST_STORY);
      storyFilled = true;
      logs.push(`[5] filled story textarea (${box.width}x${box.height})`);
      break;
    }
  }
  if (!storyFilled) {
    logs.push("[5] FAILED — no suitable textarea");
    throw new Error("No story textarea found");
  }

  await page.screenshot({ path: path.join(process.cwd(), "tests", "e2e-2-story-filled.png"), fullPage: true });

  // 6. Click "Expand with AI" — text variations possible
  const expandBtn = page.locator('button').filter({ hasText: /expand.*ai|expand with/i }).first();
  await expandBtn.waitFor({ state: "visible", timeout: 10000 });
  await expandBtn.click();
  logs.push("[6] clicked Expand with AI — waiting for character-extract response");

  // 7. Wait for character-extract response
  const extractResp = await page.waitForResponse(
    resp => /character-extract/.test(resp.url()) && resp.status() === 200,
    { timeout: 180_000 }
  );
  const extractJson = await extractResp.json();
  logs.push(`[7] character-extract returned ${extractJson.characterCount || 0} characters`);
  for (const c of (extractJson.characters || [])) {
    logs.push(`    ${c.name} | id=${c.characterId} | skinTone="${c.skinTone || ""}" | colorDesc="${c.colorDescription || ""}" | visDesc="${(c.visualDescription || "").slice(0, 80)}"`);
  }

  await page.waitForTimeout(3000);

  // 8. Switch to Characters tab and see what's shown
  const charTab = page.locator('button, a').filter({ hasText: /^CHARACTERS$|^Characters$/ }).first();
  await charTab.click().catch(() => {});
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(process.cwd(), "tests", "e2e-3-characters-tab.png"), fullPage: true });

  // 9. Read the Visual: text rendered in the UI for each character
  const visualTexts = await page.locator('text=/Visual:/i').all();
  logs.push(`[9] found ${visualTexts.length} 'Visual:' rows in UI`);
  for (let i = 0; i < visualTexts.length; i++) {
    const parent = visualTexts[i].locator('xpath=ancestor::*[1]');
    const t = await parent.innerText().catch(() => "");
    logs.push(`    Visual[${i}]: ${t.slice(0, 250).replace(/\s+/g, " ")}`);
  }

  // 10. Write the report
  const report = [
    "===== E2E ETHNICITY TEST =====",
    "",
    "=== Step log ===",
    ...logs,
    "",
    "=== Network calls ===",
    ...reqs.map(r => `${r.method} ${r.url} [${r.status || "?"}]${r.respPreview ? "\n  resp: " + r.respPreview : ""}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(process.cwd(), "tests", "e2e-report.txt"), report);

  // Print to test output
  console.log(report);

  // Assertion: visualDescription should contain "dark brown" or "African" or "melanated"
  const hasEthnicity = (extractJson.characters || []).every(
    (c: { visualDescription?: string; colorDescription?: string; skinTone?: string }) =>
      /\b(dark|brown|african|melanated|black)\b/i.test(
        [c.visualDescription, c.colorDescription, c.skinTone].filter(Boolean).join(" ")
      )
  );
  expect(hasEthnicity, "Every character should have dark/brown/African in skin fields").toBe(true);
});
