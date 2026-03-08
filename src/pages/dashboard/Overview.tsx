import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight,
  Search, Filter, Clock, CheckCircle, XCircle, AlertTriangle, Activity,
  DollarSign, Globe, BarChart3, Loader2, ChevronRight, Map, FileText,
  UserPlus, Phone, Mail, CalendarDays, Briefcase, Target, Eye,
  MessageSquare, Bell, Zap, Plus, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PlanOverviewCard } from "@/components/plan/PlanOverviewCard";

// ─── SUPER ADMIN TYPES ───
interface PlatformStats {
  totalCompanies: number; activeCompanies: number; totalUsers: number;
  totalSubscriptions: number; activeSubscriptions: number; trialSubscriptions: number;
  expiredSubscriptions: number; totalRevenueMRR: number; totalPlans: number;
}
interface CompanyRow {
  id: string; name: string; slug: string; email: string | null; is_active: boolean; created_at: string;
  subscription?: { status: string; billing_cycle: string; current_period_end: string; trial_ends_at: string | null;
    plan?: { name: string; price_monthly: number; price_yearly: number } | null; } | null;
  memberCount?: number;
}
interface AuditLogRow {
  id: string; action: string; entity_type: string; entity_id: string | null;
  user_id: string | null; created_at: string; new_data: any; old_data: any;
}

