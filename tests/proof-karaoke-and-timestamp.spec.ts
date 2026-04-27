// Proof shots: Karaoke in sidebar + Auto Time Stamp button in Hybrid + MVP
import { test, chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3200";
const SS_DIR = path.join(__dirname, "screenshots");

test("PROOF: Karaoke in sidebar + Auto Time Stamp on Hybrid + MVP", async () => {
  fs.mkdirSync(SS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1. Dashboard — sidebar should show Karaoke Studio entry
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SS_DIR, "PROOF-01-sidebar-karaoke.png"), fullPage: false });
  const sidebarText = await page.locator("nav, aside, [class*='sidebar']").first().innerText().catch(() => "");
  console.log(`[proof] sidebar contains 'Karaoke': ${sidebarText.toLowerCase().includes("karaoke")}`);

  // 2. Karaoke page renders
  await page.goto(`${BASE}/dashboard/karaoke-studio`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SS_DIR, "PROOF-02-karaoke-page.png"), fullPage: false });

  // 3. Hybrid Planner — Audio & Shots tab should have Auto Time Stamp button
  await page.goto(`${BASE}/dashboard/hybrid-planner`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // Click Audio & Shots tab — accept any matching variant
  const audioTab = page.locator("button").filter({ hasText: /Audio.*Shots|^4\s*Audio/i }).first();
  if (await audioTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await audioTab.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(SS_DIR, "PROOF-03-hybrid-audio-tab.png"), fullPage: true });
  const hybridHasButton = await page.getByText("Auto Time Stamp", { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`[proof] hybrid-planner Auto Time Stamp visible: ${hybridHasButton}`);

  // 4. Music Video Planner — Storyboard tab should have Auto Time Stamp button
  await page.goto(`${BASE}/dashboard/music-video-planner`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const storyboardTab = page.locator("button").filter({ hasText: /Storyboard/i }).first();
  if (await storyboardTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await storyboardTab.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: path.join(SS_DIR, "PROOF-04-mvp-storyboard.png"), fullPage: true });
  const mvpHasButton = await page.getByText("Auto Time Stamp", { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`[proof] music-video-planner Auto Time Stamp visible: ${mvpHasButton}`);

  await browser.close();
});
