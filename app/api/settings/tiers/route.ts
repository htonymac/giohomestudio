// GET/POST /api/settings/tiers
// Read/write pricing tier configuration from storage/config/tiers.json

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const CONFIG_PATH = path.join(process.cwd(), "storage", "config", "tiers.json");

export interface TierConfig {
  id: "free" | "starter" | "pro" | "premium";
  name: string;
  monthlyPrice: number;
  monthlyCredits: number;
  enabledModels: string[];
  color: string;
}

const DEFAULT_TIERS: TierConfig[] = [
  { id: "free",    name: "Free",    monthlyPrice: 0,   monthlyCredits: 100,  enabledModels: [], color: "#8888aa" },
  { id: "starter", name: "Starter", monthlyPrice: 19,  monthlyCredits: 500,  enabledModels: [], color: "#3b82f6" },
  { id: "pro",     name: "Pro",     monthlyPrice: 49,  monthlyCredits: 2000, enabledModels: [], color: "#d4a843" },
  { id: "premium", name: "Premium", monthlyPrice: 149, monthlyCredits: 8000, enabledModels: [], color: "#8b5cf6" },
];

function readTiers(): TierConfig[] {
  if (!fs.existsSync(CONFIG_PATH)) return DEFAULT_TIERS;
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (Array.isArray(data) && data.length === 4) return data as TierConfig[];
    return DEFAULT_TIERS;
  } catch {
    return DEFAULT_TIERS;
  }
}

function writeTiers(data: TierConfig[]) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json({ tiers: readTiers() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tier } = body as { tier: TierConfig };

  if (!tier?.id) {
    return NextResponse.json({ error: "tier.id required" }, { status: 400 });
  }

  const all = readTiers();
  const idx = all.findIndex(t => t.id === tier.id);
  if (idx === -1) {
    return NextResponse.json({ error: "unknown tier id" }, { status: 400 });
  }
  all[idx] = { ...all[idx], ...tier };
  writeTiers(all);

  return NextResponse.json({ ok: true, tier: all[idx] });
}