// ─── SHARED ───
function getGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function StatCard({ label, value, icon: Icon, trend, trendLabel, color, subtitle }: {
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

// ═══════════════════════════════════════════
//  COMPANY ADMIN DASHBOARD
// ═══════════════════════════════════════════
function CompanyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.profile.fullName?.split(" ")[0] || "there";
  const companyId = user?.activeMembership?.companyId;
  const companyName = user?.activeMembership?.companyName || "Your Company";

  const [loading, setLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(0);
  const [branchCount, setBranchCount] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogRow[]>([]);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    loadCompanyData();
  }, [companyId]);

  async function loadCompanyData() {
    setLoading(true);
    const [membersRes, branchesRes, subRes, logsRes] = await Promise.all([
      supabase.from("company_memberships").select("id").eq("company_id", companyId!).eq("is_active", true),
      supabase.from("company_branches").select("id").eq("company_id", companyId!).is("deleted_at", null),
      supabase.from("subscriptions").select("*, plans(name, price_monthly, price_yearly)").eq("company_id", companyId!).maybeSingle(),
      supabase.from("audit_logs").select("*").eq("company_id", companyId!).order("created_at", { ascending: false }).limit(10),
    ]);
    setTeamCount(membersRes.data?.length || 0);
    setBranchCount(branchesRes.data?.length || 0);
    setSubscription(subRes.data);
    setRecentLogs((logsRes.data || []) as AuditLogRow[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // Placeholder counts for future entities (leads, trips, bookings)
  const leadCount = 0;
  const draftTrips = 0;
  const awaitingApproval = 0;
  const confirmedBookings = 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">{getGreeting()}, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companyName} — Here's your operational overview for today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCompanyData} className="gap-1.5 text-xs">
            <Activity className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={leadCount} icon={Target} color="bg-accent/10 text-accent" subtitle="New inquiries" />
        <StatCard label="Trip Drafts" value={draftTrips} icon={Map} color="bg-primary/10 text-primary" subtitle="In progress" />
        <StatCard label="Awaiting Approval" value={awaitingApproval} icon={Clock} color="bg-orange-500/10 text-orange-600" subtitle="Client review" />
        <StatCard label="Confirmed Bookings" value={confirmedBookings} icon={CheckCircle} color="bg-emerald-500/10 text-emerald-600" subtitle="Ready to operate" />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="luxury-card p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">{teamCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Team Members</p>
          </div>
        </div>
        <div className="luxury-card p-4 flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">{branchCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Branches</p>
          </div>
        </div>
        <div className="luxury-card p-4 flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-accent shrink-0" />
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">
              {subscription?.plans?.name || "None"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Current Plan</p>
          </div>
        </div>
        <div className="luxury-card p-4 flex items-center gap-3">
          {subscription ? (
            <SubscriptionBadge status={subscription.status} />
          ) : (
            <span className="text-xs text-muted-foreground">No subscription</span>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Overview */}
        <PlanOverviewCard />

        {/* Quick Actions */}
        <div className="luxury-card p-6">
          <h3 className="font-semibold font-display text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" /> Quick Actions
          </h3>
          <div className="space-y-2">
            {[
              { label: "Create New Trip", icon: Plus, path: "/dashboard/trips", color: "text-accent" },
              { label: "Add New Client", icon: UserPlus, path: "/dashboard/clients", color: "text-primary" },
              { label: "Manage Staff", icon: Users, path: "/dashboard/staff", color: "text-primary" },
              { label: "View Invoices", icon: FileText, path: "/dashboard/invoices", color: "text-muted-foreground" },
              { label: "Company Settings", icon: Building2, path: "/dashboard/settings", color: "text-muted-foreground" },
            ].map((action) => (
              <button key={action.label} onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors group">
                <action.icon className={`w-4 h-4 ${action.color} shrink-0`} />
                <span className="flex-1 text-start">{action.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* Reminders & Follow-ups */}
        <div className="luxury-card p-6">
          <h3 className="font-semibold font-display text-foreground mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-500" /> Reminders & Follow-ups
          </h3>
          <div className="space-y-3">
            {/* Placeholder items — these will be populated when trips/leads tables exist */}
            {[
              { text: "Follow up with client on Maldives package", time: "Due today", urgent: true },
              { text: "Send itinerary for Paris group tour", time: "Due tomorrow", urgent: false },
              { text: "Confirm hotel reservations — Bali trip", time: "In 3 days", urgent: false },
            ].map((item, i) => (
              <div key={i} className={`p-3 rounded-lg border ${item.urgent ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/20"}`}>
                <p className="text-sm text-foreground font-medium">{item.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <CalendarDays className={`w-3 h-3 ${item.urgent ? "text-orange-600" : "text-muted-foreground"}`} />
                  <span className={`text-[11px] font-medium ${item.urgent ? "text-orange-600" : "text-muted-foreground"}`}>
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-center text-muted-foreground pt-1">
              Reminders will auto-populate once trips are created
            </p>
          </div>
        </div>

        {/* Sales Pipeline Preview */}
        <div className="luxury-card p-6">
          <h3 className="font-semibold font-display text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Sales Pipeline
          </h3>
          <div className="space-y-4">
            {[
              { stage: "New Leads", count: leadCount, color: "bg-accent" },
              { stage: "Proposal Sent", count: 0, color: "bg-primary" },
              { stage: "Negotiation", count: 0, color: "bg-orange-500" },
              { stage: "Won", count: confirmedBookings, color: "bg-emerald-500" },
            ].map((stage) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{stage.stage}</span>
                  <span className="font-bold text-foreground">{stage.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                    style={{ width: `${stage.count > 0 ? Math.max(8, (stage.count / Math.max(leadCount, 1)) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-center text-muted-foreground pt-1">
              Pipeline will populate with real data from trips & leads
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="luxury-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold font-display text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" /> Recent Activity
          </h3>
        </div>
        {recentLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity recorded yet for your company</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentLogs.map((log) => (
              <div key={log.id} className="px-6 py-3.5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  log.action === "create" ? "bg-emerald-500/10 text-emerald-600"
                  : log.action === "update" ? "bg-accent/10 text-accent"
                  : "bg-destructive/10 text-destructive"
                }`}>
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold capitalize">{log.action}</span>{" "}
                    <span className="text-muted-foreground">on</span>{" "}
                    <span className="font-medium">{log.entity_type}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  SUPER ADMIN DASHBOARD
// ═══════════════════════════════════════════
function SuperAdminDashboard() {
  const { user } = useAuth();
  const displayName = user?.profile.fullName?.split(" ")[0] || "there";

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");

  useEffect(() => { loadDashboard(); }, []);

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

    const uniqueUsers = new Set(allMemberships.map((m: any) => m.user_id));
    const activeSubs = allSubs.filter((s: any) => s.status === "active");
    const trialSubs = allSubs.filter((s: any) => s.status === "trialing");
    const expiredSubs = allSubs.filter((s: any) => s.status === "expired" || s.status === "canceled");
    const mrr = activeSubs.reduce((sum: number, s: any) => {
      const plan = s.plans;
      if (!plan) return sum;
      return sum + (s.billing_cycle === "yearly" ? plan.price_yearly / 12 : plan.price_monthly);
    }, 0);

    setStats({
      totalCompanies: allCompanies.length, activeCompanies: allCompanies.filter((c: any) => c.is_active).length,
      totalUsers: uniqueUsers.size, totalSubscriptions: allSubs.length,
      activeSubscriptions: activeSubs.length, trialSubscriptions: trialSubs.length,
      expiredSubscriptions: expiredSubs.length, totalRevenueMRR: mrr, totalPlans: allPlans.length,
    });

    const subMap: Record<string, any> = {};
    allSubs.forEach((s: any) => { subMap[s.company_id] = s; });
    const countMap: Record<string, number> = {};
    allMemberships.forEach((m: any) => { countMap[m.company_id] = (countMap[m.company_id] || 0) + 1; });

    setCompanies(allCompanies.map((c: any) => ({
      ...c, subscription: subMap[c.id] || null, memberCount: countMap[c.id] || 0,
    })));
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">{getGreeting()}, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform overview — real-time metrics across all companies.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard} className="gap-1.5 text-xs">
          <Activity className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Companies" value={stats!.totalCompanies} icon={Building2} color="bg-primary/10 text-primary" subtitle={`${stats!.activeCompanies} active`} />
        <StatCard label="Total Users" value={stats!.totalUsers} icon={Users} color="bg-accent/10 text-accent" />
        <StatCard label="Active Subscriptions" value={stats!.activeSubscriptions} icon={CreditCard} color="bg-emerald-500/10 text-emerald-600" subtitle={`${stats!.trialSubscriptions} trials · ${stats!.expiredSubscriptions} expired`} />
        <StatCard label="Est. MRR" value={`$${stats!.totalRevenueMRR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} icon={DollarSign} color="bg-accent/10 text-accent" />
      </div>

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

      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border p-1">
          <TabsTrigger value="companies" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">Companies ({companies.length})</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ insetInlineStart: 12 }} />
              <input type="text" placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="luxury-input w-full h-9 text-sm" style={{ paddingInlineStart: 36 }} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs"><Filter className="w-3.5 h-3.5 me-1.5 text-muted-foreground" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subFilter} onValueChange={setSubFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs"><CreditCard className="w-3.5 h-3.5 me-1.5 text-muted-foreground" /><SelectValue placeholder="Subscription" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subscriptions</SelectItem>
                <SelectItem value="subscribed">Active Sub</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="none">No Subscription</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                            <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0"><Building2 className="w-4 h-4 text-primary" /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{company.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-foreground">{company.subscription?.plan?.name || <span className="text-muted-foreground italic">None</span>}</td>
                        <td className="px-4 py-3.5">{company.subscription ? <SubscriptionBadge status={company.subscription.status} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3.5"><div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm font-medium text-foreground">{company.memberCount}</span></div></td>
                        <td className="px-4 py-3.5 text-sm text-muted-foreground">{company.subscription?.current_period_end ? format(new Date(company.subscription.current_period_end), "MMM d, yyyy") : "—"}</td>
                        <td className="px-4 py-3.5">
                          {company.is_active
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Active</span>
                            : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full"><XCircle className="w-3 h-3" /> Inactive</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border bg-muted/20">
                <p className="text-xs text-muted-foreground">Showing {filteredCompanies.length} of {companies.length} companies</p>
              </div>
            </div>
          )}
        </TabsContent>

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
                    : "bg-destructive/10 text-destructive"
                  }`}><Activity className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground"><span className="font-semibold capitalize">{log.action}</span> <span className="text-muted-foreground">on</span> <span className="font-medium">{log.entity_type}</span></p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}{log.entity_id && <span className="ms-2 font-mono">ID: {log.entity_id.slice(0, 8)}…</span>}</p>
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

// ═══════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════
export default function Overview() {
  const { user } = useAuth();
  return user?.isSuperAdmin ? <SuperAdminDashboard /> : <CompanyDashboard />;
}
