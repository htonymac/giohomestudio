// Bypass slow LLM — intercept /api/hybrid/character-extract and return a known-good
// response with "dark brown skin" populated. Then check the UI:
//   - Does it display "dark brown" in the Visual: row?
//   - If yes, the client mapping works.
//   - If no, the client mapping is broken (or your browser cache held old code).

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test.use({ headless: true, viewport: { width: 1400, height: 900 } });

const FAKE_EXTRACT_RESPONSE = {
  success: true,
  projectId: null,
  characterCount: 2,
  characters: [
    {
      characterId: "TS_ALEX01ADULTDARK",
      name: "ALEX",
      role: "protagonist",
      gender: "male",
      age: "young_adult",
      voiceId: "pNInz6obpgDQGcFmaJgB",
      voiceName: "Adam",
      dbId: "fake_alex_001",
      visualDescription: "dark brown skin, African features, melanated, late 20s, slim, short curly hair, casual workshop clothes",
      skinTone: "dark brown skin, African features, melanated",
      ageRange: "young_adult",
      colorDescription: "dark brown skin, African features, melanated",
    },
    {
      characterId: "TS_BEN01ADULTDARK",
      name: "BEN",
      role: "protagonist",
      gender: "male",
      age: "young_adult",
      voiceId: "VR6AewLTigWG4xSOukaG",
      voiceName: "Antoni",
      dbId: "fake_ben_001",
      visualDescription: "dark brown skin, African features, melanated, late 20s, athletic build, short curly hair, casual workshop clothes",
      skinTone: "dark brown skin, African features, melanated",
      ageRange: "young_adult",
      colorDescription: "dark brown skin, African features, melanated",
    },
  ],
};

const FAKE_STORY_EXPAND_RESPONSE = {
  success: true,
  expandedSummary: "Two Black inventors named Alex and Ben work in a workshop building flying machines.",
  fullScript: "Black inventors story.",
  characterList: [
    { name: "ALEX", displayName: "ALEX", roleType: "protagonist", gender: "male", ageRange: "young_adult", skinTone: "dark brown skin, African features, melanated" },
    { name: "BEN",  displayName: "BEN",  roleType: "protagonist", gender: "male", ageRange: "young_adult", skinTone: "dark brown skin, African features, melanated" },
  ],
  scenes: [],
  era: "",
  culture: "",
  genre: "drama",
  tone: "hopeful",
  // Other fields the planner might use
};

test("ui-mapping-with-faked-extract", async ({ page }) => {
  test.setTimeout(60_000);
  const events: string[] = [];
  const log = (m: string) => { events.push(m); console.log(m); };

  // Intercept BOTH endpoints so we don't depend on Ollama at all
  await page.route("**/api/hybrid/story-expand", async route => {
    log("[INTERCEPT] story-expand → returning fake response");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_STORY_EXPAND_RESPONSE) });
  });
  await page.route("**/api/hybrid/character-extract", async route => {
    log("[INTERCEPT] character-extract → returning fake response with dark brown skin");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_EXTRACT_RESPONSE) });
  });
  // Intercept scene-plan so it doesn't hit Ollama either
  await page.route("**/api/hybrid/scene-plan", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, scenes: [], expandedSummary: "", fullScript: "" }) });
  });

  await page.goto("http://localhost:3200/dashboard/hybrid-planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  log(`[1] landed at ${page.url()}`);

  // New project
  await page.getByRole("button", { name: /^New Project$/i }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  log("[2] new project");

  // Dismiss style modal
  const styleOptions = await page.locator('button, div[role="button"]').filter({ hasText: /^Realistic$/i }).all();
  if (styleOptions.length) { await styleOptions[0].click({ force: true }); await page.waitForTimeout(800); }
  await page.keyboard.press("Escape").catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  // Story tab
  await page.locator('button, a').filter({ hasText: /^STORY$|^Story$/ }).filter({ hasNotText: /Bank/i }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log("[3] story tab");

  // Fill textarea
  let filled = false;
  for (const ta of await page.locator("textarea").all()) {
    if (!(await ta.isVisible())) continue;
    const box = await ta.boundingBox();
    if (box && box.height > 60) {
      await ta.click({ force: true });
      await ta.fill("Two Black inventors Alex and Ben.");
      filled = true;
      log("[4] filled story");
      break;
    }
  }
  if (!filled) throw new Error("No story textarea");
  await page.waitForTimeout(500);

  // Click Expand AI (will hit our interceptor → returns instantly)
  await page.locator('button').filter({ hasText: /expand.*ai|expand with/i }).first().click();
  log("[5] clicked Expand AI");
  await page.waitForTimeout(5000);  // give React time to update state
  await page.screenshot({ path: path.join(process.cwd(), "tests", "mapping-1-after-expand.png"), fullPage: true });

  // Planner's Characters tab (NOT the sidebar Character Studio).
  // The planner tab strip is at the bottom with checkmark icons.
  // We target by the strip's specific tab text patterns: "✓ Characters" or "Characters" within a horizontal tab bar.
  const plannerCharTab = page.locator('button').filter({ hasText: /^(✓\s*)?Characters$/i }).last();
  await plannerCharTab.click({ timeout: 5000, force: true }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(process.cwd(), "tests", "mapping-2-characters-tab.png"), fullPage: true });

  // Read what the UI shows
  const visualRows = await page.locator('text=/Visual:/i').all();
  log(`[6] found ${visualRows.length} Visual: rows in UI`);
  const uiTexts: string[] = [];
  for (const row of visualRows) {
    const parent = row.locator('xpath=..');
    const text = (await parent.innerText().catch(() => "")).replace(/\s+/g, " ");
    uiTexts.push(text);
    log(`     ${text.slice(0, 300)}`);
  }

  // Verdict
  const uiHasDark = uiTexts.some(t => /(dark|brown|african|melanated)/i.test(t));
  log(`\nUI shows dark/brown/African somewhere: ${uiHasDark}`);

  if (uiHasDark) {
    log("✓✓✓ MAPPING WORKS — given correct server data, UI displays ethnicity.");
    log("   Henry's issue was browser cache (.next deletion + hard refresh needed).");
  } else {
    log("✗ MAPPING BROKEN — server data correct but UI not displaying it.");
    log("   Bug is in client-side mapping. Need to dig into characters[] state population.");
  }

  fs.writeFileSync(path.join(process.cwd(), "tests", "mapping-report.txt"), events.join("\n"));
  expect(uiHasDark, "UI should show dark/brown/African when server returns it").toBe(true);
});
