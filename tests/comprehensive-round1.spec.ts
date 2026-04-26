import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200";

test.describe("Comprehensive Test Round 1 — All Major Pages", () => {

  test("1. Movie Planner Workshop — all tabs navigate correctly", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/movie-planner`);
    await page.waitForTimeout(3000);

    // Overview tab visible and has stats
    await expect(page.locator("text=Production Progress").first()).toBeVisible();
    await expect(page.locator("text=Resume").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-movie-overview.png", fullPage: true });

    // Click Story & Draft tab
    await page.locator("button", { hasText: /story/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Movie Title").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-movie-story.png", fullPage: true });

    // Click Design tab
    await page.locator("button", { hasText: /design/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Story Genre").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-movie-design.png", fullPage: true });

    // Click Cast tab
    await page.locator("button", { hasText: /cast/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-movie-cast.png", fullPage: true });

    // Click Scene Board tab
    await page.locator("button", { hasText: /scene/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-movie-scenes.png", fullPage: true });

    // Click Audio & Shots tab
    await page.locator("button", { hasText: /audio/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-movie-audio.png", fullPage: true });

    // Click Assembly tab
    await page.locator("button", { hasText: /assembly/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-movie-assembly.png", fullPage: true });

    // Click Generate tab
    await page.locator("button", { hasText: /generate/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-movie-generate.png", fullPage: true });
  });

  test("2. Children Planner Workshop — all tabs + review gates", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/children-planner`);
    await page.waitForTimeout(3000);

    // Overview visible
    await expect(page.locator("text=Child-Safe").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-children-overview.png", fullPage: true });

    // Content Input tab
    await page.locator("button", { hasText: /content input/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Enter Your Content").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-children-content.png", fullPage: true });

    // Style tab
    await page.locator("button", { hasText: /style/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator("text=Narration Voice").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-children-style.png", fullPage: true });

    // Review 1 tab — should show safety check
    await page.locator("button", { hasText: /review 1/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-children-review1.png", fullPage: true });

    // Review 2 tab
    await page.locator("button", { hasText: /review 2/i }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-children-review2.png", fullPage: true });
  });

  test("3. Hybrid Planner — Workshop still fully functional", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/hybrid-planner`);
    await page.waitForTimeout(3000);

    await expect(page.locator("text=Production Workshop").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-hybrid-overview.png", fullPage: true });

    // Scene Board tab
    await page.locator("button", { hasText: "Scene Board" }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-hybrid-scenes.png", fullPage: true });

    // Characters tab
    await page.locator("button", { hasText: "Characters" }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-hybrid-characters.png", fullPage: true });

    // Trends tab
    await page.locator("button", { hasText: "Trends" }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "tests/screenshots/r1-hybrid-trends.png", fullPage: true });
  });

  test("4. AI Content Creator — Step 6 music pipeline", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/auto-creator`);
    await page.waitForTimeout(2000);

    // Set session to step 6 with draft
    await page.evaluate(() => {
      const session = {
        step: 6, selectedPlatform: "instagram", selectedFormat: "reel", aiTier: "standard",
        mediaNames: [], detectedActivities: ["photo"],
        suggestions: [{ title: "Test", description: "Test post", style: "casual", music_mood: "Afrobeats" }],
        selectedSuggestion: 0,
        draft: { title: "Test Video", caption: "Testing", hashtags: "#test", cta: "Follow",
          voice_script: "Test narration", music_mood: "Afrobeats", music_genre: "Afrobeats", aspect_ratio: "9:16" },
        sugProvider: "standard", savedAt: Date.now(),
      };
      localStorage.setItem("ghs_ai_creator_session", JSON.stringify(session));
    });
    await page.reload();
    await page.waitForTimeout(2000);

    const resumeBtn = page.locator("button", { hasText: /resume/i }).first();
    if (await resumeBtn.isVisible()) await resumeBtn.click();
    await page.waitForTimeout(1500);

    // Verify Step 6 loaded
    await expect(page.locator("text=STEP 6").first()).toBeVisible();

    // Scroll to music section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "tests/screenshots/r1-autocreator-music-section.png", fullPage: true });

    // Verify music buttons exist
    await expect(page.locator("text=Generate Background Music").first()).toBeVisible();
    await expect(page.locator("text=Upload Music File").first()).toBeVisible();
    await expect(page.locator("text=Open Music Studio").first()).toBeVisible();
  });

  test("5. Asset Library loads and shows content", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/assets`);
    await page.waitForTimeout(3000);
    await expect(page.locator("text=Asset Library").first()).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/r1-asset-library.png", fullPage: true });
  });

  test("6. All Content page loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/all-content`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r1-all-content.png", fullPage: true });
  });

  test("7. Collaborative Editor loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/collaborative-editor`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r1-collab-editor.png", fullPage: true });
  });

  test("8. Commercial page loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/commercial`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r1-commercial.png", fullPage: true });
  });

  test("9. SFX Library loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/sfx-library`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r1-sfx-library.png", fullPage: true });
  });

  test("10. Character Voices page loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/character-voices`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/r1-characters.png", fullPage: true });
  });
});
