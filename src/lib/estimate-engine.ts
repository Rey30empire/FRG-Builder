import { db } from "@/lib/db";
import {
  analyzeStoredDocument,
  buildDocumentAnalysisContext,
  type DocumentAnalysis,
  type DocumentAnalysisContext,
  type TakeoffSeed,
} from "@/lib/document-analysis";
import { parseJsonField } from "@/lib/json";
import { resolveRegionalContextLive } from "@/lib/location-intelligence";

type TradeRate = {
  laborRate: number;
  materialRate: number;
  laborHoursPerUnit: number;
  equipmentFactor: number;
  defaultUnit: string;
  crewSize?: number;
};

type RateLibrary = {
  defaultCrewSize: number;
  hoursPerDay: number;
  defaultEquipmentFactor: number;
  trades: Record<string, TradeRate>;
};

type EstimateGenerationContext = {
  userId: string;
  overheadPercent: number;
  profitPercent: number;
  rateLibrary: RateLibrary;
  companyWorkZones: string[];
};

const DEFAULT_RATE_LIBRARY: RateLibrary = {
  defaultCrewSize: 4,
  hoursPerDay: 8,
  defaultEquipmentFactor: 0.05,
  trades: {
    general: {
      laborRate: 62,
      materialRate: 6,
      laborHoursPerUnit: 0.08,
      equipmentFactor: 0.04,
      defaultUnit: "SF",
    },
    concrete: {
      laborRate: 68,
      materialRate: 185,
      laborHoursPerUnit: 1.2,
      equipmentFactor: 0.09,
      defaultUnit: "CY",
    },
    framing: {
      laborRate: 64,
      materialRate: 7.4,
      laborHoursPerUnit: 0.16,
      equipmentFactor: 0.05,
      defaultUnit: "LF",
    },
    drywall: {
      laborRate: 60,
      materialRate: 1.95,
      laborHoursPerUnit: 0.08,
      equipmentFactor: 0.03,
      defaultUnit: "SF",
    },
    electrical: {
      laborRate: 82,
      materialRate: 9.8,
      laborHoursPerUnit: 0.25,
      equipmentFactor: 0.04,
      defaultUnit: "LF",
    },
    plumbing: {
      laborRate: 80,
      materialRate: 12.4,
      laborHoursPerUnit: 0.27,
      equipmentFactor: 0.04,
      defaultUnit: "LF",
    },
    mechanical: {
      laborRate: 84,
      materialRate: 15.5,
      laborHoursPerUnit: 0.24,
      equipmentFactor: 0.05,
      defaultUnit: "LF",
    },
    painting: {
      laborRate: 54,
      materialRate: 0.65,
      laborHoursPerUnit: 0.03,
      equipmentFactor: 0.02,
      defaultUnit: "SF",
    },
    finishes: {
      laborRate: 61,
      materialRate: 8.2,
      laborHoursPerUnit: 0.12,
      equipmentFactor: 0.03,
      defaultUnit: "SF",
    },
  },
};

function normalizeTradeKey(value?: string | null) {
  return value?.toLowerCase().trim().replace(/\s+/g, "-") || "general";
}

function pickTradeRate(rateLibrary: RateLibrary, value?: string | null) {
  const tradeKey = normalizeTradeKey(value).replace(/-/g, "");

  const exactMatch =
    rateLibrary.trades[normalizeTradeKey(value)] ||
    rateLibrary.trades[tradeKey] ||
    Object.entries(rateLibrary.trades).find(([key]) => tradeKey.includes(key.replace(/-/g, "")))?.[1];

  return exactMatch || rateLibrary.trades.general;
}

