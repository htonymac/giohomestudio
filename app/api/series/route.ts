// GET  /api/series — list all series
// POST /api/series — create or update a series

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

const SERIES_DIR = () => path.resolve(env.storagePath, "series");

interface Series {
  id: string;
  title: string;
  genre: string;
  tone: string;
  targetAudience: string;
  platform: string;
  aspectRatio: string;
  episodeDurationSec: number;
  visualStyle: string;
  characters: Array<{
    name: string;
    role: string;
    description: string;
    voiceId: string;
    traits: string;
  }>;
  episodes: Array<{
    number: number;
    title: string;
    synopsis: string;
    status: string;
    contentItemId?: string;
  }>;
  storyBible: string;
  createdAt: string;
  updatedAt: string;
}

function loadAll(): Series[] {
  const dir = SERIES_DIR();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Series; }
      catch { return null; }
    })
    .filter(Boolean) as Series[];
}

function saveSeries(s: Series) {
  const dir = SERIES_DIR();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${s.id}.json`), JSON.stringify(s, null, 2));
}

export async function GET() {
  const series = loadAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return NextResponse.json({ series });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const id = body.id ?? `series_${Date.now()}`;
  const now = new Date().toISOString();

  const series: Series = {
    id,
    title: body.title ?? "Untitled Series",
    genre: body.genre ?? "Drama",
    tone: body.tone ?? "Serious",
    targetAudience: body.targetAudience ?? "",
    platform: body.platform ?? "YouTube",
    aspectRatio: body.aspectRatio ?? "9:16",
    episodeDurationSec: body.episodeDurationSec ?? 60,
    visualStyle: body.visualStyle ?? "Cinematic",
    characters: body.characters ?? [],
    episodes: body.episodes ?? [],
    storyBible: body.storyBible ?? "",
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };

  saveSeries(series);

  return NextResponse.json({ id: series.id, saved: true });
}
