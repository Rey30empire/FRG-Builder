import { db } from "@/lib/db";
import { parseJsonField, stringifyJson } from "@/lib/json";
import { getStripeClient, getStripePriceId, isStripeConfigured } from "@/lib/stripe";
import type {
  BillingAccount,
  BillingInterval,
  BillingMetricKey,
  BillingOverview,
  BillingPlanDefinition,
  BillingPlanKey,
  BillingStatus,
  BillingUsageSnapshot,
} from "@/types";

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlanDefinition> = {
  starter: {
    key: "starter",
    label: "Starter",
    description: "For owner-operators validating bids and sending a limited number of proposals each month.",
    badge: "Entry",
    intervalPrices: {
      monthly: 0,
      yearly: 0,
    },
    limits: {
      ai_messages: 150,
      document_analyses: 40,
      proposal_deliveries: 10,
      agent_runs: 20,
      custom_agents: 1,
    },
    features: {
      personalApiKeys: true,
      customAgents: true,
      pipelineAutomation: false,
      whiteLabelProposal: false,
      prioritySupport: false,
    },
  },
  pro: {
    key: "pro",
    label: "Pro",
    description: "For active estimators who need AI-assisted workflows, more capacity, and branded proposals.",
    badge: "Most Popular",
    intervalPrices: {
      monthly: 79,
      yearly: 790,
    },
    limits: {
      ai_messages: 2000,
      document_analyses: 300,
      proposal_deliveries: 75,
      agent_runs: 250,
      custom_agents: 8,
    },
    features: {
      personalApiKeys: true,
      customAgents: true,
      pipelineAutomation: true,
      whiteLabelProposal: true,
      prioritySupport: false,
    },
  },
  growth: {
    key: "growth",
    label: "Growth",
    description: "For heavy bid desks running multi-agent review, high-volume proposals, and advanced operations.",
    badge: "Scale",
    intervalPrices: {
      monthly: 199,
      yearly: 1990,
    },
    limits: {
      ai_messages: 10000,
      document_analyses: 1500,
      proposal_deliveries: 300,
      agent_runs: 1500,
      custom_agents: 25,
    },
    features: {
      personalApiKeys: true,
      customAgents: true,
      pipelineAutomation: true,
      whiteLabelProposal: true,
      prioritySupport: true,
    },
  },
};

export const BILLING_METRIC_LABELS: Record<BillingMetricKey, string> = {
  ai_messages: "AI messages",
  document_analyses: "Document analyses",
  proposal_deliveries: "Proposal deliveries",
  agent_runs: "Agent runs",
  custom_agents: "Custom agents",
};

export class BillingLimitError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "BillingLimitError";
    this.status = status;
  }
}

function isPaidPlanKey(planKey?: string | null) {
  return planKey === "pro" || planKey === "growth";
}

function normalizeBillingPlanKey(value?: string | null): BillingPlanKey {
  if (value === "starter" || value === "pro" || value === "growth") {
    return value;
  }

  return "starter";
}

function normalizeBillingInterval(value?: string | null): BillingInterval | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }

  return null;
}

function normalizeBillingStatus(value?: string | null): BillingStatus {
  if (
    value === "free" ||
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete"
  ) {
    return value;
  }

  return "free";
}

function hasActivePaidEntitlement(account: {
  planKey?: string | null;
  status?: string | null;
  currentPeriodEnd?: Date | null;
}) {
  if (!isPaidPlanKey(account.planKey)) {
    return true;
  }

  if (account.status === "active" || account.status === "trialing") {
    return true;
  }

  if (account.status === "canceled" && account.currentPeriodEnd) {
    return account.currentPeriodEnd.getTime() > Date.now();
  }

  return false;
}

function resolveEntitledPlanKey(account: {
  planKey?: string | null;
  status?: string | null;
  currentPeriodEnd?: Date | null;
}): BillingPlanKey {
  if (!isPaidPlanKey(account.planKey)) {
    return "starter";
  }

  return hasActivePaidEntitlement(account) ? normalizeBillingPlanKey(account.planKey) : "starter";
}

export function getCurrentBillingPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function serializeBillingAccount<T extends Record<string, unknown>>(account: T): BillingAccount {
  return {
    ...account,
    planKey: normalizeBillingPlanKey(typeof account.planKey === "string" ? account.planKey : null),
    status: normalizeBillingStatus(typeof account.status === "string" ? account.status : null),
    billingInterval: normalizeBillingInterval(
      typeof account.billingInterval === "string" ? account.billingInterval : null
    ),
    cancelAtPeriodEnd: Boolean(account.cancelAtPeriodEnd),
    metadata: parseJsonField(account.metadata, null),
  } as unknown as BillingAccount;
}

