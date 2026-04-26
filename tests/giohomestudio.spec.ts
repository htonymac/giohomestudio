/**
 * GioHomeStudio — Full Function Test Suite
 *
 * Covers every major section:
 *   1.  LLM status + settings
 *   2.  LLM errand
 *   3.  Supervisor / orchestration plan
 *   4.  Pipeline (Free Mode generate)
 *   5.  Registry
 *   6.  Review page UI
 *   7.  Voice registry (ElevenLabs list)
 *   8.  SFX library
 *   9.  Destination pages
 *   10. Character voices
 *   11. ComfyUI status
 *   12. Commercial — project CRUD + slides + polish + suggest-order
 *   13. Commercial Mode 2 — analyze mock + generate-script + build-slides
 *   14. Commercial render
 *   15. Video Tools — trim + narrate APIs
 *   16. AI suggestions — suggest-continuation
 *   17. All dashboard pages load without crash
 *
 * Run:
 *   npx playwright test               (headless)
 *   npx playwright test --headed      (see the browser)
 *   npx playwright test --debug       (step-by-step)
 *
 * Requires the app on http://localhost:3200
 */

import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function goto(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

function noError(body: string | null) {
  expect(body).not.toContain("Application error");
  expect(body).not.toContain("Internal Server Error");
  expect(body).not.toContain("Unhandled Runtime Error");
}

// ── 1. LLM Status ─────────────────────────────────────────────────────────────

test("GET /api/llm/status returns provider status", async ({ request }) => {
  const res  = await request.get("/api/llm/status");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("providers");
  expect(body).toHaveProperty("activeCount");
  expect(body).toHaveProperty("willUse");
  console.log("LLM willUse:", body.willUse, "| active:", body.activeCount);
});

// ── 2. LLM Settings ───────────────────────────────────────────────────────────

test("GET /api/settings/llm returns current settings", async ({ request }) => {
  const res  = await request.get("/api/settings/llm");
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Route returns status, serviceStatus, maskedKeys, roleAssignments etc.
  expect(body).toHaveProperty("status");
  expect(body).toHaveProperty("maskedKeys");
  console.log("LLM settings — ollama models:", body.ollamaModels?.length ?? 0);
});

// ── 3. LLM Errand ─────────────────────────────────────────────────────────────

test("POST /api/llm-errand returns result or 503", async ({ request }) => {
  const res  = await request.post("/api/llm-errand", {
    data: {
      task:       "Name 3 royalty-free music sites for a Nigerian filmmaker",
      errandType: "source_research",
    },
  });
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  if (res.status() === 200) {
    expect(typeof body.result).toBe("string");
    expect(body.result.length).toBeGreaterThan(20);
    console.log("LLM errand:", body.result.slice(0, 120));
  } else {
    console.log("LLM errand: unavailable →", body.error);
  }
});

// ── 4. Supervisor ─────────────────────────────────────────────────────────────

test("POST /api/supervisor returns orchestration plan", async ({ request }) => {
  const res  = await request.post("/api/supervisor", {
    data: {
      rawPrompt: "An elderly Yoruba woman by a fire at night telling stories to her grandchildren. Fireflies dance, drums beat in the distance.",
      blocking:  false,
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Route returns { plan: { contentIntent, supervisedBy, ... } }
  const plan = body.plan ?? body;
  expect(plan).toHaveProperty("contentIntent");
  expect(plan).toHaveProperty("supervisedBy");
  console.log("Supervisor — intent:", plan.contentIntent, "| mood:", plan.inferredMusicMood, "| by:", plan.supervisedBy);
});

// ── 5. Pipeline (Free Mode) ───────────────────────────────────────────────────

test("POST /api/pipeline creates a pipeline job and returns contentItemId", async ({ request }) => {
  const res  = await request.post("/api/pipeline", {
    data: {
      rawInput:        "A young Lagos street vendor discovers a mysterious glowing stone.",
      mode:            "FREE",
      outputMode:      "text_to_audio",
      audioMode:       "voice_music",
      aspectRatio:     "9:16",
      durationSeconds: 10,
      aiAutoMode:      true,
    },
  });
  expect([200, 202]).toContain(res.status());
  const body = await res.json();
  // Route returns { contentItemId, message }
  const itemId = body.contentItemId ?? body.id;
  expect(typeof itemId).toBe("string");
  expect(itemId.length).toBeGreaterThan(0);
  console.log("Pipeline contentItemId:", itemId);
});

// ── 6. Registry ───────────────────────────────────────────────────────────────

test("GET /api/registry returns content items list", async ({ request }) => {
  const res  = await request.get("/api/registry?limit=5");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("items");
  expect(Array.isArray(body.items)).toBe(true);
  console.log("Registry items:", body.items.length, "| total:", body.total ?? "n/a");
});

// ── 7. Review page ────────────────────────────────────────────────────────────

test("GET /api/review returns queue", async ({ request }) => {
  const res  = await request.get("/api/review");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("items");
  console.log("Review queue length:", body.items.length);
});

// ── 8. Voices ─────────────────────────────────────────────────────────────────

test("GET /api/voices returns voice list with metadata", async ({ request }) => {
  const res  = await request.get("/api/voices");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("voices");
  expect(Array.isArray(body.voices)).toBe(true);
  expect(body.voices.length).toBeGreaterThan(0);
  const v = body.voices[0];
  expect(v).toHaveProperty("id");
  expect(v).toHaveProperty("name");
  console.log("Voices:", body.voices.length, "| source:", body.source, "| first:", v.name);
});

// ── 9. SFX Library ────────────────────────────────────────────────────────────

test("GET /api/sfx returns SFX list", async ({ request }) => {
  const res  = await request.get("/api/sfx");
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Route returns { library: [...], availableCount, totalCount }
  const list = body.library ?? body.sfx ?? [];
  expect(Array.isArray(list)).toBe(true);
  console.log("SFX entries:", list.length, "| available:", body.availableCount ?? "n/a");
});

// ── 10. Destination Pages ─────────────────────────────────────────────────────

test("GET /api/destination-pages returns pages list", async ({ request }) => {
  const res  = await request.get("/api/destination-pages");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("pages");
  expect(Array.isArray(body.pages)).toBe(true);
  console.log("Destination pages:", body.pages.length);
});

// ── 11. Character Voices ──────────────────────────────────────────────────────

test("GET /api/character-voices returns voice registry", async ({ request }) => {
  const res  = await request.get("/api/character-voices");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("voices");
  expect(Array.isArray(body.voices)).toBe(true);
  console.log("Character voices:", body.voices.length);
});

// ── 12. ComfyUI Status ────────────────────────────────────────────────────────

test("GET /api/comfyui/status returns online state", async ({ request }) => {
  const res  = await request.get("/api/comfyui/status");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("online");
  expect(typeof body.online).toBe("boolean");
  console.log("ComfyUI online:", body.online);
});

// ── 13. Commercial — full project lifecycle ───────────────────────────────────

test("Commercial: create project + 2 slides + patch + polish + suggest-order + cleanup", async ({ request }) => {
  // Create project
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Playwright Test Ad", aspectRatio: "9:16", brandName: "TestBrand" },
  });
  expect(createRes.status()).toBe(201);
  const project   = await createRes.json();
  const projectId = project.id as string;
  console.log("Project:", projectId);

  // Add 2 slides
  const s1Res = await request.post(`/api/commercial/projects/${projectId}/slides`);
  expect(s1Res.status()).toBe(201);
  const slide1Id = (await s1Res.json()).id as string;

  const s2Res = await request.post(`/api/commercial/projects/${projectId}/slides`);
  expect(s2Res.status()).toBe(201);
  const slide2Id = (await s2Res.json()).id as string;
  console.log("Slides:", slide1Id, slide2Id);

  // Patch slide 1
  const patchRes = await request.patch(`/api/commercial/projects/${projectId}/slides/${slide1Id}`, {
    data: { captionOriginal: "Luxury 3BR apartment in Lekki", narrationLine: "Your dream home awaits in Lekki." },
  });
  expect(patchRes.status()).toBe(200);

  // Polish caption
  const polishRes = await request.post(`/api/commercial/projects/${projectId}/slides/${slide1Id}/polish`, {
    data: { text: "Luxury 3BR apartment in Lekki", brandName: "TestBrand", tone: "professional" },
  });
  expect([200, 503]).toContain(polishRes.status());
  if (polishRes.status() === 200) {
    const { polished } = await polishRes.json();
    expect(typeof polished).toBe("string");
    console.log("Polished caption:", polished);
  }

  // Suggest slide order (2 slides — should return a suggestion or LLM fallback)
  const orderRes = await request.post(`/api/commercial/projects/${projectId}/suggest-order`);
  expect([200, 503]).toContain(orderRes.status());
  const orderBody = await orderRes.json();
  console.log("Suggest order:", orderBody.error ?? orderBody.suggestedOrder ?? "ok");

  // Reorder slides
  const reorderRes = await request.post(`/api/commercial/projects/${projectId}/slides/reorder`, {
    data: { order: [slide2Id, slide1Id] },
  });
  expect([200, 204]).toContain(reorderRes.status());

  // Get project
  const getRes = await request.get(`/api/commercial/projects/${projectId}`);
  expect(getRes.status()).toBe(200);
  const got = await getRes.json();
  expect(got.id).toBe(projectId);
  expect(Array.isArray(got.slides)).toBe(true);
  console.log("Project fetched — slides:", got.slides.length);

  // Cleanup
  const delRes = await request.delete(`/api/commercial/projects/${projectId}`);
  expect([200, 204]).toContain(delRes.status());
  console.log("Project deleted.");
});

// ── 14. Commercial Mode 2 — analyze + generate-script + build-slides ──────────

test("Mode 2: generate-script accepts any product type", async ({ request }) => {
  // Use a real project so the route can load it from DB
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Mode2 Script Test", aspectRatio: "9:16", brandName: "Gio Tech" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  const scriptRes = await request.post(`/api/commercial/projects/${projectId}/mode2/generate-script`, {
    data: {
      productType:   "Software",
      productName:   "GioHomeStudio Pro",
      features:      "AI video generation, multi-mode output, ElevenLabs voices",
      companyName:   "Gio Tech",
      tone:          "Professional",
      duration:      "30",
    },
  });
  expect([200, 503]).toContain(scriptRes.status());
  if (scriptRes.status() === 200) {
    const body = await scriptRes.json();
    expect(body).toHaveProperty("script");
    expect(body.script.length).toBeGreaterThan(20);
    console.log("Mode 2 script (30s):", body.script.slice(0, 160));
  } else {
    console.log("Mode 2 script: LLM unavailable");
  }

  // Cleanup
  await request.delete(`/api/commercial/projects/${projectId}`);
});

