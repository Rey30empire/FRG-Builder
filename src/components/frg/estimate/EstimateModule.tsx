"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Save,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAppStore, useProjectsStore } from "@/store";
import type { Document, DocumentAnalysis, Estimate, Project, ProposalData, TakeoffItem } from "@/types";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type EstimateTab = "documents" | "takeoff" | "estimate" | "proposal";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ProjectWithMeta extends Project {
  progress: number;
  documentsCount: number;
  analyzedCount: number;
  latestEstimate: Estimate | null;
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeLines(value?: string[] | null) {
  return (value || []).join("\n");
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDefaultProposalMessage(project: Project, estimate: Estimate, recipientName?: string | null) {
  return [
    `Hi ${recipientName || project.client || "there"},`,
    "",
    `Attached is the proposal package for ${project.name}. The current estimate total is ${formatCurrency(estimate.total)} and the schedule basis is ${estimate.duration || 0} calendar days.`,
    "",
    "Please review the scope summary, pricing highlights, and exclusions. If you want, we can walk through the proposal together and confirm next steps.",
    "",
    "Best,",
    "FRG Builder",
  ].join("\n");
}

function normalizeAnalysis(document: Document) {
  return (document.analysisResult || null) as DocumentAnalysis | null;
}

function getLatestEstimate(project: Project) {
  return [...(project.estimates || [])].sort((a, b) => b.version - a.version)[0] || null;
}

function getProjectProgress(project: Project) {
  const documentsCount = project.documents?.length || 0;
  const analyzedCount = (project.documents || []).filter((document) => document.analyzed).length;
  const latestEstimate = getLatestEstimate(project);
  const documentProgress = documentsCount > 0 ? (analyzedCount / documentsCount) * 60 : 0;
  const takeoffProgress = latestEstimate?.takeoffItems?.length ? 20 : 0;
  const estimateProgress = latestEstimate ? 20 : 0;

  return {
    progress: Math.round(documentProgress + takeoffProgress + estimateProgress),
    documentsCount,
    analyzedCount,
    latestEstimate,
  };
}

function getEstimateStatusTone(status?: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "rejected":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    case "sent":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "viewed":
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "review":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "final":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

function getDocumentStatus(document: Document) {
  if (document.analyzed) {
    return {
      label: "Analyzed",
      tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    };
  }

  if (document.analysisResult) {
    return {
      label: "Needs Review",
      tone: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      icon: AlertCircle,
    };
  }

  return {
    label: "Pending",
    tone: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    icon: Clock,
  };
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({
    success: false,
    error: `Request failed with status ${response.status}`,
  }))) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload.data as T;
}

function ProjectListItem({
  project,
  isActive,
  onSelect,
}: {
  project: ProjectWithMeta;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        isActive
          ? "border-orange-500/40 bg-orange-500/10"
          : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{project.name}</p>
          <p className="truncate text-xs text-slate-500">{project.client || "No client"}</p>
        </div>
        <Badge variant="outline" className="border-slate-700 text-slate-300">
          {project.status}
        </Badge>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Readiness</span>
          <span>{project.progress}%</span>
        </div>
        <Progress value={project.progress} className="h-2 bg-slate-900" />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {project.analyzedCount}/{project.documentsCount} docs analyzed
        </span>
        <span>{project.latestEstimate ? `v${project.latestEstimate.version}` : "No estimate"}</span>
      </div>
    </button>
  );
}

function DropZone({
  disabled,
  onDrop,
}: {
  disabled?: boolean;
  onDrop: (files: FileList) => void;
}) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        if (!disabled && event.dataTransfer.files?.length) {
          onDrop(event.dataTransfer.files);
        }
      }}
      className={cn(
        "cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition",
        disabled && "cursor-not-allowed opacity-60",
        isDragOver
          ? "border-orange-500 bg-orange-500/10"
          : "border-slate-700 bg-slate-950/70 hover:border-slate-600 hover:bg-slate-900"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) {
            onDrop(event.target.files);
            event.target.value = "";
          }
        }}
      />
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="rounded-full bg-orange-500/10 p-4 text-orange-400">
          <Upload className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Drop plans, specs or photos here</p>
          <p className="mt-1 text-xs text-slate-500">
            The backend now stores the file, analyzes PDFs and prepares takeoff hints.
          </p>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({
  document,
  onAnalyze,
}: {
  document: Document;
  onAnalyze: () => void;
}) {
  const status = getDocumentStatus(document);
  const StatusIcon = status.icon;
  const analysis = normalizeAnalysis(document);

  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-400" />
              <p className="truncate text-sm font-medium text-white">{document.name}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatFileSize(document.size)}{document.pageNumber ? ` • ${document.pageNumber} pages` : ""}
            </p>
          </div>
          <Badge variant="outline" className={cn("gap-1 border", status.tone)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {document.trade && (
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {document.trade}
            </Badge>
          )}
          {document.category && (
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {document.category}
            </Badge>
          )}
          {analysis?.source && (
            <Badge variant="outline" className="border-slate-700 text-slate-300">
              {analysis.source === "pdf-text" ? "PDF text" : "Metadata"}
            </Badge>
          )}
        </div>

        {analysis?.summary ? (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-300">{analysis.summary}</p>
            {analysis.keywords?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.keywords.slice(0, 4).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-800 p-3 text-xs text-slate-500">
            This file is waiting for analysis so the estimate engine can derive trade, category and takeoff hints.
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            variant={document.analyzed ? "outline" : "default"}
            onClick={onAnalyze}
            className={cn(
              document.analyzed
                ? "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                : "bg-orange-500 text-white hover:bg-orange-600"
            )}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {document.analyzed ? "Re-run analysis" : "Analyze"}
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <a href={document.path} target="_blank" rel="noreferrer">
              <Eye className="mr-1.5 h-4 w-4" />
              Open file
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TakeoffTable({ items }: { items: TakeoffItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="border-dashed border-slate-800 bg-slate-950/50">
        <CardContent className="p-8 text-center">
          <Layers className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-300">No takeoff items yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Analyze documents and generate an estimate to populate the takeoff table.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardHeader>
        <CardTitle className="text-white">Takeoff Items</CardTitle>
        <CardDescription className="text-slate-400">
          Quantities and scope hints now come from analyzed documents and the rate engine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Trade</TableHead>
              <TableHead className="text-slate-400">Description</TableHead>
              <TableHead className="text-slate-400">Quantity</TableHead>
              <TableHead className="text-slate-400">Material</TableHead>
              <TableHead className="text-slate-400">Labor</TableHead>
              <TableHead className="text-slate-400">Total</TableHead>
              <TableHead className="text-slate-400">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="border-slate-800">
                <TableCell className="text-slate-200">{item.trade}</TableCell>
                <TableCell className="max-w-[320px] whitespace-normal text-slate-300">
                  {item.description}
                </TableCell>
                <TableCell className="text-slate-300">
                  {item.quantity.toLocaleString()} {item.unit}
                </TableCell>
                <TableCell className="text-slate-300">{formatCurrency(item.materialCost)}</TableCell>
                <TableCell className="text-slate-300">{formatCurrency(item.laborCost)}</TableCell>
                <TableCell className="font-medium text-orange-300">
                  {formatCurrency(item.totalCost)}
                </TableCell>
                <TableCell className="whitespace-normal text-xs text-slate-500">
                  {item.sourceDocument || "Generated"}
                  {item.sourcePage ? ` • ${item.sourcePage}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EstimateSummary({
  estimate,
  project,
}: {
  estimate: Estimate;
  project: ProjectWithMeta;
}) {
  const topItems = [...(estimate.takeoffItems || [])]
    .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Materials",
            value: formatCurrency(estimate.materialsCost),
            icon: FolderOpen,
            tone: "bg-sky-500/10 text-sky-400",
          },
          {
            label: "Labor",
            value: formatCurrency(estimate.laborCost),
            icon: User,
            tone: "bg-emerald-500/10 text-emerald-400",
          },
          {
            label: "Equipment",
            value: formatCurrency(estimate.equipmentCost),
            icon: TrendingUp,
            tone: "bg-amber-500/10 text-amber-400",
          },
          {
            label: "Total",
            value: formatCurrency(estimate.total),
            icon: DollarSign,
            tone: "bg-orange-500/10 text-orange-400",
          },
        ].map((item) => (
          <Card key={item.label} className="border-slate-800 bg-slate-950/70">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={cn("rounded-xl p-2.5", item.tone)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
              </div>
              <p className="mt-4 text-2xl font-semibold text-white">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Estimate Breakdown</CardTitle>
            <CardDescription className="text-slate-400">
              Version {estimate.version} created from {project.analyzedCount} analyzed documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Direct Cost Subtotal", formatCurrency(estimate.subtotal)],
              ["Overhead", formatCurrency(estimate.overhead)],
              ["Profit", formatCurrency(estimate.profit)],
              ["Weather Factor", estimate.weatherFactor?.toFixed(2) || "1.00"],
              ["Risk Factor", estimate.riskFactor?.toFixed(2) || "1.00"],
              ["Estimated Duration", `${estimate.duration || 0} days`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-slate-900/70 px-4 py-3">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Top Cost Drivers</CardTitle>
            <CardDescription className="text-slate-400">
              Highest-value takeoff lines in this estimate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.description}</p>
                    <p className="truncate text-xs text-slate-500">
                      {item.trade} • {item.quantity.toLocaleString()} {item.unit}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-orange-300">
                    {formatCurrency(item.totalCost)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProposalDraft({
  project,
  estimate,
  proposalData,
}: {
  project: ProjectWithMeta;
  estimate: Estimate | null;
  proposalData: ProposalData | null;
}) {
  if (!estimate || !proposalData) {
    return (
      <Card className="border-dashed border-slate-800 bg-slate-950/50">
        <CardContent className="p-8 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-300">Proposal basis not ready</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate an estimate first so the proposal preview, PDF and send flow can be prepared.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Proposal Basis</CardTitle>
            <CardDescription className="text-slate-400">
              Client, estimate and delivery details that feed the proposal package.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Project", project.name],
              ["Client", proposalData.recipientName || project.client || "Pending"],
              ["Email", proposalData.recipientEmail || project.clientEmail || "Pending"],
              ["Address", project.address || "Pending"],
              ["Price", formatCurrency(estimate.total)],
              ["Duration", `${estimate.duration || 0} days`],
              ["Template", proposalData.template],
              ["Estimate Status", estimate.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-900/70 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-white">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Pricing Highlights</CardTitle>
            <CardDescription className="text-slate-400">
              Top line items that will appear in the client-facing summary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposalData.highlights.length ? (
              proposalData.highlights.map((item) => (
                <div
                  key={`${item.trade}-${item.description}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.description}</p>
                      <p className="truncate text-xs text-slate-500">{item.trade}</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-300">
                      {formatCurrency(item.totalCost)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No highlight lines were generated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Draft Narrative</CardTitle>
            <CardDescription className="text-slate-400">
              Live proposal copy built from the estimate, scope and saved proposal data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Intro</p>
              <p className="mt-2 text-sm text-slate-200">{proposalData.intro}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Scope Summary</p>
              <p className="mt-2 text-sm text-slate-200">{proposalData.scopeSummary}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Schedule</p>
              <p className="mt-2 text-sm text-slate-200">{proposalData.schedule}</p>
            </div>
            {proposalData.coverNote ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Cover Note</p>
                <p className="mt-2 text-sm text-slate-200">{proposalData.coverNote}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-slate-800 bg-slate-950/70">
            <CardHeader>
              <CardTitle className="text-white">Inclusions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {proposalData.inclusions.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950/70">
            <CardHeader>
              <CardTitle className="text-white">Exclusions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {proposalData.exclusions.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-white">Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            {proposalData.terms.map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function EstimateModule({ className }: { className?: string }) {
  const { activeUser, activeProject, setActiveModule, setActiveProject } = useAppStore();
  const { projects, setProjects } = useProjectsStore();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<EstimateTab>("documents");
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isLoadingProposal, setIsLoadingProposal] = React.useState(false);
  const [isSavingProposal, setIsSavingProposal] = React.useState(false);
  const [isSendingProposal, setIsSendingProposal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [proposalData, setProposalData] = React.useState<ProposalData | null>(null);
  const [proposalRecipientName, setProposalRecipientName] = React.useState("");
  const [proposalRecipientEmail, setProposalRecipientEmail] = React.useState("");
  const [proposalIntro, setProposalIntro] = React.useState("");
  const [proposalScopeSummary, setProposalScopeSummary] = React.useState("");
  const [proposalSchedule, setProposalSchedule] = React.useState("");
  const [proposalCoverNote, setProposalCoverNote] = React.useState("");
  const [proposalInclusions, setProposalInclusions] = React.useState("");
  const [proposalExclusions, setProposalExclusions] = React.useState("");
  const [proposalTerms, setProposalTerms] = React.useState("");
  const [proposalMessage, setProposalMessage] = React.useState("");

  const syncProjects = React.useEffectEvent(async (preferredProjectId?: string | null) => {
    const userId = activeUser?.id || "default-user";
    const data = await readApi<Project[]>(`/api/projects?userId=${encodeURIComponent(userId)}`);

    React.startTransition(() => {
      setProjects(data);

      const nextProjectId =
        preferredProjectId || selectedProjectId || activeProject?.id || data[0]?.id || null;
      const nextProject = data.find((project) => project.id === nextProjectId) || null;

      setSelectedProjectId(nextProject?.id || null);
      setActiveProject(nextProject);
    });
  });

  const syncProposal = React.useEffectEvent(async (estimateId: string, project: ProjectWithMeta, estimate: Estimate) => {
    const data = await readApi<{ estimate: Estimate; proposalData: ProposalData }>(
      `/api/proposals?estimateId=${encodeURIComponent(estimateId)}`
    );

    React.startTransition(() => {
      setProposalData(data.proposalData);
      setProposalRecipientName(data.proposalData.recipientName || project.client || "");
      setProposalRecipientEmail(data.proposalData.recipientEmail || project.clientEmail || "");
      setProposalIntro(data.proposalData.intro || "");
      setProposalScopeSummary(data.proposalData.scopeSummary || "");
      setProposalSchedule(data.proposalData.schedule || "");
      setProposalCoverNote(data.proposalData.coverNote || "");
      setProposalInclusions(normalizeLines(data.proposalData.inclusions));
      setProposalExclusions(normalizeLines(data.proposalData.exclusions));
      setProposalTerms(normalizeLines(data.proposalData.terms));
      setProposalMessage(buildDefaultProposalMessage(project, data.estimate, data.proposalData.recipientName || project.client));
    });
  });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        await syncProjects(activeProject?.id);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load projects");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeUser?.id, activeProject?.id, syncProjects]);

  React.useEffect(() => {
    if (activeProject?.id) {
      setSelectedProjectId(activeProject.id);
    }
  }, [activeProject?.id]);

  const projectsWithMeta = React.useMemo<ProjectWithMeta[]>(
    () =>
      projects.map((project) => ({
        ...project,
        ...getProjectProgress(project),
      })),
    [projects]
  );

  const filteredProjects = React.useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return projectsWithMeta;

    return projectsWithMeta.filter((project) =>
      [project.name, project.client, project.address]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [deferredSearchQuery, projectsWithMeta]);

  const selectedProject = React.useMemo(
    () => projectsWithMeta.find((project) => project.id === selectedProjectId) || null,
    [projectsWithMeta, selectedProjectId]
  );

  const selectedDocuments = React.useMemo(
    () =>
      [...(selectedProject?.documents || [])].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [selectedProject]
  );

  const currentEstimate = selectedProject?.latestEstimate || null;
  const analyzedDocuments = selectedDocuments.filter((document) => document.analyzed);
  const pendingDocuments = selectedDocuments.filter((document) => !document.analyzed);
  const takeoffItems = currentEstimate?.takeoffItems || [];
  const documentsProgress =
    selectedDocuments.length > 0 ? (analyzedDocuments.length / selectedDocuments.length) * 100 : 0;
  const estimateProgress = currentEstimate ? 100 : analyzedDocuments.length ? 65 : 0;
  const overallProgress = Math.round((documentsProgress * 0.6 + estimateProgress * 0.4) || 0);
  const proposalPdfUrl = currentEstimate
    ? `/api/proposals/pdf?estimateId=${encodeURIComponent(currentEstimate.id)}`
    : null;
  const proposalReady = Boolean(
    currentEstimate &&
      proposalData &&
      proposalIntro.trim() &&
      proposalScopeSummary.trim() &&
      proposalRecipientEmail.trim()
  );

  React.useEffect(() => {
    if (!selectedProject || !currentEstimate) {
      setProposalData(null);
      setProposalRecipientName("");
      setProposalRecipientEmail("");
      setProposalIntro("");
      setProposalScopeSummary("");
      setProposalSchedule("");
      setProposalCoverNote("");
      setProposalInclusions("");
      setProposalExclusions("");
      setProposalTerms("");
      setProposalMessage("");
      return;
    }

    const estimate = currentEstimate;
    const project = selectedProject;
    let cancelled = false;

    async function loadProposal() {
      setIsLoadingProposal(true);
      try {
        await syncProposal(estimate.id, project, estimate);
      } catch (proposalError) {
        if (!cancelled) {
          toast({
            title: "Proposal preview failed",
            description:
              proposalError instanceof Error ? proposalError.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProposal(false);
        }
      }
    }

    void loadProposal();

    return () => {
      cancelled = true;
    };
  }, [currentEstimate?.id, selectedProject?.id, syncProposal]);

  async function handleCreateProject() {
    try {
      const userId = activeUser?.id || "default-user";
      const createdProject = await readApi<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: `New Project ${projects.length + 1}`,
          client: "New Client",
        }),
      });

      await syncProjects(createdProject.id);
      setActiveTab("documents");
      toast({
        title: "Project created",
        description: `${createdProject.name} is ready for document intake.`,
      });
    } catch (createError) {
      toast({
        title: "Could not create project",
        description: createError instanceof Error ? createError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleUploadFiles(files: FileList) {
    if (!selectedProjectId) {
      toast({
        title: "Select a project first",
        description: "Choose or create a project before uploading files.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      await Promise.all(
        Array.from(files).map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("projectId", selectedProjectId);
          await readApi<Document>("/api/documents", { method: "POST", body: formData });
        })
      );

      await syncProjects(selectedProjectId);
      toast({
        title: "Files uploaded",
        description: `${files.length} file${files.length === 1 ? "" : "s"} added to the project.`,
      });
    } catch (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError instanceof Error ? uploadError.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAnalyzeDocuments(documentIds?: string[]) {
    if (!selectedProjectId) return;

    try {
      setIsAnalyzing(true);
      await readApi<Document[]>("/api/documents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, documentIds }),
      });

      await syncProjects(selectedProjectId);
      toast({
        title: "Analysis completed",
        description: documentIds?.length
          ? "Selected document re-analyzed."
          : "Project documents were analyzed and classified.",
      });
    } catch (analysisError) {
      toast({
        title: "Analysis failed",
        description: analysisError instanceof Error ? analysisError.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGenerateEstimate() {
    if (!selectedProjectId) return;

    try {
      setIsGenerating(true);
      await readApi<Estimate>("/api/estimates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          userId: activeUser?.id || "default-user",
        }),
      });

      await syncProjects(selectedProjectId);
      setActiveTab("estimate");
      toast({
        title: "Estimate generated",
        description: "Takeoff and pricing now come from analyzed documents and saved rates.",
      });
    } catch (generationError) {
      toast({
        title: "Estimate generation failed",
        description: generationError instanceof Error ? generationError.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveProposal(options?: { silent?: boolean }) {
    if (!currentEstimate || !proposalData) return false;

    const nextProposalData: ProposalData = {
      ...proposalData,
      recipientName: proposalRecipientName || undefined,
      recipientEmail: proposalRecipientEmail || undefined,
      intro: proposalIntro,
      scopeSummary: proposalScopeSummary,
      schedule: proposalSchedule,
      coverNote: proposalCoverNote || undefined,
      inclusions: parseLines(proposalInclusions),
      exclusions: parseLines(proposalExclusions),
      terms: parseLines(proposalTerms),
    };

    try {
      setIsSavingProposal(true);
      const updatedEstimate = await readApi<Estimate>("/api/proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: currentEstimate.id,
          proposalData: nextProposalData,
          status: currentEstimate.status === "draft" ? "review" : currentEstimate.status,
        }),
      });

      setProposalData(nextProposalData);
      await syncProjects(selectedProjectId);
      if (!options?.silent) {
        toast({
          title: "Proposal saved",
          description: `Estimate v${updatedEstimate.version} is ready for PDF export or sending.`,
        });
      }
      return true;
    } catch (saveError) {
      if (!options?.silent) {
        toast({
          title: "Could not save proposal",
          description: saveError instanceof Error ? saveError.message : "Unknown error",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setIsSavingProposal(false);
    }
  }

  async function handleSendProposal() {
    if (!currentEstimate || !selectedProject) return;

    try {
      setIsSendingProposal(true);

      if (proposalData) {
        const saved = await handleSaveProposal({ silent: true });
        if (!saved) {
          throw new Error("Save the proposal details before sending.");
        }
      }

      const payload = await readApi<{ attachmentUrl: string }>("/api/proposals/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: currentEstimate.id,
          userId: activeUser?.id || "default-user",
          recipientName: proposalRecipientName || selectedProject.client,
          recipientEmail: proposalRecipientEmail || selectedProject.clientEmail,
          message: proposalMessage || undefined,
        }),
      });

      await syncProjects(selectedProjectId);
      setActiveTab("proposal");
      toast({
        title: "Proposal sent",
        description: `Delivery recorded and PDF available at ${payload.attachmentUrl}.`,
      });
    } catch (sendError) {
      toast({
        title: "Proposal send failed",
        description: sendError instanceof Error ? sendError.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSendingProposal(false);
    }
  }

  return (
    <div className={cn("flex h-full flex-col bg-slate-950", className)}>
      <ModuleHeader
        title="FRG Estimate"
        description={`PDF intake, analysis and estimating pipeline${activeUser?.name ? ` • profile: ${activeUser.name}` : ""}`}
        quickActions={[
          { id: "new-project", label: "New Project", icon: Plus, onClick: handleCreateProject },
          {
            id: "analyze",
            label: "Analyze Docs",
            icon: Sparkles,
            onClick: () => void handleAnalyzeDocuments(),
            variant: "outline",
            disabled: !selectedProject || selectedDocuments.length === 0 || isAnalyzing,
            loading: isAnalyzing,
          },
          {
            id: "generate",
            label: "Generate Estimate",
            icon: Calculator,
            onClick: () => void handleGenerateEstimate(),
            variant: "outline",
            disabled: !selectedProject || selectedDocuments.length === 0 || isGenerating,
            loading: isGenerating,
          },
        ]}
        statusIndicators={[
          {
            id: "projects",
            label: "Projects",
            status: projectsWithMeta.length ? "success" : "idle",
            value: projectsWithMeta.length,
          },
          {
            id: "docs",
            label: "Docs",
            status: selectedDocuments.length ? (pendingDocuments.length ? "pending" : "success") : "idle",
            value: selectedProject ? `${analyzedDocuments.length}/${selectedDocuments.length}` : "0",
          },
          {
            id: "estimate",
            label: "Estimate",
            status: currentEstimate ? "success" : "warning",
            value: currentEstimate ? `v${currentEstimate.version}` : "Pending",
          },
        ]}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 border-r border-slate-800 bg-slate-950 xl:flex xl:flex-col">
          <div className="border-b border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Projects</p>
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                {filteredProjects.length}
              </Badge>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search projects..."
                className="border-slate-800 bg-slate-900 pl-9 text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-3 p-3">
              {filteredProjects.map((project) => (
                <ProjectListItem
                  key={project.id}
                  project={project}
                  isActive={project.id === selectedProjectId}
                  onSelect={() => {
                    setSelectedProjectId(project.id);
                    setActiveProject(project);
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            </div>
          ) : selectedProject ? (
            <>
              <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold text-white">{selectedProject.name}</h1>
                      <Badge variant="outline" className={cn("border", getEstimateStatusTone(currentEstimate?.status))}>
                        {currentEstimate?.status || "planning"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                      {selectedProject.client ? (
                        <span className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          {selectedProject.client}
                        </span>
                      ) : null}
                      {selectedProject.address ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {selectedProject.address}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        {selectedProject.documentsCount} docs
                      </span>
                    </div>
                  </div>

                  <div className="grid min-w-[260px] grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Documents Ready</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {selectedProject.analyzedCount}/{selectedProject.documentsCount}
                      </p>
                      <Progress value={documentsProgress} className="mt-3 h-2 bg-slate-900" />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Overall Progress</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{overallProgress}%</p>
                      <Progress value={overallProgress} className="mt-3 h-2 bg-slate-900" />
                    </div>
                  </div>
                </div>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as EstimateTab)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="border-b border-slate-800 px-6 py-4">
                  <TabsList className="border border-slate-800 bg-slate-900/50">
                    <TabsTrigger value="documents" className="data-[state=active]:bg-slate-800">
                      <FileText className="mr-1.5 h-4 w-4" />
                      Documents
                    </TabsTrigger>
                    <TabsTrigger value="takeoff" className="data-[state=active]:bg-slate-800">
                      <Layers className="mr-1.5 h-4 w-4" />
                      Takeoff
                    </TabsTrigger>
                    <TabsTrigger value="estimate" className="data-[state=active]:bg-slate-800">
                      <DollarSign className="mr-1.5 h-4 w-4" />
                      Estimate
                    </TabsTrigger>
                    <TabsTrigger value="proposal" className="data-[state=active]:bg-slate-800">
                      <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                      Proposal
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  <TabsContent value="documents" className="space-y-6 p-6">
                    {error ? (
                      <Card className="border-rose-500/30 bg-rose-500/5">
                        <CardContent className="p-4 text-sm text-rose-300">{error}</CardContent>
                      </Card>
                    ) : null}

                    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                      <DropZone disabled={isUploading} onDrop={(files) => void handleUploadFiles(files)} />

                      <Card className="border-slate-800 bg-slate-950/70">
                        <CardHeader>
                          <CardTitle className="text-white">Document Intake Status</CardTitle>
                          <CardDescription className="text-slate-400">
                            Phase 2 is now connected to persistent analysis results.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
                              <p className="mt-2 text-2xl font-semibold text-white">{pendingDocuments.length}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Analyzed</p>
                              <p className="mt-2 text-2xl font-semibold text-white">{analyzedDocuments.length}</p>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Latest refresh</p>
                            <p className="mt-2 text-sm text-white">{formatDate(selectedProject.updatedAt)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void handleAnalyzeDocuments()}
                              disabled={!selectedDocuments.length || isAnalyzing}
                              className="bg-orange-500 text-white hover:bg-orange-600"
                            >
                              {isAnalyzing ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="mr-1.5 h-4 w-4" />
                              )}
                              Analyze all docs
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setActiveTab("takeoff")}
                              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                              View takeoff
                              <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedDocuments.length ? (
                      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {selectedDocuments.map((document) => (
                          <DocumentCard
                            key={document.id}
                            document={document}
                            onAnalyze={() => void handleAnalyzeDocuments([document.id])}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card className="border-dashed border-slate-800 bg-slate-950/50">
                        <CardContent className="p-8 text-center">
                          <FolderOpen className="mx-auto h-10 w-10 text-slate-600" />
                          <p className="mt-3 text-sm font-medium text-slate-300">No documents uploaded yet</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Upload PDFs or plan sets to start the real analysis pipeline.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="takeoff" className="space-y-6 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Takeoff Output</h2>
                        <p className="text-sm text-slate-500">
                          {currentEstimate
                            ? `Estimate v${currentEstimate.version} contains ${takeoffItems.length} priced line items.`
                            : "Generate an estimate to transform analyzed documents into priced takeoff items."}
                        </p>
                      </div>
                      <Button
                        onClick={() => void handleGenerateEstimate()}
                        disabled={!selectedDocuments.length || isGenerating}
                        className="bg-orange-500 text-white hover:bg-orange-600"
                      >
                        {isGenerating ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Calculator className="mr-1.5 h-4 w-4" />
                        )}
                        Generate estimate
                      </Button>
                    </div>
                    <TakeoffTable items={takeoffItems} />
                  </TabsContent>

                  <TabsContent value="estimate" className="space-y-6 p-6">
                    {currentEstimate ? (
                      <EstimateSummary estimate={currentEstimate} project={selectedProject} />
                    ) : (
                      <Card className="border-dashed border-slate-800 bg-slate-950/50">
                        <CardContent className="p-8 text-center">
                          <Calculator className="mx-auto h-10 w-10 text-slate-600" />
                          <p className="mt-3 text-sm font-medium text-slate-300">No estimate generated yet</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Analyze the project documents and generate the first estimate version.
                          </p>
                          <Button
                            onClick={() => void handleGenerateEstimate()}
                            disabled={!selectedDocuments.length || isGenerating}
                            className="mt-4 bg-orange-500 text-white hover:bg-orange-600"
                          >
                            {isGenerating ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <Calculator className="mr-1.5 h-4 w-4" />
                            )}
                            Generate estimate
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="proposal" className="space-y-6 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Proposal Preparation</h2>
                        <p className="text-sm text-slate-500">
                          Save the proposal narrative, export the PDF, and send the client package from here.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => void handleSaveProposal()}
                          disabled={!proposalData || isSavingProposal}
                        >
                          {isSavingProposal ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-1.5 h-4 w-4" />
                          )}
                          Save proposal
                        </Button>
                        {proposalPdfUrl ? (
                          <Button
                            asChild
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          >
                            <a href={proposalPdfUrl} target="_blank" rel="noreferrer">
                              <Download className="mr-1.5 h-4 w-4" />
                              Open PDF
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          onClick={() => void handleSendProposal()}
                          disabled={!proposalReady || isSendingProposal}
                          className="bg-orange-500 text-white hover:bg-orange-600"
                        >
                          {isSendingProposal ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="mr-1.5 h-4 w-4" />
                          )}
                          Send proposal
                        </Button>
                        <Button
                          variant="outline"
                          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => setActiveModule("boost")}
                        >
                          Follow-up in CRM
                          <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isLoadingProposal ? (
                      <Card className="border-slate-800 bg-slate-950/70">
                        <CardContent className="flex items-center justify-center gap-3 p-8 text-slate-300">
                          <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                          Loading proposal preview...
                        </CardContent>
                      </Card>
                    ) : null}

                    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                      <Card className="border-slate-800 bg-slate-950/70">
                        <CardHeader>
                          <CardTitle className="text-white">Proposal Editor</CardTitle>
                          <CardDescription className="text-slate-400">
                            Adjust client details and editable sections before exporting or sending.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-slate-400">Recipient name</Label>
                              <Input
                                value={proposalRecipientName}
                                onChange={(event) => setProposalRecipientName(event.target.value)}
                                className="border-slate-800 bg-slate-900 text-slate-200"
                                placeholder="Client name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Recipient email</Label>
                              <Input
                                type="email"
                                value={proposalRecipientEmail}
                                onChange={(event) => setProposalRecipientEmail(event.target.value)}
                                className="border-slate-800 bg-slate-900 text-slate-200"
                                placeholder="client@email.com"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-400">Intro</Label>
                            <Textarea
                              value={proposalIntro}
                              onChange={(event) => setProposalIntro(event.target.value)}
                              className="min-h-[110px] border-slate-800 bg-slate-900 text-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-400">Scope summary</Label>
                            <Textarea
                              value={proposalScopeSummary}
                              onChange={(event) => setProposalScopeSummary(event.target.value)}
                              className="min-h-[110px] border-slate-800 bg-slate-900 text-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-400">Schedule</Label>
                            <Textarea
                              value={proposalSchedule}
                              onChange={(event) => setProposalSchedule(event.target.value)}
                              className="min-h-[90px] border-slate-800 bg-slate-900 text-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-400">Cover note</Label>
                            <Textarea
                              value={proposalCoverNote}
                              onChange={(event) => setProposalCoverNote(event.target.value)}
                              className="min-h-[90px] border-slate-800 bg-slate-900 text-slate-200"
                              placeholder="Optional project note"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label className="text-slate-400">Inclusions</Label>
                              <Textarea
                                value={proposalInclusions}
                                onChange={(event) => setProposalInclusions(event.target.value)}
                                className="min-h-[150px] border-slate-800 bg-slate-900 text-slate-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Exclusions</Label>
                              <Textarea
                                value={proposalExclusions}
                                onChange={(event) => setProposalExclusions(event.target.value)}
                                className="min-h-[150px] border-slate-800 bg-slate-900 text-slate-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-400">Terms</Label>
                              <Textarea
                                value={proposalTerms}
                                onChange={(event) => setProposalTerms(event.target.value)}
                                className="min-h-[150px] border-slate-800 bg-slate-900 text-slate-200"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-400">Email message</Label>
                            <Textarea
                              value={proposalMessage}
                              onChange={(event) => setProposalMessage(event.target.value)}
                              className="min-h-[180px] border-slate-800 bg-slate-900 text-slate-200"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-6">
                        <Card className="border-slate-800 bg-slate-950/70">
                          <CardHeader>
                            <CardTitle className="text-white">Delivery Readiness</CardTitle>
                            <CardDescription className="text-slate-400">
                              Proposal send needs a client email plus saved proposal copy.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-3 md:grid-cols-3">
                            {[
                              ["Recipient", proposalRecipientName || "Pending"],
                              ["Email", proposalRecipientEmail || "Pending"],
                              ["PDF", proposalPdfUrl ? "Ready" : "Pending"],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                                <p className="mt-2 text-sm text-white">{value}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        <ProposalDraft
                          project={selectedProject}
                          estimate={currentEstimate}
                          proposalData={
                            proposalData
                              ? {
                                  ...proposalData,
                                  recipientName: proposalRecipientName || undefined,
                                  recipientEmail: proposalRecipientEmail || undefined,
                                  intro: proposalIntro,
                                  scopeSummary: proposalScopeSummary,
                                  schedule: proposalSchedule,
                                  coverNote: proposalCoverNote || undefined,
                                  inclusions: parseLines(proposalInclusions),
                                  exclusions: parseLines(proposalExclusions),
                                  terms: parseLines(proposalTerms),
                                }
                              : null
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-slate-600" />
                <p className="mt-4 text-lg font-medium text-slate-300">Select a project</p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a project from the left panel or create a new one to start Phase 2 and 3.
                </p>
                <Button onClick={handleCreateProject} className="mt-4 bg-orange-500 text-white hover:bg-orange-600">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create project
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EstimateModule;