export async function ensureBillingAccount(userId: string) {
  const account = await db.billingAccount.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      planKey: "starter",
      status: "free",
      billingInterval: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  return serializeBillingAccount(account as unknown as Record<string, unknown>);
}

export function getPlanDefinition(planKey?: string | null) {
  return BILLING_PLANS[normalizeBillingPlanKey(planKey)];
}

export async function getBillingUsageSummary(userId: string, periodKey = getCurrentBillingPeriodKey()) {
  const account = await ensureBillingAccount(userId);
  const usageRows = await db.billingUsageEvent.groupBy({
    by: ["metricKey"],
    where: {
      billingAccountId: account.id,
      periodKey,
    },
    _sum: {
      quantity: true,
    },
  });
  const plan = getPlanDefinition(resolveEntitledPlanKey(account));
  const customAgentCount = await getCurrentCustomAgentCount(userId);

  return (Object.keys(BILLING_METRIC_LABELS) as BillingMetricKey[]).map((metric) => {
    const used =
      metric === "custom_agents"
        ? customAgentCount
        : usageRows.find((row) => row.metricKey === metric)?._sum.quantity || 0;
    const limit = plan.limits[metric];
    const remaining = limit == null ? null : Math.max(limit - used, 0);
    const percentUsed = limit == null || limit === 0 ? null : Math.min((used / limit) * 100, 100);

    return {
      metric,
      label: BILLING_METRIC_LABELS[metric],
      used,
      limit,
      remaining,
      percentUsed,
    } satisfies BillingUsageSnapshot;
  });
}

