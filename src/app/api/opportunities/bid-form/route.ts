import { NextRequest, NextResponse } from "next/server";
import { serializeBidOpportunity } from "@/lib/api-serializers";
import { canAccessBidOpportunity } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import {
  getBidPackageContext,
  normalizeBidFormDataInput,
  persistBidPackageState,
} from "@/lib/bid-package";
import type { BidFormData } from "@/types";

function getQueryValue(request: NextRequest, key: string) {
  return new URL(request.url).searchParams.get(key);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const opportunityId = getQueryValue(request, "opportunityId");
    const estimateId = getQueryValue(request, "estimateId");

    if (!opportunityId) {
      return NextResponse.json(
        { success: false, error: "Opportunity ID is required." },
        { status: 400 }
      );
    }

    if (!(await canAccessBidOpportunity(auth.user, opportunityId))) {
      return NextResponse.json(
        { success: false, error: "Opportunity not found or access denied" },
        { status: 404 }
      );
    }

    const context = await getBidPackageContext(opportunityId, estimateId);
    if (!context) {
      return NextResponse.json(
        { success: false, error: "Opportunity context not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        opportunity: serializeBidOpportunity(context.opportunity),
        estimateId: context.estimate?.id || null,
        bidFormData: context.bidFormData,
        submitPackage: context.submitPackage,
      },
    });
  } catch (error) {
    console.error("Get bid form error:", error);
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

    const body = (await request.json()) as {
      opportunityId?: string;
      estimateId?: string;
      bidFormData?: Partial<BidFormData>;
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

    const nextBidFormData = normalizeBidFormDataInput(body.bidFormData, context.bidFormData);
    const updatedOpportunity = await persistBidPackageState({
      opportunityId: body.opportunityId,
      bidFormData: nextBidFormData,
    });

    return NextResponse.json({
      success: true,
      data: {
        opportunity: serializeBidOpportunity(updatedOpportunity),
        estimateId: context.estimate?.id || null,
        bidFormData: nextBidFormData,
        submitPackage: context.submitPackage,
      },
    });
  } catch (error) {
    console.error("Save bid form error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
