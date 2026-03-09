import { useState, useEffect, useMemo, useRef } from "react";
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
import { motion } from "framer-motion";

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

// Animated counter hook
function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
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
}

// Premium Stat Card Component
function PremiumStatCard({ 
  label, 
  value, 
  icon: Icon, 
  trend, 
  trendLabel, 
  bgGradient, 
  iconBg, 
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
}) {
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
}

// Revenue Card with special styling
function RevenueStatCard({ 
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
}) {
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
          positive ? "text-emerald-700" : "text-red-600"
        )}>
          <div className={cn(
            "flex items-center justify-center w-5 h-5 rounded-full",
            positive ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
          <span>{Math.abs(trend)}%</span>
          <span className="text-amber-700/50 font-normal">vs last week</span>
        </div>
      )}
    </motion.div>
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

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string; border: string }> = {
  tentative: { bg: "bg-slate-50", dot: "bg-slate-400", text: "text-slate-700", border: "border-slate-200" },
  confirmed: { bg: "bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200" },
  in_operation: { bg: "bg-blue-50", dot: "bg-blue-500", text: "text-blue-700", border: "border-blue-200" },
  completed: { bg: "bg-purple-50", dot: "bg-purple-500", text: "text-purple-700", border: "border-purple-200" },
  cancelled: { bg: "bg-red-50", dot: "bg-red-500", text: "text-red-700", border: "border-red-200" },
};

