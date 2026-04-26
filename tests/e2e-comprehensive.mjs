import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
let pass = 0, fail = 0;
function ok(name, result) { if (result) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } }

// ═══ TEST 1: Build slides + narration ═══
console.log('\n=== TEST 1: Build + Narration ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
await page.locator('[data-testid="creation-mode"]').selectOption('ghs_invtext');
await page.locator('select').filter({ hasText: 'GHS Standard (Free)' }).selectOption('standard');
await page.waitForTimeout(500);
await page.locator('[data-testid="invtext-prompt"]').fill('Amazing dogs for sale. Premium quality. Visit our store today.');
await page.locator('text=Build Only').click();
await page.waitForTimeout(5000);
ok('Slides created', await page.locator('text=Scene 1').first().isVisible().catch(() => false));
await page.click('text=Properties');
await page.waitForTimeout(300);
const narrText = await page.locator('textarea[placeholder*="Write narration"]').inputValue();
ok('Narration text populated', narrText.length > 5);
await page.locator('button', { hasText: 'Generate Voice' }).click();
// Wait up to 20s for Piper TTS (variable speed)
for (let w = 0; w < 20; w++) {
  await page.waitForTimeout(1000);
  if (await page.locator('text=Audio ready').isVisible().catch(() => false)) break;
  if (await page.locator('text=/Voice generated/').isVisible().catch(() => false)) break;
}
const audioReady = await page.locator('text=Audio ready').isVisible().catch(() => false);
const voiceGenChat = await page.locator('text=/Voice generated|voice generated/i').isVisible().catch(() => false);
ok('Narration audio generated', audioReady || voiceGenChat);
await page.screenshot({ path: 'test-results/comp-1-narration.png' });

// ═══ TEST 2: Assemble with narration ═══
console.log('\n=== TEST 2: Assemble ===');
await page.locator('text=Assemble & Export').click();
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000);
  if (await page.locator('video').isVisible().catch(() => false)) break;
}
const hasVideo = await page.locator('video').isVisible().catch(() => false);
ok('Video produced', hasVideo);
if (hasVideo) {
  await page.locator('[data-testid="play-pause"]').click().catch(() => {});
  await page.waitForTimeout(3000);
  const t = await page.evaluate(() => document.querySelector('video')?.currentTime || 0);
  ok('Video plays (time > 0)', t > 0);
}
await page.screenshot({ path: 'test-results/comp-2-assembled.png' });

// ═══ TEST 3: No double text overlay ═══
console.log('\n=== TEST 3: No double text ===');
const overlayCount = await page.locator('[data-testid^="overlay-"]').count();
ok('No CSS overlay on assembled video', overlayCount === 0);
await page.screenshot({ path: 'test-results/comp-3-no-double.png' });

// ═══ TEST 4: Library plays ═══
console.log('\n=== TEST 4: Library ===');
await page.goto('http://localhost:3200/dashboard/assets');
await page.waitForTimeout(3000);
const cards = page.locator('.card, [style*="overflow: hidden"]');
ok('Assets in library', await cards.count() > 0);
await cards.first().click();
await page.waitForTimeout(2000);
const modalVideo = await page.locator('video[controls]').isVisible().catch(() => false);
ok('Library modal has video', modalVideo);
if (modalVideo) {
  await page.locator('video[controls]').click();
  await page.waitForTimeout(3000);
  const libTime = await page.evaluate(() => document.querySelector('video[controls]')?.currentTime || 0);
  ok('Library video plays', libTime > 0);
}
const dlBtn = await page.locator('a[download]').first().isVisible().catch(() => false);
ok('Download button exists', dlBtn);
if (dlBtn) {
  const href = await page.locator('a[download]').first().getAttribute('href');
  const url = href.startsWith('http') ? href : 'http://localhost:3200' + href;
  const r = await page.request.head(url);
  ok('Download file exists (200)', r.status() === 200);
  ok('Download is video/mp4', r.headers()['content-type']?.includes('video'));
}
await page.locator('button').filter({ hasText: 'Close' }).click().catch(() => {});
await page.screenshot({ path: 'test-results/comp-4-library.png' });

