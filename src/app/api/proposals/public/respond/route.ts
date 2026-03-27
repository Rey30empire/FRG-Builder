import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { serializeEstimate } from "@/lib/api-serializers";
import { respondToProposal, sanitizeProposalDelivery } from "@/lib/proposals";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const action =
      body.action === "approved" || body.action === "rejected" ? body.action : null;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!token || !action) {
      return NextResponse.json(
        { success: false, error: "Proposal token and action are required" },
        { status: 400 }
      );
    }

    const context = await respondToProposal(token, action, message || undefined);
    if (!context) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    await logActivity({
      userId: context.project.userId || undefined,
      action,
      entity: "proposal-response",
      entityId: context.estimate.id,
      details: {
        recipientEmail: context.delivery.recipientEmail,
        responseMessage: message || undefined,
      },
      tool: "public-proposal-response",
    });

    return NextResponse.json({
      success: true,
      data: {
        estimate: serializeEstimate(context.estimate),
        delivery: sanitizeProposalDelivery(context.delivery),
      },
    });
  } catch (error) {
    console.error("Public proposal respond error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