async function loadEstimateGenerationContext(userId: string): Promise<EstimateGenerationContext> {
  const [user, company] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: { userMemory: true },
    }),
    db.companyMemory.findFirst(),
  ]);

  const laborOverrides = parseJsonField<Record<string, number>>(
    user?.userMemory?.laborRates,
    {}
  );
  const companyRates = parseJsonField<Partial<RateLibrary>>(company?.baseRates, {});
  const mergedTrades = {
    ...DEFAULT_RATE_LIBRARY.trades,
    ...(companyRates.trades || {}),
  } as Record<string, TradeRate>;

  for (const [tradeKey, laborRate] of Object.entries(laborOverrides)) {
    const existing = mergedTrades[tradeKey] || DEFAULT_RATE_LIBRARY.trades.general;
    mergedTrades[tradeKey] = {
      ...existing,
      laborRate,
    };
  }

  return {
    userId,
    overheadPercent: user?.userMemory?.overheadPercent ?? 10,
    profitPercent: user?.userMemory?.preferredMargins ?? 15,
    companyWorkZones: parseJsonField<string[]>(company?.workZones, []),
    rateLibrary: {
      defaultCrewSize: companyRates.defaultCrewSize || DEFAULT_RATE_LIBRARY.defaultCrewSize,
      hoursPerDay: companyRates.hoursPerDay || DEFAULT_RATE_LIBRARY.hoursPerDay,
      defaultEquipmentFactor:
        companyRates.defaultEquipmentFactor || DEFAULT_RATE_LIBRARY.defaultEquipmentFactor,
      trades: mergedTrades,
    },
  };
}

function normalizeTakeoffSeed(seed: TakeoffSeed, fallbackDocumentName: string) {
  return {
    trade: seed.trade || "General",
    description: seed.description || "Scope item",
    quantity: Number(seed.quantity) || 1,
    unit: seed.unit || "EA",
    sourcePage: seed.sourcePage || undefined,
    sourceDocument: seed.sourceDocument || fallbackDocumentName,
    rateKey: seed.rateKey || seed.trade || "general",
  };
}

async function ensureAnalyzedDocuments(projectId: string, context?: DocumentAnalysisContext) {
  const documents = await db.document.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  const analyzedDocuments: typeof documents = [];

  for (const document of documents) {
    if (document.analyzed && document.analysisResult) {
      analyzedDocuments.push(document);
      continue;
    }

    const analyzed = await analyzeStoredDocument(document, context);

    const updated = await db.document.update({
      where: { id: document.id },
      data: {
        analyzed: analyzed.analyzed,
        trade: analyzed.trade,
        category: analyzed.category,
        pageNumber: analyzed.pageNumber,
        relevanceScore: analyzed.relevanceScore,
        selectedForTakeoff: analyzed.selectedForTakeoff,
        selectedForProposalContext: analyzed.selectedForProposalContext,
        requiresHumanReview: analyzed.requiresHumanReview,
        selectionReason: analyzed.selectionReason,
        analysisResult: JSON.stringify(analyzed.analysisResult),
      },
    });

    analyzedDocuments.push(updated);
  }

  return analyzedDocuments;
}

function inferRiskFactor(documentAnalyses: DocumentAnalysis[]) {
  const specCount = documentAnalyses.filter((analysis) => analysis.category === "spec").length;
  const addendaCount = documentAnalyses.filter((analysis) => analysis.category === "addenda").length;
  const lowConfidenceCount = documentAnalyses.filter((analysis) => analysis.confidence < 0.6).length;
  const factor = 1 + specCount * 0.01 + addendaCount * 0.015 + lowConfidenceCount * 0.01;

  return Number(Math.min(factor, 1.12).toFixed(2));
}

