import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Skill ID is required" },
        { status: 400 }
      );
    }

    const skill = await db.skill.update({
      where: { id },
      data: {
        enabled:
          typeof body.enabled === "boolean" ? body.enabled : undefined,
        config: body.config === undefined ? undefined : stringifyJson(body.config),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...skill,
        config: parseJsonField(skill.config, null),
      },
    });
  } catch (error) {
    console.error("Update admin skill error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
