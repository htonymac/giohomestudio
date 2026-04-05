// GET /api/sfx/play?event=<event_name>
// Streams a local SFX file for in-browser preview.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import { getSFXPath } from "@/modules/sfx";

export async function GET(req: NextRequest) {
  const event = req.nextUrl.searchParams.get("event");
  if (!event) {
    return NextResponse.json({ error: "event param required" }, { status: 400 });
  }

  const filePath = getSFXPath(event);
  if (!filePath) {
    return NextResponse.json({ error: "File not available for this event" }, { status: 404 });
  }

  try {
    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": stat.size.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
