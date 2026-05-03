const { chromium } = require('playwright');

(async () => {
  const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Test list API directly
    log('[1] Testing list API...');
    await page.goto('http://localhost:3200/dashboard/hybrid-planner', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const listRes = await page.evaluate(async () => {
      const r = await fetch('/api/hybrid/saved-state?list=true');
      return { status: r.status, data: await r.json() };
    });
    log(`[1] List API → ${listRes.status}, projects: ${JSON.stringify((listRes.data?.projects || []).map(p => p.title))}`);

    // 2. Click My Projects button
    log('[2] Clicking My Projects...');
    await page.screenshot({ path: 'C:/tmp/proj-01-loaded.png', fullPage: false }).catch(() => {});
    const myProjBtn = page.locator('button').filter({ hasText: 'My Projects' }).first();
    const myProjCount = await myProjBtn.count();
    log(`[2] My Projects button found: ${myProjCount}`);

    if (myProjCount) {
      await myProjBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'C:/tmp/proj-02-panel.png', fullPage: false }).catch(() => {});

      const emptyMsg = await page.locator('text=No saved projects yet').isVisible().catch(() => false);
      const panelOpen = await page.locator('text=My Projects — Click a folder').isVisible().catch(() => false);
      log(`[2] Panel opened: ${panelOpen}, empty message: ${emptyMsg}`);

      if (!emptyMsg) {
        // Count project cards in the grid
        const allText = await page.locator('div').filter({ hasText: 'OPEN' }).count().catch(() => 0);
        log(`[2] OPEN badge count: ${allText}`);
      }
    }

    // 3. Save and check list updates
    log('[3] Setting title + clicking Save...');
    const titleInput = page.locator('input[placeholder="Movie Title"]');
    if (await titleInput.count()) {
      await titleInput.fill('Henry Alpha Project');
      await page.waitForTimeout(500);
    }
    const saveBtn = page.locator('button').filter({ hasText: /^Save$/ }).first();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await page.waitForTimeout(2500);
      log('[3] Saved');
    }

    // Check list again
    const listRes2 = await page.evaluate(async () => {
      const r = await fetch('/api/hybrid/saved-state?list=true');
      return await r.json();
    });
    log(`[3] List after save: ${JSON.stringify((listRes2?.projects || []).map(p => ({ title: p.title, id: p.id })))}`);

    // 4. New Project
    log('[4] New Project...');
    const newBtn = page.locator('button').filter({ hasText: 'New Project' }).first();
    if (await newBtn.count()) {
      await newBtn.click();
      await page.waitForTimeout(1500);
      const urlAfter = page.url();
      log(`[4] URL after New Project: ${urlAfter}`);
      log(`[4] URL has proj_ ID: ${urlAfter.includes('proj_') ? 'YES ✅' : 'NO ❌'}`);
      await page.screenshot({ path: 'C:/tmp/proj-03-new.png', fullPage: false }).catch(() => {});
    }

    log('ALL DONE');
  } catch (err) {
    log(`FAIL: ${err.message}\n${err.stack}`);
    process.exit(1);
  }
  process.exit(0);
})();
