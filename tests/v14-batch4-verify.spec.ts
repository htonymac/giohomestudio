import { test, chromium } from '@playwright/test';

const PAGES = [
  { name: 'video-tools',          path: '/dashboard/video-tools' },
  { name: 'video-trimmer',        path: '/dashboard/video-trimmer' },
  { name: 'scene-forge',          path: '/dashboard/scene-forge' },
  { name: 'video-finishing',      path: '/dashboard/video-finishing' },
  { name: 'video-editor',         path: '/dashboard/video-editor' },
  { name: 'ad-editor',            path: '/dashboard/ad-editor' },
  { name: 'collaborative-editor', path: '/dashboard/collaborative-editor' },
];

test('v14 batch 4 — 7 editor pages build + render', async () => {
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
        const emojiCount = (body.innerText.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu) || []).length;
        return { hasBuildError, bodyBg, emojiCount };
      });
      await page.screenshot({ path: `v14-b4-${p.name}.png`, fullPage: false });
      results[p.name] = { ...info, errors: errors.length, err0: errors[0] };
    } catch (e: any) {
      results[p.name] = { err: e.message.slice(0, 150) };
    } finally {
      page.off('pageerror', onErr);
      page.off('console', onMsg);
    }
  }

  console.log('---V14 BATCH 4 VERIFY---');
  for (const [n, r] of Object.entries(results)) console.log(`${n}:`, JSON.stringify(r));
  console.log('---END---');
  await browser.close();
});
