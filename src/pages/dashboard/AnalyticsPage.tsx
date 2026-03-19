import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FeatureGate } from "@/components/plan/FeatureGate";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, Users, MapPin, DollarSign, Target,
  Calendar, Download, Loader2, ArrowUpRight, ArrowDownRight,
  UserCheck, Briefcase, Filter, Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from "recharts";

const COLORS = [
  "hsl(220,40%,13%)", "hsl(38,80%,55%)", "hsl(160,50%,45%)",
  "hsl(350,65%,50%)", "hsl(200,60%,50%)", "hsl(280,50%,55%)",
];

const STATUS_COLORS: Record<string, string> = {
  new: "hsl(220,40%,13%)",
  contacted: "hsl(200,60%,50%)",
  planning: "hsl(38,80%,55%)",
  awaiting_client: "hsl(30,80%,55%)",
  won: "hsl(160,50%,45%)",
  lost: "hsl(350,65%,50%)",
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { direction } = useLanguage();
  const { limits } = usePlanLimits();
  const companyId = user?.activeMembership?.companyId;

  const [dateRange, setDateRange] = useState<"3m" | "6m" | "12m" | "all">("6m");
  const [activeSection, setActiveSection] = useState<"overview" | "leads" | "bookings" | "agents" | "destinations" | "revenue">("overview");
  const [fromDate, setFromDate] = useState<Date | undefined>(subMonths(new Date(), 6));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());

  const isLockedOut = limits.isOnFreeTier || (limits.isTrialing && limits.planSlug === "free");

  // Update date range when preset changes
  const effectiveDates = useMemo(() => {
    if (dateRange === "all") return { from: new Date("2020-01-01"), to: new Date() };
    const months = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    return { from: fromDate || subMonths(new Date(), months), to: toDate || new Date() };
  }, [dateRange, fromDate, toDate]);

  const handlePresetChange = (val: string) => {
    setDateRange(val as any);
    if (val !== "all") {
      const m = val === "3m" ? 3 : val === "6m" ? 6 : 12;
      setFromDate(subMonths(new Date(), m));
      setToDate(new Date());
    }
  };

  // ─── DATA QUERIES ───
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["analytics-leads", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, status, source, created_at, assigned_to, destinations, budget_min, budget_max, budget_currency").eq("company_id", companyId!).is("deleted_at", null);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["analytics-bookings", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("id, status, created_at, selling_price, total_cost, amount_paid, payment_status, currency, assigned_to, start_date, adults, children").eq("company_id", companyId!).is("deleted_at", null);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["analytics-trips", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("id, status, created_at, selling_price, total_cost, assigned_to, currency").eq("company_id", companyId!).is("deleted_at", null);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["analytics-profiles", companyId],
    queryFn: async () => {
      const { data: memberships } = await supabase.from("company_memberships").select("user_id, role").eq("company_id", companyId!).eq("is_active", true);
      if (!memberships?.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", memberships.map(m => m.user_id));
      return (data || []).map(p => ({ ...p, role: memberships.find(m => m.user_id === p.id)?.role }));
    },
    enabled: !!companyId,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["analytics-quotations", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("quotations").select("id, status, total_amount, created_at, currency").eq("company_id", companyId!).is("deleted_at", null);
      return data || [];
    },
    enabled: !!companyId,
  });

  const isLoading = leadsLoading || bookingsLoading || tripsLoading;

  // ─── FILTERED DATA ───
  const inRange = (dateStr: string) => {
    try {
      return isWithinInterval(parseISO(dateStr), { start: effectiveDates.from, end: effectiveDates.to });
    } catch { return false; }
  };

  const filteredLeads = useMemo(() => leads.filter(l => inRange(l.created_at)), [leads, effectiveDates]);
  const filteredBookings = useMemo(() => bookings.filter(b => inRange(b.created_at)), [bookings, effectiveDates]);
  const filteredTrips = useMemo(() => trips.filter(t => inRange(t.created_at)), [trips, effectiveDates]);
  const filteredQuotations = useMemo(() => quotations.filter(q => inRange(q.created_at)), [quotations, effectiveDates]);

  // ─── COMPUTED ANALYTICS ───

  // Leads by status
  const leadsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count, fill: STATUS_COLORS[status] || COLORS[0] }));
  }, [filteredLeads]);

  // Bookings by month
  const bookingsByMonth = useMemo(() => {
    const months: Record<string, { month: string; count: number; revenue: number }> = {};
    filteredBookings.forEach(b => {
      const m = format(parseISO(b.created_at), "yyyy-MM");
      if (!months[m]) months[m] = { month: m, count: 0, revenue: 0 };
      months[m].count++;
      months[m].revenue += Number(b.selling_price || 0);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m, label: format(parseISO(m.month + "-01"), "MMM yy"),
    }));
  }, [filteredBookings]);

  // Conversion rate: leads won / total leads
  const conversionRate = useMemo(() => {
    if (filteredLeads.length === 0) return 0;
    const won = filteredLeads.filter(l => l.status === "won").length;
    return Math.round((won / filteredLeads.length) * 100);
  }, [filteredLeads]);

  // Trip conversion: trips converted / total
  const tripConversion = useMemo(() => {
    if (filteredTrips.length === 0) return 0;
    const converted = filteredTrips.filter(t => t.status === "converted").length;
    return Math.round((converted / filteredTrips.length) * 100);
  }, [filteredTrips]);

  // Agent performance
  const agentPerformance = useMemo(() => {
    const agents: Record<string, { name: string; leads: number; won: number; bookings: number; revenue: number }> = {};
    profiles.forEach(p => {
      if (["agent", "company_admin"].includes(p.role || "")) {
        agents[p.id] = { name: p.full_name || "Unknown", leads: 0, won: 0, bookings: 0, revenue: 0 };
      }
    });
    filteredLeads.forEach(l => {
      if (l.assigned_to && agents[l.assigned_to]) {
        agents[l.assigned_to].leads++;
        if (l.status === "won") agents[l.assigned_to].won++;
      }
    });
    filteredBookings.forEach(b => {
      if (b.assigned_to && agents[b.assigned_to]) {
        agents[b.assigned_to].bookings++;
        agents[b.assigned_to].revenue += Number(b.selling_price || 0);
      }
    });
    return Object.values(agents).sort((a, b) => b.revenue - a.revenue);
  }, [profiles, filteredLeads, filteredBookings]);

  // Top destinations
  const topDestinations = useMemo(() => {
    const dests: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const destinations = l.destinations as any[];
      if (Array.isArray(destinations)) {
        destinations.forEach((d: any) => {
          const name = typeof d === "string" ? d : d?.name || d?.country || JSON.stringify(d);
          if (name) dests[name] = (dests[name] || 0) + 1;
        });
      }
    });
    return Object.entries(dests).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count], i) => ({ name, count, fill: COLORS[i % COLORS.length] }));
  }, [filteredLeads]);

  // Revenue summary
  const revenueSummary = useMemo(() => {
    const totalRevenue = filteredBookings.reduce((s, b) => s + Number(b.selling_price || 0), 0);
    const totalCost = filteredBookings.reduce((s, b) => s + Number(b.total_cost || 0), 0);
    const totalCollected = filteredBookings.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
    const totalOutstanding = totalRevenue - totalCollected;
    const avgBookingValue = filteredBookings.length > 0 ? totalRevenue / filteredBookings.length : 0;
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;
    return { totalRevenue, totalCost, totalCollected, totalOutstanding, avgBookingValue, profit, margin };
  }, [filteredBookings]);

  // Revenue by month for chart
  const revenueByMonth = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; cost: number; profit: number }> = {};
    filteredBookings.forEach(b => {
      const m = format(parseISO(b.created_at), "yyyy-MM");
      if (!months[m]) months[m] = { month: m, revenue: 0, cost: 0, profit: 0 };
      months[m].revenue += Number(b.selling_price || 0);
      months[m].cost += Number(b.total_cost || 0);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      profit: m.revenue - m.cost,
      label: format(parseISO(m.month + "-01"), "MMM yy"),
    }));
  }, [filteredBookings]);

  // ─── EXPORT ───
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  const sections = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "leads", label: "Leads", icon: Target },
    { key: "bookings", label: "Bookings", icon: Briefcase },
    { key: "agents", label: "Agents", icon: UserCheck },
    { key: "destinations", label: "Destinations", icon: MapPin },
    { key: "revenue", label: "Revenue", icon: DollarSign },
  ] as const;

  if (isLockedOut) {
    return (
      <div className="relative min-h-[60vh]">
        <LockOverlay planRequired="Starter" featureName="Analytics & Reporting" />
        <div className="opacity-30 pointer-events-none blur-sm p-8">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Detailed analytics and reporting for your business.</p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-muted" />)}
          </div>
          <div className="h-64 rounded-xl bg-muted mt-6" />
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="Analytics">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold font-display text-foreground leading-tight">Reports & Analytics</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Business intelligence for {user?.activeMembership?.companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                <Calendar className="w-3 h-3" />
                {fromDate ? format(fromDate, "MMM d") : "From"} – {toDate ? format(toDate, "MMM d") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                mode="range"
                selected={{ from: fromDate, to: toDate }}
                onSelect={(range: any) => { setFromDate(range?.from); setToDate(range?.to); setDateRange("all"); }}
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Section tabs */}
      <Tabs value={activeSection} onValueChange={v => setActiveSection(v as any)}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {sections.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="gap-1.5 text-xs">
              <s.icon className="w-3.5 h-3.5" /> {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ═══ OVERVIEW ═══ */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Total Leads" value={filteredLeads.length} icon={Target} color="bg-accent/10 text-accent" />
            <SummaryCard label="Won Leads" value={filteredLeads.filter(l => l.status === "won").length} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-600" subtitle={`${conversionRate}% conversion`} />
            <SummaryCard label="Bookings" value={filteredBookings.length} icon={Briefcase} color="bg-primary/10 text-primary" />
            <SummaryCard label="Revenue" value={`${revenueSummary.totalRevenue.toLocaleString()}`} icon={DollarSign} color="bg-accent/10 text-accent" subtitle={`${revenueSummary.margin}% margin`} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leads by Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Leads by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {leadsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={leadsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ status, count }) => `${status} (${count})`}>
                        {leadsByStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            {/* Revenue trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(38,80%,55%)" fill="hsl(38,80%,55%)" fillOpacity={0.15} strokeWidth={2} />
                      <Area type="monotone" dataKey="profit" stroke="hsl(160,50%,45%)" fill="hsl(160,50%,45%)" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>

          {/* Bookings by month */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Bookings by Month</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => exportCSV(bookingsByMonth, "bookings-by-month")}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              {bookingsByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={bookingsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Bar dataKey="count" fill="hsl(220,40%,13%)" radius={[4, 4, 0, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ LEADS ═══ */}
      {activeSection === "leads" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Total Leads" value={filteredLeads.length} icon={Target} color="bg-accent/10 text-accent" />
            <SummaryCard label="New" value={filteredLeads.filter(l => l.status === "new").length} icon={Users} color="bg-primary/10 text-primary" />
            <SummaryCard label="Won" value={filteredLeads.filter(l => l.status === "won").length} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-600" />
            <SummaryCard label="Conversion Rate" value={`${conversionRate}%`} icon={ArrowUpRight} color="bg-accent/10 text-accent" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Leads by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {leadsByStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={leadsByStatus} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Leads">
                        {leadsByStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Leads by Source</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadsBySource leads={filteredLeads} />
              </CardContent>
            </Card>
          </div>

          {/* Leads table */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Lead Breakdown</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => exportCSV(leadsByStatus, "leads-by-status")}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Count</TableHead>
                    <TableHead className="text-xs text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsByStatus.map(s => (
                    <TableRow key={s.status}>
                      <TableCell className="text-xs font-medium capitalize">{s.status.replace("_", " ")}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{s.count}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{filteredLeads.length > 0 ? Math.round((s.count / filteredLeads.length) * 100) : 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ BOOKINGS ═══ */}
      {activeSection === "bookings" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Total Bookings" value={filteredBookings.length} icon={Briefcase} color="bg-primary/10 text-primary" />
            <SummaryCard label="Confirmed" value={filteredBookings.filter(b => b.status === "confirmed").length} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-600" />
            <SummaryCard label="Avg. Value" value={Math.round(revenueSummary.avgBookingValue).toLocaleString()} icon={DollarSign} color="bg-accent/10 text-accent" />
            <SummaryCard label="Trip Conversion" value={`${tripConversion}%`} icon={Map} color="bg-primary/10 text-primary" subtitle={`${filteredTrips.filter(t => t.status === "converted").length} / ${filteredTrips.length} trips`} />
          </div>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Bookings by Month</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => exportCSV(bookingsByMonth, "bookings-monthly")}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              {bookingsByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bookingsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="hsl(220,40%,13%)" radius={[4, 4, 0, 0]} name="Bookings" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(38,80%,55%)" strokeWidth={2} name="Revenue" dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* Booking status breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Count</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["tentative", "confirmed", "in_operation", "completed", "cancelled"].map(s => {
                    const subset = filteredBookings.filter(b => b.status === s);
                    if (subset.length === 0) return null;
                    return (
                      <TableRow key={s}>
                        <TableCell className="text-xs font-medium capitalize">{s.replace("_", " ")}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{subset.length}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{subset.reduce((a, b) => a + Number(b.selling_price || 0), 0).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ AGENTS ═══ */}
      {activeSection === "agents" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Agent Performance</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => exportCSV(agentPerformance, "agent-performance")}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              {agentPerformance.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={agentPerformance}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                      <Legend />
                      <Bar dataKey="leads" fill="hsl(220,40%,13%)" radius={[4, 4, 0, 0]} name="Leads" />
                      <Bar dataKey="won" fill="hsl(160,50%,45%)" radius={[4, 4, 0, 0]} name="Won" />
                      <Bar dataKey="bookings" fill="hsl(38,80%,55%)" radius={[4, 4, 0, 0]} name="Bookings" />
                    </BarChart>
                  </ResponsiveContainer>
                  <Separator className="my-4" />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Agent</TableHead>
                        <TableHead className="text-xs text-right">Leads</TableHead>
                        <TableHead className="text-xs text-right">Won</TableHead>
                        <TableHead className="text-xs text-right">Conv. %</TableHead>
                        <TableHead className="text-xs text-right">Bookings</TableHead>
                        <TableHead className="text-xs text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentPerformance.map(a => (
                        <TableRow key={a.name}>
                          <TableCell className="text-xs font-medium">{a.name}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{a.leads}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{a.won}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{a.leads > 0 ? Math.round((a.won / a.leads) * 100) : 0}%</TableCell>
                          <TableCell className="text-xs text-right font-mono">{a.bookings}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{a.revenue.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <EmptyChart message="No agents with assigned leads or bookings" />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ DESTINATIONS ═══ */}
      {activeSection === "destinations" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Top Destinations</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => exportCSV(topDestinations, "top-destinations")}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              {topDestinations.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topDestinations} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={120} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Inquiries">
                        {topDestinations.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Destination</TableHead>
                        <TableHead className="text-xs text-right">Inquiries</TableHead>
                        <TableHead className="text-xs text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDestinations.map((d, i) => (
                        <TableRow key={d.name}>
                          <TableCell className="text-xs font-mono text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{d.name}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{d.count}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{filteredLeads.length > 0 ? Math.round((d.count / filteredLeads.length) * 100) : 0}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <EmptyChart message="No destination data found in leads" />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ REVENUE ═══ */}
      {activeSection === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Total Revenue" value={revenueSummary.totalRevenue.toLocaleString()} icon={DollarSign} color="bg-accent/10 text-accent" />
            <SummaryCard label="Total Cost" value={revenueSummary.totalCost.toLocaleString()} icon={TrendingUp} color="bg-primary/10 text-primary" />
            <SummaryCard label="Net Profit" value={revenueSummary.profit.toLocaleString()} icon={ArrowUpRight} color="bg-emerald-500/10 text-emerald-600" subtitle={`${revenueSummary.margin}% margin`} />
            <SummaryCard label="Outstanding" value={revenueSummary.totalOutstanding.toLocaleString()} icon={DollarSign} color={revenueSummary.totalOutstanding > 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue vs Cost</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                      <Legend />
                      <Bar dataKey="revenue" fill="hsl(38,80%,55%)" radius={[4, 4, 0, 0]} name="Revenue" />
                      <Bar dataKey="cost" fill="hsl(220,40%,13%)" radius={[4, 4, 0, 0]} name="Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Profit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                      <Line type="monotone" dataKey="profit" stroke="hsl(160,50%,45%)" strokeWidth={2.5} dot={{ r: 4 }} name="Profit" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>

          {/* Revenue table */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Monthly Breakdown</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => exportCSV(revenueByMonth, "revenue-monthly")}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Month</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Cost</TableHead>
                    <TableHead className="text-xs text-right">Profit</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByMonth.map(m => (
                    <TableRow key={m.month}>
                      <TableCell className="text-xs font-medium">{m.label}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{m.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{m.cost.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-xs text-right font-mono font-bold", m.profit >= 0 ? "text-emerald-600" : "text-destructive")}>{m.profit.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{m.revenue > 0 ? Math.round((m.profit / m.revenue) * 100) : 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Collection summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">{revenueSummary.totalCollected.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{revenueSummary.totalOutstanding.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. Booking Value</p>
                <p className="text-2xl font-bold font-mono text-foreground mt-1">{Math.round(revenueSummary.avgBookingValue).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}

// ─── Sub-components ───

function SummaryCard({ label, value, icon: Icon, color, subtitle }: {
  label: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold font-display text-foreground leading-none mt-0.5">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <div className="text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">{message || "No data for this period"}</p>
      </div>
    </div>
  );
}

function LeadsBySource({ leads }: { leads: any[] }) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.source] = (counts[l.source] || 0) + 1; });
    return Object.entries(counts).map(([source, count], i) => ({ source, count, fill: COLORS[i % COLORS.length] }));
  }, [leads]);

  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ source, count }) => `${source} (${count})`}>
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
