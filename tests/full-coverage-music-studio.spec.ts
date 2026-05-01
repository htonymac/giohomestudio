/**
 * Full Coverage: Music Studio
 * /dashboard/music-studio
 * Dev server: http://localhost:3200
 *
 * Tests:
 *  1. Page loads + screenshot
 *  2. Provider dropdown renders 5 options, switch to Stock, verify localStorage
 *  3. Enter prompt + click Generate Music with Stock provider
 *  4. Verify stock adapter returns a real audio URL
 *  5. Duration slider exists + is functional
 *  6. DJ Tools tab: volume, pan sliders visible; Preview Mix button present
 *  7. LiveMixer Mix & Export button exists
 */

import { test, expect, chromium, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3200";
const SS_DIR = path.resolve(__dirname, "screenshots");

async function screenshot(page: Page, name: string) {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SS_DIR, `music-studio-${name}.png`), fullPage: false });
}

test.describe("Music Studio — full coverage", () => {
  test.use({ baseURL: BASE });

  test("1. Page loads and hero renders", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });
    await screenshot(page, "01-loaded");

    // Hero title visible
    const hero = page.locator("text=Music");
    await expect(hero.first()).toBeVisible({ timeout: 10_000 });

    // Tab bar has 5 tabs
    const tabs = page.locator("button").filter({ hasText: /AI Generate|Stock Library|Sound FX|DJ Tools|Upload/i });
    await expect(tabs).toHaveCount(5, { timeout: 5_000 });
  });

  test("2. Provider dropdown: 5 options, switch to Stock, localStorage persisted", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });

    // The Provider section label
    const providerLabel = page.locator("text=Provider");
    await expect(providerLabel.first()).toBeVisible({ timeout: 5_000 });

    // Select element for music provider
    const select = page.locator("select").filter({ hasNot: page.locator("option[value='Afrobeats']") }).first();
    await expect(select).toBeVisible();

    // Verify 5 options
    const options = await select.locator("option").all();
    expect(options).toHaveLength(5);

    // Option values should match expected keys
    const optionValues = await Promise.all(options.map(o => o.getAttribute("value")));
    expect(optionValues).toEqual(["auto", "kie", "mubert", "stable_audio", "stock"]);

    // Switch to stock
    await select.selectOption("stock");
    await expect(select).toHaveValue("stock");

    // Verify localStorage saved
    const stored = await page.evaluate(() => localStorage.getItem("ghs_music_provider"));
    expect(stored).toBe("stock");

    await screenshot(page, "02-provider-stock");
  });

  test("3+4. Generate Music with Stock provider returns audio URL", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });

    // Set provider to stock
    const select = page.locator("select").first();
    await select.selectOption("stock");

    // Enter prompt
    const textarea = page.locator("textarea").first();
    await textarea.fill("calm afrobeats for a romantic scene");
    await expect(textarea).toHaveValue("calm afrobeats for a romantic scene");

    // Click Generate button
    const generateBtn = page.locator("button").filter({ hasText: /Generate/i }).first();
    await expect(generateBtn).toBeEnabled({ timeout: 5_000 });

    // Intercept the API call to verify it fires and responds
    const responsePromise = page.waitForResponse(
      res => res.url().includes("/api/music/generate") && res.status() === 200,
      { timeout: 30_000 }
    );

    await generateBtn.click();

    const response = await responsePromise;
    const body = await response.json();

    // Stock provider must return audioUrl or musicPath
    const audioUrl = body.audioUrl ?? body.musicPath;
    expect(audioUrl).toBeTruthy();
    expect(typeof audioUrl).toBe("string");

    // Provider key must be "stock"
    const providerKey = body.providerKey ?? body.provider ?? body.source;
    expect(providerKey).toMatch(/stock/i);

    await screenshot(page, "03-generate-result");

    // Result block visible in UI
    await expect(page.locator("text=Track generated")).toBeVisible({ timeout: 10_000 });

    // Play button appears
    const playBtn = page.locator("button").filter({ hasText: /Play|Stop/i }).first();
    await expect(playBtn).toBeVisible({ timeout: 5_000 });
  });

  test("5. Duration slider is functional", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });

    const durationSlider = page.locator("input[type='range']").first();
    await expect(durationSlider).toBeVisible();

    // Default value should be 60
    const initialVal = await durationSlider.inputValue();
    expect(Number(initialVal)).toBeGreaterThanOrEqual(10);

    // Drag slider to new value
    await durationSlider.fill("120");
    const newVal = await durationSlider.inputValue();
    expect(Number(newVal)).toBe(120);

    // Label should reflect new value
    await expect(page.locator("text=120s")).toBeVisible({ timeout: 3_000 });
  });

  test("6. DJ Tools tab: volume/pan sliders, Preview Mix button", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });

    // Click DJ Tools tab
    const djTab = page.locator("button").filter({ hasText: /DJ Tools/i });
    await expect(djTab).toBeVisible();
    await djTab.click();

    await screenshot(page, "04-dj-tools");

    // Volume slider in trimmer
    const volumeSlider = page.locator("input[type='range']").first();
    await expect(volumeSlider).toBeVisible({ timeout: 5_000 });

    // Trim & Export button
    const trimBtn = page.locator("button").filter({ hasText: /Trim & Export/i });
    await expect(trimBtn).toBeVisible();

    // Preview Mix button in LiveMixer
    const previewMixBtn = page.locator("button").filter({ hasText: /Preview Mix/i });
    await expect(previewMixBtn).toBeVisible({ timeout: 5_000 });

    // Master EQ labels
    await expect(page.locator("text=Master EQ")).toBeVisible();
    const eqSliders = page.locator("input[type='range']");
    const sliderCount = await eqSliders.count();
    expect(sliderCount).toBeGreaterThanOrEqual(3); // at least bass/mid/treble

    // Pan sliders exist in layers
    await expect(page.locator("text=Pan").first()).toBeVisible();
  });

  test("7. Mix & Export button exists in LiveMixer", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });

    await page.locator("button").filter({ hasText: /DJ Tools/i }).click();

    const mixExportBtn = page.locator("button").filter({ hasText: /Mix & Export/i });
    await expect(mixExportBtn).toBeVisible({ timeout: 5_000 });
    // Initially disabled because no layers selected
    await expect(mixExportBtn).toBeDisabled();
  });

  test("8. localStorage provider persists on reload", async ({ page }) => {
    await page.goto("/dashboard/music-studio", { waitUntil: "networkidle" });

    // Set to mubert
    await page.locator("select").first().selectOption("mubert");

    // Reload
    await page.reload({ waitUntil: "networkidle" });

    // Provider select should restore to mubert
    const selectVal = await page.locator("select").first().inputValue();
    expect(selectVal).toBe("mubert");

    // Reset to stock for hygiene
    await page.locator("select").first().selectOption("stock");
  });
});
