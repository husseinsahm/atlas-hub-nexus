import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Users, DollarSign, MapPin,
  Loader2, Briefcase, CheckCircle2, Clock,
  FileText, StickyNote, Pencil, Upload,
  UserCheck, Phone, Mail, Globe,
  Plus, Trash2, MessageSquare, Send,
  ChevronDown, ChevronUp, User, Shield,
  CreditCard, Plane, Hotel, Car, Eye,
  Route, Paperclip, Activity, Hash,
} from "lucide-react";
import { NationalitySelect, CountrySelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { DetailPageLoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { InternalComments } from "@/components/InternalComments";
import { FileAttachments } from "@/components/FileAttachments";
import { PaymentRecords } from "@/components/PaymentRecords";
import { createNotification } from "@/hooks/useNotifications";

type BookingStatus = "tentative" | "confirmed" | "in_operation" | "completed" | "cancelled";

const STATUS_CONFIG: Record<BookingStatus, { label: string; labelAr: string; color: string; bg: string; next?: BookingStatus }> = {
  tentative: { label: "Tentative", labelAr: "مبدئي", color: "text-slate-700", bg: "bg-slate-100", next: "confirmed" },
  confirmed: { label: "Confirmed", labelAr: "مؤكد", color: "text-blue-700", bg: "bg-blue-50", next: "in_operation" },
  in_operation: { label: "In Operation", labelAr: "قيد التنفيذ", color: "text-amber-700", bg: "bg-amber-50", next: "completed" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "text-emerald-700", bg: "bg-emerald-50" },
  cancelled: { label: "Cancelled", labelAr: "ملغي", color: "text-red-700", bg: "bg-red-50" },
};

const SERVICE_TYPES = [
  { value: "hotel", label: "Hotel", icon: Hotel },
  { value: "transfer", label: "Transfer", icon: Car },
  { value: "tour", label: "Tour", icon: MapPin },
  { value: "guide", label: "Guide", icon: User },
  { value: "meal", label: "Meal", icon: FileText },
  { value: "activity", label: "Activity", icon: Activity },
  { value: "other", label: "Other", icon: FileText },
];

const GENDERS = ["male", "female"];
const TABS = [
  { value: "summary", label: "Summary", labelAr: "الملخص", icon: Briefcase },
  { value: "customer", label: "Customer", labelAr: "العميل", icon: UserCheck },
  { value: "travelers", label: "Travelers", labelAr: "المسافرون", icon: Users },
  { value: "itinerary", label: "Itinerary", labelAr: "البرنامج", icon: Route },
  { value: "services", label: "Services", labelAr: "الخدمات", icon: Hotel },
  { value: "financials", label: "Financials", labelAr: "المالية", icon: DollarSign },
  { value: "attachments", label: "Attachments", labelAr: "المرفقات", icon: Paperclip },
  { value: "comments", label: "Comments", labelAr: "التعليقات", icon: MessageSquare },
  { value: "timeline", label: "Timeline", labelAr: "السجل", icon: Clock },
];

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isArabic = language === "ar";
  const companyId = user?.activeMembership?.companyId;

  const [activeTab, setActiveTab] = useState("summary");
  const [showTravelerDialog, setShowTravelerDialog] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<any>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  // ─── Fetch booking ───
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customers(id, full_name, email, phone, nationality, passport_number, address, city, country, date_of_birth)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ─── Fetch travelers ───
  const { data: travelers = [] } = useQuery({
    queryKey: ["booking-travelers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_travelers")
        .select("*")
        .eq("booking_id", id!)
        .order("is_lead_traveler", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ─── Fetch services ───
  const { data: services = [] } = useQuery({
    queryKey: ["booking-services", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_services")
        .select("*")
        .eq("booking_id", id!)
        .order("service_date", { ascending: true })
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ─── Fetch itinerary days ───
  const { data: itineraryDays = [] } = useQuery({
    queryKey: ["booking-days", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_days")
        .select("*, booking_day_items(*)")
        .eq("booking_id", id!)
        .order("day_number");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ─── Fetch activities ───
  const { data: activities = [] } = useQuery({
    queryKey: ["booking-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_activities")
        .select("*")
        .eq("booking_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ─── Fetch profiles ───
  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profiles-booking", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (!memberships) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberships.map(m => m.user_id));
      return data || [];
    },
    enabled: !!companyId,
  });

  const getProfileName = useCallback((userId: string | null) => {
    if (!userId) return "System";
    return profiles.find(p => p.id === userId)?.full_name || "Team member";
  }, [profiles]);

  // ─── Mutations ───
  const updateBooking = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("bookings").update(updates).eq("id", id!);
      if (error) throw error;
      if (updates.status && booking) {
        await supabase.from("booking_activities").insert({
          booking_id: id!,
          activity_type: "status_change",
          title: `Status changed to ${STATUS_CONFIG[updates.status as BookingStatus]?.label || updates.status}`,
          user_id: user?.id,
        });
        const notifyUserIds = new Set<string>();
        if (booking.assigned_to && booking.assigned_to !== user?.id) notifyUserIds.add(booking.assigned_to);
        if (booking.created_by && booking.created_by !== user?.id) notifyUserIds.add(booking.created_by);
        for (const uid of notifyUserIds) {
          createNotification({
            userId: uid,
            companyId: booking.company_id,
            type: "booking_status_change",
            title: "Booking status changed",
            message: `"${booking.title}" → ${STATUS_CONFIG[updates.status as BookingStatus]?.label || updates.status}`,
            entityType: "booking",
            entityId: id!,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-activities", id] });
    },
  });

  const saveTraveler = useMutation({
    mutationFn: async (traveler: any) => {
      if (traveler.id && !traveler._isNew) {
        const { error } = await supabase.from("booking_travelers").update({
          full_name: traveler.full_name,
          date_of_birth: traveler.date_of_birth || null,
          gender: traveler.gender || null,
          nationality: traveler.nationality || null,
          email: traveler.email || null,
          phone: traveler.phone || null,
          passport_number: traveler.passport_number || null,
          passport_expiry: traveler.passport_expiry || null,
          passport_country: traveler.passport_country || null,
          is_lead_traveler: traveler.is_lead_traveler || false,
          is_adult: traveler.is_adult !== false,
          special_requirements: traveler.special_requirements || null,
          room_preference: traveler.room_preference || null,
        }).eq("id", traveler.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("booking_travelers").insert({
          booking_id: id!,
          company_id: booking!.company_id,
          full_name: traveler.full_name,
          date_of_birth: traveler.date_of_birth || null,
          gender: traveler.gender || null,
          nationality: traveler.nationality || null,
          email: traveler.email || null,
          phone: traveler.phone || null,
          passport_number: traveler.passport_number || null,
          passport_expiry: traveler.passport_expiry || null,
          passport_country: traveler.passport_country || null,
          is_lead_traveler: traveler.is_lead_traveler || false,
          is_adult: traveler.is_adult !== false,
          special_requirements: traveler.special_requirements || null,
          room_preference: traveler.room_preference || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-travelers", id] });
      setShowTravelerDialog(false);
      setEditingTraveler(null);
      toast({ title: isArabic ? "تم حفظ المسافر" : "Traveler saved" });
    },
  });

  const deleteTraveler = useMutation({
    mutationFn: async (travelerId: string) => {
      await supabase.from("booking_travelers").delete().eq("id", travelerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-travelers", id] });
      toast({ title: isArabic ? "تم حذف المسافر" : "Traveler removed" });
    },
  });

  const saveService = useMutation({
    mutationFn: async (service: any) => {
      const payload = {
        booking_id: id!,
        company_id: booking!.company_id,
        service_type: service.service_type,
        title: service.title,
        description: service.description || null,
        supplier_name: service.supplier_name || null,
        supplier_contact: service.supplier_contact || null,
        confirmation_number: service.confirmation_number || null,
        service_date: service.service_date || null,
        location: service.location || null,
        quantity: service.quantity || 1,
        unit_price: service.unit_price || 0,
        total_cost: (service.quantity || 1) * (service.unit_price || 0),
        currency: booking?.currency || "USD",
        status: service.status || "pending",
        notes: service.notes || null,
        created_by: user?.id,
      };
      if (service.id && !service._isNew) {
        const { error } = await supabase.from("booking_services").update(payload).eq("id", service.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("booking_services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-services", id] });
      setShowServiceDialog(false);
      setEditingService(null);
      toast({ title: isArabic ? "تم حفظ الخدمة" : "Service saved" });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (serviceId: string) => {
      await supabase.from("booking_services").delete().eq("id", serviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-services", id] });
      toast({ title: isArabic ? "تم حذف الخدمة" : "Service removed" });
    },
  });

  const addItineraryDay = useMutation({
    mutationFn: async () => {
      const nextDay = itineraryDays.length + 1;
      const { error } = await supabase.from("booking_days").insert({
        booking_id: id!,
        day_number: nextDay,
        title: `Day ${nextDay}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-days", id] });
    },
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("booking_activities").insert({
        booking_id: id!,
        activity_type: "comment",
        title: "Internal comment",
        description: text.trim(),
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-activities", id] });
      toast({ title: isArabic ? "تم إضافة التعليق" : "Comment added" });
    },
  });

  const advanceStatus = useCallback(() => {
    if (!booking) return;
    const next = STATUS_CONFIG[booking.status as BookingStatus]?.next;
    if (next) {
      updateBooking.mutate({ status: next });
      toast({ title: `Status → ${STATUS_CONFIG[next].label}` });
    }
  }, [booking, updateBooking, toast]);

  // ─── Computed values ───
  const servicesTotalCost = useMemo(() => 
    services.reduce((sum: number, s: any) => sum + Number(s.total_cost || 0), 0)
  , [services]);

  if (isLoading) {
    return <DetailPageLoadingState />;
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold">{isArabic ? "الحجز غير موجود" : "Booking not found"}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/bookings")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {isArabic ? "العودة" : "Back"}
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[booking.status as BookingStatus] || STATUS_CONFIG.tentative;
  const customer = (booking as any).customers;
  const balance = (booking.selling_price || 0) - (booking.amount_paid || 0);

  return (
    <div className="space-y-0">
      {/* ─── Premium Header ─── */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-6 mb-0 overflow-hidden border-b border-border bg-gradient-to-br from-card via-background to-secondary/30">
        {/* Decorative accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 gold-gradient" />
        {/* Subtle radial glow */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07] bg-[radial-gradient(circle,hsl(var(--gold)),transparent_70%)]" />

        <div className="relative">
          {/* Top row: Back + Actions */}
          <div className="flex items-center justify-between mb-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/bookings")}
              className="text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 text-xs -ml-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {isArabic ? "الحجوزات" : "Bookings"}
            </Button>
            <div className="flex items-center gap-2">
              {sc.next && (
                <Button
                  size="sm"
                  onClick={advanceStatus}
                  className="gold-gradient text-accent-foreground text-xs gap-1.5 shadow-md hover:shadow-lg transition-shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isArabic ? `→ ${STATUS_CONFIG[sc.next].labelAr}` : `→ ${STATUS_CONFIG[sc.next].label}`}
                </Button>
              )}
              <Select
                value={booking.status}
                onValueChange={v => updateBooking.mutate({ status: v })}
              >
                <SelectTrigger className="h-8 w-auto border-border bg-background text-foreground text-xs gap-2">
                  <div className={cn("w-2 h-2 rounded-full", sc.bg)} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Booking identity */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-lg shrink-0 ring-4 ring-background">
              <Briefcase className="w-7 h-7 text-accent-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{booking.booking_number}</span>
                <Badge className={cn("border-0 text-[10px] font-semibold", sc.bg, sc.color)}>
                  {isArabic ? sc.labelAr : sc.label}
                </Badge>
                {(booking as any).source && (
                  <Badge variant="outline" className="text-[9px] capitalize">{(booking as any).source}</Badge>
                )}
              </div>
              <h1 className="text-xl font-bold font-display text-foreground truncate">{booking.title}</h1>
              {customer?.full_name && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <User className="w-3 h-3" /> {customer.full_name}
                  {customer?.phone && <span className="ml-2 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{customer.phone}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Quick stat pills */}
          <div className="flex flex-wrap gap-2.5 mt-5">
            <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-4 py-2.5 text-xs shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plane className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-foreground">{booking.total_days} {isArabic ? "يوم" : "days"}</span>
                {(booking as any).arrival_date && (
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {format(new Date((booking as any).arrival_date), "MMM d")} → {(booking as any).departure_date ? format(new Date((booking as any).departure_date), "MMM d") : "..."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-4 py-2.5 text-xs shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-foreground">{booking.adults}A{booking.children > 0 ? ` · ${booking.children}C` : ""}</span>
                <p className="text-[10px] text-muted-foreground leading-tight">{travelers.length} {isArabic ? "مسجل" : "registered"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-4 py-2.5 text-xs shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-accent" />
              </div>
              <div>
                <span className="font-semibold font-mono text-foreground">{Number(booking.selling_price || 0).toLocaleString()}</span>
                <p className="text-[10px] text-muted-foreground leading-tight">{booking.currency}</p>
              </div>
            </div>
            {balance > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs shadow-sm">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="font-semibold font-mono text-amber-700 dark:text-amber-300">{balance.toLocaleString()}</span>
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 leading-tight">{isArabic ? "متبقي" : "remaining"}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation — underline style ─── */}
      <div className="sticky top-0 z-10 -mx-6 px-6 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-3.5 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className={cn("w-3.5 h-3.5", isActive && "text-accent")} />
                {isArabic ? tab.labelAr : tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeBookingTab"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="pt-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >

      {/* ─── TAB: Summary ─── */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                    <Briefcase className="w-3.5 h-3.5 text-accent" />
                  </div>
                  {isArabic ? "تفاصيل الحجز" : "Booking Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "رقم الحجز" : "Booking #"}</Label>
                    <p className="text-sm font-mono font-medium text-foreground">{booking.booking_number}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "تاريخ الوصول" : "Arrival"}</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs mt-1"
                      defaultValue={(booking as any).arrival_date || booking.start_date || ""}
                      onBlur={e => updateBooking.mutate({ arrival_date: e.target.value || null, start_date: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "تاريخ المغادرة" : "Departure"}</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs mt-1"
                      defaultValue={(booking as any).departure_date || booking.end_date || ""}
                      onBlur={e => updateBooking.mutate({ departure_date: e.target.value || null, end_date: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "المصدر" : "Source"}</Label>
                    <Select 
                      value={(booking as any).source || "email"} 
                      onValueChange={v => updateBooking.mutate({ source: v })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["email","phone","walk_in","website","referral","social_media","partner","other"].map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "الموظف المسؤول" : "Assigned Agent"}</Label>
                    <Select 
                      value={booking.assigned_to || ""} 
                      onValueChange={v => updateBooking.mutate({ assigned_to: v })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder={isArabic ? "اختر..." : "Select..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name || "Unnamed"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                    <StickyNote className="w-3.5 h-3.5 text-accent" />
                  </div>
                  {isArabic ? "ملاحظات" : "Notes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "ملاحظات داخلية" : "Internal Notes"}</Label>
                  <Textarea
                    defaultValue={booking.internal_notes || ""}
                    onBlur={e => updateBooking.mutate({ internal_notes: e.target.value })}
                    placeholder={isArabic ? "ملاحظات داخلية..." : "Internal notes..."}
                    rows={3}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "ملاحظات العمليات" : "Operations Notes"}</Label>
                  <Textarea
                    defaultValue={booking.operations_notes || ""}
                    onBlur={e => updateBooking.mutate({ operations_notes: e.target.value })}
                    placeholder={isArabic ? "ملاحظات العمليات..." : "Operations notes..."}
                    rows={3}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "ملاحظات العميل" : "Client Notes"}</Label>
                  <Textarea
                    defaultValue={booking.client_notes || ""}
                    onBlur={e => updateBooking.mutate({ client_notes: e.target.value })}
                    placeholder={isArabic ? "ملاحظات للعميل..." : "Notes for client..."}
                    rows={3}
                    className="text-xs mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB: Customer ─── */}
      {activeTab === "customer" && (
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5 text-accent" />
              </div>
              {isArabic ? "معلومات العميل" : "Customer Information"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "الاسم" : "Full Name"}</Label>
                  <p className="text-sm font-medium text-foreground">{customer.full_name}</p>
                </div>
                {customer.email && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "البريد" : "Email"}</Label>
                    <p className="text-sm text-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</p>
                  </div>
                )}
                {customer.phone && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "الهاتف" : "Phone"}</Label>
                    <p className="text-sm text-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</p>
                  </div>
                )}
                {customer.nationality && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "الجنسية" : "Nationality"}</Label>
                    <p className="text-sm text-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> {customer.nationality}</p>
                  </div>
                )}
                {customer.country && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "البلد" : "Country"}</Label>
                    <p className="text-sm text-foreground">{customer.country}</p>
                  </div>
                )}
                {customer.city && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "المدينة" : "City"}</Label>
                    <p className="text-sm text-foreground">{customer.city}</p>
                  </div>
                )}
                {customer.passport_number && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "جواز السفر" : "Passport"}</Label>
                    <p className="text-sm text-foreground font-mono">{customer.passport_number}</p>
                  </div>
                )}
                <div className="col-span-full">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/dashboard/customers/${customer.id}`)}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> {isArabic ? "عرض ملف العميل الكامل" : "View Full Customer Profile"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <UserCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{isArabic ? "لم يتم ربط عميل بهذا الحجز" : "No customer linked to this booking"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: Travelers ─── */}
      {activeTab === "travelers" && (
        <TravelersTab
          travelers={travelers}
          isArabic={isArabic}
          onAdd={() => { setEditingTraveler({ _isNew: true, full_name: "", is_adult: true }); setShowTravelerDialog(true); }}
          onEdit={(t: any) => { setEditingTraveler(t); setShowTravelerDialog(true); }}
          onDelete={(tId: string) => deleteTraveler.mutate(tId)}
          adultsCount={booking.adults}
          childrenCount={booking.children}
        />
      )}

      {/* ─── TAB: Itinerary ─── */}
      {activeTab === "itinerary" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {itineraryDays.length} {isArabic ? "يوم" : "days"} {isArabic ? "في البرنامج" : "in itinerary"}
            </p>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => addItineraryDay.mutate()}>
              <Plus className="w-3.5 h-3.5" /> {isArabic ? "إضافة يوم" : "Add Day"}
            </Button>
          </div>

          {itineraryDays.length === 0 ? (
            <div className="text-center py-12">
              <Route className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{isArabic ? "لا يوجد برنامج بعد" : "No itinerary days yet"}</p>
              <Button size="sm" variant="outline" className="mt-3 text-xs gap-1.5" onClick={() => addItineraryDay.mutate()}>
                <Plus className="w-3.5 h-3.5" /> {isArabic ? "ابدأ البرنامج" : "Start Itinerary"}
              </Button>
            </div>
          ) : (
            itineraryDays.map((day: any) => (
              <Card key={day.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center text-accent-foreground font-bold text-sm">
                      {day.day_number}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">{day.title || `Day ${day.day_number}`}</CardTitle>
                      {day.city && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {day.city}</p>}
                    </div>
                    {day.date && <Badge variant="secondary" className="text-[10px]">{format(new Date(day.date), "MMM d")}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  {(day.booking_day_items || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">{isArabic ? "لا توجد عناصر" : "No items yet"}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(day.booking_day_items as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[9px] capitalize shrink-0">{item.category}</Badge>
                            <span className="text-xs font-medium text-foreground truncate">{item.custom_title || "Untitled"}</span>
                          </div>
                          <span className="text-xs font-mono font-semibold text-foreground shrink-0 ml-2">
                            {Number(item.total_price || 0).toLocaleString()} {item.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ─── TAB: Services ─── */}
      {activeTab === "services" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {services.length} {isArabic ? "خدمة" : "services"} · {isArabic ? "الإجمالي" : "Total"}: {servicesTotalCost.toLocaleString()} {booking.currency}
            </p>
            <Button size="sm" className="gold-gradient text-accent-foreground text-xs gap-1.5" onClick={() => {
              setEditingService({ _isNew: true, service_type: "hotel", title: "", quantity: 1, unit_price: 0, status: "pending" });
              setShowServiceDialog(true);
            }}>
              <Plus className="w-3.5 h-3.5" /> {isArabic ? "إضافة خدمة" : "Add Service"}
            </Button>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-12">
              <Hotel className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد خدمات" : "No services added"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service: any) => {
                const typeConfig = SERVICE_TYPES.find(st => st.value === service.service_type);
                const Icon = typeConfig?.icon || FileText;
                return (
                  <Card key={service.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] capitalize">{service.service_type}</Badge>
                            <Badge variant={service.status === "confirmed" ? "default" : "secondary"} className="text-[9px]">
                              {service.status}
                            </Badge>
                          </div>
                          <h4 className="text-sm font-semibold text-foreground truncate mt-0.5">{service.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {service.supplier_name && <span>{service.supplier_name}</span>}
                            {service.service_date && <span>{format(new Date(service.service_date), "MMM d")}</span>}
                            {service.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{service.location}</span>}
                            {service.confirmation_number && <span className="font-mono">#{service.confirmation_number}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold font-mono text-foreground">
                            {Number(service.total_cost || 0).toLocaleString()} {service.currency}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{service.quantity} × {Number(service.unit_price || 0).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingService(service); setShowServiceDialog(true); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteService.mutate(service.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Services total */}
              <Card className="border-accent/20 bg-accent/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{isArabic ? "إجمالي الخدمات" : "Services Total"}</span>
                  <span className="text-lg font-bold font-mono text-foreground">{servicesTotalCost.toLocaleString()} {booking.currency}</span>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Financials ─── */}
      {activeTab === "financials" && (
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-accent" />
                </div>
                {isArabic ? "الملخص المالي" : "Financial Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "التكلفة" : "Total Cost"}</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs mt-1 font-mono"
                    defaultValue={booking.total_cost || 0}
                    onBlur={e => updateBooking.mutate({ total_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "سعر البيع" : "Selling Price"}</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs mt-1 font-mono"
                    defaultValue={booking.selling_price || 0}
                    onBlur={e => updateBooking.mutate({ selling_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "الربح" : "Profit"}</Label>
                  <p className={cn("text-lg font-mono font-bold mt-1", (booking.selling_price || 0) - (booking.total_cost || 0) >= 0 ? "text-emerald-600" : "text-destructive")}>
                    {((booking.selling_price || 0) - (booking.total_cost || 0)).toLocaleString()} {booking.currency}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">{isArabic ? "الرصيد المتبقي" : "Balance"}</Label>
                  <p className={cn("text-lg font-mono font-bold mt-1", balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                    {balance > 0 ? `${balance.toLocaleString()} ${booking.currency}` : isArabic ? "مدفوع بالكامل" : "Fully Paid"}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />
              <PaymentRecords
                bookingId={booking.id}
                companyId={booking.company_id}
                currency={booking.currency}
                sellingPrice={Number(booking.selling_price || 0)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB: Attachments ─── */}
      {activeTab === "attachments" && (
        <Card>
          <CardContent className="p-4">
            <FileAttachments
              entityType="booking"
              entityId={booking.id}
              companyId={booking.company_id}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: Comments ─── */}
      {activeTab === "comments" && (
        <Card>
          <CardContent className="p-4">
            <InternalComments
              entityType="booking"
              entityId={booking.id}
              companyId={booking.company_id}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: Timeline ─── */}
      {activeTab === "timeline" && (
        <TimelineTab
          activities={activities}
          isArabic={isArabic}
          getProfileName={getProfileName}
          onAddComment={(text: string) => addComment.mutate(text)}
          isAddingComment={addComment.isPending}
        />
      )}

        </motion.div>
      </AnimatePresence>
      </div>

      {/* ─── Traveler Dialog ─── */}
      {showTravelerDialog && editingTraveler && (
        <TravelerDialog
          traveler={editingTraveler}
          isArabic={isArabic}
          open={showTravelerDialog}
          onClose={() => { setShowTravelerDialog(false); setEditingTraveler(null); }}
          onSave={(t: any) => saveTraveler.mutate(t)}
          isSaving={saveTraveler.isPending}
        />
      )}

      {/* ─── Service Dialog ─── */}
      {showServiceDialog && editingService && (
        <ServiceDialog
          service={editingService}
          isArabic={isArabic}
          open={showServiceDialog}
          onClose={() => { setShowServiceDialog(false); setEditingService(null); }}
          onSave={(s: any) => saveService.mutate(s)}
          isSaving={saveService.isPending}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ───

function TravelersTab({ travelers, isArabic, onAdd, onEdit, onDelete, adultsCount, childrenCount }: any) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {travelers.length} {isArabic ? "مسافر مسجل" : "registered"} · {adultsCount}A {childrenCount > 0 ? `${childrenCount}C` : ""}
        </p>
        <Button size="sm" className="gold-gradient text-accent-foreground text-xs gap-1.5" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" /> {isArabic ? "إضافة مسافر" : "Add Traveler"}
        </Button>
      </div>

      {travelers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{isArabic ? "لا يوجد مسافرون مسجلون" : "No travelers registered"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {travelers.map((t: any, i: number) => {
            const isExpanded = expanded === t.id;
            return (
              <Card key={t.id} className="border-border">
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{t.full_name}</p>
                        {t.is_lead_traveler && <Badge className="text-[9px] bg-accent/10 text-accent border-0">{isArabic ? "رئيسي" : "Lead"}</Badge>}
                        {!t.is_adult && <Badge variant="secondary" className="text-[9px]">{isArabic ? "طفل" : "Child"}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {t.nationality && <span><Globe className="w-2.5 h-2.5 inline mr-0.5" />{t.nationality}</span>}
                        {t.passport_number && <span className="font-mono">{t.passport_number}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={e => { e.stopPropagation(); onEdit(t); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={e => { e.stopPropagation(); onDelete(t.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border bg-muted/20 px-3 py-3 overflow-hidden"
                      >
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: isArabic ? "الجنس" : "Gender", val: t.gender },
                            { label: isArabic ? "تاريخ الميلاد" : "Date of Birth", val: t.date_of_birth },
                            { label: isArabic ? "البريد" : "Email", val: t.email },
                            { label: isArabic ? "الهاتف" : "Phone", val: t.phone },
                            { label: isArabic ? "جواز السفر" : "Passport #", val: t.passport_number, mono: true },
                            { label: isArabic ? "انتهاء الجواز" : "Passport Expiry", val: t.passport_expiry },
                            { label: isArabic ? "بلد الجواز" : "Passport Country", val: t.passport_country },
                            { label: isArabic ? "تفضيل الغرفة" : "Room Preference", val: t.room_preference },
                            { label: isArabic ? "متطلبات خاصة" : "Special Requirements", val: t.special_requirements },
                          ].filter(f => f.val).map((field, idx) => (
                            <div key={idx}>
                              <Label className="text-[10px] text-muted-foreground uppercase">{field.label}</Label>
                              <p className={cn("text-xs text-foreground", field.mono && "font-mono")}>{field.val}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TravelerDialog({ traveler, isArabic, open, onClose, onSave, isSaving }: any) {
  const [form, setForm] = useState({ ...traveler });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Premium header */}
        <div className="relative px-6 pt-5 pb-4 navy-gradient">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--gold)/0.3),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {form._isNew ? (isArabic ? "إضافة مسافر" : "Add Traveler") : (isArabic ? "تعديل المسافر" : "Edit Traveler")}
              </h2>
              <p className="text-[11px] text-white/60">{isArabic ? "معلومات جواز السفر والبيانات الشخصية" : "Passport details & personal info"}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Identity */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">{isArabic ? "الهوية" : "Identity"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">{isArabic ? "الاسم الكامل" : "Full Name"} <span className="text-destructive">*</span></Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1 h-11" autoFocus />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "الجنس" : "Gender"}</Label>
                <Select value={form.gender || ""} onValueChange={v => setForm({ ...form, gender: v })}>
                  <SelectTrigger className="mt-1 h-11"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "تاريخ الميلاد" : "Date of Birth"}</Label>
                <Input type="date" value={form.date_of_birth || ""} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "الجنسية" : "Nationality"}</Label>
                <NationalitySelect value={form.nationality || ""} onValueChange={v => setForm({ ...form, nationality: v })} placeholder={isArabic ? "اختر" : "Select"} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "البريد" : "Email"}</Label>
                <Input type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 h-11" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{isArabic ? "الهاتف" : "Phone"}</Label>
                <PhoneInput value={form.phone || ""} onValueChange={v => setForm({ ...form, phone: v })} defaultCountry="AE" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Passport */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 flex items-center gap-1"><Shield className="w-3 h-3" />{isArabic ? "جواز السفر" : "Passport"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "رقم الجواز" : "Passport #"}</Label>
                <Input value={form.passport_number || ""} onChange={e => setForm({ ...form, passport_number: e.target.value })} className="mt-1 h-11 font-mono" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "انتهاء الجواز" : "Expiry"}</Label>
                <Input type="date" value={form.passport_expiry || ""} onChange={e => setForm({ ...form, passport_expiry: e.target.value })} className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "بلد الإصدار" : "Issuing Country"}</Label>
                <CountrySelect value={form.passport_country || ""} onValueChange={v => setForm({ ...form, passport_country: v })} placeholder={isArabic ? "اختر" : "Select"} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "تفضيل الغرفة" : "Room Pref."}</Label>
                <Input value={form.room_preference || ""} onChange={e => setForm({ ...form, room_preference: e.target.value })} className="mt-1 h-11" />
              </div>
            </div>
          </div>

          {/* Extras */}
          <div>
            <Label className="text-xs">{isArabic ? "متطلبات خاصة" : "Special Requirements"}</Label>
            <Textarea value={form.special_requirements || ""} onChange={e => setForm({ ...form, special_requirements: e.target.value })} rows={2} className="mt-1 text-sm resize-none" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_lead_traveler || false} onChange={e => setForm({ ...form, is_lead_traveler: e.target.checked })} className="rounded" />
              {isArabic ? "المسافر الرئيسي" : "Lead Traveler"}
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_adult !== false} onChange={e => setForm({ ...form, is_adult: e.target.checked })} className="rounded" />
              {isArabic ? "بالغ" : "Adult"}
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">{isArabic ? "إلغاء" : "Cancel"}</Button>
          <Button
            size="sm"
            disabled={!form.full_name?.trim() || isSaving}
            onClick={() => onSave(form)}
            className="gold-gradient text-accent-foreground text-xs gap-1.5 px-6"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isArabic ? "حفظ" : "Save Traveler"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({ service, isArabic, open, onClose, onSave, isSaving }: any) {
  const [form, setForm] = useState({ ...service });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="relative px-6 pt-5 pb-4 navy-gradient">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--gold)/0.3),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <Hotel className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {form._isNew ? (isArabic ? "إضافة خدمة" : "Add Service") : (isArabic ? "تعديل الخدمة" : "Edit Service")}
              </h2>
              <p className="text-[11px] text-white/60">{isArabic ? "فنادق، نقل، جولات، مرشدين" : "Hotels, transfers, tours, guides"}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Service type chips */}
          <div>
            <Label className="text-xs font-medium mb-2 block">{isArabic ? "نوع الخدمة" : "Service Type"}</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {SERVICE_TYPES.map(st => {
                const StIcon = st.icon;
                return (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setForm({ ...form, service_type: st.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-[10px] font-medium transition-all",
                      form.service_type === st.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <StIcon className="w-4 h-4" />
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? "العنوان" : "Title"} <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 h-11" placeholder={isArabic ? "مثال: فندق ماريوت" : "e.g., Marriott Hotel"} />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الحالة" : "Status"}</Label>
              <Select value={form.status || "pending"} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending","confirmed","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "التاريخ" : "Service Date"}</Label>
              <Input type="date" value={form.service_date || ""} onChange={e => setForm({ ...form, service_date: e.target.value })} className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "المورد" : "Supplier"}</Label>
              <Input value={form.supplier_name || ""} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "رقم التأكيد" : "Confirmation #"}</Label>
              <Input value={form.confirmation_number || ""} onChange={e => setForm({ ...form, confirmation_number: e.target.value })} className="mt-1 h-11 font-mono" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? "الموقع" : "Location"}</Label>
              <Input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1 h-11" />
            </div>
          </div>

          {/* Pricing row */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> {isArabic ? "التسعير" : "Pricing"}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "الكمية" : "Qty"}</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} className="mt-1 h-11 text-center font-bold" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "سعر الوحدة" : "Unit Price"}</Label>
                <Input type="number" min={0} value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} className="mt-1 h-11 font-mono" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "الإجمالي" : "Total"}</Label>
                <div className="mt-1 h-11 rounded-md border border-border bg-background flex items-center justify-center text-sm font-bold font-mono text-foreground">
                  {((form.quantity || 1) * (form.unit_price || 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">{isArabic ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 text-sm resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">{isArabic ? "إلغاء" : "Cancel"}</Button>
          <Button
            size="sm"
            disabled={!form.title?.trim() || isSaving}
            onClick={() => onSave(form)}
            className="gold-gradient text-accent-foreground text-xs gap-1.5 px-6"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isArabic ? "حفظ" : "Save Service"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimelineTab({ activities, isArabic, getProfileName, onAddComment, isAddingComment }: any) {
  const [commentText, setCommentText] = useState("");
  const typeIcons: Record<string, { icon: any; color: string }> = {
    status_change: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
    comment: { icon: MessageSquare, color: "bg-blue-100 text-blue-600" },
    created: { icon: Plus, color: "bg-accent/20 text-accent" },
    note: { icon: StickyNote, color: "bg-muted text-muted-foreground" },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={isArabic ? "أضف تعليق أو ملاحظة..." : "Add a comment or update..."}
              rows={2}
              className="text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-auto self-end"
              disabled={!commentText.trim() || isAddingComment}
              onClick={() => { onAddComment(commentText); setCommentText(""); }}
            >
              {isAddingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{isArabic ? "لا يوجد نشاط بعد" : "No activity yet"}</p>
        </div>
      ) : (
        <div className="relative ml-3">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {activities.map((act: any, idx: number) => {
              const cfg = typeIcons[act.activity_type] || typeIcons.note;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="relative pl-8"
                >
                  <div className={cn("absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 border-card", cfg.color)}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">{act.title}</p>
                    {act.description && <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">{act.description}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {getProfileName(act.user_id)} · {format(new Date(act.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
