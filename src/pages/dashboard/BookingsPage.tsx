import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Filter, Plus, Calendar, Users, DollarSign,
  Loader2, Briefcase, ChevronRight, Clock, Plane, X,
  User, Phone, Mail, Globe, MapPin,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type BookingStatus = "tentative" | "confirmed" | "in_operation" | "completed" | "cancelled";

const STEPS = [
  { id: 0, label: "Client", labelAr: "العميل", icon: User },
  { id: 1, label: "Trip", labelAr: "الرحلة", icon: Plane },
  { id: 2, label: "Details", labelAr: "التفاصيل", icon: Briefcase },
];

const STATUS_CONFIG: Record<BookingStatus, { label: string; labelAr: string; color: string; bg: string; dot: string }> = {
  tentative: { label: "Tentative", labelAr: "مبدئي", color: "text-slate-700", bg: "bg-slate-100", dot: "bg-slate-400" },
  confirmed: { label: "Confirmed", labelAr: "مؤكد", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500" },
  in_operation: { label: "In Operation", labelAr: "قيد التنفيذ", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", labelAr: "ملغي", color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500" },
};

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

export default function BookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";
  const [step, setStep] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
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

  // Fetch company settings for booking number prefix
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

      // Generate booking number
      const prefix = companySettings?.booking_prefix || "BKG";
      const nextNum = companySettings?.booking_next_number || 1;
      const bookingNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      // Calculate total days
      let totalDays = 1;
      if (newBooking.arrival_date && newBooking.departure_date) {
        const start = new Date(newBooking.arrival_date);
        const end = new Date(newBooking.departure_date);
        totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Create customer first if name provided
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

      // Create booking
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

      // Increment booking number
      await supabase
        .from("company_settings")
        .update({ booking_next_number: nextNum + 1 })
        .eq("company_id", companyId);

      // Create booking activity
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

  const filtered = useMemo(() => {
    let list = bookings;
    if (statusFilter !== "all") list = list.filter((b: any) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b: any) =>
        b.title?.toLowerCase().includes(q) ||
        b.booking_number?.toLowerCase().includes(q) ||
        (b as any).customers?.full_name?.toLowerCase().includes(q) ||
        (b as any).customers?.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, statusFilter, search]);

  const stats = useMemo(() => {
    const s: Record<string, number> = { tentative: 0, confirmed: 0, in_operation: 0, completed: 0, cancelled: 0 };
    bookings.forEach((b: any) => { if (s[b.status] !== undefined) s[b.status]++; });
    return s;
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <StatsGridLoadingState count={5} className="grid-cols-5" />
        <TableLoadingState rows={6} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {isArabic ? "ملفات الحجز" : "Booking Files"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isArabic ? "إدارة حجوزات العملاء والعمليات" : "Manage customer bookings and operations"}
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="gold-gradient text-accent-foreground gap-2">
          <Plus className="w-4 h-4" />
          {isArabic ? "حجز جديد" : "New Booking"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {(Object.entries(STATUS_CONFIG) as [BookingStatus, typeof STATUS_CONFIG[BookingStatus]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              statusFilter === key ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isArabic ? cfg.labelAr : cfg.label}
              </span>
            </div>
            <div className="text-xl font-bold font-display text-foreground mt-1">{stats[key] || 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={isArabic ? "بحث في الحجوزات..." : "Search bookings..."} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="w-3.5 h-3.5 mr-2" />
            <SelectValue placeholder={isArabic ? "جميع الحالات" : "All statuses"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isArabic ? "جميع الحالات" : "All Statuses"}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        search.trim() ? (
          <NoSearchResultsEmptyState query={search} onClear={() => setSearch("")} />
        ) : (
          <NoBookingsEmptyState onAction={() => setShowNewDialog(true)} />
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((booking: any, idx: number) => {
            const sc = STATUS_CONFIG[booking.status as BookingStatus] || STATUS_CONFIG.tentative;
            const customer = (booking as any).customers;
            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card
                  className="border-border hover:shadow-md hover:border-foreground/10 transition-all cursor-pointer group"
                  onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Status dot & booking icon */}
                      <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-accent" />
                        </div>
                        <div className={cn("absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card", sc.dot)} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-muted-foreground">{booking.booking_number}</span>
                          <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>
                            {isArabic ? sc.labelAr : sc.label}
                          </Badge>
                          {booking.source && (
                            <Badge variant="outline" className="text-[9px] capitalize">{booking.source}</Badge>
                          )}
                          {booking.payment_status !== "unpaid" && (
                            <Badge variant="outline" className="text-[9px]">
                              <DollarSign className="w-2.5 h-2.5 mr-0.5" />
                              {booking.payment_status}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-foreground truncate mt-0.5">{booking.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                          {customer?.full_name && (
                            <span className="flex items-center gap-0.5">
                              <User className="w-2.5 h-2.5" /> {customer.full_name}
                            </span>
                          )}
                          {(booking.arrival_date || booking.start_date) && (
                            <span className="flex items-center gap-0.5">
                              <Plane className="w-2.5 h-2.5" /> 
                              {format(new Date(booking.arrival_date || booking.start_date), "MMM d")}
                              {(booking.departure_date || booking.end_date) && (
                                <> → {format(new Date(booking.departure_date || booking.end_date), "MMM d")}</>
                              )}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" /> {booking.adults}A{booking.children > 0 ? ` ${booking.children}C` : ""}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" /> {booking.total_days} {isArabic ? "يوم" : "days"}
                          </span>
                        </div>
                      </div>

                      {/* Price & arrow */}
                      <div className="text-right shrink-0">
                        {booking.selling_price > 0 && (
                          <div className="text-sm font-bold font-mono text-foreground">
                            {Number(booking.selling_price).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">{booking.currency}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(booking.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Booking Dialog — Multi-step wizard */}
      <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) setStep(0); }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          {/* Header with gradient */}
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
              {/* Step indicator */}
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
                {/* ──── Step 0: Client ──── */}
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
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={newBooking.customer_email}
                            onChange={e => setNewBooking({ ...newBooking, customer_email: e.target.value })}
                            placeholder="email@example.com"
                            className="h-11 pl-10"
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

                {/* ──── Step 1: Trip ──── */}
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
                    {/* Pax — styled counters */}
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

                {/* ──── Step 2: Details ──── */}
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
                    {/* Summary preview */}
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

          {/* Footer */}
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
