import { test, chromium } from '@playwright/test';

const PAGES = [
  { name: 'commercial-planner', path: '/dashboard/commercial-planner' },
  { name: 'movie-planner',      path: '/dashboard/movie-planner' },
  { name: 'children-planner',   path: '/dashboard/children-planner' },
  { name: 'music-video-planner',path: '/dashboard/music-video-planner' },
  { name: 'series-wizard',      path: '/dashboard/series-wizard' },
  { name: 'overview',           path: '/dashboard/overview' },
  { name: 'hybrid-planner',     path: '/dashboard/hybrid-planner' },
];

test('v14 batch 3 — all 7 planner pages render clean', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const results: Record<string, any> = {};

  for (const p of PAGES) {
    const errors: string[] = [];
    const onErr = (e: Error) => errors.push(`pageerror: ${e.message}`);
    const onMsg = (m: any) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); };
    page.on('pageerror', onErr);
    page.on('console', onMsg);

    try {
      await page.goto(`http://localhost:3200${p.path}?v=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      await page.waitForTimeout(2500);

      const info = await page.evaluate(() => {
        const body = document.body;
        const hasBuildError = /Build Error|Module not found|Unhandled Runtime Error/.test(body.innerText);
        const bodyBg = getComputedStyle(body).backgroundColor;
        const main = document.querySelector('main') || body;
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u;
        const hasEmoji = emojiRegex.test(main.innerText || '');
        // look for any blur/backdrop-filter in computed styles on any element (sample first 500)
        const nodes = Array.from(document.querySelectorAll('*')).slice(0, 500) as HTMLElement[];
        const hasBlur = nodes.some(n => {
          const cs = getComputedStyle(n);
          return /blur\(/.test(cs.backdropFilter || '') || /blur\(/.test((cs as any).filter || '');
        });
        return { hasBuildError, bodyBg, hasEmoji, hasBlur };
      });

      await page.screenshot({ path: `v14-b3-${p.name}.png`, fullPage: false });
      results[p.name] = { ...info, errors: errors.length, errorSample: errors.slice(0, 3) };
    } catch (e: any) {
      results[p.name] = { err: e.message };
    } finally {
      page.off('pageerror', onErr);
      page.off('console', onMsg);
    }
  }

  console.log('---V14 BATCH 3 VERIFY---');
  for (const [name, r] of Object.entries(results)) {
    console.log(`${name}:`, JSON.stringify(r));
  }
  console.log('---END---');

  await browser.close();
});
