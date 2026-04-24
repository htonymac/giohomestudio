import { test, chromium } from '@playwright/test';

const PAGES = [
  { name: 'sfx-library',   path: '/dashboard/sfx-library' },
  { name: 'commercial',    path: '/dashboard/commercial' },
  { name: 'movie-creator', path: '/dashboard/movie-creator' },
  { name: 'children-video',path: '/dashboard/children-video' },
  { name: 'music-video',   path: '/dashboard/music-video' },
  { name: 'music-studio',  path: '/dashboard/music-studio' },
  { name: 'review',        path: '/dashboard/review' },
  { name: 'assets',        path: '/dashboard/assets' },
];

test('v14 batch 5 — 8 content pages build + render', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const results: Record<string, any> = {};

  for (const p of PAGES) {
    const errors: string[] = [];
    const onErr = (e: Error) => errors.push(e.message.slice(0, 150));
    const onMsg = (m: any) => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); };
    page.on('pageerror', onErr);
    page.on('console', onMsg);

    try {
      await page.goto(`http://localhost:3200${p.path}?v=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const body = document.body;
        const hasBuildError = /Build Error|Module not found|Unhandled Runtime Error/.test(body.innerText);
        const bodyBg = getComputedStyle(body).backgroundColor;
        const emojiCount = (body.innerText.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        const hasHero = !!document.querySelector('h1.h1, .h1');
        return { hasBuildError, bodyBg, emojiCount, hasHero };
      });
      await page.screenshot({ path: `v14-b5-${p.name}.png`, fullPage: false });
      results[p.name] = { ...info, errors: errors.length, err0: errors[0] };
    } catch (e: any) {
      results[p.name] = { err: e.message.slice(0, 150) };
    } finally {
      page.off('pageerror', onErr);
      page.off('console', onMsg);
    }
  }

  console.log('---V14 BATCH 5 VERIFY---');
  for (const [n, r] of Object.entries(results)) console.log(`${n}:`, JSON.stringify(r));
  console.log('---END---');
  await browser.close();
});
