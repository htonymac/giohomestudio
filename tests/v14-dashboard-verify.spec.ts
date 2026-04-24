import { test, expect, chromium } from '@playwright/test';

test('v14 dashboard — fresh navigation, no build error, v14 tokens live', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`); });

  // Cache bust
  await page.goto(`http://localhost:3200/dashboard?v14=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForTimeout(2000);

  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const hasBuildError = await page.evaluate(() => /Build Error|Module not found/.test(document.body.innerText));
  const h1Text = await page.evaluate(() => {
    const h1 = document.querySelector('h1, .h1, [class*="HeroTitle" i]') as HTMLElement | null;
    return h1 ? h1.innerText.slice(0, 120) : null;
  });
  const cardBgs = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.card, [class*="Card" i]'))
      .slice(0, 5) as HTMLElement[];
    return nodes.map(n => getComputedStyle(n).backgroundColor);
  });
  const hasEmoji = await page.evaluate(() => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/u;
    const main = document.querySelector('main') || document.body;
    return emojiRegex.test(main.innerText);
  });

  await page.screenshot({ path: 'v14-dashboard-fresh.png', fullPage: true });

  console.log('---V14 DASHBOARD VERIFY---');
  console.log('build error present:', hasBuildError);
  console.log('body bg:', bodyBg);
  console.log('h1 text:', h1Text);
  console.log('card bgs (first 5):', cardBgs);
  console.log('emoji in main:', hasEmoji);
  console.log('console errors:', consoleErrors.length);
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 10).join('\n'));
  console.log('---END---');

  expect(hasBuildError).toBe(false);
  expect(bodyBg).toMatch(/rgb\(14,\s*14,\s*16\)/);

  await browser.close();
});
