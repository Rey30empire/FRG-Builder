import type {
  AgentPipelineAgentKey,
  PermissionLevel,
  ToolName,
  UserAgentWorkspaceConfig,
} from "@/types";

export const AGENT_PIPELINE_CATALOG: Record<
  AgentPipelineAgentKey,
  {
    label: string;
    description: string;
    requiredLevel: PermissionLevel;
    reviewRequired: boolean;
    allowedTools: ToolName[];
  }
> = {
  documentControl: {
    label: "Document Control",
    description: "Clasifica archivos, detecta pendientes y prepara el set documental.",
    requiredLevel: 1,
    reviewRequired: false,
    allowedTools: ["read_pdf", "extract_text", "summarize_documents"],
  },
  scopeSelector: {
    label: "Scope Selector",
    description: "Prioriza planos, spec sections y addenda por paquete de trabajo.",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: ["summarize_documents", "compare_versions", "save_memory"],
  },
  takeoff: {
    label: "Takeoff Agent",
    description: "Revisa el set elegido y valida las partidas antes del estimate.",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: ["separate_pages", "detect_scales", "explain_takeoff"],
  },
  estimator: {
    label: "Estimator",
    description: "Genera el estimate, pricing regional y riesgos del proyecto.",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: ["calculate_materials", "check_weather", "check_costs", "create_estimate_draft"],
  },
  proposalWriter: {
    label: "Proposal Writer",
    description: "Prepara narrative, PDF y package comercial para revisión.",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: ["generate_proposal", "create_pdf", "export_reports"],
  },
  bidForm: {
    label: "Bid Form Agent",
    description: "Autocompleta el bid form y arma el submit package.",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: ["create_pdf", "export_reports", "save_memory"],
  },
  followUp: {
    label: "Follow-up Agent",
    description: "Deja seguimiento comercial listo después del paquete.",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: ["write_email", "generate_follow_up", "save_memory"],
  },
};

export const DEFAULT_AGENT_WORKSPACE_CONFIG: UserAgentWorkspaceConfig = {
  mode: "manual",
  autoRunOnChat: false,
  requireReviewBeforeSend: true,
  agents: Object.fromEntries(
    Object.entries(AGENT_PIPELINE_CATALOG).map(([key, meta]) => [
      key,
      {
        enabled: true,
        reviewRequired: meta.reviewRequired,
        requiredLevel: meta.requiredLevel,
        allowedTools: meta.allowedTools,
      },
    ])
  ) as UserAgentWorkspaceConfig["agents"],
};
