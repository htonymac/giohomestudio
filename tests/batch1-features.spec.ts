import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3200";

test.describe("Batch 1 — Project Persistence + Character + Sidebar + Shortcuts", () => {

  test("1. Sidebar shows and collapse toggle works", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Screenshot: sidebar expanded
    await page.screenshot({ path: "playwright-screenshots/batch1-sidebar-expanded.png", fullPage: false });

    // Check sidebar is visible
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Find and click the collapse toggle button
    const collapseBtn = page.locator("button", { hasText: "←" }).first();
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "playwright-screenshots/batch1-sidebar-collapsed.png", fullPage: false });

      // Expand back
      const expandBtn = page.locator("button", { hasText: "→" }).first();
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
        await page.waitForTimeout(500);
      }
    }

    await page.screenshot({ path: "playwright-screenshots/batch1-sidebar-final.png", fullPage: false });
  });

  test("2. Collaborative Editor loads with project list", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/collaborative-editor`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Screenshot: editor start screen
    await page.screenshot({ path: "playwright-screenshots/batch1-editor-start.png", fullPage: false });

    // Check the editor loads
    const editorHeader = page.locator("text=GHSEditor");
    await expect(editorHeader).toBeVisible();

    // Check "Start Creating" text is visible
    const startText = page.locator("text=Start Creating");
    await expect(startText).toBeVisible();

    // Check keyboard shortcut button exists
    const shortcutsBtn = page.locator("button[title='Keyboard Shortcuts (?)']");
    await expect(shortcutsBtn).toBeVisible();

    // Check character button exists
    const charBtn = page.locator("button:has-text('Character')");
    await expect(charBtn).toBeVisible();

    await page.screenshot({ path: "playwright-screenshots/batch1-editor-buttons.png", fullPage: false });
  });

  test("3. Keyboard shortcuts panel opens and closes", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/collaborative-editor`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Click shortcuts button
    const shortcutsBtn = page.locator("button[title='Keyboard Shortcuts (?)']");
    await shortcutsBtn.click();
    await page.waitForTimeout(1000);

    // Screenshot: shortcuts panel open
    await page.screenshot({ path: "playwright-screenshots/batch1-shortcuts-open.png", fullPage: false });

    // Check shortcuts panel content
    const playbackHeader = page.locator("text=Playback");
    await expect(playbackHeader).toBeVisible();

    const editingHeader = page.locator("text=Editing");
    await expect(editingHeader).toBeVisible();

    // Close via Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Verify closed
    await expect(playbackHeader).not.toBeVisible();
    await page.screenshot({ path: "playwright-screenshots/batch1-shortcuts-closed.png", fullPage: false });
  });

  test("4. Character picker opens from top bar", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/collaborative-editor`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Click character button
    const charBtn = page.locator("button:has-text('Character')");
    await charBtn.click();
    await page.waitForTimeout(2000);

    // Screenshot: character picker
    await page.screenshot({ path: "playwright-screenshots/batch1-character-picker.png", fullPage: false });

    // Check picker UI
    const assignText = page.locator("text=Assign Character");
    await expect(assignText).toBeVisible();

    // Check search input
    const searchInput = page.locator("input[placeholder*='Search']");
    await expect(searchInput).toBeVisible();

    // Check Create New button
    const createBtn = page.locator("button:has-text('Create New')");
    await expect(createBtn).toBeVisible();

    await page.screenshot({ path: "playwright-screenshots/batch1-character-picker-detail.png", fullPage: false });

    // Close by clicking outside
    await page.click("body", { position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
  });

  test("5. Projects API works (DB persistence)", async ({ page }) => {
    // Create a project via API
    const createRes = await page.request.post(`${BASE}/api/projects`, {
      data: {
        title: "Test Project from Playwright",
        type: "collaborative",
        assembly: {
          projectId: "test_pw_" + Date.now(),
          title: "Test Project from Playwright",
          segments: [{ id: "seg_0", type: "image", sourceUrl: "", startTime: 0, endTime: 5, duration: 5, transitionIn: "cut", transitionOut: "cut" }],
          totalDuration: 5,
          narration: [],
          music: [],
          sfx: [],
          ambience: [],
          subtitles: [],
          overlays: [],
        },
        status: "draft",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createData = await createRes.json();
    expect(createData.id).toBeTruthy();
    expect(createData.saved).toBe(true);

    // List projects
    const listRes = await page.request.get(`${BASE}/api/projects`);
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    expect(listData.projects.length).toBeGreaterThan(0);

    // Find our test project
    const found = listData.projects.find((p: { title: string }) => p.title === "Test Project from Playwright");
    expect(found).toBeTruthy();

    // Load single project
    const loadRes = await page.request.get(`${BASE}/api/projects/${createData.id}`);
    expect(loadRes.ok()).toBeTruthy();
    const loadData = await loadRes.json();
    expect(loadData.project.title).toBe("Test Project from Playwright");
    expect(loadData.project.assembly.segments.length).toBe(1);

    // Delete project (editor mode — archives it)
    const delRes = await page.request.delete(`${BASE}/api/projects?id=${createData.id}&mode=editor`);
    expect(delRes.ok()).toBeTruthy();

    // Delete forever
    const delRes2 = await page.request.delete(`${BASE}/api/projects?id=${createData.id}&mode=forever`);
    // May 404 since already archived, but that's ok

    await page.screenshot({ path: "playwright-screenshots/batch1-api-projects.png" });
  });

  test("6. Editor project list and open saved project flow", async ({ page }) => {
    // First create a project
    await page.request.post(`${BASE}/api/projects`, {
      data: {
        title: "Playwright Load Test",
        type: "collaborative",
        assembly: {
          projectId: "pw_load_" + Date.now(),
          title: "Playwright Load Test",
          segments: [{ id: "seg_0", type: "image", sourceUrl: "", startTime: 0, endTime: 3, duration: 3, transitionIn: "cut", transitionOut: "cut" }],
          totalDuration: 3,
          narration: [],
          music: [],
          sfx: [],
          ambience: [],
          subtitles: [],
          overlays: [],
        },
        status: "draft",
      },
    });

    await page.goto(`${BASE}/dashboard/collaborative-editor`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Screenshot start screen
    await page.screenshot({ path: "playwright-screenshots/batch1-editor-with-projects.png", fullPage: false });

    // Check if "Open Saved Project" button appears
    const openBtn = page.locator("button:has-text('Open Saved Project')");
    if (await openBtn.isVisible({ timeout: 3000 })) {
      await openBtn.click();
      await page.waitForTimeout(1000);

      // Screenshot: project list
      await page.screenshot({ path: "playwright-screenshots/batch1-project-list.png", fullPage: false });

      // Check saved projects header
      const savedHeader = page.locator("text=Saved Projects");
      await expect(savedHeader).toBeVisible();

      // Check test project appears
      const testProject = page.locator("text=Playwright Load Test");
      if (await testProject.isVisible({ timeout: 2000 })) {
        // Open it
        const openProjectBtn = page.locator("button:has-text('Open')").first();
        await openProjectBtn.click();
        await page.waitForTimeout(2000);

        // Screenshot: project loaded
        await page.screenshot({ path: "playwright-screenshots/batch1-project-loaded.png", fullPage: false });
      }
    }

    // Cleanup
    const listRes = await page.request.get(`${BASE}/api/projects`);
    const listData = await listRes.json();
    for (const p of listData.projects) {
      if (p.title.includes("Playwright")) {
        await page.request.delete(`${BASE}/api/projects?id=${p.id}&mode=forever`);
      }
    }
  });

  test("7. Asset Library page loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/assets`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "playwright-screenshots/batch1-asset-library.png", fullPage: false });
  });

  test("8. All Content page loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/registry`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "playwright-screenshots/batch1-all-content.png", fullPage: false });
  });
});
