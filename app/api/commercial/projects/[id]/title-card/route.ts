// POST /api/commercial/projects/[id]/title-card
// Henry 2026-06-20: business intro/outro cards. User types title (+ subtitle); a cheap/local LLM
// picks a clean colour scheme; we render a FULL-FRAME card PNG (Playwright HTML→PNG, the same engine
// the captions use) and add it as a normal SLIDE at the front (intro) or back (outro) — so the
// existing render needs ZERO changes. Returns the created slide.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { callLLM } from "@/lib/llm";
import { extractJSONFromLLM } from "@/lib/media-utils";
import { renderCaptionsToPng } from "@/modules/caption-compositor/capture";
import { RENDER_DIMS, type AspectRatio } from "@/modules/caption-compositor/types";

const schema = z.object({
  text:     z.string().min(1).max(120),         // headline
  subtitle: z.string().max(160).optional(),
  kind:     z.enum(["intro", "outro"]).default("intro"),
  font:     z.string().max(40).optional(),       // card text font (system-safe)
  // Optional USER-chosen colours — if any provided, we use them and skip the AI colour pick.
  colors:   z.object({
    bg1:    z.string().optional(),
    bg2:    z.string().optional(),
    text:   z.string().optional(),
    accent: z.string().optional(),
  }).optional(),
});

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface CardColors { bg1: string; bg2: string; text: string; accent: string }
const FALLBACK: CardColors = { bg1: "#0a0f1e", bg2: "#1a1030", text: "#ffffff", accent: "#ff6b35" };
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v);

