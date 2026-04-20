// GET /api/settings/models
// Returns all models from the registry with per-model overrides applied

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getAllModels, type ModelEntry } from "@/lib/generation/model-registry";

const OVERRIDES_PATH = path.join(process.cwd(), "storage", "config", "pricing-overrides.json");

function readOverrides(): Record<string, { cost_to_henry?: number; price_to_user?: number }> {
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
  } catch {
    return {};
  }
}

export async function GET() {
  const overrides = readOverrides();
  const models = getAllModels(false).map((m: ModelEntry) => {
    const o = overrides[m.id];
    return {
      ...m,
      cost_to_henry: o?.cost_to_henry ?? m.cost_to_henry,
      price_to_user: o?.price_to_user ?? m.price_to_user,
      has_override: !!o,
    };
  });
  return NextResponse.json({ models });
}
