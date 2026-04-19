import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "storage", "series-projects");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function GET() {
  ensureDir();
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
    const projects = files.map(f => {
      const raw = fs.readFileSync(path.join(DATA_DIR, f), "utf8");
      const d = JSON.parse(raw);
      return { id: d.id, title: d.title, genre: d.genre, platform: d.platform, episodeCount: (d.episodes || []).length, updatedAt: d.updatedAt };
    });
    projects.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return NextResponse.json({ projects });
  } catch { return NextResponse.json({ projects: [] }); }
}

export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json();
  const id = body.id || `series_${Date.now()}`;
  const now = new Date().toISOString();
  const project = { ...body, id, updatedAt: now, createdAt: body.createdAt || now };
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(project, null, 2));
  return NextResponse.json({ ok: true, id });
}
