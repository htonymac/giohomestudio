// GioHomeStudio — Pixabay Stock Music Downloader
// Uses play-button click + network interception to capture real MP3 CDN URLs
// Saves to storage/music/stock/ with correct naming convention
//
// Run: node scripts/download-stock-music.js

const { chromium } = require("playwright");
const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const STOCK_DIR = path.join(__dirname, "../storage/music/stock");

// [filename, search query]
const TARGETS = [
  // ── Core moods ───────────────────────────────────────────
  ["epic.mp3",               "epic cinematic music"],
  ["calm.mp3",               "calm relaxing background"],
  ["emotional.mp3",          "emotional sad music"],
  ["upbeat.mp3",             "upbeat happy background music"],
  ["dramatic.mp3",           "dramatic tense music"],

  // ── Extended categories ───────────────────────────────────
  ["war.mp3",                "war battle epic music"],
  ["action.mp3",             "action fast intense music"],
  ["suspense.mp3",           "suspense thriller music"],
  ["dance.mp3",              "dance energetic beat"],
  ["rain.mp3",               "rain ambient nature sounds"],
  ["heavy_rain.mp3",         "heavy rain thunder storm"],
  ["nature.mp3",             "nature birds wind ambient"],

  // ── Genre variants (mood_genre Priority 2) ────────────────
  ["epic_orchestral.mp3",    "epic orchestral cinematic"],
  ["calm_ambient.mp3",       "calm ambient relaxing"],
  ["emotional_piano.mp3",    "emotional piano sad"],
  ["upbeat_pop.mp3",         "upbeat pop cheerful"],
  ["dramatic_orchestral.mp3","dramatic orchestral intense"],

  // ── Default fallback ──────────────────────────────────────
  ["default_background.mp3", "background neutral music"],
];

// ── Helpers ──────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file  = fs.createWriteStream(destPath);
    proto.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(fs.statSync(destPath).size);
      });
    }).on("error", (err) => {
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}

// Wait for a network MP3 URL by clicking the first play button
async function captureAudioViaClick(page) {
  return new Promise(async (resolve) => {
    let captured = null;

    // Intercept outgoing requests for audio
    const handler = (request) => {
      const url = request.url();
      if (url.includes("cdn.pixabay.com/audio") && url.endsWith(".mp3")) {
        if (!captured) {
          captured = url;
          resolve(url);
        }
      }
    };
    page.on("request", handler);

    // Also watch responses in case request fires before listener
    const resHandler = (response) => {
      const url = response.url();
      if (url.includes("cdn.pixabay.com/audio") && url.endsWith(".mp3")) {
        if (!captured) {
          captured = url;
          resolve(url);
        }
      }
    };
    page.on("response", resHandler);

    // Try clicking first play/audio button on the page
    try {
      // Pixabay play buttons — try multiple selectors
      const selectors = [
        "button[title='Play']",
        "button[aria-label='Play']",
        "[class*='play'][role='button']",
        "[class*='PlayButton']",
        "[class*='play-button']",
        "button[class*='play']",
        // Generic audio controls
        "audio",
      ];

      let clicked = false;
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await el.click({ timeout: 3000 });
            clicked = true;
            break;
          }
        } catch {}
      }

      if (!clicked) {
        // Try JS click on first element matching play-related classes
        await page.evaluate(() => {
          const candidates = document.querySelectorAll("button, [role='button']");
          for (const el of candidates) {
            const text = (el.textContent || "").toLowerCase();
            const cls  = (el.className || "").toLowerCase();
            const aria = (el.getAttribute("aria-label") || "").toLowerCase();
            if (cls.includes("play") || aria.includes("play") || text === "▶") {
              el.click();
              return;
            }
          }
        });
      }
    } catch {}

    // Timeout after 8s — resolve with null
    setTimeout(() => {
      if (!captured) resolve(null);
    }, 8000);
  });
}

// ── Main ─────────────────────────────────────────────────────

