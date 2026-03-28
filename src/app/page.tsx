"use client";

import * as React from "react";
import { useAppStore } from "@/store";
import {
  AppSidebar,
  DashboardModule,
  AgentModule,
  EstimateModule,
  LearnModule,
  BoostModule,
  AdminModule,
} from "@/components/frg";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/types";

interface SessionEnvelope {
  success: boolean;
  data?: {
    user: AppUser | null;
  };
  error?: string;
}

export default function BuilderFRGLLC() {
  const { activeModule, sidebarOpen, setActiveUser, setAvailableUsers } = useAppStore();
  const [authState, setAuthState] = React.useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [serviceError, setServiceError] = React.useState<string | null>(null);

  const syncSession = React.useEffectEvent(async () => {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
    });

    const payload = (await response.json()) as SessionEnvelope;
    const hasServiceError = !response.ok && Boolean(payload.error);
    const nextUser = payload.success ? payload.data?.user || null : null;

    React.startTransition(() => {
      setActiveUser(nextUser);
      setAvailableUsers(nextUser ? [nextUser] : []);
      setAuthState(nextUser ? "authenticated" : "unauthenticated");
      setServiceError(hasServiceError ? payload.error || "Service configuration incomplete" : null);
    });
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        await syncSession();
      } finally {
        if (cancelled) {
          return;
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [syncSession]);

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <DashboardModule />;
      case "agent":
        return <AgentModule />;
      case "estimate":
        return <EstimateModule />;
      case "learn":
        return <LearnModule />;
      case "boost":
        return <BoostModule />;
      case "admin":
        return <AdminModule />;
      default:
        return <DashboardModule />;
    }
  };

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading session...
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <AuthScreen
        systemNotice={serviceError}
        onAuthenticated={(user) => {
          setActiveUser(user);
          setAvailableUsers([user]);
          setAuthState("authenticated");
          setServiceError(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 overflow-hidden",
          sidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-screen"
          >
            {renderModule()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
