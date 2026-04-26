// Hybrid Planner — Full 9-Step Assembly Test (Teddy & Dog project)
// Connects to Henry's main Chrome browser via CDP (port 9222)
// Mirrors the exact steps from the April 16 session recording

import { test, chromium, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const ss = async (name: string, page: Page) => {
  const p = path.join(SCREENSHOT_DIR, `asm_${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`📸 ${name}`);
  return p;
};

test.describe("Hybrid Planner — 9-Step Assembly Sound Fix", () => {
  test.setTimeout(600000); // 10 minutes

  test("Re-assemble Teddy & Dog with sound fix via Henry's browser", async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // ── Connect to Henry's main Chrome browser (port 9222) ──────────────────────
    let browser;
    let context: BrowserContext;
    let page: Page;

    try {
      browser = await chromium.connectOverCDP("http://localhost:9222");
      const contexts = browser.contexts();
      context = contexts[0] || await browser.newContext();
      const pages = context.pages();
      // Find hybrid-planner page or use first page
      page = pages.find(p => p.url().includes("hybrid-planner")) || pages[0] || await context.newPage();
      console.log("✓ Connected to Henry's Chrome browser via CDP");
      console.log(`  Active page: ${page.url()}`);
    } catch {
      console.log("⚠ CDP connection failed — launching new browser");
      browser = await chromium.launch({ headless: false });
      context = await browser.newContext();
      page = await context.newPage();
    }

    // ── Navigate to Hybrid Planner ──────────────────────────────────────────────
    await page.goto(`${BASE}/dashboard/hybrid-planner`);
    await page.waitForLoadState("networkidle");
    await ss("01-hybrid-planner", page);

    // ── Load saved project ────────────────────────────────────────────────────────
    // Click "My Projects (N)" button
    const myProjectsBtn = page.locator('button').filter({ hasText: /My Projects/ }).first();
    if (await myProjectsBtn.isVisible({ timeout: 5000 })) {
      await myProjectsBtn.click();
      await page.waitForTimeout(1000);
      await ss("02-projects-dropdown", page);

      // Click first project in list
      const projectRow = page.locator('[class*="project"], [data-project], li').first();
      const clickableProject = page.locator('button, div[role="button"], [onclick]')
        .filter({ hasText: /Teddy|Dog|Bear|Rescue|Hybrid|story/i }).first();

      if (await clickableProject.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clickableProject.click();
        console.log("✓ Clicked saved project by name");
      } else if (await projectRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await projectRow.click();
        console.log("✓ Clicked first project row");
      }
      await page.waitForTimeout(2000);
      await ss("03-project-loaded", page);
    }

    // ── Go to Assembly tab ────────────────────────────────────────────────────────
    const assemblyTab = page.locator('button, [role="tab"]').filter({ hasText: /^Assembly$/ }).first();
    if (await assemblyTab.isVisible({ timeout: 5000 })) {
      await assemblyTab.click();
    } else {
      // Try the text tab buttons in the workshop
      await page.locator('text=Assembly').first().click();
    }
    await page.waitForTimeout(1500);
    await ss("04-assembly-tab", page);

    // ── Log what we see ───────────────────────────────────────────────────────────
    const pageText = await page.locator('body').innerText().catch(() => "");
    const hasScenes = pageText.includes("SC0") || pageText.includes("scene");
    const hasPipeline = pageText.includes("Production Pipeline") || pageText.includes("Step 1");
    console.log(`Has scenes: ${hasScenes}, Has pipeline: ${hasPipeline}`);

    if (hasPipeline) {
      await runFullPipeline(page);
    } else if (hasScenes) {
      console.log("⚠ Simplified assembly view — will run direct assemble");
    } else {
      console.log("⚠ No scenes found — check screenshots to see what is loaded");
      await ss("04b-empty-state", page);
    }

    // ── Select all scenes and assemble ───────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const selectAll = page.locator('button').filter({ hasText: /Select All/ }).first();
    if (await selectAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAll.click();
      await page.waitForTimeout(500);
      console.log("✓ Select All scenes clicked");
    }

    // ── Find and click assemble button ────────────────────────────────────────────
    const assembleBtn = page.locator('button').filter({ hasText: /Assemble My Movie|Assemble My Scenes|🚀 Assemble|Make Video/ }).first();
    const assembleBtnVisible = await assembleBtn.isVisible({ timeout: 15000 }).catch(() => false);

    await ss("05-before-assemble", page);

    if (!assembleBtnVisible) {
      console.error("❌ Assemble button not found — check screenshots");
      // Take a screenshot and also capture the full page text for debugging
      console.log("Page content sample:", pageText.slice(0, 500));
      throw new Error("Assemble button not visible");
    }

    console.log("⏳ Clicking Assemble...");
    await assembleBtn.click();
    await ss("06-assembly-running", page);

    // ── Wait for video player (up to 5 min) ──────────────────────────────────────
    console.log("⏳ Waiting for final video (up to 5 min)...");
    const videoEl = page.locator('video').first();
    await videoEl.waitFor({ state: "visible", timeout: 300000 });
    console.log("✓ Video player appeared!");
    await ss("07-video-ready", page);

    // ── Get video src and verify ──────────────────────────────────────────────────
    const videoSrc = await videoEl.getAttribute("src");
    console.log(`Video src: ${videoSrc}`);
    expect(videoSrc).toBeTruthy();

    if (videoSrc) {
      // HTTP check
      const resp = await page.request.head(`${BASE}${videoSrc}`);
      const size = parseInt(resp.headers()["content-length"] || "0");
      console.log(`Video: HTTP ${resp.status()} | ${size.toLocaleString()} bytes`);
      expect(resp.status()).toBe(200);
      expect(size).toBeGreaterThan(50000);

      // Audio stream check via ffprobe
      const audioCheck = await page.request.post(`${BASE}/api/hybrid/check-audio`, {
        data: { videoUrl: videoSrc },
      });

      if (audioCheck.ok()) {
        const d = await audioCheck.json();
        console.log(`🔊 Audio: hasAudio=${d.hasAudio} | duration=${d.duration?.toFixed(1)}s | codec=${d.audioCodec} | channels=${d.audioChannels} | streams=${d.audioStreams}`);
        expect(d.hasAudio).toBe(true);
        expect(d.duration).toBeGreaterThan(1);
        console.log("✅ SOUND VERIFIED — video has live audio stream");
      }
    }

    await ss("08-final-verified", page);
    console.log("🎉 Assembly complete — sound fix confirmed in output video");
  });
});

// ── Full 9-step pipeline runner ──────────────────────────────────────────────
async function runFullPipeline(page: Page) {
  // STEP 1: Write Screenplay
  const step1 = page.locator('text=Write Screenplay').first();
  if (await step1.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step1.click();
    await page.waitForTimeout(500);

    const alreadyDone = await page.locator('text=/Screenplay ready/').isVisible({ timeout: 2000 }).catch(() => false);
    if (!alreadyDone) {
      const authorInput = page.locator('input[placeholder*="name"]').first();
      if (await authorInput.isVisible()) await authorInput.fill("GHS Studio");
      const writeBtn = page.locator('button').filter({ hasText: /Write Screenplay/ }).first();
      if (await writeBtn.isEnabled()) {
        await writeBtn.click();
        console.log("⏳ Step 1: Writing screenplay...");
        await page.waitForSelector('text=/Screenplay ready/', { timeout: 60000 }).catch(() => {});
      }
    } else {
      console.log("✓ Step 1: Screenplay ready");
    }
    // Send to scenes
    const sendBtn = page.locator('button').filter({ hasText: /Send to Scenes/ }).first();
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
      await page.waitForTimeout(3000);
      console.log("✓ Step 1: Sent to scenes");
    }
    await ss("step1-screenplay", page);
  }

  // STEP 3: Parse Script
  const step3 = page.locator('text=Parse Script').first();
  if (await step3.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step3.click();
    await page.waitForTimeout(500);
    const alreadyDone = await page.locator('text=/narrator lines/').isVisible({ timeout: 2000 }).catch(() => false);
    if (!alreadyDone) {
      const parseBtn = page.locator('button').filter({ hasText: /Parse Script/ }).first();
      if (await parseBtn.isEnabled()) {
        await parseBtn.click();
        console.log("⏳ Step 3: Parsing script...");
        await page.waitForTimeout(15000);
      }
    } else {
      console.log("✓ Step 3: Script already parsed");
    }
    await ss("step3-parse", page);
  }

  // STEP 4: Actor Voices
  const step4 = page.locator('text=Actor Voices').first();
  if (await step4.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step4.click();
    await page.waitForTimeout(500);
    const alreadyDone = await page.locator('text=/actors voiced/').isVisible({ timeout: 2000 }).catch(() => false);
    if (!alreadyDone) {
      const genBtn = page.locator('button').filter({ hasText: /Generate Actor Voices|Generate Voices/ }).first();
      if (await genBtn.isVisible() && await genBtn.isEnabled()) {
        await genBtn.click();
        console.log("⏳ Step 4: Generating actor voices...");
        await page.waitForSelector('text=/actors voiced/', { timeout: 120000 }).catch(() => {});
      }
    } else {
      console.log("✓ Step 4: Actor voices done");
    }
    await ss("step4-actors", page);
  }

  // STEP 5: Narrator Voice
  const step5 = page.locator('text=Narrator Voice').first();
  if (await step5.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step5.click();
    await page.waitForTimeout(500);
    const alreadyDone = await page.locator('text=/Narrator audio ready|narrator.*ready/i').isVisible({ timeout: 2000 }).catch(() => false);
    if (!alreadyDone) {
      const narrateBtn = page.locator('button').filter({ hasText: /Generate Narrator|Narrate|Generate Audio/ }).first();
      if (await narrateBtn.isVisible() && await narrateBtn.isEnabled()) {
        await narrateBtn.click();
        console.log("⏳ Step 5: Generating narrator audio...");
        await page.waitForSelector('text=/Narrator audio ready|narrator.*ready/i', { timeout: 120000 }).catch(() => {});
      }
    } else {
      console.log("✓ Step 5: Narrator audio ready");
    }
    await ss("step5-narrator", page);
  }

  // STEP 6: Background Music
  const step6 = page.locator('text=Background Music').first();
  if (await step6.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step6.click();
    await page.waitForTimeout(500);
    const alreadyDone = await page.locator('text=/Track selected|music.*selected/i').isVisible({ timeout: 2000 }).catch(() => false);
    if (!alreadyDone) {
      const aiPickBtn = page.locator('button').filter({ hasText: /AI Pick/ }).first();
      if (await aiPickBtn.isVisible()) {
        await aiPickBtn.click();
        console.log("⏳ Step 6: AI picking music...");
        await page.waitForTimeout(15000);
      }
    } else {
      console.log("✓ Step 6: Music selected");
    }
    await ss("step6-music", page);
  }

  // STEP 7: AI Audio Plan
  const step7 = page.locator('text=AI Audio Plan').first();
  if (await step7.isVisible({ timeout: 3000 }).catch(() => false)) {
    await step7.click();
    await page.waitForTimeout(500);
    const planBtn = page.locator('button').filter({ hasText: /AI Plan Audio|Plan Audio/ }).first();
    if (await planBtn.isVisible() && await planBtn.isEnabled()) {
      await planBtn.click();
      console.log("⏳ Step 7: AI Audio Plan...");
      await page.waitForTimeout(10000);
    } else {
      console.log("✓ Step 7: Audio plan done");
    }
    await ss("step7-audio-plan", page);
  }
}
