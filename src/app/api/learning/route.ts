import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { serializeLearningItem } from "@/lib/api-serializers";
import { canAccessLearningItem, resolveScopedUserId } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

function serializeContent(content: unknown) {
  if (content == null) return undefined;
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));
    const category = searchParams.get("category");
    const level = searchParams.get("level");
    const type = searchParams.get("type");
    const completed = searchParams.get("completed");
    const bookmarked = searchParams.get("bookmarked");

    const where: Record<string, unknown> = { userId };
    if (category) where.category = category;
    if (level) where.level = level;
    if (type) where.type = type;
    if (completed === "true") where.completed = true;
    if (completed === "false") where.completed = false;
    if (bookmarked === "true") where.bookmarked = true;
    if (bookmarked === "false") where.bookmarked = false;

    const items = await db.learningItem.findMany({
      where,
      orderBy: [{ completed: "asc" }, { bookmarked: "desc" }, { updatedAt: "desc" }],
    });

    const serializedItems = items.map((item) => serializeLearningItem(item));

    const stats = items.reduce(
      (acc, item) => {
        acc.totalItems += 1;
        if (item.completed) acc.completedItems += 1;
        acc.totalTimeSpent += item.timeSpent || 0;
        acc.averageProgress += item.progress || 0;
        acc.categories[item.category] = acc.categories[item.category] || { total: 0, completed: 0 };
        acc.categories[item.category].total += 1;
        if (item.completed) acc.categories[item.category].completed += 1;
        return acc;
      },
      {
        totalItems: 0,
        completedItems: 0,
        totalTimeSpent: 0,
        averageProgress: 0,
        categories: {} as Record<string, { total: number; completed: number }>,
      }
    );

    const completionRate =
      stats.totalItems > 0 ? (stats.completedItems / stats.totalItems) * 100 : 0;
    const averageProgress = stats.totalItems > 0 ? stats.averageProgress / stats.totalItems : 0;

    return NextResponse.json({
      success: true,
      data: {
        items: serializedItems,
        stats: {
          totalItems: stats.totalItems,
          completedItems: stats.completedItems,
          completionRate,
          totalTimeSpent: stats.totalTimeSpent,
          averageProgress,
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
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const { title, category, level, type, completed, progress, bookmarked, score, timeSpent, content, lastStudiedAt } = body;

    if (!title || !category || !type) {
      return NextResponse.json(
        { success: false, error: "Title, category and type are required" },
        { status: 400 }
      );
    }

    const learningItem = await db.learningItem.create({
      data: {
        userId: auth.user.id,
        title,
        category,
        level: level || "beginner",
        type,
        completed: Boolean(completed),
        progress: typeof progress === "number" ? progress : completed ? 100 : 0,
        bookmarked: Boolean(bookmarked),
        score,
        timeSpent,
        lastStudiedAt: lastStudiedAt ? new Date(lastStudiedAt) : undefined,
        content: serializeContent(content),
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "create",
      entity: "learning-item",
      entityId: learningItem.id,
      details: {
        category: learningItem.category,
        type: learningItem.type,
      },
      tool: "learning-route",
    });

    return NextResponse.json({ success: true, data: serializeLearningItem(learningItem) });
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
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const { id, userId: _userId, content, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Learning item ID is required" },
        { status: 400 }
      );
    }

    const learningAccess = await canAccessLearningItem(auth.user, id);
    if (!learningAccess) {
      return NextResponse.json(
        { success: false, error: "Learning item not found or access denied" },
        { status: 404 }
      );
    }

    if (updates.lastStudiedAt) {
      updates.lastStudiedAt = new Date(updates.lastStudiedAt);
    }

    if (updates.completed === true && updates.progress === undefined) {
      updates.progress = 100;
    }

    const learningItem = await db.learningItem.update({
      where: { id },
      data: {
        ...updates,
        content: content === undefined ? undefined : serializeContent(content),
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "update",
      entity: "learning-item",
      entityId: learningItem.id,
      details: {
        completed: learningItem.completed,
        progress: learningItem.progress,
        bookmarked: learningItem.bookmarked,
      },
      tool: "learning-route",
    });

    return NextResponse.json({ success: true, data: serializeLearningItem(learningItem) });
  } catch (error) {
    console.error("Update learning item error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