async function run() {
  if (!fs.existsSync(STOCK_DIR)) fs.mkdirSync(STOCK_DIR, { recursive: true });

  console.log("Launching browser...\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });

  // ── Login once ───────────────────────────────────────────
  console.log("Logging in to Pixabay...");
  try {
    const loginPage = await context.newPage();
    await loginPage.goto("https://pixabay.com/accounts/login/", {
      waitUntil: "domcontentloaded", timeout: 20000,
    });
    await loginPage.waitForTimeout(1500);

    // Fill login form
    const usernameSelectors = ["input[name='username']", "input[type='text']", "#id_username", "input[autocomplete='username']"];
    const passwordSelectors = ["input[name='password']", "input[type='password']", "#id_password", "input[autocomplete='current-password']"];

    let filledUser = false;
    for (const sel of usernameSelectors) {
      try {
        await loginPage.fill(sel, "htonymac@gmail.com", { timeout: 3000 });
        filledUser = true;
        break;
      } catch {}
    }

    let filledPass = false;
    for (const sel of passwordSelectors) {
      try {
        await loginPage.fill(sel, "Buyer123@", { timeout: 3000 });
        filledPass = true;
        break;
      } catch {}
    }

    if (filledUser && filledPass) {
      await loginPage.keyboard.press("Enter");
      await loginPage.waitForTimeout(3000);
      console.log("Login submitted.\n");
    } else {
      console.log("Could not find login fields — proceeding without login.\n");
    }
    await loginPage.close();
  } catch (err) {
    console.log(`Login skipped: ${err.message}\n`);
  }

  let success = 0;
  let failed  = 0;
  const results = [];

  for (const [filename, query] of TARGETS) {
    const destPath = path.join(STOCK_DIR, filename);
    process.stdout.write(`[${filename}] "${query}" ... `);

    let audioUrl = null;

    try {
      const page = await context.newPage();

      // Only block images/fonts — allow JS and audio requests
      await page.route("**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,css}", r => r.abort());

      const searchUrl = `https://pixabay.com/sound-effects/search/${encodeURIComponent(query)}/`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

      // Wait for JS to render
      await page.waitForTimeout(3000);

      // Try to capture audio URL via play-button click
      audioUrl = await captureAudioViaClick(page);

      await page.close();

      // Fallback: try shorter query
      if (!audioUrl) {
        const page2 = await context.newPage();
        await page2.route("**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,css}", r => r.abort());
        const shortQuery = query.split(" ").slice(0, 2).join(" ");
        await page2.goto(`https://pixabay.com/sound-effects/search/${encodeURIComponent(shortQuery)}/`, {
          waitUntil: "domcontentloaded", timeout: 25000,
        });
        await page2.waitForTimeout(3000);
        audioUrl = await captureAudioViaClick(page2);
        await page2.close();
      }

      if (!audioUrl) {
        console.log("✗ no audio URL captured");
        failed++;
        results.push({ filename, query, status: "no_url" });
        continue;
      }

      const bytes = await downloadFile(audioUrl, destPath);
      const kb = (bytes / 1024).toFixed(0);
      console.log(`✓ ${kb} KB`);
      success++;
      results.push({ filename, query, status: "ok", kb, url: audioUrl });

    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
      results.push({ filename, query, status: "error", error: err.message });
    }
  }

  await browser.close();

  // ── Summary ──────────────────────────────────────────────
  console.log("\n── Results ──────────────────────────────────────────");
  console.log(`Downloaded: ${success} / ${TARGETS.length}`);
  console.log(`Failed:     ${failed} / ${TARGETS.length}`);

  console.log("\n── Files in stock dir ───────────────────────────────");
  const files = fs.readdirSync(STOCK_DIR).filter(f => f.endsWith(".mp3")).sort();
  for (const f of files) {
    const size = fs.statSync(path.join(STOCK_DIR, f)).size;
    const tag  = size > 20000 ? "✓ real " : "✗ mock ";
    console.log(`  ${tag} ${f.padEnd(35)} ${(size / 1024).toFixed(0)} KB`);
  }

  const failedItems = results.filter(r => r.status !== "ok");
  if (failedItems.length > 0) {
    console.log("\n── Failed items ─────────────────────────────────────");
    for (const r of failedItems) {
      console.log(`  ${r.filename} — ${r.error ?? r.status}`);
    }
  }
}

run().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
