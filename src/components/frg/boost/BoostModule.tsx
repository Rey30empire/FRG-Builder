"use client";

import * as React from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Plus,
  Rocket,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store";
import type { Campaign, Email, Lead } from "@/types";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getLeadFollowUpState, getLeadWeightedValue } from "@/lib/crm";

type BoostTab = "pipeline" | "campaigns" | "generator";
type GeneratorMode = "email" | "social" | "sequence";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

interface GeneratorOutput {
  subject?: string;
  body?: string;
  cta?: string;
  title?: string;
  headline?: string;
  bullets?: string[];
  steps?: Array<{ dayOffset: number; channel: string; subject: string; message: string }>;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function relativeTime(value?: string | Date | null) {
  if (!value) return "No activity";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload.data as T;
}

function getPriorityTone(priority?: Lead["priority"]) {
  switch (priority) {
    case "high":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    case "low":
      return "border-slate-700 bg-slate-900 text-slate-300";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
}

function getFollowUpTone(value?: Date | string | null) {
  const state = getLeadFollowUpState(value);
  switch (state) {
    case "overdue":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    case "today":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "this-week":
      return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    case "scheduled":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function LeadItem({ lead, active, onClick }: { lead: Lead; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        active ? "border-orange-500/40 bg-orange-500/10" : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{lead.name}</p>
          <p className="truncate text-xs text-slate-500">{lead.company || "No company"}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-300">{lead.status}</Badge>
          <Badge variant="outline" className={getPriorityTone(lead.priority || "medium")}>
            {lead.priority || "medium"}
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{lead.email || "No email"}</span>
        <span>{lead.estimatedValue ? formatCurrency(lead.estimatedValue) : "No value"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span className="truncate">{lead.source || "No source"}</span>
        <span>{lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "No follow-up"}</span>
      </div>
    </button>
  );
}

function ActivityItem({ item }: { item: ActivityEntry }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{item.action} {item.entity}</p>
          <p className="truncate text-xs text-slate-500">
            {item.details?.recipientEmail?.toString() || item.details?.projectId?.toString() || item.entityId || "No details"}
          </p>
        </div>
        <span className="text-xs text-slate-500">{relativeTime(item.createdAt)}</span>
      </div>
    </div>
  );
}

export function BoostModule({ className }: { className?: string }) {
  const { activeUser, activeProject, setActiveModule } = useAppStore();
  const [activeTab, setActiveTab] = React.useState<BoostTab>("pipeline");
  const [search, setSearch] = React.useState("");
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [emails, setEmails] = React.useState<Email[]>([]);
  const [activity, setActivity] = React.useState<ActivityEntry[]>([]);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSendingEmailId, setIsSendingEmailId] = React.useState<string | null>(null);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = React.useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = React.useState(false);
  const [generatorMode, setGeneratorMode] = React.useState<GeneratorMode>("email");
  const [generatorOutput, setGeneratorOutput] = React.useState<GeneratorOutput | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [leadDraft, setLeadDraft] = React.useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    source: "website",
    notes: "",
    priority: "medium",
    estimatedValue: "",
    nextFollowUp: "",
    expectedCloseDate: "",
  });
  const [campaignDraft, setCampaignDraft] = React.useState({
    name: "",
    type: "email",
    target: "",
    status: "draft",
    budget: "",
    scheduledAt: "",
  });
  const [generatorForm, setGeneratorForm] = React.useState({ topic: "", audience: "", tone: "professional", platform: "linkedin" });

  const syncData = React.useEffectEvent(async () => {
    const [nextLeads, nextCampaigns, nextEmails, nextActivity] = await Promise.all([
      readApi<Lead[]>("/api/leads"),
      readApi<Campaign[]>("/api/campaigns"),
      readApi<Email[]>("/api/emails"),
      readApi<ActivityEntry[]>("/api/activity?limit=10"),
    ]);
    React.startTransition(() => {
      setLeads(nextLeads);
      setCampaigns(nextCampaigns);
      setEmails(nextEmails);
      setActivity(nextActivity);
      setSelectedLeadId((current) => current || nextLeads[0]?.id || null);
    });
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        await syncData();
      } catch (error) {
        if (!cancelled) {
          toast({ title: "Boost data failed to load", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeUser?.id, syncData]);

  const filteredLeads = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leads;
    return leads.filter((lead) => [lead.name, lead.company, lead.email, lead.source].filter(Boolean).some((value) => value?.toLowerCase().includes(query)));
  }, [leads, search]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;
  const selectedLeadEmails = selectedLead ? emails.filter((email) => email.leadId === selectedLead.id) : [];
  const selectedLeadInteractions = Array.isArray(selectedLead?.interactions)
    ? selectedLead.interactions
    : [];
  const upcomingFollowUps = [...leads].filter((lead) => lead.nextFollowUp).sort((a, b) => new Date(a.nextFollowUp as Date).getTime() - new Date(b.nextFollowUp as Date).getTime()).slice(0, 5);
  const overdueLeads = leads.filter((lead) => getLeadFollowUpState(lead.nextFollowUp) === "overdue");
  const weightedPipeline = leads.reduce((sum, lead) => sum + getLeadWeightedValue(lead), 0);
  const pipelineStages: Lead["status"][] = ["new", "contacted", "qualified", "proposal", "closed"];
  const stats = {
    leads: leads.length,
    proposals: leads.filter((lead) => lead.status === "proposal").length,
    won: leads.filter((lead) => lead.status === "closed").length,
    campaigns: campaigns.filter((campaign) => campaign.status === "active").length,
    weightedPipeline,
    overdue: overdueLeads.length,
  };

  async function handleCreateLead() {
    try {
      await readApi<Lead>("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...leadDraft,
          estimatedValue: leadDraft.estimatedValue ? Number(leadDraft.estimatedValue) : undefined,
          nextFollowUp: leadDraft.nextFollowUp || undefined,
          expectedCloseDate: leadDraft.expectedCloseDate || undefined,
        }),
      });
      setLeadDraft({
        name: "",
        company: "",
        email: "",
        phone: "",
        source: "website",
        notes: "",
        priority: "medium",
        estimatedValue: "",
        nextFollowUp: "",
        expectedCloseDate: "",
      });
      setIsLeadDialogOpen(false);
      await syncData();
      toast({ title: "Lead created", description: "The CRM pipeline was updated." });
    } catch (error) {
      toast({ title: "Lead creation failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  }

  async function handleSaveLead() {
    if (!selectedLead) return;
    try {
      setIsSaving(true);
      await readApi<Lead>("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedLead),
      });
      await syncData();
      toast({ title: "Lead updated", description: "Status, notes and follow-up were saved." });
    } catch (error) {
      toast({ title: "Lead update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateCampaign() {
    try {
      await readApi<Campaign>("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...campaignDraft,
          budget: campaignDraft.budget ? Number(campaignDraft.budget) : undefined,
          scheduledAt: campaignDraft.scheduledAt || undefined,
          content: generatorOutput && generatorMode !== "email" ? generatorOutput : null,
        }),
      });
      setCampaignDraft({
        name: "",
        type: "email",
        target: "",
        status: "draft",
        budget: "",
        scheduledAt: "",
      });
      setIsCampaignDialogOpen(false);
      await syncData();
      toast({ title: "Campaign created", description: "The promotion draft is now stored in Boost." });
    } catch (error) {
      toast({ title: "Campaign creation failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  }

  async function handleSendEmail(emailId: string) {
    try {
      setIsSendingEmailId(emailId);
      await readApi<Email>("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId,
          nextFollowUp: selectedLead?.nextFollowUp ? new Date(selectedLead.nextFollowUp).toISOString() : undefined,
        }),
      });
      await syncData();
      toast({ title: "Email sent", description: "The follow-up was delivered and the CRM activity was updated." });
    } catch (error) {
      toast({ title: "Email send failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSendingEmailId(null);
    }
  }

  async function handleCampaignStatusChange(campaign: Campaign, status: Campaign["status"]) {
    try {
      setIsSaving(true);
      await readApi<Campaign>("/api/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...campaign,
          status,
        }),
      });
      await syncData();
      toast({ title: "Campaign updated", description: `Campaign moved to ${status}.` });
    } catch (error) {
      toast({ title: "Campaign update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateContent() {
    try {
      setIsGenerating(true);
      const output = await readApi<GeneratorOutput>("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: generatorMode,
          topic: generatorForm.topic,
          audience: generatorForm.audience,
          tone: generatorForm.tone,
          platform: generatorForm.platform,
          leadId: selectedLead?.id,
          projectId: activeProject?.id,
        }),
      });
      setGeneratorOutput(output);
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveGenerated() {
    if (!generatorOutput) return;
    try {
      setIsSaving(true);
      if (generatorMode === "email") {
        await readApi<Email>("/api/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: selectedLead?.id,
            projectId: activeProject?.id,
            subject: generatorOutput.subject || `Draft for ${generatorForm.topic}`,
            body: generatorOutput.body || "",
            type: selectedLead?.status === "proposal" ? "followup" : "outreach",
            status: "draft",
            metadata: { cta: generatorOutput.cta, template: "marketing-generator" },
          }),
        });
        setActiveTab("pipeline");
      } else {
        await readApi<Campaign>("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: generatorMode === "social" ? `${generatorForm.topic} social push` : `${selectedLead?.name || "Lead"} follow-up sequence`,
            type: generatorMode === "social" ? "social" : "email",
            target: generatorForm.audience || selectedLead?.company || "Target audience",
            status: "draft",
            content: generatorOutput,
          }),
        });
        setActiveTab("campaigns");
      }
      await syncData();
      toast({ title: "Content saved", description: "Generated output is now stored in Boost." });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn("flex h-full bg-slate-950", className)}>
      <ModuleHeader
        title="FRG Boost"
        description={`CRM, follow-up and promotion${activeUser?.name ? ` • profile: ${activeUser.name}` : ""}`}
        quickActions={[
          { id: "lead", label: "Add Lead", icon: Plus, onClick: () => setIsLeadDialogOpen(true) },
          { id: "campaign", label: "Create Campaign", icon: Rocket, onClick: () => setIsCampaignDialogOpen(true), variant: "outline" },
          { id: "estimate", label: "Open Estimate", icon: FileText, onClick: () => setActiveModule("estimate"), variant: "outline" },
        ]}
        statusIndicators={[
          { id: "leads", label: "Leads", status: stats.leads ? "success" : "idle", value: stats.leads },
          { id: "proposals", label: "Proposal", status: stats.proposals ? "pending" : "idle", value: stats.proposals },
          { id: "campaigns", label: "Campaigns", status: stats.campaigns ? "success" : "idle", value: stats.campaigns },
          { id: "follow-ups", label: "Overdue", status: stats.overdue ? "error" : "idle", value: stats.overdue },
        ]}
      />

