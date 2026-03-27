import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Tool ID is required" },
        { status: 400 }
      );
    }

    const tool = await db.tool.update({
      where: { id },
      data: {
        enabled:
          typeof body.enabled === "boolean" ? body.enabled : undefined,
        requiredLevel:
          typeof body.requiredLevel === "number" ? body.requiredLevel : undefined,
        config: body.config === undefined ? undefined : stringifyJson(body.config),
      },
    });

    return NextResponse.json({
      success: true,
      data: tool,
    });
  } catch (error) {
    console.error("Update admin tool error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
