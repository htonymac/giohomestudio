// Verify Phase 1.6: assemble button hits /api/assembly/execute not /api/video/assemble
const { chromium } = require('playwright');

(async () => {
  let browser, ownBrowser = false;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('Connected :9222');
  } catch {
    browser = await chromium.launch({ headless: false });
    ownBrowser = true;
  }
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  // Intercept network requests to verify correct route is called
  const assemblyRequests = [];
  const oldRouteRequests = [];

  await page.route('**/api/assembly/execute', route => {
    assemblyRequests.push(route.request().url());
    console.log('[INTERCEPT] /api/assembly/execute called ✓');
    route.continue();
  });
  await page.route('**/api/video/assemble', route => {
    oldRouteRequests.push(route.request().url());
    console.log('[INTERCEPT] /api/video/assemble called (OLD ROUTE - should not happen)');
    route.continue();
  });

  await page.goto('http://localhost:3200/dashboard/hybrid-planner', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(2000);

  // Navigate to Assembly tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ab = btns.find(b => (b.textContent || '').replace(/[✓\d]/g, '').trim().toLowerCase() === 'assembly');
    if (ab) ab.click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/verify-assembly-01.png' });

  const assemblyTabText = await page.evaluate(() => document.body.innerText);
  console.log('\nAssembly tab visible:', assemblyTabText.toLowerCase().includes('assembl'));

  // Find and click the Make Video / Assemble button
  const assembleBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => {
      const t = (b.textContent || '').toLowerCase();
      return t.includes('make video') || t.includes('assemble') || t.includes('generate video');
    });
    if (b) { b.click(); return b.textContent?.trim(); }
    return null;
  });
  console.log('\nAssemble button clicked:', assembleBtn);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/tmp/verify-assembly-02-triggered.png' });

  // Wait up to 15s to see if the request fires
  await page.waitForTimeout(10000);

  console.log('\n=== RESULT ===');
  console.log('Calls to /api/assembly/execute:', assemblyRequests.length, assemblyRequests.length > 0 ? '✓' : '(none - may need a project with scenes)');
  console.log('Calls to /api/video/assemble (old):', oldRouteRequests.length, oldRouteRequests.length === 0 ? '✓ NOT CALLED' : '✗ STILL CALLED');

  if (assemblyRequests.length === 0 && oldRouteRequests.length === 0) {
    console.log('\nNo assembly calls intercepted — need a project with scenes loaded to trigger assembly.');
    console.log('Route check: verify page source for /api/assembly/execute...');
    const pageSource = await page.content();
    const hasNewRoute = pageSource.includes('assembly/execute') || pageSource.includes('assembly%2Fexecute');
    console.log('Page references /api/assembly/execute:', hasNewRoute);
  }

  await page.screenshot({ path: 'C:/tmp/verify-assembly-03-final.png' });
  if (ownBrowser) await browser.close();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
