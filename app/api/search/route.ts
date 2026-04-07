// GET /api/search?q=keyword — search across all content, assets, characters, projects
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: Array<{
    type: "content" | "commercial" | "character" | "asset" | "story";
    id: string;
    title: string;
    subtitle: string;
    href: string;
    status?: string;
  }> = [];

  // Search content items
  const items = await prisma.contentItem.findMany({
    where: { originalInput: { contains: q, mode: "insensitive" } },
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, originalInput: true, status: true, mode: true, createdAt: true },
  });
  for (const item of items) {
    results.push({
      type: "content",
      id: item.id,
      title: item.originalInput?.slice(0, 60) ?? "Untitled",
      subtitle: `${item.mode} · ${item.status} · ${new Date(item.createdAt).toLocaleDateString()}`,
      href: `/dashboard/content/${item.id}`,
      status: item.status,
    });
  }

  // Search commercial projects
  const projects = await prisma.commercialProject.findMany({
    where: { projectName: { contains: q, mode: "insensitive" } },
    take: 3,
    orderBy: { updatedAt: "desc" },
    select: { id: true, projectName: true, renderStatus: true },
  });
  for (const p of projects) {
    results.push({
      type: "commercial",
      id: p.id,
      title: p.projectName,
      subtitle: `Commercial · ${p.renderStatus}`,
      href: "/dashboard/commercial",
      status: p.renderStatus,
    });
  }

  // Search characters
  const chars = await prisma.characterVoice.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 3,
    select: { id: true, name: true, role: true },
  });
  for (const c of chars) {
    results.push({
      type: "character",
      id: c.id,
      title: c.name,
      subtitle: `Character${c.role ? ` · ${c.role}` : ""}`,
      href: `/dashboard/character-voices/${c.id}`,
    });
  }

  // Search assets
  try {
    const assetFile = path.resolve(env.storagePath, "config", "asset-library.json");
    if (fs.existsSync(assetFile)) {
      const assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")) as Array<{ id: string; name: string; type: string; description: string }>;
      const matched = assets
        .filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || a.description?.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 3);
      for (const a of matched) {
        results.push({
          type: "asset",
          id: a.id,
          title: a.name,
          subtitle: `Asset · ${a.type}`,
          href: "/dashboard/assets",
        });
      }
    }
  } catch { /* ignore */ }

  // Search story bank
  try {
    const db = prisma as any; // eslint-disable-line
    const stories = await db.storyIdea.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      take: 3,
      select: { id: true, title: true, status: true },
    });
    for (const s of stories) {
      results.push({
        type: "story",
        id: s.id,
        title: s.title,
        subtitle: `Story · ${s.status}`,
        href: "/dashboard/story-bank",
      });
    }
  } catch { /* table may not exist */ }

  return NextResponse.json({ results, total: results.length });
}
