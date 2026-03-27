import { NextRequest, NextResponse } from "next/server";
import { serializeLead } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/default-user";
import { stringifyJson } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || DEFAULT_USER_ID;
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
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
      data: leads.map((lead) => serializeLead(lead)),
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
    const body = await request.json();
    const { name, email, phone, company, source, notes, nextFollowUp, interactions, userId } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Lead name is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      await ensureDefaultUser();
    }

    const lead = await db.lead.create({
      data: {
        userId: userId || DEFAULT_USER_ID,
        name,
        email,
        phone,
        company,
        source,
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        interactions: stringifyJson(interactions),
        status: "new",
      },
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
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required" },
        { status: 400 }
      );
    }

    if (updates.nextFollowUp) {
      updates.nextFollowUp = new Date(updates.nextFollowUp);
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required" },
        { status: 400 }
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
