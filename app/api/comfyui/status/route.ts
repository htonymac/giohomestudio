// GET /api/comfyui/status — quick health check for the local ComfyUI instance.

import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { isComfyUIOnline } from "@/modules/comfyui";

export async function GET() {
  const online = await isComfyUIOnline();
  if (!online) return NextResponse.json({ online: false });

  try {
    const res  = await fetch(`${env.comfyui.url}/system_stats`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json() as { system?: unknown };
    return NextResponse.json({ online: true, system: data.system ?? null });
  } catch {
    return NextResponse.json({ online: true });
  }
}
