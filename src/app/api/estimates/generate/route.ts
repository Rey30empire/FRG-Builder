import { NextRequest, NextResponse } from "next/server";
import { canAccessProject } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { generateEstimateForProject } from "@/lib/estimate-engine";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : null;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const projectAccess = await canAccessProject(auth.user, projectId);
    if (!projectAccess) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const estimate = await generateEstimateForProject(projectId, projectAccess.userId);

    return NextResponse.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    console.error("Generate estimate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
