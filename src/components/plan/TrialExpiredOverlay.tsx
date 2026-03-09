import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Full-page overlay shown when the free trial has expired.
 * Blocks dashboard usage until user upgrades or accepts limited access.
 */
export function TrialExpiredOverlay() {
  const { limits } = usePlanLimits();
  const navigate = useNavigate();

  if (!limits.trialExpired || limits.subscriptionStatus === "active") return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="max-w-md w-full mx-4 p-8 rounded-2xl border border-border bg-card shadow-2xl text-center"
      >
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        <h2 className="text-2xl font-bold font-display text-foreground mb-2">
          Your free trial has ended
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Your 14-day trial period is over. Choose a plan to continue using all features,
          or continue with limited read-only access.
        </p>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-2"
            onClick={() => navigate("/dashboard/billing")}
          >
            <Sparkles className="w-5 h-5" />
            Choose a Plan
            <ArrowRight className="w-4 h-4 rtl:scale-x-[-1]" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              // Allow limited access by just dismissing — data remains read-only via plan limits
              const overlay = document.getElementById("trial-expired-overlay");
              if (overlay) overlay.style.display = "none";
            }}
          >
            Continue with limited access
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground mt-6">
          Your data is safe. Upgrading will restore full access immediately.
        </p>
      </motion.div>
    </motion.div>
  );
}
