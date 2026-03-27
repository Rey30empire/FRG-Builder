import { access, readFile } from "fs/promises";
import path from "path";
import { constants } from "fs";
import type { Document as PrismaDocument } from "@prisma/client";
import { parseJsonField } from "@/lib/json";

export interface QuantitySignal {
  label: string;
  quantity: number;
  unit: string;
  sourceText: string;
}

export interface TakeoffSeed {
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  sourcePage?: string;
  sourceDocument?: string;
  rateKey?: string;
}

export interface DocumentAnalysis {
  source: "pdf-text" | "metadata";
  confidence: number;
  trade: string;
  category: string;
  summary: string;
  pageCount: number;
  extractedTextLength: number;
  keywords: string[];
  detectedSheets: string[];
  quantitySignals: QuantitySignal[];
  takeoffItems: TakeoffSeed[];
  textPreview: string;
}

type TradeProfile = {
  trade: string;
  rateKey: string;
  keywords: string[];
  fallbackItems: Array<{
    description: string;
    quantity: number;
    unit: string;
  }>;
};

const TRADE_PROFILES: TradeProfile[] = [
  {
    trade: "Concrete",
    rateKey: "concrete",
    keywords: ["concrete", "rebar", "slab", "footing", "foundation", "cmu"],
    fallbackItems: [
      { description: "Concrete placement", quantity: 24, unit: "CY" },
      { description: "Rebar installation", quantity: 1200, unit: "LF" },
    ],
  },
  {
    trade: "Framing",
    rateKey: "framing",
    keywords: ["stud", "framing", "joist", "track", "partition", "wood", "metal stud"],
    fallbackItems: [
      { description: "Wall framing", quantity: 1800, unit: "LF" },
      { description: "Ceiling framing", quantity: 3200, unit: "SF" },
    ],
  },
  {
    trade: "Drywall",
    rateKey: "drywall",
    keywords: ["drywall", "gyp", "sheetrock", "type x", "tape", "texture"],
    fallbackItems: [
      { description: "Drywall hanging", quantity: 6400, unit: "SF" },
      { description: "Tape and texture", quantity: 6400, unit: "SF" },
    ],
  },
  {
    trade: "Electrical",
    rateKey: "electrical",
    keywords: ["electrical", "lighting", "panel", "conduit", "wire", "switch", "receptacle"],
    fallbackItems: [
      { description: "Branch circuit rough-in", quantity: 1400, unit: "LF" },
      { description: "Devices and fixtures", quantity: 48, unit: "EA" },
    ],
  },
  {
    trade: "Plumbing",
    rateKey: "plumbing",
    keywords: ["plumbing", "pipe", "fixture", "drain", "vent", "water heater"],
    fallbackItems: [
      { description: "Water and waste piping", quantity: 860, unit: "LF" },
      { description: "Plumbing fixtures", quantity: 18, unit: "EA" },
    ],
  },
  {
    trade: "Mechanical",
    rateKey: "mechanical",
    keywords: ["hvac", "mechanical", "duct", "diffuser", "rtu", "cfm"],
    fallbackItems: [
      { description: "Ductwork installation", quantity: 940, unit: "LF" },
      { description: "Air devices and equipment", quantity: 16, unit: "EA" },
    ],
  },
  {
    trade: "Painting",
    rateKey: "painting",
    keywords: ["paint", "painting", "primer", "finish coat", "coating"],
    fallbackItems: [
      { description: "Interior painting", quantity: 7200, unit: "SF" },
    ],
  },
  {
    trade: "Finishes",
    rateKey: "finishes",
    keywords: ["tile", "flooring", "finish", "wallcovering", "cabinet", "millwork"],
    fallbackItems: [
      { description: "Finish installation", quantity: 4200, unit: "SF" },
      { description: "Millwork and specialties", quantity: 24, unit: "EA" },
    ],
  },
  {
    trade: "General",
    rateKey: "general",
    keywords: ["general", "renovation", "scope", "demo", "construction"],
    fallbackItems: [
      { description: "General conditions and supervision", quantity: 1, unit: "LS" },
      { description: "Selective demolition", quantity: 2800, unit: "SF" },
    ],
  },
];

