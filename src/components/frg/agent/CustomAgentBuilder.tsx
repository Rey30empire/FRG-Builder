"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CUSTOM_AGENT_EXECUTION_MODES,
  CUSTOM_AGENT_PIPELINE_STAGES,
  CUSTOM_AGENT_PIPELINE_STAGE_LABELS,
  CUSTOM_AGENT_SKILL_OPTIONS,
  CUSTOM_AGENT_TOOL_OPTIONS,
  DEFAULT_CUSTOM_AGENT_DRAFT,
} from "@/lib/custom-agents";
import type {
  CustomAgent,
  CustomAgentExecutionMode,
  CustomAgentPipelineStage,
  PermissionLevel,
  ToolName,
} from "@/types";
import { Bot, Loader2, Plus, RefreshCcw, Save, Trash2, Wrench } from "lucide-react";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type CustomAgentDraft = Omit<CustomAgent, "id" | "userId" | "createdAt" | "updatedAt">;

const EXECUTION_MODE_LABELS: Record<CustomAgentExecutionMode, string> = {
  chat: "Chat only",
  pipeline: "Pipeline only",
  both: "Chat + Pipeline",
};

const SKILL_LABELS: Record<string, string> = {
  estimate_skill: "Estimate",
  takeoff_skill: "Takeoff",
  plan_reader_skill: "Plan Reader",
  construction_teacher_skill: "Teacher",
  code_reference_skill: "Code Reference",
  marketing_skill: "Marketing",
  proposal_writer_skill: "Proposal Writer",
  email_outreach_skill: "Email Outreach",
  crm_skill: "CRM",
  project_manager_skill: "Project Manager",
  document_skill: "Document",
  image_analysis_skill: "Image Analysis",
  local_model_skill: "Local Model",
};

function createBlankDraft(): CustomAgentDraft {
  return {
    ...DEFAULT_CUSTOM_AGENT_DRAFT,
    allowedTools: [...DEFAULT_CUSTOM_AGENT_DRAFT.allowedTools],
    triggerPhrases: [...DEFAULT_CUSTOM_AGENT_DRAFT.triggerPhrases],
  };
}

