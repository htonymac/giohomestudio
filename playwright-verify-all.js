const { chromium } = require('playwright');

(async () => {
  const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0] || await browser.newContext();
  const page = await context.newPage();

  async function checkPlanner(url, name, checks) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    const results = {};
    for (const [key, selector] of Object.entries(checks)) {
      results[key] = await page.locator(selector).count() > 0;
    }
    log(`${name}: ${JSON.stringify(results)}`);
    return results;
  }

  try {
    // Hybrid planner
    await checkPlanner('http://localhost:3200/dashboard/hybrid-planner', 'HYBRID', {
      'titleInput': 'input[placeholder="Movie Title"]',
      'newProjectBtn': 'button:has-text("New Project")',
      'saveBtn': 'button:has-text("Save")',
      'myProjectsBtn': 'button:has-text("My Projects")',
    });

    // Movie planner
    await checkPlanner('http://localhost:3200/dashboard/movie-planner', 'MOVIE', {
      'titleInput': 'input[placeholder="Project Title"]',
      'newProjectBtn': 'button:has-text("New Project")',
      'saveBtn': 'button:has-text("Save")',
      'projectsBtn': 'button:has-text("Projects")',
    });

    // Children planner
    await checkPlanner('http://localhost:3200/dashboard/children-planner', 'CHILDREN', {
      'titleInput': 'input[placeholder="Project Title"]',
      'newProjectBtn': 'button:has-text("New Project")',
      'saveBtn': 'button:has-text("Save")',
      'myProjectsBtn': 'button:has-text("My Projects")',
    });

    // Music video planner
    await checkPlanner('http://localhost:3200/dashboard/music-video-planner', 'MUSIC_VIDEO', {
      'newProjectBtn': 'button:has-text("New Project")',
      'saveBtn': 'button:has-text("Save")',
      'projectsBtn': 'button:has-text("Projects")',
    });

    // Test New Project URL change in hybrid
    log('[TEST] Hybrid New Project URL change...');
    await page.goto('http://localhost:3200/dashboard/hybrid-planner', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    const urlBefore = page.url();
    const newBtn = page.locator('button').filter({ hasText: 'New Project' }).first();
    await newBtn.click();
    await page.waitForTimeout(1500);
    const urlAfter = page.url();
    log(`Hybrid URL before: ${urlBefore}`);
    log(`Hybrid URL after: ${urlAfter}`);
    log(`New Project created new ID: ${urlAfter.includes('proj_') ? 'YES ✅' : 'NO ❌'}`);

    // Test My Projects loads in hybrid
    log('[TEST] Hybrid My Projects panel...');
    const myProjBtn = page.locator('button').filter({ hasText: 'My Projects' }).first();
    await myProjBtn.click();
    await page.waitForTimeout(1000);
    const panelVisible = await page.locator('text=My Projects — Click a folder').isVisible().catch(() => false);
    log(`My Projects panel shows: ${panelVisible ? 'YES ✅' : 'NO ❌'}`);

    log('ALL CHECKS DONE');
  } catch (err) {
    log(`FAIL: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
})();
