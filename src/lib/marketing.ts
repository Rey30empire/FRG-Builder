import type { Campaign, EmailMetadata } from "@/types";

type MarketingMode = "email" | "social" | "sequence";
type MarketingLead = {
  name?: string | null;
  company?: string | null;
};

type MarketingProject = {
  name: string;
  address?: string | null;
};

interface GenerateMarketingContentInput {
  mode: MarketingMode;
  topic: string;
  audience?: string;
  tone?: string;
  platform?: string;
  lead?: MarketingLead | null;
  project?: MarketingProject | null;
}

function fallbackProjectLine(project?: MarketingProject | null) {
  if (!project) return "your upcoming construction scope";
  return `${project.name}${project.address ? ` in ${project.address}` : ""}`;
}

function buildHook(topic: string, audience?: string) {
  const normalizedAudience = audience?.trim() || "owners and project stakeholders";
  return `We help ${normalizedAudience} move faster from scope review to a clear price with fewer surprises. ${topic.trim()}`;
}

export function generateMarketingContent(input: GenerateMarketingContentInput) {
  const topic = input.topic.trim() || "construction support";
  const projectLine = fallbackProjectLine(input.project);
  const audience = input.audience?.trim() || input.lead?.company || "qualified prospects";
  const contactName = input.lead?.name || "there";

  if (input.mode === "social") {
    return {
      headline: `${topic} without the usual estimate delays`,
      body: [
        buildHook(topic, audience),
        `Recent focus: ${projectLine}.`,
        "If you need plan review, scope cleanup, or a faster proposal turnaround, reply and we can map the next step.",
      ].join("\n\n"),
      bullets: [
        "Plan review and trade classification",
        "Estimate breakdown with labor, material, equipment, overhead and profit",
        "Proposal-ready output for faster client follow-up",
      ],
      cta: "Book a scope review call",
      platform: input.platform || "linkedin",
    };
  }

  if (input.mode === "sequence") {
    return {
      title: `${topic} follow-up sequence`,
      steps: [
        {
          dayOffset: 0,
          channel: "email",
          subject: `Quick follow-up on ${topic}`,
          message: `Hi ${contactName}, I wanted to make it easy to review next steps for ${projectLine}. If you'd like, I can send a tighter scope summary and budget range.`,
        },
        {
          dayOffset: 3,
          channel: "email",
          subject: `Scope checkpoints for ${topic}`,
          message: `A short checklist usually helps move these jobs forward: scope alignment, exclusions, timeline, and decision points. I can package that for you this week.`,
        },
        {
          dayOffset: 7,
          channel: "call",
          subject: "Follow-up call",
          message: `Reach out to confirm whether ${projectLine} is still active and whether a revised proposal would help.`,
        },
      ],
      cta: "Keep the proposal moving",
    };
  }

  return {
    subject: `Proposal support for ${topic}`,
    body: [
      `Hi ${contactName},`,
      "",
      `I wanted to follow up regarding ${projectLine}. We can help with a cleaner breakdown for ${topic}, including scope clarification, exclusions, schedule expectations, and a proposal-ready estimate.`,
      "",
      "If it helps, I can send a concise version that is easier for your team or client to review.",
      "",
      "Best,",
      "FRG Builder",
    ].join("\n"),
    cta: "Reply with the latest set or questions",
    tone: input.tone || "professional",
  };
}

export function buildProposalEmailMetadata(attachmentUrl: string): EmailMetadata {
  return {
    attachmentLabel: "FRG Proposal PDF",
    attachmentUrl,
    cta: "Review proposal and confirm next steps",
    template: "proposal-delivery",
    generatedBy: "frg-builder",
    proposalStatus: "sent",
  };
}

export function summarizeCampaignPerformance(campaign: Campaign) {
  const sent = campaign.sent || 0;
  const opened = campaign.opened || 0;
  const clicked = campaign.clicked || 0;
  const converted = campaign.converted || 0;

  return {
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
    conversionRate: sent > 0 ? Math.round((converted / sent) * 100) : 0,
  };
}
