import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    await deleteSession(token);

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    clearSessionCookie(response);

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
