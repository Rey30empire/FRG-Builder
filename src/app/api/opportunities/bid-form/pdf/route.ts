import { NextRequest, NextResponse } from "next/server";
import { canAccessBidOpportunity } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { generateBidFormPdfBytes, getBidPackageContext } from "@/lib/bid-package";
import { hasPermissionCapability } from "@/lib/permissions";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    if (!hasPermissionCapability(auth.user, "export")) {
      return NextResponse.json(
        {
          success: false,
          error: "Exporting bid form PDFs requires permission level 2 or admin access.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get("opportunityId");
    const estimateId = searchParams.get("estimateId");

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

    const pdfBytes = await generateBidFormPdfBytes({
      opportunity: context.opportunity,
      project: context.project,
      estimate: context.estimate,
      bidFormData: context.bidFormData,
      company: context.company,
    });

    const fileName = `${slugify(context.opportunity.name)}-bid-form.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Generate bid form PDF error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
