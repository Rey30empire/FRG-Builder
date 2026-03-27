import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { serializeSupportTicket } from "@/lib/api-serializers";
import { isAdminUser, requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const tickets = await db.supportTicket.findMany({
      where: {
        ...(isAdminUser(auth.user) ? {} : { userId: auth.user.id }),
        ...(status ? { status } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: tickets.map((ticket) => serializeSupportTicket(ticket)),
    });
  } catch (error) {
    console.error("Get support tickets error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const limited = enforceRateLimit(
      request,
      "support-ticket",
      {
        windowMs: 1000 * 60 * 10,
        max: 8,
      },
      auth.user.id
    );
    if (limited) return limited;

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const priority = typeof body.priority === "string" ? body.priority : "medium";
    const channel = typeof body.channel === "string" ? body.channel : "internal";
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag)).filter(Boolean)
      : [];

    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: "Title and description are required" },
        { status: 400 }
      );
    }

    const ticket = await db.supportTicket.create({
      data: {
        userId: auth.user.id,
        title,
        description,
        priority,
        channel,
        tags: stringifyJson(tags),
        lastResponseAt: new Date(),
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "create",
      entity: "support-ticket",
      entityId: ticket.id,
      details: {
        priority,
        channel,
      },
      tool: "support-ticket",
    });

    return NextResponse.json(
      {
        success: true,
        data: serializeSupportTicket(ticket),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create support ticket error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    if (!isAdminUser(auth.user)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Support ticket ID is required" },
        { status: 400 }
      );
    }

    const nextStatus = typeof body.status === "string" ? body.status : undefined;
    const resolutionNotes =
      typeof body.resolutionNotes === "string" ? body.resolutionNotes : undefined;
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag)).filter(Boolean)
      : undefined;

    const ticket = await db.supportTicket.update({
      where: { id },
      data: {
        status: nextStatus,
        priority: typeof body.priority === "string" ? body.priority : undefined,
        resolutionNotes,
        tags: tags ? stringifyJson(tags) : undefined,
        resolvedAt: nextStatus === "resolved" ? new Date() : undefined,
        lastResponseAt: new Date(),
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "update",
      entity: "support-ticket",
      entityId: ticket.id,
      details: {
        status: ticket.status,
        priority: ticket.priority,
        tags: parseJsonField(ticket.tags, []),
      },
      tool: "support-ticket",
    });

    return NextResponse.json({
      success: true,
      data: serializeSupportTicket(ticket),
    });
  } catch (error) {
    console.error("Update support ticket error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
