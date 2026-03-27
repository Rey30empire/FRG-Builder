import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionUser } from "@/lib/auth";
import { buildOperationsOverview } from "@/lib/operations";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const overview = await buildOperationsOverview();

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error("Get ops overview error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
