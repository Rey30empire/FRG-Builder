import { analyzeStoredDocument, buildDocumentAnalysisContext } from "@/lib/document-analysis";
import { createAgentRun, finalizeAgentRun, recordAgentRunStep } from "@/lib/agent-runs";
import { AGENT_PIPELINE_CATALOG, DEFAULT_AGENT_WORKSPACE_CONFIG } from "@/lib/agent-catalog";
import { buildBidFormData, buildBidSubmitPackage, persistBidPackageState } from "@/lib/bid-package";
import {
  CUSTOM_AGENT_PIPELINE_STAGE_LABELS,
  loadUserCustomAgents,
} from "@/lib/custom-agents";
import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { loadAiSettings, loadAiSettingsResponse, resolveActiveProvider } from "@/lib/ai-settings";
import { loadAiCredentialSummaries, resolveProviderApiKey } from "@/lib/ai-credentials";
import { generateEstimateForProject } from "@/lib/estimate-engine";
import { generateMarketingContent } from "@/lib/marketing";
import { buildProposalData } from "@/lib/proposals";
import type {
  AgentPipelineAgentKey,
  AgentSafeAction,
  AiProviderName,
  AiProviderSettingsResponse,
  BidFormData,
  CustomAgent,
  CustomAgentPipelineStage,
  SkillName,
  ToolName,
  UserAgentWorkspaceConfig,
} from "@/types";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type ProjectContext = Awaited<ReturnType<typeof getProjectContext>>;

type SafeActionResult = {
  content: string;
  tool: ToolName;
  skill: SkillName;
  runId?: string;
};

type ProviderTextResponse = {
  provider: AiProviderName;
  model: string;
  content: string;
};

function compactText(value?: string | null, maxLength = 320) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

