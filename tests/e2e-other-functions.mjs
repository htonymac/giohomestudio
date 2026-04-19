import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// ═══ CHECK ALL OTHER PAGES AND FUNCTIONS ═══

console.log('=== 1. DASHBOARD HOME ===');
await page.goto('http://localhost:3200/dashboard');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-1-dashboard.png' });
console.log('Dashboard loaded');

console.log('\n=== 2. AI CONTENT CREATOR ===');
await page.goto('http://localhost:3200/dashboard/auto-creator');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-2-auto-creator.png' });
console.log('Auto Creator loaded');

console.log('\n=== 3. MOVIE PLANNER ===');
await page.goto('http://localhost:3200/dashboard/movie-planner');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-3-movie-planner.png' });
console.log('Movie Planner loaded');

console.log('\n=== 4. COMMERCIAL ===');
await page.goto('http://localhost:3200/dashboard/commercial');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-4-commercial.png' });
console.log('Commercial loaded');

console.log('\n=== 5. SHORT VIDEO ===');
await page.goto('http://localhost:3200/dashboard/short-video');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-5-short-video.png' });
console.log('Short Video loaded');

console.log('\n=== 6. CHILDREN VIDEO ===');
await page.goto('http://localhost:3200/dashboard/children-video');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-6-children.png' });
console.log('Children Video loaded');

console.log('\n=== 7. SFX LIBRARY ===');
await page.goto('http://localhost:3200/dashboard/sfx-library');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-7-sfx.png' });
console.log('SFX Library loaded');

console.log('\n=== 8. CHARACTER VOICES ===');
await page.goto('http://localhost:3200/dashboard/character-voices');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-8-characters.png' });
console.log('Character Voices loaded');

console.log('\n=== 9. MUSIC STUDIO ===');
await page.goto('http://localhost:3200/dashboard/music-studio');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-9-music.png' });
console.log('Music Studio loaded');

console.log('\n=== 10. VIDEO EDITOR ===');
await page.goto('http://localhost:3200/dashboard/video-editor');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-10-video-editor.png' });
console.log('Video Editor loaded');

console.log('\n=== 11. CONTENT CALENDAR ===');
await page.goto('http://localhost:3200/dashboard/calendar');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-11-calendar.png' });
console.log('Calendar loaded');

console.log('\n=== 12. ANALYTICS ===');
await page.goto('http://localhost:3200/dashboard/analytics');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-12-analytics.png' });
console.log('Analytics loaded');

console.log('\n=== 13. REVIEW ===');
await page.goto('http://localhost:3200/dashboard/review');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-13-review.png' });
console.log('Review loaded');

console.log('\n=== 14. DESTINATION PAGES ===');
await page.goto('http://localhost:3200/dashboard/destination-pages');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-14-destinations.png' });
console.log('Destinations loaded');

console.log('\n=== 15. BUDGET ===');
await page.goto('http://localhost:3200/dashboard/budget');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-15-budget.png' });
console.log('Budget loaded');

console.log('\n=== 16. SETTINGS ===');
await page.goto('http://localhost:3200/dashboard/settings');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-16-settings.png' });
console.log('Settings loaded');

console.log('\n=== 17. HYBRID PLANNER ===');
await page.goto('http://localhost:3200/dashboard/hybrid-planner');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-17-hybrid.png' });
console.log('Hybrid Planner loaded');

console.log('\n=== 18. SERIES WIZARD ===');
await page.goto('http://localhost:3200/dashboard/series-wizard');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-18-series.png' });
console.log('Series Wizard loaded');

console.log('\n=== 19. PUBLISHING ===');
await page.goto('http://localhost:3200/dashboard/publishing');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-19-publishing.png' });
console.log('Publishing loaded');

console.log('\n=== 20. TEMPLATES ===');
await page.goto('http://localhost:3200/dashboard/templates');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'test-results/other-20-templates.png' });
console.log('Templates loaded');

console.log('\n============================');
console.log('=== ALL PAGES CHECKED ===');
console.log('============================');
await browser.close();
