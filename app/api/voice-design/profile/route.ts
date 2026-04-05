// GioHomeStudio — GET/POST /api/voice-design/profile
// Reads and writes persistent narration settings to storage/config/voice_profiles.json

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DEFAULT_NARRATION_SETTINGS } from "@/modules/voice-provider/accent-profiles";

const PROFILE_PATH = path.resolve("storage/config/voice_profiles.json");

function readProfiles(): Record<string, unknown> {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      return JSON.parse(fs.readFileSync(PROFILE_PATH, "utf-8"));
    }
  } catch {
    // file corrupt or missing — start fresh
  }
  return { default: DEFAULT_NARRATION_SETTINGS };
}

function writeProfiles(data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const profiles = readProfiles();
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  let body: { profile?: string; settings?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileName = body.profile ?? "default";
  const settings = body.settings;
  if (!settings) {
    return NextResponse.json({ error: "Missing settings" }, { status: 400 });
  }

  const profiles = readProfiles();
  profiles[profileName] = settings;
  writeProfiles(profiles);

  return NextResponse.json({ saved: true, profile: profileName });
}
