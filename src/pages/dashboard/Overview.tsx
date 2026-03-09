import { useState, useEffect, useMemo, useRef, memo } from "react";
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

// Animated counter hook - stable definition
const useCountUp = (end: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (end === 0) {
      setCount(0);
      return;
    }
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(easeOutQuart * end);
      
      setCount(currentCount);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    
    requestAnimationFrame(animate);
    
    return () => {
      startTimeRef.current = null;
    };
  }, [end, duration]);
  
  return count;
};

// ─── PREMIUM COMPONENTS ───

// Premium Stat Card with animations - memoized to prevent hook issues
const PremiumStatCard = memo(({
  label, 
  value, 
  icon: Icon, 
  bgGradient, 
  iconBg,
  trend, 
  trendLabel,
  subtitle, 
  onClick 
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  bgGradient: string;
  iconBg: string;
  subtitle?: string;
  onClick?: () => void;
}) => {
  const animatedValue = useCountUp(value, 800);
  const positive = (trend ?? 0) >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 cursor-pointer group transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        "border border-border/50",
        bgGradient
      )}
      onClick={onClick}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-[0.15em]">{label}</p>
          <p className="text-[32px] font-extrabold font-display text-foreground mt-1 leading-none tabular-nums">
            {animatedValue.toLocaleString()}
          </p>
          {subtitle && (
            <p className="text-[11px] text-foreground/50 mt-1.5 font-medium">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
          iconBg
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1.5 mt-4 text-xs font-semibold",
          positive ? "text-emerald-700" : "text-red-600"
        )}>
          <div className={cn(
            "flex items-center justify-center w-5 h-5 rounded-full",
            positive ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
          <span>{Math.abs(trend)}%</span>
          <span className="text-foreground/50 font-normal">{trendLabel || "vs last week"}</span>
        </div>
      )}
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-white/5 to-transparent" />
    </motion.div>
  );
});

