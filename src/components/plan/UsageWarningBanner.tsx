import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Sparkles, Users, Building2, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface WarningItem {
  type: "users" | "branches" | "trips";
  icon: typeof Users;
  label: string;
  current: number;
  max: number;
  nextPlanName: string;
  nextPlanLimit: string;
}

export function UsageWarningBanner({ className }: { className?: string }) {
  const { limits, usagePercent } = usePlanLimits();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const warnings: WarningItem[] = [];

  const nextPlan = limits.planSlug === "free" ? "Starter" :
    limits.planSlug === "starter" ? "Professional" :
    limits.planSlug === "professional" ? "Enterprise" : "";

  if (limits.maxUsers !== null && usagePercent("users") >= 80) {
    warnings.push({
      type: "users", icon: Users, label: "team members",
      current: limits.currentUsers, max: limits.maxUsers,
      nextPlanName: nextPlan,
      nextPlanLimit: limits.planSlug === "free" ? "3" : limits.planSlug === "starter" ? "10" : "unlimited",
    });
  }

  if (limits.maxBranches !== null && limits.maxBranches > 0 && usagePercent("branches") >= 80) {
    warnings.push({
      type: "branches", icon: Building2, label: "branches",
      current: limits.currentBranches, max: limits.maxBranches,
      nextPlanName: nextPlan,
      nextPlanLimit: limits.planSlug === "starter" ? "3" : "unlimited",
    });
  }

  if (limits.maxTripsPerMonth !== null && usagePercent("trips") >= 80) {
    warnings.push({
      type: "trips", icon: Map, label: "bookings this month",
      current: limits.tripsThisMonth, max: limits.maxTripsPerMonth,
      nextPlanName: nextPlan,
      nextPlanLimit: limits.planSlug === "free" ? "50" : limits.planSlug === "starter" ? "200" : "unlimited",
    });
  }

  const visibleWarnings = warnings.filter(w => !dismissed.has(w.type));
  if (visibleWarnings.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence>
        {visibleWarnings.map((w) => {
          const pct = Math.round((w.current / w.max) * 100);
          const isBlocking = pct >= 100;
          return (
            <motion.div
              key={w.type}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "relative flex items-center gap-4 p-4 rounded-xl border",
                isBlocking
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                isBlocking ? "bg-destructive/10" : "bg-amber-100 dark:bg-amber-900/50"
              )}>
                <AlertTriangle className={cn("w-5 h-5", isBlocking ? "text-destructive" : "text-amber-600")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-semibold text-sm", isBlocking ? "text-destructive" : "text-amber-900 dark:text-amber-100")}>
                  {isBlocking
                    ? `You've reached your ${w.label} limit`
                    : `You've used ${w.current} of ${w.max} ${w.label}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isBlocking
                    ? `Upgrade to ${w.nextPlanName} to continue.`
                    : `Upgrade to ${w.nextPlanName} for ${w.nextPlanLimit} ${w.label}.`}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/dashboard/billing")}
                className="bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-1.5 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" /> Upgrade
              </Button>
              <button
                onClick={() => setDismissed(prev => new Set(prev).add(w.type))}
                className={cn(
                  "absolute top-2 end-2 p-1 rounded-sm transition-colors",
                  isBlocking ? "text-destructive/60 hover:text-destructive" : "text-amber-600/60 hover:text-amber-800"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