      <aside className="hidden w-80 border-r border-slate-800 bg-slate-950 xl:flex xl:flex-col">
        <div className="border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Pipeline</p>
            <Badge variant="outline" className="border-slate-700 text-slate-300">{filteredLeads.length}</Badge>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads..." className="border-slate-800 bg-slate-900 pl-9 text-slate-200 placeholder:text-slate-500" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-3">
            {filteredLeads.map((lead) => (
              <LeadItem key={lead.id} lead={lead} active={lead.id === selectedLeadId} onClick={() => setSelectedLeadId(lead.id)} />
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Sparkles className="h-8 w-8 animate-pulse text-orange-400" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BoostTab)} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-800 px-6 py-4">
              <TabsList className="border border-slate-800 bg-slate-900/50">
                <TabsTrigger value="pipeline" className="data-[state=active]:bg-slate-800"><Users className="mr-1.5 h-4 w-4" />Pipeline</TabsTrigger>
                <TabsTrigger value="campaigns" className="data-[state=active]:bg-slate-800"><Target className="mr-1.5 h-4 w-4" />Campaigns</TabsTrigger>
                <TabsTrigger value="generator" className="data-[state=active]:bg-slate-800"><Sparkles className="mr-1.5 h-4 w-4" />Generator</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="pipeline" className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Leads", value: stats.leads, Icon: Users },
                    { label: "Proposals", value: stats.proposals, Icon: FileText },
                    { label: "Won Jobs", value: stats.won, Icon: CheckCircle2 },
                    { label: "Active Campaigns", value: stats.campaigns, Icon: Rocket },
                  ].map(({ label, value, Icon }) => (
                    <Card key={label} className="border-slate-800 bg-slate-950/70">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-400"><Icon className="h-5 w-5" /></div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                        </div>
                        <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-slate-800 bg-slate-950/70">
                    <CardHeader>
                      <CardTitle className="text-white">Weighted Pipeline</CardTitle>
                      <CardDescription className="text-slate-400">Estimated value weighted by stage probability.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-semibold text-white">{formatCurrency(stats.weightedPipeline)}</p>
                        <p className="mt-2 text-sm text-slate-500">Open pipeline value {formatCurrency(leads.reduce((sum, lead) => sum + Number(lead.estimatedValue || 0), 0))}</p>
                      </div>
                      <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-400">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-slate-800 bg-slate-950/70">
                    <CardHeader>
                      <CardTitle className="text-white">Follow-up Health</CardTitle>
                      <CardDescription className="text-slate-400">Keep overdue opportunities from going cold.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Overdue</p>
                        <p className="mt-2 text-2xl font-semibold text-rose-200">{stats.overdue}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
                        <p className="mt-2 text-2xl font-semibold text-amber-200">{leads.filter((lead) => getLeadFollowUpState(lead.nextFollowUp) === "today").length}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">This Week</p>
                        <p className="mt-2 text-2xl font-semibold text-sky-200">{leads.filter((lead) => getLeadFollowUpState(lead.nextFollowUp) === "this-week").length}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-5">
                  {pipelineStages.map((stage) => {
                    const stageLeads = filteredLeads.filter((lead) => lead.status === stage);
                    const stageValue = stageLeads.reduce((sum, lead) => sum + Number(lead.estimatedValue || 0), 0);

                    return (
                      <Card key={stage} className="border-slate-800 bg-slate-950/70">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm capitalize text-white">{stage}</CardTitle>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">{stageLeads.length}</Badge>
                          </div>
                          <CardDescription className="text-slate-500">{formatCurrency(stageValue)}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {stageLeads.slice(0, 3).map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              onClick={() => setSelectedLeadId(lead.id)}
                              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-slate-700"
                            >
                              <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                              <p className="truncate text-xs text-slate-500">{lead.company || lead.source || "No company"}</p>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                <span>{formatCurrency(lead.estimatedValue)}</span>
                                <span>{lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "No follow-up"}</span>
                              </div>
                            </button>
                          ))}
                          {!stageLeads.length ? <p className="text-xs text-slate-500">No leads in this stage.</p> : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {selectedLead ? (
                  <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card className="border-slate-800 bg-slate-950/70">
                        <CardHeader>
                          <CardTitle className="text-white">Lead Workspace</CardTitle>
                          <CardDescription className="text-slate-400">Update status, notes, and proposal follow-up for the selected lead.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={getPriorityTone(selectedLead.priority || "medium")}>
                              Priority: {selectedLead.priority || "medium"}
                            </Badge>
                            <Badge variant="outline" className={getFollowUpTone(selectedLead.nextFollowUp)}>
                              Follow-up: {selectedLead.nextFollowUp ? formatDate(selectedLead.nextFollowUp) : "Not scheduled"}
                            </Badge>
                            <Badge variant="outline" className="border-slate-700 text-slate-300">
                              Weighted value: {formatCurrency(getLeadWeightedValue(selectedLead))}
                            </Badge>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-400">Name</Label>
                              <Input value={selectedLead.name} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, name: event.target.value } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                            </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Company</Label>
                            <Input value={selectedLead.company || ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, company: event.target.value } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Email</Label>
                            <Input value={selectedLead.email || ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, email: event.target.value } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Status</Label>
                            <Select value={selectedLead.status} onValueChange={(value) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, status: value as Lead["status"] } : lead))}>
                              <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger>
                              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                                <SelectItem value="new">new</SelectItem><SelectItem value="contacted">contacted</SelectItem><SelectItem value="qualified">qualified</SelectItem><SelectItem value="proposal">proposal</SelectItem><SelectItem value="closed">closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-400">Next Follow-up</Label>
                              <Input type="date" value={selectedLead.nextFollowUp ? new Date(selectedLead.nextFollowUp).toISOString().slice(0, 10) : ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, nextFollowUp: event.target.value ? new Date(`${event.target.value}T12:00:00`) : undefined } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Source</Label>
                              <Input value={selectedLead.source || ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, source: event.target.value } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-2">
                              <Label className="text-slate-400">Priority</Label>
                              <Select value={selectedLead.priority || "medium"} onValueChange={(value) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, priority: value as Lead["priority"] } : lead))}>
                                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                                  <SelectItem value="low">low</SelectItem>
                                  <SelectItem value="medium">medium</SelectItem>
                                  <SelectItem value="high">high</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Estimated Value</Label>
                              <Input type="number" value={selectedLead.estimatedValue || ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, estimatedValue: event.target.value ? Number(event.target.value) : undefined } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Expected Close</Label>
                              <Input type="date" value={selectedLead.expectedCloseDate ? new Date(selectedLead.expectedCloseDate).toISOString().slice(0, 10) : ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, expectedCloseDate: event.target.value ? new Date(`${event.target.value}T12:00:00`) : undefined } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Last Contact</Label>
                              <Input type="date" value={selectedLead.lastContactAt ? new Date(selectedLead.lastContactAt).toISOString().slice(0, 10) : ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, lastContactAt: event.target.value ? new Date(`${event.target.value}T12:00:00`) : undefined } : lead))} className="border-slate-800 bg-slate-900 text-slate-200" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400">Notes</Label>
                            <Textarea value={selectedLead.notes || ""} onChange={(event) => setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, notes: event.target.value } : lead))} className="min-h-[120px] border-slate-800 bg-slate-900 text-slate-200" />
                          </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void handleSaveLead()} disabled={isSaving} className="bg-orange-500 text-white hover:bg-orange-600"><CheckCircle2 className="mr-1.5 h-4 w-4" />Save lead</Button>
                          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setGeneratorMode("email"); setGeneratorForm((current) => ({ ...current, topic: selectedLead.company ? `follow-up for ${selectedLead.company}` : `follow-up for ${selectedLead.name}`, audience: selectedLead.company || selectedLead.name })); setActiveTab("generator"); }}><Mail className="mr-1.5 h-4 w-4" />Draft follow-up</Button>
                          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => setActiveModule("estimate")}><FileText className="mr-1.5 h-4 w-4" />Open estimate</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      <Card className="border-slate-800 bg-slate-950/70">
                        <CardHeader><CardTitle className="text-white">Email History</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {selectedLeadEmails.length ? selectedLeadEmails.map((email) => (
                            <div key={email.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">{email.subject}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">{email.type} • {email.status} • {formatDate(email.sentAt || email.updatedAt)}</p>
                                </div>
                                <Badge variant="outline" className="border-slate-700 text-slate-300">{email.status}</Badge>
                              </div>
                              <p className="mt-3 line-clamp-3 text-sm text-slate-400">{email.body}</p>
                              {email.status === "draft" ? (
                                <Button
                                  size="sm"
                                  className="mt-3 bg-orange-500 text-white hover:bg-orange-600"
                                  onClick={() => void handleSendEmail(email.id)}
                                  disabled={isSendingEmailId === email.id || !selectedLead.email}
                                >
                                  {isSendingEmailId === email.id ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="mr-1.5 h-4 w-4" />
                                  )}
                                  Send now
                                </Button>
                              ) : null}
                            </div>
                          )) : <p className="text-sm text-slate-500">No email records for this lead yet.</p>}
                        </CardContent>
                      </Card>
                      <Card className="border-slate-800 bg-slate-950/70">
                        <CardHeader><CardTitle className="text-white">Lead Activity</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {selectedLeadInteractions.length ? selectedLeadInteractions.map((interaction, index) => (
                            <div key={`${String(interaction.createdAt || index)}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                              <p className="text-sm font-medium text-white">{String(interaction.title || interaction.type || "Interaction")}</p>
                              <p className="mt-1 text-xs text-slate-500">{String(interaction.description || "No description")}</p>
                              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-600">{interaction.createdAt ? relativeTime(String(interaction.createdAt)) : "Recorded"}</p>
                            </div>
                          )) : <p className="text-sm text-slate-500">No lead interactions recorded yet.</p>}
                        </CardContent>
                      </Card>
                      <Card className="border-slate-800 bg-slate-950/70">
                        <CardHeader><CardTitle className="text-white">Upcoming Follow-ups</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {upcomingFollowUps.map((lead) => (
                            <div key={lead.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                              <p className="truncate text-sm font-medium text-white">{lead.name}</p>
                              <p className="mt-1 truncate text-xs text-slate-500">{lead.company || lead.status} • {formatDate(lead.nextFollowUp)}</p>
                              <div className="mt-2">
                                <Badge variant="outline" className={getFollowUpTone(lead.nextFollowUp)}>
                                  {getLeadFollowUpState(lead.nextFollowUp)}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <Card className="border-dashed border-slate-800 bg-slate-950/50"><CardContent className="p-8 text-center"><Users className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No leads available</p></CardContent></Card>
                )}
              </TabsContent>

              <TabsContent value="campaigns" className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-lg font-semibold text-white">Campaign Library</h2><p className="text-sm text-slate-500">Stored promotion drafts and active pushes.</p></div>
                  <Button onClick={() => setIsCampaignDialogOpen(true)} className="bg-orange-500 text-white hover:bg-orange-600"><Plus className="mr-1.5 h-4 w-4" />Add campaign</Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {campaigns.map((campaign) => (
                    <Card key={campaign.id} className="border-slate-800 bg-slate-950/70">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between"><Badge variant="outline" className="border-slate-700 text-slate-300">{campaign.type}</Badge><span className="text-xs text-slate-500">{campaign.status}</span></div>
                        <p className="mt-4 text-base font-semibold text-white">{campaign.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{campaign.target || "No target"}</p>
                        <p className="mt-4 text-xs text-slate-500">Sent {campaign.sent || 0} • Opened {campaign.opened || 0} • Won {campaign.converted || 0}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Budget</p>
                            <p className="mt-2 text-sm text-white">{campaign.budget ? formatCurrency(campaign.budget) : "Not set"}</p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Scheduled</p>
                            <p className="mt-2 text-sm text-white">{campaign.scheduledAt ? formatDate(campaign.scheduledAt) : "Not scheduled"}</p>
                          </div>
                        </div>
                        {campaign.content ? <div className="mt-4 rounded-xl bg-slate-900/70 p-3 text-xs text-slate-400">{typeof campaign.content === "object" ? JSON.stringify(campaign.content).slice(0, 180) : String(campaign.content).slice(0, 180)}</div> : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {campaign.status !== "active" ? (
                            <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" disabled={isSaving} onClick={() => void handleCampaignStatusChange(campaign, "active")}>
                              <Rocket className="mr-1.5 h-4 w-4" />
                              Launch
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" disabled={isSaving} onClick={() => void handleCampaignStatusChange(campaign, "paused")}>
                              Pause
                            </Button>
                          )}
                          {campaign.status !== "completed" ? (
                            <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" disabled={isSaving} onClick={() => void handleCampaignStatusChange(campaign, "completed")}>
                              Complete
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="generator" className="space-y-6 p-6">
                <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                  <Card className="border-slate-800 bg-slate-950/70">
                    <CardHeader><CardTitle className="text-white">Content Generator</CardTitle><CardDescription className="text-slate-400">Generate email, social copy or sequence and save it into Boost.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2"><Label className="text-slate-400">Mode</Label><Select value={generatorMode} onValueChange={(value) => setGeneratorMode(value as GeneratorMode)}><SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger><SelectContent className="border-slate-800 bg-slate-900 text-slate-200"><SelectItem value="email">email</SelectItem><SelectItem value="social">social</SelectItem><SelectItem value="sequence">sequence</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label className="text-slate-400">Topic</Label><Input value={generatorForm.topic} onChange={(event) => setGeneratorForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Proposal follow-up, ADU offer, TI outreach..." className="border-slate-800 bg-slate-900 text-slate-200 placeholder:text-slate-500" /></div>
                      <div className="space-y-2"><Label className="text-slate-400">Audience</Label><Input value={generatorForm.audience} onChange={(event) => setGeneratorForm((current) => ({ ...current, audience: event.target.value }))} placeholder="Owners, developers, commercial tenants..." className="border-slate-800 bg-slate-900 text-slate-200 placeholder:text-slate-500" /></div>
                      <div className="space-y-2"><Label className="text-slate-400">{generatorMode === "social" ? "Platform" : "Tone"}</Label><Input value={generatorMode === "social" ? generatorForm.platform : generatorForm.tone} onChange={(event) => setGeneratorForm((current) => ({ ...current, ...(generatorMode === "social" ? { platform: event.target.value } : { tone: event.target.value }) }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
                      <Button onClick={() => void handleGenerateContent()} disabled={!generatorForm.topic || isGenerating} className="w-full bg-orange-500 text-white hover:bg-orange-600"><Sparkles className="mr-1.5 h-4 w-4" />Generate content</Button>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-800 bg-slate-950/70">
                    <CardHeader><CardTitle className="text-white">Generated Output</CardTitle><CardDescription className="text-slate-400">Review and save to CRM or campaigns.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                      {generatorOutput ? (
                        <>
                          {generatorOutput.subject ? <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Subject</p><p className="mt-2 text-sm text-white">{generatorOutput.subject}</p></div> : null}
                          {generatorOutput.headline ? <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Headline</p><p className="mt-2 text-sm text-white">{generatorOutput.headline}</p></div> : null}
                          {generatorOutput.body ? <Textarea readOnly value={generatorOutput.body} className="min-h-[220px] border-slate-800 bg-slate-900 text-slate-200" /> : null}
                          {generatorOutput.bullets?.length ? <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">{generatorOutput.bullets.map((bullet) => <p key={bullet}>• {bullet}</p>)}</div> : null}
                          {generatorOutput.steps?.length ? <div className="space-y-3">{generatorOutput.steps.map((step) => <div key={`${step.dayOffset}-${step.subject}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm font-medium text-white">Day {step.dayOffset} • {step.channel}</p><p className="mt-1 text-xs text-slate-500">{step.subject}</p><p className="mt-2 text-sm text-slate-300">{step.message}</p></div>)}</div> : null}
                          {generatorOutput.cta ? <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">CTA</p><p className="mt-2 text-sm text-white">{generatorOutput.cta}</p></div> : null}
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => void handleSaveGenerated()} disabled={isSaving} className="bg-orange-500 text-white hover:bg-orange-600"><Plus className="mr-1.5 h-4 w-4" />Save output</Button>
                            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => setActiveModule("estimate")}><FileText className="mr-1.5 h-4 w-4" />Use with proposal</Button>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center"><Mail className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No generated output yet</p></div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <div className="grid gap-6 p-6 pt-0 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="border-slate-800 bg-slate-950/70">
                  <CardHeader><CardTitle className="text-white">Recent Activity</CardTitle></CardHeader>
                  <CardContent className="space-y-3">{activity.length ? activity.map((item) => <ActivityItem key={item.id} item={item} />) : <p className="text-sm text-slate-500">No activity recorded yet.</p>}</CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-950/70">
                  <CardHeader><CardTitle className="text-white">Commercial Focus</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-400">
                    <p>Use Boost after sending proposals to keep follow-ups, campaigns and CRM activity in one place.</p>
                    <p className="flex items-center justify-between"><span>Current project</span><span className="text-white">{activeProject?.name || "None selected"}</span></p>
                    <p className="flex items-center justify-between"><span>Next follow-ups</span><span className="text-white">{upcomingFollowUps.length}</span></p>
                    <p className="flex items-center justify-between"><span>Draft emails</span><span className="text-white">{emails.filter((email) => email.status === "draft").length}</span></p>
                    <p className="flex items-center justify-between"><span>Weighted pipeline</span><span className="text-white">{formatCurrency(stats.weightedPipeline)}</span></p>
                    <p className="flex items-center justify-between"><span>Overdue follow-ups</span><span className={cn("text-white", stats.overdue ? "text-rose-300" : "text-white")}>{stats.overdue}</span></p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </div>

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200">
          <DialogHeader><DialogTitle className="text-white">Add Lead</DialogTitle><DialogDescription className="text-slate-400">Create a new lead for the CRM pipeline.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label className="text-slate-400">Name</Label><Input value={leadDraft.name} onChange={(event) => setLeadDraft((current) => ({ ...current, name: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2"><Label className="text-slate-400">Company</Label><Input value={leadDraft.company} onChange={(event) => setLeadDraft((current) => ({ ...current, company: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label className="text-slate-400">Email</Label><Input value={leadDraft.email} onChange={(event) => setLeadDraft((current) => ({ ...current, email: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2"><Label className="text-slate-400">Phone</Label><Input value={leadDraft.phone} onChange={(event) => setLeadDraft((current) => ({ ...current, phone: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><Label className="text-slate-400">Source</Label><Input value={leadDraft.source} onChange={(event) => setLeadDraft((current) => ({ ...current, source: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2">
                <Label className="text-slate-400">Priority</Label>
                <Select value={leadDraft.priority} onValueChange={(value) => setLeadDraft((current) => ({ ...current, priority: value }))}>
                  <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    <SelectItem value="low">low</SelectItem>
                    <SelectItem value="medium">medium</SelectItem>
                    <SelectItem value="high">high</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-slate-400">Est. value</Label><Input type="number" value={leadDraft.estimatedValue} onChange={(event) => setLeadDraft((current) => ({ ...current, estimatedValue: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2"><Label className="text-slate-400">Next follow-up</Label><Input type="date" value={leadDraft.nextFollowUp} onChange={(event) => setLeadDraft((current) => ({ ...current, nextFollowUp: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            </div>
            <div className="space-y-2"><Label className="text-slate-400">Expected close</Label><Input type="date" value={leadDraft.expectedCloseDate} onChange={(event) => setLeadDraft((current) => ({ ...current, expectedCloseDate: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            <div className="space-y-2"><Label className="text-slate-400">Notes</Label><Textarea value={leadDraft.notes} onChange={(event) => setLeadDraft((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px] border-slate-800 bg-slate-900 text-slate-200" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsLeadDialogOpen(false)} className="border-slate-700 text-slate-300">Cancel</Button><Button onClick={() => void handleCreateLead()} className="bg-orange-500 text-white hover:bg-orange-600">Create lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200">
          <DialogHeader><DialogTitle className="text-white">Create Campaign</DialogTitle><DialogDescription className="text-slate-400">Save a promotion or sequence draft.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label className="text-slate-400">Name</Label><Input value={campaignDraft.name} onChange={(event) => setCampaignDraft((current) => ({ ...current, name: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label className="text-slate-400">Type</Label><Input value={campaignDraft.type} onChange={(event) => setCampaignDraft((current) => ({ ...current, type: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2"><Label className="text-slate-400">Status</Label><Input value={campaignDraft.status} onChange={(event) => setCampaignDraft((current) => ({ ...current, status: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label className="text-slate-400">Target</Label><Input value={campaignDraft.target} onChange={(event) => setCampaignDraft((current) => ({ ...current, target: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2"><Label className="text-slate-400">Budget</Label><Input type="number" value={campaignDraft.budget} onChange={(event) => setCampaignDraft((current) => ({ ...current, budget: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
              <div className="space-y-2"><Label className="text-slate-400">Scheduled</Label><Input type="date" value={campaignDraft.scheduledAt} onChange={(event) => setCampaignDraft((current) => ({ ...current, scheduledAt: event.target.value }))} className="border-slate-800 bg-slate-900 text-slate-200" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsCampaignDialogOpen(false)} className="border-slate-700 text-slate-300">Cancel</Button><Button onClick={() => void handleCreateCampaign()} className="bg-orange-500 text-white hover:bg-orange-600">Save campaign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BoostModule;
