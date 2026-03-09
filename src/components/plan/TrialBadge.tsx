import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface TrialBadgeProps {
  collapsed?: boolean;
}

export function TrialBadge({ collapsed = false }: TrialBadgeProps) {
  const { limits } = usePlanLimits();
  const navigate = useNavigate();

  if (!limits.isTrialing || limits.trialDaysRemaining === null) return null;

  const isUrgent = limits.trialDaysRemaining <= 3;

  if (collapsed) {
    return (
      <button
        onClick={() => navigate("/dashboard/billing")}
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
          isUrgent
            ? "bg-destructive/20 text-destructive"
            : "bg-amber-500/20 text-amber-500"
        )}
      >
        <Clock className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/dashboard/billing")}
      className={cn(
        "w-full px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-start transition-colors",
        isUrgent
          ? "bg-destructive/10 border border-destructive/20 hover:bg-destructive/15"
          : "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
      )}
    >
      {isUrgent ? (
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold leading-tight",
          isUrgent ? "text-destructive" : "text-amber-600 dark:text-amber-400"
        )}>
          Trial: {limits.trialDaysRemaining} day{limits.trialDaysRemaining !== 1 ? "s" : ""} left
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
          Upgrade now
        </p>
      </div>
    </button>
  );
}

/**
 * Plan badge pill for sidebar
 */
export function PlanBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { limits } = usePlanLimits();
  const navigate = useNavigate();

  if (limits.isTrialing) return <TrialBadge collapsed={collapsed} />;

  const colorMap: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    professional: "bg-accent/10 text-accent",
    enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };

  const badgeColor = colorMap[limits.planSlug] || colorMap.free;

  if (collapsed) return null;

  return (
    <button
      onClick={() => navigate("/dashboard/billing")}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full transition-opacity hover:opacity-80",
        badgeColor
      )}
    >
      {limits.planName}
    </button>
  );
}
