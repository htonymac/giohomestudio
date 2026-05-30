// GET /api/account/status — Live account status for all connected providers
// Returns: key configured, API reachable, live balance where available, local usage stats

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { env } from "@/config/env";

// ── Kling JWT (same logic as kling.ts gateway) ──────────────────────────────
function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeKlingJwt(): string | null {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;
  if (!accessKey || !secretKey) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64urlEncode(Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })));
  const sig = base64urlEncode(crypto.createHmac("sha256", secretKey).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

// ── Read local usage stats from asset library ────────────────────────────────
interface UsageStat {
  provider: string;
  count: number;
  estimatedCost: number;
}

function getLocalUsage(): UsageStat[] {
  const COST_MAP: Record<string, number> = {
    kling: 0.10,
    muapi: 0.05,
    fal: 0.04,
    segmind: 0.02,
    runway: 0.50,
  };

  try {
    const libPath = path.join(env.storagePath, "config", "asset-library.json");
    const assets: Array<{ provider?: string; type?: string }> = JSON.parse(fs.readFileSync(libPath, "utf-8"));
    const byProvider: Record<string, number> = {};
    for (const a of assets) {
      if (a.provider && (a.type === "video" || a.type === "image")) {
        byProvider[a.provider] = (byProvider[a.provider] || 0) + 1;
      }
    }
    return Object.entries(byProvider).map(([provider, count]) => ({
      provider,
      count,
      estimatedCost: parseFloat((count * (COST_MAP[provider] ?? 0.05)).toFixed(3)),
    }));
  } catch {
    return [];
  }
}

// ── Provider check functions ─────────────────────────────────────────────────
async function checkFal(): Promise<{ configured: boolean; reachable: boolean; balance: string | null; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { configured: false, reachable: false, balance: null };
  // Migrated to providers/fal adapter (Henry 2026-05-30 task #24).
  const { falAccountStatus } = await import("@/lib/providers/fal");
  const r = await falAccountStatus();
  if (r.ok) {
    const data = r.data as { credits?: number } | null;
    return { configured: true, reachable: true, balance: data?.credits ? `$${data.credits}` : "Connected" };
  }
  return {
    configured: true,
    reachable: r.status !== 401 && r.status !== 0,
    balance: null,
    error: r.status === 401 ? "Invalid key" : r.error.slice(0, 100),
  };
}

async function checkKling(): Promise<{ configured: boolean; reachable: boolean; balance: string | null; error?: string }> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  if (!accessKey) return { configured: false, reachable: false, balance: null };
  const jwt = makeKlingJwt();
  if (!jwt) return { configured: false, reachable: false, balance: null };
  try {
    // Try Kling account cost endpoint
    const res = await fetch("https://api.klingai.com/account/costs", {
      headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.data) {
      const d = data.data;
      const balance = d.resource_pack_subscribe_infos?.[0]?.left_quantity ?? d.total_remaining ?? null;
      return { configured: true, reachable: true, balance: balance !== null ? `${balance} credits` : "Connected" };
    }
    return { configured: true, reachable: res.status !== 401, balance: "Connected (balance hidden)", error: res.status === 401 ? "Invalid key" : undefined };
  } catch {
    return { configured: true, reachable: false, balance: null, error: "Unreachable" };
  }
}

async function checkMuApi(): Promise<{ configured: boolean; reachable: boolean; balance: string | null; error?: string }> {
  const key = process.env.MUAPI_API_KEY;
  if (!key) return { configured: false, reachable: false, balance: null };
  try {
    // MuAPI: test with a simple models list call
    const res = await fetch("https://api.muapi.ai/v1/models", {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok || res.status === 405) {
      return { configured: true, reachable: true, balance: "Connected (no balance API)" };
    }
    return { configured: true, reachable: false, balance: null, error: `HTTP ${res.status}` };
  } catch {
    return { configured: true, reachable: false, balance: null, error: "Unreachable" };
  }
}

async function checkSegmind(): Promise<{ configured: boolean; reachable: boolean; balance: string | null; error?: string }> {
  const key = process.env.SEGMIND_API_KEY;
  if (!key) return { configured: false, reachable: false, balance: null };
  try {
    const res = await fetch("https://api.segmind.com/v1/ping", {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    return { configured: true, reachable: res.status !== 401, balance: "Connected (see segmind.com)", error: res.status === 401 ? "Invalid key" : undefined };
  } catch {
    return { configured: true, reachable: false, balance: null, error: "Unreachable" };
  }
}

async function checkRunway(): Promise<{ configured: boolean; reachable: boolean; balance: string | null; error?: string }> {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) return { configured: false, reachable: false, balance: null };
  try {
    const res = await fetch("https://api.dev.runwayml.com/v1/tasks", {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}`, "X-Runway-Version": "2024-09-13" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok || res.status === 405 || res.status === 404) {
      return { configured: true, reachable: true, balance: "Connected (see runway.com)" };
    }
    return { configured: true, reachable: false, balance: null, error: `HTTP ${res.status}` };
  } catch {
    return { configured: true, reachable: false, balance: null, error: "Unreachable" };
  }
}

// ── Count local media files ──────────────────────────────────────────────────
function getMediaCounts() {
  const count = (dir: string, ext: string[]) => {
    try {
      return fs.readdirSync(path.join(env.storagePath, dir)).filter(f => ext.some(e => f.endsWith(e))).length;
    } catch { return 0; }
  };
  return {
    images: count("images", [".png", ".jpg", ".jpeg"]),
    videos: count("videos", [".mp4"]),
    merged: count("merged", [".mp4"]),
    music: count("music/stock", [".mp3"]) + count("music/generated", [".mp3", ".wav"]),
    thumbnails: count("thumbnails", [".jpg"]),
  };
}

// ── GET handler ──────────────────────────────────────────────────────────────
export async function GET() {
  const [falStatus, klingStatus, muapiStatus, segmindStatus, runwayStatus] = await Promise.all([
    checkFal(),
    checkKling(),
    checkMuApi(),
    checkSegmind(),
    checkRunway(),
  ]);

  const localUsage = getLocalUsage();
  const mediaCounts = getMediaCounts();
  const totalEstimatedSpend = localUsage.reduce((s, u) => s + u.estimatedCost, 0);

  return NextResponse.json({
    providers: [
      {
        id: "kling_direct",
        name: "Kling AI (Direct)",
        icon: "🎬",
        dashboardUrl: "https://klingai.com",
        ...klingStatus,
        models: ["Kling 2.5 Std", "Kling 2.5 Pro", "Kling 1.6 Std"],
        color: "#f59e0b",
      },
      {
        id: "fal",
        name: "FAL.ai",
        icon: "⚡",
        dashboardUrl: "https://fal.ai/dashboard",
        ...falStatus,
        models: ["Hailuo", "Wan", "LTX Video", "Flux", "Ideogram"],
        color: "#6366f1",
        note: "Kling on FAL requires separate Kuaishou subscription",
      },
      {
        id: "muapi",
        name: "MuAPI",
        icon: "🌀",
        dashboardUrl: "https://muapi.ai",
        ...muapiStatus,
        models: ["Seedance Lite", "Seedance 1.0 Pro", "Seedance 2.0", "Wan 2.1"],
        color: "#22c55e",
      },
      {
        id: "segmind",
        name: "Segmind",
        icon: "🖼",
        dashboardUrl: "https://segmind.com/dashboard",
        ...segmindStatus,
        models: ["Pruna P Image", "Pruna P Video"],
        color: "#ec4899",
      },
      {
        id: "runway",
        name: "Runway (Direct)",
        icon: "✈️",
        dashboardUrl: "https://runway.com",
        ...runwayStatus,
        models: ["Gen-4 Turbo"],
        color: "#a855f7",
      },
    ],
    localUsage,
    mediaCounts,
    totalEstimatedSpend: parseFloat(totalEstimatedSpend.toFixed(2)),
    checkedAt: new Date().toISOString(),
  });
}
