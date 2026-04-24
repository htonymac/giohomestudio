import { test, chromium } from '@playwright/test';

test('v15 — stat cards hover + render queue empty state + LIVE pill', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });

  await page.goto(`http://localhost:3200/dashboard?v=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForTimeout(2000);

  // Find all .stat cards
  const statCount = await page.evaluate(() => document.querySelectorAll('.stat').length);

  // Hover the first stat card — check transform and animation changes
  const firstStat = page.locator('.stat').first();
  await firstStat.scrollIntoViewIfNeeded();
  await firstStat.hover();
  await page.waitForTimeout(400);

  const hoverInfo = await page.evaluate(() => {
    const s = document.querySelector('.stat') as HTMLElement | null;
    const val = s?.querySelector('.val') as HTMLElement | null;
    const sparkPath = s?.querySelector('.spark path') as SVGPathElement | null;
    return {
      statTranslate: s ? (getComputedStyle(s) as any).translate : null,
      statBorderColor: s ? getComputedStyle(s).borderColor : null,
      statBoxShadow: s ? getComputedStyle(s).boxShadow : null,
      valAnimation: val ? getComputedStyle(val).animationName : null,
      sparkDashArray: sparkPath ? getComputedStyle(sparkPath).strokeDasharray : null,
      sparkAnimation: sparkPath ? getComputedStyle(sparkPath).animationName : null,
    };
  });

  // Check render queue empty state — no color blocks, has dashed card
  const renderInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasEmptyCopy = /Start a generation/i.test(text);
    const hasOldCopy = /No active renders\. Start a generation to see progress here\./.test(text);
    // Check for dashed border card
    const dashedBorder = Array.from(document.querySelectorAll('*')).some((el) => {
      const cs = getComputedStyle(el as Element);
      return cs.borderStyle === 'dashed';
    });
    // Check LIVE pill — is it pulsing? find its dot
    const livePill = Array.from(document.querySelectorAll('.pill-live')).find((el) =>
      /LIVE/i.test((el as HTMLElement).innerText || '')
    ) as HTMLElement | undefined;
    const liveDot = livePill?.querySelector('span') as HTMLElement | undefined;
    const liveAnim = liveDot ? getComputedStyle(liveDot).animationName : null;
    const isPulse = !!livePill?.classList.contains('pulse');
    return { hasEmptyCopy, hasOldCopy, dashedBorder, liveAnim, isPulse };
  });

  await page.screenshot({ path: 'v15-dashboard-hover.png', fullPage: true });

  console.log('---V15 DASHBOARD CHECK---');
  console.log('stat count:', statCount);
  console.log('stat hover:', JSON.stringify(hoverInfo));
  console.log('render queue:', JSON.stringify(renderInfo));
  console.log('console errors:', errors.length);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  console.log('---END---');

  await browser.close();
});
