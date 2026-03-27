import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Module, Project, Conversation, Message, PermissionLevel, AppUser } from "@/types";

// ============================================
// APP STORE - Estado global de la aplicación
// ============================================

interface AppState {
  activeUser: AppUser | null;
  setActiveUser: (user: AppUser | null) => void;
  availableUsers: AppUser[];
  setAvailableUsers: (users: AppUser[]) => void;

  // Módulo activo
  activeModule: Module;
  setActiveModule: (module: Module) => void;

  // Proyecto activo
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  // Conversación activa
  activeConversation: Conversation | null;
  setActiveConversation: (conversation: Conversation | null) => void;

  // Nivel de permiso actual
  permissionLevel: PermissionLevel;
  setPermissionLevel: (level: PermissionLevel) => void;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  chatPanelOpen: boolean;
  setChatPanelOpen: (open: boolean) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeUser: null,
      setActiveUser: (user) =>
        set({
          activeUser: user,
          permissionLevel: (user?.level as PermissionLevel | undefined) ?? 1,
          activeProject: null,
          activeConversation: null,
        }),

      availableUsers: [],
      setAvailableUsers: (users) => set({ availableUsers: users }),

      activeModule: "dashboard",
      setActiveModule: (module) => set({ activeModule: module }),

      activeProject: null,
      setActiveProject: (project) => set({ activeProject: project }),

      activeConversation: null,
      setActiveConversation: (conversation) => set({ activeConversation: conversation }),

      permissionLevel: 1,
      setPermissionLevel: (level) => set({ permissionLevel: level }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      chatPanelOpen: true,
      setChatPanelOpen: (open) => set({ chatPanelOpen: open }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "frg-app-storage",
      partialize: (state) => ({
        activeUser: state.activeUser,
        activeModule: state.activeModule,
        permissionLevel: state.permissionLevel,
        sidebarOpen: state.sidebarOpen,
        chatPanelOpen: state.chatPanelOpen,
      }),
    }
  )
);

// ============================================
// CHAT STORE - Estado del chat
// ============================================

interface ChatState {
  messages: Message[];
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  input: string;
  setInput: (input: string) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  isTyping: false,
  setIsTyping: (typing) => set({ isTyping: typing }),
  input: "",
  setInput: (input) => set({ input }),
}));

// ============================================
// PROJECTS STORE - Estado de proyectos
// ============================================

interface ProjectsState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

export const useProjectsStore = create<ProjectsState>()((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),
}));

// ============================================
// SKILLS STORE - Estado de skills
// ============================================

interface Skill {
  id: string;
  name: string;
  displayName: string;
  description: string;
  module: Module;
  enabled: boolean;
}

interface SkillsState {
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  toggleSkill: (id: string) => void;
}

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set) => ({
      skills: [
        {
          id: "1",
          name: "estimate_skill",
          displayName: "Estimación",
          description: "Cálculo de costos, tiempos y materiales",
          module: "estimate",
          enabled: true,
        },
        {
          id: "2",
          name: "takeoff_skill",
          displayName: "Takeoff",
          description: "Extracción de cantidades de planos",
          module: "estimate",
          enabled: true,
        },
        {
          id: "3",
          name: "plan_reader_skill",
          displayName: "Lector de Planos",
          description: "Análisis y clasificación de documentos",
          module: "estimate",
          enabled: true,
        },
        {
          id: "4",
          name: "construction_teacher_skill",
          displayName: "Profesor de Construcción",
          description: "Explicaciones paso a paso de procesos",
          module: "learn",
          enabled: true,
        },
        {
          id: "5",
          name: "code_reference_skill",
          displayName: "Referencia de Códigos",
          description: "Consultas de building codes",
          module: "learn",
          enabled: true,
        },
        {
          id: "6",
          name: "marketing_skill",
          displayName: "Marketing",
          description: "Creación de contenido y campañas",
          module: "boost",
          enabled: true,
        },
        {
          id: "7",
          name: "proposal_writer_skill",
          displayName: "Redactor de Propuestas",
          description: "Generación de proposals profesionales",
          module: "estimate",
          enabled: true,
        },
        {
          id: "8",
          name: "email_outreach_skill",
          displayName: "Email Outreach",
          description: "Redacción de correos comerciales",
          module: "boost",
          enabled: true,
        },
        {
          id: "9",
          name: "crm_skill",
          displayName: "CRM",
          description: "Gestión de leads y clientes",
          module: "boost",
          enabled: true,
        },
        {
          id: "10",
          name: "project_manager_skill",
          displayName: "Gestor de Proyectos",
          description: "Organización y seguimiento de proyectos",
          module: "agent",
          enabled: true,
        },
        {
          id: "11",
          name: "document_skill",
          displayName: "Documentos",
          description: "Procesamiento de PDFs y archivos",
          module: "agent",
          enabled: true,
        },
        {
          id: "12",
          name: "image_analysis_skill",
          displayName: "Análisis de Imágenes",
          description: "Interpretación de planos escaneados",
          module: "estimate",
          enabled: true,
        },
      ],
      setSkills: (skills) => set({ skills }),
      toggleSkill: (id) =>
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
          ),
        })),
    }),
    {
      name: "frg-skills-storage",
    }
  )
);

