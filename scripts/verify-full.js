// Full AUT verify: hybrid-planner tabs, sound tiers, per-scene controls, children-planner
const { chromium } = require('playwright');

(async () => {
  let browser, ownBrowser = false;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('Connected :9222');
  } catch {
    browser = await chromium.launch({ headless: false });
    ownBrowser = true;
    console.log('Fresh browser');
  }
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  // ── HYBRID PLANNER ──────────────────────────────────────────────
  console.log('\n=== HYBRID PLANNER ===');
  await page.goto('http://localhost:3200/dashboard/hybrid-planner', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/tmp/verify-hybrid-01.png' });

  // Find workshop tabs by looking for the run of 7-8 buttons with expected text
  const workshopTabs = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const expected = ['design', 'story', 'character', 'scene board', 'sound', 'screenplay', 'assembly', 'overview'];
    return btns
      .filter(b => {
        const t = (b.textContent || '').replace(/[✓\d]/g, '').trim().toLowerCase();
        return expected.some(e => t.includes(e));
      })
      .map(b => (b.textContent || '').trim())
      .slice(0, 12);
  });
  console.log('Workshop tabs:', JSON.stringify(workshopTabs));

  // Sound tiers check
  const bodyText = await page.evaluate(() => document.body.innerText);
  const tiers = {
    'GHS Sound': bodyText.includes('GHS Sound'),
    'GHS Plus': bodyText.includes('GHS Plus'),
    'GHS Pro': bodyText.includes('GHS Pro'),
    'GHS Premium': bodyText.includes('GHS Premium'),
  };
  console.log('Sound tiers visible:', JSON.stringify(tiers));

  // Click Sound tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => {
      const t = (b.textContent || '').replace(/[✓\d]/g, '').trim().toLowerCase();
      return t === 'sound' || t === 'sound & sfx';
    });
    if (sb) sb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/verify-hybrid-02-sound.png' });

  const soundTabText = await page.evaluate(() => document.body.innerText);
  const soundTiersOnTab = {
    'GHS Sound': soundTabText.includes('GHS Sound'),
    'GHS Plus': soundTabText.includes('GHS Plus'),
    'GHS Pro': soundTabText.includes('GHS Pro'),
    'GHS Premium': soundTabText.includes('GHS Premium'),
    'Piper': soundTabText.includes('Piper'),
    'Karaoke': soundTabText.includes('Karaoke'),
  };
  console.log('Sound tab content:', JSON.stringify(soundTiersOnTab));

  // Click Scene Board
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => (b.textContent || '').toLowerCase().includes('scene board'));
    if (sb) sb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/verify-hybrid-03-scenes.png' });
  const sceneText = await page.evaluate(() => document.body.innerText);
  console.log('Motion toggle:', sceneText.toLowerCase().includes('motion') || sceneText.toLowerCase().includes('continuous'));
  console.log('Duration picker (5s/10s):', sceneText.includes('5s') || sceneText.includes('10s') || sceneText.includes('15s'));
  console.log('AI SFX button:', sceneText.toLowerCase().includes('sfx'));

  // ── CHILDREN PLANNER ────────────────────────────────────────────
  console.log('\n=== CHILDREN PLANNER ===');
  await page.goto('http://localhost:3200/dashboard/children-planner', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/tmp/verify-children-01.png' });

  const childrenBody = await page.evaluate(() => document.body.innerText);
  console.log('Children planner loaded:', !childrenBody.toLowerCase().includes('not found'));

  // Click Scene Board in children planner
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => (b.textContent || '').toLowerCase().includes('scene board'));
    if (sb) sb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/verify-children-02-scenes.png' });
  const childSceneText = await page.evaluate(() => document.body.innerText);
  console.log('Children motion toggle:', childSceneText.toLowerCase().includes('motion'));
  console.log('Children AI SFX:', childSceneText.toLowerCase().includes('sfx') || childSceneText.toLowerCase().includes('ai sfx'));

  // ── MOVIE PLANNER ────────────────────────────────────────────────
  console.log('\n=== MOVIE PLANNER ===');
  await page.goto('http://localhost:3200/dashboard/movie-planner', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/tmp/verify-movie-01.png' });

  // Click Voice & Audio tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sb = btns.find(b => {
      const t = (b.textContent || '').toLowerCase();
      return t.includes('audio') || t.includes('voice') || t.includes('sound');
    });
    if (sb) sb.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/verify-movie-02-audio.png' });
  const movieAudioText = await page.evaluate(() => document.body.innerText);
  const movieTiers = {
    'GHS Sound': movieAudioText.includes('GHS Sound'),
    'GHS Plus': movieAudioText.includes('GHS Plus'),
    'Parse Script': movieAudioText.toLowerCase().includes('parse script'),
  };
  console.log('Movie audio tab:', JSON.stringify(movieTiers));

  console.log('\n=== ALL SCREENSHOTS saved to C:/tmp/verify-*.png ===');
  if (ownBrowser) await browser.close();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
