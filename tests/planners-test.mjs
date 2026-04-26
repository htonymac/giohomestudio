// Playwright test — all 4 new planners (Series, Commercial, Music Video, Children)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3200";
const SHOT_DIR = path.join(process.cwd(), "tests", "screenshots");
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

let passed = 0;
let failed = 0;

async function ss(page, name) {
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return file;
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ FAIL: ${name} — ${e.message}`);
    failed++;
  }
}

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// ─── TEST 1: Series Planner ───
console.log("\n═══ TEST 1: Series Planner ═══");
await page.goto(`${BASE}/dashboard/series-wizard`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await ss(page, "01-series-planner-load");

await check("Series Planner loads without crash", async () => {
  const title = await page.title();
  if (!title) throw new Error("No page title");
});

await check("Series Planner shows tab navigation", async () => {
  // Look for tab buttons
  const tabTexts = await page.locator("button").allTextContents();
  const hasTabs = tabTexts.some(t => t.includes("Overview") || t.includes("Bible") || t.includes("Episodes"));
  if (!hasTabs) throw new Error("No workshop tabs found");
});

await check("Series Planner Overview tab visible", async () => {
  // Check for stat cards or progress bars
  const body = await page.locator("body").innerText();
  if (!body.includes("Episodes") && !body.includes("Series")) throw new Error("Overview content missing");
});

// Click Bible tab
try {
  const bibleBtn = page.locator("button").filter({ hasText: "Bible" }).first();
  await bibleBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "02-series-bible-tab");
  console.log("  ✅ PASS: Series Bible tab clicked");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Bible tab click — ${e.message}`);
  failed++;
}

// Click Characters tab
try {
  const charBtn = page.locator("button").filter({ hasText: "Characters" }).first();
  await charBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "03-series-characters-tab");
  console.log("  ✅ PASS: Series Characters tab clicked");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Characters tab — ${e.message}`);
  failed++;
}

// Click Episodes tab
try {
  const epBtn = page.locator("button").filter({ hasText: "Episodes" }).first();
  await epBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "04-series-episodes-tab");

  // Click Add Episode
  const addBtn = page.locator("button").filter({ hasText: "Add Episode" }).first();
  await addBtn.click();
  await page.waitForTimeout(1500);
  await ss(page, "05-series-episode-added");
  console.log("  ✅ PASS: Add Episode works");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Episodes tab — ${e.message}`);
  failed++;
}

// Click Assembly tab
try {
  const asmBtn = page.locator("button").filter({ hasText: "Assembly" }).first();
  await asmBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "06-series-assembly-tab");
  console.log("  ✅ PASS: Assembly tab visible");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Assembly tab — ${e.message}`);
  failed++;
}

// ─── TEST 2: Commercial Planner ───
console.log("\n═══ TEST 2: Commercial Planner ═══");
await page.goto(`${BASE}/dashboard/commercial-planner`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await ss(page, "07-commercial-planner-load");

await check("Commercial Planner is NOT a redirect", async () => {
  const url = page.url();
  if (url.includes("/dashboard/commercial") && !url.includes("commercial-planner")) {
    throw new Error("Still redirecting to /commercial!");
  }
  const body = await page.locator("body").innerText();
  if (body.includes("Loading Commercial Planner...") && body.length < 500) throw new Error("Still just redirect page");
});

await check("Commercial Planner shows workshop tabs", async () => {
  const tabTexts = await page.locator("button").allTextContents();
  const hasTabs = tabTexts.some(t => t.includes("Brief") || t.includes("Cast") || t.includes("Assembly"));
  if (!hasTabs) throw new Error("No workshop tabs — might still be redirecting");
});

// Click Brief tab
try {
  const briefBtn = page.locator("button").filter({ hasText: "Brief" }).first();
  await briefBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "08-commercial-brief-tab");

  // Fill in brand name
  const brandInput = page.locator("input[placeholder*='FreshBrew'], input[placeholder*='brand'], input[placeholder*='Brand']").first();
  if (await brandInput.isVisible()) {
    await brandInput.fill("TestBrand");
    await page.waitForTimeout(500);
  }
  await ss(page, "09-commercial-brief-filled");
  console.log("  ✅ PASS: Commercial Brief tab works");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Brief tab — ${e.message}`);
  failed++;
}

// Click Script & Scenes tab
try {
  const scenesBtn = page.locator("button").filter({ hasText: "Script" }).first();
  await scenesBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "10-commercial-scenes-tab");

  // Click Apply Template
  const tplBtn = page.locator("button").filter({ hasText: /template/i }).first();
  if (await tplBtn.isVisible()) {
    await tplBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, "11-commercial-template-applied");
    console.log("  ✅ PASS: Commercial template applied");
    passed++;
  }
} catch (e) {
  console.log(`  ❌ FAIL: Scenes tab — ${e.message}`);
  failed++;
}

