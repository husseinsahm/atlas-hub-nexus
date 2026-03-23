import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";
import { motion } from "framer-motion";
import {
  Search, Filter, Calendar, Users, Plane, Hotel, Car, MapPin, User,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Loader2, Eye,
  FileText, Phone, Mail, CalendarDays, Briefcase, RefreshCw, Ticket, Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, parseISO, isWithinInterval, addDays, subDays } from "date-fns";

type BookingStatus = "confirmed" | "in_operation" | "completed";

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; bg: string; dot: string }> = {
  confirmed: { label: "Confirmed", labelAr: "مؤكد", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500" },
  in_operation: { label: "In Operation", labelAr: "قيد التنفيذ", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
};

const SERVICE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-slate-700", bg: "bg-slate-100" },
  confirmed: { label: "Confirmed", color: "text-blue-700", bg: "bg-blue-50" },
  booked: { label: "Booked", color: "text-emerald-700", bg: "bg-emerald-50" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50" },
};

export default function OperationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { limits, hasFeature } = usePlanLimits();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";
  const isLockedForFree = limits.planSlug === "free" && !hasFeature("operations");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("upcoming");
  const [activeTab, setActiveTab] = useState("bookings");

  // Fetch confirmed/in_operation bookings
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["operations-bookings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customers(full_name, email, phone),
          booking_services(id, service_type, title, status, service_date, supplier_name, confirmation_number),
          booking_travelers(id, full_name, is_lead_traveler)
        `)
        .eq("company_id", companyId!)
        .in("status", ["confirmed", "in_operation", "completed"])
        .is("deleted_at", null)
        .order("arrival_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch services needing confirmation
  const { data: pendingServices = [] } = useQuery({
    queryKey: ["pending-services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_services")
        .select(`
          *,
          bookings!inner(id, booking_number, title, arrival_date, status, company_id)
        `)
        .eq("company_id", companyId!)
        .eq("status", "pending")
        .order("service_date", { ascending: true });
      if (error) throw error;
      return data.filter((s: any) => s.bookings?.status !== "cancelled");
    },
    enabled: !!companyId,
  });

  const updateServiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("booking_services").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["pending-services"] });
      toast({ title: isArabic ? "تم تحديث الحالة" : "Status updated" });
    },
  });

  // Filter bookings
  const filtered = useMemo(() => {
    const now = new Date();
    let list = bookings;

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((b: any) => b.status === statusFilter);
    }

    // Date filter
    if (dateFilter === "today") {
      list = list.filter((b: any) => {
        if (!b.arrival_date) return false;
        const arr = parseISO(b.arrival_date);
        return format(arr, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
      });
    } else if (dateFilter === "upcoming") {
      list = list.filter((b: any) => {
        if (!b.arrival_date) return false;
        const arr = parseISO(b.arrival_date);
        return isWithinInterval(arr, { start: now, end: addDays(now, 14) });
      });
    } else if (dateFilter === "past") {
      list = list.filter((b: any) => {
        if (!b.arrival_date) return false;
        const arr = parseISO(b.arrival_date);
        return arr < subDays(now, 1);
      });
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b: any) =>
        b.title?.toLowerCase().includes(q) ||
        b.booking_number?.toLowerCase().includes(q) ||
        (b.customers as any)?.full_name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [bookings, statusFilter, dateFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const confirmedCount = bookings.filter((b: any) => b.status === "confirmed").length;
    const inOpCount = bookings.filter((b: any) => b.status === "in_operation").length;
    const pendingServicesCount = pendingServices.length;
    
    const now = new Date();
    const todayArrivals = bookings.filter((b: any) => {
      if (!b.arrival_date || b.status === "completed") return false;
      return format(parseISO(b.arrival_date), "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    }).length;

    return { confirmedCount, inOpCount, pendingServicesCount, todayArrivals };
  }, [bookings, pendingServices]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isLockedForFree && (
        <LockOverlay planRequired="Starter" featureName={isArabic ? "العمليات" : "Operations"} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {isArabic ? "العمليات" : "Operations"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isArabic ? "إدارة الحجوزات المؤكدة والخدمات" : "Manage confirmed bookings and services"}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["operations-bookings"] })}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" /> {isArabic ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{stats.todayArrivals}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isArabic ? "وصول اليوم" : "Today's Arrivals"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{stats.confirmedCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isArabic ? "مؤكد" : "Confirmed"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Plane className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{stats.inOpCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isArabic ? "قيد التنفيذ" : "In Operation"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display text-foreground">{stats.pendingServicesCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isArabic ? "خدمات معلقة" : "Pending Services"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="bookings" className="gap-2">
            <Briefcase className="w-4 h-4" />
            {isArabic ? "الحجوزات" : "Bookings"}
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Hotel className="w-4 h-4" />
            {isArabic ? "الخدمات المعلقة" : "Pending Services"}
            {pendingServices.length > 0 && (
              <Badge variant="destructive" className="ms-1 text-[10px] px-1.5">{pendingServices.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isArabic ? "بحث..." : "Search bookings..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={isArabic ? "الحالة" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
                <SelectItem value="confirmed">{isArabic ? "مؤكد" : "Confirmed"}</SelectItem>
                <SelectItem value="in_operation">{isArabic ? "قيد التنفيذ" : "In Operation"}</SelectItem>
                <SelectItem value="completed">{isArabic ? "مكتمل" : "Completed"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={isArabic ? "التاريخ" : "Date"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
                <SelectItem value="today">{isArabic ? "اليوم" : "Today"}</SelectItem>
                <SelectItem value="upcoming">{isArabic ? "القادم" : "Upcoming"}</SelectItem>
                <SelectItem value="past">{isArabic ? "السابق" : "Past"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bookings List */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">
                {isArabic ? "لا توجد حجوزات" : "No bookings found"}
              </h3>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((booking: any, idx: number) => {
                const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
                const customer = booking.customers;
                const travelers = booking.booking_travelers || [];
                const services = booking.booking_services || [];
                const pendingCount = services.filter((s: any) => s.status === "pending").length;

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card
                      className="border-border hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Status indicator */}
                          <div className="relative mt-1">
                            <div className={cn("w-3 h-3 rounded-full", sc.dot)} />
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{booking.booking_number}</span>
                              <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>
                                {isArabic ? sc.labelAr : sc.label}
                              </Badge>
                              {pendingCount > 0 && (
                                <Badge variant="destructive" className="text-[9px]">
                                  {pendingCount} {isArabic ? "معلق" : "pending"}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-sm font-semibold text-foreground truncate mt-1">{booking.title}</h3>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              {customer?.full_name && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" /> {customer.full_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" /> {travelers.length} {isArabic ? "مسافر" : "travelers"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Hotel className="w-3 h-3" /> {services.length} {isArabic ? "خدمة" : "services"}
                              </span>
                            </div>
                          </div>

                          {/* Dates */}
                          <div className="text-right shrink-0">
                            {booking.arrival_date && (
                              <div className="flex items-center gap-2 justify-end">
                                <Plane className="w-3 h-3 text-muted-foreground" />
                                <span className="text-sm font-semibold text-foreground">
                                  {format(parseISO(booking.arrival_date), "MMM d")}
                                </span>
                              </div>
                            )}
                            {booking.departure_date && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                → {format(parseISO(booking.departure_date), "MMM d")}
                              </p>
                            )}
                          </div>

                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          {pendingServices.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">
                {isArabic ? "لا توجد خدمات معلقة" : "All services confirmed"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isArabic ? "جميع الخدمات مؤكدة" : "No pending services need attention"}
              </p>
            </div>
          ) : (
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? "الحجز" : "Booking"}</TableHead>
                    <TableHead>{isArabic ? "الخدمة" : "Service"}</TableHead>
                    <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                    <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-right">{isArabic ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingServices.map((service: any) => {
                    const ssc = SERVICE_STATUS_CONFIG[service.status] || SERVICE_STATUS_CONFIG.pending;
                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div 
                            className="cursor-pointer hover:underline"
                            onClick={() => navigate(`/dashboard/bookings/${service.booking_id}`)}
                          >
                            <p className="font-medium text-sm">{(service.bookings as any)?.booking_number}</p>
                            <p className="text-xs text-muted-foreground">{(service.bookings as any)?.title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {service.service_type === "hotel" && <Hotel className="w-4 h-4 text-blue-600" />}
                            {service.service_type === "transfer" && <Car className="w-4 h-4 text-purple-600" />}
                            {service.service_type === "tour" && <MapPin className="w-4 h-4 text-emerald-600" />}
                            {service.service_type === "guide" && <User className="w-4 h-4 text-cyan-600" />}
                            {service.service_type === "flight" && <Plane className="w-4 h-4 text-sky-600" />}
                            {service.service_type === "visa" && <Stamp className="w-4 h-4 text-orange-600" />}
                            {service.service_type === "entrance" && <Ticket className="w-4 h-4 text-pink-600" />}
                            <span className="text-sm">{service.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {service.supplier_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {service.service_date ? format(parseISO(service.service_date), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-0 text-[10px]", ssc.bg, ssc.color)}>
                            {ssc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateServiceStatus.mutate({ id: service.id, status: "confirmed" });
                            }}
                            className="text-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {isArabic ? "تأكيد" : "Confirm"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
