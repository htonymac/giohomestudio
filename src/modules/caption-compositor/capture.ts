// Caption Compositor — Playwright HTML→PNG capture
// Launches one Chromium browser, renders each HTML string at the exact frame
// dimensions, and saves a transparent-background PNG.

import * as path from "path";
import * as fs from "fs";

export interface CaptureItem {
  html: string;
  outputPath: string;
}

/**
 * Renders a list of HTML strings to PNG files using a single Playwright browser.
 * Each PNG has a transparent background (omitBackground: true).
 * Resolves when all items are written; rejects on browser-level errors.
 */
export async function renderCaptionsToPng(
  items: CaptureItem[],
  width: number,
  height: number
): Promise<void> {
  if (items.length === 0) return;

  // Import at runtime — avoids loading Playwright on every module import.
  const { chromium } = await import("playwright");

  // 15-second timeout on browser launch — if Chromium can't start, fail fast
  // rather than hanging the entire render pipeline.
  const launchTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Playwright chromium.launch() timed out after 15s")), 15000)
  );

  const browser = await Promise.race([
    chromium.launch({ headless: true }),
    launchTimeout,
  ]);

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });

    for (const item of items) {
      fs.mkdirSync(path.dirname(item.outputPath), { recursive: true });
      await page.setContent(item.html, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.screenshot({
        path: item.outputPath,
        omitBackground: true,
        clip: { x: 0, y: 0, width, height },
      });
    }
  } finally {
    await browser.close().catch(() => {});
  }
}
