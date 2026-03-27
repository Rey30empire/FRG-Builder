import { NextRequest, NextResponse } from "next/server";
import { generateProposalPdfBytes, getPublicProposalContext, markProposalViewed } from "@/lib/proposals";

export const runtime = "nodejs";

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

    const context = await markProposalViewed(token);
    if (!context) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    const pdfBytes = await generateProposalPdfBytes(context.project, {
      ...context.estimate,
      proposalData: context.proposalData,
    });
    const fileName = `${context.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-proposal-v${context.estimate.version}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Generate public proposal PDF error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
