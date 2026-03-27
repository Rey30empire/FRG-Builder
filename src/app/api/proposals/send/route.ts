import { NextRequest, NextResponse } from "next/server";
import { appendLeadInteraction, logActivity } from "@/lib/activity-log";
import { assertBillingLimit, BillingLimitError, recordBillingUsage } from "@/lib/billing";
import { buildBidFormData, generateBidFormPdfBytes } from "@/lib/bid-package";
import { serializeEmail, serializeEstimate } from "@/lib/api-serializers";
import { canAccessEstimate, canAccessLead } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email-delivery";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { buildProposalEmailMetadataDetailed } from "@/lib/marketing";
import { hasPermissionCapability } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractUserSenderForDelivery } from "@/lib/user-workspace";
import {
  buildProposalData,
  buildProposalDeliveryEmail,
  buildProposalPortalUrl,
  buildPublicProposalPdfUrl,
  generateProposalPdfBytes,
  getProposalContext,
  issueProposalDeliveryToken,
} from "@/lib/proposals";
import type { BidFormData } from "@/types";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const limited = enforceRateLimit(
      request,
      "proposal-send",
      {
        windowMs: 1000 * 60 * 10,
        max: 12,
      },
      auth.user.id
    );
    if (limited) return limited;

    if (!hasPermissionCapability(auth.user, "connected")) {
      return NextResponse.json(
        {
          success: false,
          error: "Sending proposals requires permission level 3 or admin access.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const estimateId = typeof body.estimateId === "string" ? body.estimateId : null;
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

    if (!(await canAccessEstimate(auth.user, estimateId))) {
      return NextResponse.json(
        { success: false, error: "Estimate not found or access denied" },
        { status: 404 }
      );
    }

    if (leadId && !(await canAccessLead(auth.user, leadId))) {
      return NextResponse.json(
        { success: false, error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    await assertBillingLimit({
      userId: auth.user.id,
      metricKey: "proposal_deliveries",
      quantity: 1,
    });

    const { estimate, project, company } = await getProposalContext(estimateId);
    const proposalData = buildProposalData(project, estimate);
    const toEmail = recipientEmail || proposalData.recipientEmail || project.clientEmail;

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: "Recipient email is required to send proposal" },
        { status: 400 }
      );
    }

    const { token } = await issueProposalDeliveryToken({
      estimateId: estimate.id,
      recipientName: recipientName || proposalData.recipientName || project.client || undefined,
      recipientEmail: toEmail,
      senderMessage: messageOverride,
    });
    const baseUrl = new URL(request.url).origin;
    const portalUrl = buildProposalPortalUrl(baseUrl, token);
    const publicPdfUrl = buildPublicProposalPdfUrl(baseUrl, token);
    const attachmentUrl = `/api/proposals/pdf?estimateId=${encodeURIComponent(estimate.id)}`;
    const pdfBytes = await generateProposalPdfBytes(project, {
      ...estimate,
      proposalData: {
        ...proposalData,
        recipientName: recipientName || proposalData.recipientName || project.client || undefined,
        recipientEmail: toEmail,
      },
    });
    const linkedOpportunity = await db.bidOpportunity.findUnique({
      where: {
        projectId: project.id,
      },
    });
    const bidFormPdfUrl = linkedOpportunity
      ? `/api/opportunities/bid-form/pdf?opportunityId=${encodeURIComponent(linkedOpportunity.id)}&estimateId=${encodeURIComponent(estimate.id)}`
      : undefined;
    const bidFormData =
      linkedOpportunity && linkedOpportunity.bidFormRequired
        ? parseJsonField<BidFormData | null>(linkedOpportunity.bidFormData, null) ||
          buildBidFormData({
            opportunity: linkedOpportunity,
            project,
            estimate,
            user: auth.user,
            company,
          })
        : null;
    const bidFormPdfBytes =
      linkedOpportunity && bidFormData && bidFormData.lineItems.length
        ? await generateBidFormPdfBytes({
            opportunity: linkedOpportunity,
            project,
            estimate,
            bidFormData,
            company,
          })
        : null;
    const emailContent = buildProposalDeliveryEmail({
      project,
      estimate,
      proposalData: {
        ...proposalData,
        recipientName: recipientName || proposalData.recipientName || project.client || undefined,
        recipientEmail: toEmail,
      },
      senderMessage: messageOverride,
      portalUrl,
      pdfUrl: publicPdfUrl,
    });
    const sender = extractUserSenderForDelivery(auth.user);
    const sentMessage = await sendTransactionalEmail({
      to: toEmail,
      subject: subjectOverride || emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      sender,
      attachments: [
        {
          filename: `${slugify(project.name)}-proposal-v${estimate.version}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
        ...(bidFormPdfBytes
          ? [
              {
                filename: `${slugify(project.name)}-bid-form.pdf`,
                content: Buffer.from(bidFormPdfBytes),
                contentType: "application/pdf",
              },
            ]
          : []),
      ],
    });

    const email = await db.email.create({
      data: {
        userId: auth.user.id,
        leadId,
        projectId: project.id,
        estimateId: estimate.id,
        subject: subjectOverride || emailContent.subject,
        body: emailContent.text,
        type: "proposal",
        status: "sent",
        sentAt: new Date(),
        metadata: stringifyJson(
          buildProposalEmailMetadataDetailed({
            attachmentUrl,
            bidFormPdfUrl,
            portalUrl,
            publicPdfUrl,
            provider: sentMessage.provider,
            providerMessageId: sentMessage.messageId,
          })
        ),
      },
    });

    const sentAt = new Date();

    const [updatedEstimate] = await db.$transaction([
      db.estimate.update({
        where: { id: estimate.id },
        data: {
          proposalData: stringifyJson({
            ...proposalData,
            recipientName: recipientName || proposalData.recipientName || project.client,
            recipientEmail: toEmail,
          }),
          status: "sent",
          sentAt,
        },
        include: {
          takeoffItems: true,
          emails: true,
          proposalDelivery: true,
        },
      }),
      db.proposalDelivery.update({
        where: { estimateId: estimate.id },
        data: {
          recipientName: recipientName || proposalData.recipientName || project.client || null,
          recipientEmail: toEmail,
          senderMessage: messageOverride || null,
          status: "sent",
          provider: sentMessage.provider,
          providerMessageId: sentMessage.messageId,
          sentAt,
        },
      }),
    ]);

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
      userId: auth.user.id,
      action: "send",
      entity: "proposal",
      entityId: estimate.id,
      details: {
        projectId: project.id,
        leadId,
        emailId: email.id,
        recipientEmail: toEmail,
        portalUrl,
        publicPdfUrl,
        bidFormPdfUrl,
        provider: sentMessage.provider,
      },
      tool: "proposal-send",
    });

    await recordBillingUsage({
      userId: auth.user.id,
      metricKey: "proposal_deliveries",
      quantity: 1,
      source: "proposals.send",
      referenceId: estimate.id,
      referenceType: "estimate",
      metadata: {
        projectId: project.id,
        leadId: leadId || null,
        provider: sentMessage.provider,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        email: serializeEmail(email),
        estimate: serializeEstimate(updatedEstimate),
        attachmentUrl,
        portalUrl,
        publicPdfUrl,
      },
    });
  } catch (error) {
    console.error("Send proposal error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof BillingLimitError ? error.status : 500 }
    );
  }
}
