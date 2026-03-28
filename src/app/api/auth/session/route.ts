import { NextRequest, NextResponse } from "next/server";
import { serializeUser } from "@/lib/api-serializers";
import {
  createDatabaseUnavailableResponse,
  DatabaseConfigurationError,
  getSessionUser,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);

    return NextResponse.json({
      success: true,
      data: {
        user: user ? serializeUser(user) : null,
      },
    });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return createDatabaseUnavailableResponse();
    }

    console.error("Session error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
