import { NextRequest, NextResponse } from "next/server";
import { appendLeadInteraction, logActivity } from "@/lib/activity-log";
import { serializeLead } from "@/lib/api-serializers";
import { canAccessLead, resolveScopedUserId } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { buildLeadInteraction, getLeadFollowUpState } from "@/lib/crm";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const due = searchParams.get("due");

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (due === "scheduled") {
      where.nextFollowUp = { not: null };
    }

    const leads = await db.lead.findMany({
      where,
      include: {
        emails: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: leads
        .filter((lead) => {
          if (due === "overdue") {
            return getLeadFollowUpState(lead.nextFollowUp) === "overdue";
          }
          if (due === "today") {
            return getLeadFollowUpState(lead.nextFollowUp) === "today";
          }
          if (due === "week") {
            const state = getLeadFollowUpState(lead.nextFollowUp);
            return state === "today" || state === "this-week";
          }
          return true;
        })
        .map((lead) => serializeLead(lead)),
    });
  } catch (error) {
    console.error("Get leads error:", error);
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
      name,
      email,
      phone,
      company,
      source,
      notes,
      nextFollowUp,
      expectedCloseDate,
      estimatedValue,
      priority,
      lastContactAt,
      interactions,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Lead name is required" },
        { status: 400 }
      );
    }

    const lead = await db.lead.create({
      data: {
        userId: auth.user.id,
        name,
        email,
        phone,
        company,
        source,
        notes,
        priority: priority || "medium",
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
        lastContactAt: lastContactAt ? new Date(lastContactAt) : undefined,
        interactions: stringifyJson(
          interactions || [
            buildLeadInteraction({
              type: "lead-created",
              title: "Lead created",
              description: `${name} was added to the CRM pipeline.`,
            }),
          ]
        ),
        status: "new",
      },
      include: {
        emails: true,
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "create",
      entity: "lead",
      entityId: lead.id,
      details: {
        status: lead.status,
        priority: lead.priority,
        estimatedValue: lead.estimatedValue,
      },
      tool: "lead-route",
    });

    return NextResponse.json({
      success: true,
      data: serializeLead(lead),
    });
  } catch (error) {
    console.error("Create lead error:", error);
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
    const { id, userId: _userId, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required" },
        { status: 400 }
      );
    }

    const leadAccess = await canAccessLead(auth.user, id);
    if (!leadAccess) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    const existingLead = await db.lead.findUnique({
      where: { id },
      include: { emails: true },
    });

    if (!existingLead) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    if (updates.nextFollowUp) {
      updates.nextFollowUp = new Date(updates.nextFollowUp);
    }
    if (updates.nextFollowUp === null) {
      updates.nextFollowUp = null;
    }
    if (updates.expectedCloseDate) {
      updates.expectedCloseDate = new Date(updates.expectedCloseDate);
    }
    if (updates.expectedCloseDate === null) {
      updates.expectedCloseDate = null;
    }
    if (updates.lastContactAt) {
      updates.lastContactAt = new Date(updates.lastContactAt);
    }
    if (updates.lastContactAt === null) {
      updates.lastContactAt = null;
    }
    if (updates.estimatedValue !== undefined && updates.estimatedValue !== null) {
      updates.estimatedValue = Number(updates.estimatedValue);
    }

    const lead = await db.lead.update({
      where: { id },
      data: {
        ...updates,
        interactions:
          updates.interactions === undefined ? undefined : stringifyJson(updates.interactions),
      },
      include: {
        emails: true,
      },
    });

    if (existingLead.status !== lead.status) {
      await appendLeadInteraction(
        lead.id,
        buildLeadInteraction({
          type: "status-change",
          title: `Status moved to ${lead.status}`,
          description: `Lead status changed from ${existingLead.status} to ${lead.status}.`,
        })
      );
    }

    if (
      String(existingLead.nextFollowUp || "") !== String(lead.nextFollowUp || "")
    ) {
      await appendLeadInteraction(
        lead.id,
        buildLeadInteraction({
          type: "follow-up",
          title: "Next follow-up updated",
          description: lead.nextFollowUp
            ? `Next follow-up scheduled for ${new Date(lead.nextFollowUp).toLocaleDateString("en-US")}.`
            : "Next follow-up was cleared.",
        })
      );
    }

    await logActivity({
      userId: auth.user.id,
      action: "update",
      entity: "lead",
      entityId: lead.id,
      details: {
        status: lead.status,
        priority: lead.priority,
        estimatedValue: lead.estimatedValue,
        nextFollowUp: lead.nextFollowUp,
      },
      tool: "lead-route",
    });

    return NextResponse.json({
      success: true,
      data: serializeLead(lead),
    });
  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required" },
        { status: 400 }
      );
    }

    const leadAccess = await canAccessLead(auth.user, id);
    if (!leadAccess) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    await db.lead.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
