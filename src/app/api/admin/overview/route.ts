import { NextRequest, NextResponse } from "next/server";
import { buildAdminOverview } from "@/lib/admin-dashboard";
import { requireAdminSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const overview = await buildAdminOverview();

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error("Get admin overview error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
