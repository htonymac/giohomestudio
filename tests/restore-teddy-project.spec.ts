// Restore Teddy & Dog project in Hybrid Planner
// Uses server-side video registry (SC01-SC07) + narration/character audio from storage
// Runs all 9 assembly steps after restoring

import { test, chromium, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const ss = async (name: string, page: Page) => {
  const p = path.join(SCREENSHOT_DIR, `teddy_${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`📸 ${name}`);
};

// Teddy & Dog story from session recording
const TEDDY_STORY = `Teddy is a 9-year-old boy who finds a lost puppy named Scout in the park. Scout has floppy ears, big brown eyes, and a tiny wagging tail. Teddy names him Scout because he's always sniffing around exploring. They go on adventures together every day after school. One day, Scout gets lost chasing a butterfly into the woods. Teddy is heartbroken and searches everywhere. With help from his neighbours Marta and Pip, Teddy puts up posters all over the neighbourhood. Three days later, a kind old man named Claw finds Scout and returns him. Teddy learns that love, friendship, and never giving up are the greatest adventures of all.`;

// Characters from session recording: BENNY, SCOUT, CLAW, MARTA, PIP + Teddy
const TEDDY_CHARACTERS = [
  { displayName: "TEDDY", characterId: "XX_TEDDY9KF35", roleType: "protagonist", voiceId: "en_US-lessac-medium", species: "human" },
  { displayName: "SCOUT", characterId: "XX_SCOUT2VG35", roleType: "companion", voiceId: "en_US-joe-medium", species: "dog" },
  { displayName: "CLAW", characterId: "XX_CLAW1QD35", roleType: "supporting", voiceId: "en_US-danny-low", species: "human" },
  { displayName: "MARTA", characterId: "XX_MARTA2MR35", roleType: "supporting", voiceId: "en_US-amy-medium", species: "human" },
  { displayName: "PIP", characterId: "XX_PIPB6935", roleType: "supporting", voiceId: "en_US-hfc_female-medium", species: "human" },
];

// Scene IDs from video registry
const SCENE_IDS = ["SC01", "SC02", "SC03", "SC04", "SC05", "SC06", "SC07"];

test.describe("Restore and Assemble Teddy & Dog", () => {
  test.setTimeout(600000);

  test("Restore project state and run full assembly", async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // Connect to Henry's main Chrome browser
    let browser;
    try {
      browser = await chromium.connectOverCDP("http://localhost:9222");
    } catch {
      browser = await chromium.launch({ headless: false });
    }
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages().find(p => p.url().includes("localhost:3200")) || await context.newPage();

    // Navigate to Hybrid Planner
    await page.goto(`${BASE}/dashboard/hybrid-planner`);
    await page.waitForLoadState("networkidle");
    await ss("01-loaded", page);

    // ── Step A: Restore project state in localStorage ────────────────────────────
    // Fetch video registry to get actual video URLs
    const registryRes = await page.request.get(`${BASE}/api/hybrid/video-registry`);
    const videoRegistry = registryRes.ok() ? await registryRes.json() : {};
    console.log("Video registry:", JSON.stringify(videoRegistry));

    // Check which narration audio files exist
    const availableNarration = await page.evaluate(async (baseUrl) => {
      const files = ["narration_draft.wav", "narration_1776228997307.wav"];
      const results: Record<string, boolean> = {};
      for (const f of files) {
        try {
          const r = await fetch(`${baseUrl}/api/media/narration/${f}`, { method: "HEAD" });
          results[f] = r.ok;
        } catch { results[f] = false; }
      }
      return results;
    }, BASE);
    console.log("Available narration files:", availableNarration);

    // Check character audio files
    const charAudioFiles = {
      "XX_BENNY9KF35": "char_XX_BENNY9KF35_draft.wav",
      "XX_SCOUT2VG35": "char_XX_SCOUT2VG35_draft.wav",
      "XX_CLAW1QD35": "char_XX_CLAW1QD35_draft.wav",
      "XX_MARTA2MR35": "char_XX_MARTA2MR35_draft.wav",
      "XX_PIPB6935": "char_XX_PIPB6935_draft.wav",
    };
    const charAudioUrls: Record<string, string> = {};
    for (const [charId, filename] of Object.entries(charAudioFiles)) {
      const url = `/api/media/narration/${filename}`;
      try {
        const r = await page.request.head(`${BASE}${url}`);
        if (r.ok()) {
          charAudioUrls[charId] = url;
          console.log(`✓ Character audio exists: ${charId} → ${filename}`);
        }
      } catch { /* skip */ }
    }

    // Build scene videos from registry
    const sceneVideos: Record<string, string> = {};
    const sceneImages: Record<string, string> = {};
    for (const id of SCENE_IDS) {
      if (videoRegistry[id]) {
        sceneVideos[id] = videoRegistry[id];
        console.log(`✓ Scene video: ${id} → ${videoRegistry[id]}`);
      }
    }

    // Pick best narrator audio (prefer the non-draft one if it exists)
    const narratorAudioUrl = availableNarration["narration_1776228997307.wav"]
      ? "/api/media/narration/narration_1776228997307.wav"
      : availableNarration["narration_draft.wav"]
        ? "/api/media/narration/narration_draft.wav"
        : null;
    console.log(`Narrator audio: ${narratorAudioUrl || "NONE"}`);

    // Build scenes for localStorage
    const scenes = SCENE_IDS.map((id, i) => ({
      sceneId: id,
      scene: i + 1,
      title: `Scene ${i + 1}`,
      description: TEDDY_STORY.split(". ")[i] || `Teddy and Scout scene ${i + 1}`,
      location: "neighbourhood",
      mood: "heartwarming",
      sceneType: "image-led",
      status: "approved",
      motionDuration: 8,
      narrationScript: TEDDY_STORY.split(". ")[i] || "",
      narrationMode: "narrator",
      narrationStrength: "medium",
      musicStyle: "emotional",
      musicIntensity: "medium",
      sfx: "",
      ambience: "outdoor",
      shots: [],
      audioPlan: { narrationIntensity: "medium", musicMood: "emotional", musicIntensity: "medium", sfxList: ["birds", "wind"], ambienceList: ["outdoor"], transitionAudio: "" },
      costEstimate: 1,
    }));

    // Write project state to localStorage
    const localId = "teddy_dog_restored";
    const projectData = {
      projectId: "teddy_dog_restored",
      projectTitle: "Teddy & Dog",
      projectPhase: "assembly",
      genre: "Children Story",
      tone: "Heartwarming",
      idea: TEDDY_STORY,
      expandedSummary: TEDDY_STORY,
      characters: TEDDY_CHARACTERS,
      scenes,
      sceneImages,
      sceneVideos,
      narratorAudioUrl,
      characterAudioUrls: charAudioUrls,
      characterPiperVoices: {
        "XX_SCOUT2VG35": "en_US-joe-medium",
        "XX_CLAW1QD35": "en_US-danny-low",
        "XX_MARTA2MR35": "en_US-amy-medium",
        "XX_PIPB6935": "en_US-hfc_female-medium",
        "XX_TEDDY9KF35": "en_US-lessac-medium",
      },
      selectedMusicUrl: null,
      selectedMusicName: "",
      subtitleStyle: "classic",
      storyMode: "mixed",
      projectStyle: "3D Cinematic",
      timestamp: Date.now(),
    };

    await page.evaluate(({ id, data }) => {
      localStorage.setItem(`ghs_hybrid_proj_${id}`, JSON.stringify(data));
      localStorage.setItem("ghs_hybrid_active_proj", id);
      localStorage.setItem("ghs_hybrid_proj_list", JSON.stringify([id]));
      console.log("Project data written to localStorage");
    }, { id: localId, data: projectData });

    console.log("✓ Project state written to localStorage");

    // Reload page to pick up the restored state
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await ss("02-project-restored", page);

    // ── Verify project loaded correctly ──────────────────────────────────────────
    const pageText = await page.locator("body").innerText();
    const hasTeddy = pageText.includes("Teddy") || pageText.includes("teddy");
    const hasScenes = pageText.includes("SC0") || pageText.includes("Scene Board");
    console.log(`Project title visible: ${hasTeddy}, Scenes: ${hasScenes}`);

    // ── Go to Assembly tab ────────────────────────────────────────────────────────
    const assemblyTab = page.locator('button, [role="tab"]').filter({ hasText: /^Assembly$/ }).first();
    if (await assemblyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assemblyTab.click();
    } else {
      await page.locator('text=Assembly').first().click();
    }
    await page.waitForTimeout(1500);
    await ss("03-assembly-tab", page);

    // ── Select all scenes ─────────────────────────────────────────────────────────
    // Button says "All" in the scene selector area (next to "None")
    const selectAll = page.locator('button').filter({ hasText: /^All$/ }).first();
    if (await selectAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAll.click();
      await page.waitForTimeout(500);
      console.log("✓ All scenes selected");
    } else {
      // Try "Select All" variant
      const selectAll2 = page.locator('button').filter({ hasText: /Select All/ }).first();
      if (await selectAll2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await selectAll2.click();
        console.log("✓ All scenes selected (variant)");
      }
    }

    // ── Open Step 9 (Assemble Movie) in the production pipeline ─────────────────
    // Step 9 header contains "Step 9 — Assemble Movie"
    const step9Header = page.locator('text=Assemble Movie').first();
    if (await step9Header.isVisible({ timeout: 5000 }).catch(() => false)) {
      await step9Header.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await step9Header.click();
      await page.waitForTimeout(800);
      console.log("✓ Step 9 (Assemble Movie) opened");
    } else {
      // Scroll the main content area and try again
      await page.evaluate(() => {
        const main = document.querySelector("main") || document.querySelector("[class*='content']") || document.body;
        main.scrollTop = main.scrollHeight;
      });
      await page.waitForTimeout(500);
      const step9b = page.locator('text=Assemble Movie').first();
      if (await step9b.isVisible({ timeout: 3000 }).catch(() => false)) {
        await step9b.scrollIntoViewIfNeeded();
        await step9b.click();
        await page.waitForTimeout(800);
        console.log("✓ Step 9 opened (after scroll)");
      }
    }
    await ss("04-step9-opened", page);

    // ── ASSEMBLE ──────────────────────────────────────────────────────────────────
    // Button text: "🚀 Assemble My Movie (N scenes)" or "🔒 Complete Step 2 to unlock"
    const assembleBtn = page.locator('button').filter({
      hasText: /Assemble My Movie|🚀 Assemble/,
    }).first();

    const btnVisible = await assembleBtn.isVisible({ timeout: 5000 }).catch(() => false);
    await ss("05-before-assemble", page);

    if (!btnVisible) {
      // Log all buttons for debugging
      const buttons = await page.locator('button').allTextContents();
      console.log("All buttons:", buttons.filter(b => b.trim()).join(" | "));
      throw new Error("Assemble button not found — check screenshots");
    }

    const btnText = await assembleBtn.textContent();
    console.log(`⏳ Clicking: "${btnText}"`);
    await assembleBtn.click();

    await ss("06-assembly-running", page);

    // ── Wait for assembled video player (has `controls` — hero banner does NOT) ───
    console.log("⏳ Waiting for assembled video (up to 5 minutes)...");
    // The assembled video in Step 9 has `controls` attribute; hero banner does not
    const videoEl = page.locator('video[controls]').first();
    await videoEl.waitFor({ state: "visible", timeout: 300000 });
    console.log("✓ VIDEO PLAYER VISIBLE — Assembly complete!");
    await ss("07-video-ready", page);

    // ── Verify video ─────────────────────────────────────────────────────────────
    const videoSrc = await videoEl.getAttribute("src");
    expect(videoSrc).toBeTruthy();
    console.log(`Video URL: ${videoSrc}`);

    if (videoSrc) {
      const headRes = await page.request.head(`${BASE}${videoSrc}`);
      const size = parseInt(headRes.headers()["content-length"] || "0");
      console.log(`Video: ${headRes.status()} | ${(size / 1024 / 1024).toFixed(2)} MB`);
      expect(headRes.status()).toBe(200);
      expect(size).toBeGreaterThan(100000);

      // Audio check
      const audioRes = await page.request.post(`${BASE}/api/hybrid/check-audio`, {
        data: { videoUrl: videoSrc },
      });
      if (audioRes.ok()) {
        const audio = await audioRes.json();
        console.log(`🔊 AUDIO: hasAudio=${audio.hasAudio} | ${audio.duration?.toFixed(1)}s | ${audio.audioCodec} | ${audio.audioChannels}ch | ${audio.audioStreams} stream(s)`);
        expect(audio.hasAudio).toBe(true);
        expect(audio.duration).toBeGreaterThan(5);
        console.log("✅ SOUND CONFIRMED — audio stream present in assembled video");
      }
    }

    // ── Final state screenshot ────────────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await ss("08-final", page);
    console.log("🎉 Teddy & Dog assembly COMPLETE — project restored and assembled successfully");
  });
});
