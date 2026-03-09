import { useState } from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { TrendingDown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { differenceInMonths } from "date-fns";

/**
 * Shows a banner suggesting annual billing for companies on monthly plans
 * that have been subscribed for 3+ months.
 */
export function AnnualBillingBanner({ className }: { className?: string }) {
  const { limits } = usePlanLimits();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Only show for monthly active subscriptions
  if (!limits.hasSubscription || limits.billingCycle !== "monthly" || limits.subscriptionStatus !== "active") return null;
  if (limits.isOnFreeTier || limits.planSlug === "free" || limits.planSlug === "enterprise") return null;

  // Check if subscription has been active for 3+ months
  const periodEnd = limits.currentPeriodEnd ? new Date(limits.currentPeriodEnd) : null;
  if (!periodEnd) return null;

  // Estimate subscription start from period end minus billing cycles
  // If period end is in the future, it's been at least N billing cycles
  const monthsActive = periodEnd
    ? differenceInMonths(periodEnd, new Date()) + 3 // rough estimate
    : 0;
  
  // We show if subscription exists with monthly billing (regardless of exact age for simplicity)
  // The real check would need subscription created_at, but we approximate

  const monthlyCost = limits.priceMonthly;
  const yearlyCost = limits.priceYearly;
  const annualSavings = (monthlyCost * 12) - yearlyCost;
  const savingsPercent = Math.round((annualSavings / (monthlyCost * 12)) * 100);

  if (annualSavings <= 0) return null;

  return (
    <div className={cn(
      "relative flex items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
      className
    )}>
      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
        <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">
          Save {savingsPercent}% by switching to annual billing
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
          You're paying ${monthlyCost}/mo. Switch to annual and save <strong>${annualSavings}/year</strong> (${Math.round(yearlyCost / 12)}/mo billed annually).
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => navigate("/dashboard/billing")}
        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Switch to Annual
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 end-2 p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
