import { NextRequest, NextResponse } from "next/server";
import { appendLeadInteraction, logActivity } from "@/lib/activity-log";
import { serializeEmail } from "@/lib/api-serializers";
import { canAccessEmail } from "@/lib/access-control";
import { requireSessionUser } from "@/lib/auth";
import { buildLeadInteraction } from "@/lib/crm";
import { db } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email-delivery";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { renderTransactionalEmailHtml } from "@/lib/marketing";
import { hasPermissionCapability } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractUserSenderForDelivery } from "@/lib/user-workspace";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const limited = enforceRateLimit(
      request,
      "email-send",
      {
        windowMs: 1000 * 60 * 10,
        max: 20,
      },
      auth.user.id
    );
    if (limited) return limited;

    if (!hasPermissionCapability(auth.user, "connected")) {
      return NextResponse.json(
        {
          success: false,
          error: "Sending emails requires permission level 3 or admin access.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const emailId = typeof body.emailId === "string" ? body.emailId : "";
    const nextFollowUp = typeof body.nextFollowUp === "string" ? body.nextFollowUp : null;

    if (!emailId) {
      return NextResponse.json(
        { success: false, error: "Email ID is required" },
        { status: 400 }
      );
    }

    if (!(await canAccessEmail(auth.user, emailId))) {
      return NextResponse.json(
        { success: false, error: "Email not found or access denied" },
        { status: 404 }
      );
    }

    const email = await db.email.findUnique({
      where: { id: emailId },
      include: {
        lead: true,
        project: true,
        estimate: true,
      },
    });

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email not found" },
        { status: 404 }
      );
    }

    const recipientEmail = email.lead?.email || email.project?.clientEmail;
    const recipientName = email.lead?.name || email.project?.client || "there";
    const sender = extractUserSenderForDelivery(auth.user);

    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, error: "This email does not have a valid recipient address" },
        { status: 400 }
      );
    }

    const sentMessage = await sendTransactionalEmail({
      to: recipientEmail,
      subject: email.subject,
      text: email.body,
      html: renderTransactionalEmailHtml({
        title: email.subject,
        intro: `Sent to ${recipientName}`,
        body: email.body,
        footer: sender.fromName || auth.user.name || "FRG Builder",
      }),
      sender,
    });

    const sentAt = new Date();
    const existingMetadata = parseJsonField<Record<string, unknown> | null>(email.metadata, null) || {};

    const updatedEmail = await db.email.update({
      where: { id: email.id },
      data: {
        status: "sent",
        sentAt,
        metadata: stringifyJson({
          ...existingMetadata,
          provider: sentMessage.provider,
          providerMessageId: sentMessage.messageId,
          recipientEmail,
        }),
      },
    });

    if (email.leadId) {
      await db.lead.update({
        where: { id: email.leadId },
        data: {
          status: email.lead?.status === "new" ? "contacted" : undefined,
          lastContactAt: sentAt,
          nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : email.lead?.nextFollowUp || undefined,
        },
      });

      await appendLeadInteraction(
        email.leadId,
        buildLeadInteraction({
          type: "email-sent",
          title: email.type === "followup" ? "Follow-up sent" : "Email sent",
          description: `${email.subject} was sent to ${recipientEmail}.`,
          metadata: {
            emailId: email.id,
            provider: sentMessage.provider,
          },
        })
      );
    }

    await logActivity({
      userId: auth.user.id,
      action: "send",
      entity: "email",
      entityId: email.id,
      details: {
        leadId: email.leadId,
        projectId: email.projectId,
        estimateId: email.estimateId,
        recipientEmail,
        provider: sentMessage.provider,
      },
      tool: "email-send",
    });

    return NextResponse.json({
      success: true,
      data: serializeEmail(updatedEmail),
    });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
