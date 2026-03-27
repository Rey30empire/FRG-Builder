import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import type { ProposalData, ProposalLineItemSummary } from "@/types";
import { parseJsonField } from "@/lib/json";

type ProposalTakeoffItem = {
  trade: string;
  description: string;
  totalCost?: number | null;
};

type ProjectForProposal = {
  id: string;
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
  proposalData?: ProposalData | null;
  takeoffItems: ProposalTakeoffItem[];
};

const PAGE = {
  width: 612,
  height: 792,
  margin: 48,
};

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

export function buildProposalData(project: ProjectForProposal, estimate: EstimateForProposal) {
  const existing = estimate.proposalData || null;
  if (existing) {
    return existing;
  }

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
      ? `${estimate.duration} calendar days from notice to proceed, subject to field access and material lead times.`
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
    scopeSummary: `This proposal is based on ${estimate.takeoffItems.length} scoped line items with pricing assembled from labor, material, equipment, overhead, and profit assumptions.`,
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
    color: rgb(0.96, 0.52, 0.17),
  });

  page.drawText("FRG LLC", {
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
    color: rgb(0.15, 0.15, 0.2),
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
        color: label === "Total" ? rgb(0.96, 0.52, 0.17) : rgb(0.22, 0.25, 0.3),
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

  page.drawText("Prepared by FRG Builder", {
    x: PAGE.margin,
    y: 32,
    font: bodyFont,
    size: 9,
    color: rgb(0.45, 0.48, 0.52),
  });

  return pdf.save();
}

export async function getProposalContext(estimateId: string) {
  const estimate = await db.estimate.findUnique({
    where: { id: estimateId },
    include: {
      takeoffItems: true,
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
