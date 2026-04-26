// GioHomeStudio — GET/PATCH /api/sfx/source-notes
// Reads and writes storage/sfx/sources.json — a lightweight sidecar for
// per-file metadata (source site, URL, attribution, auto-mode flag, quality).
// No DB migration needed — plain JSON file on local storage.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { z } from "zod";

const SIDECAR_PATH = path.join(env.storagePath, "sfx", "sources.json");

export interface SFXSourceNote {
  key: string;
  filename: string;
  sourceSite: string;
  sourceUrl: string;
  attributionNote: string;
  importNote: string;
  safeForAutoMode: boolean;
  qualityRating: "" | "low" | "good" | "excellent";
  updatedAt: string;
}

function readSidecar(): Record<string, SFXSourceNote> {
  if (!fs.existsSync(SIDECAR_PATH)) return {};
  try {
    const raw = fs.readFileSync(SIDECAR_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, SFXSourceNote>;
  } catch {
    // Malformed JSON — return empty, do not crash
    return {};
  }
}

function writeSidecar(data: Record<string, SFXSourceNote>): void {
  const dir = path.dirname(SIDECAR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SIDECAR_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// GET — returns full notes map
export async function GET() {
  const notes = readSidecar();
  return NextResponse.json({ notes });
}

// PATCH — upserts one entry by key
const patchSchema = z.object({
  key:              z.string().min(1),
  filename:         z.string().optional().default(""),
  sourceSite:       z.string().optional().default(""),
  sourceUrl:        z.string().optional().default(""),
  attributionNote:  z.string().optional().default(""),
  importNote:       z.string().optional().default(""),
  safeForAutoMode:  z.boolean().optional().default(false),
  qualityRating:    z.enum(["", "low", "good", "excellent"]).optional().default(""),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const notes = readSidecar();
    const existing = notes[parsed.data.key] ?? {};

    notes[parsed.data.key] = {
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    } as SFXSourceNote;

    writeSidecar(notes);

    return NextResponse.json({ ok: true, note: notes[parsed.data.key] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
