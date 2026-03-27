import type { Lead } from "@/types";

export const LEAD_STATUS_PROBABILITY: Record<Lead["status"], number> = {
  new: 0.1,
  contacted: 0.25,
  qualified: 0.5,
  proposal: 0.8,
  closed: 1,
};

export function getLeadWeightedValue(lead: Pick<Lead, "status" | "estimatedValue">) {
  return Number((Number(lead.estimatedValue || 0) * LEAD_STATUS_PROBABILITY[lead.status]).toFixed(2));
}

export function getLeadFollowUpState(value?: Date | string | null) {
  if (!value) return "none" as const;

  const now = new Date();
  const target = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfInAWeek = new Date(startOfToday);
  startOfInAWeek.setDate(startOfInAWeek.getDate() + 7);

  if (target < startOfToday) return "overdue" as const;
  if (target < startOfTomorrow) return "today" as const;
  if (target < startOfInAWeek) return "this-week" as const;
  return "scheduled" as const;
}

export function buildLeadInteraction(input: {
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    type: input.type,
    title: input.title,
    description: input.description,
    ...input.metadata,
  };
}
