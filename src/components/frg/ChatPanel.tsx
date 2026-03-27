"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Paperclip, 
  Mic, 
  Bot, 
  User, 
  Sparkles,
  Lightbulb,
  FileText,
  Calculator,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore, useAppStore } from "@/store";
import { type Message } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

interface ChatPanelProps {
  className?: string;
  placeholder?: string;
  showWelcome?: boolean;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  examplePrompts?: Array<{
    icon: React.ElementType;
    text: string;
    onClick?: () => void;
  }>;
}

// Typing indicator component
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 py-3"
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-slate-800 px-4 py-3">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
          className="h-2 w-2 rounded-full bg-amber-500"
        />
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          className="h-2 w-2 rounded-full bg-amber-500"
        />
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          className="h-2 w-2 rounded-full bg-amber-500"
        />
      </div>
    </motion.div>
  );
}

// Individual message component
function ChatMessage({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "flex items-start gap-3 px-4 py-3",
        isUser && "flex-row-reverse"
      )}
    >
      <Avatar className={cn("h-8 w-8 shrink-0", isUser && "order-2")}>
        <AvatarFallback className={cn(
          isUser 
            ? "bg-slate-700 text-slate-200" 
            : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "flex flex-col gap-1.5 max-w-[80%]",
        isUser && "items-end"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-3",
          isUser 
            ? "bg-amber-600 text-white rounded-tr-sm" 
            : isSystem 
              ? "bg-slate-800/50 text-slate-400 text-sm italic"
              : "bg-slate-800 text-slate-100 rounded-tl-sm"
        )}>
          {message.content}
        </div>
        
        {/* Skill/Tool indicators */}
        {(message.skill || message.tool) && (
          <div className="flex items-center gap-1.5 px-1">
            {message.skill && (
              <Badge 
                variant="outline" 
                className="text-xs border-amber-500/30 text-amber-400 bg-amber-500/10"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {message.skill.replace("_skill", "")}
              </Badge>
            )}
            {message.tool && (
              <Badge 
                variant="outline" 
                className="text-xs border-orange-500/30 text-orange-400 bg-orange-500/10"
              >
                <FileText className="h-3 w-3 mr-1" />
                {message.tool.replace("_", " ")}
              </Badge>
            )}
          </div>
        )}
        
        <span className="text-xs text-slate-500 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </motion.div>
  );
}

// Welcome screen component
function WelcomeScreen({ 
  title, 
  subtitle, 
  examplePrompts 
}: { 
  title: string; 
  subtitle: string; 
  examplePrompts: ChatPanelProps["examplePrompts"];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full px-6 text-center"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mb-6">
        <Bot className="h-8 w-8 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 mb-8 max-w-md">{subtitle}</p>
      
      {examplePrompts && examplePrompts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
          {examplePrompts.map((prompt, index) => {
            const Icon = prompt.icon;
            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={prompt.onClick}
                className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 text-left group"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors pt-1.5">
                  {prompt.text}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export function ChatPanel({ 
  className,
  placeholder = "Type your message...",
  showWelcome = true,
  welcomeTitle = "How can I help you today?",
  welcomeSubtitle = "I'm your FRG construction assistant. Ask me about estimates, takeoffs, or project management.",
  examplePrompts = [
    { icon: Lightbulb, text: "Help me calculate materials for a foundation" },
    { icon: FileText, text: "Analyze this blueprint for takeoff" },
    { icon: Calculator, text: "Create a cost estimate for my project" },
    { icon: Sparkles, text: "Explain the estimating process step by step" },
  ],
}: ChatPanelProps) {
  const { messages, input, setInput, isTyping, addMessage, setIsTyping } = useChatStore();
  const { activeModule, activeUser, activeProject, activeConversation, setActiveConversation } = useAppStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const content = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      conversationId: activeConversation?.id || "pending",
      role: "user",
      content,
      createdAt: new Date(),
    };

    addMessage(userMessage);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          conversationId: activeConversation?.id,
          userId: activeUser?.id,
          projectId: activeProject?.id,
          module: activeModule,
        }),
      });

      const payload = await response.json();

      if (!payload?.success) {
        throw new Error(payload?.error || "Chat request failed");
      }

      if (payload.data?.conversationId) {
        setActiveConversation({
          id: payload.data.conversationId,
          userId: activeUser?.id || "default-user",
          projectId: activeProject?.id,
          module: activeModule,
          title: content.slice(0, 50),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      addMessage({
        ...payload.data.message,
        createdAt: new Date(payload.data.message.createdAt),
      });
    } catch (error) {
      const assistantErrorMessage: Message = {
        id: `${Date.now()}-error`,
        conversationId: activeConversation?.id || "pending",
        role: "assistant",
        content:
          error instanceof Error
            ? `No pude completar la consulta: ${error.message}`
            : "No pude completar la consulta. Intenta otra vez.",
        createdAt: new Date(),
      };
      addMessage(assistantErrorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const enhancedExamplePrompts = examplePrompts?.map(prompt => ({
    ...prompt,
    onClick: () => handleExampleClick(prompt.text),
  }));

  return (
    <Card className={cn(
      "flex flex-col h-full bg-slate-900 border-slate-800 rounded-none",
      className
    )}>
      {/* Messages Area */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        {showWelcome && messages.length === 0 ? (
          <WelcomeScreen 
            title={welcomeTitle}
            subtitle={welcomeSubtitle}
            examplePrompts={enhancedExamplePrompts}
          />
        ) : (
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="py-4">
              {messages.map((message, index) => (
                <ChatMessage key={message.id} message={message} index={index} />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Input Area */}
      <div className="border-t border-slate-800 p-4">
        <div className={cn(
          "flex items-end gap-2 rounded-xl bg-slate-800/50 p-2 transition-all duration-200",
          isFocused && "ring-2 ring-amber-500/30 bg-slate-800"
        )}>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="flex-1 border-0 bg-transparent text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <Mic className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              className={cn(
                "shrink-0 rounded-lg transition-all duration-200",
                input.trim() 
                  ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white" 
                  : "bg-slate-700 text-slate-500"
              )}
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <p className="text-xs text-slate-500 text-center mt-2">
          Press Enter to send • FRG AI may produce inaccurate information
        </p>
      </div>
    </Card>
  );
}

export default ChatPanel;
