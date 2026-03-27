import { NextRequest, NextResponse } from "next/server";
import { generateProposalPdfBytes, getProposalContext } from "@/lib/proposals";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const estimateId = searchParams.get("estimateId");

    if (!estimateId) {
      return NextResponse.json(
        { success: false, error: "Estimate ID is required" },
        { status: 400 }
      );
    }

    const { estimate, project } = await getProposalContext(estimateId);
    const pdfBytes = await generateProposalPdfBytes(project, estimate);
    const fileName = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-proposal-v${estimate.version}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Generate proposal PDF error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
