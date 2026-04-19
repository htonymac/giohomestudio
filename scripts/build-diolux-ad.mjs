/**
 * Diolux Serviced Apartments — Commercial Ad Builder
 * Builds a full 9:16 promotional slide ad using the Commercial Maker.
 * Run: node scripts/build-diolux-ad.mjs
 */

import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const BASE      = "http://localhost:3200";
const IMAGES_DIR = "C:/Users/USER/Desktop/CLAUDE/giohomestudio/update/Images";
const SHOT_DIR  = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "pw-shots");
fs.mkdirSync(SHOT_DIR, { recursive: true });

// ── Image groups by room/category ──────────────────────────────────────────────
// We pick the single best representative image per category for a clean 11-slide ad.
const SLIDE_PLAN = [
  // Slide 1 — Hero: exterior / building
  {
    imageFile: "building.jpg",
    caption: "Diolux Serviced Apartments\nComfort you'll love",
    narration: "Welcome to Diolux Serviced Apartments — where comfort meets elegance.",
    durationMs: 5000,
  },
  // Slide 2 — Living room (best flat4 sitting room)
  {
    imageFile: "flat4 sitting room 1.jpg",
    caption: "Stylish Living Spaces",
    narration: "Unwind in our beautifully designed living rooms.",
    durationMs: 4000,
  },
  // Slide 3 — Living room variety (flat3)
  {
    imageFile: "flat3 sitting room 1.jpg",
    caption: "Every Detail Thoughtfully Done",
    narration: "Each apartment is designed with attention to every detail.",
    durationMs: 4000,
  },
  // Slide 4 — Bedroom (flat4)
  {
    imageFile: "flat4 bedroom 1.jpg",
    caption: "Spacious Bedrooms",
    narration: "Rest easy in our spacious, well-furnished bedrooms.",
    durationMs: 4000,
  },
  // Slide 5 — Bedroom (flat3)
  {
    imageFile: "flat3 bedroom 1.jpg",
    caption: "Your Perfect Retreat",
    narration: "Wake up refreshed every morning in your private retreat.",
    durationMs: 4000,
  },
  // Slide 6 — Kitchen (flat4)
  {
    imageFile: "flat4 kitchen 1.jpg",
    caption: "Modern Kitchen",
    narration: "Cook, create and entertain in our fully equipped modern kitchens.",
    durationMs: 4000,
  },
  // Slide 7 — Kitchen (flat2)
  {
    imageFile: "flat2-kitchen.jpg",
    caption: "Fully Equipped for You",
    narration: "Everything you need is right here, ready and waiting.",
    durationMs: 4000,
  },
  // Slide 8 — Bathroom
  {
    imageFile: "flat3 toilet 4.jpg",
    caption: "Elegant Bathrooms",
    narration: "Refresh and recharge in our pristine elegant bathrooms.",
    durationMs: 4000,
  },
  // Slide 9 — Sitout / balcony (flat4)
  {
    imageFile: "flat4 sitout.jpg",
    caption: "Your Home Away from Home",
    narration: "Step out and breathe — a perfect space to relax after a long day.",
    durationMs: 4000,
  },
  // Slide 10 — Flat2 living room variety
  {
    imageFile: "flat2-living.jpg",
    caption: "Short-Let · Long-Let · Premium Stays",
    narration: "Available for short-let and long-let. Premium stays at great value.",
    durationMs: 4000,
  },
  // Slide 11 — Closing CTA
  {
    imageFile: "flat4 sitting room 2.jpg",
    caption: "Book Your Stay Today\ndioluxapartments.com\nCall / WhatsApp: +234 9025147449",
    narration: "Book your stay today. Visit dioluxapartments.com or call us on WhatsApp.",
    durationMs: 5000,
  },
];

