// GET  /api/auth/legal-consent — check if current user needs to accept current legal version
// POST /api/auth/legal-consent — save acceptance for grandfather flow
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LEGAL_VERSION = "2026-04-26-v1";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ needsConsent: false });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { legalConsentVersion: true },
    });
    const needsConsent = !user?.legalConsentVersion || user.legalConsentVersion !== LEGAL_VERSION;
    return NextResponse.json({ needsConsent });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { version } = await req.json();
    if (!version || typeof version !== "string") {
      return NextResponse.json({ error: "version required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";
    const now = new Date();

    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        legalConsentVersion: version,
        legalConsent: {
          acceptedAt: now.toISOString(),
          version,
          ip,
          userAgent: ua,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