function titleCardHtml(o: { title: string; subtitle?: string; brand?: string; colors: CardColors; w: number; h: number; font?: string }): string {
  const { w, h, colors } = o;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${w}px;height:${h}px;overflow:hidden}
    .card{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:linear-gradient(135deg, ${colors.bg1} 0%, ${colors.bg2} 100%);
      font-family:${o.font ? `'${o.font.replace(/[^a-zA-Z0-9 ]/g, "")}',` : ""}'Arial Black','Arial',sans-serif;text-align:center;padding:8% 9%}
    .brand{font-size:${Math.round(h * 0.028)}px;letter-spacing:.16em;text-transform:uppercase;color:${colors.accent};font-weight:700;margin-bottom:${Math.round(h * 0.03)}px}
    .title{font-size:${Math.round(h * 0.072)}px;font-weight:900;color:${colors.text};line-height:1.06;text-shadow:0 4px 24px rgba(0,0,0,.45)}
    .sub{font-size:${Math.round(h * 0.036)}px;font-weight:500;color:${colors.text};opacity:.9;margin-top:${Math.round(h * 0.035)}px}
    .bar{width:${Math.round(w * 0.18)}px;height:6px;border-radius:3px;background:${colors.accent};margin-top:${Math.round(h * 0.04)}px}
  </style></head><body><div class="card">
    ${o.brand ? `<div class="brand">${esc(o.brand)}</div>` : ""}
    <div class="title">${esc(o.title)}</div>
    ${o.subtitle ? `<div class="sub">${esc(o.subtitle)}</div>` : ""}
    <div class="bar"></div>
  </div></body></html>`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.commercialProject.findUnique({
    where: { id },
    select: { id: true, aspectRatio: true, brandName: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // WAY 2 — IMPORT IMAGE (multipart): user uploads their own intro/outro card image (Henry 2026-06-20).
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const ikind = String(form.get("kind") || "intro") === "outro" ? "outro" : "intro";
    if (!file) return NextResponse.json({ error: "No image file" }, { status: 400 });
    const dir = path.join(env.storagePath, "commercial", id);
    fs.mkdirSync(dir, { recursive: true });
    const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    const dest = path.join(dir, `titlecard_${ikind}_${Date.now()}${ext}`);
    fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));  // LOCAL: render reads slide images from disk
    const aggM = await prisma.commercialSlide.aggregate({ where: { projectId: id }, _max: { slideOrder: true } });
    const maxM = aggM._max.slideOrder ?? 0;
    if (ikind === "intro") await prisma.commercialSlide.updateMany({ where: { projectId: id }, data: { slideOrder: { increment: 1 } } });
    const slideM = await prisma.commercialSlide.create({
      data: { projectId: id, slideOrder: ikind === "intro" ? 0 : maxM + 1, status: "ready", imagePath: dest, imageFileName: path.basename(dest), captionOriginal: null },
    });
    return NextResponse.json({ slide: slideM, kind: ikind }, { status: 201 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { text, subtitle, kind } = parsed.data;

  // 1) Colours — USER's choice wins; else a cheap/local LLM picks; else defaults.
  let colors: CardColors = FALLBACK;
  const uc = parsed.data.colors;
  const userPicked = uc && (isHex(uc.bg1) || isHex(uc.bg2) || isHex(uc.text) || isHex(uc.accent));
  if (userPicked) {
    colors = {
      bg1: isHex(uc!.bg1) ? uc!.bg1! : FALLBACK.bg1,
      bg2: isHex(uc!.bg2) ? uc!.bg2! : FALLBACK.bg2,
      text: isHex(uc!.text) ? uc!.text! : FALLBACK.text,
      accent: isHex(uc!.accent) ? uc!.accent! : FALLBACK.accent,
    };
  } else try {
    const r = await callLLM(
      `Pick a clean, professional, high-contrast colour scheme for a business video ${kind} title card.\nBrand: ${project.brandName ?? "(none)"}\nHeadline: "${text}"${subtitle ? `\nSubtitle: "${subtitle}"` : ""}\nReturn ONLY JSON: {"bg1":"#hex","bg2":"#hex","text":"#hex","accent":"#hex"}. bg1/bg2 = a tasteful gradient, text = readable on it, accent = a tasteful highlight.`,
      "You are a brand designer. Output only valid JSON hex colours.",
      { role: "fast", temperature: 0.5, maxTokens: 120, timeoutMs: 20000 }
    );
    if (r.ok) {
      const j = JSON.parse(extractJSONFromLLM(r.text)) as Partial<CardColors>;
      colors = {
        bg1: isHex(j.bg1) ? j.bg1 : FALLBACK.bg1,
        bg2: isHex(j.bg2) ? j.bg2 : FALLBACK.bg2,
        text: isHex(j.text) ? j.text : FALLBACK.text,
        accent: isHex(j.accent) ? j.accent : FALLBACK.accent,
      };
    }
  } catch { /* keep fallback colours */ }

  // 2) Render the full-frame card PNG (Playwright HTML→PNG).
  const aspectRatio = (project.aspectRatio as AspectRatio) ?? "9:16";
  const { w, h } = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];
  const dir = path.join(env.storagePath, "commercial", id);
  fs.mkdirSync(dir, { recursive: true });
  const pngPath = path.join(dir, `titlecard_${kind}_${Date.now()}.png`);
  try {
    await renderCaptionsToPng([{ html: titleCardHtml({ title: text, subtitle, brand: project.brandName ?? undefined, colors, w, h, font: parsed.data.font }), outputPath: pngPath }], w, h);
  } catch (err) {
    return NextResponse.json({ error: `Card render failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
  if (!fs.existsSync(pngPath)) return NextResponse.json({ error: "Card image was not produced" }, { status: 500 });

  // 3) Add as a slide — intro = first (order 0), outro = last (max+1). Render sorts by slideOrder.
  const agg = await prisma.commercialSlide.aggregate({ where: { projectId: id }, _max: { slideOrder: true } });
  const maxOrder = agg._max.slideOrder ?? 0;
  const slideOrder = kind === "intro" ? 0 : maxOrder + 1;
  if (kind === "intro") {
    // push existing slides down so the intro truly leads
    await prisma.commercialSlide.updateMany({ where: { projectId: id }, data: { slideOrder: { increment: 1 } } });
  }

  const slide = await prisma.commercialSlide.create({
    data: {
      projectId: id,
      slideOrder: kind === "intro" ? 0 : slideOrder,
      status: "ready",
      imagePath: pngPath,
      imageFileName: path.basename(pngPath),
      captionOriginal: null,
    },
  });

  return NextResponse.json({ slide, colors, kind }, { status: 201 });
}
