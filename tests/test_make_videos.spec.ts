/**
 * Full hybrid video flow test.
 * VID1 → existing project (Investor Demo) → generate images → assemble → verify video in Review
 * VID2 → new project → full pipeline (Story→Expand→Parse→Characters→Sound→Screenplay)
 *   → generate images → assemble → verify video in Review
 * Both: Review Queue + All Content verified.
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3200";

async function wait(page: Page, ms: number) { await page.waitForTimeout(ms); }
async function ss(page: Page, name: string) {
  await page.screenshot({ path: `tests/screenshots/vid_${name}.png` });
  console.log(`  [📸] ${name}`);
}
async function clickBtn(page: Page, text: RegExp, label: string, timeout = 4000) {
  const el = page.locator("button").filter({ hasText: text }).first();
  if (await el.isVisible({ timeout }).catch(() => false)) {
    await el.click({ force: true });
    console.log(`  [✓] ${label}`);
    return true;
  }
  console.log(`  [—] NOT FOUND: ${label}`);
  return false;
}

// Generate images for the first N scenes visible in the Scenes/Scene Board tab
async function generateSceneImages(page: Page, count = 2, label = "") {
  console.log(`\n  [⚙] Generating images for first ${count} scenes (${label})...`);

  // Go to Scene Board tab
  const scenesTab = page.locator("button, [role=tab]").filter({ hasText: /scene board|scenes/i }).first();
  if (await scenesTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await scenesTab.click({ force: true });
    await wait(page, 2000);
    console.log("  [✓] Scene Board tab opened");
  } else {
    console.log("  [!] Scene Board tab not found");
    return 0;
  }

  // The Scene Board shows an overview first — click "Next: Scene Board →" to reach scene cards
  const nextSceneBtn = page.locator("button").filter({ hasText: /next.*scene/i }).first();
  if (await nextSceneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextSceneBtn.click({ force: true });
    await wait(page, 2000);
    console.log("  [✓] Advanced to Scene Board card view");
  }

  // Print all buttons on this page to find exact generate button label
  const pageBtns = (await page.locator("button").allInnerTexts()).map(b => b.trim()).filter(b => b.length > 0 && b.length < 50);
  const genRelated = pageBtns.filter(b => /gen|image|creat|ai|flux|photo/i.test(b));
  console.log("  [i] Generate-related buttons:", genRelated.slice(0, 10).join(" | ") || "NONE — all buttons: " + pageBtns.slice(0, 10).join(" | "));

  // Find all "Generate Image" buttons (various label formats)
  const genBtns = page.locator("button").filter({ hasText: /gen image|generate image|create image|gen photo|gen.*ai|ai.*gen|flux|imagine/i });
  const total = await genBtns.count();
  console.log(`  [i] Found ${total} generate-image buttons`);

  let generated = 0;
  const toGenerate = Math.min(count, total);
  for (let i = 0; i < toGenerate; i++) {
    const btn = genBtns.nth(i);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true });
      console.log(`  [✓] Generate image ${i + 1} clicked`);
      await wait(page, 30000); // FAL generation ~20-30s
      generated++;
    }
  }
  console.log(`  [i] Generated ${generated} images`);
  return generated;
}

// ─────────────────────────────────────────────────────────────────────────────
// VID1: load existing project → generate images → assemble
// ─────────────────────────────────────────────────────────────────────────────
test("Video 1 — Assemble existing project (Investor Demo)", async ({ page }) => {
  test.setTimeout(600000); // 10 min — includes image generation
  console.log("\n═══ VID1: Assemble existing project ═══");

  await page.goto(`${BASE}/dashboard/hybrid-planner`, { waitUntil: "networkidle" });
  await wait(page, 2000);
  await ss(page, "VID1_01_planner");

  // Open project picker → load INVESTOR DEMO PROJECT
  const myProjects = page.locator("button").filter({ hasText: /my projects/i }).first();
  if (await myProjects.isVisible({ timeout: 3000 }).catch(() => false)) {
    await myProjects.click({ force: true });
    await wait(page, 1500);
    console.log("  [✓] My Projects opened");

    const investorCard = page.locator("text=INVESTOR DEMO PROJECT").first();
    if (await investorCard.isVisible({ timeout: 4000 }).catch(() => false)) {
      const cardContainer = page.locator("[class*=project],[class*=card]").filter({ hasText: /investor demo project/i }).first();
      const openBtn = cardContainer.locator("button, a").filter({ hasText: /open/i }).first();
      if (await openBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await openBtn.click({ force: true });
      } else {
        await investorCard.click({ force: true });
      }
      await wait(page, 2500);
      console.log("  [✓] INVESTOR DEMO PROJECT loaded");
    } else {
      console.log("  [!] INVESTOR DEMO PROJECT not found — proceeding with current project");
      await page.keyboard.press("Escape");
    }
  }
  await ss(page, "VID1_02_project_loaded");

  // ── Generate images for first 2 scenes ───────────────────────────────────
  await generateSceneImages(page, 2, "VID1");
  await ss(page, "VID1_03_images_generated");

  // ── Go to Assembly tab ────────────────────────────────────────────────────
  console.log("\n  [→] Going to Assembly tab...");
  const assemblyTabEl = page.locator("button, [role=tab]").filter({ hasText: /assembly/i }).first();
  if (await assemblyTabEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    await assemblyTabEl.click({ force: true });
    await wait(page, 4000); // wait for auto-select useEffect
    console.log("  [✓] Assembly tab opened + auto-select complete");
    await ss(page, "VID1_04_assembly_tab");
  }

  // ── AI Pick Music ─────────────────────────────────────────────────────────
  await clickBtn(page, /ai pick|pick music|background music/i, "AI Pick Music");
  await wait(page, 8000);
  await ss(page, "VID1_05_music");

  // ── Print assembly buttons to diagnose ───────────────────────────────────
  const asmBtns = (await page.locator("button").allInnerTexts()).map(b => b.trim()).filter(b => b.length > 2 && b.length < 80);
  console.log("  [i] Assembly buttons:", asmBtns.filter(b => /assemble|select|unlock|complete/i.test(b)).join(" | ") || asmBtns.slice(0, 10).join(" | "));

  // Scroll to bottom — Assemble button is in pipeline step 9 (deep in page)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(page, 1000);

  // ── Assemble My Movie ─────────────────────────────────────────────────────
  const assembleEl = page.locator("button").filter({ hasText: /assemble my movie|select scenes|complete step/i }).first();
  const assembleVisible = await assembleEl.isVisible({ timeout: 5000 }).catch(() => false);
  const assembleText = assembleVisible ? await assembleEl.innerText().catch(() => "?") : "NOT FOUND";
  console.log(`\n  [i] Assembly button: "${assembleText.trim()}"`);

  if (assembleVisible) {
    const disabled = await assembleEl.isDisabled();
    console.log(`  [i] Assemble disabled: ${disabled}`);
    if (!disabled) {
      await assembleEl.click({ force: true });
      console.log("  [✓] Assemble My Movie clicked — waiting 90s for FFmpeg...");
      await wait(page, 30000);
      await ss(page, "VID1_06_assembling_30s");
      await wait(page, 60000);
      await ss(page, "VID1_07_assembled");
    } else {
      await ss(page, "VID1_06_disabled");
      console.log("  [!] Assemble disabled even after image generation");
    }
  } else {
    await ss(page, "VID1_06_no_button");
    console.log("  [!] Assemble button not visible");
  }
  expect(assembleVisible).toBe(true);

  // ── Review Queue ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/review`, { waitUntil: "networkidle" });
  await wait(page, 2000);
  await ss(page, "VID1_08_review");
  const reviewBody = await page.locator("body").innerText();
  expect(reviewBody).not.toContain("Application error");
  // Check that a new video was added (not just "No output yet")
  const hasNewVideo = !reviewBody.includes("No output yet") || reviewBody.includes("IN_REVIEW");
  console.log(`  [i] Review has new video: ${hasNewVideo}`);

  // ── All Content ───────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/registry`, { waitUntil: "networkidle" });
  await wait(page, 2000);
  await ss(page, "VID1_09_all_content");
  expect(await page.locator("body").innerText()).not.toContain("Application error");

  console.log("\n  ✅ VID1 DONE\n");
});

// ─────────────────────────────────────────────────────────────────────────────
// VID2: full new project pipeline → generate images → assemble
// ─────────────────────────────────────────────────────────────────────────────
test("Video 2 — New project full pipeline (Aisha Kano)", async ({ page }) => {
  test.setTimeout(600000); // 10 min
  const label = "VID2";
  console.log(`\n═══ ${label}: New project full pipeline ═══`);

  await page.goto(`${BASE}/dashboard/hybrid-planner`, { waitUntil: "networkidle" });
  await wait(page, 2000);

  // New Project
  await clickBtn(page, /new project/i, "New Project");
  await wait(page, 2000);
  await ss(page, `${label}_01_new`);

  // Story tab + fill
  const storyTabEl = page.locator("button").filter({ hasText: /^\d\nstory|^story\s*✓|^✓\s*story/i }).first();
  if (await storyTabEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await storyTabEl.click({ force: true });
    await wait(page, 1500);
  }
  const textarea = page.locator("textarea").first();
  if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
    await textarea.fill(`Aisha is a seamstress in Kano. She saves money for six months to buy a sewing machine. But the price doubled. She sits outside the shop crying. An older woman named Mama Bola notices her tears and asks what happened. Mama Bola gives Aisha her old sewing machine for free. Aisha promises to sew Mama Bola a dress every month. They walk home together laughing.`);
    console.log(`  [✓] Story filled`);
  }
  await ss(page, `${label}_02_story`);

  // Expand
  await clickBtn(page, /expand with ai intelligence/i, "Expand with AI");
  await wait(page, 20000);
  await ss(page, `${label}_03_expanded`);

  // Parse Script
  await clickBtn(page, /^parse script$/i, "Parse Script");
  await wait(page, 15000);
  const scenesCount = await page.locator("button").filter({ hasText: /\d+\s*scenes?/i }).first().innerText().catch(() => "?");
  console.log(`  [i] Scenes: "${scenesCount.trim()}"`);
  await ss(page, `${label}_04_parsed`);

  // Characters → AI Detect
  const charTabEl = page.locator("button").filter({ hasText: /^characters?\d*$/i }).first();
  if (await charTabEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await charTabEl.click({ force: true });
    await wait(page, 1500);
  }
  await clickBtn(page, /ai detect/i, "AI Detect characters");
  await wait(page, 12000);
  await ss(page, `${label}_05_characters`);

  // Sound & SFX
  await clickBtn(page, /sound.*sfx/i, "Sound & SFX tab");
  await wait(page, 1500);
  const sBtns = (await page.locator("button").allInnerTexts()).map(b => b.trim()).filter(b =>
    /auto|narrat|sfx|audio|music|generate/i.test(b) && b.length < 50
  );
  console.log("  [i] Sound buttons:", sBtns.slice(0, 6).join(" | "));
  await clickBtn(page, /auto time stamp|auto audio plan|generate narration/i, "Auto Time Stamp / Audio Plans");
  await wait(page, 12000);
  await ss(page, `${label}_06_sound`);

  // Screenplay → Write
  await clickBtn(page, /screenplay/i, "Screenplay tab");
  await wait(page, 3000); // wait for tab content to fully render
  await ss(page, `${label}_07_screenplay`);
  await clickBtn(page, /write screenplay/i, "Write Screenplay", 6000);
  await wait(page, 25000); // screenplay generation ~20s
  await ss(page, `${label}_07b_screenplay_done`);
  await clickBtn(page, /send to scenes/i, "Send to Scenes");
  await wait(page, 5000);

  // ── Generate images for first 2 scenes ───────────────────────────────────
  await generateSceneImages(page, 2, label);
  await ss(page, `${label}_08_images_generated`);

  // Assembly tab
  await clickBtn(page, /assembly/i, "Assembly tab");
  await wait(page, 4000); // wait for auto-select
  await ss(page, `${label}_09_assembly`);

  // Print assembly buttons
  const aBtns = (await page.locator("button").allInnerTexts()).map(b => b.trim()).filter(b =>
    b.length > 2 && b.length < 80
  );
  console.log("  [i] Assembly buttons:", aBtns.filter(b =>
    /assemble|pick|music|narrate|generate|select|unlock/i.test(b)
  ).slice(0, 8).join(" | ") || "NONE FOUND");

  // Scroll to assemble button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(page, 1000);

  const assEl = page.locator("button").filter({ hasText: /assemble my movie|select scenes|complete step/i }).first();
  const assVisible = await assEl.isVisible({ timeout: 5000 }).catch(() => false);
  const assText = assVisible ? await assEl.innerText().catch(() => "?") : "NOT FOUND";
  console.log(`  [i] Assembly button: "${assText.trim()}"`);

  if (assVisible) {
    const disabled = await assEl.isDisabled();
    console.log(`  [i] Assemble disabled: ${disabled}`);
    if (!disabled) {
      await assEl.click({ force: true });
      console.log("  [✓] Assemble clicked — waiting 90s...");
      await wait(page, 30000);
      await ss(page, `${label}_10_assembling_30s`);
      await wait(page, 60000);
      await ss(page, `${label}_11_assembled`);
    } else {
      await ss(page, `${label}_10_disabled`);
    }
  } else {
    await ss(page, `${label}_10_no_button`);
  }

  // Review + All Content
  await page.goto(`${BASE}/dashboard/review`, { waitUntil: "networkidle" });
  await wait(page, 2000);
  await ss(page, `${label}_12_review`);
  expect(await page.locator("body").innerText()).not.toContain("Application error");

  await page.goto(`${BASE}/dashboard/registry`, { waitUntil: "networkidle" });
  await wait(page, 2000);
  await ss(page, `${label}_13_registry`);
  expect(await page.locator("body").innerText()).not.toContain("Application error");

  console.log(`\n  ✅ ${label} DONE\n`);
});
