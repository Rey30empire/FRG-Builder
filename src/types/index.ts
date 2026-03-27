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
  | "compare_versions";

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
  duration?: number;
  weatherFactor?: number;
  riskFactor?: number;
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
  score?: number;
  timeSpent?: number;
  content?: Record<string, unknown>;
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
  status: "draft" | "active" | "completed";
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

export interface ProposalLineItemSummary {
  trade: string;
  description: string;
  totalCost: number;
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

export interface EmailMetadata {
  attachmentLabel?: string;
  attachmentUrl?: string;
  cta?: string;
  template?: string;
  generatedBy?: string;
  proposalStatus?: string;
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
