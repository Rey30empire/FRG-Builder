import { NextRequest, NextResponse } from "next/server";
import { serializeUser } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, ensureSystemUsers } from "@/lib/default-user";

export async function GET(request: NextRequest) {
  try {
    await ensureSystemUsers();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const user = await db.user.findUnique({
        where: { id },
        include: { userMemory: true },
      });

      return NextResponse.json({ success: true, data: user ? serializeUser(user) : null });
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
    const body = await request.json();
    const { email, name, role, level, avatar } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
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
        userMemory: {
          create: {
            language: "es",
            explanationStyle: "detailed",
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
    const body = await request.json();
    const { id = DEFAULT_USER_ID, userMemory, ...updates } = body;

    const user = await db.user.update({
      where: { id },
      data: {
        ...updates,
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