const CATEGORY_KEYWORDS = [
  { category: "plan", keywords: ["plan", "drawing", "sheet", "layout", "detail"] },
  { category: "spec", keywords: ["specification", "spec", "section", "submittal", "finish schedule"] },
  { category: "addenda", keywords: ["addendum", "addenda", "bulletin", "revision"] },
  { category: "contract", keywords: ["contract", "agreement", "scope of work", "terms"] },
];

const KEYWORD_LIMIT = 8;
const QUANTITY_SIGNAL_LIMIT = 6;
const TAKEOFF_ITEM_LIMIT = 6;
const PAGE_SCAN_LIMIT = 20;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeUnit(rawUnit: string) {
  const unit = rawUnit.toLowerCase().replace(/\./g, "");
  if (["sf", "sq ft", "sqft", "square feet"].includes(unit)) return "SF";
  if (["lf", "lin ft", "linear feet", "linear foot"].includes(unit)) return "LF";
  if (["cy", "cubic yard", "cubic yards", "yd3"].includes(unit)) return "CY";
  if (["ea", "each", "fixture", "fixtures"].includes(unit)) return "EA";
  if (["ls", "lump sum"].includes(unit)) return "LS";
  if (["ton", "tons"].includes(unit)) return "TON";
  if (["gal", "gallon", "gallons"].includes(unit)) return "GAL";
  return rawUnit.toUpperCase();
}

