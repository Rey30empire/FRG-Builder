"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Database,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Shield,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppStore, useSkillsStore, useToolsStore } from "@/store";
import { PERMISSION_LABELS, type Module, type PermissionLevel } from "@/types";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AdminTab = "dashboard" | "skills" | "tools" | "permissions" | "logs" | "settings";
type HealthStatus = "healthy" | "warning" | "critical";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AdminMetric {
  id: string;
  label: string;
  value: string | number;
  status: HealthStatus;
}

interface AdminHealthItem {
  id: string;
  label: string;
  value: string;
  status: HealthStatus;
}

interface AdminSkill {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  module: Module;
  enabled: boolean;
  config?: Record<string, unknown> | null;
}

interface AdminTool {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  enabled: boolean;
  requiredLevel: number;
}

interface AdminUserRow {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  level: number;
  createdAt?: string;
  updatedAt?: string;
  stats: {
    projects: number;
    learningItems: number;
    leads: number;
    campaigns: number;
    conversations: number;
  };
}

interface AdminLogRow {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  details?: Record<string, unknown> | null;
  skill?: string | null;
  tool?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}

interface AdminOverviewResponse {
  metrics: AdminMetric[];
  health: AdminHealthItem[];
  skills: AdminSkill[];
  tools: AdminTool[];
  users: AdminUserRow[];
  logs: AdminLogRow[];
  settings: {
    nodeEnv: string;
    database: { kind: string; label: string };
    storage: { driver: string; label: string };
    email: { provider: string; from: string; replyTo?: string | null };
    aiProviders: {
      primary: string;
      active: string | null;
      providers: Record<
        string,
        { enabled: boolean; model: string; hasApiKey: boolean; label: string }
      >;
    };
    latestBackup?: { id: string; path: string; createdAt: string; uploadsIncluded: boolean } | null;
  };
  company:
    | {
        name: string;
        specialties?: string[];
        workZones?: string[];
        crewInfo?: Record<string, unknown>;
        baseRates?: Record<string, unknown>;
        primaryColor?: string | null;
        proposalTemplate?: string | null;
        aiProviderConfig?: Record<string, unknown> | null;
      }
    | null;
  permissionSummary: Array<{
    level: PermissionLevel;
    count: number;
    capabilities: string[];
  }>;
  counts: {
    campaigns: number;
    emails: number;
    conversations: number;
    supportTickets?: number;
    incidents?: number;
    maintenanceRuns?: number;
  };
  alerts: string[];
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload.data as T;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const tone =
    status === "healthy"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : status === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-rose-500/30 bg-rose-500/10 text-rose-400";

  return (
    <Badge variant="outline" className={tone}>
      {status}
    </Badge>
  );
}

