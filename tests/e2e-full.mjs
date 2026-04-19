import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

console.log('=== 1. CREATE INVTEXT VIDEO ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
await page.locator('[data-testid="creation-mode"]').selectOption('ghs_invtext');
await page.locator('select').filter({ hasText: 'GHS Standard (Free)' }).selectOption('standard');
await page.waitForTimeout(500);
await page.locator('[data-testid="invtext-prompt"]').fill('Cute Chihuahua puppies for sale. Only 50K naira. Visit PetWorld Lekki. Call 0801234567!');
await page.locator('[data-testid="invtext-ai-build"]').click();

let videoReady = false;
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(5000);
  videoReady = await page.locator('video').isVisible().catch(() => false);
  if (videoReady) { console.log('Video ready at ' + ((i+1)*5) + 's'); break; }
}
if (!videoReady) { console.log('ERROR: No video'); await browser.close(); process.exit(1); }

console.log('\n=== 2. PLAY IN EDITOR ===');
await page.locator('[data-testid="play-pause"]').click();
await page.waitForTimeout(3000);
let s = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.currentTime.toFixed(1)+'/'+v.duration.toFixed(1) : 'none'; });
console.log('Playing:', s);
await page.screenshot({ path: 'test-results/e2e-1-playing.png' });

console.log('\n=== 3. AI EDIT ===');
await page.click('text=AI Edit');
await page.waitForTimeout(300);
await page.locator('text=Scene 2').first().click();
await page.waitForTimeout(300);
await page.click('text=AI Edit');
await page.waitForTimeout(300);
const editBox = page.locator('textarea[placeholder*="Type instruction"]');
await editBox.fill('change text to PREMIUM QUALITY GUARANTEED');
await editBox.press('Enter');
await page.waitForTimeout(1500);
await page.locator('text=Scene 2').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/e2e-2-edited.png' });
const editedText = await page.locator('[data-testid^="overlay"]').textContent().catch(() => 'NOT FOUND');
console.log('Edited overlay:', editedText);

console.log('\n=== 4. REASSEMBLE ===');
await page.locator('text=Assemble & Export').click();
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(5000);
  const ready = await page.evaluate(() => { const v = document.querySelector('video'); return v && v.duration > 0; });
  if (ready) { console.log('Reassembled at ' + ((i+1)*5) + 's'); break; }
}
await page.locator('[data-testid="play-pause"]').click().catch(() => {});
await page.waitForTimeout(3000);
s = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.currentTime.toFixed(1)+'/'+v.duration.toFixed(1) : 'none'; });
console.log('Reassembled playing:', s);
await page.screenshot({ path: 'test-results/e2e-3-reassembled.png' });

console.log('\n=== 5. KEYBOARD ===');
await page.locator('video').click();
await page.keyboard.press('Home');
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(800);
const kTime = await page.evaluate(() => document.querySelector('video')?.currentTime || 0);
console.log('Space+play time:', kTime.toFixed(2));
await page.keyboard.press('KeyK');
await page.waitForTimeout(200);
await page.keyboard.press('KeyI');
await page.waitForTimeout(200);
const inM = await page.locator('[data-testid="in-point-marker"]').isVisible().catch(() => false);
console.log('In-point marker:', inM);

console.log('\n=== 6. FOLDERS ===');
const expBtn = page.locator('button').filter({ hasText: '▶' }).first();
if (await expBtn.isVisible()) { await expBtn.click(); await page.waitForTimeout(300); }
await page.screenshot({ path: 'test-results/e2e-4-folder.png' });
console.log('Delete scene btn:', await page.locator('text=Delete scene').isVisible().catch(() => false));

console.log('\n=== 7. VOLUME ===');
await page.click('text=Properties');
await page.waitForTimeout(300);
console.log('Narr slider:', await page.locator('[data-testid="narration-volume"]').isVisible().catch(() => false));
console.log('Music slider:', await page.locator('[data-testid="music-volume"]').isVisible().catch(() => false));
console.log('LIVE label:', await page.locator('text=Volume changes are LIVE').isVisible().catch(() => false));

console.log('\n=== 8. ASSETS LIBRARY ===');
await page.goto('http://localhost:3200/dashboard/assets');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/e2e-5-assets.png' });
const cards = page.locator('.card, [style*="overflow: hidden"]');
console.log('Asset cards:', await cards.count());
await cards.first().click();
await page.waitForTimeout(1500);
const mv = page.locator('video[controls]');
const mvVis = await mv.isVisible().catch(() => false);
console.log('Modal video:', mvVis);
if (mvVis) {
  await mv.click();
  await page.waitForTimeout(3000);
  const ls = await page.evaluate(() => { const v = document.querySelector('video[controls]'); return v ? {t:v.currentTime.toFixed(1),d:v.duration.toFixed(1),p:v.paused} : null; });
  console.log('Library playback:', JSON.stringify(ls));
  await page.screenshot({ path: 'test-results/e2e-6-library-play.png' });
}
const dl = page.locator('a[download]').first();
if (await dl.isVisible()) {
  const href = await dl.getAttribute('href');
  const url = href.startsWith('http') ? href : 'http://localhost:3200' + href;
  const r = await page.request.head(url);
  console.log('Download:', r.status(), r.headers()['content-type']);
}
await page.locator('button').filter({ hasText: 'Close' }).click().catch(() => {});

console.log('\n=== 9. REGISTRY ===');
await page.goto('http://localhost:3200/dashboard/registry');
await page.waitForTimeout(2000);
console.log('Registry rows:', await page.locator('tr').count());
await page.screenshot({ path: 'test-results/e2e-7-registry.png' });

console.log('\n=== 10. MODES ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 10000 });
const modes = await page.locator('[data-testid="creation-mode"] option').allTextContents();
console.log('Modes:', modes.join(' | '));
await page.locator('[data-testid="creation-mode"]').selectOption('ai_motion');
await page.waitForTimeout(500);
console.log('V2V:', await page.locator('[data-testid="motion-v2v"]').isVisible());
console.log('I2V:', await page.locator('[data-testid="motion-i2v"]').isVisible());
console.log('IV2V:', await page.locator('[data-testid="motion-iv2v"]').isVisible());

console.log('\n============================');
console.log('=== ALL CHECKS COMPLETE ===');
console.log('============================');
await browser.close();