// ═══ TEST 5: Design panel ═══
console.log('\n=== TEST 5: Design Panel ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
await page.locator('[data-testid="creation-mode"]').selectOption('ghs_invtext');
await page.waitForTimeout(500);
await page.click('text=Design & Background');
await page.waitForTimeout(500);
ok('Design panel opens', await page.locator('text=Typography Style').isVisible().catch(() => false));
ok('Color pickers visible', await page.locator('input[type="color"]').first().isVisible().catch(() => false));
ok('Gradient presets visible', await page.getByRole('button', { name: 'Sunset', exact: true }).isVisible().catch(() => false));
ok('Font selector visible', await page.locator('select').filter({ hasText: 'Segoe UI' }).isVisible().catch(() => false));
// Change gradient
await page.getByRole('button', { name: 'Sunset', exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/comp-5-design.png' });

// ═══ TEST 6: Keyboard shortcuts ═══
console.log('\n=== TEST 6: Keyboard ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
await page.click('text=Upload File');
await page.waitForSelector('text=Import Into Editor');
const path = await import('path');
await page.locator('input[type="file"][data-testid="import-file"]').setInputFiles(path.resolve('storage/demo/action_clip1.mp4'));
await page.waitForSelector('video', { timeout: 15000 });
await page.waitForTimeout(1500);
await page.locator('video').click();
await page.keyboard.press('Space');
await page.waitForTimeout(800);
const spaceTime = await page.evaluate(() => document.querySelector('video')?.currentTime || 0);
ok('Space plays video', spaceTime > 0);
await page.keyboard.press('KeyK');
await page.waitForTimeout(200);
await page.keyboard.press('Home');
await page.waitForTimeout(200);
const homeTime = await page.evaluate(() => document.querySelector('video')?.currentTime || 0);
ok('Home seeks to start', homeTime < 0.5);
await page.keyboard.press('KeyI');
await page.waitForTimeout(200);
ok('I sets in-point', await page.locator('[data-testid="in-point-marker"]').isVisible().catch(() => false));
await page.screenshot({ path: 'test-results/comp-6-keyboard.png' });

// ═══ TEST 7: Scene folders + drag ═══
console.log('\n=== TEST 7: Folders + Drag ===');
ok('Scene folder visible', await page.locator('text=Scene 1').first().isVisible().catch(() => false));
ok('Drag handle visible', await page.locator('text=⠿').first().isVisible().catch(() => false));
// Click scene folder expand (not sidebar expand)
const sceneExpands = page.locator('button').filter({ hasText: '▶' });
for (let ei = 0; ei < await sceneExpands.count(); ei++) {
  const btn = sceneExpands.nth(ei);
  const txt = await btn.textContent();
  if (txt?.trim() === '▶') { await btn.click(); await page.waitForTimeout(300); break; }
}
ok('Delete scene button', await page.locator('text=Delete scene').isVisible().catch(() => false));
await page.screenshot({ path: 'test-results/comp-7-folders.png' });

// ═══ TEST 8: Volume sliders ═══
console.log('\n=== TEST 8: Volume ===');
await page.click('text=Properties');
await page.waitForTimeout(300);
ok('Narration slider', await page.locator('[data-testid="narration-volume"]').isVisible().catch(() => false));
ok('Music slider', await page.locator('[data-testid="music-volume"]').isVisible().catch(() => false));
ok('SFX slider', await page.locator('[data-testid="sfx-volume"]').isVisible().catch(() => false));
ok('LIVE label', await page.locator('text=Volume changes are LIVE').isVisible().catch(() => false));

// ═══ TEST 9: AI Edit changes text ═══
console.log('\n=== TEST 9: AI Edit ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
await page.locator('[data-testid="creation-mode"]').selectOption('ghs_invtext');
await page.locator('select').filter({ hasText: 'GHS Standard (Free)' }).selectOption('standard');
await page.waitForTimeout(500);
await page.locator('[data-testid="invtext-prompt"]').fill('Test text. Change me.');
await page.locator('text=Build Only').click();
await page.waitForTimeout(5000);
await page.click('text=AI Edit');
await page.waitForTimeout(300);
const editBox = page.locator('textarea[placeholder*="Type instruction"]');
await editBox.fill('change text to NEW TEXT HERE');
await editBox.press('Enter');
await page.waitForTimeout(1500);
await page.locator('text=Scene 1').first().click();
await page.waitForTimeout(500);
const editedOverlay = await page.locator('[data-testid^="overlay"]').textContent().catch(() => '');
ok('AI Edit changed text', editedOverlay.includes('NEW TEXT HERE'));
await page.screenshot({ path: 'test-results/comp-9-edit.png' });

// ═══ TEST 10: All modes exist ═══
console.log('\n=== TEST 10: Modes ===');
await page.goto('http://localhost:3200/dashboard/collaborative-editor');
await page.waitForSelector('text=Start Creating', { timeout: 15000 });
const modes = await page.locator('[data-testid="creation-mode"] option').allTextContents();
ok('4 modes exist', modes.length === 4);
ok('InvText mode', modes.some(m => m.includes('InvText')));
ok('Text→Video mode', modes.some(m => m.includes('Text→Video')));
ok('Hybrid mode', modes.some(m => m.includes('Hybrid')));
ok('AI Motion mode', modes.some(m => m.includes('AI Motion')));
await page.locator('[data-testid="creation-mode"]').selectOption('ai_motion');
await page.waitForTimeout(500);
ok('V2V card', await page.locator('[data-testid="motion-v2v"]').isVisible());
ok('I2V card', await page.locator('[data-testid="motion-i2v"]').isVisible());
ok('IV2V card', await page.locator('[data-testid="motion-iv2v"]').isVisible());

// ═══ RESULTS ═══
console.log('\n═══════════════════════════');
console.log(`RESULTS: ${pass} passed, ${fail} failed out of ${pass + fail}`);
console.log('═══════════════════════════');
await browser.close();
if (fail > 0) process.exit(1);
