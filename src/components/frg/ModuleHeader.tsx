"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  RefreshCw, 
  Download, 
  Upload, 
  MoreHorizontal,
  Circle,
  CircleCheck,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { MODULE_INFO, type Module } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
}

interface StatusIndicator {
  id: string;
  label: string;
  status: "success" | "warning" | "error" | "pending" | "idle";
  value?: string | number;
}

interface ModuleHeaderProps {
  className?: string;
  title?: string;
  description?: string;
  quickActions?: QuickAction[];
  statusIndicators?: StatusIndicator[];
  showProjectInfo?: boolean;
}

const statusConfig: Record<StatusIndicator["status"], { color: string; icon: React.ElementType }> = {
  success: { color: "text-emerald-500", icon: CircleCheck },
  warning: { color: "text-amber-500", icon: Clock },
  error: { color: "text-rose-500", icon: AlertCircle },
  pending: { color: "text-amber-500", icon: Clock },
  idle: { color: "text-slate-500", icon: Circle },
};

const moduleAccentColors: Record<Module, { border: string; text: string; bg: string }> = {
  dashboard: { border: "border-sky-500", text: "text-sky-500", bg: "bg-sky-500/20" },
  agent: { border: "border-amber-500", text: "text-amber-500", bg: "bg-amber-500/10" },
  estimate: { border: "border-orange-500", text: "text-orange-500", bg: "bg-orange-500/10" },
  learn: { border: "border-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10" },
  boost: { border: "border-rose-500", text: "text-rose-500", bg: "bg-rose-500/10" },
  admin: { border: "border-slate-400", text: "text-slate-400", bg: "bg-slate-400/10" },
};

const defaultActionsByModule: Record<Module, QuickAction[]> = {
  dashboard: [
    { id: "new-project", label: "New Project", icon: Plus },
    { id: "refresh", label: "Refresh", icon: RefreshCw },
  ],
  agent: [
    { id: "new-chat", label: "New Chat", icon: Plus },
    { id: "upload", label: "Upload", icon: Upload },
  ],
  estimate: [
    { id: "new-estimate", label: "New Estimate", icon: Plus },
    { id: "import", label: "Import Plans", icon: Upload },
    { id: "export", label: "Export", icon: Download },
  ],
  learn: [
    { id: "continue", label: "Continue", icon: RefreshCw },
    { id: "browse", label: "Browse Courses", icon: Plus },
  ],
  boost: [
    { id: "new-campaign", label: "New Campaign", icon: Plus },
    { id: "import-leads", label: "Import Leads", icon: Upload },
  ],
  admin: [
    { id: "refresh", label: "Refresh", icon: RefreshCw },
    { id: "export", label: "Export Data", icon: Download },
  ],
};

export function ModuleHeader({ 
  className,
  title,
  description,
  quickActions,
  statusIndicators,
  showProjectInfo = true,
}: ModuleHeaderProps) {
  const { activeModule, activeProject } = useAppStore();
  
  const moduleInfo = MODULE_INFO[activeModule];
  const accentColors = moduleAccentColors[activeModule];
  
  // Use provided values or defaults from module info
  const displayTitle = title || moduleInfo.name;
  const displayDescription = description || moduleInfo.description;
  
  // Use provided actions or defaults
  const actions = quickActions || defaultActionsByModule[activeModule];

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col border-b border-slate-800 bg-slate-950",
        className
      )}
    >
      {/* Main Header Row */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Module indicator bar */}
          <div className={cn("w-1 h-10 rounded-full", accentColors.bg)} />
          
          <div>
            <h1 className="text-xl font-bold text-white">{displayTitle}</h1>
            <p className="text-sm text-slate-400">{displayDescription}</p>
          </div>
          
          {/* Project info */}
          {showProjectInfo && activeProject && (
            <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-slate-800">
              <Badge 
                variant="outline" 
                className={cn(
                  "border-slate-700 text-slate-300",
                  "hover:bg-slate-800 transition-colors"
                )}
              >
                {activeProject.name}
              </Badge>
            </div>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Primary Actions */}
          {actions.slice(0, 3).map((action) => {
            const Icon = action.icon;
            const variant = action.variant || "outline";
            
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={variant}
                    size="sm"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      "h-8",
                      action.id.includes("new") && "bg-amber-600 hover:bg-amber-700 text-white border-0",
                      variant === "outline" && "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    {action.loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Icon className="h-4 w-4 mr-2" />
                    )}
                    <span className="hidden sm:inline">{action.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-800 border-slate-700">
                  {action.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
          
          {/* More Actions Menu */}
          {actions.length > 3 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end"
                className="bg-slate-900 border-slate-700"
              >
                {actions.slice(3).map((action) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="text-slate-200 hover:bg-slate-800 focus:bg-slate-800"
                    >
                      {action.loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4 mr-2" />
                      )}
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Status Indicators Row */}
      {statusIndicators && statusIndicators.length > 0 && (
        <div className="flex items-center gap-4 px-6 py-2 bg-slate-900/50 border-t border-slate-800/50">
          {statusIndicators.map((indicator) => {
            const config = statusConfig[indicator.status];
            const Icon = config.icon;
            
            return (
              <div
                key={indicator.id}
                className="flex items-center gap-2 text-sm"
              >
                <Icon className={cn("h-4 w-4", config.color)} />
                <span className="text-slate-400">{indicator.label}:</span>
                <span className={cn("font-medium", config.color)}>
                  {indicator.value || indicator.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.header>
  );
}

export default ModuleHeader;
