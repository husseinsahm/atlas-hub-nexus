import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Map, HardDrive, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface CompanyUsageTabProps {
  companyId: string;
  companyName: string;
  planSlug?: string;
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxTrips?: number | null;
}

export function CompanyUsageTab({ companyId, companyName, planSlug, maxUsers, maxBranches, maxTrips }: CompanyUsageTabProps) {
  // Fetch active users count
  const { data: userCount = 0, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-company-users", companyId],
    queryFn: async () => {
      const { count } = await supabase
        .from("company_memberships")
        .select("id", { count: "exact" })
        .eq("company_id", companyId)
        .eq("is_active", true);
      return count || 0;
    },
  });

  // Fetch bookings per month (last 6 months)
  const { data: bookingsData = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-company-bookings", companyId],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
      const { data } = await supabase
        .from("bookings")
        .select("id, created_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .gte("created_at", sixMonthsAgo);
      return data || [];
    },
  });

  // Fetch branches count
  const { data: branchCount = 0 } = useQuery({
    queryKey: ["admin-company-branches", companyId],
    queryFn: async () => {
      const { count } = await supabase
        .from("company_branches")
        .select("id", { count: "exact" })
        .eq("company_id", companyId)
        .is("deleted_at", null);
      return count || 0;
    },
  });

  // Fetch leads count (for churn risk)
  const { data: recentLeads = 0 } = useQuery({
    queryKey: ["admin-company-leads", companyId],
    queryFn: async () => {
      const thirtyDaysAgo = subMonths(new Date(), 1).toISOString();
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact" })
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .gte("created_at", thirtyDaysAgo);
      return count || 0;
    },
  });

  // Bookings chart data
  const bookingsChartData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        name: format(d, "MMM"),
        start: startOfMonth(d),
        end: endOfMonth(d),
        bookings: 0,
      };
    });

    bookingsData.forEach((b: any) => {
      const date = new Date(b.created_at);
      const monthEntry = months.find(m => date >= m.start && date <= m.end);
      if (monthEntry) monthEntry.bookings++;
    });

    return months.map(({ start, end, ...rest }) => rest);
  }, [bookingsData]);

  // Churn risk assessment
  const churnRisk = useMemo(() => {
    const totalBookings = bookingsData.length;
    const recentBookingsCount = bookingsData.filter((b: any) => {
      const d = new Date(b.created_at);
      return d >= subMonths(new Date(), 1);
    }).length;

    if (totalBookings === 0 && recentLeads === 0) return "high";
    if (recentBookingsCount === 0 && recentLeads <= 1) return "medium";
    return "low";
  }, [bookingsData, recentLeads]);

  // Upgrade recommendation
  const needsUpgrade = useMemo(() => {
    const reasons: string[] = [];
    if (maxUsers !== null && userCount >= (maxUsers || 0) * 0.8) {
      reasons.push(`Using ${userCount}/${maxUsers} users`);
    }
    if (maxBranches !== null && branchCount >= (maxBranches || 0) * 0.8) {
      reasons.push(`Using ${branchCount}/${maxBranches} branches`);
    }
    const thisMonthBookings = bookingsChartData[bookingsChartData.length - 1]?.bookings || 0;
    if (maxTrips !== null && thisMonthBookings >= (maxTrips || 0) * 0.8) {
      reasons.push(`${thisMonthBookings}/${maxTrips} bookings this month`);
    }
    return reasons;
  }, [userCount, branchCount, bookingsChartData, maxUsers, maxBranches, maxTrips]);

  const isLoading = usersLoading || bookingsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Risk & Recommendation Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge className={cn(
          "text-xs",
          churnRisk === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
          churnRisk === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        )}>
          <AlertTriangle className="w-3 h-3 me-1" />
          Churn Risk: {churnRisk}
        </Badge>
        {needsUpgrade.length > 0 && (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
            <TrendingUp className="w-3 h-3 me-1" />
            Upgrade Candidate
          </Badge>
        )}
      </div>

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{userCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">
              Active Users {maxUsers !== null ? `/ ${maxUsers}` : "(∞)"}
            </p>
            {maxUsers !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    userCount >= maxUsers ? "bg-destructive" : userCount >= maxUsers * 0.8 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, (userCount / maxUsers) * 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Map className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{bookingsData.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Bookings (6mo)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <HardDrive className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{branchCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">
              Branches {maxBranches !== null ? `/ ${maxBranches}` : "(∞)"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Over Time Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Bookings Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="bookings" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Recommendations */}
      {needsUpgrade.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Upgrade Recommendation
            </p>
            <ul className="space-y-1">
              {needsUpgrade.map((reason, i) => (
                <li key={i} className="text-xs text-muted-foreground">• {reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
