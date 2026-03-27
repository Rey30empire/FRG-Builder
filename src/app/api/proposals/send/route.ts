import { NextRequest, NextResponse } from "next/server";
import { appendLeadInteraction, logActivity } from "@/lib/activity-log";
import { serializeEmail, serializeEstimate } from "@/lib/api-serializers";
import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/default-user";
import { stringifyJson } from "@/lib/json";
import { buildProposalEmailMetadata, generateMarketingContent } from "@/lib/marketing";
import { buildProposalData, getProposalContext } from "@/lib/proposals";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const estimateId = typeof body.estimateId === "string" ? body.estimateId : null;
    const userId = typeof body.userId === "string" ? body.userId : DEFAULT_USER_ID;
    const leadId = typeof body.leadId === "string" ? body.leadId : undefined;
    const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail : undefined;
    const recipientName = typeof body.recipientName === "string" ? body.recipientName : undefined;
    const subjectOverride = typeof body.subject === "string" ? body.subject : undefined;
    const messageOverride = typeof body.message === "string" ? body.message : undefined;

    if (!estimateId) {
      return NextResponse.json(
        { success: false, error: "Estimate ID is required" },
        { status: 400 }
      );
    }

    const { estimate, project } = await getProposalContext(estimateId);
    const proposalData = buildProposalData(project, estimate);
    const toEmail = recipientEmail || proposalData.recipientEmail || project.clientEmail;

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: "Recipient email is required to send proposal" },
        { status: 400 }
      );
    }

    const emailDraft = generateMarketingContent({
      mode: "email",
      topic: `${project.name} proposal`,
      audience: project.client || recipientName,
      lead: null,
      project,
    });

    const subject = subjectOverride || `Proposal for ${project.name}`;
    const bodyText =
      messageOverride ||
      `${emailDraft.body}\n\nAttached: Proposal PDF and estimate summary.\n\nTotal proposed amount: ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(estimate.total || 0)}`;

    const attachmentUrl = `/api/proposals/pdf?estimateId=${encodeURIComponent(estimate.id)}`;

    const email = await db.email.create({
      data: {
        userId,
        leadId,
        projectId: project.id,
        estimateId: estimate.id,
        subject,
        body: bodyText,
        type: "proposal",
        status: "sent",
        sentAt: new Date(),
        metadata: stringifyJson(buildProposalEmailMetadata(attachmentUrl)),
      },
    });

    const updatedEstimate = await db.estimate.update({
      where: { id: estimate.id },
      data: {
        proposalData: stringifyJson({
          ...proposalData,
          recipientName: recipientName || proposalData.recipientName || project.client,
          recipientEmail: toEmail,
        }),
        status: "sent",
        sentAt: new Date(),
      },
      include: {
        takeoffItems: true,
        emails: true,
      },
    });

    await db.project.update({
      where: { id: project.id },
      data: {
        clientEmail: toEmail,
        client: recipientName || project.client || undefined,
      },
    });

    if (leadId) {
      await db.lead.update({
        where: { id: leadId },
        data: {
          status: "proposal",
          nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        },
      });

      await appendLeadInteraction(leadId, {
        type: "proposal",
        title: `Proposal sent for ${project.name}`,
        description: `Proposal delivered to ${toEmail}`,
        emailId: email.id,
        estimateId: estimate.id,
      });
    }

    await logActivity({
      userId,
      action: "send",
      entity: "proposal",
      entityId: estimate.id,
      details: {
        projectId: project.id,
        leadId,
        emailId: email.id,
        recipientEmail: toEmail,
      },
      tool: "proposal-send",
    });

    return NextResponse.json({
      success: true,
      data: {
        email: serializeEmail(email),
        estimate: serializeEstimate(updatedEstimate),
        attachmentUrl,
      },
    });
  } catch (error) {
    console.error("Send proposal error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
