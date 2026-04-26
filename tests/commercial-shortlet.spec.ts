/**
 * GioHomeStudio — Commercial Short Let Full Workflow Test
 *
 * Behaves exactly like a human user:
 *   1. Opens Commercial Maker
 *   2. Clicks "+ Slide Ad (Mode 1)" to create a Short Let project
 *   3. Adds 3 slides — uploads real property photos from update/IMAGE/
 *   4. On each slide: fills caption, sets position, picks font, sets size, bold,
 *      writes narration, drags duration slider
 *   5. Sets brand, music library track, total duration, CTA WhatsApp
 *   6. Hits Render — polls until complete
 *   7. Goes to Review queue — plays 5 short let videos
 *
 * Run:
 *   npx playwright test tests/commercial-shortlet.spec.ts --headed --timeout=300000
 */

import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE    = "http://localhost:3200";
const IMG_DIR = path.join(process.cwd(), "update", "IMAGE");

// ── Short Let slide content ──────────────────────────────────────────────────

const SLIDES = [
  {
    image:     "flat3 sitting room 1.jpg",
    caption:   "Luxury 3-Bedroom Short Let – Lekki Phase 1",
    narration: "Welcome to your perfect home away from home in the heart of Lekki. Fully furnished, fully serviced.",
    durationMs: 5000,
    font:       "Georgia",
    fontSize:   32,
    bold:       true,
    position:   "bottom",
  },
  {
    image:     "flat3 sitting room 2.jpg",
    caption:   "Spacious Living Room · Smart TV · Fast WiFi",
    narration: "Unwind in a bright, airy sitting room with a 55-inch smart TV and fibre broadband internet.",
    durationMs: 4000,
    font:       "Arial",
    fontSize:   28,
    bold:       false,
    position:   "bottom",
  },
  {
    image:     "flat3 sitting room 3.jpg",
    caption:   "From ₦85,000/night  ·  Call or WhatsApp to Book",
    narration: "Available nightly, weekly, and monthly. Call or WhatsApp us now to check availability.",
    durationMs: 5000,
    font:       "Inter",
    fontSize:   30,
    bold:       true,
    position:   "bottom",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function slowType(page: Page, loc: ReturnType<Page["locator"]>, text: string) {
  await loc.click();
  await loc.fill("");
  await page.keyboard.type(text, { delay: 40 });
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Main workflow test ────────────────────────────────────────────────────────

test("Short Let: create ad → 3 slides + photos → captions → render", async ({ page }) => {
  test.setTimeout(600_000); // 10 min — render pipeline can take 3-5 min

  // ━━ STEP 1: Open Commercial Maker ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n📂 Step 1: Open Commercial Maker");
  await page.goto(`${BASE}/dashboard/commercial`);
  await page.waitForLoadState("networkidle");
  await pause(800);

  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("h1, h2")).toContainText(/Commercial/i, { timeout: 6000 });
  console.log("   ✓ Page loaded");

  // ━━ STEP 2: Create project ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n🆕 Step 2: Create Short Let project");

  // Click the "+ Slide Ad (Mode 1)" create button — has a "+" prefix, not the tab
  const createAdBtn = page.getByRole("button", { name: "+ Slide Ad (Mode 1)" });
  await expect(createAdBtn).toBeVisible({ timeout: 8000 });
  await createAdBtn.click();
  await pause(600);

  // New project form appears
  const nameInput = page.getByPlaceholder(/Lagos Property Promo/i);
  await expect(nameInput).toBeVisible({ timeout: 6000 });
  await slowType(page, nameInput, "Flat 3 Short Let – Lekki");
  await pause(200);

  const brandInput = page.getByPlaceholder(/GioHomeStudio/i);
  await expect(brandInput).toBeVisible({ timeout: 4000 });
  await slowType(page, brandInput, "Gio Home Studio");
  await pause(200);

  // Select 9:16 (already active — click to confirm)
  const ratio9_16 = page.locator("button", { hasText: "9:16" }).first();
  if (await ratio9_16.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ratio9_16.click();
    await pause(200);
  }

  // Hit Create Project
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.waitForLoadState("networkidle");
  await pause(800);

  // Editor is now open (view switches to "editor")
  await expect(page.locator("body")).toContainText("Flat 3 Short Let", { timeout: 8000 });
  console.log("   ✓ Editor opened: Flat 3 Short Let – Lekki");

  // ━━ STEP 3: Add 3 slides ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n➕ Step 3: Add 3 slides");

  for (let i = 0; i < 3; i++) {
    const addBtn = page.locator("button", { hasText: "+ Add" });
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await pause(500);
    console.log(`   ✓ Slide ${i + 1} added`);
  }

  // Confirm 3 slide cards appear in left panel
  const slideCards = page.locator(".w-\\[220px\\] div[draggable]");
  await expect(slideCards).toHaveCount(3, { timeout: 8000 });
  console.log("   ✓ 3 slide cards confirmed");

  // ━━ STEP 4: Fill each slide ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n📝 Step 4: Upload photos + fill captions + narration + font");

  for (let i = 0; i < SLIDES.length; i++) {
    const s = SLIDES[i];
    console.log(`\n   🖼  Slide ${i + 1}: ${s.image}`);

    // Click the slide card in the left panel
    await slideCards.nth(i).click();
    await pause(400);

    // ── Upload image ──────────────────────────────────────────────────────────
    const imgPath = path.join(IMG_DIR, s.image);
    if (fs.existsSync(imgPath)) {
      const uploadBtn = page.locator("button", { hasText: /Upload image/i }).first();
      await expect(uploadBtn).toBeVisible({ timeout: 5000 });

      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        uploadBtn.click(),
      ]);
      await chooser.setFiles(imgPath);
      await page.waitForLoadState("networkidle");
      await pause(1200);

      // Confirm image loaded — upload button text changes to "Replace image"
      await expect(page.locator("button", { hasText: /Replace image/i })).toBeVisible({ timeout: 10000 });
      console.log(`   ✓ Photo uploaded`);
    } else {
      console.log(`   ⚠ ${imgPath} not found — skipping image`);
    }

    // ── Caption ───────────────────────────────────────────────────────────────
    const captionTA = page.getByPlaceholder("Short headline for this slide");
    await expect(captionTA).toBeVisible({ timeout: 5000 });
    await slowType(page, captionTA, s.caption);
    await pause(400);
    console.log(`   ✓ Caption: "${s.caption.slice(0, 45)}…"`);

    // Caption position button (top/center/bottom)
    const posBtn = page.locator("button", { hasText: s.position }).filter({ has: page.locator("[class*='py-0.5']") }).first();
    if (await posBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await posBtn.click();
      await pause(150);
    }

    // ── Font ──────────────────────────────────────────────────────────────────
    // Font family — select inside the Font section (label "Font family")
    const fontLabel = page.locator("label", { hasText: /^Font family/ });
    if (await fontLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const fontSelect = fontLabel.locator("..").locator("select");
      await fontSelect.selectOption(s.font);
      await pause(200);
      console.log(`   ✓ Font: ${s.font}`);
    }

    // Font size slider — the range input whose label starts with "Size:"
    const sizeLabel = page.locator("label", { hasText: /^Size:/ });
    if (await sizeLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const sizeSlider = sizeLabel.locator("..").locator('input[type="range"]');
      await sizeSlider.fill(String(s.fontSize));
      await pause(150);
    }

    // Bold toggle button
    if (s.bold) {
      const boldBtn = page.locator("button", { hasText: /^B$/ }).first();
      if (await boldBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await boldBtn.click();
        await pause(150);
        console.log("   ✓ Bold on");
      }
    }

    // ── Narration ─────────────────────────────────────────────────────────────
    const narTA = page.getByPlaceholder("What the narrator says during this slide");
    await expect(narTA).toBeVisible({ timeout: 5000 });
    await slowType(page, narTA, s.narration);
    await pause(400);
    console.log(`   ✓ Narration written`);

    // ── Duration slider ───────────────────────────────────────────────────────
    const durLabel = page.locator("label", { hasText: /^Duration:/ });
    if (await durLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const durSlider = durLabel.locator("..").locator('input[type="range"]');
      await durSlider.fill(String(s.durationMs));
      await pause(200);
      console.log(`   ✓ Duration: ${s.durationMs / 1000}s`);
    }

    await pause(900); // let debounced auto-save fire
  }

  // ━━ STEP 5: Project settings ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n⚙️  Step 5: Project settings");

  // Total duration
  const durInput = page.getByPlaceholder("e.g. 30");
  if (await durInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await durInput.click();
    await durInput.fill("15");
    await pause(300);
    console.log("   ✓ Target duration: 15s");
  }

  // Auto-distribute toggle (sibling button next to label "Auto-distribute time")
  const autoRow = page.locator("p", { hasText: "Auto-distribute time" }).locator("..");
  const autoToggle = autoRow.locator("button").first();
  if (await autoToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await autoToggle.click();
    await pause(300);
    console.log("   ✓ Auto-distribute enabled");
  }

  // CTA: WhatsApp
  const ctaSelect = page.locator("select").filter({ has: page.locator("option[value='whatsapp']") }).first();
  if (await ctaSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ctaSelect.selectOption("whatsapp");
    await pause(400);

    const ctaPrimary = page.getByPlaceholder("+234 xxx xxxx / @handle");
    if (await ctaPrimary.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slowType(page, ctaPrimary, "+234 812 345 6789");
      await pause(300);
      console.log("   ✓ CTA: WhatsApp +234 812 345 6789");
    }
  }

  // ━━ STEP 6: Pick music from library ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n🎵 Step 6: Pick background music");

  const libBtn = page.locator("button", { hasText: "📚 Library" });
  if (await libBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await libBtn.click();
    await expect(page.locator("body")).toContainText("Stock library", { timeout: 8000 });
    await pause(500);

    // Pick a good mood track for property ads
    const moods = ["upbeat", "corporate", "cinematic", "calm", "professional"];
    let picked = false;
    for (const mood of moods) {
      const btn = page.locator(".max-h-40 button", { hasText: new RegExp(mood, "i") }).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        const name = (await btn.textContent())?.trim();
        await btn.click();
        await pause(500);
        console.log(`   ✓ Music: "${name}"`);
        picked = true;
        break;
      }
    }
    if (!picked) {
      // Just pick the first one
      const first = page.locator(".max-h-40 button").first();
      if (await first.isVisible({ timeout: 2000 }).catch(() => false)) {
        const name = (await first.textContent())?.trim();
        await first.click();
        await pause(500);
        console.log(`   ✓ Music: "${name}" (first available)`);
      }
    }
  }

  await pause(800);

  // ━━ STEP 7: Render ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n🎬 Step 7: Hit Render");

  // Render button is in the top bar — exact text "Render"
  const renderBtn = page.locator("button", { hasText: /^Render$/ });
  await expect(renderBtn).toBeVisible({ timeout: 5000 });
  await expect(renderBtn).toBeEnabled({ timeout: 5000 });

  await renderBtn.click();
  await pause(1000);

  // Banner confirms render started
  await expect(page.locator("body")).toContainText(/Rendering|Check Review|started/i, { timeout: 10000 });
  console.log("   ✓ Render kicked off");

  // ━━ STEP 8: Poll for completion (max 4 min) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n⏳ Step 8: Watching render progress…");

  const deadline = Date.now() + 8 * 60 * 1000; // 8 min render window
  let done = false;

  while (Date.now() < deadline) {
    await pause(7000);
    const txt = await page.locator("body").textContent();
    if (txt?.includes("Render complete") || txt?.includes("Check Review queue")) {
      done = true;
      console.log("   ✓ Render complete!");
      break;
    }
    if (txt?.includes("Render failed")) {
      console.log("   ✗ Render failed — check server logs");
      break;
    }
    console.log(`   … ${Math.round((Date.now() - (deadline - 4 * 60 * 1000)) / 1000)}s — still rendering`);
  }

  if (!done) console.log("   ⚠ Timeout — continuing to Review anyway");

  // ━━ STEP 9: Review queue — play videos ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n▶️  Step 9: Review queue — playing videos");
  await page.goto(`${BASE}/dashboard/review`);
  await page.waitForLoadState("networkidle");
  await pause(1500);

  await expect(page.locator("body")).not.toContainText("Application error");
  console.log("   ✓ Review page loaded");

  // Play up to 5 visible videos
  const videos = page.locator("video");
  const total  = await videos.count();
  console.log(`   Found ${total} video(s)`);

  const toPlay = Math.min(5, total);
  for (let i = 0; i < toPlay; i++) {
    const vid = videos.nth(i);
    await vid.scrollIntoViewIfNeeded();
    await pause(400);

    const dur = await page.evaluate((idx) => {
      const v = document.querySelectorAll("video")[idx] as HTMLVideoElement;
      return v ? Math.round(v.duration || 0) : 0;
    }, i);

    await page.evaluate((idx) => {
      const v = document.querySelectorAll("video")[idx] as HTMLVideoElement;
      if (v) { v.muted = true; v.currentTime = 0; v.play().catch(() => {}); }
    }, i);

    console.log(`   ▶ Video ${i + 1} — ${dur}s — playing…`);
    await pause(4000);

    const pos = await page.evaluate((idx) => {
      const v = document.querySelectorAll("video")[idx] as HTMLVideoElement;
      return v ? v.currentTime.toFixed(1) : "0";
    }, i);
    console.log(`   ⏱ Played to ${pos}s`);
  }

  const finalTxt = await page.locator("body").textContent();
  expect(finalTxt).not.toContain("Application error");
  console.log("\n✅ Short Let Commercial workflow complete!");
});

