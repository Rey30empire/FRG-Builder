import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { assertBillingLimit, BillingLimitError } from "@/lib/billing";
import { db } from "@/lib/db";
import {
  buildCustomAgentPersistence,
  ensureUniqueCustomAgentSlug,
  loadUserCustomAgents,
  normalizeCustomAgentInput,
  serializeCustomAgent,
} from "@/lib/custom-agents";
import { resolveScopedUserId } from "@/lib/access-control";

function resolveAgentId(request: NextRequest, body?: Record<string, unknown>) {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get("id");
  const fromBody = typeof body?.id === "string" ? body.id : null;
  return fromQuery || fromBody || null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = resolveScopedUserId(auth.user, searchParams.get("userId"));
    const enabledOnly = searchParams.get("enabled") === "true";
    const executionMode =
      searchParams.get("executionMode") || undefined;

    const agents = await loadUserCustomAgents(userId, {
      enabledOnly,
      executionMode:
        executionMode === "chat-capable" ||
        executionMode === "pipeline-capable" ||
        executionMode === "chat" ||
        executionMode === "pipeline" ||
        executionMode === "both"
          ? executionMode
          : undefined,
    });

    return NextResponse.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load custom agents",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const normalized = normalizeCustomAgentInput(body);

    if (!normalized.name) {
      return NextResponse.json(
        { success: false, error: "Agent name is required" },
        { status: 400 }
      );
    }

    if (!normalized.instructions) {
      return NextResponse.json(
        { success: false, error: "Agent instructions are required" },
        { status: 400 }
      );
    }

    const slug = await ensureUniqueCustomAgentSlug(auth.user.id, normalized.slug || normalized.name);

    if (normalized.enabled) {
      const currentEnabledCount = await db.customAgent.count({
        where: {
          userId: auth.user.id,
          enabled: true,
        },
      });

      await assertBillingLimit({
        userId: auth.user.id,
        metricKey: "custom_agents",
        currentValue: currentEnabledCount,
        quantity: 1,
      });
    }

    const created = await db.customAgent.create({
      data: {
        userId: auth.user.id,
        ...buildCustomAgentPersistence({
          ...normalized,
          slug,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeCustomAgent(created as unknown as Record<string, unknown>),
    });
  } catch (error) {
    const status = error instanceof BillingLimitError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to create custom agent",
      },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const agentId = resolveAgentId(request, body);
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "Agent id is required" },
        { status: 400 }
      );
    }

    const existing = await db.customAgent.findFirst({
      where: {
        id: agentId,
        userId: auth.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Custom agent not found" },
        { status: 404 }
      );
    }

    const normalized = normalizeCustomAgentInput(
      body,
      serializeCustomAgent(existing as unknown as Record<string, unknown>)
    );

    if (!normalized.name) {
      return NextResponse.json(
        { success: false, error: "Agent name is required" },
        { status: 400 }
      );
    }

    if (!normalized.instructions) {
      return NextResponse.json(
        { success: false, error: "Agent instructions are required" },
        { status: 400 }
      );
    }

    const slug = await ensureUniqueCustomAgentSlug(
      auth.user.id,
      normalized.slug || normalized.name,
      existing.id
    );

    if (!existing.enabled && normalized.enabled) {
      const currentEnabledCount = await db.customAgent.count({
        where: {
          userId: auth.user.id,
          enabled: true,
          NOT: {
            id: existing.id,
          },
        },
      });

      await assertBillingLimit({
        userId: auth.user.id,
        metricKey: "custom_agents",
        currentValue: currentEnabledCount,
        quantity: 1,
      });
    }

    const updated = await db.customAgent.update({
      where: { id: existing.id },
      data: buildCustomAgentPersistence({
        ...normalized,
        slug,
      }),
    });

    return NextResponse.json({
      success: true,
      data: serializeCustomAgent(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    const status = error instanceof BillingLimitError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to update custom agent",
      },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request);
    if ("response" in auth) return auth.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const agentId = resolveAgentId(request, body);
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "Agent id is required" },
        { status: 400 }
      );
    }

    const existing = await db.customAgent.findFirst({
      where: {
        id: agentId,
        userId: auth.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Custom agent not found" },
        { status: 404 }
      );
    }

    await db.customAgent.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      success: true,
      data: { id: existing.id },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to delete custom agent",
      },
      { status: 500 }
    );
  }
}
