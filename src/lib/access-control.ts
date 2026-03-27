import { db } from "@/lib/db";
import { isAdminUser, type SessionUser } from "@/lib/auth";

export function resolveScopedUserId(user: SessionUser, requestedUserId?: string | null) {
  if (isAdminUser(user) && requestedUserId) {
    return requestedUserId;
  }

  return user.id;
}

export function canAccessUserId(user: SessionUser, targetUserId?: string | null) {
  if (!targetUserId) {
    return false;
  }

  return isAdminUser(user) || user.id === targetUserId;
}

export async function canAccessProject(user: SessionUser, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  });

  return project && canAccessUserId(user, project.userId) ? project : null;
}

export async function canAccessBidOpportunity(user: SessionUser, opportunityId: string) {
  const opportunity = await db.bidOpportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, userId: true, projectId: true },
  });

  return opportunity && canAccessUserId(user, opportunity.userId) ? opportunity : null;
}

export async function canAccessLead(user: SessionUser, leadId: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { id: true, userId: true },
  });

  return lead && canAccessUserId(user, lead.userId) ? lead : null;
}

export async function canAccessCampaign(user: SessionUser, campaignId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, userId: true },
  });

  return campaign && canAccessUserId(user, campaign.userId) ? campaign : null;
}

export async function canAccessEmail(user: SessionUser, emailId: string) {
  const email = await db.email.findUnique({
    where: { id: emailId },
    select: { id: true, userId: true },
  });

  return email && canAccessUserId(user, email.userId) ? email : null;
}

export async function canAccessConversation(user: SessionUser, conversationId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true },
  });

  return conversation && canAccessUserId(user, conversation.userId) ? conversation : null;
}

export async function canAccessDocument(user: SessionUser, documentId: string) {
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          userId: true,
        },
      },
    },
  });

  return document && canAccessUserId(user, document.project.userId) ? document : null;
}

export async function canAccessEstimate(user: SessionUser, estimateId: string) {
  const estimate = await db.estimate.findUnique({
    where: { id: estimateId },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          userId: true,
        },
      },
    },
  });

  return estimate && canAccessUserId(user, estimate.project.userId) ? estimate : null;
}

export async function canAccessLearningItem(user: SessionUser, learningItemId: string) {
  const learningItem = await db.learningItem.findUnique({
    where: { id: learningItemId },
    select: { id: true, userId: true },
  });

  return learningItem && canAccessUserId(user, learningItem.userId) ? learningItem : null;
}
