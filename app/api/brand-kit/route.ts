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
  headlineText: string;   // user's own headline / CTA copy (e.g. "Call Now 0902 000 0000")
  sublineText: string;    // user's own sub-text (e.g. locations served)
  accentText: string;     // user's own accent/price badge text
  bgColor: string;        // hex — background behind the text (preview + outro scrim)
  bgOpacity: number;      // 0 (transparent) .. 1 (fully solid)
  businessName: string;   // saved contact — business / brand name
  phone: string;          // saved contact — phone number
  whatsapp: string;       // saved contact — WhatsApp number
  email: string;          // saved contact — business email
  website: string;        // saved contact — website URL
  address: string;        // saved contact — physical address
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
  headlineText: "Call Now 0902 000 0000",
  sublineText: "Location . Location . Location",
  accentText: "₦0 / night",
  bgColor: "#000000",
  bgOpacity: 0.4,
  businessName: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  address: "",
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
  const text = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : fallback;
  const text200 = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : fallback;
  // 0..1 opacity clamp (clampNum floors at 8 — not usable for a 0..1 fraction).
  const clamp01 = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  };

  const next: BrandKit = {
    fontFamily: typeof body.fontFamily === "string" && body.fontFamily.trim() ? body.fontFamily.trim() : cur.fontFamily,
    headlineColor: hex(body.headlineColor, cur.headlineColor),
    bodyColor: hex(body.bodyColor, cur.bodyColor),
    accentColor: hex(body.accentColor, cur.accentColor),
    headlineSize: clampNum(body.headlineSize, cur.headlineSize),
    bodySize: clampNum(body.bodySize, cur.bodySize),
    bold: typeof body.bold === "boolean" ? body.bold : cur.bold,
    outline: typeof body.outline === "boolean" ? body.outline : cur.outline,
    headlineText: text(body.headlineText, cur.headlineText),
    sublineText: text(body.sublineText, cur.sublineText),
    accentText: text(body.accentText, cur.accentText),
    bgColor: hex(body.bgColor, cur.bgColor),
    bgOpacity: clamp01(body.bgOpacity, cur.bgOpacity),
    businessName: text(body.businessName, cur.businessName),
    phone: text(body.phone, cur.phone),
    whatsapp: text(body.whatsapp, cur.whatsapp),
    email: text(body.email, cur.email),
    website: text(body.website, cur.website),
    address: text200(body.address, cur.address),
  };

  try {
    fs.mkdirSync(path.dirname(kitPath()), { recursive: true });
    fs.writeFileSync(kitPath(), JSON.stringify(next, null, 2));
  } catch (e) {
    return NextResponse.json({ error: `Could not save brand kit: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, brandKit: next });
}