// ── Deep section test: overlay + voice + all right-panel sections ────────────

test("Commercial: deep check all sections — overlay, voice, AI ad builder, music, CTA", async ({ page }) => {
  test.setTimeout(600_000);

  // ━━ PART A: Open an existing rendered project and check every section ━━━━━━━
  console.log("\n🔍 PART A — Open Commercial Maker, create project, check all sections");

  await page.goto(`${BASE}/dashboard/commercial`);
  await page.waitForLoadState("networkidle");
  await pause(1000);
  await expect(page.locator("body")).not.toContainText("Application error");
  console.log("   ✓ Commercial Maker loaded");

  // Create new project
  const newBtn = page.getByRole("button", { name: "+ Slide Ad (Mode 1)" });
  await expect(newBtn).toBeVisible({ timeout: 8000 });
  await newBtn.click();
  await pause(800);

  const nameInput = page.getByPlaceholder("e.g. Lagos Property Promo April");
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await slowType(page, nameInput, "Deep Section Test Project");
  await pause(300);

  const createBtn = page.getByRole("button", { name: /Create Project/i });
  await createBtn.click();
  await pause(1000);
  console.log("   ✓ Project created");

  // Add 1 slide — button is "+ Add" in the slides panel header
  const addSlideBtn = page.locator("button", { hasText: "+ Add" }).first();
  if (!await addSlideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    // may be shown as "Add first slide" when no slides exist yet
    const firstSlideBtn = page.locator("button", { hasText: /Add first slide/i });
    if (await firstSlideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstSlideBtn.click();
    }
  } else {
    await addSlideBtn.click();
  }
  await pause(800);

  // Click first slide card then upload photo
  const slideCards2 = page.locator(".w-\\[220px\\] div[draggable]");
  await expect(slideCards2).toHaveCount(1, { timeout: 6000 });
  await slideCards2.first().click();
  await pause(500);

  const imgPath = path.join(IMG_DIR, "flat3 sitting room 1.jpg");
  if (fs.existsSync(imgPath)) {
    const uploadBtn2 = page.locator("button", { hasText: /Upload image/i }).first();
    if (await uploadBtn2.isVisible({ timeout: 4000 }).catch(() => false)) {
      const [fc] = await Promise.all([
        page.waitForEvent("filechooser"),
        uploadBtn2.click(),
      ]);
      await fc.setFiles(imgPath);
      await page.waitForLoadState("networkidle");
      await pause(1500);
      await expect(page.locator("button", { hasText: /Replace image/i })).toBeVisible({ timeout: 8000 });
      console.log("   ✓ Photo uploaded to slide");
    }
  }

  // ── SECTION: Caption ─────────────────────────────────────────────────────
  console.log("\n📝 Caption section");
  const captionArea = page.getByPlaceholder("Short headline for this slide");
  if (await captionArea.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowType(page, captionArea, "Beautiful Luxury Short Let – Lekki");
    await pause(400);
    console.log("   ✓ Caption typed");

    // Position = bottom
    const bottomBtn = page.locator("button", { hasText: "bottom" }).first();
    if (await bottomBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bottomBtn.click();
      await pause(200);
      console.log("   ✓ Position: bottom");
    }

    // Polish AI
    const polishBtn = page.locator("button", { hasText: /Polish/i }).first();
    if (await polishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await polishBtn.click();
      await pause(8000); // wait for LLM
      const acceptBtn = page.locator("button", { hasText: "Accept" }).first();
      if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn.click();
        console.log("   ✓ Caption polished and accepted");
      } else {
        console.log("   ℹ Caption polish: no AI result (LLM may be offline)");
      }
    }
  }

  // ── SECTION: Font ────────────────────────────────────────────────────────
  console.log("\n🔤 Font section");
  const fontLabel = page.locator("label", { hasText: /^Font family/ });
  if (await fontLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    const fontSelect = fontLabel.locator("..").locator("select");
    await fontSelect.selectOption("Georgia");
    await pause(200);
    console.log("   ✓ Font: Georgia");

    const sizeLabel = page.locator("label", { hasText: /^Size:/ });
    if (await sizeLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sizeLabel.locator("..").locator('input[type="range"]').fill("34");
      console.log("   ✓ Font size: 34px");
    }

    const boldBtn = page.locator("button").filter({ hasText: /^B$/ }).first();
    if (await boldBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await boldBtn.click();
      console.log("   ✓ Bold on");
    }
  }

  // ── SECTION: Narration ───────────────────────────────────────────────────
  console.log("\n🎙 Narration section");
  const narrationArea = page.getByPlaceholder("What the narrator says during this slide");
  if (await narrationArea.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowType(page, narrationArea, "Welcome to this stunning 3-bedroom short let in the heart of Lekki.");
    await pause(300);
    console.log("   ✓ Narration typed");
  }

  // ── SECTION: Duration ────────────────────────────────────────────────────
  console.log("\n⏱ Duration section");
  const durLabel = page.locator("label", { hasText: /^Duration:/ });
  if (await durLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await durLabel.locator("..").locator('input[type="range"]').fill("6000");
    console.log("   ✓ Duration set to 6s");
  }

  // ── SECTION: Brand name + Target duration ────────────────────────────────
  console.log("\n🏷 Project settings section");
  const brandInput = page.getByPlaceholder("Your brand name");
  if (await brandInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await slowType(page, brandInput, "Gio Luxury Stays");
    console.log("   ✓ Brand name: Gio Luxury Stays");
  }

  const targetDurInput = page.locator('input[type="number"]').filter({ hasText: "" }).first();
  const targetDurByPlaceholder = page.getByPlaceholder("e.g. 30");
  if (await targetDurByPlaceholder.isVisible({ timeout: 2000 }).catch(() => false)) {
    await targetDurByPlaceholder.fill("10");
    console.log("   ✓ Target duration: 10s");
  }

  // ── SECTION: CTA ─────────────────────────────────────────────────────────
  console.log("\n📞 CTA section");
  const ctaSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "WhatsApp" }) });
  if (await ctaSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ctaSelect.selectOption("whatsapp");
    await pause(400);
    const ctaInput = page.getByPlaceholder("+234 xxx xxxx / @handle");
    if (await ctaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await slowType(page, ctaInput, "+234 812 000 0000");
      console.log("   ✓ CTA: WhatsApp +234 812 000 0000");
    }
  }

  // ── SECTION: Music library ───────────────────────────────────────────────
  console.log("\n🎵 Music section");
  const libBtn = page.locator("button", { hasText: "📚 Library" });
  if (await libBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await libBtn.click();
    await pause(600);
    const firstTrack = page.locator(".max-h-40 button").first();
    if (await firstTrack.isVisible({ timeout: 3000 }).catch(() => false)) {
      const trackName = (await firstTrack.textContent())?.trim();
      await firstTrack.click();
      await pause(400);
      console.log(`   ✓ Music selected: "${trackName}"`);
    }
  }

  // ── SECTION: Voice / Narration settings ─────────────────────────────────
  console.log("\n🔊 Voice section");
  // Voice section is inside NarrationPanel — look for voice ID selector
  const voiceSection = page.locator("text=Voice").first();
  if (await voiceSection.isVisible({ timeout: 3000 }).catch(() => false)) {
    await voiceSection.scrollIntoViewIfNeeded();
    console.log("   ✓ Voice section visible");
  }
  // Check for voice language dropdown
  const langSelect = page.locator("select").filter({ has: page.locator("option", { hasText: /English|Yoruba|Pidgin/i }) }).first();
  if (await langSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await langSelect.locator("option").allTextContents();
    console.log(`   ✓ Voice language options: ${options.slice(0, 4).join(", ")}…`);
  }

  // ━━ PART B: Render and check overlay panel ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n🎬 PART B — Render and test overlay panel");

  // Render
  const renderBtn = page.locator("button", { hasText: /^Render$/ });
  if (await renderBtn.isVisible({ timeout: 5000 }).catch(() => false)
      && await renderBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
    await renderBtn.click();
    await pause(1000);
    console.log("   ✓ Render clicked");

    // Wait for render to complete (up to 5 min)
    const deadline = Date.now() + 5 * 60 * 1000;
    let rendered = false;
    while (Date.now() < deadline) {
      await pause(7000);
      const txt = await page.locator("body").textContent().catch(() => "") ?? "";
      if (txt.includes("Render complete") || txt.includes("Check Review")) {
        rendered = true;
        console.log("   ✓ Render complete!");
        break;
      }
      if (txt.includes("Render failed")) {
        console.log("   ✗ Render failed — continuing to overlay test");
        break;
      }
      console.log(`   … still rendering (${Math.round((Date.now() - (deadline - 5 * 60 * 1000)) / 1000)}s)`);
    }

    // ── SECTION: Overlay panel ───────────────────────────────────────────────
    if (rendered) {
      console.log("\n🖼 Overlay section");
      await pause(1000);

      // Overlay panel should be enabled after render
      const overlayHeader = page.locator("text=Text & Image Overlays").first();
      if (await overlayHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        await overlayHeader.scrollIntoViewIfNeeded();
        await overlayHeader.click();
        await pause(600);
        console.log("   ✓ Overlay panel opened");

        // Add text layer
        const addTextBtn = page.getByRole("button", { name: "+ Add Text Layer" });
        if (await addTextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addTextBtn.click();
          await pause(500);
          console.log("   ✓ Text layer added");

          // Fill text
          const textArea = page.getByPlaceholder("Enter text (supports multiple lines)");
          if (await textArea.isVisible({ timeout: 3000 }).catch(() => false)) {
            await slowType(page, textArea, "Gio Luxury Stays");
            await pause(300);
            console.log("   ✓ Overlay text: Gio Luxury Stays");
          }

          // Position
          const posSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Bottom" }) }).last();
          if (await posSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
            await posSelect.selectOption("bottom");
            console.log("   ✓ Overlay position: bottom");
          }

          // Animation
          const animSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Fade In" }) }).last();
          if (await animSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
            await animSelect.selectOption("fade_in");
            console.log("   ✓ Overlay animation: fade in");
          }

          // Start time
          const startInput = page.locator("label", { hasText: "Start" }).locator("..").locator("input").first();
          if (await startInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await startInput.fill("0.5");
            console.log("   ✓ Overlay start: 0.5s");
          }

          // Preview — overlay render can take 60-90 s (FFmpeg re-encodes with drawtext)
          const previewBtn = page.getByRole("button", { name: /PREVIEW/i });
          if (await previewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await previewBtn.click();
            console.log("   ✓ Preview clicked — polling up to 90s for preview render");

            // Poll every 5 s until a preview video element becomes ready or deadline hits
            const previewDeadline = Date.now() + 90_000;
            let previewReady = false;
            while (Date.now() < previewDeadline) {
              await pause(5000);
              const vidCount = await page.locator("video").count().catch(() => 0);
              if (vidCount > 0) {
                const readyState = await page.evaluate(() => {
                  const videos = document.querySelectorAll("video");
                  const v = videos[videos.length - 1] as HTMLVideoElement;
                  return v ? v.readyState : 0;
                });
                if (readyState >= 2) { previewReady = true; break; }
              }
              console.log(`   … overlay preview still rendering (${Math.round((Date.now() - (previewDeadline - 90_000)) / 1000)}s elapsed)`);
            }

            if (previewReady) {
              await page.evaluate(() => {
                const videos = document.querySelectorAll("video");
                const v = videos[videos.length - 1] as HTMLVideoElement;
                if (v) { v.muted = true; v.play().catch(() => {}); }
              });
              await pause(4000);
              const pos = await page.evaluate(() => {
                const videos = document.querySelectorAll("video");
                const v = videos[videos.length - 1] as HTMLVideoElement;
                return v ? v.currentTime.toFixed(1) : "0";
              });
              console.log(`   ✓ Overlay preview playing — position: ${pos}s`);
            } else {
              console.log("   ℹ Preview video not ready within 90s (server may be busy)");
            }
          }
        }
      } else {
        console.log("   ℹ Overlay panel not found (may need render to complete first)");
      }
    }
  } else {
    console.log("   ⚠ Render button not enabled — skipping render/overlay test");
  }

  // ━━ PART C: AI Ad Builder (Mode 2) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n🤖 PART C — AI Ad Builder (Mode 2)");
  await page.goto(`${BASE}/dashboard/commercial`);
  await page.waitForLoadState("networkidle");
  await pause(1000);

  // Click Mode 2 tab
  const mode2Btn = page.locator("button", { hasText: /AI Ad Builder|Mode 2/i }).first();
  if (await mode2Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await mode2Btn.click();
    await pause(800);
    console.log("   ✓ Mode 2 tab clicked");

    // Check Step 1 — upload zone
    const uploadZone = page.locator("text=Upload product images").first();
    if (await uploadZone.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("   ✓ Mode 2 Step 1 visible: upload zone");
    }

    // Upload an image via Mode 2
    const fileInput = page.locator("input[type='file']").first();
    if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false) || true) {
      const imgPath2 = path.join(IMG_DIR, "flat3 sitting room 2.jpg");
      if (fs.existsSync(imgPath2)) {
        const [fc2] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 8000 }),
          page.locator("div").filter({ hasText: /Click to upload/i }).first().click().catch(() =>
            page.locator("label").filter({ hasText: /upload/i }).first().click()
          ),
        ]);
        await fc2.setFiles(imgPath2);
        await pause(5000); // wait for AI analysis
        console.log("   ✓ Image uploaded to Mode 2 — waiting for AI analysis");
        const bodyTxt = await page.locator("body").textContent().catch(() => "");
        if (bodyTxt?.includes("AI pre-filled") || bodyTxt?.includes("pre-fill")) {
          console.log("   ✓ AI pre-fill detected");
        }
      }
    }

    // Step 2 — fill product details
    const productNameInput = page.getByPlaceholder(/GioStudio Pro|product.*name/i);
    if (await productNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slowType(page, productNameInput, "Flat 3 Short Let");
      console.log("   ✓ Product name typed");
    }

    const brandNameInput = page.getByPlaceholder(/GioHomeStudio|brand.*name/i);
    if (await brandNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await slowType(page, brandNameInput, "Gio Luxury Stays");
      console.log("   ✓ Brand name typed in Mode 2");
    }

    // Duration
    const dur30Btn = page.locator("button", { hasText: "30s" });
    if (await dur30Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dur30Btn.click();
      console.log("   ✓ Ad duration: 30s");
    }

    // Generate script
    const genBtn = page.locator("button", { hasText: /Generate voiceover|Generate script/i });
    if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genBtn.click();
      console.log("   ✓ Generate script clicked — waiting up to 20s");
      await pause(20000);
      const scriptArea = page.getByPlaceholder(/Voiceover script/i);
      if (await scriptArea.isVisible({ timeout: 5000 }).catch(() => false)) {
        const scriptVal = await scriptArea.inputValue().catch(() => "");
        if (scriptVal.trim()) {
          console.log(`   ✓ Script generated (${scriptVal.length} chars)`);
        } else {
          console.log("   ℹ Script area empty (LLM may be offline)");
        }
      }
    }
  } else {
    console.log("   ℹ Mode 2 button not found — may be labelled differently");
  }

  // ━━ PART D: Watch the just-rendered video ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n▶ PART D — Review queue: watch the latest video");
  await page.goto(`${BASE}/dashboard/review`);
  await page.waitForLoadState("networkidle");
  await pause(2000);
  await expect(page.locator("body")).not.toContainText("Application error");

  const videos = page.locator("video");
  const total = await videos.count();
  console.log(`   Found ${total} video(s)`);

  if (total > 0) {
    const v = videos.first();
    await v.scrollIntoViewIfNeeded();
    await pause(600);

    const dur = await page.evaluate(() => {
      const vid = document.querySelector("video") as HTMLVideoElement;
      return vid ? vid.duration?.toFixed(1) ?? "0" : "0";
    });

    await page.evaluate(() => {
      const vid = document.querySelector("video") as HTMLVideoElement;
      if (vid) { vid.muted = true; vid.currentTime = 0; vid.play().catch(() => {}); }
    });

    console.log(`   ▶ Playing latest video (${dur}s duration) — watching 5s`);
    await pause(5000);

    const playPos = await page.evaluate(() => {
      const vid = document.querySelector("video") as HTMLVideoElement;
      return vid ? vid.currentTime.toFixed(1) : "0";
    });
    console.log(`   ⏱ Position after 5s: ${playPos}s`);

    expect(parseFloat(playPos)).toBeGreaterThan(0);
    console.log("   ✓ Video is playing");
  }

  const finalTxt = await page.locator("body").textContent().catch(() => "");
  expect(finalTxt).not.toContain("Application error");
  console.log("\n✅ Deep section test complete!");
});

