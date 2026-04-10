// POST /api/auth/register — create account with email + password
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        passwordHash,
        termsAcceptedAt: new Date(),
        termsVersion: "1.0",
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
