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
  // The playwright package is in dependencies so this is always available.
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });

    for (const item of items) {
      // Ensure output directory exists
      fs.mkdirSync(path.dirname(item.outputPath), { recursive: true });

      await page.setContent(item.html, { waitUntil: "domcontentloaded" });

      await page.screenshot({
        path: item.outputPath,
        omitBackground: true,
        clip: { x: 0, y: 0, width, height },
      });
    }
  } finally {
    await browser.close();
  }
}
