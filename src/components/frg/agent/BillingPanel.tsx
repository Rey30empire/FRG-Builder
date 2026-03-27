"use client";

import * as React from "react";
import { ArrowRight, CreditCard, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { BillingInterval, BillingOverview, BillingPlanDefinition, BillingPlanKey } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface BillingPanelProps {
  overview: BillingOverview | null;
  isLoading: boolean;
  onRefresh: () => Promise<void> | void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusTone(status?: string | null) {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "trialing":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "past_due":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "canceled":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    case "incomplete":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function getFeatureLines(plan: BillingPlanDefinition) {
  const lines = ["Personal API keys", "Custom agents"];

  if (plan.features.pipelineAutomation) {
    lines.push("Bid pipeline automation");
  }

  if (plan.features.whiteLabelProposal) {
    lines.push("Branded proposal delivery");
  }

  if (plan.features.prioritySupport) {
    lines.push("Priority support");
  }

  return lines;
}

export function BillingPanel({ overview, isLoading, onRefresh }: BillingPanelProps) {
  const [selectedInterval, setSelectedInterval] = React.useState<BillingInterval>("monthly");
  const [pendingCheckoutPlan, setPendingCheckoutPlan] = React.useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);

  const currentPlanKey = overview?.account.planKey || "starter";
  const currentInterval = overview?.account.billingInterval || "monthly";

  React.useEffect(() => {
    if (overview?.account.billingInterval === "monthly" || overview?.account.billingInterval === "yearly") {
      setSelectedInterval(overview.account.billingInterval);
    }
  }, [overview?.account.billingInterval]);

  async function handleCheckout(planKey: BillingPlanKey) {
    try {
      setPendingCheckoutPlan(`${planKey}-${selectedInterval}`);

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planKey,
          interval: selectedInterval,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<{ url: string }>;
      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.error || "Unable to start checkout");
      }

      window.location.href = payload.data.url;
    } catch (error) {
      toast({
        title: "Billing checkout failed",
        description: error instanceof Error ? error.message : "Unable to start checkout",
        variant: "destructive",
      });
    } finally {
      setPendingCheckoutPlan(null);
    }
  }

  async function handlePortal() {
    try {
      setIsOpeningPortal(true);

      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const payload = (await response.json()) as ApiEnvelope<{ url: string }>;
      if (!response.ok || !payload.success || !payload.data?.url) {
        throw new Error(payload.error || "Unable to open billing portal");
      }

      window.location.href = payload.data.url;
    } catch (error) {
      toast({
        title: "Billing portal failed",
        description: error instanceof Error ? error.message : "Unable to open billing portal",
        variant: "destructive",
      });
    } finally {
      setIsOpeningPortal(false);
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <CreditCard className="h-4 w-4 text-emerald-400" />
              Billing & Plans
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Self-serve usage, upgrade paths, and billing portal access for this workspace.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-950 text-slate-200"
            onClick={() => void onRefresh()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-2">
        {isLoading && !overview ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-500">
            Loading billing overview...
          </div>
        ) : overview ? (
          <>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  {overview.plan.label}
                </Badge>
                <Badge variant="outline" className={getStatusTone(overview.account.status)}>
                  {overview.account.status}
                </Badge>
                {overview.account.cancelAtPeriodEnd ? (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                    Cancels at period end
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-slate-500">Current period</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {formatDate(overview.account.currentPeriodStart)} to {formatDate(overview.account.currentPeriodEnd)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                  <p className="text-slate-500">Current billing</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {overview.account.amountCents ? formatCurrency(overview.account.amountCents / 100) : "Free"} /{" "}
                    {overview.account.billingInterval || "monthly"}
                  </p>
                </div>
              </div>
              {overview.recommendedUpgrade ? (
                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Usage is climbing. Moving to {overview.availablePlans.find((plan) => plan.key === overview.recommendedUpgrade)?.label || overview.recommendedUpgrade} will unlock more room.
                </div>
              ) : null}
              {!overview.stripeConfigured ? (
                <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  Stripe is not configured yet in this environment, so upgrades and billing portal are disabled for now.
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-200">Current usage</p>
                {overview.portalReady ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 text-slate-200"
                    onClick={() => void handlePortal()}
                    disabled={isOpeningPortal}
                  >
                    {isOpeningPortal ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Open Portal
                  </Button>
                ) : null}
              </div>
              {overview.usage.map((entry) => (
                <div key={entry.metric} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-200">{entry.label}</p>
                      <p className="text-xs text-slate-500">
                        {entry.used} used{entry.limit != null ? ` of ${entry.limit}` : ""}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      {entry.percentUsed != null ? `${Math.round(entry.percentUsed)}%` : "Unlimited"}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        (entry.percentUsed || 0) >= 85
                          ? "bg-rose-400"
                          : (entry.percentUsed || 0) >= 65
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      )}
                      style={{ width: `${Math.min(entry.percentUsed || 0, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-200">Choose billing interval</p>
                <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1">
                  {(["monthly", "yearly"] as BillingInterval[]).map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setSelectedInterval(interval)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        selectedInterval === interval
                          ? "bg-amber-500 text-white"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {interval === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {overview.availablePlans.map((plan) => {
                  const isCurrentPlan = currentPlanKey === plan.key && currentInterval === selectedInterval;
                  const pending = pendingCheckoutPlan === `${plan.key}-${selectedInterval}`;
                  const price = plan.intervalPrices[selectedInterval];

                  return (
                    <div
                      key={plan.key}
                      className={cn(
                        "rounded-xl border p-4",
                        isCurrentPlan
                          ? "border-amber-500/30 bg-amber-500/10"
                          : "border-slate-800 bg-slate-950/70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{plan.label}</p>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">
                              {plan.badge}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-white">
                            {price > 0 ? formatCurrency(price) : "Free"}
                          </p>
                          <p className="text-xs text-slate-500">per {selectedInterval === "monthly" ? "month" : "year"}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {getFeatureLines(plan).map((feature) => (
                          <Badge
                            key={feature}
                            variant="outline"
                            className="border-slate-700 bg-slate-900 text-slate-300"
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {feature}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                        <div>AI messages: {plan.limits.ai_messages ?? "Unlimited"}</div>
                        <div>Document analyses: {plan.limits.document_analyses ?? "Unlimited"}</div>
                        <div>Proposal deliveries: {plan.limits.proposal_deliveries ?? "Unlimited"}</div>
                        <div>Agent runs: {plan.limits.agent_runs ?? "Unlimited"}</div>
                        <div>Custom agents: {plan.limits.custom_agents ?? "Unlimited"}</div>
                      </div>

                      <div className="mt-4">
                        {plan.key === "starter" ? (
                          <Button
                            variant="outline"
                            className="w-full border-slate-700 bg-slate-900 text-slate-200"
                            disabled
                          >
                            Included free tier
                          </Button>
                        ) : isCurrentPlan ? (
                          <Button
                            variant="outline"
                            className="w-full border-amber-500/30 bg-amber-500/10 text-amber-100"
                            disabled
                          >
                            Current plan
                          </Button>
                        ) : (
                          <Button
                            className="w-full bg-amber-500 text-white hover:bg-amber-600"
                            onClick={() => void handleCheckout(plan.key)}
                            disabled={pending || !overview.checkoutReady}
                          >
                            {pending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="mr-2 h-4 w-4" />
                            )}
                            Upgrade to {plan.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-500">
            Billing data is not available yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BillingPanel;
