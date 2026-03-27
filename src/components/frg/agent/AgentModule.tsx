"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Calculator, 
  FileText, 
  Sparkles, 
  Clock,
  Upload,
  Image,
  Brain,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, useChatStore, useSkillsStore } from "@/store";
import { type Module } from "@/types";
import { ChatPanel } from "@/components/frg/ChatPanel";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Local interface matching store's skill structure
interface StoreSkill {
  id: string;
  name: string;
  displayName: string;
  description: string;
  module: Module;
  enabled: boolean;
}

interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  module?: Module;
  messageCount: number;
}

// Mock recent conversations
const mockConversations: ConversationItem[] = [
  {
    id: "1",
    title: "Foundation Estimate",
    preview: "Calculating concrete volume for residential foundation...",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    module: "estimate",
    messageCount: 12,
  },
  {
    id: "2",
    title: "Blueprint Analysis",
    preview: "Analyzing electrical plans for commercial building...",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    module: "estimate",
    messageCount: 8,
  },
  {
    id: "3",
    title: "Project Timeline",
    preview: "Creating schedule for renovation project...",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    module: "agent",
    messageCount: 15,
  },
];

// Quick action button component
function QuickActionButton({ 
  icon: Icon, 
  label, 
  description, 
  onClick,
  color = "amber",
}: { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  onClick?: () => void;
  color?: "amber" | "orange" | "emerald" | "rose";
}) {
  const colorClasses = {
    amber: "text-amber-500 bg-amber-500/10 group-hover:bg-amber-500/20",
    orange: "text-orange-500 bg-orange-500/10 group-hover:bg-orange-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 group-hover:bg-emerald-500/20",
    rose: "text-rose-500 bg-rose-500/10 group-hover:bg-rose-500/20",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 text-left w-full"
    >
      <div className={cn(
        "p-2.5 rounded-lg transition-colors shrink-0",
        colorClasses[color]
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors block">
          {label}
        </span>
        <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors line-clamp-2">
          {description}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-1" />
    </motion.button>
  );
}

// Conversation item component
function ConversationItemCard({ 
  conversation,
  isActive,
  onClick,
}: { 
  conversation: ConversationItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  const moduleColors: Record<Module, string> = {
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
        "w-full text-left p-3 rounded-lg transition-all duration-200",
        isActive 
          ? "bg-amber-500/10 border border-amber-500/20" 
          : "hover:bg-slate-800/50 border border-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <MessageSquare className={cn(
          "h-4 w-4 shrink-0 mt-0.5",
          conversation.module ? moduleColors[conversation.module] : "text-slate-500"
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn(
              "text-sm font-medium truncate",
              isActive ? "text-white" : "text-slate-200"
            )}>
              {conversation.title}
            </span>
            <span className="text-xs text-slate-500 shrink-0">
              {conversation.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            {conversation.preview}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-xs py-0 h-5 border-slate-700 text-slate-400">
              {conversation.messageCount} messages
            </Badge>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// Active skills display component
function ActiveSkillsPanel({ skills }: { skills: StoreSkill[] }) {
  const enabledSkills = skills.filter(s => s.enabled);
  const agentSkills = enabledSkills.filter(s => s.module === "agent");

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Active Skills
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="flex flex-wrap gap-2">
          {agentSkills.length > 0 ? (
            agentSkills.map((skill) => (
              <Badge
                key={skill.id}
                variant="outline"
                className="border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
              >
                <Sparkles className="h-3 w-3 mr-1" />
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

export function AgentModule({ className }: { className?: string }) {
  const { activeModule, setActiveConversation, activeConversation } = useAppStore();
  const { setInput } = useChatStore();
  const { skills } = useSkillsStore();
  const [selectedConversation, setSelectedConversation] = React.useState<string | null>(null);

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversation(conversationId);
    // In real app, load conversation messages
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "estimate":
        setInput("Help me create a new estimate for my project");
        break;
      case "takeoff":
        setInput("I need to perform a takeoff from my blueprints");
        break;
      case "analyze":
        setInput("Analyze this document for construction details");
        break;
      case "timeline":
        setInput("Help me create a project timeline and schedule");
        break;
    }
  };

  return (
    <div className={cn("flex h-full bg-slate-950", className)}>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ModuleHeader
          title="FRG Agent Core"
          description="Your intelligent construction assistant"
          quickActions={[
            { id: "new-chat", label: "New Chat", icon: MessageSquare, onClick: () => setSelectedConversation(null) },
            { id: "upload", label: "Upload", icon: Upload },
          ]}
        />
        
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            welcomeTitle="How can I help with your project?"
            welcomeSubtitle="I'm your FRG construction assistant. I can help with estimates, takeoffs, project management, and more."
            examplePrompts={[
              { icon: Calculator, text: "Help me create an estimate for a residential foundation" },
              { icon: FileText, text: "Analyze my blueprints and extract material quantities" },
              { icon: Sparkles, text: "Explain the bidding process step by step" },
              { icon: Clock, text: "Create a project timeline for a kitchen renovation" },
            ]}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <AnimatePresence>
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="w-80 border-l border-slate-800 flex flex-col bg-slate-950 hidden lg:flex"
        >
          {/* Quick Actions */}
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <QuickActionButton
                icon={Calculator}
                label="New Estimate"
                description="Start a new cost estimation"
                onClick={() => handleQuickAction("estimate")}
                color="orange"
              />
              <QuickActionButton
                icon={FileText}
                label="Perform Takeoff"
                description="Extract quantities from plans"
                onClick={() => handleQuickAction("takeoff")}
                color="amber"
              />
              <QuickActionButton
                icon={Image}
                label="Analyze Document"
                description="Process blueprints or PDFs"
                onClick={() => handleQuickAction("analyze")}
                color="emerald"
              />
              <QuickActionButton
                icon={Clock}
                label="Create Timeline"
                description="Build project schedule"
                onClick={() => handleQuickAction("timeline")}
                color="rose"
              />
            </div>
          </div>

          {/* Active Skills */}
          <div className="p-4 border-b border-slate-800">
            <ActiveSkillsPanel skills={skills} />
          </div>

          {/* Recent Conversations */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 pb-2">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Recent Conversations
              </h3>
            </div>
            <ScrollArea className="flex-1 px-2">
              <div className="space-y-1 pb-4">
                {mockConversations.map((conversation) => (
                  <ConversationItemCard
                    key={conversation.id}
                    conversation={conversation}
                    isActive={selectedConversation === conversation.id}
                    onClick={() => handleConversationClick(conversation.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.aside>
      </AnimatePresence>
    </div>
  );
}

export default AgentModule;
