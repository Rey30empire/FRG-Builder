import { NextRequest, NextResponse } from "next/server";
import { serializeUser } from "@/lib/api-serializers";
import { applySessionCookie, createSession, normalizeEmail, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSystemUsers } from "@/lib/default-user";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, "auth-login", {
      windowMs: 1000 * 60 * 15,
      max: 10,
    });
    if (limited) return limited;

    await ensureSystemUsers();

    const body = await request.json();
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { userMemory: true },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({
      success: true,
      data: {
        user: serializeUser(user),
      },
    });

    applySessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
