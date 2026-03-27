"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Brain,
  Calculator,
  GraduationCap,
  Rocket,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Shield,
  User,
  Wrench,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, useChatStore, useProjectsStore } from "@/store";
import { MODULE_INFO, PERMISSION_LABELS, type AppUser, type Module, type PermissionLevel } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const moduleIcons: Record<Module, React.ElementType> = {
  dashboard: LayoutDashboard,
  agent: Brain,
  estimate: Calculator,
  learn: GraduationCap,
  boost: Rocket,
  admin: Settings,
};

const moduleColors: Record<Module, string> = {
  dashboard: "text-sky-500",
  agent: "text-amber-500",
  estimate: "text-orange-500",
  learn: "text-emerald-500",
  boost: "text-rose-500",
  admin: "text-slate-400",
};

const permissionColors: Record<PermissionLevel, string> = {
  0: "bg-slate-500",
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-orange-500",
  4: "bg-rose-500",
};

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const {
    activeUser,
    setActiveUser,
    availableUsers,
    setAvailableUsers,
    activeModule,
    setActiveModule,
    sidebarOpen,
    setSidebarOpen,
    permissionLevel,
    activeProject,
    setActiveProject,
    setActiveConversation,
  } = useAppStore();
  
  const { projects, setProjects } = useProjectsStore();
  const clearMessages = useChatStore((state) => state.clearMessages);

  const handleModuleClick = (module: Module) => {
    setActiveModule(module);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => undefined);

    setActiveUser(null);
    setAvailableUsers([]);
    setActiveProject(null);
    setActiveConversation(null);
    setProjects([]);
    clearMessages();
    window.location.reload();
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const userInitials = (activeUser?.name || activeUser?.email || "FR")
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 280 : 72 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "relative flex h-screen flex-col border-r border-slate-800 bg-slate-950",
        className
      )}
    >
      {/* Header with Logo */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        <AnimatePresence mode="wait">
          {sidebarOpen ? (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">FRG Builder</span>
                <span className="text-xs text-slate-400">LLC Platform</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mini-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 mx-auto"
            >
              <Building2 className="h-5 w-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Project Selector */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 py-3"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white",
                    "h-auto py-2 px-3"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="truncate text-sm">
                      {activeProject?.name || "Select Project"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-[248px] bg-slate-900 border-slate-700"
              >
                <DropdownMenuLabel className="text-slate-400">
                  Active Projects
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                {projects.length > 0 ? (
                  projects.filter(p => p.status === "active").map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => setActiveProject(project)}
                      className={cn(
                        "text-slate-200 hover:bg-slate-800 focus:bg-slate-800",
                        activeProject?.id === project.id && "bg-slate-800"
                      )}
                    >
                      <Building2 className="h-4 w-4 mr-2 text-amber-500" />
                      <span className="truncate">{project.name}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-slate-500">
                    No active projects
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Module Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1 py-2">
          {(Object.keys(MODULE_INFO) as Module[]).map((module) => {
            const Icon = moduleIcons[module];
            const info = MODULE_INFO[module];
            const isActive = activeModule === module;

            return (
              <Tooltip key={module} delayDuration={0}>
                <TooltipTrigger asChild>
                  <motion.button
                    onClick={() => handleModuleClick(module)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200",
                      "hover:bg-slate-800/50",
                      isActive 
                        ? "bg-gradient-to-r from-amber-500/10 to-transparent border-l-2 border-amber-500" 
                        : "border-l-2 border-transparent"
                    )}
                    whileHover={{ x: sidebarOpen ? 4 : 0 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon 
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        isActive ? moduleColors[module] : "text-slate-500"
                      )} 
                    />
                    <AnimatePresence>
                      {sidebarOpen && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col overflow-hidden"
                        >
                          <span className={cn(
                            "text-sm font-medium truncate",
                            isActive ? "text-white" : "text-slate-300"
                          )}>
                            {info.name.replace("FRG ", "")}
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {info.description}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </TooltipTrigger>
                {!sidebarOpen && (
                  <TooltipContent 
                    side="right" 
                    sideOffset={10}
                    className="bg-slate-800 border-slate-700 text-white"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{info.name}</span>
                      <span className="text-xs text-slate-400">{info.description}</span>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Permission Level Indicator */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 py-2"
          >
            <Separator className="bg-slate-800 mb-3" />
            <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2">
              <Shield className={cn(
                "h-4 w-4",
                permissionColors[permissionLevel].replace("bg-", "text-")
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Level {permissionLevel}
                  </span>
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    permissionColors[permissionLevel]
                  )} />
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {PERMISSION_LABELS[permissionLevel].split(" - ")[0]}
                </p>
              </div>
              <Wrench className="h-4 w-4 text-slate-600" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Menu */}
      <div className="border-t border-slate-800 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full hover:bg-slate-800 p-2 h-auto",
                !sidebarOpen && "justify-center"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={activeUser?.avatar || ""} alt={activeUser?.name || "User"} />
                <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="ml-3 flex-1 text-left overflow-hidden"
                  >
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {activeUser?.name || "No profile"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {activeUser?.email || "No active session"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align={sidebarOpen ? "end" : "center"} 
            side="right"
            sideOffset={10}
            className="w-56 bg-slate-900 border-slate-700"
          >
            <DropdownMenuLabel className="text-slate-400">
              Active Profile
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            {availableUsers.map((user: AppUser) => (
              <DropdownMenuItem
                key={user.id}
                className={cn(
                  "text-slate-200 hover:bg-slate-800 focus:bg-slate-800",
                  activeUser?.id === user.id && "bg-slate-800"
                )}
              >
                <User className="h-4 w-4 mr-2" />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{user.name || user.email}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-700 text-[10px] text-slate-400"
                  >
                    L{user.level}
                  </Badge>
                </div>
              </DropdownMenuItem>
            ))}
            {availableUsers.length > 0 && <DropdownMenuSeparator className="bg-slate-800" />}
            <DropdownMenuItem className="text-slate-200 hover:bg-slate-800 focus:bg-slate-800">
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-200 hover:bg-slate-800 focus:bg-slate-800">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={() => void handleLogout()}
              className="text-rose-300 hover:bg-slate-800 focus:bg-slate-800 focus:text-rose-300"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collapse Toggle Button */}
      <motion.button
        onClick={toggleSidebar}
        className={cn(
          "absolute top-1/2 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full",
          "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700",
          "transition-colors duration-200"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </motion.button>
    </motion.aside>
  );
}

export default AppSidebar;
