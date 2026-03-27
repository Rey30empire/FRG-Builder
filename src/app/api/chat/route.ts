import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import type { SkillName } from "@/types";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/default-user";

// Skill Router - Determina qué skill usar basado en el mensaje
function detectSkill(message: string): SkillName {
  const lowerMessage = message.toLowerCase();

  // Estimate skills
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

  // Learn skills
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

  // Boost skills
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

  // Agent skills
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

  // Default
  return "construction_teacher_skill";
}

// System prompts por skill
const SKILL_PROMPTS: Record<SkillName, string> = {
  estimate_skill: `Eres un experto en estimaciones de construcción. Ayudas a calcular costos de materiales, mano de obra, equipos, tiempos y riesgos. Proporciona desgloses detallados y consejos para mejorar la precisión de las estimaciones. Responde en español.`,

  takeoff_skill: `Eres un especialista en takeoff de construcción. Ayudas a extraer cantidades de planos y documentos. Explica cómo medir diferentes elementos (sf, lf, ea, etc.) y cómo interpretar planos arquitectónicos y estructurales. Responde en español.`,

  plan_reader_skill: `Eres un experto en lectura de planos de construcción. Ayudas a interpretar planos arquitectónicos, estructurales, MEP, y de especialidades. Clasificas documentos y identifies trades relevantes. Responde en español.`,

  construction_teacher_skill: `Eres un profesor experto en construcción. Explicas procesos paso a paso, desde conceptos básicos hasta avanzados. Usas ejemplos prácticos y analogías para facilitar el aprendizaje. Adaptas tu explicación al nivel del usuario. Responde en español.`,

  code_reference_skill: `Eres un consultor de códigos de construcción. Conoces IBC, IRC, NEC, y normativas locales. Ayudas a interpretar requisitos y aplicarlos correctamente. Responde en español.`,

  marketing_skill: `Eres un especialista en marketing para contratistas. Ayudas a crear contenido, campañas, y estrategias para conseguir clientes. Conoces el mercado de construcción y remodelación. Responde en español.`,

  proposal_writer_skill: `Eres un experto en redacción de propuestas comerciales. Creas documentos profesionales, persuasivos y claros. Incluyes scope, exclusiones, términos y condiciones apropiados. Responde en español.`,

  email_outreach_skill: `Eres un especialista en comunicación comercial. Redactas correos efectivos para follow-up, cold outreach, y relaciones con clientes. Tu tono es profesional pero cercano. Responde en español.`,

  crm_skill: `Eres un experto en gestión de clientes. Ayudas a organizar leads, programar seguimientos, y mantener relaciones comerciales. Sugieres mejores prácticas para CRM. Responde en español.`,

  project_manager_skill: `Eres un gerente de proyectos de construcción. Ayudas a organizar tareas, cronogramas, y recursos. Sugieres metodologías y herramientas para gestión efectiva. Responde en español.`,

  document_skill: `Eres un especialista en gestión documental. Procesas PDFs, extraes información, y organizas archivos de proyecto. Responde en español.`,

  image_analysis_skill: `Eres un analista de imágenes de construcción. Interpretas planos escaneados, fotos de sitio, y documentos visuales. Extraes información relevante para estimaciones. Responde en español.`,

  local_model_skill: `Eres un asistente de construcción especializado. Responde de manera concisa y directa. Responde en español.`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationId, userId, projectId, module } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // Detect skill
    const skill = detectSkill(message);
    const systemPrompt = SKILL_PROMPTS[skill];

    // Initialize AI
    const zai = await ZAI.create();

    // Build messages array
    let conversationHistory: Array<{ role: string; content: string }> = [];

    // Load conversation history if exists
    if (conversationId) {
      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 20, // Limit context
      });
      conversationHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
    }

    // Create or get conversation
    let conversation;
    if (conversationId) {
      conversation = await db.conversation.findUnique({
        where: { id: conversationId },
      });
    } else {
      if (!userId) {
        await ensureDefaultUser();
      }
      conversation = await db.conversation.create({
        data: {
          userId: userId || DEFAULT_USER_ID,
          projectId,
          module: module || "agent",
          title: message.slice(0, 50),
        },
      });
    }

    // Save user message
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message,
        skill,
      },
    });

    // Build final messages array
    const messages = [
      { role: "assistant", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    // Get completion
    const completion = await zai.chat.completions.create({
      messages: messages as Array<{ role: "user" | "assistant"; content: string }>,
      thinking: { type: "disabled" },
    });

    const aiResponse = completion.choices[0]?.message?.content || "No pude procesar tu solicitud. Por favor intenta de nuevo.";

    // Save assistant message
    const savedMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: aiResponse,
        skill,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: savedMessage,
        skill,
        conversationId: conversation.id,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "Conversation ID is required" },
        { status: 400 }
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
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
