import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const SS_DIR = path.join(__dirname, "screenshots");
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

const LEGAL_ROUTES = [
  { route: "/terms",          label: "terms" },
  { route: "/privacy",        label: "privacy" },
  { route: "/acceptable-use", label: "acceptable-use" },
  { route: "/dmca",           label: "dmca" },
  { route: "/ai-disclosure",  label: "ai-disclosure" },
  { route: "/cookies",        label: "cookies" },
  { route: "/sound-licensing",label: "sound-licensing" },
];

// ── 1. All 7 legal pages render 200 and contain "Effective Date" ────────────
for (const { route, label } of LEGAL_ROUTES) {
  test(`legal page ${label} — renders with Effective Date`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Page must contain "Effective Date" or "Effective" and the version year
    const body = await page.locator("body").innerText();
    expect(body, `${label} should contain "Effective Date"`).toMatch(/Effective Date/i);
    expect(body, `${label} should contain "2026-04-26"`).toContain("2026-04-26");

    await page.screenshot({
      path: path.join(SS_DIR, `legal-${label}.png`),
      fullPage: true,
    });
    console.log(`${label}: OK`);
  });
}

// ── 2. Register page has bundled consent checkbox ───────────────────────────
test("register page — bundled consent checkbox renders", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Check for key consent text
  const body = await page.locator("body").innerText();
  expect(body, "should mention Terms of Use").toMatch(/Terms of Use/i);
  expect(body, "should mention Acceptable Use Policy").toMatch(/Acceptable Use Policy/i);
  expect(body, "should mention AI Disclosure").toMatch(/AI Disclosure/i);
  expect(body, "should mention Sound Licensing Policy").toMatch(/Sound Licensing Policy/i);
  expect(body, "should mention 13+").toMatch(/13\+/);

  // Checkbox exists
  const checkbox = page.locator('input[type="checkbox"]').first();
  await expect(checkbox, "consent checkbox should be present").toBeVisible();

  // Submit button disabled before tick
  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn, "submit should be disabled before consent tick").toBeDisabled();

  await page.screenshot({
    path: path.join(SS_DIR, "legal-register-consent.png"),
  });
  console.log("register consent checkbox: OK");
});

// ── 3. Hybrid planner — pre-generation gate component in DOM ────────────────
test("hybrid-planner — gate modal not visible on load", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/dashboard/hybrid-planner");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Gate modal should NOT be open on page load (it's triggered on generate)
  const gateModal = page.locator('[data-testid="pregen-gate-modal"]');
  await expect(gateModal, "gate modal should not be visible on load").not.toBeVisible();

  await page.screenshot({
    path: path.join(SS_DIR, "legal-hybrid-planner-no-gate.png"),
  });
  console.log("hybrid-planner gate DOM check: OK");
});

// ── 4. Show all 7 documents disclosure on register page ─────────────────────
test("register page — show all 7 documents toggle works", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Click the "Show all 7 documents" button
  const toggleBtn = page.locator('button', { hasText: /Show all 7 documents/i });
  await expect(toggleBtn).toBeVisible();
  await toggleBtn.click();
  await page.waitForTimeout(500);

  // After click, should see the expanded list link (with arrow)
  const soundLink = page.locator('a[href="/sound-licensing"]').last();
  await expect(soundLink).toBeVisible();

  await page.screenshot({
    path: path.join(SS_DIR, "legal-register-docs-expanded.png"),
  });
  console.log("register show 7 docs: OK");
});