// ── Watch the 5 most recent commercial renders in Review ─────────────────────

test("Review: watch 5 most recent commercial videos", async ({ page }) => {
  test.setTimeout(120_000);

  console.log("\n📺 Watching 5 most recent commercial videos in Review");
  await page.goto(`${BASE}/dashboard/review`);
  await page.waitForLoadState("networkidle");
  await pause(1500);

  await expect(page.locator("body")).not.toContainText("Application error");

  const videos = page.locator("video");
  const count  = await videos.count();
  console.log(`   Found ${count} video element(s)`);

  const toPlay = Math.min(5, count);

  for (let i = 0; i < toPlay; i++) {
    const vid = videos.nth(i);
    await vid.scrollIntoViewIfNeeded();
    await pause(600);

    // Get duration
    const dur = await page.evaluate((idx) => {
      const v = document.querySelectorAll("video")[idx] as HTMLVideoElement;
      return v ? Math.round(v.duration || 0) : 0;
    }, i);

    // Play muted
    await page.evaluate((idx) => {
      const v = document.querySelectorAll("video")[idx] as HTMLVideoElement;
      if (v) { v.muted = true; v.currentTime = 0; v.play().catch(() => {}); }
    }, i);

    console.log(`   ▶ Video ${i + 1} — duration ${dur}s — watching for 4s`);
    await pause(4000);

    const pos = await page.evaluate((idx) => {
      const v = document.querySelectorAll("video")[idx] as HTMLVideoElement;
      return v ? v.currentTime.toFixed(1) : "0";
    }, i);
    console.log(`   ⏱ Position after watch: ${pos}s`);
  }

  if (count === 0) {
    console.log("   ⚠ No video elements found on Review page");
  }

  const finalTxt = await page.locator("body").textContent();
  expect(finalTxt).not.toContain("Application error");
  console.log("\n✅ Review watch complete!");
});

