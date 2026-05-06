// AUT verification: hybrid planner tab order + per-scene controls + sound tiers
const { chromium } = require('playwright');

(async () => {
  let browser, ownBrowser = false;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
  } catch {
    browser = await chromium.launch({ headless: false });
    ownBrowser = true;
  }

  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  console.log('Navigating to hybrid planner...');
  await page.goto('http://localhost:3200/dashboard/hybrid-planner', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/tmp/ghs-verify-01-load.png' });

  // --- Tab order check ---
  const tabTexts = await page.evaluate(() => {
    const selectors = [
      '[role="tab"]',
      '[data-testid*="tab"]',
      'button[class*="tab"]',
      'button[class*="Tab"]',
      '[class*="workshop"] button',
      '[class*="Workshop"] button',
    ];
    for (const sel of selectors) {
      const els = Array.from(document.querySelectorAll(sel));
      if (els.length >= 4) return els.map(e => e.textContent?.trim()).filter(Boolean).slice(0, 15);
    }
    // fallback: any nav-like buttons
    return Array.from(document.querySelectorAll('nav button, [class*="nav"] button'))
      .map(e => e.textContent?.trim()).filter(Boolean).slice(0, 15);
  });
  console.log('\nTABS FOUND:', JSON.stringify(tabTexts));

  const expected = ['Design', 'Story', 'Characters', 'Scene Board', 'Sound', 'Screenplay', 'Assembly', 'Overview'];
  const found = tabTexts.map(t => t.replace(/\s+/g, ' ').trim());
  expected.forEach((e, i) => {
    const match = found[i] ? found[i].toLowerCase().includes(e.toLowerCase()) : false;
    console.log(`Tab[${i}] expected="${e}" found="${found[i]||'missing'}" => ${match ? 'OK' : 'FAIL'}`);
  });

  // --- Navigate to Scene Board tab ---
  const sceneBoardBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => b.textContent?.toLowerCase().includes('scene board') || b.textContent?.toLowerCase().includes('scene'));
    if (sb) { sb.click(); return sb.textContent; }
    return null;
  });
  console.log('\nClicked Scene Board tab:', sceneBoardBtn);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/tmp/ghs-verify-02-scene-board.png' });

  // Check per-scene controls
  const sfxBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.filter(b => b.textContent?.toLowerCase().includes('sfx') || b.textContent?.toLowerCase().includes('generate sfx')).map(b => b.textContent?.trim()).slice(0, 5);
  });
  console.log('\nSFX buttons:', JSON.stringify(sfxBtn));

  const motionToggle = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    return inputs.filter(i => {
      const label = i.closest('label')?.textContent || i.parentElement?.textContent || '';
      return label.toLowerCase().includes('motion') || label.toLowerCase().includes('continuous');
    }).length;
  });
  console.log('Continuous motion toggles visible:', motionToggle);

  const durationPicker = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('select'));
    return sels.filter(s => {
      const opts = Array.from(s.options).map(o => o.value);
      return opts.some(v => ['5', '10', '15', '20', '30'].includes(v));
    }).length;
  });
  console.log('Duration pickers (5/10/15/20/30s):', durationPicker);

  // --- Navigate to Sound tab ---
  const soundBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => b.textContent?.toLowerCase().includes('sound') && !b.textContent?.toLowerCase().includes('scene'));
    if (sb) { sb.click(); return sb.textContent; }
    return null;
  });
  console.log('\nClicked Sound tab:', soundBtn);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/tmp/ghs-verify-03-sound-tab.png' });

  const tiers = await page.evaluate(() => {
    const tierLabels = ['GHS Sound', 'GHS Plus', 'GHS Pro', 'GHS Premium'];
    return tierLabels.map(label => {
      const found = Array.from(document.querySelectorAll('*')).some(el =>
        el.childNodes.length === 0 || (el.childNodes.length <= 2 && el.textContent?.includes(label))
      );
      return { label, found };
    });
  });
  console.log('\nSound tiers:', JSON.stringify(tiers));

  // Final summary screenshot
  await page.screenshot({ path: 'C:/tmp/ghs-verify-04-final.png' });
  console.log('\nAll screenshots saved to C:/tmp/ghs-verify-*.png');

  if (ownBrowser) await browser.close();
  process.exit(0);
})().catch(e => {
  console.error('PLAYWRIGHT ERROR:', e.message);
  process.exit(1);
});
