import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const TEST_STORY = `MAIN STORY: Marcus and Dante Hale are Black twin brothers who grew up on the East Side. They are twins with dark brown skin. Both have matching scars above their left eyes.

Years later, Marcus becomes a police officer. He is a strong Black man in his late thirties with dark brown skin and short salt-and-pepper hair.

Dante takes the criminal path. He is a Black man in his late thirties with dark brown skin.

Lieutenant Rivera is their commanding officer — a small strong Latina woman in her thirties with olive-brown skin and sharp dark eyes.`;

test("ethnicity-bug-diag", async ({ page }) => {
  test.setTimeout(180_000);

  const logs: string[] = [];
  page.on("console", msg => {
    const t = msg.text();
    if (/\[scene-image\]|\[ImageProvider\]|\[AI Read\]|\[fal\]|skinTone|colorDescription|ethnicity/i.test(t)) {
      logs.push(`[browser] ${msg.type()}: ${t}`);
    }
  });

  const reqs: string[] = [];
  page.on("request", req => {
    const url = req.url();
    if (/character-extract|character-build|story-expand|analyze-character|scene-image/.test(url)) {
      reqs.push(`→ ${req.method()} ${url.replace("http://localhost:3200", "")}`);
    }
  });
  page.on("response", async res => {
    const url = res.url();
    if (/character-extract|character-build|story-expand|analyze-character/.test(url) && res.status() === 200) {
      try {
        const body = await res.json();
        const summary = JSON.stringify(body).slice(0, 1200);
        reqs.push(`← 200 ${url.replace("http://localhost:3200", "")} :: ${summary}`);
      } catch { /* ignore non-json */ }
    }
  });

  await page.goto("http://localhost:3200/dashboard/hybrid-planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  logs.push(`[nav] landed at ${page.url()}`);

  // Click "New Project" to start fresh
  const newProjectBtn = page.getByRole("button", { name: /^New Project$/i }).first();
  if (await newProjectBtn.isVisible().catch(() => false)) {
    await newProjectBtn.click();
    await page.waitForTimeout(2000);
    logs.push("[step] clicked New Project");
  }

  // Dismiss any modal (style picker) — press Escape twice + click outside
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // Click upper-left area outside any modal
  await page.mouse.click(10, 10).catch(() => {});
  await page.waitForTimeout(500);
  logs.push("[step] dismissed any open modal");

  // Switch to Story tab
  const storyTab = page.locator('button:has-text("STORY"), button:has-text("Story")').filter({ hasNotText: "Story Bank" }).first();
  await storyTab.click().catch(() => {});
  await page.waitForTimeout(1500);
  logs.push("[step] switched to Story tab");

  // Take screenshot of story tab
  await page.screenshot({ path: path.join(process.cwd(), "tests", "ethnicity-step1-story-tab.png"), fullPage: true });

  // Find the story textarea
  const allTextareas = await page.locator("textarea").all();
  logs.push(`[capture] found ${allTextareas.length} textareas on Story tab`);

  // The story textarea is usually the largest visible one — try each
  let filled = false;
  for (let i = 0; i < allTextareas.length; i++) {
    const ta = allTextareas[i];
    if (await ta.isVisible()) {
      const box = await ta.boundingBox();
      const placeholder = (await ta.getAttribute("placeholder")) || "";
      logs.push(`  textarea[${i}] visible, size=${box?.width}x${box?.height}, placeholder="${placeholder.slice(0, 60)}"`);
      // Pick the biggest visible textarea
      if (!filled && box && box.height > 80) {
        await ta.click();
        await ta.fill(TEST_STORY);
        filled = true;
        logs.push(`[step] filled textarea[${i}] with test story`);
      }
    }
  }
  if (!filled) logs.push("[step] FAILED — no suitable story textarea found");

  await page.waitForTimeout(500);

  // Find Expand with AI button
  const expandBtn = page.locator('button').filter({ hasText: /expand.*ai|expand with/i }).first();
  if (await expandBtn.isVisible().catch(() => false)) {
    logs.push("[step] clicking Expand with AI — waiting up to 120s for completion");
    await expandBtn.click();
    // Wait for character-extract response
    await page.waitForResponse(
      resp => /character-extract|story-expand/.test(resp.url()) && resp.status() === 200,
      { timeout: 120_000 }
    ).catch(e => logs.push(`[step] no extract response: ${e.message}`));
    await page.waitForTimeout(3000);
  } else {
    logs.push("[step] FAILED — Expand button not found");
  }

  // Switch to Characters tab to see results
  const charTab = page.locator('button:has-text("CHARACTERS"), button:has-text("Characters")').first();
  await charTab.click().catch(() => {});
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(process.cwd(), "tests", "ethnicity-step2-characters-tab.png"), fullPage: true });

  // Capture all visible text that looks like a character description (contains "Visual:")
  const visualBlocks = await page.locator('text=/Visual:/i').all();
  logs.push(`[capture] found ${visualBlocks.length} Visual: blocks`);
  for (let i = 0; i < Math.min(visualBlocks.length, 10); i++) {
    const parent = visualBlocks[i].locator("xpath=ancestor::*[contains(@style, 'flex') or self::div][1]");
    const text = await parent.innerText().catch(() => "");
    logs.push(`[Visual ${i}] ${text.slice(0, 500)}`);
  }

  // Screenshot the Characters tab
  const screenshotPath = path.join(process.cwd(), "tests", "ethnicity-bug-shot.png");
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  logs.push(`[screenshot] saved → ${screenshotPath}`);

  // Write full log
  const logPath = path.join(process.cwd(), "tests", "ethnicity-bug-log.txt");
  fs.writeFileSync(logPath, [
    "=== NETWORK REQUESTS ===",
    ...reqs,
    "",
    "=== EVENT LOG ===",
    ...logs,
  ].join("\n"));
  logs.push(`[log] written → ${logPath}`);

  console.log("===== DIAG OUTPUT =====");
  console.log(logs.join("\n"));
});
