import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, TrendingDown, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RevenueDashboard() {
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-revenue-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*, plans(name, slug, price_monthly, price_yearly)");
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    const active = subscriptions.filter((s: any) => s.status === "active");
    const trialing = subscriptions.filter((s: any) => s.status === "trialing");
    const canceled = subscriptions.filter((s: any) => s.status === "canceled");

    const mrr = active.reduce((sum: number, s: any) => {
      if (!s.plans) return sum;
      return sum + (s.billing_cycle === "yearly" ? (s.plans as any).price_yearly / 12 : (s.plans as any).price_monthly);
    }, 0);

    const arr = mrr * 12;
    const churnRate = subscriptions.length > 0 ? (canceled.length / subscriptions.length * 100) : 0;

    // Trial conversion: trials that became active
    const allTrials = subscriptions.filter((s: any) => s.trial_starts_at);
    const convertedTrials = allTrials.filter((s: any) => s.status === "active" && s.trial_starts_at);
    const conversionRate = allTrials.length > 0 ? (convertedTrials.length / allTrials.length * 100) : 0;

    // Breakdown by plan
    const planBreakdown: Record<string, { count: number; revenue: number }> = {};
    active.forEach((s: any) => {
      const name = (s.plans as any)?.name || "Unknown";
      if (!planBreakdown[name]) planBreakdown[name] = { count: 0, revenue: 0 };
      planBreakdown[name].count++;
      planBreakdown[name].revenue += s.billing_cycle === "yearly"
        ? (s.plans as any)?.price_yearly / 12 || 0
        : (s.plans as any)?.price_monthly || 0;
    });

    // Billing cycle breakdown
    const monthly = active.filter((s: any) => s.billing_cycle === "monthly").length;
    const yearly = active.filter((s: any) => s.billing_cycle === "yearly").length;

    return { mrr: Math.round(mrr), arr: Math.round(arr), churnRate, conversionRate, planBreakdown, monthly, yearly, activeCount: active.length, trialCount: trialing.length, canceledCount: canceled.length };
  }, [subscriptions]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Revenue Dashboard</h1>
        <p className="text-sm text-muted-foreground">Financial metrics and trends</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">${metrics.mrr}</p>
            <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" /> ARR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">${metrics.arr}</p>
            <p className="text-xs text-muted-foreground">Annual Recurring Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" /> Churn Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{metrics.churnRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{metrics.canceledCount} cancelled</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" /> Trial Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{metrics.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{metrics.trialCount} active trials</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Revenue Breakdown by Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(metrics.planBreakdown).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active subscriptions yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(metrics.planBreakdown).map(([name, data]) => {
                const pct = metrics.mrr > 0 ? (data.revenue / metrics.mrr * 100) : 0;
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{data.count} subs · ${Math.round(data.revenue)}/mo</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing cycle split */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">{metrics.monthly}</p>
            <p className="text-sm text-muted-foreground mt-1">Monthly Subscribers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-foreground">{metrics.yearly}</p>
            <p className="text-sm text-muted-foreground mt-1">Annual Subscribers</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
