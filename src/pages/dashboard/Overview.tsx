import { useState, useEffect, useMemo, useRef, memo } from "react";
import { UsageWarningBanner } from "@/components/plan/UsageWarningBanner";
import { AnnualBillingBanner } from "@/components/plan/AnnualBillingBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight,
  Search, Filter, Clock, CheckCircle, XCircle, AlertTriangle, Activity,
  DollarSign, Globe, BarChart3, Loader2, ChevronRight, Map, FileText,
  UserPlus, Phone, Mail, CalendarDays, Briefcase, Target, Eye,
  MessageSquare, Bell, Zap, Plus, ArrowRight, Plane, UserCheck,
  Calendar, MapPin, AlertCircle, TrendingDown, Sparkles, Settings,
  PieChart, Wallet, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PlanOverviewCard } from "@/components/plan/PlanOverviewCard";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { addDays, startOfMonth, endOfMonth, format } from "date-fns";

// ─── TYPES ───
interface SuperAdminStats {
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

const useCountUp = (end: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (end === 0) { setCount(0); return; }
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));
      if (progress < 1) requestAnimationFrame(animate);
      else setCount(end);
    };
    requestAnimationFrame(animate);
    return () => { startTimeRef.current = null; };
  }, [end, duration]);
  
  return count;
};

// ─── MINI SPARKLINE SVG ───
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-50">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── STAT CARD CONFIG ───
interface StatCardConfig {
  gradient: string;
  border: string;
  iconBg: string;
  sparkColor: string;
}

const cardStyles: Record<string, StatCardConfig> = {
  tentative: {
    gradient: "bg-gradient-to-br from-[hsl(30_80%_96%)] to-[hsl(25_70%_90%)]",
    border: "border-[hsl(30_50%_85%)]",
    iconBg: "bg-[hsl(var(--warning))]",
    sparkColor: "hsl(42, 65%, 52%)",
  },
  confirmed: {
    gradient: "bg-gradient-to-br from-[hsl(180_30%_96%)] to-[hsl(180_40%_91%)]",
    border: "border-[hsl(180_30%_85%)]",
    iconBg: "bg-secondary",
    sparkColor: "hsl(180, 49%, 32%)",
  },
  inOperation: {
    gradient: "bg-gradient-to-br from-[hsl(25_20%_95%)] to-[hsl(25_20%_89%)]",
    border: "border-[hsl(25_15%_85%)]",
    iconBg: "bg-primary",
    sparkColor: "hsl(18, 46%, 53%)",
  },
  revenue: {
    gradient: "bg-gradient-to-br from-[hsl(38_50%_96%)] to-[hsl(38_45%_90%)]",
    border: "border-[hsl(38_40%_85%)]",
    iconBg: "bg-[hsl(var(--warning))]",
    sparkColor: "hsl(42, 65%, 52%)",
  },
  completed: {
    gradient: "bg-gradient-to-br from-muted/50 to-muted",
    border: "border-border",
    iconBg: "bg-muted-foreground/60",
    sparkColor: "hsl(25, 12%, 50%)",
  },
};

const sparkData: Record<string, number[]> = {
  tentative: [3, 5, 2, 7, 4, 6, 3],
  confirmed: [2, 4, 6, 5, 8, 7, 10],
  inOperation: [1, 3, 2, 5, 4, 3, 6],
  revenue: [12, 18, 15, 22, 20, 28, 25],
  completed: [5, 3, 7, 4, 6, 8, 5],
};

