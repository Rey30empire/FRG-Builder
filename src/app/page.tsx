"use client";

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
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function BuilderFRGLLC() {
  const { activeModule, sidebarOpen } = useAppStore();

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
