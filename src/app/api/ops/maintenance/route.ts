import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  runMaintenanceTask,
  type MaintenanceAction,
  type MaintenanceTrigger,
} from "@/lib/operations";

const ALLOWED_ACTIONS = new Set<MaintenanceAction>([
  "backup-local",
  "cleanup-storage",
  "health-scan",
  "follow-up-audit",
]);

type TriggerAuthResult =
  | {
      trigger: MaintenanceTrigger;
      actorId: string | null;
    }
  | {
      response: Response;
    };

async function resolveTriggerAuth(request: NextRequest): Promise<TriggerAuthResult> {
  const configuredSecret = process.env.OPS_CRON_SECRET || process.env.CRON_SECRET;
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (configuredSecret && headerSecret && headerSecret === configuredSecret) {
    return {
      trigger: "cron" as MaintenanceTrigger,
      actorId: null,
    };
  }

  const auth = await requireAdminSessionUser(request);
  if ("response" in auth && auth.response) {
    return { response: auth.response };
  }

  const limited = enforceRateLimit(
    request,
    "ops-maintenance",
    {
      windowMs: 1000 * 60 * 10,
      max: 8,
    },
    auth.user.id
  );
  if (limited) {
    return { response: limited };
  }

  return {
    trigger: "manual" as MaintenanceTrigger,
    actorId: auth.user.id,
  };
}

export async function POST(request: NextRequest) {
  try {
    const triggerAuth = await resolveTriggerAuth(request);
    if ("response" in triggerAuth) return triggerAuth.response;

    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (!ALLOWED_ACTIONS.has(action as MaintenanceAction)) {
      return NextResponse.json(
        { success: false, error: "Unsupported maintenance action" },
        { status: 400 }
      );
    }

    const result = await runMaintenanceTask({
      action: action as MaintenanceAction,
      trigger: triggerAuth.trigger,
      actorId: triggerAuth.actorId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Run ops maintenance error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
