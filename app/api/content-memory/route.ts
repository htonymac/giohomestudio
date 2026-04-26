// GET  /api/content-memory — get user's content preferences
// POST /api/content-memory — update preferences from usage patterns
//
// Learns: preferred platform, tone, style, music, format, voice over time.
// Powers: smarter AI suggestions, auto-fill defaults, event awareness.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Nigerian/African holidays + global events ──
const EVENTS_CALENDAR = [
  // Nigerian
  { name: "New Year", date: "01-01", recurring: true, region: "global" },
  { name: "Eid el-Fitr", date: "variable", recurring: true, region: "nigeria" },
  { name: "Eid el-Kabir", date: "variable", recurring: true, region: "nigeria" },
  { name: "Easter", date: "variable", recurring: true, region: "global" },
  { name: "Workers Day", date: "05-01", recurring: true, region: "nigeria" },
  { name: "Children's Day", date: "05-27", recurring: true, region: "nigeria" },
  { name: "Democracy Day", date: "06-12", recurring: true, region: "nigeria" },
  { name: "Independence Day (Nigeria)", date: "10-01", recurring: true, region: "nigeria" },
  { name: "Christmas", date: "12-25", recurring: true, region: "global" },
  { name: "Boxing Day", date: "12-26", recurring: true, region: "nigeria" },
  // African
  { name: "Africa Day", date: "05-25", recurring: true, region: "africa" },
  { name: "Ghana Independence Day", date: "03-06", recurring: true, region: "ghana" },
  { name: "South Africa Freedom Day", date: "04-27", recurring: true, region: "south_africa" },
  { name: "Kenya Mashujaa Day", date: "10-20", recurring: true, region: "kenya" },
  // Global trending days
  { name: "Valentine's Day", date: "02-14", recurring: true, region: "global" },
  { name: "International Women's Day", date: "03-08", recurring: true, region: "global" },
  { name: "Mother's Day", date: "03-second_sunday", recurring: true, region: "global" },
  { name: "Father's Day", date: "06-third_sunday", recurring: true, region: "global" },
  { name: "Black Friday", date: "11-last_friday", recurring: true, region: "global" },
  { name: "World Teachers Day", date: "10-05", recurring: true, region: "global" },
  { name: "International Youth Day", date: "08-12", recurring: true, region: "global" },
];

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  // Get or create memory
  let memory = await prisma.contentMemory.findFirst({
    where: userId ? { userId } : {},
    orderBy: { updatedAt: "desc" },
  });

  if (!memory) {
    memory = await prisma.contentMemory.create({
      data: { userId: userId || undefined },
    });
  }

  // Check upcoming events
  const today = new Date();
  const todayStr = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const userCountry = memory.country || "nigeria";

  const upcomingEvents = EVENTS_CALENDAR.filter(e => {
    if (e.date === "variable") return false;
    if (e.date.includes("_")) return false; // complex date rules
    if (e.region !== "global" && e.region !== userCountry) return false;
    // Check if event is within next 7 days
    const [eMonth, eDay] = e.date.split("-").map(Number);
    const eventDate = new Date(today.getFullYear(), eMonth - 1, eDay);
    const diff = (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const customEvents = (memory.customEvents as Array<{ name: string; date: string }>) || [];
  const upcomingCustom = customEvents.filter(e => {
    const eventDate = new Date(e.date);
    const diff = (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  return NextResponse.json({
    memory,
    upcomingEvents: [...upcomingEvents, ...upcomingCustom.map(e => ({ ...e, recurring: false, region: "custom" }))],
    suggestions: generateSuggestions(memory, upcomingEvents),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, action, data } = body;

    if (action === "record_usage") {
      // Track a content creation event to learn preferences
      const existing = await prisma.contentMemory.findFirst({
        where: userId ? { userId } : {},
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        const topPlatforms = updateFrequency(existing.topPlatforms as unknown[] | null, data.platform);
        const topContentTypes = updateFrequency(existing.topContentTypes as unknown[] | null, data.contentType);
        const topMoods = updateFrequency(existing.topMoods as unknown[] | null, data.mood);

        const updated = await prisma.contentMemory.update({
          where: { id: existing.id },
          data: {
            topPlatforms: JSON.parse(JSON.stringify(topPlatforms)),
            topContentTypes: JSON.parse(JSON.stringify(topContentTypes)),
            topMoods: JSON.parse(JSON.stringify(topMoods)),
            totalCreated: existing.totalCreated + 1,
            preferredPlatform: topPlatforms[0]?.item || existing.preferredPlatform,
            preferredTone: data.tone || existing.preferredTone,
            preferredStyle: data.style || existing.preferredStyle,
            preferredMusic: data.music || existing.preferredMusic,
            avgDuration: data.duration ? Math.round(((existing.avgDuration || 0) + data.duration) / 2) : existing.avgDuration,
          },
        });
        return NextResponse.json({ memory: updated });
      }
    }

    if (action === "add_event") {
      // Add custom event (birthday, launch date, etc.)
      const existing = await prisma.contentMemory.findFirst({
        where: userId ? { userId } : {},
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        const events = [...((existing.customEvents as Array<{ name: string; date: string; recurring: boolean }>) || []), { name: data.name, date: data.date, recurring: data.recurring || false }];
        const updated = await prisma.contentMemory.update({
          where: { id: existing.id },
          data: { customEvents: JSON.parse(JSON.stringify(events)) },
        });
        return NextResponse.json({ memory: updated });
      }
    }

    if (action === "set_preferences") {
      const existing = await prisma.contentMemory.findFirst({
        where: userId ? { userId } : {},
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        const updated = await prisma.contentMemory.update({
          where: { id: existing.id },
          data: {
            preferredTone: data.tone ?? existing.preferredTone,
            preferredStyle: data.style ?? existing.preferredStyle,
            preferredPlatform: data.platform ?? existing.preferredPlatform,
            preferredFormat: data.format ?? existing.preferredFormat,
            preferredMusic: data.music ?? existing.preferredMusic,
            preferredVoice: data.voice ?? existing.preferredVoice,
            country: data.country ?? existing.country,
            timezone: data.timezone ?? existing.timezone,
          },
        });
        return NextResponse.json({ memory: updated });
      }
    }

    // Create new
    const memory = await prisma.contentMemory.create({
      data: { userId: userId || undefined, country: data?.country, timezone: data?.timezone },
    });
    return NextResponse.json({ memory }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

function updateFrequency(existing: unknown[] | null, value: string | undefined): Array<{ item: string; count: number }> {
  if (!value) return (existing as Array<{ item: string; count: number }>) || [];
  const arr = [...((existing as Array<{ item: string; count: number }>) || [])];
  const found = arr.find(i => i.item === value);
  if (found) { found.count = (found.count || 0) + 1; }
  else { arr.push({ item: value, count: 1 }); }
  return arr.sort((a, b) => b.count - a.count).slice(0, 10);
}

function generateSuggestions(memory: { preferredPlatform?: string | null; preferredTone?: string | null; totalCreated: number }, events: Array<{ name: string }>): string[] {
  const suggestions: string[] = [];

  if (events.length > 0) {
    suggestions.push(`${events[0].name} is coming up! Create themed content for it.`);
  }
  if (memory.preferredPlatform) {
    suggestions.push(`You usually post on ${memory.preferredPlatform}. Create content optimized for it?`);
  }
  if (memory.totalCreated > 5) {
    suggestions.push("You've created " + memory.totalCreated + " pieces. Try a series for consistency!");
  }
  if (memory.totalCreated === 0) {
    suggestions.push("Start with a short reel — quick to make, high engagement.");
  }

  return suggestions;
}
