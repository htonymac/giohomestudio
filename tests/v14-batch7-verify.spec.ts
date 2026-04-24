import { test, chromium } from '@playwright/test';

const PAGES = [
  { name: 'settings',           path: '/dashboard/settings' },
  { name: 'settings-appearance',path: '/dashboard/settings/appearance' },
  { name: 'settings-finance',   path: '/dashboard/settings/finance' },
  { name: 'account',            path: '/dashboard/account' },
  { name: 'models',             path: '/dashboard/models' },
  { name: 'studio-updates',     path: '/dashboard/studio-updates' },
  { name: 'root',               path: '/' },
  { name: 'login',              path: '/login' },
  { name: 'register',           path: '/register' },
  { name: 'privacy',            path: '/privacy' },
  { name: 'terms',              path: '/terms' },
];

test('v14 batch 7 — 11 settings/auth/root pages', async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  const results: Record<string, any> = {};
  for (const p of PAGES) {
    const errors: string[] = [];
    const onErr = (e: Error) => errors.push(e.message.slice(0, 120));
    const onMsg = (m: any) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); };
    page.on('pageerror', onErr); page.on('console', onMsg);
    try {
      await page.goto(`http://localhost:3200${p.path}?v=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(1800);
      const info = await page.evaluate(() => {
        const body = document.body;
        return {
          hasBuildError: /Build Error|Module not found|Unhandled Runtime Error/.test(body.innerText),
          bodyBg: getComputedStyle(body).backgroundColor,
          emojiCount: (body.innerText.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
        };
      });
      results[p.name] = { ...info, errors: errors.length, err0: errors[0] };
    } catch (e: any) {
      results[p.name] = { err: e.message.slice(0, 120) };
    } finally {
      page.off('pageerror', onErr); page.off('console', onMsg);
    }
  }
  console.log('---V14 BATCH 7 VERIFY---');
  for (const [n, r] of Object.entries(results)) console.log(`${n}:`, JSON.stringify(r));
  console.log('---END---');
  await browser.close();
});
