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
      <div className="flex h-screen w-full overflow-hidden bg-[#F9FAFB] dark:bg-background">
        <DashboardSidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />

          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-4 sm:p-5 lg:p-6">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="max-w-full space-y-6"
              >
                <Outlet />
              </motion.div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
