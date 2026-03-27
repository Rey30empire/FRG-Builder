import { NextRequest, NextResponse } from "next/server";
import { canAccessConversation, canAccessProject, resolveScopedUserId } from "@/lib/access-control";
import {
  buildAgentInstructions,
  buildProjectContextPrompt,
  createConversationListTitle,
  generateAgentReply,
  getAiSettingsResponse,
  getProjectContext,
  runCustomConfiguredAgent,
  runSafeAgentAction,
} from "@/lib/agent-core";
import { requireSessionUser } from "@/lib/auth";
import {
  assertBillingLimit,
  BillingLimitError,
  canUsePipelineAutomationForAccount,
  ensureBillingAccount,
  recordBillingUsage,
} from "@/lib/billing";
import { detectCustomAgentMatch, loadUserCustomAgents } from "@/lib/custom-agents";
import { db } from "@/lib/db";
import { getToolAccess, resolveEnabledSkill } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeAgentWorkspaceConfig, shouldAutoRunOrchestrator } from "@/lib/user-workspace";
import type { AgentSafeAction, Module, SkillName, ToolName } from "@/types";

function getActionTool(action: AgentSafeAction): ToolName {
  if (action === "create_estimate_draft") return "create_estimate_draft";
  if (action === "generate_follow_up") return "generate_follow_up";
  if (action === "summarize_documents") return "summarize_documents";
  if (action === "run_project_orchestrator") return "run_project_orchestrator";
  return "explain_takeoff";
}

function detectSkill(message: string): SkillName {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("estim") ||
    lowerMessage.includes("costo") ||
    lowerMessage.includes("presupuesto")
  ) {
    return "estimate_skill";
  }
  if (
    lowerMessage.includes("takeoff") ||
    lowerMessage.includes("cantidad") ||
    lowerMessage.includes("medir")
  ) {
    return "takeoff_skill";
  }
  if (
    lowerMessage.includes("plano") ||
    lowerMessage.includes("pdf") ||
    lowerMessage.includes("documento")
  ) {
    return "plan_reader_skill";
  }
  if (
    lowerMessage.includes("explic") ||
    lowerMessage.includes("enseñ") ||
    lowerMessage.includes("aprender") ||
    lowerMessage.includes("cómo") ||
    lowerMessage.includes("como")
  ) {
    return "construction_teacher_skill";
  }
  if (
    lowerMessage.includes("código") ||
    lowerMessage.includes("codigo") ||
    lowerMessage.includes("norma") ||
    lowerMessage.includes("reglamento")
  ) {
    return "code_reference_skill";
  }
  if (
    lowerMessage.includes("marketing") ||
    lowerMessage.includes("contenido") ||
    lowerMessage.includes("post") ||
    lowerMessage.includes("redes")
  ) {
    return "marketing_skill";
  }
  if (
    lowerMessage.includes("propuesta") ||
    lowerMessage.includes("proposal") ||
    lowerMessage.includes("cotización")
  ) {
    return "proposal_writer_skill";
  }
  if (
    lowerMessage.includes("correo") ||
    lowerMessage.includes("email") ||
    lowerMessage.includes("follow-up")
  ) {
    return "email_outreach_skill";
  }
  if (
    lowerMessage.includes("cliente") ||
    lowerMessage.includes("lead") ||
    lowerMessage.includes("crm")
  ) {
    return "crm_skill";
  }
  if (
    lowerMessage.includes("proyecto") ||
    lowerMessage.includes("organizar") ||
    lowerMessage.includes("seguimiento")
  ) {
    return "project_manager_skill";
  }
  if (
    lowerMessage.includes("analizar") ||
    lowerMessage.includes("leer") ||
    lowerMessage.includes("archivo")
  ) {
    return "document_skill";
  }
  if (
    lowerMessage.includes("imagen") ||
    lowerMessage.includes("foto") ||
    lowerMessage.includes("escaneado")
  ) {
    return "image_analysis_skill";
  }

  return "construction_teacher_skill";
}

