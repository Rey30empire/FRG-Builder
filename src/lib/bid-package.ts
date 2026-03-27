import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { buildProposalData } from "@/lib/proposals";
import { extractUserSenderSettings } from "@/lib/user-workspace";
import type { BidFormData, BidSubmitPackage, ProposalData } from "@/types";

type ProjectMemoryShape = {
  exclusions?: string[] | string | null;
  notes?: string | null;
} | null;

type BidOpportunityContext = {
  id: string;
  userId: string;
  projectId?: string | null;
  name: string;
  client?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  estimatorContact?: string | null;
  dueDate?: Date | null;
  jobWalkDate?: Date | null;
  rfiDueDate?: Date | null;
  projectSize?: string | null;
  location?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scopePackage?: string | null;
  description?: string | null;
  tradeInstructions?: string | null;
  bidFormRequired: boolean;
  bidFormInstructions?: string | null;
  bidFormData?: string | null;
  submitPackage?: string | null;
  source?: string | null;
  externalUrl?: string | null;
  status: string;
  notes?: string | null;
  submittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectContext = {
  id: string;
  userId?: string | null;
  name: string;
  address?: string | null;
  client?: string | null;
  clientEmail?: string | null;
  projectMemory?: ProjectMemoryShape;
  documents?: Array<{
    id: string;
    selectedForTakeoff?: boolean;
    selectedForProposalContext?: boolean;
    requiresHumanReview?: boolean;
  }>;
};

type EstimateContext = {
  id: string;
  version: number;
  total?: number | null;
  duration?: number | null;
  takeoffItems: Array<{
    id?: string;
    trade: string;
    description: string;
    totalCost?: number | null;
  }>;
  proposalData?: ProposalData | null;
  proposalDelivery?: {
    status?: string | null;
    recipientEmail?: string | null;
    sentAt?: Date | null;
  } | null;
};

type UserContext = {
  email: string;
  name?: string | null;
  userMemory?: {
    emailFromName?: string | null;
    emailFromAddress?: string | null;
    emailReplyTo?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpSecure?: boolean | null;
    smtpUser?: string | null;
    smtpPassword?: string | null;
    hasSmtpPassword?: boolean;
  } | null;
};

type CompanyContext = {
  name?: string | null;
} | null;

const PAGE = {
  width: 612,
  height: 792,
  margin: 48,
};

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeLineItems(value: unknown, fallback: BidFormData["lineItems"]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const label = normalizeText(record.label);
      if (!label) return null;

      const amount =
        typeof record.amount === "number"
          ? record.amount
          : typeof record.amount === "string"
            ? Number(record.amount)
            : 0;

      return {
        id: normalizeText(record.id, randomUUID()),
        label,
        amount: Number.isFinite(amount) ? amount : 0,
        notes: normalizeText(record.notes, ""),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return items.length ? items : fallback;
}

function computeBidFormReady(data: Omit<BidFormData, "ready">) {
  return Boolean(
    data.bidderCompany.trim() &&
      data.projectName.trim() &&
      data.lineItems.length &&
      data.lineItems.some((item) => item.amount > 0)
  );
}

export function normalizeBidFormDataInput(
  input: Partial<BidFormData> | null | undefined,
  fallback: BidFormData
): BidFormData {
  const next = {
    bidderCompany: normalizeText(input?.bidderCompany, fallback.bidderCompany),
    bidderContact: normalizeText(input?.bidderContact, fallback.bidderContact || ""),
    bidderEmail: normalizeText(input?.bidderEmail, fallback.bidderEmail || ""),
    bidderPhone: normalizeText(input?.bidderPhone, fallback.bidderPhone || ""),
    projectName: normalizeText(input?.projectName, fallback.projectName),
    projectAddress: normalizeText(input?.projectAddress, fallback.projectAddress || ""),
    scopePackage: normalizeText(input?.scopePackage, fallback.scopePackage || ""),
    instructions: normalizeText(input?.instructions, fallback.instructions || ""),
    lineItems: normalizeLineItems(input?.lineItems, fallback.lineItems),
    alternates: normalizeStringArray(input?.alternates, fallback.alternates),
    inclusions: normalizeStringArray(input?.inclusions, fallback.inclusions),
    exclusions: normalizeStringArray(input?.exclusions, fallback.exclusions),
    attachments: normalizeStringArray(input?.attachments, fallback.attachments),
    notes: normalizeText(input?.notes, fallback.notes || ""),
    lastAutoFilledAt: normalizeText(input?.lastAutoFilledAt, fallback.lastAutoFilledAt || ""),
  };

  return {
    ...next,
    ready: computeBidFormReady(next),
  };
}

function buildDefaultLineItems(
  opportunity: BidOpportunityContext,
  estimate?: EstimateContext | null
): BidFormData["lineItems"] {
  if (estimate?.total && estimate.total > 0) {
    return [
      {
        id: "base-bid",
        label: opportunity.scopePackage || "Base bid",
        amount: estimate.total,
        notes: opportunity.bidFormInstructions || opportunity.tradeInstructions || "",
      },
    ];
  }

  return [
    {
      id: "base-bid",
      label: opportunity.scopePackage || "Base bid",
      amount: 0,
      notes: opportunity.bidFormInstructions || opportunity.tradeInstructions || "",
    },
  ];
}

export function buildBidFormData(input: {
  opportunity: BidOpportunityContext;
  project?: ProjectContext | null;
  estimate?: EstimateContext | null;
  user: UserContext;
  company?: CompanyContext;
}) {
  const sender = extractUserSenderSettings(input.user);
  const project = input.project;
  const estimate = input.estimate;
  const proposalData =
    project && estimate ? buildProposalData(project, estimate as never) : null;
  const bidderCompany =
    input.company?.name || sender.fromName || input.user.name || "FRG LLC";
  const bidderContact = input.user.name || sender.fromName || "Estimating Team";
  const bidderEmail = sender.fromAddress || input.user.email;
  const bidderPhone = input.opportunity.clientPhone || "";
  const attachments = [
    "Proposal PDF",
    estimate?.takeoffItems?.length ? "Estimate Breakdown Summary" : "",
    input.opportunity.bidFormRequired ? "Client Bid Form" : "",
    (project?.documents || []).some((document) => document.selectedForProposalContext)
      ? "Supporting plan references"
      : "",
  ].filter(Boolean);

  const draft = {
    bidderCompany,
    bidderContact,
    bidderEmail,
    bidderPhone,
    projectName: project?.name || input.opportunity.name,
    projectAddress: project?.address || input.opportunity.address || "",
    scopePackage: input.opportunity.scopePackage || "",
    instructions:
      input.opportunity.bidFormInstructions ||
      input.opportunity.tradeInstructions ||
      proposalData?.scopeSummary ||
      "",
    lineItems: buildDefaultLineItems(input.opportunity, estimate),
    alternates: [],
    inclusions: proposalData?.inclusions || [],
    exclusions: proposalData?.exclusions || [],
    attachments,
    notes: input.opportunity.notes || proposalData?.coverNote || "",
    lastAutoFilledAt: new Date().toISOString(),
  };

  return {
    ...draft,
    ready: computeBidFormReady(draft),
  } satisfies BidFormData;
}

export function buildBidSubmitPackage(input: {
  opportunity: BidOpportunityContext;
  project?: ProjectContext | null;
  estimate?: EstimateContext | null;
  bidFormData: BidFormData;
  proposalData?: ProposalData | null;
  baseUrl?: string;
  notes?: string;
  submitMethod?: BidSubmitPackage["submitMethod"];
  submitTo?: string;
}) {
  const proposalPdfUrl =
    input.baseUrl && input.estimate
      ? `${input.baseUrl.replace(/\/+$/, "")}/api/proposals/pdf?estimateId=${encodeURIComponent(input.estimate.id)}`
      : input.estimate
        ? `/api/proposals/pdf?estimateId=${encodeURIComponent(input.estimate.id)}`
        : undefined;

  const bidFormPdfUrl =
    input.baseUrl
      ? `${input.baseUrl.replace(/\/+$/, "")}/api/opportunities/bid-form/pdf?opportunityId=${encodeURIComponent(input.opportunity.id)}${input.estimate ? `&estimateId=${encodeURIComponent(input.estimate.id)}` : ""}`
      : `/api/opportunities/bid-form/pdf?opportunityId=${encodeURIComponent(input.opportunity.id)}${input.estimate ? `&estimateId=${encodeURIComponent(input.estimate.id)}` : ""}`;

  const supportingDocuments = (input.project?.documents || []).filter(
    (document) => document.selectedForProposalContext || document.selectedForTakeoff
  );
  const destination =
    input.submitTo ||
    input.opportunity.externalUrl ||
    input.proposalData?.recipientEmail ||
    input.opportunity.clientEmail ||
    input.project?.clientEmail ||
    undefined;
  const submitMethod =
    input.submitMethod ||
    (input.opportunity.externalUrl ? "portal" : destination ? "email" : "manual");

  const checklist = [
    {
      key: "project",
      label: "Project linked from the bid board",
      done: Boolean(input.project?.id),
      detail: input.project?.name || "Convert the opportunity into a project first.",
    },
    {
      key: "estimate",
      label: "Estimate version available",
      done: Boolean(input.estimate?.id && (input.estimate.total || 0) > 0),
      detail: input.estimate
        ? `v${input.estimate.version} • ${formatCurrency(input.estimate.total)}`
        : "Generate or select an estimate before preparing the package.",
    },
    {
      key: "proposal",
      label: "Proposal narrative saved",
      done: Boolean(input.proposalData?.intro && input.proposalData.scopeSummary),
      detail: input.proposalData?.title || "Save the proposal narrative first.",
    },
    {
      key: "delivery-path",
      label: "Destination path available",
      done: Boolean(destination),
      detail: destination || "Add client email or portal URL for submission.",
    },
    {
      key: "bid-form",
      label: input.opportunity.bidFormRequired ? "Bid form completed" : "Bid form optional",
      done: input.opportunity.bidFormRequired ? input.bidFormData.ready : true,
      detail: input.opportunity.bidFormRequired
        ? input.bidFormData.ready
          ? `${input.bidFormData.lineItems.length} line item(s) ready`
          : "Fill the bid form line items and bidder details."
        : "This opportunity can be submitted with the proposal package only.",
    },
    {
      key: "supporting-docs",
      label: "Supporting documents selected",
      done: supportingDocuments.length > 0,
      detail: supportingDocuments.length
        ? `${supportingDocuments.length} supporting document(s) selected`
        : "Mark at least one proposal or takeoff document for context.",
    },
  ];

  const readyForSubmit = checklist.every((item) => item.done);
  const packageItems = [
    "Proposal PDF",
    input.opportunity.bidFormRequired ? "Bid Form PDF" : "",
    supportingDocuments.length ? `${supportingDocuments.length} supporting document(s)` : "",
  ].filter(Boolean);
  const status =
    input.opportunity.status === "won"
      ? "won"
      : input.opportunity.status === "submitted"
        ? "submitted"
        : readyForSubmit
          ? "ready"
          : "review";

  return {
    status,
    submitMethod,
    submitTo: destination,
    packageSummary: readyForSubmit
      ? `Package ready for ${submitMethod} submission with ${packageItems.join(", ")}.`
      : `Package still needs review before submission. ${checklist.filter((item) => !item.done).length} checklist item(s) remain open.`,
    checklist,
    proposalPdfUrl,
    bidFormPdfUrl,
    publicPdfUrl: undefined,
    packageItems,
    readyForSubmit,
    notes: input.notes || "",
    preparedAt: new Date().toISOString(),
    submittedAt: input.opportunity.submittedAt?.toISOString(),
  } satisfies BidSubmitPackage;
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

function drawParagraph(page: PDFPage, text: string, y: number, font: PDFFont, size = 10) {
  const lines = wrapText(text, font, size, PAGE.width - PAGE.margin * 2);
  let nextY = y;

  for (const line of lines) {
    page.drawText(line, {
      x: PAGE.margin,
      y: nextY,
      font,
      size,
      color: rgb(0.21, 0.24, 0.3),
    });
    nextY -= size + 4;
  }

  return nextY;
}

function drawSectionTitle(page: PDFPage, text: string, y: number, font: PDFFont) {
  page.drawText(text, {
    x: PAGE.margin,
    y,
    font,
    size: 12,
    color: rgb(0.1, 0.12, 0.18),
  });
}

export async function generateBidFormPdfBytes(input: {
  opportunity: BidOpportunityContext;
  bidFormData: BidFormData;
  estimate?: EstimateContext | null;
  project?: ProjectContext | null;
  company?: CompanyContext;
}) {
  const pdf = await PDFDocument.create();
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let cursorY = PAGE.height - PAGE.margin;

  page.drawRectangle({
    x: 0,
    y: PAGE.height - 92,
    width: PAGE.width,
    height: 92,
    color: rgb(0.11, 0.17, 0.27),
  });

  page.drawText(input.company?.name || input.bidFormData.bidderCompany || "FRG LLC", {
    x: PAGE.margin,
    y: PAGE.height - 42,
    font: titleFont,
    size: 22,
    color: rgb(1, 1, 1),
  });
  page.drawText("Bid Form Package", {
    x: PAGE.margin,
    y: PAGE.height - 66,
    font: bodyFont,
    size: 11,
    color: rgb(0.9, 0.93, 0.97),
  });

  cursorY = PAGE.height - 126;
  const metaRows = [
    `Opportunity: ${input.opportunity.name}`,
    `Project: ${input.bidFormData.projectName}`,
    `Scope: ${input.bidFormData.scopePackage || input.opportunity.scopePackage || "Base bid"}`,
    `Bidder: ${input.bidFormData.bidderCompany}`,
    `Contact: ${input.bidFormData.bidderContact || "Estimating Team"} • ${input.bidFormData.bidderEmail || ""}`,
    `Destination: ${input.opportunity.externalUrl || input.opportunity.clientEmail || "Manual submit"}`,
  ];

  for (const row of metaRows) {
    page.drawText(row, {
      x: PAGE.margin,
      y: cursorY,
      font: bodyFont,
      size: 10,
      color: rgb(0.16, 0.18, 0.24),
    });
    cursorY -= 16;
  }

  cursorY -= 8;
  drawSectionTitle(page, "Line Items", cursorY, titleFont);
  cursorY -= 22;

  for (const item of input.bidFormData.lineItems) {
    page.drawText(item.label, {
      x: PAGE.margin,
      y: cursorY,
      font: bodyFont,
      size: 10,
      color: rgb(0.16, 0.18, 0.24),
    });
    page.drawText(formatCurrency(item.amount), {
      x: PAGE.width - PAGE.margin - 120,
      y: cursorY,
      font: titleFont,
      size: 10,
      color: rgb(0.84, 0.42, 0.14),
    });
    cursorY -= 16;

    if (item.notes) {
      cursorY = drawParagraph(page, item.notes, cursorY, bodyFont, 9);
      cursorY -= 6;
    }
  }

  cursorY -= 8;
  drawSectionTitle(page, "Instructions", cursorY, titleFont);
  cursorY -= 18;
  cursorY = drawParagraph(
    page,
    input.bidFormData.instructions || "No special bid form instructions were captured.",
    cursorY,
    bodyFont
  );

  page = pdf.addPage([PAGE.width, PAGE.height]);
  cursorY = PAGE.height - PAGE.margin;

  drawSectionTitle(page, "Inclusions", cursorY, titleFont);
  cursorY -= 20;
  for (const item of input.bidFormData.inclusions) {
    cursorY = drawParagraph(page, `• ${item}`, cursorY, bodyFont, 10);
    cursorY -= 4;
  }

  cursorY -= 10;
  drawSectionTitle(page, "Exclusions", cursorY, titleFont);
  cursorY -= 20;
  for (const item of input.bidFormData.exclusions) {
    cursorY = drawParagraph(page, `• ${item}`, cursorY, bodyFont, 10);
    cursorY -= 4;
  }

  if (input.bidFormData.alternates.length) {
    cursorY -= 10;
    drawSectionTitle(page, "Alternates", cursorY, titleFont);
    cursorY -= 20;
    for (const item of input.bidFormData.alternates) {
      cursorY = drawParagraph(page, `• ${item}`, cursorY, bodyFont, 10);
      cursorY -= 4;
    }
  }

  cursorY -= 10;
  drawSectionTitle(page, "Attachments", cursorY, titleFont);
  cursorY -= 20;
  for (const item of input.bidFormData.attachments) {
    cursorY = drawParagraph(page, `• ${item}`, cursorY, bodyFont, 10);
    cursorY -= 4;
  }

  if (input.bidFormData.notes) {
    cursorY -= 10;
    drawSectionTitle(page, "Notes", cursorY, titleFont);
    cursorY -= 20;
    cursorY = drawParagraph(page, input.bidFormData.notes, cursorY, bodyFont, 10);
  }

  page.drawText(
    input.estimate
      ? `Estimate v${input.estimate.version} • Total ${formatCurrency(input.estimate.total)}`
      : "Estimate not linked yet",
    {
      x: PAGE.margin,
      y: 32,
      font: bodyFont,
      size: 9,
      color: rgb(0.46, 0.49, 0.54),
    }
  );

  return pdf.save();
}

export async function getBidPackageContext(opportunityId: string, estimateId?: string | null) {
  const opportunity = await db.bidOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      user: {
        select: {
          email: true,
          name: true,
          userMemory: {
            select: {
              emailFromName: true,
              emailFromAddress: true,
              emailReplyTo: true,
              smtpHost: true,
              smtpPort: true,
              smtpSecure: true,
              smtpUser: true,
              smtpPassword: true,
            },
          },
        },
      },
      project: {
        include: {
          documents: true,
          projectMemory: true,
          estimates: {
            include: {
              takeoffItems: true,
              proposalDelivery: true,
            },
            orderBy: {
              version: "desc",
            },
          },
        },
      },
    },
  });

  if (!opportunity) {
    return null;
  }

  const company = await db.companyMemory.findFirst({
    select: {
      name: true,
    },
  });

  const estimate =
    estimateId && opportunity.project
      ? opportunity.project.estimates.find((item) => item.id === estimateId) || null
      : opportunity.project?.estimates[0] || null;

  const normalizedEstimate = estimate
    ? ({
        ...estimate,
        proposalData: parseJsonField<ProposalData | null>(estimate.proposalData, null),
      } satisfies EstimateContext)
    : null;

  const proposalData =
    opportunity.project && normalizedEstimate
      ? buildProposalData(opportunity.project, {
          ...normalizedEstimate,
        } as never)
      : null;

  const savedBidFormData = parseJsonField<BidFormData | null>(opportunity.bidFormData, null);
  const defaultBidFormData = buildBidFormData({
    opportunity,
    project: opportunity.project,
    estimate: normalizedEstimate,
    user: opportunity.user,
    company,
  });
  const bidFormData = normalizeBidFormDataInput(savedBidFormData, defaultBidFormData);
  const savedSubmitPackage = parseJsonField<BidSubmitPackage | null>(opportunity.submitPackage, null);

  return {
    opportunity,
    project: opportunity.project,
    estimate: normalizedEstimate,
    proposalData,
    company,
    bidFormData,
    submitPackage:
      savedSubmitPackage ||
      buildBidSubmitPackage({
        opportunity,
        project: opportunity.project,
        estimate: normalizedEstimate,
        bidFormData,
        proposalData,
      }),
  };
}

export async function persistBidPackageState(input: {
  opportunityId: string;
  bidFormData?: BidFormData | null;
  submitPackage?: BidSubmitPackage | null;
  status?: "submitted" | "won";
}) {
  const data = {
    ...(input.bidFormData ? { bidFormData: stringifyJson(input.bidFormData) } : {}),
    ...(input.submitPackage ? { submitPackage: stringifyJson(input.submitPackage) } : {}),
    ...(input.status ? { status: input.status, submittedAt: new Date() } : {}),
  };

  return db.bidOpportunity.update({
    where: { id: input.opportunityId },
    data,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          client: true,
          updatedAt: true,
          _count: {
            select: {
              documents: true,
              estimates: true,
            },
          },
        },
      },
    },
  });
}
