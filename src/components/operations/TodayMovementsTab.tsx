import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay, endOfDay, isToday, isTomorrow } from "date-fns";
import {
  Plane, PlaneTakeoff, PlaneLanding, Car, Hotel, MapPin, Clock, User,
  AlertTriangle, ChevronRight, ExternalLink, Calendar, Users,
  CheckCircle2, XCircle, Activity as ActivityIcon,
} from "lucide-react";

interface Props {
  companyId: string;
  isArabic: boolean;
}

type DayOffset = 0 | 1 | 2 | 7;

type MovementType = "pickup" | "dropoff" | "checkin" | "checkout" | "activity";

interface Movement {
  id: string;
  type: MovementType;
  time: string | null; // HH:MM
  title: string;
  subtitle?: string;
  location?: string;
  bookingId: string;
  bookingNumber?: string;
  bookingTitle?: string;
  driverName?: string;
  vehicleName?: string;
  pax?: number;
  status?: string;
}

const TYPE_CONFIG: Record<MovementType, { icon: any; color: string; label: string; labelAr: string }> = {
  pickup: { icon: Car, color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300", label: "Pickup", labelAr: "التقاط" },
  dropoff: { icon: Car, color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300", label: "Drop-off", labelAr: "إنزال" },
  checkin: { icon: PlaneLanding, color: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300", label: "Arrival", labelAr: "وصول" },
  checkout: { icon: PlaneTakeoff, color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300", label: "Departure", labelAr: "مغادرة" },
  activity: { icon: MapPin, color: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300", label: "Activity", labelAr: "نشاط" },
};

export function TodayMovementsTab({ companyId, isArabic }: Props) {
  const navigate = useNavigate();
  const [dayOffset, setDayOffset] = useState<DayOffset>(0);
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all");

  const targetDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
  const dateStr = format(targetDate, "yyyy-MM-dd");
  const dayStart = startOfDay(targetDate).toISOString();
  const dayEnd = endOfDay(targetDate).toISOString();

  // Service assignments (transfers w/ driver+vehicle)
  const { data: assignments = [] } = useQuery({
    queryKey: ["ops-assignments", companyId, dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_assignments")
        .select(`
          id, scheduled_start, scheduled_end, pickup_location, dropoff_location,
          passenger_count, status, booking_id,
          drivers(full_name),
          vehicles(name, plate_number),
          bookings(booking_number, title)
        `)
        .eq("company_id", companyId)
        .gte("scheduled_start", dayStart)
        .lte("scheduled_start", dayEnd)
        .order("scheduled_start", { ascending: true });
      return data || [];
    },
    enabled: !!companyId,
  });

  // Bookings arriving/departing today
  const { data: travelBookings = [] } = useQuery({
    queryKey: ["ops-travel-bookings", companyId, dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, booking_number, title, arrival_date, departure_date, adults, children, status, customers(full_name)")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(`arrival_date.eq.${dateStr},departure_date.eq.${dateStr}`);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Day items with start_time on this date
  const { data: dayItems = [] } = useQuery({
    queryKey: ["ops-day-items", companyId, dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_day_items")
        .select(`
          id, custom_title, start_time, duration_minutes, category,
          booking_days!inner(id, date, day_number, city, booking_id, bookings!inner(id, booking_number, title, company_id))
        `)
        .eq("booking_days.bookings.company_id", companyId)
        .eq("booking_days.date", dateStr);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Alerts: bookings starting in next 7 days without confirmation, services missing confirmation_number
  const { data: alerts = [] } = useQuery({
    queryKey: ["ops-alerts", companyId],
    queryFn: async () => {
      const inSevenDays = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: svcMissing } = await supabase
        .from("booking_services")
        .select("id, service_type, title, service_date, supplier_name, booking_id, status, bookings!inner(booking_number, arrival_date, status, company_id)")
        .eq("bookings.company_id", companyId)
        .in("status", ["pending", "confirmed"])
        .is("confirmation_number", null)
        .gte("service_date", today)
        .lte("service_date", inSevenDays);

      return (svcMissing || []).map((s: any) => ({
        kind: "missing_confirmation",
        id: s.id,
        booking_id: s.booking_id,
        booking_number: s.bookings?.booking_number,
        message: isArabic
          ? `${s.service_type} "${s.title}" بدون رقم تأكيد — ${format(new Date(s.service_date), "MMM d")}`
          : `${s.service_type} "${s.title}" missing confirmation — ${format(new Date(s.service_date), "MMM d")}`,
        severity: "warn",
      }));
    },
    enabled: !!companyId,
  });

  // Build unified movements
  const movements = useMemo<Movement[]>(() => {
    const out: Movement[] = [];

    for (const a of assignments as any[]) {
      const t = a.scheduled_start ? format(new Date(a.scheduled_start), "HH:mm") : null;
      out.push({
        id: `asg-${a.id}`,
        type: "pickup",
        time: t,
        title: a.pickup_location || (isArabic ? "نقل" : "Transfer"),
        subtitle: a.dropoff_location ? `→ ${a.dropoff_location}` : undefined,
        bookingId: a.booking_id,
        bookingNumber: a.bookings?.booking_number,
        bookingTitle: a.bookings?.title,
        driverName: a.drivers?.full_name,
        vehicleName: a.vehicles ? `${a.vehicles.name} · ${a.vehicles.plate_number}` : undefined,
        pax: a.passenger_count,
        status: a.status,
      });
    }

    for (const b of travelBookings as any[]) {
      const isArr = b.arrival_date === dateStr;
      const isDep = b.departure_date === dateStr;
      const pax = (b.adults || 0) + (b.children || 0);
      if (isArr) {
        out.push({
          id: `arr-${b.id}`,
          type: "checkin",
          time: null,
          title: b.customers?.full_name || b.title || (isArabic ? "حجز" : "Booking"),
          subtitle: isArabic ? "وصول الضيف" : "Guest arrival",
          bookingId: b.id,
          bookingNumber: b.booking_number,
          bookingTitle: b.title,
          pax,
          status: b.status,
        });
      }
      if (isDep) {
        out.push({
          id: `dep-${b.id}`,
          type: "checkout",
          time: null,
          title: b.customers?.full_name || b.title || (isArabic ? "حجز" : "Booking"),
          subtitle: isArabic ? "مغادرة الضيف" : "Guest departure",
          bookingId: b.id,
          bookingNumber: b.booking_number,
          bookingTitle: b.title,
          pax,
          status: b.status,
        });
      }
    }

    for (const it of dayItems as any[]) {
      if (it.category === "transfer") continue; // handled by assignments
      const day = it.booking_days;
      out.push({
        id: `item-${it.id}`,
        type: "activity",
        time: it.start_time || null,
        title: it.custom_title || it.category || (isArabic ? "نشاط" : "Activity"),
        subtitle: day?.city || undefined,
        location: day?.city,
        bookingId: day?.booking_id,
        bookingNumber: day?.bookings?.booking_number,
        bookingTitle: day?.bookings?.title,
      });
    }

    out.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

    return typeFilter === "all" ? out : out.filter(m => m.type === typeFilter);
  }, [assignments, travelBookings, dayItems, dateStr, typeFilter, isArabic]);

  const stats = useMemo(() => ({
    total: movements.length,
    pickups: movements.filter(m => m.type === "pickup").length,
    arrivals: movements.filter(m => m.type === "checkin").length,
    departures: movements.filter(m => m.type === "checkout").length,
    activities: movements.filter(m => m.type === "activity").length,
  }), [movements]);

  const dayLabel = isToday(targetDate)
    ? (isArabic ? "اليوم" : "Today")
    : isTomorrow(targetDate)
    ? (isArabic ? "غداً" : "Tomorrow")
    : format(targetDate, "EEE, MMM d");

  return (
    <div className="space-y-4">
      {/* Day selector + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
          {[0, 1, 2, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDayOffset(d as DayOffset)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors",
                dayOffset === d ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d === 0 ? (isArabic ? "اليوم" : "Today") :
               d === 1 ? (isArabic ? "غداً" : "Tomorrow") :
               d === 2 ? (isArabic ? "بعد غد" : "+2d") :
               (isArabic ? "أسبوع" : "+7d")}
            </button>
          ))}
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isArabic ? "كل الأنواع" : "All types"}</SelectItem>
            <SelectItem value="pickup">{isArabic ? "النقل" : "Transfers"}</SelectItem>
            <SelectItem value="checkin">{isArabic ? "الوصول" : "Arrivals"}</SelectItem>
            <SelectItem value="checkout">{isArabic ? "المغادرة" : "Departures"}</SelectItem>
            <SelectItem value="activity">{isArabic ? "الأنشطة" : "Activities"}</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ms-auto text-[10px] gap-1.5">
          <Calendar className="w-3 h-3" />
          {dayLabel} · {format(targetDate, "MMM d, yyyy")}
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatCard label={isArabic ? "إجمالي" : "Total"} value={stats.total} icon={ActivityIcon} color="text-foreground bg-muted" />
        <StatCard label={isArabic ? "نقل" : "Transfers"} value={stats.pickups} icon={Car} color="text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300" />
        <StatCard label={isArabic ? "وصول" : "Arrivals"} value={stats.arrivals} icon={PlaneLanding} color="text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <StatCard label={isArabic ? "مغادرة" : "Departures"} value={stats.departures} icon={PlaneTakeoff} color="text-blue-700 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300" />
        <StatCard label={isArabic ? "أنشطة" : "Activities"} value={stats.activities} icon={MapPin} color="text-purple-700 bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 font-display">
                {isArabic ? "تنبيهات تشغيلية" : "Service alerts"}
              </h4>
              <Badge variant="outline" className="text-[9px] border-amber-300">{alerts.length}</Badge>
            </div>
            <ul className="space-y-1">
              {alerts.slice(0, 5).map((a: any) => (
                <li key={a.id} className="flex items-center gap-2 text-[11px]">
                  <span className="text-amber-700 dark:text-amber-200 flex-1 truncate">{a.message}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => navigate(`/dashboard/bookings/${a.booking_id}`)}>
                    {a.booking_number} <ExternalLink className="w-2.5 h-2.5" />
                  </Button>
                </li>
              ))}
              {alerts.length > 5 && (
                <li className="text-[10px] text-amber-700/70">+{alerts.length - 5} {isArabic ? "إضافية" : "more"}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">{isArabic ? "لا توجد حركات في هذا اليوم" : "No movements scheduled for this day"}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {movements.map((m) => {
                const cfg = TYPE_CONFIG[m.type];
                const Icon = cfg.icon;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/dashboard/bookings/${m.bookingId}`)}
                  >
                    {/* Time column */}
                    <div className="w-14 shrink-0 text-end">
                      {m.time ? (
                        <span className="text-sm font-mono font-bold tabular-nums text-foreground">{m.time}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">{isArabic ? "بلا وقت" : "any time"}</span>
                      )}
                    </div>
                    {/* Type pill */}
                    <div className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold shrink-0", cfg.color)}>
                      <Icon className="w-3 h-3" />
                      <span>{isArabic ? cfg.labelAr : cfg.label}</span>
                    </div>
                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{m.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                        {m.subtitle && <span className="truncate">{m.subtitle}</span>}
                        {m.bookingNumber && (
                          <span className="font-mono">· {m.bookingNumber}</span>
                        )}
                        {m.driverName && (
                          <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {m.driverName}</span>
                        )}
                        {m.vehicleName && (
                          <span className="flex items-center gap-0.5"><Car className="w-2.5 h-2.5" /> {m.vehicleName}</span>
                        )}
                        {typeof m.pax === "number" && m.pax > 0 && (
                          <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> {m.pax}</span>
                        )}
                      </div>
                    </div>
                    {m.status && (
                      <Badge variant="outline" className="text-[9px] uppercase shrink-0">{m.status}</Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2.5">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider truncate">{label}</p>
        <p className="text-lg font-bold font-mono tabular-nums text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}