export async function generateEstimateForProject(projectId: string, userId?: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      bidOpportunity: true,
      projectMemory: true,
      documents: true,
      estimates: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const effectiveUserId = userId || project.userId;
  const documentContext = buildDocumentAnalysisContext(project);
  const [context, documents] = await Promise.all([
    loadEstimateGenerationContext(effectiveUserId),
    ensureAnalyzedDocuments(projectId, documentContext),
  ]);

  if (documents.length === 0) {
    throw new Error("Upload at least one document before generating an estimate");
  }

  const estimateSourceDocuments =
    documents
      .filter((document) => document.selectedForTakeoff)
      .sort(
        (a, b) =>
          Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ) || [];
  const prioritizedDocuments = estimateSourceDocuments.length > 0 ? estimateSourceDocuments : documents;

  const documentAnalyses = prioritizedDocuments
    .map((document) => parseJsonField<DocumentAnalysis | null>(document.analysisResult, null))
    .filter((analysis): analysis is DocumentAnalysis => Boolean(analysis));

  const takeoffSeeds = prioritizedDocuments.flatMap((document) => {
    const analysis = parseJsonField<DocumentAnalysis | null>(document.analysisResult, null);

    if (analysis?.takeoffItems?.length) {
      return analysis.takeoffItems.map((seed) =>
        normalizeTakeoffSeed(seed, document.originalName || document.name)
      );
    }

    return [
      normalizeTakeoffSeed(
        {
          trade: document.trade || "General",
          description: `${document.trade || "General"} scope allowance`,
          quantity: 1,
          unit: "LS",
          sourceDocument: document.originalName || document.name,
        },
        document.originalName || document.name
      ),
    ];
  });

  const regionalContext = await resolveRegionalContextLive({
    address: project.bidOpportunity?.address || project.address,
    location: project.bidOpportunity?.location,
    latitude: project.bidOpportunity?.latitude,
    longitude: project.bidOpportunity?.longitude,
    dueDate: project.bidOpportunity?.dueDate || project.deadline,
    trades: takeoffSeeds.map((seed) => seed.trade),
    companyWorkZones: context.companyWorkZones,
  });

  const directCosts = takeoffSeeds.map((seed) => {
    const rate = pickTradeRate(context.rateLibrary, seed.rateKey);
    const tradeKey = normalizeTradeKey(seed.trade || seed.rateKey);
    const regionalTrade = regionalContext.tradeAdjustments[tradeKey] || {
      labor: regionalContext.laborIndex,
      material: regionalContext.materialIndex,
      equipment: regionalContext.equipmentIndex,
    };
    const quantity = Number(seed.quantity) || 1;
    const materialCost = Number((quantity * rate.materialRate * regionalTrade.material).toFixed(2));
    const laborHours = quantity * rate.laborHoursPerUnit;
    const laborCost = Number((laborHours * rate.laborRate * regionalTrade.labor).toFixed(2));
    const totalCost = Number((materialCost + laborCost).toFixed(2));

    return {
      trade: seed.trade,
      description: seed.description,
      quantity,
      unit: seed.unit || rate.defaultUnit,
      materialCost,
      laborCost,
      totalCost,
      sourcePage: seed.sourcePage,
      sourceDocument: seed.sourceDocument,
      laborHours,
      equipmentFactor:
        (rate.equipmentFactor ?? context.rateLibrary.defaultEquipmentFactor) *
        regionalTrade.equipment *
        regionalContext.logisticsFactor,
      crewSize: rate.crewSize || context.rateLibrary.defaultCrewSize,
    };
  });

  const materialsCost = Number(
    directCosts.reduce((sum, item) => sum + item.materialCost, 0).toFixed(2)
  );
  const laborCost = Number(directCosts.reduce((sum, item) => sum + item.laborCost, 0).toFixed(2));
  const equipmentCost = Number(
    directCosts
      .reduce((sum, item) => sum + item.totalCost * item.equipmentFactor, 0)
      .toFixed(2)
  );
  const subtotal = Number((materialsCost + laborCost + equipmentCost).toFixed(2));
  const weatherFactor = regionalContext.weatherFactor;
  const marketFactor = regionalContext.marketFactor;
  const riskFactor = Number(
    (inferRiskFactor(documentAnalyses) * regionalContext.scheduleRiskFactor).toFixed(2)
  );
  const adjustedDirectCost = subtotal * weatherFactor * riskFactor;
  const overhead = Number(
    ((adjustedDirectCost * context.overheadPercent) / 100).toFixed(2)
  );
  const profit = Number(((adjustedDirectCost * context.profitPercent) / 100).toFixed(2));
  const total = Number((adjustedDirectCost + overhead + profit).toFixed(2));
  const totalLaborHours = directCosts.reduce((sum, item) => sum + item.laborHours, 0);
  const duration = Math.max(
    5,
    Math.ceil(
      (totalLaborHours * regionalContext.scheduleRiskFactor) /
        (context.rateLibrary.defaultCrewSize * context.rateLibrary.hoursPerDay)
    )
  );
  const version = (project.estimates[0]?.version || 0) + 1;

  const estimate = await db.estimate.create({
    data: {
      projectId,
      name: `${project.name} Estimate v${version}`,
      version,
      status: "draft",
      materialsCost,
      laborCost,
      equipmentCost,
      subtotal,
      overhead,
      profit,
      total,
      duration,
      weatherFactor,
      marketFactor,
      riskFactor,
      regionalContext: JSON.stringify(regionalContext),
      takeoffItems: {
        create: directCosts.map((item) => ({
          trade: item.trade,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          materialCost: item.materialCost,
          laborCost: item.laborCost,
          totalCost: item.totalCost,
          sourcePage: item.sourcePage,
          sourceDocument: item.sourceDocument,
        })),
      },
    },
    include: {
      takeoffItems: true,
      proposalDelivery: true,
    },
  });

  return estimate;
}