export async function getProjectContext(projectId?: string | null) {
  if (!projectId) {
    return null;
  }

  return db.project.findUnique({
    where: { id: projectId },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
      },
      bidOpportunity: true,
      projectMemory: true,
      estimates: {
        include: {
          takeoffItems: true,
          proposalDelivery: true,
          emails: true,
        },
        orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      },
      emails: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

function buildDocumentSummary(context: ProjectContext) {
  if (!context?.documents.length) {
    return "No hay documentos cargados para este proyecto.";
  }

  return context.documents
    .slice(0, 5)
    .map((document) => {
      const analysis = (() => {
        if (!document.analysisResult) return "Sin analisis todavia.";

        try {
          const parsed = JSON.parse(document.analysisResult) as Record<string, unknown>;
          return compactText(
            typeof parsed.summary === "string"
              ? parsed.summary
              : typeof parsed.textPreview === "string"
                ? parsed.textPreview
                : JSON.stringify(parsed)
          );
        } catch {
          return compactText(document.analysisResult);
        }
      })();

      return `- ${document.originalName} (${document.category || "uncategorized"} / ${document.trade || "general"}): ${analysis}`;
    })
    .join("\n");
}

function buildEstimateSnapshot(context: ProjectContext) {
  const latestEstimate = context?.estimates[0];

  if (!latestEstimate) {
    return "No hay estimados creados todavia.";
  }

  const tradeBreakdown = latestEstimate.takeoffItems
    .slice(0, 6)
    .map(
      (item) =>
        `- ${item.trade}: ${item.description} | ${item.quantity} ${item.unit} | total ${item.totalCost ?? 0}`
    )
    .join("\n");

  return [
    `Ultimo estimate: ${latestEstimate.name} v${latestEstimate.version} (${latestEstimate.status})`,
    `Total: ${latestEstimate.total ?? 0} | Subtotal: ${latestEstimate.subtotal ?? 0} | Labor: ${latestEstimate.laborCost ?? 0} | Materials: ${latestEstimate.materialsCost ?? 0}`,
    `Market: ${latestEstimate.marketFactor ?? 1} | Weather: ${latestEstimate.weatherFactor ?? 1} | Risk: ${latestEstimate.riskFactor ?? 1}`,
    tradeBreakdown || "Sin takeoff items todavia.",
    latestEstimate.proposalDelivery
      ? `Proposal: ${latestEstimate.proposalDelivery.status} para ${latestEstimate.proposalDelivery.recipientEmail || "sin email"}`
      : "Proposal todavia no preparada.",
  ].join("\n");
}

export function buildProjectContextPrompt(context: ProjectContext) {
  if (!context) {
    return "No hay proyecto activo. Responde en modo general y pide seleccionar un proyecto si hace falta contexto.";
  }

  return [
    `Proyecto activo: ${context.name}`,
    `Cliente: ${context.client || "sin cliente"} | Email: ${context.clientEmail || "sin email"} | Estado: ${context.status}`,
    `Address: ${context.address || "sin direccion"} | Deadline: ${context.deadline ? new Date(context.deadline).toLocaleDateString("en-US") : "sin deadline"}`,
    "",
    "Resumen de documentos:",
    buildDocumentSummary(context),
    "",
    "Resumen de estimate/takeoff:",
    buildEstimateSnapshot(context),
  ].join("\n");
}

function buildCustomAgentProjectContext(agent: CustomAgent, context: ProjectContext) {
  if (!context || !agent.includeProjectContext) {
    return "No hay proyecto activo o este agente fue configurado para trabajar sin contexto de proyecto.";
  }

  const sections = [
    `Proyecto activo: ${context.name}`,
    `Cliente: ${context.client || "sin cliente"} | Estado: ${context.status} | Direccion: ${context.address || "sin direccion"}`,
  ];

  if (context.bidOpportunity) {
    sections.push(
      `Bid intake: ${context.bidOpportunity.scopePackage || "scope general"} | Due date: ${
        context.bidOpportunity.dueDate
          ? new Date(context.bidOpportunity.dueDate).toLocaleDateString("en-US")
          : "sin fecha"
      } | Fuente: ${context.bidOpportunity.source || "manual"}`
    );
    if (context.bidOpportunity.description) {
      sections.push(`Descripcion del bid: ${compactText(context.bidOpportunity.description, 480)}`);
    }
  }

  if (agent.includeDocumentSummary) {
    sections.push("Resumen de documentos:");
    sections.push(buildDocumentSummary(context));
  }

  if (agent.includeEstimateSnapshot) {
    sections.push("Resumen de estimate/takeoff:");
    sections.push(buildEstimateSnapshot(context));
  }

  return sections.join("\n");
}

function buildCustomAgentInstructions(input: {
  agent: CustomAgent;
  context: ProjectContext;
  providerStatus: AiProviderSettingsResponse;
  purpose: string;
}) {
  const providerLine = input.providerStatus.active
    ? `Proveedor activo: ${input.providerStatus.providers[input.providerStatus.active].label}`
    : "Proveedor activo: none";

  return [
    `Eres el agente personalizado "${input.agent.name}".`,
    input.agent.description ? `Descripcion: ${input.agent.description}` : "",
    `Skill base: ${input.agent.baseSkill}.`,
    `Objetivo operativo: ${input.purpose}`,
    `Instrucciones del creador:\n${input.agent.instructions}`,
    input.agent.successCriteria ? `Criterios de exito:\n${input.agent.successCriteria}` : "",
    input.agent.outputSchema ? `Formato esperado de salida:\n${input.agent.outputSchema}` : "",
    `Tools permitidas: ${
      input.agent.allowedTools.length ? input.agent.allowedTools.join(", ") : "ninguna"
    }.`,
    `Review requerida antes de enviar: ${input.agent.reviewRequired ? "si" : "no"}.`,
    providerLine,
    buildCustomAgentProjectContext(input.agent, input.context),
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function persistCustomAgentMemory(input: {
  agent: CustomAgent;
  context: NonNullable<ProjectContext> | null;
  content: string;
}) {
  if (!input.context || !input.agent.allowedTools.includes("save_memory")) {
    return;
  }

  const note = [
    `[${new Date().toISOString()}] ${input.agent.name} (${input.agent.slug})`,
    compactText(input.content, 1200),
  ].join("\n");

  const currentMemory = await db.projectMemory.findUnique({
    where: { projectId: input.context.id },
  });
  const nextNotes = currentMemory?.notes
    ? `${currentMemory.notes}\n\n${note}`
    : note;

  await db.projectMemory.upsert({
    where: { projectId: input.context.id },
    update: {
      notes: nextNotes,
    },
    create: {
      projectId: input.context.id,
      notes: nextNotes,
    },
  });
}

async function createEstimateDraft(context: NonNullable<ProjectContext>) {
  const latestEstimate = context.estimates[0];
  const nextVersion = latestEstimate ? latestEstimate.version + 1 : 1;
  const estimateName = latestEstimate
    ? `${latestEstimate.name} Draft`
    : `${context.name} Draft Estimate`;

  const draft = await db.estimate.create({
    data: {
      projectId: context.id,
      name: estimateName,
      version: nextVersion,
      status: "draft",
      materialsCost: latestEstimate?.materialsCost,
      laborCost: latestEstimate?.laborCost,
      equipmentCost: latestEstimate?.equipmentCost,
      subtotal: latestEstimate?.subtotal,
      overhead: latestEstimate?.overhead,
      profit: latestEstimate?.profit,
      total: latestEstimate?.total,
      duration: latestEstimate?.duration,
      weatherFactor: latestEstimate?.weatherFactor,
      marketFactor: latestEstimate?.marketFactor,
      riskFactor: latestEstimate?.riskFactor,
      regionalContext: latestEstimate?.regionalContext ?? undefined,
      proposalData: latestEstimate?.proposalData ?? undefined,
      takeoffItems: latestEstimate?.takeoffItems?.length
        ? {
            create: latestEstimate.takeoffItems.map((item) => ({
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
          }
        : undefined,
    },
    include: {
      takeoffItems: true,
    },
  });

  return draft;
}

async function createFollowUpDraft(userId: string, context: NonNullable<ProjectContext>) {
  const latestEstimate = context.estimates[0];
  const generated = generateMarketingContent({
    mode: "email",
    topic: latestEstimate?.name || context.name,
    lead: {
      name: context.client,
      company: context.client,
    },
    project: {
      name: context.name,
      address: context.address,
    },
  });
  const subject =
    "subject" in generated && typeof generated.subject === "string"
      ? generated.subject
      : `Follow-up on ${latestEstimate?.name || context.name}`;
  const body =
    "body" in generated && typeof generated.body === "string"
      ? generated.body
      : `Hi,\n\nI wanted to follow up regarding ${context.name}. Let me know if you want an updated scope summary or revised proposal.\n\nBest,\nFRG Builder`;
  const cta = "cta" in generated ? generated.cta : "Reply with questions or revisions";

  const email = await db.email.create({
    data: {
      userId,
      projectId: context.id,
      estimateId: latestEstimate?.id,
      subject,
      body,
      type: "followup",
      status: "draft",
      metadata: stringifyJson({
        generatedBy: "agent-core",
        cta,
        source: "safe-action",
      }),
    },
  });

  return email;
}

async function createOrchestratedFollowUpDraft(input: {
  userId: string;
  project: NonNullable<ProjectContext>;
  estimateId?: string;
}) {
  const generated = generateMarketingContent({
    mode: "email",
    topic: input.project.name,
    lead: {
      name: input.project.client,
      company: input.project.client,
    },
    project: {
      name: input.project.name,
      address: input.project.address,
    },
  });

  const subject =
    "subject" in generated && typeof generated.subject === "string"
      ? generated.subject
      : `Follow-up on ${input.project.name}`;
  const body =
    "body" in generated && typeof generated.body === "string"
      ? generated.body
      : `Hi,\n\nI reviewed the current bid package for ${input.project.name}. I can revise scope, assumptions, or send the proposal package once your review is complete.\n\nBest,\nFRG Builder`;
  const cta = "cta" in generated ? generated.cta : "Reply with revisions or approval notes";

  return db.email.create({
    data: {
      userId: input.userId,
      projectId: input.project.id,
      estimateId: input.estimateId,
      subject,
      body,
      type: "followup",
      status: "draft",
      metadata: stringifyJson({
        generatedBy: "project-orchestrator",
        cta,
        source: "safe-action",
      }),
    },
  });
}

function explainTakeoff(context: NonNullable<ProjectContext>) {
  const latestEstimate = context.estimates[0];
  if (!latestEstimate) {
    return "No hay estimate activo para explicar. Primero crea o selecciona un estimate.";
  }

  const grouped = latestEstimate.takeoffItems.reduce<Record<string, { quantity: number; cost: number }>>(
    (acc, item) => {
      const key = item.trade || "General";
      acc[key] = acc[key] || { quantity: 0, cost: 0 };
      acc[key].quantity += item.quantity || 0;
      acc[key].cost += item.totalCost || 0;
      return acc;
    },
    {}
  );

  const breakdown = Object.entries(grouped)
    .map(
      ([trade, value]) =>
        `- ${trade}: ${value.quantity.toFixed(2)} unidades acumuladas | costo ${value.cost.toFixed(2)}`
    )
    .join("\n");

  return [
    `Takeoff explanation for ${latestEstimate.name} v${latestEstimate.version}:`,
    `Este estimate tiene ${latestEstimate.takeoffItems.length} partidas y total ${latestEstimate.total ?? 0}.`,
    breakdown || "No hay desglose por trade todavia.",
    "Usa este resumen para revisar cantidades, detectar partidas faltantes y validar supuestos antes de enviar proposal.",
  ].join("\n");
}

type PipelineStepResult = {
  status: "completed" | "skipped" | "failed";
  summary: string;
  tool?: ToolName;
  skill?: SkillName;
  details?: Record<string, unknown>;
  context?: NonNullable<ProjectContext>;
  estimate?: NonNullable<ProjectContext>["estimates"][number] | null;
};

function getAgentProfile(
  workspace: UserAgentWorkspaceConfig,
  agentKey: AgentPipelineAgentKey
) {
  return workspace.agents[agentKey] || DEFAULT_AGENT_WORKSPACE_CONFIG.agents[agentKey];
}

function canRunPipelineAgent(input: {
  workspace: UserAgentWorkspaceConfig;
  agentKey: AgentPipelineAgentKey;
  primaryTool: ToolName;
  userLevel: number;
}) {
  const profile = getAgentProfile(input.workspace, input.agentKey);

  if (!profile.enabled) {
    return {
      allowed: false,
      reason: `${AGENT_PIPELINE_CATALOG[input.agentKey].label} is disabled in this workspace.`,
    };
  }

  if ((profile.requiredLevel ?? 0) > input.userLevel) {
    return {
      allowed: false,
      reason: `${AGENT_PIPELINE_CATALOG[input.agentKey].label} needs permission level ${profile.requiredLevel}.`,
    };
  }

  if (profile.allowedTools?.length && !profile.allowedTools.includes(input.primaryTool)) {
    return {
      allowed: false,
      reason: `${AGENT_PIPELINE_CATALOG[input.agentKey].label} cannot use ${input.primaryTool} with the current workspace rules.`,
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

async function refreshProjectContext(projectId: string) {
  const refreshed = await getProjectContext(projectId);
  if (!refreshed) {
    throw new Error("Project context disappeared during pipeline execution.");
  }
  return refreshed;
}

async function runDocumentControlAgent(context: NonNullable<ProjectContext>) {
  const documentContext = buildDocumentAnalysisContext(context);
  const pendingDocuments = context.documents.filter((document) => !document.analyzed);

  if (!pendingDocuments.length) {
    return {
      status: "completed",
      summary: `Document Control: ${context.documents.length} files already analyzed and ready.`,
      tool: "summarize_documents",
      skill: "document_skill",
      details: {
        totalDocuments: context.documents.length,
        pendingDocuments: 0,
      },
      context,
    } satisfies PipelineStepResult;
  }

  for (const document of pendingDocuments) {
    const analyzed = await analyzeStoredDocument(document, documentContext);
    await db.document.update({
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
  }

  const refreshed = await refreshProjectContext(context.id);
  const selectedForTakeoff = refreshed.documents.filter((document) => document.selectedForTakeoff).length;
  const selectedForProposal = refreshed.documents.filter(
    (document) => document.selectedForProposalContext
  ).length;

  return {
    status: "completed",
    summary: `Document Control: analyzed ${pendingDocuments.length} pending file(s), ${selectedForTakeoff} marked for takeoff and ${selectedForProposal} for proposal context.`,
    tool: "summarize_documents",
    skill: "document_skill",
    details: {
      analyzedDocuments: pendingDocuments.length,
      selectedForTakeoff,
      selectedForProposal,
    },
    context: refreshed,
  } satisfies PipelineStepResult;
}

async function runScopeSelectorAgent(context: NonNullable<ProjectContext>) {
  const selectedForTakeoff = context.documents.filter((document) => document.selectedForTakeoff);
  const proposalContext = context.documents.filter((document) => document.selectedForProposalContext);
  const needsReview = context.documents.filter((document) => document.requiresHumanReview);

  return {
    status: "completed",
    summary: `Scope Selector: ${selectedForTakeoff.length} document(s) prioritized for takeoff, ${proposalContext.length} kept as proposal context, ${needsReview.length} flagged for human review.`,
    tool: "compare_versions",
    skill: "document_skill",
    details: {
      selectedForTakeoff: selectedForTakeoff.map((document) => document.originalName),
      proposalContext: proposalContext.map((document) => document.originalName),
      requiresHumanReview: needsReview.map((document) => document.originalName),
    },
    context,
  } satisfies PipelineStepResult;
}

async function runTakeoffAgent(context: NonNullable<ProjectContext>) {
  const takeoffDocuments = context.documents.filter((document) => document.selectedForTakeoff);
  const quantitySignals = takeoffDocuments.reduce((sum, document) => {
    const analysis = parseJsonField<{ quantitySignals?: unknown[] } | null>(document.analysisResult, null);
    return sum + (analysis?.quantitySignals?.length || 0);
  }, 0);

  return {
    status: "completed",
    summary: `Takeoff Agent: ${takeoffDocuments.length} scoped document(s) are feeding the estimate with ${quantitySignals} quantity signal(s).`,
    tool: "explain_takeoff",
    skill: "takeoff_skill",
    details: {
      takeoffDocuments: takeoffDocuments.map((document) => document.originalName),
      quantitySignals,
    },
    context,
  } satisfies PipelineStepResult;
}

async function runEstimatorAgent(input: {
  context: NonNullable<ProjectContext>;
  userId: string;
  workspace: UserAgentWorkspaceConfig;
}) {
  const profile = getAgentProfile(input.workspace, "estimator");
  const generatedEstimate = await generateEstimateForProject(input.context.id, input.userId);
  const estimate = await db.estimate.update({
    where: { id: generatedEstimate.id },
    data: {
      status:
        input.workspace.requireReviewBeforeSend || profile.reviewRequired ? "review" : "draft",
    },
    include: {
      takeoffItems: true,
      proposalDelivery: true,
      emails: true,
    },
  });
  const refreshed = await refreshProjectContext(input.context.id);

  return {
    status: "completed",
    summary: `Estimator: created ${estimate.name} v${estimate.version} with ${estimate.takeoffItems.length} line item(s) and total ${Number(estimate.total || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}.`,
    tool: "check_costs",
    skill: "estimate_skill",
    details: {
      estimateId: estimate.id,
      estimateVersion: estimate.version,
      total: estimate.total,
      status: estimate.status,
    },
    context: refreshed,
    estimate,
  } satisfies PipelineStepResult;
}

async function runProposalWriterAgent(input: {
  context: NonNullable<ProjectContext>;
  estimate: NonNullable<ProjectContext>["estimates"][number] | null;
  workspace: UserAgentWorkspaceConfig;
}) {
  const currentEstimate = input.estimate || input.context.estimates[0] || null;
  if (!currentEstimate) {
    return {
      status: "skipped",
      summary: "Proposal Writer: skipped because there is no estimate available yet.",
      tool: "generate_proposal",
      skill: "proposal_writer_skill",
      context: input.context,
    } satisfies PipelineStepResult;
  }

  const profile = getAgentProfile(input.workspace, "proposalWriter");
  const estimateForProposal = {
    ...currentEstimate,
    proposalData: parseJsonField(currentEstimate.proposalData, null),
  };
  const proposalData = buildProposalData(input.context, estimateForProposal);
  const updatedEstimate = await db.estimate.update({
    where: { id: currentEstimate.id },
    data: {
      proposalData: stringifyJson(proposalData),
      status:
        input.workspace.requireReviewBeforeSend || profile.reviewRequired ? "review" : currentEstimate.status,
    },
    include: {
      takeoffItems: true,
      proposalDelivery: true,
      emails: true,
    },
  });
  const refreshed = await refreshProjectContext(input.context.id);

  return {
    status: "completed",
    summary: `Proposal Writer: prepared proposal copy for ${proposalData.recipientName || input.context.client || "internal review"} using the ${proposalData.template} template.`,
    tool: "generate_proposal",
    skill: "proposal_writer_skill",
    details: {
      estimateId: updatedEstimate.id,
      template: proposalData.template,
      recipientEmail: proposalData.recipientEmail || input.context.clientEmail || null,
    },
    context: refreshed,
    estimate: updatedEstimate,
  } satisfies PipelineStepResult;
}

async function runBidFormAgent(input: {
  context: NonNullable<ProjectContext>;
  estimate: NonNullable<ProjectContext>["estimates"][number] | null;
}) {
  if (!input.context.bidOpportunity) {
    return {
      status: "skipped",
      summary: "Bid Form Agent: skipped because this project has no linked opportunity.",
      tool: "create_pdf",
      skill: "proposal_writer_skill",
      context: input.context,
      estimate: input.estimate,
    } satisfies PipelineStepResult;
  }

  const currentEstimate = input.estimate || input.context.estimates[0] || null;
  if (!currentEstimate) {
    return {
      status: "skipped",
      summary: "Bid Form Agent: skipped because an estimate is required before the submit package.",
      tool: "create_pdf",
      skill: "proposal_writer_skill",
      context: input.context,
      estimate: currentEstimate,
    } satisfies PipelineStepResult;
  }

  const user = await db.user.findUnique({
    where: { id: input.context.userId },
    include: {
      userMemory: true,
    },
  });
  const company = await db.companyMemory.findFirst({
    select: {
      name: true,
    },
  });

  if (!user) {
    throw new Error("User not found while preparing bid form package.");
  }

  const parsedEstimate = {
    ...currentEstimate,
    proposalData: parseJsonField(currentEstimate.proposalData, null),
  };
  const bidFormData =
    parseJsonField<BidFormData | null>(input.context.bidOpportunity.bidFormData, null) ||
    buildBidFormData({
      opportunity: input.context.bidOpportunity,
      project: input.context,
      estimate: parsedEstimate,
      user,
      company,
    });
  const submitPackage = buildBidSubmitPackage({
    opportunity: input.context.bidOpportunity,
    project: input.context,
    estimate: parsedEstimate,
    bidFormData,
    proposalData: buildProposalData(input.context, parsedEstimate),
    notes: input.context.bidOpportunity.notes || undefined,
  });

  await persistBidPackageState({
    opportunityId: input.context.bidOpportunity.id,
    bidFormData,
    submitPackage,
  });

  const refreshed = await refreshProjectContext(input.context.id);
  return {
    status: "completed",
    summary: `Bid Form Agent: ${submitPackage.readyForSubmit ? "package is ready for submit" : "package needs review"} with method ${submitPackage.submitMethod}.`,
    tool: "create_pdf",
    skill: "proposal_writer_skill",
    details: {
      readyForSubmit: submitPackage.readyForSubmit,
      submitMethod: submitPackage.submitMethod,
      submitTo: submitPackage.submitTo,
    },
    context: refreshed,
    estimate: currentEstimate,
  } satisfies PipelineStepResult;
}

async function runFollowUpAgent(input: {
  userId: string;
  context: NonNullable<ProjectContext>;
  estimate: NonNullable<ProjectContext>["estimates"][number] | null;
}) {
  if (!input.context.clientEmail) {
    return {
      status: "skipped",
      summary: "Follow-up Agent: skipped because the project has no client email.",
      tool: "generate_follow_up",
      skill: "email_outreach_skill",
      context: input.context,
      estimate: input.estimate,
    } satisfies PipelineStepResult;
  }

  const email = await createOrchestratedFollowUpDraft({
    userId: input.userId,
    project: input.context,
    estimateId: input.estimate?.id,
  });

  return {
    status: "completed",
    summary: `Follow-up Agent: drafted a follow-up email with subject "${email.subject}".`,
    tool: "generate_follow_up",
    skill: "email_outreach_skill",
    details: {
      emailId: email.id,
      subject: email.subject,
    },
    context: input.context,
    estimate: input.estimate,
  } satisfies PipelineStepResult;
}

function buildCustomPipelineTask(stage: CustomAgentPipelineStage, context: NonNullable<ProjectContext>) {
  switch (stage) {
    case "preflight":
      return `Review the bid intake for ${context.name}. Validate missing scope, missing files, addenda risk, due dates, and next review steps before the takeoff starts.`;
    case "takeoff":
      return `Review the currently selected takeoff documents for ${context.name}. Call out measurement risk, missing sheets, scale issues, and trade-specific quantity blind spots.`;
    case "estimate":
      return `Review the active estimate for ${context.name}. Challenge pricing assumptions, exclusions, regional factors, schedule risk, and where human review is still required.`;
    case "delivery":
      return `Review the proposal and bid package for ${context.name}. Confirm client-facing clarity, readiness to submit, missing attachments, and anything that should be revised before sending.`;
    case "followup":
      return `Review the post-package communication strategy for ${context.name}. Suggest next follow-up actions, approval prompts, and commercial reminders after delivery.`;
    default:
      return `Review the active project ${context.name} and produce the next best actions for the current bid workflow stage.`;
  }
}

async function runCustomPipelineAgent(input: {
  agent: CustomAgent;
  userId: string;
  context: NonNullable<ProjectContext>;
  estimate: NonNullable<ProjectContext>["estimates"][number] | null;
}) {
  const providerStatus = await loadAiSettingsResponse(input.userId);
  const reply = await generateAgentReply({
    instructions: buildCustomAgentInstructions({
      agent: input.agent,
      context: input.context,
      providerStatus,
      purpose: `Actua dentro del pipeline en la etapa ${CUSTOM_AGENT_PIPELINE_STAGE_LABELS[input.agent.pipelineStage || "preflight"]}. Tu salida debe ser accionable, breve y lista para revision interna.`,
    }),
    messages: [
      {
        role: "user",
        content: buildCustomPipelineTask(input.agent.pipelineStage || "preflight", input.context),
      },
    ],
    userId: input.userId,
  });

  await persistCustomAgentMemory({
    agent: input.agent,
    context: input.context,
    content: reply.content,
  });

  return {
    status: "completed",
    summary: `${input.agent.name}: ${compactText(reply.content, 280)}${
      input.agent.reviewRequired ? " Review required." : ""
    }`,
    tool: input.agent.allowedTools[0],
    skill: input.agent.baseSkill,
    details: {
      customAgentId: input.agent.id,
      slug: input.agent.slug,
      stage: input.agent.pipelineStage || "preflight",
      fullResponse: reply.content,
      provider: reply.provider,
      model: reply.model,
    },
    context: input.context,
    estimate: input.estimate,
  } satisfies PipelineStepResult;
}

export async function runCustomConfiguredAgent(input: {
  agent: CustomAgent;
  userId: string;
  userLevel: number;
  projectId?: string | null;
  conversationId?: string | null;
  message: string;
  messages: ChatTurn[];
  workspace?: UserAgentWorkspaceConfig;
  triggerReason: "mention" | "trigger";
}) {
  if (input.agent.requiredLevel > input.userLevel) {
    throw new Error(
      `${input.agent.name} necesita nivel ${input.agent.requiredLevel} y el usuario actual no lo tiene.`
    );
  }

  const context = await getProjectContext(input.projectId);
  const providerStatus = await loadAiSettingsResponse(input.userId);
  const run = await createAgentRun({
    userId: input.userId,
    projectId: context?.id || null,
    conversationId: input.conversationId || null,
    trigger: "chat",
    mode: input.workspace?.mode || "manual",
    prompt: input.message,
  });

  const cleanedMessage = input.message.replace(new RegExp(`@${input.agent.slug}\\b`, "ig"), "").trim();

  try {
    const reply = await generateAgentReply({
      instructions: buildCustomAgentInstructions({
        agent: input.agent,
        context,
        providerStatus,
        purpose:
          input.triggerReason === "mention"
            ? "El usuario te invoco directamente desde el chat. Responde como especialista operativo y usa el contexto del proyecto si existe."
            : "El usuario disparo este agente por una regla automatica del workspace. Responde con la mejor siguiente accion para el proyecto.",
      }),
      messages: [
        ...input.messages,
        {
          role: "user",
          content: cleanedMessage || input.message,
        },
      ],
      userId: input.userId,
    });

    await persistCustomAgentMemory({
      agent: input.agent,
      context,
      content: reply.content,
    });

    await recordAgentRunStep({
      runId: run.id,
      agentKey: `custom:${input.agent.slug}`,
      agentLabel: input.agent.name,
      status: "completed",
      tool: input.agent.allowedTools[0],
      skill: input.agent.baseSkill,
      summary: compactText(reply.content, 280),
      details: {
        customAgentId: input.agent.id,
        slug: input.agent.slug,
        triggerReason: input.triggerReason,
        fullResponse: reply.content,
        provider: reply.provider,
        model: reply.model,
      },
    });

    await finalizeAgentRun({
      runId: run.id,
      status: "completed",
      summary: `${input.agent.name} completed successfully.`,
      output: reply.content,
    });

    return {
      content: reply.content,
      skill: input.agent.baseSkill,
      tool: input.agent.allowedTools[0] || "summarize_documents",
      runId: run.id,
      provider: reply.provider,
      model: reply.model,
    };
  } catch (error) {
    await recordAgentRunStep({
      runId: run.id,
      agentKey: `custom:${input.agent.slug}`,
      agentLabel: input.agent.name,
      status: "failed",
      tool: input.agent.allowedTools[0],
      skill: input.agent.baseSkill,
      summary: error instanceof Error ? error.message : "Custom agent failed",
      details: {
        customAgentId: input.agent.id,
        slug: input.agent.slug,
        error: error instanceof Error ? error.message : "Custom agent failed",
      },
    });

    await finalizeAgentRun({
      runId: run.id,
      status: "failed",
      summary: `${input.agent.name} failed.`,
      output: error instanceof Error ? error.message : "Custom agent failed",
    });

    throw error;
  }
}

async function runProjectOrchestrator(input: {
  userId: string;
  userLevel: number;
  projectId?: string | null;
  conversationId?: string | null;
  trigger?: "chat" | "quick-action" | "auto-chat";
  prompt?: string;
  workspace?: UserAgentWorkspaceConfig;
}): Promise<SafeActionResult> {
  const context = await getProjectContext(input.projectId);

  if (!context) {
    return {
      content:
        "Necesito un proyecto activo para correr el pipeline agentico. Selecciona un proyecto y vuelve a intentarlo.",
      tool: "run_project_orchestrator",
      skill: "project_manager_skill",
    } satisfies SafeActionResult;
  }

  const workspace = input.workspace || DEFAULT_AGENT_WORKSPACE_CONFIG;
  const customPipelineAgents = await loadUserCustomAgents(input.userId, {
    enabledOnly: true,
    executionMode: "pipeline-capable",
  });
  const run = await createAgentRun({
    userId: input.userId,
    projectId: context.id,
    conversationId: input.conversationId || null,
    trigger: input.trigger || "chat",
    mode: workspace.mode,
    prompt: input.prompt || null,
  });

  let workingContext = context;
  let workingEstimate: NonNullable<ProjectContext>["estimates"][number] | null =
    context.estimates[0] || null;
  const lines = [
    `Pipeline FRG activado para ${context.name}.`,
    `Bid intake: ${context.client || "sin cliente"} | ${context.address || "sin direccion"} | ${context.documents.length} archivos cargados.`,
  ];
  const pipelineOrder: Array<{
    agentKey: AgentPipelineAgentKey;
    primaryTool: ToolName;
    run: () => Promise<PipelineStepResult>;
  }> = [
    {
      agentKey: "documentControl",
      primaryTool: "summarize_documents",
      run: () => runDocumentControlAgent(workingContext),
    },
    {
      agentKey: "scopeSelector",
      primaryTool: "compare_versions",
      run: () => runScopeSelectorAgent(workingContext),
    },
    {
      agentKey: "takeoff",
      primaryTool: "explain_takeoff",
      run: () => runTakeoffAgent(workingContext),
    },
    {
      agentKey: "estimator",
      primaryTool: "check_costs",
      run: () =>
        runEstimatorAgent({
          context: workingContext,
          userId: input.userId,
          workspace,
        }),
    },
    {
      agentKey: "proposalWriter",
      primaryTool: "generate_proposal",
      run: () =>
        runProposalWriterAgent({
          context: workingContext,
          estimate: workingEstimate,
          workspace,
        }),
    },
    {
      agentKey: "bidForm",
      primaryTool: "create_pdf",
      run: () =>
        runBidFormAgent({
          context: workingContext,
          estimate: workingEstimate,
        }),
    },
    {
      agentKey: "followUp",
      primaryTool: "generate_follow_up",
      run: () =>
        runFollowUpAgent({
          userId: input.userId,
          context: workingContext,
          estimate: workingEstimate,
        }),
    },
  ];

  const mergedPipelineOrder: Array<{
    agentKey: string;
    agentLabel: string;
    primaryTool: ToolName;
    run: () => Promise<PipelineStepResult>;
  }> = [];

  const buildCustomStageSteps = (stage: CustomAgentPipelineStage) =>
    customPipelineAgents
      .filter(
        (agent) =>
          (agent.pipelineStage || "preflight") === stage && agent.requiredLevel <= input.userLevel
      )
      .map((agent) => ({
        agentKey: `custom:${agent.slug}`,
        agentLabel: agent.name,
        primaryTool: agent.allowedTools[0] || "summarize_documents",
        run: () =>
          runCustomPipelineAgent({
            agent,
            userId: input.userId,
            context: workingContext,
            estimate: workingEstimate,
          }),
      }));

  const pushBuiltInStep = (
    step: (typeof pipelineOrder)[number],
    label: string
  ) => {
    mergedPipelineOrder.push({
      agentKey: step.agentKey,
      agentLabel: label,
      primaryTool: step.primaryTool,
      run: step.run,
    });
  };

  pushBuiltInStep(pipelineOrder[0], AGENT_PIPELINE_CATALOG.documentControl.label);
  pushBuiltInStep(pipelineOrder[1], AGENT_PIPELINE_CATALOG.scopeSelector.label);
  mergedPipelineOrder.push(...buildCustomStageSteps("preflight"));
  pushBuiltInStep(pipelineOrder[2], AGENT_PIPELINE_CATALOG.takeoff.label);
  mergedPipelineOrder.push(...buildCustomStageSteps("takeoff"));
  pushBuiltInStep(pipelineOrder[3], AGENT_PIPELINE_CATALOG.estimator.label);
  mergedPipelineOrder.push(...buildCustomStageSteps("estimate"));
  pushBuiltInStep(pipelineOrder[4], AGENT_PIPELINE_CATALOG.proposalWriter.label);
  pushBuiltInStep(pipelineOrder[5], AGENT_PIPELINE_CATALOG.bidForm.label);
  mergedPipelineOrder.push(...buildCustomStageSteps("delivery"));
  pushBuiltInStep(pipelineOrder[6], AGENT_PIPELINE_CATALOG.followUp.label);
  mergedPipelineOrder.push(...buildCustomStageSteps("followup"));
  let activeStep:
    | {
        agentKey: string;
        agentLabel: string;
        primaryTool: ToolName;
      }
    | null = null;

  try {
    for (const step of mergedPipelineOrder) {
      activeStep = {
        agentKey: step.agentKey,
        agentLabel: step.agentLabel,
        primaryTool: step.primaryTool,
      };
      const access = step.agentKey.startsWith("custom:")
        ? {
            allowed: true,
            reason: null,
          }
        : canRunPipelineAgent({
            workspace,
            agentKey: step.agentKey as AgentPipelineAgentKey,
            primaryTool: step.primaryTool,
            userLevel: input.userLevel,
          });

      if (!access.allowed) {
        lines.push(`${step.agentLabel}: skipped. ${access.reason}`);
        await recordAgentRunStep({
          runId: run.id,
          agentKey: step.agentKey,
          agentLabel: step.agentLabel,
          status: "skipped",
          tool: step.primaryTool,
          summary: access.reason,
          details: {
            reason: access.reason,
          },
        });
        continue;
      }

      const startedAt = new Date();
      const result = await step.run();
      await recordAgentRunStep({
        runId: run.id,
        agentKey: step.agentKey,
        agentLabel: step.agentLabel,
        status: result.status,
        tool: result.tool || step.primaryTool,
        skill: result.skill || null,
        summary: result.summary,
        details: result.details || null,
        startedAt,
        finishedAt: new Date(),
      });
      lines.push(result.summary);
      if (result.context) {
        workingContext = result.context;
      }
      if (result.estimate !== undefined) {
        workingEstimate = result.estimate;
      }
    }
    activeStep = null;
  } catch (error) {
    if (activeStep) {
      await recordAgentRunStep({
        runId: run.id,
        agentKey: activeStep.agentKey,
        agentLabel: activeStep.agentLabel,
        status: "failed",
        tool: activeStep.primaryTool,
        skill: "project_manager_skill",
        summary: error instanceof Error ? error.message : "Unknown pipeline error",
        details: {
          error: error instanceof Error ? error.message : "Unknown pipeline error",
        },
      });
    }

    await finalizeAgentRun({
      runId: run.id,
      status: "failed",
      summary: "Pipeline failed before all agents could finish.",
      output: error instanceof Error ? error.message : "Unknown pipeline error",
    });

    return {
      content: [
        ...lines,
        error instanceof Error ? `Pipeline error: ${error.message}` : "Pipeline error.",
      ].join("\n"),
      tool: "run_project_orchestrator",
      skill: "project_manager_skill",
      runId: run.id,
    } satisfies SafeActionResult;
  }

  if (input.prompt?.trim()) {
    lines.push(`Instruccion original: "${input.prompt.trim()}"`);
  }

  await finalizeAgentRun({
    runId: run.id,
    status: "completed",
    summary: workingEstimate
      ? `Pipeline completed with estimate v${workingEstimate.version} ready for review.`
      : "Pipeline completed without producing a new estimate.",
    output: lines.join("\n"),
  });

  return {
    content: lines.join("\n"),
    tool: "run_project_orchestrator",
    skill: "project_manager_skill",
    runId: run.id,
  } satisfies SafeActionResult;
}

export async function runSafeAgentAction(input: {
  action: AgentSafeAction;
  userId: string;
  userLevel: number;
  projectId?: string | null;
  prompt?: string;
  workspace?: UserAgentWorkspaceConfig;
  conversationId?: string | null;
  trigger?: "chat" | "quick-action" | "auto-chat";
}): Promise<SafeActionResult> {
  const context = await getProjectContext(input.projectId);

  if (!context) {
    return {
      content:
        "Necesito un proyecto activo para ejecutar esta accion. Selecciona un proyecto y vuelve a intentarlo.",
      tool: input.action,
      skill: "project_manager_skill",
    } satisfies SafeActionResult;
  }

  if (input.action === "create_estimate_draft") {
    const draft = await createEstimateDraft(context);
    return {
      content: [
        `Estimate draft creado para ${context.name}.`,
        `Nombre: ${draft.name}`,
        `Version: ${draft.version}`,
        `Partidas copiadas: ${draft.takeoffItems.length}`,
        "Ya puedes abrir Estimate para revisar, ajustar costos y preparar proposal.",
      ].join("\n"),
      tool: "create_estimate_draft",
      skill: "estimate_skill",
    } satisfies SafeActionResult;
  }

  if (input.action === "generate_follow_up") {
    const email = await createFollowUpDraft(input.userId, context);
    return {
      content: [
        `Follow-up draft creado para ${context.client || context.name}.`,
        `Asunto: ${email.subject}`,
        context.clientEmail
          ? `Cliente detectado: ${context.clientEmail}`
          : "El proyecto no tiene clientEmail; revisa el draft antes de enviar.",
        "El borrador ya quedo guardado en Boost para edicion o envio.",
      ].join("\n"),
      tool: "generate_follow_up",
      skill: "email_outreach_skill",
    } satisfies SafeActionResult;
  }

  if (input.action === "summarize_documents") {
    return {
      content: [
        `Resumen de documentos para ${context.name}:`,
        buildDocumentSummary(context),
      ].join("\n"),
      tool: "summarize_documents",
      skill: "document_skill",
    } satisfies SafeActionResult;
  }

  if (input.action === "run_project_orchestrator") {
    return runProjectOrchestrator({
      userId: input.userId,
      userLevel: input.userLevel,
      projectId: input.projectId,
      conversationId: input.conversationId,
      trigger: input.trigger,
      prompt: input.prompt,
      workspace: input.workspace,
    });
  }

  return {
    content: explainTakeoff(context),
    tool: "explain_takeoff",
    skill: "takeoff_skill",
  } satisfies SafeActionResult;
}

function extractOpenAiText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts = output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    return content
      .filter((entry) => entry?.type === "output_text" && typeof entry.text === "string")
      .map((entry) => entry.text as string);
  });

  return parts.join("\n").trim();
}

async function generateWithOpenAI(input: {
  apiKey: string;
  model: string;
  instructions: string;
  messages: ChatTurn[];
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      instructions: input.instructions,
      input: input.messages.map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      })),
    }),
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    throw new Error(
      (payload?.error as { message?: string } | undefined)?.message ||
        "OpenAI request failed."
    );
  }

  const content = extractOpenAiText(payload);
  if (!content) {
    throw new Error("OpenAI did not return text output.");
  }

  return {
    provider: "openai",
    model: input.model,
    content,
  } satisfies ProviderTextResponse;
}

async function generateWithAnthropic(input: {
  apiKey: string;
  model: string;
  instructions: string;
  messages: ChatTurn[];
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      system: input.instructions,
      max_tokens: 1400,
      messages: input.messages,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        content?: Array<{ type?: string; text?: string }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error?.message || "Claude request failed.");
  }

  const content = (payload.content || [])
    .filter((entry) => entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text as string)
    .join("\n")
    .trim();

  if (!content) {
    throw new Error("Claude did not return text output.");
  }

  return {
    provider: "anthropic",
    model: input.model,
    content,
  } satisfies ProviderTextResponse;
}

async function generateWithGemini(input: {
  apiKey: string;
  model: string;
  instructions: string;
  messages: ChatTurn[];
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": input.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: input.instructions }],
        },
        contents: input.messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error?.message || "Gemini request failed.");
  }

  const content = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();

  if (!content) {
    throw new Error("Gemini did not return text output.");
  }

  return {
    provider: "gemini",
    model: input.model,
    content,
  } satisfies ProviderTextResponse;
}

export async function generateAgentReply(input: {
  instructions: string;
  messages: ChatTurn[];
  userId?: string | null;
}) {
  const { settings } = await loadAiSettings(input.userId);
  const credentialSummaries = await loadAiCredentialSummaries(input.userId);
  const activeProvider = resolveActiveProvider(settings, credentialSummaries);

  if (!activeProvider) {
    throw new Error(
      "No AI provider is enabled. Enable OpenAI, Claude or Gemini from the provider panel."
    );
  }

  const model = settings.providers[activeProvider].model;
  const credential = await resolveProviderApiKey(activeProvider, input.userId);

  if (!credential.apiKey) {
    throw new Error(
      `${activeProvider.toUpperCase()} is enabled but no valid API key is available for this user or the system fallback.`
    );
  }

  if (activeProvider === "openai") {
    return generateWithOpenAI({
      apiKey: credential.apiKey,
      model,
      instructions: input.instructions,
      messages: input.messages,
    });
  }

  if (activeProvider === "anthropic") {
    return generateWithAnthropic({
      apiKey: credential.apiKey,
      model,
      instructions: input.instructions,
      messages: input.messages,
    });
  }

  return generateWithGemini({
    apiKey: credential.apiKey,
    model,
    instructions: input.instructions,
    messages: input.messages,
  });
}

export async function getAiSettingsResponse(userId?: string | null) {
  return loadAiSettingsResponse(userId);
}

export function createConversationListTitle(message: string, action?: AgentSafeAction | null) {
  if (action === "create_estimate_draft") return "AI Estimate Draft";
  if (action === "generate_follow_up") return "AI Follow-up Draft";
  if (action === "summarize_documents") return "AI Document Summary";
  if (action === "explain_takeoff") return "AI Takeoff Explanation";
  if (action === "run_project_orchestrator") return "AI Project Pipeline";
  return compactText(message, 50) || "FRG Agent Session";
}

export function buildAgentInstructions(input: {
  basePrompt: string;
  projectContextPrompt?: string;
  providerStatus: AiProviderSettingsResponse;
}) {
  const providerLine = input.providerStatus.active
    ? `Proveedor activo: ${input.providerStatus.providers[input.providerStatus.active].label}`
    : "Proveedor activo: none";

  return [input.basePrompt, "", providerLine, "", input.projectContextPrompt || ""]
    .filter(Boolean)
    .join("\n");
}
