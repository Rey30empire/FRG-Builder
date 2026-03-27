import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonField } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = Number(searchParams.get("limit") || 20);

    const activity = await db.activityLog.findMany({
      where: userId ? { userId } : undefined,
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