const PROJECT_SETTINGS = {
  brandName:          "Diolux Serviced Apartments",
  tagline:            "Comfort you'll love",
  ctaMethod:          "whatsapp",
  ctaValue:           "+2349025147449",
  ctaLabel:           "Book Now",
  transitionType:     "fade",
  renderQuality:      "cinema",
  aspectRatio:        "9:16",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

let shotIdx = 0;
async function shot(page, name) {
  const file = path.join(SHOT_DIR, `diolux-${String(++shotIdx).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
}

function log(msg) { console.log(`[BUILD] ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Fill a text input/textarea by clicking it, clearing it, then typing char by char
async function fillInput(page, selector, text) {
  const el = page.locator(selector).first();
  await el.click({ timeout: 8000 });
  await wait(150);
  // Select all and clear
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await wait(100);
  // Type the text (handles multi-line with Enter)
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    await el.type(lines[i], { delay: 30 });
    if (i < lines.length - 1) await page.keyboard.press("Enter");
  }
  await wait(200);
}

// Upload a file to an <input type="file"> via setInputFiles — works even if hidden
async function uploadFileToInput(page, inputLocator, filePath) {
  await inputLocator.setInputFiles(filePath);
  await wait(1500); // Give time for upload request to fire + UI to update
}

// ── Main ───────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({
  headless: false,
  slowMo: 60,
  args: ["--start-maximized"],
});
const ctx  = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

