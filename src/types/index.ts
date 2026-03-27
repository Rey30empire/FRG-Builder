// Builder-FRG-LLC Types

// ============================================
// PERMISSION LEVELS
// ============================================

export type PermissionLevel = 0 | 1 | 2 | 3 | 4;

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  0: "Lectura - Solo analizar y responder",
  1: "Escritura Segura - Crear borradores y proposals",
  2: "Ejecución Controlada - Exportar y modificar proyectos",
  3: "Operación Conectada - APIs externas y automatizaciones",
  4: "Admin Total - Control completo del sistema",
};

// ============================================
// MODULES
// ============================================

export type Module = "dashboard" | "agent" | "estimate" | "learn" | "boost" | "admin";

export const MODULE_INFO: Record<Module, { name: string; description: string; icon: string }> = {
  dashboard: {
    name: "Builder Hub",
    description: "Resumen operativo de proyectos, CRM y aprendizaje",
    icon: "LayoutDashboard",
  },
  agent: {
    name: "FRG Agent Core",
    description: "Orquestador central con chat inteligente",
    icon: "Brain",
  },
  estimate: {
    name: "FRG Estimate",
    description: "Estimaciones, takeoff y proposals",
    icon: "Calculator",
  },
  learn: {
    name: "FRG Learn",
    description: "Educación y aprendizaje de construcción",
    icon: "GraduationCap",
  },
  boost: {
    name: "FRG Boost",
    description: "Marketing, CRM y crecimiento de LLC",
    icon: "Rocket",
  },
  admin: {
    name: "Admin Forge",
    description: "Panel de administración",
    icon: "Settings",
  },
};

// ============================================
// SKILLS
// ============================================

export type SkillName =
  | "estimate_skill"
  | "takeoff_skill"
  | "plan_reader_skill"
  | "construction_teacher_skill"
  | "code_reference_skill"
  | "marketing_skill"
  | "proposal_writer_skill"
  | "email_outreach_skill"
  | "crm_skill"
  | "project_manager_skill"
  | "document_skill"
  | "image_analysis_skill"
  | "local_model_skill";

export interface Skill {
  id: string;
  name: SkillName;
  displayName: string;
  description: string;
  module: Module;
  enabled: boolean;
  config?: Record<string, unknown>;
}

// ============================================
// TOOLS
// ============================================

export type ToolName =
  | "read_pdf"
  | "extract_text"
  | "separate_pages"
  | "detect_scales"
  | "analyze_image"
  | "calculate_materials"
  | "check_weather"
  | "check_costs"
  | "generate_proposal"
  | "create_excel"
  | "create_pdf"
  | "save_memory"
  | "search_history"
  | "write_email"
  | "generate_copy"
  | "schedule_post"
  | "read_folders"
  | "export_reports"
  | "compare_versions"
  | "create_estimate_draft"
  | "generate_follow_up"
  | "summarize_documents"
  | "explain_takeoff"
  | "run_project_orchestrator";

export interface Tool {
  id: string;
  name: ToolName;
  displayName: string;
  description: string;
  enabled: boolean;
  requiredLevel: PermissionLevel;
  config?: Record<string, unknown>;
}

// ============================================
// PROJECTS
// ============================================

export type BidOpportunityStatus =
  | "undecided"
  | "accepted"
  | "submitted"
  | "won"
  | "archived";

export type BidSubmitPackageStatus = "draft" | "review" | "ready" | "submitted" | "won";

export interface BidFormLineItem {
  id: string;
  label: string;
  amount: number;
  notes?: string;
}

export interface BidFormData {
  bidderCompany: string;
  bidderContact?: string;
  bidderEmail?: string;
  bidderPhone?: string;
  projectName: string;
  projectAddress?: string;
  scopePackage?: string;
  instructions?: string;
  lineItems: BidFormLineItem[];
  alternates: string[];
  inclusions: string[];
  exclusions: string[];
  attachments: string[];
  notes?: string;
  ready: boolean;
  lastAutoFilledAt?: string;
}

export interface BidPackageChecklistItem {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
}

export interface BidSubmitPackage {
  status: BidSubmitPackageStatus;
  submitMethod: "email" | "portal" | "manual";
  submitTo?: string;
  packageSummary: string;
  checklist: BidPackageChecklistItem[];
  proposalPdfUrl?: string;
  bidFormPdfUrl?: string;
  publicPdfUrl?: string;
  packageItems: string[];
  readyForSubmit: boolean;
  notes?: string;
  preparedAt?: string;
  submittedAt?: string;
}

export interface BidOpportunityProjectLink {
  id: string;
  name: string;
  status: Project["status"];
  address?: string;
  client?: string;
  updatedAt: Date | string;
  documentsCount?: number;
  estimatesCount?: number;
}

