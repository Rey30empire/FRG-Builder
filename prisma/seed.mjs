import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const db = new PrismaClient();

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

const defaultAiProviderConfig = JSON.stringify({
  primary: "openai",
  providers: {
    openai: { enabled: true, model: "gpt-5.2" },
    anthropic: { enabled: false, model: "claude-sonnet-4-5" },
    gemini: { enabled: false, model: "gemini-2.5-flash" },
  },
});

const defaultAgentWorkspaceConfig = {
  mode: "manual",
  autoRunOnChat: false,
  requireReviewBeforeSend: true,
  agents: {
    documentControl: { enabled: true, reviewRequired: false, requiredLevel: 1, allowedTools: ["read_pdf", "extract_text", "summarize_documents"] },
    scopeSelector: { enabled: true, reviewRequired: true, requiredLevel: 1, allowedTools: ["summarize_documents", "compare_versions", "save_memory"] },
    takeoff: { enabled: true, reviewRequired: true, requiredLevel: 1, allowedTools: ["separate_pages", "detect_scales", "explain_takeoff"] },
    estimator: { enabled: true, reviewRequired: true, requiredLevel: 1, allowedTools: ["calculate_materials", "check_weather", "check_costs", "create_estimate_draft"] },
    proposalWriter: { enabled: true, reviewRequired: true, requiredLevel: 1, allowedTools: ["generate_proposal", "create_pdf", "export_reports"] },
    bidForm: { enabled: true, reviewRequired: true, requiredLevel: 1, allowedTools: ["create_pdf", "export_reports", "save_memory"] },
    followUp: { enabled: true, reviewRequired: true, requiredLevel: 1, allowedTools: ["write_email", "generate_follow_up", "save_memory"] },
  },
};

const users = [
  {
    id: "default-user",
    email: "builder@frg.local",
    name: "FRG Builder",
    role: "admin",
    level: 4,
    password: "Builder123!",
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "general_contractor",
      preferredMargins: 18,
      overheadPercent: 12,
      emailFromName: "FRG Builder",
      emailFromAddress: "builder@frg.local",
      emailReplyTo: "builder@frg.local",
      aiProviderConfig: defaultAiProviderConfig,
      agentWorkspaceConfig: JSON.stringify(defaultAgentWorkspaceConfig),
      laborRates: JSON.stringify({
        general: 62,
        concrete: 68,
        framing: 64,
        drywall: 60,
        electrical: 82,
        plumbing: 80,
      }),
    },
  },
  {
    id: "estimator-user",
    email: "estimator@frg.local",
    name: "Estimator Mode",
    role: "user",
    level: 2,
    password: "Estimator123!",
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "subcontractor",
      preferredMargins: 14,
      overheadPercent: 10,
      emailFromName: "Estimator Mode",
      emailFromAddress: "estimator@frg.local",
      emailReplyTo: "estimator@frg.local",
      aiProviderConfig: defaultAiProviderConfig,
      agentWorkspaceConfig: JSON.stringify({
        ...defaultAgentWorkspaceConfig,
        mode: "assisted",
        autoRunOnChat: true,
      }),
      laborRates: JSON.stringify({
        general: 60,
        concrete: 66,
        framing: 62,
        drywall: 58,
        electrical: 78,
        plumbing: 76,
      }),
    },
  },
  {
    id: "sales-user",
    email: "sales@frg.local",
    name: "Sales Mode",
    role: "user",
    level: 1,
    password: "Sales123!",
    memory: {
      language: "en",
      explanationStyle: "summary",
      companyType: "business_development",
      preferredMargins: 20,
      overheadPercent: 8,
      emailFromName: "Sales Mode",
      emailFromAddress: "sales@frg.local",
      emailReplyTo: "sales@frg.local",
      aiProviderConfig: defaultAiProviderConfig,
      agentWorkspaceConfig: JSON.stringify({
        ...defaultAgentWorkspaceConfig,
        mode: "agentic",
        autoRunOnChat: true,
      }),
      laborRates: JSON.stringify({
        general: 58,
        finishes: 59,
        painting: 52,
      }),
    },
  },
];

const skills = [
  ["estimate_skill", "Estimacion", "Calculo de costos, tiempos y materiales", "estimate"],
  ["takeoff_skill", "Takeoff", "Extraccion de cantidades desde planos", "estimate"],
  ["plan_reader_skill", "Lector de Planos", "Clasificacion y lectura de PDFs", "estimate"],
  ["construction_teacher_skill", "Profesor de Construccion", "Explicaciones paso a paso", "learn"],
  ["marketing_skill", "Marketing", "Campanas y contenido comercial", "boost"],
  ["proposal_writer_skill", "Proposal Writer", "Generacion de propuestas y estimados", "estimate"],
  ["crm_skill", "CRM", "Gestion de leads y pipeline", "boost"],
  ["project_manager_skill", "Project Manager", "Seguimiento de proyectos y tareas", "agent"],
];

const tools = [
  ["read_pdf", "Leer PDF", "Extraer informacion de planos y especificaciones", 0],
  ["extract_text", "Extraer Texto", "Recuperar texto util de documentos", 0],
  ["calculate_materials", "Calcular Materiales", "Computar cantidades y rendimientos", 0],
  ["summarize_documents", "Resumir Documentos", "Crear resumen accionable de PDFs del proyecto", 0],
  ["explain_takeoff", "Explicar Takeoff", "Explicar el desglose del takeoff en lenguaje claro", 0],
  ["create_estimate_draft", "Crear Estimate Draft", "Duplicar el estimate actual a una nueva version draft", 1],
  ["run_project_orchestrator", "Orquestar Proyecto", "Analizar intake, generar estimate y dejar proposal lista para revision", 1],
  ["generate_follow_up", "Generar Follow-up", "Crear borradores comerciales de seguimiento", 1],
  ["generate_proposal", "Generar Proposal", "Construir proposal lista para envio", 1],
  ["write_email", "Escribir Email", "Redactar follow-ups y outreach", 1],
  ["export_reports", "Exportar Reportes", "Crear documentos finales y reportes", 2],
];

function getCurrentBillingPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const billingAccounts = [
  {
    userId: "default-user",
    planKey: "growth",
    status: "active",
    billingInterval: "yearly",
    stripeCustomerId: "cus_seed_growth_admin",
    stripeSubscriptionId: "sub_seed_growth_admin",
    stripePriceId: "price_seed_growth_yearly",
    stripeCheckoutSessionId: null,
    currency: "usd",
    amountCents: 199000,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2027-03-01T00:00:00.000Z"),
    trialEndsAt: null,
    checkoutCompletedAt: new Date("2026-03-01T00:05:00.000Z"),
    portalAccessedAt: null,
    metadata: JSON.stringify({ seeded: true, segment: "growth" }),
  },
  {
    userId: "estimator-user",
    planKey: "pro",
    status: "active",
    billingInterval: "monthly",
    stripeCustomerId: "cus_seed_pro_estimator",
    stripeSubscriptionId: "sub_seed_pro_estimator",
    stripePriceId: "price_seed_pro_monthly",
    stripeCheckoutSessionId: null,
    currency: "usd",
    amountCents: 7900,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    trialEndsAt: null,
    checkoutCompletedAt: new Date("2026-03-01T00:05:00.000Z"),
    portalAccessedAt: null,
    metadata: JSON.stringify({ seeded: true, segment: "pro" }),
  },
  {
    userId: "sales-user",
    planKey: "starter",
    status: "free",
    billingInterval: "monthly",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    stripeCheckoutSessionId: null,
    currency: "usd",
    amountCents: 0,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
    trialEndsAt: null,
    checkoutCompletedAt: null,
    portalAccessedAt: null,
    metadata: JSON.stringify({ seeded: true, segment: "starter" }),
  },
];

const billingUsageTemplates = [
  { userId: "default-user", metricKey: "ai_messages", quantity: 1260, source: "seed", referenceType: "seed" },
  { userId: "default-user", metricKey: "document_analyses", quantity: 182, source: "seed", referenceType: "seed" },
  { userId: "default-user", metricKey: "proposal_deliveries", quantity: 34, source: "seed", referenceType: "seed" },
  { userId: "default-user", metricKey: "agent_runs", quantity: 118, source: "seed", referenceType: "seed" },
  { userId: "estimator-user", metricKey: "ai_messages", quantity: 640, source: "seed", referenceType: "seed" },
  { userId: "estimator-user", metricKey: "document_analyses", quantity: 78, source: "seed", referenceType: "seed" },
  { userId: "estimator-user", metricKey: "proposal_deliveries", quantity: 16, source: "seed", referenceType: "seed" },
  { userId: "estimator-user", metricKey: "agent_runs", quantity: 41, source: "seed", referenceType: "seed" },
  { userId: "sales-user", metricKey: "ai_messages", quantity: 44, source: "seed", referenceType: "seed" },
  { userId: "sales-user", metricKey: "document_analyses", quantity: 7, source: "seed", referenceType: "seed" },
  { userId: "sales-user", metricKey: "proposal_deliveries", quantity: 3, source: "seed", referenceType: "seed" },
  { userId: "sales-user", metricKey: "agent_runs", quantity: 5, source: "seed", referenceType: "seed" },
];

const customAgents = [
  {
    userId: "default-user",
    slug: "scope-auditor",
    name: "Scope Auditor",
    description: "Reviews bid intake, scope gaps, and missing files before takeoff.",
    instructions:
      "Review the bid package like a senior estimator. Flag missing scope, unclear inclusions, addenda risk, and what should be manually reviewed before takeoff continues.",
    baseSkill: "project_manager_skill",
    enabled: true,
    autoRun: true,
    includeProjectContext: true,
    includeDocumentSummary: true,
    includeEstimateSnapshot: false,
    executionMode: "both",
    pipelineStage: "preflight",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: JSON.stringify(["summarize_documents", "compare_versions", "save_memory"]),
    triggerPhrases: JSON.stringify(["scope gap", "review addenda", "missing files", "scope audit"]),
    successCriteria:
      "Return missing files, risk notes, scope clarifications needed, and the next estimator action.",
    outputSchema: "Summary / Missing files / Scope risks / Human review / Next action",
    sortOrder: 1,
  },
  {
    userId: "default-user",
    slug: "bid-qa",
    name: "Bid QA",
    description: "Reviews the proposal, bid form and submit package before delivery.",
    instructions:
      "Audit the outgoing proposal package as a quality-control reviewer. Check readiness to submit, consistency across estimate, bid form and proposal, and call out anything that should block delivery.",
    baseSkill: "proposal_writer_skill",
    enabled: true,
    autoRun: false,
    includeProjectContext: true,
    includeDocumentSummary: false,
    includeEstimateSnapshot: true,
    executionMode: "pipeline",
    pipelineStage: "delivery",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: JSON.stringify(["generate_proposal", "create_pdf", "save_memory"]),
    triggerPhrases: JSON.stringify(["qa proposal", "review bid package"]),
    successCriteria:
      "Return go/no-go, missing attachments, client-facing copy issues, and submission blockers.",
    outputSchema: "Go or No-Go / Issues / Attachments / Revisions / Ready to send",
    sortOrder: 2,
  },
  {
    userId: "sales-user",
    slug: "closeout-followup",
    name: "Closeout Follow-up",
    description: "Creates sharp follow-up strategy after proposal delivery.",
    instructions:
      "Act like a commercial closer. Draft the next follow-up steps after proposal delivery, balancing urgency and professionalism.",
    baseSkill: "email_outreach_skill",
    enabled: true,
    autoRun: true,
    includeProjectContext: true,
    includeDocumentSummary: false,
    includeEstimateSnapshot: true,
    executionMode: "both",
    pipelineStage: "followup",
    requiredLevel: 1,
    reviewRequired: true,
    allowedTools: JSON.stringify(["generate_follow_up", "write_email", "save_memory"]),
    triggerPhrases: JSON.stringify(["follow up the bid", "close the client", "send reminder"]),
    successCriteria:
      "Return next contact timing, exact message direction, and what objection to address next.",
    outputSchema: "Objective / Timing / Suggested message / Objection to address / Next step",
    sortOrder: 1,
  },
];

async function seedUsers() {
  for (const user of users) {
    await db.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        passwordHash: hashPassword(user.password),
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        passwordHash: hashPassword(user.password),
      },
    });

    await db.userMemory.upsert({
      where: { userId: user.id },
      update: user.memory,
      create: {
        userId: user.id,
        ...user.memory,
      },
    });
  }

  return users;
}

