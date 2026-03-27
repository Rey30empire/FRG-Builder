import { NextRequest, NextResponse } from "next/server";
import { serializeEstimate } from "@/lib/api-serializers";
import { canAccessEstimate } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { buildProposalData, getProposalContext } from "@/lib/proposals";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const estimateId = searchParams.get("estimateId");

    if (!estimateId) {
      return NextResponse.json(
        { success: false, error: "Estimate ID is required" },
        { status: 400 }
      );
    }

    if (!(await canAccessEstimate(auth.user, estimateId))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
      );
    }

    const { estimate, project } = await getProposalContext(estimateId);
    const proposalData = buildProposalData(project, estimate);

    return NextResponse.json({
      success: true,
      data: {
        estimate: serializeEstimate({
          ...estimate,
          proposalData,
        }),
        proposalData,
      },
    });
  } catch (error) {
    console.error("Get proposal error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const { estimateId, proposalData, status } = body;

    if (!estimateId || !proposalData) {
      return NextResponse.json(
        { success: false, error: "Estimate ID and proposal data are required" },
        { status: 400 }
      );
    }

    if (!(await canAccessEstimate(auth.user, estimateId))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
      );
    }

    const estimate = await db.estimate.update({
      where: { id: estimateId },
      data: {
        proposalData: stringifyJson(proposalData),
        status: status || undefined,
      },
      include: {
        takeoffItems: true,
        emails: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeEstimate(estimate),
    });
  } catch (error) {
    console.error("Update proposal error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
