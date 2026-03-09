import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface DeactivatedPlanBannerProps {
  className?: string;
}

/**
 * Banner shown when the company's current plan has been deactivated by super admin.
 */
export function DeactivatedPlanBanner({ className }: DeactivatedPlanBannerProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 ${className || ""}`}
    >
      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          Your current plan is no longer available
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Please choose a new plan to continue using all features.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => navigate("/dashboard/billing")}
        className="bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-1.5 shrink-0"
      >
        Choose New Plan
        <ArrowRight className="w-3.5 h-3.5 rtl:scale-x-[-1]" />
      </Button>
    </motion.div>
  );
}
