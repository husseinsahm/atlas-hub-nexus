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
  MoreVertical, Printer, Download, Copy, Archive,
  Link, ExternalLink, Share2, Receipt, ArrowRightLeft, Check,
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
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
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
import { InternalComments } from "@/components/InternalComments";
import { FileAttachments } from "@/components/FileAttachments";
import { PaymentRecords } from "@/components/PaymentRecords";
import { ItineraryBuilder } from "@/components/itinerary/ItineraryBuilder";
import { createNotification } from "@/hooks/useNotifications";
import { ShareLinkSettingsModal } from "@/components/booking/ShareLinkSettingsModal";
import { GenerateQuotationModal } from "@/components/quotation/GenerateQuotationModal";
import { TravelersTab as PremiumTravelersTab } from "@/components/booking/TravelersTab";

type BookingStatus = "tentative" | "confirmed" | "in_operation" | "completed" | "cancelled";

const STATUS_CONFIG: Record<BookingStatus, { label: string; labelAr: string; color: string; bg: string; pillBg: string; pillText: string; next?: BookingStatus }> = {
  tentative: { label: "Tentative", labelAr: "مبدئي", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", pillBg: "bg-amber-100 dark:bg-amber-900/50", pillText: "text-amber-700 dark:text-amber-300", next: "confirmed" },
  confirmed: { label: "Confirmed", labelAr: "مؤكد", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", pillBg: "bg-blue-100 dark:bg-blue-900/50", pillText: "text-blue-700 dark:text-blue-300", next: "in_operation" },
  in_operation: { label: "In Operation", labelAr: "قيد التنفيذ", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", pillBg: "bg-emerald-100 dark:bg-emerald-900/50", pillText: "text-emerald-700 dark:text-emerald-300", next: "completed" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/40", pillBg: "bg-slate-100 dark:bg-slate-800/50", pillText: "text-slate-600 dark:text-slate-400" },
  cancelled: { label: "Cancelled", labelAr: "ملغي", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", pillBg: "bg-red-100 dark:bg-red-900/50", pillText: "text-red-700 dark:text-red-300" },
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
  { value: "feedback", label: "Client Feedback", labelAr: "ملاحظات العميل", icon: CheckCircle2 },
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

  // Read ?tab= from URL for deep-linking (e.g. from notification click)
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = searchParams.get("tab") || "summary";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showTravelerDialog, setShowTravelerDialog] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<any>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);

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

  // ─── Fetch client feedback ───
  const { data: feedbackList = [], refetch: refetchFeedback } = useQuery({
    queryKey: ["booking-feedback", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_feedback")
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

  // ─── Fetch existing share tokens ───
  const { data: shareTokens = [], refetch: refetchShareTokens } = useQuery({
    queryKey: ["booking-share-tokens", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_share_tokens")
        .select("*")
        .eq("booking_id", id!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ─── Fetch related quotations ───
  const { data: relatedQuotations = [] } = useQuery({
    queryKey: ["booking-quotations", booking?.trip_id, booking?.company_id],
    queryFn: async () => {
      let query = supabase
        .from("quotations")
        .select("id, quotation_number, status, total_amount, currency")
        .eq("company_id", booking!.company_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      
      if (booking!.trip_id) {
        query = query.eq("trip_id", booking!.trip_id);
      } else if (booking!.customer_id) {
        query = query.eq("customer_id", booking!.customer_id);
      } else {
        return [];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!booking && !!(booking.trip_id || booking.customer_id),
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
      const payload = {
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
      };

      const isUpdate = traveler.id && !traveler._isNew;
      console.log("Traveler Save Payload:", { isUpdate, travelerId: traveler.id, payload });

      if (isUpdate) {
        // Try direct first, then fallback to proxy
        const { data, error, status } = await supabase
          .from("booking_travelers")
          .update(payload)
          .eq("id", traveler.id)
          .select("*")
          .single();
        console.log("Traveler Save Response:", { data, error, status });
        if (error) {
          console.error("Traveler Save Error (direct update):", error);
          // Fallback to proxy-mutation
          console.log("Falling back to proxy-mutation for update...");
          const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-mutation", {
            body: {
              table: "booking_travelers",
              operation: "update",
              payload,
              filters: [{ column: "id", value: traveler.id }],
              select: "*",
              single: true,
            },
          });
          console.log("Traveler Save Proxy Response:", { proxyData, proxyError });
          if (proxyError) throw proxyError;
          if (proxyData?.error) throw proxyData.error;
          return proxyData?.data;
        }
        return data;
      } else {
        const insertPayload = { ...payload, booking_id: id!, company_id: booking!.company_id };
        const { data, error, status } = await supabase
          .from("booking_travelers")
          .insert(insertPayload)
          .select("*")
          .single();
        console.log("Traveler Save Response:", { data, error, status });
        if (error) {
          console.error("Traveler Save Error (direct insert):", error);
          console.log("Falling back to proxy-mutation for insert...");
          const { data: proxyData, error: proxyError } = await supabase.functions.invoke("proxy-mutation", {
            body: {
              table: "booking_travelers",
              operation: "insert",
              payload: insertPayload,
              select: "*",
              single: true,
            },
          });
          console.log("Traveler Save Proxy Response:", { proxyData, proxyError });
          if (proxyError) throw proxyError;
          if (proxyData?.error) throw proxyData.error;
          return proxyData?.data;
        }
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-travelers", id] });
      setShowTravelerDialog(false);
      setEditingTraveler(null);
      toast({ title: isArabic ? "تم حفظ المسافر بنجاح" : "Traveler saved successfully" });
    },
    onError: (error: any) => {
      console.error("Traveler Save Final Error:", error);
      toast({
        title: isArabic ? "فشل حفظ المسافر" : "Failed to save traveler",
        description: error?.message || "Something went wrong, please try again",
        variant: "destructive",
      });
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

  // ─── Share link generation ───
  const generateShareLink = async () => {
    if (!booking || !companyId) return;
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase
        .from("booking_share_tokens")
        .insert({
          booking_id: id!,
          company_id: booking.company_id,
          created_by: user?.id,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      const shareUrl = `${window.location.origin}/booking/${data.token}`;
      await navigator.clipboard.writeText(shareUrl);
      await refetchShareTokens();
      toast({
        title: isArabic ? "تم نسخ الرابط!" : "Link copied!",
        description: shareUrl,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingLink(false);
    }
  };

  const previewClientItinerary = () => {
    if (shareTokens.length > 0) {
      window.open(`/booking/${shareTokens[0].token}`, "_blank");
    } else {
      setShowShareDialog(true);
    }
  };

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
          <ArrowLeft className="w-4 h-4 me-2" /> {isArabic ? "العودة" : "Back"}
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[booking.status as BookingStatus] || STATUS_CONFIG.tentative;
  const customer = (booking as any).customers;
  const balance = (booking.selling_price || 0) - (booking.amount_paid || 0);
  const paidPercent = booking.selling_price ? Math.min(100, ((booking.amount_paid || 0) / booking.selling_price) * 100) : 0;

  return (
    <div className="space-y-0">
      {/* ─── Premium Compact Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative -mx-6 -mt-6 px-6 pt-5 pb-5 mb-0 overflow-hidden border-b border-border bg-card"
      >
        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 gold-gradient" />

        {/* Top row: Back + Actions */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/bookings")}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs -ms-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isArabic ? "الحجوزات" : "Bookings"}
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Share buttons */}
            <Button
              size="sm"
              variant="outline"
              onClick={previewClientItinerary}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <Eye className="w-3.5 h-3.5" />
              {isArabic ? "معاينة البرنامج" : "Preview Client Itinerary"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowShareDialog(true)}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <Link className="w-3.5 h-3.5" />
              {isArabic ? "رابط المشاركة" : "Share Link"}
            </Button>
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
                <div className={cn("w-2 h-2 rounded-full", sc.pillBg.split(" ")[0].replace("bg-", "bg-"))} style={{ background: sc.color.includes("amber") ? "#f59e0b" : sc.color.includes("blue") ? "#3b82f6" : sc.color.includes("emerald") ? "#10b981" : sc.color.includes("red") ? "#ef4444" : "#94a3b8" }} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={previewClientItinerary}>
                  <ExternalLink className="w-4 h-4 me-2" />{isArabic ? "معاينة البرنامج للعميل" : "Preview Client Itinerary"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                  <Share2 className="w-4 h-4 me-2" />{isArabic ? "إعدادات رابط المشاركة" : "Share Link Settings"}
                </DropdownMenuItem>
                {shareTokens.length > 0 && (
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/booking/${shareTokens[0].token}`); toast({ title: isArabic ? "تم نسخ الرابط" : "Link copied" }); }}>
                    <Copy className="w-4 h-4 me-2" />{isArabic ? "نسخ الرابط الحالي" : "Copy Existing Link"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem><Printer className="w-4 h-4 me-2" />{isArabic ? "طباعة" : "Print"}</DropdownMenuItem>
                <DropdownMenuItem><Download className="w-4 h-4 me-2" />{isArabic ? "تصدير PDF" : "Export PDF"}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowQuotationModal(true)}>
                  <Receipt className="w-4 h-4 me-2" />{isArabic ? "إنشاء عرض سعر" : "Generate Quotation"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Archive className="w-4 h-4 me-2" />{isArabic ? "أرشفة" : "Archive"}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 me-2" />{isArabic ? "حذف" : "Delete"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main info row */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold font-display text-foreground">
                {customer?.full_name || booking.title}
              </h1>
              <Badge variant="outline" className="font-mono text-[10px] bg-muted/50">{booking.booking_number}</Badge>
              <Badge className={cn("border-0 text-[10px] font-semibold", sc.pillBg, sc.pillText)}>
                {isArabic ? sc.labelAr : sc.label}
              </Badge>
              {relatedQuotations.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-accent/10 transition-colors gap-1"
                  onClick={() => navigate(`/dashboard/quotations/${relatedQuotations[0].id}`)}
                >
                  <Receipt className="w-3 h-3" />
                  {relatedQuotations[0].quotation_number}
                  {relatedQuotations.length > 1 && ` +${relatedQuotations.length - 1}`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {customer?.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Phone className="w-3 h-3" /> {customer.phone}
                </a>
              )}
              {customer?.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Mail className="w-3 h-3" /> {customer.email}
                </a>
              )}
              {(booking as any).source && (
                <span className="flex items-center gap-1 capitalize">
                  <Globe className="w-3 h-3" /> {(booking as any).source}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick stat pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { icon: Calendar, label: `${booking.total_days} ${isArabic ? "يوم" : "days"}`, sub: (booking as any).arrival_date ? `${format(new Date((booking as any).arrival_date), "MMM d")} → ${(booking as any).departure_date ? format(new Date((booking as any).departure_date), "MMM d") : "..."}` : undefined, colorClass: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40" },
            { icon: Users, label: `${booking.adults}A${booking.children > 0 ? ` · ${booking.children}C` : ""}`, sub: `${travelers.length} ${isArabic ? "مسجل" : "registered"}`, colorClass: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40" },
            { icon: DollarSign, label: `${Number(booking.selling_price || 0).toLocaleString()} ${booking.currency}`, sub: isArabic ? "سعر البيع" : "Selling price", colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40" },
            ...(balance > 0 ? [{ icon: CreditCard, label: `${balance.toLocaleString()} ${booking.currency}`, sub: isArabic ? "متبقي" : "remaining", colorClass: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40" }] : []),
          ].map((pill, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg bg-background border border-border px-3 py-2 text-xs">
              <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", pill.colorClass)}>
                <pill.icon className="w-3 h-3" />
              </div>
              <div>
                <span className="font-semibold text-foreground tabular-nums">{pill.label}</span>
                {pill.sub && <p className="text-[10px] text-muted-foreground leading-tight">{pill.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Tab Navigation ─── */}
      <div className="sticky top-0 z-10 -mx-6 px-6 bg-muted/40 backdrop-blur-md border-b border-border">
        <div className="flex gap-0 overflow-x-auto scrollbar-thin">
          {TABS.map(tab => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className={cn("w-3.5 h-3.5", isActive && "text-accent")} />
                {isArabic ? tab.labelAr : tab.label}
                {tab.value === "feedback" && feedbackList.filter((f: any) => f.status === "pending").length > 0 && (
                  <span className="ml-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {feedbackList.filter((f: any) => f.status === "pending").length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeBookingTab"
                    className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-accent"
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
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" />
                  {isArabic ? "تفاصيل الحجز" : "Booking Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* Booking Number */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{isArabic ? "رقم الحجز" : "Booking Number"}</p>
                    <p className="text-sm font-bold font-mono text-foreground">{booking.booking_number}</p>
                  </div>
                  <Badge className={cn("border-0 text-xs font-semibold", sc.pillBg, sc.pillText)}>
                    {isArabic ? sc.labelAr : sc.label}
                  </Badge>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-border/50">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Plane className="w-3 h-3 text-emerald-500 rotate-[-45deg]" />
                      {isArabic ? "الوصول" : "Arrival"}
                    </Label>
                    <Input
                      type="date"
                      className="h-9 text-xs border-border/60"
                      defaultValue={(booking as any).arrival_date || booking.start_date || ""}
                      onBlur={e => updateBooking.mutate({ arrival_date: e.target.value || null, start_date: e.target.value || null })}
                    />
                  </div>
                  <div className="p-3 rounded-lg border border-border/50">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Plane className="w-3 h-3 text-rose-500 rotate-45" />
                      {isArabic ? "المغادرة" : "Departure"}
                    </Label>
                    <Input
                      type="date"
                      className="h-9 text-xs border-border/60"
                      defaultValue={(booking as any).departure_date || booking.end_date || ""}
                      onBlur={e => updateBooking.mutate({ departure_date: e.target.value || null, end_date: e.target.value || null })}
                    />
                  </div>
                </div>

                {/* Source & Agent */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-border/50">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Globe className="w-3 h-3" />
                      {isArabic ? "المصدر" : "Source"}
                    </Label>
                    <Select
                      value={(booking as any).source || "email"}
                      onValueChange={v => updateBooking.mutate({ source: v })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["email","phone","walk_in","website","referral","social_media","partner","other"].map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 rounded-lg border border-border/50">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <UserCheck className="w-3 h-3" />
                      {isArabic ? "الموظف" : "Agent"}
                    </Label>
                    <Select
                      value={booking.assigned_to || ""}
                      onValueChange={v => updateBooking.mutate({ assigned_to: v })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={isArabic ? "اختر..." : "Select..."} /></SelectTrigger>
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

          {/* Notes sidebar */}
          <div className="space-y-5">
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <StickyNote className="w-3.5 h-3.5" />
                  {isArabic ? "ملاحظات" : "Notes"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {[
                  { key: "internal_notes", label: isArabic ? "داخلية" : "Internal", placeholder: isArabic ? "ملاحظات داخلية..." : "Internal notes...", borderColor: "border-s-amber-500" },
                  { key: "operations_notes", label: isArabic ? "عمليات" : "Operations", placeholder: isArabic ? "ملاحظات العمليات..." : "Operations notes...", borderColor: "border-s-blue-500" },
                  { key: "client_notes", label: isArabic ? "عميل" : "Client", placeholder: isArabic ? "ملاحظات للعميل..." : "Notes for client...", borderColor: "border-s-emerald-500" },
                ].map(note => (
                  <div key={note.key} className={cn("rounded-lg border border-border/50 p-3 border-s-2", note.borderColor)}>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">{note.label}</Label>
                    <Textarea
                      defaultValue={(booking as any)[note.key] || ""}
                      onBlur={e => updateBooking.mutate({ [note.key]: e.target.value })}
                      placeholder={note.placeholder}
                      rows={2}
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
          <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              {isArabic ? "معلومات العميل" : "Customer Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {customer ? (
              <div className="space-y-5">
                {/* Customer header */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center text-xl font-bold text-accent-foreground shadow-lg">
                    {customer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-foreground font-display">{customer.full_name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {customer.email && (
                        <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:text-foreground">
                          <Mail className="w-3 h-3" /> {customer.email}
                        </a>
                      )}
                      {customer.phone && (
                        <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-foreground">
                          <Phone className="w-3 h-3" /> {customer.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: isArabic ? "الجنسية" : "Nationality", value: customer.nationality, icon: Globe },
                    { label: isArabic ? "البلد" : "Country", value: customer.country, icon: MapPin },
                    { label: isArabic ? "المدينة" : "City", value: customer.city, icon: MapPin },
                    { label: isArabic ? "جواز السفر" : "Passport", value: customer.passport_number, icon: Shield, mono: true },
                    { label: isArabic ? "تاريخ الميلاد" : "Date of Birth", value: customer.date_of_birth ? format(new Date(customer.date_of_birth), "MMM d, yyyy") : null, icon: Calendar },
                  ].filter(f => f.value).map((field, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                      <field.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</p>
                        <p className={cn("text-sm font-medium text-foreground truncate", field.mono && "font-mono")}>{field.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate(`/dashboard/customers/${customer.id}`)}>
                  <Eye className="w-3.5 h-3.5" /> {isArabic ? "عرض ملف العميل الكامل" : "View Full Customer Profile"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <UserCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{isArabic ? "لم يتم ربط عميل بهذا الحجز" : "No customer linked"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: Travelers ─── */}
      {activeTab === "travelers" && (
        <PremiumTravelersTab
          travelers={travelers}
          isArabic={isArabic}
          onAdd={(prefill?: any) => {
            setEditingTraveler(prefill || { _isNew: true, full_name: "", is_adult: true });
            setShowTravelerDialog(true);
          }}
          onEdit={(t: any) => { setEditingTraveler(t); setShowTravelerDialog(true); }}
          onDelete={(tId: string) => deleteTraveler.mutate(tId)}
          adultsCount={booking.adults}
          childrenCount={booking.children}
          customer={customer}
          onAddCustomerAsTraveler={() => {
            if (customer) {
              saveTraveler.mutate({
                _isNew: true,
                full_name: customer.full_name,
                email: customer.email || "",
                phone: customer.phone || "",
                nationality: customer.nationality || "",
                passport_number: customer.passport_number || "",
                date_of_birth: customer.date_of_birth || "",
                is_lead_traveler: true,
                is_adult: true,
              });
            }
          }}
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{services.length} {isArabic ? "خدمة" : "Services"}</h3>
              <p className="text-xs text-muted-foreground">{isArabic ? "الفعلي" : "Active total"}: <span className="font-mono font-semibold text-foreground">{servicesActiveCost.toLocaleString()} {booking.currency}</span></p>
            </div>
            <Button size="sm" className="gold-gradient text-accent-foreground text-xs gap-1.5" onClick={() => {
              setEditingService({ _isNew: true, service_type: "hotel", title: "", quantity: booking.adults || 1, child_quantity: booking.children || 0, unit_price: 0, child_unit_price: 0, status: "pending" });
              setShowServiceDialog(true);
            }}>
              <Plus className="w-3.5 h-3.5" /> {isArabic ? "إضافة خدمة" : "Add Service"}
            </Button>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-16">
              <Hotel className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد خدمات" : "No services added"}</p>
            </div>
          ) : (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <Table className="modern-table">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>{isArabic ? "الخدمة" : "Service"}</TableHead>
                    <TableHead>{isArabic ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                    <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "العدد" : "Qty"}</TableHead>
                    <TableHead className="text-end">{isArabic ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service: any) => {
                    const typeConfig = SERVICE_TYPES.find(st => st.value === service.service_type);
                    const Icon = typeConfig?.icon || FileText;
                    const serviceStatusColors: Record<string, string> = {
                      confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                      cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
                    };
                    return (
                      <TableRow key={service.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-accent" />
                            </div>
                            <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{service.title}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] capitalize">{service.service_type}</Badge></TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{service.supplier_name || "—"}</span></TableCell>
                        <TableCell><span className="text-xs">{service.service_date ? format(new Date(service.service_date), "MMM d") : "—"}</span></TableCell>
                        <TableCell className="text-center"><span className="text-xs font-medium">{service.quantity}</span></TableCell>
                        <TableCell className="text-end">
                          <span className="text-sm font-mono font-semibold">{Number(service.total_cost || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground ms-1">{service.currency}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[9px] border-0", serviceStatusColors[service.status] || serviceStatusColors.pending)}>
                            {service.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingService({ ...service, pricing_mode: service.metadata?.pricing_mode || "detailed", child_quantity: service.metadata?.child_quantity || 0, child_unit_price: service.metadata?.child_unit_price || 0, children_free: service.metadata?.children_free || false }); setShowServiceDialog(true); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteService.mutate(service.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Services total footer */}
              <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isArabic ? "الإجمالي الفعلي" : "Active Total"}</span>
                <span className="text-base font-bold font-mono text-foreground">{servicesActiveCost.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{booking.currency}</span></span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── TAB: Financials ─── */}
      {activeTab === "financials" && (
        <div className="space-y-6">
          {/* Financial summary bar */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { label: isArabic ? "التكلفة" : "Total Cost", value: booking.total_cost || 0, editable: true, key: "total_cost", icon: DollarSign },
                  { label: isArabic ? "سعر البيع" : "Selling Price", value: booking.selling_price || 0, editable: true, key: "selling_price", icon: CreditCard },
                  { label: isArabic ? "الربح" : "Profit", value: (booking.selling_price || 0) - (booking.total_cost || 0), icon: Activity, isProfit: true },
                  { label: isArabic ? "الرصيد" : "Balance", value: balance, icon: Clock, isBalance: true },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</Label>
                    </div>
                    {item.editable ? (
                      <Input
                        type="number"
                        className="h-9 text-sm font-mono font-bold border-border/60"
                        defaultValue={item.value}
                        key={`fin-${item.key}-${item.value}`}
                        onBlur={e => updateBooking.mutate({ [item.key!]: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <p className={cn("text-lg font-mono font-bold tabular-nums",
                        item.isProfit ? (item.value >= 0 ? "text-emerald-600" : "text-destructive") :
                        item.isBalance ? (balance > 0 ? "text-amber-600" : "text-emerald-600") :
                        "text-foreground"
                      )}>
                        {item.isBalance && balance <= 0 ? (isArabic ? "مدفوع" : "Paid") : item.value.toLocaleString()}
                        {(item.isBalance ? balance > 0 : true) && <span className="text-xs text-muted-foreground font-normal ms-1">{booking.currency}</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment progress */}
              {booking.selling_price > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{isArabic ? "التحصيل" : "Collection Progress"}</span>
                    <span className="font-mono font-semibold text-foreground">{Math.round(paidPercent)}%</span>
                  </div>
                  <Progress value={paidPercent} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{isArabic ? "مدفوع" : "Paid"}: <span className="font-mono font-semibold text-emerald-600">{Number(booking.amount_paid || 0).toLocaleString()}</span></span>
                    <span>{isArabic ? "متبقي" : "Remaining"}: <span className="font-mono font-semibold text-amber-600">{balance > 0 ? balance.toLocaleString() : "0"}</span></span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outstanding balance warning */}
          {balance > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">
                {isArabic ? `يوجد رصيد مستحق بقيمة ${balance.toLocaleString()} ${booking.currency}` : `Outstanding balance of ${balance.toLocaleString()} ${booking.currency} remaining`}
              </p>
            </div>
          )}

          {/* Payment Records */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" />
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

      {/* ─── TAB: Client Feedback ─── */}
      {activeTab === "feedback" && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isArabic ? "ملاحظات العميل" : "Client Feedback"}
              {feedbackList.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{feedbackList.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {feedbackList.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد ملاحظات من العميل بعد" : "No client feedback yet"}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{isArabic ? "سيظهر هنا عندما يتفاعل العميل مع الرابط المشترك" : "Feedback will appear here when clients interact with the shared link"}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {feedbackList.map((fb: any) => {
                  const isApproval = fb.feedback_type === "approval";
                  const isChange = fb.feedback_type === "change_request";
                  return (
                    <motion.div
                      key={fb.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors",
                        isChange && "bg-amber-50/50 dark:bg-amber-950/10"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        isApproval && "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
                        isChange && "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
                        !isApproval && !isChange && "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                      )}>
                        {isApproval ? <CheckCircle2 className="w-4 h-4" /> : isChange ? <ArrowRightLeft className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{fb.client_name}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 h-5",
                              isApproval && "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
                              isChange && "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
                              !isApproval && !isChange && "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
                            )}
                          >
                            {isApproval ? (isArabic ? "موافقة" : "Approved") : isChange ? (isArabic ? "طلب تعديل" : "Change Request") : (isArabic ? "تعليق" : "Comment")}
                          </Badge>
                          {fb.status === "pending" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400 animate-pulse">
                              {isArabic ? "جديد" : "NEW"}
                            </Badge>
                          )}
                        </div>
                        {fb.message && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">{fb.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70">
                          {fb.client_email && (
                            <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {fb.client_email}</span>
                          )}
                          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {format(new Date(fb.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                        </div>
                        {isChange && fb.status === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={async () => {
                                await supabase.from("booking_feedback").update({ status: "reviewed" } as any).eq("id", fb.id);
                                refetchFeedback();
                                toast({ title: isArabic ? "تم التأشير كمراجع" : "Marked as reviewed" });
                              }}
                            >
                              <Check className="w-3 h-3" /> {isArabic ? "تمت المراجعة" : "Mark Reviewed"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: Attachments ─── */}
      {activeTab === "attachments" && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5" />
              {isArabic ? "المرفقات" : "Attachments"}
            </CardTitle>
          </CardHeader>
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
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              {isArabic ? "التعليقات" : "Comments"}
            </CardTitle>
          </CardHeader>
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

      {/* ─── Share Link Settings Modal ─── */}
      <ShareLinkSettingsModal
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        bookingId={id!}
        companyId={booking?.company_id || ""}
        userId={user?.id}
        shareTokens={shareTokens as any}
        onRefetch={() => refetchShareTokens()}
        isArabic={isArabic}
        bookingData={booking ? {
          title: booking.title,
          description: booking.description ?? undefined,
          days: itineraryDays.map((day: any) => ({
            title: day.title ?? undefined,
            description: day.description ?? undefined,
            short_description: day.short_description ?? undefined,
            city: day.city ?? undefined,
            pickup_location: day.pickup_location ?? undefined,
            dropoff_location: day.dropoff_location ?? undefined,
            items: (day.booking_day_items || []).map((item: any) => ({
              custom_title: item.custom_title ?? undefined,
              custom_description: item.custom_description ?? undefined,
            })),
          })),
        } : undefined}
      />

      {/* ─── Generate Quotation Modal ─── */}
      <GenerateQuotationModal
        open={showQuotationModal}
        onOpenChange={setShowQuotationModal}
        bookingId={id}
        customerId={booking?.customer_id || undefined}
        leadId={booking?.lead_id || undefined}
      />
    </div>
  );
}

// ─── Sub-Components ───

function TravelersTab({ travelers, isArabic, onAdd, onEdit, onDelete, adultsCount, childrenCount }: any) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{travelers.length} {isArabic ? "مسافر مسجل" : "registered"}</h3>
          <p className="text-xs text-muted-foreground">{adultsCount}A {childrenCount > 0 ? `${childrenCount}C` : ""}</p>
        </div>
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
              <Card key={t.id} className="border-border/60 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : t.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                      {t.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{t.full_name}</p>
                        {t.is_lead_traveler && <Badge className="text-[9px] bg-accent/10 text-accent border-0">{isArabic ? "رئيسي" : "Lead"}</Badge>}
                        {!t.is_adult && <Badge variant="secondary" className="text-[9px]">{isArabic ? "طفل" : "Child"}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {t.nationality && <span><Globe className="w-2.5 h-2.5 inline me-0.5" />{t.nationality}</span>}
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
                        className="border-t border-border bg-muted/20 px-4 py-3 overflow-hidden"
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
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</Label>
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.full_name?.trim()) errs.full_name = isArabic ? "الاسم مطلوب" : "Full name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = isArabic ? "بريد غير صحيح" : "Invalid email";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      console.log("Traveler Validation Errors:", errs);
      // Scroll to first error
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(`traveler-field-${firstKey}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{form._isNew ? "Add Traveler" : "Edit Traveler"}</DialogTitle>
        <div className="relative px-6 pt-5 pb-4 navy-gradient">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--gold)/0.3),transparent_60%)]" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <User className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">{form._isNew ? (isArabic ? "إضافة مسافر" : "Add Traveler") : (isArabic ? "تعديل المسافر" : "Edit Traveler")}</h2>
              <p className="text-[11px] text-white/60">{isArabic ? "معلومات جواز السفر والتفاصيل الشخصية" : "Passport info and personal details"}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2" id="traveler-field-full_name">
              <Label className="text-xs">{isArabic ? "الاسم الكامل" : "Full Name"} <span className="text-destructive">*</span></Label>
              <Input
                value={form.full_name || ""}
                onChange={e => { setForm({ ...form, full_name: e.target.value }); if (errors.full_name) setErrors(prev => ({ ...prev, full_name: "" })); }}
                className={cn("mt-1 h-11", errors.full_name && "border-destructive ring-1 ring-destructive")}
                autoFocus
              />
              {errors.full_name && <p className="text-[10px] text-destructive mt-0.5">{errors.full_name}</p>}
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الجنس" : "Gender"}</Label>
              <Select value={form.gender || ""} onValueChange={v => setForm({ ...form, gender: v })}>
                <SelectTrigger className="mt-1 h-11"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "تاريخ الميلاد" : "Date of Birth"}</Label>
              <Input type="date" value={form.date_of_birth || ""} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الجنسية" : "Nationality"}</Label>
              <div className="mt-1">
                <NationalitySelect value={form.nationality || ""} onValueChange={v => setForm({ ...form, nationality: v })} isRtl={isArabic} />
              </div>
            </div>
            <div id="traveler-field-email">
              <Label className="text-xs">{isArabic ? "البريد" : "Email"}</Label>
              <Input
                type="email"
                value={form.email || ""}
                onChange={e => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors(prev => ({ ...prev, email: "" })); }}
                className={cn("mt-1 h-11", errors.email && "border-destructive ring-1 ring-destructive")}
              />
              {errors.email && <p className="text-[10px] text-destructive mt-0.5">{errors.email}</p>}
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? "الهاتف" : "Phone"}</Label>
              <div className="mt-1">
                <PhoneInput value={form.phone || ""} onValueChange={v => setForm({ ...form, phone: v })} defaultCountry="AE" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
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
              <div className="mt-1">
                <CountrySelect value={form.passport_country || ""} onValueChange={v => setForm({ ...form, passport_country: v })} isRtl={isArabic} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "is_lead_traveler", label: isArabic ? "مسافر رئيسي" : "Lead Traveler" },
              { key: "is_adult", label: isArabic ? "بالغ" : "Adult", defaultTrue: true },
            ].map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setForm({ ...form, [opt.key]: !form[opt.key] })}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-medium rounded-full border px-3 py-1.5 transition-all",
                  form[opt.key] ? "bg-accent/10 border-accent text-accent" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <CheckCircle2 className={cn("w-3 h-3", form[opt.key] ? "text-accent" : "text-muted-foreground/40")} />
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs">{isArabic ? "متطلبات خاصة" : "Special Requirements"}</Label>
            <Textarea value={form.special_requirements || ""} onChange={e => setForm({ ...form, special_requirements: e.target.value })} rows={2} className="mt-1 text-sm resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="text-xs">{isArabic ? "إلغاء" : "Cancel"}</Button>
          <Button
            size="sm"
            disabled={!form.full_name?.trim() || isSaving}
            onClick={handleSave}
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
  const [form, setForm] = useState({
    ...service,
    quantity: service.quantity ?? bookingAdults,
    child_quantity: service.child_quantity ?? bookingChildren,
    pricing_mode: service.pricing_mode || "detailed",
  });
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhanceTitle = async () => {
    if (!form.title?.trim()) return;
    setIsEnhancing(true);
    try {
      const res = await supabase.functions.invoke("enhance-service-title", {
        body: { title: form.title, service_type: form.service_type },
      });
      if (res.data?.enhanced_title) setForm({ ...form, title: res.data.enhanced_title });
    } catch { /* ignore */ }
    setIsEnhancing(false);
  };

  const typeConfig: Record<string, any> = {
    hotel: {
      icon: Hotel, headerLabel: "Hotel Accommodation", headerLabelAr: "إقامة فندقية",
      subtitle: "Room bookings, hotels, resorts", subtitleAr: "حجوزات الغرف والفنادق والمنتجعات",
      titlePlaceholder: "e.g., Hilton Cairo Zamalek – Deluxe Room", titlePlaceholderAr: "مثال: هيلتون القاهرة الزمالك – غرفة ديلوكس",
      locationLabel: "Hotel Address", locationLabelAr: "عنوان الفندق",
      locationPlaceholder: "e.g., 21 Zamalek Street, Cairo", locationPlaceholderAr: "مثال: 21 شارع الزمالك، القاهرة",
      notesPlaceholder: "Room type, view, meal plan, check-in/out times...", notesPlaceholderAr: "نوع الغرفة، الإطلالة، خطة الوجبات، أوقات الدخول/الخروج...",
      showCheckInOut: true,
      supplierLabel: "Hotel / Booking Platform", supplierLabelAr: "الفندق / منصة الحجز",
    },
    transfer: {
      icon: Car, headerLabel: "Transfer / Transportation", headerLabelAr: "نقل / مواصلات",
      subtitle: "Airport transfers, city transport, coaches", subtitleAr: "نقل المطار، النقل في المدينة",
      titlePlaceholder: "e.g., Airport Transfer – Cairo Intl → Hotel", titlePlaceholderAr: "مثال: نقل المطار – القاهرة الدولي → الفندق",
      locationLabel: "Route", locationLabelAr: "المسار",
      locationPlaceholder: "e.g., Cairo Airport T2 → Downtown Hotel", locationPlaceholderAr: "مثال: مطار القاهرة T2 → فندق وسط البلد",
      notesPlaceholder: "Vehicle type, driver contact, meeting point...", notesPlaceholderAr: "نوع المركبة، رقم السائق، نقطة الالتقاء...",
      showPickupDropoff: true, showStartEndTime: true,
      supplierLabel: "Transport Provider", supplierLabelAr: "مزود النقل",
    },
    tour: {
      icon: MapPin, headerLabel: "Tour / Excursion", headerLabelAr: "جولة سياحية",
      subtitle: "Guided tours, day trips, sightseeing", subtitleAr: "جولات مصحوبة بمرشدين، رحلات يومية",
      titlePlaceholder: "e.g., Pyramids of Giza Full Day Tour", titlePlaceholderAr: "مثال: جولة أهرامات الجيزة ليوم كامل",
      locationLabel: "Meeting Point", locationLabelAr: "نقطة الالتقاء",
      locationPlaceholder: "e.g., Hotel lobby at 8:00 AM", locationPlaceholderAr: "مثال: لوبي الفندق الساعة 8:00 صباحاً",
      notesPlaceholder: "Inclusions, exclusions, guide language, lunch included...", notesPlaceholderAr: "المشمول، غير المشمول، لغة المرشد...",
      showStartEndTime: true, showDuration: true,
      supplierLabel: "Tour Operator", supplierLabelAr: "منظم الجولات",
    },
    guide: {
      icon: User, headerLabel: "Tour Guide", headerLabelAr: "مرشد سياحي",
      subtitle: "Private guide, translator", subtitleAr: "مرشد خاص، مترجم",
      titlePlaceholder: "e.g., Licensed Egyptologist Guide", titlePlaceholderAr: "مثال: مرشد مصري مرخص",
      locationLabel: "Meeting Point", locationLabelAr: "نقطة الالتقاء",
      locationPlaceholder: "e.g., Hotel lobby", locationPlaceholderAr: "مثال: لوبي الفندق",
      notesPlaceholder: "Languages spoken, expertise, contact details...", notesPlaceholderAr: "اللغات، التخصص، بيانات التواصل...",
      showStartEndTime: true, showDuration: true,
      supplierLabel: "Guide / Agency", supplierLabelAr: "المرشد / الوكالة",
    },
    activity: { icon: Activity, headerLabel: "Activity / Experience", headerLabelAr: "نشاط / تجربة", subtitle: "Special activities", subtitleAr: "أنشطة خاصة", titlePlaceholder: "e.g., Felucca Ride", titlePlaceholderAr: "مثال: ركوب الفلوكة", locationLabel: "Venue", locationLabelAr: "المكان", locationPlaceholder: "Location", locationPlaceholderAr: "الموقع", notesPlaceholder: "Details...", notesPlaceholderAr: "تفاصيل...", showStartEndTime: true, showDuration: true, supplierLabel: "Provider", supplierLabelAr: "مزود الخدمة" },
    flight: { icon: Plane, headerLabel: "Flight Ticket", headerLabelAr: "تذكرة طيران", subtitle: "Flight bookings", subtitleAr: "حجوزات الطيران", titlePlaceholder: "e.g., Cairo → Istanbul", titlePlaceholderAr: "مثال: القاهرة → اسطنبول", locationLabel: "Route", locationLabelAr: "المسار", locationPlaceholder: "e.g., CAI → IST", locationPlaceholderAr: "مثال: القاهرة → اسطنبول", notesPlaceholder: "Airline, flight number...", notesPlaceholderAr: "شركة الطيران...", showStartEndTime: true, supplierLabel: "Airline", supplierLabelAr: "شركة الطيران" },
    visa: { icon: Stamp, headerLabel: "Visa Fees", headerLabelAr: "رسوم التأشيرة", subtitle: "Visa processing", subtitleAr: "معالجة التأشيرات", titlePlaceholder: "e.g., Turkey Tourist Visa", titlePlaceholderAr: "مثال: تأشيرة تركيا", locationLabel: "Embassy", locationLabelAr: "السفارة", locationPlaceholder: "Embassy location", locationPlaceholderAr: "موقع السفارة", notesPlaceholder: "Visa type, documents...", notesPlaceholderAr: "نوع التأشيرة...", supplierLabel: "Visa Agent", supplierLabelAr: "وكيل التأشيرات" },
    entrance: { icon: Ticket, headerLabel: "Entrance Ticket", headerLabelAr: "تذكرة دخول", subtitle: "Museum & attraction tickets", subtitleAr: "تذاكر المتاحف", titlePlaceholder: "e.g., Egyptian Museum", titlePlaceholderAr: "مثال: المتحف المصري", locationLabel: "Venue", locationLabelAr: "المكان", locationPlaceholder: "Venue location", locationPlaceholderAr: "موقع المكان", notesPlaceholder: "Ticket details...", notesPlaceholderAr: "تفاصيل التذكرة...", showStartEndTime: true, supplierLabel: "Provider", supplierLabelAr: "مزود التذاكر" },
    meal: { icon: FileText, headerLabel: "Meal", headerLabelAr: "وجبة", subtitle: "Restaurant reservations", subtitleAr: "حجوزات المطاعم", titlePlaceholder: "e.g., Dinner Cruise", titlePlaceholderAr: "مثال: عشاء نيلي", locationLabel: "Restaurant", locationLabelAr: "المطعم", locationPlaceholder: "Restaurant name & address", locationPlaceholderAr: "اسم وعنوان المطعم", notesPlaceholder: "Menu, dietary needs...", notesPlaceholderAr: "القائمة، احتياجات غذائية...", supplierLabel: "Restaurant", supplierLabelAr: "المطعم" },
    other: { icon: FileText, headerLabel: "Other Service", headerLabelAr: "خدمة أخرى", subtitle: "Insurance, misc", subtitleAr: "تأمين، خدمات متنوعة", titlePlaceholder: "e.g., Travel Insurance", titlePlaceholderAr: "مثال: تأمين السفر", locationLabel: "Location", locationLabelAr: "الموقع", locationPlaceholder: "Location", locationPlaceholderAr: "الموقع", notesPlaceholder: "Details...", notesPlaceholderAr: "تفاصيل...", supplierLabel: "Supplier", supplierLabelAr: "المورد" },
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
                {form._isNew ? (isArabic ? cfg.headerLabelAr : cfg.headerLabel) : (isArabic ? "تعديل الخدمة" : "Edit Service")}
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
                      isActive ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? "العنوان" : "Title"} <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-11 flex-1" placeholder={isArabic ? cfg.titlePlaceholderAr : cfg.titlePlaceholder} />
                <Button type="button" size="sm" variant="outline" disabled={!form.title?.trim() || isEnhancing} onClick={enhanceTitle} className="h-11 px-3 gap-1.5 text-xs shrink-0 border-accent/30 text-accent hover:bg-accent/10">
                  {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-sm">✨</span>}
                  {isArabic ? "تحسين" : "AI"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الحالة" : "Status"}</Label>
              <Select value={form.status || "pending"} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{["pending","confirmed","cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={form.service_date || ""} onChange={e => setForm({ ...form, service_date: e.target.value })} className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? (cfg.supplierLabelAr || "المورد") : (cfg.supplierLabel || "Supplier")}</Label>
              <Input value={form.supplier_name || ""} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "رقم التأكيد" : "Confirmation #"}</Label>
              <Input value={form.confirmation_number || ""} onChange={e => setForm({ ...form, confirmation_number: e.target.value })} className="mt-1 h-11 font-mono" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{isArabic ? cfg.locationLabelAr : cfg.locationLabel}</Label>
              <Input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1 h-11" placeholder={isArabic ? cfg.locationPlaceholderAr : cfg.locationPlaceholder} />
            </div>
          </div>

          {cfg.showPickupDropoff && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "الالتقاط" : "Pickup"}</Label>
                <Input value={form.pickup_location || ""} onChange={e => setForm({ ...form, pickup_location: e.target.value })} className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "الإنزال" : "Dropoff"}</Label>
                <Input value={form.dropoff_location || ""} onChange={e => setForm({ ...form, dropoff_location: e.target.value })} className="mt-1 h-11" />
              </div>
            </div>
          )}

          {cfg.showStartEndTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isArabic ? "البداية" : "Start"}</Label>
                <Input type="time" value={form.start_time || ""} onChange={e => setForm({ ...form, start_time: e.target.value })} className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "النهاية" : "End"}</Label>
                <Input type="time" value={form.end_time || ""} onChange={e => setForm({ ...form, end_time: e.target.value })} className="mt-1 h-11" />
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {isArabic ? "التسعير" : "Pricing"}
              </p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button type="button" onClick={() => setForm({ ...form, pricing_mode: "flat" })} className={cn("px-3 py-1 text-[10px] font-semibold transition-all", (form.pricing_mode || "detailed") === "flat" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {isArabic ? "إجمالي" : "Flat"}
                </button>
                <button type="button" onClick={() => setForm({ ...form, pricing_mode: "detailed" })} className={cn("px-3 py-1 text-[10px] font-semibold transition-all", (form.pricing_mode || "detailed") === "detailed" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {isArabic ? "تفصيلي" : "Detailed"}
                </button>
              </div>
            </div>

            {(form.pricing_mode || "detailed") === "flat" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{isArabic ? "المبلغ" : "Amount"}</Label>
                  <Input type="number" min={0} value={form.unit_price || 0} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0, quantity: 1 })} className="mt-0.5 h-11 font-mono font-bold" />
                </div>
                <div className="flex items-end">
                  <div className="h-11 w-full rounded-md border border-border bg-background flex items-center justify-center text-sm font-bold font-mono text-foreground">
                    {(form.unit_price || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] w-16 justify-center shrink-0">{isArabic ? "بالغين" : "Adults"}</Badge>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{isArabic ? "عدد" : "Qty"}</Label>
                      <Input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} className="mt-0.5 h-9 text-center font-bold" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{isArabic ? "سعر" : "Price"}</Label>
                      <Input type="number" min={0} value={form.unit_price} onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} className="mt-0.5 h-9 font-mono" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{isArabic ? "الإجمالي" : "Sub"}</Label>
                      <div className="mt-0.5 h-9 rounded-md border border-border bg-background flex items-center justify-center text-xs font-bold font-mono">
                        {((form.quantity || 0) * (form.unit_price || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] w-16 justify-center shrink-0">{isArabic ? "أطفال" : "Children"}</Badge>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input type="number" min={0} value={form.child_quantity || 0} onChange={e => setForm({ ...form, child_quantity: parseInt(e.target.value) || 0 })} className="h-9 text-center font-bold" disabled={form.children_free} />
                    <Input type="number" min={0} value={form.children_free ? 0 : (form.child_unit_price || 0)} onChange={e => setForm({ ...form, child_unit_price: parseFloat(e.target.value) || 0 })} className="h-9 font-mono" disabled={form.children_free} />
                    <div className="h-9 rounded-md border border-border bg-background flex items-center justify-center text-xs font-bold font-mono">
                      {form.children_free ? "0" : ((form.child_quantity || 0) * (form.child_unit_price || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ms-[4.5rem]">
                  <button type="button" onClick={() => setForm({ ...form, children_free: !form.children_free, child_unit_price: !form.children_free ? 0 : form.child_unit_price })} className={cn("flex items-center gap-1.5 text-[10px] font-medium rounded-full border px-2.5 py-1 transition-all", form.children_free ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:bg-muted")}>
                    <CheckCircle2 className={cn("w-3 h-3", form.children_free ? "text-emerald-600" : "text-muted-foreground/40")} />
                    {isArabic ? "أطفال مجاناً" : "Children FREE"}
                  </button>
                </div>
              </>
            )}

            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{isArabic ? "الإجمالي" : "Grand Total"}</span>
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
  const [filterType, setFilterType] = useState("all");

  const typeIcons: Record<string, { icon: any; color: string; label: string }> = {
    status_change: { icon: CheckCircle2, color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400", label: "Status" },
    comment: { icon: MessageSquare, color: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400", label: "Comment" },
    created: { icon: Plus, color: "bg-accent/20 text-accent", label: "Created" },
    note: { icon: StickyNote, color: "bg-muted text-muted-foreground", label: "Note" },
  };

  const filtered = filterType === "all" ? activities : activities.filter((a: any) => a.activity_type === filterType);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((act: any) => {
      const date = format(new Date(act.created_at), "yyyy-MM-dd");
      if (!groups[date]) groups[date] = [];
      groups[date].push(act);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Add comment */}
      <Card className="border-border/60 shadow-sm">
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
              className="h-auto self-end gold-gradient text-accent-foreground"
              disabled={!commentText.trim() || isAddingComment}
              onClick={() => { onAddComment(commentText); setCommentText(""); }}
            >
              {isAddingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {[{ key: "all", label: isArabic ? "الكل" : "All" }, ...Object.entries(typeIcons).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={cn(
              "px-3 py-1 text-[10px] font-medium rounded-full border transition-all",
              filterType === f.key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{isArabic ? "لا يوجد نشاط بعد" : "No activity yet"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, acts]) => (
            <div key={date}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {format(new Date(date), "EEEE, MMM d, yyyy")}
              </p>
              <div className="relative ms-3">
                <div className="absolute start-3 top-2 bottom-2 w-px bg-border" />
                <div className="space-y-3">
                  {(acts as any[]).map((act: any, idx: number) => {
                    const cfgItem = typeIcons[act.activity_type] || typeIcons.note;
                    const Icon = cfgItem.icon;
                    return (
                      <motion.div
                        key={act.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="relative ps-8"
                      >
                        <div className={cn("absolute start-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 border-card", cfgItem.color)}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">{act.title}</p>
                          {act.description && <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">{act.description}</p>}
                          <p className="text-[10px] text-muted-foreground">
                            {getProfileName(act.user_id)} · {format(new Date(act.created_at), "HH:mm")}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
