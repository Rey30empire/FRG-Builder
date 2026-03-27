import { NextRequest, NextResponse } from "next/server";
import { canAccessLead, canAccessProject } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateMarketingContent } from "@/lib/marketing";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

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

    if (leadId && !(await canAccessLead(auth.user, leadId))) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
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
