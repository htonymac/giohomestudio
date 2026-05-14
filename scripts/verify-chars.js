// Verify character card features: style picker, editable description, Photo→AI button
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

  await page.goto('http://localhost:3200/dashboard/hybrid-planner', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Navigate to Characters tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const cb = btns.find(b => (b.textContent || '').replace(/[✓\d]/g, '').trim().toLowerCase() === 'characters');
    if (cb) cb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/chars-01-tab.png' });

  const pageText = await page.evaluate(() => document.body.innerText);

  // Check features
  const hasStylePicker = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    return selects.some(s => {
      const opts = Array.from(s.options).map(o => o.value);
      return opts.includes('realistic') && opts.includes('3d-cinematic');
    });
  });

  const hasPhotoAiBtn = pageText.includes('Photo → AI') || pageText.includes('Photo→AI');
  const hasCancelSfx = pageText.includes('Cancel SFX') || pageText.includes('Run Auto SFX');

  // Check description textarea
  const hasEditableDesc = await page.evaluate(() => {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    return textareas.some(t => (t.placeholder || '').toLowerCase().includes('visual') || (t.placeholder || '').toLowerCase().includes('description'));
  });

  // Navigate to Sound tab to check Auto SFX cancel
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => {
      const t = (b.textContent || '').replace(/[✓\d]/g, '').trim().toLowerCase();
      return t === 'sound' || t === 'sound & sfx';
    });
    if (sb) sb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/chars-02-sound.png' });
  const soundText = await page.evaluate(() => document.body.innerText);
  const hasCancelBtn = soundText.includes('Cancel SFX') || soundText.includes('Run Auto SFX');

  console.log('\n=== CHARACTER + SFX VERIFY ===');
  console.log('Per-character style picker (select with realistic/3d-cinematic):', hasStylePicker ? '✓' : '✗');
  console.log('Photo → AI button:', hasPhotoAiBtn ? '✓' : '✗');
  console.log('Editable description textarea:', hasEditableDesc ? '✓' : '✗');
  console.log('Auto SFX control (Run/Cancel):', hasCancelBtn ? '✓' : '✗');

  await page.screenshot({ path: 'C:/tmp/chars-03-final.png' });
  if (ownBrowser) await browser.close();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
