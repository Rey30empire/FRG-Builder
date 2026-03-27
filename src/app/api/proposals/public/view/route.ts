import { NextRequest, NextResponse } from "next/server";
import { serializeEstimate } from "@/lib/api-serializers";
import { markProposalViewed, sanitizeProposalDelivery } from "@/lib/proposals";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Proposal token is required" },
        { status: 400 }
      );
    }

    const context = await markProposalViewed(token);
    if (!context) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        estimate: serializeEstimate(context.estimate),
        delivery: sanitizeProposalDelivery(context.delivery),
      },
    });
  } catch (error) {
    console.error("Mark public proposal viewed error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
