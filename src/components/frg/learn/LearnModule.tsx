"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Calculator,
  Code,
  Bookmark,
  ChevronRight,
  Hammer,
  Zap,
  Droplets,
  Layers,
  Building2,
  Home,
  Clock,
  Star,
  Play,
  CheckCircle2,
  Circle,
  Search,
  Filter,
  TrendingUp,
  Award,
  Target,
  FileText,
  HelpCircle,
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ============================================
// Types
// ============================================

type Level = "beginner" | "intermediate" | "advanced";
type Category = "framing" | "electrical" | "plumbing" | "drywall" | "concrete" | "roofing";

interface Topic {
  id: string;
  title: string;
  description: string;
  category: Category;
  level: Level;
  duration: number;
  lessons: number;
  completed: boolean;
  progress: number;
  bookmarked: boolean;
}

interface UserProgress {
  totalTopics: number;
  completedTopics: number;
  totalTimeSpent: number;
  currentStreak: number;
  categoryProgress: Record<Category, number>;
}

// ============================================
// Mock Data
// ============================================

const CATEGORIES: Record<Category, { name: string; icon: React.ElementType; color: string }> = {
  framing: { name: "Framing", icon: Hammer, color: "text-amber-500" },
  electrical: { name: "Electrical", icon: Zap, color: "text-yellow-500" },
  plumbing: { name: "Plumbing", icon: Droplets, color: "text-blue-500" },
  drywall: { name: "Drywall", icon: Layers, color: "text-slate-400" },
  concrete: { name: "Concrete", icon: Building2, color: "text-gray-500" },
  roofing: { name: "Roofing", icon: Home, color: "text-orange-500" },
};