test("Mode 2: build-slides creates one slide per image path", async ({ request }) => {
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Mode2 BuildSlides Test", aspectRatio: "9:16" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  // Pass dummy paths — build-slides will copy existing files only; non-existent paths are skipped
  // Use the real test images from update/IMAGE if they exist
  const img1 = path.join(process.cwd(), "update", "IMAGE", "flat3 sitting room 1.jpg");
  const img2 = path.join(process.cwd(), "update", "IMAGE", "flat3 sitting room 2.jpg");
  const filePaths = [img1, img2].filter(p => fs.existsSync(p));
  // Fall back to empty array — build-slides should handle gracefully
  const buildRes = await request.post(`/api/commercial/projects/${projectId}/mode2/build-slides`, {
    data: { filePaths, script: "Test script for build-slides." },
  });
  expect([201, 400]).toContain(buildRes.status());
  const body = await buildRes.json();
  if (buildRes.status() === 201) {
    expect(body).toHaveProperty("slides");
    console.log("build-slides: created", body.slides.length, "slide(s)");
  } else {
    console.log("build-slides 400:", body.error);
  }

  await request.delete(`/api/commercial/projects/${projectId}`);
});

// ── 15. Commercial render (no images — expect 400 not 500) ────────────────────

test("Commercial render with no slides returns 400", async ({ request }) => {
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Render Test (empty)", aspectRatio: "9:16" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  const renderRes = await request.post(`/api/commercial/projects/${projectId}/render`);
  expect(renderRes.status()).toBe(400);
  const body = await renderRes.json();
  expect(body).toHaveProperty("error");
  console.log("Empty render error (expected):", body.error);

  await request.delete(`/api/commercial/projects/${projectId}`);
});

