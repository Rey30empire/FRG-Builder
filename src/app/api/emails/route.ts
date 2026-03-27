import { NextRequest, NextResponse } from "next/server";
import { serializeEmail } from "@/lib/api-serializers";
import {
  canAccessEmail,
  canAccessEstimate,
  canAccessLead,
  canAccessProject,
  resolveScopedUserId,
} from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { logActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));
    const leadId = searchParams.get("leadId");
    const projectId = searchParams.get("projectId");
    const estimateId = searchParams.get("estimateId");
    const status = searchParams.get("status");

    if (leadId && !(await canAccessLead(auth.user, leadId))) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (estimateId && !(await canAccessEstimate(auth.user, estimateId))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
      );
    }

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
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const {
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

    if (leadId && !(await canAccessLead(auth.user, leadId))) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (estimateId && !(await canAccessEstimate(auth.user, estimateId))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
      );
    }

    const email = await db.email.create({
      data: {
        userId: auth.user.id,
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
      userId: auth.user.id,
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
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const { id, userId: _userId, metadata, sentAt, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Email ID is required" },
        { status: 400 }
      );
    }

    const emailAccess = await canAccessEmail(auth.user, id);
    if (!emailAccess) {
      return NextResponse.json(
        { success: false, error: "Email not found or access denied" },
        { status: 404 }
      );
    }

    if (updates.leadId && !(await canAccessLead(auth.user, updates.leadId))) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    if (updates.projectId && !(await canAccessProject(auth.user, updates.projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (updates.estimateId && !(await canAccessEstimate(auth.user, updates.estimateId))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
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