// ============================================
// TOOLS STORE - Estado de herramientas
// ============================================

interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  requiredLevel: PermissionLevel;
}

interface ToolsState {
  tools: Tool[];
  setTools: (tools: Tool[]) => void;
  toggleTool: (id: string) => void;
}

export const useToolsStore = create<ToolsState>()(
  persist(
    (set) => ({
      tools: [
        {
          id: "1",
          name: "read_pdf",
          displayName: "Leer PDF",
          description: "Extraer contenido de documentos PDF",
          enabled: true,
          requiredLevel: 0,
        },
        {
          id: "2",
          name: "extract_text",
          displayName: "Extraer Texto",
          description: "Obtener texto de documentos",
          enabled: true,
          requiredLevel: 0,
        },
        {
          id: "3",
          name: "analyze_image",
          displayName: "Analizar Imagen",
          description: "Interpretar planos e imágenes",
          enabled: true,
          requiredLevel: 0,
        },
        {
          id: "4",
          name: "calculate_materials",
          displayName: "Calcular Materiales",
          description: "Computar cantidades necesarias",
          enabled: true,
          requiredLevel: 0,
        },
        {
          id: "5",
          name: "check_weather",
          displayName: "Consultar Clima",
          description: "Verificar condiciones climáticas",
          enabled: true,
          requiredLevel: 0,
        },
        {
          id: "6",
          name: "generate_proposal",
          displayName: "Generar Proposal",
          description: "Crear documento de propuesta",
          enabled: true,
          requiredLevel: 1,
        },
        {
          id: "7",
          name: "create_excel",
          displayName: "Crear Excel",
          description: "Exportar datos a hoja de cálculo",
          enabled: true,
          requiredLevel: 1,
        },
        {
          id: "8",
          name: "save_memory",
          displayName: "Guardar Memoria",
          description: "Almacenar información persistente",
          enabled: true,
          requiredLevel: 1,
        },
        {
          id: "9",
          name: "write_email",
          displayName: "Escribir Email",
          description: "Redactar correos electrónicos",
          enabled: true,
          requiredLevel: 1,
        },
        {
          id: "10",
          name: "export_reports",
          displayName: "Exportar Reportes",
          description: "Generar informes en PDF",
          enabled: true,
          requiredLevel: 2,
        },
        {
          id: "11",
          name: "schedule_post",
          displayName: "Programar Posts",
          description: "Agendar publicaciones en redes",
          enabled: true,
          requiredLevel: 2,
        },
      ],
      setTools: (tools) => set({ tools }),
      toggleTool: (id) =>
        set((state) => ({
          tools: state.tools.map((t) =>
            t.id === id ? { ...t, enabled: !t.enabled } : t
          ),
        })),
    }),
    {
      name: "frg-tools-storage",
    }
  )
);
