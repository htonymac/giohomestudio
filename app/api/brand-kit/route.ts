// GET/PUT the Brand Kit — ONE saved text style (font + colours + sizes) callable
// from any editor so brand text is consistent everywhere (Henry 2026-07-17).
// Stored as a single JSON file at <storagePath>/config/brand-kit.json.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export interface BrandKit {
  fontFamily: string;     // "Poppins" | "Montserrat" | "Bebas Neue" | "Anton" | classic names
  headlineColor: string;  // hex
  bodyColor: string;      // hex
  accentColor: string;    // hex (boxes / highlights)
  headlineSize: number;   // px (at a 1080-wide baseline)
  bodySize: number;       // px
  bold: boolean;
  outline: boolean;
}

const DEFAULTS: BrandKit = {
  fontFamily: "Poppins",
  headlineColor: "#FFFFFF",
  bodyColor: "#F5D06B",
  accentColor: "#22c55e",
  headlineSize: 64,
  bodySize: 40,
  bold: true,
  outline: true,
};

function kitPath(): string {
  return path.join(env.storagePath, "config", "brand-kit.json");
}

function readKit(): BrandKit {
  try {
    const raw = fs.readFileSync(kitPath(), "utf8");
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<BrandKit>) };
  } catch {
    return DEFAULTS;
  }
}

export async function GET() {
  return NextResponse.json({ brandKit: readKit() });
}

export async function PUT(req: NextRequest) {
  let body: Partial<BrandKit>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cur = readKit();
  const clampNum = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(8, Math.min(300, n)) : fallback;
  };
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback;

  const next: BrandKit = {
    fontFamily: typeof body.fontFamily === "string" && body.fontFamily.trim() ? body.fontFamily.trim() : cur.fontFamily,
    headlineColor: hex(body.headlineColor, cur.headlineColor),
    bodyColor: hex(body.bodyColor, cur.bodyColor),
    accentColor: hex(body.accentColor, cur.accentColor),
    headlineSize: clampNum(body.headlineSize, cur.headlineSize),
    bodySize: clampNum(body.bodySize, cur.bodySize),
    bold: typeof body.bold === "boolean" ? body.bold : cur.bold,
    outline: typeof body.outline === "boolean" ? body.outline : cur.outline,
  };

  try {
    fs.mkdirSync(path.dirname(kitPath()), { recursive: true });
    fs.writeFileSync(kitPath(), JSON.stringify(next, null, 2));
  } catch (e) {
    return NextResponse.json({ error: `Could not save brand kit: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, brandKit: next });
}
