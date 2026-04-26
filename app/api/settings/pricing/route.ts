// GET/POST /api/settings/pricing
// Read/write per-model pricing overrides from storage/config/pricing-overrides.json
// Phase 1 — visibility only, no credit deduction

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const CONFIG_PATH = path.join(process.cwd(), "storage", "config", "pricing-overrides.json");

interface PricingOverride {
  cost_to_henry?: number;
  price_to_user?: number;
  updatedAt: string;
}

type OverrideMap = Record<string, PricingOverride>;

function readOverrides(): OverrideMap {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeOverrides(data: OverrideMap) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json({ overrides: readOverrides() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { modelId, cost_to_henry, price_to_user } = body as {
    modelId: string;
    cost_to_henry?: number;
    price_to_user?: number;
  };

  if (!modelId) {
    return NextResponse.json({ error: "modelId required" }, { status: 400 });
  }

  const data = readOverrides();
  data[modelId] = {
    ...(data[modelId] ?? {}),
    ...(cost_to_henry !== undefined ? { cost_to_henry } : {}),
    ...(price_to_user !== undefined ? { price_to_user } : {}),
    updatedAt: new Date().toISOString(),
  };
  writeOverrides(data);

  return NextResponse.json({ ok: true, override: data[modelId] });
}
