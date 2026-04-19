import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "storage", "series-projects");

function filePath(id: string) { return path.join(DATA_DIR, `${id}.json`); }

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fs.existsSync(fp)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(JSON.parse(fs.readFileSync(fp, "utf8")));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fp = filePath(id);
  const existing = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : {};
  const updates = await req.json();
  const merged = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
  fs.writeFileSync(fp, JSON.stringify(merged, null, 2));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fp = filePath(id);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  return NextResponse.json({ ok: true });
}
