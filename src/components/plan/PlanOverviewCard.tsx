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
    <Card className="border-border overflow-hidden">
      <div className="h-1 gold-gradient" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Crown className="w-4 h-4 text-accent" />
            Current Plan
          </CardTitle>
          <Badge className="bg-accent/10 text-accent border-accent/20 font-semibold">
            {limits.planName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage bars */}
        {usageMetrics.map((metric) => {
          const Icon = metric.icon;
          const percentage = metric.max === null ? 0 : Math.min(100, (metric.current / metric.max) * 100);
          const isAtLimit = metric.max !== null && metric.current >= metric.max;
          const isNearLimit = metric.max !== null && percentage >= 80;

          return (
            <div key={metric.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" />
                  {metric.label}
                </span>
                <span className={cn(
                  "font-semibold",
                  isAtLimit ? "text-destructive" : "text-foreground"
                )}>
                  {metric.current} / {metric.max === null ? "∞" : metric.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    metric.max === null 
                      ? "bg-accent w-[15%]" 
                      : isAtLimit 
                        ? "bg-destructive" 
                        : isNearLimit 
                          ? "bg-amber-500" 
                          : "bg-accent"
                  )}
                  style={{ width: metric.max === null ? "15%" : `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Features summary */}
        {limits.features.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Included Features
            </p>
            <div className="flex flex-wrap gap-1">
              {limits.features.slice(0, 6).map((f) => (
                <span key={f} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {f}
                </span>
              ))}
              {limits.features.length > 6 && (
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  +{limits.features.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        {limits.planSlug !== "enterprise" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard/settings?tab=billing")}
            className="w-full gap-2 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            Upgrade Plan
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
