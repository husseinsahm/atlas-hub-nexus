import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Bus, Users, DollarSign, TrendingUp, TrendingDown, Loader2,
  Activity, Fuel, Wrench, AlertCircle, Star,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfYear, endOfYear, differenceInMinutes, format,
} from "date-fns";

type Period = "week" | "month" | "year";

function periodRange(p: Period) {
  const now = new Date();
  if (p === "week") return { from: startOfWeek(now), to: endOfWeek(now) };
  if (p === "year") return { from: startOfYear(now), to: endOfYear(now) };
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function fmtMoney(n: number, c = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n || 0);
}

export default function FleetReportsPage() {
  const { user } = useAuth();
  const companyId = user?.activeMembership?.companyId;
  const [period, setPeriod] = useState<Period>("month");
  const { from, to } = useMemo(() => periodRange(period), [period]);

  // Data loads
  const { data: vehicles = [] } = useQuery({
    queryKey: ["rep-vehicles", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id,name,vehicle_type,plate_number,currency,daily_rate,status")
        .eq("company_id", companyId!).is("deleted_at", null);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["rep-drivers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("id,full_name,rating,total_trips,status,daily_rate,currency")
        .eq("company_id", companyId!).is("deleted_at", null);
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: assignments = [], isLoading: loadingA } = useQuery({
    queryKey: ["rep-assign", companyId, from, to],
    queryFn: async () => {
      const { data } = await supabase.from("service_assignments")
        .select("id,booking_id,vehicle_id,driver_id,scheduled_start,scheduled_end,actual_start,actual_end,status,driver_payout,currency,passenger_count")
        .eq("company_id", companyId!)
        .gte("scheduled_start", from.toISOString())
        .lte("scheduled_start", to.toISOString());
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["rep-exp", companyId, from, to],
    queryFn: async () => {
      const { data } = await supabase.from("vehicle_expenses")
        .select("id,vehicle_id,booking_id,expense_type,amount,currency,expense_date")
        .eq("company_id", companyId!)
        .gte("expense_date", format(from, "yyyy-MM-dd"))
        .lte("expense_date", format(to, "yyyy-MM-dd"));
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["rep-bookings", companyId],
    queryFn: async () => {
      const ids = Array.from(new Set(assignments.map((a: any) => a.booking_id).filter(Boolean)));
      if (!ids.length) return [];
      const { data } = await supabase.from("bookings")
        .select("id,booking_number,title,total_amount,currency")
        .in("id", ids);
      return data || [];
    },
    enabled: !!companyId && assignments.length > 0,
  });

  // Period hours
  const periodHours = (to.getTime() - from.getTime()) / (1000 * 60 * 60);

  // Vehicle utilization
  const vehicleStats = useMemo(() => {
    return vehicles.map((v: any) => {
      const va = assignments.filter((a: any) => a.vehicle_id === v.id);
      const usedMin = va.reduce((s: number, a: any) => {
        const startT = a.actual_start || a.scheduled_start;
        const endT = a.actual_end || a.scheduled_end;
        return s + Math.max(0, differenceInMinutes(new Date(endT), new Date(startT)));
      }, 0);
      const usedH = usedMin / 60;
      const util = periodHours > 0 ? Math.min(100, (usedH / periodHours) * 100) : 0;
      const exp = expenses.filter((e: any) => e.vehicle_id === v.id);
      const fuel = exp.filter((e: any) => e.expense_type === "fuel").reduce((s: number, e: any) => s + Number(e.amount), 0);
      const maint = exp.filter((e: any) => e.expense_type === "maintenance" || e.expense_type === "repair").reduce((s: number, e: any) => s + Number(e.amount), 0);
      const other = exp.filter((e: any) => !["fuel", "maintenance", "repair"].includes(e.expense_type)).reduce((s: number, e: any) => s + Number(e.amount), 0);
      const totalCost = fuel + maint + other;
      const revenue = va.length * Number(v.daily_rate || 0);
      return { ...v, trips: va.length, usedH, util, fuel, maint, other, totalCost, revenue };
    });
  }, [vehicles, assignments, expenses, periodHours]);

  // Driver performance
  const driverStats = useMemo(() => {
    return drivers.map((d: any) => {
      const da = assignments.filter((a: any) => a.driver_id === d.id);
      const completed = da.filter((a: any) => a.status === "completed").length;
      const onTime = da.filter((a: any) => {
        if (!a.actual_start || a.status !== "completed") return false;
        return new Date(a.actual_start).getTime() <= new Date(a.scheduled_start).getTime() + 15 * 60 * 1000;
      }).length;
      const pax = da.reduce((s: number, a: any) => s + (a.passenger_count || 0), 0);
      const payout = da.reduce((s: number, a: any) => s + Number(a.driver_payout || 0), 0);
      const onTimeRate = completed > 0 ? (onTime / completed) * 100 : 0;
      return { ...d, trips: da.length, completed, onTime, onTimeRate, pax, payout };
    });
  }, [drivers, assignments]);

  // Trip profitability per booking
  const tripProfit = useMemo(() => {
    return bookings.map((b: any) => {
      const ba = assignments.filter((a: any) => a.booking_id === b.id);
      const payout = ba.reduce((s: number, a: any) => s + Number(a.driver_payout || 0), 0);
      const exp = expenses.filter((e: any) => e.booking_id === b.id).reduce((s: number, e: any) => s + Number(e.amount), 0);
      const revenue = Number(b.total_amount || 0);
      const cost = payout + exp;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { ...b, trips: ba.length, payout, exp, cost, profit, margin };
    }).sort((a: any, b: any) => b.profit - a.profit);
  }, [bookings, assignments, expenses]);

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = tripProfit.reduce((s, t) => s + t.revenue, 0);
    const totalCost = tripProfit.reduce((s, t) => s + t.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgUtil = vehicleStats.length ? vehicleStats.reduce((s, v) => s + v.util, 0) / vehicleStats.length : 0;
    const totalTrips = assignments.length;
    return { totalRevenue, totalCost, totalProfit, avgUtil, totalTrips };
  }, [tripProfit, vehicleStats, assignments]);

  if (!companyId) return null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Fleet Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Utilization, driver performance and trip profitability</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Activity} label="Trips" value={String(kpis.totalTrips)} tone="blue" />
        <KpiCard icon={Bus} label="Avg Utilization" value={`${kpis.avgUtil.toFixed(1)}%`} tone="violet" />
        <KpiCard icon={DollarSign} label="Revenue" value={fmtMoney(kpis.totalRevenue)} tone="emerald" />
        <KpiCard icon={TrendingDown} label="Fleet Costs" value={fmtMoney(kpis.totalCost)} tone="amber" />
        <KpiCard icon={TrendingUp} label="Net Profit" value={fmtMoney(kpis.totalProfit)} tone={kpis.totalProfit >= 0 ? "emerald" : "red"} />
      </div>

      {loadingA && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicle Utilization</TabsTrigger>
          <TabsTrigger value="drivers">Driver Performance</TabsTrigger>
          <TabsTrigger value="profit">Trip Profitability</TabsTrigger>
          <TabsTrigger value="expenses">Expense Breakdown</TabsTrigger>
        </TabsList>

        {/* Vehicles */}
        <TabsContent value="vehicles" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Vehicle Utilization</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Trips</TableHead>
                    <TableHead>Hours Used</TableHead>
                    <TableHead className="w-[200px]">Utilization</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">Est. Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleStats.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">No vehicles</TableCell></TableRow>
                  )}
                  {vehicleStats.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{v.name}</div>
                        <div className="text-xs text-slate-500">{v.plate_number || v.vehicle_type}</div>
                      </TableCell>
                      <TableCell>{v.trips}</TableCell>
                      <TableCell>{v.usedH.toFixed(1)}h</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={v.util} className="h-2 flex-1" />
                          <span className="text-xs font-medium w-12 text-end">{v.util.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-amber-700">{fmtMoney(v.totalCost, v.currency)}</TableCell>
                      <TableCell className="text-right text-emerald-700 font-medium">{fmtMoney(v.revenue, v.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drivers */}
        <TabsContent value="drivers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Driver Performance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Trips</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="w-[180px]">On-Time Rate</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverStats.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">No drivers</TableCell></TableRow>
                  )}
                  {driverStats.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium text-slate-900">{d.full_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-current" /> {Number(d.rating || 0).toFixed(1)}
                        </div>
                      </TableCell>
                      <TableCell>{d.trips}</TableCell>
                      <TableCell>{d.completed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={d.onTimeRate} className="h-2 flex-1" />
                          <span className="text-xs font-medium w-12 text-end">{d.onTimeRate.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{d.pax}</TableCell>
                      <TableCell className="text-right">{fmtMoney(d.payout, d.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitability */}
        <TabsContent value="profit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Trip Profitability (per Booking)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Trips</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Driver Payouts</TableHead>
                    <TableHead className="text-right">Vehicle Exp.</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripProfit.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">No data in this period</TableCell></TableRow>
                  )}
                  {tripProfit.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{b.booking_number}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[260px]">{b.title}</div>
                      </TableCell>
                      <TableCell>{b.trips}</TableCell>
                      <TableCell className="text-right">{fmtMoney(b.revenue, b.currency)}</TableCell>
                      <TableCell className="text-right text-slate-600">{fmtMoney(b.payout, b.currency)}</TableCell>
                      <TableCell className="text-right text-slate-600">{fmtMoney(b.exp, b.currency)}</TableCell>
                      <TableCell className={`text-right font-semibold ${b.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {fmtMoney(b.profit, b.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={b.margin >= 30 ? "border-emerald-300 text-emerald-700" : b.margin >= 0 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}>
                          {b.margin.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense breakdown */}
        <TabsContent value="expenses" className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <ExpenseSummaryCard icon={Fuel} label="Fuel" tone="blue"
              total={expenses.filter((e: any) => e.expense_type === "fuel").reduce((s: number, e: any) => s + Number(e.amount), 0)} />
            <ExpenseSummaryCard icon={Wrench} label="Maintenance / Repair" tone="amber"
              total={expenses.filter((e: any) => ["maintenance", "repair"].includes(e.expense_type)).reduce((s: number, e: any) => s + Number(e.amount), 0)} />
            <ExpenseSummaryCard icon={AlertCircle} label="Other (Tolls, Fines…)" tone="slate"
              total={expenses.filter((e: any) => !["fuel", "maintenance", "repair"].includes(e.expense_type)).reduce((s: number, e: any) => s + Number(e.amount), 0)} />
          </div>

          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Recent Expenses</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">No expenses</TableCell></TableRow>
                  )}
                  {expenses.slice(0, 20).map((e: any) => {
                    const v = vehicles.find((x: any) => x.id === e.vehicle_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.expense_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{v?.name || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{e.expense_type}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(Number(e.amount), e.currency)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  const tones: any = {
    blue: "from-blue-50 to-blue-100/50 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-700",
    amber: "from-amber-50 to-amber-100/50 text-amber-700",
    violet: "from-violet-50 to-violet-100/50 text-violet-700",
    red: "from-red-50 to-red-100/50 text-red-700",
  };
  return (
    <Card className={`bg-gradient-to-br ${tones[tone]} border-0`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium opacity-80">{label}</span>
          <Icon className="h-4 w-4 opacity-70" />
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

function ExpenseSummaryCard({ icon: Icon, label, total, tone }: { icon: any; label: string; total: number; tone: string }) {
  const tones: any = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-bold text-slate-900">{fmtMoney(total)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
