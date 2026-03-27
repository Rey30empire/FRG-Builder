import { NextRequest, NextResponse } from "next/server";
import { serializeEmail } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/default-user";
import { stringifyJson } from "@/lib/json";
import { logActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER_ID;
    const leadId = searchParams.get("leadId");
    const projectId = searchParams.get("projectId");
    const estimateId = searchParams.get("estimateId");
    const status = searchParams.get("status");

    const emails = await db.email.findMany({
      where: {
        userId,
        ...(leadId ? { leadId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(estimateId ? { estimateId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: emails.map((email) => serializeEmail(email)),
    });
  } catch (error) {
    console.error("Get emails error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      leadId,
      projectId,
      estimateId,
      subject,
      body: messageBody,
      type,
      status,
      sentAt,
      metadata,
    } = body;

    if (!subject || !messageBody || !type) {
      return NextResponse.json(
        { success: false, error: "Subject, body and type are required" },
        { status: 400 }
      );
    }

    if (!userId) {
      await ensureDefaultUser();
    }

    const email = await db.email.create({
      data: {
        userId: userId || DEFAULT_USER_ID,
        leadId,
        projectId,
        estimateId,
        subject,
        body: messageBody,
        type,
        status: status || "draft",
        sentAt: sentAt ? new Date(sentAt) : status === "sent" ? new Date() : undefined,
        metadata: stringifyJson(metadata),
      },
    });

    await logActivity({
      userId: userId || DEFAULT_USER_ID,
      action: status === "sent" ? "send" : "create",
      entity: "email",
      entityId: email.id,
      details: {
        leadId,
        projectId,
        estimateId,
        type,
        status: email.status,
      },
      tool: "email-route",
    });

    return NextResponse.json({
      success: true,
      data: serializeEmail(email),
    });
  } catch (error) {
    console.error("Create email error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, metadata, sentAt, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Email ID is required" },
        { status: 400 }
      );
    }

    const email = await db.email.update({
      where: { id },
      data: {
        ...updates,
        sentAt: sentAt ? new Date(sentAt) : updates.status === "sent" ? new Date() : undefined,
        metadata: metadata === undefined ? undefined : stringifyJson(metadata),
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeEmail(email),
    });
  } catch (error) {
    console.error("Update email error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
