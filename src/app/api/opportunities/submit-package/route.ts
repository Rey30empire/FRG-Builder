import { NextRequest, NextResponse } from "next/server";
import { serializeBidOpportunity } from "@/lib/api-serializers";
import { canAccessBidOpportunity } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import {
  buildBidSubmitPackage,
  getBidPackageContext,
  normalizeBidFormDataInput,
  persistBidPackageState,
} from "@/lib/bid-package";
import { logActivity } from "@/lib/activity-log";
import type { BidFormData, BidSubmitPackage } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json()) as {
      opportunityId?: string;
      estimateId?: string;
      action?: "prepare" | "markSubmitted" | "markWon";
      bidFormData?: Partial<BidFormData>;
      submitMethod?: BidSubmitPackage["submitMethod"];
      submitTo?: string;
      notes?: string;
    };

    if (!body.opportunityId) {
      return NextResponse.json(
        { success: false, error: "Opportunity ID is required." },
        { status: 400 }
      );
    }

    if (!(await canAccessBidOpportunity(auth.user, body.opportunityId))) {
      return NextResponse.json(
        { success: false, error: "Opportunity not found or access denied" },
        { status: 404 }
      );
    }

    const context = await getBidPackageContext(body.opportunityId, body.estimateId);
    if (!context) {
      return NextResponse.json(
        { success: false, error: "Opportunity context not found" },
        { status: 404 }
      );
    }

    const nextBidFormData = body.bidFormData
      ? normalizeBidFormDataInput(body.bidFormData, context.bidFormData)
      : context.bidFormData;
    const baseUrl = new URL(request.url).origin;
    const submitPackage = buildBidSubmitPackage({
      opportunity: context.opportunity,
      project: context.project,
      estimate: context.estimate,
      bidFormData: nextBidFormData,
      proposalData: context.proposalData,
      baseUrl,
      notes: body.notes,
      submitMethod: body.submitMethod,
      submitTo: body.submitTo,
    });
    const action = body.action || "prepare";
    const updatedOpportunity = await persistBidPackageState({
      opportunityId: body.opportunityId,
      bidFormData: nextBidFormData,
      submitPackage: {
        ...submitPackage,
        status:
          action === "markWon"
            ? "won"
            : action === "markSubmitted"
              ? "submitted"
              : submitPackage.status,
        submittedAt:
          action === "markSubmitted" || action === "markWon"
            ? new Date().toISOString()
            : submitPackage.submittedAt,
      },
      status:
        action === "markWon"
          ? "won"
          : action === "markSubmitted"
            ? "submitted"
            : undefined,
    });

    await logActivity({
      userId: auth.user.id,
      action: action === "prepare" ? "prepare" : "update",
      entity: "bid-package",
      entityId: body.opportunityId,
      details: {
        estimateId: context.estimate?.id,
        submitMethod: body.submitMethod || submitPackage.submitMethod,
        submitTo: body.submitTo || submitPackage.submitTo,
        readyForSubmit: submitPackage.readyForSubmit,
        status: action,
      },
      tool: "bid-package",
    });

    return NextResponse.json({
      success: true,
      data: {
        opportunity: serializeBidOpportunity(updatedOpportunity),
        estimateId: context.estimate?.id || null,
        bidFormData: nextBidFormData,
        submitPackage: {
          ...submitPackage,
          status:
            action === "markWon"
              ? "won"
              : action === "markSubmitted"
                ? "submitted"
                : submitPackage.status,
          submittedAt:
            action === "markSubmitted" || action === "markWon"
              ? new Date().toISOString()
              : submitPackage.submittedAt,
        },
      },
    });
  } catch (error) {
    console.error("Prepare submit package error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
