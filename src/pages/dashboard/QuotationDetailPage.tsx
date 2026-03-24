import { useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, FileText, Calendar, DollarSign,
  Printer, Send, CheckCircle2, XCircle, Clock, Eye,
  Pencil, Save, User, MapPin, Phone, Mail,
  Building2, Globe, AlertCircle, Receipt, Download,
  ChevronDown, ChevronUp, Hotel, Car, Landmark,
  Utensils, UserCheck, Ticket, Plane, Activity,
  MessageSquare, RefreshCw, Copy, ExternalLink, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

type QuotationStatus = "draft" | "sent" | "viewed" | "negotiating" | "accepted" | "rejected" | "expired" | "cancelled";

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string; icon: typeof FileText; next?: QuotationStatus }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: FileText, next: "sent" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Send, next: "viewed" },
  viewed: { label: "Viewed", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", icon: Eye, next: "negotiating" },
  negotiating: { label: "Negotiating", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: MessageSquare },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  expired: { label: "Expired", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Clock },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", icon: XCircle },
};

const CATEGORY_ICONS: Record<string, typeof Hotel> = {
  hotel: Hotel,
  transfer: Car,
  tour: Landmark,
  attraction: Landmark,
  activity: Activity,
  meal: Utensils,
  guide: UserCheck,
  flight: Plane,
  entrance: Ticket,
  other: FileText,
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { direction, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const isArabic = language === "ar";

  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [localPaymentTerms, setLocalPaymentTerms] = useState<string | null>(null);
  const [localClientNotes, setLocalClientNotes] = useState<string | null>(null);
  const [localInternalNotes, setLocalInternalNotes] = useState<string | null>(null);
  const [localTerms, setLocalTerms] = useState<string | null>(null);

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("*, customers(full_name, email, phone, nationality, country, city), trips(trip_number, title, total_days, start_date, end_date, adults, children), leads(full_name, email, phone)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ["company-detail", quotation?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, email, phone, logo_url, address")
        .eq("id", quotation.company_id)
        .single();
      return data;
    },
    enabled: !!quotation?.company_id,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-qtn", quotation?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("logo_url, tagline, website")
        .eq("company_id", quotation.company_id)
        .single();
      return data;
    },
    enabled: !!quotation?.company_id,
  });

  // Fetch related booking - try booking_id first, then trip_id
  const { data: relatedBooking } = useQuery({
    queryKey: ["quotation-booking", quotation?.booking_id, quotation?.trip_id],
    queryFn: async () => {
      // Direct booking_id link
      if (quotation!.booking_id) {
        const { data } = await supabase
          .from("bookings")
          .select("id, booking_number, title")
          .eq("id", quotation!.booking_id)
          .is("deleted_at", null)
          .maybeSingle();
        if (data) return data;
      }
      // Fallback: match by trip_id
      if (quotation!.trip_id) {
        const { data } = await supabase
          .from("bookings")
          .select("id, booking_number, title")
          .eq("trip_id", quotation!.trip_id)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!quotation && !!(quotation.booking_id || quotation.trip_id),
  });

  const updateQuotation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("quotations").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      toast({ title: isArabic ? "تم التحديث" : "Quotation updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const [exporting, setExporting] = useState(false);
  const handleExportPDF = useCallback(async () => {
    const el = printRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let position = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      if (pdfH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      } else {
        while (position < pdfH) {
          pdf.addImage(imgData, "PNG", 0, -position, pdfW, pdfH);
          position += pageH;
          if (position < pdfH) pdf.addPage();
        }
      }
      pdf.save(`${quotation?.quotation_number || "quotation"}.pdf`);
      toast({ title: isArabic ? "تم التصدير" : "PDF exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [quotation, isArabic, toast]);

  const saveTextField = useCallback((field: string, value: string | null) => {
    if (value !== null && value !== (quotation?.[field] || "")) {
      updateQuotation.mutate({ [field]: value });
    }
  }, [quotation, updateQuotation]);

  const tripSnapshot = quotation?.trip_snapshot as any;
  const days = tripSnapshot?.days || [];
  const services = tripSnapshot?.services || [];

  // Calculate price breakdown by category
  const priceBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; total: number }> = {};
    
    // From services
    services.forEach((s: any) => {
      const cat = s.service_type || "other";
      if (!breakdown[cat]) breakdown[cat] = { count: 0, total: 0 };
      breakdown[cat].count += 1;
      breakdown[cat].total += Number(s.total_cost || 0);
    });
    
    // From day items
    days.forEach((day: any) => {
      (day.items || []).forEach((item: any) => {
        const cat = item.category || "other";
        if (!breakdown[cat]) breakdown[cat] = { count: 0, total: 0 };
        breakdown[cat].count += item.quantity || 1;
        breakdown[cat].total += Number(item.total_price || 0);
      });
    });
    
    return breakdown;
  }, [days, services]);

  const customerInfo = quotation?.customers || quotation?.leads;
  const customerName = customerInfo?.full_name || "—";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
          <Receipt className="w-7 h-7 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-foreground">{isArabic ? "عرض السعر غير موجود" : "Quotation not found"}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/quotations")} className="gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5 rtl:scale-x-[-1]" /> {isArabic ? "العودة" : "Back to Quotations"}
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[quotation.status as QuotationStatus] || STATUS_CONFIG.draft;
  const isExpired = quotation.valid_until && new Date(quotation.valid_until) < new Date() && !["accepted", "rejected", "cancelled"].includes(quotation.status);

  return (
    <div className="space-y-6">
      {/* Header - hidden in print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/quotations")} className="shrink-0">
            <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display text-foreground flex items-center gap-2 flex-wrap">
              {quotation.quotation_number}
              <Badge className={cn("text-[10px] border-0", sc.className)}>{sc.label}</Badge>
              {isExpired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
            </h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(quotation.created_at), "MMM d, yyyy")}
              {customerName !== "—" && ` · ${customerName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {sc.next && quotation.status !== "accepted" && quotation.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => {
                const updates: any = { status: sc.next };
                if (sc.next === "sent") updates.sent_at = new Date().toISOString();
                updateQuotation.mutate(updates);
              }}
              disabled={updateQuotation.isPending}
            >
              {sc.next === "sent" && <Send className="w-3.5 h-3.5" />}
              {sc.next === "viewed" && <Eye className="w-3.5 h-3.5" />}
              {sc.next === "negotiating" && <MessageSquare className="w-3.5 h-3.5" />}
              Mark as {STATUS_CONFIG[sc.next]?.label}
            </Button>
          )}
          {quotation.status === "sent" || quotation.status === "viewed" || quotation.status === "negotiating" ? (
            <>
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => updateQuotation.mutate({ status: "accepted", accepted_at: new Date().toISOString() })}
                disabled={updateQuotation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                onClick={() => updateQuotation.mutate({ status: "rejected" })}
                disabled={updateQuotation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          ) : null}
          {relatedBooking && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => navigate(`/dashboard/bookings/${relatedBooking.id}`)}
            >
              <Briefcase className="w-3.5 h-3.5" /> {relatedBooking.booking_number}
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Export PDF
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Select
            value={quotation.status}
            onValueChange={v => updateQuotation.mutate({ status: v })}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Printable Quotation Document */}
      <motion.div
        ref={printRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl overflow-hidden print:border-0 print:rounded-none print:shadow-none"
      >
        {/* Document Header */}
        <div className="bg-gradient-to-br from-primary to-primary/90 p-6 sm:p-8 text-primary-foreground relative overflow-hidden print:bg-primary">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-accent/10 -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-accent/5 translate-y-1/2" />
          
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative z-10">
            <div>
              {(companySettings?.logo_url || company?.logo_url) && (
                <img
                  src={companySettings?.logo_url || company?.logo_url || ""}
                  alt={company?.name || "Company Logo"}
                  className="h-12 mb-3 object-contain brightness-0 invert"
                  loading="lazy"
                />
              )}
              <h2 className="text-xl font-bold">{company?.name || "Company"}</h2>
              {companySettings?.tagline && (
                <p className="text-xs text-primary-foreground/70 mt-0.5">{companySettings.tagline}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-primary-foreground/70">
                {company?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{company.email}</span>}
                {company?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{company.phone}</span>}
                {companySettings?.website && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{companySettings.website}</span>}
              </div>
            </div>
            <div className="text-start sm:text-end">
              <div className="inline-block px-4 py-2 bg-accent/20 rounded-lg backdrop-blur-sm">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">QUOTATION</h1>
                <p className="text-sm font-mono font-semibold mt-1">{quotation.quotation_number}</p>
              </div>
              <div className="mt-3 space-y-0.5 text-[11px] text-primary-foreground/70">
                <p>Date: {format(new Date(quotation.created_at), "MMMM d, yyyy")}</p>
                {quotation.valid_until && (
                  <p className={cn(isExpired && "text-red-300")}>
                    Valid Until: <span className="font-semibold text-primary-foreground">{format(new Date(quotation.valid_until), "MMMM d, yyyy")}</span>
                    {isExpired && " (Expired)"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customer + Trip Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 sm:p-8 pb-4 bg-muted/30">
          <div className="space-y-1">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3 h-3" /> {isArabic ? "معلومات العميل" : "Client Information"}
            </h3>
            {customerInfo ? (
              <div className="bg-card rounded-lg p-3 border border-border">
                <p className="text-sm font-semibold text-foreground">{customerInfo.full_name}</p>
                <div className="space-y-0.5 mt-1 text-[11px] text-muted-foreground">
                  {customerInfo.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{customerInfo.email}</p>}
                  {customerInfo.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{customerInfo.phone}</p>}
                  {customerInfo.country && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{[customerInfo.city, customerInfo.country].filter(Boolean).join(", ")}</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No customer linked</p>
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> {isArabic ? "تفاصيل الرحلة" : "Trip Details"}
            </h3>
            <div className="bg-card rounded-lg p-3 border border-border">
              <p className="text-sm font-semibold text-foreground">{tripSnapshot?.title || quotation.trips?.title || "Travel Package"}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                {quotation.trips?.trip_number && <p>Ref: {quotation.trips.trip_number}</p>}
                <p>{tripSnapshot?.totalDays || quotation.trips?.total_days || days.length} days</p>
                {(tripSnapshot?.startDate || quotation.trips?.start_date) && (
                  <p className="col-span-2">
                    {format(new Date(tripSnapshot?.startDate || quotation.trips.start_date), "MMM d")} – 
                    {(tripSnapshot?.endDate || quotation.trips?.end_date) && format(new Date(tripSnapshot?.endDate || quotation.trips.end_date), " MMM d, yyyy")}
                  </p>
                )}
                <p>{tripSnapshot?.adults || quotation.trips?.adults || 1} adults{(tripSnapshot?.children || quotation.trips?.children) > 0 ? `, ${tripSnapshot?.children || quotation.trips?.children} children` : ""}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Itinerary Days */}
        {days.length > 0 && (
          <div className="px-6 sm:px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> {isArabic ? "البرنامج اليومي" : "Itinerary"}
            </h3>
            <div className="space-y-3">
              {days.map((day: any, idx: number) => {
                const isOpen = expandedDay === idx;
                const items = day.items || [];
                const DayIcon = items.length > 0 ? (CATEGORY_ICONS[items[0]?.category] || MapPin) : MapPin;
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "border rounded-lg overflow-hidden transition-all",
                      isOpen ? "border-accent/50 bg-accent/5" : "border-border bg-card"
                    )}
                  >
                    <button
                      className="w-full flex items-center gap-3 p-3 text-start hover:bg-muted/30 transition-colors print:pointer-events-none"
                      onClick={() => setExpandedDay(isOpen ? null : idx)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-accent">{day.day_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {day.title || `Day ${day.day_number}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                          {day.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{day.city}</span>}
                          {items.length > 0 && <span>{items.length} activities</span>}
                        </p>
                      </div>
                      {items.length > 0 && (
                        <span className="print:hidden">
                          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </span>
                      )}
                    </button>
                    
                    {/* Show content when expanded OR when printing/exporting (always visible in print) */}
                    <div className={cn(
                      "px-3 pb-3 space-y-2",
                      !isOpen && "hidden print:block"
                    )}>
                      {day.description && (
                        <p className="text-xs text-muted-foreground px-1 pb-2 border-b border-border">{day.description}</p>
                      )}
                      {day.pickup_location && (
                        <p className="text-[11px] text-muted-foreground px-1">📍 Pickup: {day.pickup_location}</p>
                      )}
                      {items.map((item: any, iIdx: number) => {
                        const ItemIcon = CATEGORY_ICONS[item.category] || FileText;
                        return (
                          <div key={iIdx} className="flex items-start gap-2 p-2 bg-card rounded-md border border-border">
                            <ItemIcon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{item.custom_title || item.title}</p>
                              {item.custom_description && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.custom_description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                {item.start_time && <span>⏰ {item.start_time}</span>}
                                {item.duration_minutes && <span>{item.duration_minutes}min</span>}
                                {item.quantity > 1 && <span>×{item.quantity}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {day.dropoff_location && (
                        <p className="text-[11px] text-muted-foreground px-1 pt-1 border-t border-border">🏁 Drop-off: {day.dropoff_location}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        {Object.keys(priceBreakdown).length > 0 && (
          <div className="px-6 sm:px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> {isArabic ? "تفاصيل الأسعار" : "Price Breakdown"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(priceBreakdown).map(([cat, data]) => {
                const Icon = CATEGORY_ICONS[cat] || FileText;
                return (
                  <div key={cat} className="bg-muted/30 rounded-lg p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground capitalize">{cat}</p>
                      <p className="text-xs font-semibold text-foreground font-mono">{quotation.currency} {data.total.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing Summary */}
        <div className="px-6 sm:px-8 pb-6">
          <div className="flex justify-end">
            <div className="w-full sm:w-80 bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono text-foreground">{quotation.currency} {Number(quotation.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(quotation.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-{quotation.currency} {Number(quotation.discount_amount).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-foreground">{isArabic ? "الإجمالي" : "Total"}</span>
                <span className="font-mono text-accent">{quotation.currency} {Number(quotation.total_amount || 0).toLocaleString()}</span>
              </div>
              {Number(quotation.deposit_amount || 0) > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deposit ({quotation.deposit_percentage}%)</span>
                    <span className="font-mono font-semibold text-foreground">{quotation.currency} {Number(quotation.deposit_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance Due</span>
                    <span className="font-mono text-foreground">{quotation.currency} {(Number(quotation.total_amount || 0) - Number(quotation.deposit_amount || 0)).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        {quotation.payment_terms && (
          <div className="px-6 sm:px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isArabic ? "شروط الدفع" : "Payment Terms"}</h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3">{quotation.payment_terms}</p>
          </div>
        )}

        {/* Client Notes */}
        {quotation.client_notes && (
          <div className="px-6 sm:px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isArabic ? "ملاحظات" : "Notes"}</h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3">{quotation.client_notes}</p>
          </div>
        )}

        {/* Terms and Conditions */}
        {quotation.terms_and_conditions && (
          <div className="px-6 sm:px-8 pb-8 border-t border-border pt-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isArabic ? "الشروط والأحكام" : "Terms & Conditions"}</h3>
            <p className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{quotation.terms_and_conditions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-primary/5 px-6 sm:px-8 py-4 text-center border-t border-border">
          <p className="text-[10px] text-muted-foreground">{isArabic ? "شكراً لاهتمامك. نتطلع لخدمتك." : "Thank you for your interest. We look forward to creating an unforgettable experience for you."}</p>
          {company?.name && <p className="text-[10px] font-semibold text-muted-foreground mt-1">{company.name}</p>}
        </div>
      </motion.div>

      {/* Editable Fields - hidden in print */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{isArabic ? "الشروط والدفع" : "Terms & Payment"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">{isArabic ? "نسبة العربون %" : "Deposit %"}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="h-8 text-xs"
                  value={quotation.deposit_percentage || ""}
                  onChange={e => {
                    const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    const depositAmt = (pct / 100) * Number(quotation.total_amount || 0);
                    updateQuotation.mutate({ deposit_percentage: pct, deposit_amount: Math.round(depositAmt * 100) / 100 });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">{isArabic ? "مبلغ العربون" : "Deposit Amount"}</Label>
                <Input type="number" className="h-8 text-xs font-mono bg-muted/30" value={quotation.deposit_amount || ""} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">{isArabic ? "الصلاحية (أيام)" : "Validity (days)"}</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  className="h-8 text-xs"
                  value={quotation.validity_days || 14}
                  onChange={e => {
                    const d = Math.min(365, Math.max(1, parseInt(e.target.value) || 14));
                    const validUntil = format(addDays(new Date(quotation.created_at), d), "yyyy-MM-dd");
                    updateQuotation.mutate({ validity_days: d, valid_until: validUntil });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">{isArabic ? "صالح حتى" : "Valid Until"}</Label>
                <Input type="date" className="h-8 text-xs bg-muted/30" value={quotation.valid_until || ""} readOnly />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">{isArabic ? "شروط الدفع" : "Payment Terms"}</Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={localPaymentTerms ?? quotation.payment_terms ?? ""}
                onChange={e => setLocalPaymentTerms(e.target.value)}
                onBlur={() => saveTextField("payment_terms", localPaymentTerms)}
                placeholder="e.g., 50% deposit upon confirmation, balance due 30 days before travel..."
                maxLength={2000}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{isArabic ? "الملاحظات والشروط" : "Notes & Conditions"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px]">{isArabic ? "ملاحظات للعميل" : "Client Notes"} <span className="text-muted-foreground">({isArabic ? "تظهر في العرض" : "visible on quotation"})</span></Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={localClientNotes ?? quotation.client_notes ?? ""}
                onChange={e => setLocalClientNotes(e.target.value)}
                onBlur={() => saveTextField("client_notes", localClientNotes)}
                placeholder={isArabic ? "ملاحظات تظهر للعميل..." : "Notes visible to the client..."}
                maxLength={2000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">{isArabic ? "ملاحظات داخلية" : "Internal Notes"} <span className="text-muted-foreground">({isArabic ? "لا تظهر للعميل" : "not visible to client"})</span></Label>
              <Textarea
                className="text-xs"
                rows={2}
                value={localInternalNotes ?? quotation.notes ?? ""}
                onChange={e => setLocalInternalNotes(e.target.value)}
                onBlur={() => saveTextField("notes", localInternalNotes)}
                placeholder={isArabic ? "ملاحظات داخلية..." : "Internal notes..."}
                maxLength={1000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">{isArabic ? "الشروط والأحكام" : "Terms & Conditions"}</Label>
              <Textarea
                className="text-xs"
                rows={4}
                value={localTerms ?? quotation.terms_and_conditions ?? ""}
                onChange={e => setLocalTerms(e.target.value)}
                onBlur={() => saveTextField("terms_and_conditions", localTerms)}
                placeholder={isArabic ? "سياسة الإلغاء، ما يشمله/لا يشمله العرض..." : "Cancellation policy, inclusions/exclusions, liability terms..."}
                maxLength={5000}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
