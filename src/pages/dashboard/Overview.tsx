import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight,
  Search, Filter, Clock, CheckCircle, XCircle, AlertTriangle, Activity,
  DollarSign, Globe, BarChart3, Loader2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";

interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  totalRevenueMRR: number;
  totalPlans: number;
}

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  subscription?: {
    status: string;
    billing_cycle: string;
    current_period_end: string;
    trial_ends_at: string | null;
    plan?: { name: string; price_monthly: number; price_yearly: number } | null;
  } | null;
  memberCount?: number;
}

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  created_at: string;
  new_data: any;
  old_data: any;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label, value, icon: Icon, trend, trendLabel, color, subtitle,
}: {
  label: string; value: string | number; icon: React.ElementType;
  trend?: number; trendLabel?: string; color: string; subtitle?: string;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className="luxury-card p-5 group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className="text-[28px] font-bold font-display text-foreground mt-1.5 leading-none">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${positive ? "text-emerald-600" : "text-destructive"}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}% {trendLabel || "from last month"}
        </div>
      )}
    </div>
  );
}

function SubscriptionBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ElementType }> = {
    active: { className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: CheckCircle },
    trialing: { className: "bg-accent/10 text-accent border-accent/20", icon: Clock },
    expired: { className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
    canceled: { className: "bg-muted text-muted-foreground border-border", icon: XCircle },
    past_due: { className: "bg-orange-500/10 text-orange-700 border-orange-500/20", icon: AlertTriangle },
  };
  const c = config[status] || config.expired;
  const IconComp = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.className}`}>
      <IconComp className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");

  const isSuperAdmin = user?.isSuperAdmin;
  const displayName = user?.profile.fullName?.split(" ")[0] || "there";

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [isSuperAdmin]);

  async function loadDashboard() {
    setLoading(true);
    const [companiesRes, subsRes, membershipsRes, plansRes, logsRes] = await Promise.all([
      supabase.from("companies").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*, plans(name, price_monthly, price_yearly)"),
      supabase.from("company_memberships").select("company_id, user_id").eq("is_active", true),
      supabase.from("plans").select("id").is("deleted_at", null),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    const allCompanies = companiesRes.data || [];
    const allSubs = subsRes.data || [];
    const allMemberships = membershipsRes.data || [];
    const allPlans = plansRes.data || [];
    const allLogs = logsRes.data || [];

    // Unique users
    const uniqueUsers = new Set(allMemberships.map((m: any) => m.user_id));

    // Sub stats
    const activeSubs = allSubs.filter((s: any) => s.status === "active");
    const trialSubs = allSubs.filter((s: any) => s.status === "trialing");
    const expiredSubs = allSubs.filter((s: any) => s.status === "expired" || s.status === "canceled");

    // MRR calc
    const mrr = activeSubs.reduce((sum: number, s: any) => {
      const plan = s.plans;
      if (!plan) return sum;
      return sum + (s.billing_cycle === "yearly" ? plan.price_yearly / 12 : plan.price_monthly);
    }, 0);

    setStats({
      totalCompanies: allCompanies.length,
      activeCompanies: allCompanies.filter((c: any) => c.is_active).length,
      totalUsers: uniqueUsers.size,
      totalSubscriptions: allSubs.length,
      activeSubscriptions: activeSubs.length,
      trialSubscriptions: trialSubs.length,
      expiredSubscriptions: expiredSubs.length,
      totalRevenueMRR: mrr,
      totalPlans: allPlans.length,
    });

    // Map subscriptions & member counts to companies
    const subMap = new Map<string, any>();
    allSubs.forEach((s: any) => subMap.set(s.company_id, s));
    const countMap = new Map<string, number>();
    allMemberships.forEach((m: any) => countMap.set(m.company_id, (countMap.get(m.company_id) || 0) + 1));

    const enriched: CompanyRow[] = allCompanies.map((c: any) => ({
      ...c,
      subscription: subMap.get(c.id) || null,
      memberCount: countMap.get(c.id) || 0,
    }));

    setCompanies(enriched);
    setAuditLogs(allLogs as AuditLogRow[]);
    setLoading(false);
  }

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? c.is_active : !c.is_active);
      const matchSub = subFilter === "all" ||
        (subFilter === "subscribed" && c.subscription?.status === "active") ||
        (subFilter === "trial" && c.subscription?.status === "trialing") ||
        (subFilter === "expired" && (c.subscription?.status === "expired" || c.subscription?.status === "canceled")) ||
        (subFilter === "none" && !c.subscription);
      return matchSearch && matchStatus && matchSub;
    });
  }, [companies, search, statusFilter, subFilter]);

  // Non-super-admin fallback
  if (!isSuperAdmin) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">{getGreeting()}, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening across your travel platform today.</p>
        </div>
        <div className="luxury-card p-12 text-center">
          <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Your company dashboard is being prepared.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
          <p className="text-sm text-muted-foreground">Loading platform data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">{getGreeting()}, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform overview — real-time metrics across all companies.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard} className="gap-1.5 text-xs">
            <Activity className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Companies"
          value={stats!.totalCompanies}
          icon={Building2}
          color="bg-primary/10 text-primary"
          subtitle={`${stats!.activeCompanies} active`}
        />
        <StatCard
          label="Total Users"
          value={stats!.totalUsers}
          icon={Users}
          color="bg-accent/10 text-accent"
        />
        <StatCard
          label="Active Subscriptions"
          value={stats!.activeSubscriptions}
          icon={CreditCard}
          color="bg-emerald-500/10 text-emerald-600"
          subtitle={`${stats!.trialSubscriptions} trials · ${stats!.expiredSubscriptions} expired`}
        />
        <StatCard
          label="Est. MRR"
          value={`$${stats!.totalRevenueMRR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          color="bg-accent/10 text-accent"
        />
      </div>

      {/* Subscription breakdown mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: stats!.activeSubscriptions, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Trial", value: stats!.trialSubscriptions, icon: Clock, color: "text-accent" },
          { label: "Expired", value: stats!.expiredSubscriptions, icon: XCircle, color: "text-destructive" },
          { label: "Plans", value: stats!.totalPlans, icon: BarChart3, color: "text-primary" },
        ].map((item) => (
          <div key={item.label} className="luxury-card p-4 flex items-center gap-3">
            <item.icon className={`w-5 h-5 ${item.color} shrink-0`} />
            <div>
              <p className="text-lg font-bold font-display text-foreground leading-none">{item.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border p-1">
          <TabsTrigger value="companies" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Recent Activity
          </TabsTrigger>
        </TabsList>

        {/* Companies tab */}
        <TabsContent value="companies" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ insetInlineStart: 12 }} />
              <input
                type="text"
                placeholder="Search companies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="luxury-input w-full h-9 text-sm"
                style={{ paddingInlineStart: 36 }}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <Filter className="w-3.5 h-3.5 me-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subFilter} onValueChange={setSubFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <CreditCard className="w-3.5 h-3.5 me-1.5 text-muted-foreground" />
                <SelectValue placeholder="Subscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subscriptions</SelectItem>
                <SelectItem value="subscribed">Active Sub</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="none">No Subscription</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Companies Table */}
          {filteredCompanies.length === 0 ? (
            <div className="luxury-card p-12 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No companies match your filters</p>
            </div>
          ) : (
            <div className="luxury-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Company", "Plan", "Subscription", "Users", "Period End", "Status"].map((h) => (
                        <th key={h} className="text-start text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{company.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-foreground">
                            {company.subscription?.plan?.name || <span className="text-muted-foreground italic">None</span>}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          {company.subscription ? (
                            <SubscriptionBadge status={company.subscription.status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm text-foreground font-medium">{company.memberCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">
                          {company.subscription?.current_period_end
                            ? format(new Date(company.subscription.current_period_end), "MMM d, yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          {company.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                              <XCircle className="w-3 h-3" /> Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {filteredCompanies.length} of {companies.length} companies
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Activity tab */}
        <TabsContent value="activity" className="space-y-3">
          {auditLogs.length === 0 ? (
            <div className="luxury-card p-12 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No recent activity recorded</p>
            </div>
          ) : (
            <div className="luxury-card divide-y divide-border">
              {auditLogs.map((log) => (
                <div key={log.id} className="px-5 py-4 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    log.action === "create" ? "bg-emerald-500/10 text-emerald-600"
                    : log.action === "update" ? "bg-accent/10 text-accent"
                    : log.action === "delete" ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold capitalize">{log.action}</span>
                      {" "}
                      <span className="text-muted-foreground">on</span>
                      {" "}
                      <span className="font-medium">{log.entity_type}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      {log.entity_id && <span className="ms-2 font-mono">ID: {log.entity_id.slice(0, 8)}…</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