export function CustomAgentBuilder({ onChanged }: { onChanged?: () => void }) {
  const [agents, setAgents] = React.useState<CustomAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<CustomAgentDraft>(createBlankDraft);
  const [triggerInput, setTriggerInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const syncAgents = React.useEffectEvent(async (preferredId?: string | null) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/custom-agents");
      const payload = (await response.json()) as ApiEnvelope<CustomAgent[]>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to load custom agents");
      }

      const nextAgents = payload.data.map((agent) => ({
        ...agent,
        createdAt: new Date(agent.createdAt),
        updatedAt: new Date(agent.updatedAt),
      }));

      setAgents(nextAgents);
      const nextSelection =
        preferredId && nextAgents.some((agent) => agent.id === preferredId)
          ? preferredId
          : nextAgents[0]?.id || null;

      setSelectedAgentId(nextSelection);
      const selected = nextAgents.find((agent) => agent.id === nextSelection);
      if (selected) {
        setDraft({
          name: selected.name,
          slug: selected.slug,
          description: selected.description || "",
          instructions: selected.instructions,
          baseSkill: selected.baseSkill,
          enabled: selected.enabled,
          autoRun: selected.autoRun,
          includeProjectContext: selected.includeProjectContext,
          includeDocumentSummary: selected.includeDocumentSummary,
          includeEstimateSnapshot: selected.includeEstimateSnapshot,
          executionMode: selected.executionMode,
          pipelineStage: selected.pipelineStage || "preflight",
          requiredLevel: selected.requiredLevel,
          reviewRequired: selected.reviewRequired,
          allowedTools: selected.allowedTools,
          triggerPhrases: selected.triggerPhrases,
          successCriteria: selected.successCriteria || "",
          outputSchema: selected.outputSchema || "",
          sortOrder: selected.sortOrder,
        });
        setTriggerInput(selected.triggerPhrases.join(", "));
      } else {
        setDraft(createBlankDraft());
        setTriggerInput("");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Custom agents",
        description:
          error instanceof Error ? error.message : "Unable to load custom agents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  });

  React.useEffect(() => {
    void syncAgents();
  }, [syncAgents]);

  function handleSelectAgent(agent: CustomAgent) {
    setSelectedAgentId(agent.id);
    setDraft({
      name: agent.name,
      slug: agent.slug,
      description: agent.description || "",
      instructions: agent.instructions,
      baseSkill: agent.baseSkill,
      enabled: agent.enabled,
      autoRun: agent.autoRun,
      includeProjectContext: agent.includeProjectContext,
      includeDocumentSummary: agent.includeDocumentSummary,
      includeEstimateSnapshot: agent.includeEstimateSnapshot,
      executionMode: agent.executionMode,
      pipelineStage: agent.pipelineStage || "preflight",
      requiredLevel: agent.requiredLevel,
      reviewRequired: agent.reviewRequired,
      allowedTools: [...agent.allowedTools],
      triggerPhrases: [...agent.triggerPhrases],
      successCriteria: agent.successCriteria || "",
      outputSchema: agent.outputSchema || "",
      sortOrder: agent.sortOrder,
    });
    setTriggerInput(agent.triggerPhrases.join(", "));
  }

  function handleNewAgent() {
    setSelectedAgentId(null);
    setDraft(createBlankDraft());
    setTriggerInput("");
  }

  function toggleTool(tool: ToolName, enabled: boolean) {
    const nextTools = enabled
      ? Array.from(new Set([...draft.allowedTools, tool]))
      : draft.allowedTools.filter((current) => current !== tool);

    setDraft((current) => ({
      ...current,
      allowedTools: nextTools.length ? nextTools : ["summarize_documents"],
    }));
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      const method = selectedAgentId ? "PUT" : "POST";
      const response = await fetch("/api/custom-agents", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(selectedAgentId ? { id: selectedAgentId } : {}),
          ...draft,
          triggerPhrases: triggerInput,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<CustomAgent>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to save custom agent");
      }

      toast({
        title: "Custom agents",
        description: `${payload.data.name} is ready to use from chat and pipeline rules.`,
      });
      await syncAgents(payload.data.id);
      onChanged?.();
    } catch (error) {
      console.error(error);
      toast({
        title: "Custom agents",
        description:
          error instanceof Error ? error.message : "Unable to save custom agent",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedAgentId) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/custom-agents?id=${selectedAgentId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
      if (!payload.success) {
        throw new Error(payload.error || "Unable to delete custom agent");
      }

      toast({
        title: "Custom agents",
        description: "The custom agent was removed.",
      });
      await syncAgents();
      onChanged?.();
    } catch (error) {
      console.error(error);
      toast({
        title: "Custom agents",
        description:
          error instanceof Error ? error.message : "Unable to delete custom agent",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Bot className="h-4 w-4 text-amber-400" />
          Agent Builder Pro
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Create user-owned agents with prompts, triggers, tools, permissions and pipeline stages. Use them in chat with <span className="font-mono">@agent-slug</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleNewAgent}
            className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void syncAgents(selectedAgentId)}
            className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              Loading custom agents...
            </div>
          ) : agents.length ? (
            agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleSelectAgent(agent)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-all",
                  selectedAgentId === agent.id
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/80"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{agent.name}</p>
                    <p className="mt-1 text-xs text-slate-500">@{agent.slug}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        agent.enabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 bg-slate-900 text-slate-300"
                      )}
                    >
                      {agent.enabled ? "enabled" : "disabled"}
                    </Badge>
                    <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                      {EXECUTION_MODE_LABELS[agent.executionMode]}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                  {agent.description || agent.instructions}
                </p>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
              No custom agents yet. Create one for scope review, bid QA, pricing review or client-ready summaries.
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-400">Agent name</Label>
              <Input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="border-slate-800 bg-slate-900 text-slate-200"
                placeholder="Scope Auditor"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Slug / chat command</Label>
              <Input
                value={draft.slug}
                onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                className="border-slate-800 bg-slate-900 text-slate-200"
                placeholder="scope-auditor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-400">Description</Label>
            <Input
              value={draft.description || ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
              className="border-slate-800 bg-slate-900 text-slate-200"
              placeholder="Reviews scope gaps before the estimate moves forward."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-400">Core instructions</Label>
            <Textarea
              value={draft.instructions}
              onChange={(event) =>
                setDraft((current) => ({ ...current, instructions: event.target.value }))
              }
              className="min-h-28 border-slate-800 bg-slate-900 text-slate-200"
              placeholder="Tell this agent exactly how it should think, what it should prioritize, and what a strong answer looks like."
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-400">Base skill</Label>
              <Select
                value={draft.baseSkill}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, baseSkill: value as CustomAgentDraft["baseSkill"] }))
                }
              >
                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {CUSTOM_AGENT_SKILL_OPTIONS.map((skill) => (
                    <SelectItem key={skill} value={skill}>
                      {SKILL_LABELS[skill] || skill}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Execution mode</Label>
              <Select
                value={draft.executionMode}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    executionMode: value as CustomAgentExecutionMode,
                    pipelineStage:
                      value === "chat"
                        ? "preflight"
                        : current.pipelineStage || "preflight",
                  }))
                }
              >
                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {CUSTOM_AGENT_EXECUTION_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {EXECUTION_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.executionMode !== "chat" ? (
            <div className="space-y-2">
              <Label className="text-slate-400">Pipeline stage</Label>
              <Select
                value={draft.pipelineStage || "preflight"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    pipelineStage: value as CustomAgentPipelineStage,
                  }))
                }
              >
                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {CUSTOM_AGENT_PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {CUSTOM_AGENT_PIPELINE_STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-400">Permission level</Label>
              <Select
                value={String(draft.requiredLevel)}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    requiredLevel: Number(value) as PermissionLevel,
                  }))
                }
              >
                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {[0, 1, 2, 3, 4].map((level) => (
                    <SelectItem key={level} value={String(level)}>
                      Level {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Sort order</Label>
              <Input
                type="number"
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value || 0),
                  }))
                }
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-400">Trigger phrases</Label>
              <Input
                value={triggerInput}
                onChange={(event) => setTriggerInput(event.target.value)}
                className="border-slate-800 bg-slate-900 text-slate-200"
                placeholder="scope gap, review addenda, check exclusions"
              />
              <p className="text-xs text-slate-500">
                Comma-separated. If auto-run is enabled, these phrases can trigger the agent from chat.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Success criteria</Label>
              <Textarea
                value={draft.successCriteria || ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, successCriteria: event.target.value }))
                }
                className="min-h-20 border-slate-800 bg-slate-900 text-slate-200"
                placeholder="List the checks this agent must complete before it considers the task done."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-400">Output schema / response format</Label>
            <Textarea
              value={draft.outputSchema || ""}
              onChange={(event) =>
                setDraft((current) => ({ ...current, outputSchema: event.target.value }))
              }
              className="min-h-20 border-slate-800 bg-slate-900 text-slate-200"
              placeholder="Example: Summary / Risks / Missing files / Recommended next action / Human review needed"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Wrench className="h-4 w-4 text-sky-400" />
              Tool permissions
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {CUSTOM_AGENT_TOOL_OPTIONS.map((tool) => (
                <label
                  key={tool}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                >
                  <span className="text-xs text-slate-300">{tool}</span>
                  <Switch
                    checked={draft.allowedTools.includes(tool)}
                    onCheckedChange={(checked) => toggleTool(tool, checked)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
              <span className="text-sm text-slate-300">Enabled</span>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, enabled: checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
              <span className="text-sm text-slate-300">Auto-run from triggers</span>
              <Switch
                checked={draft.autoRun}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, autoRun: checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
              <span className="text-sm text-slate-300">Include project context</span>
              <Switch
                checked={draft.includeProjectContext}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, includeProjectContext: checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
              <span className="text-sm text-slate-300">Include document summary</span>
              <Switch
                checked={draft.includeDocumentSummary}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, includeDocumentSummary: checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
              <span className="text-sm text-slate-300">Include estimate snapshot</span>
              <Switch
                checked={draft.includeEstimateSnapshot}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, includeEstimateSnapshot: checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
              <span className="text-sm text-slate-300">Require review</span>
              <Switch
                checked={draft.reviewRequired}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, reviewRequired: checked }))
                }
              />
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Agent
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDelete()}
              disabled={!selectedAgentId || isDeleting}
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
