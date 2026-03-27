import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { serializeCampaign } from "@/lib/api-serializers";
import { canAccessCampaign, resolveScopedUserId } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));

    const campaigns = await db.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: campaigns.map((campaign) => serializeCampaign(campaign)),
    });
  } catch (error) {
    console.error("Get campaigns error:", error);
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
      type,
      target,
      content,
      status,
      sent,
      opened,
      clicked,
      converted,
      budget,
      scheduledAt,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: "Campaign name and type are required" },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.create({
      data: {
        userId: auth.user.id,
        name,
        type,
        target,
        content: stringifyJson(content),
        status: status || "draft",
        budget: budget ? Number(budget) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        launchedAt: status === "active" ? new Date() : undefined,
        completedAt: status === "completed" ? new Date() : undefined,
        sent,
        opened,
        clicked,
        converted,
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "create",
      entity: "campaign",
      entityId: campaign.id,
      details: {
        status: campaign.status,
        type: campaign.type,
        target: campaign.target,
        budget: campaign.budget,
      },
      tool: "campaign-route",
    });

    return NextResponse.json({
      success: true,
      data: serializeCampaign(campaign),
    });
  } catch (error) {
    console.error("Create campaign error:", error);
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
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const campaignAccess = await canAccessCampaign(auth.user, id);
    if (!campaignAccess) {
      return NextResponse.json(
        { success: false, error: "Campaign not found or access denied" },
        { status: 404 }
      );
    }

    const existingCampaign = await db.campaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found or access denied" },
        { status: 404 }
      );
    }

    if (updates.budget !== undefined && updates.budget !== null) {
      updates.budget = Number(updates.budget);
    }
    if (updates.scheduledAt) {
      updates.scheduledAt = new Date(updates.scheduledAt);
    }
    if (updates.scheduledAt === null) {
      updates.scheduledAt = null;
    }

    const nextStatus = updates.status || existingCampaign.status;

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        ...updates,
        content: updates.content === undefined ? undefined : stringifyJson(updates.content),
        launchedAt:
          nextStatus === "active"
            ? existingCampaign.launchedAt || new Date()
            : updates.status === "paused"
              ? existingCampaign.launchedAt
              : updates.status === "draft"
                ? null
                : undefined,
        completedAt:
          nextStatus === "completed"
            ? existingCampaign.completedAt || new Date()
            : updates.status && updates.status !== "completed"
              ? null
              : undefined,
      },
    });

    await logActivity({
      userId: auth.user.id,
      action: "update",
      entity: "campaign",
      entityId: campaign.id,
      details: {
        status: campaign.status,
        type: campaign.type,
        target: campaign.target,
        budget: campaign.budget,
      },
      tool: "campaign-route",
    });

    return NextResponse.json({
      success: true,
      data: serializeCampaign(campaign),
    });
  } catch (error) {
    console.error("Update campaign error:", error);
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
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const campaignAccess = await canAccessCampaign(auth.user, id);
    if (!campaignAccess) {
      return NextResponse.json(
        { success: false, error: "Campaign not found or access denied" },
        { status: 404 }
      );
    }

    await db.campaign.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    console.error("Delete campaign error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
