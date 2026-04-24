import { test, chromium } from '@playwright/test';

const PAGES = [
  // AI tools
  { name: 'ai-motion-video', path: '/dashboard/ai-motion-video' },
  { name: 'short-video',     path: '/dashboard/short-video' },
  { name: 'viral-video',     path: '/dashboard/viral-video' },
  { name: 'auto-creator',    path: '/dashboard/auto-creator' },
  { name: 'free-mode',       path: '/dashboard/free-mode' },
  { name: 'ab-testing',      path: '/dashboard/ab-testing' },
  // Management
  { name: 'character-voices',     path: '/dashboard/character-voices' },
  { name: 'character-voices-id',  path: '/dashboard/character-voices/test-id' },
  { name: 'calendar',             path: '/dashboard/calendar' },
  { name: 'budget',               path: '/dashboard/budget' },
  { name: 'registry',             path: '/dashboard/registry' },
  { name: 'destination-pages',    path: '/dashboard/destination-pages' },
  { name: 'story-bank',           path: '/dashboard/story-bank' },
  { name: 'templates',            path: '/dashboard/templates' },
  { name: 'analytics',            path: '/dashboard/analytics' },
  { name: 'publishing',           path: '/dashboard/publishing' },
];

test('v14 batch 6 — 16 tool+mgmt pages build + render', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const results: Record<string, any> = {};

  for (const p of PAGES) {
    const errors: string[] = [];
    const onErr = (e: Error) => errors.push(e.message.slice(0, 120));
    const onMsg = (m: any) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); };
    page.on('pageerror', onErr);
    page.on('console', onMsg);

    try {
      await page.goto(`http://localhost:3200${p.path}?v=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2000);
      const info = await page.evaluate(() => {
        const body = document.body;
        const hasBuildError = /Build Error|Module not found|Unhandled Runtime Error/.test(body.innerText);
        const bodyBg = getComputedStyle(body).backgroundColor;
        const emojiCount = (body.innerText.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        return { hasBuildError, bodyBg, emojiCount };
      });
      results[p.name] = { ...info, errors: errors.length, err0: errors[0] };
    } catch (e: any) {
      results[p.name] = { err: e.message.slice(0, 120) };
    } finally {
      page.off('pageerror', onErr);
      page.off('console', onMsg);
    }
  }

  console.log('---V14 BATCH 6 VERIFY---');
  for (const [n, r] of Object.entries(results)) console.log(`${n}:`, JSON.stringify(r));
  console.log('---END---');
  await browser.close();
});
