import { NextRequest, NextResponse } from "next/server";
import { serializeCampaign } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/default-user";
import { stringifyJson } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER_ID;

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
    const body = await request.json();
    const { name, type, target, content, status, sent, opened, clicked, converted, userId } = body;

    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: "Campaign name and type are required" },
        { status: 400 }
      );
    }

    if (!userId) {
      await ensureDefaultUser();
    }

    const campaign = await db.campaign.create({
      data: {
        userId: userId || DEFAULT_USER_ID,
        name,
        type,
        target,
        content: stringifyJson(content),
        status: status || "draft",
        sent,
        opened,
        clicked,
        converted,
      },
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
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: {
        ...updates,
        content: updates.content === undefined ? undefined : stringifyJson(updates.content),
      },
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
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
