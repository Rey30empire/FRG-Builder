import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { serializeOpsIncident } from "@/lib/api-serializers";
import { requireAdminSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const incidents = await db.opsIncident.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: incidents.map((incident) => serializeOpsIncident(incident)),
    });
  } catch (error) {
    console.error("Get incidents error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";

    if (!title || !summary) {
      return NextResponse.json(
        { success: false, error: "Title and summary are required" },
        { status: 400 }
      );
    }

    const incident = await db.opsIncident.create({
      data: {
        title,
        summary,
        affectedService:
          typeof body.affectedService === "string" ? body.affectedService : undefined,
        severity: typeof body.severity === "string" ? body.severity : "warning",
        status: typeof body.status === "string" ? body.status : "open",
        source: typeof body.source === "string" ? body.source : "manual",
        details: body.details === undefined ? undefined : stringifyJson(body.details),
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "create",
      entity: "ops-incident",
      entityId: incident.id,
      details: {
        severity: incident.severity,
        status: incident.status,
      },
      tool: "ops-incident",
    });

    return NextResponse.json(
      {
        success: true,
        data: serializeOpsIncident(incident),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create incident error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Incident ID is required" },
        { status: 400 }
      );
    }

    const incident = await db.opsIncident.update({
      where: { id },
      data: {
        title: typeof body.title === "string" ? body.title : undefined,
        summary: typeof body.summary === "string" ? body.summary : undefined,
        affectedService:
          typeof body.affectedService === "string" ? body.affectedService : undefined,
        severity: typeof body.severity === "string" ? body.severity : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        source: typeof body.source === "string" ? body.source : undefined,
        details: body.details === undefined ? undefined : stringifyJson(body.details),
        resolvedAt: body.status === "resolved" ? new Date() : undefined,
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "update",
      entity: "ops-incident",
      entityId: incident.id,
      details: {
        severity: incident.severity,
        status: incident.status,
      },
      tool: "ops-incident",
    });

    return NextResponse.json({
      success: true,
      data: serializeOpsIncident(incident),
    });
  } catch (error) {
    console.error("Update incident error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
