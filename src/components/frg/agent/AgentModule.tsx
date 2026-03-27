"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calculator,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  KeyRound,
  MailCheck,
  Loader2,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRoundCog,
  Zap,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppStore, useChatStore, useSkillsStore } from "@/store";
import { AGENT_PIPELINE_CATALOG } from "@/lib/agent-catalog";
import type {
  AgentPipelineAgentKey,
  AgentSafeAction,
  AgentRun,
  BillingOverview,
  AiProviderName,
  AiProviderSettingsResponse,
  AppUser,
  Conversation,
  Message,
  Module,
  PermissionLevel,
  ToolName,
  UserAgentWorkspaceConfig,
  UserSenderSettings,
} from "@/types";
import { ChatPanel } from "@/components/frg/ChatPanel";
import { BillingPanel } from "@/components/frg/agent/BillingPanel";
import { CustomAgentBuilder } from "@/components/frg/agent/CustomAgentBuilder";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface ConversationSummary {
  id: string;
  userId: string;
  projectId?: string | null;
  title?: string | null;
  preview: string;
  module?: Module | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface WorkspaceSettingsResponse {
  user?: AppUser;
  sender: UserSenderSettings;
  agentWorkspaceConfig: UserAgentWorkspaceConfig;
}

type ProviderSettingsPatch = {
  primary?: AiProviderName;
  providers?: Partial<Record<AiProviderName, { enabled?: boolean; model?: string }>>;
};

type ProviderDraftState = Record<AiProviderName, string>;

interface QuickActionDefinition {
  action: AgentSafeAction;
  label: string;
  description: string;
  icon: React.ElementType;
  color: "amber" | "orange" | "emerald" | "rose";
  prompt: string;
}

const QUICK_ACTIONS: QuickActionDefinition[] = [
  {
    action: "run_project_orchestrator",
    label: "Run Bid Pipeline",
    description: "Analyze the intake, review documents, generate the estimate and leave proposal ready for review.",
    icon: MailCheck,
    color: "amber",
    prompt: "Analyze the active bid package, select the right documents, build the estimate and leave everything ready for review before sending.",
  },
  {
    action: "create_estimate_draft",
    label: "Create Estimate Draft",
    description: "Clone the latest estimate into a safe draft version.",
    icon: Calculator,
    color: "orange",
    prompt: "Create a new estimate draft using the active project context.",
  },
  {
    action: "summarize_documents",
    label: "Summarize PDFs",
    description: "Summarize plans, specs and addenda from the active project.",
    icon: FileText,
    color: "emerald",
    prompt: "Summarize the current project documents and point out missing reviews.",
  },
  {
    action: "explain_takeoff",
    label: "Explain Takeoff",
    description: "Break down the latest takeoff in plain language by trade.",
    icon: Sparkles,
    color: "amber",
    prompt: "Explain the active takeoff and its current breakdown.",
  },
  {
    action: "generate_follow_up",
    label: "Generate Follow-up",
    description: "Create a safe follow-up email draft from the project context.",
    icon: Mail,
    color: "rose",
    prompt: "Generate a follow-up email draft for the active project.",
  },
];

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function QuickActionButton({
  action,
  disabled,
  isRunning,
  onClick,
}: {
  action: QuickActionDefinition;
  disabled?: boolean;
  isRunning?: boolean;
  onClick: () => void;
}) {
  const Icon = action.icon;
  const colorClasses = {
    amber: "text-amber-500 bg-amber-500/10 group-hover:bg-amber-500/20",
    orange: "text-orange-500 bg-orange-500/10 group-hover:bg-orange-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 group-hover:bg-emerald-500/20",
    rose: "text-rose-500 bg-rose-500/10 group-hover:bg-rose-500/20",
  };

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200",
        disabled
          ? "cursor-not-allowed border-slate-800 bg-slate-900/40 opacity-50"
          : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
      )}
    >
      <div className={cn("shrink-0 rounded-lg p-2.5 transition-colors", colorClasses[action.color])}>
        {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-200 transition-colors group-hover:text-white">
          {action.label}
        </span>
        <span className="line-clamp-2 text-xs text-slate-500 transition-colors group-hover:text-slate-400">
          {action.description}
        </span>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400" />
    </motion.button>
  );
}

