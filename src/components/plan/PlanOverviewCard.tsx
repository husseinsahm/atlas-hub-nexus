import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Users, Building2, Map, Crown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function PlanOverviewCard() {
  const { limits, isLoading } = usePlanLimits();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  const usageMetrics = [
    {
      icon: Users,
      label: "Team Members",
      current: limits.currentUsers,
      max: limits.maxUsers,
    },
    {
      icon: Building2,
      label: "Branches",
      current: limits.currentBranches,
      max: limits.maxBranches,
    },
    {
      icon: Map,
      label: "Trips this month",
      current: limits.tripsThisMonth,
      max: limits.maxTripsPerMonth,
    },
  ];

  return (
    <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-accent via-amber-500 to-orange-500" />
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/30 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            Current Plan
          </CardTitle>
          <Badge className="bg-gradient-to-r from-accent to-amber-500 text-white border-0 font-semibold px-3 py-1">
            {limits.planName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {/* Usage bars */}
        {usageMetrics.map((metric) => {
          const Icon = metric.icon;
          const percentage = metric.max === null ? 0 : Math.min(100, (metric.current / metric.max) * 100);
          const isAtLimit = metric.max !== null && metric.current >= metric.max;
          const isNearLimit = metric.max !== null && percentage >= 80;

          return (
            <div key={metric.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent/10 to-amber-500/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{metric.label}</span>
                </div>
                <span className={cn(
                  "text-sm font-bold font-mono",
                  isAtLimit ? "text-red-600" : isNearLimit ? "text-orange-600" : "text-foreground"
                )}>
                  {metric.current} / {metric.max === null ? "∞" : metric.max}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    metric.max === null 
                      ? "bg-gradient-to-r from-accent to-amber-500 w-[15%]" 
                      : isAtLimit 
                        ? "bg-gradient-to-r from-red-500 to-red-600" 
                        : isNearLimit 
                          ? "bg-gradient-to-r from-orange-500 to-amber-500" 
                          : "bg-gradient-to-r from-accent to-amber-500"
                  )}
                  style={{ width: metric.max === null ? "15%" : `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Features summary */}
        {limits.features.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-3">
              Included Features
            </p>
            <div className="flex flex-wrap gap-1.5">
              {limits.features.slice(0, 6).map((f) => (
                <span key={f} className="text-[10px] bg-gradient-to-r from-muted/80 to-muted px-2.5 py-1 rounded-full text-muted-foreground font-medium">
                  {f}
                </span>
              ))}
              {limits.features.length > 6 && (
                <span className="text-[10px] bg-gradient-to-r from-accent/10 to-amber-500/10 px-2.5 py-1 rounded-full text-accent font-medium">
                  +{limits.features.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        {limits.planSlug !== "enterprise" && (
          <Button
            onClick={() => navigate("/dashboard/settings?tab=billing")}
            className="w-full gap-2 text-sm bg-gradient-to-r from-accent to-amber-500 hover:from-accent/90 hover:to-amber-500/90 text-white shadow-lg shadow-accent/20"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade Plan
            <ArrowRight className="w-4 h-4 rtl:scale-x-[-1]" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