function extractKeywords(text: string) {
  const words = normalizeText(text)
    .split(/[^a-z0-9#.-]+/)
    .filter((word) => word.length >= 4 && !/^\d+$/.test(word));

  const counts = new Map<string, number>();

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, KEYWORD_LIMIT)
    .map(([word]) => word);
}

function extractSheetNumbers(text: string) {
  const matches = text.match(/\b[A-Z]{1,3}[-.]?\d{1,2}(?:\.\d+)?\b/g) || [];
  return [...new Set(matches)].slice(0, 10);
}

function extractQuantitySignals(text: string) {
  const pattern =
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(sf|sq ft|sqft|lf|lin ft|cy|ea|each|ls|lump sum|ton|tons|gal|gallons?)\b/gi;
  const signals: QuantitySignal[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const rawValue = match[1];
    const rawUnit = match[2];
    const quantity = Number(rawValue.replace(/,/g, ""));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const start = Math.max(0, (match.index || 0) - 40);
    const end = Math.min(text.length, (match.index || 0) + match[0].length + 40);
    const context = text.slice(start, end).replace(/\s+/g, " ").trim();
    const unit = normalizeUnit(rawUnit);
    const key = `${quantity}-${unit}-${context.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    signals.push({
      label: titleCase(context.replace(match[0], "").trim() || `Detected ${unit} quantity`),
      quantity,
      unit,
      sourceText: context,
    });

    if (signals.length >= QUANTITY_SIGNAL_LIMIT) {
      break;
    }
  }

  return signals;
}

function scoreTrade(text: string) {
  const normalized = normalizeText(text);
  let best = TRADE_PROFILES[TRADE_PROFILES.length - 1];
  let bestScore = 0;

  for (const profile of TRADE_PROFILES) {
    let score = 0;

    for (const keyword of profile.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.includes(" ") ? 3 : 2;
      }
    }

    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }

  return {
    profile: best,
    score: bestScore,
  };
}

function scoreCategory(text: string) {
  const normalized = normalizeText(text);
  let bestCategory = "plan";
  let bestScore = 0;

  for (const option of CATEGORY_KEYWORDS) {
    let score = 0;

    for (const keyword of option.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.includes(" ") ? 3 : 2;
      }
    }

    if (score > bestScore) {
      bestCategory = option.category;
      bestScore = score;
    }
  }

  return {
    category: bestCategory,
    score: bestScore,
  };
}

function buildTakeoffItems({
  analysisTrade,
  quantitySignals,
  sheets,
  fileName,
}: {
  analysisTrade: TradeProfile;
  quantitySignals: QuantitySignal[];
  sheets: string[];
  fileName: string;
}) {
  if (quantitySignals.length > 0) {
    return quantitySignals.slice(0, TAKEOFF_ITEM_LIMIT).map((signal, index) => ({
      trade: analysisTrade.trade,
      description:
        signal.label && signal.label.length > 2
          ? signal.label
          : `${analysisTrade.trade} scope item ${index + 1}`,
      quantity: signal.quantity,
      unit: signal.unit,
      sourcePage: sheets[index] || sheets[0],
      sourceDocument: fileName,
      rateKey: analysisTrade.rateKey,
    }));
  }

  return analysisTrade.fallbackItems.map((item, index) => ({
    trade: analysisTrade.trade,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    sourcePage: sheets[index] || sheets[0],
    sourceDocument: fileName,
    rateKey: analysisTrade.rateKey,
  }));
}

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function extractPdfTextFromFile(filePath: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  const pdf = await getDocument({ data }).promise;
  const textChunks: string[] = [];

  try {
    const pageCount = pdf.numPages;
    const maxPages = Math.min(pageCount, PAGE_SCAN_LIMIT);

    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (pageText) {
        textChunks.push(pageText);
      }
    }

    return {
      pageCount,
      text: textChunks.join("\n"),
    };
  } finally {
    await pdf.destroy();
  }
}

function resolvePublicPath(filePath: string) {
  if (!filePath) return null;

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", normalized);
}

export async function analyzeStoredDocument(
  document: Pick<
    PrismaDocument,
    "id" | "name" | "originalName" | "type" | "path" | "trade" | "category" | "analysisResult"
  >
) {
  const fileName = document.originalName || document.name;
  const absolutePath = resolvePublicPath(document.path);
  const existingAnalysis = parseJsonField<DocumentAnalysis | null>(document.analysisResult, null);

  let pageCount = existingAnalysis?.pageCount || 0;
  let extractedText = "";
  let source: DocumentAnalysis["source"] = "metadata";

  if (document.type.includes("pdf") && absolutePath && (await fileExists(absolutePath))) {
    try {
      const extracted = await extractPdfTextFromFile(absolutePath);
      pageCount = extracted.pageCount;
      extractedText = extracted.text;
      source = extracted.text ? "pdf-text" : "metadata";
    } catch (error) {
      console.warn(`PDF extraction failed for ${fileName}:`, error);
    }
  }

  const sourceText = [fileName, document.trade, document.category, extractedText]
    .filter(Boolean)
    .join(" ");

  const { profile, score: tradeScore } = scoreTrade(sourceText);
  const { category, score: categoryScore } = scoreCategory(sourceText);
  const detectedTrade = document.trade || profile.trade;
  const detectedCategory = document.category || category;
  const keywords = extractKeywords(sourceText);
  const detectedSheets = extractSheetNumbers(sourceText);
  const quantitySignals = extractQuantitySignals(extractedText || sourceText);
  const takeoffItems = buildTakeoffItems({
    analysisTrade: { ...profile, trade: detectedTrade },
    quantitySignals,
    sheets: detectedSheets,
    fileName,
  });
  const confidence = Math.min(0.98, 0.45 + (tradeScore + categoryScore) * 0.04);

  const summary = [
    `${fileName} classified as ${detectedTrade} ${detectedCategory}.`,
    pageCount ? `${pageCount} pages reviewed.` : "Metadata-only review.",
    quantitySignals.length
      ? `${quantitySignals.length} measurable quantity signals detected.`
      : "Fallback takeoff assumptions prepared from document keywords.",
  ].join(" ");

  const analysis: DocumentAnalysis = {
    source,
    confidence: Number(confidence.toFixed(2)),
    trade: detectedTrade,
    category: detectedCategory,
    summary,
    pageCount,
    extractedTextLength: extractedText.length,
    keywords,
    detectedSheets,
    quantitySignals,
    takeoffItems,
    textPreview: extractedText.slice(0, 500),
  };

  return {
    trade: detectedTrade,
    category: detectedCategory,
    pageNumber: pageCount || null,
    analyzed: true,
    analysisResult: analysis,
  };
}
