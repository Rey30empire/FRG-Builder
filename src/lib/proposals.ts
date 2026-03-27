import { createHash, randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import type { EstimateRegionalContext, ProposalData, ProposalLineItemSummary } from "@/types";
import { parseJsonField } from "@/lib/json";

type ProposalTakeoffItem = {
  trade: string;
  description: string;
  totalCost?: number | null;
};

type ProjectForProposal = {
  id: string;
  userId?: string | null;
  name: string;
  address?: string | null;
  client?: string | null;
  clientEmail?: string | null;
  projectMemory?: {
    exclusions?: string[] | string | null;
    notes?: string | null;
  } | null;
};

type EstimateForProposal = {
  id: string;
  total?: number | null;
  materialsCost?: number | null;
  laborCost?: number | null;
  equipmentCost?: number | null;
  subtotal?: number | null;
  overhead?: number | null;
  profit?: number | null;
  duration?: number | null;
  marketFactor?: number | null;
  proposalData?: ProposalData | null;
  regionalContext?: EstimateRegionalContext | string | null;
  proposalDelivery?: {
    status?: string | null;
    recipientName?: string | null;
    recipientEmail?: string | null;
    senderMessage?: string | null;
    responseMessage?: string | null;
    provider?: string | null;
    providerMessageId?: string | null;
    sentAt?: Date | null;
    viewedAt?: Date | null;
    approvedAt?: Date | null;
    rejectedAt?: Date | null;
    viewCount?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;
  takeoffItems: ProposalTakeoffItem[];
};

type CompanyForProposal = {
  name?: string | null;
  primaryColor?: string | null;
  proposalTemplate?: string | null;
} | null;

const DEFAULT_BRAND = {
  companyName: "FRG LLC",
  accent: rgb(0.96, 0.52, 0.17),
  accentMuted: rgb(0.97, 0.92, 0.87),
  heading: rgb(0.15, 0.15, 0.2),
  body: rgb(0.28, 0.3, 0.36),
};

const PAGE = {
  width: 612,
  height: 792,
  margin: 48,
};

function hashProposalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function issueProposalToken() {
  return randomBytes(24).toString("base64url");
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseBrandColor(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace("#", "").trim();

  if (normalized.length !== 6) {
    return null;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((component) => Number.isNaN(component))) {
    return null;
  }

  return rgb(red / 255, green / 255, blue / 255);
}

function getProposalBranding(company?: CompanyForProposal, proposal?: ProposalData | null) {
  const accentFromCompany = parseBrandColor(company?.primaryColor);

  if (accentFromCompany) {
    return {
      ...DEFAULT_BRAND,
      companyName: company?.name || DEFAULT_BRAND.companyName,
      accent: accentFromCompany,
    };
  }

  if (proposal?.template === "residential") {
    return {
      ...DEFAULT_BRAND,
      companyName: company?.name || DEFAULT_BRAND.companyName,
      accent: rgb(0.85, 0.44, 0.15),
    };
  }

  if (proposal?.template === "tenant-improvement") {
    return {
      ...DEFAULT_BRAND,
      companyName: company?.name || DEFAULT_BRAND.companyName,
      accent: rgb(0.16, 0.45, 0.67),
    };
  }

  return {
    ...DEFAULT_BRAND,
    companyName: company?.name || DEFAULT_BRAND.companyName,
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);

    if (width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function detectProposalTemplate(project: ProjectForProposal, estimate: EstimateForProposal) {
  const projectName = `${project.name} ${project.client || ""}`.toLowerCase();
  const isTI = ["tenant improvement", "office", "retail", "ti", "warehouse"].some((keyword) =>
    projectName.includes(keyword)
  );
  const isResidential = ["adu", "residential", "home", "family", "kitchen", "bathroom"].some(
    (keyword) => projectName.includes(keyword)
  );

  if (isTI) return "tenant-improvement" as const;
  if (isResidential) return "residential" as const;

  const majorTrades = estimate.takeoffItems?.map((item) => item.trade.toLowerCase()) || [];
  if (majorTrades.some((trade) => ["concrete", "framing", "structural"].includes(trade))) {
    return "commercial" as const;
  }

  return "commercial" as const;
}

function buildHighlights(estimate: EstimateForProposal): ProposalLineItemSummary[] {
  return [...(estimate.takeoffItems || [])]
    .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
    .slice(0, 5)
    .map((item) => ({
      trade: item.trade,
      description: item.description,
      totalCost: item.totalCost || 0,
    }));
}

function resolveRegionalContext(estimate: EstimateForProposal) {
  return parseJsonField<EstimateRegionalContext | null>(estimate.regionalContext, null);
}

export function buildProposalData(project: ProjectForProposal, estimate: EstimateForProposal) {
  const existing = estimate.proposalData || null;
  if (existing) {
    return existing;
  }

  const regionalContext = resolveRegionalContext(estimate);

  const exclusions = parseJsonField<string[]>(
    project.projectMemory?.exclusions,
    [
      "Permit fees unless specifically listed",
      "Unforeseen concealed conditions",
      "Owner-provided design revisions after approval",
    ]
  );

  const template = detectProposalTemplate(project, estimate);
  const schedule =
    estimate.duration && estimate.duration > 0
      ? `${estimate.duration} calendar days from notice to proceed, subject to field access${regionalContext ? `, ${regionalContext.weatherSummary.toLowerCase()}` : ""} and material lead times.`
      : "Schedule to be confirmed once scope and start window are approved.";

  const terms = [
    "Price is based on the current document set and identified scope assumptions.",
    "Any owner-directed revisions, hidden conditions, or new addenda may require a revised proposal.",
    "Payment schedule and mobilization terms will be finalized in the contract package.",
  ];

  return {
    title: `${project.name} Proposal`,
    recipientName: project.client || undefined,
    recipientEmail: project.clientEmail || undefined,
    intro:
      template === "residential"
        ? "Thank you for the opportunity to review your residential project. Below is our pricing and proposed scope summary."
        : "Thank you for the opportunity to provide pricing. Below is a proposal summary based on the current plan set and estimating assumptions.",
    scopeSummary: `This proposal is based on ${estimate.takeoffItems.length} scoped line items with pricing assembled from labor, material, equipment, overhead, and profit assumptions.${regionalContext ? ` Regional pricing was aligned to ${regionalContext.locationSummary} with market factor ${regionalContext.marketFactor.toFixed(2)} and climate factor ${regionalContext.weatherFactor.toFixed(2)}.` : ""}`,
    inclusions: [
      "Scope review and estimate breakdown",
      "Trade pricing aligned to analyzed project documents",
      "Proposal-ready summary for client review",
    ],
    exclusions,
    schedule,
    terms,
    template,
    coverNote: project.projectMemory?.notes || undefined,
    highlights: buildHighlights(estimate),
  } satisfies ProposalData;
}

function drawSectionTitle(page: PDFPage, text: string, y: number, font: PDFFont) {
  page.drawText(text, {
    x: PAGE.margin,
    y,
    font,
    size: 13,
    color: rgb(0.15, 0.15, 0.2),
  });
}

function drawParagraph(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size = 10,
  color = rgb(0.28, 0.3, 0.36)
) {
  const lines = wrapText(text, font, size, PAGE.width - PAGE.margin * 2);
  let currentY = y;

  for (const line of lines) {
    page.drawText(line, {
      x: PAGE.margin,
      y: currentY,
      font,
      size,
      color,
    });
    currentY -= size + 4;
  }

  return currentY;
}

export async function generateProposalPdfBytes(project: ProjectForProposal, estimate: EstimateForProposal) {
  const proposal = buildProposalData(project, estimate);
  const company = await db.companyMemory.findFirst({
    select: {
      name: true,
      primaryColor: true,
      proposalTemplate: true,
    },
  });
  const brand = getProposalBranding(company, proposal);
  const pdf = await PDFDocument.create();
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let cursorY = PAGE.height - PAGE.margin;

  page.drawRectangle({
    x: 0,
    y: PAGE.height - 120,
    width: PAGE.width,
    height: 120,
    color: brand.accent,
  });

  page.drawText(brand.companyName, {
    x: PAGE.margin,
    y: PAGE.height - 56,
    font: titleFont,
    size: 24,
    color: rgb(1, 1, 1),
  });

  page.drawText(proposal.title, {
    x: PAGE.margin,
    y: PAGE.height - 86,
    font: bodyFont,
    size: 12,
    color: rgb(1, 1, 1),
  });

  cursorY = PAGE.height - 150;

  page.drawText(`Prepared for: ${proposal.recipientName || project.client || "Client"}`, {
    x: PAGE.margin,
    y: cursorY,
    font: titleFont,
    size: 12,
    color: brand.heading,
  });
  cursorY -= 20;

  page.drawText(`Project: ${project.name}`, {
    x: PAGE.margin,
    y: cursorY,
    font: bodyFont,
    size: 10,
    color: rgb(0.22, 0.25, 0.3),
  });
  cursorY -= 16;

  page.drawText(`Address: ${project.address || "TBD"}`, {
    x: PAGE.margin,
    y: cursorY,
    font: bodyFont,
    size: 10,
    color: rgb(0.22, 0.25, 0.3),
  });
  cursorY -= 28;

  drawSectionTitle(page, "Proposal Overview", cursorY, titleFont);
  cursorY -= 20;
  cursorY = drawParagraph(page, proposal.intro, cursorY, bodyFont);
  cursorY -= 10;
  cursorY = drawParagraph(page, proposal.scopeSummary, cursorY, bodyFont);
  cursorY -= 16;

  drawSectionTitle(page, "Pricing Summary", cursorY, titleFont);
  cursorY -= 22;

  const pricingRows: Array<[string, number]> = [
    ["Materials", estimate.materialsCost || 0],
    ["Labor", estimate.laborCost || 0],
    ["Equipment", estimate.equipmentCost || 0],
    ["Subtotal", estimate.subtotal || 0],
    ["Overhead", estimate.overhead || 0],
    ["Profit", estimate.profit || 0],
    ["Total", estimate.total || 0],
  ];

  for (const [label, value] of pricingRows) {
    page.drawText(label, {
      x: PAGE.margin,
      y: cursorY,
      font: label === "Total" ? titleFont : bodyFont,
      size: 10,
      color: rgb(0.15, 0.15, 0.2),
    });
    page.drawText(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(value)),
      {
      x: PAGE.width - PAGE.margin - 140,
      y: cursorY,
      font: label === "Total" ? titleFont : bodyFont,
      size: 10,
      color: label === "Total" ? brand.accent : rgb(0.22, 0.25, 0.3),
    }
  );
    cursorY -= 16;
  }

  cursorY -= 12;
  drawSectionTitle(page, "Included Highlights", cursorY, titleFont);
  cursorY -= 20;

  for (const item of proposal.highlights) {
    const bullet = `${item.trade}: ${item.description} - ${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(item.totalCost)}`;
    cursorY = drawParagraph(page, `• ${bullet}`, cursorY, bodyFont, 9);
    cursorY -= 4;
  }

  page = pdf.addPage([PAGE.width, PAGE.height]);
  cursorY = PAGE.height - PAGE.margin;

  drawSectionTitle(page, "Inclusions", cursorY, titleFont);
  cursorY -= 20;
  for (const inclusion of proposal.inclusions) {
    cursorY = drawParagraph(page, `• ${inclusion}`, cursorY, bodyFont, 10);
    cursorY -= 4;
  }

  cursorY -= 8;
  drawSectionTitle(page, "Exclusions", cursorY, titleFont);
  cursorY -= 20;
  for (const exclusion of proposal.exclusions) {
    cursorY = drawParagraph(page, `• ${exclusion}`, cursorY, bodyFont, 10);
    cursorY -= 4;
  }

  cursorY -= 8;
  drawSectionTitle(page, "Schedule", cursorY, titleFont);
  cursorY -= 20;
  cursorY = drawParagraph(page, proposal.schedule, cursorY, bodyFont);
  cursorY -= 12;

  drawSectionTitle(page, "Terms", cursorY, titleFont);
  cursorY -= 20;
  for (const term of proposal.terms) {
    cursorY = drawParagraph(page, `• ${term}`, cursorY, bodyFont, 10);
    cursorY -= 4;
  }

  if (proposal.coverNote) {
    cursorY -= 8;
    drawSectionTitle(page, "Project Note", cursorY, titleFont);
    cursorY -= 20;
    cursorY = drawParagraph(page, proposal.coverNote, cursorY, bodyFont);
  }

  page.drawText(`Prepared by ${brand.companyName}`, {
    x: PAGE.margin,
    y: 32,
    font: bodyFont,
    size: 9,
    color: rgb(0.45, 0.48, 0.52),
  });

  return pdf.save();
}

export function buildProposalPortalUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, "")}/proposal/${token}`;
}

export function buildPublicProposalPdfUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, "")}/api/proposals/public/pdf?token=${encodeURIComponent(token)}`;
}

export function buildProposalDeliveryEmail({
  project,
  estimate,
  proposalData,
  senderMessage,
  portalUrl,
  pdfUrl,
}: {
  project: ProjectForProposal;
  estimate: EstimateForProposal;
  proposalData: ProposalData;
  senderMessage?: string;
  portalUrl: string;
  pdfUrl: string;
}) {
  const greetingName = proposalData.recipientName || project.client || "there";
  const senderNote = senderMessage?.trim();
  const text = [
    `Hi ${greetingName},`,
    "",
    senderNote || proposalData.intro,
    "",
    `Project: ${project.name}`,
    `Proposal total: ${formatCurrency(estimate.total)}`,
    `Template: ${proposalData.template}`,
    "",
    `Review proposal online: ${portalUrl}`,
    `Download PDF: ${pdfUrl}`,
    "",
    "Please review the scope summary, inclusions, exclusions, and terms. You can approve or reject the proposal directly from the portal.",
    "",
    "Best,",
    "FRG Builder",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#1f2937;">
      <h2 style="margin:0 0 16px;color:#111827;">${proposalData.title}</h2>
      <p style="margin:0 0 16px;">Hi ${greetingName},</p>
      <p style="margin:0 0 16px;">${(senderNote || proposalData.intro).replace(/\n/g, "<br />")}</p>
      <div style="border:1px solid #e5e7eb;border-radius:16px;padding:18px 20px;margin:0 0 18px;background:#fff8f3;">
        <p style="margin:0 0 8px;"><strong>Project:</strong> ${project.name}</p>
        <p style="margin:0 0 8px;"><strong>Proposal total:</strong> ${formatCurrency(estimate.total)}</p>
        <p style="margin:0;"><strong>Schedule:</strong> ${proposalData.schedule}</p>
      </div>
      <p style="margin:0 0 20px;">${proposalData.scopeSummary}</p>
      <div style="margin:0 0 20px;">
        <a href="${portalUrl}" style="display:inline-block;background:#ea7d2b;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;margin-right:12px;">Review proposal</a>
        <a href="${pdfUrl}" style="display:inline-block;border:1px solid #d1d5db;color:#111827;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">Download PDF</a>
      </div>
      <p style="margin:0 0 12px;color:#4b5563;">You can approve or reject the proposal directly from the portal after reviewing it.</p>
      <p style="margin:0;color:#6b7280;">FRG Builder</p>
    </div>
  `.trim();

  return {
    subject: `Proposal for ${project.name}`,
    text,
    html,
  };
}

export async function issueProposalDeliveryToken(input: {
  estimateId: string;
  recipientName?: string;
  recipientEmail?: string;
  senderMessage?: string;
}) {
  const token = issueProposalToken();
  const tokenHash = hashProposalToken(token);

  const delivery = await db.proposalDelivery.upsert({
    where: { estimateId: input.estimateId },
    update: {
      tokenHash,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      senderMessage: input.senderMessage,
      responseMessage: null,
    },
    create: {
      estimateId: input.estimateId,
      tokenHash,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      senderMessage: input.senderMessage,
      status: "draft",
    },
  });

  return { token, delivery };
}

export async function getPublicProposalContext(token: string) {
  const delivery = await db.proposalDelivery.findUnique({
    where: {
      tokenHash: hashProposalToken(token),
    },
    include: {
      estimate: {
        include: {
          takeoffItems: true,
          proposalDelivery: true,
          project: {
            include: {
              projectMemory: true,
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    return null;
  }

  const company = await db.companyMemory.findFirst();
  const estimate = {
    ...delivery.estimate,
    proposalData: parseJsonField<ProposalData | null>(delivery.estimate.proposalData, null),
  };
  const project = estimate.project as ProjectForProposal;
  const proposalData = buildProposalData(project, estimate);

  return {
    delivery,
    estimate,
    project,
    proposalData,
    company,
  };
}

export function sanitizeProposalDelivery(delivery: {
  id: string;
  estimateId: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  senderMessage?: string | null;
  responseMessage?: string | null;
  status: string;
  provider?: string | null;
  providerMessageId?: string | null;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: delivery.id,
    estimateId: delivery.estimateId,
    recipientName: delivery.recipientName,
    recipientEmail: delivery.recipientEmail,
    senderMessage: delivery.senderMessage,
    responseMessage: delivery.responseMessage,
    status: delivery.status,
    provider: delivery.provider,
    providerMessageId: delivery.providerMessageId,
    sentAt: delivery.sentAt,
    viewedAt: delivery.viewedAt,
    approvedAt: delivery.approvedAt,
    rejectedAt: delivery.rejectedAt,
    viewCount: delivery.viewCount,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

export async function markProposalViewed(token: string) {
  const context = await getPublicProposalContext(token);
  if (!context) {
    return null;
  }

  const now = new Date();
  const nextStatus =
    context.delivery.status === "approved" || context.delivery.status === "rejected"
      ? context.delivery.status
      : "viewed";
  const nextEstimateStatus =
    context.estimate.status === "approved" || context.estimate.status === "rejected"
      ? context.estimate.status
      : "viewed";

  await db.$transaction([
    db.proposalDelivery.update({
      where: { id: context.delivery.id },
      data: {
        status: nextStatus,
        viewedAt: context.delivery.viewedAt || now,
        viewCount: {
          increment: 1,
        },
      },
    }),
    db.estimate.update({
      where: { id: context.estimate.id },
      data: {
        status: nextEstimateStatus,
        viewedAt: context.estimate.viewedAt || now,
      },
    }),
  ]);

  return getPublicProposalContext(token);
}

export async function respondToProposal(token: string, action: "approved" | "rejected", message?: string) {
  const context = await getPublicProposalContext(token);
  if (!context) {
    return null;
  }

  const now = new Date();

  await db.$transaction([
    db.proposalDelivery.update({
      where: { id: context.delivery.id },
      data: {
        status: action,
        responseMessage: message || null,
        viewedAt: context.delivery.viewedAt || now,
        approvedAt: action === "approved" ? now : context.delivery.approvedAt,
        rejectedAt: action === "rejected" ? now : context.delivery.rejectedAt,
      },
    }),
    db.estimate.update({
      where: { id: context.estimate.id },
      data: {
        status: action,
        viewedAt: context.estimate.viewedAt || now,
        approvedAt: action === "approved" ? now : context.estimate.approvedAt,
        rejectedAt: action === "rejected" ? now : context.estimate.rejectedAt,
      },
    }),
  ]);

  return getPublicProposalContext(token);
}

export async function getProposalContext(estimateId: string) {
  const estimate = await db.estimate.findUnique({
    where: { id: estimateId },
    include: {
      takeoffItems: true,
      proposalDelivery: true,
      project: {
        include: {
          projectMemory: true,
        },
      },
      emails: true,
    },
  });

  if (!estimate) {
    throw new Error("Estimate not found");
  }

  const company = await db.companyMemory.findFirst();

  return {
    estimate: {
      ...estimate,
      proposalData: parseJsonField<ProposalData | null>(estimate.proposalData, null),
    },
    project: estimate.project as ProjectForProposal,
    company,
  };
}
