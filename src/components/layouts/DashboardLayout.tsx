import { useEffect, useCallback } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { Topbar } from "./Topbar";
import { Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { TrialExpiredOverlay } from "@/components/plan/TrialExpiredOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowRightLeft, MessageSquare, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function DashboardLayout() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Real-time listener for client feedback notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("feedback-popup")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as any;
          if (!n?.type?.startsWith("client_feedback_")) return;

          const isApproval = n.type === "client_feedback_approval";
          const isChange = n.type === "client_feedback_change_request";
          const entityId = n.entity_id;

          toast({
            title: isApproval ? "✅ Client Approved!" : isChange ? "⚠️ Change Requested" : "💬 Client Comment",
            description: n.message || n.title,
            duration: 12000,
            action: entityId ? (
              <button
                onClick={() => navigate(`/dashboard/bookings/${entityId}?tab=feedback`)}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline whitespace-nowrap"
              >
                View Details <ExternalLink className="w-3 h-3" />
              </button>
            ) : undefined,
          });

          // Invalidate notifications query
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast, navigate, queryClient]);

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

        {/* Trial expired full-page overlay */}
        <TrialExpiredOverlay />
      </div>
    </SidebarProvider>
  );
}
