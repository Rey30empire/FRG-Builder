"use client";

import * as React from "react";
import {
  BookOpen,
  Bookmark,
  Bot,
  Calculator,
  CheckCircle2,
  Code,
  FileText,
  GraduationCap,
  Loader2,
  Play,
  Search,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import type { LearningItem } from "@/types";
import { useAppStore } from "@/store";
import { ModuleHeader } from "@/components/frg/ModuleHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type LearnTab = "overview" | "chat" | "calculators" | "codes" | "resources";
type TypeFilter = "all" | LearningItem["type"];
type ChatMessage = { role: "user" | "assistant"; content: string };

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LearningSummaryResponse {
  items: LearningItem[];
  stats: {
    totalItems: number;
    completedItems: number;
    completionRate: number;
    totalTimeSpent: number;
    averageProgress: number;
  };
  categories: Record<string, { total: number; completed: number }>;
}

interface LearningContent {
  summary?: string;
  keyPoints?: string[];
  calculators?: Array<{ name: string; description: string }>;
  codeRefs?: Array<{ title: string; code: string; note?: string }>;
  resources?: string[];
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) throw new Error(payload.error || `Request failed with status ${response.status}`);
  return payload.data as T;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCategory(category: string) {
  return category.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function parseContent(item?: LearningItem | null): LearningContent {
  const raw = item?.content;
  if (!raw || typeof raw !== "object") return {};
  const content = raw as Record<string, unknown>;
  return {
    summary: typeof content.summary === "string" ? content.summary : undefined,
    keyPoints: Array.isArray(content.keyPoints) ? content.keyPoints.map(String) : [],
    calculators: Array.isArray(content.calculators)
      ? content.calculators.map((entry) => ({
          name: String((entry as Record<string, unknown>).name || "Calculator"),
          description: String((entry as Record<string, unknown>).description || ""),
        }))
      : [],
    codeRefs: Array.isArray(content.codeRefs)
      ? content.codeRefs.map((entry) => ({
          title: String((entry as Record<string, unknown>).title || "Reference"),
          code: String((entry as Record<string, unknown>).code || ""),
          note: typeof (entry as Record<string, unknown>).note === "string" ? String((entry as Record<string, unknown>).note) : undefined,
        }))
      : [],
    resources: Array.isArray(content.resources) ? content.resources.map(String) : [],
  };
}

export function LearnModule() {
  const { activeUser, setActiveModule } = useAppStore();
  const [data, setData] = React.useState<LearningSummaryResponse>({
    items: [],
    stats: { totalItems: 0, completedItems: 0, completionRate: 0, totalTimeSpent: 0, averageProgress: 0 },
    categories: {},
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [category, setCategory] = React.useState("all");
  const [level, setLevel] = React.useState<"all" | LearningItem["level"]>("all");
  const [type, setType] = React.useState<TypeFilter>("all");
  const [bookmarkedOnly, setBookmarkedOnly] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<LearnTab>("overview");
  const [scoreDraft, setScoreDraft] = React.useState("");
  const [chatInput, setChatInput] = React.useState("");
  const [isSendingChat, setIsSendingChat] = React.useState(false);
  const [chatByItem, setChatByItem] = React.useState<Record<string, ChatMessage[]>>({});
  const [conversationIds, setConversationIds] = React.useState<Record<string, string>>({});

  const syncData = React.useEffectEvent(async () => {
    const next = await readApi<LearningSummaryResponse>("/api/learning");
    React.startTransition(() => {
      setData(next);
      setSelectedId((current) => current || next.items[0]?.id || null);
    });
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        await syncData();
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load learning data");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeUser?.id, syncData]);

  const filteredItems = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return data.items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (level !== "all" && item.level !== level) return false;
      if (type !== "all" && item.type !== type) return false;
      if (bookmarkedOnly && !item.bookmarked) return false;
      if (!query) return true;
      const summary = parseContent(item).summary || "";
      return `${item.title} ${item.category} ${item.type} ${summary}`.toLowerCase().includes(query);
    });
  }, [bookmarkedOnly, category, data.items, deferredSearch, level, type]);

  const selectedItem = React.useMemo(() => data.items.find((item) => item.id === selectedId) || filteredItems[0] || null, [data.items, filteredItems, selectedId]);
  const content = parseContent(selectedItem);
  const categories = React.useMemo(() => ["all", ...Array.from(new Set(data.items.map((item) => item.category)))], [data.items]);
  const recommended = React.useMemo(() => data.items.filter((item) => !item.completed).sort((a, b) => a.progress - b.progress).slice(0, 4), [data.items]);
  const recent = React.useMemo(() => [...data.items].filter((item) => item.lastStudiedAt || item.progress > 0).sort((a, b) => new Date(b.lastStudiedAt || b.updatedAt).getTime() - new Date(a.lastStudiedAt || a.updatedAt).getTime()).slice(0, 4), [data.items]);
  const categoryFocus = React.useMemo(
    () =>
      Object.entries(data.categories)
        .map(([categoryName, stats]) => {
          const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
          const nextItem =
            data.items
              .filter((item) => item.category === categoryName && !item.completed)
              .sort((a, b) => a.progress - b.progress)[0] || null;

          return {
            category: categoryName,
            total: stats.total,
            completed: stats.completed,
            completionRate,
            nextItem,
          };
        })
        .sort((a, b) => a.completionRate - b.completionRate),
    [data.categories, data.items]
  );
  const contentMix = React.useMemo(
    () =>
      {
        const counts: Record<TypeFilter, number> = { all: data.items.length, lesson: 0, exercise: 0, exam: 0 };
        for (const item of data.items) {
          counts[item.type] += 1;
        }
        return counts;
      },
    [data.items]
  );

  React.useEffect(() => {
    setScoreDraft(selectedItem?.score != null ? String(selectedItem.score) : "");
  }, [selectedItem?.id, selectedItem?.score]);

  async function updateItem(patch: Partial<LearningItem>) {
    if (!selectedItem) return;
    try {
      await readApi<LearningItem>("/api/learning", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, ...patch }),
      });
      await syncData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update learning item");
    }
  }

  async function sendChat() {
    if (!selectedItem || !chatInput.trim()) return;
    const itemId = selectedItem.id;
    const message = chatInput.trim();
    setChatByItem((current) => ({ ...current, [itemId]: [...(current[itemId] || []), { role: "user", content: message }] }));
    setChatInput("");
    setIsSendingChat(true);
    try {
      const result = await readApi<{ message: { content: string }; conversationId: string }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Learning topic: ${selectedItem.title}\nCategory: ${selectedItem.category}\nQuestion: ${message}`,
          conversationId: conversationIds[itemId],
          module: "learn",
        }),
      });
      setConversationIds((current) => ({ ...current, [itemId]: result.conversationId }));
      setChatByItem((current) => ({ ...current, [itemId]: [...(current[itemId] || []), { role: "assistant", content: result.message.content }] }));
      await updateItem({ lastStudiedAt: new Date(), timeSpent: (selectedItem.timeSpent || 0) + 5 });
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to answer learning question");
    } finally {
      setIsSendingChat(false);
    }
  }

  return (
    <div className="flex h-full bg-slate-950">
      <ModuleHeader
        title="FRG Learn"
        description={`Learning workspace backed by the real API${activeUser?.name ? ` • profile: ${activeUser.name}` : ""}`}
        quickActions={[
          { id: "refresh", label: "Refresh", icon: Sparkles, onClick: () => void syncData() },
          { id: "agent", label: "Open Agent", icon: Bot, onClick: () => setActiveModule("agent"), variant: "outline" },
        ]}
        statusIndicators={[
          { id: "assets", label: "Assets", status: data.stats.totalItems ? "success" : "idle", value: data.stats.totalItems },
          { id: "done", label: "Completed", status: data.stats.completedItems ? "success" : "idle", value: data.stats.completedItems },
          { id: "avg", label: "Avg Progress", status: data.stats.averageProgress > 0 ? "pending" : "idle", value: `${Math.round(data.stats.averageProgress)}%` },
        ]}
      />

      <aside className="hidden w-80 border-r border-slate-800 bg-slate-950 xl:flex xl:flex-col">
        <div className="border-b border-slate-800 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics..." className="border-slate-800 bg-slate-900 pl-9 text-slate-200 placeholder:text-slate-500" />
          </div>
          <div className="mt-3 grid gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">{categories.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All categories" : formatCategory(value)}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select value={level} onValueChange={(value) => setLevel(value as "all" | LearningItem["level"])}>
                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200"><SelectItem value="all">All levels</SelectItem><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="intermediate">Intermediate</SelectItem><SelectItem value="advanced">Advanced</SelectItem></SelectContent>
              </Select>
              <Select value={type} onValueChange={(value) => setType(value as TypeFilter)}>
                <SelectTrigger className="border-slate-800 bg-slate-900 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200"><SelectItem value="all">All types</SelectItem><SelectItem value="lesson">Lessons</SelectItem><SelectItem value="exercise">Exercises</SelectItem><SelectItem value="exam">Exams</SelectItem></SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "justify-start border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white",
                bookmarkedOnly && "border-amber-500/40 bg-amber-500/10 text-amber-200"
              )}
              onClick={() => setBookmarkedOnly((current) => !current)}
            >
              <Bookmark className={cn("mr-2 h-4 w-4", bookmarkedOnly && "fill-amber-400 text-amber-400")} />
              {bookmarkedOnly ? "Showing bookmarks only" : "Show bookmarks only"}
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-3">
            {filteredItems.map((item) => (
              <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setTab("overview"); }} className={cn("w-full rounded-2xl border p-4 text-left transition", selectedItem?.id === item.id ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{formatCategory(item.category)} • {item.type}</p>
                  </div>
                  {item.bookmarked ? <Bookmark className="h-4 w-4 fill-amber-400 text-amber-400" /> : null}
                </div>
                <div className="mt-4"><div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span>Progress</span><span>{item.progress}%</span></div><Progress value={item.progress} className="h-2 bg-slate-900" /></div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="grid min-w-0 flex-1 xl:grid-cols-[1.2fr_0.8fr]">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 text-slate-300"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" />Loading learning workspace...</div>
        ) : error ? (
          <div className="col-span-full flex items-center justify-center px-6"><Card className="w-full max-w-xl border-rose-500/30 bg-slate-900/90"><CardHeader><CardTitle className="text-white">Learning data unavailable</CardTitle><CardDescription className="text-rose-300">{error}</CardDescription></CardHeader></Card></div>
        ) : selectedItem ? (
          <>
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-slate-800 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{formatCategory(selectedItem.category)}</Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{selectedItem.level}</Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">{selectedItem.type}</Badge>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-white">{selectedItem.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">{content.summary || "This learning item is now loaded from the real learning API."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => void updateItem({ bookmarked: !selectedItem.bookmarked })}><Bookmark className={cn("mr-1.5 h-4 w-4", selectedItem.bookmarked && "fill-amber-400 text-amber-400")} />{selectedItem.bookmarked ? "Bookmarked" : "Bookmark"}</Button>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => void updateItem({ completed: true, progress: 100, lastStudiedAt: new Date() })} disabled={selectedItem.completed}><CheckCircle2 className="mr-1.5 h-4 w-4" />Mark complete</Button>
                    <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void updateItem({ progress: Math.min(selectedItem.progress + 25, 100), completed: selectedItem.progress + 25 >= 100, timeSpent: (selectedItem.timeSpent || 0) + 15, lastStudiedAt: new Date() })}><Play className="mr-1.5 h-4 w-4" />{selectedItem.progress > 0 ? "Continue 15 min" : "Start learning"}</Button>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  {[["Progress", `${selectedItem.progress}%`], ["Time Spent", `${selectedItem.timeSpent || 0} min`], ["Score", selectedItem.score != null ? `${selectedItem.score}` : "Not scored"], ["Last Studied", formatDate(selectedItem.lastStudiedAt)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-white">{value}</p></div>)}
                </div>
              </div>

              <Tabs value={tab} onValueChange={(value) => setTab(value as LearnTab)} className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-slate-800 px-6 py-4">
                  <TabsList className="border border-slate-800 bg-slate-900/50">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800"><BookOpen className="mr-1.5 h-4 w-4" />Overview</TabsTrigger>
                    <TabsTrigger value="chat" className="data-[state=active]:bg-slate-800"><Bot className="mr-1.5 h-4 w-4" />Q&A</TabsTrigger>
                    <TabsTrigger value="calculators" className="data-[state=active]:bg-slate-800"><Calculator className="mr-1.5 h-4 w-4" />Calculators</TabsTrigger>
                    <TabsTrigger value="codes" className="data-[state=active]:bg-slate-800"><Code className="mr-1.5 h-4 w-4" />Codes</TabsTrigger>
                    <TabsTrigger value="resources" className="data-[state=active]:bg-slate-800"><FileText className="mr-1.5 h-4 w-4" />Resources</TabsTrigger>
                  </TabsList>
                </div>
                <ScrollArea className="flex-1">
                  <TabsContent value="overview" className="space-y-6 p-6">
                    <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Key Points</CardTitle><CardDescription className="text-slate-400">Use these to review the topic before moving on.</CardDescription></CardHeader><CardContent className="space-y-3">{content.keyPoints?.length ? content.keyPoints.map((point) => <div key={point} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">{point}</div>) : <p className="text-sm text-slate-500">No key points added yet.</p>}</CardContent></Card>
                    <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Progress Controls</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-[0.7fr_0.3fr]"><div className="flex flex-wrap gap-2">{[25, 50, 75, 100].map((value) => <Button key={value} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => void updateItem({ progress: value, completed: value >= 100, lastStudiedAt: new Date() })}>Set {value}%</Button>)}</div><div className="space-y-2"><Input type="number" value={scoreDraft} onChange={(event) => setScoreDraft(event.target.value)} placeholder="Score" className="border-slate-800 bg-slate-900 text-slate-200" /><Button className="w-full bg-slate-800 text-white hover:bg-slate-700" onClick={() => void updateItem({ score: scoreDraft.trim() ? Number(scoreDraft) : undefined, lastStudiedAt: new Date() })}>Save score</Button></div></CardContent></Card>
                  </TabsContent>
                  <TabsContent value="chat" className="space-y-4 p-6">
                    <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Learning Q&A</CardTitle><CardDescription className="text-slate-400">Ask the FRG agent about this topic.</CardDescription></CardHeader><CardContent className="space-y-4">
                      <div className="space-y-4">{selectedItem ? (chatByItem[selectedItem.id] || []).map((message, index) => <div key={`${message.role}-${index}`} className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}><Avatar className="h-8 w-8"><AvatarFallback className={cn(message.role === "assistant" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200")}>{message.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}</AvatarFallback></Avatar><div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm", message.role === "assistant" ? "bg-slate-900 text-slate-100" : "bg-emerald-600 text-white")}>{message.content}</div></div>) : null}{isSendingChat ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-emerald-400" />Thinking through the topic...</div> : null}</div>
                      <div className="flex gap-2"><Input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void sendChat(); } }} placeholder="Ask a study question..." className="border-slate-800 bg-slate-900 text-slate-200 placeholder:text-slate-500" /><Button onClick={() => void sendChat()} disabled={!chatInput.trim() || isSendingChat} className="bg-emerald-600 text-white hover:bg-emerald-700">{isSendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
                    </CardContent></Card>
                  </TabsContent>
                  <TabsContent value="calculators" className="space-y-4 p-6">{content.calculators?.length ? content.calculators.map((calculator) => <Card key={calculator.name} className="border-slate-800 bg-slate-950/70"><CardContent className="flex items-start gap-3 p-5"><div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400"><Calculator className="h-5 w-5" /></div><div><p className="text-sm font-medium text-white">{calculator.name}</p><p className="mt-1 text-sm text-slate-400">{calculator.description}</p></div></CardContent></Card>) : <Card className="border-dashed border-slate-800 bg-slate-950/50"><CardContent className="p-8 text-center"><Calculator className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No calculators attached yet</p></CardContent></Card>}</TabsContent>
                  <TabsContent value="codes" className="space-y-4 p-6">{content.codeRefs?.length ? content.codeRefs.map((reference) => <Card key={`${reference.title}-${reference.code}`} className="border-slate-800 bg-slate-950/70"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-white">{reference.title}</p><p className="mt-1 text-sm text-slate-400">{reference.note || "Reference note not provided."}</p></div><Badge variant="outline" className="border-slate-700 text-slate-300">{reference.code}</Badge></div></CardContent></Card>) : <Card className="border-dashed border-slate-800 bg-slate-950/50"><CardContent className="p-8 text-center"><Code className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No code references linked yet</p></CardContent></Card>}</TabsContent>
                  <TabsContent value="resources" className="space-y-4 p-6">{content.resources?.length ? content.resources.map((resource) => <Card key={resource} className="border-slate-800 bg-slate-950/70"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-slate-800 p-2.5 text-slate-200"><FileText className="h-4 w-4" /></div><p className="text-sm text-white">{resource}</p></CardContent></Card>) : <Card className="border-dashed border-slate-800 bg-slate-950/50"><CardContent className="p-8 text-center"><FileText className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No resources linked yet</p></CardContent></Card>}</TabsContent>
                </ScrollArea>
              </Tabs>
            </div>

            <aside className="hidden border-l border-slate-800 bg-slate-950 xl:flex xl:flex-col">
              <ScrollArea className="flex-1">
                <div className="space-y-6 p-6">
                  <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Learning Totals</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Completed</p><p className="mt-2 text-2xl font-semibold text-white">{data.stats.completedItems}/{data.stats.totalItems}</p></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Study Time</p><p className="mt-2 text-2xl font-semibold text-white">{Math.round(data.stats.totalTimeSpent / 60)}h</p></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Completion</p><p className="mt-2 text-2xl font-semibold text-white">{Math.round(data.stats.completionRate)}%</p></div><div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Average Progress</p><p className="mt-2 text-2xl font-semibold text-white">{Math.round(data.stats.averageProgress)}%</p></div></CardContent></Card>
                  <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Content Mix</CardTitle></CardHeader><CardContent className="space-y-3">{[
                    ["Lessons", contentMix.lesson],
                    ["Exercises", contentMix.exercise],
                    ["Exams", contentMix.exam],
                  ].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"><span className="text-sm text-slate-400">{label}</span><span className="text-sm font-medium text-white">{value}</span></div>)}</CardContent></Card>
                  <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Recently Studied</CardTitle></CardHeader><CardContent className="space-y-3">{recent.length ? recent.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-slate-700"><p className="truncate text-sm font-medium text-white">{item.title}</p><p className="mt-1 truncate text-xs text-slate-500">{formatDate(item.lastStudiedAt || item.updatedAt)} • {item.progress}%</p></button>) : <p className="text-sm text-slate-500">No recent activity yet.</p>}</CardContent></Card>
                  <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Recommended Next</CardTitle></CardHeader><CardContent className="space-y-3">{recommended.length ? recommended.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-slate-700"><p className="truncate text-sm font-medium text-white">{item.title}</p><p className="mt-1 truncate text-xs text-slate-500">{formatCategory(item.category)} • {item.type}</p></button>) : <p className="text-sm text-slate-500">No recommendations yet.</p>}</CardContent></Card>
                  <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-white">Category Gaps</CardTitle><CardDescription className="text-slate-400">Recommendations by category with the lowest completion.</CardDescription></CardHeader><CardContent className="space-y-3">{categoryFocus.length ? categoryFocus.slice(0, 4).map((entry) => <button key={entry.category} type="button" onClick={() => entry.nextItem && setSelectedId(entry.nextItem.id)} className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-700"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white">{formatCategory(entry.category)}</p><p className="mt-1 text-xs text-slate-500">{entry.completed}/{entry.total} completed • {Math.round(entry.completionRate)}%</p></div><Badge variant="outline" className="border-slate-700 text-slate-300">{entry.nextItem ? "Next item ready" : "Complete"}</Badge></div><p className="mt-3 text-sm text-slate-400">{entry.nextItem ? entry.nextItem.title : "This category is already complete."}</p></button>) : <p className="text-sm text-slate-500">No category insights yet.</p>}</CardContent></Card>
                </div>
              </ScrollArea>
            </aside>
          </>
        ) : (
          <div className="col-span-full flex items-center justify-center px-6"><Card className="w-full max-w-xl border-slate-800 bg-slate-900/90"><CardContent className="p-8 text-center"><GraduationCap className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-3 text-lg font-medium text-white">No learning items yet</p><p className="mt-1 text-sm text-slate-500">Seed the database or create learning content through the API to start using FRG Learn.</p></CardContent></Card></div>
        )}
      </div>
    </div>
  );
}

export default LearnModule;
