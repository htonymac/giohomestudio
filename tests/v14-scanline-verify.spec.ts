import { test, chromium } from '@playwright/test';

test('v14 — scanlines gone from dashboard thumbs', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`http://localhost:3200/dashboard?v=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForTimeout(1500);
  const anyScanline = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('div')) as HTMLElement[];
    return nodes.some(n => /repeating-linear-gradient\s*\(\s*0deg\s*,\s*rgba\(0,\s*0,\s*0/.test(getComputedStyle(n).backgroundImage || ''));
  });
  await page.screenshot({ path: 'v14-no-scanlines.png', fullPage: true });
  console.log('scanline overlay present:', anyScanline);
  await browser.close();
});
