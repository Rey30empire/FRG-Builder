"use client";

import * as React from "react";
import { CheckCircle2, Clock3, Download, Loader2, XCircle } from "lucide-react";
import type { Estimate, ProposalData, ProposalDelivery } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type PublicProposalPayload = {
  project: {
    name: string;
    address?: string | null;
    client?: string | null;
  };
  estimate: Estimate;
  proposalData: ProposalData;
  delivery: ProposalDelivery;
  company?: {
    name?: string | null;
  } | null;
};

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Pending";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PublicProposalPortal({ token }: { token: string }) {
  const [payload, setPayload] = React.useState<PublicProposalPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isResponding, setIsResponding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [responseMessage, setResponseMessage] = React.useState("");

  const loadProposal = React.useEffectEvent(async () => {
    const response = await fetch(`/api/proposals/public?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as ApiEnvelope<PublicProposalPayload>;

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error || "Unable to load proposal");
    }

    setPayload(result.data);

    await fetch("/api/proposals/public/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
  });

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setIsLoading(true);
        setError(null);
        await loadProposal();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load proposal");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadProposal]);

  async function handleRespond(action: "approved" | "rejected") {
    try {
      setIsResponding(true);
      setError(null);

      const response = await fetch("/api/proposals/public/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          action,
          message: responseMessage || undefined,
        }),
      });

      const result = (await response.json()) as ApiEnvelope<{
        estimate: Estimate;
        delivery: ProposalDelivery;
      }>;

      if (!response.ok || !result.success || !result.data || !payload) {
        throw new Error(result.error || "Unable to submit proposal response");
      }

      setPayload({
        ...payload,
        estimate: result.data.estimate,
        delivery: result.data.delivery,
      });
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Unable to submit proposal response"
      );
    } finally {
      setIsResponding(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-orange-400" />
        Loading proposal...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-200">
        <Card className="w-full max-w-xl border-rose-500/30 bg-slate-900/90">
          <CardHeader>
            <CardTitle className="text-white">Proposal unavailable</CardTitle>
            <CardDescription className="text-rose-300">
              {error || "We couldn't load this proposal link."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const status = payload.delivery.status;
  const isFinal = status === "approved" || status === "rejected";

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-slate-800 bg-slate-900/90">
          <CardHeader>
            <CardDescription className="text-slate-400">
              {payload.company?.name || "FRG Builder"} proposal delivery portal
            </CardDescription>
            <CardTitle className="text-3xl text-white">{payload.proposalData.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Project", payload.project.name],
              ["Recipient", payload.delivery.recipientName || payload.project.client || "Client"],
              ["Total", formatCurrency(payload.estimate.total)],
              ["Status", status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-medium text-white">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/90">
              <CardHeader>
                <CardTitle className="text-white">Scope Summary</CardTitle>
                <CardDescription className="text-slate-400">
                  {payload.project.address || "Project address pending"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-200">{payload.proposalData.intro}</p>
                <p className="text-sm text-slate-300">{payload.proposalData.scopeSummary}</p>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Schedule</p>
                  <p className="mt-2 text-sm text-slate-200">{payload.proposalData.schedule}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/90">
              <CardHeader>
                <CardTitle className="text-white">Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.proposalData.highlights.map((item) => (
                  <div
                    key={`${item.trade}-${item.description}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{item.trade}</p>
                        <p className="text-sm text-slate-400">{item.description}</p>
                      </div>
                      <p className="text-sm font-semibold text-orange-300">
                        {formatCurrency(item.totalCost)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="text-white">Inclusions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-300">
                  {payload.proposalData.inclusions.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="text-white">Exclusions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-300">
                  {payload.proposalData.exclusions.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="text-white">Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-300">
                  {payload.proposalData.terms.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/90">
              <CardHeader>
                <CardTitle className="text-white">Delivery Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Sent</p>
                  <p className="mt-2 text-sm text-white">{formatDate(payload.delivery.sentAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Viewed</p>
                  <p className="mt-2 text-sm text-white">{formatDate(payload.delivery.viewedAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Response</p>
                  <p className="mt-2 text-sm text-white">
                    {payload.delivery.approvedAt
                      ? `Approved • ${formatDate(payload.delivery.approvedAt)}`
                      : payload.delivery.rejectedAt
                        ? `Rejected • ${formatDate(payload.delivery.rejectedAt)}`
                        : "Pending"}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                >
                  <a
                    href={`/api/proposals/public/pdf?token=${encodeURIComponent(token)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/90">
              <CardHeader>
                <CardTitle className="text-white">Respond</CardTitle>
                <CardDescription className="text-slate-400">
                  Share any note and confirm your decision.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={responseMessage}
                  onChange={(event) => setResponseMessage(event.target.value)}
                  placeholder="Optional note for the estimator or PM"
                  className="min-h-[140px] border-slate-800 bg-slate-950 text-slate-200"
                  disabled={isResponding || isFinal}
                />

                {payload.delivery.responseMessage ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Latest response</p>
                    <p className="mt-2 text-sm text-slate-200">{payload.delivery.responseMessage}</p>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    onClick={() => void handleRespond("approved")}
                    disabled={isResponding || status === "approved"}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {isResponding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Approve proposal
                  </Button>
                  <Button
                    onClick={() => void handleRespond("rejected")}
                    disabled={isResponding || status === "rejected"}
                    variant="outline"
                    className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                  >
                    {isResponding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Reject proposal
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/90">
              <CardHeader>
                <CardTitle className="text-white">Proposal Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-sm text-slate-400">Current status</span>
                  <span className="text-sm font-medium text-white">{payload.delivery.status}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-sm text-slate-400">Views</span>
                  <span className="text-sm font-medium text-white">{payload.delivery.viewCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-sm text-slate-400">Timeline basis</span>
                  <span className="text-sm font-medium text-white">
                    {payload.estimate.duration || 0} days
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-sm text-slate-400">Template</span>
                  <span className="text-sm font-medium text-white">{payload.proposalData.template}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span className="text-sm text-slate-400">Tracking</span>
                  <span className="text-sm font-medium text-white">
                    <Clock3 className="mr-2 inline h-4 w-4 text-orange-400" />
                    {formatDate(payload.delivery.updatedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicProposalPortal;