function ConversationItemCard({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const moduleTone: Record<Module, string> = {
    dashboard: "text-sky-500",
    agent: "text-amber-500",
    estimate: "text-orange-500",
    learn: "text-emerald-500",
    boost: "text-rose-500",
    admin: "text-slate-400",
  };

  return (
    <motion.button
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-all duration-200",
        isActive
          ? "border-amber-500/20 bg-amber-500/10"
          : "border-transparent hover:bg-slate-800/50"
      )}
    >
      <div className="flex items-start gap-3">
        <MessageSquare
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            conversation.module ? moduleTone[conversation.module] : "text-slate-500"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm font-medium", isActive ? "text-white" : "text-slate-200")}>
              {conversation.title || "FRG Agent Session"}
            </span>
            <span className="shrink-0 text-xs text-slate-500">{formatTime(conversation.updatedAt)}</span>
          </div>
          <p className="truncate text-xs text-slate-500">{conversation.preview || "No preview yet."}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className="h-5 border-slate-700 py-0 text-xs text-slate-400">
              {conversation.messageCount} messages
            </Badge>
            {conversation.projectId ? (
              <Badge variant="outline" className="h-5 border-slate-700 py-0 text-xs text-slate-400">
                linked project
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function ActiveSkillsPanel({ skills }: { skills: Array<{ id: string; displayName: string; enabled: boolean; module: Module }> }) {
  const enabledSkills = skills.filter((skill) => skill.enabled && skill.module === "agent");

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Zap className="h-4 w-4 text-amber-500" />
          Active Skills
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {enabledSkills.length ? (
            enabledSkills.map((skill) => (
              <Badge
                key={skill.id}
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-400"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {skill.displayName}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-slate-500">No agent skills enabled</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderPanel({
  settings,
  disabled,
  isSaving,
  credentialDrafts,
  savingCredential,
  onToggle,
  onPrimaryChange,
  onCredentialChange,
  onCredentialSave,
  onCredentialDelete,
}: {
  settings: AiProviderSettingsResponse | null;
  disabled: boolean;
  isSaving: boolean;
  credentialDrafts: ProviderDraftState;
  savingCredential: AiProviderName | null;
  onToggle: (provider: AiProviderName, enabled: boolean) => void;
  onPrimaryChange: (provider: AiProviderName) => void;
  onCredentialChange: (provider: AiProviderName, value: string) => void;
  onCredentialSave: (provider: AiProviderName) => void;
  onCredentialDelete: (provider: AiProviderName) => void;
}) {
  if (!settings) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4 text-sm text-slate-500">Loading provider settings...</CardContent>
      </Card>
    );
  }

  const providers = (["openai", "anthropic", "gemini"] as AiProviderName[]).map((provider) => ({
    id: provider,
    ...settings.providers[provider],
  }));

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          AI Providers
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Each user can paste, validate, replace, or remove personal provider keys from here. OpenAI stays as the default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-2">
        <RadioGroup
          value={settings.primary}
          onValueChange={(value) => onPrimaryChange(value as AiProviderName)}
          className="space-y-3"
        >
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="cursor-pointer text-sm text-slate-200" htmlFor={`provider-${provider.id}`}>
                      {provider.label}
                    </Label>
                    {settings.active === provider.id ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        active
                      </Badge>
                    ) : null}
                    {!provider.hasApiKey ? (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                        missing key
                      </Badge>
                    ) : null}
                    {provider.validationStatus === "invalid" ? (
                      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                        invalid key
                      </Badge>
                    ) : null}
                    {provider.hasPersonalKey ? (
                      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-300">
                        personal key
                      </Badge>
                    ) : null}
                    {provider.hasSystemKey ? (
                      <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                        system fallback
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {provider.model} • using {provider.keySource === "user" ? "personal" : provider.keySource === "system" ? "system" : "no"} key
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      id={`provider-${provider.id}`}
                      value={provider.id}
                      disabled={disabled || !provider.enabled || isSaving}
                    />
                    <Switch
                      checked={provider.enabled}
                      disabled={disabled || isSaving}
                      onCheckedChange={(enabled) => onToggle(provider.id, enabled)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
                  <div className="flex items-start gap-2">
                    {provider.validationStatus === "invalid" || provider.validationStatus === "missing" ? (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-300">
                        {provider.hasPersonalKey
                          ? `Stored key ${provider.keyHint || ""}`
                          : provider.hasSystemKey
                            ? "No personal key saved yet. The app can still fall back to the system key."
                            : "No usable key is configured yet for this provider."}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          provider.validationStatus === "invalid" || provider.validationStatus === "missing"
                            ? "text-rose-300"
                            : "text-slate-500"
                        )}
                      >
                        {provider.lastValidationError
                          ? provider.lastValidationError
                          : provider.lastValidatedAt
                            ? `Last validated ${new Date(provider.lastValidatedAt).toLocaleString()}`
                            : provider.validationStatus === "pending"
                              ? "Validation is still pending."
                              : "Ready to use from this workspace."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-400">Personal API key</Label>
                  <Input
                    type="password"
                    value={credentialDrafts[provider.id]}
                    onChange={(event) => onCredentialChange(provider.id, event.target.value)}
                    className="border-slate-800 bg-slate-900 text-slate-200"
                    placeholder={
                      provider.hasPersonalKey
                        ? `Replace ${provider.label} key`
                        : `Paste your ${provider.label} API key`
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => onCredentialSave(provider.id)}
                    disabled={disabled || isSaving || savingCredential === provider.id || !credentialDrafts[provider.id].trim()}
                    className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    {savingCredential === provider.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    Save and validate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCredentialDelete(provider.id)}
                    disabled={disabled || isSaving || savingCredential === provider.id || !provider.hasPersonalKey}
                    className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>
        <p className="text-xs text-slate-500">
          If the primary provider is disabled or its key is missing or invalid, the agent falls back to the next enabled provider with a usable key.
        </p>
      </CardContent>
    </Card>
  );
}

type SenderFormState = UserSenderSettings & {
  smtpPassword?: string;
};

function SenderPanel({
  value,
  onChange,
  onSave,
  isSaving,
}: {
  value: SenderFormState;
  onChange: (next: SenderFormState) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <UserRoundCog className="h-4 w-4 text-sky-400" />
          Sender Profile
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Your registered email becomes the default sender profile. Add SMTP only if you want true send-as from your own mailbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-2">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-slate-400">From name</Label>
            <Input
              value={value.fromName || ""}
              onChange={(event) => onChange({ ...value, fromName: event.target.value })}
              className="border-slate-800 bg-slate-950 text-slate-200"
              placeholder="Future Remodeling LLC"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">From email</Label>
            <Input
              type="email"
              value={value.fromAddress || ""}
              onChange={(event) => onChange({ ...value, fromAddress: event.target.value })}
              className="border-slate-800 bg-slate-950 text-slate-200"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-400">Reply-to</Label>
          <Input
            type="email"
            value={value.replyTo || ""}
            onChange={(event) => onChange({ ...value, replyTo: event.target.value })}
            className="border-slate-800 bg-slate-950 text-slate-200"
            placeholder="reply@company.com"
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">SMTP personal</p>
              <p className="mt-1 text-xs text-slate-500">
                Si lo dejas vacio, el app usa el proveedor global y tu correo queda como reply-to o sender profile segun compatibilidad del proveedor.
              </p>
            </div>
            <Switch
              checked={Boolean(value.smtpHost)}
              onCheckedChange={(enabled) =>
                onChange(
                  enabled
                    ? value
                    : {
                        ...value,
                        smtpHost: "",
                        smtpPort: undefined,
                        smtpUser: "",
                        smtpPassword: "",
                      }
                )
              }
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              value={value.smtpHost || ""}
              onChange={(event) => onChange({ ...value, smtpHost: event.target.value })}
              className="border-slate-800 bg-slate-900 text-slate-200"
              placeholder="smtp.gmail.com"
            />
            <Input
              value={value.smtpPort || ""}
              onChange={(event) => onChange({ ...value, smtpPort: Number(event.target.value) || undefined })}
              className="border-slate-800 bg-slate-900 text-slate-200"
              placeholder="587"
            />
            <Input
              value={value.smtpUser || ""}
              onChange={(event) => onChange({ ...value, smtpUser: event.target.value })}
              className="border-slate-800 bg-slate-900 text-slate-200"
              placeholder="SMTP user"
            />
            <Input
              type="password"
              value={value.smtpPassword || ""}
              onChange={(event) => onChange({ ...value, smtpPassword: event.target.value })}
              className="border-slate-800 bg-slate-900 text-slate-200"
              placeholder={value.hasSmtpPassword ? "Saved password - write a new one to replace it" : "SMTP password"}
            />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-900/80 px-3 py-2">
            <span className="text-xs text-slate-400">Use secure SMTP</span>
            <Switch
              checked={Boolean(value.smtpSecure)}
              onCheckedChange={(checked) => onChange({ ...value, smtpSecure: checked })}
            />
          </div>
        </div>

        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-sky-500 text-white hover:bg-sky-600"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          Save sender profile
        </Button>
      </CardContent>
    </Card>
  );
}

function WorkspaceModePanel({
  value,
  onChange,
  onSave,
  isSaving,
}: {
  value: UserAgentWorkspaceConfig | null;
  onChange: (next: UserAgentWorkspaceConfig) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  if (!value) {
    return null;
  }

  const workspace = value;

  function updateAgent(
    agentKey: keyof UserAgentWorkspaceConfig["agents"],
    patch: Partial<UserAgentWorkspaceConfig["agents"][keyof UserAgentWorkspaceConfig["agents"]]>
  ) {
    onChange({
      ...workspace,
      agents: {
        ...workspace.agents,
        [agentKey]: {
          ...workspace.agents[agentKey],
          ...patch,
        },
      },
    });
  }

  function toggleAllowedTool(agentKey: AgentPipelineAgentKey, toolName: ToolName, enabled: boolean) {
    const current = workspace.agents[agentKey].allowedTools || [];
    const next: ToolName[] = enabled
      ? [...new Set([...current, toolName])]
      : current.filter((tool) => tool !== toolName);

    updateAgent(agentKey, { allowedTools: next });
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Agent Workspace
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Manual leaves all control to you. Assisted suggests and runs when you ask. Agentic can auto-launch the bid pipeline from chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-2">
        <div className="space-y-2">
          <Label className="text-slate-400">Workspace mode</Label>
          <Select
            value={workspace.mode}
            onValueChange={(nextMode) =>
              onChange({
                ...workspace,
                mode: nextMode as UserAgentWorkspaceConfig["mode"],
              })
            }
          >
            <SelectTrigger className="w-full border-slate-800 bg-slate-950 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="assisted">Assisted</SelectItem>
              <SelectItem value="agentic">Agentic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-200">Auto-run from chat</p>
              <p className="text-xs text-slate-500">
                If you type things like “analiza todo” or “haz el estimado”, the orchestrator can start automatically.
              </p>
            </div>
            <Switch
              checked={workspace.autoRunOnChat}
              onCheckedChange={(checked) => onChange({ ...workspace, autoRunOnChat: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-200">Require review before send</p>
              <p className="text-xs text-slate-500">
                Keeps estimate and proposal in review before any external send.
              </p>
            </div>
            <Switch
              checked={workspace.requireReviewBeforeSend}
              onCheckedChange={(checked) =>
                onChange({ ...workspace, requireReviewBeforeSend: checked })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          {(Object.entries(AGENT_PIPELINE_CATALOG) as Array<
            [AgentPipelineAgentKey, (typeof AGENT_PIPELINE_CATALOG)[AgentPipelineAgentKey]]
          >).map(([agentKey, meta]) => (
            <div
              key={agentKey}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-200">{meta.label}</p>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </div>
                <Switch
                  checked={workspace.agents[agentKey].enabled}
                  onCheckedChange={(checked) => updateAgent(agentKey, { enabled: checked })}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg bg-slate-900/80 px-3 py-2">
                  <span className="text-xs text-slate-400">Review required</span>
                  <Switch
                    checked={Boolean(workspace.agents[agentKey].reviewRequired)}
                    onCheckedChange={(checked) =>
                      updateAgent(agentKey, { reviewRequired: checked })
                    }
                  />
                </div>

                <div className="space-y-2 rounded-lg bg-slate-900/80 px-3 py-2">
                  <Label className="text-xs text-slate-400">Required level</Label>
                  <Select
                    value={String(workspace.agents[agentKey].requiredLevel ?? meta.requiredLevel)}
                    onValueChange={(nextLevel) =>
                      updateAgent(agentKey, {
                        requiredLevel: Number(nextLevel) as PermissionLevel,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 border-slate-800 bg-slate-950 text-slate-200">
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
              </div>

              <div className="mt-3 rounded-lg bg-slate-900/80 px-3 py-3">
                <p className="text-xs font-medium text-slate-400">Allowed tools</p>
                <div className="mt-2 grid gap-2">
                  {meta.allowedTools.map((toolName) => {
                    const enabled = (workspace.agents[agentKey].allowedTools || []).includes(toolName);
                    return (
                      <div key={toolName} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-300">{toolName}</span>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            toggleAllowedTool(agentKey, toolName, checked)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={onSave}
          disabled={isSaving}
          className="w-full bg-amber-500 text-white hover:bg-amber-600"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Save agent workspace
        </Button>
      </CardContent>
    </Card>
  );
}

export function AgentModule({ className }: { className?: string }) {
  const { activeProject, activeUser, activeConversation, setActiveConversation, setActiveUser } =
    useAppStore();
  const { skills } = useSkillsStore();
  const { addMessage, clearMessages, setIsTyping, setMessages } = useChatStore();
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [agentRuns, setAgentRuns] = React.useState<AgentRun[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = React.useState(true);
  const [providerSettings, setProviderSettings] = React.useState<AiProviderSettingsResponse | null>(null);
  const [billingOverview, setBillingOverview] = React.useState<BillingOverview | null>(null);
  const [providerDrafts, setProviderDrafts] = React.useState<ProviderDraftState>({
    openai: "",
    anthropic: "",
    gemini: "",
  });
  const [isSavingProviders, setIsSavingProviders] = React.useState(false);
  const [isLoadingBilling, setIsLoadingBilling] = React.useState(true);
  const [savingCredentialProvider, setSavingCredentialProvider] = React.useState<AiProviderName | null>(null);
  const [senderSettings, setSenderSettings] = React.useState<SenderFormState>({
    smtpSecure: false,
  });
  const [workspaceConfig, setWorkspaceConfig] = React.useState<UserAgentWorkspaceConfig | null>(null);
  const [isSavingWorkspace, setIsSavingWorkspace] = React.useState(false);
  const [runningAction, setRunningAction] = React.useState<AgentSafeAction | null>(null);
  const selectedConversationId = activeConversation?.id || null;

  const syncConversations = React.useEffectEvent(async () => {
    const params = new URLSearchParams();
    params.set("module", "agent");
    params.set("limit", "15");
    if (activeProject?.id) {
      params.set("projectId", activeProject.id);
    }

    const response = await fetch(`/api/chat?${params.toString()}`);
    const payload = (await response.json()) as ApiEnvelope<ConversationSummary[]>;
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load conversations");
    }

    React.startTransition(() => {
      setConversations(payload.data || []);
    });
  });

  const syncAgentRuns = React.useEffectEvent(async () => {
    const params = new URLSearchParams();
    params.set("limit", "8");
    if (activeProject?.id) {
      params.set("projectId", activeProject.id);
    }

    const response = await fetch(`/api/agent-runs?${params.toString()}`);
    const payload = (await response.json()) as ApiEnvelope<AgentRun[]>;
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load agent runs");
    }

    React.startTransition(() => {
      setAgentRuns(
        (payload.data || []).map((run) => ({
          ...run,
          createdAt: new Date(run.createdAt),
          updatedAt: new Date(run.updatedAt),
          steps: (run.steps || []).map((step) => ({
            ...step,
            startedAt: new Date(step.startedAt),
            finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
            createdAt: new Date(step.createdAt),
            updatedAt: new Date(step.updatedAt),
          })),
        }))
      );
    });
  });

  const syncProviderSettings = React.useEffectEvent(async () => {
    const response = await fetch("/api/ai/settings");
    const payload = (await response.json()) as ApiEnvelope<AiProviderSettingsResponse>;
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load provider settings");
    }

    React.startTransition(() => {
      setProviderSettings(payload.data || null);
    });
  });

  const syncBillingOverview = React.useEffectEvent(async () => {
    const response = await fetch("/api/billing/overview");
    const payload = (await response.json()) as ApiEnvelope<BillingOverview>;
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load billing overview");
    }

    React.startTransition(() => {
      setBillingOverview(payload.data || null);
    });
  });

  const syncWorkspaceSettings = React.useEffectEvent(async () => {
    const response = await fetch("/api/workspace/settings");
    const payload = (await response.json()) as ApiEnvelope<WorkspaceSettingsResponse>;
    if (!payload.success || !payload.data) {
      throw new Error(payload.error || "Unable to load workspace settings");
    }
    const data = payload.data;

    React.startTransition(() => {
      setSenderSettings({
        ...data.sender,
        smtpPassword: "",
      });
      setWorkspaceConfig(data.agentWorkspaceConfig);
      if (data.user) {
        setActiveUser(data.user);
      }
    });
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setIsLoadingConversations(true);
        setIsLoadingBilling(true);
        await Promise.all([
          syncConversations(),
          syncProviderSettings(),
          syncWorkspaceSettings(),
          syncAgentRuns(),
          syncBillingOverview(),
        ]);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false);
          setIsLoadingBilling(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [
    activeProject?.id,
    activeUser?.id,
    syncAgentRuns,
    syncBillingOverview,
    syncConversations,
    syncProviderSettings,
    syncWorkspaceSettings,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const billingState = params.get("billing");
    if (!billingState) {
      return;
    }

    if (billingState === "success") {
      toast({
        title: "Billing updated",
        description: "Stripe checkout completed. Refreshing your current plan and usage.",
      });
    } else if (billingState === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "No billing changes were applied.",
        variant: "destructive",
      });
    } else if (billingState === "portal-return") {
      toast({
        title: "Billing portal closed",
        description: "Refreshing your account status.",
      });
    }

    void syncBillingOverview();

    params.delete("billing");
    params.delete("session_id");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, [syncBillingOverview]);

  React.useEffect(() => {
    if (!activeConversation?.id) {
      return;
    }

    void syncConversations();
  }, [activeConversation?.id, syncConversations]);

  async function handleConversationClick(conversation: ConversationSummary) {
    if (!activeUser) return;

    setActiveConversation({
      id: conversation.id,
      userId: activeUser.id,
      projectId: conversation.projectId || undefined,
      module: (conversation.module as Module | undefined) || "agent",
      title: conversation.title || undefined,
      messages: [],
      createdAt: new Date(conversation.createdAt),
      updatedAt: new Date(conversation.updatedAt),
    } satisfies Conversation);
  }

  function handleNewChat() {
    setActiveConversation(null);
    clearMessages();
  }

  async function runSafeAction(action: QuickActionDefinition) {
    if (!activeUser) return;

    setRunningAction(action.action);
    setActiveConversation(null);
    clearMessages();

    const optimisticUserMessage: Message = {
      id: `${Date.now()}-user`,
      conversationId: "pending",
      role: "user",
      content: action.prompt,
      createdAt: new Date(),
    };

    addMessage(optimisticUserMessage);
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: action.prompt,
          projectId: activeProject?.id,
          module: "agent",
          action: action.action,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<{
        conversationId: string;
        message: Message;
      }>;

      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Safe action failed");
      }

      const assistantMessage = {
        ...payload.data.message,
        createdAt: new Date(payload.data.message.createdAt),
      };

      setMessages([
        {
          ...optimisticUserMessage,
          conversationId: payload.data.conversationId,
        },
        assistantMessage,
      ]);

      setActiveConversation({
        id: payload.data.conversationId,
        userId: activeUser.id,
        projectId: activeProject?.id,
        module: "agent",
        title: action.label,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await Promise.all([syncConversations(), syncAgentRuns(), syncBillingOverview()]);
    } catch (error) {
      addMessage({
        id: `${Date.now()}-error`,
        conversationId: "pending",
        role: "assistant",
        content:
          error instanceof Error
            ? `No pude ejecutar la accion: ${error.message}`
            : "No pude ejecutar la accion segura.",
        createdAt: new Date(),
      });
    } finally {
      setIsTyping(false);
      setRunningAction(null);
    }
  }

  async function updateProviderSettings(next: ProviderSettingsPatch) {
    try {
      setIsSavingProviders(true);

      const response = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(next),
      });

      const payload = (await response.json()) as ApiEnvelope<AiProviderSettingsResponse>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to save provider settings");
      }

      setProviderSettings(payload.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingProviders(false);
    }
  }

  function handleProviderToggle(provider: AiProviderName, enabled: boolean) {
    if (!providerSettings) return;
    void updateProviderSettings({
      providers: {
        [provider]: {
          enabled,
          model: providerSettings.providers[provider].model,
        },
      },
    });
  }

  function handlePrimaryChange(provider: AiProviderName) {
    if (!providerSettings) return;
    void updateProviderSettings({ primary: provider });
  }

  function handleProviderDraftChange(provider: AiProviderName, value: string) {
    setProviderDrafts((current) => ({
      ...current,
      [provider]: value,
    }));
  }

  async function handleProviderCredentialSave(provider: AiProviderName) {
    const apiKey = providerDrafts[provider].trim();
    if (!apiKey) {
      toast({
        title: "API key required",
        description: `Paste your ${providerSettings?.providers[provider].label || provider} API key first.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingCredentialProvider(provider);

      const response = await fetch("/api/ai/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<AiProviderSettingsResponse>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to save provider key");
      }

      setProviderSettings(payload.data);
      setProviderDrafts((current) => ({
        ...current,
        [provider]: "",
      }));

      const savedProvider = payload.data.providers[provider];
      if (savedProvider.validationStatus === "invalid") {
        toast({
          title: `${savedProvider.label} key saved with a validation issue`,
          description:
            savedProvider.lastValidationError ||
            "The personal key did not validate. Check it and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: `${savedProvider.label} ready`,
        description:
          savedProvider.keySource === "user"
            ? "Your personal API key is now active for this workspace."
            : "The provider was updated and the app can now use the available fallback.",
      });
    } catch (error) {
      toast({
        title: "Provider key save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingCredentialProvider(null);
    }
  }

  async function handleProviderCredentialDelete(provider: AiProviderName) {
    try {
      setSavingCredentialProvider(provider);

      const response = await fetch("/api/ai/credentials", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider }),
      });

      const payload = (await response.json()) as ApiEnvelope<AiProviderSettingsResponse>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to remove provider key");
      }

      setProviderSettings(payload.data);
      setProviderDrafts((current) => ({
        ...current,
        [provider]: "",
      }));
      toast({
        title: `${payload.data.providers[provider].label} personal key removed`,
        description: payload.data.providers[provider].hasSystemKey
          ? "The app can still use the system fallback for this provider."
          : "This provider now needs a new valid key before it can be used.",
      });
    } catch (error) {
      toast({
        title: "Provider key removal failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingCredentialProvider(null);
    }
  }

  async function handleSaveWorkspace() {
    if (!workspaceConfig) return;

    try {
      setIsSavingWorkspace(true);

      const response = await fetch("/api/workspace/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: senderSettings,
          agentWorkspaceConfig: workspaceConfig,
        }),
      });

      const payload = (await response.json()) as ApiEnvelope<WorkspaceSettingsResponse>;
      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Unable to save workspace settings");
      }
      const data = payload.data;

      setSenderSettings({
        ...data.sender,
        smtpPassword: "",
      });
      setWorkspaceConfig(data.agentWorkspaceConfig);
      if (data.user) {
        setActiveUser(data.user);
      }
    } catch (error) {
      toast({
        title: "Workspace save failed",
        description: error instanceof Error ? error.message : "Unable to save workspace settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  return (
    <div className={cn("flex h-full bg-slate-950", className)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <ModuleHeader
          title="FRG Agent Core"
          description="Bid intake, document review, estimate orchestration and proposal prep from one project-aware chat"
          quickActions={[
            { id: "new-chat", label: "New Chat", icon: MessageSquare, onClick: handleNewChat },
            { id: "refresh", label: "Refresh", icon: Sparkles, onClick: () => void syncConversations() },
          ]}
          statusIndicators={[
            {
              id: "provider",
              label: "Provider",
              status: providerSettings?.active ? "success" : "warning",
              value: providerSettings?.active
                ? providerSettings.providers[providerSettings.active].label
                : "No active provider",
            },
            {
              id: "project",
              label: "Project",
              status: activeProject ? "success" : "idle",
              value: activeProject?.name || "No active project",
            },
            {
              id: "mode",
              label: "Mode",
              status: workspaceConfig?.mode === "agentic" ? "success" : "idle",
              value: workspaceConfig?.mode || "manual",
            },
          ]}
        />

        <div className="flex-1 overflow-hidden">
          <ChatPanel
            welcomeTitle="What do you want the agent to do?"
            welcomeSubtitle="Drop into chat exactly like a bid desk workflow: upload the bid package, pick the project, then tell the agent to analyze the scope, select the right plans, build the estimate and leave it ready for review."
            examplePrompts={[
              {
                icon: MailCheck,
                text: "Analiza todo este bid package, selecciona los planos correctos, haz el estimate y dejalo listo para revision.",
              },
              {
                icon: Calculator,
                text: "Review the current estimate and tell me the riskiest line items.",
              },
              {
                icon: FileText,
                text: "Summarize the uploaded PDFs and tell me what still needs review.",
              },
              {
                icon: Sparkles,
                text: "Explain the current takeoff like I am reviewing it with the client.",
              },
              {
                icon: Mail,
                text: "Draft a follow-up email for the active project.",
              },
            ]}
          />
        </div>
      </div>

      <AnimatePresence>
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="hidden w-96 flex-col border-l border-slate-800 bg-slate-950 lg:flex"
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm font-medium text-slate-200">Project Context</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Safe actions use the active project, latest estimate and uploaded documents.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 py-2">
                  {activeProject ? (
                    <>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-sm font-medium text-white">{activeProject.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activeProject.client || "No client"} • {activeProject.status}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <span className="text-slate-500">Documents</span>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {activeProject.documents.length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                          <span className="text-slate-500">Estimates</span>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {activeProject.estimates.length}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Select a project from the sidebar so the agent can use real context.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div>
                <h3 className="mb-3 text-sm font-medium text-slate-300">Safe Actions</h3>
                <div className="space-y-2">
                  {QUICK_ACTIONS.map((action) => (
                    <QuickActionButton
                      key={action.action}
                      action={action}
                      disabled={!activeProject}
                      isRunning={runningAction === action.action}
                      onClick={() => void runSafeAction(action)}
                    />
                  ))}
                </div>
              </div>

              <ActiveSkillsPanel skills={skills} />
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm font-medium text-slate-200">
                    Recent Pipeline Runs
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Execution log by agent for the active workspace and project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 py-2">
                  {agentRuns.length ? (
                    agentRuns.map((run) => (
                      <div
                        key={run.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {run.summary || "Pipeline run"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {run.trigger} • {run.mode} • {new Date(run.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              run.status === "completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : run.status === "failed"
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            )}
                          >
                            {run.status}
                          </Badge>
                        </div>

                        <div className="mt-3 space-y-2">
                          {run.steps.map((step) => (
                            <div
                              key={step.id}
                              className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-medium text-slate-200">
                                  {step.agentLabel}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    step.status === "completed"
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                      : step.status === "failed"
                                        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                        : "border-slate-700 bg-slate-900 text-slate-300"
                                  )}
                                >
                                  {step.status}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-400">{step.summary}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {step.tool ? (
                                  <Badge
                                    variant="outline"
                                    className="border-slate-700 bg-slate-900 text-slate-300"
                                  >
                                    {step.tool}
                                  </Badge>
                                ) : null}
                                {step.skill ? (
                                  <Badge
                                    variant="outline"
                                    className="border-slate-700 bg-slate-900 text-slate-300"
                                  >
                                    {step.skill}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-500">
                      No pipeline runs yet for this scope.
                    </div>
                  )}
                </CardContent>
              </Card>
              <ProviderPanel
                settings={providerSettings}
                disabled={false}
                isSaving={isSavingProviders}
                credentialDrafts={providerDrafts}
                savingCredential={savingCredentialProvider}
                onToggle={handleProviderToggle}
                onPrimaryChange={handlePrimaryChange}
                onCredentialChange={handleProviderDraftChange}
                onCredentialSave={(provider) => void handleProviderCredentialSave(provider)}
                onCredentialDelete={(provider) => void handleProviderCredentialDelete(provider)}
              />
              <BillingPanel
                overview={billingOverview}
                isLoading={isLoadingBilling}
                onRefresh={async () => {
                  setIsLoadingBilling(true);
                  try {
                    await syncBillingOverview();
                  } finally {
                    setIsLoadingBilling(false);
                  }
                }}
              />
              <SenderPanel
                value={senderSettings}
                onChange={setSenderSettings}
                onSave={() => void handleSaveWorkspace()}
                isSaving={isSavingWorkspace}
              />
              <WorkspaceModePanel
                value={workspaceConfig}
                onChange={(next) => setWorkspaceConfig(next)}
                onSave={() => void handleSaveWorkspace()}
                isSaving={isSavingWorkspace}
              />
              <CustomAgentBuilder onChanged={() => void syncBillingOverview()} />

              <Separator className="bg-slate-800" />

              <div className="flex min-h-0 flex-col">
                <div className="pb-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Clock className="h-4 w-4 text-slate-500" />
                    Recent Conversations
                  </h3>
                </div>
                {isLoadingConversations ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                    Loading conversations...
                  </div>
                ) : conversations.length ? (
                  <div className="space-y-1">
                    {conversations.map((conversation) => (
                      <ConversationItemCard
                        key={conversation.id}
                        conversation={conversation}
                        isActive={selectedConversationId === conversation.id}
                        onClick={() => void handleConversationClick(conversation)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-500">
                    No agent conversations yet for this scope.
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </motion.aside>
      </AnimatePresence>
    </div>
  );
}

export default AgentModule;
