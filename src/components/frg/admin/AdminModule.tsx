"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Shield,
  Database,
  Activity,
  Zap,
  Power,
  Key,
  LayoutDashboard,
  Wrench,
  ScrollText,
  Users,
  MemoryStick,
  FileText,
  ChevronRight,
  Cpu,
  Plug,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Building2,
  FolderKanban,
  MoreHorizontal,
  Bell,
  Save,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, useSkillsStore, useToolsStore } from "@/store";
import { PERMISSION_LABELS, type PermissionLevel, type Module } from "@/types";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================
// TYPES
// ============================================

type AdminSection = "dashboard" | "skills" | "tools" | "rules" | "permissions" | "memory" | "logs" | "settings";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warning" | "error" | "success";
  module: Module;
  action: string;
  details: string;
  user?: string;
}

interface SystemMetric {
  label: string;
  value: string | number;
  change?: number;
  status: "healthy" | "warning" | "critical";
}

interface ConnectorStatus {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  lastSync?: Date;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  usage: number;
  limit?: number;
}

interface AutomationSwitch {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  lastTriggered?: Date;
}

// ============================================
// MOCK DATA
// ============================================

const mockSystemMetrics: SystemMetric[] = [
  { label: "Active Users", value: 12, change: 3, status: "healthy" },
  { label: "API Calls Today", value: 1247, change: -5, status: "healthy" },
  { label: "Memory Usage", value: "2.4 GB", status: "healthy" },
  { label: "Response Time", value: "142ms", change: 12, status: "warning" },
];

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    level: "info",
    module: "estimate",
    action: "Takeoff Complete",
    details: "Extracted 45 quantities from blueprint",
    user: "john@builder.com",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    level: "success",
    module: "boost",
    action: "Email Sent",
    details: "Proposal email delivered to client@example.com",
    user: "sarah@builder.com",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
    level: "warning",
    module: "agent",
    action: "Rate Limit",
    details: "API rate limit approaching (85% used)",
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    level: "error",
    module: "estimate",
    action: "Parse Error",
    details: "Failed to extract text from corrupted PDF",
    user: "mike@builder.com",
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    level: "info",
    module: "learn",
    action: "Lesson Completed",
    details: "User completed 'Foundation Basics' module",
    user: "newbie@builder.com",
  },
];

const mockConnectors: ConnectorStatus[] = [
  { id: "1", name: "OpenAI API", type: "AI Provider", status: "connected", lastSync: new Date() },
  { id: "2", name: "Google Drive", type: "Storage", status: "connected", lastSync: new Date(Date.now() - 1000 * 60 * 5) },
  { id: "3", name: "QuickBooks", type: "Accounting", status: "disconnected" },
  { id: "4", name: "SendGrid", type: "Email", status: "connected", lastSync: new Date(Date.now() - 1000 * 60 * 2) },
];

const mockAIModels: AIModel[] = [
  { id: "1", name: "GPT-4o", provider: "OpenAI", enabled: true, usage: 5420, limit: 10000 },
  { id: "2", name: "GPT-4o-mini", provider: "OpenAI", enabled: true, usage: 12847 },
  { id: "3", name: "Claude 3.5 Sonnet", provider: "Anthropic", enabled: true, usage: 3210, limit: 5000 },
  { id: "4", name: "Gemini Pro", provider: "Google", enabled: false, usage: 0 },
];

