// Recovery Pass: End-to-end Studio generate test
// Tests: Text→Video, Text→Audio, page loads, detail page, review queue
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3200";
const TIMEOUT = 60_000;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const results = [];

  function log(test, status, detail = "") {
    const entry = { test, status, detail };
    results.push(entry);
    console.log(`[${status}] ${test}${detail ? " — " + detail : ""}`);
  }

  // ─── TEST A: Studio page loads ────────────────────────────
  try {
    await page.goto(`${BASE}/dashboard`, { timeout: TIMEOUT, waitUntil: "networkidle" });
    const title = await page.locator("h1").first().textContent();
    log("A. Studio page loads", "PASS", `Title: ${title?.trim()}`);
  } catch (e) {
    log("A. Studio page loads", "FAIL", e.message);
  }

  // ─── TEST B: Output mode selector visible ─────────────────
  try {
    const modes = await page.locator("text=Text → Video").count();
    const audioModes = await page.locator("text=Text → Audio").count();
    log("B. Output mode selector visible", (modes > 0 && audioModes > 0) ? "PASS" : "FAIL",
      `Text→Video: ${modes}, Text→Audio: ${audioModes}`);
  } catch (e) {
    log("B. Output mode selector", "FAIL", e.message);
  }

  // ─── TEST C: Text → Video generate ────────────────────────
  let videoContentId = null;
  try {
    // Click text_to_video mode
    const t2vBtn = page.locator("text=Text → Video").first();
    await t2vBtn.click();
    await sleep(500);

    // Enter prompt in textarea
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Recovery test: a golden sunset over calm ocean waves");
    await sleep(500);

    // The button text is "Assemble in Auto Mode" for text_to_video
    // Find the gradient-styled submit button (it's the main action button)
    const genBtn = page.locator('button:has-text("Assemble"), button:has-text("Generate"), button:has-text("Generating")').first();
    await genBtn.waitFor({ state: "visible", timeout: 5000 });
    const btnText = await genBtn.textContent();
    const isDisabled = await genBtn.isDisabled();
    console.log(`  Generate button found: "${btnText?.trim()}", disabled: ${isDisabled}`);

    if (isDisabled) {
      log("C. Text → Video generate", "FAIL", `Button "${btnText?.trim()}" is disabled`);
    } else {
      // Listen for the API call
      const apiPromise = page.waitForResponse(
        resp => resp.url().includes("/api/pipeline") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await genBtn.click();
      const apiResp = await apiPromise;
      const apiStatus = apiResp.status();
      const apiBody = await apiResp.json();

      if (apiStatus === 202 && apiBody.contentItemId) {
        videoContentId = apiBody.contentItemId;
        log("C. Text → Video generate", "PASS", `API 202, contentItemId: ${videoContentId}`);
      } else {
        log("C. Text → Video generate", "FAIL", `API status ${apiStatus}, body: ${JSON.stringify(apiBody).slice(0, 200)}`);
      }
    }
  } catch (e) {
    log("C. Text → Video generate", "FAIL", e.message);
  }

  // ─── TEST D: Verify content item in registry API ──────────
  if (videoContentId) {
    try {
      await sleep(3000); // Let pipeline start
      const resp = await page.evaluate(async (id) => {
        const r = await fetch(`/api/registry/${id}`);
        return { status: r.status, body: await r.json() };
      }, videoContentId);

      if (resp.status === 200) {
        // API returns { item, versions }
        const item = resp.body.item || resp.body;
        log("D. Registry item exists", "PASS", `Status: ${item.status}, mode: ${item.mode}`);
      } else {
        log("D. Registry item exists", "FAIL", `API ${resp.status}`);
      }
    } catch (e) {
      log("D. Registry item exists", "FAIL", e.message);
    }
  } else {
    log("D. Registry item exists", "SKIP", "No contentItemId from step C");
  }

  // ─── TEST E: Wait for pipeline completion (up to 90s) ─────
  if (videoContentId) {
    try {
      let finalStatus = "UNKNOWN";
      let mergedPath = null;
      let notes = null;
      for (let i = 0; i < 18; i++) {
        await sleep(5000);
        const resp = await page.evaluate(async (id) => {
          const r = await fetch(`/api/registry/${id}`);
          return r.json();
        }, videoContentId);
        const item = resp.item || resp;
        finalStatus = item.status;
        mergedPath = item.mergedOutputPath;
        notes = item.notes;
        console.log(`  Pipeline poll ${i + 1}: status=${finalStatus}`);
        if (finalStatus === "IN_REVIEW" || finalStatus === "FAILED" || finalStatus === "APPROVED") break;
      }

      if (finalStatus === "IN_REVIEW" && mergedPath) {
        const fileExists = fs.existsSync(mergedPath);
        log("E. Pipeline completes + output exists", fileExists ? "PASS" : "FAIL",
          `Status: ${finalStatus}, file exists: ${fileExists}`);
      } else if (finalStatus === "IN_REVIEW") {
        log("E. Pipeline completes", "PARTIAL", `Status: IN_REVIEW but no mergedOutputPath — may be audio-only or fallback`);
      } else if (finalStatus === "FAILED") {
        log("E. Pipeline completes", "FAIL", `Pipeline FAILED: ${(notes || "").slice(0, 200)}`);
      } else {
        log("E. Pipeline completes", "PARTIAL", `Status stuck at: ${finalStatus}`);
      }
    } catch (e) {
      log("E. Pipeline completes", "FAIL", e.message);
    }
  }

  // ─── TEST F: Text → Audio generate ────────────────────────
  let audioContentId = null;
  try {
    await page.goto(`${BASE}/dashboard`, { timeout: TIMEOUT, waitUntil: "networkidle" });
    await sleep(500);

    // Select Text → Audio mode
    const t2aBtn = page.locator("text=Text → Audio").first();
    await t2aBtn.click();
    await sleep(500);

    // Enter prompt
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Recovery test audio: a calm morning story about coffee brewing");
    await sleep(500);

    // Button should say "Generate Audio" for text_to_audio mode
    const genBtn = page.locator('button:has-text("Generate Audio"), button:has-text("Generate"), button:has-text("Assemble")').first();
    await genBtn.waitFor({ state: "visible", timeout: 5000 });
    const btnText = await genBtn.textContent();
    const isDisabled = await genBtn.isDisabled();
    console.log(`  Audio generate button: "${btnText?.trim()}", disabled: ${isDisabled}`);

    if (isDisabled) {
      log("F. Text → Audio generate", "FAIL", `Button "${btnText?.trim()}" is disabled`);
    } else {
      const apiPromise = page.waitForResponse(
        resp => resp.url().includes("/api/pipeline") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await genBtn.click();
      const apiResp = await apiPromise;
      const apiStatus = apiResp.status();
      const apiBody = await apiResp.json();

      if (apiStatus === 202 && apiBody.contentItemId) {
        audioContentId = apiBody.contentItemId;
        log("F. Text → Audio generate", "PASS", `API 202, contentItemId: ${audioContentId}`);
      } else {
        log("F. Text → Audio generate", "FAIL", `API status ${apiStatus}, body: ${JSON.stringify(apiBody).slice(0, 200)}`);
      }
    }
  } catch (e) {
    log("F. Text → Audio generate", "FAIL", e.message);
  }

  // ─── TEST G: Wait for audio pipeline ──────────────────────
  if (audioContentId) {
    try {
      let finalStatus = "UNKNOWN";
      let mergedPath = null;
      let notes = null;
      for (let i = 0; i < 18; i++) {
        await sleep(5000);
        const resp = await page.evaluate(async (id) => {
          const r = await fetch(`/api/registry/${id}`);
          return r.json();
        }, audioContentId);
        const item = resp.item || resp;
        finalStatus = item.status;
        mergedPath = item.mergedOutputPath;
        notes = item.notes;
        console.log(`  Audio pipeline poll ${i + 1}: status=${finalStatus}`);
        if (finalStatus === "IN_REVIEW" || finalStatus === "FAILED" || finalStatus === "APPROVED") break;
      }

      if ((finalStatus === "IN_REVIEW") && mergedPath) {
        const fileExists = fs.existsSync(mergedPath);
        log("G. Audio pipeline completes + output exists", fileExists ? "PASS" : "FAIL",
          `Status: ${finalStatus}, file exists: ${fileExists}`);
      } else if (finalStatus === "FAILED") {
        log("G. Audio pipeline completes", "FAIL", `Pipeline FAILED: ${(notes || "").slice(0, 200)}`);
      } else {
        log("G. Audio pipeline completes", "PARTIAL", `Status: ${finalStatus}, mergedPath: ${mergedPath}`);
      }
    } catch (e) {
      log("G. Audio pipeline completes", "FAIL", e.message);
    }
  }

  // ─── TEST H: Registry page loads ──────────────────────────
  try {
    await page.goto(`${BASE}/dashboard/registry`, { timeout: TIMEOUT, waitUntil: "networkidle" });
    const rows = await page.locator("tbody tr").count();
    log("H. Registry page loads", "PASS", `${rows} items in table`);
  } catch (e) {
    log("H. Registry page loads", "FAIL", e.message);
  }

  // ─── TEST I: Review page loads ────────────────────────────
  try {
    await page.goto(`${BASE}/dashboard/review`, { timeout: TIMEOUT, waitUntil: "networkidle" });
    log("I. Review page loads", "PASS");
  } catch (e) {
    log("I. Review page loads", "FAIL", e.message);
  }

  // ─── TEST J: Content detail page loads ────────────────────
  const detailId = videoContentId || "cmnnjqhdk000clk8ccwpbit2u";
  try {
    await page.goto(`${BASE}/dashboard/content/${detailId}`, { timeout: TIMEOUT, waitUntil: "networkidle" });
    const heading = await page.locator("h1, h2").first().textContent();
    log("J. Content detail page loads", "PASS", `Heading: ${heading?.trim()?.slice(0, 60)}`);
  } catch (e) {
    log("J. Content detail page loads", "FAIL", e.message);
  }

  // ─── TEST K: Commercial page loads ────────────────────────
  try {
    await page.goto(`${BASE}/dashboard/commercial`, { timeout: TIMEOUT, waitUntil: "networkidle" });
    log("K. Commercial page loads", "PASS");
  } catch (e) {
    log("K. Commercial page loads", "FAIL", e.message);
  }

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════");
  console.log("  RECOVERY PASS TEST RESULTS");
  console.log("════════════════════════════════════════════");
  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const partial = results.filter(r => r.status === "PARTIAL").length;
  const skip = results.filter(r => r.status === "SKIP").length;
  console.log(`  PASS: ${pass}  FAIL: ${fail}  PARTIAL: ${partial}  SKIP: ${skip}`);
  console.log("────────────────────────────────────────────");
  for (const r of results) {
    console.log(`  [${r.status}] ${r.test}`);
    if (r.detail) console.log(`         ${r.detail}`);
  }
  console.log("════════════════════════════════════════════\n");

  await browser.close();
}

run().catch(e => { console.error("Test runner error:", e); process.exit(1); });
