// POST /api/hybrid/generate-card
// Generates intro or outro card as a PNG image using SVG + Sharp.
// The image is then used by the assembly as an img: scene (gets motion + fade treatment).
//
// Card types:
//   intro — "Studio Reveal": dark cinematic gradient, studio name → presents → title
//   outro — "Rolling Credits": black bg, full cast + credits block

import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";

export const maxDuration = 30;

interface CardRequest {
  type: "intro" | "outro";
  title: string;
  author?: string;
  genre?: string;
  tone?: string;
  cast?: Array<{ name: string; species?: string; roleType: string }>;
  style?: "cinematic" | "minimal" | "bold" | "nollywood";
}

// ── Escape XML special chars for SVG text ──
function x(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildIntroSVG(req: CardRequest): string {
  const title = x((req.title || "UNTITLED").toUpperCase());
  const genre = x([req.genre, req.tone].filter(Boolean).join(" · "));
  const style = req.style || "cinematic";

  const configs = {
    cinematic: {
      bg1: "#050510", bg2: "#0e0e2e", bg3: "#07071a",
      studioColor: "rgba(255,255,255,0.92)",
      presentsColor: "rgba(255,255,255,0.75)",
      titleColor: "#ffffff",
      genreColor: "rgba(255,255,255,0.80)",
      lineColor: "rgba(255,255,255,0.35)",
      titleSize: 84,
    },
    minimal: {
      bg1: "#111111", bg2: "#1a1a1a", bg3: "#111111",
      studioColor: "rgba(255,255,255,0.90)",
      presentsColor: "rgba(255,255,255,0.70)",
      titleColor: "#ffffff",
      genreColor: "rgba(255,255,255,0.75)",
      lineColor: "rgba(255,255,255,0.30)",
      titleSize: 76,
    },
    bold: {
      bg1: "#1a0033", bg2: "#2d006e", bg3: "#0d001a",
      studioColor: "#c084fc",
      presentsColor: "rgba(192,132,252,0.6)",
      titleColor: "#ffffff",
      genreColor: "#a855f7",
      lineColor: "rgba(168,85,247,0.3)",
      titleSize: 92,
    },
    nollywood: {
      bg1: "#1a0a00", bg2: "#2d1500", bg3: "#0d0800",
      studioColor: "#fbbf24",
      presentsColor: "rgba(251,191,36,0.6)",
      titleColor: "#fef08a",
      genreColor: "#f59e0b",
      lineColor: "rgba(251,191,36,0.3)",
      titleSize: 86,
    },
  };

  const c = configs[style] || configs.cinematic;
  // Shrink title font if very long
  const titleSize = title.length > 20 ? Math.max(52, c.titleSize - (title.length - 20) * 2) : c.titleSize;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c.bg1}"/>
      <stop offset="50%" stop-color="${c.bg2}"/>
      <stop offset="100%" stop-color="${c.bg3}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1920" height="1080" fill="url(#bg)"/>

  <!-- Decorative thin lines -->
  <line x1="580" y1="460" x2="1340" y2="460" stroke="${c.lineColor}" stroke-width="1"/>
  <line x1="580" y1="650" x2="1340" y2="650" stroke="${c.lineColor}" stroke-width="1"/>

  <!-- GIO HOME AI STUDIO -->
  <text x="960" y="430"
    text-anchor="middle"
    font-family="'Arial','Helvetica',sans-serif"
    font-size="26"
    fill="${c.studioColor}"
    letter-spacing="10">GIO HOME AI STUDIO</text>

  <!-- presents -->
  <text x="960" y="505"
    text-anchor="middle"
    font-family="'Arial','Helvetica',sans-serif"
    font-size="22"
    font-style="italic"
    fill="${c.presentsColor}"
    letter-spacing="4">presents</text>

  <!-- Movie title -->
  <text x="960" y="590"
    text-anchor="middle"
    font-family="'Arial Black','Arial','Helvetica',sans-serif"
    font-size="${titleSize}"
    font-weight="900"
    fill="${c.titleColor}"
    letter-spacing="6">${title}</text>

  ${genre ? `<!-- Genre / tone -->
  <text x="960" y="670"
    text-anchor="middle"
    font-family="'Arial','Helvetica',sans-serif"
    font-size="24"
    fill="${c.genreColor}"
    letter-spacing="3">${genre}</text>` : ""}
</svg>`;
}

function buildOutroSVG(req: CardRequest): string {
  const title = x((req.title || "UNTITLED").toUpperCase());
  const author = x(req.author || "");
  const cast = (req.cast || []).slice(0, 12);
  const style = req.style || "cinematic";
  const year = new Date().getFullYear();

  const colors = {
    cinematic: { bg: "#000000", studio: "rgba(255,255,255,0.5)", title: "#ffffff", label: "rgba(255,255,255,0.45)", value: "#ffffff", castLine: "rgba(255,255,255,0.7)", dots: "rgba(255,255,255,0.25)", footer: "rgba(255,255,255,0.3)" },
    minimal:   { bg: "#0a0a0a", studio: "rgba(255,255,255,0.45)", title: "#ffffff", label: "rgba(255,255,255,0.4)", value: "#ffffff", castLine: "rgba(255,255,255,0.65)", dots: "rgba(255,255,255,0.2)", footer: "rgba(255,255,255,0.25)" },
    bold:      { bg: "#0d0020", studio: "#c084fc", title: "#ffffff", label: "#a855f7", value: "#e9d5ff", castLine: "#d8b4fe", dots: "rgba(168,85,247,0.4)", footer: "#9333ea" },
    nollywood: { bg: "#0a0500", studio: "#fbbf24", title: "#fef08a", label: "#f59e0b", value: "#fef3c7", castLine: "#fde68a", dots: "rgba(251,191,36,0.3)", footer: "#d97706" },
  };

  const col = colors[style] || colors.cinematic;

  // Layout: stack credits vertically from y=160
  let y = 160;
  const lineH = 54;
  const smallH = 40;
  const rows: string[] = [];

  const addText = (text: string, size: number, color: string, weight = "normal", spacing = 2, dy = lineH) => {
    rows.push(`<text x="960" y="${y}" text-anchor="middle" font-family="'Arial','Helvetica',sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="${spacing}">${text}</text>`);
    y += dy;
  };
  const addSpacer = (h = 20) => { y += h; };
  const addLine = (color: string) => {
    rows.push(`<line x1="700" y1="${y}" x2="1220" y2="${y}" stroke="${color}" stroke-width="1"/>`);
    y += 20;
  };

  addText("GIO HOME AI STUDIO", 22, col.studio, "normal", 8, 36);
  addText("presents", 18, col.studio, "normal", 3, smallH);
  addSpacer(16);
  addLine(col.dots);
  addSpacer(16);
  addText(title, 56, col.title, "900", 4, 70);
  addSpacer(10);
  addText("Written by", 18, col.label, "normal", 2, 30);
  addText(author || "—", 28, col.value, "700", 2, lineH);
  addSpacer(16);
  addLine(col.dots);
  addSpacer(16);

  if (cast.length > 0) {
    addText("CAST", 18, col.label, "normal", 6, smallH);
    addSpacer(10);
    for (const c of cast) {
      const nameText = x(c.name.toUpperCase());
      const roleText = x([c.species, c.roleType].filter(Boolean).join(" · "));
      // Name left, dots, role right — simulated with spaces
      rows.push(
        `<text x="680" y="${y}" font-family="'Arial','Helvetica',sans-serif" font-size="20" font-weight="700" fill="${col.castLine}" letter-spacing="1">${nameText}</text>` +
        `<text x="1240" y="${y}" text-anchor="end" font-family="'Arial','Helvetica',sans-serif" font-size="18" fill="${col.castLine}" letter-spacing="1">${roleText}</text>` +
        `<line x1="${700 + nameText.length * 11}" y1="${y - 4}" x2="${1220 - roleText.length * 10}" y2="${y - 4}" stroke="${col.dots}" stroke-width="1" stroke-dasharray="4,6"/>`
      );
      y += 36;
    }
    addSpacer(16);
    addLine(col.dots);
    addSpacer(16);
  }

  addText("AI Characters &amp; Assets created by", 16, col.label, "normal", 2, 28);
  addText("GIO HOME AI STUDIO", 20, col.studio, "normal", 6, 36);
  addSpacer(12);
  addText(`© ${year} ${author ? x(author) + " / " : ""}GIO HOME AI STUDIO`, 14, col.footer, "normal", 1, 28);
  addText("All rights reserved.", 13, col.footer, "normal", 1, 30);

  // If credits overflow, scale viewBox so they all fit
  const totalH = Math.max(1080, y + 60);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="${totalH}" viewBox="0 0 1920 ${totalH}">
  <rect width="1920" height="${totalH}" fill="${col.bg}"/>
  ${rows.join("\n  ")}
</svg>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CardRequest;
    if (!body.type) return NextResponse.json({ error: "type required (intro|outro)" }, { status: 400 });

    const sharp = (await import("sharp")).default;
    const outDir = path.join(env.storagePath, "images", "cards");
    fs.mkdirSync(outDir, { recursive: true });

    const svg = body.type === "intro" ? buildIntroSVG(body) : buildOutroSVG(body);
    const fileName = `${body.type}_${Date.now()}.png`;
    const outPath = path.join(outDir, fileName);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outPath);

    const relativePath = path.relative(env.storagePath, outPath).replace(/\\/g, "/");

    return NextResponse.json({
      ok: true,
      imagePath: outPath,
      imageUrl: `/api/media/${relativePath}`,
    });

  } catch (err) {
    console.error("[generate-card]", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