const mockAutomations: AutomationSwitch[] = [
  { id: "1", name: "Auto-save Conversations", description: "Automatically save chat history", enabled: true, lastTriggered: new Date() },
  { id: "2", name: "Daily Backup", description: "Backup data to cloud storage daily", enabled: true, lastTriggered: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  { id: "3", name: "Email Notifications", description: "Send alerts for important events", enabled: false },
  { id: "4", name: "Auto Tag Documents", description: "Use AI to categorize uploaded files", enabled: true, lastTriggered: new Date(Date.now() - 1000 * 60 * 30) },
];

const mockMemoryData = {
  user: {
    language: "English",
    explanationStyle: "detailed",
    companyType: "General Contractor",
    preferredMargins: 15,
    recentProjects: ["Downtown Office", "Residential Complex"],
  },
  company: {
    name: "Builder-FRG-LLC",
    specialties: ["Commercial", "Residential", "Renovation"],
    workZones: ["Downtown", "Suburbs"],
    crewCount: 25,
  },
  project: {
    name: "Downtown Office Renovation",
    addendas: 2,
    exclusions: ["HVAC", "Elevator"],
    notes: "Historic building - special permits required",
  },
};

// ============================================
// NAVIGATION ITEM COMPONENT
// ============================================

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  section: AdminSection;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function NavItem({ icon: Icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left",
        active
          ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {badge !== undefined && (
        <Badge variant="outline" className="h-5 px-1.5 text-xs border-slate-600 text-slate-400">
          {badge}
        </Badge>
      )}
      {active && <ChevronRight className="h-4 w-4 text-orange-400" />}
    </motion.button>
  );
}

// ============================================
// METRIC CARD COMPONENT
// ============================================

function MetricCard({ metric }: { metric: SystemMetric }) {
  const statusColors = {
    healthy: "text-emerald-500",
    warning: "text-amber-500",
    critical: "text-rose-500",
  };

  const statusBgColors = {
    healthy: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    critical: "bg-rose-500/10",
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">{metric.label}</span>
          <div className={cn("h-2 w-2 rounded-full", statusBgColors[metric.status], statusColors[metric.status])} />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-white">{metric.value}</span>
          {metric.change !== undefined && (
            <span className={cn(
              "text-xs font-medium mb-1",
              metric.change >= 0 ? "text-emerald-500" : "text-rose-500"
            )}>
              {metric.change >= 0 ? "+" : ""}{metric.change}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// LOG ENTRY COMPONENT
// ============================================

function LogEntryRow({ log }: { log: LogEntry }) {
  const levelConfig = {
    info: { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
    success: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
    error: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  };

  const config = levelConfig[log.level];
  const Icon = config.icon;

  const moduleColors: Record<Module, string> = {
    dashboard: "text-sky-500",
    agent: "text-amber-500",
    estimate: "text-orange-500",
    learn: "text-emerald-500",
    boost: "text-rose-500",
    admin: "text-slate-400",
  };

  return (
    <TableRow className="hover:bg-slate-800/50 border-slate-800">
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-1 rounded", config.bg)}>
            <Icon className={cn("h-3.5 w-3.5", config.color)} />
          </div>
          <span className="text-xs text-slate-500">
            {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("border-slate-700", moduleColors[log.module])}>
          {log.module}
        </Badge>
      </TableCell>
      <TableCell className="font-medium text-slate-200">{log.action}</TableCell>
      <TableCell className="text-slate-400 text-sm max-w-xs truncate">{log.details}</TableCell>
      <TableCell className="text-slate-500 text-sm">{log.user || "System"}</TableCell>
    </TableRow>
  );
}

// ============================================
// CONNECTOR STATUS COMPONENT
// ============================================

function ConnectorCard({ connector }: { connector: ConnectorStatus }) {
  const statusConfig = {
    connected: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Connected" },
    disconnected: { color: "text-slate-500", bg: "bg-slate-500/10", label: "Disconnected" },
    error: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Error" },
  };

  const config = statusConfig[connector.status];

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", config.bg)}>
          <Plug className={cn("h-4 w-4", config.color)} />
        </div>
        <div>
          <span className="text-sm font-medium text-slate-200">{connector.name}</span>
          <p className="text-xs text-slate-500">{connector.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn("text-xs", config.color, "border-current/20")}>
          {config.label}
        </Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// AI MODEL CARD COMPONENT
// ============================================

function AIModelCard({ model, onToggle }: { model: AIModel; onToggle: () => void }) {
  const usagePercent = model.limit ? (model.usage / model.limit) * 100 : 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          model.enabled ? "bg-orange-500/10" : "bg-slate-700/50"
        )}>
          <Cpu className={cn("h-4 w-4", model.enabled ? "text-orange-500" : "text-slate-500")} />
        </div>
        <div>
          <span className="text-sm font-medium text-slate-200">{model.name}</span>
          <p className="text-xs text-slate-500">{model.provider}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {model.limit && (
          <div className="w-24">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Usage</span>
              <span className="text-slate-300">{model.usage.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", usagePercent > 80 ? "bg-rose-500" : "bg-orange-500")}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}
        <Switch checked={model.enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

// ============================================
// AUTOMATION TOGGLE COMPONENT
// ============================================

function AutomationToggle({ automation, onToggle }: { automation: AutomationSwitch; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          automation.enabled ? "bg-emerald-500/10" : "bg-slate-700/50"
        )}>
          <Power className={cn("h-4 w-4", automation.enabled ? "text-emerald-500" : "text-slate-500")} />
        </div>
        <div>
          <span className="text-sm font-medium text-slate-200">{automation.name}</span>
          <p className="text-xs text-slate-500">{automation.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {automation.lastTriggered && (
          <span className="text-xs text-slate-500">
            {automation.lastTriggered.toLocaleDateString()}
          </span>
        )}
        <Switch checked={automation.enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

// ============================================
// MEMORY VIEWER COMPONENT
// ============================================

function MemoryViewer({ type, data }: { type: "user" | "company" | "project"; data: Record<string, unknown> }) {
  const icons = { user: User, company: Building2, project: FolderKanban };
  const colors = {
    user: "text-amber-500 bg-amber-500/10",
    company: "text-blue-500 bg-blue-500/10",
    project: "text-emerald-500 bg-emerald-500/10",
  };
  const Icon = icons[type];

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <div className={cn("p-1.5 rounded", colors[type])}>
            <Icon className="h-4 w-4" />
          </div>
          {type.charAt(0).toUpperCase() + type.slice(1)} Memory
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-xs text-slate-500 min-w-24">{key}:</span>
              <span className="text-sm text-slate-300">
                {Array.isArray(value)
                  ? value.join(", ")
                  : typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 text-slate-300">
            <Save className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 text-slate-300">
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// SKILL ROW COMPONENT
// ============================================

function SkillRow({
  skill,
  onToggle,
}: {
  skill: { id: string; name: string; displayName: string; description: string; module: Module; enabled: boolean };
  onToggle: () => void;
}) {
  const moduleColors: Record<Module, string> = {
    dashboard: "text-sky-500 border-sky-500/30",
    agent: "text-amber-500 border-amber-500/30",
    estimate: "text-orange-500 border-orange-500/30",
    learn: "text-emerald-500 border-emerald-500/30",
    boost: "text-rose-500 border-rose-500/30",
    admin: "text-slate-400 border-slate-500/30",
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          skill.enabled ? "bg-orange-500/10" : "bg-slate-700/50"
        )}>
          <Zap className={cn("h-4 w-4", skill.enabled ? "text-orange-500" : "text-slate-500")} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{skill.displayName}</span>
            <Badge variant="outline" className={cn("text-xs", moduleColors[skill.module])}>
              {skill.module}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 truncate">{skill.description}</p>
        </div>
      </div>
      <Switch checked={skill.enabled} onCheckedChange={onToggle} />
    </div>
  );
}

// ============================================
// TOOL ROW COMPONENT
// ============================================

function ToolRow({
  tool,
  onToggle,
}: {
  tool: { id: string; name: string; displayName: string; description: string; enabled: boolean; requiredLevel: PermissionLevel };
  onToggle: () => void;
}) {
  const levelColors: Record<PermissionLevel, string> = {
    0: "text-slate-400 border-slate-500/30",
    1: "text-blue-400 border-blue-500/30",
    2: "text-amber-400 border-amber-500/30",
    3: "text-orange-400 border-orange-500/30",
    4: "text-rose-400 border-rose-500/30",
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          tool.enabled ? "bg-blue-500/10" : "bg-slate-700/50"
        )}>
          <Wrench className={cn("h-4 w-4", tool.enabled ? "text-blue-500" : "text-slate-500")} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{tool.displayName}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn("text-xs", levelColors[tool.requiredLevel])}>
                  <Key className="h-3 w-3 mr-1" />
                  L{tool.requiredLevel}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-800 border-slate-700">
                {PERMISSION_LABELS[tool.requiredLevel]}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-slate-500 truncate">{tool.description}</p>
        </div>
      </div>
      <Switch checked={tool.enabled} onCheckedChange={onToggle} />
    </div>
  );
}

// ============================================
// MAIN ADMIN MODULE COMPONENT
// ============================================

export function AdminModule({ className }: { className?: string }) {
  const { activeUser, permissionLevel } = useAppStore();
  const { skills, toggleSkill } = useSkillsStore();
  const { tools, toggleTool } = useToolsStore();
  
  const [activeSection, setActiveSection] = React.useState<AdminSection>("dashboard");
  const [aiModels, setAIModels] = React.useState(mockAIModels);
  const [automations, setAutomations] = React.useState(mockAutomations);
  const [searchQuery, setSearchQuery] = React.useState("");

  const navigationItems: { icon: React.ElementType; label: string; section: AdminSection; badge?: number }[] = [
    { icon: LayoutDashboard, label: "Dashboard", section: "dashboard" },
    { icon: Zap, label: "Skills", section: "skills", badge: skills.filter(s => s.enabled).length },
    { icon: Wrench, label: "Tools", section: "tools", badge: tools.filter(t => t.enabled).length },
    { icon: ScrollText, label: "Rules", section: "rules" },
    { icon: Shield, label: "Permissions", section: "permissions" },
    { icon: MemoryStick, label: "Memory", section: "memory" },
    { icon: FileText, label: "Logs", section: "logs", badge: mockLogs.filter(l => l.level === "error").length },
    { icon: Settings, label: "Settings", section: "settings" },
  ];

  const toggleAIModel = (id: string) => {
    setAIModels(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("flex h-full bg-slate-950", className)}>
      {/* Left Panel - Admin Navigation */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="w-56 border-r border-slate-800 flex flex-col bg-slate-950"
      >
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Settings className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Admin Forge</h2>
              <p className="text-xs text-slate-500">Control Panel</p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-3 py-4">
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <NavItem
                key={item.section}
                {...item}
                active={activeSection === item.section}
                onClick={() => setActiveSection(item.section)}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-slate-400">Access Level:</span>
            <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
              L{permissionLevel}
            </Badge>
          </div>
        </div>
      </motion.aside>

      {/* Main Area - Active Section */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ModuleHeader
          title={navigationItems.find(n => n.section === activeSection)?.label || "Admin"}
          description="System configuration and management"
          quickActions={[
            { id: "refresh", label: "Refresh", icon: RefreshCw },
            { id: "export", label: "Export", icon: Download },
          ]}
        />

        <ScrollArea className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Dashboard Section */}
              {activeSection === "dashboard" && (
                <>
                  {/* System Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {mockSystemMetrics.map((metric) => (
                      <MetricCard key={metric.label} metric={metric} />
                    ))}
                  </div>

                  {/* Connectors & AI Models */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                          <Plug className="h-4 w-4 text-blue-500" />
                          Connectors
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-4 space-y-2">
                        {mockConnectors.map((connector) => (
                          <ConnectorCard key={connector.id} connector={connector} />
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900/50 border-slate-800">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-orange-500" />
                          AI Models
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-4 space-y-2">
                        {aiModels.map((model) => (
                          <AIModelCard
                            key={model.id}
                            model={model}
                            onToggle={() => toggleAIModel(model.id)}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Automation Switches */}
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                        <Power className="h-4 w-4 text-emerald-500" />
                        Automation Switches
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {automations.map((automation) => (
                        <AutomationToggle
                          key={automation.id}
                          automation={automation}
                          onToggle={() => toggleAutomation(automation.id)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Skills Section */}
              {activeSection === "skills" && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        placeholder="Search skills..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-900/50 border-slate-800 text-slate-200 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span>{filteredSkills.filter(s => s.enabled).length} enabled</span>
                      <span className="text-slate-600">/</span>
                      <span>{filteredSkills.length} total</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredSkills.map((skill) => (
                      <SkillRow
                        key={skill.id}
                        skill={skill}
                        onToggle={() => toggleSkill(skill.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Tools Section */}
              {activeSection === "tools" && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-900/50 border-slate-800 text-slate-200 placeholder:text-slate-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span>{filteredTools.filter(t => t.enabled).length} enabled</span>
                      <span className="text-slate-600">/</span>
                      <span>{filteredTools.length} total</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredTools.map((tool) => (
                      <ToolRow
                        key={tool.id}
                        tool={tool}
                        onToggle={() => toggleTool(tool.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Rules Section */}
              {activeSection === "rules" && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-slate-200 flex items-center gap-2">
                      <ScrollText className="h-5 w-5 text-orange-500" />
                      Rules Configuration
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Define behavioral rules and constraints for the AI assistant
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <h4 className="text-sm font-medium text-slate-200 mb-2">Default Behavior Rules</h4>
                      <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Always confirm before creating proposals
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Include material costs in estimates
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Verify quantities before finalizing takeoffs
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Apply company overhead to all calculations
                        </li>
                      </ul>
                    </div>
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Rules
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Permissions Section */}
              {activeSection === "permissions" && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-slate-200 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-orange-500" />
                      Permission Levels
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Manage user access levels and capabilities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-800/50">
                          <TableHead className="text-slate-400">Level</TableHead>
                          <TableHead className="text-slate-400">Description</TableHead>
                          <TableHead className="text-slate-400">Capabilities</TableHead>
                          <TableHead className="text-slate-400 text-right">Users</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {([0, 1, 2, 3, 4] as PermissionLevel[]).map((level) => (
                          <TableRow key={level} className="border-slate-800 hover:bg-slate-800/50">
                            <TableCell>
                              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                                Level {level}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">{PERMISSION_LABELS[level]}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {level >= 0 && <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Read</Badge>}
                                {level >= 1 && <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">Write</Badge>}
                                {level >= 2 && <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">Export</Badge>}
                                {level >= 3 && <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">API</Badge>}
                                {level >= 4 && <Badge variant="outline" className="text-xs border-rose-500/30 text-rose-400">Admin</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-slate-400">
                              {level === 0 && "8"}
                              {level === 1 && "3"}
                              {level === 2 && "2"}
                              {level === 3 && "1"}
                              {level === 4 && "1"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Memory Section */}
              {activeSection === "memory" && (
                <Tabs defaultValue="user" className="space-y-4">
                  <TabsList className="bg-slate-900 border border-slate-800">
                    <TabsTrigger value="user" className="data-[state=active]:bg-slate-800">
                      <User className="h-4 w-4 mr-2" />
                      User Memory
                    </TabsTrigger>
                    <TabsTrigger value="company" className="data-[state=active]:bg-slate-800">
                      <Building2 className="h-4 w-4 mr-2" />
                      Company Memory
                    </TabsTrigger>
                    <TabsTrigger value="project" className="data-[state=active]:bg-slate-800">
                      <FolderKanban className="h-4 w-4 mr-2" />
                      Project Memory
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="user">
                    <MemoryViewer type="user" data={mockMemoryData.user} />
                  </TabsContent>
                  <TabsContent value="company">
                    <MemoryViewer type="company" data={mockMemoryData.company} />
                  </TabsContent>
                  <TabsContent value="project">
                    <MemoryViewer type="project" data={mockMemoryData.project} />
                  </TabsContent>
                </Tabs>
              )}

              {/* Logs Section */}
              {activeSection === "logs" && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                      <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                        <Clock className="h-4 w-4 mr-2" />
                        Last 24h
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-700 text-slate-300">
                      <Download className="h-4 w-4 mr-2" />
                      Export Logs
                    </Button>
                  </div>

                  <Card className="bg-slate-900/50 border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-800/50">
                          <TableHead className="text-slate-400 w-32">Time</TableHead>
                          <TableHead className="text-slate-400 w-24">Module</TableHead>
                          <TableHead className="text-slate-400">Action</TableHead>
                          <TableHead className="text-slate-400">Details</TableHead>
                          <TableHead className="text-slate-400">User</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockLogs.map((log) => (
                          <LogEntryRow key={log.id} log={log} />
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}

              {/* Settings Section */}
              {activeSection === "settings" && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-slate-200 flex items-center gap-2">
                      <Settings className="h-5 w-5 text-orange-500" />
                      System Settings
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Configure system-wide settings and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-200">General</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <span className="text-sm text-slate-300">Dark Mode</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <span className="text-sm text-slate-300">Auto-save</span>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                            <span className="text-sm text-slate-300">Notifications</span>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-200">Data Management</h4>
                        <div className="space-y-3">
                          <Button variant="outline" className="w-full justify-start border-slate-700 text-slate-300">
                            <Download className="h-4 w-4 mr-2" />
                            Export All Data
                          </Button>
                          <Button variant="outline" className="w-full justify-start border-slate-700 text-slate-300">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync with Cloud
                          </Button>
                          <Button variant="outline" className="w-full justify-start border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Cache
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-slate-800" />

                    <div className="flex items-center justify-between p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <div>
                        <h4 className="text-sm font-medium text-orange-400">Admin Actions</h4>
                        <p className="text-xs text-slate-500">Advanced operations requiring elevated permissions</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-slate-700 text-slate-300">
                          Reset to Defaults
                        </Button>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </div>

      {/* Right Panel - Quick Info */}
      <motion.aside
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="w-72 border-l border-slate-800 flex flex-col bg-slate-950 hidden xl:flex"
      >
        {/* Current User Info */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            Current User
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {(activeUser?.name || activeUser?.email || "AD")
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {activeUser?.name || "No active profile"}
                </p>
                <p className="text-xs text-slate-500">
                  {activeUser?.email || "Select a profile from the sidebar"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Permission Level */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            Permission Level
          </h3>
          <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-orange-400">Level {permissionLevel}</span>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                Admin
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              {PERMISSION_LABELS[permissionLevel]}
            </p>
          </div>
        </div>

        {/* System Health */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" />
            System Health
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/30">
              <span className="text-sm text-slate-400">API Status</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-500">Operational</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/30">
              <span className="text-sm text-slate-400">Database</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-500">Healthy</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/30">
              <span className="text-sm text-slate-400">Storage</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs text-amber-500">78% Used</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/30">
              <span className="text-sm text-slate-400">AI Models</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-500">3 Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-slate-500" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800"
              size="sm"
            >
              <Bell className="h-4 w-4 mr-2 text-amber-500" />
              View Alerts
              <Badge variant="outline" className="ml-auto border-rose-500/30 text-rose-400">2</Badge>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2 text-blue-500" />
              Sync All
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2 text-emerald-500" />
              Backup Data
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800"
              size="sm"
            >
              <FileText className="h-4 w-4 mr-2 text-purple-500" />
              View Reports
            </Button>
          </div>
        </div>

        {/* Version Info */}
        <div className="p-4 border-t border-slate-800">
          <div className="text-center">
            <p className="text-xs text-slate-500">Builder-FRG-LLC Platform</p>
            <p className="text-xs text-slate-600">Version 2.0.0 • Admin Forge</p>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

export default AdminModule;
