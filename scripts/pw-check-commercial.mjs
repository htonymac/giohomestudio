/**
 * Playwright check: Commercial dashboard render flow
 * Run: node scripts/pw-check-commercial.mjs
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const BASE = "http://localhost:3200";
const SHOT_DIR = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "pw-shots");
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIdx = 0;
async function shot(page, name) {
  const file = path.join(SHOT_DIR, `${String(++shotIdx).padStart(2,"0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}`);
}

async function log(msg) { console.log(`[PW] ${msg}`); }

const browser = await chromium.launch({ headless: false, slowMo: 80 });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// Capture console errors from the app
const consoleErrors = [];
page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

try {
  // ── 1. Load commercial dashboard ──────────────────────────────────────────
  log("Loading /dashboard/commercial ...");
  await page.goto(`${BASE}/dashboard/commercial`, { waitUntil: "networkidle", timeout: 30000 });
  await shot(page, "01-dashboard-load");
  log("Page title: " + await page.title());

  // ── 2. Find a project to work with ────────────────────────────────────────
  const projectCards = await page.locator('[data-testid="project-card"], .project-card').count();
  log(`Project cards found: ${projectCards}`);

  // Try to find and click the first project
  const firstProject = page.locator("text=/Diolux|Deep Section|Flat 3|TRR4/i").first();
  const projectName = await firstProject.textContent({ timeout: 5000 }).catch(() => null);
  if (projectName) {
    log(`Clicking project: ${projectName.trim()}`);
    await firstProject.click();
    await page.waitForTimeout(1000);
    await shot(page, "02-project-selected");
  } else {
    log("No project text found — checking full page content...");
    await shot(page, "02-no-projects");
  }

  // ── 3. Check render button state ──────────────────────────────────────────
  const renderBtn = page.locator("button").filter({ hasText: /render|Render/i }).first();
  const renderBtnCount = await renderBtn.count();
  log(`Render button found: ${renderBtnCount > 0}`);

  if (renderBtnCount > 0) {
    const renderBtnText = await renderBtn.textContent();
    const renderBtnDisabled = await renderBtn.isDisabled();
    log(`Render button text: "${renderBtnText?.trim()}" | disabled: ${renderBtnDisabled}`);
    await shot(page, "03-render-button");
  }

  // ── 4. Check renderStatus display ─────────────────────────────────────────
  const statusTexts = await page.locator("text=/rendering|ready|failed|draft/i").all();
  for (const el of statusTexts.slice(0, 5)) {
    const txt = await el.textContent().catch(() => "");
    if (txt?.trim()) log(`Status text found: "${txt.trim()}"`);
  }

  // ── 5. Try clicking render and observe what happens ───────────────────────
  if (renderBtnCount > 0 && !(await renderBtn.isDisabled())) {
    log("Clicking render button...");

    // Intercept the render API call
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes("/render") && r.request().method() === "POST", { timeout: 10000 }).catch(() => null),
      renderBtn.click(),
    ]);

    if (response) {
      const status = response.status();
      const body = await response.text().catch(() => "");
      log(`Render API response: ${status} — ${body.slice(0, 200)}`);
    } else {
      log("No render API call detected within 10s");
    }

    await page.waitForTimeout(2000);
    await shot(page, "04-after-render-click");

    // Watch for any toast/alert messages
    const toasts = await page.locator('[role="alert"], .toast, [class*="toast"], [class*="alert"]').all();
    for (const t of toasts) {
      const txt = await t.textContent().catch(() => "");
      if (txt?.trim()) log(`Toast/alert: "${txt.trim()}"`);
    }

    // Check if status changed
    const renderMsg = await page.locator("text=/rendering|render complete|check review|failed/i").first().textContent({ timeout: 5000 }).catch(() => null);
    if (renderMsg) log(`Render message: "${renderMsg.trim()}"`);
  }

  // ── 6. Check for any visible errors ───────────────────────────────────────
  await shot(page, "05-final-state");

  // Network errors
  const netErrors = [];
  page.on("requestfailed", req => netErrors.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`));
  await page.waitForTimeout(1000);

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("══════════════════════════════════════════");
  if (consoleErrors.length > 0) {
    console.log("Console errors:");
    consoleErrors.forEach(e => console.log("  ❌", e));
  } else {
    console.log("  ✅ No console errors");
  }
  if (netErrors.length > 0) {
    console.log("Network failures:");
    netErrors.forEach(e => console.log("  ❌", e));
  }
  console.log(`Screenshots saved to: ${SHOT_DIR}`);

} catch (err) {
  console.error("[PW] ERROR:", err.message);
  await shot(page, "error-state").catch(() => {});
} finally {
  await page.waitForTimeout(2000);
  await browser.close();
}