// Mini Donut Chart Component
function MiniDonutChart({ collected, total, size = 80 }: { collected: number; total: number; size?: number }) {
  const percentage = total > 0 ? (collected / total) * 100 : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(38 70% 55%)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground text-center max-w-[200px] mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          size="sm" 
          className="gap-1.5 bg-gradient-to-r from-accent to-amber-500 hover:from-accent/90 hover:to-amber-500/90 text-white shadow-lg shadow-accent/20"
        >
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({ 
  icon: Icon, 
  label, 
  color, 
  bgColor, 
  onClick 
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 transition-all duration-200",
        "hover:shadow-md hover:border-transparent",
        bgColor
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </motion.button>
  );
}

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
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-amber-500/20 animate-pulse" />
            <Loader2 className="w-6 h-6 animate-spin text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">{isArabic ? "جاري التحميل..." : "Loading your dashboard…"}</p>
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: isArabic ? "حجز جديد" : "New Booking", icon: Plus, path: "/dashboard/bookings", color: "bg-gradient-to-br from-accent to-amber-500 text-white", bgColor: "bg-gradient-to-br from-amber-50 to-orange-50" },
    { label: isArabic ? "إضافة عميل" : "Add Lead", icon: UserPlus, path: "/dashboard/clients", color: "bg-gradient-to-br from-blue-500 to-indigo-500 text-white", bgColor: "bg-gradient-to-br from-blue-50 to-indigo-50" },
    { label: isArabic ? "المكتبة" : "Library", icon: Map, path: "/dashboard/library", color: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white", bgColor: "bg-gradient-to-br from-emerald-50 to-teal-50" },
    { label: isArabic ? "فريق العمل" : "Team", icon: Users, path: "/dashboard/staff", color: "bg-gradient-to-br from-purple-500 to-pink-500 text-white", bgColor: "bg-gradient-to-br from-purple-50 to-pink-50" },
    { label: isArabic ? "الإعدادات" : "Settings", icon: Settings, path: "/dashboard/settings", color: "bg-gradient-to-br from-slate-500 to-slate-600 text-white", bgColor: "bg-gradient-to-br from-slate-50 to-slate-100" },
  ];

  const pendingCount = bookingStats.tentative + bookingStats.confirmed;

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Premium Header with Gradient */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/60 to-white p-6 border border-amber-100/50"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.15)_0%,_transparent_50%)]" />
        <div className="absolute top-0 end-0 w-40 h-40 bg-gradient-to-bl from-amber-200/20 to-transparent rounded-full blur-3xl" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600/80 uppercase tracking-wider">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-foreground">
              {getGreeting(isArabic)}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">{displayName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {companyName}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  <Bell className="w-3 h-3" />
                  {pendingCount} {isArabic ? "حجوزات معلقة" : "pending bookings"}
                </span>
              )}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadCompanyData} 
            className="gap-2 bg-white/80 backdrop-blur-sm border-amber-200/50 hover:bg-white hover:border-amber-300 transition-all self-start sm:self-center"
          >
            <Activity className="w-4 h-4 text-amber-600" />
            <span>{isArabic ? "تحديث" : "Refresh"}</span>
          </Button>
        </div>
      </motion.div>

      {/* Primary Stats - Booking Pipeline */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <PremiumStatCard 
          label={isArabic ? "مبدئية" : "Tentative"} 
          value={bookingStats.tentative} 
          icon={Clock} 
          bgGradient="bg-gradient-to-br from-amber-50 to-orange-50/60"
          iconBg="bg-gradient-to-br from-amber-400 to-amber-500 text-white"
          subtitle={isArabic ? "في انتظار التأكيد" : "Awaiting confirmation"}
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "تم الفوز" : "Won Leads"}</p>
          </div>
        </div>
        
        <div className="w-px h-10 bg-border hidden sm:block" />
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/5 to-purple-500/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold font-display text-foreground leading-none">{teamCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "فريق العمل" : "Team Members"}</p>
          </div>
        </div>
        
        <div className="w-px h-10 bg-border hidden sm:block" />
        
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-accent/5 to-accent/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold font-display text-foreground leading-none">
              {subscription?.plans?.name || "—"}
            </p>
            {subscription && <SubscriptionBadge status={subscription.status} />}
          </div>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Arrivals */}
        <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/50 to-transparent border-b border-border/30">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              {isArabic ? "الوصول القادم (7 أيام)" : "Upcoming Arrivals (7 days)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {upcomingArrivals.length === 0 ? (
              <EmptyState
                icon={Plane}
                title={isArabic ? "لا يوجد وصول قادم" : "No upcoming arrivals"}
                description={isArabic ? "ستظهر هنا الحجوزات القادمة" : "Upcoming bookings will appear here"}
                actionLabel={isArabic ? "إنشاء حجز" : "Create Booking"}
                onAction={() => navigate("/dashboard/bookings")}
              />
            ) : (
              <div className="space-y-3">
                {upcomingArrivals.map((b, idx) => {
                  const sc = STATUS_COLORS[b.status] || STATUS_COLORS.tentative;
                  const customerName = (b.customers as any)?.full_name || "Guest";
                  const initials = customerName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                  
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer group",
                        sc.bg, sc.border,
                        "hover:shadow-md hover:-translate-y-0.5"
                      )}
                      onClick={() => navigate(`/dashboard/bookings/${b.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold", sc.bg, sc.text)}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{b.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span>{customerName}</span>
                            <span className="opacity-50">·</span>
                            <span className="font-mono">{b.booking_number}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-end shrink-0 flex items-center gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {format(parseISO(b.arrival_date), "MMM d")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(parseISO(b.arrival_date), { addSuffix: true })}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity rtl:scale-x-[-1]" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/50 to-transparent border-b border-border/30">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              {isArabic ? "إجراءات سريعة" : "Quick Actions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, idx) => (
                <QuickActionButton
                  key={action.label}
                  icon={action.icon}
                  label={action.label}
                  color={action.color}
                  bgColor={action.bgColor}
                  onClick={() => navigate(action.path)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-purple-50/50 to-transparent border-b border-border/30">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              {isArabic ? "أداء الوكلاء" : "Agent Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {agentPerformance.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title={isArabic ? "لا توجد بيانات" : "No data yet"}
                description={isArabic ? "ستظهر بيانات الأداء هنا" : "Performance data will appear here"}
              />
            ) : (
              <div className="space-y-4">
                {agentPerformance.map((agent, idx) => {
                  const maxCount = Math.max(...agentPerformance.map(a => a.count));
                  const percentage = (agent.count / maxCount) * 100;
                  const conversionRate = leadStats.total > 0 ? ((agent.count / leadStats.total) * 100).toFixed(0) : 0;
                  
                  return (
                    <div key={agent.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-[10px] font-bold text-purple-600">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate max-w-[100px]">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{agent.count} {isArabic ? "حجز" : "bookings"}</span>
                          <span className="font-mono text-emerald-600">${(agent.revenue / 1000).toFixed(1)}K</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50/50 to-transparent border-b border-border/30">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              {isArabic ? "ملخص مالي" : "Financial Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <MiniDonutChart 
                collected={bookingStats.totalPaid} 
                total={bookingStats.totalRevenue} 
                size={90}
              />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isArabic ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {bookingStats.totalRevenue.toLocaleString()} {bookingStats.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {isArabic ? "المحصل" : "Collected"}
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-600">
                    {bookingStats.totalPaid.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    {isArabic ? "المتبقي" : "Outstanding"}
                  </span>
                  <span className="text-sm font-bold font-mono text-orange-600">
                    {bookingStats.totalBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(bookingStats.totalPaid / Math.max(bookingStats.totalRevenue, 1)) * 100}%` }}
                  transition={{ duration: 1 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500"
                />
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                {((bookingStats.totalPaid / Math.max(bookingStats.totalRevenue, 1)) * 100).toFixed(0)}% {isArabic ? "تم تحصيله" : "collected"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50/50 to-transparent border-b border-border/30 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              {isArabic ? "آخر الحجوزات" : "Recent Bookings"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/bookings")} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
              {isArabic ? "عرض الكل" : "View all"} <ChevronRight className="w-3 h-3 rtl:scale-x-[-1]" />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {recentBookings.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={isArabic ? "لا توجد حجوزات" : "No bookings yet"}
                description={isArabic ? "ستظهر الحجوزات هنا" : "Your bookings will appear here"}
                actionLabel={isArabic ? "إنشاء حجز" : "Create Booking"}
                onAction={() => navigate("/dashboard/bookings")}
              />
            ) : (
              <div className="space-y-2">
                {recentBookings.map((b, idx) => {
                  const sc = STATUS_COLORS[b.status] || STATUS_COLORS.tentative;
                  const customerName = (b.customers as any)?.full_name || "Guest";
                  const initials = customerName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                  
                  return (
                    <motion.div 
                      key={b.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-all group"
                      onClick={() => navigate(`/dashboard/bookings/${b.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold", sc.bg, sc.text)}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", sc.dot)} />
                            <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">{b.booking_number}</p>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(b.created_at), "MMM d")}
                        </p>
                      </div>
                    </motion.div>
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
        <PremiumStatCard 
          label="Companies" 
          value={stats.totalCompanies} 
          icon={Building2} 
          bgGradient="bg-gradient-to-br from-primary/5 to-primary/10" 
          iconBg="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
          subtitle={`${stats.activeCompanies} active`} 
        />
        <PremiumStatCard 
          label="Users" 
          value={stats.totalUsers} 
          icon={Users} 
          bgGradient="bg-gradient-to-br from-accent/5 to-accent/10"
          iconBg="bg-gradient-to-br from-accent to-amber-500 text-white"
        />
        <PremiumStatCard 
          label="Subscriptions" 
          value={stats.totalSubscriptions} 
          icon={CreditCard} 
          bgGradient="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10"
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
          subtitle={`${stats.activeSubscriptions} active`} 
        />
        <RevenueStatCard 
          label="MRR" 
          value={stats.totalRevenueMRR} 
          currency="$"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search companies…" value={search} onChange={(e) => setSearch(e.target.value)} className="luxury-input w-full ps-10" />
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
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start">
                <th className="px-5 py-3 font-semibold text-foreground text-start">Company</th>
                <th className="px-5 py-3 font-semibold text-foreground text-start">Plan</th>
                <th className="px-5 py-3 font-semibold text-foreground text-start">Status</th>
                <th className="px-5 py-3 font-semibold text-foreground text-start">Users</th>
                <th className="px-5 py-3 font-semibold text-foreground text-start">Created</th>
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
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
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