export interface BidOpportunity {
  id: string;
  userId: string;
  projectId?: string | null;
  linkedProject?: BidOpportunityProjectLink | null;
  name: string;
  client?: string;
  clientEmail?: string;
  clientPhone?: string;
  estimatorContact?: string;
  dueDate?: Date | string | null;
  jobWalkDate?: Date | string | null;
  rfiDueDate?: Date | string | null;
  projectSize?: string;
  location?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  scopePackage?: string;
  description?: string;
  tradeInstructions?: string;
  bidFormRequired: boolean;
  bidFormInstructions?: string;
  bidFormData?: BidFormData | null;
  submitPackage?: BidSubmitPackage | null;
  source?: string;
  externalUrl?: string;
  status: BidOpportunityStatus;
  notes?: string;
  submittedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  address?: string;
  client?: string;
  clientEmail?: string;
  clientPhone?: string;
  deadline?: Date;
  status: "active" | "completed" | "archived";
  documents: Document[];
  estimates: Estimate[];
  bidOpportunity?: BidOpportunity | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  originalName: string;
  type: string;
  path: string;
  size?: number;
  trade?: string;
  category?: string;
  pageNumber?: number;
  analyzed: boolean;
  analysisResult?: DocumentAnalysis | null;
  relevanceScore?: number | null;
  selectedForTakeoff: boolean;
  selectedForProposalContext: boolean;
  requiresHumanReview: boolean;
  selectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Estimate {
  id: string;
  projectId: string;
  name: string;
  version: number;
  status: "draft" | "review" | "final" | "sent" | "viewed" | "approved" | "rejected";
  materialsCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  subtotal?: number;
  overhead?: number;
  profit?: number;
  total?: number;
  takeoffItems: TakeoffItem[];
  proposalData?: ProposalData | null;
  proposalDelivery?: ProposalDelivery | null;
  duration?: number;
  weatherFactor?: number;
  marketFactor?: number;
  riskFactor?: number;
  regionalContext?: EstimateRegionalContext | null;
  sentAt?: Date;
  viewedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TakeoffItem {
  id: string;
  estimateId: string;
  trade: string;
  description: string;
  quantity: number;
  unit: string;
  materialCost?: number;
  laborCost?: number;
  totalCost?: number;
  sourcePage?: string;
  sourceDocument?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuantitySignal {
  label: string;
  quantity: number;
  unit: string;
  sourceText: string;
}

export interface DocumentAnalysisTakeoffItem {
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
  relevanceScore: number;
  selectedForTakeoff: boolean;
  selectedForProposalContext: boolean;
  requiresHumanReview: boolean;
  selectionReason: string;
  matchedScopeTerms: string[];
  summary: string;
  pageCount: number;
  extractedTextLength: number;
  keywords: string[];
  detectedSheets: string[];
  quantitySignals: QuantitySignal[];
  takeoffItems: DocumentAnalysisTakeoffItem[];
  textPreview: string;
}

// ============================================
// CONVERSATIONS
// ============================================

export interface Conversation {
  id: string;
  userId: string;
  projectId?: string;
  title?: string;
  module?: Module;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  skill?: SkillName;
  tool?: ToolName;
  tokens?: number;
  createdAt: Date;
}

export type AiProviderName = "openai" | "anthropic" | "gemini";

export type BillingPlanKey = "starter" | "pro" | "growth";

export type BillingMetricKey =
  | "ai_messages"
  | "document_analyses"
  | "proposal_deliveries"
  | "agent_runs"
  | "custom_agents";

export type BillingStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export type BillingInterval = "monthly" | "yearly";

export type AgentSafeAction =
  | "create_estimate_draft"
  | "generate_follow_up"
  | "summarize_documents"
  | "explain_takeoff"
  | "run_project_orchestrator";

export interface AiProviderConfig {
  enabled: boolean;
  model: string;
}

export interface AiProviderSettings {
  primary: AiProviderName;
  providers: Record<AiProviderName, AiProviderConfig>;
}

export interface AiProviderStatus extends AiProviderConfig {
  hasApiKey: boolean;
  hasPersonalKey: boolean;
  hasSystemKey: boolean;
  keySource: "user" | "system" | "none";
  validationStatus: "valid" | "invalid" | "pending" | "missing";
  keyHint?: string | null;
  lastValidatedAt?: string | null;
  lastValidationError?: string | null;
  label: string;
}

export interface AiProviderSettingsResponse {
  primary: AiProviderName;
  active: AiProviderName | null;
  providers: Record<AiProviderName, AiProviderStatus>;
}

export interface BillingPlanDefinition {
  key: BillingPlanKey;
  label: string;
  description: string;
  badge: string;
  intervalPrices: Record<BillingInterval, number>;
  limits: Record<BillingMetricKey, number | null>;
  features: {
    personalApiKeys: boolean;
    customAgents: boolean;
    pipelineAutomation: boolean;
    whiteLabelProposal: boolean;
    prioritySupport: boolean;
  };
}

export interface BillingUsageSnapshot {
  metric: BillingMetricKey;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  percentUsed: number | null;
}

export interface BillingAccount {
  id: string;
  userId: string;
  planKey: BillingPlanKey;
  status: BillingStatus;
  billingInterval?: BillingInterval | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeCheckoutSessionId?: string | null;
  currency?: string | null;
  amountCents?: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  checkoutCompletedAt?: Date | null;
  portalAccessedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingUsageEvent {
  id: string;
  billingAccountId: string;
  userId: string;
  metricKey: BillingMetricKey;
  quantity: number;
  source: string;
  referenceId?: string | null;
  referenceType?: string | null;
  periodKey: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface BillingOverview {
  account: BillingAccount;
  plan: BillingPlanDefinition;
  availablePlans: BillingPlanDefinition[];
  usage: BillingUsageSnapshot[];
  checkoutReady: boolean;
  portalReady: boolean;
  stripeConfigured: boolean;
  recommendedUpgrade?: BillingPlanKey | null;
}

// ============================================
// LEARNING
// ============================================

export interface LearningItem {
  id: string;
  userId: string;
  title: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  type: "lesson" | "exercise" | "exam";
  completed: boolean;
  progress: number;
  bookmarked: boolean;
  score?: number;
  timeSpent?: number;
  lastStudiedAt?: Date;
  content?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CRM & MARKETING
// ============================================

export interface Lead {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status: "new" | "contacted" | "qualified" | "proposal" | "closed";
  priority: "low" | "medium" | "high";
  estimatedValue?: number;
  lastContactAt?: Date;
  expectedCloseDate?: Date;
  interactions?: Record<string, unknown>[];
  nextFollowUp?: Date;
  notes?: string;
  emails: Email[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  type: "email" | "social" | "ads";
  target?: string;
  status: "draft" | "scheduled" | "active" | "paused" | "completed";
  budget?: number;
  scheduledAt?: Date;
  launchedAt?: Date;
  completedAt?: Date;
  content?: Record<string, unknown>;
  sent?: number;
  opened?: number;
  clicked?: number;
  converted?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  userId: string;
  leadId?: string;
  projectId?: string;
  estimateId?: string;
  subject: string;
  body: string;
  type: "outreach" | "followup" | "proposal";
  status: "draft" | "sent" | "delivered" | "opened";
  metadata?: EmailMetadata | null;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicket {
  id: string;
  userId?: string | null;
  title: string;
  description: string;
  status: "open" | "investigating" | "waiting" | "resolved";
  priority: "low" | "medium" | "high" | "urgent";
  channel: "internal" | "email" | "phone";
  tags?: string[];
  resolutionNotes?: string | null;
  lastResponseAt?: Date | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpsIncident {
  id: string;
  title: string;
  summary: string;
  affectedService?: string | null;
  severity: "info" | "warning" | "critical";
  status: "open" | "investigating" | "monitoring" | "resolved";
  source?: string | null;
  details?: Record<string, unknown> | null;
  startedAt: Date;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceRun {
  id: string;
  action: string;
  trigger: "manual" | "cron";
  status: "completed" | "failed" | "skipped";
  summary?: string | null;
  details?: Record<string, unknown> | null;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalLineItemSummary {
  trade: string;
  description: string;
  totalCost: number;
}

export interface EstimateRegionalContext {
  source: "heuristic" | "hybrid-live";
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  metro?: string;
  pricingRegion: string;
  marketTier: "low" | "standard" | "elevated" | "premium";
  timezone: string;
  climateZone: string;
  season: "winter" | "spring" | "summer" | "fall";
  latitude?: number | null;
  longitude?: number | null;
  coordinateSource: "opportunity" | "city-centroid" | "state-centroid" | "open-meteo" | "none";
  geocodingProvider?: "open-meteo" | "heuristic";
  weatherProvider?: "open-meteo" | "heuristic";
  marketDataProvider?: "fred" | "heuristic";
  locationSummary: string;
  weatherSummary: string;
  weatherFactor: number;
  marketFactor: number;
  logisticsFactor: number;
  scheduleRiskFactor: number;
  laborIndex: number;
  materialIndex: number;
  equipmentIndex: number;
  drivers: string[];
  liveDataNotes?: string[];
  weatherSnapshot?: {
    date?: string;
    temperatureMaxC?: number;
    temperatureMinC?: number;
    precipitationMm?: number;
    windSpeedMaxKph?: number;
  } | null;
  marketSeries?: {
    labor?: {
      provider: "fred";
      seriesId: string;
      date?: string;
      value: number;
      baseline: number;
      multiplier: number;
    };
    material?: {
      provider: "fred";
      seriesId: string;
      date?: string;
      value: number;
      baseline: number;
      multiplier: number;
    };
    equipment?: {
      provider: "fred";
      seriesId: string;
      date?: string;
      value: number;
      baseline: number;
      multiplier: number;
    };
  } | null;
  tradeAdjustments: Record<
    string,
    {
      labor: number;
      material: number;
      equipment: number;
    }
  >;
}

export interface ProposalData {
  title: string;
  recipientName?: string;
  recipientEmail?: string;
  intro: string;
  scopeSummary: string;
  inclusions: string[];
  exclusions: string[];
  schedule: string;
  terms: string[];
  template: "residential" | "commercial" | "tenant-improvement";
  coverNote?: string;
  highlights: ProposalLineItemSummary[];
}

export interface ProposalDelivery {
  id: string;
  estimateId: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  senderMessage?: string | null;
  responseMessage?: string | null;
  status: "draft" | "sent" | "viewed" | "approved" | "rejected";
  provider?: string | null;
  providerMessageId?: string | null;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMetadata {
  attachmentLabel?: string;
  attachmentUrl?: string;
  bidFormPdfUrl?: string;
  portalUrl?: string;
  publicPdfUrl?: string;
  cta?: string;
  template?: string;
  generatedBy?: string;
  proposalStatus?: string;
  provider?: string;
  providerMessageId?: string;
}

export type AgentWorkspaceMode = "manual" | "assisted" | "agentic";

export type CustomAgentExecutionMode = "chat" | "pipeline" | "both";

export type CustomAgentPipelineStage =
  | "preflight"
  | "takeoff"
  | "estimate"
  | "delivery"
  | "followup";

export type AgentPipelineAgentKey =
  | "documentControl"
  | "scopeSelector"
  | "takeoff"
  | "estimator"
  | "proposalWriter"
  | "bidForm"
  | "followUp";

export interface AgentWorkspaceProfile {
  enabled: boolean;
  reviewRequired?: boolean;
  requiredLevel?: PermissionLevel;
  allowedTools?: ToolName[];
}

export interface UserAgentWorkspaceConfig {
  mode: AgentWorkspaceMode;
  autoRunOnChat: boolean;
  requireReviewBeforeSend: boolean;
  agents: Record<AgentPipelineAgentKey, AgentWorkspaceProfile>;
}

export interface CustomAgent {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string | null;
  instructions: string;
  baseSkill: SkillName;
  enabled: boolean;
  autoRun: boolean;
  includeProjectContext: boolean;
  includeDocumentSummary: boolean;
  includeEstimateSnapshot: boolean;
  executionMode: CustomAgentExecutionMode;
  pipelineStage?: CustomAgentPipelineStage | null;
  requiredLevel: PermissionLevel;
  reviewRequired: boolean;
  allowedTools: ToolName[];
  triggerPhrases: string[];
  successCriteria?: string | null;
  outputSchema?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRunStep {
  id: string;
  runId: string;
  agentKey: string;
  agentLabel: string;
  status: "completed" | "skipped" | "failed";
  tool?: ToolName | null;
  skill?: SkillName | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRun {
  id: string;
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
  trigger: "chat" | "quick-action" | "auto-chat";
  mode: AgentWorkspaceMode;
  status: "running" | "completed" | "failed";
  prompt?: string | null;
  summary?: string | null;
  output?: string | null;
  steps: AgentRunStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSenderSettings {
  fromName?: string;
  fromAddress?: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  hasSmtpPassword?: boolean;
}

// ============================================
// MEMORY
// ============================================

export interface UserMemory {
  id: string;
  userId: string;
  language: string;
  explanationStyle: "detailed" | "summary";
  companyType?: string;
  preferredMargins?: number;
  laborRates?: Record<string, number>;
  overheadPercent?: number;
  emailFromName?: string;
  emailFromAddress?: string;
  emailReplyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  hasSmtpPassword?: boolean;
  aiProviderConfig?: AiProviderSettings | null;
  agentWorkspaceConfig?: UserAgentWorkspaceConfig | null;
  topicsStudied?: string[];
  frequentErrors?: string[];
  progressByArea?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
  role: string;
  level: PermissionLevel;
  userMemory?: UserMemory | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyMemory {
  id: string;
  name: string;
  specialties?: string[];
  workZones?: string[];
  crewInfo?: Record<string, unknown>;
  baseRates?: Record<string, unknown>;
  logo?: string;
  primaryColor?: string;
  proposalTemplate?: string;
  aiProviderConfig?: AiProviderSettings | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemory {
  id: string;
  projectId: string;
  addendas?: string[];
  versions?: Record<string, unknown>;
  exclusions?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChatResponse {
  message: Message;
  skill?: SkillName;
  tool?: ToolName;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}