const SKILL_PROMPTS: Record<SkillName, string> = {
  estimate_skill:
    "Eres un experto en estimaciones de construccion. Ayudas a calcular costos, mano de obra, equipos, tiempos, riesgo y estrategia de pricing. Responde en espanol y con estructura clara.",
  takeoff_skill:
    "Eres un especialista en takeoff de construccion. Explica como medir y validar cantidades desde planos y especificaciones. Responde en espanol.",
  plan_reader_skill:
    "Eres un experto en lectura de planos y documentos de construccion. Resume sets, clasifica trades y destaca informacion accionable. Responde en espanol.",
  construction_teacher_skill:
    "Eres un profesor experto en construccion. Explica paso a paso con lenguaje claro, practico y profesional. Responde en espanol.",
  code_reference_skill:
    "Eres un consultor de codigos de construccion. Ayudas a interpretar requisitos y riesgos de cumplimiento. Responde en espanol.",
  marketing_skill:
    "Eres un especialista en marketing para contratistas. Propones copy, campanas y seguimiento comercial accionable. Responde en espanol.",
  proposal_writer_skill:
    "Eres un experto en proposals y propuestas comerciales. Priorizas claridad, scope, exclusiones, schedule y proximo paso. Responde en espanol.",
  email_outreach_skill:
    "Eres un especialista en follow-up y outreach comercial. Redactas correos claros, breves y persuasivos. Responde en espanol.",
  crm_skill:
    "Eres un experto en CRM para contractors. Ayudas a mover oportunidades, planear follow-ups y cerrar mejor. Responde en espanol.",
  project_manager_skill:
    "Eres un project manager de construccion. Organiza tareas, prioridades, timeline y dependencias. Responde en espanol.",
  document_skill:
    "Eres un especialista en gestion documental de proyectos. Resumes PDFs, detectas gaps y propones proximos pasos. Responde en espanol.",
  image_analysis_skill:
    "Eres un analista de imagenes y planos escaneados para construccion. Responde en espanol.",
  local_model_skill:
    "Eres un asistente de construccion especializado. Responde de manera concisa y util en espanol.",
};

