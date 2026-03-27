import { NextRequest, NextResponse } from "next/server";
import { resolveScopedUserId } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonField } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));
    const limit = Number(searchParams.get("limit") || 20);

    const activity = await db.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 50)),
    });

    return NextResponse.json({
      success: true,
      data: activity.map((item) => ({
        ...item,
        details: parseJsonField(item.details, null),
      })),
    });
  } catch (error) {
    console.error("Get activity error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
