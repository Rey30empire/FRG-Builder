import { NextRequest, NextResponse } from "next/server";
import { serializeUser } from "@/lib/api-serializers";
import {
  applySessionCookie,
  createSession,
  hashPassword,
  normalizeEmail,
} from "@/lib/auth";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai-settings";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildWorkspaceMemoryDefaults } from "@/lib/user-workspace";

function normalizeName(name?: string) {
  return name?.trim() || null;
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, "auth-register", {
      windowMs: 1000 * 60 * 15,
      max: 8,
    });
    if (limited) return limited;

    const body = await request.json();
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? normalizeName(body.name) : null;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "That email is already registered." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        role: "user",
        level: 1,
        passwordHash: hashPassword(password),
        userMemory: {
          create: {
            ...buildWorkspaceMemoryDefaults({ email, name }),
            aiProviderConfig: stringifyJson(DEFAULT_AI_SETTINGS),
          },
        },
      },
      include: {
        userMemory: true,
      },
    });

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: serializeUser(user),
        },
      },
      { status: 201 }
    );

    applySessionCookie(response, token, expiresAt);

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
