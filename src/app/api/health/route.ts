import { NextRequest, NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/health";

export async function GET(_request: NextRequest) {
  try {
    const health = await getSystemHealth();

    return NextResponse.json(
      {
        success: true,
        data: health,
      },
      {
        status: health.ok ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Health check failed",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
