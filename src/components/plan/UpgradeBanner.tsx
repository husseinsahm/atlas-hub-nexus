import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Sparkles, Users, Building2, Map, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UpgradeBannerProps {
  type: "users" | "branches" | "trips";
  className?: string;
}

export function UpgradeBanner({ type, className }: UpgradeBannerProps) {
  const { limits } = usePlanLimits();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const configs = {
    users: {
      icon: Users,
      shouldShow: !limits.canAddUser,
      current: limits.currentUsers,
      max: limits.maxUsers,
      title: "User limit reached",
      description: `You've reached the maximum of ${limits.maxUsers} users on your ${limits.planName} plan.`,
    },
    branches: {
      icon: Building2,
      shouldShow: !limits.canAddBranch,
      current: limits.currentBranches,
      max: limits.maxBranches,
      title: "Branch limit reached",
      description: `You've reached the maximum of ${limits.maxBranches} branches on your ${limits.planName} plan.`,
    },
    trips: {
      icon: Map,
      shouldShow: !limits.canCreateTrip,
      current: limits.tripsThisMonth,
      max: limits.maxTripsPerMonth,
      title: "Monthly trip limit reached",
      description: `You've created ${limits.tripsThisMonth}/${limits.maxTripsPerMonth} trips this month on your ${limits.planName} plan.`,
    },
  };

  const config = configs[type];

  if (!config.shouldShow) return null;

  return (
    <div className={cn(
      "relative flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
      className
    )}>
      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
          {config.title}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          {config.description}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => navigate("/dashboard/settings?tab=billing")}
        className="gold-gradient text-accent-foreground gap-1.5 shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Upgrade
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Compact usage indicator for headers
 */
export function UsageIndicator({ type }: { type: "users" | "branches" | "trips" }) {
  const { limits } = usePlanLimits();

  const configs = {
    users: { current: limits.currentUsers, max: limits.maxUsers, label: "Users" },
    branches: { current: limits.currentBranches, max: limits.maxBranches, label: "Branches" },
    trips: { current: limits.tripsThisMonth, max: limits.maxTripsPerMonth, label: "Trips/mo" },
  };

  const config = configs[type];
  
  if (config.max === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {config.current} {config.label} (Unlimited)
      </span>
    );
  }

  const percentage = Math.min(100, (config.current / config.max) * 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "text-xs font-medium",
        isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-600" : "text-muted-foreground"
      )}>
        {config.current}/{config.max} {config.label}
      </span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all",
            isAtLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-accent"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
