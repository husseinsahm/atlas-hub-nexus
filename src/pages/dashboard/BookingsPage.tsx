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

      {/* New Booking Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-accent" />
              {isArabic ? "ملف حجز جديد" : "New Booking File"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Booking Title */}
            <div>
              <Label className="text-xs">{isArabic ? "عنوان الحجز" : "Booking Title"}</Label>
              <Input
                value={newBooking.title}
                onChange={e => setNewBooking({ ...newBooking, title: e.target.value })}
                placeholder={isArabic ? "مثال: رحلة عائلة أحمد إلى دبي" : "e.g., Ahmed Family Dubai Trip"}
                className="mt-1"
              />
            </div>

            {/* Customer Info */}
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-accent" />
                {isArabic ? "معلومات العميل" : "Customer Information"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">{isArabic ? "اسم العميل" : "Customer Name"} *</Label>
                  <Input
                    value={newBooking.customer_name}
                    onChange={e => setNewBooking({ ...newBooking, customer_name: e.target.value })}
                    placeholder={isArabic ? "الاسم الكامل" : "Full name"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{isArabic ? "البريد الإلكتروني" : "Email"}</Label>
                  <Input
                    type="email"
                    value={newBooking.customer_email}
                    onChange={e => setNewBooking({ ...newBooking, customer_email: e.target.value })}
                    placeholder="email@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{isArabic ? "رقم الهاتف" : "Phone"}</Label>
                  <PhoneInput
                    value={newBooking.customer_phone}
                    onValueChange={v => setNewBooking({ ...newBooking, customer_phone: v })}
                    defaultCountry="AE"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{isArabic ? "الجنسية" : "Nationality"}</Label>
                  <NationalitySelect
                    value={newBooking.customer_nationality}
                    onValueChange={v => setNewBooking({ ...newBooking, customer_nationality: v })}
                    placeholder={isArabic ? "اختر الجنسية" : "Select nationality"}
                    isRtl={isArabic}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Travel Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "تاريخ الوصول" : "Arrival Date"}</Label>
                <Input
                  type="date"
                  value={newBooking.arrival_date}
                  onChange={e => setNewBooking({ ...newBooking, arrival_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "تاريخ المغادرة" : "Departure Date"}</Label>
                <Input
                  type="date"
                  value={newBooking.departure_date}
                  onChange={e => setNewBooking({ ...newBooking, departure_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "عدد الكبار" : "Adults"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={newBooking.adults}
                  onChange={e => setNewBooking({ ...newBooking, adults: parseInt(e.target.value) || 1 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "عدد الأطفال" : "Children"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={newBooking.children}
                  onChange={e => setNewBooking({ ...newBooking, children: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Source */}
            <div>
              <Label className="text-xs">{isArabic ? "مصدر الحجز" : "Booking Source"}</Label>
              <Select value={newBooking.source} onValueChange={v => setNewBooking({ ...newBooking, source: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">{isArabic ? "ملاحظات" : "Initial Notes"}</Label>
              <Textarea
                value={newBooking.notes}
                onChange={e => setNewBooking({ ...newBooking, notes: e.target.value })}
                placeholder={isArabic ? "أي ملاحظات أو متطلبات خاصة..." : "Any notes or special requirements..."}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => createBookingMutation.mutate()} 
              disabled={!newBooking.customer_name.trim() || createBookingMutation.isPending}
              className="gold-gradient text-accent-foreground gap-2"
            >
              {createBookingMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isArabic ? "إنشاء الحجز" : "Create Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
