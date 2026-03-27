import { NextRequest, NextResponse } from "next/server";
import { buildAdminOverview } from "@/lib/admin-dashboard";
import { requireAdminSessionUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const limited = enforceRateLimit(
      request,
      "admin-export",
      {
        windowMs: 1000 * 60 * 5,
        max: 12,
      },
      auth.user.id
    );
    if (limited) return limited;

    const snapshot = await buildAdminOverview();
    const fileName = `frg-admin-snapshot-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Export admin snapshot error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
