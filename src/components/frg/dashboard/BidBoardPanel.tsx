"use client";

import * as React from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppStore, useProjectsStore } from "@/store";
import type { BidOpportunity, BidOpportunityStatus, Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type OpportunityFormState = {
  id?: string;
  name: string;
  client: string;
  clientEmail: string;
  clientPhone: string;
  estimatorContact: string;
  dueDate: string;
  jobWalkDate: string;
  rfiDueDate: string;
  projectSize: string;
  location: string;
  address: string;
  latitude: string;
  longitude: string;
  scopePackage: string;
  description: string;
  tradeInstructions: string;
  bidFormRequired: boolean;
  bidFormInstructions: string;
  source: string;
  externalUrl: string;
  status: BidOpportunityStatus;
  notes: string;
};

const STATUS_COLUMNS: Array<{
  id: BidOpportunityStatus;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    id: "undecided",
    label: "Undecided",
    description: "New invites waiting on qualification.",
    tone: "border-slate-700 bg-slate-900 text-slate-200",
  },
  {
    id: "accepted",
    label: "Accepted",
    description: "Packages we plan to price and review.",
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  {
    id: "submitted",
    label: "Submitted",
    description: "Bids already issued to the client.",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  {
    id: "won",
    label: "Won",
    description: "Awarded work and negotiated wins.",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  {
    id: "archived",
    label: "Archived",
    description: "Declined, paused or historical bids.",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  },
];

function buildEmptyForm(): OpportunityFormState {
  return {
    name: "",
    client: "",
    clientEmail: "",
    clientPhone: "",
    estimatorContact: "",
    dueDate: "",
    jobWalkDate: "",
    rfiDueDate: "",
    projectSize: "",
    location: "",
    address: "",
    latitude: "",
    longitude: "",
    scopePackage: "",
    description: "",
    tradeInstructions: "",
    bidFormRequired: false,
    bidFormInstructions: "",
    source: "manual-intake",
    externalUrl: "",
    status: "undecided",
    notes: "",
  };
}

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function mapOpportunityToForm(opportunity: BidOpportunity): OpportunityFormState {
  return {
    id: opportunity.id,
    name: opportunity.name || "",
    client: opportunity.client || "",
    clientEmail: opportunity.clientEmail || "",
    clientPhone: opportunity.clientPhone || "",
    estimatorContact: opportunity.estimatorContact || "",
    dueDate: toDateInputValue(opportunity.dueDate),
    jobWalkDate: toDateInputValue(opportunity.jobWalkDate),
    rfiDueDate: toDateInputValue(opportunity.rfiDueDate),
    projectSize: opportunity.projectSize || "",
    location: opportunity.location || "",
    address: opportunity.address || "",
    latitude:
      opportunity.latitude === null || opportunity.latitude === undefined
        ? ""
        : String(opportunity.latitude),
    longitude:
      opportunity.longitude === null || opportunity.longitude === undefined
        ? ""
        : String(opportunity.longitude),
    scopePackage: opportunity.scopePackage || "",
    description: opportunity.description || "",
    tradeInstructions: opportunity.tradeInstructions || "",
    bidFormRequired: Boolean(opportunity.bidFormRequired),
    bidFormInstructions: opportunity.bidFormInstructions || "",
    source: opportunity.source || "manual-intake",
    externalUrl: opportunity.externalUrl || "",
    status: opportunity.status,
    notes: opportunity.notes || "",
  };
}

function formatDate(value?: string | Date | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function serializeForm(form: OpportunityFormState) {
  return {
    ...(form.id ? { id: form.id } : {}),
    name: form.name,
    client: form.client || undefined,
    clientEmail: form.clientEmail || undefined,
    clientPhone: form.clientPhone || undefined,
    estimatorContact: form.estimatorContact || undefined,
    dueDate: form.dueDate || undefined,
    jobWalkDate: form.jobWalkDate || undefined,
    rfiDueDate: form.rfiDueDate || undefined,
    projectSize: form.projectSize || undefined,
    location: form.location || undefined,
    address: form.address || undefined,
    latitude: form.latitude || undefined,
    longitude: form.longitude || undefined,
    scopePackage: form.scopePackage || undefined,
    description: form.description || undefined,
    tradeInstructions: form.tradeInstructions || undefined,
    bidFormRequired: form.bidFormRequired,
    bidFormInstructions: form.bidFormInstructions || undefined,
    source: form.source || undefined,
    externalUrl: form.externalUrl || undefined,
    status: form.status,
    notes: form.notes || undefined,
  };
}

function OpportunityCard({
  opportunity,
  selected,
  onClick,
}: {
  opportunity: BidOpportunity;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition",
        selected
          ? "border-orange-500/40 bg-orange-500/10"
          : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{opportunity.name}</p>
          <p className="truncate text-xs text-slate-500">
            {opportunity.client || "No client"}
            {opportunity.location ? ` • ${opportunity.location}` : ""}
          </p>
        </div>
        {opportunity.linkedProject ? (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            linked
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Due {formatDate(opportunity.dueDate)}</span>
        </div>
        <p className="line-clamp-2 text-xs text-slate-500">
          {opportunity.scopePackage || opportunity.description || "No scope package yet."}
        </p>
      </div>
    </button>
  );
}

export function BidBoardPanel() {
  const { setActiveModule, setActiveProject } = useAppStore();
  const { projects, addProject, updateProject } = useProjectsStore();
  const [opportunities, setOpportunities] = React.useState<BidOpportunity[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<OpportunityFormState>(buildEmptyForm());
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isConverting, setIsConverting] = React.useState(false);

  const selectedOpportunity = React.useMemo(
    () => opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) || null,
    [opportunities, selectedOpportunityId]
  );

  const grouped = React.useMemo(
    () =>
      STATUS_COLUMNS.map((column) => ({
        ...column,
        items: opportunities.filter((opportunity) => opportunity.status === column.id),
      })),
    [opportunities]
  );

  const syncBoard = React.useEffectEvent(async () => {
    const response = await fetch("/api/opportunities");
    const payload = (await response.json()) as ApiEnvelope<BidOpportunity[]>;

    if (!payload.success || !payload.data) {
      throw new Error(payload.error || "Unable to load bid opportunities");
    }

    const data = payload.data;

    React.startTransition(() => {
      setOpportunities(data);

      if (!selectedOpportunityId && data[0]) {
        setSelectedOpportunityId(data[0].id);
        setForm(mapOpportunityToForm(data[0]));
        return;
      }

      if (selectedOpportunityId) {
        const nextSelected = data.find((item) => item.id === selectedOpportunityId) || null;
        if (nextSelected) {
          setForm(mapOpportunityToForm(nextSelected));
        }
      }
    });
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      try {
        setIsLoading(true);
        await syncBoard();
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Bid board failed to load",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, [syncBoard]);

  function handleSelect(opportunity: BidOpportunity) {
    setSelectedOpportunityId(opportunity.id);
    setForm(mapOpportunityToForm(opportunity));
  }

  function handleNewOpportunity() {
    setSelectedOpportunityId(null);
    setForm(buildEmptyForm());
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({
        title: "Opportunity name required",
        description: "Add the bid or opportunity name before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch("/api/opportunities", {
        method: form.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serializeForm(form)),
      });

      const payload = (await response.json()) as ApiEnvelope<BidOpportunity>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to save opportunity");
      }

      const savedOpportunity = payload.data;

      setOpportunities((current) =>
        form.id
          ? current.map((item) => (item.id === savedOpportunity.id ? savedOpportunity : item))
          : [savedOpportunity, ...current]
      );
      setSelectedOpportunityId(savedOpportunity.id);
      setForm(mapOpportunityToForm(savedOpportunity));

      toast({
        title: form.id ? "Opportunity updated" : "Opportunity created",
        description: "The bid intake record is now stored in the board.",
      });
    } catch (error) {
      toast({
        title: "Bid intake save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConvertToProject() {
    if (!selectedOpportunity?.id) return;

    try {
      setIsConverting(true);

      const response = await fetch("/api/opportunities/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunityId: selectedOpportunity.id,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<{
        opportunity: BidOpportunity;
        project: Project;
      }>;

      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to convert opportunity");
      }

      const conversion = payload.data;

      setOpportunities((current) =>
        current.map((item) => (item.id === conversion.opportunity.id ? conversion.opportunity : item))
      );
      setSelectedOpportunityId(conversion.opportunity.id);
      setForm(mapOpportunityToForm(conversion.opportunity));

      const existingProject = projects.find((project) => project.id === conversion.project.id);
      if (existingProject) {
        updateProject(existingProject.id, conversion.project);
      } else {
        addProject(conversion.project);
      }

      setActiveProject(conversion.project);
      setActiveModule("estimate");

      toast({
        title: "Opportunity converted",
        description: "The bid intake is now linked to a live estimating project.",
      });
    } catch (error) {
      toast({
        title: "Project conversion failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  }

  function openLinkedProject() {
    if (!selectedOpportunity?.linkedProject) return;

    const matchedProject = projects.find(
      (project) => project.id === selectedOpportunity.linkedProject?.id
    );

    if (!matchedProject) {
      toast({
        title: "Project not loaded yet",
        description: "Refresh the dashboard or open Estimate so the linked project is available locally.",
        variant: "destructive",
      });
      return;
    }

    setActiveProject(matchedProject);
    setActiveModule("estimate");
  }

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-white">
            <BriefcaseBusiness className="h-5 w-5 text-orange-400" />
            Bid Board
          </CardTitle>
          <CardDescription className="text-slate-400">
            Intake opportunities first, then convert the right ones into live estimating projects.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => void syncBoard()}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Refresh board
          </Button>
          <Button onClick={handleNewOpportunity} className="bg-orange-500 text-white hover:bg-orange-600">
            <Plus className="mr-2 h-4 w-4" />
            New bid
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-5">
          {grouped.map((column) => (
            <div key={column.id} className="space-y-3">
              <div className={cn("rounded-2xl border px-4 py-3", column.tone)}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{column.label}</p>
                    <p className="text-xs opacity-80">{column.description}</p>
                  </div>
                  <Badge variant="outline" className="border-current/20 bg-transparent text-current">
                    {column.items.length}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {column.items.length > 0 ? (
                  column.items.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      selected={selectedOpportunityId === opportunity.id}
                      onClick={() => handleSelect(opportunity)}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-500">
                    No bids in this lane.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
          <Card className="border-slate-800 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-sky-400" />
                Opportunity Snapshot
              </CardTitle>
              <CardDescription className="text-slate-400">
                Review the invite before converting it into a live estimating project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                  Loading current bid board snapshot...
                </div>
              ) : selectedOpportunity ? (
                <>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{selectedOpportunity.name}</p>
                        <p className="text-sm text-slate-400">
                          {selectedOpportunity.client || "No client yet"}
                        </p>
                      </div>
                      <Badge className={cn("border", STATUS_COLUMNS.find((item) => item.id === selectedOpportunity.status)?.tone)}>
                        {selectedOpportunity.status}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Due date</p>
                        <p className="mt-1 text-sm text-slate-200">{formatDate(selectedOpportunity.dueDate)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Scope package</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedOpportunity.scopePackage || "Needs trade scope"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedOpportunity.location || selectedOpportunity.address || "No location yet"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Bid form</p>
                        <p className="mt-1 text-sm text-slate-200">
                          {selectedOpportunity.bidFormRequired ? "Required by client" : "Proposal only"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <MapPin className="h-4 w-4 text-orange-400" />
                      <span>{selectedOpportunity.address || "Address pending intake"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Link2 className="h-4 w-4 text-orange-400" />
                      <span>{selectedOpportunity.source || "manual-intake"}</span>
                    </div>
                    <p className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
                      {selectedOpportunity.description || "No description captured yet. Use the form to store client scope, notes and trade instructions."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Trade instructions</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {selectedOpportunity.tradeInstructions || "No trade-specific notes yet."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Linked project</p>
                      {selectedOpportunity.linkedProject ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm font-medium text-white">
                            {selectedOpportunity.linkedProject.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectedOpportunity.linkedProject.documentsCount || 0} docs •{" "}
                            {selectedOpportunity.linkedProject.estimatesCount || 0} estimates
                          </p>
                          <Button
                            variant="outline"
                            className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                            onClick={openLinkedProject}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Open estimate workspace
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400">
                          Not linked yet. Save intake, then convert when ready to estimate.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-500">
                  Select a bid on the board or create a new one to start capturing the opportunity.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                Opportunity Detail
              </CardTitle>
              <CardDescription className="text-slate-400">
                Structured intake for dates, scope, map context and bid form requirements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-name">Opportunity name</Label>
                  <Input
                    id="opportunity-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Saucy_Frisco"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        status: value as BidOpportunityStatus,
                      }))
                    }
                  >
                    <SelectTrigger id="opportunity-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_COLUMNS.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-source">Source</Label>
                  <Input
                    id="opportunity-source"
                    value={form.source}
                    onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
                    placeholder="buildingconnected"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-client">Client</Label>
                  <Input
                    id="opportunity-client"
                    value={form.client}
                    onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}
                    placeholder="20 Twenty Construction"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-client-email">Client email</Label>
                  <Input
                    id="opportunity-client-email"
                    type="email"
                    value={form.clientEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, clientEmail: event.target.value }))
                    }
                    placeholder="estimating@client.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-client-phone">Client phone</Label>
                  <Input
                    id="opportunity-client-phone"
                    value={form.clientPhone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, clientPhone: event.target.value }))
                    }
                    placeholder="(555) 555-5555"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-estimator">Estimator contact</Label>
                  <Input
                    id="opportunity-estimator"
                    value={form.estimatorContact}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, estimatorContact: event.target.value }))
                    }
                    placeholder="Estimating Team"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-due-date">Due date</Label>
                  <Input
                    id="opportunity-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-job-walk">Job walk</Label>
                  <Input
                    id="opportunity-job-walk"
                    type="date"
                    value={form.jobWalkDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, jobWalkDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-rfi-due">RFI due</Label>
                  <Input
                    id="opportunity-rfi-due"
                    type="date"
                    value={form.rfiDueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, rfiDueDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-size">Project size</Label>
                  <Input
                    id="opportunity-size"
                    value={form.projectSize}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, projectSize: event.target.value }))
                    }
                    placeholder="2,780 sq. ft."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-location">Location</Label>
                  <Input
                    id="opportunity-location"
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder="Frisco, Texas"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-address">Address</Label>
                  <Input
                    id="opportunity-address"
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="705 University Dr, Frisco, TX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-latitude">Latitude</Label>
                  <Input
                    id="opportunity-latitude"
                    value={form.latitude}
                    onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                    placeholder="33.15"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opportunity-longitude">Longitude</Label>
                  <Input
                    id="opportunity-longitude"
                    value={form.longitude}
                    onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                    placeholder="-96.82"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-scope">Scope package</Label>
                  <Input
                    id="opportunity-scope"
                    value={form.scopePackage}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, scopePackage: event.target.value }))
                    }
                    placeholder="Toilet partitions & bathroom accessories"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-description">Description</Label>
                  <Textarea
                    id="opportunity-description"
                    rows={4}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="What the client needs completed, special requirements and project context."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-trade-notes">Trade instructions</Label>
                  <Textarea
                    id="opportunity-trade-notes"
                    rows={4}
                    value={form.tradeInstructions}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, tradeInstructions: event.target.value }))
                    }
                    placeholder="Trade-specific notes, addendas, exclusions or field assumptions."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                    <div>
                      <Label htmlFor="opportunity-bid-form" className="text-sm text-slate-200">
                        Bid form required
                      </Label>
                      <p className="text-xs text-slate-500">
                        Toggle on when the GC requires a specific bid form or submission sheet.
                      </p>
                    </div>
                    <Switch
                      id="opportunity-bid-form"
                      checked={form.bidFormRequired}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({ ...current, bidFormRequired: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-bid-form-instructions">Bid form instructions</Label>
                  <Textarea
                    id="opportunity-bid-form-instructions"
                    rows={3}
                    value={form.bidFormInstructions}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bidFormInstructions: event.target.value,
                      }))
                    }
                    placeholder="Client-specific bid form, pricing format, alternates or submission notes."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-external-url">Source URL</Label>
                  <Input
                    id="opportunity-external-url"
                    value={form.externalUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, externalUrl: event.target.value }))
                    }
                    placeholder="https://app.buildingconnected.com/..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="opportunity-notes">Internal notes</Label>
                  <Textarea
                    id="opportunity-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Qualification notes, win probability, internal reminders or markup strategy."
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save intake
                </Button>

                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={selectedOpportunity?.linkedProject ? openLinkedProject : handleConvertToProject}
                  disabled={isConverting || (!selectedOpportunity && !form.id)}
                >
                  {isConverting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : selectedOpportunity?.linkedProject ? (
                    <FolderOpen className="mr-2 h-4 w-4" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {selectedOpportunity?.linkedProject ? "Open estimate" : "Convert to project"}
                </Button>

                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={() => {
                    if (form.externalUrl) {
                      window.open(form.externalUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  disabled={!form.externalUrl}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open source
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-orange-400">
                    <MapPin className="h-4 w-4" />
                    <p className="text-sm font-medium">Map-ready intake</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Capture address and coordinates now so geocoding, climate and zone costs can plug in next.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-sky-400">
                    <FileSpreadsheet className="h-4 w-4" />
                    <p className="text-sm font-medium">Bid form aware</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Mark opportunities that require a client bid form so proposals and pricing can follow their format.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-sm font-medium">Estimate handoff</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Convert accepted bids into estimating projects so document intake, AI review and takeoff can continue.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export default BidBoardPanel;
