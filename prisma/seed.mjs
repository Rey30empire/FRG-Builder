import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const users = [
  {
    id: "default-user",
    email: "builder@frg.local",
    name: "FRG Builder",
    role: "admin",
    level: 4,
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "general_contractor",
      preferredMargins: 18,
      overheadPercent: 12,
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
    memory: {
      language: "es",
      explanationStyle: "detailed",
      companyType: "subcontractor",
      preferredMargins: 14,
      overheadPercent: 10,
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
    memory: {
      language: "en",
      explanationStyle: "summary",
      companyType: "business_development",
      preferredMargins: 20,
      overheadPercent: 8,
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
  ["generate_proposal", "Generar Proposal", "Construir proposal lista para envio", 1],
  ["write_email", "Escribir Email", "Redactar follow-ups y outreach", 1],
  ["export_reports", "Exportar Reportes", "Crear documentos finales y reportes", 2],
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
        userMemory: {
          upsert: {
            update: user.memory,
            create: user.memory,
          },
        },
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        level: user.level,
        userMemory: {
          create: user.memory,
        },
      },
    });
  }

  return users;
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

function getLearningTemplates(userId) {
  if (userId === "sales-user") {
    return [
      {
        title: "Proposal Follow-up Strategy",
        category: "sales",
        level: "intermediate",
        type: "lesson",
        completed: true,
        score: 92,
        timeSpent: 42,
        content: JSON.stringify({ summary: "How to recover silent proposals with structured follow-up." }),
      },
      {
        title: "Commercial Outreach Copy",
        category: "marketing",
        level: "beginner",
        type: "exercise",
        completed: false,
        timeSpent: 18,
        content: JSON.stringify({ summary: "Message framing for LinkedIn and email." }),
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
      score: 95,
      timeSpent: 75,
      content: JSON.stringify({ summary: "How to map scope, sheets and addenda." }),
    },
    {
      title: "Concrete Takeoff Basics",
      category: "concrete",
      level: "beginner",
      type: "lesson",
      completed: false,
      timeSpent: 35,
      content: JSON.stringify({ summary: "Foundation quantities and waste factors." }),
    },
    {
      title: "Proposal Writing Checklist",
      category: "sales",
      level: "intermediate",
      type: "exercise",
      completed: false,
      timeSpent: 20,
      content: JSON.stringify({ checklist: ["Scope", "Exclusions", "Schedule", "Terms"] }),
    },
    {
      title: "Labor Burden and Markups",
      category: "estimating",
      level: "advanced",
      type: "lesson",
      completed: true,
      score: 88,
      timeSpent: 55,
      content: JSON.stringify({ summary: "Margin, markup, overhead and profit relationships." }),
    },
  ];
}

async function seedLearning(userId) {
  const count = await db.learningItem.count({ where: { userId } });
  if (count > 0) return;

  await db.learningItem.createMany({
    data: getLearningTemplates(userId).map((item) => ({ ...item, userId })),
  });
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
        status: "draft",
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

  if ((await db.lead.count({ where: { userId } })) === 0) {
    await db.lead.createMany({
      data: templates.leads,
    });
  }

  if ((await db.campaign.count({ where: { userId } })) === 0) {
    await db.campaign.createMany({
      data: templates.campaigns,
    });
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

async function main() {
  const seededUsers = await seedUsers();
  await seedCompanyMemory();

  for (const user of seededUsers) {
    await seedProjects(user.id);
    await seedLearning(user.id);
    await seedBoost(user.id);
    await seedEmails(user.id);
  }

  await seedConfigTables();

  const summary = {
    users: await db.user.count(),
    projects: await db.project.count(),
    documents: await db.document.count(),
    estimates: await db.estimate.count(),
    learningItems: await db.learningItem.count(),
    leads: await db.lead.count(),
    campaigns: await db.campaign.count(),
    emails: await db.email.count(),
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
