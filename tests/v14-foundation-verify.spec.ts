import { test, expect, chromium } from '@playwright/test';

// v14 Foundation verify — connects to debug Chrome :9222 (no new browser).
test('v14 foundation — dashboard renders with correct tokens', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`); });

  await page.goto('http://localhost:3200/dashboard', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1500);

  // Body background
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Sidebar background — find the <aside> element
  const sidebarBg = await page.evaluate(() => {
    const el = document.querySelector('aside, [data-sidebar], nav[class*="Sidebar" i]') as HTMLElement | null;
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  // Font family on body
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  // Check Geist actually loaded (check document.fonts)
  const fontsLoaded = await page.evaluate(async () => {
    await (document as any).fonts.ready;
    const families: string[] = [];
    (document as any).fonts.forEach((f: any) => families.push(f.family));
    return Array.from(new Set(families));
  });
  // Check for brand dot presence
  const brandDotExists = await page.evaluate(() => {
    return !!document.querySelector('.brand-dot, [class*="brand"]');
  });
  // Screenshot
  await page.screenshot({ path: 'v14-foundation-dashboard.png', fullPage: true });

  console.log('---V14 FOUNDATION VERIFY---');
  console.log('body bg:', bodyBg);
  console.log('sidebar bg:', sidebarBg);
  console.log('body font:', bodyFont);
  console.log('fonts loaded:', fontsLoaded);
  console.log('brand dot exists:', brandDotExists);
  console.log('console errors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
  console.log('---END---');

  // Assertions — soft, log-first
  // Body bg should be rgb(14, 14, 16) = #0e0e10
  expect(bodyBg).toMatch(/rgb\(14,\s*14,\s*16\)/);
  expect(bodyFont.toLowerCase()).toContain('geist');
  expect(fontsLoaded.some((f) => /geist/i.test(f))).toBe(true);

  await browser.close();
});
