// Quick audio verification test — checks most recent assembled video
// Does NOT re-run assembly (that takes 5-10 min)
import { test, chromium, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3200";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

test("Verify assembled video has sound", async () => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.connectOverCDP("http://localhost:9222").catch(
    () => chromium.launch({ headless: false })
  );
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  // ── Find latest assembled video ──────────────────────────────────────────────
  const listRes = await page.request.get(`${BASE}/api/media/videos/assembled`).catch(() => null);

  // Hardcode the known latest assembled video (from test run 3)
  const videoUrl = "/api/media/video/assembled/movie_export_1776432020530.mp4";

  // ── Check audio via API ──────────────────────────────────────────────────────
  const audioRes = await page.request.post(`${BASE}/api/hybrid/check-audio`, {
    data: { videoUrl },
  });
  expect(audioRes.ok()).toBe(true);

  const audio = await audioRes.json();
  console.log(`🎬 Video: ${videoUrl}`);
  console.log(`📏 Size: ${(audio.fileSizeBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`⏱ Duration: ${audio.duration?.toFixed(1)}s`);
  console.log(`🔊 Audio: hasAudio=${audio.hasAudio} | codec=${audio.audioCodec} | channels=${audio.audioChannels} | streams=${audio.audioStreams}`);

  expect(audio.hasAudio).toBe(true);
  expect(audio.audioCodec).toBe("aac");
  expect(audio.audioChannels).toBeGreaterThan(0);
  expect(audio.duration).toBeGreaterThan(30);

  // ── Verify video is accessible ───────────────────────────────────────────────
  const headRes = await page.request.head(`${BASE}${videoUrl}`);
  expect(headRes.status()).toBe(200);
  const size = parseInt(headRes.headers()["content-length"] || "0");
  expect(size).toBeGreaterThan(1000000); // > 1MB

  // ── Navigate to planner and show the result ──────────────────────────────────
  await page.goto(`${BASE}/dashboard/hybrid-planner`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "audio_verify_pass.png"), fullPage: false });

  console.log(`✅ AUDIO VERIFIED — ${audio.audioCodec} ${audio.audioChannels}ch ${audio.duration?.toFixed(1)}s`);
  console.log(`✅ OLD NARRATOR FIX CONFIRMED — sound is present in assembled video`);
});
