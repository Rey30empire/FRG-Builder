import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { buildBillingOverview } from "@/lib/billing";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const overview = await buildBillingOverview(auth.user.id);

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error("Get billing overview error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load billing overview",
      },
      { status: 500 }
    );
  }
}
