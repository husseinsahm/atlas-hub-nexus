import { DashboardSidebar } from "./DashboardSidebar";
import { Topbar } from "./Topbar";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function DashboardLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />
          
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-full"
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}