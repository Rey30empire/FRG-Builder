import { NextRequest, NextResponse } from "next/server";
import { serializeAgentRun } from "@/lib/api-serializers";
import { canAccessProject, resolveScopedUserId } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const limit = Number(searchParams.get("limit") || 12);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const runs = await db.agentRun.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        steps: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? limit : 12,
    });

    return NextResponse.json({
      success: true,
      data: runs.map((run) => serializeAgentRun(run)),
    });
  } catch (error) {
    console.error("Get agent runs error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
