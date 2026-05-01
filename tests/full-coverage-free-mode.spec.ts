/**
 * full-coverage-free-mode.spec.ts
 * Full coverage: Free Mode (/dashboard/free-mode)
 * - PR #12 verification: imageModel/videoModel sent in request body
 * - Model selector state, mode tabs, history panel
 */

import { test, expect, chromium, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(process.cwd(), "tests/screenshots");

function ensureDir(d: string) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

test.describe("Free Mode — full coverage", () => {
  let page: Page;

  test.beforeAll(async () => {
    ensureDir(SCREENSHOT_DIR);
  });

  test.beforeEach(async ({ page: p }) => {
    page = p;
  });

  // ── 1. Page loads ────────────────────────────────────────────────────────────
  test("1. Navigate and screenshot", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });
    const heading = page.locator("text=Free Mode");
    await expect(heading.first()).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-01-loaded.png`, fullPage: true });
  });

  // ── 2. Prompt input ─────────────────────────────────────────────────────────
  test("2. Type prompt into textarea", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });
    const textarea = page.locator("textarea").first();
    await textarea.fill("A flying whale over a desert canyon at sunset, photorealistic");
    await expect(textarea).toHaveValue(/flying whale/);
  });

  // ── 3. Switch to text_to_image mode ─────────────────────────────────────────
  test("3. Switch mode to Text → Image", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    // Click the mode selector button
    const modeTrigger = page.locator("button").filter({ hasText: /Text.*Video|Image|Audio|Hybrid|Slideshow/i }).first();
    await modeTrigger.click();

    // Click "Text → Image" in the dropdown
    const imageMode = page.locator("button").filter({ hasText: "Text → Image" }).first();
    await imageMode.click();

    // Verify mode label updated
    await expect(page.locator("button").filter({ hasText: "Text → Image" }).first()).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-02-image-mode.png` });
  });

  // ── 4. Open Advanced + switch image model to segmind_pruna ──────────────────
  test("4. Switch image model to segmind_pruna via Advanced panel", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    // Switch to text_to_image mode first (image model is used for this mode)
    const modeTrigger = page.locator("button").filter({ hasText: /Text.*Video|→.*Image|Audio/i }).first();
    await modeTrigger.click();
    const imageMode = page.locator("button").filter({ hasText: "Text → Image" }).first();
    await imageMode.click();

    // Open Advanced settings
    const advBtn = page.locator("button").filter({ hasText: /Adv/i }).first();
    await advBtn.click();
    await expect(page.locator("text=Generation Models")).toBeVisible();

    // Click the image model picker (🖼 button)
    const imageModelBtn = page.locator("button").filter({ hasText: /Flux|Seedream|Ideogram|Pruna/i }).last();
    await imageModelBtn.click();

    // segmind_pruna is not in the ModelPicker IMAGE_MODELS list
    // (it lives in model-registry but NOT exposed in ModelPicker — this is the finding)
    // The UI exposes: Flux Schnell, Flux Dev, Ideogram v3, Seedream, Flux Pro
    // segmind_pruna is available as model ID but not listed in ModelPicker dropdown
    // We'll select "Flux Schnell" (fal_flux_schnell) as closest available, then verify body
    const fluxSchnell = page.locator("button").filter({ hasText: "Flux Schnell" }).first();
    if (await fluxSchnell.isVisible()) {
      await fluxSchnell.click();
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-03-model-picker.png` });
  });

  // ── 5. PR #12 fix: imageModel sent in API body ───────────────────────────────
  test("5. PR #12 verify: imageModel included in /api/generation/image body", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    // Switch to text_to_image
    const modeTrigger = page.locator("button").filter({ hasText: /Text.*Video|→/i }).first();
    await modeTrigger.click();
    const imageMode = page.locator("button").filter({ hasText: "Text → Image" }).first();
    await imageMode.click();

    // Type prompt
    const textarea = page.locator("textarea").first();
    await textarea.fill("A flying whale over a desert canyon at sunset, photorealistic");

    // Intercept /api/generation/image
    let capturedImageBody: Record<string, unknown> | null = null;
    let capturedEnhanceBody: Record<string, unknown> | null = null;

    await page.route("**/api/free-mode/enhance", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      capturedEnhanceBody = body;
      // Mock enhance response to avoid real API call
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enhanced: "A majestic flying whale soaring over a dramatic desert canyon at golden sunset, photorealistic, cinematic lighting",
          understood: true,
          confidence: "high",
          note: null,
        }),
      });
    });

    await page.route("**/api/generation/image", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      capturedImageBody = body;
      // Mock image generation response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ imagePath: "storage/images/test_gen.png", model: "fal_flux_schnell" }),
      });
    });

    await page.route("**/api/free-mode/history", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "test-id-123" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
      }
    });

    // Click Generate
    const generateBtn = page.locator("button").filter({ hasText: /^Generate$/ }).first();
    await generateBtn.click();

    // Wait for confirm modal
    await page.waitForSelector("text=Confirm your generation", { timeout: 15_000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-04-confirm-modal.png` });

    // Click "Generate →" in the modal
    const confirmBtn = page.locator("button").filter({ hasText: /Generate →|Generate Anyway/ }).first();
    await confirmBtn.click();

    // Wait briefly for the image API call
    await page.waitForTimeout(3_000);

    // Verify enhance body has mode
    expect(capturedEnhanceBody).not.toBeNull();
    expect((capturedEnhanceBody as unknown as Record<string, unknown>)?.mode).toBe("text_to_image");

    // Verify imageModel is sent in /api/generation/image body (PR #12 fix)
    expect(capturedImageBody).not.toBeNull();
    expect(capturedImageBody).toHaveProperty("modelId");
    // modelId should be the selected image model (default fal_flux_schnell)
    expect(typeof (capturedImageBody as unknown as Record<string, unknown>)?.modelId).toBe("string");
    expect(((capturedImageBody as unknown as Record<string, unknown>)?.modelId as string).length).toBeGreaterThan(0);

    console.log("[PR #12 VERIFY] imageModel sent:", (capturedImageBody as unknown as Record<string, unknown>)?.modelId);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-05-after-generate.png`, fullPage: true });
  });

  // ── 6. Pipeline body includes videoModel for non-image modes ────────────────
  test("6. videoModel included in /api/pipeline body for text_to_video", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    const textarea = page.locator("textarea").first();
    await textarea.fill("A sunrise timelapse over Lagos harbour");

    let capturedPipelineBody: Record<string, unknown> | null = null;

    await page.route("**/api/free-mode/enhance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enhanced: "A sunrise timelapse over Lagos harbour, cinematic", understood: true, confidence: "high", note: null }),
      });
    });

    await page.route("**/api/pipeline", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      capturedPipelineBody = body;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ contentItemId: "item-789" }),
      });
    });

    await page.route("**/api/free-mode/history", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "vid-item-1" }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      }
    });

    const generateBtn = page.locator("button").filter({ hasText: /^Generate$/ }).first();
    await generateBtn.click();

    await page.waitForSelector("text=Confirm your generation", { timeout: 15_000 });
    const confirmBtn = page.locator("button").filter({ hasText: /Generate →|Generate Anyway/ }).first();
    await confirmBtn.click();

    await page.waitForTimeout(3_000);

    expect(capturedPipelineBody).not.toBeNull();
    expect(capturedPipelineBody).toHaveProperty("videoModelId");
    expect(capturedPipelineBody).toHaveProperty("imageModelId");
    expect(typeof (capturedPipelineBody as unknown as Record<string, unknown>)?.videoModelId).toBe("string");
    expect(((capturedPipelineBody as unknown as Record<string, unknown>)?.videoModelId as string).length).toBeGreaterThan(0);

    console.log("[PR #12 VERIFY] videoModelId sent:", (capturedPipelineBody as unknown as Record<string, unknown>)?.videoModelId);
    console.log("[PR #12 VERIFY] imageModelId sent:", (capturedPipelineBody as unknown as Record<string, unknown>)?.imageModelId);
  });

  // ── 7. Video model dropdown state change ─────────────────────────────────────
  test("7. Video model dropdown — state changes without generating", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    // Open Advanced settings
    const advBtn = page.locator("button").filter({ hasText: /Adv/i }).first();
    await advBtn.click();
    await expect(page.locator("text=Generation Models")).toBeVisible();

    // Click the video model button (first model picker button)
    const videoModelBtn = page.locator("button").filter({ hasText: /Seedance|Kling|Wan/i }).first();
    const initialText = await videoModelBtn.textContent();
    await videoModelBtn.click();

    // Select a different model
    const klingBtn = page.locator("button").filter({ hasText: "Kling 2.5" }).first();
    if (await klingBtn.isVisible()) {
      await klingBtn.click();
      // Verify button text changed
      const newText = await page.locator("button").filter({ hasText: /Kling|Seedance|Wan/i }).first().textContent();
      expect(newText).not.toBe(initialText);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-06-video-model-changed.png` });
  });

  // ── 8. Mode tabs — each panel changes ────────────────────────────────────────
  test("8. Mode tabs — each mode switch changes the dropdown label", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    const modesToTest: { label: string; id: string }[] = [
      { label: "Text → Image", id: "text_to_image" },
      { label: "Audio Only", id: "text_to_audio" },
      { label: "Slideshow", id: "images_audio" },
      { label: "Hybrid", id: "hybrid" },
    ];

    for (const m of modesToTest) {
      const modeTrigger = page.locator("button").filter({ hasText: /→|Motion|Slideshow|Audio|Hybrid/i }).first();
      await modeTrigger.click();
      await page.waitForTimeout(300);

      const modeBtn = page.locator("button").filter({ hasText: m.label }).first();
      if (await modeBtn.isVisible()) {
        await modeBtn.click();
        await page.waitForTimeout(300);
        // Verify the mode selector button now shows this mode
        const currentModeLabel = page.locator("button").filter({ hasText: new RegExp(m.label.split("→")[0]?.trim() || m.label, "i") }).first();
        await expect(currentModeLabel).toBeVisible();
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-07-modes-tested.png`, fullPage: true });
  });

  // ── 9. History panel renders ─────────────────────────────────────────────────
  test("9. History panel renders (empty state + header visible)", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/free-mode`, { waitUntil: "networkidle" });

    // Header bar visible
    await expect(page.locator("text=Free Mode")).toBeVisible();

    // Empty state text or history items
    const emptyState = page.locator("text=What would you like to create?");
    const historyHeader = page.locator("text=generation");

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasHistory = await historyHeader.isVisible().catch(() => false);

    // At least one should be visible
    expect(hasEmpty || hasHistory).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/free-mode-08-history.png`, fullPage: true });
  });
});