function MetricCard({ metric }: { metric: AdminMetric }) {
  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
          </div>
          <HealthBadge status={metric.status} />
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminModule({ className }: { className?: string }) {
  const { activeUser, activeProject } = useAppStore();
  const { setSkills } = useSkillsStore();
  const { setTools } = useToolsStore();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("dashboard");
  const [overview, setOverview] = React.useState<AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchLogs, setSearchLogs] = React.useState("");
  const [isRunningBackup, setIsRunningBackup] = React.useState(false);
  const [pendingSkillId, setPendingSkillId] = React.useState<string | null>(null);
  const [pendingToolId, setPendingToolId] = React.useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = React.useState<string | null>(null);
  const deferredLogSearch = React.useDeferredValue(searchLogs);

  const syncOverview = React.useEffectEvent(async () => {
    const next = await readApi<AdminOverviewResponse>("/api/admin/overview");
    React.startTransition(() => {
      setOverview(next);
      setSkills(
        next.skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          displayName: skill.displayName,
          description: skill.description || "",
          module: skill.module,
          enabled: skill.enabled,
        }))
      );
      setTools(
        next.tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description || "",
          enabled: tool.enabled,
          requiredLevel: tool.requiredLevel as PermissionLevel,
        }))
      );
    });
  });

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await syncOverview();
      } catch (nextError) {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : "Unable to load admin overview");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [syncOverview]);

  const filteredLogs = React.useMemo(() => {
    const query = deferredLogSearch.trim().toLowerCase();
    if (!overview?.logs) return [];
    if (!query) return overview.logs;

    return overview.logs.filter((log) => {
      const haystack = [
        log.action,
        log.entity,
        log.userName,
        log.userEmail,
        log.skill,
        log.tool,
        JSON.stringify(log.details || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredLogSearch, overview?.logs]);

  const handleRefresh = React.useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      await syncOverview();
      toast({ title: "Admin synced", description: "Live admin data was refreshed." });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to refresh admin data");
      toast({
        title: "Refresh failed",
        description:
          nextError instanceof Error ? nextError.message : "Unable to refresh admin data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [syncOverview]);

  const handleSkillToggle = React.useCallback(
    async (skill: AdminSkill, enabled: boolean) => {
      try {
        setPendingSkillId(skill.id);
        await readApi(`/api/admin/skills`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: skill.id, enabled }),
        });
        await syncOverview();
        toast({
          title: enabled ? "Skill enabled" : "Skill disabled",
          description: `${skill.displayName} was updated in Admin Forge.`,
        });
      } catch (nextError) {
        toast({
          title: "Skill update failed",
          description:
            nextError instanceof Error ? nextError.message : "Unable to update skill settings",
          variant: "destructive",
        });
      } finally {
        setPendingSkillId(null);
      }
    },
    [syncOverview]
  );

  const handleToolPatch = React.useCallback(
    async (tool: AdminTool, patch: Partial<Pick<AdminTool, "enabled" | "requiredLevel">>) => {
      try {
        setPendingToolId(tool.id);
        await readApi(`/api/admin/tools`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tool.id, ...patch }),
        });
        await syncOverview();
        toast({
          title: "Tool policy updated",
          description: `${tool.displayName} permissions are now saved.`,
        });
      } catch (nextError) {
        toast({
          title: "Tool update failed",
          description:
            nextError instanceof Error ? nextError.message : "Unable to update tool policy",
          variant: "destructive",
        });
      } finally {
        setPendingToolId(null);
      }
    },
    [syncOverview]
  );

  const handleUserLevelChange = React.useCallback(
    async (user: AdminUserRow, level: PermissionLevel) => {
      try {
        setPendingUserId(user.id);
        await readApi(`/api/users`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: user.id, level }),
        });
        await syncOverview();
        toast({
          title: "Permission level updated",
          description: `${user.name || user.email} now uses level ${level}.`,
        });
      } catch (nextError) {
        toast({
          title: "Permission update failed",
          description:
            nextError instanceof Error ? nextError.message : "Unable to update permission level",
          variant: "destructive",
        });
      } finally {
        setPendingUserId(null);
      }
    },
    [syncOverview]
  );

  const handleRunBackup = React.useCallback(async () => {
    try {
      setIsRunningBackup(true);
      const result = await readApi<{ output?: string }>(`/api/admin/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup-local" }),
      });
      await syncOverview();
      toast({
        title: "Backup completed",
        description: result.output || "A new local backup snapshot was created.",
      });
    } catch (nextError) {
      toast({
        title: "Backup failed",
        description:
          nextError instanceof Error ? nextError.message : "Unable to run local backup",
        variant: "destructive",
      });
    } finally {
      setIsRunningBackup(false);
    }
  }, [syncOverview]);

  const handleExport = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.open("/api/admin/export", "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div className={cn("flex h-full flex-col gap-6", className)}>
      <ModuleHeader
        title="Admin Forge"
        description={`Operaciones reales, permisos y trazabilidad. ${
          activeUser ? `Sesion: ${activeUser.name || activeUser.email}.` : "Sin sesion activa."
        } ${activeProject ? `Proyecto activo: ${activeProject.name}.` : "Contexto global de admin."}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            {overview?.settings.nodeEnv || "development"}
          </Badge>
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            {overview?.settings.database.label || "Database"}
          </Badge>
          <Badge variant="outline" className="border-slate-700 text-slate-300">
            {overview?.settings.storage.label || "Storage"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Snapshot
          </Button>
          <Button size="sm" onClick={handleRunBackup} disabled={isRunningBackup}>
            {isRunningBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Run Backup
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="flex items-start gap-3 p-4 text-rose-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Admin overview failed to load</p>
              <p className="text-sm text-rose-100/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AdminTab)}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList className="grid w-full grid-cols-3 bg-slate-950/80 lg:grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="min-h-0 flex-1 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(overview?.metrics || []).map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Database className="h-5 w-5 text-orange-300" />
                  System Health
                </CardTitle>
                <CardDescription>Database, storage, email, AI routing, and backup posture.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(overview?.health || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.value}</p>
                    </div>
                    <HealthBadge status={item.status} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-sky-300" />
                  Permission Coverage
                </CardTitle>
                <CardDescription>How many users sit at each execution tier.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(overview?.permissionSummary || []).map((entry) => (
                  <div key={entry.level} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">Level {entry.level}</p>
                        <p className="text-xs text-slate-500">{PERMISSION_LABELS[entry.level]}</p>
                      </div>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {entry.count} users
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      {entry.capabilities.join(" • ") || "No capabilities"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                  Active Alerts
                </CardTitle>
                <CardDescription>Operational gaps we still need to close before full production.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(overview?.alerts || []).length ? (
                  overview?.alerts.map((alert) => (
                    <div
                      key={alert}
                      className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                    >
                      {alert}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    No active admin alerts right now.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Activity className="h-5 w-5 text-emerald-300" />
                  Platform Snapshot
                </CardTitle>
                <CardDescription>Commercial and AI activity currently stored in the app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span>Campaigns tracked</span>
                  <span className="font-medium text-white">{overview?.counts.campaigns || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span>Emails logged</span>
                  <span className="font-medium text-white">{overview?.counts.emails || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span>Conversations saved</span>
                  <span className="font-medium text-white">{overview?.counts.conversations || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span>Open support tickets</span>
                  <span className="font-medium text-white">{overview?.counts.supportTickets || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span>Open incidents</span>
                  <span className="font-medium text-white">{overview?.counts.incidents || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <span>Recent maintenance runs</span>
                  <span className="font-medium text-white">{overview?.counts.maintenanceRuns || 0}</span>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Company memory</p>
                  <p className="mt-2 font-medium text-white">{overview?.company?.name || "No company profile seeded"}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(overview?.company?.specialties || []).join(" • ") || "Specialties not configured yet"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="skills" className="min-h-0 flex-1">
          <ScrollArea className="h-[560px] rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="space-y-3">
              {(overview?.skills || []).map((skill) => (
                <div
                  key={skill.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{skill.displayName}</p>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {skill.module}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          skill.enabled
                            ? "border-emerald-500/30 text-emerald-300"
                            : "border-rose-500/30 text-rose-300"
                        }
                      >
                        {skill.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{skill.description || "No description"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {pendingSkillId === skill.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : null}
                    <Switch
                      checked={skill.enabled}
                      onCheckedChange={(checked) => void handleSkillToggle(skill, checked)}
                      disabled={pendingSkillId === skill.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tools" className="min-h-0 flex-1">
          <ScrollArea className="h-[560px] rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="space-y-3">
              {(overview?.tools || []).map((tool) => (
                <div key={tool.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">{tool.displayName}</p>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {tool.name}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{tool.description || "No description"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {pendingToolId === tool.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : null}
                      <Switch
                        checked={tool.enabled}
                        onCheckedChange={(checked) => void handleToolPatch(tool, { enabled: checked })}
                        disabled={pendingToolId === tool.id}
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-slate-500">Required level</Label>
                      <Select
                        value={String(tool.requiredLevel)}
                        onValueChange={(value) =>
                          void handleToolPatch(tool, {
                            requiredLevel: Number(value) as PermissionLevel,
                          })
                        }
                        disabled={pendingToolId === tool.id}
                      >
                        <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
                          <SelectValue placeholder="Choose level" />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4].map((level) => (
                            <SelectItem key={level} value={String(level)}>
                              Level {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Access policy</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {PERMISSION_LABELS[tool.requiredLevel as PermissionLevel]}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="permissions" className="min-h-0 flex-1">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <ScrollArea className="h-[560px] rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="space-y-3">
                {(overview?.users || []).map((user) => (
                  <div key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">{user.name || user.email}</p>
                          <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {user.role}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Projects {user.stats.projects} • Learn {user.stats.learningItems} • Leads{" "}
                          {user.stats.leads} • Campaigns {user.stats.campaigns} • Chats{" "}
                          {user.stats.conversations}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {pendingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : null}
                        <Select
                          value={String(user.level)}
                          onValueChange={(value) =>
                            void handleUserLevelChange(user, Number(value) as PermissionLevel)
                          }
                          disabled={pendingUserId === user.id}
                        >
                          <SelectTrigger className="w-[220px] border-slate-700 bg-slate-900 text-slate-100">
                            <SelectValue placeholder="Permission level" />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4].map((level) => (
                              <SelectItem key={level} value={String(level)}>
                                Level {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Permission profile</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {PERMISSION_LABELS[user.level as PermissionLevel]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-orange-300" />
                  Level Reference
                </CardTitle>
                <CardDescription>
                  Use this to calibrate who can export, send, or hit live integrations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(overview?.permissionSummary || []).map((entry) => (
                  <div key={entry.level} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">Level {entry.level}</p>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {entry.count}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {entry.capabilities.join(" • ") || "No capabilities"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="min-h-0 flex-1">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="h-5 w-5 text-sky-300" />
                Activity Log
              </CardTitle>
              <CardDescription>
                Audit trail for proposals, outreach, uploads, AI actions, and admin events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={searchLogs}
                onChange={(event) => setSearchLogs(event.target.value)}
                placeholder="Search action, entity, user, skill, tool..."
                className="border-slate-700 bg-slate-950 text-slate-100"
              />
              <ScrollArea className="h-[460px] rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-slate-700 text-slate-300">
                              {log.action}
                            </Badge>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">
                              {log.entity}
                            </Badge>
                            {log.skill ? (
                              <Badge variant="outline" className="border-sky-500/30 text-sky-300">
                                {log.skill}
                              </Badge>
                            ) : null}
                            {log.tool ? (
                              <Badge
                                variant="outline"
                                className="border-orange-500/30 text-orange-300"
                              >
                                {log.tool}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-white">
                            {log.userName || log.userEmail || "System event"}
                          </p>
                          <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                        </div>
                      </div>
                      {log.details ? (
                        <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                  {!filteredLogs.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
                      No logs match this filter.
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="min-h-0 flex-1">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Settings className="h-5 w-5 text-violet-300" />
                  Runtime Settings
                </CardTitle>
                <CardDescription>
                  Current deploy-sensitive configuration as seen by the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Email provider</p>
                  <p className="mt-2 font-medium text-white">
                    {overview?.settings.email.provider || "log"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    From: {overview?.settings.email.from || "Not configured"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Reply-To: {overview?.settings.email.replyTo || "Not configured"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Storage</p>
                  <p className="mt-2 font-medium text-white">
                    {overview?.settings.storage.label || "Unknown"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Driver: {overview?.settings.storage.driver || "local"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Latest backup</p>
                  <p className="mt-2 font-medium text-white">
                    {overview?.settings.latestBackup
                      ? formatDateTime(overview.settings.latestBackup.createdAt)
                      : "No backup snapshot yet"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {overview?.settings.latestBackup?.path ||
                      "Run the backup action to create a snapshot."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Bot className="h-5 w-5 text-emerald-300" />
                  AI Provider Routing
                </CardTitle>
                <CardDescription>
                  OpenAI is primary, but the panel shows readiness for every provider.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(overview?.settings.aiProviders.providers || {}).map(
                  ([key, provider]) => (
                    <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{provider.label}</p>
                          <p className="text-xs text-slate-500">{provider.model}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {overview?.settings.aiProviders.primary === key ? (
                            <Badge variant="outline" className="border-orange-500/30 text-orange-300">
                              Primary
                            </Badge>
                          ) : null}
                          <Badge
                            variant="outline"
                            className={
                              provider.enabled
                                ? "border-emerald-500/30 text-emerald-300"
                                : "border-slate-700 text-slate-300"
                            }
                          >
                            {provider.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        API key {provider.hasApiKey ? "detected" : "missing"}
                      </p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminModule;