// Click Assembly tab
try {
  const asmBtn = page.locator("button").filter({ hasText: "Assembly" }).first();
  await asmBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "12-commercial-assembly-tab");
  console.log("  ✅ PASS: Commercial Assembly tab visible");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Commercial Assembly — ${e.message}`);
  failed++;
}

// ─── TEST 3: Music Video Planner ───
console.log("\n═══ TEST 3: Music Video Planner ═══");
await page.goto(`${BASE}/dashboard/music-video-planner`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await ss(page, "13-music-video-planner-load");

await check("Music Video Planner has tab navigation (not steps)", async () => {
  const tabTexts = await page.locator("button").allTextContents();
  const hasTabs = tabTexts.some(t => t.includes("Overview") || t.includes("Song Input") || t.includes("Storyboard"));
  if (!hasTabs) throw new Error("No workshop tabs — still step-based?");
});

// Click Song Input tab
try {
  const songBtn = page.locator("button").filter({ hasText: "Song Input" }).first();
  await songBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "14-mv-song-tab");

  const titleInput = page.locator("input[placeholder*='Lagos'], input[placeholder*='title'], input[placeholder*='Title']").first();
  if (await titleInput.isVisible()) {
    await titleInput.fill("Test Song");
    await page.waitForTimeout(300);
  }
  console.log("  ✅ PASS: Music Video Song tab works");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Song tab — ${e.message}`);
  failed++;
}

// Click Mode & AI tab
try {
  const analysisBtn = page.locator("button").filter({ hasText: /Mode|Analysis/i }).first();
  await analysisBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "15-mv-analysis-tab");
  console.log("  ✅ PASS: Music Video Analysis tab visible");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Analysis tab — ${e.message}`);
  failed++;
}

// Click Storyboard tab
try {
  const sbBtn = page.locator("button").filter({ hasText: "Storyboard" }).first();
  await sbBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "16-mv-storyboard-tab");
  console.log("  ✅ PASS: Music Video Storyboard tab visible");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Storyboard tab — ${e.message}`);
  failed++;
}

// Click Captions tab
try {
  const capBtn = page.locator("button").filter({ hasText: "Captions" }).first();
  await capBtn.click();
  await page.waitForTimeout(1000);
  await ss(page, "17-mv-captions-tab");
  console.log("  ✅ PASS: Music Video Captions tab visible");
  passed++;
} catch (e) {
  console.log(`  ❌ FAIL: Captions tab — ${e.message}`);
  failed++;
}

// ─── TEST 4: Children Planner ───
console.log("\n═══ TEST 4: Children Planner ═══");
await page.goto(`${BASE}/dashboard/children-planner`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await ss(page, "18-children-planner-load");

await check("Children Planner loads", async () => {
  const body = await page.locator("body").innerText();
  if (!body.includes("Children") && !body.includes("child") && !body.includes("Story")) throw new Error("No children content");
});

// Check for learning modes
await check("Children Planner has Learning Mode selector", async () => {
  const body = await page.locator("body").innerText();
  const hasLearning = body.includes("Storybook") || body.includes("Read-Along") || body.includes("Phonics") || body.includes("Learning");
  if (!hasLearning) throw new Error("No learning modes found");
});

// Click Content tab
try {
  const contentBtn = page.locator("button").filter({ hasText: /Content/i }).first();
  if (await contentBtn.isVisible()) {
    await contentBtn.click();
    await page.waitForTimeout(1000);
    await ss(page, "19-children-content-tab");
    console.log("  ✅ PASS: Children Content tab works");
    passed++;
  }
} catch (e) {
  console.log(`  ❌ FAIL: Content tab — ${e.message}`);
  failed++;
}

// Check visual styles
try {
  const body = await page.locator("body").innerText();
  const hasStyles = body.includes("Storybook") || body.includes("Cartoon") || body.includes("Nursery");
  if (hasStyles) {
    console.log("  ✅ PASS: Children visual styles present");
    passed++;
  } else {
    console.log("  ❌ FAIL: No visual styles found");
    failed++;
  }
} catch (e) {
  failed++;
}

await ss(page, "20-children-final-state");

// ─── TEST 5: Check Asset Library still works ───
console.log("\n═══ TEST 5: Asset Library check ═══");
await page.goto(`${BASE}/dashboard/assets`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await ss(page, "21-asset-library");

await check("Asset Library loads", async () => {
  const body = await page.locator("body").innerText();
  if (!body.includes("Asset") && !body.includes("Library") && !body.includes("Upload")) throw new Error("Asset Library broken");
});

// ─── SUMMARY ───
await browser.close();
console.log(`\n${"═".repeat(50)}`);
console.log(`RESULTS: ${passed} passed / ${failed} failed`);
console.log(`Screenshots saved to: tests/screenshots/`);
console.log("═".repeat(50));

if (failed > 0) process.exit(1);
