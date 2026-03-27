"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Rocket,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, useProjectsStore } from "@/store";
import type { Campaign, Lead, LearningItem, Project } from "@/types";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { BidBoardPanel } from "@/components/frg/dashboard/BidBoardPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface LearningSummaryResponse {
  items: LearningItem[];
  stats: {
    totalItems: number;
    completedItems: number;
    completionRate: number;
    totalTimeSpent: number;
  };
}

interface OpsOverviewResponse {
  health: {
    status: "healthy" | "warning" | "critical";
    releaseReady: boolean;
  };
  stats: {
    openTickets: number;
    openIncidents: number;
    overdueFollowUps: number;
    staleProposals: number;
    maintenanceRuns: number;
  };
  alerts: string[];
}

function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatOpenRate(campaign: Campaign) {
  if (!campaign.sent || !campaign.opened) return "0%";
  return formatPercent((campaign.opened / campaign.sent) * 100);
}

function DashboardStatCard({
  title,
  value,
  caption,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  caption: string;
  icon: React.ElementType;
  tone: "sky" | "orange" | "emerald" | "rose";
}) {
  const toneClasses = {
    sky: "bg-sky-500/10 text-sky-400",
    orange: "bg-orange-500/10 text-orange-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    rose: "bg-rose-500/10 text-rose-400",
  };

  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={cn("rounded-xl p-2.5", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="outline" className="border-slate-700 text-slate-400">
            {title}
          </Badge>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardModule() {
  const { activeUser, setActiveModule, setActiveProject } = useAppStore();
  const { projects, setProjects } = useProjectsStore();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [learning, setLearning] = React.useState<LearningSummaryResponse>({
    items: [],
    stats: {
      totalItems: 0,
      completedItems: 0,
      completionRate: 0,
      totalTimeSpent: 0,
    },
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [ops, setOps] = React.useState<OpsOverviewResponse | null>(null);
  const isAdminView = (activeUser?.level ?? 0) >= 4;

  React.useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [projectsRes, leadsRes, campaignsRes, learningRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/leads"),
          fetch("/api/campaigns"),
          fetch("/api/learning"),
        ]);

        const [projectsJson, leadsJson, campaignsJson, learningJson] = await Promise.all([
          projectsRes.json() as Promise<ApiEnvelope<Project[]>>,
          leadsRes.json() as Promise<ApiEnvelope<Lead[]>>,
          campaignsRes.json() as Promise<ApiEnvelope<Campaign[]>>,
          learningRes.json() as Promise<ApiEnvelope<LearningSummaryResponse>>,
        ]);

        if (cancelled) return;

        setProjects(projectsJson.success ? projectsJson.data : []);
        setLeads(leadsJson.success ? leadsJson.data : []);
        setCampaigns(campaignsJson.success ? campaignsJson.data : []);
        setLearning(
          learningJson.success
            ? learningJson.data
            : {
                items: [],
                stats: {
                  totalItems: 0,
                  completedItems: 0,
                  completionRate: 0,
                  totalTimeSpent: 0,
                },
              }
        );

        if (isAdminView) {
          const opsRes = await fetch("/api/ops/overview");
          const opsJson = (await opsRes.json()) as ApiEnvelope<OpsOverviewResponse>;
          if (!cancelled) {
            setOps(opsJson.success ? opsJson.data : null);
          }
        } else if (!cancelled) {
          setOps(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [activeUser?.id, activeUser?.level, isAdminView, setProjects]);

  const activeProjects = React.useMemo(
    () => projects.filter((project) => project.status === "active"),
    [projects]
  );

  const recentProjects = React.useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [projects]
  );

  const pendingEstimates = React.useMemo(
    () =>
      projects
        .flatMap((project) => project.estimates ?? [])
        .filter((estimate) => estimate.status !== "sent").length,
    [projects]
  );

  const totalDocuments = React.useMemo(
    () => projects.flatMap((project) => project.documents ?? []).length,
    [projects]
  );

  const actionableLeads = React.useMemo(
    () => leads.filter((lead) => lead.status !== "closed"),
    [leads]
  );

  const upcomingFollowUps = React.useMemo(
    () =>
      [...leads]
        .filter((lead) => lead.nextFollowUp)
        .sort(
          (a, b) =>
            new Date(a.nextFollowUp as Date).getTime() - new Date(b.nextFollowUp as Date).getTime()
        )
        .slice(0, 4),
    [leads]
  );

  const activeCampaigns = React.useMemo(
    () => campaigns.filter((campaign) => campaign.status === "active"),
    [campaigns]
  );

  const topCampaigns = React.useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => (b.opened || 0) - (a.opened || 0))
        .slice(0, 3),
    [campaigns]
  );

  const totalPipelineValue = React.useMemo(() => {
    return leads.reduce((total, lead) => {
      const notes = lead.notes || "";
      const parsed = Number(notes.match(/\$([\d,]+)/)?.[1]?.replace(/,/g, ""));
      return total + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
  }, [leads]);

  const statusIndicators = React.useMemo(
    () => [
      {
        id: "projects",
        label: "Projects",
        status: activeProjects.length > 0 ? ("success" as const) : ("idle" as const),
        value: activeProjects.length,
      },
      {
        id: "loading",
        label: "Sync",
        status: isLoading
          ? ("pending" as const)
          : loadError
            ? ("error" as const)
            : ("success" as const),
        value: isLoading ? "Loading" : loadError ? "Check data" : "Ready",
      },
      ...(isAdminView
        ? [
            {
              id: "ops",
              label: "Ops",
              status:
                ops?.health.status === "critical"
                  ? ("error" as const)
                  : ops?.health.status === "warning"
                    ? ("warning" as const)
                    : ("success" as const),
              value: ops?.health.releaseReady ? "Release ready" : "Needs infra",
            },
          ]
        : []),
    ],
    [activeProjects.length, isAdminView, isLoading, loadError, ops?.health.releaseReady, ops?.health.status]
  );

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <ModuleHeader
        title="Builder Hub"
        description={`Proyecto canonico para estimacion, propuesta, envio y crecimiento comercial${activeUser?.name ? ` • perfil: ${activeUser.name}` : ""}`}
        quickActions={[
          {
            id: "new-project",
            label: "New Project",
            icon: FolderOpen,
            onClick: () => setActiveModule("estimate"),
          },
          {
            id: "crm",
            label: "Open CRM",
            icon: Users,
            onClick: () => setActiveModule("boost"),
            variant: "outline",
          },
          {
            id: "learning",
            label: "Learning",
            icon: GraduationCap,
            onClick: () => setActiveModule("learn"),
            variant: "outline",
          },
        ]}
        statusIndicators={statusIndicators}
      />

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <DashboardStatCard
              title="Projects"
              value={activeProjects.length}
              caption={`${totalDocuments} uploaded documents across the workspace`}
              icon={LayoutDashboard}
              tone="sky"
            />
            <DashboardStatCard
              title="Estimates"
              value={pendingEstimates}
              caption="Draft or review estimates ready to refine and send"
              icon={Calculator}
              tone="orange"
            />
            <DashboardStatCard
              title="Learning"
              value={learning.stats.completedItems}
              caption={`${learning.stats.totalItems} learning assets with ${formatPercent(learning.stats.completionRate)} completion`}
              icon={BookOpen}
              tone="emerald"
            />
            <DashboardStatCard
              title="CRM"
              value={actionableLeads.length}
              caption={`${activeCampaigns.length} active campaigns and ${totalPipelineValue ? `$${totalPipelineValue.toLocaleString()}` : "no parsed"} pipeline value`}
              icon={BriefcaseBusiness}
              tone="rose"
            />
          </motion.div>

          <BidBoardPanel />

          {loadError && (
            <Card className="border-rose-500/30 bg-rose-500/5">
              <CardContent className="p-4 text-sm text-rose-300">
                Dashboard data could not finish loading: {loadError}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Project Pulse</CardTitle>
                  <CardDescription className="text-slate-400">
                    The best of FRG Builder plus Builder_Rey30 now anchored in one home view
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => setActiveModule("estimate")}
                >
                  Go to Estimate
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentProjects.length > 0 ? (
                  recentProjects.map((project) => {
                    const analyzedDocs = (project.documents || []).filter((doc) => doc.analyzed).length;
                    const totalDocs = project.documents?.length || 0;
                    const completion = totalDocs > 0 ? (analyzedDocs / totalDocs) * 100 : 0;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setActiveProject(project);
                          setActiveModule("estimate");
                        }}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-orange-500/30 hover:bg-slate-900"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-white">{project.name}</p>
                            <p className="truncate text-sm text-slate-400">
                              {project.client || "No client"}{project.address ? ` • ${project.address}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {project.status}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Updated</p>
                            <p className="mt-1 text-sm text-slate-200">{formatDate(project.updatedAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Estimate versions</p>
                            <p className="mt-1 text-sm text-slate-200">{project.estimates?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Docs analyzed</p>
                            <p className="mt-1 text-sm text-slate-200">
                              {analyzedDocs}/{totalDocs || 0}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                            <span>Document readiness</span>
                            <span>{formatPercent(completion)}</span>
                          </div>
                          <Progress value={completion} className="h-2 bg-slate-800" />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
                    No projects yet. Run the seed or create your first project from Estimate.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">Next Best Actions</CardTitle>
                  <CardDescription className="text-slate-400">
                    The remaining pieces to finish the end-to-end flow
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    {
                      label: "Upload and classify PDFs",
                      description: "Move project files through document intake and analysis",
                      module: "estimate" as const,
                      icon: FolderOpen,
                    },
                    {
                      label: "Generate and send estimate",
                      description: "Complete takeoff, pricing and proposal delivery",
                      module: "estimate" as const,
                      icon: Calculator,
                    },
                    {
                      label: "Follow up with active leads",
                      description: "Use CRM and campaigns to keep the pipeline moving",
                      module: "boost" as const,
                      icon: Mail,
                    },
                    {
                      label: "Expand training content",
                      description: "Turn FRG Learn into a real study system backed by data",
                      module: "learn" as const,
                      icon: GraduationCap,
                    },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => setActiveModule(action.module)}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left transition hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
                        <action.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-100">{action.label}</p>
                        <p className="text-xs text-slate-500">{action.description}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">CRM and Marketing</CardTitle>
                  <CardDescription className="text-slate-400">
                    Data coming from the unified boost backend
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Open Leads</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{actionableLeads.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Campaigns</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{campaigns.length}</p>
                    </div>
                  </div>

                  <Separator className="bg-slate-800" />

                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Upcoming Follow-ups</p>
                    {upcomingFollowUps.length > 0 ? (
                      upcomingFollowUps.map((lead) => (
                        <div key={lead.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                              <p className="truncate text-xs text-slate-500">
                                {lead.company || "No company"} • {lead.status}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">
                              {formatDate(lead.nextFollowUp)}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No follow-ups scheduled yet.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Top Campaigns</p>
                    {topCampaigns.length > 0 ? (
                      topCampaigns.map((campaign) => (
                        <div key={campaign.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{campaign.name}</p>
                              <p className="truncate text-xs text-slate-500">
                                {campaign.type} • {campaign.status}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-orange-400">{formatOpenRate(campaign)}</p>
                              <p className="text-xs text-slate-500">open rate</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No campaign data yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {isAdminView ? (
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">Ops Pulse</CardTitle>
                    <CardDescription className="text-slate-400">
                      Live operational posture for support, incidents and maintenance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Health</p>
                        <p className="mt-1 text-2xl font-semibold text-white">
                          {ops?.health.status || "unknown"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Release</p>
                        <p className="mt-1 text-2xl font-semibold text-white">
                          {ops?.health.releaseReady ? "ready" : "hold"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Tickets</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{ops?.stats.openTickets || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Incidents</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{ops?.stats.openIncidents || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Overdue follow-ups</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{ops?.stats.overdueFollowUps || 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Stale proposals</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{ops?.stats.staleProposals || 0}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Current alerts</p>
                      {(ops?.alerts || []).length > 0 ? (
                        ops?.alerts.slice(0, 4).map((alert) => (
                          <div
                            key={alert}
                            className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                            <span>{alert}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No operational alerts right now.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Learning Progress</CardTitle>
                <CardDescription className="text-slate-400">
                  FRG Learn is now represented in the root project and ready for full implementation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Assets</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{learning.stats.totalItems}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Completed</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{learning.stats.completedItems}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Hours</p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {(learning.stats.totalTimeSpent / 60).toFixed(1)}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Learning completion</span>
                    <span>{formatPercent(learning.stats.completionRate)}</span>
                  </div>
                  <Progress value={learning.stats.completionRate} className="h-2 bg-slate-800" />
                </div>
                <div className="space-y-2">
                  {learning.items.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {item.category} • {item.level} • {item.type}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {item.completed ? "Done" : "Open"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Unified Project Decision</CardTitle>
                <CardDescription className="text-slate-400">
                  What this root app inherited from the three sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    icon: LayoutDashboard,
                    title: "From Builder_Rey30",
                    description: "Dashboard-first navigation and a cleaner operating home for the app.",
                  },
                  {
                    icon: Rocket,
                    title: "From Builder-FRG-LLC",
                    description: "Stronger data model ideas, learning backend direction and production workflow focus.",
                  },
                  {
                    icon: TrendingUp,
                    title: "From FRG Builder root",
                    description: "The broadest module coverage: estimate, chat, learn, boost and admin in one Next.js base.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default DashboardModule;