// Track failed network requests
const networkFails = [];
page.on("requestfailed", req => networkFails.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`));

let createdProject = null;

try {
  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Navigate to Commercial Maker
  // ────────────────────────────────────────────────────────────────────────────
  log("Navigating to /dashboard/commercial …");
  await page.goto(`${BASE}/dashboard/commercial`, { waitUntil: "networkidle", timeout: 30000 });
  await wait(800);
  await shot(page, "01-commercial-list");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Click "New Slide Ad"
  // ────────────────────────────────────────────────────────────────────────────
  log("Clicking New Slide Ad button …");
  const newBtn = page.locator("button").filter({ hasText: /new slide ad|create first/i }).first();
  await newBtn.click({ timeout: 8000 });
  await wait(600);
  await shot(page, "02-new-project-form");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Fill new project form
  // ────────────────────────────────────────────────────────────────────────────
  log("Filling project name …");
  const nameInput = page.locator("input[placeholder*='Lagos Property'], input[placeholder*='project'], input[type='text']").first();
  await nameInput.click({ timeout: 5000 });
  await page.keyboard.press("Control+a");
  await nameInput.type("Diolux Serviced Apartments", { delay: 40 });
  await wait(300);

  log("Filling brand name …");
  const brandInput = page.locator("input[placeholder*='GioHomeStudio'], input[placeholder*='brand']").first();
  await brandInput.click({ timeout: 5000 });
  await page.keyboard.press("Control+a");
  await brandInput.type("Diolux Serviced Apartments", { delay: 40 });
  await wait(300);

  log("Selecting 9:16 aspect ratio …");
  const ratio916Btn = page.locator("button").filter({ hasText: "9:16" }).first();
  await ratio916Btn.click({ timeout: 5000 });
  await wait(300);

  await shot(page, "03-form-filled");

  log("Clicking Create Project …");
  const createBtn = page.locator("button").filter({ hasText: /create project/i }).first();
  await createBtn.click({ timeout: 8000 });

  // Wait for the editor to load (slides panel should appear)
  await page.waitForSelector("button:has-text('+ Add Slide'), button:has-text('Add Slide'), [data-testid='add-slide']", { timeout: 15000 })
    .catch(async () => {
      log("Looking for any editor indicator …");
      await page.waitForTimeout(3000);
    });

  await wait(1000);
  await shot(page, "04-editor-loaded");

  // Try to get the project ID from the URL or API — we'll need it for direct API calls
  const currentUrl = page.url();
  log(`Editor URL: ${currentUrl}`);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Fetch the project we just created to get its ID
  // ────────────────────────────────────────────────────────────────────────────
  log("Fetching project list to get created project ID …");
  const projectsResp = await page.evaluate(async () => {
    const r = await fetch("/api/commercial/projects");
    return r.json();
  });

  if (!Array.isArray(projectsResp) || projectsResp.length === 0) {
    throw new Error("No projects returned from API after creation");
  }

  // The newest project (last in list, or highest slideOrder) is what we created
  createdProject = projectsResp.find(p => p.projectName === "Diolux Serviced Apartments")
    ?? projectsResp[projectsResp.length - 1];

  log(`Project ID: ${createdProject.id} — Name: ${createdProject.projectName}`);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 5 — Patch project-level settings via API (fast, avoids fragile UI)
  // ────────────────────────────────────────────────────────────────────────────
  log("Patching project settings (brand, CTA, transition, quality) via API …");
  const patchResult = await page.evaluate(async ({ projId, settings }) => {
    const r = await fetch(`/api/commercial/projects/${projId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    return { ok: r.ok, status: r.status };
  }, {
    projId: createdProject.id,
    settings: {
      brandName:         PROJECT_SETTINGS.brandName,
      tagline:           PROJECT_SETTINGS.tagline,
      ctaMethod:         PROJECT_SETTINGS.ctaMethod,
      ctaValue:          PROJECT_SETTINGS.ctaValue,
      ctaLabel:          PROJECT_SETTINGS.ctaLabel,
      transitionType:    PROJECT_SETTINGS.transitionType,
      renderQuality:     PROJECT_SETTINGS.renderQuality,
    },
  });
  log(`Project patch: ${patchResult.ok ? "OK" : "FAILED"} (HTTP ${patchResult.status})`);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 6 — Create all slides via batch API, then upload images + patch captions
  // ────────────────────────────────────────────────────────────────────────────
  log(`Creating ${SLIDE_PLAN.length} slides via batch API …`);

  const batchResp = await page.evaluate(async ({ projId, count }) => {
    const r = await fetch(`/api/commercial/projects/${projId}/slides?batch=${count}`, {
      method: "POST",
    });
    return r.json();
  }, { projId: createdProject.id, count: SLIDE_PLAN.length });

  if (!Array.isArray(batchResp) || batchResp.length === 0) {
    throw new Error("Batch slide creation failed: " + JSON.stringify(batchResp));
  }

  log(`Batch created ${batchResp.length} slides.`);
  const createdSlides = batchResp;

  // ── Upload images + patch captions one by one ─────────────────────────────
  for (let i = 0; i < SLIDE_PLAN.length; i++) {
    const plan  = SLIDE_PLAN[i];
    const slide = createdSlides[i];
    const imgPath = path.join(IMAGES_DIR, plan.imageFile);

    if (!fs.existsSync(imgPath)) {
      warn(`Image not found: ${imgPath} — skipping upload for slide ${i + 1}`);
    } else {
      log(`[Slide ${i + 1}/${SLIDE_PLAN.length}] Uploading: ${plan.imageFile} …`);

      // Upload via API using a multipart form. We use Node's fetch + FormData (Node 18+)
      const uploadResult = await page.evaluate(async ({ projId, slideId, imgDataB64, imgName }) => {
        // Convert base64 to blob
        const byteChars = atob(imgDataB64);
        const byteNums  = new Uint8Array(byteChars.length);
        for (let j = 0; j < byteChars.length; j++) byteNums[j] = byteChars.charCodeAt(j);
        const blob = new Blob([byteNums], { type: "image/jpeg" });
        const fd   = new FormData();
        fd.append("image", blob, imgName);
        const r = await fetch(`/api/commercial/projects/${projId}/slides/${slideId}/image`, {
          method: "POST",
          body: fd,
        });
        const text = await r.text();
        return { ok: r.ok, status: r.status, body: text.slice(0, 300) };
      }, {
        projId:     createdProject.id,
        slideId:    slide.id,
        imgDataB64: fs.readFileSync(imgPath).toString("base64"),
        imgName:    plan.imageFile,
      });

      if (uploadResult.ok) {
        log(`  ✓ Image uploaded (HTTP ${uploadResult.status})`);
      } else {
        warn(`  ✗ Upload failed (HTTP ${uploadResult.status}): ${uploadResult.body}`);
      }
    }

    // Patch caption, narration, duration
    log(`  Setting caption + narration for slide ${i + 1} …`);
    const patchSlide = await page.evaluate(async ({ projId, slideId, data }) => {
      const r = await fetch(`/api/commercial/projects/${projId}/slides/${slideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { ok: r.ok, status: r.status };
    }, {
      projId:  createdProject.id,
      slideId: slide.id,
      data: {
        captionOriginal:  plan.caption,
        captionPolished:  plan.caption,
        captionApproved:  true,
        narrationLine:    plan.narration,
        durationMs:       plan.durationMs,
        brandingEnabled:  true,
      },
    });

    if (!patchSlide.ok) {
      warn(`  ✗ Slide patch failed (HTTP ${patchSlide.status})`);
    } else {
      log(`  ✓ Slide ${i + 1} configured.`);
    }

    await wait(200);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 7 — Reload the page so the editor shows the populated project
  // ────────────────────────────────────────────────────────────────────────────
  log("Reloading editor to verify all slides are visible …");
  await page.reload({ waitUntil: "networkidle", timeout: 30000 });
  await wait(1000);

  // Click into the project
  const projBtn = page.locator("button, div").filter({ hasText: "Diolux Serviced Apartments" }).first();
  const projBtnCount = await projBtn.count();
  if (projBtnCount > 0) {
    await projBtn.click({ timeout: 5000 });
    await wait(1000);
  }

  await shot(page, "05-slides-loaded");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 8 — Apply project settings via the UI (Brand, CTA, Transition, Quality)
  // ────────────────────────────────────────────────────────────────────────────
  log("Looking for Brand Name field in settings panel …");

  // Scroll to find the settings section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);

  // Try to fill brand name in the right panel
  const brandFieldLabel = page.locator("text=Brand name, text=Brand / business, label:has-text('brand')").first();
  const brandFieldCount = await brandFieldLabel.count();
  if (brandFieldCount > 0) {
    log("Found brand field via label, filling …");
    const brandField = page.locator("input").near(brandFieldLabel).first();
    await brandField.click({ timeout: 3000 }).catch(() => {});
    await page.keyboard.press("Control+a");
    await brandField.type("Diolux Serviced Apartments", { delay: 30 });
    await wait(500);
  } else {
    log("Brand field not found in UI (already set via API).");
  }

  // Try to set transition to "fade"
  const fadeBtn = page.locator("button").filter({ hasText: /Fade|fade/i }).first();
  const fadeBtnCount = await fadeBtn.count();
  if (fadeBtnCount > 0) {
    log("Selecting Fade transition …");
    await fadeBtn.click({ timeout: 3000 }).catch(() => {});
    await wait(300);
  }

  // Try to set quality to Cinema
  const cinemaBtn = page.locator("button").filter({ hasText: /cinema|Cinema/i }).first();
  const cinemaBtnCount = await cinemaBtn.count();
  if (cinemaBtnCount > 0) {
    log("Selecting Cinema quality …");
    await cinemaBtn.click({ timeout: 3000 }).catch(() => {});
    await wait(300);
  }

  await shot(page, "06-settings-applied");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 9 — Click Render
  // ────────────────────────────────────────────────────────────────────────────
  log("Searching for Render button …");
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);

  const renderBtn = page.locator("button").filter({ hasText: /🚀\s*Render|Render Ad|Render/i }).first();
  const renderBtnCount = await renderBtn.count();
  log(`Render button found: ${renderBtnCount > 0}`);

  if (renderBtnCount > 0) {
    const isDisabled = await renderBtn.isDisabled();
    log(`Render button disabled: ${isDisabled}`);

    if (isDisabled) {
      // Try via API directly
      log("Render button is disabled — triggering render via API …");
    }
  }

  // Trigger render via API (most reliable)
  log("Triggering render via API …");
  const renderResult = await page.evaluate(async (projId) => {
    const r = await fetch(`/api/commercial/projects/${projId}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, body: text.slice(0, 500) };
  }, createdProject.id);

  log(`Render API: HTTP ${renderResult.status} — ${renderResult.body}`);

  if (!renderResult.ok) {
    warn("Render API call was not successful. Trying render button click as fallback …");
    if (renderBtnCount > 0) {
      const [renderResp] = await Promise.all([
        page.waitForResponse(r => r.url().includes("/render"), { timeout: 15000 }).catch(() => null),
        renderBtn.click({ timeout: 5000 }).catch(() => {}),
      ]);
      if (renderResp) {
        const body = await renderResp.text().catch(() => "");
        log(`Render button response: HTTP ${renderResp.status()} — ${body.slice(0, 200)}`);
      }
    }
  }

  await wait(2000);
  await shot(page, "07-render-triggered");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 10 — Poll render status for up to 3 minutes
  // ────────────────────────────────────────────────────────────────────────────
  log("Polling render status …");
  let renderDone = false;
  let renderStatus = "rendering";
  const pollEnd = Date.now() + 3 * 60 * 1000; // 3 min max

  while (Date.now() < pollEnd) {
    await wait(5000);

    const statusCheck = await page.evaluate(async (projId) => {
      const r = await fetch(`/api/commercial/projects/${projId}`);
      if (!r.ok) return null;
      const data = await r.json();
      return data.renderStatus ?? "unknown";
    }, createdProject.id);

    renderStatus = statusCheck ?? renderStatus;
    log(`  render status: ${renderStatus}`);

    if (renderStatus === "ready" || renderStatus === "failed") {
      renderDone = true;
      break;
    }
  }

  await shot(page, "08-render-final");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 11 — Final summary
  // ────────────────────────────────────────────────────────────────────────────
  const totalDurationSec = SLIDE_PLAN.reduce((acc, s) => acc + s.durationMs / 1000, 0);

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  DIOLUX AD BUILD — SUMMARY");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  Project ID   : ${createdProject?.id}`);
  console.log(`  Project Name : Diolux Serviced Apartments`);
  console.log(`  Aspect Ratio : 9:16 (Instagram / WhatsApp / TikTok)`);
  console.log(`  Total Slides : ${SLIDE_PLAN.length}`);
  console.log(`  Total Duration: ${totalDurationSec}s`);
  console.log(`  Render Status: ${renderDone ? renderStatus : "still rendering / timed out"}`);
  console.log("  ── Slide Plan ──────────────────────────────────────────");
  SLIDE_PLAN.forEach((s, i) => {
    const firstLine = s.caption.split("\n")[0];
    console.log(`  Slide ${String(i + 1).padStart(2, " ")}: [${s.imageFile.padEnd(35)}] "${firstLine}"`);
  });
  console.log("  ── Image Groups ────────────────────────────────────────");
  console.log("  Building   : building.jpg");
  console.log("  Flat 2     : flat2-living, flat2-kitchen (2 slides)");
  console.log("  Flat 3     : flat3 sitting room 1, flat3 bedroom 1, flat3 toilet 4 (3 slides)");
  console.log("  Flat 4     : flat4 sitting room 1+2, flat4 bedroom 1, flat4 kitchen 1, flat4 sitout (5 slides)");
  console.log("  ── Console Errors ─────────────────────────────────────");
  if (consoleErrors.length === 0) {
    console.log("  ✅ None");
  } else {
    consoleErrors.forEach(e => console.log(`  ❌ ${e}`));
  }
  if (networkFails.length > 0) {
    console.log("  ── Network Failures ───────────────────────────────────");
    networkFails.forEach(e => console.log(`  ❌ ${e}`));
  }
  console.log(`  Screenshots: ${SHOT_DIR}`);
  console.log("══════════════════════════════════════════════════════════\n");

} catch (err) {
  console.error("[BUILD] FATAL ERROR:", err.message);
  await shot(page, "error-state").catch(() => {});
} finally {
  await wait(3000);
  await browser.close();
}
