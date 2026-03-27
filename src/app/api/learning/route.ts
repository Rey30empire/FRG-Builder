import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/default-user";

function serializeContent(content: unknown) {
  if (content == null) return undefined;
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER_ID;
    const category = searchParams.get("category");
    const level = searchParams.get("level");
    const type = searchParams.get("type");
    const completed = searchParams.get("completed");

    const where: Record<string, unknown> = { userId };
    if (category) where.category = category;
    if (level) where.level = level;
    if (type) where.type = type;
    if (completed === "true") where.completed = true;
    if (completed === "false") where.completed = false;

    const items = await db.learningItem.findMany({
      where,
      orderBy: [{ completed: "asc" }, { updatedAt: "desc" }],
    });

    const stats = items.reduce(
      (acc, item) => {
        acc.totalItems += 1;
        if (item.completed) acc.completedItems += 1;
        acc.totalTimeSpent += item.timeSpent || 0;
        acc.categories[item.category] = acc.categories[item.category] || { total: 0, completed: 0 };
        acc.categories[item.category].total += 1;
        if (item.completed) acc.categories[item.category].completed += 1;
        return acc;
      },
      {
        totalItems: 0,
        completedItems: 0,
        totalTimeSpent: 0,
        categories: {} as Record<string, { total: number; completed: number }>,
      }
    );

    const completionRate =
      stats.totalItems > 0 ? (stats.completedItems / stats.totalItems) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        items,
        stats: {
          totalItems: stats.totalItems,
          completedItems: stats.completedItems,
          completionRate,
          totalTimeSpent: stats.totalTimeSpent,
        },
        categories: stats.categories,
      },
    });
  } catch (error) {
    console.error("Get learning error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, category, level, type, completed, score, timeSpent, content } = body;

    if (!title || !category || !type) {
      return NextResponse.json(
        { success: false, error: "Title, category and type are required" },
        { status: 400 }
      );
    }

    if (!userId) {
      await ensureDefaultUser();
    }

    const learningItem = await db.learningItem.create({
      data: {
        userId: userId || DEFAULT_USER_ID,
        title,
        category,
        level: level || "beginner",
        type,
        completed: Boolean(completed),
        score,
        timeSpent,
        content: serializeContent(content),
      },
    });

    return NextResponse.json({ success: true, data: learningItem });
  } catch (error) {
    console.error("Create learning item error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Learning item ID is required" },
        { status: 400 }
      );
    }

    const learningItem = await db.learningItem.update({
      where: { id },
      data: {
        ...updates,
        content: content === undefined ? undefined : serializeContent(content),
      },
    });

    return NextResponse.json({ success: true, data: learningItem });
  } catch (error) {
    console.error("Update learning item error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
