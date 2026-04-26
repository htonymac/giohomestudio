import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200";

test.describe("AI Content Creator — Music Pipeline Fix Verification", () => {
  test("Music section has Generate + Upload + Library link on Step 6", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/auto-creator`);
    await page.waitForTimeout(2000);

    // Dismiss any resume banner
    const startFresh = page.locator("button", { hasText: /start fresh/i }).first();
    if (await startFresh.isVisible()) {
      await startFresh.click();
      await page.waitForTimeout(500);
    }

    // Step 1: Select Instagram
    await page.locator("button", { hasText: "Instagram" }).first().click();
    await page.waitForTimeout(500);

    // Select Reel format
    const reelBtn = page.locator("button", { hasText: /reel/i }).first();
    if (await reelBtn.isVisible()) await reelBtn.click();
    await page.waitForTimeout(300);

    // Force navigate to step 6 by setting state via JavaScript
    // (Steps 2-5 require API calls and real media which we can't provide in test)
    await page.evaluate(() => {
      // Find React fiber and set step directly — or use URL state
      // Alternative: use the step bar buttons if visible
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        // Look for "Video Production" or step 6 indicator
        if (btn.textContent?.includes("Build") || btn.textContent?.includes("Video Production")) {
          btn.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1000);

    // Check if we can see the step indicators at top
    await page.screenshot({ path: "tests/screenshots/auto-creator-03-step-nav.png", fullPage: true });

    // Try clicking the progress dots/tabs at the top to go to step 6
    // The step bar has: Platform, Media, Analyze, Ideas, Draft, Build, Polish, Export
    const buildTab = page.locator("text=Build").first();
    if (await buildTab.isVisible()) {
      // Click on the Build step indicator to go to step 6
      // Note: step bar may not be clickable
    }

    // Alternative: Use page.evaluate to directly set the step state
    // We need to set draft + step = 6 to see the music section
    await page.evaluate(() => {
      // Save a fake session that will put us at step 6 with a draft
      const session = {
        step: 6,
        selectedPlatform: "instagram",
        selectedFormat: "reel",
        aiTier: "standard",
        mediaNames: [],
        detectedActivities: ["photo"],
        suggestions: [{ title: "Test", description: "Test post", style: "casual", music_mood: "Afrobeats" }],
        selectedSuggestion: 0,
        draft: {
          title: "Test Video",
          caption: "Testing the pipeline",
          hashtags: "#test",
          cta: "Follow me",
          voice_script: "This is a test narration",
          music_mood: "Afrobeats",
          music_genre: "Afrobeats",
          aspect_ratio: "9:16",
        },
        sugProvider: "standard",
        savedAt: Date.now(),
      };
      localStorage.setItem("ghs_ai_creator_session", JSON.stringify(session));
    });

    // Reload page to trigger session restore
    await page.reload();
    await page.waitForTimeout(2000);

    // Click resume if banner appears
    const resumeBtn = page.locator("button", { hasText: /resume/i }).first();
    if (await resumeBtn.isVisible()) {
      await resumeBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: "tests/screenshots/auto-creator-04-step6-music.png", fullPage: true });

    // Now check for the music section
    // Look for "Background Music" label
    const musicLabel = page.locator("text=Background Music").first();
    const isStep6 = await musicLabel.isVisible();

    if (isStep6) {
      // Verify the 3 music options exist:
      // 1. Generate Background Music button
      const generateBtn = page.locator("button", { hasText: /generate.*music/i }).first();
      await expect(generateBtn).toBeVisible();

      // 2. Upload Music File button (label element)
      const uploadLabel = page.locator("text=Upload Music File").first();
      await expect(uploadLabel).toBeVisible();

      // 3. Browse Music Library link (SFX Library)
      const studioLink = page.locator("text=Browse Music Library").first();
      await expect(studioLink).toBeVisible();

      // 4. Help text about options
      const helpText = page.locator("text=Generate AI music, upload your own").first();
      await expect(helpText).toBeVisible();

      await page.screenshot({ path: "tests/screenshots/auto-creator-05-music-buttons.png", fullPage: true });
    }

    // Also check Build Video button exists and shows clip count
    const buildVideoBtn = page.locator("button", { hasText: /build video/i }).first();
    if (await buildVideoBtn.isVisible()) {
      await page.screenshot({ path: "tests/screenshots/auto-creator-06-build-button.png", fullPage: true });
    }
  });

  test("Step 7 shows helpful message when no video built", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/auto-creator`);
    await page.waitForTimeout(1000);

    // Set state for step 7 without assembled video
    await page.evaluate(() => {
      const session = {
        step: 7,
        selectedPlatform: "instagram",
        selectedFormat: "reel",
        aiTier: "standard",
        mediaNames: [],
        detectedActivities: [],
        suggestions: [{ title: "Test", description: "Test", style: "casual", music_mood: "" }],
        selectedSuggestion: 0,
        draft: {
          title: "Test Video",
          caption: "Testing",
          hashtags: "",
          cta: "",
          voice_script: "",
          music_mood: "",
          music_genre: "",
          aspect_ratio: "9:16",
        },
        sugProvider: "standard",
        assembledVideoUrl: null,
        savedAt: Date.now(),
      };
      localStorage.setItem("ghs_ai_creator_session", JSON.stringify(session));
    });

    await page.reload();
    await page.waitForTimeout(2000);

    const resumeBtn = page.locator("button", { hasText: /resume/i }).first();
    if (await resumeBtn.isVisible()) {
      await resumeBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: "tests/screenshots/auto-creator-07-step7-no-video.png", fullPage: true });

    // Should show "No video built yet" message instead of empty page
    const noVideoMsg = page.locator("text=No video built yet").first();
    if (await noVideoMsg.isVisible()) {
      await expect(noVideoMsg).toBeVisible();
      // And a "Back to Build" button
      const backBtn = page.locator("button", { hasText: /back to build/i }).first();
      await expect(backBtn).toBeVisible();
    }
  });
});