function getActionPrompt(action: AgentSafeAction) {
  switch (action) {
    case "create_estimate_draft":
      return "Create a new estimate draft using the active project context.";
    case "generate_follow_up":
      return "Generate a follow-up draft using the active project and estimate context.";
    case "summarize_documents":
      return "Summarize the active project's documents and highlight the next review items.";
    case "explain_takeoff":
      return "Explain the current takeoff and breakdown in plain language.";
    case "run_project_orchestrator":
      return "Analyze the active project intake, review the documents, generate the estimate, and leave everything ready for review.";
    default:
      return "Run a safe agent action.";
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const limited = enforceRateLimit(
      request,
      "chat-message",
      {
        windowMs: 1000 * 60,
        max: 30,
      },
      auth.user.id
    );
    if (limited) return limited;

    const body = await request.json();
    const {
      message,
      conversationId,
      projectId: requestedProjectId,
      module,
      action,
    } = body as {
      message?: string;
      conversationId?: string;
      projectId?: string;
      module?: Module;
      action?: AgentSafeAction;
    };
    const workspace = normalizeAgentWorkspaceConfig(auth.user.userMemory?.agentWorkspaceConfig);
    const autoOrchestrate =
      !action &&
      Boolean(requestedProjectId) &&
      typeof message === "string" &&
      shouldAutoRunOrchestrator(message, workspace);
    const effectiveAction = action || (autoOrchestrate ? "run_project_orchestrator" : undefined);

    if (!message && !effectiveAction) {
      return NextResponse.json(
        { success: false, error: "Message or action is required" },
        { status: 400 }
      );
    }

    let billingAccount: Awaited<ReturnType<typeof ensureBillingAccount>> | null = null;

    if (effectiveAction) {
      const actionTool = getActionTool(effectiveAction);
      const toolAccess = await getToolAccess(auth.user, actionTool);
      if (!toolAccess.allowed) {
        return NextResponse.json(
          { success: false, error: toolAccess.reason || "This action is not allowed" },
          { status: 403 }
        );
      }

      if (
        effectiveAction === "run_project_orchestrator" &&
        !canUsePipelineAutomationForAccount(
          (billingAccount ||= await ensureBillingAccount(auth.user.id))
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "The automatic bid pipeline requires an active Pro or Growth plan.",
          },
          { status: 403 }
        );
      }
    }

    let conversation = null as Awaited<ReturnType<typeof db.conversation.findUnique>> | null;
    let projectId = requestedProjectId || null;
    let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (conversationId) {
      if (!(await canAccessConversation(auth.user, conversationId))) {
        return NextResponse.json(
          { success: false, error: "Conversation not found or access denied" },
          { status: 404 }
        );
      }

      conversation = await db.conversation.findUnique({
        where: { id: conversationId },
      });

      projectId = projectId || conversation?.projectId || null;

      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      conversationHistory = messages
        .filter((entry) => entry.role === "user" || entry.role === "assistant")
        .map((entry) => ({
          role: entry.role as "user" | "assistant",
          content: entry.content,
        }));
    }

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          userId: auth.user.id,
          projectId: projectId || undefined,
          module: module || "agent",
          title: createConversationListTitle(message || "", effectiveAction || null),
        },
      });
    }

    const normalizedMessage = (message || (effectiveAction ? getActionPrompt(effectiveAction) : "")).trim();
    const projectContext = await getProjectContext(projectId);
    const customAgentMatch = !effectiveAction
      ? detectCustomAgentMatch(
          normalizedMessage,
          await loadUserCustomAgents(auth.user.id, {
            enabledOnly: true,
            executionMode: "chat-capable",
          }),
          auth.user.level ?? 0
        )
      : null;

    if (effectiveAction || customAgentMatch) {
      await assertBillingLimit({
        userId: auth.user.id,
        metricKey: "agent_runs",
        quantity: 1,
      });
    }

    await assertBillingLimit({
      userId: auth.user.id,
      metricKey: "ai_messages",
      quantity: 1,
    });

    let skill = effectiveAction
      ? "project_manager_skill"
      : customAgentMatch
        ? customAgentMatch.agent.baseSkill
        : await resolveEnabledSkill(detectSkill(normalizedMessage));
    let tool: string | undefined;

    const userMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: normalizedMessage,
        skill,
      },
    });

    let assistantContent = "";
    let provider = "safe-action";
    let model: string | null = null;
    let agentRunId: string | undefined;

    if (effectiveAction) {
      const safeResult = await runSafeAgentAction({
        action: effectiveAction,
        userId: auth.user.id,
        userLevel: auth.user.level ?? 0,
        projectId,
        prompt: message,
        workspace,
        conversationId: conversation.id,
        trigger: autoOrchestrate ? "auto-chat" : action ? "quick-action" : "chat",
      });
      assistantContent = safeResult.content;
      skill = safeResult.skill;
      tool = safeResult.tool;
      agentRunId = safeResult.runId;
    } else if (customAgentMatch) {
      const customResult = await runCustomConfiguredAgent({
        agent: customAgentMatch.agent,
        userId: auth.user.id,
        userLevel: auth.user.level ?? 0,
        projectId,
        conversationId: conversation.id,
        message: normalizedMessage,
        messages: conversationHistory,
        workspace,
        triggerReason: customAgentMatch.reason,
      });

      assistantContent = customResult.content;
      skill = customResult.skill;
      tool = customResult.tool;
      agentRunId = customResult.runId;
      provider = customResult.provider;
      model = customResult.model;
    } else {
      const providerStatus = await getAiSettingsResponse(auth.user.id);
      const instructions = buildAgentInstructions({
        basePrompt: SKILL_PROMPTS[skill],
        projectContextPrompt: buildProjectContextPrompt(projectContext),
        providerStatus,
      });

      const reply = await generateAgentReply({
        instructions,
        messages: [...conversationHistory, { role: "user", content: normalizedMessage }],
        userId: auth.user.id,
      });

      assistantContent = reply.content;
      provider = reply.provider;
      model = reply.model;
    }

    const savedMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: assistantContent,
        skill,
        tool,
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        title: conversation.title || createConversationListTitle(normalizedMessage, effectiveAction || null),
        updatedAt: new Date(),
      },
    });

    await recordBillingUsage({
      userId: auth.user.id,
      metricKey: "ai_messages",
      quantity: 1,
      source: "chat.reply",
      referenceId: conversation.id,
      referenceType: "conversation",
      metadata: {
        provider,
        model,
        projectId,
        action: effectiveAction || null,
      },
    });

    if (effectiveAction || customAgentMatch) {
      await recordBillingUsage({
        userId: auth.user.id,
        metricKey: "agent_runs",
        quantity: 1,
        source: effectiveAction ? "chat.safe-action" : "chat.custom-agent",
        referenceId: agentRunId || conversation.id,
        referenceType: agentRunId ? "agent-run" : "conversation",
        metadata: {
          action: effectiveAction || null,
          customAgentId: customAgentMatch?.agent.id || null,
          projectId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: savedMessage,
        skill,
        tool,
        provider,
        model,
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        runId: agentRunId,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: error instanceof BillingLimitError ? error.status : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const projectId = searchParams.get("projectId");
    const moduleFilter = searchParams.get("module");
    const limit = Number(searchParams.get("limit") || 20);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));

    if (projectId && !(await canAccessProject(auth.user, projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    if (conversationId) {
      if (!(await canAccessConversation(auth.user, conversationId))) {
        return NextResponse.json(
          { success: false, error: "Conversation not found or access denied" },
          { status: 404 }
        );
      }

      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({
        success: true,
        data: messages,
      });
    }

    const conversations = await db.conversation.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
        ...(moduleFilter ? { module: moduleFilter } : {}),
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: Number.isFinite(limit) ? limit : 20,
    });

    return NextResponse.json({
      success: true,
      data: conversations.map((conversation) => ({
        id: conversation.id,
        userId: conversation.userId,
        projectId: conversation.projectId,
        title: conversation.title,
        module: conversation.module,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        preview: conversation.messages[0]?.content || "",
        messageCount: conversation._count.messages,
      })),
    });
  } catch (error) {
    console.error("Get chat error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
