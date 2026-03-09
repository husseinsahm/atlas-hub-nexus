import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight,
  Search, Filter, Clock, CheckCircle, XCircle, AlertTriangle, Activity,
  DollarSign, Globe, BarChart3, Loader2, ChevronRight, Map, FileText,
  UserPlus, Phone, Mail, CalendarDays, Briefcase, Target, Eye,
  MessageSquare, Bell, Zap, Plus, ArrowRight, Plane, UserCheck,
  Calendar, MapPin, AlertCircle, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow, addDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PlanOverviewCard } from "@/components/plan/PlanOverviewCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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
function getGreeting(isArabic: boolean): string {
  const h = new Date().getHours();
  if (isArabic) {
    return h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء الخير";
  }
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function StatCard({ label, value, icon: Icon, trend, trendLabel, color, subtitle, onClick }: {
  label: string; value: string | number; icon: React.ElementType;
  trend?: number; trendLabel?: string; color: string; subtitle?: string; onClick?: () => void;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className={cn("luxury-card p-5 group", onClick && "cursor-pointer hover:shadow-md transition-shadow")} onClick={onClick}>
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

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  tentative: { bg: "bg-slate-100", dot: "bg-slate-400", text: "text-slate-700" },
  confirmed: { bg: "bg-blue-50", dot: "bg-blue-500", text: "text-blue-700" },
  in_operation: { bg: "bg-amber-50", dot: "bg-amber-500", text: "text-amber-700" },
  completed: { bg: "bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-700" },
  cancelled: { bg: "bg-red-50", dot: "bg-red-500", text: "text-red-700" },
};

// ═══════════════════════════════════════════
//  COMPANY ADMIN DASHBOARD
// ═══════════════════════════════════════════
function CompanyDashboard() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const isArabic = language === "ar";
  const displayName = user?.profile.fullName?.split(" ")[0] || (isArabic ? "هناك" : "there");
  const companyId = user?.activeMembership?.companyId;
  const companyName = user?.activeMembership?.companyName || (isArabic ? "شركتك" : "Your Company");

  const [loading, setLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(0);
  const [bookingStats, setBookingStats] = useState({
    total: 0, tentative: 0, confirmed: 0, inOperation: 0, completed: 0, cancelled: 0,
    totalRevenue: 0, totalPaid: 0, totalBalance: 0, currency: "USD",
  });
  const [leadStats, setLeadStats] = useState({ total: 0, new: 0, won: 0, lost: 0 });
  const [upcomingArrivals, setUpcomingArrivals] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    loadCompanyData();
  }, [companyId]);

  async function loadCompanyData() {
    setLoading(true);
    const now = new Date();
    const nextWeek = addDays(now, 7);
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    const [membersRes, subRes, bookingsRes, leadsRes, activitiesRes] = await Promise.all([
      supabase.from("company_memberships").select("id, user_id").eq("company_id", companyId!).eq("is_active", true),
      supabase.from("subscriptions").select("*, plans(name, price_monthly, price_yearly)").eq("company_id", companyId!).maybeSingle(),
      supabase.from("bookings").select("id, booking_number, title, status, arrival_date, selling_price, amount_paid, currency, assigned_to, customer_id, customers(full_name), created_at").eq("company_id", companyId!).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("leads").select("id, status, created_at").eq("company_id", companyId!).is("deleted_at", null),
      supabase.from("booking_activities").select("id, booking_id, title, activity_type, created_at, user_id").eq("booking_id", companyId!).order("created_at", { ascending: false }).limit(10),
    ]);

    setTeamCount(membersRes.data?.length || 0);
    setSubscription(subRes.data);

    const allBookings = bookingsRes.data || [];
    const stats = {
      total: allBookings.length,
      tentative: allBookings.filter(b => b.status === "tentative").length,
      confirmed: allBookings.filter(b => b.status === "confirmed").length,
      inOperation: allBookings.filter(b => b.status === "in_operation").length,
      completed: allBookings.filter(b => b.status === "completed").length,
      cancelled: allBookings.filter(b => b.status === "cancelled").length,
      totalRevenue: allBookings.reduce((s, b) => s + Number(b.selling_price || 0), 0),
      totalPaid: allBookings.reduce((s, b) => s + Number(b.amount_paid || 0), 0),
      totalBalance: 0,
      currency: allBookings[0]?.currency || "USD",
    };
    stats.totalBalance = stats.totalRevenue - stats.totalPaid;
    setBookingStats(stats);

    // Upcoming arrivals (next 7 days)
    const arrivals = allBookings.filter(b => {
      if (!b.arrival_date || b.status === "cancelled" || b.status === "completed") return false;
      const arr = parseISO(b.arrival_date);
      return isWithinInterval(arr, { start: now, end: nextWeek });
    }).slice(0, 5);
    setUpcomingArrivals(arrivals);

    // Recent bookings
    setRecentBookings(allBookings.slice(0, 5));

    // Lead stats
    const allLeads = leadsRes.data || [];
    setLeadStats({
      total: allLeads.length,
      new: allLeads.filter(l => l.status === "new").length,
      won: allLeads.filter(l => l.status === "won").length,
      lost: allLeads.filter(l => l.status === "lost").length,
    });

    // Agent performance (bookings per agent this month)
    const monthBookings = allBookings.filter(b => {
      const d = new Date(b.created_at);
      return d >= new Date(monthStart) && d <= new Date(monthEnd);
    });
    const agentMap: Record<string, { count: number; revenue: number }> = {};
    monthBookings.forEach(b => {
      const agent = b.assigned_to || "unassigned";
      if (!agentMap[agent]) agentMap[agent] = { count: 0, revenue: 0 };
      agentMap[agent].count++;
      agentMap[agent].revenue += Number(b.selling_price || 0);
    });

    // Get agent names
    const agentIds = Object.keys(agentMap).filter(id => id !== "unassigned");
    let agentNames: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", agentIds);
      (profiles || []).forEach(p => { agentNames[p.id] = p.full_name || "Unknown"; });
    }

    const performance = Object.entries(agentMap).map(([id, data]) => ({
      id, name: id === "unassigned" ? (isArabic ? "غير معين" : "Unassigned") : (agentNames[id] || "Unknown"),
      ...data,
    })).sort((a, b) => b.count - a.count).slice(0, 5);
    setAgentPerformance(performance);

    // Recent activities from bookings
    const bookingIds = allBookings.slice(0, 10).map(b => b.id);
    if (bookingIds.length > 0) {
      const { data: acts } = await supabase.from("booking_activities").select("*").in("booking_id", bookingIds).order("created_at", { ascending: false }).limit(10);
      setRecentActivities(acts || []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">{isArabic ? "جاري التحميل..." : "Loading dashboard…"}</p>
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: isArabic ? "حجز جديد" : "New Booking", icon: Plus, path: "/dashboard/bookings", color: "text-accent" },
    { label: isArabic ? "إضافة عميل محتمل" : "Add Lead", icon: UserPlus, path: "/dashboard/clients", color: "text-primary" },
    { label: isArabic ? "المكتبة" : "Library", icon: Map, path: "/dashboard/library", color: "text-emerald-600" },
    { label: isArabic ? "فريق العمل" : "Team", icon: Users, path: "/dashboard/staff", color: "text-purple-600" },
    { label: isArabic ? "الإعدادات" : "Settings", icon: Building2, path: "/dashboard/settings", color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {getGreeting(isArabic)}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companyName} — {isArabic ? "نظرة عامة على العمليات اليومية" : "Here's your operational overview for today."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCompanyData} className="gap-1.5 text-xs">
            <Activity className="w-3.5 h-3.5" /> {isArabic ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Primary Stats - Booking Pipeline - RTL-friendly grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" dir={isArabic ? 'rtl' : 'ltr'}>
        <StatCard 
          label={isArabic ? "حجوزات مبدئية" : "Tentative"} 
          value={bookingStats.tentative} 
          icon={Clock} 
          color="bg-slate-100 text-slate-600"
          subtitle={isArabic ? "في انتظار التأكيد" : "Awaiting confirmation"}
          onClick={() => navigate("/dashboard/bookings")}
        />
        <StatCard 
          label={isArabic ? "مؤكدة" : "Confirmed"} 
          value={bookingStats.confirmed} 
          icon={CheckCircle} 
          color="bg-blue-100 text-blue-600"
          subtitle={isArabic ? "جاهزة للعمليات" : "Ready for operations"}
          onClick={() => navigate("/dashboard/bookings")}
        />
        <StatCard 
          label={isArabic ? "قيد التنفيذ" : "In Operation"} 
          value={bookingStats.inOperation} 
          icon={Plane} 
          color="bg-amber-100 text-amber-600"
          subtitle={isArabic ? "حاليًا نشطة" : "Currently active"}
          onClick={() => navigate("/dashboard/bookings")}
        />
        <StatCard 
          label={isArabic ? "مكتملة" : "Completed"} 
          value={bookingStats.completed} 
          icon={CheckCircle} 
          color="bg-emerald-100 text-emerald-600"
          subtitle={isArabic ? "هذا الشهر" : "This month"}
          onClick={() => navigate("/dashboard/bookings")}
        />
        <StatCard 
          label={isArabic ? "الإيرادات" : "Revenue"} 
          value={`${(bookingStats.totalRevenue / 1000).toFixed(0)}K`} 
          icon={DollarSign} 
          color="bg-accent/10 text-accent"
          subtitle={bookingStats.currency}
          onClick={() => navigate("/dashboard/bookings")}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold font-display text-foreground leading-none">{leadStats.total}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {isArabic ? "العملاء المحتملين" : "Total Leads"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold font-display text-foreground leading-none">{leadStats.won}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {isArabic ? "تم الفوز" : "Won Leads"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold font-display text-foreground leading-none">{teamCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {isArabic ? "فريق العمل" : "Team Members"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            {subscription ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold font-display text-foreground leading-none">
                    {subscription?.plans?.name || "None"}
                  </p>
                  <SubscriptionBadge status={subscription.status} />
                </div>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{isArabic ? "لا اشتراك" : "No subscription"}</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Arrivals */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plane className="w-4 h-4 text-accent" />
              {isArabic ? "الوصول القادم (7 أيام)" : "Upcoming Arrivals (7 days)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingArrivals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isArabic ? "لا يوجد وصول قادم" : "No upcoming arrivals"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingArrivals.map((b) => {
                  const sc = STATUS_COLORS[b.status] || STATUS_COLORS.tentative;
                  return (
                    <div 
                      key={b.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/dashboard/bookings/${b.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", sc.dot)} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(b.customers as any)?.full_name || "—"} · {b.booking_number}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {format(parseISO(b.arrival_date), "MMM d")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(parseISO(b.arrival_date), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              {isArabic ? "إجراءات سريعة" : "Quick Actions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {quickActions.map((action) => (
              <button 
                key={action.label} 
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors group"
              >
                <action.icon className={`w-4 h-4 ${action.color} shrink-0`} />
                <span className="flex-1 text-start">{action.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {isArabic ? "أداء الوكلاء" : "Agent Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isArabic ? "لا توجد بيانات" : "No data this month"}
              </p>
            ) : (
              <div className="space-y-3">
                {agentPerformance.map((agent, idx) => (
                  <div key={agent.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-foreground truncate">{agent.name}</span>
                      <span className="text-muted-foreground">{agent.count} {isArabic ? "حجز" : "bookings"}</span>
                    </div>
                    <Progress 
                      value={(agent.count / Math.max(...agentPerformance.map(a => a.count))) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              {isArabic ? "ملخص مالي" : "Financial Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{isArabic ? "إجمالي الإيرادات" : "Total Revenue"}</span>
              <span className="font-bold font-mono text-foreground">
                {bookingStats.totalRevenue.toLocaleString()} {bookingStats.currency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{isArabic ? "المدفوع" : "Collected"}</span>
              <span className="font-bold font-mono text-emerald-600">
                {bookingStats.totalPaid.toLocaleString()} {bookingStats.currency}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-medium text-foreground">{isArabic ? "الرصيد المتبقي" : "Outstanding Balance"}</span>
              <span className="font-bold font-mono text-amber-600">
                {bookingStats.totalBalance.toLocaleString()} {bookingStats.currency}
              </span>
            </div>
            <Progress 
              value={(bookingStats.totalPaid / Math.max(bookingStats.totalRevenue, 1)) * 100} 
              className="h-2"
            />
            <p className="text-[10px] text-center text-muted-foreground">
              {((bookingStats.totalPaid / Math.max(bookingStats.totalRevenue, 1)) * 100).toFixed(0)}% {isArabic ? "تم تحصيله" : "collected"}
            </p>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-accent" />
              {isArabic ? "آخر الحجوزات" : "Recent Bookings"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/bookings")} className="text-xs gap-1">
              {isArabic ? "عرض الكل" : "View all"} <ChevronRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isArabic ? "لا توجد حجوزات" : "No bookings yet"}
              </p>
            ) : (
              <div className="space-y-2">
                {recentBookings.map((b) => {
                  const sc = STATUS_COLORS[b.status] || STATUS_COLORS.tentative;
                  return (
                    <div 
                      key={b.id} 
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/dashboard/bookings/${b.id}`)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />
                        <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{b.booking_number}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Overview */}
      <PlanOverviewCard />
    </div>
  );
}

// ═══════════════════════════════════════════
//  SUPER ADMIN DASHBOARD
// ═══════════════════════════════════════════
function SuperAdminDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";
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

    // Company member counts
    const memberCountMap: Record<string, number> = {};
    allMemberships.forEach((m) => {
      memberCountMap[m.company_id] = (memberCountMap[m.company_id] || 0) + 1;
    });

    // Subscription map
    const subMap: Record<string, any> = {};
    allSubs.forEach((s) => { subMap[s.company_id] = s; });

    const enriched: CompanyRow[] = allCompanies.map((c) => ({
      ...c,
      subscription: subMap[c.id] || null,
      memberCount: memberCountMap[c.id] || 0,
    }));
    setCompanies(enriched);
    setAuditLogs(allLogs as AuditLogRow[]);

    // Stats
    const activeSubs = allSubs.filter((s) => s.status === "active");
    const trialSubs = allSubs.filter((s) => s.status === "trialing");
    const expiredSubs = allSubs.filter((s) => s.status === "expired" || s.status === "canceled");
    const mrr = activeSubs.reduce((acc, s) => {
      const plan = (s as any).plans;
      if (!plan) return acc;
      return acc + (s.billing_cycle === "yearly" ? plan.price_yearly / 12 : plan.price_monthly);
    }, 0);

    setStats({
      totalCompanies: allCompanies.length,
      activeCompanies: allCompanies.filter((c) => c.is_active).length,
      totalUsers: new Set(allMemberships.map((m) => m.user_id)).size,
      totalSubscriptions: allSubs.length,
      activeSubscriptions: activeSubs.length,
      trialSubscriptions: trialSubs.length,
      expiredSubscriptions: expiredSubs.length,
      totalRevenueMRR: mrr,
      totalPlans: allPlans.length,
    });
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = companies;
    if (statusFilter === "active") list = list.filter((c) => c.is_active);
    if (statusFilter === "inactive") list = list.filter((c) => !c.is_active);
    if (subFilter === "active") list = list.filter((c) => c.subscription?.status === "active");
    if (subFilter === "trialing") list = list.filter((c) => c.subscription?.status === "trialing");
    if (subFilter === "expired") list = list.filter((c) => !c.subscription || c.subscription.status === "expired" || c.subscription.status === "canceled");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
    }
    return list;
  }, [companies, statusFilter, subFilter, search]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
          <h1 className="text-2xl font-bold font-display text-foreground">
            {getGreeting(isArabic)}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform overview — monitor companies, subscriptions and system health.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard} className="gap-1.5 text-xs">
          <Activity className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Companies" value={stats.totalCompanies} icon={Building2} color="bg-primary/10 text-primary" subtitle={`${stats.activeCompanies} active`} />
        <StatCard label="Users" value={stats.totalUsers} icon={Users} color="bg-accent/10 text-accent" />
        <StatCard label="Subscriptions" value={stats.totalSubscriptions} icon={CreditCard} color="bg-emerald-500/10 text-emerald-600" subtitle={`${stats.activeSubscriptions} active`} />
        <StatCard label="MRR" value={`$${stats.totalRevenueMRR.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={TrendingUp} color="bg-amber-500/10 text-amber-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)} className="luxury-input w-full pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subFilter} onValueChange={setSubFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Subscription" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subscriptions</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="expired">Expired / None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Companies Table */}
      <div className="luxury-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 font-semibold text-foreground">Company</th>
                <th className="px-5 py-3 font-semibold text-foreground">Plan</th>
                <th className="px-5 py-3 font-semibold text-foreground">Status</th>
                <th className="px-5 py-3 font-semibold text-foreground">Users</th>
                <th className="px-5 py-3 font-semibold text-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 10).map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.slug}</p>
                  </td>
                  <td className="px-5 py-4">
                    {c.subscription?.plan?.name || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    {c.subscription ? <SubscriptionBadge status={c.subscription.status} /> : <span className="text-muted-foreground text-xs">No sub</span>}
                  </td>
                  <td className="px-5 py-4 text-foreground">{c.memberCount}</td>
                  <td className="px-5 py-4 text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No companies match your filters</p>
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="luxury-card">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold font-display text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" /> Recent Platform Activity
          </h3>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No activity recorded</div>
        ) : (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="px-6 py-3.5 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${log.action === "create" ? "bg-emerald-500/10 text-emerald-600" : log.action === "update" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
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
//  MAIN EXPORT
// ═══════════════════════════════════════════
export default function Overview() {
  const { user } = useAuth();
  if (user?.isSuperAdmin) return <SuperAdminDashboard />;
  return <CompanyDashboard />;
}
