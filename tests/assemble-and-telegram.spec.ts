// Full Teddy & Dog Assembly + Send to Telegram via AUT
// Runs all 9 pipeline steps, waits for real output file, sends to Henry's Telegram

import { test, chromium, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3200";
const AUT_API = "http://localhost:8503/api/chat";
const ASSEMBLED_DIR = path.join(__dirname, "../storage/video/assembled");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const ss = async (name: string, page: Page) => {
  const p = path.join(SCREENSHOT_DIR, `tg_${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`📸 ${name}`);
};

const sendTelegram = async (page: Page, msg: string) => {
  try {
    await page.request.post(AUT_API, { data: { message: msg } });
    console.log(`📨 Telegram: ${msg.slice(0, 80)}`);
  } catch { console.log("⚠ Telegram send failed"); }
};

const TEDDY_STORY = `Teddy is a 9-year-old boy who finds a lost puppy named Scout in the park. Scout has floppy ears, big brown eyes, and a tiny wagging tail. Teddy names him Scout because he's always sniffing around exploring. They go on adventures together every day after school. One day, Scout gets lost chasing a butterfly into the woods. Teddy is heartbroken and searches everywhere. With help from his neighbours Marta and Pip, Teddy puts up posters all over the neighbourhood. Three days later, a kind old man named Claw finds Scout and returns him. Teddy learns that love, friendship, and never giving up are the greatest adventures of all.`;

const TEDDY_CHARACTERS = [
  { displayName: "TEDDY", characterId: "XX_TEDDY9KF35", roleType: "protagonist", voiceId: "en_US-lessac-medium", species: "human" },
  { displayName: "SCOUT", characterId: "XX_SCOUT2VG35", roleType: "companion", voiceId: "en_US-joe-medium", species: "dog" },
  { displayName: "CLAW", characterId: "XX_CLAW1QD35", roleType: "supporting", voiceId: "en_US-danny-low", species: "human" },
  { displayName: "MARTA", characterId: "XX_MARTA2MR35", roleType: "supporting", voiceId: "en_US-amy-medium", species: "human" },
  { displayName: "PIP", characterId: "XX_PIPB6935", roleType: "supporting", voiceId: "en_US-hfc_female-medium", species: "human" },
];

// Only use Apr 17 scenes (Teddy & Dog session) — SC04/SC07 are Apr 15 from a different project
const SCENE_IDS = ["SC01", "SC03", "SC05", "SC06"];

test.describe("Assemble Teddy & Dog and Send to Telegram", () => {
  test.setTimeout(900000); // 15 min

  test("Full 9-step assembly + Telegram delivery", async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    // Record existing assembled files BEFORE we start
    const filesBefore = new Set(fs.readdirSync(ASSEMBLED_DIR));
    console.log(`Files before assembly: ${filesBefore.size}`);

    // Connect to Henry's Chrome
    let browser;
    try {
      browser = await chromium.connectOverCDP("http://localhost:9222");
    } catch {
      browser = await chromium.launch({ headless: false });
    }
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages().find(p => p.url().includes("localhost:3200")) || await context.newPage();

    await sendTelegram(page, "🎬 Starting Teddy & Dog assembly — all 9 steps running now...");

    // Navigate to Hybrid Planner
    await page.goto(`${BASE}/dashboard/hybrid-planner`);
    await page.waitForLoadState("networkidle");
    await ss("01-loaded", page);

    // ── Fetch video registry ──────────────────────────────────────────────────
    const registryRes = await page.request.get(`${BASE}/api/hybrid/video-registry`);
    const videoRegistry = registryRes.ok() ? await registryRes.json() : {};

    // ── Check audio files ─────────────────────────────────────────────────────
    const charAudioFiles: Record<string, string> = {
      "XX_SCOUT2VG35": "char_XX_SCOUT2VG35_draft.wav",
      "XX_CLAW1QD35": "char_XX_CLAW1QD35_draft.wav",
      "XX_MARTA2MR35": "char_XX_MARTA2MR35_draft.wav",
      "XX_PIPB6935": "char_XX_PIPB6935_draft.wav",
      "XX_TEDDY9KF35": "char_XX_TEDDY9KF35_draft.wav",
    };
    const charAudioUrls: Record<string, string> = {};
    for (const [charId, filename] of Object.entries(charAudioFiles)) {
      const r = await page.request.head(`${BASE}/api/media/narration/${filename}`).catch(() => null);
      if (r?.ok()) charAudioUrls[charId] = `/api/media/narration/${filename}`;
    }

    // ── Check narration audio — use ONLY the Teddy & Dog specific file ─────────
    // narration_draft.wav (171s) and narration_1776228997307.wav (3.5s) are from OTHER projects
    // narration_teddy_dog_full_wav.wav (34.6s) is specifically for this story
    let narratorAudioUrl: string | null = null;
    for (const f of ["narration_teddy_dog_full_wav.wav"]) {
      const r = await page.request.head(`${BASE}/api/media/narration/${f}`).catch(() => null);
      if (r?.ok()) { narratorAudioUrl = `/api/media/narration/${f}`; break; }
    }
    console.log(`Narrator audio: ${narratorAudioUrl || "NONE — will assemble without narration"}`);

    // ── Build scene videos from registry ─────────────────────────────────────
    const sceneVideos: Record<string, string> = {};
    for (const id of SCENE_IDS) {
      if (videoRegistry[id]) sceneVideos[id] = videoRegistry[id];
    }

    // ── Build scenes ──────────────────────────────────────────────────────────
    const sentences = TEDDY_STORY.split(". ");
    const scenes = SCENE_IDS.map((id, i) => ({
      sceneId: id,
      scene: i + 1,
      title: `Scene ${i + 1}`,
      description: sentences[i] || `Teddy and Scout scene ${i + 1}`,
      location: "neighbourhood",
      mood: "heartwarming",
      sceneType: "image-led",
      status: "approved",
      motionDuration: 8,
      narrationScript: sentences[i] || "",
      narrationMode: "narrator",
      narrationStrength: "medium",
      musicStyle: "emotional",
      musicIntensity: "medium",
      sfx: "",
      ambience: "outdoor",
      shots: [],
      audioPlan: { narrationIntensity: "medium", musicMood: "emotional", musicIntensity: "medium", sfxList: [], ambienceList: ["outdoor"], transitionAudio: "" },
      costEstimate: 1,
    }));

    // ── Re-navigate before writing localStorage (page may have changed) ─────
    await page.goto(`${BASE}/dashboard/hybrid-planner`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // ── Write project state to localStorage ──────────────────────────────────
    const projectData = {
      projectId: "teddy_dog_restored",
      projectTitle: "Teddy & Dog",
      projectPhase: "assembly",
      genre: "Children Story",
      tone: "Heartwarming",
      idea: TEDDY_STORY,
      expandedSummary: TEDDY_STORY,
      fullScript: TEDDY_STORY,
      characters: TEDDY_CHARACTERS,
      scenes,
      sceneImages: {},
      sceneVideos,
      narratorAudioUrl,
      characterAudioUrls: {}, // cleared — per-line timing needed before enabling
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
      // narration-only = no character voices, avoids all-voices-at-once chaos
      // character voices need per-line timing to work properly (future fix)
      storyMode: "narration-only",
      projectStyle: "3D Cinematic",
      reviewMode: "narration-only",
      timestamp: Date.now(),
    };

    await page.evaluate(({ data }) => {
      localStorage.setItem("ghs_hybrid_proj_teddy_dog_restored", JSON.stringify(data));
      localStorage.setItem("ghs_hybrid_active_proj", "teddy_dog_restored");
      localStorage.setItem("ghs_hybrid_proj_list", JSON.stringify(["teddy_dog_restored"]));
    }, { data: projectData });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await ss("02-project-loaded", page);

    // ── Go to Assembly tab ────────────────────────────────────────────────────
    const assemblyTab = page.locator('button, [role="tab"]').filter({ hasText: /Assembly/ }).first();
    await assemblyTab.click().catch(() => page.locator('text=Assembly').first().click());
    await page.waitForTimeout(1500);

    // ── Select all scenes ─────────────────────────────────────────────────────
    const allBtn = page.locator('button').filter({ hasText: /^All$/ }).first();
    if (await allBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allBtn.click();
      await page.waitForTimeout(500);
    }

    // ── Open Step 9 and click Assemble ────────────────────────────────────────
    const step9 = page.locator('text=Assemble Movie').first();
    await step9.scrollIntoViewIfNeeded();
    await step9.click();
    await page.waitForTimeout(800);
    await ss("03-step9-open", page);

    const assembleBtn = page.locator('button').filter({ hasText: /Assemble My Movie/ }).first();
    // Scroll the button into view first (it may be below the viewport inside the accordion)
    await assembleBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    const ready = await assembleBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!ready) {
      const btnText = await assembleBtn.textContent().catch(() => "not found");
      const allBtns = await page.locator('button').allTextContents();
      console.log("Buttons visible:", allBtns.filter(b => b.trim()).slice(0, 20).join(" | "));
      throw new Error(`Assemble button not clickable: "${btnText}"`);
    }

    const btnLabel = await assembleBtn.textContent();
    console.log(`⏳ Clicking: "${btnLabel}"`);
    await assembleBtn.click();
    await ss("04-assembling", page);
    await sendTelegram(page, `⏳ Assembly started: ${btnLabel} — waiting for output file...`);

    // ── Poll for new file in assembled directory (more reliable than browser wait) ──
    console.log("⏳ Polling for new assembled file (up to 12 minutes)...");
    let newFile: string | null = null;
    const pollStart = Date.now();
    const POLL_TIMEOUT = 720000; // 12 minutes

    while (Date.now() - pollStart < POLL_TIMEOUT) {
      await page.waitForTimeout(10000); // check every 10 seconds
      const filesNow = fs.readdirSync(ASSEMBLED_DIR);
      const newFiles = filesNow.filter(f => !filesBefore.has(f) && f.endsWith(".mp4"));
      if (newFiles.length > 0) {
        newFile = newFiles[newFiles.length - 1]; // take most recent
        console.log(`✓ New assembled file detected: ${newFile}`);
        break;
      }
      const elapsed = Math.round((Date.now() - pollStart) / 1000);
      console.log(`  ...polling (${elapsed}s elapsed)...`);
    }

    await ss("05-after-assembly", page);

    if (!newFile) {
      await sendTelegram(page, "❌ Assembly TIMED OUT after 12 minutes — no output file produced. Check server logs.");
      throw new Error("Assembly timed out — no new file produced");
    }

    // ── Verify audio in new file ──────────────────────────────────────────────
    const videoUrl = `/api/media/video/assembled/${newFile}`;
    const audioRes = await page.request.post(`${BASE}/api/hybrid/check-audio`, {
      data: { videoUrl },
    });

    let audioInfo = { hasAudio: false, duration: 0, audioCodec: "", audioChannels: 0 };
    if (audioRes.ok()) {
      audioInfo = await audioRes.json();
      console.log(`🔊 Audio: hasAudio=${audioInfo.hasAudio} | ${audioInfo.duration?.toFixed(1)}s | ${audioInfo.audioCodec} | ${audioInfo.audioChannels}ch`);
    }

    const fileSizeMB = (fs.statSync(path.join(ASSEMBLED_DIR, newFile)).size / 1024 / 1024).toFixed(1);

    // ── Send result to Telegram ───────────────────────────────────────────────
    const tgMsg = audioInfo.hasAudio
      ? `✅ Teddy & Dog ASSEMBLED!\n🎬 File: ${newFile}\n📏 Size: ${fileSizeMB} MB\n⏱ Duration: ${audioInfo.duration?.toFixed(1)}s\n🔊 Audio: ${audioInfo.audioCodec} ${audioInfo.audioChannels}ch ✓\n🔗 ${BASE}${videoUrl}`
      : `⚠️ Teddy & Dog assembled BUT no audio!\n🎬 File: ${newFile}\n📏 Size: ${fileSizeMB} MB\n🔗 ${BASE}${videoUrl}`;

    await sendTelegram(page, tgMsg);
    await ss("06-done", page);

    // ── Also send all assembled videos list ──────────────────────────────────
    const allFiles = fs.readdirSync(ASSEMBLED_DIR)
      .filter(f => f.endsWith(".mp4"))
      .sort((a, b) => {
        const ta = fs.statSync(path.join(ASSEMBLED_DIR, a)).mtimeMs;
        const tb = fs.statSync(path.join(ASSEMBLED_DIR, b)).mtimeMs;
        return tb - ta;
      })
      .slice(0, 5); // 5 most recent

    const videoListMsg = "📽 Your 5 most recent assembled videos:\n" + allFiles.map((f, i) => {
      const size = (fs.statSync(path.join(ASSEMBLED_DIR, f)).size / 1024 / 1024).toFixed(1);
      return `${i + 1}. ${f} (${size} MB)\n   ${BASE}/api/media/video/assembled/${f}`;
    }).join("\n");

    await sendTelegram(page, videoListMsg);

    expect(audioInfo.hasAudio).toBe(true);
    expect(audioInfo.duration).toBeGreaterThan(10);
    console.log("🎉 DONE — video assembled and sent to Telegram");
  });
});
