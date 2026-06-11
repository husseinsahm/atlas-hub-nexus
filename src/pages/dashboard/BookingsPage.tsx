import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UsageWarningBanner } from "@/components/plan/UsageWarningBanner";
import { LimitReachedDialog } from "@/components/plan/LimitReachedDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Filter, Plus, Calendar, Users, DollarSign,
  Loader2, Briefcase, ChevronRight, Clock, Plane, X,
  User, Phone, Mail, Globe, MapPin, ArrowUpDown, ArrowDown, ArrowUp,
  MoreHorizontal, Trash2, UserCheck, Download, CheckSquare,
  ChevronLeft, ChevronsLeft, ChevronsRight, Library,
} from "lucide-react";
import { RecipeLibraryDialog } from "@/components/recipes/RecipeLibraryDialog";
import { NationalitySelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { NoBookingsEmptyState, NoSearchResultsEmptyState } from "@/components/ui/empty-state";
import { StatsGridLoadingState, TableLoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type BookingStatus = "tentative" | "confirmed" | "in_operation" | "completed" | "cancelled";
type SortField = "created_at" | "arrival_date" | "selling_price" | "status";
type SortDir = "asc" | "desc";

const STEPS = [
  { id: 0, label: "Client", labelAr: "العميل", icon: User },
  { id: 1, label: "Trip", labelAr: "الرحلة", icon: Plane },
  { id: 2, label: "Details", labelAr: "التفاصيل", icon: Briefcase },
];

const STATUS_CONFIG: Record<BookingStatus, { label: string; labelAr: string; color: string; bg: string; dot: string; pillBg: string; pillText: string }> = {
  tentative: { label: "Tentative", labelAr: "مبدئي", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", dot: "bg-amber-500", pillBg: "bg-amber-100 dark:bg-amber-900/50", pillText: "text-amber-700 dark:text-amber-300" },
  confirmed: { label: "Confirmed", labelAr: "مؤكد", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", dot: "bg-blue-500", pillBg: "bg-blue-100 dark:bg-blue-900/50", pillText: "text-blue-700 dark:text-blue-300" },
  in_operation: { label: "In Operation", labelAr: "قيد التنفيذ", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", dot: "bg-emerald-500", pillBg: "bg-emerald-100 dark:bg-emerald-900/50", pillText: "text-emerald-700 dark:text-emerald-300" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/40", dot: "bg-slate-400", pillBg: "bg-slate-100 dark:bg-slate-800/50", pillText: "text-slate-600 dark:text-slate-400" },
  cancelled: { label: "Cancelled", labelAr: "ملغي", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", dot: "bg-red-500", pillBg: "bg-red-100 dark:bg-red-900/50", pillText: "text-red-700 dark:text-red-300" },
};

const PIPELINE_ORDER: BookingStatus[] = ["tentative", "confirmed", "in_operation", "completed"];

const SOURCES = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "walk_in", label: "Walk-in" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const ITEMS_PER_PAGE = 10;

export default function BookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";
  const [step, setStep] = useState(0);

  const { limits, usagePercent, refetch: refetchLimits } = usePlanLimits();
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const handleNewBookingClick = () => {
    if (!limits.canCreateTrip) {
      setLimitDialogOpen(true);
      return;
    }
    setShowNewDialog(true);
  };

  const [newBooking, setNewBooking] = useState({
    title: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_nationality: "",
    source: "email",
    arrival_date: "",
    departure_date: "",
    adults: 1,
    children: 0,
    notes: "",
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customers(full_name, email, phone)")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("booking_prefix, booking_next_number")
        .eq("company_id", companyId!)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");

      const prefix = companySettings?.booking_prefix || "BKG";
      const nextNum = companySettings?.booking_next_number || 1;
      const bookingNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      let totalDays = 1;
      if (newBooking.arrival_date && newBooking.departure_date) {
        const start = new Date(newBooking.arrival_date);
        const end = new Date(newBooking.departure_date);
        totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }

      let customerId = null;
      if (newBooking.customer_name.trim()) {
        const { data: customer, error: custErr } = await supabase
          .from("customers")
          .insert({
            company_id: companyId,
            full_name: newBooking.customer_name.trim(),
            email: newBooking.customer_email.trim() || null,
            phone: newBooking.customer_phone.trim() || null,
            nationality: newBooking.customer_nationality.trim() || null,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = customer.id;
      }

      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          company_id: companyId,
          booking_number: bookingNumber,
          title: newBooking.title.trim() || `Booking ${bookingNumber}`,
          customer_id: customerId,
          source: newBooking.source,
          arrival_date: newBooking.arrival_date || null,
          departure_date: newBooking.departure_date || null,
          start_date: newBooking.arrival_date || null,
          end_date: newBooking.departure_date || null,
          total_days: totalDays,
          adults: newBooking.adults,
          children: newBooking.children,
          internal_notes: newBooking.notes.trim() || null,
          status: "tentative",
          created_by: user?.id,
          assigned_to: user?.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase
        .from("company_settings")
        .update({ booking_next_number: nextNum + 1 })
        .eq("company_id", companyId);

      await supabase.from("booking_activities").insert({
        booking_id: booking.id,
        activity_type: "created",
        title: "Booking file created",
        user_id: user?.id,
      });

      return booking;
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setShowNewDialog(false);
      setNewBooking({
        title: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_nationality: "",
        source: "email",
        arrival_date: "",
        departure_date: "",
        adults: 1,
        children: 0,
        notes: "",
      });
      toast({ title: isArabic ? "تم إنشاء ملف الحجز" : "Booking file created" });
      navigate(`/dashboard/bookings/${booking.id}`);
    },
    onError: () => {
      toast({ title: isArabic ? "خطأ في الإنشاء" : "Failed to create booking", variant: "destructive" });
    },
  });

  // Stats for pipeline
  const stats = useMemo(() => {
    const s: Record<string, number> = { tentative: 0, confirmed: 0, in_operation: 0, completed: 0, cancelled: 0 };
    let totalRevenue = 0;
    bookings.forEach((b: any) => {
      if (s[b.status] !== undefined) s[b.status]++;
      if (b.status !== "cancelled") totalRevenue += Number(b.selling_price || 0);
    });
    return { ...s, totalRevenue };
  }, [bookings]);

  // Filtered, sorted, and paginated data
  const filteredAndSorted = useMemo(() => {
    let list = [...bookings];

    // Filter by status
    if (statusFilter !== "all") {
      list = list.filter((b: any) => b.status === statusFilter);
    }

    // Filter by source
    if (sourceFilter !== "all") {
      list = list.filter((b: any) => b.source === sourceFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b: any) =>
        b.title?.toLowerCase().includes(q) ||
        b.booking_number?.toLowerCase().includes(q) ||
        (b as any).customers?.full_name?.toLowerCase().includes(q) ||
        (b as any).customers?.email?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a: any, b: any) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "arrival_date":
          aVal = a.arrival_date || a.start_date || "";
          bVal = b.arrival_date || b.start_date || "";
          break;
        case "selling_price":
          aVal = Number(a.selling_price || 0);
          bVal = Number(b.selling_price || 0);
          break;
        case "status":
          const statusOrder = { tentative: 0, confirmed: 1, in_operation: 2, completed: 3, cancelled: 4 };
          aVal = statusOrder[a.status as BookingStatus] ?? 5;
          bVal = statusOrder[b.status as BookingStatus] ?? 5;
          break;
        default:
          aVal = a.created_at || "";
          bVal = b.created_at || "";
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [bookings, statusFilter, sourceFilter, search, sortField, sortDir]);

  const totalPages = Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE);
  const paginatedList = filteredAndSorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedList.map((b: any) => b.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSourceFilter("all");
    setSearch("");
    setCurrentPage(1);
  };

  const activeFilters = [
    ...(statusFilter !== "all" ? [{ key: "status", label: STATUS_CONFIG[statusFilter as BookingStatus]?.label || statusFilter, clear: () => setStatusFilter("all") }] : []),
    ...(sourceFilter !== "all" ? [{ key: "source", label: SOURCES.find(s => s.value === sourceFilter)?.label || sourceFilter, clear: () => setSourceFilter("all") }] : []),
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatsGridLoadingState count={4} className="grid-cols-4" />
        <TableLoadingState rows={6} columns={7} />
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ms-1 opacity-50" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ms-1" /> : <ArrowDown className="w-3 h-3 ms-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Usage warnings */}
      <UsageWarningBanner />

      {/* Limit reached dialog */}
      <LimitReachedDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen} type="trips" />

      {/* ─── Premium Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {isArabic ? "الحجوزات" : "Bookings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {bookings.length} {isArabic ? "حجز إجمالي" : "total bookings"}
          </p>
        </div>
        <Button onClick={handleNewBookingClick} className="gold-gradient text-accent-foreground gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Plus className="w-4 h-4" />
          {isArabic ? "حجز جديد" : "New Booking"}
        </Button>
      </motion.div>

      {/* ─── Pipeline Summary Bar ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            {PIPELINE_ORDER.map((status, idx) => {
              const cfg = STATUS_CONFIG[status];
              const count = stats[status] || 0;
              const isActive = statusFilter === status;
              return (
                <div key={status} className="flex items-center">
                  <button
                    onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
                    className={cn(
                      "relative flex flex-col items-center px-4 py-2 rounded-lg transition-all min-w-[80px]",
                      isActive
                        ? cn(cfg.bg, "ring-2 ring-offset-1 ring-offset-background", cfg.color.replace("text-", "ring-"))
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span className={cn("text-2xl font-bold tabular-nums", isActive ? cfg.color : "text-foreground")}>
                      {count}
                    </span>
                    <span className={cn("text-[10px] font-medium uppercase tracking-wide", isActive ? cfg.color : "text-muted-foreground")}>
                      {isArabic ? cfg.labelAr : cfg.label}
                    </span>
                    <div className={cn("absolute bottom-0 inset-x-4 h-0.5 rounded-full", cfg.dot, isActive ? "opacity-100" : "opacity-30")} />
                  </button>
                  {idx < PIPELINE_ORDER.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 ps-4 border-s border-border">
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{isArabic ? "إجمالي الإيرادات" : "Total Revenue"}</p>
              <p className="text-xl font-bold font-mono text-foreground">
                {stats.totalRevenue.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ms-1">USD</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Filters Row ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isArabic ? "بحث بالاسم، رقم الحجز..." : "Search by name, booking ID..."}
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="ps-10 h-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-36 h-9">
            <Filter className="w-3.5 h-3.5 me-2 text-muted-foreground" />
            <SelectValue placeholder={isArabic ? "الحالة" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isArabic ? "جميع الحالات" : "All Statuses"}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", v.dot)} />
                  {isArabic ? v.labelAr : v.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source filter */}
        <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-32 h-9">
            <Globe className="w-3.5 h-3.5 me-2 text-muted-foreground" />
            <SelectValue placeholder={isArabic ? "المصدر" : "Source"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isArabic ? "جميع المصادر" : "All Sources"}</SelectItem>
            {SOURCES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2">
            {activeFilters.map(f => (
              <Badge
                key={f.key}
                variant="secondary"
                className="gap-1.5 pe-1.5 text-xs cursor-pointer hover:bg-secondary/80"
                onClick={f.clear}
              >
                {f.label}
                <X className="w-3 h-3" />
              </Badge>
            ))}
            {activeFilters.length > 1 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-muted-foreground">
                {isArabic ? "مسح الكل" : "Clear all"}
              </Button>
            )}
          </div>
        )}
      </motion.div>

      {/* ─── Bookings Table ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {filteredAndSorted.length === 0 ? (
          search.trim() || statusFilter !== "all" || sourceFilter !== "all" ? (
            <NoSearchResultsEmptyState query={search} onClear={clearFilters} />
          ) : (
            <NoBookingsEmptyState onAction={() => setShowNewDialog(true)} />
          )
        ) : (
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="modern-table">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === paginatedList.length && paginatedList.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-28">{isArabic ? "رقم الحجز" : "Booking ID"}</TableHead>
                    <TableHead>{isArabic ? "العميل" : "Client"}</TableHead>
                    <TableHead>{isArabic ? "الرحلة" : "Trip"}</TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("arrival_date")} className="flex items-center font-medium hover:text-foreground">
                        {isArabic ? "التواريخ" : "Dates"}
                        <SortIcon field="arrival_date" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">{isArabic ? "المسافرون" : "Travelers"}</TableHead>
                    <TableHead className="text-end">
                      <button onClick={() => handleSort("selling_price")} className="flex items-center justify-end font-medium hover:text-foreground ms-auto">
                        {isArabic ? "المبلغ" : "Amount"}
                        <SortIcon field="selling_price" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("status")} className="flex items-center font-medium hover:text-foreground">
                        {isArabic ? "الحالة" : "Status"}
                        <SortIcon field="status" />
                      </button>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedList.map((booking: any, idx: number) => {
                    const sc = STATUS_CONFIG[booking.status as BookingStatus] || STATUS_CONFIG.tentative;
                    const customer = (booking as any).customers;
                    const initials = customer?.full_name
                      ? customer.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                      : "?";

                    return (
                      <TableRow
                        key={booking.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedIds.has(booking.id) && "bg-accent/5"
                        )}
                        onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(booking.id)}
                            onCheckedChange={() => toggleSelect(booking.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] bg-muted/50">
                            {booking.booking_number}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {customer?.full_name || <span className="text-muted-foreground italic">{isArabic ? "بدون اسم" : "No name"}</span>}
                              </p>
                              {customer?.email && (
                                <p className="text-[10px] text-muted-foreground truncate">{customer.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                            {booking.title}
                          </p>
                        </TableCell>
                        <TableCell>
                          {booking.arrival_date || booking.start_date ? (
                            <span className="text-xs text-foreground whitespace-nowrap">
                              {format(new Date(booking.arrival_date || booking.start_date), "MMM d")}
                              {(booking.departure_date || booking.end_date) && (
                                <span className="text-muted-foreground"> → {format(new Date(booking.departure_date || booking.end_date), "MMM d")}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-medium">
                            {booking.adults}A{booking.children > 0 ? ` ${booking.children}C` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-end">
                          {booking.selling_price > 0 ? (
                            <span className="text-sm font-mono font-semibold text-foreground">
                              {Number(booking.selling_price).toLocaleString()}
                              <span className="text-[10px] font-normal text-muted-foreground ms-1">{booking.currency}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-0 text-[10px] font-semibold", sc.pillBg, sc.pillText)}>
                            {isArabic ? sc.labelAr : sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}>
                                <Briefcase className="w-4 h-4 me-2" />
                                {isArabic ? "عرض التفاصيل" : "View Details"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <Trash2 className="w-4 h-4 me-2" />
                                {isArabic ? "حذف" : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                {isArabic ? `عرض ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSorted.length)} من ${filteredAndSorted.length}` : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSorted.length)} of ${filteredAndSorted.length}`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </motion.div>

      {/* ─── Bulk Actions Bar ─── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl bg-foreground text-background shadow-2xl border border-background/10">
              <CheckSquare className="w-4 h-4" />
              <span className="text-sm font-medium">
                {selectedIds.size} {isArabic ? "محدد" : "selected"}
              </span>
              <div className="h-5 w-px bg-background/20" />
              <Button variant="ghost" size="sm" className="text-background hover:bg-background/20 h-7 text-xs">
                <UserCheck className="w-3.5 h-3.5 me-1.5" />
                {isArabic ? "تعيين موظف" : "Assign Agent"}
              </Button>
              <Button variant="ghost" size="sm" className="text-background hover:bg-background/20 h-7 text-xs">
                <Download className="w-3.5 h-3.5 me-1.5" />
                {isArabic ? "تصدير" : "Export"}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/20 h-7 text-xs">
                <Trash2 className="w-3.5 h-3.5 me-1.5" />
                {isArabic ? "حذف" : "Delete"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-background/60 hover:text-background hover:bg-background/20"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── New Booking Dialog ─── */}
      <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) setStep(0); }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="relative px-6 pt-6 pb-4 navy-gradient">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--gold)/0.3),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
                  <Briefcase className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    {isArabic ? "ملف حجز جديد" : "New Booking File"}
                  </h2>
                  <p className="text-[11px] text-white/60">
                    {isArabic ? STEPS[step].labelAr : STEPS[step].label} — {isArabic ? `الخطوة ${step + 1} من 3` : `Step ${step + 1} of 3`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {STEPS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStep(s.id)}
                    className={cn(
                      "flex-1 h-1.5 rounded-full transition-all duration-300",
                      s.id <= step ? "bg-accent" : "bg-white/20"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {step === 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">{isArabic ? "اسم العميل" : "Customer Name"} <span className="text-destructive">*</span></Label>
                      <Input
                        value={newBooking.customer_name}
                        onChange={e => setNewBooking({ ...newBooking, customer_name: e.target.value })}
                        placeholder={isArabic ? "الاسم الكامل" : "Full name"}
                        className="h-11"
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{isArabic ? "البريد الإلكتروني" : "Email"}</Label>
                        <div className="relative">
                          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={newBooking.customer_email}
                            onChange={e => setNewBooking({ ...newBooking, customer_email: e.target.value })}
                            placeholder="email@example.com"
                            className="h-11 ps-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{isArabic ? "رقم الهاتف" : "Phone"}</Label>
                        <PhoneInput
                          value={newBooking.customer_phone}
                          onValueChange={v => setNewBooking({ ...newBooking, customer_phone: v })}
                          defaultCountry="AE"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{isArabic ? "الجنسية" : "Nationality"}</Label>
                        <NationalitySelect
                          value={newBooking.customer_nationality}
                          onValueChange={v => setNewBooking({ ...newBooking, customer_nationality: v })}
                          placeholder={isArabic ? "اختر الجنسية" : "Select nationality"}
                          isRtl={isArabic}
                        />
                      </div>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{isArabic ? "عنوان الحجز" : "Booking Title"}</Label>
                      <Input
                        value={newBooking.title}
                        onChange={e => setNewBooking({ ...newBooking, title: e.target.value })}
                        placeholder={isArabic ? "رحلة عائلة أحمد - دبي" : "Ahmed Family — Dubai Trip"}
                        className="h-11"
                        autoFocus
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {isArabic ? "اختياري — سيتم إنشاء عنوان تلقائياً إن تُرك فارغاً" : "Optional — auto-generated if left empty"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Plane className="w-3 h-3 text-accent" />
                          {isArabic ? "الوصول" : "Arrival"}
                        </Label>
                        <Input
                          type="date"
                          value={newBooking.arrival_date}
                          onChange={e => setNewBooking({ ...newBooking, arrival_date: e.target.value })}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Plane className="w-3 h-3 text-muted-foreground rotate-90" />
                          {isArabic ? "المغادرة" : "Departure"}
                        </Label>
                        <Input
                          type="date"
                          value={newBooking.departure_date}
                          onChange={e => setNewBooking({ ...newBooking, departure_date: e.target.value })}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-accent" />
                        {isArabic ? "المسافرون" : "Travelers"}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                          <div>
                            <p className="text-xs font-medium text-foreground">{isArabic ? "كبار" : "Adults"}</p>
                            <p className="text-[10px] text-muted-foreground">{isArabic ? "12+ سنة" : "12+ years"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setNewBooking({ ...newBooking, adults: Math.max(1, newBooking.adults - 1) })}
                              className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition-colors"
                            >−</button>
                            <span className="text-sm font-bold text-foreground w-5 text-center">{newBooking.adults}</span>
                            <button
                              type="button"
                              onClick={() => setNewBooking({ ...newBooking, adults: newBooking.adults + 1 })}
                              className="w-7 h-7 rounded-full border border-accent bg-accent/10 flex items-center justify-center text-accent hover:bg-accent/20 transition-colors"
                            >+</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                          <div>
                            <p className="text-xs font-medium text-foreground">{isArabic ? "أطفال" : "Children"}</p>
                            <p className="text-[10px] text-muted-foreground">{isArabic ? "2-11 سنة" : "2-11 years"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setNewBooking({ ...newBooking, children: Math.max(0, newBooking.children - 1) })}
                              className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center text-foreground hover:bg-muted transition-colors"
                            >−</button>
                            <span className="text-sm font-bold text-foreground w-5 text-center">{newBooking.children}</span>
                            <button
                              type="button"
                              onClick={() => setNewBooking({ ...newBooking, children: newBooking.children + 1 })}
                              className="w-7 h-7 rounded-full border border-accent bg-accent/10 flex items-center justify-center text-accent hover:bg-accent/20 transition-colors"
                            >+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{isArabic ? "مصدر الحجز" : "Booking Source"}</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {SOURCES.map(s => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setNewBooking({ ...newBooking, source: s.value })}
                            className={cn(
                              "rounded-lg border px-2 py-2.5 text-[10px] font-medium transition-all text-center",
                              newBooking.source === s.value
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">{isArabic ? "ملاحظات" : "Notes"}</Label>
                      <Textarea
                        value={newBooking.notes}
                        onChange={e => setNewBooking({ ...newBooking, notes: e.target.value })}
                        placeholder={isArabic ? "أي ملاحظات أو متطلبات خاصة..." : "Special requirements, preferences, or initial notes..."}
                        rows={4}
                        className="text-sm resize-none"
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {isArabic ? "ملخص" : "Summary"}
                      </p>
                      <div className="space-y-1.5 text-xs">
                        {newBooking.customer_name && (
                          <div className="flex items-center gap-2 text-foreground">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{newBooking.customer_name}</span>
                          </div>
                        )}
                        {(newBooking.arrival_date || newBooking.departure_date) && (
                          <div className="flex items-center gap-2 text-foreground">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>{newBooking.arrival_date && format(new Date(newBooking.arrival_date), "MMM d")} → {newBooking.departure_date && format(new Date(newBooking.departure_date), "MMM d, yyyy")}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-foreground">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <span>{newBooking.adults} {isArabic ? "كبار" : "Adults"}{newBooking.children > 0 ? ` · ${newBooking.children} ${isArabic ? "أطفال" : "Children"}` : ""}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => step === 0 ? setShowNewDialog(false) : setStep(step - 1)}
              className="text-xs"
            >
              {step === 0 ? (isArabic ? "إلغاء" : "Cancel") : (isArabic ? "السابق" : "Back")}
            </Button>
            {step < 2 ? (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !newBooking.customer_name.trim()}
                className="gold-gradient text-accent-foreground text-xs gap-1.5 px-6"
              >
                {isArabic ? "التالي" : "Next"}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => createBookingMutation.mutate()}
                disabled={!newBooking.customer_name.trim() || createBookingMutation.isPending}
                className="gold-gradient text-accent-foreground text-xs gap-1.5 px-6"
              >
                {createBookingMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isArabic ? "إنشاء الحجز" : "Create Booking"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
