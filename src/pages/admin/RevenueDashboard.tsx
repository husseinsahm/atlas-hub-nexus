import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, TrendingDown, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const PLAN_COLORS: Record<string, string> = {
  Free: "#9CA3AF",
  Starter: "#3B82F6",
  Professional: "#F59E0B",
  Enterprise: "#8B5CF6",
  Unknown: "#6B7280",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  trialing: "#F59E0B",
  canceled: "#EF4444",
};

export default function RevenueDashboard() {
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-revenue-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*, plans(name, slug, price_monthly, price_yearly)");
      return data || [];
    },
  });

  const { data: billingRecords = [] } = useQuery({
    queryKey: ["admin-revenue-billing"],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
      const { data } = await supabase
        .from("billing_history")
        .select("*")
        .gte("invoice_date", sixMonthsAgo)
        .order("invoice_date", { ascending: true });
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

    const monthly = active.filter((s: any) => s.billing_cycle === "monthly").length;
    const yearly = active.filter((s: any) => s.billing_cycle === "yearly").length;

    return { mrr: Math.round(mrr), arr: Math.round(arr), churnRate, conversionRate, planBreakdown, monthly, yearly, activeCount: active.length, trialCount: trialing.length, canceledCount: canceled.length };
  }, [subscriptions]);

  // MRR trend data (last 6 months from billing_history)
  const mrrTrendData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        month: format(d, "MMM"),
        start: startOfMonth(d),
        end: endOfMonth(d),
        revenue: 0,
      };
    });

    billingRecords.forEach((record: any) => {
      if (record.amount <= 0 || record.status !== "paid") return;
      const date = new Date(record.invoice_date);
      const monthEntry = months.find(m =>
        date >= m.start && date <= m.end
      );
      if (monthEntry) monthEntry.revenue += Number(record.amount);
    });

    return months.map(m => ({ name: m.month, MRR: Math.round(m.revenue) }));
  }, [billingRecords]);

  // Pie chart data
  const pieData = useMemo(() => {
    return Object.entries(metrics.planBreakdown).map(([name, data]) => ({
      name,
      value: Math.round(data.revenue),
      color: PLAN_COLORS[name] || PLAN_COLORS.Unknown,
    }));
  }, [metrics.planBreakdown]);

  // New subscriptions per month (bar chart)
  const newSubsData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        name: format(d, "MMM"),
        start: startOfMonth(d),
        end: endOfMonth(d),
        active: 0,
        trialing: 0,
        canceled: 0,
      };
    });

    subscriptions.forEach((s: any) => {
      const date = new Date(s.created_at);
      const monthEntry = months.find(m => date >= m.start && date <= m.end);
      if (monthEntry) {
        if (s.status === "active") monthEntry.active++;
        else if (s.status === "trialing") monthEntry.trialing++;
        else if (s.status === "canceled") monthEntry.canceled++;
      }
    });

    return months.map(({ start, end, ...rest }) => rest);
  }, [subscriptions]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Revenue Dashboard</h1>
        <p className="text-sm text-muted-foreground">Financial metrics and trends</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* MRR Trend Chart - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> MRR Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mrrTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [`$${value}`, "MRR"]}
                />
                <Line type="monotone" dataKey="MRR" stroke="#F59E0B" strokeWidth={2.5} dot={{ fill: "#F59E0B", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart + Bar Chart side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Plan Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Revenue by Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active subscriptions yet</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: 13,
                      }}
                      formatter={(value: number) => [`$${value}/mo`, "Revenue"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Subscriptions Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> New Subscriptions per Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={newSubsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 13,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="active" stackId="a" fill={STATUS_COLORS.active} name="Active" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="trialing" stackId="a" fill={STATUS_COLORS.trialing} name="Trialing" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="canceled" stackId="a" fill={STATUS_COLORS.canceled} name="Canceled" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown by plan (table) */}
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
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PLAN_COLORS[name] || PLAN_COLORS.Unknown }} />
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