async function seedCustomAgents() {
  for (const agent of customAgents) {
    await db.customAgent.upsert({
      where: {
        userId_slug: {
          userId: agent.userId,
          slug: agent.slug,
        },
      },
      update: agent,
      create: agent,
    });
  }

  return db.customAgent.count();
}

async function seedBilling() {
  const accountsByUserId = new Map();

  for (const template of billingAccounts) {
    const account = await db.billingAccount.upsert({
      where: { userId: template.userId },
      update: template,
      create: template,
    });

    accountsByUserId.set(template.userId, account);
  }

  await db.billingUsageEvent.deleteMany({
    where: {
      source: "seed",
    },
  });

  const periodKey = getCurrentBillingPeriodKey();

  for (const template of billingUsageTemplates) {
    const account = accountsByUserId.get(template.userId);
    if (!account) continue;

    await db.billingUsageEvent.create({
      data: {
        billingAccountId: account.id,
        userId: template.userId,
        metricKey: template.metricKey,
        quantity: template.quantity,
        source: template.source,
        referenceType: template.referenceType,
        periodKey,
        metadata: JSON.stringify({ seeded: true }),
      },
    });
  }
}

async function seedCompanyMemory() {
  const payload = {
    name: "FRG LLC",
    specialties: JSON.stringify(["Framing", "Concrete", "Renovation", "Bid Support"]),
    workZones: JSON.stringify(["Los Angeles", "Orange County", "Inland Empire"]),
    crewInfo: JSON.stringify({ estimators: 2, fieldCrew: 8, office: 2 }),
    baseRates: JSON.stringify({
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
    }),
    primaryColor: "#f97316",
    proposalTemplate: "default-proposal-v1",
    aiProviderConfig: JSON.stringify({
      primary: "openai",
      providers: {
        openai: { enabled: true, model: "gpt-5.2" },
        anthropic: { enabled: false, model: "claude-sonnet-4-5" },
        gemini: { enabled: false, model: "gemini-2.5-flash" },
      },
    }),
  };

  const existing = await db.companyMemory.findFirst();
  if (existing) {
    return db.companyMemory.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return db.companyMemory.create({ data: payload });
}

function getProjectTemplates(userId) {
  if (userId === "estimator-user") {
    return [
      {
        name: "Estimator Demo - Concrete Rehab",
        address: "620 Pine St, Long Beach, CA",
        client: "West Harbor Properties",
        clientEmail: "estimating@westharborproperties.com",
        clientPhone: "(555) 810-2201",
        deadline: new Date("2026-04-12"),
        status: "active",
        notes: "Focused on quantity accuracy and crew assumptions.",
        exclusions: ["Shoring engineering"],
        documents: [
          {
            name: "Concrete Rehab Set",
            originalName: "concrete-rehab-set.pdf",
            type: "application/pdf",
            path: "/uploads/documents/concrete-rehab-set.pdf",
            size: 1620000,
            trade: "Concrete",
            category: "plan",
            analyzed: true,
            analysisResult: JSON.stringify({ sheets: ["S1.0", "S2.1"] }),
          },
        ],
        estimate: {
          name: "Concrete Rehab Estimate",
          version: 1,
          status: "draft",
          materialsCost: 28400,
          laborCost: 22150,
          equipmentCost: 5100,
          subtotal: 55650,
          overhead: 5565,
          profit: 8347.5,
          total: 69562.5,
          duration: 24,
          weatherFactor: 1.03,
          riskFactor: 1.05,
          takeoffItems: [
            {
              trade: "Concrete",
              description: "Patch and reform edge slab",
              quantity: 18,
              unit: "CY",
              materialCost: 6100,
              laborCost: 4900,
              totalCost: 11000,
              sourcePage: "S1.0",
              sourceDocument: "concrete-rehab-set.pdf",
            },
          ],
        },
      },
      {
        name: "Estimator Demo - Metal Stud TI",
        address: "112 Grand Ave, Glendale, CA",
        client: "Summit Interiors",
        clientEmail: "precon@summitinteriors.com",
        clientPhone: "(555) 810-2202",
        deadline: new Date("2026-04-25"),
        status: "active",
        notes: "Good sample for drywall and framing alternates.",
        exclusions: ["Finish carpentry"],
        documents: [
          {
            name: "Metal Stud Package",
            originalName: "metal-stud-package.pdf",
            type: "application/pdf",
            path: "/uploads/documents/metal-stud-package.pdf",
            size: 1910000,
            trade: "Framing",
            category: "plan",
            analyzed: true,
            analysisResult: JSON.stringify({ walls: 44, ceilings: 7 }),
          },
        ],
        estimate: {
          name: "Metal Stud TI Bid",
          version: 1,
          status: "review",
          materialsCost: 36250,
          laborCost: 28950,
          equipmentCost: 4200,
          subtotal: 69400,
          overhead: 6940,
          profit: 10410,
          total: 86750,
          duration: 31,
          weatherFactor: 1,
          riskFactor: 1.04,
          takeoffItems: [
            {
              trade: "Framing",
              description: "3 5/8 metal studs",
              quantity: 2400,
              unit: "LF",
              materialCost: 11800,
              laborCost: 9100,
              totalCost: 20900,
              sourcePage: "A3.2",
              sourceDocument: "metal-stud-package.pdf",
            },
          ],
        },
      },
    ];
  }

  if (userId === "sales-user") {
    return [
      {
        name: "Sales Demo - ADU Preconstruction",
        address: "845 Oak Ave, Pasadena, CA",
        client: "Fernandez Family",
        clientEmail: "fernandez.family@example.com",
        clientPhone: "(555) 810-2203",
        deadline: new Date("2026-05-08"),
        status: "active",
        notes: "Proposal version for owner financing review.",
        exclusions: ["Landscape", "Utility meter fees"],
        documents: [
          {
            name: "ADU Full Set",
            originalName: "adu-full-set.pdf",
            type: "application/pdf",
            path: "/uploads/documents/adu-full-set.pdf",
            size: 2150000,
            trade: "General",
            category: "plan",
            analyzed: true,
            analysisResult: JSON.stringify({ bedrooms: 2, bathrooms: 1 }),
          },
        ],
        estimate: {
          name: "ADU Sales Proposal",
          version: 1,
          status: "sent",
          materialsCost: 58900,
          laborCost: 41250,
          equipmentCost: 8200,
          subtotal: 108350,
          overhead: 10835,
          profit: 16252.5,
          total: 135437.5,
          duration: 68,
          weatherFactor: 1.01,
          riskFactor: 1.08,
          takeoffItems: [
            {
              trade: "Concrete",
              description: "Slab and footings",
              quantity: 32,
              unit: "CY",
              materialCost: 7200,
              laborCost: 5600,
              totalCost: 12800,
              sourcePage: "S1.0",
              sourceDocument: "adu-full-set.pdf",
            },
          ],
        },
      },
    ];
  }

  return [
    {
      name: "Downtown Office TI",
      address: "123 Main St, Los Angeles, CA",
      client: "Atlas Commercial",
      clientEmail: "precon@atlascommercial.com",
      clientPhone: "(555) 810-1201",
      deadline: new Date("2026-04-20"),
      status: "active",
      notes: "Tenant improvement with phased demolition and framing.",
      exclusions: ["Furniture", "Fire alarm programming"],
      documents: [
        {
          name: "Architectural Core Plans",
          originalName: "architectural-core-plans.pdf",
          type: "application/pdf",
          path: "/uploads/documents/architectural-core-plans.pdf",
          size: 2480000,
          trade: "Architecture",
          category: "plan",
          analyzed: true,
          analysisResult: JSON.stringify({ pages: 24, sheets: ["A1.1", "A2.0"] }),
        },
        {
          name: "Structural Notes",
          originalName: "structural-notes.pdf",
          type: "application/pdf",
          path: "/uploads/documents/structural-notes.pdf",
          size: 1280000,
          trade: "Structural",
          category: "spec",
          analyzed: false,
        },
      ],
      estimate: {
        name: "Office TI Estimate",
        version: 1,
        status: "draft",
        materialsCost: 42500,
        laborCost: 31800,
        equipmentCost: 6400,
        subtotal: 80700,
        overhead: 8070,
        profit: 12105,
        total: 100875,
        duration: 42,
        weatherFactor: 1.02,
        riskFactor: 1.06,
        takeoffItems: [
          {
            trade: "Framing",
            description: "Metal stud partitions",
            quantity: 1850,
            unit: "LF",
            materialCost: 15600,
            laborCost: 11800,
            totalCost: 27400,
            sourcePage: "A3.1",
            sourceDocument: "architectural-core-plans.pdf",
          },
          {
            trade: "Drywall",
            description: "5/8 Type X drywall",
            quantity: 9600,
            unit: "SF",
            materialCost: 13200,
            laborCost: 9800,
            totalCost: 23000,
            sourcePage: "A5.0",
            sourceDocument: "architectural-core-plans.pdf",
          },
        ],
      },
    },
    {
      name: "Garden ADU Build",
      address: "845 Oak Ave, Pasadena, CA",
      client: "Fernandez Family",
      clientEmail: "fernandez.family@example.com",
      clientPhone: "(555) 810-1202",
      deadline: new Date("2026-05-08"),
      status: "active",
      notes: "Need proposal version for owner financing review.",
      exclusions: ["Landscape", "Utility meter fees"],
      documents: [
        {
          name: "ADU Full Set",
          originalName: "adu-full-set.pdf",
          type: "application/pdf",
          path: "/uploads/documents/adu-full-set.pdf",
          size: 2150000,
          trade: "General",
          category: "plan",
          analyzed: true,
          analysisResult: JSON.stringify({ bedrooms: 2, bathrooms: 1 }),
        },
      ],
      estimate: {
        name: "ADU Base Estimate",
        version: 1,
        status: "review",
        materialsCost: 58900,
        laborCost: 41250,
        equipmentCost: 8200,
        subtotal: 108350,
        overhead: 10835,
        profit: 16252.5,
        total: 135437.5,
        duration: 68,
        weatherFactor: 1.01,
        riskFactor: 1.08,
        takeoffItems: [
          {
            trade: "Concrete",
            description: "Slab and footings",
            quantity: 32,
            unit: "CY",
            materialCost: 7200,
            laborCost: 5600,
            totalCost: 12800,
            sourcePage: "S1.0",
            sourceDocument: "adu-full-set.pdf",
          },
        ],
      },
    },
    {
      name: "Retail Refresh Package",
      address: "450 Market Blvd, Burbank, CA",
      client: "Northview Retail",
      clientEmail: "ops@northviewretail.com",
      clientPhone: "(555) 810-1203",
      deadline: new Date("2026-03-30"),
      status: "completed",
      notes: "Use as reference for similar quick-turn proposals.",
      exclusions: ["Store fixtures"],
      documents: [
        {
          name: "Retail Finish Schedule",
          originalName: "retail-finish-schedule.pdf",
          type: "application/pdf",
          path: "/uploads/documents/retail-finish-schedule.pdf",
          size: 980000,
          trade: "Finishes",
          category: "spec",
          analyzed: true,
          analysisResult: JSON.stringify({ finishCount: 17 }),
        },
      ],
      estimate: {
        name: "Retail Refresh Final",
        version: 1,
        status: "sent",
        materialsCost: 18400,
        laborCost: 14650,
        equipmentCost: 2400,
        subtotal: 35450,
        overhead: 3545,
        profit: 5317.5,
        total: 44312.5,
        duration: 18,
        weatherFactor: 1,
        riskFactor: 1.03,
        takeoffItems: [
          {
            trade: "Painting",
            description: "Interior repaint",
            quantity: 6400,
            unit: "SF",
            materialCost: 5200,
            laborCost: 4700,
            totalCost: 9900,
            sourcePage: "F1.2",
            sourceDocument: "retail-finish-schedule.pdf",
          },
        ],
      },
    },
  ];
}

async function seedProjects(userId) {
  const count = await db.project.count({ where: { userId } });
  if (count > 0) return;

  const projects = getProjectTemplates(userId);

  for (const project of projects) {
    await db.project.create({
      data: {
        userId,
        name: project.name,
        address: project.address,
        client: project.client,
        clientEmail: project.clientEmail,
        clientPhone: project.clientPhone,
        deadline: project.deadline,
        status: project.status,
        projectMemory: {
          create: {
            notes: project.notes,
            exclusions: JSON.stringify(project.exclusions),
          },
        },
        documents: {
          create: project.documents,
        },
        estimates: {
          create: {
            name: project.estimate.name,
            version: project.estimate.version,
            status: project.estimate.status,
            materialsCost: project.estimate.materialsCost,
            laborCost: project.estimate.laborCost,
            equipmentCost: project.estimate.equipmentCost,
            subtotal: project.estimate.subtotal,
            overhead: project.estimate.overhead,
            profit: project.estimate.profit,
            total: project.estimate.total,
            duration: project.estimate.duration,
            weatherFactor: project.estimate.weatherFactor,
            riskFactor: project.estimate.riskFactor,
            takeoffItems: {
              create: project.estimate.takeoffItems,
            },
          },
        },
      },
    });
  }
}

function getBidOpportunityTemplates(userId, projects) {
  const primaryProject = projects[0] || null;
  const secondaryProject = projects[1] || null;
  const completedProject = projects.find((project) => project.status === "completed") || projects[2] || null;

  if (userId === "sales-user") {
    return [
      {
        name: "Pasadena ADU - Bid Invite",
        client: "Fernandez Family",
        clientEmail: "fernandez.family@example.com",
        estimatorContact: "Ana Ruiz",
        dueDate: new Date("2026-04-11T17:00:00"),
        jobWalkDate: new Date("2026-04-03T10:00:00"),
        rfiDueDate: new Date("2026-04-05T17:00:00"),
        projectSize: "1,120 sq.ft.",
        location: "Pasadena, CA",
        address: "845 Oak Ave, Pasadena, CA",
        scopePackage: "ADU shell, interiors and exterior finishes",
        description: "Owner-requested proposal for detached ADU with quick financing review.",
        tradeInstructions: "Include base scope plus alternate for upgraded kitchen package.",
        bidFormRequired: true,
        bidFormInstructions: "Summarize alternates on a separate sheet.",
        source: "manual-intake",
        status: "accepted",
        notes: "Sales-led opportunity; keep proposal language client-friendly.",
        projectId: primaryProject?.id,
      },
      {
        name: "Beverly Hills Tenant Refresh",
        client: "Westline Hospitality",
        clientEmail: "precon@westlinehospitality.com",
        estimatorContact: "Chris Neal",
        dueDate: new Date("2026-04-18T14:00:00"),
        projectSize: "9,400 sq.ft.",
        location: "Beverly Hills, CA",
        address: "301 Canon Dr, Beverly Hills, CA",
        scopePackage: "Lobby and restroom refresh",
        description: "Interior refresh with finish schedule, owner standards and brand review.",
        tradeInstructions: "Focus on finishes, paint and restroom accessories.",
        bidFormRequired: false,
        source: "broker-referral",
        status: "undecided",
        notes: "Waiting on final finish schedule upload.",
      },
    ];
  }

  if (userId === "estimator-user") {
    return [
      {
        name: "Sanger Brake Shop Retrofit",
        client: "Maddwell Construction",
        clientEmail: "estimating@maddwellconstruction.com",
        estimatorContact: "Brandon Carter",
        dueDate: new Date("2026-04-09T12:00:00"),
        jobWalkDate: new Date("2026-04-02T09:00:00"),
        rfiDueDate: new Date("2026-04-04T16:00:00"),
        projectSize: "6,800 sq.ft.",
        location: "Sanger, TX",
        address: "1022 Industrial Loop, Sanger, TX",
        scopePackage: "Concrete rehab and light framing",
        description: "Bid package includes structural notes, demo plans and concrete details.",
        tradeInstructions: "Track slab repair separately from tenant improvement scope.",
        bidFormRequired: true,
        bidFormInstructions: "List exclusions below base bid.",
        source: "buildingconnected-import",
        status: "accepted",
        notes: "Estimator-focused package with high quantity sensitivity.",
        projectId: primaryProject?.id,
      },
      {
        name: "Frisco Retail Finish-Out",
        client: "20 Twenty Construction",
        clientEmail: "estimating@20twentyconstruction.com",
        estimatorContact: "Estimating Team",
        dueDate: new Date("2026-04-16T17:00:00"),
        jobWalkDate: new Date("2026-04-08T11:00:00"),
        projectSize: "2,780 sq.ft.",
        location: "Frisco, TX",
        address: "705 University Dr, Frisco, TX",
        scopePackage: "Toilet partitions and bathroom accessories",
        description: "Fast-turn bid requiring scope confirmation and proposal form.",
        tradeInstructions: "Confirm owner-furnished items before final number.",
        bidFormRequired: true,
        bidFormInstructions: "Carry one line item and attach formal proposal.",
        source: "buildingconnected-import",
        status: "undecided",
        notes: "Good test case for high-volume bid intake.",
      },
    ];
  }

  return [
    {
      name: "Saucy_Frisco",
      client: "20 Twenty Construction",
      clientEmail: "estimating@20twentyconstruction.com",
      estimatorContact: "Estimating Team",
      dueDate: new Date("2026-04-14T17:00:00"),
      jobWalkDate: new Date("2026-04-07T09:30:00"),
      rfiDueDate: new Date("2026-04-09T17:00:00"),
      projectSize: "2,780 sq.ft.",
      location: "Frisco, TX",
      address: "705 University Dr, Frisco, TX",
      scopePackage: "Toilet partitions & bathroom accessories",
      description: "Client sent multiple PDFs, plans, schedule and bid form for a restroom package.",
      tradeInstructions: "Select only restroom accessory sheets and relevant scope notes for takeoff.",
      bidFormRequired: true,
      bidFormInstructions: "Use one line item and attach formal proposal PDF.",
      source: "buildingconnected-import",
      externalUrl: "https://app.buildingconnected.com/",
      status: "undecided",
      notes: "Model this one closely after the BuildingConnected workflow.",
    },
    {
      name: "Downtown Office TI - Bid Package",
      client: primaryProject?.client || "Atlas Commercial",
      clientEmail: primaryProject?.clientEmail || "precon@atlascommercial.com",
      estimatorContact: "Luis Mendoza",
      dueDate: new Date("2026-04-20T14:00:00"),
      jobWalkDate: new Date("2026-04-10T08:00:00"),
      projectSize: "18,600 sq.ft.",
      location: "Los Angeles, CA",
      address: primaryProject?.address || "123 Main St, Los Angeles, CA",
      scopePackage: "Framing, drywall and finishes",
      description: "Tenant improvement package with phased demolition and framing alternates.",
      tradeInstructions: "Separate base bid from alternate partition package.",
      bidFormRequired: true,
      bidFormInstructions: "Client wants alternates summarized on the form and again in the proposal.",
      source: "manual-intake",
      status: "accepted",
      notes: "Already converted into an estimating project.",
      projectId: primaryProject?.id,
    },
    {
      name: "Retail Refresh Package - Closeout",
      client: completedProject?.client || "Northview Retail",
      clientEmail: completedProject?.clientEmail || "ops@northviewretail.com",
      estimatorContact: "Tina Flores",
      dueDate: new Date("2026-03-30T12:00:00"),
      projectSize: "4,200 sq.ft.",
      location: "Burbank, CA",
      address: completedProject?.address || "450 Market Blvd, Burbank, CA",
      scopePackage: "Painting and finish refresh",
      description: "Reference opportunity already sent and tracked to completion.",
      tradeInstructions: "Keep for bid board history and close-rate tracking.",
      bidFormRequired: false,
      source: "manual-intake",
      status: completedProject ? "submitted" : "archived",
      notes: "Useful seed example for submitted history.",
      projectId: completedProject?.id,
    },
    {
      name: "Garden ADU Expansion - Negotiated Win",
      client: secondaryProject?.client || "Fernandez Family",
      clientEmail: secondaryProject?.clientEmail || "fernandez.family@example.com",
      estimatorContact: "Owner Rep",
      dueDate: new Date("2026-05-01T17:00:00"),
      projectSize: "1,120 sq.ft.",
      location: "Pasadena, CA",
      address: secondaryProject?.address || "845 Oak Ave, Pasadena, CA",
      scopePackage: "ADU expansion negotiated award",
      description: "Negotiated follow-on scope after base estimate review.",
      tradeInstructions: "Use as a won board example and pipeline reference.",
      bidFormRequired: false,
      source: "direct-award",
      status: "won",
      notes: "Awarded opportunity tied to active project.",
      projectId: secondaryProject?.id,
    },
  ];
}

async function seedBidOpportunities(userId) {
  const count = await db.bidOpportunity.count({ where: { userId } });
  if (count > 0) return;

  const projects = await db.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const opportunities = getBidOpportunityTemplates(userId, projects);

  for (const opportunity of opportunities) {
    await db.bidOpportunity.create({
      data: {
        userId,
        ...opportunity,
      },
    });
  }
}

function getLearningTemplates(userId) {
  if (userId === "sales-user") {
    return [
      {
        title: "Proposal Follow-up Strategy",
        category: "sales",
        level: "intermediate",
        type: "lesson",
        completed: true,
        progress: 100,
        bookmarked: true,
        score: 92,
        timeSpent: 42,
        lastStudiedAt: new Date("2026-03-24"),
        content: JSON.stringify({
          summary: "How to recover silent proposals with structured follow-up.",
          keyPoints: [
            "Send the first follow-up within 48 to 72 hours.",
            "Restate value, not just price.",
            "End with one clear next step.",
          ],
          calculators: [
            { name: "Follow-up cadence", description: "Plan 3 to 5 touches over 14 days." },
          ],
          codeRefs: [],
          resources: ["Proposal checklist", "Client response matrix"],
        }),
      },
      {
        title: "Commercial Outreach Copy",
        category: "marketing",
        level: "beginner",
        type: "exercise",
        completed: false,
        progress: 35,
        bookmarked: false,
        timeSpent: 18,
        lastStudiedAt: new Date("2026-03-21"),
        content: JSON.stringify({
          summary: "Message framing for LinkedIn and email.",
          keyPoints: [
            "Lead with the outcome the client wants.",
            "Keep first-touch outreach short.",
            "Use one CTA only.",
          ],
          calculators: [],
          codeRefs: [],
          resources: ["LinkedIn opener examples", "Cold outreach subject lines"],
        }),
      },
    ];
  }

  return [
    {
      title: "Plan Reading for Tenant Improvements",
      category: "plan-reading",
      level: "intermediate",
      type: "lesson",
      completed: true,
      progress: 100,
      bookmarked: true,
      score: 95,
      timeSpent: 75,
      lastStudiedAt: new Date("2026-03-26"),
      content: JSON.stringify({
        summary: "How to map scope, sheets and addenda.",
        keyPoints: [
          "Identify the discipline set first.",
          "Track sheet references and revisions.",
          "Flag addenda before quantities are finalized.",
        ],
        calculators: [
          { name: "Sheet coverage check", description: "Confirm all referenced sheets exist in the set." },
        ],
        codeRefs: [
          { title: "Document control", code: "Best Practice", note: "Always compare current set vs addenda." },
        ],
        resources: ["Plan review checklist", "Addenda log"],
      }),
    },
    {
      title: "Concrete Takeoff Basics",
      category: "concrete",
      level: "beginner",
      type: "lesson",
      completed: false,
      progress: 45,
      bookmarked: false,
      timeSpent: 35,
      lastStudiedAt: new Date("2026-03-23"),
      content: JSON.stringify({
        summary: "Foundation quantities and waste factors.",
        keyPoints: [
          "Separate footing, slab and wall volumes.",
          "Use consistent units before pricing.",
          "Add waste intentionally, not by guesswork.",
        ],
        calculators: [
          { name: "Concrete volume", description: "CY conversion from dimensions." },
          { name: "Waste factor", description: "Apply standard contingency to pours." },
        ],
        codeRefs: [
          { title: "ACI references", code: "ACI", note: "Check placement and tolerance requirements." },
        ],
        resources: ["CY conversion chart", "Foundation checklist"],
      }),
    },
    {
      title: "Proposal Writing Checklist",
      category: "sales",
      level: "intermediate",
      type: "exercise",
      completed: false,
      progress: 60,
      bookmarked: true,
      timeSpent: 20,
      lastStudiedAt: new Date("2026-03-22"),
      content: JSON.stringify({
        summary: "Use a repeatable checklist before every send.",
        keyPoints: ["Scope", "Exclusions", "Schedule", "Terms"],
        calculators: [],
        codeRefs: [],
        resources: ["Proposal QA checklist", "Client-ready scope summary"],
      }),
    },
    {
      title: "Labor Burden and Markups",
      category: "estimating",
      level: "advanced",
      type: "lesson",
      completed: true,
      progress: 100,
      bookmarked: false,
      score: 88,
      timeSpent: 55,
      lastStudiedAt: new Date("2026-03-20"),
      content: JSON.stringify({
        summary: "Margin, markup, overhead and profit relationships.",
        keyPoints: [
          "Markup and margin are not interchangeable.",
          "Burden must include payroll taxes and insurance.",
          "Protect margin before discounting.",
        ],
        calculators: [
          { name: "Margin vs markup", description: "Compare selling price outcomes." },
        ],
        codeRefs: [],
        resources: ["Burden worksheet", "Pricing review guide"],
      }),
    },
  ];
}

async function seedLearning(userId) {
  const templates = getLearningTemplates(userId);

  for (const item of templates) {
    const existing = await db.learningItem.findFirst({
      where: {
        userId,
        title: item.title,
      },
    });

    if (existing) {
      await db.learningItem.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await db.learningItem.create({
        data: { ...item, userId },
      });
    }
  }
}

function getBoostTemplates(userId) {
  if (userId === "sales-user") {
    return {
      leads: [
        {
          userId,
          name: "Helena Brooks",
          email: "helena@urbanretail.com",
          phone: "(555) 212-4410",
          company: "Urban Retail Group",
          source: "linkedin",
          status: "proposal",
          priority: "high",
          estimatedValue: 210000,
          lastContactAt: new Date("2026-03-24"),
          expectedCloseDate: new Date("2026-04-04"),
          notes: "Proposal in review for two-store refresh around $210,000.",
          nextFollowUp: new Date("2026-03-28"),
        },
        {
          userId,
          name: "Cesar Morales",
          email: "cesar@aduprojects.co",
          phone: "(555) 330-1902",
          company: "ADU Projects Co",
          source: "website",
          status: "contacted",
          priority: "medium",
          estimatedValue: 95000,
          lastContactAt: new Date("2026-03-22"),
          expectedCloseDate: new Date("2026-04-12"),
          notes: "Looking for preconstruction pricing package around $95,000.",
          nextFollowUp: new Date("2026-03-30"),
        },
      ],
      campaigns: [
        {
          userId,
          name: "LinkedIn Retail Refresh Push",
          type: "social",
          target: "Retail operators",
          status: "active",
          budget: 1500,
          scheduledAt: new Date("2026-03-15"),
          launchedAt: new Date("2026-03-16"),
          sent: 95,
          opened: 42,
          clicked: 14,
          converted: 3,
          content: JSON.stringify({
            CTA: "Book a scope review",
            angle: "Retail refresh without store downtime surprises",
            channel: "linkedin",
          }),
        },
      ],
    };
  }

  return {
    leads: [
      {
        userId,
        name: "Sarah Chen",
        email: "sarah@atlascommercial.com",
        phone: "(555) 104-2001",
        company: "Atlas Commercial",
        source: "referral",
        status: "qualified",
        priority: "high",
        estimatedValue: 85000,
        lastContactAt: new Date("2026-03-23"),
        expectedCloseDate: new Date("2026-04-10"),
        notes: "Warehouse refresh opportunity around $85,000.",
        nextFollowUp: new Date("2026-03-28"),
      },
      {
        userId,
        name: "Miguel Torres",
        email: "miguel@ownerbuild.co",
        phone: "(555) 330-1188",
        company: "OwnerBuild Co",
        source: "website",
        status: "proposal",
        priority: "high",
        estimatedValue: 140000,
        lastContactAt: new Date("2026-03-25"),
        expectedCloseDate: new Date("2026-04-08"),
        notes: "ADU lead estimated around $140,000 and waiting for financing.",
        nextFollowUp: new Date("2026-03-29"),
      },
      {
        userId,
        name: "Nina Patel",
        email: "nina@northviewretail.com",
        phone: "(555) 800-4400",
        company: "Northview Retail",
        source: "linkedin",
        status: "contacted",
        priority: "medium",
        estimatedValue: 60000,
        lastContactAt: new Date("2026-03-20"),
        expectedCloseDate: new Date("2026-04-18"),
        notes: "Potential recurring store refresh work around $60,000.",
        nextFollowUp: new Date("2026-03-31"),
      },
    ],
    campaigns: [
      {
        userId,
        name: "Spring TI Outreach",
        type: "email",
        target: "Commercial tenant improvements",
        status: "active",
        budget: 3200,
        scheduledAt: new Date("2026-03-10"),
        launchedAt: new Date("2026-03-12"),
        sent: 180,
        opened: 74,
        clicked: 26,
        converted: 4,
        content: JSON.stringify({ CTA: "Book a plan review call" }),
      },
      {
        userId,
        name: "ADU Case Study Push",
        type: "social",
        target: "Residential owners",
        status: "scheduled",
        budget: 1200,
        scheduledAt: new Date("2026-04-02"),
        sent: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        content: JSON.stringify({
          CTA: "Request a feasibility estimate",
          vertical: "ADU",
          channel: "social",
        }),
      },
    ],
  };
}

async function seedBoost(userId) {
  const templates = getBoostTemplates(userId);

  for (const lead of templates.leads) {
    const existingLead = await db.lead.findFirst({
      where: {
        userId,
        name: lead.name,
      },
    });

    if (existingLead) {
      const { userId: _leadUserId, ...leadUpdates } = lead;
      await db.lead.update({
        where: { id: existingLead.id },
        data: leadUpdates,
      });
    } else {
      await db.lead.create({
        data: lead,
      });
    }
  }

  for (const campaign of templates.campaigns) {
    const existingCampaign = await db.campaign.findFirst({
      where: {
        userId,
        name: campaign.name,
      },
    });

    if (existingCampaign) {
      const { userId: _campaignUserId, ...campaignUpdates } = campaign;
      await db.campaign.update({
        where: { id: existingCampaign.id },
        data: campaignUpdates,
      });
    } else {
      await db.campaign.create({
        data: campaign,
      });
    }
  }
}

async function seedEmails(userId) {
  if ((await db.email.count({ where: { userId } })) > 0) {
    return;
  }

  const project = await db.project.findFirst({
    where: { userId },
    include: {
      estimates: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const lead = await db.lead.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  if (!project) {
    return;
  }

  const proposalEstimate = project.estimates[0];

  await db.email.createMany({
    data: [
      {
        userId,
        leadId: lead?.id,
        projectId: project.id,
        estimateId: proposalEstimate?.id,
        subject: `Proposal summary for ${project.name}`,
        body: `Attached is the current proposal summary for ${project.name}. Let me know if you want a revised scope breakdown or updated exclusions before approval.`,
        type: "proposal",
        status: "sent",
        sentAt: new Date("2026-03-20T18:00:00.000Z"),
        metadata: JSON.stringify({
          attachmentLabel: "Proposal PDF",
          attachmentUrl: proposalEstimate
            ? `/api/proposals/pdf?estimateId=${proposalEstimate.id}`
            : null,
          template: "proposal-delivery",
        }),
      },
      {
        userId,
        leadId: lead?.id,
        projectId: project.id,
        estimateId: proposalEstimate?.id,
        subject: `Follow-up on ${project.name}`,
        body: `Checking whether the team had a chance to review the proposal and schedule assumptions for ${project.name}. Happy to revise and resend if needed.`,
        type: "followup",
        status: "draft",
        metadata: JSON.stringify({
          cta: "Reply with revisions or approval notes",
          template: "follow-up",
        }),
      },
    ],
  });
}

async function seedConfigTables() {
  for (const [name, displayName, description, module] of skills) {
    await db.skill.upsert({
      where: { name },
      update: { displayName, description, module, enabled: true },
      create: { name, displayName, description, module, enabled: true },
    });
  }

  for (const [name, displayName, description, requiredLevel] of tools) {
    await db.tool.upsert({
      where: { name },
      update: { displayName, description, requiredLevel, enabled: true },
      create: { name, displayName, description, requiredLevel, enabled: true },
    });
  }
}

async function seedOperationsData() {
  const supportTemplates = [
    {
      userId: "sales-user",
      title: "Client portal approval email not branded",
      description:
        "Need final review of EMAIL_FROM and branded footer before sending to external clients.",
      status: "investigating",
      priority: "high",
      channel: "internal",
      tags: JSON.stringify(["email", "branding", "proposal"]),
      lastResponseAt: new Date("2026-03-25T18:30:00.000Z"),
    },
    {
      userId: "estimator-user",
      title: "Need review on stale proposal reminders",
      description:
        "Proposal follow-up audit is working, but team wants a better escalation path for sent proposals older than 72 hours.",
      status: "open",
      priority: "medium",
      channel: "internal",
      tags: JSON.stringify(["crm", "follow-up"]),
      lastResponseAt: new Date("2026-03-24T16:00:00.000Z"),
    },
  ];

  for (const ticket of supportTemplates) {
    const existing = await db.supportTicket.findFirst({
      where: {
        title: ticket.title,
      },
    });

    if (existing) {
      await db.supportTicket.update({
        where: { id: existing.id },
        data: ticket,
      });
    } else {
      await db.supportTicket.create({
        data: ticket,
      });
    }
  }

  const incidentTemplates = [
    {
      title: "Production infrastructure still using local development defaults",
      summary:
        "Release gate remains blocked because DATABASE_URL and STORAGE_DRIVER are still configured for local development.",
      affectedService: "release",
      severity: "warning",
      status: "open",
      source: "health-scan",
      details: JSON.stringify({
        database: "postgres",
        storage: "local",
      }),
      startedAt: new Date("2026-03-27T08:00:00.000Z"),
    },
  ];

  for (const incident of incidentTemplates) {
    const existing = await db.opsIncident.findFirst({
      where: {
        title: incident.title,
      },
    });

    if (existing) {
      await db.opsIncident.update({
        where: { id: existing.id },
        data: incident,
      });
    } else {
      await db.opsIncident.create({
        data: incident,
      });
    }
  }

  const maintenanceTemplates = [
    {
      action: "backup-local",
      trigger: "manual",
      status: "completed",
      summary: "Local backup snapshot completed successfully.",
      details: JSON.stringify({
        snapshot: "seeded-example",
      }),
      startedAt: new Date("2026-03-26T09:00:00.000Z"),
      finishedAt: new Date("2026-03-26T09:00:10.000Z"),
    },
    {
      action: "follow-up-audit",
      trigger: "cron",
      status: "completed",
      summary: "Lead and proposal follow-up audit completed.",
      details: JSON.stringify({
        overdueLeadCount: 2,
        staleProposalCount: 1,
      }),
      startedAt: new Date("2026-03-27T06:00:00.000Z"),
      finishedAt: new Date("2026-03-27T06:00:01.000Z"),
    },
  ];

  for (const run of maintenanceTemplates) {
    const existing = await db.maintenanceRun.findFirst({
      where: {
        action: run.action,
        startedAt: run.startedAt,
      },
    });

    if (existing) {
      await db.maintenanceRun.update({
        where: { id: existing.id },
        data: run,
      });
    } else {
      await db.maintenanceRun.create({
        data: run,
      });
    }
  }
}

async function main() {
  const seededUsers = await seedUsers();
  await seedCustomAgents();
  await seedBilling();
  await seedCompanyMemory();

  for (const user of seededUsers) {
    await seedProjects(user.id);
    await seedBidOpportunities(user.id);
    await seedLearning(user.id);
    await seedBoost(user.id);
    await seedEmails(user.id);
  }

  await seedConfigTables();
  await seedOperationsData();

  const summary = {
    users: await db.user.count(),
    projects: await db.project.count(),
    opportunities: await db.bidOpportunity.count(),
    documents: await db.document.count(),
    estimates: await db.estimate.count(),
    learningItems: await db.learningItem.count(),
    leads: await db.lead.count(),
    campaigns: await db.campaign.count(),
    emails: await db.email.count(),
    supportTickets: await db.supportTicket.count(),
    customAgents: await db.customAgent.count(),
    billingAccounts: await db.billingAccount.count(),
    billingUsageEvents: await db.billingUsageEvent.count(),
    incidents: await db.opsIncident.count(),
    maintenanceRuns: await db.maintenanceRun.count(),
  };

  console.log("Seed completed:", summary);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
