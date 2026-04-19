import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Create video
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
await page.locator('[data-testid="creation-mode"]').selectOption('ghs_invtext');
await page.locator('select').filter({ hasText: 'GHS Standard (Free)' }).selectOption('standard');
await page.waitForTimeout(500);
await page.locator('[data-testid="invtext-prompt"]').fill('PUPPIES FOR SALE. ONLY 50K NAIRA. PETWORLD LEKKI. CALL NOW!');
await page.locator('[data-testid="invtext-ai-build"]').click();

// Wait for pipeline
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(5000);
  if (await page.locator('video').isVisible().catch(() => false)) { console.log('Video at ' + (i+1)*5 + 's'); break; }
}

// Play in editor - screenshot every 2s to catch text on different slides
await page.locator('[data-testid="play-pause"]').click().catch(() => {});
for (let i = 1; i <= 6; i++) {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `test-results/textcheck-editor-${i}.png` });
  const t = await page.evaluate(() => document.querySelector('video')?.currentTime?.toFixed(1) || '?');
  console.log(`Editor frame ${i} at ${t}s`);
}

// Go to library, open video, play it, screenshot
await page.goto('http://localhost:3200/dashboard/assets');
await page.waitForTimeout(3000);
await page.locator('.card, [style*="overflow: hidden"]').first().click();
await page.waitForTimeout(1000);
const mv = page.locator('video[controls]');
if (await mv.isVisible()) {
  await mv.click();
  for (let i = 1; i <= 4; i++) {
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `test-results/textcheck-library-${i}.png` });
    const t = await page.evaluate(() => document.querySelector('video[controls]')?.currentTime?.toFixed(1) || '?');
    console.log(`Library frame ${i} at ${t}s`);
  }
}

console.log('Done - check test-results/textcheck-*.png');
await browser.close();