// Revenue Card with special styling - memoized to prevent hook issues
const RevenueStatCard = memo(({ 
  label, 
  value, 
  currency,
  trend,
  onClick 
}: {
  label: string;
  value: number;
  currency: string;
  trend?: number;
  onClick?: () => void;
}) => {
  const displayValue = value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString();
  const positive = (trend ?? 0) >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 cursor-pointer group transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        "border border-amber-200/50 bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50/60"
      )}
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.1)_0%,_transparent_60%)]" />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-amber-700/70 uppercase tracking-[0.15em]">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <p className="text-[32px] font-extrabold font-display text-amber-900 leading-none">
              {displayValue}
            </p>
            <span className="text-sm font-semibold text-amber-700/60">{currency}</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
      </div>
      
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1.5 mt-4 text-xs font-semibold",
          positive ? "text-amber-700" : "text-red-600"
        )}>
          <div className={cn(
            "flex items-center justify-center w-5 h-5 rounded-full",
            positive ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
          <span>{Math.abs(trend)}%</span>
          <span className="text-amber-700/50 font-normal">vs last month</span>
        </div>
      )}
      
      {/* Revenue sparkline visualization */}
      <div className="mt-4 h-8 flex items-end justify-center">
        <svg width="80" height="20" className="text-amber-600/40">
          <path
            d="M 0 15 Q 20 5, 40 8 T 80 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="drop-shadow-sm"
          />
        </svg>
      </div>
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-amber-400/5 to-transparent" />
    </motion.div>
  );
});

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

  useEffect(() => {
    loadSuperAdminData();
  }, []);

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

        setStats({
          totalCompanies, activeCompanies, totalUsers,
          totalSubscriptions, activeSubscriptions, trialSubscriptions,
          expiredSubscriptions, totalRevenueMRR, totalPlans: 3, // Assuming 3 plans
        });
      }
      
      if (auditRes.data) {
        setAuditLogs(auditRes.data);
      }
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{isArabic ? "لوحة الإدارة العليا" : "Super Admin Dashboard"}</h1>
        <p className="text-muted-foreground mt-1">{isArabic ? "إدارة النظام والشركات" : "System & company management"}</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? "إجمالي الشركات" : "Total Companies"}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCompanies} {isArabic ? "نشطة" : "active"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? "إجمالي المستخدمين" : "Total Users"}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {isArabic ? "عبر جميع الشركات" : "across all companies"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? "الاشتراكات" : "Subscriptions"}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.trialSubscriptions} {isArabic ? "تجريبي" : "trial"}, {stats.expiredSubscriptions} {isArabic ? "منتهي" : "expired"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? "الإيرادات الشهرية" : "Monthly Revenue"}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenueMRR.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">MRR</p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "الشركات" : "Companies"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-start p-4 font-medium">{isArabic ? "الشركة" : "Company"}</th>
                  <th className="text-start p-4 font-medium">{isArabic ? "الحالة" : "Status"}</th>
                  <th className="text-start p-4 font-medium">{isArabic ? "الاشتراك" : "Subscription"}</th>
                  <th className="text-start p-4 font-medium">{isArabic ? "الأعضاء" : "Members"}</th>
                  <th className="text-start p-4 font-medium">{isArabic ? "تاريخ الإنشاء" : "Created"}</th>
                </tr>
              </thead>
              <tbody>
                {companies.slice(0, 10).map((company) => (
                  <tr key={company.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-muted-foreground">{company.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={company.is_active ? "default" : "secondary"}>
                        {company.is_active ? (isArabic ? "نشط" : "Active") : (isArabic ? "غير نشط" : "Inactive")}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {company.subscription ? (
                        <div>
                          <div className="text-sm font-medium">{company.subscription.plan?.name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground capitalize">{company.subscription.status}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{isArabic ? "لا يوجد" : "None"}</span>
                      )}
                    </td>
                    <td className="p-4">{company.memberCount}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {format(new Date(company.created_at), "MMM dd, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "الأنشطة الأخيرة" : "Recent Activities"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{log.action}</div>
                  <div className="text-xs text-muted-foreground">{log.entity_type} • {log.entity_id}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "MMM dd, HH:mm")}
                </div>
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
      }, {
        total: 0, tentative: 0, confirmed: 0, inOperation: 0, completed: 0, cancelled: 0,
        totalRevenue: 0, totalPaid: 0, totalBalance: 0, currency: bookings[0]?.currency || "USD",
      });

      stats.totalBalance = stats.totalRevenue - stats.totalPaid;
      setBookingStats(stats);

      // Filter upcoming arrivals (within next 7 days)
      const upcoming = bookings.filter(b => {
        if (!b.arrival_date) return false;
        const arrivalDate = new Date(b.arrival_date);
        return arrivalDate >= now && arrivalDate <= nextWeek;
      }).slice(0, 5);
      
      setUpcomingArrivals(upcoming);
    }

    if (leadsRes.data) {
      const leads = leadsRes.data;
      const stats = leads.reduce((acc, lead) => {
        acc.total++;
        switch (lead.status) {
          case "new": acc.new++; break;
          case "won": acc.won++; break;
          case "lost": acc.lost++; break;
        }
        return acc;
      }, { total: 0, new: 0, won: 0, lost: 0 });
      
      setLeadStats(stats);
    }

    if (activitiesRes.data) {
      setRecentActivities(activitiesRes.data);
    }

    // Mock agent performance data
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

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Compact Professional Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-4 px-6 rounded-2xl bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border border-primary/10"
      >
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">{companyName}</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <DollarSign className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-primary">
              {bookingStats.totalRevenue.toLocaleString()} {bookingStats.currency}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full">
            <CheckCircle className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">{bookingStats.confirmed} {isArabic ? "مؤكد" : "Active"}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-full">
            <Clock className="w-3 h-3 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">{bookingStats.tentative} {isArabic ? "معلق" : "Pending"}</span>
          </div>
        </div>
      </motion.div>

      {/* Hero Pipeline Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{isArabic ? "خط إنجاز الحجوزات" : "Booking Pipeline"}</h2>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/bookings")}>
            <Eye className="w-4 h-4 me-1" />
            {isArabic ? "عرض الكل" : "View All"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <PremiumStatCard 
            label={isArabic ? "مؤقتة" : "Tentative"} 
            value={bookingStats.tentative} 
            icon={Clock} 
            bgGradient="bg-gradient-to-br from-amber-50 to-yellow-50/60"
            iconBg="bg-gradient-to-br from-amber-400 to-amber-500 text-white"
            subtitle={isArabic ? "تحتاج تأكيد" : "Awaiting confirmation"}
            trend={5}
            onClick={() => navigate("/dashboard/bookings")}
          />
          <PremiumStatCard 
            label={isArabic ? "مؤكدة" : "Confirmed"} 
            value={bookingStats.confirmed} 
            icon={CheckCircle} 
            bgGradient="bg-gradient-to-br from-emerald-50 to-green-50/60"
            iconBg="bg-gradient-to-br from-emerald-400 to-emerald-500 text-white"
            subtitle={isArabic ? "جاهزة للعمليات" : "Ready for operations"}
            trend={12}
            onClick={() => navigate("/dashboard/bookings")}
          />
          <PremiumStatCard 
            label={isArabic ? "قيد التنفيذ" : "In Operation"} 
            value={bookingStats.inOperation} 
            icon={Plane} 
            bgGradient="bg-gradient-to-br from-blue-50 to-indigo-50/60"
            iconBg="bg-gradient-to-br from-blue-400 to-blue-500 text-white"
            subtitle={isArabic ? "حاليًا نشطة" : "Currently active"}
            trend={-3}
            onClick={() => navigate("/dashboard/bookings")}
          />
          <PremiumStatCard 
            label={isArabic ? "مكتملة" : "Completed"} 
            value={bookingStats.completed} 
            icon={CheckCircle} 
            bgGradient="bg-gradient-to-br from-slate-50 to-gray-50/60"
            iconBg="bg-gradient-to-br from-slate-400 to-slate-500 text-white"
            subtitle={isArabic ? "هذا الشهر" : "This month"}
            trend={8}
            onClick={() => navigate("/dashboard/bookings")}
          />
          <RevenueStatCard 
            label={isArabic ? "الإيرادات" : "Revenue"} 
            value={bookingStats.totalRevenue} 
            currency={bookingStats.currency}
            trend={15}
            onClick={() => navigate("/dashboard/bookings")}
          />
        </div>
      </motion.div>

      {/* Secondary Stats - Compact Summary Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 shadow-sm"
      >
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">{leadStats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "العملاء المحتملين" : "Total Leads"}</p>
          </div>
        </div>
        
        <div className="w-px h-10 bg-border hidden sm:block" />
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/5 to-emerald-500/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">{leadStats.won}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "فوز العملاء" : "Won Leads"}</p>
          </div>
        </div>
        
        <div className="w-px h-10 bg-border hidden sm:block" />
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/5 to-purple-500/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">{teamCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "الفريق" : "Team Members"}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-8">
          {/* Upcoming Arrivals Table */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{isArabic ? "الوصولات القادمة" : "Upcoming Arrivals"}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/bookings")}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingArrivals.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="text-start p-3 font-medium">{isArabic ? "الضيف" : "Guest"}</th>
                        <th className="text-start p-3 font-medium">{isArabic ? "الحزمة" : "Package"}</th>
                        <th className="text-start p-3 font-medium">{isArabic ? "تاريخ الوصول" : "Arrival"}</th>
                        <th className="text-start p-3 font-medium">{isArabic ? "الحالة" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingArrivals.map((arrival, index) => (
                        <tr key={arrival.id} className={cn(
                          "hover:bg-muted/50 transition-colors",
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                                {arrival.customers?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'G'}
                              </div>
                              <span className="font-medium text-sm">{arrival.customers?.full_name || "Guest"}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-sm font-medium truncate max-w-[200px]">{arrival.title}</div>
                            <div className="text-xs text-muted-foreground">{arrival.booking_number}</div>
                          </td>
                          <td className="p-3 text-sm">{arrival.arrival_date ? format(new Date(arrival.arrival_date), "MMM dd") : "TBD"}</td>
                          <td className="p-3">
                            <Badge 
                              variant={arrival.status === "confirmed" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {arrival.status === "confirmed" ? (isArabic ? "مؤكد" : "Confirmed") : (isArabic ? "معلق" : "Pending")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد وصولات قادمة هذا الأسبوع" : "No arrivals scheduled this week"}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/dashboard/bookings")}>
                    <Plus className="w-4 h-4 me-1" />
                    {isArabic ? "إنشاء حجز جديد" : "Create New Booking"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Bookings Table */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{isArabic ? "الحجوزات الأخيرة" : "Recent Bookings"}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/bookings")}>
                  {isArabic ? "عرض الكل" : "View All"}
                  <ArrowRight className="w-4 h-4 ms-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="text-start p-3 font-medium">{isArabic ? "معرف الحجز" : "Booking ID"}</th>
                      <th className="text-start p-3 font-medium">{isArabic ? "العميل" : "Client"}</th>
                      <th className="text-start p-3 font-medium">{isArabic ? "الحزمة" : "Package"}</th>
                      <th className="text-start p-3 font-medium">{isArabic ? "المبلغ" : "Amount"}</th>
                      <th className="text-start p-3 font-medium">{isArabic ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking, index) => (
                      <tr 
                        key={booking.id} 
                        className={cn(
                          "hover:bg-muted/50 transition-colors cursor-pointer",
                          index % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}
                        onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                      >
                        <td className="p-3">
                          <div className="text-sm font-medium">{booking.booking_number}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(booking.created_at), "MMM dd")}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-xs font-semibold text-blue-700">
                              {booking.customers?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'G'}
                            </div>
                            <span className="text-sm font-medium">{booking.customers?.full_name || "Guest"}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm truncate max-w-[200px]">{booking.title}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm font-semibold tabular-nums">
                            {booking.selling_price?.toLocaleString()} {booking.currency}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              booking.status === "confirmed" ? "bg-green-500" :
                              booking.status === "tentative" ? "bg-yellow-500" :
                              booking.status === "completed" ? "bg-blue-500" :
                              "bg-gray-500"
                            )} />
                            <span className="text-xs capitalize">{booking.status}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Financial Summary */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">{isArabic ? "الملخص المالي" : "Financial Summary"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Donut Chart Placeholder */}
              <div className="relative">
                <div className="w-32 h-32 mx-auto relative">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-muted-foreground/20"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={`${(bookingStats.totalPaid / (bookingStats.totalRevenue || 1)) * 283} 283`}
                      className="text-green-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {((bookingStats.totalPaid / (bookingStats.totalRevenue || 1)) * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">{isArabic ? "محصل" : "Collected"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{isArabic ? "المحصل" : "Collected"}</span>
                  <span className="text-sm font-semibold text-green-600 tabular-nums">
                    {bookingStats.totalPaid.toLocaleString()} {bookingStats.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{isArabic ? "المتبقي" : "Outstanding"}</span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    bookingStats.totalBalance > 0 ? "text-orange-600" : "text-muted-foreground"
                  )}>
                    {bookingStats.totalBalance.toLocaleString()} {bookingStats.currency}
                  </span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{isArabic ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                    <span className="text-sm font-bold tabular-nums">
                      {bookingStats.totalRevenue.toLocaleString()} {bookingStats.currency}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">{isArabic ? "أداء الوكلاء" : "Agent Performance"}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/staff")}>
                  {isArabic ? "عرض الكل" : "View All"}
                  <ArrowRight className="w-4 h-4 ms-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentPerformance.map((agent, index) => (
                <div key={agent.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-muted-foreground w-4">#{index + 1}</div>
                    <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                      {agent.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.bookings} bookings • {agent.conversion}%</div>
                    </div>
                  </div>
                  <div className="flex-1 ms-auto">
                    <div className="text-xs text-muted-foreground text-end mb-1">
                      ${agent.revenue.toLocaleString()}
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300"
                        style={{ width: `${(agent.revenue / 35000) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Collapsible Secondary Section */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Card className="border border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{isArabic ? "تفاصيل إضافية" : "Additional Details"}</CardTitle>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-6">
              {/* Current Plan */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {isArabic ? "الخطة الحالية" : "Current Plan"}
                </h3>
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