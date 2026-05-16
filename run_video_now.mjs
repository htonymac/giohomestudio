/**
 * Drive Henry's live GHS Chrome tab (port 9222) to make a video.
 * Connects directly to the page-level CDP WebSocket.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3200';
const SS_DIR = 'tests/screenshots';
mkdirSync(SS_DIR, { recursive: true });

async function wait(page, ms) { await page.waitForTimeout(ms); }

async function ss(page, name) {
  const p = `${SS_DIR}/live_${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  [📸] ${p}`);
}

async function clickBtn(page, re, label, timeout = 5000) {
  try {
    const el = page.locator('button').filter({ hasText: re }).first();
    const vis = await el.isVisible({ timeout });
    if (vis) {
      await el.click({ force: true });
      console.log(`  [✓] ${label}`);
      return true;
    }
  } catch(e) {}
  console.log(`  [—] NOT FOUND: ${label}`);
  return false;
}

async function main() {
  console.log('\n═══ Connecting via CDP to GHS page ═══');

  // Use the direct page WebSocket to avoid browser-level CDP handshake timeout
  const wsUrl = 'ws://localhost:9222/devtools/page/052D9EC7104B106134CEE8DC5A89D2A5';
  console.log('  WS:', wsUrl);

  // Use Playwright CDP session directly
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 60000 });
  const contexts = browser.contexts();
  console.log('  Contexts:', contexts.length);

  let page = null;
  for (const ctx of contexts) {
    const pages = ctx.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.includes('localhost:3200')) {
        page = p;
        console.log('  [✓] Found GHS page:', url);
        break;
      }
    }
    if (page) break;
  }

  if (!page) {
    // Open new page in first context
    console.log('  [i] No GHS page found, opening new one...');
    const ctx = contexts[0] || await browser.newContext();
    page = await ctx.newPage();
  }

  // Navigate to hybrid planner
  console.log('\n[1] Navigating to Hybrid Planner...');
  await page.goto(`${BASE}/dashboard/hybrid-planner`, { waitUntil: 'networkidle' });
  await wait(page, 3000);
  await ss(page, '01_planner_loaded');

  // Print current buttons
  const allBtns = await page.locator('button').allInnerTexts();
  const filtered = allBtns.map(b => b.trim()).filter(b => b.length > 1 && b.length < 60);
  console.log('\n[i] Current buttons:', filtered.slice(0, 25).join(' | '));

  // ── Try My Projects ───────────────────────────────────────────────────────
  console.log('\n[2] Opening My Projects...');
  const myProj = page.locator('button').filter({ hasText: /my projects/i }).first();
  if (await myProj.isVisible({ timeout: 4000 }).catch(() => false)) {
    await myProj.click({ force: true });
    await wait(page, 2000);
    await ss(page, '02_my_projects_open');

    // Print what appeared
    const panelBtns = await page.locator('button').allInnerTexts();
    const pf = panelBtns.map(b => b.trim()).filter(b => b.length > 1 && b.length < 60);
    console.log('  [i] After My Projects click:', pf.slice(0, 30).join(' | '));

    // Look for project items
    const items = page.locator('li, [class*=project-item], [class*=projectItem], [class*=project_card]');
    const cnt = await items.count();
    console.log(`  [i] Found ${cnt} list items`);
    if (cnt > 0) {
      await items.first().click({ force: true });
      await wait(page, 2000);
      console.log('  [✓] Clicked first project item');
    }
  } else {
    console.log('  [i] No My Projects button visible');
  }
  await ss(page, '03_after_project_select');

  // ── Find Assembly tab ─────────────────────────────────────────────────────
  console.log('\n[3] Looking for Assembly tab...');
  const btns3 = await page.locator('button').allInnerTexts();
  const f3 = btns3.map(b => b.trim()).filter(b => b.length > 0 && b.length < 60);
  console.log('  All buttons:', f3.join(' | '));

  const assemblyEl = page.locator('button').filter({ hasText: /assembly/i }).first();
  if (await assemblyEl.isVisible({ timeout: 4000 }).catch(() => false)) {
    await assemblyEl.click({ force: true });
    await wait(page, 2000);
    console.log('  [✓] Assembly tab clicked');
    await ss(page, '04_assembly_tab');
  } else {
    console.log('  [!] Assembly tab not found');
    await ss(page, '04_no_assembly');
  }

  // ── AI Pick Music ─────────────────────────────────────────────────────────
  console.log('\n[4] AI Pick Music...');
  await clickBtn(page, /ai pick|pick music|background music/i, 'AI Pick Music');
  await wait(page, 8000);
  await ss(page, '05_music');

  // ── Assemble My Movie ─────────────────────────────────────────────────────
  console.log('\n[5] Looking for Assemble My Movie...');
  const assEl = page.locator('button').filter({ hasText: /assemble my movie/i }).first();
  const assVisible = await assEl.isVisible({ timeout: 5000 }).catch(() => false);
  const assDisabled = assVisible ? await assEl.isDisabled() : true;
  console.log(`  visible: ${assVisible} | disabled: ${assDisabled}`);

  if (!assVisible) {
    // Print all visible buttons to debug
    const ab = await page.locator('button').allInnerTexts();
    console.log('  All assembly page buttons:', ab.map(b => b.trim()).filter(b => b.length > 1 && b.length < 60).join(' | '));
  }

  if (assVisible && !assDisabled) {
    console.log('\n[6] ASSEMBLING VIDEO...');
    await assEl.click({ force: true });
    await wait(page, 30000);
    await ss(page, '06_assembling_30s');
    await wait(page, 30000);
    await ss(page, '06_assembling_60s');
    await wait(page, 30000);
    await ss(page, '06_assembled_90s');
  } else if (assVisible && assDisabled) {
    console.log('\n[6] Button disabled — checking page content...');
    const bodyText = await page.locator('body').innerText();
    const lines = bodyText.split('\n').filter(l => l.trim().length > 3 && l.trim().length < 100).slice(0, 20);
    console.log('  Page snippet:', lines.join(' | '));
    await ss(page, '06_disabled_state');
  } else {
    await ss(page, '06_no_button');
  }

  // ── Review ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/review`, { waitUntil: 'networkidle' });
  await wait(page, 2000);
  await ss(page, '07_review');

  // ── Registry ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/registry`, { waitUntil: 'networkidle' });
  await wait(page, 2000);
  await ss(page, '08_registry');

  console.log('\n═══ DONE. Check tests/screenshots/ for results ═══');
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
