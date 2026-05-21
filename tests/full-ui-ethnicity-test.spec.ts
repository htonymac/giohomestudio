// FULL UI ETHNICITY TEST — proves where the gap is.
// Drives a fresh Chromium browser through the actual user flow:
//   1. New project → Story tab → paste inventor story → Expand AI
//   2. Capture EXACTLY what /api/hybrid/character-extract returns over the wire
//   3. Open Characters tab → screenshot + read what's rendered in UI
//   4. Compare: if server sent "dark brown" but UI shows "light skin" → client mapping bug
//      If server sent empty/light → server bug
//
// Result file: tests/full-ui-report.txt + tests/full-ui-*.png

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STORY = `Two inventors named Alex and Ben work together. Both are Black men in their late 20s with dark brown skin and short curly hair. They build flying machines in a small workshop. One day their newest invention takes flight for the first time.`;

test.use({ headless: true, viewport: { width: 1400, height: 900 } });

test("ethnicity full UI test", async ({ page }) => {
  test.setTimeout(240_000);

  const events: string[] = [];
  const log = (msg: string) => { events.push(msg); console.log(msg); };

  // Capture extract response
  let extractResp: { skinTone?: string; colorDescription?: string; visualDescription?: string; characterId?: string }[] | null = null;
  page.on("response", async res => {
    if (/character-extract/.test(res.url()) && res.status() === 200) {
      try {
        const j = await res.json();
        extractResp = j.characters || [];
        log(`[NET] character-extract returned ${extractResp?.length} characters`);
        for (const c of (extractResp || [])) {
          log(`     ${(c as { name?: string }).name || "?"}: skinTone="${c.skinTone || ""}" colorDescription="${c.colorDescription || ""}"`);
        }
      } catch { /* ignore */ }
    }
  });

  // ── 1. Open planner ──
  await page.goto("http://localhost:3200/dashboard/hybrid-planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  log(`[1] landed at ${page.url()}`);

  // ── 2. Click New Project ──
  const newBtn = page.getByRole("button", { name: /^New Project$/i }).first();
  await newBtn.click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  log("[2] clicked New Project");

  // ── 3. Dismiss style picker modal ──
  // Look for any clickable style option (Realistic / 3D / etc.)
  const styleOptions = await page.locator('button, div[role="button"], [onclick]').filter({ hasText: /^(Realistic|3D Cinematic|Storybook|Nollywood)$/i }).all();
  if (styleOptions.length > 0) {
    log(`[3] style picker has ${styleOptions.length} options — picking first (Realistic)`);
    await styleOptions[0].click({ force: true });
    await page.waitForTimeout(1500);
  }
  // Press Escape twice in case there's still a modal
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(process.cwd(), "tests", "full-ui-1-after-newproject.png"), fullPage: false });

  // ── 4. Switch to Story tab (lowercase or uppercase) ──
  const storyTab = page.locator('button, a').filter({ hasText: /^STORY$|^Story$/ }).filter({ hasNotText: /Bank/i }).first();
  await storyTab.click({ timeout: 5000 }).catch(() => log("[4] story tab not directly clickable, may already be active"));
  await page.waitForTimeout(1500);
  log("[4] switched to Story tab");

  await page.screenshot({ path: path.join(process.cwd(), "tests", "full-ui-2-story-tab.png"), fullPage: false });

  // ── 5. Find and fill the story textarea (biggest visible one) ──
  const allTextareas = await page.locator("textarea").all();
  log(`[5] found ${allTextareas.length} textareas`);
  let filled = false;
  for (const ta of allTextareas) {
    if (!(await ta.isVisible())) continue;
    const box = await ta.boundingBox();
    if (box && box.height > 60) {
      await ta.click({ force: true });
      await ta.fill(STORY);
      filled = true;
      log(`[5] filled textarea (${box.width}x${box.height})`);
      break;
    }
  }
  if (!filled) throw new Error("Could not find story textarea");
  await page.waitForTimeout(800);

  // ── 6. Click "Expand with AI" ──
  const expandBtn = page.locator('button').filter({ hasText: /expand.*ai|expand with/i }).first();
  await expandBtn.waitFor({ state: "visible", timeout: 10000 });
  log("[6] clicking Expand with AI — will wait up to 180s for character-extract");
  await expandBtn.click();

  // ── 7. Wait for character-extract response ──
  await page.waitForResponse(
    resp => /character-extract/.test(resp.url()) && resp.status() === 200,
    { timeout: 180_000 }
  );
  log("[7] character-extract response received");
  await page.waitForTimeout(3000);

  // ── 8. Switch to Characters tab ──
  const charTab = page.locator('button, a').filter({ hasText: /^CHARACTERS$|^Characters$/ }).first();
  await charTab.click({ timeout: 5000 }).catch(() => log("[8] char tab click failed"));
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(process.cwd(), "tests", "full-ui-3-characters-tab.png"), fullPage: true });

  // ── 9. Read what UI is actually showing ──
  const visualRows = await page.locator('text=/Visual:/i').all();
  log(`[9] UI has ${visualRows.length} 'Visual:' rows`);
  const uiDescs: string[] = [];
  for (let i = 0; i < visualRows.length; i++) {
    const parentDiv = visualRows[i].locator('xpath=..');
    const text = await parentDiv.innerText().catch(() => "");
    const clean = text.replace(/\s+/g, " ").slice(0, 300);
    uiDescs.push(clean);
    log(`     Visual[${i}]: ${clean}`);
  }

  // ── 10. Comparison + report ──
  log("\n=== COMPARISON ===");
  log("SERVER returned:");
  for (const c of (extractResp || [])) {
    const cn = c as { name?: string; characterId?: string; skinTone?: string; colorDescription?: string };
    log(`  ${cn.name} (${cn.characterId}): skinTone="${cn.skinTone || ""}" colorDesc="${cn.colorDescription || ""}"`);
  }
  log("\nUI rendered:");
  uiDescs.forEach((d, i) => log(`  [${i}]: ${d}`));

  const serverDark = (extractResp || []).every((c: { skinTone?: string; colorDescription?: string }) =>
    /(dark|brown|african|melanated)/i.test([c.skinTone, c.colorDescription].filter(Boolean).join(" "))
  );
  const uiDark = uiDescs.every(d => /(dark|brown|african|melanated)/i.test(d));

  log(`\nSERVER has dark/brown/African in skin fields: ${serverDark}`);
  log(`UI has dark/brown/African in displayed text: ${uiDark}`);

  if (serverDark && !uiDark) {
    log("\n🔴 CONFIRMED: server sends ethnicity correctly, client THROWS IT AWAY.");
    log("   This proves the client bundle is stale or has a mapping bug.");
  } else if (!serverDark) {
    log("\n🔴 SERVER BUG: extract did not return ethnicity");
  } else {
    log("\n✓ Both sides have ethnicity. Test passed.");
  }

  fs.writeFileSync(path.join(process.cwd(), "tests", "full-ui-report.txt"), events.join("\n"));

  // Assertion last
  expect(serverDark, "Server should return ethnicity").toBe(true);
  expect(uiDark, "UI should display ethnicity").toBe(true);
});
