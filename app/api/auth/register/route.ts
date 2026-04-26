// POST /api/auth/register — create account with email + password
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const LEGAL_VERSION = "2026-04-26-v1";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const ua = req.headers.get("user-agent") ?? "unknown";
    const now = new Date();

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        passwordHash,
        termsAcceptedAt: now,
        termsVersion: LEGAL_VERSION,
        legalConsentVersion: LEGAL_VERSION,
        legalConsent: {
          acceptedAt: now.toISOString(),
          version: LEGAL_VERSION,
          ip,
          userAgent: ua,
        },
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
