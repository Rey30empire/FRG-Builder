import { NextRequest, NextResponse } from "next/server";
import { serializeEstimate } from "@/lib/api-serializers";
import { getPublicProposalContext, sanitizeProposalDelivery } from "@/lib/proposals";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Proposal token is required" },
        { status: 400 }
      );
    }

    const context = await getPublicProposalContext(token);
    if (!context) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        project: context.project,
        estimate: serializeEstimate(context.estimate),
        proposalData: context.proposalData,
        delivery: sanitizeProposalDelivery(context.delivery),
        company: context.company,
      },
    });
  } catch (error) {
    console.error("Get public proposal error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
