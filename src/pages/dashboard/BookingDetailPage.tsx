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
  Route, Paperclip, Activity, Hash, Ticket, Stamp,
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
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { InternalComments } from "@/components/InternalComments";
import { FileAttachments } from "@/components/FileAttachments";
import { PaymentRecords } from "@/components/PaymentRecords";
import { ItineraryBuilder } from "@/components/itinerary/ItineraryBuilder";
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
  { value: "flight", label: "Flight", icon: Plane },
  { value: "visa", label: "Visa", icon: Stamp },
  { value: "entrance", label: "Entrance", icon: Ticket },
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
      const isFlat = service.pricing_mode === "flat";
      const adultTotal = isFlat ? (service.unit_price || 0) : (service.quantity || 0) * (service.unit_price || 0);
      const childTotal = isFlat || service.children_free ? 0 : (service.child_quantity || 0) * (service.child_unit_price || 0);
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
        quantity: isFlat ? 1 : (service.quantity || 1),
        unit_price: service.unit_price || 0,
        total_cost: adultTotal + childTotal,
        currency: booking?.currency || "USD",
        status: service.status || "pending",
        notes: service.notes || null,
        created_by: user?.id,
        metadata: {
          pricing_mode: service.pricing_mode || "detailed",
          child_quantity: service.child_quantity || 0,
          child_unit_price: service.children_free ? 0 : (service.child_unit_price || 0),
          children_free: service.children_free || false,
        },
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
  const serviceCostByStatus = useMemo(() => {
    const breakdown: Record<string, number> = { pending: 0, confirmed: 0, booked: 0, cancelled: 0 };
    services.forEach((s: any) => {
      const status = s.status || "pending";
      breakdown[status] = (breakdown[status] || 0) + Number(s.total_cost || 0);
    });
    return breakdown;
  }, [services]);
  const servicesTotalCost = useMemo(() => 
    services.reduce((sum: number, s: any) => sum + Number(s.total_cost || 0), 0)
  , [services]);
  const servicesActiveCost = useMemo(() => 
    services.filter((s: any) => s.status !== "cancelled").reduce((sum: number, s: any) => sum + Number(s.total_cost || 0), 0)
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
            {/* Booking Details Card */}
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 via-muted/30 to-transparent border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center shadow-sm">
                    <Briefcase className="w-3.5 h-3.5 text-accent-foreground" />
                  </div>
                  {isArabic ? "تفاصيل الحجز" : "Booking Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Booking Number & Status highlight */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "رقم الحجز" : "Booking Number"}</p>
                    <p className="text-base font-bold font-mono text-foreground">{booking.booking_number}</p>
                  </div>
                  <Badge className={cn("border-0 text-xs font-semibold px-3 py-1", sc.bg, sc.color)}>
                    {isArabic ? sc.labelAr : sc.label}
                  </Badge>
                </div>

                {/* Date range visual */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <Plane className="w-3 h-3 text-emerald-600 dark:text-emerald-400 rotate-[-45deg]" />
                      </div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "تاريخ الوصول" : "Arrival"}</Label>
                    </div>
                    <Input
                      type="date"
                      className="h-9 text-xs border-border/60 bg-transparent"
                      defaultValue={(booking as any).arrival_date || booking.start_date || ""}
                      onBlur={e => updateBooking.mutate({ arrival_date: e.target.value || null, start_date: e.target.value || null })}
                    />
                  </div>
                  <div className="relative p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                        <Plane className="w-3 h-3 text-rose-600 dark:text-rose-400 rotate-45" />
                      </div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "تاريخ المغادرة" : "Departure"}</Label>
                    </div>
                    <Input
                      type="date"
                      className="h-9 text-xs border-border/60 bg-transparent"
                      defaultValue={(booking as any).departure_date || booking.end_date || ""}
                      onBlur={e => updateBooking.mutate({ departure_date: e.target.value || null, end_date: e.target.value || null })}
                    />
                  </div>
                </div>

                {/* Source & Agent */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                        <Globe className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "المصدر" : "Source"}</Label>
                    </div>
                    <Select 
                      value={(booking as any).source || "email"} 
                      onValueChange={v => updateBooking.mutate({ source: v })}
                    >
                      <SelectTrigger className="h-9 text-xs border-border/60 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["email","phone","walk_in","website","referral","social_media","partner","other"].map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                        <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "الموظف المسؤول" : "Assigned Agent"}</Label>
                    </div>
                    <Select 
                      value={booking.assigned_to || ""} 
                      onValueChange={v => updateBooking.mutate({ assigned_to: v })}
                    >
                      <SelectTrigger className="h-9 text-xs border-border/60 bg-transparent">
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
              <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 via-muted/30 to-transparent border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center shadow-sm">
                    <StickyNote className="w-3.5 h-3.5 text-accent-foreground" />
                  </div>
                  {isArabic ? "ملاحظات" : "Notes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {[
                  { key: "internal_notes", label: isArabic ? "ملاحظات داخلية" : "Internal Notes", placeholder: isArabic ? "ملاحظات داخلية..." : "Internal notes...", icon: Shield, iconBg: "bg-amber-100 dark:bg-amber-900/40", iconText: "text-amber-600 dark:text-amber-400" },
                  { key: "operations_notes", label: isArabic ? "ملاحظات العمليات" : "Operations Notes", placeholder: isArabic ? "ملاحظات العمليات..." : "Operations notes...", icon: Activity, iconBg: "bg-blue-100 dark:bg-blue-900/40", iconText: "text-blue-600 dark:text-blue-400" },
                  { key: "client_notes", label: isArabic ? "ملاحظات العميل" : "Client Notes", placeholder: isArabic ? "ملاحظات للعميل..." : "Notes for client...", icon: User, iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconText: "text-emerald-600 dark:text-emerald-400" },
                ].map(note => (
                  <div key={note.key} className="rounded-xl border border-border/50 p-3 bg-gradient-to-br from-background to-muted/20 hover:border-accent/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", note.iconBg)}>
                        <note.icon className={cn("w-2.5 h-2.5", note.iconText)} />
                      </div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{note.label}</Label>
                    </div>
                    <Textarea
                      defaultValue={(booking as any)[note.key] || ""}
                      onBlur={e => updateBooking.mutate({ [note.key]: e.target.value })}
                      placeholder={note.placeholder}
                      rows={3}
                      className="text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 resize-none"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB: Customer ─── */}
      {activeTab === "customer" && (
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 via-muted/30 to-transparent border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center shadow-sm">
                <UserCheck className="w-3.5 h-3.5 text-accent-foreground" />
              </div>
              {isArabic ? "معلومات العميل" : "Customer Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {customer ? (
              <div className="space-y-5">
                {/* Customer header card */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                  <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center text-xl font-bold text-accent-foreground shadow-lg">
                    {customer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground font-display">{customer.full_name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</span>}
                      {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</span>}
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: isArabic ? "الجنسية" : "Nationality", value: customer.nationality, icon: Globe, iconBg: "bg-blue-100 dark:bg-blue-900/40", iconText: "text-blue-600 dark:text-blue-400" },
                    { label: isArabic ? "البلد" : "Country", value: customer.country, icon: MapPin, iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconText: "text-emerald-600 dark:text-emerald-400" },
                    { label: isArabic ? "المدينة" : "City", value: customer.city, icon: MapPin, iconBg: "bg-violet-100 dark:bg-violet-900/40", iconText: "text-violet-600 dark:text-violet-400" },
                    { label: isArabic ? "جواز السفر" : "Passport", value: customer.passport_number, icon: Shield, iconBg: "bg-amber-100 dark:bg-amber-900/40", iconText: "text-amber-600 dark:text-amber-400", mono: true },
                    { label: isArabic ? "تاريخ الميلاد" : "Date of Birth", value: customer.date_of_birth ? format(new Date(customer.date_of_birth), "MMM d, yyyy") : null, icon: Calendar, iconBg: "bg-rose-100 dark:bg-rose-900/40", iconText: "text-rose-600 dark:text-rose-400" },
                  ].filter(f => f.value).map((field, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", field.iconBg)}>
                        <field.icon className={cn("w-3.5 h-3.5", field.iconText)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</p>
                        <p className={cn("text-sm font-medium text-foreground truncate", field.mono && "font-mono")}>{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="text-xs gap-1.5 mt-2" onClick={() => navigate(`/dashboard/customers/${customer.id}`)}>
                  <Eye className="w-3.5 h-3.5" /> {isArabic ? "عرض ملف العميل الكامل" : "View Full Customer Profile"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{isArabic ? "لم يتم ربط عميل بهذا الحجز" : "No customer linked to this booking"}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{isArabic ? "اربط عميل من صفحة العملاء" : "Link a customer from the customers page"}</p>
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
        <ItineraryBuilder
          bookingId={booking.id}
          companyId={booking.company_id}
          itineraryDays={itineraryDays as any}
          booking={booking}
          isArabic={isArabic}
        />
      )}

      {/* ─── TAB: Services ─── */}
      {activeTab === "services" && (
        <div className="space-y-4">
          {/* Services header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/50 via-muted/30 to-transparent border border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-sm">
                <Hotel className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{services.length} {isArabic ? "خدمة" : "Services"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "الفعلي" : "Active"}: <span className="font-mono font-semibold text-foreground">{servicesActiveCost.toLocaleString()} {booking.currency}</span>{serviceCostByStatus.pending > 0 && <span className="text-muted-foreground/70"> ({isArabic ? "معلق" : "pending"}: {serviceCostByStatus.pending.toLocaleString()})</span>}</p>
              </div>
            </div>
            <Button size="sm" className="gold-gradient text-accent-foreground text-xs gap-1.5 shadow-md" onClick={() => {
              setEditingService({ _isNew: true, service_type: "hotel", title: "", quantity: booking.adults || 1, child_quantity: booking.children || 0, unit_price: 0, child_unit_price: 0, status: "pending" });
              setShowServiceDialog(true);
            }}>
              <Plus className="w-3.5 h-3.5" /> {isArabic ? "إضافة خدمة" : "Add Service"}
            </Button>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Hotel className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{isArabic ? "لا توجد خدمات" : "No services added"}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{isArabic ? "أضف فنادق ونقل وجولات" : "Add hotels, transfers, tours & more"}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {services.map((service: any) => {
                const typeConfig = SERVICE_TYPES.find(st => st.value === service.service_type);
                const Icon = typeConfig?.icon || FileText;
                const statusColors: Record<string, string> = {
                  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                };
                return (
                  <Card key={service.id} className="border-border/50 hover:border-accent/30 transition-colors overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 p-4">
                        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/15 transition-colors">
                          <Icon className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="text-[9px] capitalize border-border/60">{service.service_type}</Badge>
                            <Badge className={cn("text-[9px] border-0", statusColors[service.status] || statusColors.pending)}>
                              {service.status}
                            </Badge>
                          </div>
                          <h4 className="text-sm font-semibold text-foreground truncate">{service.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {service.supplier_name && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{service.supplier_name}</span>}
                            {service.service_date && <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{format(new Date(service.service_date), "MMM d")}</span>}
                            {service.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{service.location}</span>}
                            {service.confirmation_number && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">#{service.confirmation_number}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold font-mono text-foreground">
                            {Number(service.total_cost || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">{service.currency}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">{service.quantity}A × {Number(service.unit_price || 0).toLocaleString()}{(service.metadata as any)?.child_quantity > 0 && ` + ${(service.metadata as any).child_quantity}C × ${Number((service.metadata as any).child_unit_price || 0).toLocaleString()}`}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingService({ ...service, pricing_mode: service.metadata?.pricing_mode || "detailed", child_quantity: service.metadata?.child_quantity || 0, child_unit_price: service.metadata?.child_unit_price || 0, children_free: service.metadata?.children_free || false }); setShowServiceDialog(true); }}>
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

              {/* Services cost breakdown by status */}
              <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-accent/10 overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{isArabic ? "تكاليف الخدمات" : "Services Cost"}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {serviceCostByStatus.confirmed > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />{isArabic ? "مؤكد" : "Confirmed"}</span>
                        <span className="font-mono font-semibold text-foreground">{serviceCostByStatus.confirmed.toLocaleString()} {booking.currency}</span>
                      </div>
                    )}
                    {serviceCostByStatus.booked > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{isArabic ? "محجوز" : "Booked"}</span>
                        <span className="font-mono font-semibold text-foreground">{serviceCostByStatus.booked.toLocaleString()} {booking.currency}</span>
                      </div>
                    )}
                    {serviceCostByStatus.pending > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />{isArabic ? "معلق" : "Pending"}</span>
                        <span className="font-mono font-semibold text-muted-foreground">{serviceCostByStatus.pending.toLocaleString()} {booking.currency}</span>
                      </div>
                    )}
                    {serviceCostByStatus.cancelled > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="line-through">{isArabic ? "ملغي" : "Cancelled"}</span></span>
                        <span className="font-mono font-semibold text-muted-foreground line-through">{serviceCostByStatus.cancelled.toLocaleString()} {booking.currency}</span>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">{isArabic ? "الإجمالي الفعلي" : "Active Total"}</span>
                    <span className="text-lg font-bold font-mono text-foreground">{servicesActiveCost.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{booking.currency}</span></span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Financials ─── */}
      {activeTab === "financials" && (
        <div className="space-y-6">
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Cost — auto from services with manual override */}
            <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-accent/20 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "التكلفة" : "Total Cost"}</Label>
              </div>
              <Input
                type="number"
                className="h-10 text-sm font-mono font-bold border-border/60 bg-transparent"
                defaultValue={booking.total_cost || 0}
                key={`tc-${booking.total_cost}`}
                onBlur={e => updateBooking.mutate({ total_cost: parseFloat(e.target.value) || 0 })}
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground">{isArabic ? "من الخدمات" : "From services"}: <span className="font-mono font-semibold">{servicesActiveCost.toLocaleString()}</span></span>
                {Number(booking.total_cost || 0) !== servicesActiveCost && servicesActiveCost > 0 && (
                  <button
                    type="button"
                    className="text-[9px] text-accent hover:underline font-medium"
                    onClick={() => updateBooking.mutate({ total_cost: servicesActiveCost })}
                  >
                    {isArabic ? "مزامنة" : "Sync"}
                  </button>
                )}
              </div>
            </div>

            {/* Selling Price */}
            <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-accent/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "سعر البيع" : "Selling Price"}</Label>
              </div>
              <Input
                type="number"
                className="h-10 text-sm font-mono font-bold border-border/60 bg-transparent"
                defaultValue={booking.selling_price || 0}
                key={`sp-${booking.selling_price}`}
                onBlur={e => updateBooking.mutate({ selling_price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Profit */}
            {(() => {
              const profit = (booking.selling_price || 0) - (booking.total_cost || 0);
              const isPositive = profit >= 0;
              return (
                <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-accent/20 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isPositive ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40")}>
                      <Activity className={cn("w-4 h-4", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")} />
                    </div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "الربح" : "Profit"}</Label>
                  </div>
                  <p className={cn("text-xl font-mono font-bold", isPositive ? "text-emerald-600" : "text-destructive")}>
                    {profit.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{booking.currency}</span>
                  </p>
                </div>
              );
            })()}

            {/* Balance */}
            <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-accent/20 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", balance > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-emerald-100 dark:bg-emerald-900/40")}>
                  <Clock className={cn("w-4 h-4", balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")} />
                </div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "الرصيد المتبقي" : "Balance"}</Label>
              </div>
              <p className={cn("text-xl font-mono font-bold", balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                {balance > 0 ? balance.toLocaleString() : (isArabic ? "مدفوع بالكامل" : "Fully Paid")} {balance > 0 && <span className="text-xs text-muted-foreground font-normal">{booking.currency}</span>}
              </p>
            </div>
          </div>

          {/* Payment Records */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 via-muted/30 to-transparent border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center shadow-sm">
                  <CreditCard className="w-3.5 h-3.5 text-accent-foreground" />
                </div>
                {isArabic ? "سجل المدفوعات" : "Payment Records"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
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
          bookingAdults={booking?.adults || 1}
          bookingChildren={booking?.children || 0}
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
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden dark-header-dialog">
        <ModalDarkHeader
          icon={<Users className="w-5 h-5 text-accent-foreground" />}
          title={form._isNew ? (isArabic ? "إضافة مسافر" : "Add Traveler") : (isArabic ? "تعديل المسافر" : "Edit Traveler")}
          description={isArabic ? "معلومات جواز السفر والبيانات الشخصية" : "Passport details & personal info"}
        />

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

function ServiceDialog({ service, isArabic, open, onClose, onSave, isSaving, bookingAdults, bookingChildren }: any) {
  const [form, setForm] = useState({ ...service });
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhanceTitle = async () => {
    if (!form.title?.trim()) return;
    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-service-title", {
        body: { title: form.title, serviceType: form.service_type, language: isArabic ? "ar" : "en" },
      });
      if (error) throw error;
      if (data?.enhanced) setForm((prev: any) => ({ ...prev, title: data.enhanced }));
    } catch (e) {
      console.error("Enhance failed:", e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const typeConfig: Record<string, {
    icon: any; headerLabel: string; headerLabelAr: string; subtitle: string; subtitleAr: string;
    titlePlaceholder: string; titlePlaceholderAr: string; locationLabel: string; locationLabelAr: string;
    locationPlaceholder: string; locationPlaceholderAr: string; notesPlaceholder: string; notesPlaceholderAr: string;
    showPickupDropoff?: boolean; showStartEndTime?: boolean; showDuration?: boolean; supplierLabel?: string; supplierLabelAr?: string;
  }> = {
    hotel: {
      icon: Hotel, headerLabel: "Hotel / Accommodation", headerLabelAr: "فندق / إقامة",
      subtitle: "Add hotel, resort, or accommodation details", subtitleAr: "أضف تفاصيل الفندق أو الإقامة",
      titlePlaceholder: "e.g., Marriott Mena House 5★", titlePlaceholderAr: "مثال: ماريوت مينا هاوس 5★",
      locationLabel: "Hotel Address", locationLabelAr: "عنوان الفندق",
      locationPlaceholder: "e.g., Pyramids Road, Giza", locationPlaceholderAr: "مثال: طريق الأهرامات، الجيزة",
      notesPlaceholder: "Room type, meal plan, check-in/out times...", notesPlaceholderAr: "نوع الغرفة، خطة الوجبات، مواعيد الوصول/المغادرة...",
      supplierLabel: "Hotel / Chain", supplierLabelAr: "الفندق / السلسلة",
    },
    transfer: {
      icon: Car, headerLabel: "Transfer / Transport", headerLabelAr: "نقل / مواصلات",
      subtitle: "Airport pickup, city transfers, private cars", subtitleAr: "استقبال المطار، التنقلات، سيارات خاصة",
      titlePlaceholder: "e.g., Airport → Hotel Transfer", titlePlaceholderAr: "مثال: نقل من المطار إلى الفندق",
      locationLabel: "Route", locationLabelAr: "المسار",
      locationPlaceholder: "e.g., Cairo Airport → Downtown Hotel", locationPlaceholderAr: "مثال: مطار القاهرة → فندق وسط البلد",
      notesPlaceholder: "Vehicle type, flight number, meet & greet details...", notesPlaceholderAr: "نوع المركبة، رقم الرحلة، تفاصيل الاستقبال...",
      showPickupDropoff: true, showStartEndTime: true,
      supplierLabel: "Transport Company", supplierLabelAr: "شركة النقل",
    },
    tour: {
      icon: MapPin, headerLabel: "Tour / Excursion", headerLabelAr: "جولة / رحلة",
      subtitle: "Guided tours, day trips, experiences", subtitleAr: "جولات سياحية، رحلات يومية، تجارب",
      titlePlaceholder: "e.g., Pyramids & Sphinx Guided Tour", titlePlaceholderAr: "مثال: جولة الأهرامات وأبو الهول",
      locationLabel: "Meeting Point", locationLabelAr: "نقطة التجمع",
      locationPlaceholder: "e.g., Hotel lobby at 8:00 AM", locationPlaceholderAr: "مثال: لوبي الفندق الساعة 8:00 صباحاً",
      notesPlaceholder: "Itinerary highlights, what's included, entrance fees...", notesPlaceholderAr: "أبرز المحطات، ما يشمله، رسوم الدخول...",
      showStartEndTime: true, showDuration: true,
      supplierLabel: "Tour Operator", supplierLabelAr: "منظم الرحلة",
    },
    guide: {
      icon: User, headerLabel: "Tour Guide", headerLabelAr: "مرشد سياحي",
      subtitle: "Professional licensed tour guides", subtitleAr: "مرشدون سياحيون مرخصون",
      titlePlaceholder: "e.g., 🇬🇧 English-speaking Guide", titlePlaceholderAr: "مثال: 🇬🇧 مرشد يتحدث الإنجليزية",
      locationLabel: "Meeting Point", locationLabelAr: "نقطة التجمع",
      locationPlaceholder: "e.g., Hotel lobby", locationPlaceholderAr: "مثال: لوبي الفندق",
      notesPlaceholder: "Languages spoken, specialization, license #...", notesPlaceholderAr: "اللغات، التخصص، رقم الترخيص...",
      showStartEndTime: true, showDuration: true,
      supplierLabel: "Guide Name / Agency", supplierLabelAr: "اسم المرشد / الوكالة",
    },
    meal: {
      icon: FileText, headerLabel: "Meal / Dining", headerLabelAr: "وجبة / مطعم",
      subtitle: "Restaurant reservations, meal plans", subtitleAr: "حجوزات المطاعم، خطط الوجبات",
      titlePlaceholder: "e.g., Dinner at Nile View Restaurant", titlePlaceholderAr: "مثال: عشاء في مطعم بإطلالة على النيل",
      locationLabel: "Restaurant / Venue", locationLabelAr: "المطعم / المكان",
      locationPlaceholder: "e.g., Four Seasons Nile Plaza", locationPlaceholderAr: "مثال: فور سيزونز نايل بلازا",
      notesPlaceholder: "Cuisine type, dietary needs, reservation time...", notesPlaceholderAr: "نوع المطبخ، احتياجات غذائية، موعد الحجز...",
      showStartEndTime: true,
      supplierLabel: "Restaurant", supplierLabelAr: "المطعم",
    },
    activity: {
      icon: Activity, headerLabel: "Activity / Experience", headerLabelAr: "نشاط / تجربة",
      subtitle: "Special activities, shows, cruises", subtitleAr: "أنشطة خاصة، عروض، رحلات بحرية",
      titlePlaceholder: "e.g., Felucca Ride on the Nile", titlePlaceholderAr: "مثال: ركوب الفلوكة على النيل",
      locationLabel: "Venue / Location", locationLabelAr: "المكان / الموقع",
      locationPlaceholder: "e.g., Corniche El Nile, Aswan", locationPlaceholderAr: "مثال: كورنيش النيل، أسوان",
      notesPlaceholder: "Duration, what to bring, age restrictions...", notesPlaceholderAr: "المدة، ماذا تحضر، قيود العمر...",
      showStartEndTime: true, showDuration: true,
      supplierLabel: "Provider", supplierLabelAr: "مزود الخدمة",
    },
    flight: {
      icon: Plane, headerLabel: "Flight Ticket", headerLabelAr: "تذكرة طيران",
      subtitle: "Domestic & international flight bookings", subtitleAr: "حجوزات الطيران الداخلية والدولية",
      titlePlaceholder: "e.g., Cairo → Istanbul (Turkish Airlines)", titlePlaceholderAr: "مثال: القاهرة → اسطنبول (الخطوط التركية)",
      locationLabel: "Route", locationLabelAr: "المسار",
      locationPlaceholder: "e.g., CAI → IST", locationPlaceholderAr: "مثال: القاهرة → اسطنبول",
      notesPlaceholder: "Airline, flight number, class, baggage allowance, PNR...", notesPlaceholderAr: "شركة الطيران، رقم الرحلة، الدرجة، الأمتعة، رقم الحجز...",
      showStartEndTime: true,
      supplierLabel: "Airline / Agency", supplierLabelAr: "شركة الطيران / الوكالة",
    },
    visa: {
      icon: Stamp, headerLabel: "Visa Fees", headerLabelAr: "رسوم التأشيرة",
      subtitle: "Visa processing, application fees", subtitleAr: "معالجة التأشيرات، رسوم التقديم",
      titlePlaceholder: "e.g., Turkey Tourist Visa", titlePlaceholderAr: "مثال: تأشيرة سياحية لتركيا",
      locationLabel: "Embassy / Consulate", locationLabelAr: "السفارة / القنصلية",
      locationPlaceholder: "e.g., Turkish Embassy, Cairo", locationPlaceholderAr: "مثال: السفارة التركية، القاهرة",
      notesPlaceholder: "Visa type, processing time, documents required, passport details...", notesPlaceholderAr: "نوع التأشيرة، مدة المعالجة، المستندات المطلوبة، تفاصيل الجواز...",
      supplierLabel: "Visa Agent", supplierLabelAr: "وكيل التأشيرات",
    },
    entrance: {
      icon: Ticket, headerLabel: "Entrance Ticket", headerLabelAr: "تذكرة دخول",
      subtitle: "Museum, monument & attraction tickets", subtitleAr: "تذاكر المتاحف والمعالم والأماكن السياحية",
      titlePlaceholder: "e.g., Egyptian Museum Entrance", titlePlaceholderAr: "مثال: تذكرة دخول المتحف المصري",
      locationLabel: "Venue / Site", locationLabelAr: "المكان / الموقع",
      locationPlaceholder: "e.g., Egyptian Museum, Tahrir Square", locationPlaceholderAr: "مثال: المتحف المصري، ميدان التحرير",
      notesPlaceholder: "Ticket type (adult/child/student), opening hours, group discounts...", notesPlaceholderAr: "نوع التذكرة (بالغ/طفل/طالب)، ساعات العمل، خصومات المجموعات...",
      showStartEndTime: true,
      supplierLabel: "Ticket Provider", supplierLabelAr: "مزود التذاكر",
    },
    other: {
      icon: FileText, headerLabel: "Other Service", headerLabelAr: "خدمة أخرى",
      subtitle: "Insurance, misc services", subtitleAr: "التأمين، خدمات متنوعة",
      titlePlaceholder: "e.g., Travel Insurance", titlePlaceholderAr: "مثال: تأمين السفر",
      locationLabel: "Location", locationLabelAr: "الموقع",
      locationPlaceholder: "Service location or address", locationPlaceholderAr: "موقع الخدمة أو العنوان",
      notesPlaceholder: "Any relevant details or special instructions...", notesPlaceholderAr: "أي تفاصيل أو تعليمات خاصة...",
      supplierLabel: "Supplier", supplierLabelAr: "المورد",
    },
  };

  const cfg = typeConfig[form.service_type] || typeConfig.other;
  const HeaderIcon = cfg.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="relative px-6 pt-5 pb-4 navy-gradient">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--gold)/0.3),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <HeaderIcon className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                {form._isNew
                  ? (isArabic ? cfg.headerLabelAr : cfg.headerLabel)
                  : (isArabic ? "تعديل الخدمة" : "Edit Service")}
              </h2>
              <p className="text-[11px] text-white/60">{isArabic ? cfg.subtitleAr : cfg.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Service type chips */}
          <div>
            <Label className="text-xs font-medium mb-2 block">{isArabic ? "نوع الخدمة" : "Service Type"}</Label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_TYPES.map(st => {
                const StIcon = st.icon;
                const isActive = form.service_type === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setForm({ ...form, service_type: st.value })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "border-accent bg-accent/10 text-accent shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <StIcon className="w-3.5 h-3.5" />
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Main fields - 2 column layout */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? "العنوان" : "Title"} <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-11 flex-1" placeholder={isArabic ? cfg.titlePlaceholderAr : cfg.titlePlaceholder} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!form.title?.trim() || isEnhancing}
                  onClick={enhanceTitle}
                  className="h-11 px-3 gap-1.5 text-xs shrink-0 border-accent/30 text-accent hover:bg-accent/10"
                >
                  {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-sm">✨</span>}
                  {isArabic ? "تحسين بالذكاء" : "AI Enhance"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الحالة" : "Status"}</Label>
              <Select value={form.status || "pending"} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "confirmed", "cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "التاريخ" : "Service Date"}</Label>
              <Input type="date" value={form.service_date || ""} onChange={e => setForm({ ...form, service_date: e.target.value })} className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? (cfg.supplierLabelAr || "المورد") : (cfg.supplierLabel || "Supplier")}</Label>
              <Input value={form.supplier_name || ""} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="mt-1 h-11" placeholder={isArabic ? (cfg.supplierLabelAr || "المورد") : (cfg.supplierLabel || "Supplier")} />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "رقم التأكيد" : "Confirmation #"}</Label>
              <Input value={form.confirmation_number || ""} onChange={e => setForm({ ...form, confirmation_number: e.target.value })} className="mt-1 h-11 font-mono" placeholder="e.g., CNF-2024-001" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? cfg.locationLabelAr : cfg.locationLabel}</Label>
              <Input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1 h-11" placeholder={isArabic ? cfg.locationPlaceholderAr : cfg.locationPlaceholder} />
            </div>
          </div>

          {/* Conditional: Pickup/Dropoff for transfers */}
          {cfg.showPickupDropoff && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "نقطة الالتقاط" : "Pickup Location"}</Label>
                <Input value={form.pickup_location || ""} onChange={e => setForm({ ...form, pickup_location: e.target.value })} className="mt-1 h-11" placeholder={isArabic ? "مثال: مطار القاهرة T2" : "e.g., Cairo Airport T2"} />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "نقطة الإنزال" : "Dropoff Location"}</Label>
                <Input value={form.dropoff_location || ""} onChange={e => setForm({ ...form, dropoff_location: e.target.value })} className="mt-1 h-11" placeholder={isArabic ? "مثال: فندق وسط البلد" : "e.g., Downtown Hotel"} />
              </div>
            </div>
          )}

          {/* Conditional: Start/End time */}
          {cfg.showStartEndTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "وقت البداية" : "Start Time"}</Label>
                <Input type="time" value={form.start_time || ""} onChange={e => setForm({ ...form, start_time: e.target.value })} className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "وقت النهاية" : "End Time"}</Label>
                <Input type="time" value={form.end_time || ""} onChange={e => setForm({ ...form, end_time: e.target.value })} className="mt-1 h-11" />
              </div>
            </div>
          )}

          {/* Conditional: Duration */}
          {cfg.showDuration && (
            <div className="w-1/2">
              <Label className="text-xs">{isArabic ? "المدة (دقائق)" : "Duration (minutes)"}</Label>
              <Input type="number" min={0} value={form.duration_minutes || ""} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || null })} className="mt-1 h-11" placeholder="e.g., 120" />
            </div>
          )}

          {/* Pricing row */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {isArabic ? "التسعير" : "Pricing"}
              </p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button type="button" onClick={() => setForm({ ...form, pricing_mode: "flat" })} className={cn("px-3 py-1 text-[10px] font-semibold transition-all", (form.pricing_mode || "detailed") === "flat" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {isArabic ? "مبلغ إجمالي" : "Flat Rate"}
                </button>
                <button type="button" onClick={() => setForm({ ...form, pricing_mode: "detailed" })} className={cn("px-3 py-1 text-[10px] font-semibold transition-all", (form.pricing_mode || "detailed") === "detailed" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {isArabic ? "تفصيلي" : "Detailed"}
                </button>
              </div>
            </div>

            {(form.pricing_mode || "detailed") === "flat" ? (
              /* ── Flat rate: single total ── */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{isArabic ? "المبلغ الإجمالي" : "Total Amount"}</Label>
                  <Input type="number" min={0} value={form.unit_price || 0} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0, quantity: 1, child_quantity: 0, child_unit_price: 0 })} className="mt-0.5 h-11 font-mono text-sm font-bold" placeholder="e.g., 500" />
                </div>
                <div className="flex items-end">
                  <div className="h-11 w-full rounded-md border border-border bg-background flex items-center justify-center text-sm font-bold font-mono text-foreground">
                    {(form.unit_price || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              /* ── Detailed: adults + children ── */
              <>
                {/* Adults row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="text-[10px] w-16 justify-center shrink-0">{isArabic ? "بالغين" : "Adults"}</Badge>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{isArabic ? "عدد" : "Qty"}</Label>
                      <Input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} className="mt-0.5 h-9 text-center font-bold text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{isArabic ? "سعر الفرد" : "Price/each"}</Label>
                      <Input type="number" min={0} value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} className="mt-0.5 h-9 font-mono text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{isArabic ? "الإجمالي" : "Subtotal"}</Label>
                      <div className="mt-0.5 h-9 rounded-md border border-border bg-background flex items-center justify-center text-xs font-bold font-mono">
                        {((form.quantity || 0) * (form.unit_price || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Children row */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="text-[10px] w-16 justify-center shrink-0">{isArabic ? "أطفال" : "Children"}</Badge>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <Input type="number" min={0} value={form.child_quantity || 0} onChange={e => setForm({ ...form, child_quantity: parseInt(e.target.value) || 0 })} className="h-9 text-center font-bold text-sm" disabled={form.children_free} />
                    </div>
                    <div>
                      <Input type="number" min={0} value={form.children_free ? 0 : (form.child_unit_price || 0)} onChange={e => setForm({ ...form, child_unit_price: parseFloat(e.target.value) || 0 })} className="h-9 font-mono text-sm" disabled={form.children_free} />
                    </div>
                    <div>
                      <div className="h-9 rounded-md border border-border bg-background flex items-center justify-center text-xs font-bold font-mono">
                        {form.children_free ? "0" : ((form.child_quantity || 0) * (form.child_unit_price || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Children free toggle */}
                <div className="flex items-center gap-2 mb-3 ml-[4.5rem]">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, children_free: !form.children_free, child_unit_price: !form.children_free ? 0 : form.child_unit_price })}
                    className={cn("flex items-center gap-1.5 text-[10px] font-medium rounded-full border px-2.5 py-1 transition-all",
                      form.children_free ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <CheckCircle2 className={cn("w-3 h-3", form.children_free ? "text-emerald-600" : "text-muted-foreground/40")} />
                    {isArabic ? "الأطفال مجاناً" : "Children are FREE"}
                  </button>
                </div>
              </>
            )}

            {/* Grand total */}
            <Separator className="mb-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{isArabic ? "الإجمالي الكلي" : "Grand Total"}</span>
              <span className="text-base font-bold font-mono text-foreground">
                {(form.pricing_mode || "detailed") === "flat"
                  ? (form.unit_price || 0).toLocaleString()
                  : (((form.quantity || 0) * (form.unit_price || 0)) + (form.children_free ? 0 : ((form.child_quantity || 0) * (form.child_unit_price || 0)))).toLocaleString()
                }
              </span>
            </div>
          </div>

          <div>
            <Label className="text-xs">{isArabic ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 text-sm resize-none" placeholder={isArabic ? cfg.notesPlaceholderAr : cfg.notesPlaceholder} />
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
