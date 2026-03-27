import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMarketingContent } from "@/lib/marketing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mode,
      topic,
      audience,
      tone,
      platform,
      leadId,
      projectId,
    } = body;

    if (!mode || !topic) {
      return NextResponse.json(
        { success: false, error: "Mode and topic are required" },
        { status: 400 }
      );
    }

    const [lead, project] = await Promise.all([
      leadId ? db.lead.findUnique({ where: { id: leadId }, include: { emails: true } }) : null,
      projectId ? db.project.findUnique({ where: { id: projectId }, include: { documents: true, estimates: true } }) : null,
    ]);

    const content = generateMarketingContent({
      mode,
      topic,
      audience,
      tone,
      platform,
      lead,
      project,
    });

    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Generate marketing content error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