export async function recordBillingUsage(input: {
  userId: string;
  metricKey: BillingMetricKey;
  quantity?: number;
  source: string;
  referenceId?: string | null;
  referenceType?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  if ((input.quantity ?? 1) <= 0) {
    return null;
  }

  const account = await ensureBillingAccount(input.userId);
  return db.billingUsageEvent.create({
    data: {
      billingAccountId: account.id,
      userId: input.userId,
      metricKey: input.metricKey,
      quantity: input.quantity ?? 1,
      source: input.source,
      referenceId: input.referenceId || null,
      referenceType: input.referenceType || null,
      periodKey: getCurrentBillingPeriodKey(),
      metadata: stringifyJson(input.metadata),
    },
  });
}

async function getCurrentCustomAgentCount(userId: string) {
  return db.customAgent.count({
    where: {
      userId,
      enabled: true,
    },
  });
}

export async function enforceBillingLimit(input: {
  userId: string;
  metricKey: BillingMetricKey;
  quantity?: number;
  currentValue?: number;
}) {
  const account = await ensureBillingAccount(input.userId);
  const plan = getPlanDefinition(resolveEntitledPlanKey(account));
  const limit = plan.limits[input.metricKey];

  if (limit == null) {
    return {
      account,
      plan,
      allowed: true,
      used: 0,
      limit: null,
    };
  }

  const used =
    input.metricKey === "custom_agents" && typeof input.currentValue === "number"
      ? input.currentValue
      : input.metricKey === "custom_agents"
        ? await getCurrentCustomAgentCount(input.userId)
        : (
            await getBillingUsageSummary(input.userId)
          ).find((entry) => entry.metric === input.metricKey)?.used || 0;

  const quantity = input.quantity ?? 1;
  const allowed = used + quantity <= limit;

  return {
    account,
    plan,
    allowed,
    used,
    limit,
  };
}

export async function assertBillingLimit(input: {
  userId: string;
  metricKey: BillingMetricKey;
  quantity?: number;
  currentValue?: number;
}) {
  const result = await enforceBillingLimit(input);
  if (result.allowed) {
    return result;
  }

  const recommendedUpgrade =
    result.plan.key === "starter" ? "pro" : result.plan.key === "pro" ? "growth" : null;

  throw new BillingLimitError(
    `${BILLING_METRIC_LABELS[input.metricKey]} exceeded for the ${result.plan.label} plan (${result.used}/${result.limit}).${
      recommendedUpgrade ? ` Upgrade to ${BILLING_PLANS[recommendedUpgrade].label} to continue.` : ""
    }`
  );
}

export async function buildBillingOverview(userId: string): Promise<BillingOverview> {
  const account = await ensureBillingAccount(userId);
  const usage = await getBillingUsageSummary(userId);
  const plan = getPlanDefinition(resolveEntitledPlanKey(account));
  const stripeConfigured = isStripeConfigured();

  const hottestUsage = usage
    .filter((entry) => entry.percentUsed != null)
    .sort((left, right) => (right.percentUsed || 0) - (left.percentUsed || 0))[0];

  const recommendedUpgrade =
    (hottestUsage?.percentUsed || 0) >= 80
      ? plan.key === "starter"
        ? "pro"
        : plan.key === "pro"
          ? "growth"
          : null
      : null;

  return {
    account,
    plan,
    availablePlans: Object.values(BILLING_PLANS),
    usage,
    checkoutReady: stripeConfigured,
    portalReady: stripeConfigured && Boolean(account.stripeCustomerId),
    stripeConfigured,
    recommendedUpgrade,
  };
}

export function canUsePipelineAutomation(planKey?: string | null) {
  return getPlanDefinition(planKey).features.pipelineAutomation;
}

export function canUsePipelineAutomationForAccount(account: {
  planKey?: string | null;
  status?: string | null;
  currentPeriodEnd?: Date | null;
}) {
  return getPlanDefinition(resolveEntitledPlanKey(account)).features.pipelineAutomation;
}

export async function createOrUpdateStripeCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured in this environment.");
  }

  const account = await ensureBillingAccount(input.userId);

  if (account.stripeCustomerId) {
    return {
      account,
      customerId: account.stripeCustomerId,
    };
  }

  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name || undefined,
    metadata: {
      userId: input.userId,
    },
  });

  const updated = await db.billingAccount.update({
    where: { id: account.id },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return {
    account: serializeBillingAccount(updated as unknown as Record<string, unknown>),
    customerId: customer.id,
  };
}

export async function updateBillingAccountFromStripe(input: {
  userId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  planKey?: BillingPlanKey | null;
  status?: BillingStatus | string | null;
  billingInterval?: BillingInterval | string | null;
  amountCents?: number | null;
  currency?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  checkoutCompletedAt?: Date | null;
  portalAccessedAt?: Date | null;
  stripeCheckoutSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const existing =
    (input.userId
      ? await db.billingAccount.findUnique({ where: { userId: input.userId } })
      : null) ||
    (input.stripeCustomerId
      ? await db.billingAccount.findFirst({
          where: { stripeCustomerId: input.stripeCustomerId },
        })
      : null) ||
    (input.stripeSubscriptionId
      ? await db.billingAccount.findFirst({
          where: { stripeSubscriptionId: input.stripeSubscriptionId },
        })
      : null);

  if (!existing && !input.userId) {
    throw new Error("Cannot update billing account without userId or existing account reference.");
  }

  const base = existing
    ? serializeBillingAccount(existing as unknown as Record<string, unknown>)
    : await ensureBillingAccount(input.userId as string);

  const updated = await db.billingAccount.update({
    where: { id: base.id },
    data: {
      stripeCustomerId: input.stripeCustomerId ?? base.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? base.stripeSubscriptionId ?? null,
      stripePriceId: input.stripePriceId ?? base.stripePriceId ?? null,
      stripeCheckoutSessionId:
        input.stripeCheckoutSessionId ?? base.stripeCheckoutSessionId ?? null,
      planKey: input.planKey ?? base.planKey,
      status: normalizeBillingStatus(input.status ?? base.status),
      billingInterval:
        normalizeBillingInterval(input.billingInterval ?? base.billingInterval) ??
        base.billingInterval,
      amountCents: input.amountCents ?? base.amountCents ?? null,
      currency: input.currency ?? base.currency ?? null,
      cancelAtPeriodEnd:
        typeof input.cancelAtPeriodEnd === "boolean"
          ? input.cancelAtPeriodEnd
          : base.cancelAtPeriodEnd,
      currentPeriodStart: input.currentPeriodStart ?? base.currentPeriodStart ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? base.currentPeriodEnd ?? null,
      trialEndsAt: input.trialEndsAt ?? base.trialEndsAt ?? null,
      checkoutCompletedAt: input.checkoutCompletedAt ?? base.checkoutCompletedAt ?? null,
      portalAccessedAt: input.portalAccessedAt ?? base.portalAccessedAt ?? null,
      metadata: stringifyJson({
        ...(base.metadata || {}),
        ...(input.metadata || {}),
      }),
    },
  });

  return serializeBillingAccount(updated as unknown as Record<string, unknown>);
}

export function resolvePlanKeyFromPriceMap(input: {
  priceId?: string | null;
  interval?: BillingInterval | null;
}) {
  const planKeys = Object.keys(BILLING_PLANS) as BillingPlanKey[];
  for (const planKey of planKeys) {
    const monthly = getStripePriceId(planKey, "monthly");
    const yearly = getStripePriceId(planKey, "yearly");
    if (input.priceId && input.priceId === monthly) {
      return {
        planKey,
        interval: "monthly" as BillingInterval,
      };
    }
    if (input.priceId && input.priceId === yearly) {
      return {
        planKey,
        interval: "yearly" as BillingInterval,
      };
    }
  }

  if (input.interval && input.priceId == null) {
    return null;
  }

  return null;
}