const VoyageStatCard = memo(({
  label, value, icon: Icon, styleKey, subtitle, trend, trendLabel, onClick, isCurrency, currency,
}: {
  label: string; value: number; icon: React.ElementType; styleKey: string;
  subtitle?: string; trend?: number; trendLabel?: string; onClick?: () => void;
  isCurrency?: boolean; currency?: string;
}) => {
  const animatedValue = useCountUp(value, 800);
  const positive = (trend ?? 0) >= 0;
  const style = cardStyles[styleKey] || cardStyles.completed;
  const displayValue = isCurrency
    ? (value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString())
    : animatedValue.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "relative overflow-hidden rounded-[14px] p-5 cursor-pointer group transition-all duration-200 border",
        style.gradient, style.border,
        "hover:shadow-card-hover hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      {/* Sparkline in bottom-right */}
      <div className="absolute bottom-2 right-3 pointer-events-none">
        <Sparkline data={sparkData[styleKey] || sparkData.completed} color={style.sparkColor} />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="section-label">{label}</p>
          <div className={cn("w-10 h-10 rounded-[10px] flex items-center justify-center shadow-sm", style.iconBg)}>
            <Icon className="w-[18px] h-[18px] text-white" />
          </div>
        </div>

        <div className="flex items-baseline gap-1.5">
          <p className="text-[28px] font-bold font-display text-foreground leading-none tracking-[-0.02em]">
            {displayValue}
          </p>
          {isCurrency && currency && (
            <span className="text-sm font-medium text-muted-foreground">{currency}</span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
        )}

        {trend !== undefined && (
          <div className={cn("flex items-center gap-1.5 mt-3 text-xs font-semibold",
            positive ? "text-[hsl(var(--success))]" : "text-destructive"
          )}>
            <div className={cn("flex items-center justify-center w-5 h-5 rounded-full",
              positive ? "bg-[hsl(var(--success)/0.12)]" : "bg-destructive/10"
            )}>
              {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            </div>
            <span>{Math.abs(trend)}%</span>
            <span className="text-muted-foreground font-normal">{trendLabel || "vs last week"}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─── QUICK ACTION CARD ───
function QuickActionCard({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType; label: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 p-4 rounded-[14px] border border-border bg-card text-start transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-sm"
    >
      <div className={cn("w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0", color)}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{label}</span>
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════
//  SUPER ADMIN DASHBOARD  
// ═════════════════════════════════════════════════════════════════

function SuperAdminDashboard() {
  const { language, t } = useLanguage();
  const isArabic = language === "ar";
  const [stats, setStats] = useState<SuperAdminStats>({
    totalCompanies: 0, activeCompanies: 0, totalUsers: 0,
    totalSubscriptions: 0, activeSubscriptions: 0, trialSubscriptions: 0,
    expiredSubscriptions: 0, totalRevenueMRR: 0, totalPlans: 0,
  });
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSuperAdminData(); }, []);

  const loadSuperAdminData = async () => {
    setLoading(true);
    try {
      const [companiesRes, subscriptionsRes, membershipsRes, auditRes] = await Promise.all([
        supabase.from("companies").select("*, subscriptions(*), company_memberships(count)")
          .is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*, plans(*)").order("created_at", { ascending: false }),
        supabase.from("company_memberships").select("company_id").eq("is_active", true),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      if (companiesRes.data) {
        const companiesWithCounts = companiesRes.data.map(company => ({
          ...company,
          memberCount: membershipsRes.data?.filter(m => m.company_id === company.id).length || 0,
        }));
        setCompanies(companiesWithCounts);
        
        const totalCompanies = companiesRes.data.length;
        const activeCompanies = companiesRes.data.filter(c => c.is_active).length;
        const totalUsers = membershipsRes.data?.length || 0;
        const totalSubscriptions = subscriptionsRes.data?.length || 0;
        const activeSubscriptions = subscriptionsRes.data?.filter(s => s.status === "active").length || 0;
        const trialSubscriptions = subscriptionsRes.data?.filter(s => s.status === "trialing").length || 0;
        const expiredSubscriptions = subscriptionsRes.data?.filter(s => ["canceled", "unpaid", "past_due"].includes(s.status)).length || 0;
        const totalRevenueMRR = subscriptionsRes.data?.reduce((sum, sub) => {
          if (!sub.plans || sub.status !== "active") return sum;
          return sum + (sub.billing_cycle === "yearly" ? sub.plans.price_yearly / 12 : sub.plans.price_monthly);
        }, 0) || 0;

        setStats({ totalCompanies, activeCompanies, totalUsers, totalSubscriptions, activeSubscriptions, trialSubscriptions, expiredSubscriptions, totalRevenueMRR, totalPlans: 3 });
      }
      if (auditRes.data) setAuditLogs(auditRes.data);
    } catch (error) {
      console.error("Error loading super admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">{isArabic ? "جاري التحميل..." : "Loading..."}</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground">{isArabic ? "لوحة الإدارة العليا" : "Super Admin Dashboard"}</h1>
        <p className="text-muted-foreground mt-1">{isArabic ? "إدارة النظام والشركات" : "System & company management"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <VoyageStatCard label={isArabic ? "الشركات" : "Companies"} value={stats.totalCompanies} icon={Building2} styleKey="confirmed" subtitle={`${stats.activeCompanies} active`} />
        <VoyageStatCard label={isArabic ? "المستخدمين" : "Users"} value={stats.totalUsers} icon={Users} styleKey="inOperation" subtitle="across all companies" />
        <VoyageStatCard label={isArabic ? "الاشتراكات" : "Subscriptions"} value={stats.activeSubscriptions} icon={CreditCard} styleKey="tentative" subtitle={`${stats.trialSubscriptions} trial`} />
        <VoyageStatCard label={isArabic ? "الإيرادات" : "MRR"} value={stats.totalRevenueMRR} icon={DollarSign} styleKey="revenue" isCurrency currency="USD" />
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "الشركات" : "Companies"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full modern-table">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-start p-4">{isArabic ? "الشركة" : "Company"}</th>
                  <th className="text-start p-4">{isArabic ? "الحالة" : "Status"}</th>
                  <th className="text-start p-4">{isArabic ? "الاشتراك" : "Subscription"}</th>
                  <th className="text-start p-4">{isArabic ? "الأعضاء" : "Members"}</th>
                  <th className="text-start p-4">{isArabic ? "تاريخ الإنشاء" : "Created"}</th>
                </tr>
              </thead>
              <tbody>
                {companies.slice(0, 10).map((company) => (
                  <tr key={company.id} className="hover:bg-[hsl(18_46%_53%/0.04)] transition-colors">
                    <td className="p-4">
                      <div className="font-medium">{company.name}</div>
                      <div className="text-sm text-muted-foreground">{company.email}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant={company.is_active ? "default" : "secondary"}>
                        {company.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {company.subscription ? (
                        <div>
                          <div className="text-sm font-medium">{company.subscription.plan?.name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground capitalize">{company.subscription.status}</div>
                        </div>
                      ) : <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="p-4">{company.memberCount}</td>
                    <td className="p-4 text-sm text-muted-foreground">{format(new Date(company.created_at), "MMM dd, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "الأنشطة الأخيرة" : "Recent Activities"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-[hsl(18_46%_53%/0.04)] transition-colors">
                <div>
                  <div className="text-sm font-medium">{log.action}</div>
                  <div className="text-xs text-muted-foreground">{log.entity_type} • {log.entity_id}</div>
                </div>
                <div className="text-xs text-muted-foreground">{format(new Date(log.created_at), "MMM dd, HH:mm")}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  COMPANY ADMIN DASHBOARD
// ═════════════════════════════════════════════════════════════════
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

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    loadCompanyData();
  }, [companyId]);

  async function loadCompanyData() {
    setLoading(true);
    const now = new Date();
    const nextWeek = addDays(now, 7);

    const [membersRes, subRes, bookingsRes, leadsRes] = await Promise.all([
      supabase.from("company_memberships").select("id, user_id").eq("company_id", companyId!).eq("is_active", true),
      supabase.from("subscriptions").select("*, plans(name, price_monthly, price_yearly)").eq("company_id", companyId!).maybeSingle(),
      supabase.from("bookings").select("id, booking_number, title, status, arrival_date, selling_price, amount_paid, currency, assigned_to, customer_id, customers(full_name), created_at").eq("company_id", companyId!).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("leads").select("id, status, created_at").eq("company_id", companyId!).is("deleted_at", null),
    ]);

    setTeamCount(membersRes.data?.length || 0);
    setSubscription(subRes.data);

    if (bookingsRes.data) {
      const bookings = bookingsRes.data;
      setRecentBookings(bookings.slice(0, 5));
      const stats = bookings.reduce((acc, booking) => {
        acc.total++;
        const price = booking.selling_price || 0;
        const paid = booking.amount_paid || 0;
        switch (booking.status) {
          case "tentative": acc.tentative++; break;
          case "confirmed": acc.confirmed++; break;
          case "in_operation": acc.inOperation++; break;
          case "completed": acc.completed++; break;
          case "cancelled": acc.cancelled++; break;
        }
        acc.totalRevenue += price;
        acc.totalPaid += paid;
        return acc;
      }, { total: 0, tentative: 0, confirmed: 0, inOperation: 0, completed: 0, cancelled: 0, totalRevenue: 0, totalPaid: 0, totalBalance: 0, currency: bookings[0]?.currency || "USD" });
      stats.totalBalance = stats.totalRevenue - stats.totalPaid;
      setBookingStats(stats);
      setUpcomingArrivals(bookings.filter(b => {
        if (!b.arrival_date) return false;
        const d = new Date(b.arrival_date);
        return d >= now && d <= nextWeek;
      }).slice(0, 5));
    }

    if (leadsRes.data) {
      const leads = leadsRes.data;
      setLeadStats(leads.reduce((acc, lead) => {
        acc.total++;
        if (lead.status === "new") acc.new++;
        else if (lead.status === "won") acc.won++;
        else if (lead.status === "lost") acc.lost++;
        return acc;
      }, { total: 0, new: 0, won: 0, lost: 0 }));
    }

    setAgentPerformance([
      { id: "1", name: "Alex Johnson", avatar: "AJ", bookings: 12, revenue: 24500, conversion: 68 },
      { id: "2", name: "Sarah Miller", avatar: "SM", bookings: 9, revenue: 18900, conversion: 72 },
      { id: "3", name: "Mike Chen", avatar: "MC", bookings: 15, revenue: 31200, conversion: 61 },
    ]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">{isArabic ? "جاري التحميل..." : "Loading..."}</span>
      </div>
    );
  }

  const statusPillClass = (status: string) => {
    switch (status) {
      case "tentative": return "bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]";
      case "confirmed": return "bg-secondary/10 text-secondary border-secondary/20";
      case "in_operation": return "bg-primary/10 text-primary border-primary/20";
      case "completed": return "bg-muted text-muted-foreground border-border";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const collectionPct = bookingStats.totalRevenue > 0 
    ? ((bookingStats.totalPaid / bookingStats.totalRevenue) * 100) 
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <UsageWarningBanner />
      <AnnualBillingBanner />

      {/* ── GREETING HEADER ── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[14px] border border-border p-6 lg:p-8"
        style={{ background: "linear-gradient(135deg, hsl(35 25% 96%) 0%, hsl(30 20% 90%) 100%)" }}
      >
        <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.08em] mb-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
        <h1 className="font-display text-[26px] font-bold text-foreground leading-tight">
          {getGreeting(isArabic)}, <span className="text-primary">{displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {companyName} • {bookingStats.tentative} {isArabic ? "حجوزات معلقة" : "pending bookings"}
        </p>
      </motion.div>

      {/* Downgrade Banner */}
      {subscription?.canceled_at && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-[14px] border border-destructive/20 bg-destructive/5 flex items-center gap-4"
        >
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{isArabic ? "سيتم تغيير اشتراكك" : "Your subscription is set to cancel"}</p>
            <p className="text-xs text-muted-foreground">{isArabic ? "سيبقى اشتراكك نشطاً حتى نهاية الفترة الحالية" : `Active until ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "end of period"}`}</p>
          </div>
          <Button size="sm" variant="outline" onClick={async () => {
            await supabase.from("subscriptions").update({ status: "active", canceled_at: null }).eq("id", subscription.id);
            loadCompanyData();
          }}>{isArabic ? "إعادة التفعيل" : "Reactivate"}</Button>
        </motion.div>
      )}

      {/* ── STAT CARDS ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">{isArabic ? "خط إنجاز الحجوزات" : "Booking Pipeline"}</h2>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/bookings")}>
            <Eye className="w-4 h-4 me-1" /> {isArabic ? "عرض الكل" : "View All"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          <VoyageStatCard label={isArabic ? "مؤقتة" : "Tentative"} value={bookingStats.tentative} icon={Clock} styleKey="tentative"
            subtitle={isArabic ? "تحتاج تأكيد" : "Awaiting confirmation"} trend={5} onClick={() => navigate("/dashboard/bookings")} />
          <VoyageStatCard label={isArabic ? "مؤكدة" : "Confirmed"} value={bookingStats.confirmed} icon={CheckCircle} styleKey="confirmed"
            subtitle={isArabic ? "جاهزة للعمليات" : "Ready for operations"} trend={12} onClick={() => navigate("/dashboard/bookings")} />
          <VoyageStatCard label={isArabic ? "قيد التنفيذ" : "In Operation"} value={bookingStats.inOperation} icon={Plane} styleKey="inOperation"
            subtitle={isArabic ? "حاليًا نشطة" : "Currently active"} trend={-3} onClick={() => navigate("/dashboard/bookings")} />
          <VoyageStatCard label={isArabic ? "مكتملة" : "Completed"} value={bookingStats.completed} icon={CheckCircle} styleKey="completed"
            subtitle={isArabic ? "هذا الشهر" : "This month"} trend={8} onClick={() => navigate("/dashboard/bookings")} />
          <VoyageStatCard label={isArabic ? "الإيرادات" : "Revenue"} value={bookingStats.totalRevenue} icon={DollarSign} styleKey="revenue"
            isCurrency currency={bookingStats.currency} trend={15} trendLabel="vs last month" onClick={() => navigate("/dashboard/bookings")} />
        </div>
      </motion.div>

      {/* ── SECONDARY STATS BAR ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center gap-3 p-4 rounded-[14px] bg-card border border-border shadow-card"
      >
        {[
          { icon: Target, value: leadStats.total, label: isArabic ? "العملاء المحتملين" : "Total Leads", bg: "bg-primary" },
          { icon: UserCheck, value: leadStats.won, label: isArabic ? "فوز العملاء" : "Won Leads", bg: "bg-secondary" },
          { icon: Users, value: teamCount, label: isArabic ? "الفريق" : "Team Members", bg: "bg-muted-foreground/60" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2 rounded-[10px] bg-muted/40">
            <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center", item.bg)}>
              <item.icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold font-display text-foreground leading-none tracking-[-0.02em]">{item.value}</p>
              <p className="section-label mt-0.5">{item.label}</p>
            </div>
            {i < 2 && <div className="w-px h-10 bg-border hidden sm:block ms-4" />}
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-8">
          {/* ── QUICK ACTIONS 2×2 ── */}
          <div>
            <h3 className="section-label mb-3">{isArabic ? "إجراءات سريعة" : "Quick Actions"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <QuickActionCard icon={Plus} label={isArabic ? "حجز جديد" : "New Booking"} color="bg-primary text-primary-foreground" onClick={() => navigate("/dashboard/bookings?action=new")} />
              <QuickActionCard icon={UserPlus} label={isArabic ? "إضافة عميل" : "Add Lead"} color="bg-secondary text-secondary-foreground" onClick={() => navigate("/dashboard/clients?action=new")} />
              <QuickActionCard icon={FileText} label={isArabic ? "عرض سعر" : "New Quote"} color="bg-[hsl(var(--warning))] text-white" onClick={() => navigate("/dashboard/quotations?action=new")} />
              <QuickActionCard icon={Calendar} label={isArabic ? "العمليات" : "Operations"} color="bg-muted-foreground/60 text-white" onClick={() => navigate("/dashboard/operations")} />
            </div>
          </div>

          {/* ── RECENT BOOKINGS TABLE ── */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{isArabic ? "الحجوزات الأخيرة" : "Recent Bookings"}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/bookings")}>
                  {isArabic ? "عرض الكل" : "View All"} <ArrowRight className="w-4 h-4 ms-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-start p-3 section-label">{isArabic ? "العميل" : "Client"}</th>
                      <th className="text-start p-3 section-label">{isArabic ? "الحزمة" : "Package"}</th>
                      <th className="text-start p-3 section-label">{isArabic ? "المبلغ" : "Amount"}</th>
                      <th className="text-start p-3 section-label">{isArabic ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking) => (
                      <tr 
                        key={booking.id} 
                        className="border-b border-muted/60 hover:bg-[hsl(18_46%_53%/0.06)] transition-colors cursor-pointer"
                        onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-semibold text-primary">
                              {booking.customers?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'G'}
                            </div>
                            <div>
                              <span className="text-sm font-medium">{booking.customers?.full_name || "Guest"}</span>
                              <div className="text-xs text-muted-foreground">{booking.booking_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm truncate max-w-[200px]">{booking.title}</div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-display font-semibold tracking-[-0.02em]">
                            {booking.selling_price?.toLocaleString()} {booking.currency}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-xs font-medium border",
                            statusPillClass(booking.status)
                          )}>
                            {booking.status === "in_operation" ? (isArabic ? "قيد التنفيذ" : "In Operation") : booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentBookings.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                        {isArabic ? "لا توجد حجوزات" : "No bookings yet"}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── UPCOMING ARRIVALS ── */}
          {upcomingArrivals.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{isArabic ? "الوصولات القادمة" : "Upcoming Arrivals"}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/bookings")}><ArrowRight className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-start p-3 section-label">{isArabic ? "الضيف" : "Guest"}</th>
                      <th className="text-start p-3 section-label">{isArabic ? "الحزمة" : "Package"}</th>
                      <th className="text-start p-3 section-label">{isArabic ? "الوصول" : "Arrival"}</th>
                      <th className="text-start p-3 section-label">{isArabic ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingArrivals.map((a) => (
                      <tr key={a.id} className="border-b border-muted/60 hover:bg-[hsl(18_46%_53%/0.06)] transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center text-xs font-semibold text-secondary">
                              {a.customers?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'G'}
                            </div>
                            <span className="font-medium text-sm">{a.customers?.full_name || "Guest"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm">{a.title}<div className="text-xs text-muted-foreground">{a.booking_number}</div></td>
                        <td className="p-3 text-sm">{a.arrival_date ? format(new Date(a.arrival_date), "MMM dd") : "TBD"}</td>
                        <td className="p-3">
                          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-xs font-medium border", statusPillClass(a.status))}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-8">
          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{isArabic ? "الملخص المالي" : "Financial Summary"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress ring */}
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(collectionPct / 100) * 283} 283`}
                    stroke="url(#progressGrad)" />
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--secondary))" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-center">
                  <div>
                    <div className="text-lg font-bold font-display text-primary tracking-[-0.02em]">{collectionPct.toFixed(0)}%</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "محصل" : "Collected"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{isArabic ? "المحصل" : "Collected"}</span>
                  <span className="text-sm font-display font-semibold text-secondary tracking-[-0.02em]">
                    {bookingStats.totalPaid.toLocaleString()} {bookingStats.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{isArabic ? "المتبقي" : "Outstanding"}</span>
                  <span className={cn("text-sm font-display font-semibold tracking-[-0.02em]",
                    bookingStats.totalBalance > 0 ? "text-primary" : "text-muted-foreground"
                  )}>
                    {bookingStats.totalBalance.toLocaleString()} {bookingStats.currency}
                  </span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{isArabic ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                    <span className="text-sm font-display font-bold tracking-[-0.02em]">
                      {bookingStats.totalRevenue.toLocaleString()} {bookingStats.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gradient progress bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${collectionPct}%`, background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))" }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{isArabic ? "أداء الوكلاء" : "Agent Performance"}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/staff")}>
                  {isArabic ? "عرض الكل" : "View All"} <ArrowRight className="w-4 h-4 ms-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentPerformance.map((agent, index) => (
                <div key={agent.id} className="flex items-center gap-4">
                  <div className="text-xs font-bold text-muted-foreground w-4">#{index + 1}</div>
                  <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-semibold text-primary">
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.bookings} bookings • {agent.conversion}%</div>
                  </div>
                  <div className="w-24">
                    <div className="text-xs text-muted-foreground text-end mb-1 font-display font-semibold tracking-[-0.02em]">
                      ${agent.revenue.toLocaleString()}
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${(agent.revenue / 35000) * 100}%`, background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Plan */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer hover:shadow-card-hover transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{isArabic ? "تفاصيل إضافية" : "Additional Details"}</CardTitle>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-6">
              <div className="space-y-4">
                <h3 className="section-label">{isArabic ? "الخطة الحالية" : "Current Plan"}</h3>
                <PlanOverviewCard />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═════════════════════════════════════════════════════════════════
export default function Overview() {
  const { user } = useAuth();
  if (user?.isSuperAdmin) return <SuperAdminDashboard />;
  return <CompanyDashboard />;
}
