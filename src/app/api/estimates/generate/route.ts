import { NextRequest, NextResponse } from "next/server";
import { generateEstimateForProject } from "@/lib/estimate-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    const userId = typeof body.userId === "string" ? body.userId : undefined;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const estimate = await generateEstimateForProject(projectId, userId);

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
