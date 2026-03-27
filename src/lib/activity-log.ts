import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";

interface LogActivityInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  skill?: string | null;
  tool?: string | null;
}

export async function logActivity(input: LogActivityInput) {
  return db.activityLog.create({
    data: {
      userId: input.userId || undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || undefined,
      details: stringifyJson(input.details),
      skill: input.skill || undefined,
      tool: input.tool || undefined,
    },
  });
}

export async function appendLeadInteraction(
  leadId: string,
  interaction: Record<string, unknown>
) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    return null;
  }

  const interactions = parseJsonField<Record<string, unknown>[]>(lead.interactions, []);
  const nextInteractions = [
    {
      ...interaction,
      createdAt: interaction.createdAt || new Date().toISOString(),
    },
    ...interactions,
  ].slice(0, 50);

  return db.lead.update({
    where: { id: leadId },
    data: {
      interactions: stringifyJson(nextInteractions),
    },
  });
}
