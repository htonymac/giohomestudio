// Verify hybrid planner: tab order, per-scene controls, sound tiers
const { chromium } = require('playwright');

(async () => {
  let browser, ownBrowser = false;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('Connected to debug Chrome on :9222');
  } catch {
    browser = await chromium.launch({ headless: false, slowMo: 100 });
    ownBrowser = true;
    console.log('Launched fresh browser');
  }

  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('http://localhost:3200/dashboard/hybrid-planner', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/tmp/ghs-v2-01-load.png' });
  console.log('Page loaded');

  // --- Tab order: look in the workshop/planner section buttons ---
  const tabInfo = await page.evaluate(() => {
    // Try: buttons inside a container that has 6-10 buttons in a row (workshop tabs)
    const allButtons = Array.from(document.querySelectorAll('button'));

    // Group adjacent buttons that look like tabs (short text, likely in header area)
    const candidates = allButtons.filter(b => {
      const t = b.textContent?.trim() ?? '';
      return t.length < 40 && t.length > 2;
    });

    // Find a run of 7+ buttons with tab-like text
    const expected = ['design', 'story', 'character', 'scene', 'sound', 'screenplay', 'assembly', 'overview'];
    const tabRun = [];
    for (const btn of candidates) {
      const t = btn.textContent?.trim().toLowerCase() ?? '';
      if (expected.some(e => t.includes(e))) {
        tabRun.push({ text: btn.textContent?.trim(), active: btn.getAttribute('aria-selected') === 'true' || btn.classList.contains('active') || btn.classList.contains('selected') });
      }
    }
    return tabRun;
  });

  console.log('\nWorkshop tabs found:');
  tabInfo.forEach((t, i) => console.log(`  [${i}] ${t.text}${t.active ? ' (ACTIVE)' : ''}`));

  // Detect expected order
  const expectedOrder = ['Design', 'Story', 'Characters', 'Scene Board', 'Sound', 'Screenplay', 'Assembly', 'Overview'];
  const foundTexts = tabInfo.map(t => t.text ?? '');
  let orderCorrect = true;
  expectedOrder.forEach((e, i) => {
    const match = foundTexts[i]?.toLowerCase().includes(e.toLowerCase());
    if (!match) {
      orderCorrect = false;
      console.log(`  TAB ORDER ISSUE: pos ${i} expected "${e}", got "${foundTexts[i] || 'missing'}"`);
    }
  });
  if (orderCorrect) console.log('  TAB ORDER: CORRECT ✓');

  // --- Click Scene Board ---
  const sceneBoardClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => b.textContent?.trim().toLowerCase().includes('scene board'));
    if (sb) { sb.click(); return true; }
    // fallback: find "Scenes" button
    const fb = btns.find(b => {
      const t = b.textContent?.trim().toLowerCase();
      return t === 'scene board' || t === 'scenes' || t === 'scene board✓' || t?.includes('scene board');
    });
    if (fb) { fb.click(); return fb.textContent?.trim(); }
    return false;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/ghs-v2-02-scene-board.png' });
  console.log('\nScene Board clicked:', sceneBoardClicked);

  // Check per-scene SFX/motion/duration
  const perSceneControls = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return {
      sfxButtonFound: text.includes('generate sfx') || text.includes('ai sfx') || (document.querySelectorAll('[data-testid*="sfx"]').length > 0),
      motionToggleFound: text.includes('continuous') || text.includes('motion'),
      durationFound: text.includes('5s') || text.includes('10s') || text.includes('15s') || document.querySelectorAll('select').length > 0,
      sceneCardCount: document.querySelectorAll('[class*="scene-card"],[data-testid*="scene"]').length,
    };
  });
  console.log('Per-scene controls:', JSON.stringify(perSceneControls));

  // --- Click Sound tab ---
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => {
      const t = b.textContent?.trim().toLowerCase();
      return (t === 'sound' || t === 'sound & sfx' || t?.includes('sound')) && !t.includes('scene');
    });
    if (sb) sb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/ghs-v2-03-sound.png' });

  const tierCheck = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      ghsSound: text.includes('GHS Sound'),
      ghsPlus: text.includes('GHS Plus'),
      ghsPro: text.includes('GHS Pro'),
      ghsPremium: text.includes('GHS Premium'),
    };
  });
  console.log('\nSound tiers:', JSON.stringify(tierCheck));
  const allTiersOk = Object.values(tierCheck).every(Boolean);
  console.log('Sound tiers all present:', allTiersOk ? 'YES ✓' : 'NO - MISSING TIERS');

  // --- Final screenshot ---
  await page.screenshot({ path: 'C:/tmp/ghs-v2-04-sound-tab.png' });

  // Send AUT summary
  const pass = allTiersOk;
  const summary = `GHS Hybrid Planner AUT verify: tabs=${tabInfo.length} found, tiers=${allTiersOk ? 'ALL OK' : 'MISSING'}, scene controls=${JSON.stringify(perSceneControls)}`;
  console.log('\nSUMMARY:', summary);

  try {
    const r = await fetch('http://localhost:8503/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `[GHS AUT VERIFY] ${summary}` }),
    });
    console.log('AUT notified:', r.status);
  } catch { console.log('AUT not reachable — skipping notify'); }

  if (ownBrowser) await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => {
  console.error('PLAYWRIGHT ERROR:', e.message);
  process.exit(1);
});