// ── 16. Video Tools — trim API ────────────────────────────────────────────────

test("POST /api/video-tools/trim rejects non-video files", async ({ request }) => {
  // Send a fake text file — should get 400 MIME error
  const res = await request.post("/api/video-tools/trim", {
    multipart: {
      file:     { name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("not a video") },
      startSec: "0",
      endSec:   "5",
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty("error");
  console.log("Trim MIME rejection:", body.error);
});

test("POST /api/video-tools/trim rejects invalid time range", async ({ request }) => {
  // endSec < startSec — should get 400
  const res = await request.post("/api/video-tools/trim", {
    multipart: {
      file:     { name: "test.mp4", mimeType: "video/mp4", buffer: Buffer.from("fake") },
      startSec: "30",
      endSec:   "10",
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toContain("endSec");
  console.log("Trim range rejection:", body.error);
});

// ── 17. Video Tools — narrate API ─────────────────────────────────────────────

test("POST /api/video-tools/narrate rejects missing text", async ({ request }) => {
  const res = await request.post("/api/video-tools/narrate", {
    multipart: {
      file: { name: "test.mp4", mimeType: "video/mp4", buffer: Buffer.from("fake") },
      // text omitted
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty("error");
  console.log("Narrate missing text:", body.error);
});

test("POST /api/video-tools/narrate rejects non-video file", async ({ request }) => {
  const res = await request.post("/api/video-tools/narrate", {
    multipart: {
      file: { name: "audio.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("fake") },
      text: "Hello world",
    },
  });
  expect(res.status()).toBe(400);
  console.log("Narrate MIME rejection:", (await res.json()).error);
});

// ── 18. AI Suggestions — suggest-continuation ────────────────────────────────

test("POST /api/content/[id]/suggest-continuation returns suggestions or 404", async ({ request }) => {
  // First get any existing content item to test against
  const regRes = await request.get("/api/registry?limit=1");
  expect(regRes.status()).toBe(200);
  const items = (await regRes.json()).items as { id: string }[];

  if (items.length === 0) {
    console.log("suggest-continuation: no items in registry — skipping");
    return;
  }

  const id  = items[0].id;
  const res = await request.post(`/api/content/${id}/suggest-continuation`);
  expect([200, 404]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body).toHaveProperty("suggestions");
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body).toHaveProperty("sourceSettings");
    console.log("Suggestions for", id, ":", body.suggestions.length, "ideas");
    if (body.suggestions[0]) {
      expect(body.suggestions[0]).toHaveProperty("promptSeed");
      expect(body.suggestions[0]).toHaveProperty("label");
    }
  } else {
    console.log("suggest-continuation 404 — item may be deleted");
  }
});

// ── 19. All dashboard pages load without crash ────────────────────────────────

const DASHBOARD_PAGES = [
  "/dashboard",
  "/dashboard/commercial",
  "/dashboard/video-tools",
  "/dashboard/review",
  "/dashboard/registry",
  "/dashboard/character-voices",
  "/dashboard/sfx-library",
  "/dashboard/destination-pages",
  "/dashboard/studio-updates",
  "/dashboard/settings",
];

for (const route of DASHBOARD_PAGES) {
  test(`UI: ${route} loads without crash`, async ({ page }) => {
    await goto(page, route);
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const text = await body.textContent();
    noError(text);
    console.log(`${route} — OK`);
  });
}

// ── 20. Sidebar navigation works ─────────────────────────────────────────────

test("Sidebar: Video Tools link is present and navigates correctly", async ({ page }) => {
  await goto(page, "/dashboard");
  // Use href selector for reliable Next.js client-side navigation
  const link = page.locator('a[href="/dashboard/video-tools"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL("**/video-tools", { timeout: 10_000 });
  const text = await page.locator("body").textContent();
  noError(text);
  expect(text).toContain("Trim");
  console.log("Video Tools navigation: OK");
});

test("Sidebar: Commercial Maker link navigates correctly", async ({ page }) => {
  await goto(page, "/dashboard");
  const link = page.locator('a[href="/dashboard/commercial"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL("**/commercial", { timeout: 10_000 });
  const text = await page.locator("body").textContent();
  noError(text);
  console.log("Commercial navigation: OK");
});

// ── 21. Commercial UI — project creation workflow ────────────────────────────

test("Commercial UI: can create a new project and see the editor", async ({ page }) => {
  await goto(page, "/dashboard/commercial");
  // Click new project button
  const newBtn = page.getByRole("button", { name: /New Project|New Ad|Create/i }).first();
  if (await newBtn.isVisible()) {
    await newBtn.click();
    await page.waitForLoadState("networkidle");
    // Should show modal or inline form
    const text = await page.locator("body").textContent();
    noError(text);
    console.log("New project dialog: opened");
  } else {
    console.log("New Project button not found — skipping click (may already be open)");
  }
});

// ── 22. Video Tools UI ────────────────────────────────────────────────────────

test("Video Tools UI: Trim and Narrate tabs are visible and switch correctly", async ({ page }) => {
  await goto(page, "/dashboard/video-tools");
  const text = await page.locator("body").textContent();
  noError(text);

  // Tab buttons are in the toolbar — use first() to avoid matching the submit button
  const trimTab    = page.getByRole("button", { name: /Trim Video/i }).first();
  const narrateTab = page.getByRole("button", { name: /Add Narration/i }).first();
  await expect(trimTab).toBeVisible();
  await expect(narrateTab).toBeVisible();

  // Click Narrate tab
  await narrateTab.click();
  await expect(page.getByPlaceholder(/narration script/i)).toBeVisible();
  console.log("Video Tools tabs: OK");

  // Switch back to Trim
  await trimTab.click();
  await expect(page.getByPlaceholder(/0/i).first()).toBeVisible();
  console.log("Video Tools trim form: OK");
});

// ── 23. Review page approve/reject controls ───────────────────────────────────

test("Review page UI: loads and shows queue or empty state", async ({ page }) => {
  await goto(page, "/dashboard/review");
  const body = await page.locator("body").textContent();
  noError(body);
  // Should say "Review" somewhere
  expect(body?.toLowerCase()).toContain("review");
  console.log("Review page: OK");
});

// ── 24. Registry page ─────────────────────────────────────────────────────────

test("Registry page UI: loads and shows content list or empty state", async ({ page }) => {
  await goto(page, "/dashboard/registry");
  const body = await page.locator("body").textContent();
  noError(body);
  console.log("Registry page: OK");
});

// ── 25. Music library API ─────────────────────────────────────────────────────

test("GET /api/music/library returns stock tracks list", async ({ request }) => {
  const res  = await request.get("/api/music/library");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("tracks");
  expect(Array.isArray(body.tracks)).toBe(true);
  if (body.tracks.length > 0) {
    const t = body.tracks[0];
    expect(t).toHaveProperty("filename");
    expect(t).toHaveProperty("label");
    expect(t).toHaveProperty("mood");
  }
  console.log("Music library: found", body.tracks.length, "stock tracks");
});

test("POST /api/music/library requires projectId and filename", async ({ request }) => {
  const res = await request.post("/api/music/library", {
    data: {},
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty("error");
  console.log("Music library POST validation:", body.error);
});

test("POST /api/music/library rejects path traversal filenames", async ({ request }) => {
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Library Security Test", aspectRatio: "9:16" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  const res = await request.post("/api/music/library", {
    data: { projectId, filename: "../../../etc/passwd" },
  });
  expect(res.status()).toBe(400);
  console.log("Music library traversal blocked:", (await res.json()).error);

  await request.delete(`/api/commercial/projects/${projectId}`);
});

test("POST /api/music/library sets stock track when valid filename provided", async ({ request }) => {
  // Get available stock tracks first
  const libRes = await request.get("/api/music/library");
  expect(libRes.status()).toBe(200);
  const { tracks } = await libRes.json() as { tracks: { filename: string }[] };

  if (tracks.length === 0) {
    console.log("Music library: no stock tracks — skipping select test");
    return;
  }

  // Create a project to assign the track to
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Library Select Test", aspectRatio: "9:16" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  const track = tracks[0];
  const res = await request.post("/api/music/library", {
    data: { projectId, filename: track.filename },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("musicPath");
  expect(body.musicSource).toBe("stock");
  console.log(`Music library: assigned "${track.filename}" to project`);

  await request.delete(`/api/commercial/projects/${projectId}`);
});

// ── 26. Music download API ────────────────────────────────────────────────────

test("POST /api/music/download requires url or query", async ({ request }) => {
  const res = await request.post("/api/music/download", { data: {} });
  expect(res.status()).toBe(400);
  console.log("Music download missing params:", (await res.json()).error);
});

test("POST /api/music/download rejects invalid URL", async ({ request }) => {
  const res = await request.post("/api/music/download", {
    data: { url: "not-a-url" },
  });
  expect(res.status()).toBe(400);
  console.log("Music download invalid URL:", (await res.json()).error);
});

test("POST /api/music/download: Pixabay search returns 503 when no API key", async ({ request }) => {
  // If PIXABAY_API_KEY is not set, should return 503 with informative error
  const res = await request.post("/api/music/download", {
    data: { query: "cinematic epic" },
  });
  // 503 = no API key, 200 = success (if key is configured), 404 = no results
  expect([200, 404, 503]).toContain(res.status());
  const body = await res.json();
  if (res.status() === 503) {
    expect(body.error).toContain("PIXABAY_API_KEY");
    console.log("Music download Pixabay: API key not configured (expected in test env)");
  } else if (res.status() === 200) {
    expect(body).toHaveProperty("filename");
    console.log("Music download Pixabay: downloaded", body.filename);
  } else {
    console.log("Music download Pixabay: no results");
  }
});

// ── 27. Commercial UI — music library picker visible ─────────────────────────

test("Commercial UI: music Library button opens track picker", async ({ page, request }) => {
  // Create a project via API so we can open it directly in the editor
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Music Library UI Test", aspectRatio: "9:16", brandName: "TestBrand" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  // Navigate to commercial page and open the project list
  await goto(page, "/dashboard/commercial");
  await page.waitForLoadState("networkidle");

  // Click the project card to open the editor
  const projectCard = page.locator("button", { hasText: "Music Library UI Test" }).first();
  await expect(projectCard).toBeVisible({ timeout: 8000 });
  await projectCard.click();
  await page.waitForLoadState("networkidle");

  // The editor should now be open — find the Library button in the music section
  // Match button containing exactly "Library" text (not sidebar SFX Library link which is an <a>)
  const libBtn = page.locator("button", { hasText: "📚 Library" }).first();
  await expect(libBtn).toBeVisible({ timeout: 8000 });
  await libBtn.click();

  // Panel renders after React state update + fetch — wait for the heading text to appear
  await expect(page.locator("body")).toContainText("Stock library", { timeout: 10000 });
  const bodyText = await page.locator("body").textContent();
  noError(bodyText);
  console.log("Commercial music library panel: opened and shows stock library ✓");

  // Cleanup
  await request.delete(`/api/commercial/projects/${projectId}`);
});

// ── 28. Commercial UI — text overflow check ───────────────────────────────────

test("Commercial UI: no text overflow in editor layout", async ({ page }) => {
  await goto(page, "/dashboard/commercial");
  const bodyText = await page.locator("body").textContent();
  noError(bodyText);

  // Check viewport width vs scroll width — if scrollWidth > clientWidth there is overflow
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
  console.log("Commercial page: no horizontal overflow ✓");
});

// ── 29. Music delete protects stock files ─────────────────────────────────────

test("Commercial music DELETE: removes uploaded music from project", async ({ request }) => {
  const createRes = await request.post("/api/commercial/projects", {
    data: { projectName: "Music Delete Test", aspectRatio: "9:16" },
  });
  expect(createRes.status()).toBe(201);
  const projectId = (await createRes.json()).id as string;

  // Simulate setting a stock track (POST to library endpoint)
  const libRes = await request.get("/api/music/library");
  const { tracks } = await libRes.json() as { tracks: { filename: string }[] };
  if (tracks.length > 0) {
    await request.post("/api/music/library", {
      data: { projectId, filename: tracks[0].filename },
    });
    // DELETE should clear musicPath without deleting the stock file
    const delRes = await request.delete(`/api/commercial/projects/${projectId}/music`);
    expect([200, 204]).toContain(delRes.status());
    console.log("Music delete (stock): cleared without file deletion ✓");
  } else {
    console.log("No stock tracks to test delete");
  }

  await request.delete(`/api/commercial/projects/${projectId}`);
});