const LEVELS: Record<Level, { name: string; color: string; bgColor: string }> = {
  beginner: { name: "Beginner", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  intermediate: { name: "Intermediate", color: "text-amber-500", bgColor: "bg-amber-500/10" },
  advanced: { name: "Advanced", color: "text-rose-500", bgColor: "bg-rose-500/10" },
};

const MOCK_TOPICS: Topic[] = [
  {
    id: "1",
    title: "Wall Framing Fundamentals",
    description: "Learn the basics of framing interior and exterior walls",
    category: "framing",
    level: "beginner",
    duration: 45,
    lessons: 6,
    completed: false,
    progress: 75,
    bookmarked: true,
  },
  {
    id: "2",
    title: "Electrical Circuit Design",
    description: "Understanding residential electrical circuits and load calculations",
    category: "electrical",
    level: "intermediate",
    duration: 60,
    lessons: 8,
    completed: false,
    progress: 30,
    bookmarked: false,
  },
  {
    id: "3",
    title: "Pipe Sizing & Pressure",
    description: "Calculate proper pipe sizes for water supply systems",
    category: "plumbing",
    level: "advanced",
    duration: 90,
    lessons: 12,
    completed: true,
    progress: 100,
    bookmarked: true,
  },
  {
    id: "4",
    title: "Drywall Finishing Techniques",
    description: "Professional taping, mudding, and sanding methods",
    category: "drywall",
    level: "beginner",
    duration: 40,
    lessons: 5,
    completed: false,
    progress: 0,
    bookmarked: false,
  },
  {
    id: "5",
    title: "Concrete Mix Design",
    description: "Understanding concrete ratios and strength calculations",
    category: "concrete",
    level: "intermediate",
    duration: 55,
    lessons: 7,
    completed: false,
    progress: 50,
    bookmarked: false,
  },
  {
    id: "6",
    title: "Roof Pitch Calculations",
    description: "Calculate roof angles, materials, and drainage",
    category: "roofing",
    level: "beginner",
    duration: 35,
    lessons: 4,
    completed: false,
    progress: 10,
    bookmarked: true,
  },
];

const MOCK_USER_PROGRESS: UserProgress = {
  totalTopics: 24,
  completedTopics: 8,
  totalTimeSpent: 1240,
  currentStreak: 5,
  categoryProgress: {
    framing: 65,
    electrical: 30,
    plumbing: 45,
    drywall: 20,
    concrete: 55,
    roofing: 40,
  },
};

// ============================================
// Left Panel - Topics Browser
// ============================================

interface TopicsBrowserProps {
  topics: Topic[];
  selectedCategory: Category | "all";
  selectedLevel: Level | "all";
  onSelectCategory: (category: Category | "all") => void;
  onSelectLevel: (level: Level | "all") => void;
  onSelectTopic: (topic: Topic) => void;
  userProgress: UserProgress;
}

function TopicsBrowser({
  topics,
  selectedCategory,
  selectedLevel,
  onSelectCategory,
  onSelectLevel,
  onSelectTopic,
  userProgress,
}: TopicsBrowserProps) {
  const filteredTopics = topics.filter((topic) => {
    if (selectedCategory !== "all" && topic.category !== selectedCategory) return false;
    if (selectedLevel !== "all" && topic.level !== selectedLevel) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-white">Topics</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search topics..."
            className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus-visible:ring-amber-500/30"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-400">Categories</span>
        </div>
        <ScrollArea className="whitespace-nowrap pb-2">
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectCategory("all")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                selectedCategory === "all"
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              )}
            >
              All
            </motion.button>
            {(Object.keys(CATEGORIES) as Category[]).map((cat) => {
              const Icon = CATEGORIES[cat].icon;
              const progress = userProgress.categoryProgress[cat];
              return (
                <motion.button
                  key={cat}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectCategory(cat)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                    selectedCategory === cat
                      ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{CATEGORIES[cat].name}</span>
                  <Badge variant="outline" className="text-xs border-slate-700">
                    {progress}%
                  </Badge>
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Level Filters */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-400">Level</span>
        </div>
        <div className="flex gap-2">
          {(["all", "beginner", "intermediate", "advanced"] as const).map((level) => (
            <motion.button
              key={level}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectLevel(level)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm transition-colors capitalize",
                selectedLevel === level
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              )}
            >
              {level === "all" ? "All Levels" : LEVELS[level].name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Topics List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredTopics.map((topic, index) => {
              const CategoryIcon = CATEGORIES[topic.category].icon;
              return (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectTopic(topic)}
                  className="group relative p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:bg-slate-900 hover:border-slate-700 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        CATEGORIES[topic.category].color,
                        "bg-slate-800/50"
                      )}
                    >
                      <CategoryIcon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-white truncate">{topic.title}</h3>
                        {topic.bookmarked && <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      </div>

                      <p className="text-xs text-slate-500 truncate mb-2">{topic.description}</p>

                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", LEVELS[topic.level].color, LEVELS[topic.level].bgColor)}
                        >
                          {LEVELS[topic.level].name}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          {topic.duration}m
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <FileText className="h-3 w-3" />
                          {topic.lessons} lessons
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-amber-500 transition-colors" />
                  </div>

                  {/* Progress bar */}
                  {topic.progress > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-500">Progress</span>
                        <span className="text-xs text-amber-500">{topic.progress}%</span>
                      </div>
                      <Progress value={topic.progress} className="h-1 bg-slate-800 [&>div]:bg-amber-500" />
                    </div>
                  )}

                  {/* Completion indicator */}
                  {topic.completed && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// Main Area - Learning Content
// ============================================

interface LearningContentProps {
  selectedTopic: Topic | null;
  onStartTopic: (topic: Topic) => void;
}

function LearningContent({ selectedTopic, onStartTopic }: LearningContentProps) {
  const [activeTab, setActiveTab] = React.useState("chat");
  const [chatInput, setChatInput] = React.useState("");
  const [messages, setMessages] = React.useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isTyping, setIsTyping] = React.useState(false);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: chatInput }]);
    setChatInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'd be happy to help you understand this construction topic better. Let me explain the key concepts and provide some practical examples from real-world construction projects.",
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  // Welcome Screen
  if (!selectedTopic) {
    return (
      <div className="flex flex-col h-full bg-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-full px-6 text-center"
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mb-6">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-3">What would you like to learn?</h2>
          <p className="text-slate-400 mb-8 max-w-md">
            Explore construction topics, ask questions, use calculators, or search building codes.
          </p>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
            {[
              { icon: MessageSquare, title: "Ask a Question", desc: "Chat with FRG AI", tab: "chat" },
              { icon: Calculator, title: "Calculators", desc: "Material & cost tools", tab: "calculators" },
              { icon: Code, title: "Code Reference", desc: "Building codes lookup", tab: "codes" },
              { icon: BookOpen, title: "Study Topics", desc: "Structured lessons", tab: "topics" },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setActiveTab(item.tab)}
                  className="flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 hover:border-amber-500/30 transition-all duration-200 text-left group"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-base font-medium text-white">{item.title}</span>
                  <span className="text-sm text-slate-500">{item.desc}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // Topic Detail View with Tabs
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Topic Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={cn(LEVELS[selectedTopic.level].color, LEVELS[selectedTopic.level].bgColor)}
              >
                {LEVELS[selectedTopic.level].name}
              </Badge>
              <Badge
                variant="outline"
                className={cn(CATEGORIES[selectedTopic.category].color, "bg-slate-800")}
              >
                {CATEGORIES[selectedTopic.category].name}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{selectedTopic.title}</h2>
            <p className="text-slate-400">{selectedTopic.description}</p>
          </div>
          <Button
            onClick={() => onStartTopic(selectedTopic)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          >
            <Play className="h-4 w-4 mr-2" />
            {selectedTopic.progress > 0 ? "Continue Learning" : "Start Learning"}
          </Button>
        </div>

        {/* Progress */}
        {selectedTopic.progress > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Your Progress</span>
              <span className="text-sm text-amber-500">{selectedTopic.progress}% Complete</span>
            </div>
            <Progress value={selectedTopic.progress} className="h-2 bg-slate-800 [&>div]:bg-amber-500" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6 pt-4 border-b border-slate-800">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="chat" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500">
              <MessageSquare className="h-4 w-4 mr-2" />
              Q&A Chat
            </TabsTrigger>
            <TabsTrigger value="calculators" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500">
              <Calculator className="h-4 w-4 mr-2" />
              Calculators
            </TabsTrigger>
            <TabsTrigger value="codes" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500">
              <Code className="h-4 w-4 mr-2" />
              Codes
            </TabsTrigger>
            <TabsTrigger value="resources" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500">
              <FileText className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="h-12 w-12 text-amber-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Ask About {selectedTopic.title}</h3>
                <p className="text-slate-400 max-w-md">
                  I'm here to help you understand concepts, solve problems, and answer any questions about this topic.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback
                        className={cn(
                          msg.role === "assistant"
                            ? "bg-gradient-to-br from-amber-500 to-orange-600"
                            : "bg-slate-700"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <Bot className="h-4 w-4 text-white" />
                        ) : (
                          <User className="h-4 w-4 text-slate-300" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-amber-600 text-white rounded-tr-sm"
                          : "bg-slate-800 text-slate-100 rounded-tl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600">
                        <Bot className="h-4 w-4 text-white" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            className="h-2 w-2 rounded-full bg-amber-500"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder="Ask a question about this topic..."
                className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500/30"
              />
              <Button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isTyping}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calculators" className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "Material Calculator", desc: "Calculate quantities needed", icon: Calculator },
              { name: "Cost Estimator", desc: "Estimate project costs", icon: FileText },
              { name: "Concrete Volume", desc: "Calculate concrete needed", icon: Building2 },
              { name: "Lumber Estimator", desc: "Board feet calculator", icon: Hammer },
            ].map((calc) => {
              const Icon = calc.icon;
              return (
                <Card
                  key={calc.name}
                  className="bg-slate-800/50 border-slate-700 hover:border-amber-500/30 cursor-pointer transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{calc.name}</h3>
                        <p className="text-sm text-slate-500">{calc.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="codes" className="flex-1 p-4">
          <div className="max-w-xl mx-auto">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search building codes..."
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500/30"
              />
            </div>
            <div className="space-y-2">
              {["IRC 2021 - Wall Framing", "NEC 2020 - Electrical Circuits", "IPC 2021 - Pipe Sizing"].map(
                (code) => (
                  <Card key={code} className="bg-slate-800/50 border-slate-700 hover:border-amber-500/30 cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white">{code}</span>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "Video Tutorials", count: 12, icon: Play },
              { name: "PDF Guides", count: 8, icon: FileText },
              { name: "Practice Quizzes", count: 5, icon: HelpCircle },
              { name: "Reference Charts", count: 15, icon: FileText },
            ].map((resource) => {
              const Icon = resource.icon;
              return (
                <Card
                  key={resource.name}
                  className="bg-slate-800/50 border-slate-700 hover:border-amber-500/30 cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-amber-500" />
                      <div className="flex-1">
                        <h3 className="font-medium text-white">{resource.name}</h3>
                        <p className="text-sm text-slate-500">{resource.count} items</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Right Panel - Progress & Resources
// ============================================

interface ProgressPanelProps {
  userProgress: UserProgress;
  recentTopics: Topic[];
  bookmarkedTopics: Topic[];
  recommendedTopics: Topic[];
  onSelectTopic: (topic: Topic) => void;
}

function ProgressPanel({
  userProgress,
  recentTopics,
  bookmarkedTopics,
  recommendedTopics,
  onSelectTopic,
}: ProgressPanelProps) {
  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* User Progress Overview */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-slate-800/50">
                  <div className="text-2xl font-bold text-amber-500">
                    {userProgress.completedTopics}/{userProgress.totalTopics}
                  </div>
                  <div className="text-xs text-slate-500">Topics Completed</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-800/50">
                  <div className="text-2xl font-bold text-emerald-500">
                    {Math.floor(userProgress.totalTimeSpent / 60)}h
                  </div>
                  <div className="text-xs text-slate-500">Time Studied</div>
                </div>
              </div>

              {/* Streak */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <div>
                  <div className="text-sm font-medium text-white">{userProgress.currentStreak} Day Streak</div>
                  <div className="text-xs text-slate-400">Keep learning daily!</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Progress */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Category Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(CATEGORIES) as Category[]).map((cat) => {
                const Icon = CATEGORIES[cat].icon;
                const progress = userProgress.categoryProgress[cat];
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", CATEGORIES[cat].color)} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-300">{CATEGORIES[cat].name}</span>
                        <span className="text-xs text-amber-500">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5 bg-slate-800 [&>div]:bg-amber-500" />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recently Studied */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                Recently Studied
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentTopics.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
              ) : (
                recentTopics.map((topic) => (
                  <motion.button
                    key={topic.id}
                    whileHover={{ x: 4 }}
                    onClick={() => onSelectTopic(topic)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="p-1.5 rounded bg-slate-800">
                      {topic.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{topic.title}</div>
                      <div className="text-xs text-slate-500">{topic.progress}% complete</div>
                    </div>
                  </motion.button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Bookmarked Items */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-amber-500" />
                Bookmarked
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bookmarkedTopics.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No bookmarks yet</p>
              ) : (
                bookmarkedTopics.map((topic) => (
                  <motion.button
                    key={topic.id}
                    whileHover={{ x: 4 }}
                    onClick={() => onSelectTopic(topic)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{topic.title}</div>
                      <div className="text-xs text-slate-500">{CATEGORIES[topic.category].name}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </motion.button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recommended Next */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Recommended Next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommendedTopics.map((topic) => (
                <motion.button
                  key={topic.id}
                  whileHover={{ x: 4 }}
                  onClick={() => onSelectTopic(topic)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div
                    className={cn(
                      "p-1.5 rounded",
                      LEVELS[topic.level].bgColor,
                      LEVELS[topic.level].color
                    )}
                  >
                    {React.createElement(CATEGORIES[topic.category].icon, { className: "h-4 w-4" })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{topic.title}</div>
                    <div className="text-xs text-slate-500">
                      {topic.duration}m • {topic.lessons} lessons
                    </div>
                  </div>
                </motion.button>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// Main LearnModule Component
// ============================================

export function LearnModule() {
  const [selectedCategory, setSelectedCategory] = React.useState<Category | "all">("all");
  const [selectedLevel, setSelectedLevel] = React.useState<Level | "all">("all");
  const [selectedTopic, setSelectedTopic] = React.useState<Topic | null>(null);
  const [topics] = React.useState<Topic[]>(MOCK_TOPICS);
  const [userProgress] = React.useState<UserProgress>(MOCK_USER_PROGRESS);

  const recentTopics = topics.filter((t) => t.progress > 0 && !t.completed).slice(0, 3);
  const bookmarkedTopics = topics.filter((t) => t.bookmarked);
  const recommendedTopics = topics.filter((t) => t.progress === 0).slice(0, 3);

  const handleSelectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
  };

  const handleStartTopic = (topic: Topic) => {
    // Would navigate to the lesson content
    console.log("Starting topic:", topic.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-12 h-screen"
    >
      {/* Left Panel - Topics Browser */}
      <div className="col-span-3 min-w-[280px]">
        <TopicsBrowser
          topics={topics}
          selectedCategory={selectedCategory}
          selectedLevel={selectedLevel}
          onSelectCategory={setSelectedCategory}
          onSelectLevel={setSelectedLevel}
          onSelectTopic={handleSelectTopic}
          userProgress={userProgress}
        />
      </div>

      {/* Main Area - Learning Content */}
      <div className="col-span-6">
        <LearningContent selectedTopic={selectedTopic} onStartTopic={handleStartTopic} />
      </div>

      {/* Right Panel - Progress & Resources */}
      <div className="col-span-3 min-w-[280px]">
        <ProgressPanel
          userProgress={userProgress}
          recentTopics={recentTopics}
          bookmarkedTopics={bookmarkedTopics}
          recommendedTopics={recommendedTopics}
          onSelectTopic={handleSelectTopic}
        />
      </div>
    </motion.div>
  );
}

export default LearnModule;
