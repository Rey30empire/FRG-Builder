import { NextRequest, NextResponse } from "next/server";
import { serializeUser } from "@/lib/api-serializers";
import { hashPassword, isAdminUser, normalizeEmail, requireSessionUser } from "@/lib/auth";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai-settings";
import { db } from "@/lib/db";
import { ensureSystemUsers } from "@/lib/default-user";
import { stringifyJson } from "@/lib/json";
import { buildWorkspaceMemoryDefaults } from "@/lib/user-workspace";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    await ensureSystemUsers();

    const currentUser = auth.user;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      if (!isAdminUser(currentUser) && currentUser.id !== id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }

      const user = await db.user.findUnique({
        where: { id },
        include: {
          userMemory: true,
          _count: {
            select: {
              projects: true,
              learningItems: true,
              leads: true,
              campaigns: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, data: user ? serializeUser(user) : null });
    }

    if (!isAdminUser(currentUser)) {
      const user = await db.user.findUnique({
        where: { id: currentUser.id },
        include: {
          userMemory: true,
          _count: {
            select: {
              projects: true,
              learningItems: true,
              leads: true,
              campaigns: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: user ? [serializeUser(user)] : [],
      });
    }

    const users = await db.user.findMany({
      include: {
        userMemory: true,
        _count: {
          select: {
            projects: true,
            learningItems: true,
            leads: true,
            campaigns: true,
          },
        },
      },
      orderBy: [{ level: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, data: users.map((user) => serializeUser(user)) });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;
    if (!isAdminUser(auth.user)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const { name, role, level, avatar } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        role: role || "user",
        level: level ?? 1,
        avatar,
        passwordHash: hashPassword(password),
        userMemory: {
          create: {
            ...buildWorkspaceMemoryDefaults({ email, name }),
            aiProviderConfig: stringifyJson(DEFAULT_AI_SETTINGS),
          },
        },
      },
      include: { userMemory: true },
    });

    return NextResponse.json({ success: true, data: serializeUser(user) }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const targetUserId = typeof body.id === "string" ? body.id : auth.user.id;
    const userMemory = body.userMemory;
    const password = typeof body.password === "string" ? body.password : undefined;
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : undefined;
    const {
      id: _id,
      password: _password,
      userMemory: _userMemory,
      email: _email,
      role: _role,
      level: _level,
      ...updates
    } = body;

    if (!isAdminUser(auth.user) && targetUserId !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const baseUpdates = isAdminUser(auth.user)
      ? {
          ...updates,
          role: body.role,
          level: body.level,
        }
      : updates;

    const user = await db.user.update({
      where: { id: targetUserId },
      data: {
        ...baseUpdates,
        email,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        userMemory: userMemory
          ? {
              upsert: {
                update: userMemory,
                create: userMemory,
              },
            }
          : undefined,
      },
      include: { userMemory: true },
    });

    return NextResponse.json({ success: true, data: serializeUser(user) });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
