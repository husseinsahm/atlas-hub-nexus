import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, TrendingUp, Loader2 } from "lucide-react";

export default function AdminOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [companiesRes, membershipsRes, subsRes] = await Promise.all([
        supabase.from("companies").select("id, is_active", { count: "exact" }).is("deleted_at", null),
        supabase.from("company_memberships").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("subscriptions").select("*, plans(price_monthly, price_yearly)"),
      ]);

      const subs = subsRes.data || [];
      const active = subs.filter((s: any) => s.status === "active");
      const trialing = subs.filter((s: any) => s.status === "trialing");
      const mrr = active.reduce((sum: number, s: any) => {
        if (!s.plans) return sum;
        return sum + (s.billing_cycle === "yearly" ? (s.plans as any).price_yearly / 12 : (s.plans as any).price_monthly);
      }, 0);

      return {
        totalCompanies: companiesRes.count || 0,
        activeCompanies: companiesRes.data?.filter((c: any) => c.is_active).length || 0,
        totalUsers: membershipsRes.count || 0,
        activeSubs: active.length,
        trialSubs: trialing.length,
        mrr: Math.round(mrr),
      };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">System-wide metrics at a glance</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Companies", value: stats?.totalCompanies || 0, sub: `${stats?.activeCompanies || 0} active`, icon: Building2 },
          { label: "Users", value: stats?.totalUsers || 0, sub: "across all companies", icon: Users },
          { label: "Active Subscriptions", value: stats?.activeSubs || 0, sub: `${stats?.trialSubs || 0} trialing`, icon: CreditCard },
          { label: "MRR", value: `$${stats?.mrr || 0}`, sub: "monthly recurring revenue", icon: TrendingUp },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
